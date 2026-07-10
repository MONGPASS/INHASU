/* ═══════════════════════════════════════════════════════════
   Solapi(쿨SMS) 카카오 알림톡 · 문자 발송 헬퍼
   ---------------------------------------------------------------
   · 파일명이 _ 로 시작하므로 URL 라우팅에서 제외됩니다 (내부 모듈 전용).
   · IP 제한이 없어 Cloudflare(가변 IP)에서 바로 호출 가능 (HMAC 서명 인증).
   · 환경변수가 없으면 조용히 건너뜁니다 — 발송 실패가 저장을 막지 않습니다.
   · 알림톡 본문은 Solapi가 승인본으로 채우므로 변수 값만 보내면 됩니다.

   ── 환경변수 (Cloudflare Pages → inhasu → Settings → Environment variables) ──
   공통 (없으면 알림톡·문자 모두 건너뜀)
     SOLAPI_API_KEY          Solapi API Key
     SOLAPI_API_SECRET       Solapi API Secret
     SOLAPI_SENDER           등록된 발신 전화번호 (숫자만) — 문자·대체발송용

   고객 알림톡 (각각 카카오 승인을 받은 템플릿 ID)
     SOLAPI_PF_ID            연동된 카카오 채널 pfId
     SOLAPI_TEMPLATE_ID      "맞춤여행접수"  — 고객이 견적요청한 순간
     SOLAPI_TEMPLATE_QUOTE_ID    "견적서 도착"  — 관리자가 견적을 발행한 순간
     SOLAPI_TEMPLATE_CONFIRM_ID  "예약 확정"    — 예약이 확정된 순간
     ※ 위 두 템플릿이 없으면 해당 발송만 조용히 건너뜁니다 (나머지는 정상 동작).

   관리자 알림 (문자 — 템플릿 승인 불필요)
     ADMIN_PHONE             관리자 휴대폰. 쉼표로 여러 명 가능 (예: 01011112222,01033334444)

   선택
     NOTIFY_COMPANY          #{회사명} 값 (기본: "몽골리아 은하수 여행사")
     SITE_URL                고객 링크 도메인 (기본: 요청이 들어온 origin)
     SOLAPI_DISABLE_SMS      "Y"면 알림톡 실패 시 SMS 대체발송 끔 (기본: 대체발송 함)
   ═══════════════════════════════════════════════════════════ */

const SKIP = reason => ({ ok: false, skipped: true, reason });

const normPhone = p => String(p || "").replace(/[^0-9]/g, "");
const isPhone = tel => /^0[0-9]{8,10}$/.test(tel);
const sender = env => normPhone(env.SOLAPI_SENDER) || undefined;
const company = env => env.NOTIFY_COMPANY || "몽골리아 은하수 여행사";

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/* Solapi 단건 발송 (알림톡·문자 공통). HMAC-SHA256 서명 인증 → IP 등록 불필요. */
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

/* 승인된 알림톡 템플릿으로 발송.
   smsText 를 주면 알림톡 실패 시 그 문구로 문자 대체발송됩니다 (비우면 템플릿 본문이 쓰입니다). */
export async function sendAlimtalkTemplate(env, { templateId, phone, variables, smsText }) {
  if (!templateId) return SKIP("template id not set");
  if (!env.SOLAPI_PF_ID) return SKIP("SOLAPI_PF_ID not set");

  const tel = normPhone(phone);
  if (!isPhone(tel)) return SKIP("invalid phone");

  const disableSms = env.SOLAPI_DISABLE_SMS === "Y";   // 기본: 실패 시 SMS 대체발송
  const message = {
    to: tel,
    from: sender(env),
    kakaoOptions: { pfId: env.SOLAPI_PF_ID, templateId, variables, disableSms },
  };
  if (!disableSms && smsText) message.text = String(smsText).slice(0, 1000);

  return solapiSend(env, message);
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

/* ── 고객 링크 ──
   내견적 허브 한 곳에서 견적서·계약서·확정일정표가 모두 열립니다.

   알림톡 버튼(WL)의 링크에 변수를 쓰려면 프로토콜·도메인이 템플릿에 고정돼 있어야 하고,
   변수는 그 뒤 경로만 채울 수 있습니다. 템플릿에는 이렇게 등록합니다:
       https://mongolia-milkyway.com/#{링크}
   따라서 #{링크} 에는 전체 URL이 아니라 경로만 넣습니다 → customerPath()
   반대로 SMS 대체발송 문구에는 눌러서 열 수 있는 전체 URL이 필요합니다 → customerLink() */

export function customerPath(token) {
  return `${encodeURI("내견적.html")}?t=${encodeURIComponent(token)}`;
}

export function customerLink(env, origin, token) {
  const base = String(env.SITE_URL || origin || "").replace(/\/+$/, "");
  return `${base}/${customerPath(token)}`;
}

/* 고객용 알림톡 공통 — 버튼 링크 변수(경로)와 SMS 대체발송 문구(전체 URL)를 함께 실어 보냅니다. */
async function sendCustomer(env, { templateId, name, phone, origin, token, smsText }) {
  return sendAlimtalkTemplate(env, {
    templateId,
    phone,
    variables: {
      "#{고객명}": name || "고객",
      "#{회사명}": company(env),
      "#{링크}": token ? customerPath(token) : "",
    },
    // 알림톡 발송이 실패했을 때 문자로 대체발송되는 내용. 버튼이 없으므로 전체 주소를 본문에 넣습니다.
    smsText: smsText && token ? `${smsText}\n${customerLink(env, origin, token)}` : smsText,
  });
}

/* ── 발송 시점별 래퍼 ── */

/* ① 고객이 견적요청을 접수한 순간 → 고객 ("맞춤여행접수") */
export async function sendAlimtalk(env, { name, phone, origin, token }) {
  return sendCustomer(env, {
    templateId: env.SOLAPI_TEMPLATE_ID,
    name, phone, origin, token,
    smsText: `[${company(env)}] ${name || "고객"}님, 견적 요청이 접수되었습니다. 빠르게 견적서를 보내드립니다.`,
  });
}

/* ② 관리자가 견적서를 발행한 순간 → 고객 ("견적서 도착") */
export async function sendQuoteReady(env, { name, phone, origin, token }) {
  return sendCustomer(env, {
    templateId: env.SOLAPI_TEMPLATE_QUOTE_ID,
    name, phone, origin, token,
    smsText: `[${company(env)}] ${name || "고객"}님, 요청하신 견적서가 준비되었습니다. 아래 링크에서 확인해 주세요.`,
  });
}

/* ③ 예약이 확정된 순간 → 고객 ("예약 확정") */
export async function sendBookingConfirmed(env, { name, phone, origin, token }) {
  return sendCustomer(env, {
    templateId: env.SOLAPI_TEMPLATE_CONFIRM_ID,
    name, phone, origin, token,
    smsText: `[${company(env)}] ${name || "고객"}님, 예약이 확정되었습니다. 확정 일정표를 아래 링크에서 확인해 주세요.`,
  });
}
