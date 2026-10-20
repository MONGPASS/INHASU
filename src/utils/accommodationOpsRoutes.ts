import { customerWorkspaceReturnTo } from './customerWorkspaceRoutes.ts';

export type AccommodationOpsSource = 'product' | 'quote_booking';
const returnLists = new Set(['/admin/calendar', '/admin/reservations', '/admin/accommodation-ops']);

/** The lodging board may return to a known list or the exact customer workspace that opened it. */
export function readAccommodationReturnTo(value: string | null | undefined, fallback = '/admin/accommodation-ops'): string {
    if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return fallback;
    try {
        const url = new URL(value, 'https://workspace.invalid');
        if (url.origin !== 'https://workspace.invalid' || /%(?:0a|0d|5c)/i.test(url.pathname)) return fallback;
        if (url.searchParams.getAll('returnTo').length > 1 || url.searchParams.getAll('action').length > 1) return fallback;
        if (returnLists.has(url.pathname)) return customerWorkspaceReturnTo(value, fallback);
        if (!/^\/admin\/customer-workspace\/(?:product|quote)\/[^/]+$/.test(url.pathname)) return fallback;
        // A consumed calendar shortcut must not reopen itself when returning from the board.
        if (url.searchParams.has('action')) url.searchParams.delete('action');
        return `${url.pathname}${url.search}${url.hash}`;
    } catch { return fallback; }
}

/** Source and ID are always separate: product and quote reservations can share an ID. */
export function accommodationOpsHref(source: AccommodationOpsSource, id: string, returnTo?: string, day?: number): string {
    const params = new URLSearchParams({ source, open: id });
    if (returnTo) params.set('returnTo', readAccommodationReturnTo(returnTo));
    if (typeof day === 'number' && Number.isInteger(day) && day > 0 && day <= 100) params.set('day', String(day));
    return `/admin/accommodation-ops?${params}`;
}
