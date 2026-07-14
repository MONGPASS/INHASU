/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/requests
   ---------------------------------------------------------------
   POST : 고객이 견적요청 폼에서 제출 → D1에 저장 (인증 없음)
          · honeypot / 같은 번호 60초 제한으로 스팸 방어
          · 신규 id만 저장 (기존 문의 덮어쓰기 불가)
   GET  : 관리자 페이지에서 목록 조회 (x-admin-token 헤더 필요)
   ═══════════════════════════════════════════════════════════ */

import { notifyAdmin } from "./_solapi.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

// 관리자 토큰은 URL·브라우저 기록에 남지 않도록 헤더로만 받습니다.
const isAdmin = (request, env) => {
  const token = request.headers.get("x-admin-token") || "";
  return !!env.ADMIN_TOKEN && token === env.ADMIN_TOKEN;
};

const randomToken = () =>
  [...crypto.getRandomValues(new Uint8Array(24))]
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));

// ── 고객 제출 저장 ──
export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 256_000) return json({ ok: false, error: "request too large" }, 413);
    const d = await request.json();
    const admin = isAdmin(request, env);

    // 스팸 방어 1: honeypot — 사람 눈에는 안 보이는 숨은 칸.
    // 봇이 채워서 제출하면 저장하지 않고 성공한 척 응답합니다.
    if (!admin && d.website) return json({ ok: true, id: "ok" });
    delete d.website;

    if (!admin) {
      d.name = String(d.name || "").trim().slice(0, 40);
      d.phone = String(d.phone || "").replace(/\D/g, "").slice(0, 11);
      d.email = String(d.email || "").trim().slice(0, 120);
      d.kakaoId = String(d.kakaoId || "").trim().slice(0, 80);
      d.request = String(d.request || "").trim().slice(0, 2000);
      d.destSpots = Array.isArray(d.destSpots) ? d.destSpots.slice(0, 20).map(x => String(x).slice(0, 50)) : [];
      d.travelStyles = Array.isArray(d.travelStyles) ? d.travelStyles.slice(0, 10).map(x => String(x).slice(0, 50)) : [];
      ["tripType", "destination", "cityStay", "gerStay", "vehicle", "budget", "flightIssued"].forEach(k => {
        d[k] = String(d[k] || "").trim().slice(0, 100);
      });
    }

    // 스팸 방어 2: 같은 전화번호로 60초 안에 또 제출하면 차단
    if (!admin && d.phone) {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const dup = await env.DB.prepare(
        "SELECT id FROM requests WHERE phone = ? AND received_at > ? LIMIT 1"
      ).bind(d.phone, cutoff).first();
      if (dup) return json({ ok: false, error: "too many requests" }, 429);
    }

    // 공개 폼의 필수값은 서버에서도 검증합니다. 브라우저 검증만으로는 직접 API 호출을 막을 수 없습니다.
    if (!admin) {
      const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email);
      const datesOk = validDate(d.depart) && validDate(d.return_) && d.depart < d.return_;
      const totalPax = Number(d.adult || 0) + Number(d.child || 0) + Number(d.infant || 0);
      const capMatch = String(d.vehicle || "").match(/\((\d+)인\)/);
      const vehicleOk = !capMatch || Number(capMatch[1]) >= totalPax;
      const choicesOk = d.tripType && d.destination && d.cityStay && d.gerStay && d.vehicle && d.flightIssued;
      if (!d.name || !/^\d{9,11}$/.test(d.phone) || !emailOk || !datesOk || Number(d.adult) < 1 || !choicesOk || !vehicleOk || d.agree !== true) {
        return json({ ok: false, error: "invalid request" }, 400);
      }
    }

    // 고객 조회 토큰과 공개 폼의 ID는 서버에서 발급해 변조·형식 불일치를 방지합니다.
    const token = randomToken();
    const id = admin && d.id ? String(d.id) : crypto.randomUUID();
    d.id = id;
    d.token = token;
    d.receivedAt = admin && d.receivedAt ? d.receivedAt : new Date().toISOString();
    d.status = admin && d.status ? d.status : "신규";
    d.memo = admin && d.memo ? d.memo : "";

    // INSERT OR IGNORE: 같은 id가 이미 있으면 무시 → 기존 문의·발행 견적을
    // 인증 없이 덮어쓸 수 없습니다. (중복이면 409, 고객 폼은 재시도 시 새 id로 성공)
    const r = await env.DB.prepare(
      `INSERT OR IGNORE INTO requests
       (id, received_at, name, phone, destination, budget, status, memo, data, token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      d.receivedAt,
      d.name || "", d.phone || "", d.destination || "", d.budget || "",
      d.status || "신규", d.memo || "",
      JSON.stringify(d),
      token
    ).run();
    if (!r.meta || r.meta.changes === 0) return json({ ok: false, error: "duplicate" }, 409);

    // 관리자 문자 알림 — 응답을 막지 않게 백그라운드로.
    // 고객 카톡 알림톡은 사용하지 않습니다 (고객 안내는 페이지 표시 + 카카오 채널 수동 응대).
    const bg = (tag, p) => context.waitUntil(
      p.then(res => console.log(tag, JSON.stringify(res))).catch(e => console.log(tag + "-err", String(e)))
    );

    if (d.source !== "walkin" && d.source !== "course-share") {
      const pax = Number(d.adult || 0) + Number(d.child || 0) + Number(d.infant || 0);
      bg("notify-admin-request", notifyAdmin(env,
        `[새 견적요청] ${d.name || "고객"} · ${d.destination || "여행지 미정"}\n` +
        `${d.depart || "일정 미정"}${d.return_ ? " ~ " + d.return_ : ""} · ${pax || "?"}명\n` +
        `연락처 ${d.phone || "-"}`
      ));
    }

    return json({ ok: true, id, token });
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
