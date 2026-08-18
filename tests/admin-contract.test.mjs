import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPatch } from "../functions/api/requests/[id].js";
import { onRequestPost as onSignPost } from "../functions/api/sign/[token].js";
import { onRequestPost as onDepositPost } from "../functions/api/deposit/[token].js";

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

test("5박 6일은 숙소 5개 배정 후 일정표를 공개할 수 있다", async () => {
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
  let saved = null;
  const env = {
    ADMIN_TOKEN:"admin-secret",
    DB:{ prepare(sql) { return { bind(...values) { return {
      async first() { return { data:JSON.stringify(rec), status:"예약확정" }; },
      async run() { saved = { sql, values }; return { success:true }; },
    }; } }; } },
  };
  const response = await onRequestPatch({
    request:new Request("https://example.com/api/requests/req-1", {
      method:"PATCH", headers:{ "Content-Type":"application/json", "x-admin-token":"admin-secret" },
      body:JSON.stringify({ booking:{ ...booking, publishStatus:"published" } }),
    }),
    env, params:{ id:"req-1" }, waitUntil() {},
  });
  assert.equal(response.status, 200);
  assert.ok(saved);
  assert.equal((await response.json()).publishStatus, "published");
});

test("확정일정표 최초 공개 시 고객 직링크 알림톡을 한 번 요청한다", async () => {
  const days = Array.from({ length:3 }, (_, i) => ({ d:i + 1, stay:{ name:`숙소 ${i + 1}` } }));
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
  const env = {
    ADMIN_TOKEN:"admin-secret",
    SOLAPI_API_KEY:"api-key", SOLAPI_API_SECRET:"api-secret", SOLAPI_SENDER:"0212345678",
    SOLAPI_PF_ID:"KA01PF-test", SOLAPI_TEMPLATE_ITINERARY_ID:"KA01TP-itinerary",
    SITE_URL:"https://mongolia-milkyway.com",
    DB:{ prepare() { return { bind() { return {
      async first() { return { data:JSON.stringify(rec), status:"예약확정" }; },
      async run() { return { success:true }; },
    }; } }; } },
  };
  const originalFetch = globalThis.fetch;
  let sentBody = null;
  globalThis.fetch = async (_url, init) => {
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
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(sentBody.message.kakaoOptions.templateId, "KA01TP-itinerary");
  assert.equal(sentBody.message.kakaoOptions.buttons, undefined);
  assert.equal(sentBody.message.kakaoOptions.variables["#{링크}"], "%EB%82%B4%EA%B2%AC%EC%A0%81.html?t=customer-token");
});

test("여행서명 시 여행자 정보를 함께 제출하면 booking과 스냅샷에 저장된다", async () => {
  const rec = {
    id: "req-1",
    token: "token-1234567890123456",
    name: "홍길동",
    adult: 2, child: 0, infant: 0,
    booking: {
      contractInfo: { depositStatus: "입금완료", totalAmount: 2000000, depositAmount: 200000 },
    },
  };
  let savedData = null;
  const env = {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() { return { id: "req-1", status: "진행중", data: JSON.stringify(rec) }; },
              async run() { return { success: true }; },
            };
          },
          run() { return { success: true }; },
        };
      },
    },
  };
  env.DB.prepare = (sql) => ({
    bind(...args) {
      if (sql.includes("UPDATE")) {
        savedData = JSON.parse(args[1] || "{}");
      }
      return {
        async first() { return { id: "req-1", status: "진행중", data: JSON.stringify(rec) }; },
        async run() { return { success: true }; },
      };
    },
  });

  const signImg = "data:image/png;base64," + "A".repeat(300);
  const travelers = [
    { nameKo: "홍길동", passportName: "HONG GILDONG", birth: "1990-01-01", phone: "01012345678", gender: "남", passportNo: "M12345678" },
    { nameKo: "김영희", passportName: "KIM YOUNGHEE", birth: "1992-02-02", phone: "01087654321", gender: "여", passportNo: "M87654321" },
  ];

  const response = await onSignPost({
    request: new Request("https://example.com/api/sign/token-1234567890123456", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    waitUntil() {},
  });

  assert.equal(response.status, 200);
  assert.ok(savedData);
  assert.equal(savedData.booking.travelers.length, 2);
  assert.equal(savedData.booking.travelerSubmission.status, "submitted");
  assert.equal(savedData.booking.contract.snapshot.travelers.length, 2);
  assert.equal(savedData.booking.contract.snapshot.pickupLodge, "샹그릴라 호텔");
  assert.equal(savedData.booking.contract.snapshot.travelerNote, "채식주의");
});

test("고객이 예약금 입금 완료를 알리면 depositReport와 관리자 알림이 발송된다", async () => {
  const rec = {
    id: "req-1",
    token: "token-deposit-123456",
    name: "김철수",
    booking: {
      contractInfo: { depositAmount: 200000, bankName: "우리은행" },
    },
  };
  let savedData = null;
  const env = {
    ADMIN_PHONE: "01012345678",
    SOLAPI_API_KEY: "key",
    SOLAPI_API_SECRET: "secret",
    SOLAPI_SENDER: "0212345678",
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            if (sql.includes("UPDATE")) {
              savedData = JSON.parse(args[0] || "{}");
            }
            return {
              async first() { return { id: "req-1", status: "신규", data: JSON.stringify(rec) }; },
              async run() { return { success: true }; },
            };
          },
        };
      },
    },
  };

  const response = await onDepositPost({
    request: new Request("https://example.com/api/deposit/token-deposit-123456", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "김철수(실입금자)" }),
    }),
    env,
    params: { token: "token-deposit-123456" },
    waitUntil() {},
  });

  assert.equal(response.status, 200);
  assert.ok(savedData);
  assert.equal(savedData.booking.depositReport.status, "reported");
  assert.equal(savedData.booking.depositReport.name, "김철수(실입금자)");
  assert.ok(savedData.activities.some(a => a.type === "deposit_reported"));
});

test("관리자가 입금확인완료를 누르면 고객에게 계약서 안내 메시지와 링크가 발송된다", async () => {
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
  let sentBody = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
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
    SITE_URL: "https://mongolia-milkyway.com",
    DB: {
      prepare() {
        return {
          bind() {
            return {
              async first() { return { data: JSON.stringify(rec), status: "신규" }; },
              async run() { return { success: true }; },
            };
          },
        };
      },
    },
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
  assert.ok(sentBody.message.text.includes("입금확인이 완료되었습니다."));
  assert.ok(sentBody.message.text.includes("1. 여행자정보 입력하기"));
  assert.ok(sentBody.message.text.includes("2. 여행계약서 확인 및 서명하기"));
  assert.ok(sentBody.message.text.includes("https://mongolia-milkyway.com/%EB%82%B4%EA%B2%AC%EC%A0%81.html?t=test-token-abcdef123456"));
});


