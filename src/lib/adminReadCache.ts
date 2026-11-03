/** Short-lived, memory-only snapshots for one authenticated administrator. */
const SNAPSHOT_LIFETIME = 60_000;
const RESOURCES = new Set([
    '/api/reservations', '/api/quotes', '/api/products', '/api/products?summary=1',
    '/api/admin/bookings/quote', '/api/admin/workspace', '/api/admin/assignments',
    '/api/guides', '/api/accommodations', '/api/hotels', '/api/itinerary-templates',
    '/api/banners', '/api/categories', '/api/faqs', '/api/faq-categories',
    '/api/reviews', '/api/magazines', '/api/promotions',
]);

let account = '';
let revision = 0;
const snapshots = new Map<string, { value: unknown; at: number }>();
const pending = new Map<string, Promise<unknown>>();

export function isAdminReadResource(url: string) {
    return RESOURCES.has(url);
}

/** Retain the current scope while invalidating results from before an edit. */
export function invalidateAdminReads() {
    revision += 1;
    snapshots.clear();
    pending.clear();
}

export function setAdminReadAccount(next: string) {
    if (next === account) return;
    invalidateAdminReads();
    account = next;
}

/** Called synchronously before logout and when the authenticated provider unmounts. */
export function clearAdminReads() {
    invalidateAdminReads();
    account = '';
}

/** Callers may explicitly seed a view, without treating cached data as a fresh fetch. */
export function peekAdminRead<T>(url: string, expectedAccount?: string): T | undefined {
    if (!account || (expectedAccount !== undefined && expectedAccount !== account) || !isAdminReadResource(url)) return;
    const snapshot = snapshots.get(url);
    if (!snapshot) return;
    if (Date.now() - snapshot.at >= SNAPSHOT_LIFETIME) {
        snapshots.delete(url);
        return;
    }
    // Existing editors sort and enrich response arrays. Their changes must not
    // modify the snapshot that another administrator view will receive.
    return structuredClone(snapshot.value) as T;
}

/**
 * Default: share only an in-flight GET, then make the next read fresh.
 * preferSnapshot is opt-in; force also bypasses an older in-flight read.
 * Responses from before an account switch/edit never repopulate snapshots.
 */
export function readAdminCached<T>(url: string, loader: () => Promise<T>, options: {
    force?: boolean;
    preferSnapshot?: boolean;
} = {}): Promise<T> {
    if (!account || !isAdminReadResource(url)) return loader();
    if (options.preferSnapshot && !options.force) {
        const value = peekAdminRead<T>(url);
        if (value !== undefined) return Promise.resolve(value);
    }
    if (!options.force) {
        const existing = pending.get(url);
        if (existing) return existing.then(value => structuredClone(value) as T);
    }
    const requestAccount = account, requestRevision = revision;
    const request: Promise<T> = Promise.resolve().then(loader).then(value => {
        if (account === requestAccount && revision === requestRevision && pending.get(url) === request) {
            snapshots.set(url, { value: structuredClone(value), at: Date.now() });
        }
        return value;
    }).finally(() => {
        if (pending.get(url) === request) pending.delete(url);
    });
    pending.set(url, request);
    // Each consumer owns its result; cache and concurrent callers keep copies.
    return request.then(value => structuredClone(value));
}
