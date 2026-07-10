/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/requests/:id
   PATCH  : 관리자가 상태/메모/견적 변경 (?token=… 필요)
   DELETE : 관리자가 문의 삭제 (?token=… 필요)
   ═══════════════════════════════════════════════════════════ */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

// 관리자 토큰: 헤더(x-admin-token) 우선, 쿼리(?token=)도 호환용으로 허용
const isAdmin = (request, env) => {
  const url = new URL(request.url);
  const token = request.headers.get("x-admin-token") || url.searchParams.get("token") || "";
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
};

const isAccepted = rec => !!(rec.decision && rec.decision.status === "accepted");
const isConfirmationReady = rec => {
  const booking = rec.booking || {};
  const signed = !!(booking.contract && booking.contract.signedAt);
  const paid = !!(booking.contractInfo && booking.contractInfo.depositStatus === "입금완료");
  return !!rec.quote && isAccepted(rec) && signed && paid;
};
const isPublishReady = rec => {
  const booking = rec.booking || {};
  const days = Array.isArray(booking.days) ? booking.days : [];
  const assign = booking.assign || {};
  const lodges = Array.isArray(assign.lodges) ? assign.lodges.filter(x => x && x.name) : [];
  const stayDays = days.filter(d => d && d.stay && d.stay.name && d.stay.name !== "숙소미포함").length;
  return rec.status === "예약확정" && days.length > 0 &&
    !!(assign.guide && assign.guide.name) && !!(assign.vehicle && assign.vehicle.model) &&
    lodges.length >= (stayDays || Math.max(days.length - 1, 0));
};

export async function onRequestPatch({ request, env, params }) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const patch = await request.json();
    const id = params.id;

    // 현재 레코드 읽기 (status 컬럼도 함께 — 상태 보존용)
    const row = await env.DB.prepare("SELECT data, status FROM requests WHERE id = ?").bind(id).first();
    if (!row) return json({ ok: false, error: "not found" }, 404);

    const rec = JSON.parse(row.data);
    const hadBooking = !!rec.booking;
    const prevStatus = row.status || rec.status || "신규";
    const prevDecision = (rec.decision && rec.decision.status) || "pending";
    const prevPublish = (rec.booking && rec.booking.publishStatus) || (prevStatus === "예약확정" ? "published" : "draft");
    const prevDeposit = rec.booking && rec.booking.contractInfo ? rec.booking.contractInfo.depositStatus || "미입금" : "미입금";
    const prevBalance = rec.booking && rec.booking.contractInfo ? rec.booking.contractInfo.balanceStatus || "미수령" : "미수령";
    // booking 저장 시 기존 계약 서명은 보존 — 관리자가 예약관리를 열어둔 사이 고객이 서명해도
    // 구스냅샷 저장으로 서명이 지워지지 않게. 명시적 초기화(resetContract)일 때만 삭제 허용.
    if (patch.booking && !patch.resetContract) {
      const prev = rec.booking;
      if (prev && prev.contract && prev.contract.signedAt &&
          !(patch.booking.contract && patch.booking.contract.signedAt)) {
        patch.booking.contract = prev.contract;
        patch.booking.checklist = { ...(patch.booking.checklist || {}), contract: true };
      }
    }
    delete patch.resetContract;   // 플래그가 rec에 저장되지 않게
    delete patch.activities;      // 활동 이력은 서버에서만 추가
    const next = { ...rec, ...patch };
    if (patch.booking && patch.status === undefined && ["신규", "진행중"].includes(prevStatus) && isConfirmationReady(next)) {
      patch.status = "예약확정";
      next.status = "예약확정";
    }
    if (patch.status === "예약확정" && !isConfirmationReady(next)) {
      return json({ ok: false, error: "고객 수락·계약 서명·예약금 입금이 모두 필요합니다", code: "confirmation_not_ready" }, 409);
    }
    if (patch.booking && patch.booking.publishStatus === "published" && prevPublish !== "published") {
      next.status = patch.status === undefined ? prevStatus : patch.status;
      if (!isPublishReady(next)) {
        return json({ ok: false, error: "예약확정 후 일정·가이드·차량·숙소 배정을 완료해야 공개할 수 있습니다", code: "publish_not_ready" }, 409);
      }
    }

    Object.assign(rec, patch);
    // patch에 status가 없으면 기존 상태 유지 — 견적 발행 등으로 상태가 임의로 바뀌지 않게.
    // 상태 변경은 관리자가 대시보드에서 명시적으로 status를 보낼 때만 이뤄짐.
    if (patch.status === undefined) rec.status = row.status || rec.status || "신규";

    const now = new Date().toISOString();
    if (rec.status === "예약확정" && rec.booking && !rec.booking.confirmedAt) {
      rec.booking.confirmedAt = now.slice(0, 10);
    }
    if (rec.booking && rec.booking.publishStatus === "published" && prevPublish !== "published") {
      rec.booking.publishedAt = now;
    }

    rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
    if (!hadBooking && rec.booking) {
      rec.activities.push({ at: now, type: "booking_started", detail: "예약 준비를 시작함" });
    }
    const nextDecision = (rec.decision && rec.decision.status) || "pending";
    if (prevDecision !== nextDecision) {
      rec.activities.push({ at: now, type: "decision_changed", detail: `고객 결정: ${prevDecision} → ${nextDecision}` });
    }
    if (prevStatus !== rec.status) {
      rec.activities.push({ at: now, type: "status_changed", detail: `상태: ${prevStatus} → ${rec.status}` });
    }
    const nextPublish = (rec.booking && rec.booking.publishStatus) || "draft";
    if (prevPublish !== nextPublish) {
      rec.activities.push({ at: now, type: "publish_changed", detail: `일정표 공개: ${prevPublish} → ${nextPublish}` });
    }
    const nextDeposit = rec.booking && rec.booking.contractInfo ? rec.booking.contractInfo.depositStatus || "미입금" : "미입금";
    const nextBalance = rec.booking && rec.booking.contractInfo ? rec.booking.contractInfo.balanceStatus || "미수령" : "미수령";
    if (prevDeposit !== nextDeposit) rec.activities.push({ at: now, type: "payment_changed", detail: `예약금: ${prevDeposit} → ${nextDeposit}` });
    if (prevBalance !== nextBalance) rec.activities.push({ at: now, type: "payment_changed", detail: `잔금: ${prevBalance} → ${nextBalance}` });
    rec.activities = rec.activities.slice(-100);

    await env.DB.prepare(
      "UPDATE requests SET status = ?, memo = ?, data = ? WHERE id = ?"
    ).bind(rec.status || "신규", rec.memo || "", JSON.stringify(rec), id).run();

    return json({ ok: true, status: rec.status || "신규", publishStatus: (rec.booking && rec.booking.publishStatus) || "draft", activities: rec.activities });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

// ── 문의 삭제 (관리자 전용) ──
export async function onRequestDelete({ request, env, params }) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const r = await env.DB.prepare("DELETE FROM requests WHERE id = ?").bind(params.id).run();
    if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: "not found" }, 404);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
