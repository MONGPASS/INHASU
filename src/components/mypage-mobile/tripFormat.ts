/** Trip phase and quote-card notes shared by the my page screens (PC and mobile). */

interface TripDates {
    start: string;
    end: string;
    status: string;
}

export type TripPhase = 'upcoming' | 'live' | 'past';

/** Where a reservation sits relative to `today` ("YYYY-MM-DD"); cancelled and completed trips count as past. */
export const tripPhase = (r: TripDates, today: string): TripPhase => {
    if (r.status === 'cancelled' || r.status === 'completed') return 'past';
    if (!r.start) return 'upcoming';
    if ((r.end || r.start) < today) return 'past';
    return r.start <= today ? 'live' : 'upcoming';
};

/** Quote card footer: what happens next for each status, plus the link label when there is something to open. */
export const QUOTE_NOTE: Record<string, { note: string; cta?: string }> = {
    new: { note: '담당자가 확인 중입니다 (24시간 이내 답변)' },
    pending: { note: '담당자가 확인 중입니다 (24시간 이내 답변)' },
    waiting: { note: '담당자가 확인 중입니다 (24시간 이내 답변)' },
    processing: { note: '담당자와 상담 중입니다' },
    answered: { note: '견적이 도착했습니다', cta: '견적 보기' },
    reservation_requested: { note: '예약 요청이 접수되었습니다', cta: '견적 보기' },
    converted: { note: '예약이 확정되었습니다', cta: '예약 보기' },
    completed: { note: '여행이 완료되었습니다' },
    cancelled: { note: '취소되었습니다' },
};
