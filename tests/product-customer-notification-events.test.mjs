// Actual Hono/Lucia/SQLite persistence with only the delivery engine substituted.
// These tests cannot contact Google, Solapi, mail, or production storage.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { deflateSync } from 'node:zlib';
import { build } from 'esbuild';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';

const bundled = await build({ stdin: { contents: `import { Hono } from 'hono';
import reservations from './functions/api/reservations'; import documents from './functions/api/documents';
const app = new Hono(); app.onError((error, context) => context.json({ error:'Local test persistence failure' }, 500));
app.route('/reservations', reservations); app.route('/documents', documents); export default app;`, resolveDir: process.cwd() },
    bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'local-notification-engine', setup(build) {
        build.onResolve({ filter: /(?:^|\/)customerNotifications(?:\.ts)?$/ }, () => ({ path: 'customer-notifications', namespace: 'local-notice' }));
        build.onLoad({ filter: /.*/, namespace: 'local-notice' }, () => ({ contents: `
export async function dispatchCustomerNotification(env, event) {
    const saved = await env.DB.prepare('SELECT * FROM reservations WHERE id=?').bind(event.bookingId).first();
    env.localAttempts.push({ ...event, saved });
    if (env.localHold) await env.localHold;
    if (env.localNotificationFailure) throw Error('Local synthetic notification failure');
    const key = [event.source,event.bookingId,event.kind,event.eventKey].join(':');
    if (env.localAccepted.has(key)) return { ok:true,state:'accepted',duplicate:true };
    env.localAccepted.add(key); env.localDelivered.push(event);
    return { ok:true,state:'accepted' };
}` }));
    } }] });
const app = (await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'))).default;

const crc32 = bytes => { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; };
const pngChunk = (name, bytes) => { const type = Buffer.from(name), size = Buffer.alloc(4), crc = Buffer.alloc(4); size.writeUInt32BE(bytes.length); crc.writeUInt32BE(crc32(Buffer.concat([type, bytes]))); return Buffer.concat([size, type, bytes, crc]); };
const signaturePng = () => {
    const header = Buffer.alloc(13); header.writeUInt32BE(120); header.writeUInt32BE(60, 4); header[8] = 8; header[9] = 6;
    const scan = Buffer.alloc((120 * 4 + 1) * 60);
    for (let y = 0; y < 60; y++) for (let x = 0; x < 120; x++) if (Math.abs(y - x / 2) < 3) scan[y * 481 + 1 + x * 4 + 3] = 255;
    return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(scan)), pngChunk('IEND', Buffer.alloc(0))]).toString('base64');
};

