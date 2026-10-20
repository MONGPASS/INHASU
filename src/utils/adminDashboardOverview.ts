import type { AdminWorkspaceData } from '../types/adminWorkspace';

export type DashboardRevenueRange = 'all' | 'month' | '30days' | 'year';
const sold = (status: string) => ['confirmed', 'paid', 'completed'].includes(status);
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Creation timestamps use Korea time, including SQLite's offset-free UTC values. */
export function dashboardCreatedDay(value: string): string {
    if (!value) return '';
    if (validDay(value)) return value;
    if (!validDay(value.slice(0, 10))) return '';
    const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
    const date = new Date(normalized);
    if (!Number.isFinite(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const part = (name: string) => parts.find(entry => entry.type === name)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
}

/** Additional charts use the same complete, account-scoped booking snapshot as the lists. */
export function dashboardOverview(data: AdminWorkspaceData | null, range: DashboardRevenueRange = 'all') {
    const complete = !!data && data.availability.reservations && data.availability.requests;
    const today = data && validDay(data.today) ? data.today : '';
    const confirmed = data?.bookings.filter(booking => sold(booking.status)) || [];
    const missingCreatedDay = data?.bookings.some(booking => !dashboardCreatedDay(booking.createdAt));
    const undated = confirmed.filter(booking => !dashboardCreatedDay(booking.createdAt)).length;
    const floor = today ? range === 'month' ? `${today.slice(0, 7)}-01` : range === 'year' ? `${today.slice(0, 4)}-01-01`
        : new Date(Date.parse(today) - 29 * 86400000).toISOString().slice(0, 10) : '';
    const selection = range === 'all' ? confirmed : confirmed.filter(booking => {
        const day = dashboardCreatedDay(booking.createdAt);
        return day >= floor && day <= today;
    });
    const knownMoney = (value: number | null) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
    const revenue = !complete ? null : range === 'all' ? data?.metrics.confirmedSales ?? null
        : !today || undated || selection.some(booking => !knownMoney(booking.totalAmount)) ? null
            : selection.reduce((sum, booking) => sum + booking.totalAmount!, 0);
    const monthBase = today ? new Date(`${today.slice(0, 7)}-01T00:00:00Z`) : null;
    const months = Array.from({ length: 6 }, (_, index) => {
        const key = monthBase ? new Date(Date.UTC(monthBase.getUTCFullYear(), monthBase.getUTCMonth() - 5 + index, 1)).toISOString().slice(0, 7) : '';
        const rows = confirmed.filter(booking => dashboardCreatedDay(booking.createdAt).startsWith(key));
        return { key, label: key ? `${Number(key.slice(5))}월` : '—', amount: !complete || !key || undated || rows.some(booking => !knownMoney(booking.totalAmount)) ? null
            : rows.reduce((sum, booking) => sum + booking.totalAmount!, 0) };
    });
    const days = Array.from({ length: 7 }, (_, index) => {
        const key = today ? new Date(Date.parse(today) - (6 - index) * 86400000).toISOString().slice(0, 10) : '';
        return { key, label: key ? `${Number(key.slice(5, 7))}.${Number(key.slice(8))}` : '—',
            count: complete && key && !missingCreatedDay ? data!.bookings.filter(booking => dashboardCreatedDay(booking.createdAt) === key).length : null };
    });
    const sources = [
        { type: 'product', label: '상품 예약', href: '/admin/reservations?type=product' },
        { type: 'quote_booking', label: '견적 예약', href: '/admin/reservations?type=quote_booking' },
    ].map(source => ({ ...source, count: complete ? data!.bookings.filter(booking => booking.type === source.type).length : null }));
    return { complete, revenue, months, days, sources, undated,
        total: complete ? data!.bookings.length : null,
        signed: complete ? data!.bookings.filter(booking => booking.contractSigned).length : null,
        paid: complete ? data!.bookings.filter(booking => booking.depositPaid).length : null };
}
