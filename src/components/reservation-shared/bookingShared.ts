import type { AccommodationOption, TourPricingOption, VehicleOption } from '../../types/product';
import { won } from '../desktop-primitives/mwTokens';

/**
 * Types, copy and pure helpers shared by the PC and mobile booking screens
 * (Claude Design: "Booking Header / Body / Summary"). No state and no requests live here:
 * the three pages (Reservation, Payment, ReservationComplete) own the booking logic.
 */

export interface PriceBreakdown {
    total: number;
    deposit: number;
    local: number;
}

export interface ParsedDuration {
    nights: number;
    days: number;
}

export interface CustomerInfo {
    name: string;
    phone: string;
    email: string;
}

export interface FieldError {
    field: string;
    msg: string;
}

export type BookingStepNo = 1 | 2 | 3;

/** What the booking screens read from a product. Quote bookings only carry id / name / duration. */
export interface BookingProduct {
    id?: string;
    name: string;
    duration?: string;
    category?: string;
    /** 상품 구분(풀패키지·실속형) — PC 예약 요약의 꼬리표. */
    packageType?: 'full' | 'value' | null;
    mainImages?: string[];
    pricingOptions?: TourPricingOption[];
    accommodationOptions?: AccommodationOption[];
    vehicleOptions?: VehicleOption[];
}

/** STEP 1 (/reservation/:id): state and handlers owned by pages/Reservation.tsx. */
export interface ReservationStepProps {
    product: BookingProduct;
    parsedDuration: ParsedDuration;
    selectedStartDate: Date | null;
    /** null = 고른 날을 지운다(PC ‘다시 선택’). */
    setSelectedStartDate: (d: Date | null) => void;
    totalPeople: number;
    setTotalPeople: (n: number) => void;
    selectedAccomId: string;
    setSelectedAccomId: (id: string) => void;
    selectedVehicleId: string;
    setSelectedVehicleId: (id: string) => void;
    baseOption: TourPricingOption | null;
    priceBreakdown: PriceBreakdown;
    onNext: () => void;
}

/** STEP 2 (/payment): state and handlers owned by pages/Payment.tsx. */
export interface PaymentStepProps {
    product: BookingProduct;
    isQuote: boolean;
    selectedStartDate: Date | null;
    endDate: Date | null;
    nights: number;
    days: number;
    totalPeople: number;
    baseOption: TourPricingOption | null;
    priceBreakdown: PriceBreakdown;
    selectedAccomId?: string;
    selectedVehicleId?: string;
    customerInfo: CustomerInfo;
    setCustomerInfo: (info: CustomerInfo) => void;
    memo: string;
    setMemo: (s: string) => void;
    agreeToTerms: boolean;
    setAgreeToTerms: (b: boolean) => void;
    isProcessing: boolean;
    fieldError: FieldError | null;
    /** Clears the error once the customer edits the field it points at. */
    onFieldEdit: (field: string) => void;
    onSubmit: () => void;
    onBack: () => void;
}

/** 완료 (/reservation-complete): values read from the saved reservation. */
export interface CompleteStepProps {
    /** Reservation row id: the 완료 screen links to its My Page detail, where the deposit is reported. */
    reservationId: string;
    productName: string;
    email: string;
    reservationNo: string;
    total: number;
    deposit: number;
    local: number;
    /** PC 완료 화면의 신청 내용(사진 · 여행 기간 · 인원). 없으면 그 줄을 뺀다. */
    image?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    people?: number;
}

export const BK_PAGE_BG = '#F4F6F5';

/** Shown under the deposit rule on STEP 2; the rule itself is DEPOSIT_POLICY in constants/company.ts. */
export const BK_CANCEL_NOTES = [
    '취소나 일정 변경을 원하시면 가능한 한 빨리 카카오톡 또는 이메일로 연락해 주세요.',
    '자세한 계약 조건은 예약 후 보내 드리는 해외여행 계약서를 확인해 주세요.',
];

export const BK_PAY_NOTES = [
    '예약금은 안내해 드리는 기한 내에 입금해 주세요.',
    '기한 내에 입금이 확인되지 않으면 예약이 취소될 수 있습니다.',
    '잔금은 현지에서 현금으로 결제합니다. 여행 당일 가이드에게 직접 전달해 주세요.',
];

/** Stroke icon paths (24px grid) copied from the design file. */
export const BK_D = {
    stay: 'M3 20h18M5 20V10l7-6 7 6v10M10 20v-5h4v5',
    car: 'M5 16V9l2-4h10l2 4v7M3 16h18v3H3zM7 19v2M17 19v2M5 12h14',
    bank: 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18',
    copy: 'M9 9h11v11H9zM5 15V4h11',
    note: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8h.01',
    warn: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v5M12 16h.01',
    tick: 'M5 12l5 5 9-10',
    arrow: 'M5 12h14M13 6l6 6-6 6',
    down: 'M6 9l6 6 6-6',
} as const;

