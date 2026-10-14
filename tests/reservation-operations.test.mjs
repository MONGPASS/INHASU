// 실제 Hono·Lucia·SQLite를 사용한다. 운영 DB와 외부 발송 서비스에는 연결하지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { ensureSiteSchema, SITE_SCHEMA_VERSION } from '../functions/lib/siteSchema.ts';

const bundled = await build({ entryPoints: [fileURLToPath(new URL('../functions/api/reservations.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', write: false });
const app = (await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString('base64')}`)).default;

const operations = {
    joining: 'join', region: '남고비', category: '단독맞춤', vehicle: '하이스', driverPhone: 'fixture-driver-private',
    receipt: { status: 'pending', number: 'fixture-receipt-private', issuedDate: '2026-10-14' },
    opsNote: 'fixture-internal-private',
};
const history = [{ timestamp: '2026-10-01', type: 'created', description: '이전 예약 기록' }];

async function fixture(t) {
    const raw = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true });
    t.after(() => raw.close());
    const stmt = (sql, args = []) => ({
        bind: (...values) => stmt(sql, values),
        async first() { return raw.prepare(sql).get(...args) ?? null; },
        async all() { return { results: raw.prepare(sql).all(...args) }; },
        async run() { return { meta: raw.prepare(sql).run(...args) }; },
        async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
        exec() {
            const statement = raw.prepare(sql);
            return /^\s*(select|pragma)\b/i.test(sql) ? { results: statement.all(...args) } : { meta: statement.run(...args), results: [] };
        },
    });
    const DB = { prepare: sql => stmt(sql), batch: async list => list.map(s => s.exec()) };
    await ensureSiteSchema(DB);
    raw.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, google_id TEXT, email TEXT, name TEXT, role TEXT, avatar_url TEXT, password_hash TEXT);
        CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER);`);
    for (const [id, role] of [['admin', 'admin'], ['owner', 'user'], ['other', 'user']]) {
        raw.prepare('INSERT INTO users (id,email,name,role) VALUES (?,?,?,?)').run(id, `${id}@example.invalid`, '로컬 테스트', role);
        raw.prepare('INSERT INTO sessions VALUES (?,?,?)').run(`test-${id}-session`, id, Date.now() + 86400000);
    }
    const insert = raw.prepare('INSERT INTO reservations (id,product_name,customer_name,customer_email,user_id,history,admin_operations,total_price) VALUES (?,?,?,?,?,?,?,?)');
    insert.run('owned-booking', '로컬 상품', '테스트 예약자', 'owner@example.invalid', 'owner', JSON.stringify(history), JSON.stringify(operations), 1234567);
    insert.run('guest-booking', '로컬 게스트 상품', '테스트 게스트', 'owner@example.invalid', null, JSON.stringify(history), JSON.stringify(operations), 2345678);
    const request = (path, { role, method = 'GET', body, text, headers = {} } = {}) => app.request(path, {
        method, headers: { ...(role ? { cookie: `auth_session=test-${role}-session` } : {}), ...(body !== undefined || text !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
        ...(body !== undefined ? { body: JSON.stringify(body) } : text !== undefined ? { body: text } : {}),
    }, { DB, ENVIRONMENT: 'production' });
    return { raw, DB, request };
}

const noInternalData = (value) => {
    assert.equal(Object.hasOwn(value, 'adminOperations'), false);
    assert.equal(Object.hasOwn(value, 'admin_operations'), false);
    assert.ok(!JSON.stringify(value).includes('fixture-internal-private'));
    assert.ok(!JSON.stringify(value).includes('fixture-receipt-private'));
    assert.ok(!JSON.stringify(value).includes('fixture-driver-private'));
};

test('상세 문서 저장은 공개 배정 플래그를 숫자로 저장하고 금액·잔금도 함께 유지한다', async t => {
    const { raw, request } = await fixture(t);
    const document = { name: '고객 일정', days: [{ day: 1, title: '도착', activities: [{ time: '09:30', title: '픽업' }] }] };
    for (const visible of [false, true]) {
        const result = await request('/owned-booking', { role: 'admin', method: 'PUT', body: {
            document_content: document, are_assignments_visible_to_user: visible,
            total_amount: 3300000, deposit_amount: 330000, balance_amount: 2970000,
        } });
        assert.equal(result.status, 200);
        const row = raw.prepare('SELECT document_content,are_assignments_visible_to_user,total_price,deposit_amount,balance_amount FROM reservations WHERE id=?').get('owned-booking');
        assert.deepEqual(JSON.parse(row.document_content), document);
        assert.equal(row.are_assignments_visible_to_user, visible ? 1 : 0);
        assert.equal(row.balance_amount, row.total_price - row.deposit_amount);
    }
});

test('관리자는 회원·게스트 예약 목록과 상세에서 운영 정보를 읽고 응답은 캐시하지 않는다', async t => {
    const { request } = await fixture(t);
    for (const path of ['/', '/owned-booking', '/guest-booking']) {
        const response = await request(path, { role: 'admin' });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        const body = await response.json();
        for (const row of Array.isArray(body) ? body : [body]) assert.deepEqual(row.adminOperations, operations);
    }
});

test('본인 회원과 이메일로 연결된 게스트 예약에도 내부 메모·영수증 번호를 노출하지 않는다', async t => {
    const { request } = await fixture(t);
    const list = await request('/', { role: 'owner' });
    assert.equal(list.status, 200);
    const rows = await list.json();
    assert.equal(rows.length, 2);
    rows.forEach(noInternalData);
    for (const path of ['/owned-booking', '/guest-booking']) {
        const response = await request(path, { role: 'owner' });
        assert.equal(response.status, 200);
        noInternalData(await response.json());
    }
});

test('게스트 공개 링크·일반 타계정·유효하지 않은 세션에도 운영 정보 키를 제거한다', async t => {
    const { request } = await fixture(t);
    for (const options of [{}, { role: 'other' }, { headers: { cookie: 'auth_session=expired-session' } }]) {
        const response = await request('/guest-booking', options);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        noInternalData(await response.json());
    }
    assert.equal((await request('/owned-booking')).status, 401);
    assert.equal((await request('/owned-booking', { role: 'other' })).status, 403);
    assert.equal((await request('/')).status, 401);
});

test('고객·게스트 조회는 관리자 메모만 숨기고 관리자와 DB의 전체 이력은 보존한다', async t => {
    const { raw, request } = await fixture(t);
    const completeHistory = [...history,
        { timestamp: '2026-10-02', type: 'admin_memo', description: 'fixture-admin-memo-private' },
        { timestamp: '2026-10-03', type: 'deposit_confirmed', description: '고객 공개 입금 확인 이력' }];
    for (const id of ['owned-booking', 'guest-booking']) {
        raw.prepare('UPDATE reservations SET history = ? WHERE id = ?').run(JSON.stringify(completeHistory), id);
    }
    const before = raw.prepare('SELECT id,history FROM reservations ORDER BY id').all();
    const visibleHistory = completeHistory.filter(entry => entry.type !== 'admin_memo');
    for (const [path, options] of [['/', { role: 'owner' }], ['/owned-booking', { role: 'owner' }],
        ['/guest-booking', { role: 'owner' }], ['/guest-booking', {}], ['/guest-booking', { role: 'other' }]]) {
        const response = await request(path, options);
        assert.equal(response.status, 200);
        const body = await response.json();
        for (const row of Array.isArray(body) ? body : [body]) assert.deepEqual(row.history, visibleHistory);
        assert.ok(!JSON.stringify(body).includes('fixture-admin-memo-private'));
    }
    for (const path of ['/', '/owned-booking', '/guest-booking']) {
        const body = await (await request(path, { role: 'admin' })).json();
        for (const row of Array.isArray(body) ? body : [body]) assert.deepEqual(row.history, completeHistory);
    }
    assert.deepEqual(raw.prepare('SELECT id,history FROM reservations ORDER BY id').all(), before);
});

test('관리자 저장 후 새 조회에서도 운영 정보가 유지되고 기존 예약·이력은 보존한다', async t => {
    const { raw, request } = await fixture(t);
    const before = raw.prepare('SELECT * FROM reservations WHERE id = ?').get('owned-booking');
    const next = { ...operations, joining: 'private', opsNote: '새 내부 메모', receipt: { ...operations.receipt, status: 'issued' } };
    const response = await request('/owned-booking', { role: 'admin', method: 'PUT', body: { adminOperations: next } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).adminOperations, next);
    const fresh = await request('/owned-booking', { role: 'admin' });
    assert.deepEqual((await fresh.json()).adminOperations, next);
    const after = raw.prepare('SELECT * FROM reservations WHERE id = ?').get('owned-booking');
    const { admin_operations: oldOps, ...oldRow } = before;
    const { admin_operations: newOps, ...newRow } = after;
    assert.deepEqual(newRow, oldRow);
    assert.deepEqual(JSON.parse(newOps), next);
});

test('snake_case와 JSON 문자열 부분 갱신이 다른 운영 값과 영수증 하위 값을 보존한다', async t => {
    const { request } = await fixture(t);
    const response = await request('/guest-booking', { role: 'admin', method: 'PUT', body: { admin_operations: JSON.stringify({ receipt: { status: 'issued' }, category: '수동 분류' }) } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).adminOperations, { ...operations, category: '수동 분류', receipt: { ...operations.receipt, status: 'issued' } });
});

test('권한 없는 PUT은 운영 정보를 변경하지 않는다', async t => {
    const { raw, request } = await fixture(t);
    const before = raw.prepare('SELECT admin_operations FROM reservations WHERE id = ?').get('guest-booking');
    assert.equal((await request('/guest-booking', { method: 'PUT', body: { adminOperations: {} } })).status, 401);
    assert.equal((await request('/guest-booking', { role: 'owner', method: 'PUT', body: { adminOperations: {} } })).status, 403);
    assert.deepEqual(raw.prepare('SELECT admin_operations FROM reservations WHERE id = ?').get('guest-booking'), before);
});

test('잘못된 JSON·타입·enum·길이·날짜·내부 임의 필드를 거절하고 저장하지 않는다', async t => {
    const { raw, request } = await fixture(t);
    const before = raw.prepare('SELECT * FROM reservations WHERE id = ?').get('owned-booking');
    const invalid = [null, [], '{bad-json', { joining: ['join'] }, { joining: 'unexpected' }, { region: 123 }, { region: 'a'.repeat(201) },
        { receipt: [] }, { receipt: { status: ['issued'] } }, { receipt: { status: 'unknown' } }, { receipt: { number: 123 } },
        { receipt: { issuedDate: '2026-02-30' } }, { receipt: { issuedDate: '2026-99-99' } }, { receipt: { secret: 'not-allowed' } },
        { opsNote: 'a'.repeat(5001) }, { arbitrary: 'not-allowed' }];
    for (const adminOperations of invalid) {
        const response = await request('/owned-booking', { role: 'admin', method: 'PUT', body: { adminOperations, history: [] } });
        assert.equal(response.status, 400, JSON.stringify(adminOperations).slice(0, 100));
    }
    assert.equal((await request('/owned-booking', { role: 'admin', method: 'PUT', text: '{bad' })).status, 400);
    assert.deepEqual(raw.prepare('SELECT * FROM reservations WHERE id = ?').get('owned-booking'), before);
});

test('고객 POST는 관리자 운영 정보 주입을 무시하고 본인의 새 예약만 만든다', async t => {
    const { raw, request } = await fixture(t);
    const response = await request('/', { role: 'owner', method: 'POST', body: { productName: '고객 접수 상품', customerName: '로컬 고객', email: 'owner@example.invalid', phone: 'fixture-phone',
        adminOperations: operations, admin_operations: operations, status: 'confirmed' } });
    assert.equal(response.status, 201);
    const { id } = await response.json();
    const row = raw.prepare('SELECT user_id,status,admin_operations FROM reservations WHERE id = ?').get(id);
    assert.equal(row.user_id, 'owner');
    assert.equal(row.status, 'pending_payment');
    assert.equal(row.admin_operations, null);
    noInternalData(await (await request(`/${id}`, { role: 'owner' })).json());
});

test('관리자 수동 접수는 운영 정보를 검증해 저장한다', async t => {
    const { request } = await fixture(t);
    const body = { id: 'manual-booking', productName: '수동 상품', customerName: '로컬 고객', adminOperations: operations };
    const response = await request('/', { role: 'admin', method: 'POST', body });
    assert.equal(response.status, 201);
    assert.deepEqual((await (await request('/manual-booking', { role: 'admin' })).json()).adminOperations, operations);
    const invalid = await request('/', { role: 'admin', method: 'POST', body: { ...body, id: 'invalid', adminOperations: { receipt: { number: 1 } } } });
    assert.equal(invalid.status, 400);
    assert.equal((await request('/invalid', { role: 'admin' })).status, 404);
});

test('기존 예약의 빈 운영 정보와 손상된 JSON도 안전한 관리자 기본값으로 읽는다', async t => {
    const { raw, request } = await fixture(t);
    for (const value of [null, '{bad-json']) {
        raw.prepare('UPDATE reservations SET admin_operations = ? WHERE id = ?').run(value, 'guest-booking');
        const response = await request('/guest-booking', { role: 'admin' });
        assert.equal(response.status, 200);
        const { adminOperations } = await response.json();
        assert.equal(adminOperations.joining, 'undecided');
        assert.deepEqual(adminOperations.receipt, { status: 'not_requested', number: '', issuedDate: '' });
        noInternalData(await (await request('/guest-booking')).json());
    }
});

test('기존 예약표에 운영 칸만 추가하며 고객 데이터와 이력을 유지한다', async t => {
    const raw = new DatabaseSync(':memory:');
    t.after(() => raw.close());
    raw.exec(`CREATE TABLE reservations (id TEXT PRIMARY KEY, customer_name TEXT, history TEXT);
        INSERT INTO reservations VALUES ('old', '로컬 이전 고객', '[{"type":"created"}]');`);
    const statement = (sql) => ({
        async all() { return { results: raw.prepare(sql).all() }; },
        async run() { return raw.prepare(sql).run(); },
    });
    const DB = { prepare: statement, batch: async statements => Promise.all(statements.map(s => s.run())) };
    const before = raw.prepare('SELECT id,customer_name,history FROM reservations').get();
    await ensureSiteSchema(DB);
    assert.equal(SITE_SCHEMA_VERSION, 2);
    assert.ok(raw.prepare('PRAGMA table_info(reservations)').all().some(c => c.name === 'admin_operations'));
    assert.deepEqual(raw.prepare('SELECT id,customer_name,history FROM reservations').get(), before);
    assert.deepEqual(await ensureSiteSchema(DB), []);
});
