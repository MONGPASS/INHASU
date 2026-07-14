/* 고객 견적 수락 · /api/accept/<token>
   POST: 고객이 발행 견적을 확인하고 예약 진행 의사를 확정합니다.
   수락 즉시 견적에서 예약금·계좌가 채워진 booking을 자동 생성해
   고객 화면(내견적)에 바로 입금 안내가 표시됩니다 — 별도 알림톡은 보내지 않습니다. */

import { notifyAdmin } from "../_solapi.js";
import { isQuoteExpired } from "../_workflow.mjs";
import { seedBookingFromQuote } from "../_booking.mjs";

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

    /* 예약금 안내 자동 준비 — 견적에서 예약금이 계산되는 경우에만.
       금액이 0원이면(가격표 미입력 견적 등) 기존 수동 흐름으로 넘깁니다. */
    let depositReady = false;
    if (!rec.booking) {
      const bk = seedBookingFromQuote(rec);
      if (Number(bk.contractInfo.depositAmount) > 0) {
        bk.preparedAt = now;
        bk.depositRequest = { status: "requested", requestedAt: now, source: "auto_accept" };
        rec.booking = bk;
        depositReady = true;
        rec.activities.push({ at: now, type: "deposit_requested",
          detail: `수락과 동시에 예약금 ${Number(bk.contractInfo.depositAmount).toLocaleString("ko-KR")}원 입금 안내 자동 표시` });
      }
    } else if (rec.booking.depositRequest && rec.booking.depositRequest.status === "requested") {
      depositReady = true;
    }
    rec.activities = rec.activities.slice(-100);
    if (!row.status || row.status === "신규") rec.status = "진행중";
    else rec.status = row.status;

    await env.DB.prepare("UPDATE requests SET status = ?, data = ? WHERE id = ?")
      .bind(rec.status, JSON.stringify(rec), row.id)
      .run();

    // 담당자에게 문자 알림 — 백그라운드, 실패해도 수락 처리에는 영향 없음
    const depositAmount = rec.booking && rec.booking.contractInfo ? Number(rec.booking.contractInfo.depositAmount) || 0 : 0;
    context.waitUntil(
      notifyAdmin(env,
        `[견적 수락] ${rec.name || "고객"} · ${rec.destination || "여행지 미정"}\n` +
        (depositReady
          ? `예약금 ${depositAmount.toLocaleString("ko-KR")}원 계좌 안내가 고객 화면에 표시됐습니다. 고객이 입금 후 신고하면 다시 알려드립니다.`
          : `고객이 견적을 수락했습니다. 견적에 예약금이 없어 예약관리에서 직접 안내해 주세요.`)
      ).then(res => console.log("notify-admin-accept", JSON.stringify(res)))
       .catch(e => console.log("notify-admin-accept-err", String(e)))
    );

    return json({ ok: true, acceptedAt: now, depositReady });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
