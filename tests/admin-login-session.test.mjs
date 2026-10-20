import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { requestSQLite } from './helpers/request-sqlite.mjs';

const bundled = await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
  import { Hono } from 'hono';
  import auth from './functions/api/auth.ts';
  import { requireAdmin } from './functions/lib/adminAuth.ts';
  import { requireAuth } from './functions/lib/userAuth.ts';
  export { hashPassword } from './functions/lib/password.ts';
  const app = new Hono();
  app.route('/auth', auth);
  app.get('/admin', requireAdmin, c => c.json({ ok: true }));
  app.get('/user', requireAuth, c => c.json({ ok: true }));
  export default app;
` }, bundle: true, platform: 'node', format: 'esm', write: false });
const { default: app, hashPassword } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'));
const password = 'local-session-fixture-2026';
const passwordHash = await hashPassword(password);
function fixture(t) {
  const DB = requestSQLite(t, null, { skipInsert: true });
  DB.raw.exec('CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT UNIQUE,email TEXT UNIQUE,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT); CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);');
  DB.raw.prepare('INSERT INTO users(id,email,name,role,password_hash) VALUES(?,?,?,?,?)').run('admin-1', 'admin@example.invalid', '합성 관리자', 'admin', passwordHash);
  DB.raw.prepare('INSERT INTO users(id,email,name,role,password_hash) VALUES(?,?,?,?,?)').run('user-1', 'user@example.invalid', '합성 고객', 'user', passwordHash);
  const request = (path, init = {}) => app.request('https://site.invalid' + path, init, { DB, ENVIRONMENT: 'production' });
  const login = (remember, email = 'admin@example.invalid', suppliedPassword = password) => request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: suppliedPassword, ...(remember === undefined ? {} : { remember }) }) });
  return { DB, request, login };
}
const sessionCookie = (response) => response.headers.getSetCookie().find(value => value.startsWith('auth_session='));
const cookieHeader = (response) => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
const security = (cookie) => { assert.match(cookie, /HttpOnly/); assert.match(cookie, /Secure/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Path=\//); };

test('로그인 상태 유지는 기존 서버 만료 기간을 유지하고 해제하면 보안 속성이 있는 브라우저 세션 쿠키를 발급한다', async t => {
  const f = fixture(t);
  for (const remember of [undefined, true, false]) {
    const response = await f.login(remember); assert.equal(response.status, 200);
    const cookie = sessionCookie(response); security(cookie);
    const marker = response.headers.getSetCookie().find(value => value.startsWith('admin_session_mode='));
    security(marker);
    if (remember === false) { assert.doesNotMatch(cookie, /Max-Age|Expires/i); assert.match(marker, /^admin_session_mode=session;/); assert.doesNotMatch(marker, /Max-Age|Expires/i); }
    else { assert.match(cookie, /Max-Age=\d+/); assert.match(marker, /Max-Age=0/); }
    assert.equal((await f.request('/admin', { headers: { cookie: cookieHeader(response) } })).status, 200);
    assert.ok(f.DB.raw.prepare('SELECT expires_at FROM sessions WHERE id=?').get(cookie.split(';')[0].split('=')[1]).expires_at > Math.floor(Date.now() / 1000) + 86400);
  }
});

test('세션 갱신과 로그아웃은 로그인 유지 해제 선택을 보존하고 실제 Lucia 세션을 폐기한다', async t => {
  const f = fixture(t), response = await f.login(false), cookie = cookieHeader(response);
  const id = sessionCookie(response).split(';')[0].split('=')[1];
  for (const path of ['/auth/me', '/admin', '/user']) {
    f.DB.raw.prepare('UPDATE sessions SET expires_at=? WHERE id=?').run(Math.floor(Date.now() / 1000) + 60, id);
    const refreshed = await f.request(path, { headers: { cookie } }); assert.equal(refreshed.status, 200);
    security(sessionCookie(refreshed)); assert.doesNotMatch(sessionCookie(refreshed), /Max-Age|Expires/i);
  }
  const logout = await f.request('/auth/logout', { method: 'POST', headers: { cookie } }); assert.equal(logout.status, 200);
  assert.match(sessionCookie(logout), /Max-Age=0/);
  assert.ok(logout.headers.getSetCookie().some(value => value.startsWith('admin_session_mode=;') && value.includes('Max-Age=0')));
  assert.equal((await f.request('/admin', { headers: { cookie } })).status, 401);
});

test('잘못된 로그인 유지 값·비밀번호·일반 계정은 관리자 쿠키를 만들지 않는다', async t => {
  const f = fixture(t);
  for (const [remember, email, suppliedPassword, status] of [['false', undefined, undefined, 400], [false, undefined, 'incorrect', 401], [false, 'user@example.invalid', undefined, 403]]) {
    const response = await f.login(remember, email, suppliedPassword); assert.equal(response.status, status);
    assert.equal(sessionCookie(response), undefined);
    assert.equal(response.headers.getSetCookie().length, 0);
  }
  assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM sessions').get().n, 0);
});
