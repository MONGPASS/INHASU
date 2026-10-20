import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { safeCustomerReturnPath, customerLoginPath, customerLinkPath, parseCustomerReference, requireCustomerAccess, requireAdminDocumentAccess, customerDocumentFetch } from '../public/customer-access.js';

const token = 'synthetic-customer-token-1234';
const path = `/내견적.html?t=${token}#progress`;
const surfaceFor = (body, status = 200) => {
  const redirects = [], calls = [];
  const surface = {
    location: { pathname: '/내견적.html', search: `?t=${token}`, hash: '#progress', replace: value => redirects.push(value) },
    fetch: async (url, options) => { calls.push({ url, options }); return Response.json(body, { status }); },
  };
  return { surface, redirects, calls };
};
const tick = () => new Promise(resolve => setImmediate(resolve));

test('login return paths preserve Korean customer links and reject external/control/backslash redirects', () => {
  assert.equal(decodeURI(safeCustomerReturnPath(path)), path);
  assert.equal(new URL(customerLoginPath(path), 'https://site.test').searchParams.get('returnTo'), safeCustomerReturnPath(path));
  assert.equal(safeCustomerReturnPath('/customer-link?source=request&key=old', '', true), '/customer-link?source=request&key=old');
  assert.equal(safeCustomerReturnPath('/customer-link?key=%5cevil', '', true), '');
  for (const value of ['https://other.invalid', '//other.invalid', '/\\other.invalid', '/%5cevil', '/%2fother.invalid', '/%0anext', '/login', '/customer-link?key=old', 'javascript:alert(1)', '/\nnext']) {
    assert.equal(safeCustomerReturnPath(value), '/mypage/estimates', value);
  }
});

test('pasted historical links accept own-site documents only and never accept an arbitrary recipient', () => {
  const origin = 'https://inhasu.com';
  for (const document of ['내견적', '견적서', '견적서-모바일', '확정일정표', '확정일정표-모바일', '계약서', '여행자정보', '일정지도', '확정안내']) {
    const reference = parseCustomerReference(`${origin}/${document}.html?t=${token}`, origin);
    assert.equal(reference.source, 'request', document); assert.equal(reference.key, token);
  }
  assert.equal(parseCustomerReference(`https://www.inhasu.com/내견적.html?t=${token}`, origin).source, 'request');
  assert.equal(parseCustomerReference('/estimate/quote-one', origin).source, 'quote');
  assert.equal(parseCustomerReference('/documents/contract/booking-one', origin).source, 'reservation');
  for (const value of [`https://outside.invalid/내견적.html?t=${token}`, `//outside.invalid/내견적.html?t=${token}`, `https://user@inhasu.com/내견적.html?t=${token}`, '/admin/quotes', 'javascript:alert(1)', '/내견적.html?t=short']) assert.equal(parseCustomerReference(value, origin), null, value);
});

test('linked customer access checks the server with credentials and permits rendering', async () => {
  const { surface, redirects, calls } = surfaceFor({ ok: true, state: 'linked' });
  assert.equal(await requireCustomerAccess('request', token, surface), true);
  assert.deepEqual(redirects, []); assert.equal(calls.length, 1);
  assert.equal(calls[0].options.credentials, 'same-origin'); assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(new URL(calls[0].url, 'https://site.test').searchParams.get('key'), token);
});

test('anonymous and unclaimed documents stop before rendering and keep the exact return document', async () => {
  for (const [body, status, expected] of [
    [{ code: 'login_required' }, 401, customerLoginPath(path)],
    [{ ok: true, state: 'verification_required' }, 200, customerLinkPath('request', token, path)],
    [{ ok: true, state: 'unavailable' }, 200, customerLinkPath('request', token, path)],
  ]) {
    const { surface, redirects } = surfaceFor(body, status);
    let rendered = false;
    void requireCustomerAccess('request', token, surface).then(() => { rendered = true; });
    await tick();
    assert.deepEqual(redirects, [expected]); assert.equal(rendered, false);
  }
});

test('another owner and missing records fail closed without starting a claim challenge', async () => {
  for (const [body, status] of [[{ code: 'access_denied' }, 403], [{ error: 'not found' }, 404]]) {
    const { surface, redirects, calls } = surfaceFor(body, status);
    await assert.rejects(requireCustomerAccess('request', token, surface));
    assert.deepEqual(redirects, []); assert.equal(calls.length, 1); assert.match(calls[0].url, /\/status\?/);
  }
});

test('an expired session on a customer write redirects to login and never retries the write', async () => {
  const { surface, redirects, calls } = surfaceFor({ code: 'login_required' }, 401);
  let continued = false;
  void customerDocumentFetch('/api/sign/' + token, { method: 'POST', body: '{}' }, { source: 'request', key: token }, surface).then(() => { continued = true; });
  await tick(); assert.deepEqual(redirects, [customerLoginPath(path)]); assert.equal(continued, false);
  assert.equal(calls.length, 1); assert.equal(calls[0].options.method, 'POST');
});

