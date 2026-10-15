import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { onRequestGet, onRequestPost } from "../functions/api/requests/[id]/itinerary-notice.js";
import { onRequestPatch } from '../functions/api/requests/[id].js';
import { notifyCustomerItineraryReady } from '../functions/api/_solapi.js';
import { trackedDelivery } from '../functions/lib/adminDelivery.ts';
import { ADMIN_DELIVERY_TABLE } from '../functions/lib/siteSchema.ts';
const ENV = { ADMIN_TOKEN:"admin", SOLAPI_API_KEY:"key", SOLAPI_API_SECRET:"secret", SOLAPI_PF_ID:"pf", SOLAPI_TEMPLATE_QUOTE_ID:"quote", SOLAPI_TEMPLATE_ITINERARY_ID:"itinerary" };
function setup({ published = true, fail = false, record } = {}) {
  const raw = new DatabaseSync(':memory:');
  raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const table = ADMIN_DELIVERY_TABLE;
  raw.exec(`CREATE TABLE ${table.name} (${[...table.columns, ...(table.constraints || [])].join(', ')})`);
  raw.exec(`CREATE TABLE itinerary_notice_dispatches (
    request_id TEXT NOT NULL, dispatch_key TEXT NOT NULL, state TEXT NOT NULL,
    created_at TEXT NOT NULL, result TEXT, PRIMARY KEY(request_id,dispatch_key))`);
  const initial = record || { name:"TEST", phone:"01000007901", token:"real-booking-token", status:"완료", booking:{ publishStatus:published ? "published" : "draft" } };
  const initialData = JSON.stringify(initial);
  raw.prepare('INSERT INTO requests(id,status,data,token) VALUES(?,?,?,?)').run('test-booking', initial.status, initialData, initial.token);
  const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    async first() { return raw.prepare(sql).get(...args) ?? null; },
    async all() { return { results: raw.prepare(sql).all(...args) }; },
    async run() { const result = raw.prepare(sql).run(...args); return { meta: { changes: Number(result.changes) } }; },
  });
  const DB = { prepare: sql => statement(sql) };
  const ctx = (method, body = {}, auth = true) => ({
    env:{ ...ENV, DB }, params:{ id:"test-booking" },
    request:new Request(`https://site.test/api/requests/test-booking/itinerary-notice${method === "GET" ? "?idempotencyKey=test-itinerary-send-20260930" : ""}`, { method, headers:auth ? { "x-admin-token":"admin" } : {}, ...(method === "POST" ? { body:JSON.stringify(body) } : {}) }),
  });
  const sends = [];
  const fetch = async (url, init) => {
    assert.equal(new URL(String(url)).hostname, 'api.solapi.com', 'unexpected external provider');
    if (init.method === "POST") {
      sends.push(JSON.parse(init.body));
      if (fail) throw new Error("connection lost");
      return Response.json({ groupId:"provider-receipt" });
    }
    return Response.json({ templateList:[{ templateId:"itinerary", content:"확정일정표 안내", status:"APPROVED" }] });
  };
  return { ctx, sends, fetch, DB, raw, initialData, close: () => raw.close(),
    get rec() { return JSON.parse(raw.prepare('SELECT data FROM requests WHERE id=?').get('test-booking').data); },
    get legacy() { return raw.prepare('SELECT * FROM itinerary_notice_dispatches ORDER BY created_at,dispatch_key').all().map(row => ({ ...row })); },
    get tracked() { return raw.prepare('SELECT * FROM admin_delivery_attempts ORDER BY created_at,id').all().map(row => ({ ...row })); },
  };
}
const input = { idempotencyKey:"test-itinerary-send-20260930", templateId:"itinerary" };
async function withMock(options, run) {
  const s = setup(options), original = globalThis.fetch;
  globalThis.fetch = s.fetch;
  try { await run(s); } finally { globalThis.fetch = original; s.close(); }
}
test("published completed booking preview is read-only and includes exact template/payload", () => withMock({}, async s => {
  const r = await (await onRequestGet(s.ctx("GET"))).json();
  assert.equal(r.ready, true);
  assert.equal(r.booking.phoneLast4, "7901");
  assert.equal(r.template.content, "확정일정표 안내");
  assert.equal(r.payload.variables["#{링크}"], `${encodeURI("확정일정표.html")}?t=real-booking-token`);
  assert.equal(s.sends.length, 0);
  assert.equal(s.legacy.length, 0);
  assert.equal(s.tracked.length, 0);
  assert.equal(s.raw.prepare('SELECT data FROM requests').get().data, s.initialData);
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
  assert.equal(s.raw.prepare('SELECT data FROM requests').get().data, s.initialData, 'both ledgers must leave the booking and accounting row untouched');
  assert.equal(s.legacy.length, 1);
  assert.equal(s.legacy[0].state, 'accepted');
  assert.equal(s.tracked.length, 1);
  assert.equal(s.tracked[0].state, 'accepted');
  assert.equal(s.tracked[0].provider_id, 'provider-receipt');
}));
test("uncertain provider outcome never retries the same send key", () => withMock({ fail:true }, async s => {
  assert.equal((await onRequestPost(s.ctx("POST", input))).status, 502);
  const retry = await (await onRequestPost(s.ctx("POST", input))).json();
  assert.equal(retry.duplicate, true);
  assert.equal(retry.state, "unknown");
  assert.equal(s.sends.length, 1);
  assert.equal(s.legacy[0].state, 'unknown');
  assert.equal(s.tracked[0].state, 'unknown');
  assert.equal(s.raw.prepare('SELECT data FROM requests').get().data, s.initialData);
}));
test("authorization, publication, key and template guards prevent sends", async () => {
  await withMock({}, async s => {
    assert.equal((await onRequestPost(s.ctx("POST", input, false))).status, 401);
    assert.equal((await onRequestGet(s.ctx("GET", {}, false))).status, 401);
    assert.equal((await onRequestPost(s.ctx("POST", {}))).status, 400);
    assert.equal((await onRequestPost(s.ctx("POST", { ...input, templateId:"quote" }))).status, 409);
    assert.equal(s.sends.length, 0);
    assert.equal(s.legacy.length, 0);
    assert.equal(s.tracked.length, 0);
  });
  await withMock({ published:false }, async s => {
    assert.equal((await onRequestPost(s.ctx("POST", input))).status, 409);
    assert.equal(s.sends.length, 0);
    assert.equal(s.legacy.length, 0);
    assert.equal(s.tracked.length, 0);
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

test('legacy sending/unknown blocks the new sender before any provider request', async () => {
  for (const state of ['sending', 'unknown']) await withMock({}, async s => {
    s.raw.prepare('INSERT INTO itinerary_notice_dispatches VALUES(?,?,?,?,?)')
      .run('test-booking', 'old-unresolved-attempt', state, '2026-10-14T00:00:00Z', '{}');
    const outcome = await trackedDelivery(s.DB, { source:'quote_booking', bookingId:'test-booking', kind:'itinerary', channel:'kakao', key:'new-attempt-123456' },
      () => notifyCustomerItineraryReady(s.ctx('GET').env, s.rec));
    assert.equal(outcome.state, state);
    assert.equal(outcome.duplicate, true);
    assert.equal(outcome.ok, false);
    assert.equal(s.sends.length, 0);
    assert.equal(s.tracked.length, 0);
    assert.equal(s.legacy[0].state, state);
    assert.equal(s.raw.prepare('SELECT data FROM requests').get().data, s.initialData);
  });
});

test('new sending/unknown blocks the legacy sender and marks its unsent claim failed', async () => {
  for (const state of ['sending', 'unknown']) await withMock({}, async s => {
    s.raw.prepare(`INSERT INTO admin_delivery_attempts (id,source,booking_id,kind,channel,state,dispatch_key,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?)`).run('new-unresolved', 'quote_booking', 'test-booking', 'itinerary', 'kakao', state, 'new-unresolved-key', '2026-10-14T00:00:00Z', '2026-10-14T00:00:00Z');
    const response = await onRequestPost(s.ctx('POST', input));
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.ok, false);
    assert.equal(body.state, 'failed', 'this legacy claim did not call the provider');
    assert.equal(s.sends.length, 0);
    assert.equal(s.legacy.length, 1);
    assert.equal(s.legacy[0].state, 'failed');
    assert.equal(s.tracked.length, 1);
    assert.equal(s.tracked[0].state, state, 'the real unresolved attempt must not be overwritten');
    assert.equal(s.raw.prepare('SELECT data FROM requests').get().data, s.initialData);
  });
});

test('legacy uncertainty also blocks the actual booking-publication PATCH notification', () => withMock({ record: {
  name:'TEST', phone:'01000007901', token:'real-booking-token', status:'예약확정', quote:{}, decision:{status:'accepted'},
  booking:{ publishStatus:'draft', days:[{d:1},{d:2}], contract:{signedAt:'2026-10-14'}, contractInfo:{depositStatus:'입금완료',totalAmount:1000000},
    assign:{guide:{name:'합성 가이드'},vehicle:{model:'합성 차량'},lodges:[{day:1,name:'합성 숙소'}]} },
} }, async s => {
  s.raw.prepare('INSERT INTO itinerary_notice_dispatches VALUES(?,?,?,?,?)')
    .run('test-booking', 'old-unresolved-attempt', 'unknown', '2026-10-14T00:00:00Z', '{}');
  const before = s.rec, pending = [];
  const response = await onRequestPatch({ env:s.ctx('GET').env, params:{id:'test-booking'},
    request:new Request('https://site.test/api/requests/test-booking', { method:'PATCH', headers:{'Content-Type':'application/json','x-admin-token':'admin'},
      body:JSON.stringify({booking:{...before.booking,publishStatus:'published'}}) }), waitUntil(task) { pending.push(task); },
  });
  assert.equal(response.status, 200);
  await Promise.all(pending);
  assert.equal(s.sends.length, 0);
  assert.equal(s.tracked.length, 0);
  assert.equal(s.legacy[0].state, 'unknown');
  assert.equal(s.rec.booking.publishStatus, 'published');
  assert.equal(s.rec.status, before.status);
  assert.deepEqual(s.rec.booking.contractInfo, before.booking.contractInfo);
  assert.deepEqual(s.rec.booking.contract, before.booking.contract);
}));

test('a legacy claim appearing after preflight is checked again by the atomic new INSERT', () => withMock({}, async s => {
  const prepare = s.DB.prepare;
  let injected = false;
  s.DB.prepare = sql => {
    const statement = prepare(sql);
    if (!/^\s*INSERT INTO admin_delivery_attempts/i.test(sql)) return statement;
    const bind = statement.bind;
    statement.bind = (...values) => {
      const bound = bind(...values), run = bound.run;
      bound.run = async () => {
        if (!injected) { injected = true; s.raw.prepare('INSERT INTO itinerary_notice_dispatches VALUES(?,?,?,?,?)')
          .run('test-booking', 'racing-legacy-key', 'unknown', '2026-10-14T00:00:00Z', '{}'); }
        return run();
      };
      return bound;
    };
    return statement;
  };
  const outcome = await trackedDelivery(s.DB, {source:'quote_booking',bookingId:'test-booking',kind:'itinerary',channel:'kakao',key:'racing-new-key-123456'},
    () => notifyCustomerItineraryReady(s.ctx('GET').env, s.rec));
  assert.equal(injected, true);
  assert.equal(outcome.ok, false);
  assert.equal(outcome.duplicate, true);
  assert.equal(s.sends.length, 0);
  assert.equal(s.tracked.length, 0);
  assert.equal(s.legacy[0].state, 'unknown');
}));

test("read-only discovery restricts templates to exact profile, exposes metadata not secrets, and declares incompleteness", () => withMock({}, async s => {
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.method, undefined, "discovery must never send a POST");
    return Response.json({ templateList:[
      { templateId:"approved-itinerary", pfId:"pf", name:"확정일정표", status:"APPROVED", title:"여행 안내", content:"#{고객명}님 확정일정표입니다.", buttons:[{ buttonType:"WL", linkMo:"https://example.test/#{링크}" }], privateField:"DO_NOT_EXPOSE" },
      { templateId:"pending", channelId:"pf", status:"PENDING", content:"검토 중" },
      { templateId:"other", pfId:"other-channel", content:"OTHER_CHANNEL" },
      { templateId:"no-profile", content:"UNKNOWN_CHANNEL" },
    ] });
  };
  const response = await onRequestGet(s.ctx("GET"));
  const result = await response.json();
  assert.deepEqual(result.discovery.templates.map(t=>t.templateId), ["approved-itinerary","pending"]);
  assert.deepEqual(result.discovery.templates[0].variables, ["#{고객명}","#{링크}"]);
  assert.equal(result.discovery.templates[0].title,"여행 안내");
  assert.equal(result.discovery.templates[0].buttons[0].linkMo,"https://example.test/#{링크}");
  assert.equal(result.discovery.excludedCount,2);
  assert.equal(result.discovery.complete,false);
  assert.equal(result.discovery.limit,100);
  assert.doesNotMatch(JSON.stringify(result.discovery),/DO_NOT_EXPOSE|OTHER_CHANNEL|UNKNOWN_CHANNEL|apiKey|Authorization|secret/);
  assert.equal(s.sends.length,0);
}));
