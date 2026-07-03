/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/my/<token>
   GET : 고객이 매직 링크로 자기 요청·견적서 조회 (로그인/토큰 인증 없음)
   - token 은 제출 시 발급된 122-bit 랜덤값. 정확히 일치할 때만 반환.
   - 링크 유출 대비, 전화·이메일·카톡ID·첨부키 등 민감정보는 반환하지 않음.
   ═══════════════════════════════════════════════════════════ */

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export async function onRequestGet({ env, params }) {
  try {
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    if (!token || String(token).length < 16) return json({ ok: false, error: "invalid" }, 400);

    const row = await env.DB
      .prepare("SELECT data, status FROM requests WHERE token = ?")
      .bind(token)
      .first();
    if (!row) return json({ ok: false, error: "not found" }, 404);

    const rec = JSON.parse(row.data || "{}");

    // 고객 안전 필드만 추림 (민감정보 제외)
    return json({
      ok: true,
      status: row.status || "신규",
      name: rec.name || "",
      destination: rec.destination || "",
      destSpots: rec.destSpots || [],
      tripType: rec.tripType || "",
      depart: rec.depart || "",
      return_: rec.return_ || "",
      nights: rec.nights || null,
      adult: rec.adult || 0,
      child: rec.child || 0,
      infant: rec.infant || 0,
      receivedAt: rec.receivedAt || "",
      quote: rec.quote || null,
    });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
