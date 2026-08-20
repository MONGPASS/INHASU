/* ═══════════════════════════════════════════════════════════
   여행 주의사항(가이드북 PDF) 발송 기록 헬퍼
   ---------------------------------------------------------------
   발송 경로는 두 가지이며 기록은 이 모듈로 통일합니다.
     1) 자동 — 고객이 여행계약서에 서명한 직후 1회 (/api/sign/<token>)
     2) 수동 — 관리자가 예약관리에서 버튼으로 발송 (PATCH notifyTravelNotice)
   자동 발송은 서명 1건당 한 번만 나가고, 수동 발송은 횟수 제한이 없습니다.
   ═══════════════════════════════════════════════════════════ */

export const AUTO_TRIGGER = "contract_signed";
export const MANUAL_TRIGGER = "admin_manual";

export function travelNoticeState(rec) {
  const notify = rec && typeof rec.notify === "object" && rec.notify ? rec.notify : {};
  return {
    sentAt: notify.travelNoticeSentAt || "",
    sentCount: Number(notify.travelNoticeSentCount) || 0,
    autoSentAt: notify.travelNoticeAutoSentAt || "",
    lastTrigger: notify.travelNoticeTrigger || "",
  };
}

/* 서명 직후 자동 발송 대상인지 — 이미 자동으로 나갔으면 다시 보내지 않습니다.
   (관리자 수동 발송은 이 값과 무관하게 언제든 가능합니다) */
export function shouldAutoSendTravelNotice(rec) {
  return !travelNoticeState(rec).autoSentAt;
}

export function recordTravelNoticeSent(rec, { at, trigger }) {
  const sentAt = at || new Date().toISOString();
  rec.notify = rec.notify && typeof rec.notify === "object" ? rec.notify : {};
  rec.notify.travelNoticeSentAt = sentAt;
  rec.notify.travelNoticeTrigger = trigger;
  rec.notify.travelNoticeSentCount = (Number(rec.notify.travelNoticeSentCount) || 0) + 1;
  if (trigger === AUTO_TRIGGER && !rec.notify.travelNoticeAutoSentAt) {
    rec.notify.travelNoticeAutoSentAt = sentAt;
  }
  rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
  rec.activities.push({
    at: sentAt,
    type: "travel_notice_sent",
    detail: trigger === AUTO_TRIGGER
      ? "계약서 서명 완료 후 여행 주의사항 자동 발송"
      : "관리자가 여행 주의사항을 수동 발송",
  });
  rec.activities = rec.activities.slice(-100);
  return rec;
}
