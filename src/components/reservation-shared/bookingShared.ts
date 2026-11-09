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
    setSelectedStartDate: (d: Date) => void;
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

/**
 * What the customer picked in STEP 1 · 2, kept for the summary card of the 완료 screen
 * (mobile shows it under the confirmation card, as in the design). Amounts are not part of it:
 * they always come from the saved reservation.
 */
export interface BookingSummarySnapshot {
    product: BookingProduct;
    isQuote: boolean;
    start: Date | null;
    end: Date | null;
    nights: number;
    days: number;
    people: number;
    baseOption: TourPricingOption | null;
    accom?: AccommodationOption;
    vehicle?: VehicleOption;
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
    /** Mobile only: the booking summary card shown under the confirmation card. */
    summary?: BookingSummarySnapshot;
}

export const BK_PAGE_BG = '#F4F6F5';
export const BK_SOFT = '#F7FAF9';
export const BK_HAIR = '#EEF1EF';
export const BK_OFF = '#C3CCCA';
export const BK_SAT = '#2B63C6';
export const BK_ERR_BG = '#FDECEA';
export const BK_DARK_GRADIENT = 'linear-gradient(160deg,#0F2A3B 0%,#1C8571 100%)';

export const BK_STEPS: { label: string; short: string }[] = [
    { label: '예약일·옵션', short: '일정·옵션' },
    { label: '예약자 정보·결제', short: '정보·결제' },
    { label: '신청 완료', short: '완료' },
];

export const BK_HEAD: Record<BookingStepNo, { title: string; sub: string }> = {
    1: { title: '예약일 및 옵션 선택', sub: '여행 시작일과 인원, 옵션을 선택해 주세요' },
    2: { title: '예약 정보 및 결제 확인', sub: '예약자 정보와 결제 방법을 확인해 주세요' },
    3: { title: '신청 완료', sub: '예약금 입금이 확인되면 예약이 확정됩니다' },
};

/** Shown under the deposit rule on STEP 2; the rule itself is DEPOSIT_POLICY in constants/company.ts. */
export const BK_CANCEL_NOTES = [
    '취소나 일정 변경을 원하시면 가능한 한 빨리 카카오톡 또는 이메일로 연락해 주세요.',
    '자세한 계약 조건은 예약 후 보내 드리는 해외여행 계약서를 확인해 주세요.',
];

/** 예약금 = 계좌이체 + 입금 신고, 잔금 = 현지 현금 (오너 방침). */
export const BK_PAY_TITLE = '계좌이체';
export const BK_PAY_GUIDE = "예약 신청 후 안내해 드리는 계좌로 예약금을 입금하고, 마이페이지에서 '입금 완료'를 알려 주세요. 담당자가 확인한 뒤 예약이 확정됩니다.";

/** STEP 2의 계좌이체 카드에 미리 보여 주는, 신청 뒤의 세 단계. */
export const BK_PAY_STEPS = [
    '예약 신청 후 예약금 입금',
    "마이페이지에서 '입금 완료' 신고",
    '담당자 확인 후 예약 확정',
];

export const BK_PAY_NOTES = [
    '예약금은 안내해 드리는 기한 내에 입금해 주세요.',
    '기한 내에 입금이 확인되지 않으면 예약이 취소될 수 있습니다.',
    '잔금은 현지에서 현금으로 결제합니다. 여행 당일 가이드에게 직접 전달해 주세요.',
];

export const BK_NEXT_STEPS: { t: string; d: string }[] = [
    { t: '예약금을 계좌이체로 입금', d: '위 입금 계좌로 예약금을 입금해 주세요.' },
    { t: "마이페이지에서 '입금 완료' 알리기", d: '입금하신 뒤 마이페이지의 예약 상세 화면에서 입금 완료를 알려 주세요.' },
    { t: '담당자 확인 후 예약 확정', d: '기한 내에 입금이 확인되지 않으면 예약이 취소될 수 있습니다.' },
];

export const BK_HINT_DEPOSIT = '예약금은 취소 시에도 환불되지 않습니다';
export const BK_HINT_PICK_DATE = '달력에서 출발일을 선택해 주세요';
export const BK_HINT_INVOICE = '신청 후 예약금 입금 계좌를 안내해 드립니다';

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

/** "2026년 9월 12일(금)" */
export const fmtLong = (d: Date): string => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일(${WEEK[d.getDay()]})`;

export const periodShort = (start: Date, end: Date): string => `${fmtShort(start)} ~ ${fmtShort(end)}`;

export const periodLong = (start: Date, end: Date): string =>
    `${fmtLong(start)} ~ ${end.getMonth() + 1}월 ${end.getDate()}일(${WEEK[end.getDay()]})`;

/** "4박 5일" when the tour has nights, otherwise the product's own duration text. */
export const durationLabel = (nights: number, days: number, fallback?: string): string =>
    nights > 0 ? `${nights}박 ${days}일` : fallback || '';

/** Admin titles sometimes start with a "[카테고리]" tag; the booking screens show the bare name. */
export const bareName = (name: string): string => name.replace(/^\[[^\]]+\]\s*/, '');

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

/** Sticky offset of the PC summary card. The PC booking pages render without the site header. */
export const BK_STICKY_TOP_PC = 24;
