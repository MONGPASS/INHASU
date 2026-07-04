/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/requests/:id
   PATCH  : 관리자가 상태/메모/견적 변경 (?token=… 필요)
   DELETE : 관리자가 문의 삭제 (?token=… 필요)
   ═══════════════════════════════════════════════════════════ */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

// 관리자 토큰: 헤더(x-admin-token) 우선, 쿼리(?token=)도 호환용으로 허용
const isAdmin = (request, env) => {
  const url = new URL(request.url);
  const token = request.headers.get("x-admin-token") || url.searchParams.get("token") || "";
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
};

export async function onRequestPatch({ request, env, params }) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const patch = await request.json();
    const id = params.id;

    // 현재 레코드 읽기
    const row = await env.DB.prepare("SELECT data FROM requests WHERE id = ?").bind(id).first();
    if (!row) return json({ ok: false, error: "not found" }, 404);

    const rec = JSON.parse(row.data);
    Object.assign(rec, patch);

    await env.DB.prepare(
      "UPDATE requests SET status = ?, memo = ?, data = ? WHERE id = ?"
    ).bind(rec.status || "신규", rec.memo || "", JSON.stringify(rec), id).run();

    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

// ── 문의 삭제 (관리자 전용) ──
export async function onRequestDelete({ request, env, params }) {
  if (!isAdmin(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const r = await env.DB.prepare("DELETE FROM requests WHERE id = ?").bind(params.id).run();
    if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: "not found" }, 404);
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
