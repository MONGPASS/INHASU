/* ═══════════════════════════════════════════════════════════
   발송 서버 IP 진단용 (임시 · 공개) · /api/egress
   ---------------------------------------------------------------
   · Cloudflare 서버가 외부(특히 IPv4 전용 사이트)로 나갈 때 쓰는
     IP를 여러 서비스로 교차 확인. 알리고 IP 등록값 파악용.
   · 비밀정보 없음(서버 공인 IP만 표시). 원인 파악 후 삭제 예정.
   ═══════════════════════════════════════════════════════════ */

const fetchText = async (url) => {
  try {
    const r = await fetch(url, { headers: { "User-Agent": "curl/8" } });
    return (await r.text()).trim().slice(0, 80);
  } catch (e) { return "실패: " + String(e).slice(0, 60); }
};

const dohA = async (name, type) => {
  try {
    const r = await fetch(`https://dns.google/resolve?name=${name}&type=${type}`);
    const j = await r.json();
    return (j.Answer || []).map(a => a.data);
  } catch (e) { return ["실패"]; }
};

// IP 인증 통과 여부만 확인 — 실제 계정(서버 환경변수)으로 호출하되 수신자를
// 비워서 절대 발송되지 않게 함. 응답에는 오류 코드/메시지만 담김(비밀값 노출 없음).
// · IP가 막혀 있으면: "인증되지 않는 서버 IP..." 메시지
// · IP는 통과했으면: 수신자/템플릿 관련 다른 오류 → IP 등록이 먹혔다는 뜻
const aligoIpProbe = async (env) => {
  if (!env.ALIGO_API_KEY || !env.ALIGO_USER_ID) return { skipped: "env 미설정" };
  try {
    const form = new FormData();
    form.set("apikey", env.ALIGO_API_KEY);
    form.set("userid", env.ALIGO_USER_ID);
    form.set("senderkey", env.ALIGO_SENDER_KEY || "");
    form.set("tpl_code", (env.ALIGO_TPL_CODE || "").split(",")[0].trim());
    form.set("sender", env.ALIGO_SENDER || "");
    // receiver_1 없음 → 인증을 다 통과해도 "수신자 없음"류 오류로 끝남 (발송 0건)
    const r = await fetch("https://kakaoapi.aligo.in/akv10/alimtalk/send/", { method: "POST", body: form });
    const j = await r.json().catch(() => ({}));
    const ipBlocked = /서버 IP/.test(j.message || "");
    return { code: j.code, message: j.message, IP차단여부: ipBlocked ? "차단됨" : "통과!" };
  } catch (e) { return { error: String(e).slice(0, 80) }; }
};

export async function onRequestGet({ env }) {
  const [identV4, aligoA, aligoAAAA, probe] = await Promise.all([
    fetchText("https://v4.ident.me"),               // IPv4 전용 에코
    dohA("kakaoapi.aligo.in", "A"),                 // 알리고 서버의 IPv4
    dohA("kakaoapi.aligo.in", "AAAA"),              // 알리고 서버의 IPv6 (없어야 정상)
    aligoIpProbe(env),
  ]);
  return new Response(JSON.stringify({
    "IPv4전용에코(v4.ident.me)": identV4,
    "알리고서버_A(IPv4)": aligoA,
    "알리고서버_AAAA(IPv6)": aligoAAAA,
    "알리고IP인증프로브": probe,
  }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
