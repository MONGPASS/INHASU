import { notifyAdmin, sendChangeRequested } from "../_solapi.js";

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

const ALLOWED = new Set(["일정", "방문 장소", "숙소", "이동시간", "여행 인원·날짜", "견적금액", "기타"]);

export async function onRequestPost(context) {
  const { request, env, params } = context;
  try {
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    if (!token || String(token).length < 16) return json({ ok:false, error:"invalid token" }, 400);
    const body = await request.json();
    const categories = Array.isArray(body.categories) ? body.categories.filter(x => ALLOWED.has(x)).slice(0, 7) : [];
    const message = String(body.message || "").trim().slice(0, 1500);
    if (!categories.length || !message) return json({ ok:false, error:"request details required" }, 400);

    const row = await env.DB.prepare("SELECT id, data FROM requests WHERE token = ?").bind(token).first();
    if (!row) return json({ ok:false, error:"not found" }, 404);
    const rec = JSON.parse(row.data || "{}");
    const now = new Date().toISOString();
    rec.changeRequests = Array.isArray(rec.changeRequests) ? rec.changeRequests : [];
    rec.changeRequests.push({ id: crypto.randomUUID(), at: now, categories, message, status:"requested" });
    rec.changeRequests = rec.changeRequests.slice(-20);
    rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
    rec.activities.push({ at:now, type:"change_requested", detail:`일정 변경 요청 · ${categories.join(", ")}: ${message}` });
    rec.activities = rec.activities.slice(-100);
    await env.DB.prepare("UPDATE requests SET data = ? WHERE id = ?").bind(JSON.stringify(rec), row.id).run();

    context.waitUntil(notifyAdmin(env,
      `[일정 변경 요청] ${rec.name || "고객"} · ${rec.destination || "여행지 미정"}\n` +
      `${categories.join(", ")}\n${message}`
    ).catch(e => console.log("notify-admin-change-err", String(e))));
    if (rec.phone && rec.token) context.waitUntil(sendChangeRequested(env, {
      name:rec.name || "고객", phone:rec.phone, origin:new URL(request.url).origin, token:rec.token,
    }).catch(e => console.log("alimtalk-change-err", String(e))));
    return json({ ok:true, requestedAt:now });
  } catch (e) {
    return json({ ok:false, error:String(e) }, 500);
  }
}
