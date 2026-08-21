import test from "node:test";
import assert from "node:assert/strict";
import { onRequestPost as createRequest } from "../functions/api/requests.js";
import { onRequestPatch } from "../functions/api/requests/[id].js";

/* 견적서 편집기의 [저장하기]와 [링크 공유하기] 분리 검증
   · 저장하기      → silentQuote:true  → 고객 알림톡이 나가면 안 된다
   · 링크 공유하기 → notifyQuote:true  → 고객 알림톡이 나가야 한다 */

const ENV = {
  ADMIN_TOKEN:"admin-secret",
  SOLAPI_API_KEY:"api-key", SOLAPI_API_SECRET:"api-secret", SOLAPI_SENDER:"0212345678",
  SOLAPI_PF_ID:"KA01PF-test", SOLAPI_TEMPLATE_QUOTE_ID:"KA01TP-quote",
  SITE_URL:"https://mongolia-milkyway.com",
};

/* 고객 견적 알림톡 발송만 세어 준다 (관리자 문자는 제외) */
const withSolapi = async run => {
  const original = globalThis.fetch;
  const sent = [];
  const pending = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("solapi")) sent.push(JSON.parse(init.body).message);
    return new Response(JSON.stringify({ groupId:"g" }), { status:200, headers:{ "Content-Type":"application/json" } });
  };
  try {
    const result = await run(p => pending.push(p));
    await Promise.allSettled(pending);   // 백그라운드 알림 발송까지 마친 뒤 판정
    return { result, sent };
  } finally { globalThis.fetch = original; }
};
const quoteSends = sent => sent.filter(m => (m.kakaoOptions || {}).templateId === "KA01TP-quote").length;

const insertDb = () => ({
  saved: null,
  prepare() {
    return { bind: (...args) => ({ run: async () => { insertDbLast.saved = args; return { meta:{ changes:1 } }; } }) };
  },
});
const insertDbLast = {};

function patchDb(record) {
  let data = JSON.stringify(record);
  return {
    get record() { return JSON.parse(data); },
    prepare() {
      return {
        bind(...args) {
          return {
            async first() { return { data, status:JSON.parse(data).status || "신규" }; },
            async run() { data = args[2]; return { meta:{ changes:1 } }; },
          };
        },
      };
    },
  };
}

const adminPost = body => new Request("https://mongolia-milkyway.com/api/requests", {
  method:"POST", headers:{ "Content-Type":"application/json", "x-admin-token":"admin-secret" },
  body: JSON.stringify(body),
});
const adminPatch = body => new Request("https://mongolia-milkyway.com/api/requests/req-1", {
  method:"PATCH", headers:{ "Content-Type":"application/json", "x-admin-token":"admin-secret" },
  body: JSON.stringify(body),
});

const newQuote = { customer:"테스트고객", price:{} };

test("새 견적 저장하기 — 고객 알림톡을 보내지 않는다", async () => {
  const DB = insertDb();
  const { result, sent } = await withSolapi(collect => createRequest({
    request: adminPost({ name:"홍길동", phone:"01012345678", quote:newQuote, silentQuote:true, source:"walkin" }),
    env:{ ...ENV, DB }, waitUntil(p) { collect(p); },
  }));
  const body = await result.json();
  assert.equal(body.ok, true);
  assert.equal(quoteSends(sent), 0, "저장만 했는데 고객에게 알림톡이 나갔다");
  assert.equal(body.notifications[0].status, "silent");
});

test("새 견적 링크 공유하기 — 고객 알림톡을 보낸다", async () => {
  const DB = insertDb();
  const { result, sent } = await withSolapi(collect => createRequest({
    request: adminPost({ name:"홍길동", phone:"01012345678", quote:newQuote, source:"walkin" }),
    env:{ ...ENV, DB }, waitUntil(p) { collect(p); },
  }));
  const body = await result.json();
  assert.equal(body.ok, true);
  assert.equal(quoteSends(sent), 1);
  assert.equal(body.notifications[0].status, "queued");
});

test("silentQuote 플래그는 저장된 견적 데이터에 남지 않는다", async () => {
  const DB = insertDb();
  await withSolapi(collect => createRequest({
    request: adminPost({ name:"홍길동", phone:"01012345678", quote:newQuote, silentQuote:true, source:"walkin" }),
    env:{ ...ENV, DB }, waitUntil(p) { collect(p); },
  }));
  const stored = JSON.parse(insertDbLast.saved[8]);
  assert.equal(stored.silentQuote, undefined);
});

test("기존 문의에 저장하기 — 첫 견적이어도 알림톡을 보내지 않는다", async () => {
  const DB = patchDb({ id:"req-1", name:"홍길동", phone:"01012345678", status:"진행중" });
  const { result, sent } = await withSolapi(collect => onRequestPatch({
    request: adminPatch({ quote:newQuote, silentQuote:true }),
    env:{ ...ENV, DB }, params:{ id:"req-1" }, waitUntil(p) { collect(p); },
  }));
  const body = await result.json();
  assert.equal(body.ok, true);
  assert.equal(quoteSends(sent), 0, "저장만 했는데 고객에게 알림톡이 나갔다");
  assert.equal(DB.record.quote.customer, "테스트고객", "견적은 저장되어야 한다");
});

test("기존 문의에 링크 공유하기 — 알림톡을 보낸다", async () => {
  const DB = patchDb({ id:"req-1", name:"홍길동", phone:"01012345678", status:"진행중", quote:{ old:true } });
  const { result, sent } = await withSolapi(collect => onRequestPatch({
    request: adminPatch({ quote:newQuote, notifyQuote:true }),
    env:{ ...ENV, DB }, params:{ id:"req-1" }, waitUntil(p) { collect(p); },
  }));
  const body = await result.json();
  assert.equal(body.ok, true);
  assert.equal(quoteSends(sent), 1);
  assert.equal(body.notifications.find(n => n.type === "quote").status, "queued");
});

test("저장하기를 여러 번 해도 알림톡은 한 번도 나가지 않는다", async () => {
  const DB = patchDb({ id:"req-1", name:"홍길동", phone:"01012345678", status:"진행중" });
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const { sent } = await withSolapi(collect => onRequestPatch({
      request: adminPatch({ quote:{ ...newQuote, rev:i } , silentQuote:true }),
      env:{ ...ENV, DB }, params:{ id:"req-1" }, waitUntil(p) { collect(p); },
    }));
    total += quoteSends(sent);
  }
  assert.equal(total, 0);
  assert.equal(DB.record.quote.rev, 2, "마지막 저장 내용이 남아야 한다");
});
