// Actual Hono/Lucia/D1-shaped SQLite routes for local reservation workspace QA.
// node scripts/check-reservation-workspace.mjs [--serve] [--port=8796] — no production data or outbound network.
import { build } from 'esbuild';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { hashPassword } from '../functions/lib/password.ts';
import { productScheduleDays } from '../functions/lib/productItinerary.ts';
import { productDocumentSections } from '../public/product-itinerary.js';
import { onRequestGet as quoteGet, onRequestPatch as quotePatch, onRequestDelete as quoteDelete } from '../functions/api/requests/[id].js';
import { onRequestGet as libraryGet } from '../functions/api/data/[key].js';
import { onRequestGet as quoteListGet, onRequestPost as quotePost } from '../functions/api/requests.js';
import { onRequestGet as customerQuoteGet } from '../functions/api/my/[token].js';
import { onRequestGet as noticeGet, onRequestPost as noticePost } from '../functions/api/requests/[id]/itinerary-notice.js';
import { adminProductDraftKey } from '../src/utils/adminProductDraft.ts';
import { reservationDraftKey, reservationDraftFingerprint, readReservationDraft, writeReservationDraft } from '../src/utils/adminReservationDraft.ts';

const root = path.resolve(import.meta.dirname, '..');
const portArgument = process.argv.find(argument => argument.startsWith('--port='));
const port = portArgument ? Number(portArgument.slice('--port='.length)) : 8795;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port는 1~65535 사이의 정수여야 합니다.');
const localOrigin = `http://localhost:${port}`;
const draftStoragePrefixes = ['inhasu:admin-product-draft:', 'inhasu:admin-reservation-doc-draft:', 'inhasu:quote-editor:'];
const draftStorageFaultSource = `(function(){const originalSetItem=Storage.prototype.setItem;const prefixes=${JSON.stringify(draftStoragePrefixes)};Storage.prototype.setItem=function(key,value){if(prefixes.some(prefix=>String(key).startsWith(prefix)))throw new DOMException('Local draft storage fault','QuotaExceededError');return originalSetItem.call(this,key,value);};})();`;
const draftStorageFaultHtml = html => html.replace(/<head(?:\s[^>]*)?>/i, head => head + `<script>${draftStorageFaultSource}</script>`);
function draftStorageBlocked(url, referer) {
    if (url.searchParams.has('localDraftStorage')) return url.searchParams.get('localDraftStorage') === 'blocked';
    // Same-origin quote iframes inherit the parent's explicit local QA option.
    // A foreign referrer or a normal visit cannot enable this fault.
    try {
        const parentUrl = new URL(referer);
        return parentUrl.origin === localOrigin && parentUrl.searchParams.get('localDraftStorage') === 'blocked';
    } catch { return false; }
}
const scratch = path.join(root, 'work/reservation-workspace');
fs.mkdirSync(scratch, { recursive: true });
const entry = path.join(scratch, 'entry.ts');
fs.writeFileSync(entry, `import { Hono } from 'hono';
import auth from '../../functions/api/auth';
import reservations from '../../functions/api/reservations';
import products from '../../functions/api/products';
import quotes from '../../functions/api/quotes';
import bookings from '../../functions/api/admin-bookings';
import workspace from '../../functions/api/admin-workspace';
import deliveries from '../../functions/api/admin-deliveries';
import categories from '../../functions/api/categories';
import documents from '../../functions/api/documents';
import templates from '../../functions/api/itinerary-templates';
import guides from '../../functions/api/tour-guides';
import accommodations from '../../functions/api/accommodations';
import hotels from '../../functions/api/hotels';
import spots from '../../functions/api/tourist-spots';
import notifications from '../../functions/api/notifications/index';
import email from '../../functions/api/notifications/email';
import settings from '../../functions/api/settings';
const app = new Hono().basePath('/api');
app.route('/auth', auth); app.route('/reservations', reservations); app.route('/products', products);
app.route('/quotes', quotes); app.route('/admin/bookings', bookings); app.route('/documents', documents);
app.route('/admin/workspace', workspace); app.route('/admin/deliveries', deliveries); app.route('/categories', categories);
app.route('/itinerary-templates', templates); app.route('/tour-guides', guides);
app.route('/accommodations', accommodations); app.route('/hotels', hotels); app.route('/tourist-spots', spots);
app.route('/notifications/email', email); app.route('/notifications', notifications); app.route('/settings', settings);
export default app;`);
const bundle = path.join(scratch, 'app.mjs');
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm' });
const app = (await import(pathToFileURL(bundle).href + '?v=' + Date.now())).default;

