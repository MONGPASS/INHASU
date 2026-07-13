/* 고객 견적 수락 · /api/accept/<token>
   POST: 고객이 발행 견적을 확인하고 예약 진행 의사를 확정합니다. */

import { notifyAdmin, sendQuoteAccepted } from "../_solapi.js";
import { isQuoteExpired } from "../_workflow.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export async function onRequestPost(context) {
  const { env, params } = context;
  try {
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    if (!token || String(token).length < 16) return json({ ok: false, error: "invalid token" }, 400);

    const row = await env.DB
      .prepare("SELECT id, data, status FROM requests WHERE token = ?")
      .bind(token)
      .first();
    if (!row) return json({ ok: false, error: "not found" }, 404);

    const rec = JSON.parse(row.data || "{}");
    if (!rec.quote) return json({ ok: false, error: "quote not ready" }, 409);
    if (isQuoteExpired(rec)) return json({ ok:false, error:"quote expired", code:"quote_expired" }, 410);
    if (rec.decision && rec.decision.status === "accepted") {
      return json({ ok: true, acceptedAt: rec.decision.acceptedAt, alreadyAccepted: true });
    }

    const now = new Date().toISOString();
    rec.decision = { status: "accepted", acceptedAt: now, source: "customer" };
    rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
    rec.activities.push({ at: now, type: "quote_accepted", detail: "고객이 견적을 수락함" });
    rec.activities = rec.activities.slice(-100);
    if (!row.status || row.status === "신규") rec.status = "진행중";
    else rec.status = row.status;

    await env.DB.prepare("UPDATE requests SET status = ?, data = ? WHERE id = ?")
      .bind(rec.status, JSON.stringify(rec), row.id)
      .run();

    // 담당자에게 문자 알림 — 백그라운드, 실패해도 수락 처리에는 영향 없음
    context.waitUntil(
      notifyAdmin(env,
        `[견적 수락] ${rec.name || "고객"} · ${rec.destination || "여행지 미정"}\n` +
        `고객이 견적을 수락했습니다. 예약 준비를 시작해 주세요.`
      ).then(res => console.log("notify-admin-accept", JSON.stringify(res)))
       .catch(e => console.log("notify-admin-accept-err", String(e)))
    );
    if (rec.phone && rec.token) context.waitUntil(
      sendQuoteAccepted(env, { name:rec.name || "고객", phone:rec.phone, origin:new URL(context.request.url).origin, token:rec.token })
        .then(res => console.log("alimtalk-accept", JSON.stringify(res)))
        .catch(e => console.log("alimtalk-accept-err", String(e)))
    );

    return json({ ok: true, acceptedAt: now });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
