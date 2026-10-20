// Actual Hono, Drizzle and Lucia persistence; only the Google provider boundary is synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { requestSQLite } from './helpers/request-sqlite.mjs';
import { customerIdentity } from './helpers/customer-session.mjs';
import { safeCustomerReturn } from '../functions/lib/customerAccess.ts';

const bundled = await build({ entryPoints:['functions/api/auth.ts'], bundle:true, platform:'node',format:'esm',write:false,
  plugins:[{name:'local-google-provider',setup(builder){
    builder.onResolve({filter:/^arctic$/},()=>({path:'google-provider',namespace:'local-oauth'}));
    builder.onLoad({filter:/.*/,namespace:'local-oauth'},()=>({contents:`
      export const generateState=()=> 'fixture-state';
      export const generateCodeVerifier=()=> 'fixture-verifier';
      export class Google {
        createAuthorizationURL(state,verifier,scopes){
          if(verifier!=='fixture-verifier'||!scopes.includes('email'))throw Error('Invalid PKCE setup');
          return new URL('https://accounts.google.com/o/oauth2/v2/auth?state='+state);
        }
        async validateAuthorizationCode(code,verifier){
          if(code!=='fixture-code'||verifier!=='fixture-verifier')throw Error('Invalid authorization exchange');
          return {accessToken:()=> 'fixture-access-token'};
        }
      }` }));
  }}] });
