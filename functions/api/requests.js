/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/requests
   ---------------------------------------------------------------
   POST : 고객이 견적요청 폼에서 제출 → D1에 저장 (인증 없음)
   GET  : 관리자 페이지에서 목록 조회 (?token=… 필요)
   ═══════════════════════════════════════════════════════════ */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

// ── 고객 제출 저장 ──
export async function onRequestPost({ request, env }) {
  try {
    const d = await request.json();
    const id = d.id || (Date.now() + "_" + (d.phone || ""));

    await env.DB.prepare(
      `INSERT OR REPLACE INTO requests
       (id, received_at, name, phone, destination, budget, status, memo, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      d.receivedAt || new Date().toISOString(),
      d.name || "", d.phone || "", d.destination || "", d.budget || "",
      d.status || "신규", d.memo || "",
      JSON.stringify(d)
    ).run();

    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

// ── 관리자 목록 조회 ──
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const { results } = await env.DB
      .prepare("SELECT data, status, memo FROM requests ORDER BY received_at DESC")
      .all();
    // data(JSON)에 최신 status/memo를 덮어써서 반환
    const items = results.map(row => {
      const rec = JSON.parse(row.data);
      rec.status = row.status;
      rec.memo = row.memo;
      return rec;
    });
    return json({ ok: true, items });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
