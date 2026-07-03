/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/file/<key...>
   GET : 관리자가 고객 첨부파일 다운로드 (?token=ADMIN_TOKEN 필요)
   - 파일은 비공개 R2에 있으므로 이 경로가 유일한 접근 통로
   ═══════════════════════════════════════════════════════════ */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export async function onRequestGet({ request, env, params }) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    // [[key]] 는 배열로 들어옴: ["uploads", "1234_file.pdf"]
    const key = Array.isArray(params.key) ? params.key.join("/") : params.key;
    const obj = await env.FILES.get(key);
    if (!obj) return json({ ok: false, error: "not found" }, 404);

    const name = (obj.customMetadata && obj.customMetadata.originalName) || key.split("/").pop();
    const headers = new Headers();
    headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(name)}`);
    return new Response(obj.body, { headers });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
