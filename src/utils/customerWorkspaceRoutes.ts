const paths = new Set(['/admin', '/admin/reservations', '/admin/quotes', '/admin/quote-desk/inbox', '/admin/quote-desk/bookings', '/admin/calendar', '/admin/accommodation-ops']);
/** Only known administrator lists may be used as a return destination. */
export function customerWorkspaceReturnTo(value: string | null | undefined, fallback = '/admin/reservations'): string {
    if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return fallback;
    try { const url = new URL(value, 'https://workspace.invalid'); return url.origin === 'https://workspace.invalid' && paths.has(url.pathname) ? url.pathname + url.search + url.hash : fallback; }
    catch { return fallback; }
}
const workspaceHref = (source: string, id: string, returnTo?: string) => `/admin/customer-workspace/${source}/${encodeURIComponent(id)}` + (returnTo ? `?returnTo=${encodeURIComponent(customerWorkspaceReturnTo(returnTo))}` : '');
export const productCustomerHref = (id: string, returnTo?: string) => workspaceHref('product', id, returnTo);
export const quoteCustomerHref = (id: string, returnTo?: string) => workspaceHref('quote', id, returnTo);
export const legacyQuoteCustomerHref = (id: string, returnTo?: string) => workspaceHref('legacy-quote', id, returnTo);