async function fixture(t) {
    const raw = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true }); t.after(() => raw.close());
    let intercept;
    const statement = (sql, args = []) => ({ bind: (...values) => statement(sql, values),
        async first() { return raw.prepare(sql).get(...args) ?? null; },
        async all() { return { results: raw.prepare(sql).all(...args) }; },
        async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
        async run() { intercept?.(sql, args); return { meta: raw.prepare(sql).run(...args) }; },
        exec() { return /^\s*(select|pragma)/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args), results: [] }; } });
    const DB = { prepare: sql => statement(sql), batch: async rows => rows.map(row => row.exec()) };
    await ensureSiteSchema(DB);
    raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
      CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);`);
    for (const [id, role] of [['admin', 'admin'], ['google-customer', 'user'], ['other', 'user']]) {
        raw.prepare('INSERT INTO users(id,google_id,name,email,role) VALUES(?,?,?,?,?)').run(id, 'local-google-' + id, '동명이인 고객', id + '@example.invalid', role);
        raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run('notice-' + id, id, Date.now() + 86400000);
    }
    raw.prepare('INSERT INTO products(id,name,included,excluded) VALUES(?,?,?,?)').run('local-tour', '예약 상품', '["포함"]', '["불포함"]');
    raw.prepare(`INSERT INTO reservations(id,product_id,product_name,customer_name,customer_email,customer_phone,user_id,status,deposit_status,balance_status,contract_data,document_content,start_date,end_date,total_price,deposit_amount,balance_amount,travelers)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('local-booking', 'local-tour', '예약 상품', '저장된 예약자', 'stored@example.invalid', '01012345678', 'google-customer', 'pending_payment', 'unpaid', 'unpaid', '{}', JSON.stringify({ name: '저장 일정', days: [{ day: 1, title: '울란바토르', items: ['공항 픽업'] }] }), '2026-10-25', '2026-10-25', 1000000, 300000, 700000, 1);
    const env = { DB, ENVIRONMENT: 'production', PAYPAL_ENABLED: 'false', localAttempts: [], localDelivered: [], localAccepted: new Set() };
    const request = (route, method = 'GET', body, user = 'admin', context) => app.request('http://local.example.invalid' + route, {
        method, headers: { ...(user ? { cookie: 'auth_session=notice-' + user } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, env, context);
    const set = values => { const keys = Object.keys(values); raw.prepare(`UPDATE reservations SET ${keys.map(key => key + '=?').join(',')} WHERE id=?`).run(...keys.map(key => values[key]), 'local-booking'); };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw Error('External fetch is forbidden in product notification event tests'); };
    t.after(() => globalThis.fetch = originalFetch);
    const signedBody = async () => ({ agreement: { agreed: true, name: '서명 고객' }, travelers: [{ name: '서명 고객', passportName: 'LOCAL CUSTOMER' }], signature: {
        agree: true, signerName: '서명 고객', signImg: signaturePng(), expectedRevision: (await (await request('/documents/contract/local-booking','GET',undefined,'google-customer')).json()).signatureRevision } });
    return { raw, env, request, set, signedBody, intercept: callback => { intercept = callback; } };
}

test('최초 실제 입금·예약 확정 저장 뒤에만 알림을 요청하고 반복 PUT·상태 왕복은 같은 이벤트 키를 쓴다', async t => {
    const f = await fixture(t);
    const saved = await f.request('/reservations/local-booking', 'PUT', { deposit_status: 'paid', status: 'confirmed' });
    assert.equal(saved.status, 200); assert.equal((await saved.json()).depositStatus, 'paid');
    assert.deepEqual(f.env.localDelivered.map(event => event.kind), ['contract', 'booking_confirmed']);
    assert.ok(f.env.localAttempts.every(event => event.source === 'product' && event.bookingId === 'local-booking' && event.saved.deposit_status === 'paid' && event.saved.status === 'confirmed'));
    const firstKeys = f.env.localDelivered.map(event => event.eventKey);
    assert.equal((await f.request('/reservations/local-booking', 'PUT', { deposit_status: 'paid', status: 'confirmed' })).status, 200);
    assert.equal(f.env.localAttempts.length, 2);
    await f.request('/reservations/local-booking', 'PUT', { deposit_status: 'unpaid', status: 'pending_payment' });
    await f.request('/reservations/local-booking', 'PUT', { deposit_status: 'paid', status: 'confirmed' });
    assert.equal(f.env.localDelivered.length, 2); assert.deepEqual(f.env.localAttempts.slice(2).map(event => event.eventKey), firstKeys);
});

test('확정 상태에서 미입금인 원본을 일반 수정해도 입금으로 추정하거나 계약 알림을 만들지 않는다', async t => {
    const f = await fixture(t); f.set({ status: 'confirmed', deposit_status: 'unpaid', balance_status: 'paid' });
    const result = await f.request('/reservations/local-booking', 'PUT', { notes: '고객 메모', assigned_guide: { id: 'guide', name: '가이드' }, document_content: { days: [{ day: 1, title: '수정 일정' }] } });
    assert.equal(result.status, 200); const data = await result.json();
    assert.equal(data.depositStatus, 'unpaid'); assert.equal(data.balanceStatus, 'paid'); assert.equal(f.env.localAttempts.length, 0);
    for (const route of ['/reservations/local-booking', '/documents/itinerary/local-booking?preview=1', '/documents/contract/local-booking']) assert.equal((await f.request(route)).status, 200);
    assert.equal(f.env.localAttempts.length, 0);
    assert.equal((await f.request('/reservations/local-booking', 'PUT', { deposit_status: 'paid' })).status, 200);
    assert.deepEqual(f.env.localDelivered.map(event => event.kind), ['contract']);
});

test('최초 고객 공개만 알리고 재클릭·저장·구버전 PUT 공개는 동일 원장 이벤트로 합친다', async t => {
    const f = await fixture(t); f.set({ status: 'confirmed', deposit_status: 'paid' });
    assert.equal((await f.request('/documents/itinerary/local-booking/publish', 'POST')).status, 200);
    assert.deepEqual(f.env.localDelivered.map(event => event.kind), ['itinerary']); assert.ok(f.env.localAttempts[0].saved.itinerary_url);
    assert.equal((await f.request('/documents/itinerary/local-booking/publish', 'POST')).status, 200);
    await f.request('/reservations/local-booking', 'PUT', { itinerary_url: 'https://example.invalid/documents/itinerary/local-booking' });
    assert.equal(f.env.localAttempts.length, 1);
    f.set({ itinerary_url: null });
    await f.request('/reservations/local-booking', 'PUT', { itinerary_url: 'https://example.invalid/documents/itinerary/local-booking' });
    assert.equal(f.env.localAttempts.length, 2); assert.equal(f.env.localDelivered.length, 1);
    assert.equal(f.env.localAttempts[0].eventKey, f.env.localAttempts[1].eventKey);
});

test('성명 동의·정보 수정은 무발송이며 최초 손서명 CAS 성공 뒤 접수·여행 준비를 각각 한 번 요청한다', async t => {
    const f = await fixture(t); f.set({ status: 'confirmed', deposit_status: 'paid' });
    assert.equal((await f.request('/documents/contract/local-booking/customer', 'POST', { agreement: { agreed: true, name: '기존 성명 동의' }, travelers: [{ name: '기존 고객' }] }, 'google-customer')).status, 200);
    assert.equal(f.env.localAttempts.length, 0);
    const body = await f.signedBody();
    assert.equal((await f.request('/documents/contract/local-booking/customer', 'POST', body, 'google-customer')).status, 200);
    assert.deepEqual(f.env.localDelivered.map(event => event.kind), ['contract_signed', 'travel_notice']);
    for (const event of f.env.localAttempts) { const signature = JSON.parse(event.saved.contract_data).signature; assert.ok(signature.signedAt); assert.ok(event.eventKey.endsWith(signature.signedAt)); }
    assert.equal((await f.request('/documents/contract/local-booking/customer', 'POST', body, 'google-customer')).status, 409);
    assert.equal((await f.request('/documents/contract/local-booking/customer', 'POST', { travelers: [{ name: '최신 여행자 정보' }] }, 'google-customer')).status, 200);
    assert.equal(f.env.localAttempts.length, 2);
});

test('저장 실패·서명 충돌·잘못된 서명과 공개 거부에서는 알림 엔진을 호출하지 않는다', async t => {
    const f = await fixture(t);
    assert.equal((await f.request('/documents/itinerary/local-booking/publish', 'POST')).status, 409);
    assert.equal((await f.request('/documents/contract/local-booking/customer', 'POST', { signature: { agree: true, signerName: '고객', signImg: 'broken' } }, 'google-customer')).status, 400);
    f.set({ status: 'confirmed', deposit_status: 'paid' }); const signed = await f.signedBody();
    let changed = false;
    f.intercept(sql => { if (!changed && sql.startsWith('UPDATE reservations SET contract_data')) { changed = true; f.set({ contract_data: '{"concurrent":"saved"}' }); } });
    assert.equal((await f.request('/documents/contract/local-booking/customer', 'POST', signed, 'google-customer')).status, 409);
    f.intercept(sql => { if (/^update "reservations"/i.test(sql)) throw Error('Local save failure'); });
    assert.equal((await f.request('/reservations/local-booking', 'PUT', { deposit_status: 'paid', status: 'confirmed' })).status, 500);
    assert.equal(f.env.localAttempts.length, 0);
});

test('알림 오류는 저장 성공을 실패로 바꾸지 않으며 waitUntil이 있으면 주 업무 응답을 기다리게 하지 않는다', async t => {
    const f = await fixture(t); f.env.localNotificationFailure = true;
    assert.equal((await f.request('/reservations/local-booking', 'PUT', { deposit_status: 'paid', status: 'confirmed' })).status, 200);
    assert.equal(f.raw.prepare('SELECT deposit_status FROM reservations WHERE id=?').get('local-booking').deposit_status, 'paid');
    f.env.localNotificationFailure = false; f.set({ status: 'pending_payment', deposit_status: 'unpaid' });
    let release; f.env.localHold = new Promise(resolve => { release = resolve; }); const pending = [];
    const response = await f.request('/reservations/local-booking', 'PUT', { deposit_status: 'paid' }, 'admin', { waitUntil(task) { pending.push(task); } });
    assert.equal(response.status, 200); assert.equal(pending.length, 1);
    release(); await Promise.all(pending); assert.equal(f.env.localDelivered.length, 1);
});

test('서명 후 알림이 모두 실패해도 원본 서명·고객 정보 제출은 성공으로 남는다', async t => {
    const f = await fixture(t); f.set({ status: 'confirmed', deposit_status: 'paid' }); f.env.localNotificationFailure = true;
    assert.equal((await f.request('/documents/contract/local-booking/customer', 'POST', await f.signedBody(), 'google-customer')).status, 200);
    const saved = JSON.parse(f.raw.prepare('SELECT contract_data FROM reservations WHERE id=?').get('local-booking').contract_data);
    assert.ok(saved.signature.signedAt); assert.ok(saved.signature.signImg.startsWith('data:image/png;base64,')); assert.equal(saved.customerSubmittedAt, saved.signature.signedAt);
    assert.deepEqual(f.env.localAttempts.map(event => event.kind), ['contract_signed', 'travel_notice']); assert.equal(f.env.localDelivered.length, 0);
});

test('Google 계정 예약의 소유자는 세션으로 저장하며 부적합한 견적 접수 템플릿은 호출하지 않는다', async t => {
    const f = await fixture(t); const input = { user_id: 'other', status: 'confirmed', source: 'phone', product_id: 'local-tour', product_name: '예약 상품', customer_info: { name: '실제 예약자', email: 'chosen@example.invalid', phone: '01098765432' }, total_people: 2, price_breakdown: { total: 1000000, deposit: 300000, local: 700000 } };
    assert.equal((await f.request('/reservations', 'POST', input, '')).status, 401);
    const response = await f.request('/reservations', 'POST', input, 'google-customer'); assert.equal(response.status, 201);
    const created = await response.json(), row = f.raw.prepare('SELECT * FROM reservations WHERE id=?').get(created.id);
    assert.equal(row.user_id, 'google-customer'); assert.equal(row.product_id, 'local-tour'); assert.equal(row.status, 'pending_payment'); assert.equal(row.source, null);
    assert.equal(row.customer_name, '실제 예약자'); assert.equal(row.customer_phone, '01098765432'); assert.equal(f.env.localAttempts.length, 0);
});
