/* ═══════════════════════════════════════════════════════════
   Solapi(쿨SMS) 문자·고객 카카오 알림톡 발송 헬퍼
   ---------------------------------------------------------------
   · 파일명이 _ 로 시작하므로 URL 라우팅에서 제외됩니다 (내부 모듈 전용).
   · IP 제한이 없어 Cloudflare(가변 IP)에서 바로 호출 가능 (HMAC 서명 인증).
   · 환경변수가 없으면 조용히 건너뜁니다 — 발송 실패가 저장을 막지 않습니다.
   · 고객 알림톡은 승인된 템플릿으로만 발송하며 견적/일정표/가이드북 링크를 버튼에 넣습니다.

   ── 환경변수 (Cloudflare Pages → Settings → Environment variables) ──
   공통 (없으면 문자 발송 건너뜀)
     SOLAPI_API_KEY          Solapi API Key
     SOLAPI_API_SECRET       Solapi API Secret
     SOLAPI_SENDER           등록된 발신 전화번호 (숫자만)

   관리자 알림 (문자 — 템플릿 승인 불필요)
     ADMIN_PHONE             관리자 휴대폰. 쉼표로 여러 명 가능 (예: 01011112222,01033334444)

   고객 카카오 알림톡 (Cloudflare에 이미 등록된 기존 변수명)
     SOLAPI_PF_ID                    연동한 카카오 비즈니스 채널 pfId
     SOLAPI_TEMPLATE_QUOTE_ID        승인된 "견적서 도착" 템플릿 ID
     SOLAPI_TEMPLATE_ITINERARY_ID    승인된 확정일정표 템플릿 ID
     SOLAPI_TEMPLATE_GUIDEBOOK_ID     승인된 출발 7일 전 가이드북 템플릿 ID
     SITE_URL                        고객 링크 기준 주소(선택, 예: https://mongolia-milkyway.com)
     NOTIFY_COMPANY                  #{회사명} 값(기본: 몽골리아 은하수 여행사)
     SOLAPI_DISABLE_SMS              Y면 알림톡 실패 시 문자 대체발송 안 함

   기존 템플릿은 #{고객명}, #{회사명}, #{링크} 변수를 사용하며,
   승인된 버튼은 템플릿 자체의 버튼을 그대로 사용합니다.
   ═══════════════════════════════════════════════════════════ */

const SKIP = reason => ({ ok: false, skipped: true, reason });

