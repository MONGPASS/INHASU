import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost } from "../functions/api/guidebook-reminders.js";
import { kstDateString } from "../functions/api/_guidebook-reminder.mjs";
import { runGuidebookReminder } from "../workers/guidebook-reminder-cron.js";

const addDays = (iso, days) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
};

function mockDb(initialRecord) {
  let data = JSON.stringify(initialRecord);
  return {
    get data() { return data; },
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async all() {
              assert.match(sql, /WHERE status = \?/);
              return { results:[{ id:"req-guidebook", data, status:args[0] }] };
            },
            async run() {
              assert.match(sql, /UPDATE requests SET data/);
              const [nextData, id, expectedData] = args;
              if (id !== "req-guidebook" || expectedData !== data) return { meta:{ changes:0 } };
              data = nextData;
              return { meta:{ changes:1 } };
            },
          };
        },
      };
    },
  };
}

test("가이드북 API는 발송 성공을 기록하고 다음 실행에서 중복 발송하지 않는다", async () => {
  const today = kstDateString();
  const depart = addDays(today, 7);
  const DB = mockDb({
    id:"req-guidebook", status:"예약확정", name:"홍길동", phone:"01012345678", depart, activities:[],
  });
  const env = {
    DB, ADMIN_TOKEN:"admin-secret", SOLAPI_API_KEY:"api-key", SOLAPI_API_SECRET:"api-secret",
    SOLAPI_PF_ID:"pf-id", SOLAPI_TEMPLATE_GUIDEBOOK_ID:"guidebook-template",
  };
  const originalFetch = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async (_url, init) => {
    sends += 1;
    const body = JSON.parse(init.body);
    assert.equal(body.message.kakaoOptions.variables["#{출발일}"], depart);
    return new Response(JSON.stringify({ groupId:"group-1" }), {
      status:200, headers:{ "Content-Type":"application/json" },
    });
  };
  try {
    const request = new Request("https://example.com/api/guidebook-reminders", {
      method:"POST", headers:{ "x-admin-token":"admin-secret" },
    });
    const first = await onRequestPost({ request, env });
    const firstBody = await first.json();
    assert.equal(first.status, 200);
    assert.equal(firstBody.sent, 1);
    assert.equal(JSON.parse(DB.data).notify.guidebookDepartureDate, depart);

    const second = await onRequestPost({ request, env });
    const secondBody = await second.json();
    assert.equal(secondBody.sent, 0);
    assert.equal(secondBody.results[0].reason, "already_sent");
    assert.equal(sends, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("예약 Worker는 비밀 헤더로 Pages API를 호출한다", async () => {
  const originalFetch = globalThis.fetch;
  let called;
  globalThis.fetch = async (url, init) => {
    called = { url, init };
    return new Response(JSON.stringify({ ok:true, sent:0 }), {
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
