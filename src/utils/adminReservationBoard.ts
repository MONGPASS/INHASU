import { dashboardDayDiff, dashboardWon } from './adminDashboard.ts';

/** The fields of an admin reservation row that the 통합 예약 목록 board reads. */
export interface BoardReservation {
    id: string; type: 'product' | 'quote' | 'quote_booking'; status: string;
    customerName: string; productName: string; startDate?: string; endDate?: string;
    totalAmount: number; deposit: number; balance: number;
    depositStatus: 'unpaid' | 'paid'; balanceStatus: 'unpaid' | 'paid';
    itineraryUrl?: string;
    quoteBooking?: { signed?: boolean; published?: boolean } | null;
    contractData?: { agreement?: { agreed?: boolean } };
    assignedGuide?: { name?: string };
    dailyAccommodations?: Array<{ day: number; accommodation?: { name?: string } }>;
}

/** Status groups behind the 확정 대기 / 예약 확정 tabs; cancelled, on hold and finished trips belong to neither. */
export const WAITING_STATUSES = ['pending_payment', 'reservation_requested', 'new', 'processing', 'answered'];
export const CONFIRMED_STATUSES = ['confirmed', 'paid'];
export const STATUS_GROUP_WAITING = '확정 대기';
export const STATUS_GROUP_CONFIRMED = '확정 팀';
export const isWaitingReservation = (r: { status: string }) => WAITING_STATUSES.includes(r.status);
export const isConfirmedReservation = (r: { status: string }) => CONFIRMED_STATUSES.includes(r.status);

const dateKey = (value?: string) => /^\d{4}-\d{2}-\d{2}/.test(value || '') ? (value as string).slice(0, 10) : '';
const validAmount = (value: number) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
/** A total over bookings with an unknown amount is unavailable, never a smaller number. */
function sum<T>(rows: T[], pick: (row: T) => number): number | null {
    let total = 0;
    for (const row of rows) { const value = pick(row); if (!validAmount(value)) return null; total += value; }
    return total;
}

/** Customer agreement: quote bookings carry the server's signed flag, product bookings the contract agreement. */
export const reservationSigned = (r: BoardReservation) =>
    r.type === 'quote_booking' ? !!r.quoteBooking?.signed : r.contractData?.agreement?.agreed === true;
/** Publishing an itinerary stores its URL on product bookings; quote bookings report publishStatus. */
export const reservationPublished = (r: BoardReservation) => r.status !== 'cancelled'
    && (r.type === 'quote_booking' ? !!r.quoteBooking?.published : ['confirmed', 'paid', 'completed'].includes(r.status) && !!r.itineraryUrl);

export function reservationSteps(r: BoardReservation): { label: string; title: string; done: boolean }[] {
    return [
        { label: '예약금', title: '예약금 입금 확인', done: r.depositStatus === 'paid' },
        { label: '서명', title: '고객 계약 동의', done: reservationSigned(r) },
        { label: '잔금', title: '잔금 입금 확인', done: r.balanceStatus === 'paid' },
        { label: '일정표', title: '일정표 공개', done: reservationPublished(r) },
    ];
}

export type DdayTone = 'none' | 'past' | 'soon' | 'near' | 'far';
/** D-day against a Korean-time today key: within 7 days pulses, within 90 days is emphasised. */
export function reservationDday(startDate: string | undefined, today: string): { label: string; days: number | null; tone: DdayTone } {
    const days = dashboardDayDiff(today, dateKey(startDate));
    if (days === null) return { label: '일정 미정', days: null, tone: 'none' };
    if (days < 0) return { label: '출발 완료', days, tone: 'past' };
    return { label: days === 0 ? 'D-DAY' : `D-${days}`, days, tone: days <= 7 ? 'soon' : days <= 90 ? 'near' : 'far' };
}

export function reservationPeriod(startDate?: string, endDate?: string): { range: string; nights: string } {
    const start = dateKey(startDate), end = dateKey(endDate), dot = (key: string) => key.replaceAll('-', '.');
    if (!start) return { range: '일정 미정', nights: '' };
    if (!end || end === start) return { range: dot(start), nights: end ? '당일' : '' };
    const nights = dashboardDayDiff(start, end) ?? 0;
    return { range: `${dot(start)} – ${dot(end)}`, nights: nights > 0 ? `${nights}박 ${nights + 1}일` : '' };
}

export function reservationPayNote(r: BoardReservation): { text: string; done: boolean } | null {
    if (r.type === 'quote' || r.status === 'cancelled') return null;
    if (r.balanceStatus === 'paid') return { text: '잔금까지 입금 완료', done: true };
    return { text: r.depositStatus === 'paid' ? '잔금 입금 대기' : '예약금 입금 대기', done: false };
}

