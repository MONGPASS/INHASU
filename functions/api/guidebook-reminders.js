/* ═══════════════════════════════════════════════════════════
   /api/guidebook-reminders  ·  출발 7일 전 가이드북 자동 발송 — 중단됨
   ---------------------------------------------------------------
   여행 주의사항(가이드북)은 이제 출발 7일 전이 아니라
     1) 고객이 여행계약서에 서명한 직후 자동 (/api/sign/<token>)
     2) 관리자가 예약관리에서 수동 발송 (PATCH notifyTravelNotice)
   두 경로로만 나갑니다.

   Cloudflare에 등록된 스케줄 Worker가 아직 남아 있어도 고객에게 문자가
   나가지 않도록, 이 엔드포인트는 아무것도 보내지 않고 중단 상태만 알려줍니다.
   (Worker와 Cron 트리거를 삭제하면 이 파일도 함께 지우면 됩니다.)
   ═══════════════════════════════════════════════════════════ */

import { kstDateString } from "./_guidebook-reminder.mjs";

const json = (obj, status = 200) => new Response(JSON.stringify(obj, null, 2), {
  status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

export async function onRequestPost() {
  return json({
    ok: true,
    disabled: true,
    today: kstDateString(),
    checked: 0, sent: 0, skipped: 0, failed: 0, results: [],
    note: "출발 7일 전 자동 발송은 중단됐습니다 — 여행 주의사항은 계약서 서명 직후 자동 발송되거나 예약관리에서 수동 발송합니다.",
  });
}
