// 로컬 D1/실제 Lucia 세션으로 상품 PDF API를 검사한다. 운영 DB·이메일은 사용하지 않는다.
// npm ci 후 node scripts/check-product-documents.mjs [--serve]
import { build } from 'esbuild';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import http from 'node:http';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';

const root = path.resolve(import.meta.dirname, '..');
const scratch = path.join(root, 'work/product-documents');
fs.mkdirSync(scratch, { recursive: true });
const bundle = path.join(scratch, 'documents.mjs');
await build({ entryPoints: [path.join(root, 'functions/api/documents.ts')], outfile: bundle, bundle: true, platform: 'node', format: 'esm' });
const app = (await import(pathToFileURL(bundle).href + '?v=' + Date.now())).default;
const mailBundle = path.join(scratch, 'email.mjs');
await build({ entryPoints: [path.join(root, 'functions/api/notifications/email.ts')], outfile: mailBundle, bundle: true, platform: 'node', format: 'esm' });
const emailApp = (await import(pathToFileURL(mailBundle).href + '?v=' + Date.now())).default;
const raw = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true });
const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    async first() { return raw.prepare(sql).get(...args) ?? null; },
    async all() { return { results: raw.prepare(sql).all(...args) }; },
    async run() { return raw.prepare(sql).run(...args); },
    async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
});
const db = { prepare: sql => stmt(sql), batch: async list => Promise.all(list.map(s => s.run())) };
await ensureSiteSchema(db);
raw.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, google_id TEXT, email TEXT, name TEXT, role TEXT, avatar_url TEXT, password_hash TEXT);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER);`);
for (const role of ['admin', 'user']) {
    raw.prepare('INSERT INTO users (id,name,role) VALUES (?,?,?)').run(role, `로컬 테스트 ${role}`, role);
    raw.prepare('INSERT INTO sessions VALUES (?,?,?)').run(`local-${role}-session`, role, Date.now() + 86400000);
}
const days = Array.from({ length: 3 }, (_, i) => ({ day: i + 1, title: ['울란바토르 · 테렐지', '테렐지 국립공원', '울란바토르 귀환'][i],
    summary: ['공항 픽업 후 테렐지로 이동', '자연 속에서 여유로운 하루', '시내 관광 후 공항으로 이동'][i],
    meals: { breakfast: i ? '캠프식' : '-', lunch: '현지식', dinner: i === 2 ? '-' : '한식' },
    activities: [{ time: '10:00', title: '초원 산책', description: '탁 트인 초원에서 산책하며 몽골의 자연을 즐깁니다. 담당 가이드가 현지 상황에 따라 이동 시간을 안내합니다.', images: ['/img/regions/terelj.webp'] },
        { time: '14:00', title: '명소 방문', description: '당일 안내에 따라 여유롭게 관광합니다.' }],
    accommodation: i === 2 ? null : { name: '테렐지 게르 캠프', images: ['/img/quote/lodge-lux.webp'], description: '예약된 캠프에서 휴식합니다.' },
}));
raw.prepare('INSERT INTO products (id,name,category,main_images,included,excluded) VALUES (?,?,?,?,?,?)')
    .run('local-tour', '테렐지 초원 여행 2박 3일', '중앙몽골', '["/img/regions/terelj.webp"]', '["전용 차량","한국어 가이드","일정에 표시된 숙박과 식사"]', '["국제선 항공권","개인 여행자보험","개인 경비"]');
const insert = raw.prepare('INSERT INTO reservations (id,product_id,product_name,customer_name,travelers,start_date,end_date,status,total_price,deposit_amount,balance_amount,document_content,assigned_guide,are_assignments_visible_to_user) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
for (const [id, status] of [['local-confirmed', 'confirmed'], ['local-pending', 'pending_payment'], ['local-cancelled', 'cancelled'], ['local-empty', 'confirmed']]) {
    insert.run(id, 'local-tour', '테렐지 초원 여행 2박 3일', '김여행 · 테스트 예약', 3, '2026-10-20', '2026-10-22', status, 1234567, 234567, 1000000,
        JSON.stringify({ days: id === 'local-empty' ? [] : days }), '{"name":"담당 가이드","phone":"LOCAL-TEST-PHONE","image":"/img/quote/guide.webp"}', 1);
}
const request = (route, options = {}) => app.request(route, options, { DB: db });
const admin = { cookie: 'auth_session=local-admin-session' };
assert.equal((await request('/itinerary/local-confirmed?format=quote')).status, 409);
assert.equal((await request('/itinerary/local-confirmed?format=quote&preview=1')).status, 403);
assert.equal((await request('/itinerary/local-confirmed?format=quote&preview=1', { headers: { cookie: 'auth_session=local-user-session' } })).status, 403);
const preview = await request('/itinerary/local-confirmed?format=quote&preview=1', { headers: admin });
assert.equal(preview.status, 200);
assert.equal((await preview.json()).quote.customer, '김여행 · 테스트 예약');
assert.equal((await request('/itinerary/local-confirmed/publish', { method: 'POST' })).status, 401);
assert.equal((await request('/itinerary/local-pending/publish', { method: 'POST', headers: admin })).status, 409);
assert.equal((await request('/itinerary/local-empty/publish', { method: 'POST', headers: admin })).status, 409);
assert.equal((await request('/itinerary/local-confirmed/publish', { method: 'POST', headers: admin })).status, 200);
const published = await request('/itinerary/local-confirmed?format=quote');
assert.equal(published.status, 200);
assert.equal(published.headers.get('cache-control'), 'private, no-store');
assert.deepEqual(Object.keys(await published.json()), ['quote']);
raw.prepare('UPDATE reservations SET are_assignments_visible_to_user=0, daily_accommodations=? WHERE id=?').run('[{"day":1,"accommodation":{"name":"PRIVATE-LODGE"}}]', 'local-confirmed');
const hidden = await (await request('/itinerary/local-confirmed?format=quote')).text();
assert.ok(!hidden.includes('LOCAL-TEST-PHONE'));
assert.ok(!hidden.includes('PRIVATE-LODGE'));
raw.prepare('UPDATE reservations SET are_assignments_visible_to_user=1,daily_accommodations=NULL WHERE id=?').run('local-confirmed');
assert.equal((await request('/itinerary/local-cancelled?format=quote')).status, 409);
assert.equal((await request('/itinerary/unknown?format=quote')).status, 404);
assert.equal((await request('/itinerary/local-confirmed')).status, 200); // 기존 가이드 출력 API
console.log('상품 문서 API: 관리자/고객 권한, 공개 전후, 미확정·빈 일정 차단, 비공개 배정, 기존 가이드 API 검사 통과');

// 실제 메일 서비스로 보내지 않고 공급자 응답만 흉내 낸다.
const realFetch = globalThis.fetch;
let providerStatus = 200;
globalThis.fetch = async url => {
    assert.equal(String(url), 'https://api.resend.com/emails');
    return new Response(JSON.stringify({ id: 'local-test-email' }), { status: providerStatus, headers: { 'content-type': 'application/json' } });
};
try {
    const options = { method: 'POST', headers: { ...admin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'local-test@example.invalid', type: 'ITINERARY_READY', data: { customerName: '테스트 고객', reservationDbId: 'local-confirmed', userId: 'user', itineraryUrl: 'https://example.invalid/documents/itinerary/local-confirmed' } }) };
    assert.equal((await emailApp.request('/', options, { DB: db, RESEND_API_KEY: '' })).status, 502);
    assert.equal((await emailApp.request('/', options, { DB: db, RESEND_API_KEY: 'local-dummy' })).status, 200);
    providerStatus = 503;
    assert.equal((await emailApp.request('/', options, { DB: db, RESEND_API_KEY: 'local-dummy' })).status, 502);
    console.log('이메일 API: 설정 누락·공급자 실패를 실패로 반환하고 성공만 성공으로 반환함(실제 발송 없음)');
} finally { globalThis.fetch = realFetch; }

if (process.argv.includes('--serve')) {
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost:8791');
            if (url.pathname === '/__local-admin') {
                res.writeHead(302, { 'Set-Cookie': 'auth_session=local-admin-session; HttpOnly; SameSite=Lax; Path=/', Location: '/확정일정표.html?reservationId=local-pending&preview=1&m=0' }); res.end(); return;
            }
            if (url.pathname.startsWith('/api/documents/')) {
                const response = await request(url.pathname.slice('/api/documents'.length) + url.search, { method: req.method, headers: req.headers });
                res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
            }
            if (url.pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true,"data":null}'); return; }
            let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
            if (!path.extname(relative) && fs.existsSync(path.join(root, 'public', relative + '.html'))) relative += '.html';
            let file = path.resolve(root, 'public', relative);
            if (!file.startsWith(path.join(root, 'public') + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                file = path.resolve(root, 'dist', relative);
                if (!file.startsWith(path.join(root, 'dist') + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'dist', 'index.html');
            }
            const types = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
            res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(file));
        } catch (error) { res.writeHead(500); res.end(String(error)); }
    });
    server.listen(8791, '127.0.0.1', () => console.log('로컬 상품 PDF 미리보기: http://localhost:8791/확정일정표.html?reservationId=local-confirmed&m=0'));
} else raw.close();
