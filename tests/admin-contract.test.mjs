import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPatch } from "../functions/api/requests/[id].js";
import { onRequestPost as onSignPost } from "../functions/api/sign/[token].js";
import { onRequestPost as onDepositPost } from "../functions/api/deposit/[token].js";
import { requestSQLite } from './helpers/request-sqlite.mjs';
import { customerIdentity } from './helpers/customer-session.mjs';

const makeEnv = () => ({
  ADMIN_TOKEN: "admin-secret",
  DB: {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return {
                data: JSON.stringify({
                  id: "req-1",
                  booking: {
                    contract: {
                      signedAt: "2026-07-13T10:00:00.000Z",
                      signImg: "data:image/png;base64,signature-original",
                    },
                  },
                }),
                status: "예약확정",
                memo: "",
              };
            },
          };
        },
      };
    },
  },
});

test("관리자 인증이 있어야 계약 서명 원본을 조회한다", async () => {
  const env = makeEnv();
  const unauthorized = await onRequestGet({
    request: new Request("https://example.com/api/requests/req-1"), env, params:{ id:"req-1" },
  });
  assert.equal(unauthorized.status, 401);

  const authorized = await onRequestGet({
    request: new Request("https://example.com/api/requests/req-1", {
      headers:{ "x-admin-token":"admin-secret" },
    }),
    env,
    params:{ id:"req-1" },
  });
  assert.equal(authorized.status, 200);
  const body = await authorized.json();
  assert.equal(body.item.booking.contract.signImg, "data:image/png;base64,signature-original");
});

test("5박 6일은 숙소 5개 배정 후 일정표를 공개할 수 있다", async t => {
  const days = Array.from({ length:6 }, (_, i) => ({ d:i + 1, stay:{ name:`숙소 ${i + 1}` } }));
  const booking = {
    days,
    assign:{
      guide:{ name:"빌궁" }, vehicle:{ model:"토요타 벨파이어" },
      lodges:Array.from({ length:5 }, (_, i) => ({ day:i + 1, name:`숙소 ${i + 1}` })),
    },
    contract:{ signedAt:"2026-07-13T10:00:00.000Z", signImg:"data:image/png;base64,signature-original" },
    contractInfo:{ depositStatus:"입금완료" }, publishStatus:"draft",
  };
  const rec = { id:"req-1", quote:{}, decision:{ status:"accepted" }, status:"예약확정", booking };
  const DB = requestSQLite(t, rec), env = { ADMIN_TOKEN:'admin-secret', DB }, pending = [];
  const response = await onRequestPatch({
    request:new Request("https://example.com/api/requests/req-1", {
      method:"PATCH", headers:{ "Content-Type":"application/json", "x-admin-token":"admin-secret" },
      body:JSON.stringify({ booking:{ ...booking, publishStatus:"published" } }),
    }),
    env, params:{ id:"req-1" }, waitUntil(task) { pending.push(task); },
  });
  assert.equal(response.status, 200);
  await Promise.all(pending); assert.ok(DB.requestWrites.length);
  assert.equal((await response.json()).publishStatus, "published");
});

