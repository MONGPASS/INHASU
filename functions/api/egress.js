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

export async function onRequestGet() {
  const [identV4, amazon, aligoA, aligoAAAA] = await Promise.all([
    fetchText("https://v4.ident.me"),               // IPv4 전용 에코
    fetchText("https://checkip.amazonaws.com"),     // AWS 에코 (듀얼스택일 수 있음)
    dohA("kakaoapi.aligo.in", "A"),                 // 알리고 서버의 IPv4
    dohA("kakaoapi.aligo.in", "AAAA"),              // 알리고 서버의 IPv6 (없어야 정상)
  ]);
  return new Response(JSON.stringify({
    "IPv4전용에코(v4.ident.me)": identV4,
    "아마존에코": amazon,
    "알리고서버_A(IPv4)": aligoA,
    "알리고서버_AAAA(IPv6)": aligoAAAA,
  }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}
