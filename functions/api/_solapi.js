/* ═══════════════════════════════════════════════════════════
   Solapi(쿨SMS) 관리자 문자 발송 헬퍼
   ---------------------------------------------------------------
   · 파일명이 _ 로 시작하므로 URL 라우팅에서 제외됩니다 (내부 모듈 전용).
   · IP 제한이 없어 Cloudflare(가변 IP)에서 바로 호출 가능 (HMAC 서명 인증).
   · 환경변수가 없으면 조용히 건너뜁니다 — 발송 실패가 저장을 막지 않습니다.
   · 고객 카카오 알림톡은 모두 제거했습니다 — 고객 안내는 페이지(내견적)에서 직접 표시하고,
     개별 연락은 카카오톡 채널에서 수동으로 합니다. 남은 발송은 "관리자 문자"뿐입니다.

   ── 환경변수 (Cloudflare Pages → Settings → Environment variables) ──
   공통 (없으면 문자 발송 건너뜀)
     SOLAPI_API_KEY          Solapi API Key
     SOLAPI_API_SECRET       Solapi API Secret
     SOLAPI_SENDER           등록된 발신 전화번호 (숫자만)

   관리자 알림 (문자 — 템플릿 승인 불필요)
     ADMIN_PHONE             관리자 휴대폰. 쉼표로 여러 명 가능 (예: 01011112222,01033334444)
   ═══════════════════════════════════════════════════════════ */

const SKIP = reason => ({ ok: false, skipped: true, reason });

const normPhone = p => String(p || "").replace(/[^0-9]/g, "");
const isPhone = tel => /^0[0-9]{8,10}$/.test(tel);
const sender = env => normPhone(env.SOLAPI_SENDER) || undefined;

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
