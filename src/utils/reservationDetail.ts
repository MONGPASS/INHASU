// Shared helpers for the reservation detail screens (mobile MyReservationDetail + PC BookingDetailDesktop).

export interface Guide {
    id?: string;
    name?: string;
    image?: string;
    introduction?: string;
    bio?: string;
    phone?: string;
    kakaoId?: string;
    languages?: unknown;
    specialties?: unknown;
}

export interface Accommodation {
    id?: string;
    name?: string;
    type?: string;
    location?: string;
    images?: unknown;
    description?: string;
    facilities?: unknown;
}

export interface HistoryEntry {
    timestamp: string;
    type: string;
    description: string;
    detail?: string;
}

export interface PriceBreakdown {
    total: number;
    deposit: number;
    local: number;
}

/** 고객의 예약금 '입금 완료' 신고 (reservations.deposit_report). 미신고는 null. */
export interface DepositReport {
    status: 'reported';
    /** 입금자명 */
    name: string;
    /** 신고 시각 (ISO) */
    reportedAt: string;
}

export interface ReservationDetail {
    id: string;
    reservationNumber?: string | null;
    productName: string;
    customerName?: string | null;
    status: string;
    startDate?: string;
    endDate?: string;
    totalPeople?: number;
    travelers?: number;
    priceBreakdown?: PriceBreakdown;
    price_breakdown?: PriceBreakdown;
    contractUrl?: string;
    itineraryUrl?: string;
    itineraryTemplateId?: string;
    history?: HistoryEntry[];
    assignedGuide?: Guide;
    dailyAccommodations?: Array<{ day: number; accommodation: Accommodation }>;
    areAssignmentsVisibleToUser?: boolean;
    depositStatus?: string;
    balanceStatus?: string;
    depositReport?: DepositReport | null;
    deposit_report?: DepositReport | null;
    createdAt?: string;
}

/** JSON-array columns arrive either parsed or as a JSON string. */
export const parseArr = (v: unknown): string[] => {
    let arr: unknown = v;
    if (typeof v === 'string') {
        try { arr = JSON.parse(v); } catch { return []; }
    }
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
};

export const parseImage = (v: unknown): string => {
    const arr = parseArr(v);
    if (arr.length > 0) return arr[0];
    if (typeof v === 'string' && v.startsWith('http')) return v;
    return '';
};

export const formatDateShort = (iso?: string) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const wd = weekdays[d.getDay()];
        return `${y}/${m}/${day} (${wd})`;
    } catch { return iso; }
};

export const formatDateTime = (iso?: string) => {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return iso; }
};

export const computeDays = (start?: string, end?: string) => {
    if (!start || !end) return null;
    try {
        const s = new Date(start);
        const e = new Date(end);
        const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
        return diff >= 0 ? { nights: diff, days: diff + 1 } : null;
    } catch { return null; }
};

/** Fields the payment helpers read; reservation list rows and the detail response both carry them. */
export interface PaymentSource {
    status?: unknown;
    depositStatus?: unknown;
    balanceStatus?: unknown;
    priceBreakdown?: unknown;
    price_breakdown?: unknown;
    depositReport?: unknown;
    deposit_report?: unknown;
}

/** The list API parses price_breakdown, but the raw `priceBreakdown` column is a JSON string. */
export const readBreakdown = (r: PaymentSource): PriceBreakdown | null => {
    for (const v of [r.price_breakdown, r.priceBreakdown]) {
        let o: unknown = v;
        if (typeof v === 'string') {
            try { o = JSON.parse(v); } catch { o = null; }
        }
        if (o && typeof o === 'object') {
            const b = o as Partial<PriceBreakdown>;
            return { total: Number(b.total) || 0, deposit: Number(b.deposit) || 0, local: Number(b.local) || 0 };
        }
    }
    return null;
};

/** The API sends the report parsed (`depositReport` / `deposit_report`); a raw JSON string is read too. Not reported → null. */
export const readDepositReport = (r: { depositReport?: unknown; deposit_report?: unknown }): DepositReport | null => {
    for (const v of [r.depositReport, r.deposit_report]) {
        let o: unknown = v;
        if (typeof v === 'string') {
            try { o = JSON.parse(v); } catch { o = null; }
        }
        if (o && typeof o === 'object' && (o as Partial<DepositReport>).status === 'reported') {
            const d = o as Partial<DepositReport>;
            return { status: 'reported', name: String(d.name ?? ''), reportedAt: String(d.reportedAt ?? '') };
        }
    }
    return null;
};

/** 예약금 단계: 입금 전 → 고객이 '입금 완료'를 신고(담당자 확인 대기) → 담당자가 입금 확인. */
export type DepositStage = 'unpaid' | 'reported' | 'paid';

/** Paid amount and progress: the deposit counts once paid/confirmed, the local balance once the trip is completed. */
export const paymentSummary = (r: PaymentSource) => {
    const pb = readBreakdown(r);
    const status = typeof r.status === 'string' ? r.status : '';
    const depositPaid = r.depositStatus === 'paid' || ['paid', 'confirmed', 'completed'].includes(status);
    const balancePaid = r.balanceStatus === 'paid' || status === 'completed';
    const paid = pb ? (depositPaid ? pb.deposit : 0) + (balancePaid ? pb.local : 0) : 0;
    const percent = pb && pb.total > 0 ? Math.round((paid / pb.total) * 100) : 0;
    const depositReport = readDepositReport(r);
    const depositStage: DepositStage = depositPaid ? 'paid' : depositReport ? 'reported' : 'unpaid';
    return { pb, depositPaid, balancePaid, paid, percent, depositReport, depositStage };
};

export type StatusTone = 'pending' | 'partial' | 'paid' | 'cancelled' | 'neutral';

/** `reportedLabel`: shown instead of `label` once the customer has reported the deposit and staff have not confirmed it yet. */
export const STATUS_MAP: Record<string, { label: string; tone: StatusTone; reportedLabel?: string }> = {
    pending_payment: { label: '입금 대기', tone: 'pending', reportedLabel: '입금 확인 중' },
    waiting_deposit: { label: '입금 대기', tone: 'pending', reportedLabel: '입금 확인 중' },
    paid: { label: '결제 완료', tone: 'partial' },
    confirmed: { label: '예약 확정', tone: 'paid' },
    completed: { label: '여행 종료', tone: 'neutral' },
    cancelled: { label: '취소', tone: 'cancelled' },
};

/** Badge text for a reservation status; `fallback` covers statuses the map does not know. */
export const reservationStatusLabel = (status: string, depositReported = false, fallback = status): string => {
    const entry = STATUS_MAP[status];
    if (!entry) return fallback;
    return depositReported && entry.reportedLabel ? entry.reportedLabel : entry.label;
};