test('all token-based customer documents gate reads and have no localhost private-record bypass', () => {
  for (const name of ['내견적', '견적서', '견적서-모바일', '확정일정표', '확정일정표-모바일', '계약서', '여행자정보', '일정지도', '확정안내']) {
    const html = fs.readFileSync(new URL(`../public/${name}.html`, import.meta.url), 'utf8');
    assert.match(html, /from "\/customer-access\.js"/, name);
    assert.match(html, /await requireCustomerAccess\('request', (?:_token|token)\)/, name);
    assert.doesNotMatch(html, /localStorage\.(?:getItem|setItem)\("leaders_requests"/, name);
    assert.doesNotMatch(html, /\bfetch\("\/api\/(?:my|travelers|sign|deposit)\//, name);
  }
});

test('editor document storage requires a real administrator session even with preview query flags', async () => {
  const node = () => ({ style: {}, append() {} });
  for (const user of [null, { id: 'customer', role: 'user' }, { role: 'admin' }]) {
    let checked = false, replaced = false, opened = false;
    const surface = { location: { search: '?preview=1&adminPrint=1' }, document: { createElement: node, body: { replaceChildren() { replaced = true; } } },
      fetch: async (url, options) => { checked = true; assert.equal(url, '/api/auth/me'); assert.equal(options.cache, 'no-store'); return Response.json({ user }); } };
    void requireAdminDocumentAccess(surface).then(() => { opened = true; });
    await tick(); assert.equal(checked, true); assert.equal(replaced, true); assert.equal(opened, false);
  }
  assert.equal(await requireAdminDocumentAccess({ fetch: async () => Response.json({ user: { id: 'admin', role: 'admin' } }) }), true);
  for (const name of ['견적서', '견적서-모바일', '확정일정표', '확정일정표-모바일', '일정지도']) {
    const html = fs.readFileSync(new URL(`../public/${name}.html`, import.meta.url), 'utf8');
    const gate = html.indexOf('await requireAdminDocumentAccess()');
    assert.ok(gate > 0 && gate < html.indexOf('localStorage.getItem'), name);
  }
});

test('legacy mobile administrators can preview only after the server verifies their stored credential', async () => {
  const { surface, calls, redirects } = surfaceFor({ ok: true, state: 'linked' });
  surface.location.origin = 'https://site.test';
  surface.sessionStorage = { getItem: name => name === 'leaders_admin_token' ? 'verified-admin-fixture' : null };
  surface.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/legacy-admin/check') {
      assert.equal(options.method, 'POST'); assert.equal(options.credentials, 'same-origin');
      assert.equal(options.headers['x-admin-token'], 'verified-admin-fixture');
      return Response.json({ ok: true, legacyAdmin: true });
    }
    assert.equal(new Headers(options.headers).get('x-admin-token'), 'verified-admin-fixture');
    return Response.json({ ok: true, state: 'linked' });
  };
  assert.equal(await requireAdminDocumentAccess(surface), true);
  assert.equal(await requireCustomerAccess('request', token, surface), true);
  const response = await customerDocumentFetch('/api/my/' + token, { headers: { Accept: 'application/json' } }, { source: 'request', key: token }, surface);
  assert.equal(response.status, 200); assert.deepEqual(redirects, []);
  assert.equal(calls.filter(call => call.url === '/api/auth/legacy-admin/check').length, 1);
  const read = calls.at(-1); assert.equal(read.options.redirect, 'error'); assert.equal(read.options.headers.get('Accept'), 'application/json');
});

test('a forged stored administrator credential never opens a preview or reaches a customer API as an admin', async () => {
  const { surface, calls, redirects } = surfaceFor({ state: 'linked' });
  surface.sessionStorage = { getItem: () => 'forged-admin-fixture' };
  surface.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/legacy-admin/check') return Response.json({ ok: false }, { status: 401 });
    assert.equal(new Headers(options.headers).has('x-admin-token'), false);
    return Response.json({ ok: true, state: 'linked' });
  };
  assert.equal(await requireCustomerAccess('request', token, surface), true);
  await customerDocumentFetch('/api/my/' + token, {}, { source: 'request', key: token }, surface);
  assert.deepEqual(redirects, []); assert.equal(calls.length, 3);
  const node = () => ({ style: {}, append() {} });
  let replaced = false, opened = false;
  surface.document = { createElement: node, body: { replaceChildren() { replaced = true; } } };
  surface.fetch = async () => Response.json({ user: null });
  void requireAdminDocumentAccess(surface).then(() => { opened = true; });
  await tick(); assert.equal(replaced, true); assert.equal(opened, false);
});

test('verified legacy credentials never attach to external, unrelated or redirected requests', async () => {
  const { surface, calls } = surfaceFor({ ok: true });
  let stored = 'verified-admin-fixture';
  surface.location.origin = 'https://site.test';
  surface.sessionStorage = { getItem: () => stored };
  surface.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === '/api/auth/legacy-admin/check') return Response.json({ ok: true, legacyAdmin: true });
    return Response.json({ ok: true });
  };
  assert.equal(await requireAdminDocumentAccess(surface), true);
  for (const url of [`https://outside.invalid/api/my/${token}`, `/api/products/${token}`, `/api/my/${token}/extra`, `//outside.invalid/api/my/${token}`]) {
    await customerDocumentFetch(url, undefined, undefined, surface);
    assert.equal(new Headers(calls.at(-1).options.headers).has('x-admin-token'), false, url);
  }
  stored = '';
  await customerDocumentFetch('/api/my/' + token, undefined, undefined, surface);
  assert.equal(new Headers(calls.at(-1).options.headers).has('x-admin-token'), false);
});
