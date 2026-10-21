import ReactGA from 'react-ga4';

/** GA4 property "Milky way" (519854094), web stream 몽골리아 은하수. */
const MEASUREMENT_ID = 'G-PZ55YEJ7WL';
/** Only the live site reports; local servers, previews and tests never send hits. */
const PRODUCTION_HOSTS = new Set(['mongolia-milkyway.com', 'www.mongolia-milkyway.com']);
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];

/**
 * Public marketing pages only (allowlist). Customer documents, my-page, booking/payment, chats and
 * admin screens carry tokens or personal records in their URLs and are never reported by path.
 */
const PUBLIC_ROUTES = [
    /^\/$/, /^\/about$/, /^\/products(\/[^/]+)?$/, /^\/category\/[^/]+$/, /^\/promotions(\/[^/]+)?$/,
    /^\/reviews(\/(?!write$)[^/]+)?$/, /^\/travel-guide(\/[^/]+)?$/, /^\/travel-mates(\/(?!write$)[^/]+)?$/,
    /^\/faq$/, /^\/contact$/, /^\/custom-estimate$/, /^\/estimate-complete$/, /^\/privacy-policy$/,
    /^\/terms-of-service$/, /^\/guide-apply$/,
];
export const isTrackedPath = (pathname: string): boolean => PUBLIC_ROUTES.some(route => route.test(pathname));

/** The reported URL keeps only campaign (utm_*) parameters, which GA needs for channel attribution. */
export function analyticsPageLocation(origin: string, pathname: string, search: string): string {
    const params = new URLSearchParams(search), kept = new URLSearchParams();
    UTM_KEYS.forEach(key => { const value = params.get(key); if (value) kept.set(key, value); });
    const query = kept.toString();
    return `${origin}${pathname}${query ? `?${query}` : ''}`;
}

let started = false;
const enabled = () => typeof window !== 'undefined' && !import.meta.env.DEV && PRODUCTION_HOSTS.has(window.location.hostname);

/**
 * Reports one route view. GA starts on the first public page, so a visitor who only opens a customer
 * link is never tracked. Automatic page views are off (here and in the stream's enhanced measurement);
 * after start, private routes are masked so scroll/click events cannot carry their URLs either.
 */
export function trackPageView(pathname: string, search: string): void {
    if (!enabled()) return;
    const origin = window.location.origin;
    if (!isTrackedPath(pathname)) {
        if (started) ReactGA.set({ page_location: `${origin}/private`, page_title: '비공개 화면' });
        return;
    }
    if (!started) {
        ReactGA.initialize(MEASUREMENT_ID, { gtagOptions: { send_page_view: false } });
        started = true;
    }
    const location = analyticsPageLocation(origin, pathname, search);
    ReactGA.set({ page_location: location, page_title: document.title });
    ReactGA.gtag('event', 'page_view', { page_location: location, page_title: document.title });
}

/** A quote request the server confirmed as saved; GA attributes it to the visit's channel. */
export function trackLead(form: 'custom_estimate'): void {
    if (!enabled() || !started) return;
    ReactGA.gtag('event', 'generate_lead', { lead_form: form });
}