test("확정일정표 최초 공개 시 고객 직링크 알림톡을 한 번 요청한다", async t => {
  const days = Array.from({ length:3 }, (_, i) => ({ d:i + 1, dest:`저장 일정 ${i + 1}`, stay:{ name:`숙소 ${i + 1}` } }));
  const booking = {
    days,
    assign:{
      guide:{ name:"빌궁" }, vehicle:{ model:"토요타 벨파이어" },
      lodges:[{ day:1, name:"숙소 1" }, { day:2, name:"숙소 2" }],
    },
    contract:{ signedAt:"2026-07-13T10:00:00.000Z" },
    contractInfo:{ depositStatus:"입금완료" }, publishStatus:"draft",
  };
  const rec = {
    id:"req-1", token:"customer-token", name:"홍길동", phone:"01012345678",
    quote:{}, decision:{ status:"accepted" }, status:"예약확정", booking,
  };
  const pending = [];
  const DB = requestSQLite(t, rec);
  const env = {
    ADMIN_TOKEN:"admin-secret",
    SOLAPI_API_KEY:"api-key", SOLAPI_API_SECRET:"api-secret", SOLAPI_SENDER:"0212345678",
    SOLAPI_PF_ID:"KA01PF-test", SOLAPI_TEMPLATE_ITINERARY_ID:"KA01TP-itinerary",
    SITE_URL:"https://mongolia-milkyway.com",
    DB,
  };
  const originalFetch = globalThis.fetch;
  let sentBody = null;
  let sends = 0;
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(String(url)).hostname, 'api.solapi.com', 'unexpected outbound service');
    assert.equal(DB.deliveries[0]?.state, 'sending', 'claim must be stored before contacting the provider');
    sends++;
    sentBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ groupId:"group-1" }), { status:200, headers:{ "Content-Type":"application/json" } });
  };
  try {
    const response = await onRequestPatch({
      request:new Request("https://preview.pages.dev/api/requests/req-1", {
        method:"PATCH", headers:{ "Content-Type":"application/json", "x-admin-token":"admin-secret" },
        body:JSON.stringify({ booking:{ ...booking, publishStatus:"published" } }),
      }),
      env, params:{ id:"req-1" }, waitUntil(task) { pending.push(task); },
    });
    const body = await response.json();
    assert.deepEqual(body.notifications, [{ type:"itinerary", status:"queued" }]);
    await Promise.all(pending);
    const repeat = await onRequestPatch({
      request:new Request('https://preview.pages.dev/api/requests/req-1', {
        method:'PATCH', headers:{ 'Content-Type':'application/json', 'x-admin-token':'admin-secret' },
        body:JSON.stringify({ booking:DB.record.booking }),
      }), env, params:{ id:'req-1' }, waitUntil(task) { pending.push(task); },
    });
    assert.equal(repeat.status, 200);
    assert.deepEqual((await repeat.json()).notifications, []);
    await Promise.all(pending);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(sentBody.message.kakaoOptions.templateId, "KA01TP-itinerary");
  assert.equal(sentBody.message.kakaoOptions.buttons, undefined);
  assert.equal(sentBody.message.kakaoOptions.variables["#{링크}"], `${encodeURI("확정일정표.html")}?t=customer-token`);
  assert.equal(sends, 1);
  assert.equal(DB.record.booking.publishStatus, 'published');
  assert.deepEqual(DB.record.booking.contract, rec.booking.contract);
  assert.equal(DB.deliveries.length, 1);
  assert.equal(DB.deliveries[0].source, 'quote_booking');
  assert.equal(DB.deliveries[0].booking_id, 'req-1');
  assert.equal(DB.deliveries[0].kind, 'itinerary');
  assert.equal(DB.deliveries[0].state, 'accepted');
});

test("여행서명 시 여행자 정보를 함께 제출하면 booking과 스냅샷에 저장된다", async t => {
  const rec = {
    id: "req-1",
    token: "token-1234567890123456",
    name: "홍길동",
    adult: 2, child: 0, infant: 0,
    booking: {
      contractInfo: { depositStatus: "입금완료", totalAmount: 2000000, depositAmount: 200000 },
    },
  };
  const DB = requestSQLite(t, rec), env = { DB }, pending = [];
  const customer = customerIdentity(DB, { resourceId:rec.id });

  const signImg = "data:image/png;base64," + "A".repeat(300);
  const travelers = [
    { nameKo: "홍길동", passportName: "HONG GILDONG", birth: "1990-01-01", phone: "01012345678", gender: "남", passportNo: "M12345678" },
    { nameKo: "김영희", passportName: "KIM YOUNGHEE", birth: "1992-02-02", phone: "01087654321", gender: "여", passportNo: "M87654321" },
  ];

  const response = await onSignPost({
    request: new Request("https://example.com/api/sign/token-1234567890123456", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...customer },
      body: JSON.stringify({
        agree: true,
        signImg,
        signerName: "홍길동",
        travelers,
        flight: { inNo: "OM310" },
        pickupLodge: "샹그릴라 호텔",
        travelerNote: "채식주의",
      }),
    }),
    env,
    params: { token: "token-1234567890123456" },
    waitUntil(task) { pending.push(task); },
  });

  assert.equal(response.status, 200);
  await Promise.all(pending);
  const savedData = DB.record;
  assert.ok(savedData);
  assert.equal(savedData.booking.travelers.length, 2);
  assert.equal(savedData.booking.travelerSubmission.status, "submitted");
  assert.equal(savedData.booking.contract.snapshot.travelers.length, 2);
  assert.equal(savedData.booking.contract.snapshot.pickupLodge, "샹그릴라 호텔");
  assert.equal(savedData.booking.contract.snapshot.travelerNote, "채식주의");
});

