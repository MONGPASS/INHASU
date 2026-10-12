/**
 * 예약 안내 — the five steps shown on /booking-flow and mirrored in its HowTo JSON-LD.
 * Every statement follows what the booking / payment screens and notification mails actually do
 * (quote form, Payment, ReservationComplete, functions/api/reservations.ts, notifications/email.ts).
 * Keep it in sync when those change.
 */
export interface BookingFlowStep {
    title: string;
    text: string;
    /** Timing chip under the step. */
    when: string;
}

export const BOOKING_FLOW_STEPS: BookingFlowStep[] = [
    {
        title: '투어 선택·견적 문의',
        text: '투어 상품에서 고르시거나, 견적 폼에 희망 인원·기간·예산·가고 싶은 곳을 알려 주세요. 견적은 무료입니다.',
        when: '언제든지',
    },
    {
        title: '플랜 제안',
        text: '견적을 요청하신 경우 담당자가 내용을 확인한 뒤 맞춤 견적을 보내 드립니다. 투어 상품을 그대로 예약하시는 경우 이 단계는 필요 없습니다.',
        when: '24시간 이내',
    },
    {
        title: '예약·예약금 입금',
        text: '플랜이 정해지면 사이트에서 예약을 신청해 주세요(Google 계정 로그인이 필요합니다). 예약금은 계좌이체로 받습니다. 예약 신청 후 안내해 드리는 계좌로 예약금을 입금하고, 마이페이지에서 ‘입금 완료’를 알려 주세요. 담당자가 확인한 뒤 예약이 확정됩니다. 예약금 금액은 투어와 인원에 따라 다르며, 예약 화면에서 확인하실 수 있습니다. 예약금은 호텔 및 숙박 시설의 선결제 금액으로 사용되므로 취소하시는 경우에도 환불되지 않습니다. 기한까지 입금이 확인되지 않으면 예약이 취소될 수 있습니다.',
        when: '안내해 드린 입금 기한 이내',
    },
    {
        title: '출발 전 안내',
        text: '입금 확인 후 숙박·차량·가이드 등 현지 수배를 진행하고, 확정 일정표·해외여행 계약서·담당 가이드 정보를 순서대로 메일로 안내해 드립니다. 예약 현황은 마이페이지에서도 확인하실 수 있습니다. 궁금한 점은 카카오톡 채널이나 채팅으로 편하게 문의해 주세요.',
        when: '입금 확인 후 순차 안내',
    },
    {
        title: '몽골로 출발',
        text: '확정 일정표에 따라 여행을 즐겨 주세요. 잔금은 현지에서 현금으로 결제합니다. 여행 당일 가이드에게 직접 전달해 주세요. 자세한 내용은 출발 전에 다시 안내해 드립니다.',
        when: '여행 당일',
    },
];
