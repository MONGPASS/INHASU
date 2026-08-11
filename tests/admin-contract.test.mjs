import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPatch } from "../functions/api/requests/[id].js";

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
