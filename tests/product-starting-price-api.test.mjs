// Actual catalog endpoints, Lucia admin session and local SQLite only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';

const bundled = await build({ entryPoints: ['functions/api/products.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const app = (await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'))).default;
const tiers = [{ people: 2, pricePerPerson: 700000, depositPerPerson: 50000, localPaymentPerPerson: 650000 },
    { people: 6, pricePerPerson: 400000, depositPerPerson: 50000, localPaymentPerPerson: 350000 }];

async function fixture(t) {
    const raw = new DatabaseSync(':memory:'); t.after(() => raw.close());
    const statement = (sql, args = []) => ({ bind: (...values) => statement(sql, values),
        async first() { return raw.prepare(sql).get(...args) ?? null; },
        async all() { return { results: raw.prepare(sql).all(...args) }; },
        async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
        async run() { return { meta: raw.prepare(sql).run(...args) }; },
        exec() { return /^\s*(select|pragma)/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args), results: [] }; } });
    const DB = { prepare: sql => statement(sql), batch: async rows => rows.map(row => row.exec()) };
    await ensureSiteSchema(DB);
    raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
        CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);`);
    raw.prepare('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)').run('admin', 'admin@example.invalid', '로컬 관리자', 'admin');
    raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run('starting-price-admin', 'admin', Date.now() + 86400000);
    const request = (path, method = 'GET', body, admin = false) => app.request('http://local.example.invalid' + path, {
        method, headers: { ...(admin ? { cookie: 'auth_session=starting-price-admin' } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, { DB, ENVIRONMENT: 'production' });
    const create = (id, values = {}) => request('/', 'POST', { id, name: '로컬 여행', price: 999999, originalPrice: 1500000, pricingOptions: tiers, ...values }, true);
    const saved = id => raw.prepare('SELECT * FROM products WHERE id=?').get(id);
    const read = async (path, id = 'tour', admin = false) => { const response = await request(path, 'GET', undefined, admin); assert.equal(response.status, 200); const data = await response.json(); return Array.isArray(data) ? data.find(row => row.id === id) : data; };
    return { raw, request, create, saved, read };
}

test('상품 목록·요약·상세는 저장된 별도 가격 대신 같은 인원별 대표 가격과 기준 인원을 반환한다', async t => {
    const f = await fixture(t); assert.equal((await f.create('tour')).status, 200);
    assert.equal(f.saved('tour').price, 400000);
    // Older rows can still contain an independent amount; reading does not migrate them.
    f.raw.prepare('UPDATE products SET price=? WHERE id=?').run(999999, 'tour');
    for (const path of ['/', '/?summary=1', '/tour']) {
        const product = await f.read(path);
        assert.deepEqual([product.price, product.startingPrice, product.priceBasisPeople, product.priceReady], [400000, 400000, 6, true]);
        assert.deepEqual(product.pricingOptions, tiers); assert.deepEqual(JSON.parse(product.pricing_options), tiers);
        assert.equal(product.originalPrice, null); assert.equal(product.original_price, null);
    }
    assert.equal(f.saved('tour').price, 999999, 'GET must not rewrite existing catalog rows');
    const admin = await f.read('/tour', 'tour', true); assert.equal(admin.original_price, 1500000); assert.equal(admin.originalPrice, null);
});

test('상품 저장은 최종 요금표에서 대표 가격을 계산하고 부분 수정은 다른 요금표를 지우지 않는다', async t => {
    const f = await fixture(t); await f.create('tour');
    assert.equal((await f.request('/tour', 'PUT', { price: 1, name: '가격 입력과 이름 수정' }, true)).status, 200);
    assert.equal(f.saved('tour').price, 400000); assert.deepEqual(JSON.parse(f.saved('tour').pricing_options), tiers);
    const revised = [{ people: 8, pricePerPerson: 300000 }, { people: 4, pricePerPerson: 300000 }];
    assert.equal((await f.request('/tour', 'PUT', { price: 9999999, pricing_options: JSON.stringify(revised), pricingOptions: tiers }, true)).status, 200);
    const row = f.saved('tour'); assert.equal(row.price, 300000); assert.deepEqual(JSON.parse(row.pricing_options), revised);
    assert.equal((await f.read('/tour')).priceBasisPeople, 4);
    assert.equal((await f.request('/tour', 'PUT', { name: '이름만 변경' }, true)).status, 200);
    assert.equal(f.saved('tour').price, 300000); assert.deepEqual(JSON.parse(f.saved('tour').pricing_options), revised);
});

test('비어 있는 요금표·전부 0원·손상된 요금표는 문의 상태이며 임의의 기본 가격을 되살리지 않는다', async t => {
    const f = await fixture(t);
    for (const [id, pricingOptions] of [['empty', []], ['zero', [{ people: 2, pricePerPerson: 0 }]], ['broken', '{broken'], ['invalid', [{ people: 0, pricePerPerson: 100000 }]]]) {
        assert.equal((await f.create(id, { pricingOptions })).status, 200); assert.equal(f.saved(id).price, 0);
        const product = await f.read('/' + id, id);
        assert.deepEqual([product.price, product.startingPrice, product.priceBasisPeople, product.priceReady], [0, null, null, false]);
    }
    await f.create('tour'); assert.equal((await f.request('/tour', 'PUT', { pricing_options: [], price: 999999 }, true)).status, 200);
    assert.equal(f.saved('tour').price, 0); assert.deepEqual(JSON.parse(f.saved('tour').pricing_options), []);
    assert.equal((await f.read('/?summary=1')).priceReady, false);
});

test('요금표 변경은 기존 고객 예약·견적 금액을 갱신하지 않고 권한 없는 변경을 거부한다', async t => {
    const f = await fixture(t); await f.create('tour');
    f.raw.prepare('INSERT INTO reservations(id,product_id,total_price,deposit_amount,balance_amount) VALUES(?,?,?,?,?)').run('historic-booking', 'tour', 1234567, 234567, 1000000);
    f.raw.exec('CREATE TABLE requests(id TEXT PRIMARY KEY,data TEXT)');
    const quote = JSON.stringify({ booking: { contractInfo: { totalAmount: 7654321, depositAmount: 654321, balanceAmount: 7000000 } } });
    f.raw.prepare('INSERT INTO requests VALUES(?,?)').run('historic-quote', quote);
    const before = f.raw.prepare('SELECT * FROM reservations WHERE id=?').get('historic-booking');
    assert.equal((await f.request('/tour', 'PUT', { pricingOptions: [{ people: 6, pricePerPerson: 200000 }] }, true)).status, 200);
    assert.deepEqual(f.raw.prepare('SELECT * FROM reservations WHERE id=?').get('historic-booking'), before);
    assert.equal(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('historic-quote').data, quote);
    const catalogBefore = f.saved('tour');
    assert.equal((await f.request('/tour', 'PUT', { price: 1, pricingOptions: [] })).status, 401);
    assert.equal((await f.request('/', 'POST', { id: 'unauthorized', pricingOptions: tiers })).status, 401);
    assert.deepEqual(f.saved('tour'), catalogBefore); assert.equal(f.saved('unauthorized'), undefined);
});
