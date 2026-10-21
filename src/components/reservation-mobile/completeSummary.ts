import type { TourPricingOption } from '../../types/product';
import { toTourDateKey } from '../../utils/formatDate';
import { findOption, sortTiers, type BookingProduct, type BookingSummarySnapshot } from '../reservation-shared/bookingShared';

/**
 * 완료 화면(모바일)의 요약 카드에 쓰는 값 (Claude Design: STEP 3 에서도 "Booking Summary" 가 완료 카드 아래에 보인다).
 * STEP 2 가 신청을 마치고 완료 화면으로 넘어갈 때 고른 내용을 라우터 state 로 함께 넘기고,
 * 없으면(옛 링크 등) 저장된 예약에서 다시 만든다 — 이때는 사진·옵션 없이 기간·인원·금액만 보인다.
 */

/** 완료 화면(모바일)의 "다음 단계": 계좌이체 → 입금 완료 신고·담당자 확인 → 확정 일정표. */
export const DONE_NEXT_STEPS_MOBILE: { t: string; d: string }[] = [
    { t: '예약금을 계좌이체로 입금', d: '위 입금 계좌로 예약금을 입금해 주세요.' },
    { t: "'입금 완료' 알리기 → 담당자 확인·연락", d: "내 예약 상세에서 '입금 완료'를 알려 주시면 담당자가 확인한 뒤 연락드리고 예약이 확정됩니다." },
    { t: '여행 안내(확정 일정표) 받기', d: '일정이 확정되면 내 예약 상세의 여행 서류에서 확정 일정표를 확인할 수 있습니다.' },
];

interface PickedBooking {
    product: BookingProduct;
    isQuote: boolean;
    selectedStartDate?: Date | string | null;
    endDate?: Date | string | null;
    parsedDuration?: { nights: number; days: number } | null;
    totalPeople?: number;
    selectedAccomId?: string;
    selectedVehicleId?: string;
}

const asDate = (v: unknown): Date | null => {
    if (!v) return null;
    const d = v instanceof Date ? v : new Date(v as string | number);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** "YYYY-MM-DD" → that calendar day at local midnight. */
const keyToDate = (key: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

/** Same tier rule as STEP 1 · 2: the exact head count, else the nearest tier at or below it. */
const pickTier = (options: TourPricingOption[] | undefined, people: number): TourPricingOption | null => {
    const tiers = sortTiers(options);
    if (!tiers.length || !people) return null;
    const exact = tiers.find((p) => p.people === people);
    if (exact) return exact;
    if (people < tiers[0].people) return tiers[0];
    return tiers.filter((p) => p.people <= people).pop() ?? tiers[0];
};

/**
 * Router state for /reservation-complete, trimmed to what the summary card shows.
 * Never throws: the reservation is already saved when this runs.
 */
export function bookingSummaryState(picked: PickedBooking): BookingSummarySnapshot | undefined {
    try {
        const { product } = picked;
        const people = Number(picked.totalPeople) || 0;
        return {
            product: {
                id: product.id,
                name: String(product.name || ''),
                duration: product.duration,
                category: product.category,
                mainImages: Array.isArray(product.mainImages) ? product.mainImages.slice(0, 1) : [],
            },
            isQuote: picked.isQuote,
            start: asDate(picked.selectedStartDate),
            end: asDate(picked.endDate),
            nights: Number(picked.parsedDuration?.nights) || 0,
            days: Number(picked.parsedDuration?.days) || 0,
            people,
            baseOption: pickTier(product.pricingOptions, people),
            accom: findOption(product.accommodationOptions, picked.selectedAccomId),
            vehicle: findOption(product.vehicleOptions, picked.selectedVehicleId),
        };
    } catch {
        return undefined;
    }
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Summary for the 완료 screen: what STEP 2 handed over, else rebuilt from the saved reservation. */
export function readCompleteSummary(saved: unknown, reservation: Record<string, unknown>): BookingSummarySnapshot {
    const s = saved && typeof saved === 'object' ? (saved as Partial<BookingSummarySnapshot>) : null;
    if (s?.product && typeof s.product.name === 'string' && s.product.name) {
        return {
            product: s.product,
            isQuote: !!s.isQuote,
            start: asDate(s.start),
            end: asDate(s.end),
            nights: Number(s.nights) || 0,
            days: Number(s.days) || 0,
            people: Number(s.people) || 0,
            baseOption: s.baseOption ?? null,
            accom: s.accom,
            vehicle: s.vehicle,
        };
    }

    const start = keyToDate(toTourDateKey(text(reservation.startDate) || text(reservation.start_date) || text(reservation.date)));
    const end = keyToDate(toTourDateKey(text(reservation.endDate) || text(reservation.end_date)));
    const nights = start && end ? Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000)) : 0;
    return {
        product: {
            id: text(reservation.productId) || text(reservation.product_id) || undefined,
            name: text(reservation.productName) || text(reservation.product_name),
            duration: text(reservation.duration) || undefined,
        },
        isQuote: reservation.type === 'quote',
        start,
        end,
        nights,
        days: start && end ? nights + 1 : 0,
        people: Number(reservation.totalPeople ?? reservation.travelers ?? reservation.total_people) || 0,
        baseOption: null,
    };
}
