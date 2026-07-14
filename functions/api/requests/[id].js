/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/requests/:id
   PATCH  : 관리자가 상태/메모/견적 변경 (x-admin-token 헤더 필요)
   DELETE : 관리자가 문의 삭제 (x-admin-token 헤더 필요)
   ═══════════════════════════════════════════════════════════ */

import { workflowStatus, defaultQuoteExpiry, requiredLodgeCount } from "../_workflow.mjs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

// 관리자 토큰은 URL·브라우저 기록에 남지 않도록 헤더로만 받습니다.
const isAdmin = (request, env) => {
  const token = request.headers.get("x-admin-token") || "";
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
};
const randomToken = () => [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, "0")).join("");

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
  const lodgeNeeded = requiredLodgeCount(days);
  return rec.status === "예약확정" && days.length > 0 &&
    !!(assign.guide && assign.guide.name) && !!(assign.vehicle && assign.vehicle.model) &&
    lodges.length >= lodgeNeeded;
};

// 관리자 단건 조회 — 계약서 원본 서명 등 공개 API에서 제외한 내부 자료 확인용
export async function onRequestGet({ request, env, params }) {
  if (!isAdmin(request, env)) return json({ ok:false, error:"unauthorized" }, 401);
  try {
    const row = await env.DB.prepare("SELECT data, status, memo FROM requests WHERE id = ?").bind(params.id).first();
    if (!row) return json({ ok:false, error:"not found" }, 404);
    const item = JSON.parse(row.data || "{}");
    item.status = row.status || item.status || "신규";
    item.memo = row.memo || item.memo || "";
    return json({ ok:true, item });
  } catch (e) {
    return json({ ok:false, error:String(e) }, 500);
  }
}

