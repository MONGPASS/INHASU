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

    // 현재 레코드 읽기 (status 컬럼도 함께 — 상태 보존용)
    const row = await env.DB.prepare("SELECT data, status FROM requests WHERE id = ?").bind(id).first();
    if (!row) return json({ ok: false, error: "not found" }, 404);

    const rec = JSON.parse(row.data);
    // booking 저장 시 기존 계약 서명은 보존 — 관리자가 예약관리를 열어둔 사이 고객이 서명해도
    // 구스냅샷 저장으로 서명이 지워지지 않게. 명시적 초기화(resetContract)일 때만 삭제 허용.
    if (patch.booking && !patch.resetContract) {
      const prev = rec.booking;
      if (prev && prev.contract && prev.contract.signedAt &&
          !(patch.booking.contract && patch.booking.contract.signedAt)) {
        patch.booking.contract = prev.contract;
        patch.booking.checklist = { ...(patch.booking.checklist || {}), contract: true };
      }
    }
    delete patch.resetContract;   // 플래그가 rec에 저장되지 않게
    Object.assign(rec, patch);
    // patch에 status가 없으면 기존 상태 유지 — 견적 발행 등으로 상태가 임의로 바뀌지 않게.
    // 상태 변경은 관리자가 대시보드에서 명시적으로 status를 보낼 때만 이뤄짐.
    if (patch.status === undefined) rec.status = row.status || rec.status || "신규";

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
