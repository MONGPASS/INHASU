import { SEO_CONSTANTS } from '../src/constants/seo.ts';

export async function onRequest(context) {
  const requestUrl = new URL(context.request.url);
  const canonical = new URL(SEO_CONSTANTS.SITE_URL);
  let response;
  if (requestUrl.hostname === `www.${canonical.hostname}`) {
    // This is a public production alias, not a preview host. Keep methods and customer link queries.
    const target = new URL(canonical.origin);
    target.pathname = requestUrl.pathname;
    target.search = requestUrl.search;
    response = new Response(null, { status: 308, headers: { Location: target.href } });
  } else response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  const pathname = requestUrl.pathname;
  if (/^\/api\/(file|my|documents|requests|admin|auth|reservations|travelers|sign|deposit)(?:\/|$)/.test(pathname)) {
    headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  // Keep cache headers only for successful public raster-image responses. This never
  // includes /api/file, private quote attachments, JSON APIs or failed image lookups.
  const publicImage = /^\/api\/(images|img)\/.+/.test(pathname) &&
    (response.status === 200 || response.status === 304) &&
    /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/.test(headers.get("Content-Type") || "") &&
    /^public(?:,|$)/.test(headers.get("Cache-Control") || "");
  if (pathname.startsWith("/api/") && !publicImage) headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status:response.status, statusText:response.statusText, headers });
}
