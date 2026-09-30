import test from "node:test";
import assert from "node:assert/strict";
import { onRequestGet, onRequestPost } from "../functions/api/requests/[id]/itinerary-notice.js";
const ENV = { ADMIN_TOKEN:"admin", SOLAPI_API_KEY:"key", SOLAPI_API_SECRET:"secret", SOLAPI_PF_ID:"pf", SOLAPI_TEMPLATE_QUOTE_ID:"quote", SOLAPI_TEMPLATE_ITINERARY_ID:"itinerary" };
function setup({ published = true, fail = false } = {}) {
  const ledger = new Map();
  const rec = { name:"TEST", phone:"01000007901", token:"real-booking-token", status:"완료", booking:{ publishStatus:published ? "published" : "draft" } };
  const DB = { prepare(sql) {
    const stmt = args => ({
      async first() {
        if (sql.startsWith("SELECT data")) return { data:JSON.stringify(rec), status:rec.status };
        if (sql.includes("sqlite_master")) return ledger.size ? { name:"itinerary_notice_dispatches" } : null;
        return ledger.get(args[1]);
      },
      async run() {
        if (sql.startsWith("INSERT")) {
          if (ledger.has(args[1])) return { meta:{ changes:0 } };
          ledger.set(args[1], { state:"sending" });
          return { meta:{ changes:1 } };
        }
        if (sql.startsWith("UPDATE")) ledger.set(args[3], { state:args[0], result:args[1] });
        return { meta:{ changes:1 } };
      },
    });
    return { ...stmt([]), bind:(...args) => stmt(args) };
  } };
  const ctx = (method, body = {}, auth = true) => ({
    env:{ ...ENV, DB }, params:{ id:"test-booking" },
    request:new Request(`https://site.test/api/requests/test-booking/itinerary-notice${method === "GET" ? "?idempotencyKey=test-itinerary-send-20260930" : ""}`, { method, headers:auth ? { "x-admin-token":"admin" } : {}, ...(method === "POST" ? { body:JSON.stringify(body) } : {}) }),
  });
  const sends = [];
  const fetch = async (_url, init) => {
    if (init.method === "POST") {
      sends.push(JSON.parse(init.body));
      if (fail) throw new Error("connection lost");
      return Response.json({ groupId:"provider-receipt" });
    }
    return Response.json({ templateList:[{ templateId:"itinerary", content:"확정일정표 안내", status:"APPROVED" }] });
  };
  return { ctx, sends, fetch, rec };
}
const input = { idempotencyKey:"test-itinerary-send-20260930", templateId:"itinerary" };
async function withMock(options, run) {
  const s = setup(options), original = globalThis.fetch;
  globalThis.fetch = s.fetch;
  try { await run(s); } finally { globalThis.fetch = original; }
}
test("published completed booking preview is read-only and includes exact template/payload", () => withMock({}, async s => {
  const r = await (await onRequestGet(s.ctx("GET"))).json();
  assert.equal(r.ready, true);
  assert.equal(r.booking.phoneLast4, "7901");
  assert.equal(r.template.content, "확정일정표 안내");
  assert.equal(r.payload.variables["#{링크}"], `${encodeURI("확정일정표.html")}?t=real-booking-token`);
  assert.equal(s.sends.length, 0);
}));
test("one attempt survives concurrent and later retries without changing booking stage", () => withMock({}, async s => {
  const results = await Promise.all([onRequestPost(s.ctx("POST", input)), onRequestPost(s.ctx("POST", input))]);
  assert.equal(s.sends.length, 1);
  assert.equal(s.sends[0].message.kakaoOptions.templateId, "itinerary");
  const retry = await (await onRequestPost(s.ctx("POST", input))).json();
  assert.equal(retry.duplicate, true);
  assert.equal(retry.state, "accepted");
  assert.equal(s.sends.length, 1);
  const preview = await (await onRequestGet(s.ctx("GET"))).json();
  assert.equal(preview.dispatch.state, "accepted");
  assert.equal(s.sends.length, 1);
  assert.equal(s.rec.status, "완료");
  assert.equal(s.rec.booking.publishStatus, "published");
}));
test("uncertain provider outcome never retries the same send key", () => withMock({ fail:true }, async s => {
  assert.equal((await onRequestPost(s.ctx("POST", input))).status, 502);
  const retry = await (await onRequestPost(s.ctx("POST", input))).json();
  assert.equal(retry.duplicate, true);
  assert.equal(retry.state, "unknown");
  assert.equal(s.sends.length, 1);
}));
test("authorization, publication, key and template guards prevent sends", async () => {
  await withMock({}, async s => {
    assert.equal((await onRequestPost(s.ctx("POST", input, false))).status, 401);
    assert.equal((await onRequestGet(s.ctx("GET", {}, false))).status, 401);
    assert.equal((await onRequestPost(s.ctx("POST", {}))).status, 400);
    assert.equal((await onRequestPost(s.ctx("POST", { ...input, templateId:"quote" }))).status, 409);
    assert.equal(s.sends.length, 0);
  });
  await withMock({ published:false }, async s => {
    assert.equal((await onRequestPost(s.ctx("POST", input))).status, 409);
    assert.equal(s.sends.length, 0);
  });
});

test("preview exposes a quote-template collision without sending or hiding its configured ID", () => withMock({}, async s => {
  const ctx = s.ctx("GET");
  ctx.env.SOLAPI_TEMPLATE_ITINERARY_ID = "quote";
  const result = await (await onRequestGet(ctx)).json();
  assert.equal(result.ready, false);
  assert.equal(result.configuration.sameTemplate, true);
  assert.equal(result.configuration.itineraryTemplateId, "quote");
  assert.equal(result.configuration.quoteTemplateId, "quote");
  assert.equal(result.payload.templateId, "");
  assert.equal(result.dispatch, null);
  assert.equal(s.sends.length, 0);
}));
