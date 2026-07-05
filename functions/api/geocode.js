/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/geocode
   GET ?q=<지명>&token=…  → 이름으로 위도·경도 조회 (관리자 전용)
   ---------------------------------------------------------------
   OpenStreetMap Nominatim을 서버에서 호출합니다.
   · 브라우저 CORS 회피 + Nominatim 정책(User-Agent) 준수
   · 몽골(countrycodes=mn)로 우선 검색, 없으면 전역 재검색
   · 결과는 kv 테이블에 캐시(같은 지명 재조회 시 API 호출 안 함)
   ═══════════════════════════════════════════════════════════ */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

async function ensureCache(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT, updated_at TEXT)`
  ).run();
}

async function nominatim(q, mongoliaOnly) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  if (mongoliaOnly) url.searchParams.set("countrycodes", "mn");
  const res = await fetch(url, {
    headers: {
      // Nominatim 정책상 식별 가능한 User-Agent 필요
      "User-Agent": "MongoliaMilkyway-Admin/1.0 (travel quote tool)",
      "Accept-Language": "en",
    },
  });
  if (!res.ok) return null;
  const arr = await res.json().catch(() => []);
  if (!Array.isArray(arr) || !arr.length) return null;
  const hit = arr[0];
  const lat = parseFloat(hit.lat), lng = parseFloat(hit.lon);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng, display: hit.display_name || "" };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-admin-token") || "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return json({ ok: false, error: "no query" }, 400);

  const cacheKey = "geo:" + q.toLowerCase();
  try {
    await ensureCache(env);
    const row = await env.DB.prepare("SELECT v FROM kv WHERE k = ?").bind(cacheKey).first();
    if (row) { try { return json({ ok: true, cached: true, ...JSON.parse(row.v) }); } catch (e) {} }

    // 몽골 우선 → 전역 순으로 검색
    let hit = await nominatim(q, true);
    if (!hit) hit = await nominatim(q, false);
    if (!hit) return json({ ok: false, error: "not found" }, 404);

    const now = new Date().toISOString();
    await env.DB.prepare(
      `INSERT INTO kv (k, v, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(k) DO UPDATE SET v = excluded.v, updated_at = excluded.updated_at`
    ).bind(cacheKey, JSON.stringify(hit), now).run();

    return json({ ok: true, ...hit });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