const WEEK = '일월화수목금토';
export const BK_WEEK = WEEK.split('');

export const startOfToday = (): Date => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

export const addDays = (date: Date, n: number): Date => {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
};

export const sameDay = (a: Date | null, b: Date | null): boolean =>
    !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** STEP 1 choices, kept for this tab so going back from STEP 2 does not reset them. */
export interface BookingDraft {
    startDate: Date | null;
    totalPeople: number;
    selectedAccomId: string;
    selectedVehicleId: string;
}

const draftKey = (productId: string) => `mw-booking-draft:${productId}`;

export const saveBookingDraft = (productId: string, draft: BookingDraft): void => {
    try {
        const d = draft.startDate;
        sessionStorage.setItem(draftKey(productId), JSON.stringify({
            ...draft,
            startDate: d ? [d.getFullYear(), d.getMonth(), d.getDate()] : null,
        }));
    } catch {
        // Storage can be blocked (private mode); the flow works without it.
    }
};

export const readBookingDraft = (productId: string): BookingDraft | null => {
    try {
        const raw = sessionStorage.getItem(draftKey(productId));
        if (!raw) return null;
        const v = JSON.parse(raw);
        const ymd = Array.isArray(v.startDate) && v.startDate.length === 3 ? v.startDate.map(Number) : null;
        const startDate = ymd && ymd.every(Number.isFinite) ? new Date(ymd[0], ymd[1], ymd[2]) : null;
        return {
            startDate,
            totalPeople: Number.isFinite(Number(v.totalPeople)) ? Number(v.totalPeople) : 0,
            selectedAccomId: typeof v.selectedAccomId === 'string' ? v.selectedAccomId : '',
            selectedVehicleId: typeof v.selectedVehicleId === 'string' ? v.selectedVehicleId : '',
        };
    } catch {
        return null;
    }
};

export const clearBookingDraft = (productId: string): void => {
    try {
        sessionStorage.removeItem(draftKey(productId));
    } catch {
        // see saveBookingDraft
    }
};

/** "9/12(금)" */
export const fmtShort = (d: Date): string => `${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]})`;

/** "4박 5일" when the tour has nights, otherwise the product's own duration text. */
export const durationLabel = (nights: number, days: number, fallback?: string): string =>
    nights > 0 ? `${nights}박 ${days}일` : fallback || '';

/** Admin titles sometimes start with a "[카테고리]" tag; the booking screens show the bare name. */
export const bareName = (name: string): string => name.replace(/^\[[^\]]+\]\s*/, '');

/** 숙박·차량 옵션(관리자 등록) 한 줄. */
export interface BookingOptionItem {
    id: string;
    name: string;
    description?: string;
    priceModifier: number;
    isDefault?: boolean;
    imageUrl?: string;
}

export const signedWon = (n: number): string => (n < 0 ? `−${won(Math.abs(n))}` : `+${won(n)}`);

export const optionPriceLabel = (modifier: number, isDefault?: boolean): string =>
    modifier === 0 ? (isDefault ? '기본 요금에 포함' : '추가 요금 없음') : signedWon(modifier);

/** Tier chip price: "129만원" on narrow screens when the price is a round 만(10,000). */
export const tierPrice = (price: number, compact: boolean): string =>
    compact && price >= 10000 && price % 10000 === 0 ? `${(price / 10000).toLocaleString('ko-KR')}만원` : won(price);

export const sortTiers = (options?: TourPricingOption[]): TourPricingOption[] =>
    (options ?? []).slice().sort((a, b) => a.people - b.people);

export const findOption = <T extends { id: string }>(options: T[] | undefined, id?: string): T | undefined =>
    id ? (options ?? []).find((o) => o.id === id) : undefined;

/** Breakdown rows above the total: base price and any option surcharge / discount. */
export function priceLines(
    baseOption: TourPricingOption | null,
    people: number,
    accom?: AccommodationOption,
    vehicle?: VehicleOption,
): { k: string; v: string }[] {
    const lines: { k: string; v: string }[] = [];
    if (baseOption) lines.push({ k: `${won(baseOption.pricePerPerson)} × ${people}명`, v: won(baseOption.pricePerPerson * people) });
    if (accom && accom.priceModifier !== 0) lines.push({ k: '숙박 옵션', v: signedWon(accom.priceModifier) });
    if (vehicle && vehicle.priceModifier !== 0) lines.push({ k: '차량 옵션', v: signedWon(vehicle.priceModifier) });
    return lines;
}

/** Same number the customer sees in My Page (reservation number, else the short id). */
export const reservationNoOf = (r: { id?: string; reservationNumber?: string | null; reservation_number?: string | null }): string =>
    String(r.reservationNumber || r.reservation_number || (r.id ? r.id.slice(0, 8).toUpperCase() : ''));

