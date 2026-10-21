// Actual Hono/Lucia/D1-shaped SQLite routes for local reservation workspace QA.
// node scripts/check-reservation-workspace.mjs [--serve] [--usability] [--customer-workspace] [--customer-notices] [--calendar] [--port=8796]
// Uses only synthetic, in-memory data; never reaches a live delivery or storage service.
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
import { onRequestGet as libraryGet, onRequestPut as libraryPut } from '../functions/api/data/[key].js';
import { onRequestGet as quoteListGet, onRequestPost as quotePost } from '../functions/api/requests.js';
import { onRequestGet as customerQuoteGet } from '../functions/api/my/[token].js';
import { onRequestGet as noticeGet, onRequestPost as noticePost } from '../functions/api/requests/[id]/itinerary-notice.js';
import { adminProductDraftKey } from '../src/utils/adminProductDraft.ts';
import { reservationDraftKey, reservationDraftFingerprint, readReservationDraft, writeReservationDraft } from '../src/utils/adminReservationDraft.ts';
import { magazineDraftKey, magazineDraftFingerprint, readMagazineDraft, writeMagazineDraft } from '../src/utils/adminMagazineDraft.ts';
import { assignmentDraftKey, readAssignmentDraft, writeAssignmentDraft } from '../src/utils/adminAssignmentDraft.ts';

const root = path.resolve(import.meta.dirname, '..');
const portArgument = process.argv.find(argument => argument.startsWith('--port='));
const port = portArgument ? Number(portArgument.slice('--port='.length)) : 8795;
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('--port는 1~65535 사이의 정수여야 합니다.');
const localOrigin = `http://localhost:${port}`;
const usability = process.argv.includes('--usability');
const customerWorkspace = process.argv.includes('--customer-workspace');
const customerNotices = process.argv.includes('--customer-notices');
const calendar = process.argv.includes('--calendar');
const draftStoragePrefixes = ['inhasu:admin-product-draft:', 'inhasu:admin-reservation-doc-draft:', 'inhasu:quote-editor:',
    'inhasu:admin-magazine-draft:', 'inhasu:admin-assignment:'];
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
import customerAccess from '../../functions/api/customer-access';
import reservations from '../../functions/api/reservations';
import products from '../../functions/api/products';
import quotes from '../../functions/api/quotes';
import bookings from '../../functions/api/admin-bookings';
import workspace from '../../functions/api/admin-workspace';
import traffic from '../../functions/api/admin-traffic';
import deliveries from '../../functions/api/admin-deliveries';
import customerNotices from '../../functions/api/admin-customer-notices';
import assignments from '../../functions/api/admin-assignments';
import categories from '../../functions/api/categories';
import magazines from '../../functions/api/magazines';
import banners from '../../functions/api/banners';
import upload from '../../functions/api/site-upload';
import images from '../../functions/api/images/[...path]';
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
app.route('/customer-access', customerAccess);
app.route('/quotes', quotes); app.route('/admin/bookings', bookings); app.route('/documents', documents);
app.route('/admin/workspace', workspace); app.route('/admin/traffic', traffic); app.route('/admin/deliveries', deliveries); app.route('/categories', categories);
app.route('/admin/customer-notices', customerNotices);
app.route('/admin/assignments', assignments); app.route('/magazines', magazines); app.route('/banners', banners);
app.route('/site-upload', upload); app.route('/images', images);
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
assert.ok(raw.prepare('PRAGMA table_info(admin_delivery_attempts)').all().some(column => column.name === 'document_revision'));
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
    raw.prepare('INSERT INTO users (id,name,email,role,password_hash,google_id) VALUES (?,?,?,?,?,?)').run(id, '로컬 검증 계정', email, role, passwordHash, role === 'user' ? 'synthetic-google-' + id : null);
    raw.prepare('INSERT INTO sessions VALUES (?,?,?)').run(`local-${id}-session`, id, Date.now() + 86400000);
}
const admin = { cookie: 'auth_session=local-workspace-admin-session' };
raw.prepare('INSERT INTO categories (id,name,type) VALUES (?,?,?)').run('local-central', '중앙몽골', 'product');
raw.prepare('INSERT INTO categories (id,name,type) VALUES (?,?,?)').run('local-gobi', '고비사막', 'product');
const owner = { cookie: 'auth_session=local-workspace-owner-session' };
const other = { cookie: 'auth_session=local-workspace-other-session' };
// Exercise the actual upload/image routes with R2-shaped memory objects. Nothing
// is written to cloud storage, and uploaded photos disappear when this process exits.
const imageObjects = new Map();
const BUCKET = {
    async put(key, bytes, options = {}) {
        const body = new Uint8Array(bytes).slice();
        const digest = await crypto.subtle.digest('SHA-256', body);
        const httpEtag = '"' + Buffer.from(digest).toString('hex') + '"';
        imageObjects.set(key, { body, httpMetadata: { ...options.httpMetadata }, httpEtag });
    },
    async delete(key) { imageObjects.delete(key); },
    async get(key) {
        const stored = imageObjects.get(key);
        return stored ? { body: stored.body.slice(), size: stored.body.byteLength, httpEtag: stored.httpEtag,
            writeHttpMetadata(headers) {
                if (stored.httpMetadata.contentType) headers.set('Content-Type', stored.httpMetadata.contentType);
                if (stored.httpMetadata.cacheControl) headers.set('Cache-Control', stored.httpMetadata.cacheControl);
            } } : null;
    },
};
const env = { DB, BUCKET, ENVIRONMENT: 'production', ADMIN_TOKEN: 'local-workspace-quote-fixture',
    GOOGLE_CLIENT_SECRET: 'local-only-customer-link-fixture',
    RESEND_API_KEY: 'local-stub-key', ADMIN_EMAIL: 'admin@example.invalid', PAYPAL_ENABLED: 'false' };

// Never delegate to the real fetch. Local mail and opt-in Kakao outcomes are
// deterministic; every other request fails closed and cannot reach a live service.
const outbound = [];
globalThis.fetch = async (input, options = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    if (customerNotices && url === 'https://api.solapi.com/messages/v4/send') {
        const body = JSON.parse(options.body || '{}'), message = body.message || {};
        assert.equal(message.kakaoOptions?.disableSms, true, 'The local notification fixture never accepts an SMS fallback');
        assert.ok(String(message.kakaoOptions?.templateId || '').startsWith('local-notice-'));
        outbound.push({ provider: 'local-kakao-stub', templateId: message.kakaoOptions.templateId });
        if (fs.existsSync(path.join(scratch, 'kakao-slow'))) await new Promise(resolve => setTimeout(resolve, 1500));
        if (fs.existsSync(path.join(scratch, 'kakao-unavailable'))) return Response.json({ errorMessage: 'Local Kakao provider response unavailable' }, { status: 503 });
        if (fs.existsSync(path.join(scratch, 'kakao-rejected'))) return Response.json({ failedMessageList: [{ statusCode: 'LOCAL-REJECTED', statusMessage: 'Local synthetic rejection' }] }, { status: 422 });
        return Response.json({ groupId: `local-kakao-${outbound.filter(item => item.provider === 'local-kakao-stub').length}`, statusCode: '2000' });
    }
    if (customerNotices && /^https:\/\/api\.solapi\.com\/kakao\/v[12]\/templates\?limit=100$/.test(url)) {
        return Response.json({ templateList: ['quote', 'contract', 'itinerary', 'guidebook'].map(kind => ({
            templateId: `local-notice-${kind}`, name: `로컬 ${kind} 알림`, status: 'APPROVED', pfId: 'local-notice-profile',
            content: '#{고객명}님, #{회사명}의 로컬 검증용 안내입니다. #{링크}',
            buttons: [{ buttonType: 'WL', buttonName: '로컬 고객 문서 확인', linkMo: 'https://example.invalid/#{링크}', linkPc: 'https://example.invalid/#{링크}' }],
        })) });
    }
    if (url !== 'https://api.resend.com/emails') throw new Error('로컬 검증에서 외부 접속을 차단했습니다.');
    outbound.push({ provider: 'local-email-stub' });
    // Synthetic provider only. This script never contacts a real provider or serves production.
    const mail = JSON.parse(options.body || '{}');
    if (String(mail.subject || '').includes('기존 여행 기록 연결')) {
        console.log('LOCAL-MOCK-OTP:', String(mail.html || '').match(/>(\d{8})</)?.[1]);
    }
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
    else if (libraryMatch) { context.params = { key: decodeURIComponent(libraryMatch[1]) }; handler = { GET: libraryGet, PUT: libraryPut, POST: libraryPut }[method]; }
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
assert.equal((await apiRequest(`/api/my/${createdQuoteResponse.token}`)).status, 401);
const publicQuoteReloaded = await (await apiRequest(`/api/my/${createdQuoteResponse.token}`, { headers: quoteAdmin })).json();
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
const customerContract = await (await apiRequest('/api/documents/contract/workspace-check', { headers: owner })).json();
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
const contractAfterPartial = await (await apiRequest('/api/documents/contract/workspace-check', { headers: owner })).json();
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
const magazineDraftScope = { userId: quoteDeskSession.userId, magazineId: null };
const magazineDraftSource = { title: '', content: '', image: '', isActive: false };
const magazineDraft = { ...magazineDraftSource, title: '로컬 매거진 초안', content: '<p>저장 실패 후 복원</p>', image };
const magazineBase = magazineDraftFingerprint(magazineDraftSource);
assert.equal(writeMagazineDraft(draftStorage, magazineDraftScope, magazineDraft, magazineBase).ok, true);
assert.equal(readMagazineDraft(draftStorage, magazineDraftScope, magazineDraftSource).kind, 'draft');
assert.equal(readMagazineDraft(draftStorage, { ...magazineDraftScope, userId: 'workspace-other' }, magazineDraftSource).kind, 'empty');
const assignmentDraftScope = { userId: quoteDeskSession.userId, source: 'product', id: 'workspace-product' };
const assignmentDraft = { guide: { id: 'workspace-guide', name: '로컬 가이드' }, vehicle: { type: '하이스', phone: 'LOCAL-PRIVATE-DRAFT-DRIVER' },
    accommodations: [{ day: 1, date: '2026-10-20', accommodation: { name: '로컬 숙소', images: [lodgeImage, 'blob:temporary'] } }] };
assert.equal(writeAssignmentDraft(draftStorage, assignmentDraftScope, 'local-base-version', assignmentDraft).ok, true);
assert.deepEqual(readAssignmentDraft(draftStorage, assignmentDraftScope, 'local-base-version').draft.assignment.accommodations[0].accommodation.images, [lodgeImage]);
assert.deepEqual(readAssignmentDraft(draftStorage, { ...assignmentDraftScope, source: 'quote_booking' }, 'local-base-version'), {});

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
    quoteDraftState.keyFor(bookingDraftScope.account, bookingDraftScope.kind, bookingDraftScope.requestId),
    magazineDraftKey(magazineDraftScope), assignmentDraftKey(assignmentDraftScope)];
