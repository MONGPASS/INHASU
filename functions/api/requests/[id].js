/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/requests/:id
   PATCH : 관리자가 상태/메모 변경 (?token=… 필요)
   ═══════════════════════════════════════════════════════════ */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export async function onRequestPatch({ request, env, params }) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
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
