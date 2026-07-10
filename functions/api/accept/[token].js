/* 고객 견적 수락 · /api/accept/<token>
   POST: 고객이 발행 견적을 확인하고 예약 진행 의사를 확정합니다. */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export async function onRequestPost({ env, params }) {
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

    return json({ ok: true, acceptedAt: now });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
