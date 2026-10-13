import { SEO_CONSTANTS, isPrivateSeoPath } from '../src/constants/seo.ts';
import { fallbackMarkup, readPublicPage, PUBLIC_STATIC_META } from './lib/publicSeo.ts';

interface Env { DB: D1Database; ASSETS: { fetch(request: Request): Promise<Response> } }

const LEGACY_REDIRECTS: Record<string, string> = {
    '/gobi-desert': '/category/gobi-desert',
    '/horse-riding-tour': '/category/horse-riding-tour',
    '/mongol-travel': '/travel-guide',
    '/mongol-tour': '/products',
};

const isQuoteStaticPage = (pathname: string) => {
    let decoded = pathname;
    try { decoded = decodeURIComponent(pathname); } catch { /* malformed URL */ }
    return /^\/[^/]*[가-힣][^/]*$/.test(decoded);
};

export const onRequestGet: PagesFunction<Env> = async context => {
    const url = new URL(context.request.url);
    const path = url.pathname;
    if (path.startsWith('/shop_view') || url.searchParams.has('idx')) return Response.redirect(`${SEO_CONSTANTS.SITE_URL}/products`, 301);
    if (LEGACY_REDIRECTS[path]) return Response.redirect(`${SEO_CONSTANTS.SITE_URL}${LEGACY_REDIRECTS[path]}`, 301);
    if (path === '/index.html' || path === '/index') return Response.redirect(`${url.origin}/${url.search}`, 301);

    // Existing customer/admin document addresses are fixed in Kakao templates.
    // Keep their HTML and token URLs intact, but never publish them to search engines.
    if (isQuoteStaticPage(path)) {
        const response = await context.next();
        const headers = new Headers(response.headers);
        headers.set('X-Robots-Tag', 'noindex, nofollow');
        if (headers.get('content-type')?.includes('text/html')) headers.set('Cache-Control', 'private, no-store');
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    if (path === '/admin-mobile' || path === '/admin-mobile.html') return Response.redirect(`${url.origin}/${encodeURIComponent('견적관리-모바일')}${url.search}`, 302);
    if (path === '/admin.html') return Response.redirect(`${url.origin}/admin${url.search}`, 302);

    // A catalog edit changes HTML independently of the index.html build timestamp.
    // Revalidate known SPA documents against the DB, never the static shell's ETag.
    // Leave static asset requests untouched so their existing 304/cache behavior remains.
    const normalizedPath = path.replace(/\/+$/, '') || '/';
    const spaDocument = Object.hasOwn(PUBLIC_STATIC_META, normalizedPath) || isPrivateSeoPath(normalizedPath) ||
        /^\/(?:products|category|travel-guide|promotions|reviews|travel-mates)\/[^/]+$/.test(normalizedPath);
    let assetRequest: Request = context.request;
    if (spaDocument) {
        const headers = new Headers(context.request.headers);
        for (const name of ['If-None-Match', 'If-Modified-Since', 'If-Match', 'If-Unmodified-Since', 'If-Range', 'Range']) headers.delete(name);
        assetRequest = new Request(context.request, { headers });
    }

    // Avoid the preserved pre-integration admin.html asset in Cloudflare Pages.
    const response = path === '/admin' || path === '/admin/'
        ? await context.env.ASSETS.fetch(new Request(new URL('/', url), { headers: assetRequest.headers }))
        : await context.next(assetRequest);
    if (!response.headers.get('content-type')?.includes('text/html')) return response;

    // HTML assets (including extensionless Pages URLs) are independent documents.
    // Only the actual React app shell has its mount root and needs SPA metadata.
    // Keep verification files and iframe maps byte-for-byte, with their original status.
    const shell = await response.clone().text();
    if (!/<div\b[^>]*\sid\s*=\s*["']root["'][^>]*>/i.test(shell)) {
        if (url.hostname === new URL(SEO_CONSTANTS.SITE_URL).hostname) return response;
        const headers = new Headers(response.headers);
        headers.set('X-Robots-Tag', 'noindex, nofollow');
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }

    let page;
    try {
        page = await readPublicPage(context.env.DB, path);
    } catch (error) {
        // A temporary database error is not a deleted product or an empty catalog.
        console.error('Public page metadata unavailable:', error);
        const headers = new Headers(response.headers);
        headers.delete('ETag');
        headers.delete('Last-Modified');
        headers.set('Cache-Control', 'no-store');
        headers.set('Retry-After', '60');
        headers.set('X-Robots-Tag', 'noindex');
        return new Response(response.body, { status: 503, headers });
    }

    // Preview domains are review copies of the canonical production site.
    if (url.hostname !== new URL(SEO_CONSTANTS.SITE_URL).hostname) page.robots = 'noindex, nofollow';
    const headers = new Headers(response.headers);
    headers.delete('ETag');
    headers.delete('Last-Modified');
    headers.set('X-Robots-Tag', page.robots);
    headers.set('Cache-Control', page.robots.startsWith('noindex') ? 'private, no-store' : 'public, max-age=0, must-revalidate');
    const original = new Response(response.body, { status: page.status, headers });

    const rewrite = new HTMLRewriter()
        .on('title', { element(el) { el.setInnerContent(page.title); el.setAttribute('data-rh', 'true'); } })
        .on('meta[name="description"]', { element(el) { el.setAttribute('content', page.description); el.setAttribute('data-rh', 'true'); } })
        .on('meta[name="robots"]', { element(el) { el.setAttribute('content', page.robots); el.setAttribute('data-rh', 'true'); } })
        .on('link[rel="canonical"]', { element(el) { el.setAttribute('href', page.canonical); el.setAttribute('data-rh', 'true'); } });
    const tags: Record<string, string> = {
        'meta[property="og:title"]': page.title, 'meta[property="og:description"]': page.description,
        'meta[property="og:image"]': page.image, 'meta[property="og:url"]': page.canonical,
        'meta[name="twitter:title"]': page.title, 'meta[name="twitter:description"]': page.description,
        'meta[name="twitter:image"]': page.image,
    };
    for (const [selector, value] of Object.entries(tags)) rewrite.on(selector, { element(el) { el.setAttribute('content', value); el.setAttribute('data-rh', 'true'); } });
    rewrite.on('head', { element(el) {
        for (const data of page.jsonLd) {
            // Escape all '<' characters so stored copy can never end the script element.
            const safe = JSON.stringify(data).replace(/</g, '\\u003c');
            el.append(`<script type="application/ld+json" data-rh="true">${safe}</script>`, { html: true });
        }
    } });
    if (page.body) rewrite.on('#root', { element(el) {
        // Everyone receives the same truthful public content. React replaces this root
        // when it mounts; it remains usable if JavaScript cannot load.
        el.setInnerContent(fallbackMarkup(page), { html: true });
    } });
    return rewrite.transform(original);
};
