/* ═══════════════════════════════════════════════════════════
   알림톡 진단용 (임시) · /api/aligo-test?token=<관리자토큰>&phone=010...
   ---------------------------------------------------------------
   · 관리자 토큰 필요. 환경변수 설정 상태 + 실제 알리고 발송 응답을 보여줍니다.
   · 원인 파악 후 이 파일은 삭제 예정.
   ═══════════════════════════════════════════════════════════ */
import { sendAlimtalk } from "./_aligo.js";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || request.headers.get("x-admin-token") || "";
  if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
    return json({ ok: false, error: "unauthorized — ?token=<관리자토큰> 필요" }, 401);
  }

  // 환경변수 존재 여부만(값은 노출 안 함), 일부는 앞 3글자 힌트
  const hint = v => (v ? v.slice(0, 3) + "…(" + v.length + "자)" : null);
  const envState = {
    ALIGO_API_KEY: !!env.ALIGO_API_KEY,
    ALIGO_USER_ID: env.ALIGO_USER_ID || null,
    ALIGO_SENDER_KEY: !!env.ALIGO_SENDER_KEY,
    ALIGO_SENDER: env.ALIGO_SENDER || null,
    ALIGO_TPL_CODE: env.ALIGO_TPL_CODE || null,
    ALIGO_COMPANY: env.ALIGO_COMPANY || "(기본값 몽골리아 은하수 여행사)",
    ALIGO_FAILOVER: env.ALIGO_FAILOVER || "(꺼짐)",
    ALIGO_TPL_TEXT_설정됨: !!env.ALIGO_TPL_TEXT,
    ALIGO_BUTTON_설정됨: !!env.ALIGO_BUTTON,
    _senderkey힌트: hint(env.ALIGO_SENDER_KEY),
  };

  // 이 서버(Cloudflare)가 밖으로 나갈 때 쓰는 실제 IP — 알리고에 등록해야 하는 값
  // ※ Cloudflare 뒤에 있는 확인 서비스(ipify 등)는 내부 주소가 나오므로
  //   Cloudflare가 아닌 곳(아마존)으로 확인해야 알리고가 보는 IP와 같음
  let egressIp = null;
  try {
    egressIp = (await (await fetch("https://checkip.amazonaws.com")).text()).trim();
  } catch (e) {
    try { egressIp = (await (await fetch("https://ifconfig.me/ip")).text()).trim(); }
    catch (e2) { egressIp = "확인 실패: " + String(e2); }
  }

  const phone = url.searchParams.get("phone");
  if (!phone) {
    return json({ ok: true, note: "환경변수 상태만 확인. 실제 발송 테스트하려면 &phone=010... 추가", 발송서버IP: egressIp, envState });
  }

  const result = await sendAlimtalk(env, { name: url.searchParams.get("name") || "테스트", phone });
  return json({ ok: result.ok, 발송서버IP: egressIp, envState, aligoResponse: result });
}
