export type AdminDeliveryKind = 'request_received' | 'quote' | 'change_requested' | 'reservation_requested' | 'deposit_requested' | 'travelers_requested' | 'contract' | 'contract_signed' | 'booking_confirmed' | 'itinerary' | 'travel_notice';
export const ADMIN_DELIVERY_NAMES: Record<AdminDeliveryKind, string> = {
    request_received: '견적 요청 접수', quote: '견적서', change_requested: '일정 변경 요청 접수', reservation_requested: '예약 진행 요청 접수',
    deposit_requested: '예약금 입금 안내', travelers_requested: '여행자 정보 입력 요청', contract: '여행 계약서', contract_signed: '계약서 서명 접수',
    booking_confirmed: '예약 확정 안내', itinerary: '확정 일정표', travel_notice: '여행 주의사항',
};
export interface AdminDeliveryItem { id: string; kind: AdminDeliveryKind; channel: string; state: string; at: string; error?: string; providerId?: string; legacy?: boolean; revision?: string; }
export interface DocumentDeliveryVersion { revision: string; lastSentRevision?: string; needsResend: boolean; verified: boolean; hasPriorDelivery?: boolean; }
export interface AdminBookingWorkflow { accepted: boolean; deposit: boolean; contract: boolean; schedule: boolean; published: boolean; }
export interface AdminDeliveryData { source: 'product' | 'quote_booking'; bookingId: string; workflow: AdminBookingWorkflow; items: AdminDeliveryItem[]; warnings: string[]; documents?: Record<string, DocumentDeliveryVersion>; }