/** 가이드·차량·숙소 readiness; lodging counts saved nightly stays against the trip's nights. */
export function reservationAssignments(r: BoardReservation, vehicleType: string) {
    const nights = dashboardDayDiff(dateKey(r.startDate), dateKey(r.endDate)) ?? 0;
    const stayDays = new Set((r.dailyAccommodations || []).filter(s => s.accommodation?.name).map(s => Number(s.day)));
    const stays = Array.from(stayDays).filter(day => day >= 1 && day <= nights).length;
    return [
        { key: 'guide', label: '가이드', done: !!r.assignedGuide?.name },
        { key: 'vehicle', label: '차량', done: !!vehicleType },
        { key: 'stay', label: '숙소', done: nights <= 0 || stays >= nights },
    ] as const;
}

/** Splits `text` around the first match of `query`; digit-only queries also match phone numbers written with hyphens. */
export function highlightMatch(text: string, query: string): { a: string; b: string; c: string } {
    const q = query.trim().toLowerCase(), none = { a: text, b: '', c: '' };
    if (!q || !text) return none;
    const at = text.toLowerCase().indexOf(q);
    if (at >= 0) return { a: text.slice(0, at), b: text.slice(at, at + q.length), c: text.slice(at + q.length) };
    const digits = q.replace(/[-\s]/g, '');
    if (!/^\d+$/.test(digits)) return none;
    const positions: number[] = [];
    for (let i = 0; i < text.length; i += 1) if (/\d/.test(text[i])) positions.push(i);
    const found = positions.map(i => text[i]).join('').indexOf(digits);
    if (found < 0) return none;
    const from = positions[found], to = positions[found + digits.length - 1] + 1;
    return { a: text.slice(0, from), b: text.slice(from, to), c: text.slice(to) };
}

export interface BoardKpi {
    key: 'all' | 'waiting' | 'confirmed' | 'balanceDue' | 'departing';
    label: string; value: number; pct: string; warn: boolean; tip: string;
    rows: { k: string; v: string; alert: boolean }[];
}
/**
 * The five summary cards. Each count is exactly the set its card's filter shows (legacy quote inquiries excluded);
 * money lines leave cancelled bookings out and stay unavailable when an amount is unknown.
 */
export function reservationKpis(reservations: BoardReservation[], today: string): BoardKpi[] {
    const all = reservations.filter(r => r.type !== 'quote');
    const live = (rows: BoardReservation[]) => rows.filter(r => r.status !== 'cancelled');
    const total = all.length || 1;
    const pct = (value: number) => `${Math.round(value / total * 100)}%`;
    const waiting = all.filter(isWaitingReservation), confirmed = all.filter(isConfirmedReservation);
    const balanceDue = all.filter(r => r.balanceStatus !== 'paid');
    const departing = all.filter(r => dateKey(r.startDate) >= today && !!dateKey(r.startDate));
    const upcoming = live(departing).sort((a, b) => dateKey(a.startDate).localeCompare(dateKey(b.startDate)));
    const nearest = upcoming[0], within30 = upcoming.filter(r => (dashboardDayDiff(today, dateKey(r.startDate)) ?? 99) <= 30).length;
    const unsigned = waiting.filter(r => r.status !== 'new' && !reservationSigned(r)).length;
    const outstanding = sum(live(balanceDue), r => r.balance);
    return [
        { key: 'all', label: '전체 예약', value: all.length, pct: '', warn: false, tip: '필터 없이 전체 보기',
            rows: [{ k: '총 투어 비용', v: dashboardWon(sum(live(all), r => r.totalAmount)), alert: false },
                { k: '예약금 수령', v: dashboardWon(sum(live(all).filter(r => r.depositStatus === 'paid'), r => r.deposit)), alert: false }] },
        { key: 'waiting', label: '확정 대기', value: waiting.length, pct: pct(waiting.length), warn: waiting.length > 0, tip: '입금·서명·확정 처리가 남은 예약',
            rows: [{ k: '계약 서명 전', v: `${unsigned}건`, alert: unsigned > 0 }, { k: '대기 금액', v: dashboardWon(sum(waiting, r => r.totalAmount)), alert: false }] },
        { key: 'confirmed', label: '예약 확정', value: confirmed.length, pct: pct(confirmed.length), warn: false, tip: '확정·결제 완료 예약',
            rows: [{ k: '확정 금액', v: dashboardWon(sum(confirmed, r => r.totalAmount)), alert: false },
                { k: '잔금까지 완료', v: `${confirmed.filter(r => r.balanceStatus === 'paid').length}건`, alert: false }] },
        { key: 'balanceDue', label: '잔금 대기', value: balanceDue.length, pct: pct(balanceDue.length), warn: balanceDue.length > 0, tip: '잔금 입금이 남은 예약',
            rows: [{ k: '미수 잔금', v: dashboardWon(outstanding), alert: !!outstanding },
                { k: '예약금 수령', v: dashboardWon(sum(live(balanceDue).filter(r => r.depositStatus === 'paid'), r => r.deposit)), alert: false }] },
        { key: 'departing', label: '출발 예정', value: departing.length, pct: pct(departing.length), warn: false, tip: '오늘 이후 출발하는 예약',
            rows: [{ k: '가장 가까운 출발', v: nearest ? `${reservationDday(nearest.startDate, today).label} · ${nearest.customerName || '이름 미정'}` : '없음', alert: false },
                { k: '30일 이내', v: `${within30}건`, alert: within30 > 0 }] },
    ];
}
