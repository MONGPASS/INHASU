import type { AdminWorkspaceData, AdminWorkTask } from '../types/adminWorkspace';

const numbers = new Intl.NumberFormat('ko-KR');
/** Null means unavailable, not zero; amounts are already team totals in won. */
export const dashboardNumber = (value: number | null | undefined): string =>
    typeof value === 'number' && Number.isFinite(value) ? numbers.format(value) : '—';

export function dashboardDate(value: string): string {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    const date = new Date(`${value}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return '';
    return `${Number(match[2])}월 ${Number(match[3])}일 (${['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()]})`;
}

/** Dates are normalized calendar keys by the server, never browser-local dates. */
export function dashboardPeriod(start: string, end: string): string {
    const short = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && dashboardDate(value) ? value.replaceAll('-', '.') : '';
    const from = short(start), to = short(end);
    if (from && to) return from === to ? from : `${from} ~ ${to}`;
    return from || to || '일정 미정';
}

const kstTime = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
});
/** SQLite creation timestamps without an offset are UTC, like its datetime('now'). */
export function dashboardTimestamp(value: string): string {
    if (!value) return '접수일 미정';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return dashboardDate(value) || '접수일 미정';
    const timestamp = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
    const date = new Date(timestamp);
    return Number.isFinite(date.getTime()) ? kstTime.format(date) : '접수일 미정';
}

export function dashboardAvailability(data: AdminWorkspaceData | null) {
    return {
        bookings: !!data && data.availability.reservations && data.availability.requests,
        inquiries: !!data && data.availability.quotes && data.availability.requests,
        tasks: !!data && data.availability.reservations && data.availability.requests && data.availability.quotes,
    };
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const kstDateParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
/** Same rule as the workspace server: offset-less SQLite timestamps are UTC, date-only values keep their day. */
export function dashboardSeoulDate(value: string): string {
    const raw = (value || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
    const date = new Date(iso);
    if (!raw || !Number.isFinite(date.getTime())) return '';
    const parts = kstDateParts.formatToParts(date);
    const part = (type: string) => parts.find(p => p.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
}
const dayMs = 86400000;
const isDateKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const keyTime = (key: string) => Date.parse(`${key}T00:00:00Z`);
export const dashboardAddDays = (key: string, days: number): string => new Date(keyTime(key) + days * dayMs).toISOString().slice(0, 10);
/** Whole calendar days from `from` to `to`; null when either key is missing. */
export const dashboardDayDiff = (from: string, to: string): number | null =>
    isDateKey(from) && isDateKey(to) ? Math.round((keyTime(to) - keyTime(from)) / dayMs) : null;

export const dashboardWon = (value: number | null | undefined): string =>
    typeof value === 'number' && Number.isFinite(value) ? `₩${numbers.format(Math.round(value))}` : '—';

/** "26.09.12 – 09.15" and "3박 4일", the compact form of the dashboard rows. */
export function dashboardShortRange(start: string, end: string): { range: string; nights: string } {
    const valid = (value: string) => isDateKey(value) && !!dashboardDate(value);
    if (!valid(start)) return { range: valid(end) ? end.slice(2).replaceAll('-', '.') : '일정 미정', nights: '' };
    const from = start.slice(2).replaceAll('-', '.');
    if (!valid(end)) return { range: from, nights: '' };
    if (end === start) return { range: from, nights: '당일' };
    const to = end.slice(0, 4) === start.slice(0, 4) ? end.slice(5).replace('-', '.') : end.slice(2).replaceAll('-', '.');
    const nights = dashboardDayDiff(start, end) ?? 0;
    return { range: `${from} – ${to}`, nights: nights > 0 ? `${nights}박 ${nights + 1}일` : '' };
}

export const dashboardPhone = (value: string): string => {
    const digits = (value || '').replace(/\D/g, '');
    return digits.length === 11 ? digits.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3') : value || '';
};

export type DashboardBookingGroup = 'confirmed' | 'waiting' | 'other';
/** Confirmed is the server's sales rule (confirmed·paid·completed); cancelled stays out of both groups. */
export const dashboardBookingGroup = (status: string): DashboardBookingGroup =>
    ['confirmed', 'paid', 'completed'].includes(status) ? 'confirmed'
        : ['pending', 'pending_payment', 'reservation_requested', 'on_hold'].includes(status) ? 'waiting' : 'other';

export const REVENUE_PERIODS = ['전체 기간', '이번 달', '지난 30일', '최근 3개월', '올해'] as const;
export type RevenuePeriod = typeof REVENUE_PERIODS[number];
/**
 * 전체 기간 is the server total as received. Shorter periods sum the same confirmed bookings by their
 * Korean-time reception date, and stay unavailable when any amount in that period is unknown.
 */
export function dashboardRevenue(data: AdminWorkspaceData | null, period: RevenuePeriod): { value: number | null; range: string } {
    if (!data || !isDateKey(data.today)) return { value: null, range: '' };
    const today = data.today, short = (key: string) => key.slice(5).replace('-', '.');
    if (period === '전체 기간') return { value: data.metrics.confirmedSales, range: '전체' };
    const from = period === '이번 달' ? `${today.slice(0, 8)}01` : period === '지난 30일' ? dashboardAddDays(today, -30)
        : period === '최근 3개월' ? dashboardAddDays(today, -92) : `${today.slice(0, 4)}-01-01`;
    const range = period === '올해' ? `${today.slice(0, 4)}.01.01 –` : `${short(from)} – ${short(today)}`;
    if (!dashboardAvailability(data).bookings) return { value: null, range };
    const sold = data.bookings.filter(b => {
        const key = dashboardSeoulDate(b.createdAt);
        return dashboardBookingGroup(b.status) === 'confirmed' && !!key && key >= from && key <= today;
    });
    if (sold.some(b => b.totalAmount === null)) return { value: null, range };
    return { value: sold.reduce((total, b) => total + (b.totalAmount ?? 0), 0), range };
}

/** Confirmed vs waiting bookings; an unknown amount makes that group's total unavailable, never zero. */
export function dashboardBookingSplit(data: AdminWorkspaceData | null) {
    const bookings = data?.bookings.filter(b => b.status !== 'cancelled') || [];
    const group = (name: DashboardBookingGroup) => {
        const list = bookings.filter(b => dashboardBookingGroup(b.status) === name);
        return { count: list.length, amount: list.some(b => b.totalAmount === null) ? null : list.reduce((total, b) => total + (b.totalAmount ?? 0), 0) };
    };
    return { total: bookings.length, confirmed: group('confirmed'), waiting: group('waiting') };
}

/** New bookings per Korean-time reception day for the 7 days ending today, oldest first. */
export function dashboardDailyNew(data: AdminWorkspaceData | null): { key: string; label: string; count: number; today: boolean }[] {
    if (!data || !isDateKey(data.today)) return [];
    const counts = new Map<string, number>();
    data.bookings.forEach(b => { const key = dashboardSeoulDate(b.createdAt); if (key) counts.set(key, (counts.get(key) || 0) + 1); });
    return Array.from({ length: 7 }, (_, index) => {
        const key = dashboardAddDays(data.today, index - 6);
        return { key, label: `${key.slice(5).replace('-', '.')} (${WEEKDAYS[new Date(keyTime(key)).getUTCDay()]})`, count: counts.get(key) || 0, today: index === 6 };
    });
}

/** This month's inquiries by Korean-time reception, and how many no longer wait for a reply. */
export function dashboardAnswerRate(data: AdminWorkspaceData | null): { month: number; received: number; answered: number } | null {
    if (!data || !isDateKey(data.today) || !dashboardAvailability(data).inquiries) return null;
    const month = data.today.slice(0, 7);
    const list = data.inquiries.filter(inquiry => dashboardSeoulDate(inquiry.createdAt).startsWith(month));
    return { month: Number(data.today.slice(5, 7)), received: list.length, answered: list.filter(inquiry => !inquiry.pending).length };
}

export type DashboardTaskKind = Exclude<AdminWorkTask['kind'], 'quote'>;
export interface DashboardTaskCard { task: AdminWorkTask; name: string; product: string; start: string; end: string; dday: number | null }
/**
 * Booking tasks grouped by kind, nearest departure first. A task joins back to its booking through
 * the server key (`kind:bookingKey`); the task's own text is used when that booking is not loaded.
 */
export function dashboardTaskCards(data: AdminWorkspaceData | null): Record<DashboardTaskKind, DashboardTaskCard[]> {
    const groups: Record<DashboardTaskKind, DashboardTaskCard[]> = { assignment: [], deposit_report: [], contract: [] };
    if (!data) return groups;
    const byKey = new Map(data.bookings.map(b => [b.key, b]));
    data.tasks.forEach(task => {
        if (task.kind === 'quote') return;
        const booking = byKey.get(task.key.slice(task.kind.length + 1));
        groups[task.kind].push({ task, name: booking?.customerName || task.description.split(' · ')[0] || '이름 미정',
            product: booking?.productName || '', start: booking?.startDate || '', end: booking?.endDate || '',
            dday: booking ? dashboardDayDiff(data.today, booking.startDate) : null });
    });
    const order = (card: DashboardTaskCard) => card.dday ?? Number.MAX_SAFE_INTEGER;
    (Object.keys(groups) as DashboardTaskKind[]).forEach(kind => groups[kind].sort((a, b) => order(a) - order(b)));
    return groups;
}

/** "11.27 – 11.28": the work-queue period. The year is kept only when it is not this year. */
export function dashboardMonthRange(start: string, end: string, today: string): string {
    const valid = (value: string) => isDateKey(value) && !!dashboardDate(value);
    const short = (value: string) => value.slice(0, 4) === today.slice(0, 4) ? value.slice(5).replace('-', '.') : value.slice(2).replaceAll('-', '.');
    if (!valid(start)) return valid(end) ? short(end) : '일정 미정';
    if (!valid(end) || end === start) return short(start);
    return `${short(start)} – ${end.slice(0, 4) === start.slice(0, 4) ? end.slice(5).replace('-', '.') : end.slice(2).replaceAll('-', '.')}`;
}

export type DashboardQueueKind = DashboardTaskKind | 'quote';
export interface DashboardQueueRow {
    key: string; kind: DashboardQueueKind; href: string;
    /** 출발: D-day, "N일 지남", or the inquiry's reception date */
    due: string; dueTone: 'danger' | 'accent' | 'neutral';
    name: string; product: string; period: string; periodLabel: string; category: '상품' | '견적';
    status: string; statusTone: 'danger' | 'info' | 'neutral'; action: string; overdue: boolean;
}
const QUEUE_ACTION: Record<DashboardTaskKind, string> = { assignment: '배정하기', deposit_report: '입금 확인', contract: '계약 확인' };

/**
 * 오늘 처리할 일(업무함): the server's booking tasks and pending-inquiry tasks in one list, most urgent first —
 * upcoming departures nearest first, then departures already passed (oldest first), then inquiries by reception.
 * Text comes from the task and the booking or inquiry it points to; nothing is invented when either is missing.
 */
export function dashboardWorkQueue(data: AdminWorkspaceData | null): DashboardQueueRow[] {
    if (!data) return [];
    const cards = dashboardTaskCards(data);
    const bookingRows = (Object.keys(cards) as DashboardTaskKind[]).flatMap(kind => cards[kind].map((card): DashboardQueueRow & { order: number } => {
        const bookingKey = card.task.key.slice(kind.length + 1);
        const overdue = card.dday !== null && card.dday < 0;
        return {
            key: card.task.key, kind, href: card.task.href, overdue,
            due: card.dday === null ? '미정' : card.dday === 0 ? 'D-DAY' : overdue ? `${-card.dday}일 지남` : `D-${card.dday}`,
            dueTone: card.dday === null ? 'neutral' : overdue ? 'danger' : 'accent',
            name: card.name, product: card.product, period: dashboardMonthRange(card.start, card.end, data.today),
            periodLabel: dashboardPeriod(card.start, card.end), category: bookingKey.startsWith('quote_booking:') ? '견적' : '상품',
            status: card.task.title, statusTone: overdue || card.task.priority === 'urgent' ? 'danger' : 'info',
            action: overdue ? '상태 정리' : QUEUE_ACTION[kind],
            order: card.dday === null ? 3e6 : overdue ? 1e6 + card.dday : card.dday,
        };
    }));
    const inquiries = new Map(data.inquiries.map(inquiry => [inquiry.key, inquiry]));
    const quoteRows = data.tasks.filter(task => task.kind === 'quote').map((task): DashboardQueueRow & { order: number } => {
        const inquiry = inquiries.get(task.key.slice('quote:'.length));
        const received = dashboardSeoulDate(inquiry?.createdAt || task.createdAt);
        const status = inquiry?.statusLabel || inquiry?.status || '답변 대기';
        return {
            key: task.key, kind: 'quote', href: task.href, overdue: false,
            due: received ? `접수 ${received.slice(5).replace('-', '.')}` : '접수일 미정', dueTone: 'neutral',
            name: inquiry?.name || task.description.split(' · ')[0] || '이름 미정',
            product: `${inquiry?.destination || '희망 여행 미정'} · ${inquiry?.type === 'legacy_quote' ? '기존 견적' : '맞춤 견적'}`,
            period: '일정 미정', periodLabel: '일정 미정', category: '견적', status, statusTone: 'neutral',
            action: status.includes('작성') ? '견적 작성' : '답변 작성',
            order: 4e6 + (received ? keyTime(received) / dayMs : 1e5),
        };
    });
    return [...bookingRows, ...quoteRows].sort((a, b) => a.order - b.order).map(({ order: _order, ...row }) => row);
}

export interface DashboardDeparture {
    key: string; href: string; name: string; date: string; step: string; percent: number; next: 'deposit' | 'contract' | 'confirm' | 'depart';
}
/**
 * 출발 준비 현황: the next departures (today included, cancelled left out) and how far each booking has come —
 * 예약 접수 → 예약금 확인 → 계약 서명 → 예약 확정 → 출발, one fifth per step, from the booking's own flags.
 */
export function dashboardDepartures(data: AdminWorkspaceData | null, limit = 3): DashboardDeparture[] {
    if (!data || !isDateKey(data.today)) return [];
    const labels = { deposit: '예약금 확인', contract: '계약 서명', confirm: '예약 확정', depart: '출발' } as const;
    return data.bookings
        .filter(b => dashboardBookingGroup(b.status) !== 'other' && isDateKey(b.startDate) && b.startDate >= data.today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))
        .slice(0, limit)
        .map(b => {
            const confirmed = dashboardBookingGroup(b.status) === 'confirmed';
            const next = !b.depositPaid ? 'deposit' : !b.contractSigned ? 'contract' : !confirmed ? 'confirm' : 'depart';
            const done = 1 + (b.depositPaid ? 1 : 0) + (b.contractSigned ? 1 : 0) + (confirmed ? 1 : 0);
            const last = next === 'deposit' ? '예약 접수' : next === 'contract' ? '예약금 확인' : next === 'confirm' ? '계약 서명' : '예약 확정';
            return { key: b.key, href: b.href, name: b.customerName || '이름 미정', date: `${dashboardMonthRange(b.startDate, b.startDate, data.today)} 출발`,
                step: `${last} 완료 → ${labels[next]} 대기`, percent: done * 20, next };
        });
}
