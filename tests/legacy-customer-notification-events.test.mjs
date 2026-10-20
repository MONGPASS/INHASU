// End-to-end legacy handlers + SQLite + the real delivery engine; the provider
// boundary is replaced and fails if anything except the local Solapi stub runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as createRequest } from '../functions/api/requests.js';
import { onRequestPatch as patchRequest } from '../functions/api/requests/[id].js';
import { onRequestPost as signRequest } from '../functions/api/sign/[token].js';
import { requestSQLite } from './helpers/request-sqlite.mjs';

const kinds = ['request_received','quote','reservation_requested','change_requested','deposit_requested','travelers_requested','contract','contract_signed','booking_confirmed','itinerary','travel_notice'];
const config = { ADMIN_TOKEN:'local-admin', SOLAPI_API_KEY:'local-key', SOLAPI_API_SECRET:'local-secret', SOLAPI_PF_ID:'local-profile',
  ...Object.fromEntries(kinds.map(kind => [`SOLAPI_TEMPLATE_${kind.toUpperCase()}_ID`, `local-${kind}`])) };
const basic = () => ({ id:'req-1', token:'local-customer-token-123456789', name:'저장된 고객', phone:'01012345678', depart:'2026-11-01', return_:'2026-11-02', adult:2,
  status:'진행중', quote:{ customer:'저장된 고객', price:{ total:2000000, deposit:500000 } }, activities:[] });
const booking = () => ({ days:[{ d:1, dest:'울란바토르', items:['공항 픽업'] },{ d:2, dest:'테렐지', items:['초원 산책'] }], publishStatus:'draft',
  contractInfo:{ depositAmount:500000, depositStatus:'미입금', bankName:'로컬 은행', accountNumber:'LOCAL-ACCOUNT', accountHolder:'로컬 여행사' },
  assign:{ guide:{name:'등록 가이드'},vehicle:{model:'등록 차량'},lodges:[{day:1,name:'등록 숙소'}] } });
function fixture(t, record = basic(), options) {
  const DB = requestSQLite(t, record, options), env = { ...config, DB }, sent = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.solapi.com/messages/v4/send');
    const message = JSON.parse(init.body).message; assert.equal(message.kakaoOptions.disableSms, true); assert.equal(message.text, undefined);
    assert.ok(DB.records.length > 0, 'business row must be persisted before delivery');
    assert.ok(DB.deliveries.some(item => item.state === 'sending'), 'delivery claim must precede provider request');
    sent.push(message); return Response.json({ groupId:'local-receipt-' + sent.length, statusCode:'2000' });
  };
  t.after(() => globalThis.fetch = originalFetch);
  const patch = (body, context = {}) => patchRequest({ request:new Request('https://local.example.invalid/api/requests/req-1', {
    method:'PATCH',headers:{'Content-Type':'application/json','x-admin-token':'local-admin'},body:JSON.stringify(body) }),env,params:{id:'req-1'},...context });
  const sign = (context = {}) => signRequest({ request:new Request('https://local.example.invalid/api/sign/' + record.token, {
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({agree:true,signerName:'저장된 고객',signImg:'data:image/png;base64,' + 'A'.repeat(300)}) }),env,params:{token:record.token},...context });
  return { DB,env,sent,patch,sign };
}

test('비회원 정상 요청 저장 후 접수 안내 1건이며 관리자 silent 저장·honeypot·거절은 발송하지 않는다', async t => {
  const f = fixture(t, null, {skipInsert:true});
  const body = {name:'새 고객',phone:'01098765432',email:'local@example.invalid',depart:'2026-11-01',return_:'2026-11-03',adult:2,agree:true,
    tripType:'맞춤',destination:'고비',cityStay:'호텔',gerStay:'게르',vehicle:'전용 차량(4인)',flightIssued:'미발권'};
  const post = (data, admin = false) => createRequest({ request:new Request('https://local.example.invalid/api/requests', {method:'POST',headers:{'Content-Type':'application/json',...(admin?{'x-admin-token':'local-admin'}:{})},body:JSON.stringify(data)}),env:f.env });
  const response = await post(body); assert.equal(response.status,200); const saved = await response.json();
  assert.deepEqual(f.sent.map(message=>message.kakaoOptions.templateId),['local-request_received']);
  assert.equal(f.sent[0].to,'01098765432'); assert.ok(f.sent[0].kakaoOptions.variables['#{링크}'].includes(saved.token));
  assert.equal((await post({...body,website:'bot'})).status,200);
  assert.equal((await post({...body,phone:'01011112222',agree:false})).status,400);
  assert.equal((await post({id:'silent-admin',name:'내부 저장',phone:'01011112222',source:'walkin',quote:{customer:'내부 저장'},silentQuote:true},true)).status,200);
  assert.equal(f.sent.length,1); assert.equal(f.DB.deliveries.length,1);
});

