export async function onRequest(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  const pathname = new URL(context.request.url).pathname;
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
