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

    // 키: uploads/<타임스탬프>_<안전한 파일명>
    const safeName = name.replace(/[^\w가-힣.\-]/g, "_").slice(-80);
    const key = `uploads/${Date.now()}_${safeName}`;

    await env.FILES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type || "application/octet-stream" },
      customMetadata: { originalName: name },
    });

    return json({ ok: true, key, name });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
