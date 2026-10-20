/* Customer document links keep their original URL, but never authorize access by themselves. */
export function safeCustomerReturnPath(value, fallback = '/mypage/estimates', allowLinking = false) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
    const parsed = new URL(value, 'https://customer.invalid');
    if (parsed.origin !== 'https://customer.invalid' || /^\/login(?:\/|$)/.test(parsed.pathname) || (!allowLinking && /^\/customer-link(?:\/|$)/.test(parsed.pathname))) return fallback;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch { return fallback; }
}

export const customerLoginPath = returnTo => '/login?returnTo=' + encodeURIComponent(safeCustomerReturnPath(returnTo));
export function customerLinkPath(source, key, returnTo) {
  return '/customer-link?' + new URLSearchParams({ source, key, returnTo: safeCustomerReturnPath(returnTo) });
}

/** Accept only links from this site, including the older www/apex spelling. */
export function parseCustomerReference(value, origin) {
  const input = String(value || '').trim();
  if (!input || /[\\\u0000-\u001f\u007f]/.test(input)) return null;
  try {
    const base = new URL(origin);
    const url = new URL(input, base);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.host.replace(/^www\./, '') !== base.host.replace(/^www\./, '')) return null;
    const path = decodeURIComponent(url.pathname);
    const token = url.searchParams.get('t');
    if (token && token.length >= 16 && token.length <= 256 && /^\/(?:내견적|견적서(?:-모바일)?|확정일정표(?:-모바일)?|계약서|여행자정보|일정지도|확정안내)\.html$/.test(path)) {
      return { source: 'request', key: token, returnTo: url.pathname + url.search + url.hash };
    }
    const quote = path.match(/^\/estimate\/([^/]+)$/);
    const reservation = path.match(/^\/(?:mypage\/reservations|my-booking|documents\/(?:contract|itinerary))\/([^/]+)$/);
    if (quote || reservation) return { source: quote ? 'quote' : 'reservation', key: (quote || reservation)[1], returnTo: url.pathname + url.search + url.hash };
    return null;
  } catch { return null; }
}

const currentPath = surface => surface.location.pathname + surface.location.search + surface.location.hash;
const leave = (surface, path) => { surface.location.replace(path); return new Promise(() => {}); };
const legacyAdminChecks = new WeakMap();
const storedAdminToken = surface => {
  try { return surface.sessionStorage?.getItem('leaders_admin_token') || ''; } catch { return ''; }
};
/** A storage value is only a candidate; the server must verify it before use. */
async function verifiedLegacyAdminToken(surface) {
  const candidate = storedAdminToken(surface);
  if (!candidate) return '';
  const previous = legacyAdminChecks.get(surface);
  if (previous?.candidate === candidate) return previous.check;
  const check = (async () => {
    try {
      const response = await surface.fetch('/api/auth/legacy-admin/check', { method: 'POST', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: { 'x-admin-token': candidate } });
      const result = response.ok ? await response.json() : null;
      return result?.ok === true && result.legacyAdmin === true && storedAdminToken(surface) === candidate ? candidate : '';
    } catch { return ''; }
  })();
  legacyAdminChecks.set(surface, { candidate, check });
  return check;
}
const legacyCustomerApi = (input, surface) => {
  try {
    const base = surface.location?.href || surface.location?.origin || 'https://customer.invalid';
    const url = new URL(typeof Request !== 'undefined' && input instanceof Request ? input.url : String(input), base);
    return url.origin === new URL(base).origin && /^\/api\/(?:my|travelers|sign|deposit)\/[a-zA-Z0-9_-]+$/.test(url.pathname);
  } catch { return false; }
};

/** A failed check stops the document before any customer details are rendered. */
export async function requireCustomerAccess(source, key, surface = window) {
  if (!key) throw new Error('담당자에게 받은 고객 전용 링크를 확인해 주세요.');
  const adminToken = source === 'request' ? await verifiedLegacyAdminToken(surface) : '';
  const response = await surface.fetch('/api/customer-access/status?' + new URLSearchParams({ source, key }), { credentials: 'same-origin', cache: 'no-store', ...(adminToken ? { headers: { 'x-admin-token': adminToken }, redirect: 'error' } : {}) });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401) return leave(surface, customerLoginPath(currentPath(surface)));
  if (response.ok && result.state === 'linked') return true;
  if ((response.ok && ['verification_required', 'unavailable'].includes(result.state)) || result.code === 'claim_required') return leave(surface, customerLinkPath(source, key, currentPath(surface)));
  throw new Error(result.code === 'access_denied' ? '이 이력은 다른 계정에 연결되어 있습니다. 처음 연결한 Google 계정으로 로그인하거나 담당자에게 문의해 주세요.' : '연결할 이력을 확인할 수 없습니다. 담당자에게 문의해 주세요.');
}

