/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/deposit/<token>
   POST : 고객이 매직 링크로 "예약금 입금 완료" 신고
   - 고객이 입금자명을 입력하고 입금 완료를 알리면
   - 관리자 페이지에 즉시 "입금 신고 확인" 상태로 표시되고
   - 관리자(ADMIN_PHONE)에게 입금 확인 요청 문자를 발송합니다.
   ═══════════════════════════════════════════════════════════ */

import { notifyAdmin } from "../_solapi.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export async function onRequestPost(context) {
  const { request, env, params } = context;
  try {
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    if (!token || String(token).length < 16) return json({ ok: false, error: "invalid token" }, 400);

    let body = {};
    try { body = await request.json(); } catch (e) { body = {}; }

    const row = await env.DB
      .prepare("SELECT id, data, status FROM requests WHERE token = ?")
      .bind(token)
      .first();
    if (!row) return json({ ok: false, error: "not found" }, 404);

    const rec = JSON.parse(row.data || "{}");
    if (!rec.booking) return json({ ok: false, error: "no booking" }, 400);

    const depositorName = String(body.name || rec.name || "").trim().slice(0, 40);
    const now = new Date().toISOString();

    rec.booking.depositReport = {
      status: "reported",
      name: depositorName,
      reportedAt: now,
    };

    rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
    rec.activities.push({
      at: now,
      type: "deposit_reported",
      detail: `고객이 예약금 입금 완료를 알림${depositorName ? ` (입금자명: ${depositorName})` : ""}`,
    });
    rec.activities = rec.activities.slice(-100);

    await env.DB.prepare("UPDATE requests SET data = ? WHERE id = ?")
      .bind(JSON.stringify(rec), row.id).run();

    const ci = rec.booking.contractInfo || {};
    const amt = Number(ci.depositAmount || 0) ? Number(ci.depositAmount).toLocaleString("ko-KR") + "원" : "확인 필요";
    const adminText = `[예약금 입금 알림] ${rec.name || "고객"}님이 예약금 입금 완료를 알렸습니다.\n` +
      `• 입금자명: ${depositorName || rec.name || "-"}\n` +
      `• 예약금: ${amt}\n` +
      `• 여행지: ${rec.destination || "-"}\n` +
      `관리자 예약관리 페이지에서 입금 내역을 확인해 주세요.`;

    if (context.waitUntil) {
      context.waitUntil(notifyAdmin(env, adminText).catch(() => null));
    }

    return json({
      ok: true,
      depositReport: rec.booking.depositReport,
    });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
