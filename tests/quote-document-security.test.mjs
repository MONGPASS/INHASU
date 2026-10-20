import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runInNewContext } from 'node:vm';
import { escapeDocumentText, documentUrl, documentImageAttribute, documentTextWithoutBreaks, sanitizeDocumentHTML } from '../public/document-safe.js';
import { onRequestGet as download } from '../functions/api/file/[[key]].js';
import { onRequestGet as diagnose } from '../functions/api/notify-test.js';
import { onRequestGet as customerQuote } from '../functions/api/my/[token].js';
import { requestSQLite } from './helpers/request-sqlite.mjs';
import { customerIdentity } from './helpers/customer-session.mjs';

test('고객 텍스트와 사진 속성의 태그·따옴표를 안전하게 표시한다', () => {
  assert.equal(escapeDocumentText('<img src=x onerror="alert(1)"> & \'고객\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;고객&#39;');
  assert.equal(documentTextWithoutBreaks('초원<br/>여행<img src=x>'), '초원 여행&lt;img src=x&gt;');
  assert.equal(documentImageAttribute('/img/a" onerror="alert(1).png'), '/img/a&quot; onerror=&quot;alert(1).png');
  assert.equal(sanitizeDocumentHTML('<svg onload=alert(1)>'), '&lt;svg onload=alert(1)&gt;', 'without a browser DOM the rich renderer fails closed');
});

test('사진과 링크에서 실행 프로토콜·SVG data·우회 URL을 차단한다', () => {
  for (const unsafe of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'vbscript:evil', 'data:text/html,<script>evil</script>', 'data:image/svg+xml,<svg onload=evil>', 'blob:https://site.test/id', '//external.test/a', '\\external.test/a']) {
    assert.equal(documentUrl(unsafe), '', unsafe);
    assert.equal(documentUrl(unsafe, true), '', unsafe);
    assert.equal(documentImageAttribute(unsafe), '', unsafe);
  }
  for (const valid of ['/api/img/spot.webp', 'img/초원.jpg', 'https://images.example.invalid/picture.webp', '../img/ger.png']) assert.equal(documentUrl(valid, true), valid);
  assert.equal(documentUrl('data:image/png;base64,aGVsbG8=', true), 'data:image/png;base64,aGVsbG8=');
  assert.equal(documentUrl('tel:+97612345678'), 'tel:+97612345678');
  assert.equal(documentUrl('tel:+97612345678', true), '');
});

test('고객 문서가 공통 안전 렌더러를 로드하고 강조·회색 일정 표현을 유지한다', () => {
  for (const name of ['견적서.html', '견적서-모바일.html', '확정일정표.html', '확정일정표-모바일.html', '확정안내.html', '일정지도.html']) {
    const html = fs.readFileSync(new URL('../public/' + name, import.meta.url), 'utf8');
    assert.match(html, /from "\/document-safe\.js"/, name);
    assert.doesNotMatch(html, /const esc = s => String\(s \?\? ""\)/, name);
    assert.doesNotMatch(html, /src="\$\{(?:src|g\.img|guideQr|s\.spot\.img)\}"/, name);
    if (name !== '일정지도.html') {
      assert.match(html, /startsWith\("\*"\)/, name);
      assert.match(html, /startsWith\("\("\)/, name);
      assert.match(html, /\$\{rich\(t\)\}/, name);
    }
  }
});

test('실제 PC·모바일 견적/확정 표지가 고객명과 이미지 속성 공격을 실행 가능한 HTML로 만들지 않는다', () => {
  const dataContext = { window: {} };
  runInNewContext(fs.readFileSync(new URL('../public/data.js', import.meta.url), 'utf8'), dataContext);
  const quote = structuredClone(dataContext.window.QUOTE);
  const attack = '<img src=x onerror="alert(1)">';
  quote.customer = attack;
  quote.quoteNo = attack;
  quote.images.cover = '/img/photo" onerror="alert(1)';
  const declaration = (source, name) => {
    const start = source.indexOf(`const ${name} =`); assert.ok(start >= 0, name);
    const end = source.slice(start).search(/;\r?\n/); assert.ok(end >= 0, name);
    return source.slice(start, start + end + 1);
  };
  const bindings = { escapeQuoteDocumentText: escapeDocumentText, sanitizeDocumentHTML, documentUrl, documentImageAttribute };
  for (const filename of ['견적서.html', '견적서-모바일.html', '확정일정표.html', '확정일정표-모바일.html']) {
    const source = fs.readFileSync(new URL('../public/' + filename, import.meta.url), 'utf8');
    const mobile = filename.includes('모바일');
    const cover = mobile ? 'secCover' : 'pgCover';
    const code = `const B=Q.brand; const IMG=Q.images; ${declaration(source, 'esc')} ${declaration(source, 'LOGO')} ${declaration(source, 'ph')} ${mobile ? declaration(source, 'card') : ''} ${declaration(source, cover)} return ${cover};`;
    const html = new Function('Q', ...Object.keys(bindings), code)(quote, ...Object.values(bindings));
    assert.ok(html.includes('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;'), filename);
    assert.ok(!html.includes(attack), filename);
    assert.ok(!html.includes(' onerror="'), filename);
    assert.ok(html.includes('/img/photo&quot; onerror=&quot;alert(1)'), filename);
  }
});

