import type { AdminWorkspaceData } from '../types/adminWorkspace';

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

export const dashboardStatusTone = (status: string): string => ({
    confirmed: 'b-green', paid: 'b-blue', completed: 'b-gray', cancelled: 'b-gray',
    pending_payment: 'b-amber', reservation_requested: 'b-purple', on_hold: 'b-amber',
}[status] || 'b-gray');
