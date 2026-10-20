/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/requests/:id
   PATCH  : 관리자가 상태/메모/견적 변경 (x-admin-token 헤더 필요)
   DELETE : 관리자가 문의 삭제 (x-admin-token 헤더 필요)
   ═══════════════════════════════════════════════════════════ */

import { workflowStatus, defaultQuoteExpiry, requiredLodgeCount } from "../_workflow.mjs";
import { MANUAL_TRIGGER, travelNoticeState } from "../_travel-notice.mjs";
import { resolveNotificationTemplate } from '../../lib/customerNotifications.ts';
import { backgroundCustomerEvent, customerEvent, recordTravelNoticeOutcome } from '../_customer-events.mjs';
import { documentRevision, quoteDocumentRevisions } from '../../lib/adminDocumentRevision.ts';

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
  const lodgeNeeded = requiredLodgeCount(days, rec);
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
  if (!isAdmin(request, env)) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    const patch = await request.json();
    const id = params.id;

    const forceNotifyQuote = !!patch.notifyQuote; delete patch.notifyQuote;
    /* [저장하기]는 고객 알림 없이 내부 저장만 — [링크 공유하기]에서만 발송합니다 */
    const silentQuote = !!patch.silentQuote; delete patch.silentQuote;
    const rotateCustomerLink = !!patch.rotateCustomerLink; delete patch.rotateCustomerLink;
    const requestTravelerInfo = !!patch.notifyTravelers; delete patch.notifyTravelers;
    const requestDeposit = !!patch.notifyDeposit; delete patch.notifyDeposit;
    const requestContract = !!patch.notifyContract; delete patch.notifyContract;
    const confirmDeposit = !!patch.confirmDeposit; delete patch.confirmDeposit;
    const sendTravelNotice = !!patch.notifyTravelNotice; delete patch.notifyTravelNotice;

    const row = await env.DB.prepare("SELECT data, status FROM requests WHERE id = ?").bind(id).first();
    if (!row) return json({ ok: false, error: "not found" }, 404);

    const rec = JSON.parse(row.data);
    const previousAccepted = rec.decision?.status === 'accepted';
    const previousPaid = rec.booking?.contractInfo?.depositStatus === '입금완료';
    const previousChanges = Array.isArray(rec.changeRequests) ? rec.changeRequests : [];
    const previousDocumentVersions = await quoteDocumentRevisions(rec);
    if ((requestTravelerInfo || requestDeposit || requestContract || confirmDeposit) && !rec.booking) 
      return json({ ok:false, error:"예약관리를 먼저 시작해 주세요" }, 409);
    
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
    const prevPublish = (rec.booking && rec.booking.publishStatus) || "draft";

    if (patch.booking && !patch.resetContract) {
      const prev = rec.booking;
      if (prev && prev.contract && prev.contract.signedAt && !(patch.booking.contract && patch.booking.contract.signedAt)) {
        patch.booking.contract = prev.contract;
        patch.booking.checklist = { ...(patch.booking.checklist || {}), contract: true };
      }
      const prevSubmitted = prev && prev.travelerSubmission && prev.travelerSubmission.submittedAt;
      const incomingSubmitted = patch.booking.travelerSubmission && patch.booking.travelerSubmission.submittedAt;
      if (prevSubmitted && prevSubmitted !== incomingSubmitted) {
        patch.booking.travelers = prev.travelers;
        patch.booking.travelerSubmission = prev.travelerSubmission;
      }
      const prevReported = prev && prev.depositReport && prev.depositReport.status === "reported";
      const incomingReported = patch.booking.depositReport && patch.booking.depositReport.status === "reported";
      if (prevReported && !incomingReported) patch.booking.depositReport = prev.depositReport;
    }
    delete patch.resetContract;
    delete patch.activities;

    const next = { ...rec, ...patch };
    if (patch.status === "예약확정" && !isConfirmationReady(next))
      return json({ ok: false, error: "고객 수락·계약 서명·예약금 입금이 모두 필요합니다", code: "confirmation_not_ready" }, 409);
    
    if (patch.booking && patch.booking.publishStatus === "published" && prevPublish !== "published") {
      next.status = patch.status === undefined ? prevStatus : patch.status;
      if (!isPublishReady(next))
        return json({ ok: false, error: "예약확정 후 일정·가이드·차량·숙소 배정을 완료해야 공개할 수 있습니다", code: "publish_not_ready" }, 409);
    }

    Object.assign(rec, patch);
    if (patch.status === undefined) rec.status = prevStatus;

    const now = new Date().toISOString();
    if (!hadBooking && rec.booking && !rec.booking.preparedAt) rec.booking.preparedAt = now;
    if (!!rec.quote && (!hadQuote || forceNotifyQuote)) {
      rec.quoteIssuedAt = now;
      rec.quoteExpiresAt = defaultQuoteExpiry(new Date(now));
    }
    if (rec.status === "예약확정" && rec.booking && !rec.booking.confirmedAt) rec.booking.confirmedAt = now.slice(0, 10);
    if (rec.booking && rec.booking.publishStatus === "published" && prevPublish !== "published") rec.booking.publishedAt = now;

    rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
    if (requestTravelerInfo) {
      const expected = (Number(rec.adult)||0) + (Number(rec.child)||0) + (Number(rec.infant)||0);
      rec.booking.travelerSubmission = { ...(rec.booking.travelerSubmission || {}), status:"requested", requestedAt:now, expectedCount:expected, submittedCount:Array.isArray(rec.booking.travelers) ? rec.booking.travelers.length : 0 };
      rec.activities.push({ at:now, type:"travelers_requested", detail:"고객에게 여행자 정보 입력 요청" });
    }
    if (requestDeposit) {
      rec.booking.depositRequest = { status:"requested", requestedAt:now };
      rec.activities.push({ at:now, type:"deposit_requested", detail:"예약금 입금 안내" });
    }
    if (requestContract) {
      rec.booking.contractRequest = { status:"requested", requestedAt:now };
      rec.activities.push({ at:now, type:"contract_requested", detail:"계약서 서명 요청" });
    }
    if (confirmDeposit) {
      rec.booking.contractInfo = { ...(rec.booking.contractInfo || {}), depositStatus: "입금완료" };
      rec.booking.checklist = { ...(rec.booking.checklist || {}), deposit: true };
      if (!rec.booking.contract?.signedAt) rec.booking.contractRequest = { status:"requested", requestedAt:now };
      rec.activities.push({ at:now, type:"deposit_confirmed", detail:"관리자가 입금 확인함" });
    }
    if (rotateCustomerLink) { rec.token = randomToken(); rec.activities.push({ at:now, type:"customer_link_rotated", detail:"링크 재발급" }); }

    const nextWorkflow = workflowStatus(rec, rec.status);
    rec.workflowStatus = nextWorkflow;
    const notifications = [];
    const currentDocumentVersions = await quoteDocumentRevisions(rec);
    for (const kind of ['quote', 'itinerary', 'contract']) {
      if (previousDocumentVersions[kind] !== currentDocumentVersions[kind]) rec.activities.push({ at:now, type:`${kind}_document_changed`, detail:'관리자가 고객 문서 내용을 변경했습니다.' });
    }
    const publishingItinerary = !!(rec.booking && rec.booking.publishStatus === "published" && prevPublish !== "published");
    const shouldNotifyQuote = !publishingItinerary && !silentQuote && !!rec.quote && (!hadQuote || forceNotifyQuote);
    const firstDepositConfirmed = !previousPaid && rec.booking?.contractInfo?.depositStatus === '입금완료';
    const shouldNotifyContract = firstDepositConfirmed || requestContract;
    const shouldNotifyItinerary = publishingItinerary;

    const readyFor = kind => !!(env.SOLAPI_API_KEY && env.SOLAPI_API_SECRET && resolveNotificationTemplate(env, kind) && /^0\d{8,10}$/.test(String(rec.phone || '').replace(/\D/g, '')));

    if (shouldNotifyQuote) {
      const ready = readyFor('quote');
      notifications.push({ type:"quote", status:ready ? "queued" : "skipped" });
      rec.activities.push({ at:now, type:ready ? "quote_notification_queued" : "quote_notification_skipped", detail:ready ? "고객 견적 준비 알림톡 발송 요청" : "견적 발행 알림 건너뜀" });
    }
    if (shouldNotifyContract) {
      const ready = readyFor('contract');
      notifications.push({ type:"contract", status:ready ? "queued" : "skipped" });
      rec.activities.push({ at:now, type:ready ? "contract_notification_queued" : "contract_notification_skipped", detail:ready ? "고객 계약서 서명 안내 발송 요청" : "계약서 안내 발송 건너뜀" });
    }
    if (shouldNotifyItinerary) {
      const ready = readyFor('itinerary');
      notifications.push({ type:"itinerary", status:ready ? "queued" : "skipped" });
      rec.activities.push({ at:now, type:ready ? "itinerary_notification_queued" : "itinerary_notification_skipped", detail:ready ? "고객 확정일정표 확인 알림톡 발송 요청" : "확정일정표 알림 건너뜀" });
    }

    rec.activities = rec.activities.slice(-100);
    const persisted = await env.DB.prepare("UPDATE requests SET status = ?, memo = ?, data = ?, token = ? WHERE id = ? AND data = ?")
      .bind(rec.status, rec.memo || "", JSON.stringify(rec), rec.token || "", id, row.data).run();
    if (Number(persisted?.meta?.changes ?? persisted?.changes ?? 0) !== 1) return json({ ok:false, error:'다른 화면에서 예약이 변경되었습니다. 입력을 보관한 뒤 최신 정보를 확인해 주세요.' }, 409);

    const bg = async (kind, eventKey, forceManual = false) => backgroundCustomerEvent(context, { source:'quote_booking', bookingId:id, kind, eventKey, ...(forceManual ? {forceManual:true} : {}) });
    if (shouldNotifyQuote) await bg('quote', forceNotifyQuote ? `quote-shared:${now}:${currentDocumentVersions.quote}` : 'first-quote-issued:v1', forceNotifyQuote);
    if (shouldNotifyContract) await bg('contract', requestContract ? `contract-requested:${rec.booking.contractRequest?.requestedAt || now}` : 'first-deposit-paid:v1', requestContract);
    if (shouldNotifyItinerary) await bg('itinerary', 'first-itinerary-published:v1');
    if (requestDeposit) await bg('deposit_requested', `deposit-requested:${rec.booking.depositRequest.requestedAt}`);
    if (requestTravelerInfo) await bg('travelers_requested', `travelers-requested:${rec.booking.travelerSubmission.requestedAt}`);
    if (!previousAccepted && rec.decision?.status === 'accepted') await bg('reservation_requested', 'first-reservation-requested:v1');
    if (prevStatus !== '예약확정' && rec.status === '예약확정') await bg('booking_confirmed', 'first-booking-confirmed:v1');
    const changeKey = async change => change?.id ? `id:${String(change.id).slice(0, 150)}` : `hash:${await documentRevision(change)}`;
    const oldChanges = new Set(await Promise.all(previousChanges.map(changeKey)));
    for (const change of Array.isArray(rec.changeRequests) ? rec.changeRequests : []) {
      if (!change || typeof change !== 'object' || Array.isArray(change)) continue;
      const key = await changeKey(change);
      if (!oldChanges.has(key)) { oldChanges.add(key); await bg('change_requested', `change-requested:${key}`); }
    }

    // Manual re-notices persist the main edit first, then return the actual
    // provider receipt. Failed/unknown delivery never reports the saved edit lost.
    let travelNotice;
    if (sendTravelNotice) {
      const result = await customerEvent(context, { source:'quote_booking', bookingId:id, kind:'travel_notice', eventKey:`admin-travel-notice:${crypto.randomUUID()}` });
      let marked;
      try { marked = await recordTravelNoticeOutcome(env, id, result, MANUAL_TRIGGER); }
      catch { marked = { marked:false }; }
      if (marked.rec) { rec.notify = marked.rec.notify; rec.activities = marked.rec.activities; }
      const state = travelNoticeState(rec);
      travelNotice = { ok:result.ok, state:result.state, duplicate:!!result.duplicate, ...(result.ok ? { sentAt:state.sentAt, sentCount:state.sentCount } : { reason:result.error || '알림 처리 결과를 확인해 주세요.' }),
        ...(!marked.marked && !result.duplicate ? { warning:'주 업무는 저장되었습니다. 발송 결과는 발송 이력에서 확인해 주세요.' } : {}) };
    }

    return json({
      ok: true,
      status: rec.status,
      token: rotateCustomerLink ? rec.token : undefined,
      workflowStatus: rec.workflowStatus,
      quoteExpiresAt: rec.quoteExpiresAt || "",
      publishStatus: (rec.booking && rec.booking.publishStatus) || "draft",
      preparedAt: rec.booking && rec.booking.preparedAt,
      travelerSubmission: rec.booking && rec.booking.travelerSubmission,
      depositRequest: rec.booking && rec.booking.depositRequest,
      contractRequest: rec.booking && rec.booking.contractRequest,
      travelNotice,
      notify: rec.notify,
      notifications,
      activities: rec.activities,
    });
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