test('수락과 새 변경 요청 ID는 저장된 사건만 안내하며 반복 저장이나 동일 ID 수정으로 재발송하지 않는다', async t => {
  const f = fixture(t);
  const decision={status:'accepted',acceptedAt:'2026-10-20T01:00:00Z',source:'admin'};
  assert.equal((await f.patch({decision})).status,200); assert.equal((await f.patch({decision,memo:'보존할 상담'})).status,200);
  const first={id:'change-a',at:'2026-10-20T02:00:00Z',text:'숙소 변경'};
  assert.equal((await f.patch({changeRequests:[first]})).status,200);
  assert.equal((await f.patch({changeRequests:[{...first,text:'같은 요청의 보완'}]})).status,200);
  assert.equal((await f.patch({changeRequests:[first,{id:'change-b',at:'2026-10-20T03:00:00Z',text:'출발일 변경'}]})).status,200);
  assert.deepEqual(f.sent.map(message=>message.kakaoOptions.templateId),['local-reservation_requested','local-change_requested','local-change_requested']);
  assert.equal(f.DB.record.memo,'보존할 상담'); assert.equal(f.DB.record.changeRequests.length,2);
});

test('요청 플래그·최초 실제 입금·예약 확정·일정 공개가 각 전용 알림으로 연결되고 저장만으로 재전송하지 않는다', async t => {
  const row={...basic(),decision:{status:'accepted'},booking:booking()}, f=fixture(t,row);
  assert.equal((await f.patch({notifyDeposit:true})).status,200);
  assert.equal((await f.patch({notifyTravelers:true})).status,200);
  assert.equal((await f.patch({confirmDeposit:true})).status,200);
  assert.equal((await f.patch({confirmDeposit:true})).status,200);
  const signed={...f.DB.record.booking,contract:{signedAt:'2026-10-20T01:00:00Z'}};
  assert.equal((await f.patch({booking:signed,status:'예약확정'})).status,200);
  assert.equal((await f.patch({booking:{...f.DB.record.booking,publishStatus:'published'}})).status,200);
  assert.equal((await f.patch({booking:f.DB.record.booking,memo:'일정 일반 저장'})).status,200);
  assert.deepEqual(f.sent.map(message=>message.kakaoOptions.templateId),['local-deposit_requested','local-travelers_requested','local-contract','local-booking_confirmed','local-itinerary']);
  assert.equal(f.DB.record.booking.travelerSubmission.status,'requested'); assert.equal(f.DB.record.booking.depositRequest.status,'requested');
  assert.equal(f.DB.deliveries.filter(item=>item.kind==='contract').length,1);
});

test('동시 최초 서명은 CAS 성공 1건만 접수·준비 안내하고 수동 근접 재안내도 원장에서 중복 차단한다', async t => {
  const row={...basic(),booking:{...booking(),contractInfo:{...booking().contractInfo,depositStatus:'입금완료'}}}, f=fixture(t,row);
  const responses=await Promise.all([f.sign(),f.sign()]); assert.deepEqual(responses.map(response=>response.status).sort(),[200,409]);
  assert.deepEqual(f.sent.map(message=>message.kakaoOptions.templateId).sort(),['local-contract_signed','local-travel_notice']);
  assert.equal(f.DB.record.notify.travelNoticeSentCount,1); assert.ok(f.DB.record.notify.travelNoticeAutoSentAt);
  const manual=await (await f.patch({notifyTravelNotice:true,memo:'서명 후 수동 확인'})).json();
  assert.equal(manual.ok,true); assert.equal(manual.travelNotice.duplicate,true); assert.equal(f.sent.length,2); assert.equal(f.DB.record.notify.travelNoticeSentCount,1);
  f.DB.raw.prepare("UPDATE admin_delivery_attempts SET created_at=? WHERE kind='travel_notice'").run(new Date(Date.now()-61_000).toISOString());
  assert.equal((await (await f.patch({notifyTravelNotice:true})).json()).travelNotice.ok,true);
  assert.equal(f.sent.length,3); assert.equal(f.DB.record.notify.travelNoticeSentCount,2); assert.equal(f.DB.record.memo,'서명 후 수동 확인');
});