for (const key of scopedDraftKeys) assert.throws(() => draftStorage.setItem(key, 'blocked'), { name: 'QuotaExceededError' });
draftStorage.setItem('normal-site-setting', 'kept');
assert.equal(draftStorage.getItem('normal-site-setting'), 'kept');
assert.equal(writeReservationDraft(draftStorage, draftScope, documentDraft, reservationDraftFingerprint(documentSource), 'itinerary').ok, false);
assert.equal(quoteDraftState.write(draftStorage, quoteDraftScope, quoteDraftSource, quoteDraft).ok, false);
assert.equal(quoteDraftState.write(draftStorage, bookingDraftScope, bookingDraftSource, bookingDraft).ok, false);
assert.equal(writeMagazineDraft(draftStorage, magazineDraftScope, { ...magazineDraft, title: '저장 실패 입력' }, magazineBase).ok, false);
assert.equal(writeAssignmentDraft(draftStorage, assignmentDraftScope, 'local-base-version', assignmentDraft).ok, false);
// A rejected update leaves the previously recoverable snapshot intact.
assert.equal(readReservationDraft(draftStorage, draftScope, documentSource).kind, 'draft');
assert.equal(quoteDraftState.read(draftStorage, quoteDraftScope, quoteDraftSource, quoteDraftState.validQuote).kind, 'draft');
assert.equal(readMagazineDraft(draftStorage, magazineDraftScope, magazineDraftSource).draft.form.title, '로컬 매거진 초안');
assert.equal(readAssignmentDraft(draftStorage, assignmentDraftScope, 'local-base-version').draft.assignment.guide.name, '로컬 가이드');
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
const contractAfterCompact = await (await apiRequest('/api/documents/contract/workspace-check', { headers: owner })).json();
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

assert.equal((await apiRequest('/api/documents/itinerary/workspace-check?format=quote', { headers: owner })).status, 409);
assert.equal((await apiRequest('/api/documents/itinerary/workspace-check/publish', { method: 'POST', headers: admin })).status, 200);
assert.equal((await apiRequest('/api/documents/itinerary/workspace-check?format=quote', { headers: owner })).status, 200);
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
const publicPdf = await (await apiRequest('/api/documents/itinerary/workspace-check?format=quote', { headers: owner })).text();
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
assert.match(sentDocumentHistory.documents.itinerary.revision, /^[a-f0-9]{64}$/);
assert.equal(sentDocumentHistory.documents.itinerary.lastSentRevision, sentDocumentHistory.documents.itinerary.revision);
assert.equal(sentDocumentHistory.documents.itinerary.verified, true);
assert.equal(sentDocumentHistory.documents.itinerary.needsResend, false);
assert.match(raw.prepare('SELECT document_revision FROM admin_delivery_attempts WHERE booking_id=?').get('workspace-check').document_revision, /^[a-f0-9]{64}$/);
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { admin_operations: { opsNote: 'LOCAL-PRIVATE-REVISION-NOTE' } })).status, 200);
const privateRevision = await (await apiRequest('/api/admin/deliveries?source=product&id=workspace-check', { headers: admin })).json();
assert.equal(privateRevision.documents.itinerary.revision, sentDocumentHistory.documents.itinerary.revision);
const changedDocument = { ...structuredClone(compactDocument), description: '발송 후 수정한 고객 일정 안내' };
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { document_content: changedDocument })).status, 200);
const changedRevision = await (await apiRequest('/api/admin/deliveries?source=product&id=workspace-check', { headers: admin })).json();
assert.notEqual(changedRevision.documents.itinerary.revision, sentDocumentHistory.documents.itinerary.revision);
assert.equal(changedRevision.documents.itinerary.needsResend, true);
assert.equal(changedRevision.documents.itinerary.lastSentRevision, sentDocumentHistory.documents.itinerary.revision);
assert.equal((await write('/api/reservations/workspace-check', 'PUT', { total_amount: 0, deposit_amount: 0, balance_amount: 0, total_people: 4 })).status, 200);
const amountRevision = await (await apiRequest('/api/admin/deliveries?source=product&id=workspace-check', { headers: admin })).json();
assert.notEqual(amountRevision.documents.contract.revision, changedRevision.documents.contract.revision);
assert.notEqual(amountRevision.documents.itinerary.revision, changedRevision.documents.itinerary.revision);
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
// GA4 secrets are absent locally: the traffic API answers "not configured" without any outbound call.
assert.deepEqual(await (await apiRequest('/api/admin/traffic?period=7d', { headers: admin })).json(), { configured: false, period: '7d' });
assert.equal((await apiRequest('/api/admin/traffic?period=1y', { headers: admin })).status, 400);
assert.equal((await apiRequest('/api/admin/traffic', { headers: owner })).status, 403);
assert.equal((await apiRequest('/api/admin/traffic')).status, 401);

// The new assignment board talks to both original sources, never copying a
// booking into the other table. Check overlapping IDs and signed source safety.
assert.equal((await apiRequest('/api/admin/assignments')).status, 401);
assert.equal((await apiRequest('/api/admin/assignments', { headers: owner })).status, 403);
const originalSignedRow = raw.prepare('SELECT * FROM reservations WHERE id=?').get('workspace-signed');
const signedContract = { ...JSON.parse(originalSignedRow.contract_data),
    signature: 'LOCAL-PRIVATE-SIGNATURE', travelers: [{ name: '로컬 여행자', passportNo: 'LOCAL-PRIVATE-PASSPORT' }],
    vehicle: { type: '기존 로컬 차량', phone: 'LOCAL-PRIVATE-OLD-DRIVER' }, retained: '계약 추가 항목 보존' };
raw.prepare('UPDATE reservations SET contract_data=?,admin_operations=?,daily_accommodations=? WHERE id=?').run(
    JSON.stringify(signedContract), JSON.stringify({ opsNote: 'LOCAL-PRIVATE-ASSIGNMENT-NOTE' }),
    JSON.stringify([{ day: 1, date: '2026-10-20', accommodation: { name: '기존 숙소', images: [lodgeImage], privateNote: 'LOCAL-PRIVATE-LODGE-NOTE' } }]), 'workspace-signed');
const assignmentQuote = { ...structuredClone(quoteFixture), id: 'workspace-signed', token: 'local-assignment-quote-token',
    booking: { ...structuredClone(quoteFixture.booking), days: structuredClone(quoteEditorDocument.days),
        travelers: [{ name: '로컬 여행자', passportNo: 'LOCAL-PRIVATE-QUOTE-PASSPORT' }],
        contract: { signedAt: '2026-10-18T00:00:00Z', signImg: 'LOCAL-PRIVATE-QUOTE-SIGNATURE',
            snapshot: { travelers: [{ passportNo: 'LOCAL-PRIVATE-SNAPSHOT' }] } },
        assign: { guide: { id: 'workspace-guide', name: '기존 견적 가이드', img: '/img/quote/guide.webp' },
            vehicle: { model: '기존 견적 차량', plate: 'LOCAL-PRIVATE-PLATE', phone: 'LOCAL-PRIVATE-QUOTE-DRIVER' },
            lodges: [{ day: 1, date: '2026-10-25', name: '기존 견적 숙소', img: lodgeImage, imgs: [lodgeImage], tags: '샤워 가능',
                desc: '예약 당시 숙소 설명', bookingStatus: 'Баталгаажсан' }] } } };
raw.prepare('INSERT INTO requests (id,received_at,name,status,data,token) VALUES (?,?,?,?,?,?)')
    .run(assignmentQuote.id, quoteFixture.receivedAt, assignmentQuote.name, assignmentQuote.status, JSON.stringify(assignmentQuote), assignmentQuote.token);
