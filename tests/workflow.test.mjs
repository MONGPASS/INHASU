import test from "node:test";
import assert from "node:assert/strict";
import { WORKFLOW, workflowStatus, defaultQuoteExpiry, isQuoteExpired, requiredLodgeCount } from "../functions/api/_workflow.mjs";
import { onRequestPatch } from '../functions/api/requests/[id].js';
import { requestSQLite } from './helpers/request-sqlite.mjs';
import fs from 'node:fs';
import vm from 'node:vm';

test("workflow follows the customer booking sequence", () => {
  const rec = {};
  assert.equal(workflowStatus(rec), WORKFLOW.REQUESTED);
  rec.quote = {};
  assert.equal(workflowStatus(rec), WORKFLOW.QUOTE_SENT);
  rec.decision = { status:"accepted" };
  assert.equal(workflowStatus(rec), WORKFLOW.QUOTE_ACCEPTED);
  rec.booking = { contract:null, contractInfo:{ depositStatus:"미입금" }, publishStatus:"draft" };
  assert.equal(workflowStatus(rec), WORKFLOW.BOOKING_PREPARED);
  rec.booking.depositRequest = { status:"requested" };
  assert.equal(workflowStatus(rec), WORKFLOW.DEPOSIT_REQUESTED);
  rec.booking.contractInfo.depositStatus = "입금완료";
  assert.equal(workflowStatus(rec), WORKFLOW.DEPOSIT_PAID);
  rec.booking.contract = { signedAt:"2026-07-13" };
  assert.equal(workflowStatus(rec), WORKFLOW.CONTRACT_SIGNED);
  rec.status = "예약확정";
  assert.equal(workflowStatus(rec), WORKFLOW.BOOKING_CONFIRMED);
  rec.booking.publishStatus = "published";
  assert.equal(workflowStatus(rec), WORKFLOW.ITINERARY_PUBLISHED);
});

test("quote expiry defaults to seven days and blocks past quotes", () => {
  const now = new Date("2026-07-13T00:00:00Z");
  assert.equal(defaultQuoteExpiry(now), "2026-07-20T00:00:00.000Z");
  assert.equal(isQuoteExpired({ quoteExpiresAt:"2026-07-12T23:59:59Z" }, now), true);
  assert.equal(isQuoteExpired({ quoteExpiresAt:"2026-07-14T00:00:00Z" }, now), false);
});

test("숙소 배정 수는 귀국일을 제외한 총 박수를 넘지 않는다", () => {
  const sixDays = Array.from({ length:6 }, (_, i) => ({ d:i + 1, stay:{ name:`숙소 ${i + 1}` } }));
  assert.equal(requiredLodgeCount(sixDays), 5);
  assert.equal(requiredLodgeCount(sixDays.slice(0, 1)), 0);
  assert.equal(requiredLodgeCount([
    { stay:{ name:"게르" } },
    { stay:{ name:"숙소미포함" } },
    { stay:{ name:"호텔" } },
    { stay:{ name:"" } },
  ]), 3); // Without a valid booking period, four cards mean three nights.
});

test('서버와 실제 예약 UI는 여행 날짜·빈 카드·당일·윤년·잘못된 날짜에서 같은 숙박 수를 사용한다', () => {
  const html = fs.readFileSync(new URL('../public/예약관리.html', import.meta.url), 'utf8');
  const code = html.slice(html.indexOf('function assignStats()'), html.indexOf('function workflowUi()'));
  const cases = [
    [{ depart:'2026-10-20', return_:'2026-10-22' }, [{d:1}], 2],
    [{ depart:'2026-10-20', return_:'2026-10-22' }, [], 2],
    [{ depart:'2026-10-20', return_:'2026-10-20' }, [{d:1},{d:2},{d:3}], 0],
    [{ depart:'2028-02-28', return_:'2028-03-01' }, [{d:1}], 2],
    [{ depart:'2026-02-30', return_:'2026-03-02' }, [{d:1},{d:2},{d:3}], 2],
    [{ depart:'2026-10-22', return_:'2026-10-20' }, [{d:1},{d:2}], 1],
    [{ depart:'2026-10-20' }, [{d:1},{d:2},{d:3}], 2],
    [{}, [], 0],
  ];
  for (const [period,days,expected] of cases) {
    const context = vm.createContext({ PRE:{status:'예약확정',...period}, BK:{days,assign:{},contractInfo:{}} });
    vm.runInContext(code,context);
    assert.equal(requiredLodgeCount(days,period),expected);
    assert.equal(vm.runInContext('assignStats().lodgeNeeded',context),expected);
  }
});

