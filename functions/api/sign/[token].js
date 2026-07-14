/* ═══════════════════════════════════════════════════════════
   Cloudflare Pages Function · /api/sign/<token>
   POST : 고객이 매직 링크 토큰으로 여행계약서에 서명 제출
   - 예약(booking)이 있어야 하고, 이미 서명했으면 409 (재서명은 관리자가 초기화 후 가능)
   - 서명 시점의 계약 스냅샷(고객·여행 정보·약관 버전)을 함께 동결 저장
   ═══════════════════════════════════════════════════════════ */

import { notifyAdmin } from "../_solapi.js";

const TERMS_VERSION = "v1-2026-07";       // 계약서.html 조항을 바꾸면 버전도 올려주세요
const MAX_SIGN_BYTES = 300_000;           // 서명 PNG dataURL 최대 길이 (~220KB 이미지)

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export async function onRequestPost(context) {
  const { request, env, params } = context;
  try {
    const token = Array.isArray(params.token) ? params.token[0] : params.token;
    if (!token || String(token).length < 16) return json({ ok: false, error: "invalid token" }, 400);

    let body;
    try { body = await request.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }

    if (body.agree !== true) return json({ ok: false, error: "agreement required" }, 400);
    const sig = String(body.signImg || "");
    if (!sig.startsWith("data:image/png;base64,") || sig.length < 200)
      return json({ ok: false, error: "invalid signature image" }, 400);
    if (sig.length > MAX_SIGN_BYTES)
      return json({ ok: false, error: "signature too large" }, 413);

    const row = await env.DB
      .prepare("SELECT id, data, status FROM requests WHERE token = ?")
      .bind(token)
      .first();
    if (!row) return json({ ok: false, error: "not found" }, 404);

    const rec = JSON.parse(row.data || "{}");
    if (!rec.booking) return json({ ok: false, error: "no booking" }, 400);
    if (!rec.booking.contractInfo || rec.booking.contractInfo.depositStatus !== "입금완료")
      return json({ ok:false, error:"deposit required", code:"deposit_required" }, 409);
    if (rec.booking.contract && rec.booking.contract.signedAt)
      return json({ ok: false, error: "already signed" }, 409);

    // 서명 시점의 계약 내용 동결 — 이후 예약 정보가 바뀌어도 서명 당시 내용이 남습니다
    const bk = rec.booking || {};
    const ci = bk.contractInfo || {};
    const contract = {
      signedAt: new Date().toISOString(),
      signImg: sig,
      signerName: String(body.signerName || rec.name || "").slice(0, 40),
      termsVersion: TERMS_VERSION,
      snapshot: {
        name: rec.name || "",
        destination: rec.destination || "",
        depart: rec.depart || "",
        return_: rec.return_ || "",
        nights: rec.nights || null,
        adult: rec.adult || 0, child: rec.child || 0, infant: rec.infant || 0,
        confirmedAt: bk.confirmedAt || "",
        dayCount: Array.isArray(bk.days) ? bk.days.length : 0,
        travelers: Array.isArray(bk.travelers) ? bk.travelers.map(t => ({
          nameKo: t.nameKo || "", passportName: t.passportName || "", birth: t.birth || "",
          phone: t.phone || "", gender: t.gender || "", passportNo: t.passportNo || "",
        })) : [],
        flight: bk.flight || null,
        contractInfo: {
          productName: ci.productName || rec.destination || "",
          region: ci.region || rec.destination || "",
          totalAmount: Number(ci.totalAmount || 0),
          depositAmount: Number(ci.depositAmount || 0),
          depositStatus: ci.depositStatus || "",
          balanceAmount: Number(ci.balanceAmount || 0),
          balanceStatus: ci.balanceStatus || "",
          cashReceipt: ci.cashReceipt || "",
          note: ci.note || "",
        },
      },
      // 법적 증빙 보조 (분쟁 대비): 접속 IP·기기 정보
      ip: request.headers.get("CF-Connecting-IP") || "",
      ua: (request.headers.get("User-Agent") || "").slice(0, 200),
    };
    rec.booking.contract = contract;
    rec.booking.checklist = { ...(rec.booking.checklist || {}), contract: true };

    const now = contract.signedAt;
    rec.activities = Array.isArray(rec.activities) ? rec.activities : [];
    rec.activities.push({ at: now, type: "contract_signed", detail: "고객이 여행계약서에 서명함" });
    let status = row.status || rec.status || "진행중";
    /* ── 알림 ── 백그라운드 발송이라 실패해도 서명 저장에는 영향 없음 */
    rec.notify = rec.notify && typeof rec.notify === "object" ? rec.notify : {};
    rec.activities = rec.activities.slice(-100);

    await env.DB.prepare("UPDATE requests SET status = ?, data = ? WHERE id = ?")
      .bind(status, JSON.stringify(rec), row.id).run();

    const bg = (tag, p) => context.waitUntil(
      p.then(res => console.log(tag, JSON.stringify(res))).catch(e => console.log(tag + "-err", String(e)))
    );
    bg("notify-admin-sign", notifyAdmin(env,
      `[계약서 서명] ${rec.name || "고객"} · ${rec.destination || "여행지 미정"}\n` +
      `고객이 여행계약서에 서명했습니다. 관리자 페이지에서 내용을 확인하고 예약을 확정해 주세요.`
    ));

    return json({ ok: true, signedAt: contract.signedAt, status });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
