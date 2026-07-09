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

    // 예약 확정 정보 — 고객에게 보여줄 안전 서브셋만 (내부 메모·체크리스트·연락처 제외)
    const bk = rec.booking || null;
    const safeAssign = a => a ? {
      // 가이드: 고객 확정일정표에 노출되는 필드 전체 (영문이름·구분·전화·카톡QR 포함 — 관리자가 고객 노출용으로 입력)
      guide:   a.guide   ? { name: a.guide.name || "", nameEn: a.guide.nameEn || "", role: a.guide.role || "",
                             phone: a.guide.phone || "", qr: a.guide.qr || "",
                             career: a.guide.career || "",  korean: a.guide.korean || "", img: a.guide.img || "",  desc: a.guide.desc || "" } : null,
      vehicle: a.vehicle ? { model: a.vehicle.model || "", seats: a.vehicle.seats || "", img: a.vehicle.img || "", imgs: Array.isArray(a.vehicle.imgs) ? a.vehicle.imgs : [], desc: a.vehicle.desc || "" } : null,
      lodges:  Array.isArray(a.lodges) ? a.lodges.map(l => ({ day: l.day, name: l.name || "", grade: l.grade || "", img: l.img || "", imgs: Array.isArray(l.imgs) ? l.imgs : [], tags: l.tags || "", desc: l.desc || "" })) : [],
    } : null;
    const booking = bk ? {
      confirmedAt: bk.confirmedAt || "",
      days: Array.isArray(bk.days) ? bk.days : [],
      travelers: Array.isArray(bk.travelers) ? bk.travelers.map(t => ({
        nameKo: t.nameKo || "",
        passportName: t.passportName || "",
        birth: t.birth || "",
        phone: t.phone || "",
        gender: t.gender || "",
        passportNo: t.passportNo || "",
      })) : [],
      flight: bk.flight ? {
        inDate: bk.flight.inDate || "",
        inTime: bk.flight.inTime || "",
        inNo: bk.flight.inNo || "",
        outDate: bk.flight.outDate || "",
        outTime: bk.flight.outTime || "",
        outNo: bk.flight.outNo || "",
      } : null,
      contractInfo: {
        productName: (bk.contractInfo && bk.contractInfo.productName) || rec.destination || "",
        region: (bk.contractInfo && bk.contractInfo.region) || rec.destination || "",
        totalAmount: Number((bk.contractInfo && bk.contractInfo.totalAmount) || (rec.finance && rec.finance.salesAmount) || 0),
        depositAmount: Number((bk.contractInfo && bk.contractInfo.depositAmount) || (rec.finance && rec.finance.depositAmount) || 0),
        balanceAmount: Number((bk.contractInfo && bk.contractInfo.balanceAmount) || (rec.finance && rec.finance.balanceAmount) || 0),
        cashReceipt: (bk.contractInfo && bk.contractInfo.cashReceipt) || (rec.finance && rec.finance.cashReceipt) || "",
        note: (bk.contractInfo && bk.contractInfo.note) || "",
      },
      // notes(추가 메모)는 내부 참고용 — 고객에게 반환하지 않음
      assign: safeAssign(bk.assign),
      // 계약 서명 상태 — 본인 서명 이미지·서명 시각만 (IP·기기 정보는 반환 안 함)
      contract: (bk.contract && bk.contract.signedAt) ? {
        signedAt: bk.contract.signedAt,
        signImg: bk.contract.signImg || "",
        signerName: bk.contract.signerName || "",
        termsVersion: bk.contract.termsVersion || "",
        snapshot: bk.contract.snapshot || null,
      } : null,
    } : null;

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
      booking,
    });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
