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
     SOLAPI_TEMPLATE_GUIDEBOOK_ID     (사용 안 함) 기존 출발 7일 전 가이드북 템플릿 ID
     SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID 여행 주의사항 알림톡 템플릿 ID
                                     · 여행 주의사항은 카카오 알림톡으로만 발송합니다.
                                     · 없으면 발송되지 않습니다 (문자로 대체하지 않음).
     SITE_URL                        고객 링크 기준 주소(선택, 예: https://mongolia-milkyway.com)
     NOTIFY_COMPANY                  #{회사명} 값(기본: 몽골리아 은하수 여행사)
     SOLAPI_DISABLE_SMS              Y면 알림톡 실패 시 문자 대체발송 안 함
                                     (여행 주의사항은 이 값과 무관하게 항상 대체발송 없음)

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
export const contractTemplateId = env => env.SOLAPI_TEMPLATE_CONTRACT_ID || env.SOLAPI_KAKAO_CONTRACT_TEMPLATE_ID || "";
export const itineraryTemplateId = env => env.SOLAPI_TEMPLATE_ITINERARY_ID || env.SOLAPI_KAKAO_ITINERARY_TEMPLATE_ID || "";
export const guidebookTemplateId = env => env.SOLAPI_TEMPLATE_GUIDEBOOK_ID || "";
/* 여행 주의사항(가이드북) 전용 템플릿 — 계약서 서명 직후 문구로 승인받은 템플릿을 넣습니다.
   여행 주의사항은 카카오 알림톡으로만 나가므로, 이 값이 비어 있으면 발송되지 않습니다. */
export const travelNoticeTemplateId = env => env.SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID || "";
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
export async function sendKakaoAlimtalk(env, { phone, templateId, variables, buttonName, link, disableSms }) {
  const tel = normPhone(phone);
  if (!isPhone(tel)) return SKIP("invalid phone");
  if (!pfId(env)) return SKIP("SOLAPI_PF_ID not set");
  if (!templateId) return SKIP("kakao template id not set");

  const kakaoOptions = {
    pfId: pfId(env),
    templateId,
    // disableSms를 명시로 넘기면(카톡 전용 발송) 환경변수와 무관하게 문자 대체를 막습니다.
    disableSms: disableSms === true || env.SOLAPI_DISABLE_SMS === "Y" || envBool(env.SOLAPI_KAKAO_DISABLE_SMS),
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

export async function notifyCustomerContractReady(env, { phone, name, token, requestUrl }) {
  const url = customerPageUrl(env, requestUrl, "내견적.html", token);
  const templateId = contractTemplateId(env);
  if (canSendKakao(env, { phone, templateId })) {
    return sendKakaoAlimtalk(env, {
      phone,
      templateId,
      variables: {
        "#{고객명}": name || "고객",
        "#{회사명}": company(env),
        "#{링크}": customerPath(token),
      },
      buttonName: "계약서 확인하기",
      link: url,
    });
  }

  const text =
`[${company(env)}]
${name ? name + "님, " : ""}입금확인이 완료되었습니다.
투어 계약서 보내드립니다.
확인하시고 작성해주세요😊

1. 여행자정보 입력하기
2. 여행계약서 확인 및 서명하기

완료하고 저희한테 말씀해주시면 되겠습니다.

▶ 투어 계약서 확인하기:
${url}`;

  return sendSms(env, { phone, text });
}

export function guidebookUrl(env, requestUrl) {
  const configured = String(env.SITE_URL || env.CUSTOMER_BASE_URL || "").trim();
  const base = new URL(configured || requestUrl || "https://mongolia-milkyway.com");
  return new URL(`/${GUIDEBOOK_PATH}`, base.origin).toString();
}

/* 여행 주의사항 안내 — 계약서 서명 직후 자동 발송과 관리자 수동 발송에 함께 사용합니다.
   ── 카카오 알림톡으로만 발송합니다 ──
   문자로는 절대 나가지 않도록 대체발송(disableSms)을 끄고, 승인된 전용 템플릿
   (SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID)이 없으면 아예 보내지 않고 이유를 돌려줍니다.
   ※ 기존 "출발 7일 전" 가이드북 템플릿을 그대로 쓰시려면 그 템플릿 ID를
      SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID에 넣으시면 됩니다(코드 수정 불필요). */
export async function notifyCustomerTravelNotice(env, { phone, name, depart, requestUrl }) {
  const templateId = travelNoticeTemplateId(env);
  if (!templateId) return SKIP("travel notice kakao template not set");
  if (!pfId(env)) return SKIP("SOLAPI_PF_ID not set");
  if (!isPhone(normPhone(phone))) return SKIP("invalid phone");

  return sendKakaoAlimtalk(env, {
    phone,
    templateId,
    disableSms: true,          // 알림톡이 실패해도 문자로 대체하지 않습니다
    variables: {
      "#{고객명}": name || "고객",
      "#{출발일}": String(depart || ""),
      "#{회사명}": company(env),
      "#{링크}": GUIDEBOOK_PATH,
    },
    // 버튼은 승인된 템플릿의 버튼(https://mongolia-milkyway.com/#{링크})을 그대로 사용합니다.
    // 견적·일정표·가이드북 템플릿과 같은 방식이며, API로 버튼을 새로 만들면
    // 승인 내용과 달라져 반려될 수 있습니다.
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
