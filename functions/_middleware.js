export async function onRequest(context) {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (new URL(context.request.url).pathname.startsWith("/api/")) headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status:response.status, statusText:response.statusText, headers });
}
