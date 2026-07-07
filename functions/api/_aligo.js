/* ═══════════════════════════════════════════════════════════
   알리고(Aligo) 카카오 알림톡 발송 헬퍼
   ---------------------------------------------------------------
   · 파일명이 _ 로 시작하므로 URL 라우팅에서 제외됩니다 (내부 모듈 전용).
   · Cloudflare 환경변수 5개가 모두 있어야 발송하고, 하나라도 없으면
     조용히 건너뜁니다({skipped:true}) → 키 등록 전에도 배포 안전.

   필요한 환경변수 (Cloudflare Pages → inhasu → Settings → Environment variables):
     ALIGO_API_KEY     알리고 API 키
     ALIGO_USER_ID     알리고 아이디
     ALIGO_SENDER_KEY  카카오 발신프로필 Sender Key
     ALIGO_SENDER      등록된 발신 전화번호 (SMS 대체발송용)
     ALIGO_TPL_CODE    승인된 알림톡 템플릿 코드
   선택:
     ALIGO_TPL_TEXT    승인 템플릿 원문(#{고객명}, #{링크} 포함) — 기본 문안과
                       다르게 승인받았을 때만 설정
     ALIGO_TPL_BUTTON  템플릿에 버튼이 있으면 그 버튼 JSON (알리고 문서 형식)
   ═══════════════════════════════════════════════════════════ */

// 알리고에 등록 신청할 기본 템플릿 문안 — 승인받은 원문과 완전히 같아야 발송됩니다.
const DEFAULT_TPL = `[몽골리아 은하수] 견적 요청 접수 완료

#{고객명}님, 견적 요청이 정상 접수되었습니다.
담당자가 확인 후 맞춤 견적서를 준비해 드릴게요.

▶ 내 견적 확인: #{링크}`;

export async function sendAlimtalk(env, { name, phone, link }) {
  const need = ["ALIGO_API_KEY", "ALIGO_USER_ID", "ALIGO_SENDER_KEY", "ALIGO_SENDER", "ALIGO_TPL_CODE"];
  if (need.some(k => !env[k])) return { ok: false, skipped: true, reason: "aligo env not set" };
  if (!phone || !/^[0-9]{9,11}$/.test(phone)) return { ok: false, skipped: true, reason: "invalid phone" };

  const tpl = env.ALIGO_TPL_TEXT || DEFAULT_TPL;
  const msg = tpl.replaceAll("#{고객명}", name || "고객").replaceAll("#{링크}", link || "");

  const form = new FormData();
  form.set("apikey", env.ALIGO_API_KEY);
  form.set("userid", env.ALIGO_USER_ID);
  form.set("senderkey", env.ALIGO_SENDER_KEY);
  form.set("tpl_code", env.ALIGO_TPL_CODE);
  form.set("sender", env.ALIGO_SENDER);
  form.set("receiver_1", phone);
  form.set("subject_1", "견적 접수 안내");
  form.set("message_1", msg);
  // 알림톡 실패(카톡 미사용·채널 차단 등) 시 같은 내용을 SMS/LMS로 대체 발송
  form.set("failover", "Y");
  form.set("fsubject_1", "견적 접수 안내");
  form.set("fmessage_1", msg);
  if (env.ALIGO_TPL_BUTTON) form.set("button_1", env.ALIGO_TPL_BUTTON);

  const r = await fetch("https://kakaoapi.aligo.in/akv10/alimtalk/send/", { method: "POST", body: form });
  const j = await r.json().catch(() => ({ code: -1, message: "invalid response" }));
  // 알리고 성공 응답: { code: 0, message: "성공적으로 전송요청 하였습니다." }
  return { ok: j.code === 0, ...j };
}