const request = (path, header) => new Request('https://site.test' + path, { headers: header ? { 'x-admin-token': header } : {} });
test('첨부파일 권한 실패는 R2를 읽지 않고 관리자 헤더·기존 링크만 허용한다', async () => {
  let reads = 0;
  const FILES = { async get(key) { reads++; assert.equal(key, 'uploads/synthetic.pdf'); return { body: 'fixture only', httpMetadata: { contentType: 'application/pdf' }, customMetadata: { originalName: '시험 파일.pdf' } }; } };
  const env = { ADMIN_TOKEN: 'fixture-admin', FILES };
  for (const req of [request('/api/file/uploads/synthetic.pdf'), request('/api/file/uploads/synthetic.pdf?token=wrong'), request('/api/file/uploads/synthetic.pdf?token=fixture-admin', 'wrong')]) {
    const res = await download({ request: req, env, params: { key: ['uploads', 'synthetic.pdf'] } });
    assert.equal(res.status, 401); assert.match(res.headers.get('Cache-Control'), /private, no-store/);
  }
  assert.equal(reads, 0);
  assert.equal((await download({ request: request('/api/file/uploads/synthetic.pdf'), env: { ...env, ADMIN_TOKEN: null }, params: { key: ['uploads', 'synthetic.pdf'] } })).status, 401);
  for (const req of [request('/api/file/uploads/synthetic.pdf', 'fixture-admin'), request('/api/file/uploads/synthetic.pdf?token=fixture-admin')]) {
    const res = await download({ request: req, env, params: { key: ['uploads', 'synthetic.pdf'] } });
    assert.equal(res.status, 200); assert.equal(await res.text(), 'fixture only');
    assert.match(res.headers.get('Cache-Control'), /private, no-store/); assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff');
    assert.match(res.headers.get('Content-Disposition'), /^attachment;/);
  }
  assert.equal(reads, 2);
});

test('알림 진단 권한 실패는 발송하지 않고 설정 조회는 관리자에게만 허용한다', async () => {
  const original = globalThis.fetch;
  let sends = 0;
  globalThis.fetch = async () => { sends++; throw new Error('No external services are allowed in this test'); };
  try {
    const env = { ADMIN_TOKEN: 'fixture-admin', SOLAPI_API_KEY: 'fixture-secret-key' };
    for (const req of [request('/api/notify-test?type=admin'), request('/api/notify-test?type=quote&phone=01000000000&token=wrong'), request('/api/notify-test?token=fixture-admin', 'wrong')]) {
      assert.equal((await diagnose({ request: req, env })).status, 401);
    }
    for (const req of [request('/api/notify-test', 'fixture-admin'), request('/api/notify-test?token=fixture-admin')]) {
      const res = await diagnose({ request: req, env });
      assert.equal(res.status, 200); assert.match(res.headers.get('Cache-Control'), /private, no-store/);
      const text = await res.text(); assert.ok(!text.includes('fixture-secret-key')); assert.equal(JSON.parse(text).envState.SOLAPI_API_KEY, true);
    }
    assert.equal(sends, 0);
  } finally { globalThis.fetch = original; }
});

test('소유자가 연 견적 링크도 서명 snapshot의 신원 정보는 마스킹하고 계약 원본은 보존한다', async t => {
  const traveler = { nameKo: '합성 고객', passportName: 'SYNTHETIC CUSTOMER', birth: '1990-01-23', phone: '01012345678', passportNo: 'AB1234567', gender: '여성' };
  const snapshot = { name: '합성 고객', destination: '고비', travelers: [{ ...traveler }], contractInfo: { totalAmount: 1230000, note: '합성 특약' } };
  const raw = JSON.stringify({ name: '합성 고객', status: '예약확정', booking: { travelers: [{ ...traveler }], contract: { signedAt: '2026-10-14T00:00:00Z', signImg: 'private-signature-evidence', snapshot } } });
  const DB = requestSQLite(t,{id:'req-1',token:'synthetic-customer-link-token',...JSON.parse(raw)});
  const customer = customerIdentity(DB,{resourceId:'req-1'});
  const res = await customerQuote({ request:new Request('https://example.invalid/api/my/synthetic-customer-link-token',{headers:customer}), env: { DB }, params: { token: 'synthetic-customer-link-token' } });
  assert.equal(res.status, 200);
  const text = await res.text(); const body = JSON.parse(text);
  for (const secret of [traveler.birth, traveler.phone, traveler.passportNo, 'private-signature-evidence']) assert.ok(!text.includes(secret), secret);
  assert.equal(body.booking.contract.snapshot.travelers[0].birth, '1990-**-**');
  assert.equal(body.booking.contract.snapshot.travelers[0].phone, '***-****-5678');
  assert.equal(body.booking.contract.snapshot.travelers[0].passportNo, 'AB*****67');
  assert.deepEqual(body.booking.contract.snapshot.travelers, body.booking.travelers);
  assert.deepEqual(body.booking.contract.snapshot.contractInfo, snapshot.contractInfo);
  assert.equal(JSON.parse(raw).booking.contract.snapshot.travelers[0].passportNo, traveler.passportNo);
  assert.equal(DB.requestWrites.length, 0);
});
