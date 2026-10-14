import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';

async function bundle(path) {
    const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, platform: 'node', format: 'esm', write: false });
    return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
}
const { readAdminWorkspace, seoulDate } = await bundle('../functions/lib/adminWorkspace.ts');
const { default: app } = await bundle('../functions/api/admin-workspace.ts');
const now = new Date('2026-10-14T00:00:00Z');

async function fixture(t) {
    const raw = new DatabaseSync(':memory:');
    t.after(() => raw.close());
    const stmt = (sql, args = []) => ({ bind: (...values) => stmt(sql, values),
        async all() { return { results: raw.prepare(sql).all(...args) }; },
        async first() { return raw.prepare(sql).get(...args) ?? null; },
        async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
        async run() { return { meta: raw.prepare(sql).run(...args) }; },
        exec() { return /^\s*(select|pragma)\b/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args) }; },
    });
    const DB = { prepare: sql => stmt(sql), batch: async rows => rows.map(row => row.exec()) };
    await ensureSiteSchema(DB);
    raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
    raw.exec('CREATE TABLE users (id TEXT PRIMARY KEY, google_id TEXT, email TEXT, name TEXT, role TEXT, avatar_url TEXT, password_hash TEXT); CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER);');
    for (const role of ['admin', 'user']) {
        raw.prepare('INSERT INTO users (id,name,email,role) VALUES (?,?,?,?)').run(role, role, role + '@example.invalid', role);
        raw.prepare('INSERT INTO sessions VALUES (?,?,?)').run('session-' + role, role, Date.now() + 86400000);
    }
    const reservation = (id, extra = {}) => {
        const row = { id, reservation_number: 'BOOK-' + id, customer_name: '상품 고객', product_name: '테를지', status: 'confirmed', total_price: 1000,
            start_date: '2026-10-14', end_date: '2026-10-16', created_at: '2026-10-13 16:00:00', deposit_status: 'paid', ...extra };
        raw.prepare(`INSERT INTO reservations (${Object.keys(row).join(',')}) VALUES (${Object.keys(row).map(() => '?').join(',')})`).run(...Object.values(row));
    };
    const request = (id, extra = {}) => {
        const row = { id, name: '견적 고객', phone: '01012345678', destination: '고비', status: '예약확정', receivedAt: '2026-10-13T16:00:00Z',
            booking: { contractInfo: { totalAmount: 900, depositStatus: '입금완료' }, contract: { signedAt: '2026-10-13T10:00:00Z' } },
            depart: '2026-10-13', return_: '2026-10-15', token: 'secret-customer-token', ...extra };
        raw.prepare('INSERT INTO requests (id,name,phone,destination,status,received_at,data,token) VALUES (?,?,?,?,?,?,?,?)')
            .run(id, row.name, row.phone, row.destination, row.status, row.receivedAt, JSON.stringify(row), row.token);
    };
    return { raw, DB, reservation, request };
}

test('한국시간 오늘과 실제 진행 기간으로 상품·견적 예약을 함께 집계하며 금액 0을 보존한다', async t => {
    const f = await fixture(t);
    f.reservation('same-id'); f.request('same-id');
    f.reservation('zero', { total_price: 0, start_date: '2026-11-01', end_date: '2026-11-03' });
    f.reservation('cancel', { status: 'cancelled', total_price: 99999 });
    f.reservation('done', { status: 'completed', total_price: 200 });
    f.reservation('pending', { status: 'pending_payment', deposit_status: 'unpaid', deposit_report: '{"status":"reported"}' });
    const data = await readAdminWorkspace(f.DB, now);
    assert.equal(data.today, '2026-10-14');
    assert.equal(data.metrics.todayReservations, 6);
    assert.equal(data.metrics.confirmedSales, 2100);
    assert.equal(data.metrics.ongoingTours, 2);
    assert.equal(data.metrics.unpaidReservations, 1);
    assert.equal(data.metrics.depositReports, 1);
    assert.equal(new Set(data.bookings.map(b => b.key)).size, 6);
    assert.equal(data.bookings.find(b => b.id === 'zero').totalAmount, 0);
    assert.ok(data.tasks.some(t => t.kind === 'deposit_report'));
    assert.ok(!data.tasks.some(t => t.href.includes('cancel') || t.href.includes('done')));
});

