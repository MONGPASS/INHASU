// Successful content saves refresh this tab and other tabs on the same origin.
// The signal contains a resource name only; customer/admin payloads never leave this tab.
const CHANGE_KEY = 'mw_public_content_changed';
const CHANGE_EVENT = 'mw-public-content-changed';
const RESOURCES = new Set(['products', 'categories', 'banners', 'magazines', 'promotions', 'settings', 'tourist-spots', 'design-spots', 'hotels', 'faqs', 'tour-faqs', 'reviews', 'quick-links', 'event-banners']);
const CONTENT_QUERIES = new Set(['homeData', 'heroBannersDesktop', 'heroBannersMobile', 'productCategories', 'category', 'products-by-category', 'headerSearch', 'products', 'quickLinks', 'touristSpots', 'settings', 'hotel', 'tourFaqs', 'promotions', 'homeReviewsDesktop', 'userReviews', 'reviewTourProducts']);

export function changedContentResource(url: string, method = 'GET'): string | null {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return null;
    const resource = url.match(/^\/api\/([^/?]+)/)?.[1];
    return resource && RESOURCES.has(resource) ? resource : null;
}

export function isPublicContentQuery(key: readonly unknown[]): boolean {
    return CONTENT_QUERIES.has(String(key[0])) || (key[0] === 'tourDetail' && key[1] === 'products');
}

export function notifyContentSaved(resource: string): void {
    if (typeof window === 'undefined' || !RESOURCES.has(resource)) return;
    window.dispatchEvent(new Event(CHANGE_EVENT));
    try {
        window.localStorage.setItem(CHANGE_KEY, JSON.stringify({ resource, savedAt: Date.now(), nonce: Math.random() }));
    } catch { /* Storage can be unavailable; this tab has already refreshed. */ }
}

export function subscribeContentSaved(refresh: () => void): () => void {
    if (typeof window === 'undefined') return () => {};
    const onStorage = (event: StorageEvent) => {
        if (event.key !== CHANGE_KEY || !event.newValue) return;
        try {
            if (RESOURCES.has(JSON.parse(event.newValue).resource)) refresh();
        } catch { /* Ignore unrelated or invalid storage signals. */ }
    };
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
        window.removeEventListener(CHANGE_EVENT, refresh);
        window.removeEventListener('storage', onStorage);
    };
}
