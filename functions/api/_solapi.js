/* ═══════════════════════════════════════════════════════════
   Solapi(쿨SMS) 카카오 알림톡 발송 헬퍼
   ---------------------------------------------------------------
   · 파일명이 _ 로 시작하므로 URL 라우팅에서 제외됩니다 (내부 모듈 전용).
   · IP 제한이 없어 Cloudflare(가변 IP)에서 바로 호출 가능 (HMAC 서명 인증).
   · 환경변수 4개(+발신번호)가 모두 있어야 발송, 없으면 조용히 건너뜁니다.
   · 템플릿 본문은 Solapi가 승인본으로 채우므로 변수 값만 보내면 됨
     (알리고처럼 본문 전체를 똑같이 재현할 필요 없음).

   ── "맞춤여행접수" 템플릿용 (고객이 견적요청한 순간) ──
   템플릿 변수: #{고객명}, #{회사명}

   필요한 환경변수 (Cloudflare Pages → inhasu → Settings → Environment variables):
     SOLAPI_API_KEY      Solapi API Key
     SOLAPI_API_SECRET   Solapi API Secret
     SOLAPI_PF_ID        연동된 카카오 채널 pfId
     SOLAPI_TEMPLATE_ID  승인된 "맞춤여행접수" 템플릿 ID
     SOLAPI_SENDER       등록된 발신 전화번호 (SMS 대체발송용, 숫자만)
   선택:
     NOTIFY_COMPANY      #{회사명} 값 (기본: "몽골리아 은하수 여행사")
     SOLAPI_DISABLE_SMS  "Y"면 SMS 대체발송 끔 (기본: 대체발송 함)
   ═══════════════════════════════════════════════════════════ */

async function hmacHex(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function sendAlimtalk(env, { name, phone }) {
  const need = ["SOLAPI_API_KEY", "SOLAPI_API_SECRET", "SOLAPI_PF_ID", "SOLAPI_TEMPLATE_ID"];
  if (need.some(k => !env[k])) return { ok: false, skipped: true, reason: "solapi env not set" };

  const tel = String(phone || "").replace(/[^0-9]/g, "");
  if (!/^0[0-9]{8,10}$/.test(tel)) return { ok: false, skipped: true, reason: "invalid phone" };

  // HMAC-SHA256 서명 인증 (IP 등록 불필요)
  const date = new Date().toISOString();
  const salt = crypto.randomUUID().replace(/-/g, "");
  const signature = await hmacHex(env.SOLAPI_API_SECRET, date + salt);

  const message = {
    to: tel,
    from: String(env.SOLAPI_SENDER || "").replace(/[^0-9]/g, "") || undefined,
    kakaoOptions: {
      pfId: env.SOLAPI_PF_ID,
      templateId: env.SOLAPI_TEMPLATE_ID,
      // 변수만 보내면 Solapi가 승인 템플릿 본문에 채워서 발송
      variables: {
        "#{고객명}": name || "고객",
        "#{회사명}": env.NOTIFY_COMPANY || "몽골리아 은하수 여행사",
      },
      disableSms: env.SOLAPI_DISABLE_SMS === "Y",   // 기본: 실패 시 SMS 대체발송
    },
  };

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
