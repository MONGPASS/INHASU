/* ═══════════════════════════════════════════════════════════
   알림 진단 · /api/notify-test?token=<관리자토큰>
   ---------------------------------------------------------------
   · 관리자 토큰 필요. 환경변수 설정 상태 + 실제 발송 응답을 보여줍니다.
   · phone 없이 호출하면 설정 상태만 확인 (발송 안 됨).

   발송 테스트:
     ?token=…&phone=010…               접수 알림톡 ("맞춤여행접수")
     ?token=…&phone=010…&type=quote    견적서 도착 알림톡
     ?token=…&phone=010…&type=confirm  예약 확정 알림톡
     ?token=…&type=admin               관리자 문자 (ADMIN_PHONE으로 발송)
   ═══════════════════════════════════════════════════════════ */
import { sendAlimtalk, sendQuoteReady, sendBookingConfirmed, notifyAdmin, customerPath } from "./_solapi.js";

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
    SOLAPI_SENDER: env.SOLAPI_SENDER || null,
    SOLAPI_PF_ID: env.SOLAPI_PF_ID || null,
    SOLAPI_TEMPLATE_ID: env.SOLAPI_TEMPLATE_ID || null,
    SOLAPI_TEMPLATE_QUOTE_ID: env.SOLAPI_TEMPLATE_QUOTE_ID || null,
    SOLAPI_TEMPLATE_CONFIRM_ID: env.SOLAPI_TEMPLATE_CONFIRM_ID || null,
    ADMIN_PHONE: env.ADMIN_PHONE || null,
    NOTIFY_COMPANY: env.NOTIFY_COMPANY || "(기본값 몽골리아 은하수 여행사)",
    SITE_URL: env.SITE_URL || "(요청 origin 사용)",
    SOLAPI_DISABLE_SMS: env.SOLAPI_DISABLE_SMS || "(대체발송 켜짐)",
  };

  const type = url.searchParams.get("type") || "request";
  const phone = url.searchParams.get("phone");
  const name = url.searchParams.get("name") || "테스트";

  if (type === "admin") {
    const result = await notifyAdmin(env, "[알림 테스트] 몽골리아 은하수 관리자 문자 발송이 정상 동작합니다.");
    return json({ ok: result.ok, type, envState, solapiResponse: result });
  }

  if (!phone) {
    return json({
      ok: true,
      note: "설정 상태만 확인. 실제 발송은 &phone=010… (관리자 문자는 &type=admin)",
      envState,
    });
  }

  // 테스트용 더미 토큰 — 실제 발송에서는 고객 토큰이 들어갑니다 (링크를 눌러도 404)
  const who = { name, phone, origin: url.origin, token: url.searchParams.get("t") || "TEST-TOKEN" };

  let result;
  if (type === "quote") result = await sendQuoteReady(env, who);
  else if (type === "confirm") result = await sendBookingConfirmed(env, who);
  else result = await sendAlimtalk(env, who);

  return json({ ok: result.ok, type, envState, buttonLinkPath: customerPath(who.token), solapiResponse: result });
}