const auth=(await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].contents).toString('base64'))).default;
const env={ENVIRONMENT:'production',GOOGLE_CLIENT_ID:'fixture-id',GOOGLE_CLIENT_SECRET:'fixture-secret'};
const validProfile=()=>({sub:'google-fixture-customer',email:'owner@gmail.com',email_verified:true,name:'합성 고객',picture:'https://images.example.invalid/avatar.png'});
function fixture(t){
  const DB=requestSQLite(t,null,{skipInsert:true});
  DB.raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT UNIQUE,email TEXT UNIQUE,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
    CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);`);
  let profile=validProfile(),status=200,calls=0;
  const original=globalThis.fetch;
  globalThis.fetch=async(url,init)=>{
    calls++;assert.equal(url,'https://openidconnect.googleapis.com/v1/userinfo');
    assert.equal(init.headers.Authorization,'Bearer fixture-access-token');
    return Response.json(profile,{status});
  };
  t.after(()=>{globalThis.fetch=original;});
  const request=(path,cookie)=>auth.request('https://site.invalid'+path,{headers:cookie?{cookie}:{}},{...env,DB});
  const callback=(redirect='/',extra='')=>request('/login/google/callback?code=fixture-code&state=fixture-state'+extra,
    'google_oauth_state=fixture-state; google_code_verifier=fixture-verifier; post_login_redirect='+encodeURIComponent(redirect));
  return {DB,request,callback,get calls(){return calls;},setProfile(value,code=200){profile=value;status=code;}};
}
const cleared=(response,name)=>assert.ok(response.headers.getSetCookie().some(value=>value.startsWith(name+'=;')&&value.includes('Max-Age=0')),name);

test('고객 복귀 주소는 원래 문서의 경로·쿼리를 보존하고 외부 주소·역슬래시·제어문자를 거절한다',()=>{
  const original='/계약서.html?t=customer-fixture&from=notice#signature';
  assert.equal(safeCustomerReturn(original),original);
  for(const value of ['https://evil.invalid','//evil.invalid','/\\evil.invalid','/\nevil.invalid','/\revil.invalid','/\tevil.invalid','/%5Cevil.invalid','/%2F%2Fevil.invalid','/%0aevil.invalid','javascript:alert(1)',null]){
    assert.equal(safeCustomerReturn(value),'/');
  }
});

test('Google 로그인 시작은 PKCE·state·복귀 주소를 HttpOnly로 보관하며 새 요청에 복귀 주소가 없으면 이전 쿠키를 지운다',async t=>{
  const f=fixture(t),target='/내견적.html?t=fixture-customer-key';
  let response=await f.request('/login/google?redirect='+encodeURIComponent(target));
  assert.equal(response.status,302);assert.equal(new URL(response.headers.get('Location')).hostname,'accounts.google.com');
  for(const name of ['google_oauth_state','google_code_verifier','post_login_redirect']){
    const cookie=response.headers.getSetCookie().find(value=>value.startsWith(name+'='));
    assert.ok(cookie);assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Lax/);assert.match(cookie,/Secure/);
  }
  response=await f.request('/login/google','post_login_redirect=%2Fold');cleared(response,'post_login_redirect');
  response=await f.request('/login/google?redirect='+encodeURIComponent('/\\evil.invalid'));cleared(response,'post_login_redirect');
  assert.equal(f.calls,0);
});

test('잘못된 OAuth state·누락 PKCE는 Google에 접근하지 않고 로그인 쿠키를 만료시킨다',async t=>{
  const f=fixture(t);
  for(const cookie of [undefined,'google_oauth_state=wrong; google_code_verifier=fixture-verifier','google_oauth_state=fixture-state']){
    const response=await f.request('/login/google/callback?code=fixture-code&state=fixture-state',cookie);
    assert.equal(response.status,302);assert.equal(response.headers.get('Location'),'/login?error=google_state');
    cleared(response,'google_oauth_state');cleared(response,'google_code_verifier');
  }
  assert.equal(f.calls,0);assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
});

test('검증되지 않은 이메일·userinfo 오류는 Google 계정과 고객 세션을 만들지 않는다',async t=>{
  const f=fixture(t);
  for(const [profile,status] of [[{...validProfile(),email_verified:false},200],[{...validProfile(),email_verified:'true'},200],[{...validProfile(),sub:''},200],[{...validProfile(),email:''},200],[validProfile(),503]]){
    f.setProfile(profile,status);const response=await f.callback('/mypage');
    assert.equal(response.headers.get('Location'),'/login?error=google_failed&returnTo=%2Fmypage');
    assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM users').get().n,0);
    assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
  }
});

test('Google 고객은 서버가 정한 일반 계정으로 생성되고 실제 Lucia 세션으로 원래 안내 링크에 돌아온다',async t=>{
  const f=fixture(t),target='/내견적.html?t=original-customer-link';
  const response=await f.callback(target);assert.equal(response.status,302);
  assert.equal(decodeURI(response.headers.get('Location')),target);
  const user=f.DB.raw.prepare('SELECT * FROM users').get();assert.equal(user.google_id,validProfile().sub);assert.equal(user.role,'user');
  const cookie=response.headers.getSetCookie().find(value=>value.startsWith('auth_session='));
  assert.ok(cookie);assert.match(cookie,/Secure/);assert.match(cookie,/HttpOnly/);
  const me=await f.request('/me',cookie.split(';')[0]);assert.equal((await me.json()).user.id,user.id);
  cleared(response,'post_login_redirect');cleared(response,'google_oauth_state');cleared(response,'google_code_verifier');
});

test('Google 이메일이 관리자 또는 다른 Google 계정과 충돌하면 기존 계정·세션에 연결하지 않는다',async t=>{
  for(const [role,googleId] of [['admin',null],['user','google-different']])await t.test(`${role} ${googleId}`,async sub=>{
    const f=fixture(sub);f.DB.raw.prepare('INSERT INTO users(id,email,role,google_id,password_hash) VALUES(?,?,?,?,?)')
      .run('existing',validProfile().email,role,googleId,role==='admin'?'stored-admin-password':null);
    const response=await f.callback('/mypage');assert.equal(response.headers.get('Location'),'/login?error=google_linked&returnTo=%2Fmypage');
    assert.equal(f.DB.raw.prepare('SELECT google_id FROM users').get().google_id,googleId);
    assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
  });
});

test('현재 이메일 소유권을 Google이 보증하지 않는 외부 이메일은 verified=true만으로 기존 계정을 연결하지 않는다',async t=>{
  const f=fixture(t),email='previous-owner@example.invalid';
  f.setProfile({...validProfile(),email});
  f.DB.raw.prepare('INSERT INTO users(id,email,role) VALUES(?,?,?)').run('legacy-owner',email,'user');
  const response=await f.callback('/mypage');assert.equal(response.headers.get('Location'),'/login?error=google_linked&returnTo=%2Fmypage');
  assert.equal(f.DB.raw.prepare('SELECT google_id FROM users').get().google_id,null);
  assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,0);
});

test('이미 연결한 Google sub는 이메일 변경과 관계없이 같은 계정으로 로그인하며 악성 복귀 주소는 홈으로 제한한다',async t=>{
  const f=fixture(t);f.DB.raw.prepare('INSERT INTO users(id,email,google_id,role) VALUES(?,?,?,?)').run('existing-google-owner','old@gmail.com',validProfile().sub,'user');
  const response=await f.callback('/\\evil.invalid');assert.equal(response.headers.get('Location'),'/');
  assert.equal(f.DB.raw.prepare('SELECT user_id FROM sessions').get().user_id,'existing-google-owner');
  assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM users').get().n,1);
});

test('레거시 관리자 문서 확인은 실제 토큰·관리자 세션만 검증하고 계정이나 세션을 만들지 않는다', async t => {
  const f = fixture(t);
  const customer = customerIdentity(f.DB, { user: 'preview-customer' });
  const admin = customerIdentity(f.DB, { user: 'preview-admin', role: 'admin', google: false });
  const check = (headers = {}, configuration = {}) => auth.request('https://site.invalid/legacy-admin/check?preview=1&adminPrint=1', {
    method: 'POST', headers: { Origin: 'https://site.invalid', ...headers },
  }, { ...env, DB: f.DB, ADMIN_TOKEN: 'actual-legacy-fixture', ...configuration });
  for (const headers of [{}, { 'x-admin-token': 'forged' }, customer]) {
    const response = await check(headers); assert.equal(response.status, 401); assert.deepEqual(await response.json(), { ok: false, code: 'access_denied' });
    assert.equal(response.headers.has('Set-Cookie'), false); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
  let response = await check({ 'x-admin-token': 'actual-legacy-fixture' });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, legacyAdmin: true });
  assert.equal(response.headers.has('Set-Cookie'), false);
  response = await check(admin); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true, legacyAdmin: false });
  response = await check({ 'x-admin-token': 'actual-legacy-fixture' }, { ADMIN_TOKEN: '' }); assert.equal(response.status, 401);
  for (const headers of [{ Origin: 'https://outside.invalid' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    response = await check({ 'x-admin-token': 'actual-legacy-fixture', ...headers }); assert.equal(response.status, 403);
  }
  assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 2); assert.equal(f.calls, 0);
});