const raw = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true });
const stmt = (sql, args = []) => ({
    bind: (...values) => stmt(sql, values),
    async first() { return raw.prepare(sql).get(...args) ?? null; },
    async all() { return { results: raw.prepare(sql).all(...args) }; },
    async run() { const result = raw.prepare(sql).run(...args); return { meta: { changes: result.changes } }; },
    async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
});
const DB = { prepare: sql => stmt(sql), batch: async statements => {
    raw.exec('BEGIN');
    try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        raw.exec('COMMIT');
        return results;
    } catch (error) { raw.exec('ROLLBACK'); throw error; }
} };
await ensureSiteSchema(DB);
raw.exec(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
raw.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, google_id TEXT, email TEXT, name TEXT, role TEXT, avatar_url TEXT, password_hash TEXT);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER);`);
const password = 'local-workspace-test-2026';
const passwordHash = await hashPassword(password);
for (const [id, role, email] of [
    ['workspace-admin', 'admin', 'admin@example.invalid'],
    ['workspace-owner', 'user', 'customer@example.invalid'],
    ['workspace-other', 'user', 'other@example.invalid'],
]) {
    raw.prepare('INSERT INTO users (id,name,email,role,password_hash) VALUES (?,?,?,?,?)').run(id, '로컬 검증 계정', email, role, passwordHash);
    raw.prepare('INSERT INTO sessions VALUES (?,?,?)').run(`local-${id}-session`, id, Date.now() + 86400000);
}
const admin = { cookie: 'auth_session=local-workspace-admin-session' };
raw.prepare('INSERT INTO categories (id,name,type) VALUES (?,?,?)').run('local-central', '중앙몽골', 'product');
raw.prepare('INSERT INTO categories (id,name,type) VALUES (?,?,?)').run('local-gobi', '고비사막', 'product');
const owner = { cookie: 'auth_session=local-workspace-owner-session' };
const other = { cookie: 'auth_session=local-workspace-other-session' };
const env = { DB, ENVIRONMENT: 'production', ADMIN_TOKEN: 'local-workspace-quote-fixture',
    RESEND_API_KEY: 'local-stub-key', ADMIN_EMAIL: 'admin@example.invalid', PAYPAL_ENABLED: 'false' };

// Never delegate to the real fetch. Local mail success/failure is deterministic;
// every other outbound request fails closed and cannot reach a live service.
const outbound = [];
globalThis.fetch = async input => {
    const url = String(input instanceof Request ? input.url : input);
    if (url !== 'https://api.resend.com/emails') throw new Error('로컬 검증에서 외부 접속을 차단했습니다.');
    outbound.push({ provider: 'local-email-stub' });
    const status = fs.existsSync(path.join(scratch, 'mail-unavailable')) ? 503 : 200;
    return Response.json({ id: 'local-email-' + outbound.length }, { status });
};
// CLI checks and the browser server use identical dispatch, including the Pages
// functions used by quote editors instead of substituting a fake PATCH response.
const apiRequest = async (route, options = {}) => {
    const url = new URL(route, localOrigin);
    const method = (options.method || 'GET').toUpperCase();
    const request = new Request(url, options);
    const pending = [];
    const context = { request, env, waitUntil(task) { pending.push(Promise.resolve(task)); } };
    const noticeMatch = url.pathname.match(/^\/api\/requests\/([^/]+)\/itinerary-notice$/);
    const quoteMatch = url.pathname.match(/^\/api\/requests\/([^/]+)$/);
    const customerMatch = url.pathname.match(/^\/api\/my\/([^/]+)$/);
    const libraryMatch = url.pathname.match(/^\/api\/data\/([^/]+)$/);
    let handler;
    if (url.pathname === '/api/requests') handler = { GET: quoteListGet, POST: quotePost }[method];
    else if (noticeMatch) { context.params = { id: decodeURIComponent(noticeMatch[1]) }; handler = { GET: noticeGet, POST: noticePost }[method]; }
    else if (quoteMatch) { context.params = { id: decodeURIComponent(quoteMatch[1]) }; handler = { GET: quoteGet, PATCH: quotePatch, DELETE: quoteDelete }[method]; }
    else if (customerMatch && method === 'GET') { context.params = { token: decodeURIComponent(customerMatch[1]) }; handler = customerQuoteGet; }
    else if (libraryMatch && method === 'GET') { context.params = { key: decodeURIComponent(libraryMatch[1]) }; handler = libraryGet; }
    const response = handler ? await handler(context) : await app.request(request, undefined, env);
    await Promise.allSettled(pending);
    return response;
};
const write = (route, method, data, headers = admin) => apiRequest(route, {
    method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

const productName = '테렐지 초원 여행 2박 3일';
const image = '/img/regions/terelj.webp';
const lodgeImage = '/img/quote/lodge-lux.webp';
// Only safe, public course/spot content lives in this library. Every photo is a
// bundled local asset; no private uploads, contact details or live data are used.
const publicLibraryFixtures = {
    snippets: {
        '테를지 초원 코스': {
            cat: '중앙몽골', dest: '테를지 일정 조각 확인', move: '2시간', dist: '120km',
            items: ['09:30 공항 픽업', '거북바위 산책'],
            stay: { name: '테를지 로컬 게르 캠프', tags: ['게르', '초원'], img: lodgeImage,
                imgs: [lodgeImage], desc: '로컬 검증용 게르 숙소 사진입니다.' },
            meals: ['조식', '현지식', '캠프식'], images: [image, '/img/home/1.webp'],
        },
    },
    snippet_cats: ['중앙몽골'],
    spots: {
        '거북바위': {
            name: '거북바위', nameMn: 'Мэлхий хад', region: '중앙몽골', short: '테를지 국립공원의 대표 명소',
            desc: '거북 모양의 바위와 주변 초원을 둘러보는 로컬 검증용 명소 안내입니다.',
            img: image, subImgs: ['/img/home/1.webp', lodgeImage, '/img/quote/cover.webp'],
        },
        '테를지 전망대': {
            name: '테를지 전망대', nameMn: 'Тэрэлж', region: '중앙몽골', short: '초원 전망을 보는 로컬 검증 명소',
            desc: '같은 지역의 두 번째 명소를 선택할 때 순서와 선택 수를 확인하는 자료입니다.',
            img: '/img/home/1.webp', subImgs: [image, '/img/quote/cover.webp', lodgeImage],
        },
        '홍고린 엘스': {
            name: '홍고린 엘스', nameMn: 'Хонгорын элс', region: '고비사막', short: '모래언덕 사진과 안내를 확인하는 명소',
            desc: '고비사막 그룹에서 선택한 사진과 설명을 저장하는 로컬 검증 자료입니다.',
            img: '/img/regions/khongor.webp', subImgs: ['/img/regions/bayanzag.webp', '/img/regions/els.webp', '/img/quote/cover.webp'],
        },
        '로컬 미분류 명소': {
            name: '로컬 미분류 명소', nameMn: 'LOCAL SPOT', region: '', short: '미분류 그룹과 선택 순서 확인',
            desc: '지역이 비어 있는 명소도 선택할 수 있는지 확인하는 자료입니다.',
            img: '/img/quote/cover.webp', subImgs: [image, '/img/home/1.webp', lodgeImage],
        },
    },
    spot_cats: ['중앙몽골', '고비사막'],
};
for (const [key, data] of Object.entries(publicLibraryFixtures)) {
    raw.prepare('INSERT INTO kv (k,v,updated_at) VALUES (?,?,?)').run(key, JSON.stringify(data), '2026-10-14T00:00:00Z');
}
const libraryResponse = (key, headers = {}) => libraryGet({
    request: new Request(`${localOrigin}/api/data/${encodeURIComponent(key)}`, { headers }), params: { key }, env,
});
const blocks = [
    { type: 'dayInfo', content: { title: '테렐지 초원 도착', description: '공항 픽업 후 국립공원으로 이동합니다.',
        heroImage: image, galleryImages: ['/img/home/1.webp'], meals: { lunch: '현지식', dinner: '캠프식' },
        accommodation: '테렐지 기본 게르 캠프', accommodationImages: [lodgeImage],
        accommodationAddress: '테렐지 국립공원', accommodationDescription: '첫날 기본 숙소입니다.' } },
    { type: 'timeline', content: { time: '09:30', title: '공항 픽업과 초원 산책',
        description: '확정된 고객 일정을 직접 수정할 수 있습니다.', images: [image] } },
    { type: 'image', content: '/img/home/1.webp' },
    { type: 'slide', content: { title: '게르 캠프에서의 휴식', description: '사진형 일정도 저장과 PDF에서 유지됩니다.', images: [lodgeImage] } },
    { type: 'dayInfo', content: { title: '테렐지 국립공원 탐방', meals: { breakfast: '캠프식', lunch: '현지식', dinner: '현지식' } } },
    { type: 'timeline', content: { time: '14:00', title: '거북바위와 승마 체험', images: [image] } },
    { type: 'dayInfo', content: { title: '울란바토르 귀환', meals: { breakfast: '조식', lunch: '현지식' } } },
    { type: 'timeline', content: { time: '16:00', title: '공항 이동', description: '항공편에 맞춰 출발합니다.' } },
];
const insertProduct = raw.prepare(`INSERT INTO products
    (id,name,description,category,duration,price,status,main_images,thumbnail,included,excluded,itinerary_blocks,pricing_options)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
