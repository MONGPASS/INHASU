/* ═══════════════════════════════════════════════════════════
   알리고(Aligo) 카카오 알림톡 발송 헬퍼
   ---------------------------------------------------------------
   · 파일명이 _ 로 시작하므로 URL 라우팅에서 제외됩니다 (내부 모듈 전용).
   · 환경변수 5개가 모두 있어야 발송하고, 하나라도 없으면 조용히
     건너뜁니다({skipped:true}) → 키 등록 전에도 배포 안전.

   ── 이 발송은 "맞춤여행접수" 템플릿용 (고객이 견적요청한 순간) ──
   승인 템플릿 변수: #{고객명}, #{회사명}  (링크 없음, 버튼 "상담원 연결" 1개)

   필요한 환경변수 (Cloudflare Pages → inhasu → Settings → Environment variables):
     ALIGO_API_KEY     알리고 API 키
     ALIGO_USER_ID     알리고 아이디
     ALIGO_SENDER_KEY  카카오 발신프로필 Sender Key
     ALIGO_SENDER      등록된 발신 전화번호 (SMS 대체발송용, 숫자만)
     ALIGO_TPL_CODE    "맞춤여행접수" 템플릿 코드  ← 접수 알림이므로 이 템플릿!
   선택(값 있으면 사용):
     ALIGO_COMPANY     #{회사명} 자리에 넣을 상호 (기본: "몽골리아 은하수 여행사")
     ALIGO_TPL_TEXT    승인 템플릿 본문과 글자가 다르면 여기에 정확한 원문 붙여넣기
                       (#{고객명}, #{회사명} 포함) — 코드 수정 없이 문구 교정용
     ALIGO_BUTTON      템플릿 버튼 JSON을 직접 넘겨야 할 때 (알리고 button 형식)
     ALIGO_FAILOVER    "Y"면 알림톡 실패 시 같은 내용 SMS 대체발송 (기본: 안 함)
   ═══════════════════════════════════════════════════════════ */

// "맞춤여행접수" 승인 템플릿 본문 — 실제 승인본과 글자가 다르면 ALIGO_TPL_TEXT로 교정.
const DEFAULT_TPL = `안녕하세요. #{고객명}님!
#{회사명}입니다.

#{회사명}에 몽골 맞춤 여행을 요청해 주셔서 연락드렸습니다. 요청하신 내역으로 열심히 만드는 중입니다.

몽골 여행과 관련해서 문의 사항 있으시면 언제든지 상담원과 연락을 해 주시면 친절하게 안내를 도와 드리겠습니다.`;

export async function sendAlimtalk(env, { name, phone }) {
  const need = ["ALIGO_API_KEY", "ALIGO_USER_ID", "ALIGO_SENDER_KEY", "ALIGO_SENDER", "ALIGO_TPL_CODE"];
  if (need.some(k => !env[k])) return { ok: false, skipped: true, reason: "aligo env not set" };

  const tel = String(phone || "").replace(/[^0-9]/g, "");
  if (!/^0[0-9]{8,10}$/.test(tel)) return { ok: false, skipped: true, reason: "invalid phone" };

  const company = env.ALIGO_COMPANY || "몽골리아 은하수 여행사";
  const tpl = env.ALIGO_TPL_TEXT || DEFAULT_TPL;
  const msg = tpl.replaceAll("#{고객명}", name || "고객").replaceAll("#{회사명}", company);

  const form = new FormData();
  form.set("apikey", env.ALIGO_API_KEY);
  form.set("userid", env.ALIGO_USER_ID);
  form.set("senderkey", env.ALIGO_SENDER_KEY);
  form.set("tpl_code", env.ALIGO_TPL_CODE);
  form.set("sender", env.ALIGO_SENDER);
  form.set("receiver_1", tel);
  form.set("subject_1", "맞춤여행 접수");
  form.set("message_1", msg);
  if (env.ALIGO_BUTTON) form.set("button_1", env.ALIGO_BUTTON);
  // 대체 발송(SMS)은 기본 꺼둠 — 발신번호 SMS 승인 확인 후 ALIGO_FAILOVER=Y로 켜기
  if (env.ALIGO_FAILOVER === "Y") {
    form.set("failover", "Y");
    form.set("fsubject_1", "맞춤여행 접수");
    form.set("fmessage_1", msg);
  }

  const r = await fetch("https://kakaoapi.aligo.in/akv10/alimtalk/send/", { method: "POST", body: form });
  const j = await r.json().catch(() => ({ code: -1, message: "invalid response" }));
  // 성공: { code: 0, message: "성공적으로 전송요청 하였습니다." }
  return { ok: j.code === 0, ...j };
}