test("고객이 예약금 입금 완료를 알리면 depositReport와 관리자 알림이 발송된다", async t => {
  const rec = {
    id: "req-1",
    token: "token-deposit-123456",
    name: "김철수",
    booking: {
      contractInfo: { depositAmount: 200000, bankName: "우리은행" },
    },
  };
  const DB = requestSQLite(t, rec), customer = customerIdentity(DB, { resourceId:rec.id });
  const env = {
    ADMIN_PHONE: "01012345678",
    SOLAPI_API_KEY: "key",
    SOLAPI_API_SECRET: "secret",
    SOLAPI_SENDER: "0212345678",
    DB,
  };

  const pending = [];
  const originalFetch = globalThis.fetch;
  const messages = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(String(url)).hostname, 'api.solapi.com', 'unexpected outbound service');
    messages.push(JSON.parse(init.body).message);
    return Response.json({ groupId:'synthetic-admin-deposit' });
  };
  let response;
  try { response = await onDepositPost({
    request: new Request("https://example.com/api/deposit/token-deposit-123456", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...customer },
      body: JSON.stringify({ name: "김철수(실입금자)" }),
    }),
    env,
    params: { token: "token-deposit-123456" },
    waitUntil(task) { pending.push(task); },
  });
  await Promise.all(pending);
  } finally { globalThis.fetch = originalFetch; }

  assert.equal(response.status, 200);
  const savedData = DB.record;
  assert.ok(savedData);
  assert.equal(savedData.booking.depositReport.status, "reported");
  assert.equal(savedData.booking.depositReport.name, "김철수(실입금자)");
  assert.ok(savedData.activities.some(a => a.type === "deposit_reported"));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].to, env.ADMIN_PHONE);
});

test("관리자가 입금확인완료를 누르면 고객에게 계약서 안내 메시지와 링크가 발송된다", async t => {
  const booking = {
    contractInfo: { depositAmount: 200000, depositStatus: "미입금" },
    publishStatus: "draft",
  };
  const rec = {
    id: "req-1",
    token: "test-token-abcdef123456",
    name: "홍길동",
    phone: "01099998888",
    quote: {},
    decision: { status: "accepted" },
    status: "신규",
    booking,
  };
  const pending = [];
  const DB = requestSQLite(t, rec);
  let sentBody = null;
  let sends = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(new URL(String(url)).hostname, 'api.solapi.com', 'unexpected outbound service');
    assert.equal(DB.deliveries[0]?.state, 'sending', 'claim must be stored before contacting the provider');
    sends++;
    sentBody = JSON.parse(init.body);
    return new Response(JSON.stringify({ groupId: "group-contract-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const env = {
    ADMIN_TOKEN: "admin-secret",
    SOLAPI_API_KEY: "api-key",
    SOLAPI_API_SECRET: "api-secret",
    SOLAPI_SENDER: "0212345678",
    SOLAPI_PF_ID: 'local-test-profile',
    SOLAPI_TEMPLATE_CONTRACT_ID: 'local-test-contract',
    SITE_URL: "https://mongolia-milkyway.com",
    DB,
  };

  try {
    const response = await onRequestPatch({
      request: new Request("https://preview.pages.dev/api/requests/req-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": "admin-secret" },
        body: JSON.stringify({ confirmDeposit: true }),
      }),
      env,
      params: { id: "req-1" },
      waitUntil(task) { pending.push(task); },
    });

    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(body.notifications, [{ type: "contract", status: "queued" }]);
    await Promise.all(pending);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(sentBody);
  assert.equal(sentBody.message.to, "01099998888");
  assert.equal(sentBody.message.text, undefined);
  assert.equal(sentBody.message.kakaoOptions.templateId, 'local-test-contract');
  assert.equal(sentBody.message.kakaoOptions.disableSms, true);
  assert.equal(sentBody.message.kakaoOptions.variables['#{고객명}'], '홍길동');
  assert.equal(sentBody.message.kakaoOptions.variables['#{링크}'], `${encodeURI('내견적.html')}?t=test-token-abcdef123456`);
  assert.equal(sends, 1);
  assert.equal(DB.record.booking.contractInfo.depositStatus, '입금완료');
  assert.equal(DB.record.booking.checklist.deposit, true);
  assert.ok(DB.record.activities.some(activity => activity.type === 'deposit_confirmed'));
  assert.equal(DB.deliveries.length, 1);
  assert.equal(DB.deliveries[0].kind, 'contract');
  assert.equal(DB.deliveries[0].channel, 'kakao');
  assert.equal(DB.deliveries[0].state, 'accepted');
});


