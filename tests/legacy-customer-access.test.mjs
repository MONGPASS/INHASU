import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet as quote } from '../functions/api/my/[token].js';
import { onRequestGet as travelers, onRequestPost as submitTravelers } from '../functions/api/travelers/[token].js';
import { onRequestPost as sign } from '../functions/api/sign/[token].js';
import { onRequestPost as deposit } from '../functions/api/deposit/[token].js';
import { onRequestPost as createRequest } from '../functions/api/requests.js';
import { requestSQLite } from './helpers/request-sqlite.mjs';
import { customerIdentity } from './helpers/customer-session.mjs';

const customerToken = 'synthetic-original-customer-link';
const privateTraveler = { nameKo:'합성 여행자',passportName:'SYNTHETIC TRAVELER',birth:'1990-01-01',phone:'01012345678',gender:'남',passportNo:'M12345678' };
const record = () => ({ id:'legacy-1',token:customerToken,name:'PRIVATE-CUSTOMER',email:'fixture-customer@example.invalid',
  phone:'01012345678',adult:1,depart:'2026-11-01',return_:'2026-11-03',destination:'PRIVATE-TOUR',status:'예약확정',
  // Old requests accepted this field from arbitrary JSON. It must never grant access.
  userId:'fixture-customer',booking:{publishStatus:'published',days:[{d:1,dest:'PRIVATE-SCHEDULE'}],travelers:[privateTraveler],
    contractInfo:{depositStatus:'입금완료'},contractRequest:{status:'requested'}} });
function fixture(t, linked = true) {
  const DB=requestSQLite(t,record()), owner=customerIdentity(DB,{...(linked?{resourceId:'legacy-1'}:{})});
  const other=customerIdentity(DB,{user:'other'}), passwordOnly=customerIdentity(DB,{user:'password-only',google:false});
  const admin=customerIdentity(DB,{user:'admin',role:'admin',google:false});
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('외부 발송은 사용하지 않는다.');};
  t.after(()=>{globalThis.fetch=original;assert.equal(calls,0);});
  const request=(handler,{headers={},body,token=customerToken}={})=>handler({
    request:new Request(`https://customer.invalid/api/test/${token}`,{method:body===undefined?'GET':'POST',
      headers:{...headers,...(body===undefined?{}:{'Content-Type':'application/json',Origin:'https://customer.invalid'})},
      ...(body===undefined?{}:{body:JSON.stringify(body)})}),env:{DB,ADMIN_TOKEN:'admin-secret'},params:{token} });
  return {DB,owner,other,passwordOnly,admin,request};
}
const writes = [
  [submitTravelers,{consent:true,travelers:[privateTraveler]}],
  [deposit,{name:'변조된 입금자'}],
  [sign,{agree:true,signerName:'합성 고객',signImg:'data:image/png;base64,'+'A'.repeat(300)}],
];

test('기존 견적 링크는 Google 로그인과 확인된 소유자가 있어야 문서·여권 정보를 반환한다',async t=>{
  const f=fixture(t);
  for(const headers of [{},f.passwordOnly,f.other]) for(const handler of [quote,travelers]) {
    const response=await f.request(handler,{headers});
    assert.equal(response.status,headers===f.other?403:401);
    assert.doesNotMatch(await response.text(),/PRIVATE-|M12345678|1990-01-01|01012345678/);
  }
  const safe=await f.request(quote,{headers:f.owner});assert.equal(safe.status,200);
  assert.doesNotMatch(await safe.text(),/M12345678|1990-01-01|01012345678/);
  const full=await f.request(travelers,{headers:f.owner});assert.equal(full.status,200);
  assert.equal((await full.json()).travelers[0].passportNo,privateTraveler.passportNo);
});

test('미연결 견적은 과거 JSON userId·일치하는 연락처만으로 소유권을 얻지 않는다',async t=>{
  const f=fixture(t,false),before=f.DB.record;
  for(const [handler,body] of [[quote],[travelers],...writes]) {
    const response=await f.request(handler,{headers:f.owner,body});
    assert.equal(response.status,403);assert.equal((await response.json()).code,'claim_required');
  }
  assert.deepEqual(f.DB.record,before);assert.equal(f.DB.requestWrites.length,0);
});

test('비로그인·타계정 고객은 여행자·입금·서명 제출로 기존 자료를 변경할 수 없다',async t=>{
  const f=fixture(t),before=f.DB.record;
  for(const headers of [{},f.passwordOnly,f.other]) for(const [handler,body] of writes) {
    const response=await f.request(handler,{headers,body});assert.equal(response.status,headers===f.other?403:401);
  }
  assert.deepEqual(f.DB.record,before);assert.equal(f.DB.requestWrites.length,0);
});

test('로그인 소유자의 여행자·입금·서명 저장은 유지하며 서명 재제출은 증빙을 덮지 않는다',async t=>{
  const f=fixture(t);
  for(const [handler,body] of writes) assert.equal((await f.request(handler,{headers:f.owner,body})).status,200);
  const before=f.DB.record.booking.contract;
  assert.equal((await f.request(sign,{headers:f.owner,body:writes[2][1]})).status,409);
  assert.deepEqual(f.DB.record.booking.contract,before);
  assert.equal(f.DB.record.booking.travelerSubmission.status,'submitted');
  assert.equal(f.DB.record.booking.depositReport.status,'reported');
});