const booked = (extra = {}) => ({ id:'night-check',status:'예약확정',name:'합성 고객',token:'fixture-customer-token',quote:{price:{deposit:0}},decision:{status:'accepted'},
  depart:'2026-10-20',return_:'2026-10-22',booking:{publishStatus:'draft',days:[{d:1}],contract:{signedAt:'2026-10-01'},
    contractInfo:{depositStatus:'입금완료',totalAmount:0,depositAmount:0,balanceAmount:0},assign:{guide:{name:'합성 가이드'},vehicle:{model:'합성 차량'},lodges:[]}},...extra });
async function publish(t, rec, patch) {
  const originalFetch=globalThis.fetch;let providerCalls=0;
  globalThis.fetch=async()=>{providerCalls++;throw Error('외부 발송 금지');};
  t.after(()=>{globalThis.fetch=originalFetch;assert.equal(providerCalls,0);});
  const DB=requestSQLite(t,rec),pending=[];
  const response=await onRequestPatch({ request:new Request(`https://example.invalid/api/requests/${rec.id}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-admin-token':'fixture-admin'},body:JSON.stringify(patch)}),
    env:{DB,ADMIN_TOKEN:'fixture-admin'},params:{id:rec.id},waitUntil:task=>pending.push(task) });
  await Promise.allSettled(pending);
  return {DB,response};
}

test('실제 PATCH는 3일 투어에 카드가 하나뿐이어도 숙소 2건 미만이면 공개를 거절한다', async t => {
  for(const count of [0,1,2]) await t.test(`숙소 ${count}건`,async sub=>{
    const rec=booked(),booking={...rec.booking,publishStatus:'published',assign:{...rec.booking.assign,lodges:Array.from({length:count},(_,i)=>({day:i+1,name:`합성 숙소 ${i+1}`}))}};
    const {DB,response}=await publish(sub,rec,{booking});
    assert.equal(response.status,count===2?200:409);
    assert.equal(DB.record.booking.publishStatus,count===2?'published':'draft');
    assert.equal(DB.record.booking.contract.signedAt,rec.booking.contract.signedAt);
    assert.deepEqual(DB.record.booking.contractInfo,rec.booking.contractInfo);
    if(count<2){assert.equal((await response.json()).code,'publish_not_ready');assert.equal(DB.requestWrites.length,0);}
  });
});

test('숙박 수 정합성 보완 후에도 취소·보류 공개와 서명 없는 확정을 막고 정상 0원 계약은 보존한다',async t=>{
  for(const status of ['예약취소','cancelled','보류']) await t.test(status,async sub=>{
    const rec=booked({status});rec.booking.assign.lodges=[{day:1,name:'첫 숙소'},{day:2,name:'둘째 숙소'}];
    const {DB,response}=await publish(sub,rec,{booking:{...rec.booking,publishStatus:'published'}});
    assert.equal(response.status,409);assert.equal(DB.record.status,status);assert.equal(DB.record.booking.publishStatus,'draft');assert.equal(DB.requestWrites.length,0);
  });
  await t.test('서명 없는 확정',async sub=>{
    const rec=booked({status:'진행중'});rec.booking.contract=null;
    const {DB,response}=await publish(sub,rec,{status:'예약확정'});assert.equal(response.status,409);assert.equal((await response.json()).code,'confirmation_not_ready');assert.equal(DB.record.booking.contract,null);
  });
});