test('단순 문의는 예약·매출에서 제외하고 이전 문의와 새 문의의 답변 작업을 합친다', async t => {
    const f = await fixture(t);
    f.request('new', { booking: undefined, status: '신규' });
    f.raw.prepare('INSERT INTO quotes (id,name,destination,status) VALUES (?,?,?,?)').run('legacy', '이전 문의', '홉스굴', 'processing');
    f.raw.prepare('INSERT INTO quotes (id,name,status) VALUES (?,?,?)').run('converted', '전환됨', 'converted');
    const data = await readAdminWorkspace(f.DB, now);
    assert.equal(data.metrics.confirmedSales, 0);
    assert.equal(data.metrics.todayReservations, 0);
    assert.equal(data.metrics.newQuotes, 2);
    assert.deepEqual(data.inquiries.map(i => i.type).sort(), ['legacy_quote', 'quote_request']);
    assert.ok(data.tasks.every(t => t.kind === 'quote'));
    assert.equal(data.inquiries.find(i => i.id === 'new').href, '/admin/quote-desk/inbox?id=new');
});

test('부분 조회 실패와 손상된 문의는 해당 집계를 미확인으로 표시한다', async t => {
    const f = await fixture(t);
    f.reservation('ok');
    const missing = { prepare(sql) { if (sql.includes('FROM requests')) throw new Error('unavailable'); return f.DB.prepare(sql); } };
    const data = await readAdminWorkspace(missing, now);
    assert.equal(data.bookings.length, 1);
    assert.equal(data.metrics.confirmedSales, null);
    assert.equal(data.metrics.newQuotes, null);
    assert.equal(data.availability.requests, false);
    assert.ok(data.warnings.length);
    f.raw.prepare('INSERT INTO requests (id,data) VALUES (?,?)').run('corrupt', '{broken');
    const corrupt = await readAdminWorkspace(f.DB, now);
    assert.equal(corrupt.metrics.todayReservations, null);
    assert.equal(corrupt.availability.requests, false);
    assert.match(corrupt.warnings.join(' '), /손상/);
});

test('집계·검색 응답은 고객 토큰·서명·여권·내부 메모를 포함하지 않는다', async t => {
    const f = await fixture(t);
    f.request('private', { booking: { contractInfo: { totalAmount: 200 }, contract: { signedAt: '2026-10-10', signature: 'private-signature' }, travelers: [{ passport: 'private-passport' }] }, memo: 'private-admin-memo' });
    const text = JSON.stringify(await readAdminWorkspace(f.DB, now));
    for (const secret of ['secret-customer-token', 'private-signature', 'private-passport', 'private-admin-memo']) assert.ok(!text.includes(secret));
});

test('작업 알림은 실제 입금·서명·배정 상태가 해결되면 사라진다', async t => {
    const f = await fixture(t);
    f.reservation('ready', { contract_data: '{"agreement":{"agreed":true}}', assigned_guide: '{"name":"가이드"}', admin_operations: '{"vehicle":"차량"}',
        daily_accommodations: '[{"day":1,"accommodation":{"name":"캠프"}},{"day":2,"accommodation":{"name":"캠프"}}]' });
    assert.equal((await readAdminWorkspace(f.DB, now)).tasks.length, 0);
});

test('업무 API는 관리자 인증만 허용하고 개인정보 응답을 캐시하지 않는다', async t => {
    const f = await fixture(t);
    for (const [role, expected] of [['', 401], ['user', 403], ['admin', 200]]) {
        const response = await app.request('/', { headers: role ? { cookie: 'auth_session=session-' + role } : {} }, { DB: f.DB });
        assert.equal(response.status, expected);
        if (role === 'admin') assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    }
    assert.equal(seoulDate('2026-10-13 16:00:00'), '2026-10-14');
    assert.equal(seoulDate('2026-10-13T14:59:59Z'), '2026-10-13');
});