for (const [id, itinerary] of [
    ['workspace-old-tour', [{ type: 'dayInfo', content: { title: '잘못 선택하면 안 되는 동명 상품 일정' } }]],
    ['workspace-booked-tour', blocks],
]) {
    insertProduct.run(id, productName, '몽골 여행 예약 작업 검증 상품', '중앙몽골', '2박 3일', 1100000, 'active',
        JSON.stringify([image]), image, JSON.stringify(['전용 차량', '한국어 가이드', '등록된 식사와 숙박']),
        JSON.stringify(['국제선 항공권', '개인 경비']), JSON.stringify(itinerary),
        JSON.stringify([{ people: 3, pricePerPerson: 1100000, depositPerPerson: 110000, localPaymentPerPerson: 990000 }]));
}
const savedDocument = { name: productName, description: '저장된 고객 일정표', days: productScheduleDays({ itinerary_blocks: blocks }), documentSettings: {} };
const insertReservation = raw.prepare(`INSERT INTO reservations
    (id,product_id,product_name,customer_name,customer_email,customer_phone,travelers,start_date,end_date,status,
     total_price,deposit_amount,balance_amount,deposit_status,balance_status,reservation_number,document_content,
     contract_data,assigned_guide,daily_accommodations,are_assignments_visible_to_user,itinerary_url,contract_url,user_id,created_at,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
for (const [id, status, document, signed] of [
    ['workspace-product', 'confirmed', null, false],
    ['workspace-signed', 'confirmed', savedDocument, true],
    ['workspace-pending', 'pending_payment', null, false],
    ['workspace-empty', 'confirmed', { name: '의도적으로 비운 고객 일정', days: [], documentSettings: {} }, false],
    ['workspace-check', 'confirmed', null, false],
]) {
    insertReservation.run(id, 'workspace-booked-tour', productName, id === 'workspace-product' ? '김여행 · 테스트 예약' : '로컬 검증 고객',
        'customer@example.invalid', '01000000000', 3, '2026-10-20', '2026-10-22', status,
        3300000, 330000, 2970000, status === 'pending_payment' ? 'unpaid' : 'paid', 'unpaid', `LOCAL-${id}`,
        document ? JSON.stringify(document) : null,
        signed ? JSON.stringify({ travelers: [{ name: '로컬 테스트 여행자', passportName: 'LOCAL TEST', gender: '남성' }],
            agreement: { agreed: true, name: '로컬 테스트 여행자', agreedAt: '2026-10-14T00:00:00Z' }, customerSubmittedAt: '2026-10-14T00:00:00Z' }) : null,
        JSON.stringify({ id: 'workspace-guide', name: '로컬 한국어 가이드', image: '/img/quote/guide.webp', phone: 'LOCAL-GUIDE-PHONE' }),
        '[]', signed ? 1 : 0, signed ? `${localOrigin}/documents/itinerary/${id}` : null,
        signed ? `${localOrigin}/documents/contract/${id}` : null, 'workspace-owner', '2026-10-14T00:00:00Z', 'website');
}
raw.prepare('UPDATE reservations SET history=? WHERE id=?').run(JSON.stringify([
    { timestamp: '2026-10-14T00:00:00Z', type: 'email', description: '확정 일정표를 고객님께 발송했습니다.', detail: `${localOrigin}/documents/itinerary/workspace-signed` },
    { timestamp: '2026-10-14T00:01:00Z', type: 'email', description: '해외여행 계약서를 고객님께 발송했습니다.', detail: `${localOrigin}/documents/contract/workspace-signed` },
]), 'workspace-signed');

// A real quote-backed row lets the unified list distinguish product bookings.
const quoteFixture = { id: 'workspace-quote', name: '로컬 견적 예약', phone: '01000000000', email: 'quote@example.invalid',
    depart: '2026-10-25', return_: '2026-10-27', adult: 3, status: '예약확정', token: 'local-workspace-quote-token',
    receivedAt: '2026-10-14T00:00:00Z', destination: '고비사막', decision: { status: 'accepted' },
    quote: { customer: '로컬 견적 예약', price: { total: 3300000, deposit: 330000 } },
    booking: { preparedAt: '2026-10-14', contractInfo: { productName: '고비사막 맞춤 견적', totalAmount: 3300000,
        depositAmount: 330000, balanceAmount: 2970000, depositStatus: '입금완료' }, publishStatus: 'draft', days: [] } };
raw.prepare('INSERT INTO requests (id,received_at,name,phone,destination,status,data,token) VALUES (?,?,?,?,?,?,?,?)')
    .run(quoteFixture.id, quoteFixture.receivedAt, quoteFixture.name, quoteFixture.phone, quoteFixture.destination,
        quoteFixture.status, JSON.stringify(quoteFixture), quoteFixture.token);

// Verify the same routes used by the UI. Mutate only a disposable check row so
// --serve starts with unsaved, signed, pending and intentionally empty fixtures.
assert.equal((await apiRequest('/api/reservations')).status, 401);
assert.equal((await apiRequest('/api/admin/bookings/quote')).status, 401);
const login = await write('/api/auth/login', 'POST', { email: 'admin@example.invalid', password }, {});
assert.equal(login.status, 200);
assert.match(login.headers.get('set-cookie') || '', /auth_session=/);
const loginHeaders = { cookie: login.headers.get('set-cookie').split(';')[0] };
assert.equal((await apiRequest('/api/auth/me', { headers: loginHeaders })).status, 200);
const quoteDeskResponse = await apiRequest('/api/auth/quote-desk', { headers: admin });
assert.equal(quoteDeskResponse.status, 200);
assert.equal(quoteDeskResponse.headers.get('cache-control'), 'no-store');
const quoteDeskSession = await quoteDeskResponse.json();
assert.equal(quoteDeskSession.userId, 'workspace-admin');
assert.equal(quoteDeskSession.token, env.ADMIN_TOKEN);
assert.equal((await apiRequest('/api/auth/quote-desk')).status, 401);
assert.equal((await apiRequest('/api/auth/quote-desk', { headers: owner })).status, 403);
const quoteAdmin = { 'x-admin-token': quoteDeskSession.token };
// A disposable walk-in record exercises the editor's real POST/PATCH/GET path;
// internal saves must neither publish a schedule nor call a delivery provider.
const quoteEditorId = 'workspace-quote-editor-check';
const quoteEditorDocument = { ...structuredClone(quoteFixture.quote),
    days: [{ d: 1, date: '10.25(일)', dest: '로컬 견적 일정', move: '2시간', dist: '120km',
        items: ['*확정 픽업 안내*', '(상황에 따라 조정)', '09:30 공항 픽업'], stay: { name: '로컬 게르 캠프', tags: ['게르'] },
        meals: ['조식', '현지식', '캠프식'] }], highlights: [structuredClone(publicLibraryFixtures.spots['거북바위'])] };
const quoteCreated = await write('/api/requests', 'POST', { id: quoteEditorId, name: '로컬 저장 검증',
    phone: '01000000000', source: 'walkin', quote: quoteEditorDocument, status: '진행중', silentQuote: true }, quoteAdmin);
assert.equal(quoteCreated.status, 200);
const createdQuoteResponse = await quoteCreated.json();
assert.equal(createdQuoteResponse.ok, true);
assert.equal(createdQuoteResponse.notifications[0].status, 'silent');
assert.equal((await write(`/api/requests/${quoteEditorId}`, 'PATCH', { memo: '인증 없이 저장' }, {})).status, 401);
const editedQuoteDocument = { ...structuredClone(quoteEditorDocument), customer: '견적 저장 후 재조회 확인' };
const editedBooking = { preparedAt: '2026-10-14', publishStatus: 'draft', days: structuredClone(quoteEditorDocument.days),
    contractInfo: { productName: '직접 입력한 계약 조건', included: '등록된 안내 유지', excluded: '개인 경비' } };
const quoteSaved = await write(`/api/requests/${quoteEditorId}`, 'PATCH', { quote: editedQuoteDocument, booking: editedBooking, silentQuote: true }, quoteAdmin);
assert.equal(quoteSaved.status, 200);
const quoteSaveResponse = await quoteSaved.json();
assert.equal(quoteSaveResponse.ok, true);
assert.equal(quoteSaveResponse.publishStatus, 'draft');
assert.deepEqual(quoteSaveResponse.notifications, []);
const quoteReloaded = await (await apiRequest(`/api/requests/${quoteEditorId}`, { headers: quoteAdmin })).json();
assert.deepEqual(quoteReloaded.item.quote, editedQuoteDocument);
assert.deepEqual(quoteReloaded.item.booking.days, editedBooking.days);
assert.deepEqual(quoteReloaded.item.booking.contractInfo, editedBooking.contractInfo);
const publicQuoteReloaded = await (await apiRequest(`/api/my/${createdQuoteResponse.token}`)).json();
assert.equal(publicQuoteReloaded.ok, true);
assert.deepEqual(publicQuoteReloaded.quote, editedQuoteDocument);
assert.equal(publicQuoteReloaded.booking.publishStatus, 'draft');
assert.equal((await apiRequest('/api/requests', { headers: quoteAdmin })).status, 200);
assert.equal((await write('/api/requests/missing-local-request', 'PATCH', { silentQuote: true }, quoteAdmin)).status, 404);
assert.equal((await write(`/api/requests/${quoteEditorId}`, 'DELETE', {}, quoteAdmin)).status, 200);
assert.equal(outbound.length, 0);

const deliveryRoute = '/api/admin/deliveries?source=product&id=workspace-signed';
assert.equal((await apiRequest(deliveryRoute)).status, 401);
assert.equal((await apiRequest(deliveryRoute, { headers: owner })).status, 403);
const productDeliveriesResponse = await apiRequest(deliveryRoute, { headers: admin });
assert.equal(productDeliveriesResponse.status, 200);
assert.equal(productDeliveriesResponse.headers.get('cache-control'), 'private, no-store');
const productDeliveries = await productDeliveriesResponse.json();
assert.equal(productDeliveries.bookingId, 'workspace-signed');
assert.equal(productDeliveries.workflow.contract, true);
assert.equal(productDeliveries.workflow.published, true);
assert.equal(productDeliveries.items.length, 2);
assert.ok(productDeliveries.items.every(item => item.state === 'legacy'));
const quoteDeliveriesResponse = await apiRequest('/api/admin/deliveries?source=quote_booking&id=workspace-quote', { headers: admin });
assert.equal(quoteDeliveriesResponse.status, 200);
const quoteDeliveries = await quoteDeliveriesResponse.json();
assert.equal(quoteDeliveries.workflow.contract, false);
assert.equal(quoteDeliveries.workflow.published, false);
assert.equal((await apiRequest('/api/admin/deliveries?source=product&id=missing-local-reservation', { headers: admin })).status, 404);
assert.equal((await apiRequest('/api/admin/deliveries?source=invalid&id=workspace-signed', { headers: admin })).status, 400);
assert.equal((await apiRequest('/api/admin/bookings/quote', { headers: admin })).status, 200);
assert.equal((await apiRequest('/api/quotes', { headers: admin })).status, 200);
for (const [key, data] of Object.entries(publicLibraryFixtures)) {
    const response = await libraryResponse(key);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.key, key);
    assert.deepEqual(body.data, data);
    assert.ok(!/LOCAL-PRIVATE-|passport|adminOperations|local-workspace-quote-token/.test(JSON.stringify(body)));
}
assert.equal((await libraryResponse('unsupported-local-key')).status, 404);

// Product-selected representative spots are independent of marketing highlights.
// Exercise actual registration, update and reservation/document routes rather
// than adding a raw DB column fixture that could bypass a missing API mapping.
const selectedSpots = ['홍고린 엘스', '거북바위', '로컬 미분류 명소'].map(name => structuredClone(publicLibraryFixtures.spots[name]));
const legacyHighlights = [{ icon: 'star', title: '판매 상품의 기존 안내', description: '대표 명소와 별도로 유지할 판매 포인트입니다.' }];
const spotProductInput = { id: 'workspace-spots-product', name: '대표 명소 통합 검증 상품', description: '공통 명소 선택기의 저장과 상속을 확인하는 로컬 상품',
    category: '중앙몽골', duration: '2박 3일', price: 1100000, status: 'active', mainImages: [image],
    included: ['전용 차량', '현지 가이드'], excluded: ['국제선 항공권'], itineraryBlocks: blocks,
    representativeSpots: selectedSpots, highlights: legacyHighlights };
assert.equal((await write('/api/products', 'POST', spotProductInput, {})).status, 401);
assert.equal((await write('/api/products', 'POST', spotProductInput, owner)).status, 403);
assert.equal((await write('/api/products', 'POST', spotProductInput)).status, 200);
const createdSpotProduct = await (await apiRequest('/api/products/workspace-spots-product', { headers: admin })).json();
assert.deepEqual(createdSpotProduct.representativeSpots, selectedSpots);
assert.deepEqual(JSON.parse(createdSpotProduct.representative_spots), selectedSpots);
assert.deepEqual(createdSpotProduct.highlights, legacyHighlights);
const publicSpotProduct = await (await apiRequest('/api/products/workspace-spots-product')).json();
assert.deepEqual(publicSpotProduct.representativeSpots, selectedSpots);
const revisedSpots = [structuredClone(selectedSpots[2]), structuredClone(selectedSpots[0])];
revisedSpots[0].desc = '선택 순서를 바꾸고 수정한 최신 미분류 명소 설명입니다.';
revisedSpots[0].img = '/img/home/1.webp';
revisedSpots[0].subImgs = [lodgeImage, image, '/img/quote/cover.webp'];
assert.equal((await write('/api/products/workspace-spots-product', 'PUT', { representative_spots: JSON.stringify(revisedSpots) }, owner)).status, 403);
assert.deepEqual((await (await apiRequest('/api/products/workspace-spots-product')).json()).representativeSpots, selectedSpots);
assert.equal((await write('/api/products/workspace-spots-product', 'PUT', { representative_spots: JSON.stringify(revisedSpots) })).status, 200);
const updatedSpotProduct = await (await apiRequest('/api/products/workspace-spots-product', { headers: admin })).json();
assert.deepEqual(updatedSpotProduct.representativeSpots, revisedSpots);
assert.deepEqual(JSON.parse(updatedSpotProduct.representative_spots), revisedSpots);
assert.deepEqual(updatedSpotProduct.highlights, legacyHighlights);
assert.deepEqual(updatedSpotProduct.itineraryBlocks, blocks);
const productList = await (await apiRequest('/api/products', { headers: admin })).json();
assert.deepEqual(productList.find(product => product.id === spotProductInput.id).representativeSpots, revisedSpots);

const spotBookingInput = { id: 'workspace-spots-check', product_id: spotProductInput.id, productName: spotProductInput.name,
    customerName: '로컬 대표 명소 예약', email: 'customer@example.invalid', phone: '01000000000', user_id: 'workspace-owner',
    status: 'confirmed', total_people: 3, start_date: '2026-10-20', end_date: '2026-10-22',
    price_breakdown: { total: 3300000, deposit: 330000, local: 2970000 } };
assert.equal((await write('/api/reservations', 'POST', spotBookingInput)).status, 201);
const quoteForSpotBooking = async () => {
    const response = await apiRequest('/api/documents/itinerary/workspace-spots-check?format=quote&preview=1', { headers: admin });
    assert.equal(response.status, 200);
    return (await response.json()).quote;
};
assert.deepEqual((await quoteForSpotBooking()).highlights, revisedSpots);
const inheritedDays = productScheduleDays(updatedSpotProduct);
const savedSpotDocument = { name: spotProductInput.name, description: '예약별 대표 명소 스냅샷', days: inheritedDays,
    highlights: structuredClone(updatedSpotProduct.representativeSpots), documentSettings: {} };
assert.equal((await write('/api/reservations/workspace-spots-check', 'PUT', { document_content: savedSpotDocument })).status, 200);
assert.deepEqual(JSON.parse((await (await apiRequest('/api/reservations/workspace-spots-check', { headers: admin })).json()).documentContent), savedSpotDocument);
assert.deepEqual((await quoteForSpotBooking()).highlights, revisedSpots);
assert.equal((await write('/api/products/workspace-spots-product', 'PUT', { representativeSpots: [selectedSpots[1]] })).status, 200);
assert.deepEqual((await quoteForSpotBooking()).highlights, revisedSpots); // saved customer snapshot stays unchanged
const noCustomerSpots = { ...structuredClone(savedSpotDocument), highlights: [] };
assert.equal((await write('/api/reservations/workspace-spots-check', 'PUT', { document_content: noCustomerSpots })).status, 200);
assert.deepEqual((await quoteForSpotBooking()).highlights, []); // explicit empty beats nonempty product defaults
assert.equal((await write('/api/reservations/workspace-spots-check', 'PUT', { document_content: { ...noCustomerSpots, highlights: undefined } })).status, 200);
assert.deepEqual((await quoteForSpotBooking()).highlights, [selectedSpots[1]]); // older saved docs missing the field inherit
assert.equal((await write('/api/products/workspace-spots-product', 'PUT', { representativeSpots: [] })).status, 200);
assert.deepEqual((await (await apiRequest('/api/products/workspace-spots-product')).json()).representativeSpots, []);
assert.deepEqual((await quoteForSpotBooking()).highlights, []);
assert.equal((await write('/api/products/workspace-spots-product', 'PUT', { representativeSpots: revisedSpots })).status, 200);
raw.prepare('DELETE FROM reservations WHERE id=?').run('workspace-spots-check');

const catalog = await (await apiRequest('/api/products', { headers: admin })).json();
assert.equal(catalog.filter(product => product.name === productName).length, 2);
const before = await (await apiRequest('/api/reservations/workspace-product', { headers: admin })).json();
assert.equal(before.productId, 'workspace-booked-tour');
assert.equal(before.documentContent, null);
const previewBefore = await apiRequest('/api/documents/itinerary/workspace-product?format=quote&preview=1', { headers: admin });
assert.equal(previewBefore.status, 200);
assert.ok(!(await previewBefore.text()).includes('잘못 선택하면 안 되는'));

const checkDocument = structuredClone(savedDocument);
checkDocument.documentSettings = { contract: { includedText: '고객별 포함 조건', excludedText: '' } };
const originalDay = structuredClone(checkDocument.days[0]);
const originalContractSettings = structuredClone(checkDocument.documentSettings);
checkDocument.days[0].activities[0].time = '10:45';
checkDocument.days[0].activities[0].title = '고객별 확정 픽업 시간';
checkDocument.days[0].move = '2시간';
checkDocument.days[0].dist = '120km';
checkDocument.highlights = [structuredClone(publicLibraryFixtures.spots['거북바위'])];
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { document_content: checkDocument })).status, 200);
const detail = await (await apiRequest('/api/reservations/workspace-check', { headers: admin })).json();
assert.deepEqual(JSON.parse(detail.documentContent), checkDocument);
const customerContract = await (await apiRequest('/api/documents/contract/workspace-check')).json();
assert.deepEqual(customerContract.productIncluded, ['고객별 포함 조건']);
assert.deepEqual(customerContract.productExcluded, []);
assert.equal(customerContract.contractIncludedOverride, true);
assert.equal(customerContract.contractExcludedOverride, true);
const preview = await apiRequest('/api/documents/itinerary/workspace-check?format=quote&preview=1', { headers: admin });
assert.equal(preview.status, 200);
const pdf = (await preview.json()).quote;
assert.equal(pdf.price.total, 3300000);
assert.equal(pdf.price.deposit, 330000);
assert.equal(pdf.price.balanceFinal, 2970000);
assert.equal(pdf.pax, 3);
assert.equal(pdf.detailDays[0].activities[0].time, '10:45');
assert.equal(pdf.detailDays[0].activities[0].title, '고객별 확정 픽업 시간');
assert.equal(pdf.days[0].move, '2시간');
assert.equal(pdf.days[0].dist, '120km');
assert.equal(pdf.highlights[0].name, '거북바위');
assert.equal(pdf.highlights[0].nameMn, 'Мэлхий хад');
assert.equal(pdf.highlights[0].desc, checkDocument.highlights[0].desc);
assert.equal(pdf.highlights[0].img, image);
assert.deepEqual(pdf.highlights[0].subImgs, checkDocument.highlights[0].subImgs);
assert.equal(pdf.detailDays[0].activities[0].description, originalDay.activities[0].description);
assert.deepEqual(pdf.detailDays[0].activities[0].images, originalDay.activities[0].images);
assert.deepEqual(pdf.detailDays[0].activities.slice(1), originalDay.activities.slice(1));
assert.deepEqual(pdf.detailDays[0].images, originalDay.images);
assert.deepEqual(pdf.detailDays[0].images, ['/img/home/1.webp', image]);
assert.deepEqual(pdf.detailDays[0].activities[2].images, [lodgeImage]);
const sections = productDocumentSections(pdf);
assert.match(sections.details, /10:45|고객별 확정 픽업 시간/);
assert.ok(sections.details.includes(lodgeImage));
// Simulate a later inline edit of only travel time/distance. The exact document
// saved by the admin must remain authoritative for every customer PDF read.
const partialDocument = structuredClone(JSON.parse(detail.documentContent));
partialDocument.days[0].move = '3시간';
partialDocument.days[0].dist = '150km';
partialDocument.highlights[0].desc = '관리자가 수정한 최신 대표 명소 안내입니다.';
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { document_content: partialDocument })).status, 200);
const savedPartial = await (await apiRequest('/api/reservations/workspace-check', { headers: admin })).json();
const parsedPartial = JSON.parse(savedPartial.documentContent);
assert.deepEqual(parsedPartial, partialDocument);
assert.deepEqual(parsedPartial.documentSettings, originalContractSettings);
assert.deepEqual(parsedPartial.days[0].activities, checkDocument.days[0].activities);
assert.deepEqual(parsedPartial.days[0].images, originalDay.images);
assert.deepEqual(parsedPartial.days[0].accommodation, originalDay.accommodation);
const latestPdf = (await (await apiRequest('/api/documents/itinerary/workspace-check?format=quote&preview=1', { headers: admin })).json()).quote;
assert.equal(latestPdf.days[0].move, '3시간');
assert.equal(latestPdf.days[0].dist, '150km');
assert.equal(latestPdf.highlights[0].desc, partialDocument.highlights[0].desc);
assert.deepEqual(latestPdf.highlights[0].subImgs, checkDocument.highlights[0].subImgs);
assert.deepEqual(latestPdf.detailDays[0].activities, pdf.detailDays[0].activities);
assert.deepEqual(latestPdf.detailDays[0].images, pdf.detailDays[0].images);
const contractAfterPartial = await (await apiRequest('/api/documents/contract/workspace-check')).json();
assert.deepEqual(contractAfterPartial.productIncluded, customerContract.productIncluded);
assert.deepEqual(contractAfterPartial.productExcluded, customerContract.productExcluded);
// Deliberately clearing the list is a saved choice, never a request to restore
// sample spots or the booked product's original days.
const emptyHighlights = { ...structuredClone(partialDocument), highlights: [] };
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { document_content: emptyHighlights })).status, 200);
const noSpotsPdf = (await (await apiRequest('/api/documents/itinerary/workspace-check?format=quote&preview=1', { headers: admin })).json()).quote;
assert.deepEqual(noSpotsPdf.highlights, []);
assert.deepEqual(noSpotsPdf.detailDays[0].activities, latestPdf.detailDays[0].activities);
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { document_content: partialDocument })).status, 200);
const emptyDaysResponse = await apiRequest('/api/documents/itinerary/workspace-empty?preview=1', { headers: admin });
assert.equal(emptyDaysResponse.status, 200);
assert.deepEqual((await emptyDaysResponse.json()).days, []);
assert.equal((await apiRequest('/api/documents/itinerary/workspace-empty?format=quote&preview=1', { headers: admin })).status, 409);

// The shared quote STEP 2 stores compact text independently of rich activity
// metadata. A manual free-text date or deliberately blank date is authoritative.
const compactDocument = structuredClone(partialDocument);
const compactItems = ['*확정 픽업 안내*', '(날씨에 따라 초원 산책 장소가 조정됩니다)', '10:45 고객별 확정 픽업 시간'];
const compactMeals = '조식, 현지식당, 캠프식'.split(',').map(value => value.trim());
compactDocument.days[0].dateMode = 'manual';
compactDocument.days[0].date = '10.21 수요일';
compactDocument.days[0].items = compactItems;
compactDocument.days[0].accommodation.name = '한 칸에 입력한 테를지 게르 숙소';
compactDocument.days[0].meals = { breakfast: compactMeals[0], lunch: compactMeals[1], dinner: compactMeals[2] };
compactDocument.days[1].dateMode = 'manual';
compactDocument.days[1].date = '';
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { document_content: compactDocument })).status, 200);
const compactDetail = await (await apiRequest('/api/reservations/workspace-check', { headers: admin })).json();
const savedCompact = JSON.parse(compactDetail.documentContent);
assert.deepEqual(savedCompact, compactDocument);
assert.deepEqual(savedCompact.days[0].activities, partialDocument.days[0].activities);
assert.deepEqual(savedCompact.days[0].images, partialDocument.days[0].images);
assert.deepEqual(savedCompact.days[0].accommodation, { ...partialDocument.days[0].accommodation, name: compactDocument.days[0].accommodation.name });
assert.deepEqual(savedCompact.documentSettings, originalContractSettings);
// Round-trip actual API document content through the production recovery helpers.
// The VM runs the public quote helper without creating a browser or a server.
class LocalDraftStorage {
    values = new Map();
    getItem(key) { return this.values.get(String(key)) ?? null; }
    setItem(key, value) { this.values.set(String(key), String(value)); }
    removeItem(key) { this.values.delete(String(key)); }
}
const draftStorage = new LocalDraftStorage();
const draftContext = vm.createContext({ Storage: LocalDraftStorage, DOMException, Blob, URL, structuredClone,
    localStorage: draftStorage, location: { origin: localOrigin }, fetch: route => apiRequest(route, { headers: admin }) });
vm.runInContext(fs.readFileSync(path.join(root, 'public/quote-editor-state.js'), 'utf8'), draftContext);
const quoteDraftState = draftContext.QuoteEditorState;
assert.equal(await quoteDraftState.resolveAccount(), quoteDeskSession.userId);
const draftScope = { userId: quoteDeskSession.userId, reservationId: 'workspace-check' };
const documentSource = { content: savedCompact, dates: { startDate: compactDetail.startDate, endDate: compactDetail.endDate } };
const documentDraft = structuredClone(documentSource);
documentDraft.content.description = '로컬 문서 초안 복원 확인';
assert.equal(writeReservationDraft(draftStorage, draftScope, documentDraft, reservationDraftFingerprint(documentSource), 'contract').ok, true);
const restoredDocumentDraft = readReservationDraft(draftStorage, draftScope, documentSource);
assert.equal(restoredDocumentDraft.kind, 'draft');
assert.equal(restoredDocumentDraft.conflict, false);
assert.equal(restoredDocumentDraft.draft.mode, 'contract');
assert.deepEqual(restoredDocumentDraft.draft.content, documentDraft.content);
assert.deepEqual(restoredDocumentDraft.draft.dates, documentDraft.dates);
assert.equal(readReservationDraft(draftStorage, { ...draftScope, userId: 'workspace-other' }, documentSource).kind, 'empty');
const newerDocumentSource = structuredClone(documentSource);
newerDocumentSource.content.description = '서버의 다른 저장본';
assert.equal(readReservationDraft(draftStorage, draftScope, newerDocumentSource).conflict, true);
const quoteDraftScope = { account: quoteDeskSession.userId, kind: 'quote', requestId: 'workspace-quote' };
const quoteDraftSource = { customer: quoteFixture.name, days: quoteEditorDocument.days, spots: ['거북바위'], options: [], balances: [] };
const quoteDraft = { ...structuredClone(quoteDraftSource), customer: '로컬 견적 초안 복원 확인' };
assert.equal(quoteDraftState.write(draftStorage, quoteDraftScope, quoteDraftSource, quoteDraft).ok, true);
const restoredQuoteDraft = quoteDraftState.read(draftStorage, quoteDraftScope, quoteDraftSource, quoteDraftState.validQuote);
assert.equal(restoredQuoteDraft.kind, 'draft');
assert.equal(restoredQuoteDraft.conflict, false);
assert.deepEqual(JSON.parse(JSON.stringify(restoredQuoteDraft.value)), quoteDraft);
const bookingDraftScope = { ...quoteDraftScope, kind: 'booking' };
const bookingDraftSource = structuredClone(quoteFixture.booking);
const bookingDraft = { ...structuredClone(bookingDraftSource), days: structuredClone(quoteEditorDocument.days) };
assert.equal(quoteDraftState.write(draftStorage, bookingDraftScope, bookingDraftSource, bookingDraft).ok, true);
assert.equal(quoteDraftState.read(draftStorage, bookingDraftScope, bookingDraftSource, quoteDraftState.validBooking).kind, 'draft');

const blockedDraftUrl = new URL('/admin/reservations?localDraftStorage=blocked', localOrigin);
assert.equal(draftStorageBlocked(blockedDraftUrl), true);
assert.equal(draftStorageBlocked(new URL('/견적만들기.html', localOrigin), blockedDraftUrl.href), true);
assert.equal(draftStorageBlocked(new URL('/견적만들기.html', localOrigin), 'https://other.example.invalid/?localDraftStorage=blocked'), false);
assert.equal(draftStorageBlocked(new URL('/admin/reservations', localOrigin)), false);
assert.equal(draftStorageBlocked(new URL('/견적만들기.html?localDraftStorage=normal', localOrigin), blockedDraftUrl.href), false);
assert.ok(draftStorageFaultHtml('<!doctype html><head><script src="editor.js"></script></head>').indexOf(draftStorageFaultSource) < draftStorageFaultHtml('<!doctype html><head><script src="editor.js"></script></head>').indexOf('editor.js'));
vm.runInContext(draftStorageFaultSource, draftContext);
const scopedDraftKeys = [adminProductDraftKey({ userId: quoteDeskSession.userId, productId: 'workspace-booked-tour' }),
    reservationDraftKey(draftScope), quoteDraftState.keyFor(quoteDraftScope.account, quoteDraftScope.kind, quoteDraftScope.requestId),
    quoteDraftState.keyFor(bookingDraftScope.account, bookingDraftScope.kind, bookingDraftScope.requestId)];
for (const key of scopedDraftKeys) assert.throws(() => draftStorage.setItem(key, 'blocked'), { name: 'QuotaExceededError' });
draftStorage.setItem('normal-site-setting', 'kept');
assert.equal(draftStorage.getItem('normal-site-setting'), 'kept');
assert.equal(writeReservationDraft(draftStorage, draftScope, documentDraft, reservationDraftFingerprint(documentSource), 'itinerary').ok, false);
assert.equal(quoteDraftState.write(draftStorage, quoteDraftScope, quoteDraftSource, quoteDraft).ok, false);
assert.equal(quoteDraftState.write(draftStorage, bookingDraftScope, bookingDraftSource, bookingDraft).ok, false);
// A rejected update leaves the previously recoverable snapshot intact.
assert.equal(readReservationDraft(draftStorage, draftScope, documentSource).kind, 'draft');
assert.equal(quoteDraftState.read(draftStorage, quoteDraftScope, quoteDraftSource, quoteDraftState.validQuote).kind, 'draft');
const compactPreview = await apiRequest('/api/documents/itinerary/workspace-check?format=quote&preview=1', { headers: admin });
assert.equal(compactPreview.status, 200);
const compactPdf = (await compactPreview.json()).quote;
assert.equal(compactPdf.days[0].date, '10.21 수요일');
assert.equal(compactPdf.days[1].date, '');
assert.equal(compactPdf.detailDays[0].date, '10.21 수요일');
assert.equal(compactPdf.detailDays[1].date, '');
assert.deepEqual(compactPdf.days[0].items, compactItems);
assert.equal(compactPdf.days[0].stay.name, compactDocument.days[0].accommodation.name);
assert.deepEqual(compactPdf.days[0].meals, compactMeals);
assert.deepEqual(compactPdf.detailDays[0].activities, latestPdf.detailDays[0].activities);
assert.deepEqual(compactPdf.detailDays[0].images, latestPdf.detailDays[0].images);
assert.deepEqual(compactPdf.detailDays[0].accommodation, { ...latestPdf.detailDays[0].accommodation, name: compactDocument.days[0].accommodation.name });
assert.deepEqual(compactPdf.highlights, latestPdf.highlights);
const contractAfterCompact = await (await apiRequest('/api/documents/contract/workspace-check')).json();
assert.deepEqual(contractAfterCompact.productIncluded, customerContract.productIncluded);
assert.deepEqual(contractAfterCompact.productExcluded, customerContract.productExcluded);
const blankCompactItems = structuredClone(compactDocument);
blankCompactItems.days[0].items = [];
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { document_content: blankCompactItems })).status, 200);
const blankItemsPreview = await apiRequest('/api/documents/itinerary/workspace-check?format=quote&preview=1', { headers: admin });
assert.equal(blankItemsPreview.status, 200);
const blankItemsPdf = (await blankItemsPreview.json()).quote;
assert.deepEqual(blankItemsPdf.days[0].items, []);
assert.deepEqual(blankItemsPdf.detailDays[0].activities, compactPdf.detailDays[0].activities);
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { document_content: compactDocument })).status, 200);

assert.equal((await apiRequest('/api/documents/itinerary/workspace-check?format=quote')).status, 409);
assert.equal((await apiRequest('/api/documents/itinerary/workspace-check/publish', { method: 'POST', headers: admin })).status, 200);
assert.equal((await apiRequest('/api/documents/itinerary/workspace-check?format=quote')).status, 200);
for (const id of ['workspace-pending', 'workspace-empty']) {
    assert.equal((await apiRequest(`/api/documents/itinerary/${id}/publish`, { method: 'POST', headers: admin })).status, 409);
}

const operations = { joining: 'private', region: '테렐지', category: '초원 여행', vehicle: '로컬 차량',
    driverPhone: 'LOCAL-PRIVATE-DRIVER', receipt: { status: 'pending', number: '', issuedDate: '' }, opsNote: 'LOCAL-PRIVATE-OPS-NOTE' };
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { admin_operations: operations })).status, 200);
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { admin_operations: { receipt: { status: 'issued', number: 'LOCAL-RECEIPT', issuedDate: '2026-10-14' } } })).status, 200);
const privateDetail = await (await apiRequest('/api/reservations/workspace-check', { headers: admin })).json();
assert.equal(privateDetail.adminOperations.region, '테렐지');
assert.equal(privateDetail.adminOperations.receipt.status, 'issued');
assert.equal(privateDetail.adminOperations.opsNote, operations.opsNote);
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { admin_operations: { joining: 'invalid' } })).status, 400);
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { admin_operations: operations }, owner)).status, 403);
for (const route of ['/api/reservations', '/api/reservations/workspace-check']) {
    const ownerResponse = await apiRequest(route, { headers: owner });
    assert.equal(ownerResponse.status, 200);
    const text = await ownerResponse.text();
    assert.ok(!/adminOperations|admin_operations|LOCAL-PRIVATE-/.test(text));
}
assert.equal((await apiRequest('/api/reservations/workspace-check', { headers: other })).status, 403);
const publicPdf = await (await apiRequest('/api/documents/itinerary/workspace-check?format=quote')).text();
assert.ok(!publicPdf.includes('LOCAL-PRIVATE-'));
const publicCompactQuote = JSON.parse(publicPdf).quote;
assert.equal(publicCompactQuote.days[0].date, '10.21 수요일');
assert.equal(publicCompactQuote.days[1].date, '');
assert.deepEqual(publicCompactQuote.days[0].items, compactItems);
assert.equal(publicCompactQuote.days[0].stay.name, compactDocument.days[0].accommodation.name);
assert.deepEqual(publicCompactQuote.days[0].meals, compactMeals);
assert.deepEqual(publicCompactQuote.detailDays[0].activities, compactPdf.detailDays[0].activities);
assert.deepEqual(publicCompactQuote.detailDays[0].images, compactPdf.detailDays[0].images);
const mail = await write('/api/notifications/email', 'POST', { to: 'customer@example.invalid', type: 'ITINERARY_READY',
    data: { customerName: '로컬 검증 고객', reservationDbId: 'workspace-check', userId: 'workspace-owner', itineraryUrl: `${localOrigin}/documents/itinerary/workspace-check` } });
assert.equal(mail.status, 200);
assert.equal(outbound.length, 1);
const sentDocumentHistory = await (await apiRequest('/api/admin/deliveries?source=product&id=workspace-check', { headers: admin })).json();
assert.ok(sentDocumentHistory.items.some(item => item.kind === 'itinerary' && item.state === 'accepted' && item.providerId === 'local-email-1'));
raw.prepare('DELETE FROM reservations WHERE id=?').run('workspace-check');
raw.exec('DELETE FROM notifications');
outbound.length = 0;
const workspaceResponse = await apiRequest('/api/admin/workspace', { headers: admin });
assert.equal(workspaceResponse.status, 200);
const workspaceData = await workspaceResponse.json();
assert.equal(workspaceData.bookings.filter(booking => booking.type === 'product').length, 4);
assert.equal(workspaceData.bookings.filter(booking => booking.type === 'quote_booking').length, 1);
assert.equal(workspaceData.metrics.confirmedSales, 13200000);
assert.ok(Object.values(workspaceData.availability).every(Boolean));
assert.ok(workspaceData.searchItems.some(item => item.category === 'product'));
assert.equal((await apiRequest('/api/admin/workspace', { headers: owner })).status, 403);
assert.equal((await apiRequest('/api/admin/workspace')).status, 401);
console.log('예약 작업 API 검증 통과: 실제 로그인/견적 계정 · 견적 POST/PATCH/재조회 · 상품/견적 발송 이력 · 상품 ID · 공개 코스/명소 라이브러리 · 대표 명소 등록/조회/수정/예약 상속 · STEP 2 문서 저장/재조회 · 계정별 예약/견적 초안 복원/충돌 · 세 종류 초안 저장 실패 · 수동/빈 날짜와 강조/회색 문구 정본 · 숙소/식사 한 칸 입력 · 최신 이동/대표 명소 PDF · 원본 시간/사진/계약조건 보존 · 빈 배열 정본 · 공개 제한 · 관리자 운영정보 보호 · 외부 발송 차단');

if (process.argv.includes('--serve')) {
    const types = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css;charset=utf-8',
        '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2', '.json': 'application/json', '.mp4': 'video/mp4' };
    const findFile = (base, relative) => {
        const resolved = path.resolve(base, relative);
        return resolved.startsWith(base + path.sep) && fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? resolved : null;
    };
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, localOrigin);
            if (url.pathname === '/__local-admin') {
                res.writeHead(302, { Location: '/admin/reservations', 'Set-Cookie': `${admin.cookie}; Path=/; HttpOnly; SameSite=Lax; Secure`, 'Cache-Control': 'no-store' });
                res.end(); return;
            }
            if (url.pathname.startsWith('/api/')) {
                const chunks = []; for await (const chunk of req) chunks.push(chunk);
                const options = { method: req.method, headers: req.headers };
                if (chunks.length) options.body = Buffer.concat(chunks);
                let response;
                if (url.pathname === '/api/products' && fs.existsSync(path.join(scratch, 'products-unavailable'))) {
                    response = Response.json({ error: '로컬 검증: 상품 조회 실패' }, { status: 503 });
                } else if (url.pathname === '/api/__local-metrics') {
                    const who = await apiRequest('/api/auth/me', { headers: req.headers });
                    const session = await who.json();
                    response = session.user?.role === 'admin' ? Response.json({ emailStubCalls: outbound.length, liveCalls: 0 }) : Response.json({ error: 'Unauthorized' }, { status: 401 });
                } else response = await apiRequest(url.pathname + url.search, options);
                res.writeHead(response.status, { ...Object.fromEntries(response.headers), 'Cache-Control': 'no-store' });
                res.end(Buffer.from(await response.arrayBuffer())); return;
            }
            let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
            const publicRoot = path.join(root, 'public');
            const distRoot = path.join(root, 'dist');
            if (!path.extname(relative) && findFile(publicRoot, relative + '.html')) relative += '.html';
            let file = findFile(publicRoot, relative) || findFile(distRoot, relative);
            if (!file && path.extname(relative)) { res.writeHead(404); res.end('Local asset not found'); return; }
            file ||= path.join(distRoot, 'index.html');
            res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            // Opt-in local browser fault test; this script never serves production traffic.
            if (path.extname(file).toLowerCase() === '.html' && draftStorageBlocked(url, req.headers.referer)) {
                res.end(draftStorageFaultHtml(fs.readFileSync(file, 'utf8'))); return;
            }
            res.end(fs.readFileSync(file));
        } catch (error) { res.writeHead(500, { 'Content-Type': 'text/plain;charset=utf-8' }); res.end(String(error)); }
    });
    server.listen(port, '127.0.0.1', () => console.log(`예약 작업 로컬 검증: ${localOrigin}/__local-admin · admin@example.invalid / local-workspace-test-2026`));
} else raw.close();
