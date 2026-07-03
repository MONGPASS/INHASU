/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/img/<key...>
   GET : 공개 이미지 서빙 (명소·견적 사진 등 — 고객도 봐야 하므로 인증 없음)
   - 반드시 R2의 images/ 접두 키만 서빙 (uploads/ 등 비공개 영역 접근 불가)
   - 장기 캐시
   ═══════════════════════════════════════════════════════════ */

export async function onRequestGet({ env, params }) {
  try {
    const sub = Array.isArray(params.key) ? params.key.join("/") : params.key;
    if (!sub) return new Response("bad request", { status: 400 });
    const key = "images/" + sub;   // 항상 images/ 접두 — 비공개 영역 접근 차단

    const obj = await env.FILES.get(key);
    if (!obj) return new Response("not found", { status: 404 });

    const headers = new Headers();
    headers.set("Content-Type", obj.httpMetadata?.contentType || "image/webp");
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
    if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
    return new Response(obj.body, { headers });
  } catch (e) {
    return new Response("error", { status: 500 });
  }
}
