// Actual Hono/Lucia/D1-shaped SQLite routes for local reservation workspace QA.
// node scripts/check-reservation-workspace.mjs [--serve] — no production data or outbound network.
import { build } from 'esbuild';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { hashPassword } from '../functions/lib/password.ts';
import { productScheduleDays } from '../functions/lib/productItinerary.ts';
import { productDocumentSections } from '../public/product-itinerary.js';
import { onRequestGet as quoteGet } from '../functions/api/requests/[id].js';

const root = path.resolve(import.meta.dirname, '..');
const scratch = path.join(root, 'work/reservation-workspace');
fs.mkdirSync(scratch, { recursive: true });
const entry = path.join(scratch, 'entry.ts');
fs.writeFileSync(entry, `import { Hono } from 'hono';
import auth from '../../functions/api/auth';
import reservations from '../../functions/api/reservations';
import products from '../../functions/api/products';
import quotes from '../../functions/api/quotes';
import bookings from '../../functions/api/admin-bookings';
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
const apiRequest = (route, options = {}) => app.request(route, options, env);
const write = (route, method, data, headers = admin) => apiRequest(route, {
    method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

const productName = '테렐지 초원 여행 2박 3일';
const image = '/img/regions/terelj.webp';
const lodgeImage = '/img/quote/lodge-lux.webp';
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
        '[]', signed ? 1 : 0, signed ? `http://localhost:8795/documents/itinerary/${id}` : null,
        signed ? `http://localhost:8795/documents/contract/${id}` : null, 'workspace-owner', '2026-10-14T00:00:00Z', 'website');
}
raw.prepare('UPDATE reservations SET history=? WHERE id=?').run(JSON.stringify([
    { timestamp: '2026-10-14T00:00:00Z', type: 'email', description: '확정 일정표를 고객님께 발송했습니다.', detail: 'http://localhost:8795/documents/itinerary/workspace-signed' },
    { timestamp: '2026-10-14T00:01:00Z', type: 'email', description: '해외여행 계약서를 고객님께 발송했습니다.', detail: 'http://localhost:8795/documents/contract/workspace-signed' },
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
assert.equal((await apiRequest('/api/admin/bookings/quote', { headers: admin })).status, 200);
assert.equal((await apiRequest('/api/quotes', { headers: admin })).status, 200);
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
checkDocument.days[0].activities[0].time = '10:45';
checkDocument.days[0].activities[0].title = '고객별 확정 픽업 시간';
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
assert.deepEqual(pdf.detailDays[0].images, ['/img/home/1.webp', image]);
assert.deepEqual(pdf.detailDays[0].activities[2].images, [lodgeImage]);
const sections = productDocumentSections(pdf);
assert.match(sections.details, /10:45|고객별 확정 픽업 시간/);
assert.ok(sections.details.includes(lodgeImage));
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
const mail = await write('/api/notifications/email', 'POST', { to: 'customer@example.invalid', type: 'ITINERARY_READY',
    data: { customerName: '로컬 검증 고객', reservationDbId: 'workspace-check', userId: 'workspace-owner', itineraryUrl: 'http://localhost:8795/documents/itinerary/workspace-check' } });
assert.equal(mail.status, 200);
assert.equal(outbound.length, 1);
raw.prepare('DELETE FROM reservations WHERE id=?').run('workspace-check');
raw.exec('DELETE FROM notifications');
outbound.length = 0;
console.log('예약 작업 API 검증 통과: 실제 로그인 · 상품 ID · 문서 저장/재조회 · 금액/시간/사진 PDF · 공개 제한 · 관리자 운영정보 보호 · 외부 발송 차단');

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
            const url = new URL(req.url, 'http://localhost:8795');
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
                } else if (url.pathname.startsWith('/api/requests/') && req.method === 'GET') {
                    response = await quoteGet({ request: new Request(url, options), env, params: { id: decodeURIComponent(url.pathname.slice('/api/requests/'.length)) } });
                } else if (url.pathname.startsWith('/api/data/') && req.method === 'GET') {
                    response = Response.json({ ok: true, data: [] });
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
            res.end(fs.readFileSync(file));
        } catch (error) { res.writeHead(500, { 'Content-Type': 'text/plain;charset=utf-8' }); res.end(String(error)); }
    });
    server.listen(8795, '127.0.0.1', () => console.log('예약 작업 로컬 검증: http://localhost:8795/__local-admin · admin@example.invalid / local-workspace-test-2026'));
} else raw.close();
