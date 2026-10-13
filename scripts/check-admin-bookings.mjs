// 실제 Hono·Lucia 로그인과 로컬 SQLite로 통합 예약 조회를 검증한다. 운영 DB·알림 서비스는 사용하지 않는다.
// npm ci 후 node scripts/check-admin-bookings.mjs [--serve]
import { build } from 'esbuild';
import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { hashPassword } from '../functions/lib/password.ts';
import { onRequestGet as quoteGet } from '../functions/api/requests/[id].js';

const root = path.resolve(import.meta.dirname, '..');
const scratch = path.join(root, 'work/admin-bookings');
fs.mkdirSync(scratch, { recursive: true });
const entry = path.join(scratch, 'entry.ts');
fs.writeFileSync(entry, `import { Hono } from 'hono';
import auth from '../../functions/api/auth';
import reservations from '../../functions/api/reservations';
import quotes from '../../functions/api/quotes';
import products from '../../functions/api/products';
import bookings from '../../functions/api/admin-bookings';
const app = new Hono().basePath('/api');
app.route('/auth', auth); app.route('/reservations', reservations); app.route('/quotes', quotes);
app.route('/products', products); app.route('/admin/bookings', bookings); export default app;`);
const bundle = path.join(scratch, 'app.mjs');
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm' });
const app = (await import(pathToFileURL(bundle).href + '?v=' + Date.now())).default;
const raw = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true });
const stmt = (sql, args = []) => ({
    bind: (...a) => stmt(sql, a),
    async first() { return raw.prepare(sql).get(...args) ?? null; },
    async all() { return { results: raw.prepare(sql).all(...args) }; },
    async run() { const result = raw.prepare(sql).run(...args); return { meta: { changes: result.changes } }; },
    async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
});
const DB = { prepare: sql => stmt(sql), batch: async list => Promise.all(list.map(s => s.all())) };
await ensureSiteSchema(DB);
raw.exec(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
raw.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, google_id TEXT, email TEXT, name TEXT, role TEXT, avatar_url TEXT, password_hash TEXT);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER);`);
const password = 'local-bookings-test-2026';
const passwordHash = await hashPassword(password);
for (const role of ['admin', 'user']) {
    raw.prepare('INSERT INTO users (id,name,email,role,password_hash) VALUES (?,?,?,?,?)').run(role, '로컬 테스트 관리자', `${role}@example.invalid`, role, passwordHash);
    raw.prepare('INSERT INTO sessions VALUES (?,?,?)').run(`local-${role}-session`, role, Date.now() + 86400000);
}
const env = { DB, ENVIRONMENT: 'production', ADMIN_TOKEN: 'local-quote-fixture' };
const admin = { cookie: 'auth_session=local-admin-session' };
const apiRequest = (route, options = {}) => app.request(route, options, env);
const insert = raw.prepare('INSERT INTO requests (id,received_at,name,phone,destination,status,data,token) VALUES (?,?,?,?,?,?,?,?)');
for (const [id, status, depositPaid, signed, progress] of [
    ['shared-id', '예약확정', true, true, ''], ['quote-pending', '진행중', false, false, ''],
    ['quote-signing', '진행중', true, false, ''], ['quote-cancelled', '예약확정', true, true, '예약취소'],
]) {
    const name = { 'shared-id': '김견적', 'quote-pending': '박예약금', 'quote-signing': '이서명', 'quote-cancelled': '최취소' }[id];
    const booking = { preparedAt: '2026-10-13', confirmedAt: status === '예약확정' ? '2026-10-13' : '',
        contractInfo: { productName: '고비 사막 맞춤 여행', totalAmount: 3456789, depositAmount: 456789, balanceAmount: 3000000,
            depositStatus: depositPaid ? '입금완료' : '미입금', balanceStatus: '미수령' },
        contract: signed ? { signedAt: '2026-10-13', signature: 'PRIVATE-SIGNATURE' } : {},
        contractRequest: { status: depositPaid ? 'requested' : '' }, publishStatus: status === '예약확정' ? 'published' : 'draft',
        depositReport: !depositPaid ? { status: 'reported', name: '박입금', reportedAt: '2026-10-13T00:00:00Z' } : null,
        days: [{ day: 1, title: '고비 사막 도착', stay: { name: '게르 캠프' } }, { day: 2, title: '사막 여행', stay: { name: '게르 캠프' } }, { day: 3, title: '귀환' }],
        assign: { guide: { name: '몽골 가이드' }, vehicle: { model: '하이스' }, lodges: [{ day: 1, name: '게르 캠프' }, { day: 2, name: '게르 캠프' }] } };
    const data = { id, name, phone: '01000000000', email: 'customer@example.invalid', depart: '2026-10-20', return_: '2026-10-22',
        receivedAt: '2026-10-13', adult: 3, destination: '고비사막', status, progress, booking, token: 'PRIVATE-TOKEN', decision: { status: 'accepted' } };
    insert.run(id, data.receivedAt, name, data.phone, data.destination, status, JSON.stringify(data), data.token);
}
insert.run('only-inquiry', '2026-10-12', '문의고객', '', '', '신규', '{"id":"only-inquiry","quote":{}}', 'PRIVATE-INQUIRY');
raw.prepare('INSERT INTO reservations (id,product_name,customer_name,customer_email,travelers,start_date,end_date,status,total_price,deposit_amount,balance_amount,deposit_status,user_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run('shared-id', '테렐지 상품 여행', '김상품', 'product@example.invalid', 2, '2026-10-21', '2026-10-23', 'confirmed', 2222222, 222222, 2000000, 'paid', 'user', '2026-10-12');
raw.prepare('INSERT INTO quotes (id,name,status,period,created_at) VALUES (?,?,?,?,?)')
    .run('old-quote', '이전문의', 'new', '2026-10-25 ~ 2026-10-27', '2026-10-11');

assert.equal((await apiRequest('/api/admin/bookings/quote')).status, 401);
assert.equal((await apiRequest('/api/admin/bookings/quote', { headers: { cookie: 'auth_session=local-user-session' } })).status, 403);
assert.equal((await apiRequest('/api/admin/bookings/quote', { headers: { cookie: 'auth_session=expired-session' } })).status, 401);
assert.equal((await apiRequest('/api/admin/bookings/quote', { headers: { 'x-admin-token': env.ADMIN_TOKEN } })).status, 401);
const failingDB = { ...DB, prepare(sql) {
    if (sql.includes('FROM requests')) throw new Error('local simulated requests failure');
    return DB.prepare(sql);
} };
assert.equal((await app.request('/api/admin/bookings/quote', { headers: admin }, { ...env, DB: failingDB })).status, 503);
const before = raw.prepare('SELECT * FROM requests ORDER BY id').all();
const response = await apiRequest('/api/admin/bookings/quote', { headers: admin });
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
const body = await response.json();
assert.equal(body.items.length, 4);
assert.equal(body.skipped, 0);
assert.ok(!JSON.stringify(body).includes('PRIVATE-'));
const quote = body.items.find(b => b.id === 'shared-id');
assert.equal(quote.customerName, '김견적');
assert.equal(quote.totalAmount, 3456789);
assert.deepEqual(raw.prepare('SELECT * FROM requests ORDER BY id').all(), before);
const products = await (await apiRequest('/api/reservations', { headers: admin })).json();
assert.equal(products[0].id, quote.id);
assert.equal(products[0].customerName, '김상품'); // 같은 ID라도 서로 다른 원본 예약
const login = await apiRequest('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.invalid', password }) });
assert.equal(login.status, 200);
assert.ok(login.headers.get('set-cookie')?.includes('auth_session='));
const cookie = login.headers.get('set-cookie').split(';')[0];
assert.equal((await apiRequest('/api/admin/bookings/quote', { headers: { cookie } })).status, 200);
const fresh = await quoteGet({ request: new Request('http://localhost/api/requests/shared-id', { headers: { 'x-admin-token': env.ADMIN_TOKEN } }), env, params: { id: 'shared-id' } });
assert.equal((await fresh.json()).item.name, '김견적');
console.log('통합 예약 API: 관리자 권한·캐시 금지·실제 예약 필터·고객 비밀 제외·동일 ID 구분·실제 로그인·원본 보존 검사 통과');

if (process.argv.includes('--serve')) {
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost:8792');
            if (url.pathname.startsWith('/api/')) {
                const chunks = []; for await (const chunk of req) chunks.push(chunk);
                const options = { method: req.method, headers: req.headers };
                if (chunks.length) options.body = Buffer.concat(chunks);
                let response;
                if (url.pathname === '/api/admin/bookings/quote' && fs.existsSync(path.join(scratch, 'quote-unavailable'))) {
                    response = Response.json({ error: '로컬 테스트: 견적 조회 실패' }, { status: 503 });
                } else if (url.pathname.startsWith('/api/requests/') && req.method === 'GET') {
                    response = await quoteGet({ request: new Request(url, options), env, params: { id: decodeURIComponent(url.pathname.slice('/api/requests/'.length)) } });
                } else if (url.pathname.startsWith('/api/data/') && req.method === 'GET') {
                    response = Response.json({ ok: true, data: [] });
                } else if (req.method !== 'GET' && url.pathname !== '/api/auth/login' && url.pathname !== '/api/auth/logout') {
                    response = Response.json({ error: '로컬 조회 검증 화면입니다.' }, { status: 403 });
                } else response = await apiRequest(url.pathname + url.search, options);
                res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
            }
            let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
            if (!path.extname(relative) && fs.existsSync(path.join(root, 'public', relative + '.html'))) relative += '.html';
            let file = path.resolve(root, 'public', relative);
            if (!file.startsWith(path.join(root, 'public') + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                file = path.resolve(root, 'dist', relative);
                if (!file.startsWith(path.join(root, 'dist') + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'dist', 'index.html');
            }
            const types = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
            res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(fs.readFileSync(file));
        } catch (error) { res.writeHead(500); res.end(String(error)); }
    });
    server.listen(8792, '127.0.0.1', () => console.log('통합 예약 로컬 검증: http://localhost:8792/admin/login · admin@example.invalid / local-bookings-test-2026'));
} else raw.close();
