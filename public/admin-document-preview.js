/* Ephemeral, administrator-only preview transport. Never reads or writes draft storage. */
export async function receiveAdminDocumentPreview(params, surface = window) {
  const nonce = params.get('adminDraft');
  if (!nonce || !/^[a-zA-Z0-9_-]{24,100}$/.test(nonce)) throw new Error('관리자 초안 미리보기 요청을 확인해 주세요.');
  const host = surface.parent && surface.parent !== surface ? surface.parent : surface.opener;
  if (!host) throw new Error('문서 편집 화면에서 초안 미리보기를 다시 열어 주세요.');
  const response = await surface.fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
  const account = response.ok ? await response.json() : null;
  if (account?.user?.role !== 'admin' || !account.user.id) throw new Error('관리자 로그인 후 초안을 미리볼 수 있습니다.');
  return new Promise((resolve, reject) => {
    const finish = () => { surface.removeEventListener('message', receive); surface.clearTimeout(timer); };
    const receive = event => {
      if (event.origin !== surface.location.origin || event.source !== host || event.data?.type !== 'inhasu-admin-preview-content' || event.data.nonce !== nonce) return;
      const quote = event.data.quote;
      if (!quote || quote.source !== 'product' || !Array.isArray(quote.days) || !Array.isArray(quote.detailDays)) return;
      finish(); resolve(quote);
    };
    const timer = surface.setTimeout(() => { finish(); reject(new Error('초안을 받지 못했습니다. 편집 화면에서 다시 열어 주세요.')); }, 12000);
    surface.addEventListener('message', receive);
    host.postMessage({ type: 'inhasu-admin-preview-ready', nonce, userId: account.user.id }, surface.location.origin);
  });
}