export async function onRequestPatch(context) {
  const { request, env, params } = context;
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const patch = await request.json();
    const id = params.id;

    // 견적 재발행 시에도 고객에게 다시 알리고 싶을 때 관리자가 보내는 플래그
    const forceNotifyQuote = patch.notifyQuote === true;
    delete patch.notifyQuote;
    const rotateCustomerLink = patch.rotateCustomerLink === true;
    delete patch.rotateCustomerLink;
    const requestTravelerInfo = patch.notifyTravelers === true;
    delete patch.notifyTravelers;
    const requestDeposit = patch.notifyDeposit === true;
    delete patch.notifyDeposit;
    const requestContract = patch.notifyContract === true;
    delete patch.notifyContract;
    // 입금 확인 원클릭: 입금완료 저장 + 계약서 서명·여행자 정보 요청 자동 발송
    const confirmDeposit = patch.confirmDeposit === true;
    delete patch.confirmDeposit;

    // 현재 레코드 읽기 (status 컬럼도 함께 — 상태 보존용)
    const row = await env.DB.prepare("SELECT data, status FROM requests WHERE id = ?").bind(id).first();
    if (!row) return json({ ok: false, error: "not found" }, 404);

    const rec = JSON.parse(row.data);
    if (requestTravelerInfo && !rec.booking) return json({ ok:false, error:"예약관리를 먼저 시작해 주세요" }, 409);
    if ((requestDeposit || requestContract || confirmDeposit) && !rec.booking) return json({ ok:false, error:"예약정보를 먼저 저장해 주세요" }, 409);
    if (requestDeposit) {
      const ci = rec.booking.contractInfo || {};
      if (!(Number(ci.depositAmount) > 0) || !ci.bankName || !ci.accountNumber || !ci.accountHolder)
        return json({ ok:false, error:"예약금과 입금 계좌 정보를 먼저 저장해 주세요" }, 409);
    }
    if (requestContract && (!rec.booking.contractInfo || rec.booking.contractInfo.depositStatus !== "입금완료"))
      return json({ ok:false, error:"예약금 입금 확인 후 계약서 서명을 요청할 수 있습니다" }, 409);
    const hadBooking = !!rec.booking;
    const hadQuote = !!rec.quote;
    const prevStatus = row.status || rec.status || "신규";
    const prevDecision = (rec.decision && rec.decision.status) || "pending";
    const prevPublish = (rec.booking && rec.booking.publishStatus) || (prevStatus === "예약확정" ? "published" : "draft");
    const prevDeposit = rec.booking && rec.booking.contractInfo ? rec.booking.contractInfo.depositStatus || "미입금" : "미입금";
    const prevBalance = rec.booking && rec.booking.contractInfo ? rec.booking.contractInfo.balanceStatus || "미수령" : "미수령";
    const prevWorkflow = workflowStatus(rec, prevStatus);
    // booking 저장 시 기존 계약 서명은 보존 — 관리자가 예약관리를 열어둔 사이 고객이 서명해도
    // 구스냅샷 저장으로 서명이 지워지지 않게. 명시적 초기화(resetContract)일 때만 삭제 허용.
    if (patch.booking && !patch.resetContract) {
      const prev = rec.booking;
      if (prev && prev.contract && prev.contract.signedAt &&
          !(patch.booking.contract && patch.booking.contract.signedAt)) {
        patch.booking.contract = prev.contract;
        patch.booking.checklist = { ...(patch.booking.checklist || {}), contract: true };
      }
      // 고객이 이 화면을 연 뒤 여행자 정보를 제출했다면, 오래된 관리자 화면 저장으로 덮어쓰지 않습니다.
      const prevSubmitted = prev && prev.travelerSubmission && prev.travelerSubmission.submittedAt;
      const incomingSubmitted = patch.booking.travelerSubmission && patch.booking.travelerSubmission.submittedAt;
      if (prevSubmitted && prevSubmitted !== incomingSubmitted) {
        patch.booking.travelers = prev.travelers;
        patch.booking.travelerSubmission = prev.travelerSubmission;
      }
      // 고객의 입금 신고도 같은 방식으로 보존합니다.
      const prevReported = prev && prev.depositReport && prev.depositReport.status === "reported";
      const incomingReported = patch.booking.depositReport && patch.booking.depositReport.status === "reported";
      if (prevReported && !incomingReported) patch.booking.depositReport = prev.depositReport;
    }
    delete patch.resetContract;   // 플래그가 rec에 저장되지 않게
    delete patch.activities;      // 활동 이력은 서버에서만 추가
    const next = { ...rec, ...patch };
    // 예약정보 저장만으로 자동 확정하지 않습니다. 예약확정은 관리자가 명시적으로 선택해야 합니다.
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
    if (!hadBooking && rec.booking && !rec.booking.preparedAt) rec.booking.preparedAt = now;
    if (rec.quote && (!hadQuote || forceNotifyQuote)) {
      rec.quoteIssuedAt = now;
      rec.quoteExpiresAt = defaultQuoteExpiry(new Date(now));
    }
    if (rec.status === "예약확정" && rec.booking && !rec.booking.confirmedAt) {
      rec.booking.confirmedAt = now.slice(0, 10);
    }
    if (rec.booking && rec.booking.publishStatus === "published" && prevPublish !== "published") {
      rec.booking.publishedAt = now;
    }

    rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
    if (requestTravelerInfo) {
      const expectedCount = (Number(rec.adult)||0) + (Number(rec.child)||0) + (Number(rec.infant)||0);
      const alreadySubmitted = rec.booking.travelerSubmission && rec.booking.travelerSubmission.status === "submitted";
      rec.booking.travelerSubmission = {
        ...(rec.booking.travelerSubmission || {}), status:alreadySubmitted ? "submitted" : "requested", requestedAt:now,
        expectedCount, submittedCount:Array.isArray(rec.booking.travelers) ? rec.booking.travelers.length : 0,
      };
      rec.activities.push({ at:now, type:"travelers_requested", detail:`고객에게 여행자 정보 ${expectedCount}명 ${alreadySubmitted ? "확인·수정" : "입력"} 요청` });
    }
    if (requestDeposit) {
      rec.booking.depositRequest = { status:"requested", requestedAt:now };
      rec.activities.push({ at:now, type:"deposit_requested", detail:`고객에게 예약금 ${Number(rec.booking.contractInfo.depositAmount).toLocaleString("ko-KR")}원 입금 안내` });
    }
    if (requestContract) {
      rec.booking.contractRequest = { status:"requested", requestedAt:now };
      rec.activities.push({ at:now, type:"contract_requested", detail:"예약금 확인 후 고객에게 계약서 서명 요청" });
    }
    // 입금 확인 원클릭 — 입금완료 저장 + 계약서·여행자 정보 요청을 한 번에 (고객 페이지에 표시)
    if (confirmDeposit) {
      rec.booking.contractInfo = rec.booking.contractInfo || {};
      rec.booking.contractInfo.depositStatus = "입금완료";
      rec.booking.checklist = { ...(rec.booking.checklist || {}), deposit: true };
      const signed = !!(rec.booking.contract && rec.booking.contract.signedAt);
      if (!signed) rec.booking.contractRequest = { status:"requested", requestedAt:now };
      const travelersDone = rec.booking.travelerSubmission && rec.booking.travelerSubmission.status === "submitted";
      if (!travelersDone) {
        const expectedCount = (Number(rec.adult)||0) + (Number(rec.child)||0) + (Number(rec.infant)||0);
        rec.booking.travelerSubmission = {
          ...(rec.booking.travelerSubmission || {}), status:"requested", requestedAt:now,
          expectedCount, submittedCount:Array.isArray(rec.booking.travelers) ? rec.booking.travelers.length : 0,
        };
      }
      rec.activities.push({ at:now, type:"deposit_confirmed", detail:"관리자가 입금을 확인함 — 계약서 서명·여행자 정보 요청 자동 진행" });
    }
    if (rotateCustomerLink) {
      rec.token = randomToken();
      rec.activities.push({ at:now, type:"customer_link_rotated", detail:"고객 링크를 재발급하고 이전 링크를 폐기함" });
    }
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
    const nextWorkflow = workflowStatus(rec, rec.status);
    if (prevWorkflow !== nextWorkflow) {
      rec.workflowStatus = nextWorkflow;
      rec.activities.push({ at:now, type:"workflow_changed", detail:`예약 단계: ${prevWorkflow} → ${nextWorkflow}` });
    } else rec.workflowStatus = nextWorkflow;
    rec.activities = rec.activities.slice(-100);

    /* 고객 카톡 알림톡은 사용하지 않습니다 — 각 단계는 고객 페이지(내견적)에 즉시 표시되고,
       개별 연락은 카카오톡 채널에서 수동으로 합니다. 관리자 문자(notifyAdmin)만 유지. */
    rec.activities = rec.activities.slice(-100);

    await env.DB.prepare(
      "UPDATE requests SET status = ?, memo = ?, data = ?, token = ? WHERE id = ?"
    ).bind(rec.status || "신규", rec.memo || "", JSON.stringify(rec), rec.token || "", id).run();

    return json({ ok: true, status: rec.status || "신규", token:rotateCustomerLink ? rec.token : undefined, workflowStatus:rec.workflowStatus, quoteExpiresAt:rec.quoteExpiresAt || "", publishStatus: (rec.booking && rec.booking.publishStatus) || "draft", preparedAt:rec.booking && rec.booking.preparedAt, travelerSubmission:rec.booking && rec.booking.travelerSubmission, depositRequest:rec.booking && rec.booking.depositRequest, contractRequest:rec.booking && rec.booking.contractRequest, activities: rec.activities });
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
