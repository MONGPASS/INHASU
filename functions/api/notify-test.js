/* ═══════════════════════════════════════════════════════════
   알림 진단 · /api/notify-test?token=<관리자토큰>
   ---------------------------------------------------------------
   · 관리자 토큰 필요. 환경변수 설정 상태 + 실제 발송 응답을 보여줍니다.
   · 고객 카톡 알림톡은 제거되어 관리자 문자만 진단합니다.

   발송 테스트:
     ?token=…                        설정 상태만 확인 (발송 안 됨)
     ?token=…&type=admin             관리자 문자 (ADMIN_PHONE으로 발송)
     ?token=…&phone=010…             해당 번호로 테스트 문자 발송
   ═══════════════════════════════════════════════════════════ */
import { sendSms, notifyAdmin } from "./_solapi.js";

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
    ADMIN_PHONE: env.ADMIN_PHONE || null,
  };

  const type = url.searchParams.get("type") || "";
  const phone = url.searchParams.get("phone");

  if (type === "admin") {
    const result = await notifyAdmin(env, "[알림 테스트] 몽골리아 은하수 관리자 문자 발송이 정상 동작합니다.");
    return json({ ok: result.ok, type, envState, solapiResponse: result });
  }

  if (phone) {
    const result = await sendSms(env, { phone, text: "[알림 테스트] 몽골리아 은하수 문자 발송이 정상 동작합니다." });
    return json({ ok: result.ok, envState, solapiResponse: result });
  }

  return json({
    ok: true,
    note: "설정 상태만 확인. 관리자 문자 테스트는 &type=admin, 특정 번호 테스트는 &phone=010…",
    envState,
  });
}