/** Static documents have no React error boundary; show an actionable, private-data-free state. */
export async function requireCustomerDocumentAccess(source, key, surface = window) {
  try { return await requireCustomerAccess(source, key, surface); }
  catch (failure) {
    const doc = surface.document;
    const main = doc.createElement('main');
    main.style.cssText = 'max-width:520px;margin:64px auto;padding:28px;font-family:system-ui,sans-serif;color:#0A1F2E;line-height:1.8';
    const heading = doc.createElement('h1'); heading.textContent = '고객 이력을 확인할 수 없습니다'; heading.style.fontSize = '22px';
    const message = doc.createElement('p'); message.textContent = failure.message || '인터넷 연결을 확인하고 잠시 후 다시 시도해 주세요.';
    const back = doc.createElement('a'); back.href = '/mypage/estimates'; back.textContent = '내 견적 내역으로'; back.style.cssText = 'display:block;color:#1C8571;font-weight:700;margin-top:20px';
    const support = doc.createElement('a'); support.href = 'https://pf.kakao.com/_BSLaxl'; support.textContent = '카카오톡으로 문의하기'; support.rel = 'noopener noreferrer'; support.style.cssText = 'display:block;color:#1C8571;margin-top:10px';
    main.append(heading, message, back, support); doc.body.replaceChildren(main);
    return new Promise(() => {});
  }
}

/** Editor storage is private even after logout; query flags never grant editor access. */
export async function requireAdminDocumentAccess(surface = window) {
  if (await verifiedLegacyAdminToken(surface)) return true;
  try {
    const response = await surface.fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    const result = response.ok ? await response.json() : null;
    if (result?.user?.role === 'admin' && result.user.id) return true;
  } catch { /* An unavailable session check cannot open editor storage. */ }
  const doc = surface.document;
  const main = doc.createElement('main'); main.style.cssText = 'max-width:520px;margin:64px auto;padding:28px;font-family:system-ui,sans-serif;color:#0A1F2E;line-height:1.8';
  const heading = doc.createElement('h1'); heading.textContent = '관리자 로그인이 필요합니다'; heading.style.fontSize = '22px';
  const message = doc.createElement('p'); message.textContent = '문서 편집기 미리보기는 관리자 로그인 후 열 수 있습니다. 고객님은 담당자에게 받은 전용 링크로 접속해 주세요.';
  const login = doc.createElement('a'); login.href = '/admin/login'; login.textContent = '관리자 로그인'; login.style.cssText = 'display:block;color:#1C8571;font-weight:700;margin-top:20px';
  const back = doc.createElement('a'); back.href = '/mypage/estimates'; back.textContent = '내 견적 내역으로'; back.style.cssText = 'display:block;color:#1C8571;margin-top:10px';
  main.append(heading, message, login, back); doc.body.replaceChildren(main);
  return new Promise(() => {});
}

/** Also catches a session that expires after the document was first opened. */
export async function customerDocumentFetch(input, options, reference, surface = window) {
  const adminToken = legacyCustomerApi(input, surface) ? await verifiedLegacyAdminToken(surface) : '';
  const requestOptions = { credentials: 'same-origin', ...options };
  if (adminToken) {
    const headers = new Headers(options?.headers || (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined));
    headers.set('x-admin-token', adminToken);
    requestOptions.headers = headers;
    // Never forward the legacy credential through a provider or cross-origin redirect.
    requestOptions.redirect = 'error';
  }
  const response = await surface.fetch(input, requestOptions);
  if (response.status === 401) return leave(surface, customerLoginPath(currentPath(surface)));
  if (response.status === 403 && reference) {
    const result = await response.clone().json().catch(() => ({}));
    if (result.code === 'claim_required') return leave(surface, customerLinkPath(reference.source, reference.key, currentPath(surface)));
  }
  return response;
}
