/* ═══════════════════════════════════════════════════════════
   알림톡(Solapi) 진단 · /api/notify-test?token=<관리자토큰>[&phone=010...]
   ---------------------------------------------------------------
   · 관리자 토큰 필요. 환경변수 설정 상태 + 실제 발송 응답을 보여줍니다.
   · phone 없이 호출하면 설정 상태만 확인 (발송 안 됨).
   ═══════════════════════════════════════════════════════════ */
import { sendAlimtalk } from "./_solapi.js";

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

  const envState = {
    SOLAPI_API_KEY: !!env.SOLAPI_API_KEY,
    SOLAPI_API_SECRET: !!env.SOLAPI_API_SECRET,
    SOLAPI_PF_ID: env.SOLAPI_PF_ID || null,
    SOLAPI_TEMPLATE_ID: env.SOLAPI_TEMPLATE_ID || null,
    SOLAPI_SENDER: env.SOLAPI_SENDER || null,
    NOTIFY_COMPANY: env.NOTIFY_COMPANY || "(기본값 몽골리아 은하수 여행사)",
    SOLAPI_DISABLE_SMS: env.SOLAPI_DISABLE_SMS || "(대체발송 켜짐)",
  };

  const phone = url.searchParams.get("phone");
  if (!phone) {
    return json({ ok: true, note: "설정 상태만 확인. 실제 발송 테스트는 &phone=010... 추가", envState });
  }

  const result = await sendAlimtalk(env, { name: url.searchParams.get("name") || "테스트", phone });
  return json({ ok: result.ok, envState, solapiResponse: result });
}