const assignmentResponse = await apiRequest('/api/admin/assignments', { headers: admin });
assert.equal(assignmentResponse.status, 200);
assert.equal(assignmentResponse.headers.get('cache-control'), 'private, no-store');
const assignmentText = await assignmentResponse.text(), assignmentData = JSON.parse(assignmentText);
assert.deepEqual(assignmentData.warnings, []);
assert.deepEqual(assignmentData.availability, { product: true, quote_booking: true });
assert.deepEqual(new Set(assignmentData.items.filter(item => item.id === 'workspace-signed').map(item => item.key)),
    new Set(['product:workspace-signed', 'quote_booking:workspace-signed']));
assert.ok(!/LOCAL-PRIVATE-(SIGNATURE|PASSPORT|QUOTE-PASSPORT|QUOTE-SIGNATURE|SNAPSHOT|ASSIGNMENT-NOTE|LODGE-NOTE|PLATE)|local-assignment-quote-token/.test(assignmentText));
for (const source of ['product', 'quote_booking']) {
    const item = assignmentData.items.find(row => row.id === 'workspace-signed' && row.source === source);
    const updated = structuredClone(item.assignment);
    updated.guide.name = source === 'product' ? '새 상품 가이드' : '새 견적 가이드';
    updated.vehicle = { type: '새 로컬 검증 차량', phone: 'LOCAL-PRIVATE-NEW-DRIVER' };
    updated.accommodations[0].accommodation.roomCount = 2;
    const route = `/api/admin/assignments/${source}/workspace-signed`;
    assert.equal((await write(route, 'PATCH', { expectedVersion: item.version, assignment: updated })).status, 200);
    assert.equal((await write(route, 'PATCH', { expectedVersion: item.version, assignment: updated })).status, 409);
}
const updatedSignedRow = raw.prepare('SELECT * FROM reservations WHERE id=?').get('workspace-signed');
const updatedSignedContract = JSON.parse(updatedSignedRow.contract_data);
assert.deepEqual({ ...updatedSignedContract, vehicle: undefined }, { ...signedContract, vehicle: undefined });
assert.equal(updatedSignedContract.vehicle.type, '새 로컬 검증 차량');
assert.equal(updatedSignedContract.vehicle.phone, JSON.parse(updatedSignedRow.admin_operations).driverPhone);
assert.equal(JSON.parse(updatedSignedRow.daily_accommodations)[0].accommodation.privateNote, 'LOCAL-PRIVATE-LODGE-NOTE');
assert.equal(updatedSignedRow.document_content, originalSignedRow.document_content);
const updatedAssignmentQuote = JSON.parse(raw.prepare('SELECT data FROM requests WHERE id=?').get('workspace-signed').data);
const immutableQuote = rec => ({ ...rec, booking: { ...rec.booking, assign: undefined } });
assert.deepEqual(immutableQuote(updatedAssignmentQuote), immutableQuote(assignmentQuote));
assert.equal(updatedAssignmentQuote.booking.assign.guide.img, assignmentQuote.booking.assign.guide.img);
assert.equal(updatedAssignmentQuote.booking.assign.lodges[0].tags, '샤워 가능');
assert.equal(updatedAssignmentQuote.booking.assign.lodges[0].roomCount, 2);
for (const route of ['/api/reservations/workspace-signed', '/api/documents/itinerary/workspace-signed?format=quote', '/api/documents/contract/workspace-signed']) {
    const response = await apiRequest(route, { headers: owner });
    assert.equal(response.status, 200);
    assert.ok(!(await response.text()).includes('LOCAL-PRIVATE-NEW-DRIVER'), `기사 개인 연락처는 고객 응답에서 제외: ${route}`);
}
raw.prepare('INSERT INTO customer_resource_links VALUES(?,?,?,?)').run('request', assignmentQuote.id, 'workspace-owner', new Date().toISOString());
const assignmentPublicQuote = await apiRequest(`/api/my/${assignmentQuote.token}`, { headers: owner });
assert.equal(assignmentPublicQuote.status, 200);
assert.ok(!(await assignmentPublicQuote.text()).includes('LOCAL-PRIVATE-NEW-DRIVER'));
const productAssignment = (await (await apiRequest('/api/admin/assignments', { headers: admin })).json()).items.find(item => item.key === 'product:workspace-signed');
assert.equal((await write('/api/admin/assignments/product/workspace-signed', 'PATCH', {
    expectedVersion: productAssignment.version, assignment: { ...productAssignment.assignment, vehicle: { type: '', phone: '' }, accommodations: [] },
})).status, 200);
const clearedProduct = raw.prepare('SELECT * FROM reservations WHERE id=?').get('workspace-signed');
assert.equal(JSON.parse(clearedProduct.contract_data).vehicle.type, '');
assert.equal(JSON.parse(clearedProduct.admin_operations).vehicle, '');
assert.deepEqual(JSON.parse(clearedProduct.daily_accommodations), []);
raw.prepare('UPDATE reservations SET contract_data=?,admin_operations=?,daily_accommodations=?,assigned_guide=? WHERE id=?')
    .run(originalSignedRow.contract_data, originalSignedRow.admin_operations, originalSignedRow.daily_accommodations, originalSignedRow.assigned_guide, 'workspace-signed');
raw.prepare('DELETE FROM requests WHERE id=?').run('workspace-signed');
assert.equal(outbound.length, 0, '배정 조회와 저장은 발송을 실행하지 않아야 한다');

