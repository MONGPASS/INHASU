// Real Hono/Lucia/SQLite access checks; external mail, SMS and production data are never used.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { Hono } from 'hono';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';

const bundle = async name => {
    const result = await build({ entryPoints: [`functions/api/${name}.ts`], bundle: true, platform: 'node', format: 'esm', write: false });
    return (await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'))).default;
};
const [quotes, reservations, documents, reviews] = await Promise.all(['quotes', 'reservations', 'documents', 'reviews'].map(bundle));

async function fixture(t) {
    const raw = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true });
    t.after(() => raw.close());
    const statement = (sql, args = []) => ({
        bind: (...values) => statement(sql, values),
        first: async () => raw.prepare(sql).get(...args) ?? null,
        all: async () => ({ results: raw.prepare(sql).all(...args) }),
        raw: async () => raw.prepare(sql).all(...args).map(row => Object.values(row)),
        run: async () => ({ meta: raw.prepare(sql).run(...args) }),
        exec: () => /^\s*(SELECT|PRAGMA)/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args), results: [] },
    });
    const DB = { prepare: sql => statement(sql), batch: async rows => rows.map(row => row.exec()) };
    await ensureSiteSchema(DB);
    raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
        CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);`);
    for (const id of ['admin', 'owner', 'other', 'password-only']) {
        raw.prepare('INSERT INTO users(id,google_id,email,name,role) VALUES(?,?,?,?,?)').run(id,
            ['owner', 'other'].includes(id) ? `google-${id}` : null, `${id}@example.invalid`, id, id === 'admin' ? 'admin' : 'user');
        raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run(`test-${id}`, id, Date.now() + 86400000);
    }
    for (const [id, owner, email] of [['owned', 'owner', 'other@example.invalid'], ['unlinked', null, 'owner@example.invalid']]) {
        raw.prepare(`INSERT INTO reservations(id,user_id,customer_name,customer_email,product_name,status,start_date,end_date,contract_data,document_content,itinerary_url)
            VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(id, owner, 'PRIVATE-CUSTOMER', email, 'PRIVATE-TOUR', 'completed', '2025-01-01', '2025-01-03',
            '{"travelers":[{"name":"PRIVATE-TRAVELER"}]}', '{"days":[{"day":1,"title":"PRIVATE-SCHEDULE"}]}', `https://example.invalid/documents/itinerary/${id}`);
        raw.prepare('INSERT INTO quotes(id,user_id,type,name,email,status,admin_note) VALUES(?,?,?,?,?,?,?)').run(id, owner, 'personal', 'PRIVATE-QUOTE', email, 'pending', 'PRIVATE-INTERNAL-NOTE');
    }
    const app = new Hono();
    app.route('/quotes', quotes); app.route('/reservations', reservations); app.route('/documents', documents); app.route('/reviews', reviews);
    const request = (path, { user, method = 'GET', body, headers = {} } = {}) => app.request('https://site.test' + path, {
        method, headers: { ...(user ? { cookie: `auth_session=test-${user}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }, { DB, ENVIRONMENT: 'production' });
    return { raw, request };
}

const protectedReads = id => [`/quotes/${id}`, `/reservations/${id}`, `/documents/contract/${id}`, `/documents/itinerary/${id}?format=quote`];
const privateFieldsAbsent = async response => assert.doesNotMatch(await response.text(), /PRIVATE-(CUSTOMER|TOUR|TRAVELER|SCHEDULE|QUOTE)/);

test('기존 ID 주소도 비로그인·Google 연결 없는 일반 세션에는 개인정보를 반환하지 않는다', async t => {
    const f = await fixture(t);
    for (const user of [undefined, 'password-only']) for (const path of [...protectedReads('owned'), ...protectedReads('unlinked'), '/quotes', '/reservations']) {
        const response = await f.request(path, { user });
        assert.equal(response.status, 401, `${user} ${path}`);
        await privateFieldsAbsent(response);
    }
});

test('고객 이메일이 같아도 타계정 소유 예약·견적을 열거나 미소유 기록을 자동 연결하지 않는다', async t => {
    const f = await fixture(t);
    for (const path of protectedReads('owned')) {
        const response = await f.request(path, { user: 'other' });
        assert.equal(response.status, 403, path); await privateFieldsAbsent(response);
    }
    for (const path of protectedReads('unlinked')) {
        const response = await f.request(path, { user: 'owner' });
        assert.equal(response.status, 403, path); assert.equal((await response.json()).code, 'claim_required');
    }
    for (const collection of ['quotes', 'reservations']) {
        const own = await (await f.request(`/${collection}`, { user: 'owner' })).json();
        assert.deepEqual(own.map(row => row.id), ['owned']);
        assert.deepEqual(await (await f.request(`/${collection}`, { user: 'other' })).json(), []);
    }
});

test('고객 상세와 공개 일정 projection은 소유자에게 열리고 내부 가이드 형태는 관리자만 읽는다', async t => {
    const f = await fixture(t);
    for (const path of protectedReads('owned')) assert.equal((await f.request(path, { user: 'owner' })).status, 200, path);
    for (const path of ['/documents/itinerary/owned', '/documents/itinerary/owned?format=quote&guide=1']) {
        assert.equal((await f.request(path, { user: 'owner' })).status, 403);
        assert.equal((await f.request(path, { user: 'admin' })).status, 200);
    }
});

test('계약·입금·리뷰 제출은 비로그인·타계정·미연결 기록의 DB를 변경하지 않는다', async t => {
    const f = await fixture(t), before = f.raw.prepare('SELECT * FROM reservations ORDER BY id').all();
    for (const [id, user, status] of [['owned', undefined, 401], ['owned', 'other', 403], ['unlinked', 'owner', 403]]) {
        for (const path of [`/documents/contract/${id}/customer`, `/reservations/${id}/deposit-report`, `/reviews/reservation/${id}`]) {
            const response = await f.request(path, { user, method: 'POST', body: { name: '변조', agreement: { agreed: true, name: '변조' }, rating: 5, content: '변조된 후기 제출입니다.' } });
            assert.equal(response.status, status, `${user} ${path}`); await privateFieldsAbsent(response);
        }
    }
    assert.deepEqual(f.raw.prepare('SELECT * FROM reservations ORDER BY id').all(), before);
});

test('새 견적·예약은 Google 고객 세션에 귀속되고 클라이언트가 보낸 타계정 ID를 무시한다', async t => {
    const f = await fixture(t);
    for (const user of [undefined, 'password-only']) for (const path of ['/quotes', '/reservations']) {
        assert.equal((await f.request(path, { user, method: 'POST', body: {} })).status, 401);
    }
    const quote = await f.request('/quotes', { user: 'owner', method: 'POST', body: { name: '신규 고객', type: 'personal', user_id: 'other', userId: 'other',
        status: 'confirmed', adminNote: 'FORGED-NOTE', admin_note: 'FORGED-NOTE', deposit: 99999, confirmedPrice: 99999, depositStatus: 'paid', deposit_status: 'paid', created_at: '1900-01-01' } });
    assert.equal(quote.status, 200); const quoteId = (await quote.json()).id;
    const savedQuote = f.raw.prepare('SELECT * FROM quotes WHERE id=?').get(quoteId);
    assert.equal(savedQuote.user_id, 'owner'); assert.equal(savedQuote.status, 'new'); assert.equal(savedQuote.admin_note, null);
    assert.equal(savedQuote.deposit, null); assert.equal(savedQuote.confirmed_price, null); assert.equal(savedQuote.deposit_status, 'unpaid'); assert.notEqual(savedQuote.created_at, '1900-01-01');
    const booking = await f.request('/reservations', { user: 'owner', method: 'POST', body: { productName: '신규 투어', customerName: '신규 고객', email: 'owner@example.invalid', user_id: 'other', userId: 'other' } });
    assert.equal(booking.status, 201); const bookingId = (await booking.json()).id;
    assert.equal(f.raw.prepare('SELECT user_id FROM reservations WHERE id=?').get(bookingId).user_id, 'owner');
});

test('타 사이트 Origin의 계약·입금·신규 견적·예약 제출은 로그인 쿠키가 있어도 차단한다', async t => {
    const f = await fixture(t);
    for (const path of ['/documents/contract/owned/customer', '/reservations/owned/deposit-report', '/quotes', '/reservations']) {
        const response = await f.request(path, { user: 'owner', method: 'POST', headers: { Origin: 'https://attacker.invalid' }, body: { name: '변조', type: 'personal', productName: '변조', customerName: '변조' } });
        assert.equal(response.status, 403, path);
    }
});

test('고객 견적 목록·상세는 관리자 메모를 제거하고 관리자 조회와 원본은 보존한다', async t => {
    const f = await fixture(t);
    for (const path of ['/quotes', '/quotes/owned']) {
        const response = await f.request(path, { user: 'owner' }); assert.equal(response.status, 200);
        const text = await response.text(); assert.doesNotMatch(text, /PRIVATE-INTERNAL-NOTE|adminNote|admin_note/);
        const admin = await f.request(path, { user: 'admin' }); assert.equal(admin.status, 200); assert.match(await admin.text(), /PRIVATE-INTERNAL-NOTE/);
    }
    assert.equal(f.raw.prepare('SELECT admin_note FROM quotes WHERE id=?').get('owned').admin_note, 'PRIVATE-INTERNAL-NOTE');
});
