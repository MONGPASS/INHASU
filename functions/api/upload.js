/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/upload
   POST : 고객이 견적요청 폼에서 첨부파일(항공권 등) 업로드 → R2 저장
   - 인증 없음(고객용)이지만 크기·형식 제한으로 방어
   - 파일은 비공개 R2에 저장, 다운로드는 관리자 토큰 필요(/api/file/…)
   ═══════════════════════════════════════════════════════════ */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXT = ["pdf", "jpg", "jpeg", "png", "webp", "heic", "gif"];

export async function onRequestPost({ request, env }) {
  try {
    const url = new URL(request.url);
    // folder=images → 공개 이미지(명소·견적 사진). 관리자 인증 필요.
    // 그 외 → uploads/ (고객 첨부, 비공개, 인증 없음)
    // 토큰은 x-admin-token 헤더 우선, ?token= 쿼리도 호환용으로 허용.
    const isPublic = url.searchParams.get("folder") === "images";
    const token = request.headers.get("x-admin-token") || url.searchParams.get("token") || "";
    if (isPublic && (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN)) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return json({ ok: false, error: "no file" }, 400);
    }
    if (file.size > MAX_SIZE) {
      return json({ ok: false, error: "too large (max 10MB)" }, 413);
    }
    const name = file.name || "file";
    const ext = (name.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return json({ ok: false, error: "type not allowed" }, 415);
    }

    const safeName = name.replace(/[^\w가-힣.\-]/g, "_").slice(-80);
    const folder = isPublic ? "images" : "uploads";
    const key = `${folder}/${Date.now()}_${safeName}`;

    await env.FILES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { originalName: name },
    });

    // 공개 이미지는 바로 쓸 수 있는 공개 URL도 함께 반환
    if (isPublic) return json({ ok: true, key, url: "/api/img/" + key.slice("images/".length) });
    return json({ ok: true, key, name });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
