/* 고객 예약금 입금 신고 · /api/deposit/<token>
   POST { name }: 고객이 예약금을 입금한 뒤 입금자명과 함께 "입금했어요"를 신고합니다.
   실제 입금 확인·상태 변경(입금완료)은 관리자가 합니다 — 고객 알림톡은 보내지 않습니다. */

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
  const { env, params, request } = context;
  try {
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    if (!token || String(token).length < 16) return json({ ok: false, error: "invalid token" }, 400);

    let body = {};
    try { body = await request.json(); } catch (e) {}
    const name = String(body.name || "").trim().slice(0, 40);
    if (!name) return json({ ok: false, error: "입금자명을 입력해 주세요" }, 400);

    const row = await env.DB
      .prepare("SELECT id, data, status FROM requests WHERE token = ?")
      .bind(token)
      .first();
    if (!row) return json({ ok: false, error: "not found" }, 404);

    const rec = JSON.parse(row.data || "{}");
    const bk = rec.booking;
    if (!bk || !(bk.depositRequest && bk.depositRequest.status === "requested"))
      return json({ ok: false, error: "입금 안내가 아직 준비되지 않았습니다" }, 409);
    if (bk.contractInfo && bk.contractInfo.depositStatus === "입금완료")
      return json({ ok: true, alreadyPaid: true });

    const now = new Date().toISOString();
    bk.depositReport = { status: "reported", name, reportedAt: now };
    rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
    rec.activities.push({ at: now, type: "deposit_reported", detail: `고객이 입금 완료를 신고함 (입금자명: ${name})` });
    rec.activities = rec.activities.slice(-100);

    await env.DB.prepare("UPDATE requests SET data = ? WHERE id = ?")
      .bind(JSON.stringify(rec), row.id)
      .run();

    const amount = Number(bk.contractInfo && bk.contractInfo.depositAmount) || 0;
    context.waitUntil(
      notifyAdmin(env,
        `[입금 신고] ${rec.name || "고객"} · ${rec.destination || "여행지 미정"}\n` +
        `예약금 ${amount.toLocaleString("ko-KR")}원 · 입금자명 '${name}'\n` +
        `입금 확인 후 대시보드에서 입금완료로 변경해 주세요.`
      ).then(res => console.log("notify-admin-deposit", JSON.stringify(res)))
       .catch(e => console.log("notify-admin-deposit-err", String(e)))
    );

    return json({ ok: true, reportedAt: now });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
