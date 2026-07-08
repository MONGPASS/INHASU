/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/data/:key
   ---------------------------------------------------------------
   관리자가 편집하는 "콘텐츠 라이브러리"를 서버(D1)에 영구 저장합니다.
   지금까지 명소·코스·일정은 브라우저 localStorage에만 있어서
   다른 기기/브라우저에서는 사라졌습니다. 이제 서버에 보관됩니다.

   GET  /api/data/:key            → 저장된 JSON 반환 (공개 읽기)
   PUT  /api/data/:key?token=…    → JSON 저장 (관리자 토큰 필요)

   허용 key: spots, spot_cats, courses, snippets, snippet_cats,
             guides, lodges, vehicles (예약관리 리소스)
   ═══════════════════════════════════════════════════════════ */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

const ALLOWED = ["spots", "spot_cats", "courses", "snippets", "snippet_cats", "guides", "drivers", "lodges", "vehicles"];

// kv 테이블은 없으면 자동으로 만듭니다(별도 마이그레이션 불필요).
async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS kv (
       k TEXT PRIMARY KEY,
       v TEXT,
       updated_at TEXT
     )`
  ).run();
}

// ── 읽기 (공개) ──
export async function onRequestGet({ params, env }) {
  const key = params.key;
  if (!ALLOWED.includes(key)) return json({ ok: false, error: "unknown key" }, 404);
  try {
    await ensureTable(env);
    const row = await env.DB.prepare("SELECT v, updated_at FROM kv WHERE k = ?").bind(key).first();
    if (!row) return json({ ok: true, key, data: null, updatedAt: null });
    let data = null;
    try { data = JSON.parse(row.v); } catch (e) {}
    return json({ ok: true, key, data, updatedAt: row.updated_at });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

// ── 저장 (관리자 전용) ──
// 동시 편집 보호: ?base=<마지막으로 받은 updatedAt> 를 보내면, 그 사이에
// 다른 기기/탭이 먼저 저장한 경우 409(conflict)로 알려줍니다. ?force=1 로 덮어쓰기.
export async function onRequestPut({ request, params, env }) {
  const key = params.key;
  if (!ALLOWED.includes(key)) return json({ ok: false, error: "unknown key" }, 404);

  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-admin-token") || "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: "invalid json" }, 400); }

  const v = JSON.stringify(body);
  if (v.length > 3_000_000) return json({ ok: false, error: "too large" }, 413); // ~3MB 안전 한계

  try {
    await ensureTable(env);

    // 충돌 감지 (base가 왔을 때만 검사; force=1이면 무시하고 덮어씀)
    const base = url.searchParams.get("base");
    const force = url.searchParams.get("force") === "1";
    if (base !== null && !force) {
      const cur = await env.DB.prepare("SELECT updated_at FROM kv WHERE k = ?").bind(key).first();
      const curAt = cur ? cur.updated_at : "";
      if ((curAt || "") !== base) {
        return json({ ok: false, error: "conflict", updatedAt: curAt || null }, 409);
      }
    }

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO kv (k, v, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`
    ).bind(key, v, now).run();
    return json({ ok: true, key, updatedAt: now });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

// PUT를 못 쓰는 환경 대비: POST도 저장으로 허용
export const onRequestPost = onRequestPut;