const normPhone = p => String(p || "").replace(/[^0-9]/g, "");
const isPhone = tel => /^0[0-9]{8,10}$/.test(tel);
const sender = env => normPhone(env.SOLAPI_SENDER) || undefined;
const company = env => env.NOTIFY_COMPANY || "몽골리아 은하수 여행사";
const pfId = env => env.SOLAPI_PF_ID || env.SOLAPI_KAKAO_PF_ID || "";
export const quoteTemplateId = env => env.SOLAPI_TEMPLATE_QUOTE_ID || env.SOLAPI_KAKAO_QUOTE_TEMPLATE_ID || "";
export const itineraryTemplateId = env => env.SOLAPI_TEMPLATE_ITINERARY_ID || env.SOLAPI_KAKAO_ITINERARY_TEMPLATE_ID || "";
export const guidebookTemplateId = env => env.SOLAPI_TEMPLATE_GUIDEBOOK_ID || "";
export const GUIDEBOOK_PATH = "guidebooks/mongolia-travel-guidebook-2026.pdf";

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* Solapi 단건 발송. HMAC-SHA256 서명 인증 → IP 등록 불필요. */
async function solapiSend(env, message) {
  if (!env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET) return SKIP("solapi keys not set");

  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const signature = await hmacHex(env.SOLAPI_API_SECRET, date + salt);

  const r = await fetch("https://api.solapi.com/messages/v4/send", {
    method: "POST",
    headers: {
      "Authorization": `HMAC-SHA256 apiKey=${env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
  const j = await r.json().catch(() => ({ errorMessage: "invalid response" }));
  return { ok: r.ok, httpStatus: r.status, ...j };
}

const envBool = value => /^(1|true|yes|on)$/i.test(String(value || ""));

export function canSendKakao(env, { phone, templateId } = {}) {
  return !!(env.SOLAPI_API_KEY && env.SOLAPI_API_SECRET && pfId(env) &&
    templateId && isPhone(normPhone(phone)));
}

/* 승인된 카카오 알림톡 단건 발송. text를 함께 보내면 알림톡이 실패하므로 넣지 않습니다. */
export async function sendKakaoAlimtalk(env, { phone, templateId, variables, buttonName, link }) {
  const tel = normPhone(phone);
  if (!isPhone(tel)) return SKIP("invalid phone");
  if (!pfId(env)) return SKIP("SOLAPI_PF_ID not set");
  if (!templateId) return SKIP("kakao template id not set");

  const kakaoOptions = {
    pfId: pfId(env),
    templateId,
    disableSms: env.SOLAPI_DISABLE_SMS === "Y" || envBool(env.SOLAPI_KAKAO_DISABLE_SMS),
    variables: Object.fromEntries(
      Object.entries(variables || {}).map(([key, value]) => [String(key), String(value ?? "")])
    ),
  };
  if (buttonName && link) {
    kakaoOptions.buttons = [{
      buttonType: "WL", buttonName: String(buttonName),
      linkMo: String(link), linkPc: String(link),
    }];
  }

  const message = { to: tel, kakaoOptions };
  const from = sender(env);
  if (from) message.from = from; // 알림톡 실패 시 SMS/LMS 대체발송에 사용
  return solapiSend(env, message);
}

export function customerPageUrl(env, requestUrl, page, token) {
  const configured = String(env.SITE_URL || env.CUSTOMER_BASE_URL || "").trim();
  const base = new URL(configured || requestUrl);
  const url = new URL(`/${page}`, base.origin);
  url.searchParams.set("t", String(token || ""));
  return url.toString();
}

/* 기존 승인 템플릿의 https://mongolia-milkyway.com/#{링크}에 들어갈 경로입니다. */
export function customerPath(token) {
  return `${encodeURI("내견적.html")}?t=${encodeURIComponent(token || "")}`;
}

export function notifyCustomerQuoteReady(env, { phone, name, token }) {
  return sendKakaoAlimtalk(env, {
    phone,
    templateId: quoteTemplateId(env),
    variables: {
      "#{고객명}": name || "고객",
      "#{회사명}": company(env),
      "#{링크}": customerPath(token),
    },
    // 승인된 "내 요청 확인하기 / 내 견적 확인하기" 버튼을 템플릿 그대로 사용합니다.
  });
}

export function notifyCustomerItineraryReady(env, { phone, name, token }) {
  return sendKakaoAlimtalk(env, {
    phone,
    templateId: itineraryTemplateId(env),
    variables: {
      "#{고객명}": name || "고객",
      "#{회사명}": company(env),
      "#{링크}": customerPath(token),
    },
  });
}

export function notifyCustomerGuidebook(env, { phone, name, depart }) {
  return sendKakaoAlimtalk(env, {
    phone,
    templateId: guidebookTemplateId(env),
    variables: {
      "#{고객명}": name || "고객",
      "#{출발일}": String(depart || ""),
      "#{회사명}": company(env),
      "#{링크}": GUIDEBOOK_PATH,
    },
    // 승인된 "투어 가이드북 보기" 버튼을 템플릿 그대로 사용합니다.
  });
}

/* 일반 문자(SMS/LMS) — 길이에 따라 Solapi가 자동 분류. 템플릿 승인 불필요. */
export async function sendSms(env, { phone, text }) {
  const from = sender(env);
  if (!from) return SKIP("SOLAPI_SENDER not set");

  const tel = normPhone(phone);
  if (!isPhone(tel)) return SKIP("invalid phone");
  if (!text) return SKIP("empty text");

  return solapiSend(env, { to: tel, from, text: String(text).slice(0, 1000) });
}

/* 관리자에게 문자 알림 (ADMIN_PHONE, 쉼표로 여러 명). 실패해도 예외를 던지지 않습니다. */
export async function notifyAdmin(env, text) {
  const list = String(env.ADMIN_PHONE || "").split(",").map(normPhone).filter(isPhone);
  if (!list.length) return SKIP("ADMIN_PHONE not set");

  const results = await Promise.all(
    list.map(phone => sendSms(env, { phone, text }).catch(e => ({ ok: false, error: String(e) })))
  );
  return { ok: results.some(r => r.ok), results };
}