test('관리자 미리보기는 실제 관리자 인증이 필요하고 교차 사이트 쓰기는 소유자도 거절한다',async t=>{
  const f=fixture(t,false);
  for(const headers of [f.admin,{'x-admin-token':'admin-secret'}]) assert.equal((await f.request(quote,{headers})).status,200);
  for(const [handler,body] of writes) {
    const request=new Request(`https://customer.invalid/api/test/${customerToken}`,{method:'POST',headers:{...f.admin,Origin:'https://evil.invalid','Content-Type':'application/json'},body:JSON.stringify(body)});
    const response=await handler({request,env:{DB:f.DB},params:{token:customerToken}});
    assert.equal(response.status,403);assert.equal((await response.json()).code,'invalid_origin');
  }
  assert.equal(f.DB.requestWrites.length,0);
});

test('새 맞춤 견적은 Google 고객만 요청하고 전달된 소유자·ID 대신 서버에서 계정과 연결한다',async t=>{
  const DB=requestSQLite(t,null,{skipInsert:true}),owner=customerIdentity(DB),passwordOnly=customerIdentity(DB,{user:'password-only',google:false});
  const payload={id:'forged-id',name:'합성 고객',phone:'01098765432',email:'old-contact@example.invalid',depart:'2026-11-01',return_:'2026-11-03',adult:2,agree:true,
    tripType:'맞춤',destination:'고비',cityStay:'호텔',gerStay:'게르',vehicle:'전용 차량(4인)',flightIssued:'미발권',userId:'another-user',user_id:'another-user',ownerId:'another-user'};
  const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('외부 발송 금지');};
  t.after(()=>{globalThis.fetch=original;assert.equal(calls,0);});
  const post=(headers={})=>createRequest({request:new Request('https://customer.invalid/api/requests',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://customer.invalid',...headers},body:JSON.stringify(payload)}),env:{DB}});
  for(const headers of [{},passwordOnly]) {
    const response=await post(headers);assert.equal(response.status,401);assert.equal((await response.json()).code,'login_required');
  }
  assert.equal(DB.records.length,0);
  const denied=await post({...owner,Origin:'https://evil.invalid'});assert.equal(denied.status,403);assert.equal(DB.records.length,0);
  payload.booking={contract:{signImg:'FORGED-SIGNATURE'},deposit:{paid:true}};
  payload.quote={price:{total:0}};payload.activities=[{type:'signed'}];payload.status='예약확정';
  const response=await post(owner);assert.equal(response.status,200);
  const saved=await response.json();assert.notEqual(saved.id,'forged-id');
  assert.equal(DB.records.length,1);assert.equal(DB.records[0].userId,'fixture-customer');
  assert.equal(DB.records[0].booking,undefined);assert.equal(DB.records[0].quote,undefined);
  assert.equal(DB.records[0].activities,undefined);assert.equal(DB.records[0].status,'신규');
  for(const key of ['user_id','ownerId']) assert.notEqual(DB.records[0][key],'another-user');
  const link=DB.raw.prepare('SELECT * FROM customer_resource_links WHERE source=? AND resource_id=?').get('request',saved.id);
  assert.equal(link.user_id,'fixture-customer');
  assert.equal((await quote({request:new Request('https://customer.invalid/api/my/'+saved.token,{headers:owner}),env:{DB},params:{token:saved.token}})).status,200);
});

test('관리자 대리 접수는 고객을 임의 계정에 연결하지 않으며 연결 저장 실패 때 새 문의도 롤백한다',async t=>{
  const DB=requestSQLite(t,null,{skipInsert:true}),owner=customerIdentity(DB);
  const payload={id:'admin-created',name:'합성 대리 고객',phone:'01011112222',source:'walkin',quote:{customer:'합성 대리 고객'},silentQuote:true,userId:'another-user'};
  let response=await createRequest({request:new Request('https://customer.invalid/api/requests',{method:'POST',headers:{'Content-Type':'application/json','x-admin-token':'fixture-admin'},body:JSON.stringify(payload)}),env:{DB,ADMIN_TOKEN:'fixture-admin'}});
  assert.equal(response.status,200);assert.equal(DB.raw.prepare('SELECT COUNT(*) AS n FROM customer_resource_links').get().n,0);
  DB.raw.exec(`CREATE TRIGGER reject_link BEFORE INSERT ON customer_resource_links BEGIN SELECT RAISE(FAIL,'synthetic link failure'); END;`);
  const body={name:'합성 신규 고객',phone:'01099998888',email:'local@example.invalid',depart:'2026-11-01',return_:'2026-11-03',adult:2,agree:true,
    tripType:'맞춤',destination:'고비',cityStay:'호텔',gerStay:'게르',vehicle:'전용 차량(4인)',flightIssued:'미발권'};
  response=await createRequest({request:new Request('https://customer.invalid/api/requests',{method:'POST',headers:{'Content-Type':'application/json',...owner},body:JSON.stringify(body)}),env:{DB}});
  assert.equal(response.status,500);assert.equal(DB.records.length,1);assert.equal(DB.records[0].id,'admin-created');
});