// Actual image bytes and actual Hono auth/validation, backed solely by memory.
const uploadImageFixture = async (headers = admin, folder = 'banners', bytes = fs.readFileSync(path.join(root, 'public', image))) => {
    const form = new FormData(); form.set('folder', folder);
    form.set('file', new Blob([bytes], { type: 'image/webp' }), 'local-photo.webp');
    return apiRequest('/api/site-upload', { method: 'POST', headers, body: form });
};
assert.equal((await uploadImageFixture({})).status, 401);
assert.equal((await uploadImageFixture(owner)).status, 403);
assert.equal((await uploadImageFixture(admin, 'banners', Buffer.from('<html>not an image</html>'))).status, 415);
const uploaded = await uploadImageFixture(); assert.equal(uploaded.status, 200);
const uploadedImage = await uploaded.json(); assert.match(uploadedImage.url, /^\/api\/images\/banners\//);
const imageRead = await apiRequest(uploadedImage.url);
assert.equal(imageRead.status, 200); assert.equal(imageRead.headers.get('content-type'), 'image/webp');
assert.deepEqual(Buffer.from(await imageRead.arrayBuffer()), fs.readFileSync(path.join(root, 'public', image)));
assert.equal((await apiRequest(uploadedImage.url, { method: 'HEAD' })).status, 200);
assert.equal((await apiRequest(uploadedImage.url, { headers: { 'If-None-Match': imageRead.headers.get('etag') } })).status, 304);

const bannerFixture = {
    banners: [{ id: 'local-banner-terelj', image: uploadedImage.url, pcImage: image, title: '로컬 몽골 여행', subtitle: '테를지 초원', tag: 'LOCAL', link: '/products/workspace-booked-tour' },
        { id: 'local-banner-gobi', image: '/img/regions/khongor.webp', title: '로컬 고비사막 여행', subtitle: '배너 순서 확인', tag: 'LOCAL', link: '/products' }],
    quickLinks: [{ id: 'local-link', icon: 'travel_explore', label: '몽골 여행', path: '/products', image }],
    eventBanners: [{ id: 'local-promo', image, backgroundColor: '#0F766E', tag: '몽골 여행', title: '관리자 이미지 저장·새로고침 확인', link: '/custom-estimate', location: 'all' }],
    categoryTabs: [{ id: 'local-tab', name: '중앙몽골', title: '테를지 여행', subtitle: '지역별 여행', bannerImage: image }],
};
assert.equal((await write('/api/banners', 'PUT', bannerFixture, owner)).status, 403);
assert.equal((await write('/api/banners', 'PUT', bannerFixture)).status, 200);
const bannerReload = await (await apiRequest('/api/banners')).json();
assert.deepEqual(bannerReload.banners.map(row => row.id), bannerFixture.banners.map(row => row.id));
assert.equal(bannerReload.banners[0].image, uploadedImage.url);
assert.equal(bannerReload.eventBanners[0].image, image);

assert.equal((await write('/api/categories/local-central', 'PUT', { description: '부분 수정 보존 확인', image,
    landing_hero_images: [image, lodgeImage], landing_hero_title: '중앙몽골 여행', is_active: 1 })).status, 200);
assert.equal((await write('/api/categories/local-central', 'PUT', { is_active: 0, order: 0 })).status, 200);
const categoryReload = await (await apiRequest('/api/categories', { headers: admin })).json();
const preservedCategory = categoryReload.find(row => row.id === 'local-central');
assert.equal(preservedCategory.name, '중앙몽골'); assert.equal(preservedCategory.description, '부분 수정 보존 확인');
assert.deepEqual(preservedCategory.landing_hero_images, [image, lodgeImage]);
assert.equal(preservedCategory.is_active, 0); assert.equal(preservedCategory.sort_order, 0);
assert.equal((await write('/api/categories/missing-local-category', 'PUT', { is_active: 1 })).status, 404);
assert.equal((await write('/api/categories/reorder', 'PUT', { type: 'product', items: [{ id: 'local-central', sort_order: 0 }] })).status, 409);
const categoryOrder = { type: 'product', items: [{ id: 'local-gobi', sort_order: 0 }, { id: 'local-central', sort_order: 1 }] };
assert.equal((await write('/api/categories/reorder', 'PUT', categoryOrder, owner)).status, 403);
assert.equal((await write('/api/categories/reorder', 'PUT', categoryOrder)).status, 200);
assert.deepEqual((await (await apiRequest('/api/categories?type=product', { headers: admin })).json()).map(row => row.id), ['local-gobi', 'local-central']);
assert.equal((await write('/api/categories/local-central', 'PUT', { is_active: 1 })).status, 200);

const magazineFixture = { id: 'workspace-magazine-check', title: '로컬 매거진 검증', subtitle: '발행 상태 보존 확인',
    content: '<p>합성 콘텐츠입니다. 실제 고객 자료를 포함하지 않습니다.</p>', thumbnail: image, category: '중앙몽골', author: '로컬 검증' };
assert.equal((await write('/api/magazines', 'POST', magazineFixture, owner)).status, 403);
assert.equal((await write('/api/magazines', 'POST', magazineFixture)).status, 200);
assert.equal((await apiRequest('/api/magazines/workspace-magazine-check')).status, 404);
assert.equal((await apiRequest('/api/magazines/workspace-magazine-check', { headers: admin })).status, 200);
assert.equal((await write('/api/magazines/workspace-magazine-check', 'PUT', { ...magazineFixture, is_published: true })).status, 200);
const publishedMagazine = await (await apiRequest('/api/magazines/workspace-magazine-check')).json();
assert.equal(publishedMagazine.is_published, 1); assert.equal(publishedMagazine.thumbnail, image);
assert.equal((await apiRequest('/api/magazines/workspace-magazine-check', { method: 'DELETE', headers: admin })).status, 200);

if (usability) {
    // Add after the exact baseline assertions so the original regression checks
    // stay unchanged. All names, contacts, signatures and images are synthetic.
    const guideRows = [
        { id: 'workspace-guide', name: '로컬 한국어 가이드', phone: 'LOCAL-GUIDE-PHONE', image: '/img/quote/guide.webp' },
        { id: 'workspace-guide-duplicate', name: '로컬 한국어 가이드', phone: 'LOCAL-GUIDE-DUPLICATE', image: '/img/quote/guide.webp' },
        { id: 'workspace-guide-gobi', name: '로컬 고비 가이드', phone: 'LOCAL-GOBI-GUIDE', image: '/img/quote/guide.webp' },
    ];
    for (const guide of guideRows) assert.equal((await write('/api/tour-guides', 'POST', {
        ...guide, bio: '중복 이름과 예약 날짜 겹침을 확인하는 로컬 가이드', languages: ['한국어', '몽골어'],
        specialties: ['중앙몽골'], experience_years: 5,
    })).status, 200);
    assert.equal((await apiRequest('/api/tour-guides')).status, 401);
    assert.equal((await apiRequest('/api/tour-guides', { headers: owner })).status, 403);
    const guideList = await (await apiRequest('/api/tour-guides', { headers: admin })).json();
    assert.equal(guideList.filter(guide => guide.name === '로컬 한국어 가이드').length, 2);

    const lodgeRows = [
        { id: 'workspace-lodge-terelj', name: '로컬 테를지 게르 캠프', location: '중앙몽골', type: '게르',
            images: [lodgeImage, image], description: '사진·객실·예약 상태 보존 확인 숙소', facilities: ['샤워', '전기'], is_active: 1 },
        { id: 'workspace-lodge-gobi', name: '로컬 고비 게르 캠프', location: '고비사막', type: '게르',
            images: [lodgeImage], description: '견적 예약 숙소 배정 확인용', facilities: ['공용 샤워'], is_active: 1 },
    ];
    assert.equal((await write('/api/accommodations/bulk', 'POST', { accommodations: lodgeRows })).status, 200);
    const libraryResources = {
        guides: {
            '로컬 한국어 가이드': { id: 'workspace-guide', name: '로컬 한국어 가이드', phone: 'LOCAL-KV-GUIDE-PHONE',
                img: '/img/quote/guide.webp', desc: '상품 가이드 목록과 동일한 이름의 견적 리소스', role: '한국어 가이드' },
            '로컬 고비 가이드': { id: 'workspace-guide-gobi', name: '로컬 고비 가이드', phone: 'LOCAL-KV-GOBI-PHONE',
                img: '/img/quote/guide.webp', desc: '고비사막 가이드 소개' },
        },
        lodges: Object.fromEntries(lodgeRows.map(lodge => [lodge.name, { id: lodge.id, name: lodge.name, region: lodge.location,
            grade: lodge.type, img: lodge.images[0], imgs: lodge.images, desc: lodge.description,
            tags: lodge.facilities.join(', '), facilities: lodge.facilities, contact: 'LOCAL-PRIVATE-LODGE-CONTACT' }])),
        lodge_cats: ['중앙몽골', '고비사막'],
        vehicles: { '로컬 하이스': { model: '로컬 하이스', seats: '6인', luggage: '캐리어 4개', img: image,
            desc: '로컬 차량 사진과 안내' } },
    };
    for (const [key, value] of Object.entries(libraryResources)) {
        assert.equal((await write(`/api/data/${key}`, 'PUT', value, quoteAdmin)).status, 200);
        const loaded = await (await apiRequest(`/api/data/${key}`, { headers: quoteAdmin })).json();
        assert.deepEqual(loaded.data, value);
    }
    const publicGuides = await (await apiRequest('/api/data/guides')).text();
    assert.ok(!publicGuides.includes('LOCAL-KV-GUIDE-PHONE'));

    for (let index = 1; index <= 10; index++) {
        const id = `workspace-usability-${String(index).padStart(2, '0')}`;
        const status = index === 3 ? 'pending_payment' : index === 7 ? 'cancelled' : index === 10 ? 'completed' : 'confirmed';
        const start = index <= 4 ? '2026-10-20' : index <= 8 ? '2026-10-25' : '2026-10-16';
        const end = index <= 4 ? '2026-10-22' : index <= 8 ? '2026-10-27' : '2026-10-18';
        const assigned = index % 3 !== 0;
        const guide = guideRows[index === 2 ? 1 : index % 3 === 2 ? 2 : 0];
        const signed = index === 2 || index === 8;
        const contract = { travelers: [{ name: `합성 여행자 ${index}`, passportName: `LOCAL TRAVELER ${index}`, gender: '남성' }],
            vehicle: { type: assigned ? '로컬 하이스' : '', phone: assigned ? 'LOCAL-PRIVATE-USABILITY-DRIVER' : '' },
            ...(signed ? { agreement: { agreed: true, name: `합성 여행자 ${index}`, agreedAt: '2026-10-18T00:00:00Z' },
                customerSubmittedAt: '2026-10-18T00:00:00Z' } : {}) };
        const lodges = assigned ? [{ day: 1, date: start, accommodation: { ...lodgeRows[0], roomCount: 2,
            occupancy: '2인실', bookingStatus: index % 2 ? 'Баталгаажсан' : 'Шалгаж байна' } }] : [];
        insertReservation.run(id, 'workspace-booked-tour', productName, `합성 예약 고객 ${String(index).padStart(2, '0')}`,
            `local-${index}@example.invalid`, '01000000000', index % 4 + 1, start, end, status,
            index === 4 ? 0 : 3300000, index === 4 ? 0 : 330000, index === 4 ? 0 : 2970000,
            status === 'pending_payment' ? 'unpaid' : 'paid', status === 'completed' ? 'paid' : 'unpaid', `LOCAL-QA-${index}`,
            index % 2 === 0 ? JSON.stringify(savedDocument) : null, JSON.stringify(contract),
            assigned ? JSON.stringify(guide) : null, JSON.stringify(lodges), 0, null, null, 'workspace-owner',
            `2026-10-${String(index + 8).padStart(2, '0')}T01:00:00Z`, 'website');
    }
    // Same source ID in reservations and requests is intentional. Both rows must
    // remain separately searchable and editable in the unified list/assignment board.
    const assignedQuote = { ...structuredClone(quoteFixture),
        booking: { ...structuredClone(quoteFixture.booking), days: structuredClone(quoteEditorDocument.days),
            assign: { guide: { id: 'workspace-guide', name: guideRows[0].name, phone: 'LOCAL-KV-GUIDE-PHONE', img: guideRows[0].image },
                vehicle: { model: '로컬 하이스', phone: 'LOCAL-PRIVATE-USABILITY-QUOTE-DRIVER', plate: 'LOCAL-PRIVATE-USABILITY-PLATE' },
                lodges: [{ ...libraryResources.lodges[lodgeRows[1].name], day: 1, date: '2026-10-25',
                    roomCount: 2, occupancy: '2인실', bookingStatus: 'Баталгаажсан' }] } } };
    raw.prepare('UPDATE requests SET data=? WHERE id=?').run(JSON.stringify(assignedQuote), assignedQuote.id);
    const sameIdQuote = { ...structuredClone(assignedQuote), id: 'workspace-product', name: '동일 ID 견적 예약 고객',
        token: 'local-same-id-quote-token', depart: '2026-10-20', return_: '2026-10-22' };
    sameIdQuote.booking.assign.lodges[0].date = sameIdQuote.depart;
    raw.prepare('INSERT INTO requests (id,received_at,name,phone,destination,status,data,token) VALUES (?,?,?,?,?,?,?,?)')
        .run(sameIdQuote.id, '2026-10-18T12:00:00Z', sameIdQuote.name, sameIdQuote.phone, sameIdQuote.destination,
            sameIdQuote.status, JSON.stringify(sameIdQuote), sameIdQuote.token);
    const inquiry = { id: 'workspace-usability-inquiry', name: '합성 신규 견적 문의', status: '신규', destination: '중앙몽골',
        depart: '2026-11-01', return_: '2026-11-03', adult: 2, receivedAt: '2026-10-19T00:00:00Z', token: 'local-inquiry-fixture-token' };
    raw.prepare('INSERT INTO requests(id,received_at,name,destination,status,data,token) VALUES(?,?,?,?,?,?,?)')
        .run(inquiry.id, inquiry.receivedAt, inquiry.name, inquiry.destination, inquiry.status, JSON.stringify(inquiry), inquiry.token);

    for (const [id, name, type, active] of [
        ['local-khuvsgul', '홉스골', 'product', 1], ['local-hidden', '비공개 테스트 지역', 'product', 0],
        ['local-mag-travel', '여행 이야기', 'magazine', 1], ['local-mag-spot', '명소 이야기', 'magazine', 1],
    ]) assert.equal((await write('/api/categories', 'POST', { id, name, type, is_active: active,
        image, landing_hero_image: image, landing_hero_images: [image, lodgeImage], landing_hero_title: `${name} 로컬 여행`,
        description: '저장·활성화·순서 변경 검증용 카테고리', sort_order: type === 'product' ? (active ? 2 : 3) : (id.endsWith('travel') ? 0 : 1),
    })).status, 200);
    for (const [index, published] of [[1, true], [2, false], [3, true]]) {
        assert.equal((await write('/api/magazines', 'POST', { ...magazineFixture, id: `workspace-magazine-${index}`,
            title: published ? `로컬 몽골 여행 매거진 ${index}` : '로컬 작성 중 매거진', category: index === 3 ? '명소 이야기' : '여행 이야기',
            content: '<p>로컬 QA 합성 콘텐츠입니다.</p><p>발행 여부와 카테고리 저장 후 재조회합니다.</p>', is_published: published,
        })).status, 200);
    }
    const adminMagazines = await (await apiRequest('/api/magazines', { headers: admin })).json();
    const publicMagazines = await (await apiRequest('/api/magazines')).json();
    assert.equal(adminMagazines.length, 3); assert.equal(publicMagazines.length, 2);
    assert.ok(!publicMagazines.some(row => row.id === 'workspace-magazine-2'));
    const usabilityWorkspace = await (await apiRequest('/api/admin/workspace', { headers: admin })).json();
    assert.equal(usabilityWorkspace.bookings.filter(row => row.type === 'product').length, 14);
    assert.equal(usabilityWorkspace.bookings.filter(row => row.type === 'quote_booking').length, 2);
    assert.equal(usabilityWorkspace.bookings.find(row => row.id === 'workspace-usability-04').totalAmount, 0);
    const usabilityAssignments = await (await apiRequest('/api/admin/assignments', { headers: admin })).json();
    assert.equal(usabilityAssignments.items.length, 16);
    assert.equal(usabilityAssignments.items.filter(row => row.id === 'workspace-product').length, 2);
    assert.equal(usabilityAssignments.items.find(row => row.key === 'quote_booking:workspace-quote').assignment.accommodations[0].accommodation.name, lodgeRows[1].name);
    assert.ok(usabilityWorkspace.searchItems.some(row => row.title === '합성 예약 고객 01'));
    assert.ok(usabilityWorkspace.searchItems.some(row => row.title === inquiry.name));
    assert.equal(outbound.length, 0);
    console.log('사용성 합성 데이터 검증 통과: 상품 예약 14건(추가 10건) · 견적 예약 2건 · 동일 ID 출처 분리 · 중복 가이드 · 견적 숙소 배정 · 매거진 공개/비공개 · 배너/카테고리 · 0원 정본');
}

if (customerWorkspace) {
    // Identity comes from account/source/record IDs, never a customer's name.
    // Two bookings belong to one account; a different account intentionally has
    // the same display name. One quote also reuses the first product booking ID.
    const customerName = '동명이인 로컬 고객';
    // Dedicated accounts keep this two-booking case independent of the older
    // baseline customer's four reservations and optional usability rows.
    const customerAccounts = [
        { id: 'workspace-customer-account-a', email: 'customer-a@example.invalid' },
        { id: 'workspace-customer-account-b', email: 'customer-b@example.invalid' },
    ];
    for (const account of customerAccounts) {
        raw.prepare('INSERT INTO users(id,name,email,role,password_hash,google_id) VALUES(?,?,?,?,?,?)')
            .run(account.id, customerName, account.email, 'user', passwordHash, 'synthetic-google-' + account.id);
        raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run(`local-${account.id}-session`, account.id, Date.now() + 86400000);
    }
    const customerOwner = { cookie: 'auth_session=local-workspace-customer-account-a-session' };
    const namesakeOwner = { cookie: 'auth_session=local-workspace-customer-account-b-session' };
    const productCustomerRows = [
        { id: 'workspace-customer-product-a', userId: customerAccounts[0].id, email: customerAccounts[0].email, total: 0, doc: null },
        { id: 'workspace-customer-product-b', userId: customerAccounts[0].id, email: customerAccounts[0].email, total: 2200000, doc: savedDocument },
        { id: 'workspace-customer-other', userId: customerAccounts[1].id, email: customerAccounts[1].email, total: 4400000, doc: null },
    ];
    for (const [index, row] of productCustomerRows.entries()) {
        insertReservation.run(row.id, 'workspace-booked-tour', productName, customerName, row.email, '01000000000', index + 1,
            '2026-10-25', '2026-10-27', 'confirmed', row.total, 0, row.total, 'paid', 'unpaid', `LOCAL-CUSTOMER-${index + 1}`,
            row.doc ? JSON.stringify(row.doc) : null, JSON.stringify({ travelers: [], manager: '로컬 담당자' }), null, '[]', 0,
            null, null, row.userId, '2026-10-19T02:00:00Z', 'website');
        assert.equal((await write(`/api/reservations/${row.id}`, 'PUT', { admin_operations: {
            opsNote: `LOCAL-PRIVATE-CUSTOMER-${index + 1}`, vehicle: '', driverPhone: '',
        } })).status, 200);
    }
    const ownerCustomerRows = await (await apiRequest('/api/reservations', { headers: customerOwner })).json();
    assert.deepEqual(new Set(ownerCustomerRows.map(row => row.id)),
        new Set(['workspace-customer-product-a', 'workspace-customer-product-b']));
    for (const id of ['workspace-customer-product-a', 'workspace-customer-product-b']) {
        const customerRead = await apiRequest(`/api/reservations/${id}`, { headers: customerOwner });
        assert.equal(customerRead.status, 200); assert.ok(!(await customerRead.text()).includes('LOCAL-PRIVATE-CUSTOMER-'));
        assert.equal((await apiRequest(`/api/reservations/${id}`, { headers: namesakeOwner })).status, 403);
    }
    assert.equal((await apiRequest('/api/reservations/workspace-customer-other', { headers: customerOwner })).status, 403);
    assert.equal((await apiRequest('/api/reservations/workspace-customer-other', { headers: namesakeOwner })).status, 200);
    assert.equal((await apiRequest('/api/reservations/workspace-customer-product-a')).status, 401);
    const zeroProduct = await (await apiRequest('/api/reservations/workspace-customer-product-a', { headers: admin })).json();
    assert.equal(zeroProduct.totalAmount, 0); assert.equal(zeroProduct.adminOperations.opsNote, 'LOCAL-PRIVATE-CUSTOMER-1');
    const productCustomerPreview = await apiRequest('/api/documents/itinerary/workspace-customer-product-a?preview=1&format=quote', { headers: admin });
    assert.equal(productCustomerPreview.status, 200);
    assert.equal((await productCustomerPreview.json()).quote.price.total, 0);

    const customerQuoteFixtures = [
        { id: 'workspace-customer-inquiry', name: '예약 전 로컬 문의 고객', status: '신규', quote: null },
        { id: 'workspace-customer-product-a', name: customerName, status: '진행중',
            quote: { ...structuredClone(quoteEditorDocument), customer: customerName, pax: 2, price: { total: 0, deposit: 0, balances: [{ pax: 2, economy: 0, full: 0 }] } } },
    ];
    for (const [index, fixture] of customerQuoteFixtures.entries()) {
        const memo = `LOCAL-PRIVATE-CUSTOMER-QUOTE-MEMO-${index + 1}`;
        const created = await write('/api/requests', 'POST', { ...fixture, source: 'walkin', phone: '01000000000',
            email: `local-workspace-quote-${index + 1}@example.invalid`, adult: 2, depart: '2026-11-01', return_: '2026-11-03',
            destination: '중앙몽골', memo, request: '고객 전용 화면에서 기존 문의·견적·문서 연결을 확인하는 합성 자료',
            receivedAt: '2026-10-19T03:00:00Z', silentQuote: true,
        }, quoteAdmin);
        assert.equal(created.status, 200); const createdData = await created.json(); assert.equal(createdData.ok, true);
        if (fixture.quote) assert.equal(createdData.notifications[0].status, 'silent');
        else assert.deepEqual(createdData.notifications, []);
        const route = `/api/requests/${fixture.id}`;
        for (const headers of [{}, owner, admin, { 'x-admin-token': 'wrong-local-token' }]) {
            assert.equal((await apiRequest(route, { headers })).status, 401);
        }
        const before = (await (await apiRequest(route, { headers: quoteAdmin })).json()).item;
        assert.equal(before.memo, memo); assert.equal(before.booking, undefined);
        // A consultation memo save must not accept a booking, lose the issued
        // quote, rotate its customer token, or notify anyone.
        const saved = await write(route, 'PATCH', { memo: `${memo}-SAVED`, silentQuote: true }, quoteAdmin);
        assert.equal(saved.status, 200); assert.deepEqual((await saved.json()).notifications, []);
        const after = (await (await apiRequest(route, { headers: quoteAdmin })).json()).item;
        assert.equal(after.memo, `${memo}-SAVED`); assert.deepEqual(after.quote, before.quote);
        assert.equal(after.token, before.token); assert.equal(after.status, before.status); assert.equal(after.booking, undefined);
        assert.equal((await apiRequest(`/api/my/${createdData.token}`)).status, 401);
        raw.prepare('INSERT INTO customer_resource_links VALUES(?,?,?,?)').run('request', fixture.id, 'workspace-customer-account-a', new Date().toISOString());
        const customerRead = await apiRequest(`/api/my/${createdData.token}`, { headers: customerOwner });
        assert.equal(customerRead.status, 200); const text = await customerRead.text(), safe = JSON.parse(text);
        assert.ok(!text.includes('LOCAL-PRIVATE-CUSTOMER-QUOTE-MEMO'));
        assert.equal(safe.booking, null); assert.deepEqual(safe.quote, fixture.quote);
        if (fixture.quote) assert.equal(safe.quote.price.total, 0);
        const inquiryLedger = await apiRequest(`/api/admin/deliveries?source=quote_booking&id=${encodeURIComponent(fixture.id)}`, { headers: admin });
        assert.equal(inquiryLedger.status, 200);
        assert.equal((await inquiryLedger.json()).workflow.accepted, false, 'Inquiry receipts must be readable without creating a booking');
    }
    const rawQuoteList = await (await apiRequest('/api/requests', { headers: quoteAdmin })).json();
    const quoteBookingList = await (await apiRequest('/api/admin/bookings/quote', { headers: admin })).json();
    for (const fixture of customerQuoteFixtures) {
        assert.ok(rawQuoteList.items.some(row => row.id === fixture.id));
        assert.ok(!quoteBookingList.items.some(row => row.id === fixture.id));
    }
    const legacyCustomerId = 'workspace-customer-product-a';
    const legacyNote = '로컬 이전 견적 안내 · 저장 원문 보존';
    const legacyDocument = { ...structuredClone(savedDocument), name: '이전 견적 저장 일정', description: '별도 quotes 원본 확인' };
    raw.prepare(`INSERT INTO quotes(id,user_id,type,name,phone,email,destination,headcount,period,status,admin_note,
        confirmed_price,deposit,confirmed_start_date,confirmed_end_date,document_content,created_at)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(legacyCustomerId, customerAccounts[0].id, 'personal',
            '이전 견적 고객 · 분리 확인', '01000000000', customerAccounts[0].email, '중앙몽골', '2명',
            '2026-10-25 ~ 2026-10-27', 'processing', legacyNote, 0, 0, '2026-10-25', '2026-10-27',
            JSON.stringify(legacyDocument), '2026-10-19T04:00:00Z');
    const legacyRead = await apiRequest(`/api/quotes/${legacyCustomerId}`, { headers: admin });
    assert.equal(legacyRead.status, 200);
    const legacySaved = await legacyRead.json();
    assert.equal(legacySaved.id, legacyCustomerId); assert.equal(legacySaved.status, 'processing');
    assert.equal(legacySaved.confirmedPrice, 0); assert.equal(legacySaved.deposit, 0); assert.equal(legacySaved.adminNote, legacyNote);
    assert.deepEqual(legacySaved.documentContent, legacyDocument);
    assert.deepEqual(legacySaved.itinerary.days, legacyDocument.days);
    assert.equal((await apiRequest('/api/quotes')).status, 401);
    const ownedLegacy = await (await apiRequest('/api/quotes', { headers: customerOwner })).json();
    assert.equal(ownedLegacy.filter(row => row.id === legacyCustomerId).length, 1);
    assert.equal((await (await apiRequest('/api/quotes', { headers: namesakeOwner })).json()).filter(row => row.id === legacyCustomerId).length, 0);
    const customerWorkspaceData = await (await apiRequest('/api/admin/workspace', { headers: admin })).json();
    assert.equal(customerWorkspaceData.bookings.filter(row => row.id.startsWith('workspace-customer-')).length, 3);
    assert.equal(customerWorkspaceData.inquiries.filter(row => row.type === 'quote_request' && customerQuoteFixtures.some(fixture => fixture.id === row.id)).length, 2);
    const legacyInquiry = customerWorkspaceData.inquiries.find(row => row.type === 'legacy_quote' && row.id === legacyCustomerId);
    assert.equal(legacyInquiry.status, 'processing');
    assert.equal(legacyInquiry.href, `/admin/customer-workspace/legacy-quote/${legacyCustomerId}`);
    assert.equal(customerWorkspaceData.inquiries.find(row => row.type === 'quote_request' && row.id === legacyCustomerId).href,
        `/admin/customer-workspace/quote/${legacyCustomerId}`);
    assert.equal(customerWorkspaceData.bookings.find(row => row.id === legacyCustomerId).href,
        `/admin/customer-workspace/product/${legacyCustomerId}`);
    assert.equal(customerWorkspaceData.bookings.find(row => row.id === 'workspace-customer-product-a').totalAmount, 0);
    assert.ok(customerWorkspaceData.searchItems.some(row => row.key === 'product:workspace-customer-product-a'));
    assert.ok(customerWorkspaceData.searchItems.some(row => row.key === 'quote_request:workspace-customer-product-a'));
    assert.ok(customerWorkspaceData.searchItems.some(row => row.key === 'legacy_quote:workspace-customer-product-a'));
    const customerAssignments = await (await apiRequest('/api/admin/assignments', { headers: admin })).json();
    assert.ok(customerAssignments.items.some(row => row.key === 'product:workspace-customer-product-a'));
    assert.ok(!customerAssignments.items.some(row => row.key === 'quote_booking:workspace-customer-product-a'));
    assert.equal(outbound.length, 0);
    console.log('고객 통합 작업 데이터 검증 통과: 예약 전 문의 · 견적 발행/미예약 · 동일 계정 상품 예약 2건 · 다른 계정 동명이인 · 상품/견적/이전 견적 같은 ID · 이전 견적 저장 일정·0원 · 상담 메모/권한/고객 링크 보존');
}

if (customerNotices) {
    assert.ok(customerWorkspace && usability, '--customer-notices requires --usability --customer-workspace');
    // These deliberately fake values exist only inside this in-memory server.
    // The global fetch above has no path to a real provider, even on rejection.
    Object.assign(env, {
        SOLAPI_API_KEY: 'local-customer-notice-key', SOLAPI_API_SECRET: 'local-customer-notice-secret',
        SOLAPI_PF_ID: 'local-notice-profile', SOLAPI_TEMPLATE_QUOTE_ID: 'local-notice-quote',
        SOLAPI_TEMPLATE_CONTRACT_ID: 'local-notice-contract', SOLAPI_TEMPLATE_ITINERARY_ID: 'local-notice-itinerary',
        SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID: 'local-notice-travel-notice', SOLAPI_DISABLE_SMS: 'Y',
        SOLAPI_TEMPLATE_REQUEST_RECEIVED_ID: 'local-notice-request-received', SOLAPI_TEMPLATE_CHANGE_REQUESTED_ID: 'local-notice-change-requested',
        SOLAPI_TEMPLATE_RESERVATION_REQUESTED_ID: 'local-notice-reservation-requested', SOLAPI_TEMPLATE_DEPOSIT_REQUESTED_ID: 'local-notice-deposit-requested',
        SOLAPI_TEMPLATE_TRAVELERS_REQUESTED_ID: 'local-notice-travelers-requested', SOLAPI_TEMPLATE_CONTRACT_SIGNED_ID: 'local-notice-contract-signed',
        SOLAPI_TEMPLATE_BOOKING_CONFIRMED_ID: 'local-notice-booking-confirmed',
        SITE_URL: localOrigin,
    });
    // Prepare saved, published documents directly in the fixture database. No
    // publishing endpoint or automatic notification runs while starting QA.
    raw.prepare('UPDATE reservations SET document_content=?,itinerary_url=? WHERE id=?')
        .run(JSON.stringify(savedDocument), `${localOrigin}/documents/itinerary/workspace-customer-other`, 'workspace-customer-other');
    const readyQuote = JSON.parse(raw.prepare('SELECT data FROM requests WHERE id=?').get('workspace-quote').data);
    readyQuote.booking = { ...readyQuote.booking, publishStatus: 'published', publishedAt: '2026-10-19T04:00:00Z' };
    raw.prepare('UPDATE requests SET data=? WHERE id=?').run(JSON.stringify(readyQuote), readyQuote.id);
    for (const [source, id, kinds] of [
        ['product', 'workspace-customer-other', ['contract', 'itinerary', 'travel_notice']],
        ['quote_booking', 'workspace-quote', ['quote', 'contract', 'itinerary', 'travel_notice']],
    ]) {
        const route = `/api/admin/customer-notices/${source}/${id}`;
        assert.equal((await apiRequest(route)).status, 401);
        assert.equal((await apiRequest(route, { headers: owner })).status, 403);
        const calls = outbound.length;
        const response = await apiRequest(route, { headers: admin });
        assert.equal(response.status, 200);
        const state = await response.json();
        assert.deepEqual(state.notices.map(item => item.kind), kinds);
        assert.ok(state.notices.filter(item => item.kind !== 'travel_notice').every(item => item.available), JSON.stringify(state.notices));
        assert.equal(state.notices.find(item => item.kind === 'travel_notice').available, false, 'Signing-completed template must not be offered before signing');
        assert.equal(state.automation.enabled, true);
        assert.equal(state.recipient.phone, '***-****-0000');
        assert.equal(outbound.length, calls, 'Reading notification availability must not dispatch anything');
    }
    // Smoke-test provider acceptance and idempotent receipt persistence on
    // disposable clones. Main UI fixtures retain no cooldown or prior attempt.
    const smokeProductId = 'workspace-notice-product-smoke';
    const productClone = { ...raw.prepare('SELECT * FROM reservations WHERE id=?').get('workspace-customer-other'),
        id: smokeProductId, reservation_number: 'LOCAL-NOTICE-SMOKE', user_id: null,
        customer_name: '로컬 알림 검증 고객', customer_email: 'notice-smoke@example.invalid' };
    const productColumns = Object.keys(productClone);
    raw.prepare(`INSERT INTO reservations (${productColumns.join(',')}) VALUES (${productColumns.map(() => '?').join(',')})`)
        .run(...productColumns.map(column => productClone[column]));
    const smokeQuote = { ...structuredClone(readyQuote), id: 'workspace-notice-quote-smoke',
        token: 'local-notice-quote-smoke-token', name: '로컬 견적 알림 검증 고객', email: 'quote-notice-smoke@example.invalid' };
    raw.prepare('INSERT INTO requests (id,received_at,name,phone,destination,status,data,token) VALUES (?,?,?,?,?,?,?,?)')
        .run(smokeQuote.id, smokeQuote.receivedAt, smokeQuote.name, smokeQuote.phone, smokeQuote.destination,
            smokeQuote.status, JSON.stringify(smokeQuote), smokeQuote.token);
    const smokeCalls = outbound.filter(item => item.provider === 'local-kakao-stub').length;
    for (const [source, id] of [['product', smokeProductId], ['quote_booking', smokeQuote.id]]) {
        const route = `/api/admin/customer-notices/${source}/${id}`;
        const body = { kind: 'contract', idempotencyKey: `local-notice-smoke-${source}` };
        const response = await write(route, 'POST', body, { ...admin, Origin: localOrigin });
        assert.equal(response.status, 200);
        const receipt = await response.json();
        assert.equal(receipt.state, 'accepted'); assert.equal(receipt.ok, true);
        assert.match(receipt.providerId, /^local-kakao-\d+$/);
        const calls = outbound.length;
        const repeated = await write(route, 'POST', body, { ...admin, Origin: localOrigin });
        assert.equal(repeated.status, 200); assert.equal((await repeated.json()).duplicate, true);
        assert.equal(outbound.length, calls, 'Retrying the same dispatch key must not call the provider');
        const ledger = await (await apiRequest(`/api/admin/deliveries?source=${source}&id=${id}`, { headers: admin })).json();
        assert.ok(ledger.items.some(item => item.id === receipt.id && item.state === 'accepted' && item.providerId === receipt.providerId));
        const state = await (await apiRequest(route, { headers: admin })).json();
        assert.equal(state.notices.find(item => item.kind === 'contract').lastAttempt.state, 'accepted');
        raw.prepare('DELETE FROM admin_delivery_attempts WHERE source=? AND booking_id=?').run(source, id);
    }
    raw.prepare('DELETE FROM reservations WHERE id=?').run(smokeProductId);
    raw.prepare('DELETE FROM requests WHERE id=?').run(smokeQuote.id);
    assert.equal(outbound.filter(item => item.provider === 'local-kakao-stub').length - smokeCalls, 2);
    console.log('고객 카카오 알림 검증 통과: 상품·견적 GET 발송 가능 · POST 모의 접수 2건 · 동일 키 중복 차단 · 발송 이력 재조회 · 실제 외부 접속 0건');
}
if (calendar) {
    // Added after every baseline/existing optional assertion: exact-count checks
    // above keep exercising the same fixtures. These are local synthetic records
    // only, and calendar reads must not create provider calls or mutate bookings.
    const outboundBeforeCalendar = outbound.length;
    const sharedGuide = { id: 'calendar-guide-shared', name: '캘린더 한국어 가이드', phone: 'LOCAL-CALENDAR-GUIDE-A' };
    const namesakeGuide = { id: 'calendar-guide-namesake', name: sharedGuide.name, phone: 'LOCAL-CALENDAR-GUIDE-B' };
    const calendarLodge = { id: 'calendar-lodge', name: '캘린더 초원 게르 캠프', type: '게르', location: '중앙몽골',
        bookingStatus: 'confirmed', roomCount: 2, occupancy: '2인실', images: [lodgeImage] };
    const calendarFixtures = [
        { id: 'calendar-shared-id', name: '김캘린더 · 상품팀', start: '2026-10-20', end: '2026-10-22', guide: sharedGuide,
            vehiclePhone: 'LOCAL-CALENDAR-SHARED-DRIVER', total: 3600000, deposit: 360000,
            lodges: [{ day: 1, date: '2026-10-20', accommodation: calendarLodge }, { day: 2, date: '2026-10-21', accommodation: calendarLodge }] },
        { id: 'calendar-lodge-gap', name: '숙소 중간 날짜 미배정팀', start: '2026-10-21', end: '2026-10-24', guide: namesakeGuide,
            vehiclePhone: 'LOCAL-CALENDAR-SHARED-DRIVER', total: 4800000, deposit: 480000,
            lodges: [{ day: 1, date: '2026-10-21', accommodation: calendarLodge }, { day: 3, date: '2026-10-23', accommodation: calendarLodge }] },
        { id: 'calendar-month-boundary', name: '월말 출발 · 다음 달 귀환팀', start: '2026-10-30', end: '2026-11-02', guide: namesakeGuide,
            vehiclePhone: 'LOCAL-CALENDAR-OTHER-DRIVER', total: 5100000, deposit: 510000,
            lodges: [1, 2, 3].map((day, index) => ({ day, date: ['2026-10-30', '2026-10-31', '2026-11-01'][index], accommodation: calendarLodge })) },
        { id: 'calendar-zero', name: '총액 0원 · 당일 투어', start: '2026-10-21', end: '2026-10-21', guide: null,
            vehiclePhone: '', total: 0, deposit: 0, lodges: [] },
        { id: 'calendar-no-date', name: '출발일 확인 필요팀', start: '', end: '', guide: null,
            vehiclePhone: '', total: 1200000, deposit: 120000, lodges: [] },
        { id: 'calendar-invalid-date', name: '잘못된 날짜 확인팀', start: '2026-02-30', end: '2026-03-02', guide: null,
            vehiclePhone: '', total: 2400000, deposit: 240000, lodges: [] },
        { id: 'calendar-reversed-date', name: '귀환일이 출발일보다 빠른 팀', start: '2026-10-24', end: '2026-10-22', guide: null,
            vehiclePhone: '', total: 2400000, deposit: 240000, lodges: [] },
        { id: 'calendar-cancelled', name: '취소 · 운영 건수 제외팀', start: '2026-10-20', end: '2026-10-22', guide: sharedGuide,
            vehiclePhone: 'LOCAL-CALENDAR-SHARED-DRIVER', total: 3600000, deposit: 360000, status: 'cancelled', lodges: [] },
    ];
    for (const fixture of calendarFixtures) {
        insertReservation.run(fixture.id, 'workspace-booked-tour', productName, fixture.name,
            `${fixture.id}@example.invalid`, '01000000000', 3, fixture.start, fixture.end, fixture.status || 'confirmed',
            fixture.total, fixture.deposit, Math.max(0, fixture.total - fixture.deposit),
            fixture.total === 0 ? 'unpaid' : 'paid', 'unpaid', `LOCAL-${fixture.id.toUpperCase()}`, JSON.stringify(savedDocument),
            JSON.stringify({ vehicle: { type: fixture.vehiclePhone ? '로컬 하이스' : '', phone: fixture.vehiclePhone }, travelers: [] }),
            fixture.guide ? JSON.stringify(fixture.guide) : null, JSON.stringify(fixture.lodges), 0, null, null,
            'workspace-owner', '2026-10-19T02:00:00Z', 'website');
    }
    // Both records deliberately share an ID, customer spelling and guide ID.
    // Source-qualified keys must keep two teams and their links distinct.
    const calendarQuote = { ...structuredClone(quoteFixture), id: 'calendar-shared-id', name: '김캘린더 · 견적팀',
        token: 'local-calendar-shared-quote-token', depart: '2026-10-21', return_: '2026-10-23',
        booking: { preparedAt: '2026-10-19', publishStatus: 'draft',
            contractInfo: { productName: '중앙몽골 맞춤 2박 3일', totalAmount: 2700000, depositAmount: 270000,
                balanceAmount: 2430000, depositStatus: '입금완료' }, days: [],
            assign: { guide: sharedGuide, vehicle: { model: '로컬 하이스', phone: 'LOCAL-CALENDAR-DIFFERENT-DRIVER' },
                lodges: [{ ...calendarLodge, day: 1, date: '2026-10-21' }] } } };
    raw.prepare('INSERT INTO requests (id,received_at,name,phone,destination,status,data,token) VALUES (?,?,?,?,?,?,?,?)')
        .run(calendarQuote.id, calendarQuote.receivedAt, calendarQuote.name, calendarQuote.phone, calendarQuote.destination,
            calendarQuote.status, JSON.stringify(calendarQuote), calendarQuote.token);
    raw.prepare(`INSERT INTO quotes(id,user_id,type,name,phone,email,destination,headcount,period,status,admin_note,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run('calendar-shared-id', 'workspace-owner', 'custom', '김캘린더 · 이전 문의',
        '01000000000', 'calendar-legacy@example.invalid', '중앙몽골', '2명', '2026-10-21 ~ 2026-10-23', 'processing',
        '견적 문의는 확정 운영 팀과 분리해야 합니다.', '2026-10-19T02:00:00Z');

    const productResponse = await apiRequest('/api/reservations', { headers: admin });
    assert.equal(productResponse.status, 200);
    const productRows = await productResponse.json();
    const calendarProducts = productRows.filter(row => row.id.startsWith('calendar-'));
    assert.equal(calendarProducts.length, calendarFixtures.length);
    const byCalendarId = id => calendarProducts.find(row => row.id === id);
    assert.equal(byCalendarId('calendar-zero').totalAmount, 0, 'A real zero total must reach the calendar unchanged');
    assert.equal(byCalendarId('calendar-month-boundary').endDate, '2026-11-02');
    assert.deepEqual(byCalendarId('calendar-lodge-gap').dailyAccommodations.map(day => day.day), [1, 3], 'A two-of-three-night gap remains explicit');
    assert.equal(byCalendarId('calendar-lodge-gap').dailyAccommodations[1].date, '2026-10-23');
    assert.notEqual(byCalendarId('calendar-shared-id').assignedGuide.id, byCalendarId('calendar-lodge-gap').assignedGuide.id,
        'Equal guide names cannot imply equal resource identities');
    assert.equal(byCalendarId('calendar-shared-id').assignedGuide.name, byCalendarId('calendar-lodge-gap').assignedGuide.name);
    assert.equal(byCalendarId('calendar-shared-id').adminOperations.driverPhone, byCalendarId('calendar-lodge-gap').adminOperations.driverPhone);
    assert.equal(byCalendarId('calendar-no-date').startDate, '');
    assert.equal(byCalendarId('calendar-invalid-date').startDate, '2026-02-30');
    assert.equal(byCalendarId('calendar-reversed-date').endDate, '2026-10-22');
    assert.equal(byCalendarId('calendar-cancelled').status, 'cancelled');
    const quoteResponse = await apiRequest('/api/admin/bookings/quote', { headers: admin });
    assert.equal(quoteResponse.status, 200);
    const calendarQuoteSummary = (await quoteResponse.json()).items.find(row => row.id === calendarQuote.id);
    assert.ok(calendarQuoteSummary);
    assert.equal(calendarQuoteSummary.assignedGuide.id, byCalendarId('calendar-shared-id').assignedGuide.id);
    assert.notEqual(calendarQuoteSummary.contractData.vehicle.phone, byCalendarId('calendar-shared-id').adminOperations.driverPhone,
        'The same vehicle model with another driver must not be labelled a proven vehicle clash');
    assert.equal(calendarQuoteSummary.dailyAccommodations[0].day, 1);
    const calendarAssignments = (await (await apiRequest('/api/admin/assignments', { headers: admin })).json()).items;
    assert.equal(calendarAssignments.find(row => row.key === 'quote_booking:calendar-shared-id').assignment.accommodations[0].date, '2026-10-21');
    assert.ok(calendarAssignments.some(row => row.key === 'product:calendar-shared-id'));
    const legacyRows = await (await apiRequest('/api/quotes', { headers: admin })).json();
    assert.ok(legacyRows.some(row => row.id === 'calendar-shared-id' && row.status === 'processing'));
    assert.equal((await apiRequest('/api/admin/bookings/quote', { headers: owner })).status, 403);
    assert.equal(outbound.length, outboundBeforeCalendar, 'Calendar fixture reads never send customer notifications');
    console.log('캘린더 합성 데이터 검증 통과: 월 경계 · 동일 가이드 ID 중복 · 동명 다른 가이드 · 동일 기사 연락처 · 같은 차종 다른 기사 · 3박 중 2박 배정 · 0원 · 미정/잘못된/역전 날짜 · 취소 · 세 출처 동일 ID · 외부 발송 0건');
}
console.log('예약 작업 API 검증 통과: 실제 로그인/견적 계정 · 견적 POST/PATCH/재조회 · 상품/견적 발송 이력·v5 문서 버전 · 상품 ID · 공개 코스/명소 라이브러리 · 대표 명소 등록/조회/수정/예약 상속 · STEP 2 문서 저장/재조회 · 계정별 예약/견적 초안 복원/충돌 · 상품·예약·견적·매거진·배정 초안 저장 실패 · 수동/빈 날짜와 강조/회색 문구 정본 · 숙소/식사 한 칸 입력 · 최신 이동/대표 명소 PDF · 원본 시간/사진/계약조건 보존 · 빈 배열 정본 · 공개 제한 · 배정 버전 충돌/서명·여행자 보존/기사 연락처 보호 · 실제 이미지 업로드/조회 · 배너·카테고리 부분 수정/순서/매거진 공개 · 외부 발송 차단');

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
            const url = new URL(req.url, `http://${req.headers.host || `localhost:${port}`}`);
            if (url.pathname === '/__local-admin') {
                res.writeHead(302, { Location: '/admin/reservations', 'Set-Cookie': `${admin.cookie}; Path=/; HttpOnly; SameSite=Lax; Secure`, 'Cache-Control': 'no-store' });
                res.end(); return;
            }
            if (url.pathname === '/__local-customer' || url.pathname === '/__local-anonymous') {
                const cookie = url.pathname === '/__local-customer'
                    ? `${owner.cookie}; Path=/; HttpOnly; SameSite=Lax; Secure`
                    : 'auth_session=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0';
                res.writeHead(302, { Location: encodeURI('/내견적.html?t=local-workspace-quote-token'), 'Set-Cookie': cookie, 'Cache-Control': 'no-store' });
                res.end(); return;
            }
            if (url.pathname.startsWith('/api/')) {
                const chunks = []; for await (const chunk of req) chunks.push(chunk);
                const options = { method: req.method, headers: req.headers };
                if (chunks.length) options.body = Buffer.concat(chunks);
                // Optional local files let browser QA hold uploads in flight or
                // return a retryable failure without replacing the success routes.
                if (url.pathname === '/api/site-upload' && fs.existsSync(path.join(scratch, 'uploads-slow'))) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                const writeMethod = !['GET', 'HEAD'].includes(req.method);
                const faults = [
                    ['uploads-unavailable', url.pathname === '/api/site-upload'],
                    ['banners-unavailable', url.pathname === '/api/banners'],
                    ['banner-save-unavailable', url.pathname === '/api/banners' && writeMethod],
                    ['categories-unavailable', url.pathname.startsWith('/api/categories')],
                    ['category-save-unavailable', url.pathname.startsWith('/api/categories') && writeMethod],
                    ['magazines-unavailable', url.pathname.startsWith('/api/magazines')],
                    ['assignments-unavailable', url.pathname.startsWith('/api/admin/assignments')],
                    ['customer-notices-unavailable', url.pathname.startsWith('/api/admin/customer-notices/') && !writeMethod],
                    ['calendar-reservations-unavailable', url.pathname === '/api/reservations' && !writeMethod],
                    ['calendar-quote-bookings-unavailable', url.pathname === '/api/admin/bookings/quote' && !writeMethod],
                    ['calendar-legacy-quotes-unavailable', url.pathname === '/api/quotes' && !writeMethod],
                ];
                const fault = faults.find(([name, applies]) => applies && fs.existsSync(path.join(scratch, name)));
                let response;
                if (fault) {
                    response = Response.json({ error: '로컬 검증: 일시적 조회·저장 실패' }, { status: 503 });
                } else if (url.pathname === '/api/products' && fs.existsSync(path.join(scratch, 'products-unavailable'))) {
                    response = Response.json({ error: '로컬 검증: 상품 조회 실패' }, { status: 503 });
                } else if (url.pathname === '/api/__local-metrics') {
                    const who = await apiRequest('/api/auth/me', { headers: req.headers });
                    const session = await who.json();
                    response = session.user?.role === 'admin' ? Response.json({
                        emailStubCalls: outbound.filter(item => item.provider === 'local-email-stub').length,
                        kakaoStubCalls: outbound.filter(item => item.provider === 'local-kakao-stub').length,
                        liveCalls: 0,
                    }) : Response.json({ error: 'Unauthorized' }, { status: 401 });
                } else response = await apiRequest(url.toString(), options);
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