test('서명 전 준비 안내·서명 CAS 거절은 발송하지 않으며 알림 실패도 예약·서명 저장을 취소하지 않는다', async t => {
  const f=fixture(t,{...basic(),booking:booking()});
  const blocked=await (await f.patch({notifyTravelNotice:true,memo:'서명 전 메모'})).json();
  assert.equal(blocked.ok,true); assert.equal(blocked.travelNotice.ok,false); assert.match(blocked.travelNotice.reason,/서명/); assert.equal(f.sent.length,0); assert.equal(f.DB.record.memo,'서명 전 메모');
  const current=f.DB.record; current.booking.contractInfo.depositStatus='입금완료';
  f.DB.raw.prepare('UPDATE requests SET data=? WHERE id=?').run(JSON.stringify(current),'req-1');
  f.DB.raw.exec(`CREATE TRIGGER ignore_signature BEFORE UPDATE ON requests WHEN json_extract(NEW.data,'$.booking.contract.signedAt') IS NOT NULL BEGIN SELECT RAISE(IGNORE); END;`);
  assert.equal((await f.sign()).status,409); assert.equal(f.sent.length,0); assert.equal(f.DB.record.booking.contract,undefined);
  f.DB.raw.exec('DROP TRIGGER ignore_signature');
  globalThis.fetch=async()=>Response.json({errorMessage:'Local provider unavailable'},{status:503});
  assert.equal((await f.sign()).status,200); assert.ok(f.DB.record.booking.contract.signedAt); assert.equal(f.DB.record.notify?.travelNoticeSentAt,undefined);
  assert.ok(f.DB.deliveries.some(item=>item.kind==='travel_notice'&&item.state==='unknown'));
});

test('발송 중 새 여행자·메모 저장은 notify 호환 갱신에 덮이지 않고 waitUntil 없는 실행도 이력을 남긴다', async t => {
  const row={...basic(),booking:{...booking(),contract:{signedAt:'2026-10-20T01:00:00Z'}}}, f=fixture(t,row);
  globalThis.fetch=async(url,init)=>{
    assert.equal(url,'https://api.solapi.com/messages/v4/send'); const message=JSON.parse(init.body).message; f.sent.push(message);
    const latest=f.DB.record; latest.memo='동시 저장한 메모'; latest.booking.travelers=[{nameKo:'동시 제출한 고객'}];
    f.DB.raw.prepare('UPDATE requests SET data=?,memo=? WHERE id=?').run(JSON.stringify(latest),latest.memo,'req-1');
    return Response.json({groupId:'local-concurrent-receipt',statusCode:'2000'});
  };
  const body=await (await f.patch({notifyTravelNotice:true})).json();
  assert.equal(body.ok,true); assert.equal(body.travelNotice.state,'accepted'); assert.equal(f.DB.record.memo,'동시 저장한 메모');
  assert.equal(f.DB.record.booking.travelers[0].nameKo,'동시 제출한 고객'); assert.equal(f.DB.record.notify.travelNoticeSentCount,1);
});

test('명시 견적 공유·계약 재안내는 짧은 중복을 막고 1분 뒤 같은 문서도 다시 보낼 수 있다', async t => {
  const row={...basic(),booking:{...booking(),contractInfo:{...booking().contractInfo,depositStatus:'입금완료'}}}, f=fixture(t,row);
  assert.equal((await f.patch({notifyQuote:true,notifyContract:true})).status,200);
  assert.equal(f.sent.length,2);
  assert.equal((await f.patch({notifyQuote:true,notifyContract:true})).status,200); assert.equal(f.sent.length,2);
  f.DB.raw.prepare('UPDATE admin_delivery_attempts SET created_at=?').run(new Date(Date.now()-61_000).toISOString());
  await new Promise(resolve=>setTimeout(resolve,2));
  assert.equal((await f.patch({notifyQuote:true,notifyContract:true})).status,200); assert.equal(f.sent.length,4);
  assert.deepEqual(f.sent.map(message=>message.kakaoOptions.templateId),['local-quote','local-contract','local-quote','local-contract']);
});
