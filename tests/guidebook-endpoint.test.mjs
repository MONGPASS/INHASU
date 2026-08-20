import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/guidebook-reminders.js";
import { runGuidebookReminder } from "../workers/guidebook-reminder-cron.js";

/* 여행 주의사항은 출발 7일 전이 아니라 계약서 서명 직후·관리자 수동 발송으로 나갑니다.
   (발송 동작 자체는 tests/travel-notice.test.mjs 참고)
   Cloudflare에 남아 있는 스케줄 Worker가 호출하더라도 아무것도 보내지 않아야 합니다. */

test("출발 7일 전 자동 발송은 중단되어 예약을 조회하지도 발송하지도 않는다", async () => {
  const originalFetch = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async () => { sends += 1; return new Response("{}", { status:200 }); };
  const DB = { prepare() { throw new Error("예약을 조회하면 안 됩니다"); } };
  try {
    const request = new Request("https://example.com/api/guidebook-reminders", {
      method:"POST", headers:{ "x-admin-token":"admin-secret" },
    });
    const response = await onRequestPost({ request, env:{ DB, ADMIN_TOKEN:"admin-secret" } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.disabled, true);
    assert.equal(body.sent, 0);
    assert.equal(sends, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("남아 있는 예약 Worker가 호출해도 중단 응답을 정상으로 받는다", async () => {
  const originalFetch = globalThis.fetch;
  let called;
  globalThis.fetch = async (url, init) => {
    called = { url, init };
    return new Response(JSON.stringify({ ok:true, disabled:true, sent:0 }), {
      status:200, headers:{ "Content-Type":"application/json" },
    });
  };
  try {
    await runGuidebookReminder({
      CUSTOMER_BASE_URL:"https://mongolia-milkyway.com/", GUIDEBOOK_CRON_SECRET:"cron-secret",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(called.url, "https://mongolia-milkyway.com/api/guidebook-reminders");
  assert.equal(called.init.headers["x-cron-secret"], "cron-secret");
});
