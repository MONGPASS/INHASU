/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/requests
   ---------------------------------------------------------------
   POST : 고객이 견적요청 폼에서 제출 → D1에 저장 (인증 없음)
          · honeypot / 같은 번호 60초 제한으로 스팸 방어
          · 신규 id만 저장 (기존 문의 덮어쓰기 불가)
   GET  : 관리자 페이지에서 목록 조회 (토큰 필요 — x-admin-token 헤더 또는 ?token=)
   ═══════════════════════════════════════════════════════════ */

import { sendAlimtalk } from "./_solapi.js";

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

// ── 고객 제출 저장 ──
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const d = await request.json();

    // 스팸 방어 1: honeypot — 사람 눈에는 안 보이는 숨은 칸.
    // 봇이 채워서 제출하면 저장하지 않고 성공한 척 응답합니다.
    if (d.website) return json({ ok: true, id: "ok" });
    delete d.website;

    // 스팸 방어 2: 같은 전화번호로 60초 안에 또 제출하면 차단
    if (d.phone) {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const dup = await env.DB.prepare(
        "SELECT id FROM requests WHERE phone = ? AND received_at > ? LIMIT 1"
      ).bind(d.phone, cutoff).first();
      if (dup) return json({ ok: false, error: "too many requests" }, 429);
    }

    const id = d.id || (Date.now() + "_" + (d.phone || ""));

    // INSERT OR IGNORE: 같은 id가 이미 있으면 무시 → 기존 문의·발행 견적을
    // 인증 없이 덮어쓸 수 없습니다. (중복이면 409, 고객 폼은 재시도 시 새 id로 성공)
    const r = await env.DB.prepare(
      `INSERT OR IGNORE INTO requests
       (id, received_at, name, phone, destination, budget, status, memo, data, token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      d.receivedAt || new Date().toISOString(),
      d.name || "", d.phone || "", d.destination || "", d.budget || "",
      d.status || "신규", d.memo || "",
      JSON.stringify(d),
      d.token || null
    ).run();
    if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: "duplicate" }, 409);

    // 접수 확인 카톡 알림톡("맞춤여행접수" 템플릿) — 응답을 막지 않게 백그라운드로.
    // 발송 실패해도 접수 저장에는 영향 없음. 결과는 CF 함수 로그에서 확인.
    if (d.phone && d.source !== "walkin") {
      context.waitUntil(
        sendAlimtalk(env, { name: d.name || "고객", phone: d.phone })
          .then(res => console.log("alimtalk", JSON.stringify(res)))
          .catch(e => console.log("alimtalk-err", String(e)))
      );
    }

    return json({ ok: true, id });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}

// ── 관리자 목록 조회 ──
export async function onRequestGet({ request, env }) {
  if (!isAdmin(request, env)) {
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
