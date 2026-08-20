/* ═══════════════════════════════════════════════════════════
   알림 진단 · /api/notify-test?token=<관리자토큰>
   ---------------------------------------------------------------
   · 관리자 토큰 필요. 환경변수 설정 상태 + 실제 발송 응답을 보여줍니다.
   · 관리자 문자와 세 고객 카카오 알림톡 템플릿을 각각 진단합니다.

   발송 테스트:
     ?token=…                        설정 상태만 확인 (발송 안 됨)
     ?token=…&type=admin             관리자 문자 (ADMIN_PHONE으로 발송)
     ?token=…&phone=010…             해당 번호로 테스트 문자 발송
     ?token=…&type=quote&phone=010…  견적 준비 알림톡 테스트
     ?token=…&type=itinerary&phone=010… 확정일정표 알림톡 테스트
     ?token=…&type=guidebook&phone=010…&depart=2026-08-18 가이드북 알림톡 테스트
     ?token=…&type=travelnotice&phone=010… 여행 주의사항 알림톡 테스트
        (카카오 알림톡 전용 — 템플릿이 없으면 발송되지 않고 ready:false로 알려줍니다)
   ═══════════════════════════════════════════════════════════ */
import {
  sendSms, notifyAdmin, canSendKakao, travelNoticeTemplateId,
  notifyCustomerQuoteReady, notifyCustomerItineraryReady, notifyCustomerGuidebook,
  notifyCustomerTravelNotice,
} from "./_solapi.js";

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
    SOLAPI_PF_ID: !!env.SOLAPI_PF_ID,
    SOLAPI_TEMPLATE_QUOTE_ID: !!env.SOLAPI_TEMPLATE_QUOTE_ID,
    SOLAPI_TEMPLATE_ITINERARY_ID: !!env.SOLAPI_TEMPLATE_ITINERARY_ID,
    SOLAPI_TEMPLATE_GUIDEBOOK_ID: !!env.SOLAPI_TEMPLATE_GUIDEBOOK_ID,
    SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID: !!env.SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID,
    SITE_URL: env.SITE_URL || env.CUSTOMER_BASE_URL || null,
  };
  /* 여행 주의사항은 카카오 알림톡으로만 나갑니다 — 템플릿이 없으면 발송되지 않습니다 */
  const travelNoticeReady = phoneForChannel =>
    canSendKakao(env, { phone: phoneForChannel || "01000000000", templateId: travelNoticeTemplateId(env) });

  const type = url.searchParams.get("type") || "";
  const phone = url.searchParams.get("phone");

  if (type === "admin") {
    const result = await notifyAdmin(env, "[알림 테스트] 몽골리아 은하수 관리자 문자 발송이 정상 동작합니다.");
    return json({ ok: result.ok, type, envState, solapiResponse: result });
  }

  if ((type === "quote" || type === "itinerary") && phone) {
    const result = type === "quote"
      ? await notifyCustomerQuoteReady(env, { phone, name:"테스트 고객", token:"notification-test" })
      : await notifyCustomerItineraryReady(env, { phone, name:"테스트 고객", token:"notification-test" });
    return json({ ok:result.ok, type, envState, solapiResponse:result });
  }

  if (type === "guidebook" && phone) {
    const result = await notifyCustomerGuidebook(env, {
      phone, name:"테스트 고객", depart:url.searchParams.get("depart") || "2026-08-18",
    });
    return json({ ok:result.ok, type, envState, solapiResponse:result });
  }

  if (type === "travelnotice" && phone) {
    const result = await notifyCustomerTravelNotice(env, {
      phone, name:"테스트 고객", depart:url.searchParams.get("depart") || "2026-08-18", requestUrl:request.url,
    });
    return json({ ok:result.ok, type, channel:"kakao", ready:travelNoticeReady(phone), envState, solapiResponse:result });
  }

  if (phone) {
    const result = await sendSms(env, { phone, text: "[알림 테스트] 몽골리아 은하수 문자 발송이 정상 동작합니다." });
    return json({ ok: result.ok, envState, solapiResponse: result });
  }

  return json({
    ok: true,
    note: "설정 상태만 확인. 관리자 문자는 &type=admin, 일반 문자는 &phone=010…, 알림톡은 &type=quote|itinerary|guidebook|travelnotice&phone=010…",
    travelNotice: {
      channel: "kakao",
      ready: travelNoticeReady(),
      설명: travelNoticeReady()
        ? "여행 주의사항은 카카오 알림톡으로만 발송됩니다 (문자 대체발송 없음)."
        : "SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID가 없어 지금은 발송되지 않습니다 — 승인된 알림톡 템플릿 ID를 넣어주세요.",
    },
    envState,
  });
}
