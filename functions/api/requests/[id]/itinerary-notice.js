/* Published itinerary notices: GET previews without sending; POST claims one attempt
   per booking/key before contacting Solapi. An uncertain response must not be retried
   with a new key: inspect the provider result first. Booking stages are never changed. */
import { canSendKakao, quoteTemplateId, itineraryNoticePayload, listKakaoTemplates, notifyCustomerItineraryReady } from "../../_solapi.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const authorized = (request, env) => !!env.ADMIN_TOKEN && request.headers.get("x-admin-token") === env.ADMIN_TOKEN;
async function booking(env, id) {
  const row = await env.DB.prepare("SELECT data, status FROM requests WHERE id = ?").bind(id).first();
  return row ? { ...JSON.parse(row.data), status: row.status } : null;
}
const eligible = rec => rec?.booking?.publishStatus === "published" && !!rec.token;

export async function onRequestGet({ request, env, params }) {
  if (!authorized(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  const rec = await booking(env, params.id);
  if (!rec) return json({ ok: false, error: "not found" }, 404);
  const payload = itineraryNoticePayload(env, rec);
  const templates = await listKakaoTemplates(env);
  const configuredItineraryId = env.SOLAPI_TEMPLATE_ITINERARY_ID || env.SOLAPI_KAKAO_ITINERARY_TEMPLATE_ID || "";
  const key = new URL(request.url).searchParams.get("idempotencyKey");
  let dispatch = null;
  if (key && /^[a-zA-Z0-9_-]{16,100}$/.test(key)) {
    const table = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'itinerary_notice_dispatches'").first();
    if (table) {
      const previous = await env.DB.prepare("SELECT state, result FROM itinerary_notice_dispatches WHERE request_id = ? AND dispatch_key = ?").bind(params.id, key).first();
      if (previous) dispatch = { state: previous.state, result: previous.result ? JSON.parse(previous.result) : null };
    }
  }
  return json({
    ok: true, eligible: eligible(rec), ready: eligible(rec) && canSendKakao(env, payload),
    booking: { id: params.id, name: rec.name, phoneLast4: String(rec.phone || "").replace(/\D/g, "").slice(-4), depart: rec.depart, return_: rec.return_, adult: rec.adult, child: rec.child, infant: rec.infant, status: rec.status },
    payload, template: templates.templates?.find(t => t.templateId === configuredItineraryId) || null,
    configuration: { itineraryTemplateId: configuredItineraryId, quoteTemplateId: quoteTemplateId(env), sameTemplate: !!configuredItineraryId && configuredItineraryId === quoteTemplateId(env) },
    quoteTemplate: templates.templates?.find(t => t.templateId === quoteTemplateId(env)) || null,
    dispatch,
    templatesError: templates.ok ? undefined : templates.reason,
    templateError: payload.templateId ? undefined : "Missing itinerary template or same ID as quote template",
  });
}

export async function onRequestPost({ request, env, params }) {
  if (!authorized(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  let input;
  try { input = await request.json(); } catch { return json({ ok: false, error: "invalid JSON" }, 400); }
  if (!input || !/^[a-zA-Z0-9_-]{16,100}$/.test(input.idempotencyKey || ""))
    return json({ ok: false, error: "idempotencyKey required (16–100 letters, digits, - or _)" }, 400);
  const rec = await booking(env, params.id);
  if (!rec) return json({ ok: false, error: "not found" }, 404);
  if (!eligible(rec)) return json({ ok: false, error: "published itinerary required" }, 409);
  const payload = itineraryNoticePayload(env, rec);
  if (!canSendKakao(env, payload) || input.templateId !== payload.templateId)
    return json({ ok: false, error: "Preview and verify the configured itinerary template before sending" }, 409);

  // Dedicated ledger survives ordinary booking saves and concurrent browser requests.
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS itinerary_notice_dispatches (
    request_id TEXT NOT NULL, dispatch_key TEXT NOT NULL, state TEXT NOT NULL,
    created_at TEXT NOT NULL, result TEXT, PRIMARY KEY (request_id, dispatch_key)
  )`).run();
  const claim = await env.DB.prepare(`INSERT INTO itinerary_notice_dispatches
    (request_id, dispatch_key, state, created_at) VALUES (?, ?, 'sending', ?)
    ON CONFLICT(request_id, dispatch_key) DO NOTHING`).bind(params.id, input.idempotencyKey, new Date().toISOString()).run();
  if (claim.meta?.changes !== 1) {
    const previous = await env.DB.prepare("SELECT state, result FROM itinerary_notice_dispatches WHERE request_id = ? AND dispatch_key = ?").bind(params.id, input.idempotencyKey).first();
    return json({ ok: previous?.state === "accepted", duplicate: true, state: previous?.state || "unknown", result: previous?.result ? JSON.parse(previous.result) : null });
  }
  let result;
  try { result = await notifyCustomerItineraryReady(env, rec); }
  catch { result = { ok: false, error: "Provider outcome unknown; inspect Solapi before any further attempt" }; }
  // HTTP acceptance is not proof of delivery; return the provider receipt for review.
  const state = result.ok ? "accepted" : "unknown";
  await env.DB.prepare("UPDATE itinerary_notice_dispatches SET state = ?, result = ? WHERE request_id = ? AND dispatch_key = ?").bind(state, JSON.stringify(result), params.id, input.idempotencyKey).run();
  return json({ ok: !!result.ok, state, result }, result.ok ? 200 : 502);
}
