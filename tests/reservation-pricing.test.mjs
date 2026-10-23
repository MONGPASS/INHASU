// Actual Hono/Lucia/SQLite requests; no production storage or outbound messages.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';

const invoices = [];
globalThis.__localPricingInvoices = invoices;
const bundled = await build({ entryPoints: ['functions/api/reservations.ts'], bundle: true, platform: 'node', format: 'esm', write: false,
    plugins: [{ name: 'local-pricing-invoice', setup(builder) {
        builder.onResolve({ filter: /(?:^|\/)paypal(?:\.ts)?$/ }, () => ({ path: 'local-invoice', namespace: 'pricing-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'pricing-test' }, () => ({ contents: `export async function sendPayPalInvoice(input) {
            globalThis.__localPricingInvoices.push(input); return { invoiceId:'synthetic-invoice',invoiceNumber:'synthetic-number' };
        }` }));
    } }] });
const app = (await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].contents).toString('base64'))).default;
const tier = { people: 2, pricePerPerson: 50000, depositPerPerson: 540000, localPaymentPerPerson: 0 };
const split = (total = 100000, deposit = 100000, local = 0) => ({ total, deposit, local });

async function fixture(t) {
    const raw = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true }); t.after(() => raw.close());
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
    for (const [id, role] of [['customer', 'user'], ['admin', 'admin']]) {
        raw.prepare('INSERT INTO users(id,google_id,name,email,role) VALUES(?,?,?,?,?)').run(id, 'synthetic-' + id, '로컬 고객', id + '@example.invalid', role);
        raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run('pricing-' + id, id, Date.now() + 86400000);
    }
    raw.prepare('INSERT INTO products(id,name,price,pricing_options,accommodation_options,vehicle_options) VALUES(?,?,?,?,?,?)')
        .run('tour', '로컬 상품', 50000, JSON.stringify([tier]), '[]', '[]');
    const env = { DB, ENVIRONMENT: 'production', PAYPAL_ENABLED: 'false' };
    const request = (path, method = 'GET', body, role = 'customer') => app.request('http://local.example.invalid' + path, {
        method, headers: { cookie: 'auth_session=pricing-' + role, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }, env, { waitUntil(task) { return task; } });
    const body = (values = {}) => ({ product_id: 'tour', product_name: '로컬 상품', total_people: 2,
        customer_info: { name: '로컬 고객', email: 'customer@example.invalid', phone: '01000000000' }, price_breakdown: split(), ...values });
    const saved = id => raw.prepare('SELECT * FROM reservations WHERE id=?').get(id);
    const count = () => raw.prepare('SELECT COUNT(*) AS count FROM reservations').get().count;
    const updateProduct = values => { const keys = Object.keys(values); raw.prepare(`UPDATE products SET ${keys.map(key => key + '=?').join(',')} WHERE id=?`).run(...keys.map(key => values[key]), 'tour'); };
    const previousFetch = globalThis.fetch; globalThis.fetch = async () => { throw Error('External fetch is forbidden in pricing tests'); };
    t.after(() => { globalThis.fetch = previousFetch; });
    return { raw, env, request, body, saved, count, updateProduct };
}

test('오래된 54만원 예약금이 있는 1인 5만원 상품은 2명 총액·예약금 10만원으로 저장·조회·인보이스를 일치시킨다', async t => {
    const f = await fixture(t); const invoiceCount = invoices.length;
    Object.assign(f.env, { PAYPAL_ENABLED: 'true', PAYPAL_CLIENT_ID: 'local', PAYPAL_SECRET_KEY: 'local', PAYPAL_BUSINESS_EMAIL: 'local@example.invalid' });
    const response = await f.request('/', 'POST', f.body()); assert.equal(response.status, 201);
    const result = await response.json(), row = f.saved(result.id);
    assert.deepEqual(result.priceBreakdown, split()); assert.deepEqual(result.price_breakdown, split());
    assert.deepEqual([row.total_price, row.deposit_amount, row.balance_amount], [100000, 100000, 0]);
    const read = await (await f.request('/' + result.id)).json(); assert.deepEqual(read.price_breakdown, split());
    const list = await (await f.request('/')).json(); assert.deepEqual(list.find(item => item.id === result.id).price_breakdown, split());
    assert.equal(invoices.length, invoiceCount + 1); assert.equal(invoices.at(-1).depositAmount, 100000);
});

test('잘못된 예약금·합계·인원은 저장이나 인보이스 요청 전에 거부한다', async t => {
    const f = await fixture(t); const invoiceCount = invoices.length;
    Object.assign(f.env, { PAYPAL_ENABLED: 'true', PAYPAL_CLIENT_ID: 'local', PAYPAL_SECRET_KEY: 'local', PAYPAL_BUSINESS_EMAIL: 'local@example.invalid' });
    for (const amounts of [split(100000, 1080000, 0), split(100000, 0, -5), split(100000, 50000, 0), split(100000, null, 100000),
        split(100000, '', 100000), split(100000, true, 99999), split(100000, 'Infinity', 0), split(100000.5, 100000.5, 0), split(Number.MAX_SAFE_INTEGER + 1, 0, Number.MAX_SAFE_INTEGER + 1)]) {
        const response = await f.request('/', 'POST', f.body({ price_breakdown: amounts }));
        assert.equal(response.status, 400, JSON.stringify(amounts)); assert.equal((await response.json()).code, 'INVALID_PRICE');
    }
    for (const total_people of [0, -1, 1.5, true, '', 'Infinity']) assert.equal((await f.request('/', 'POST', f.body({ total_people }))).status, 400);
    for (const price_breakdown of [[], 'invalid']) assert.equal((await f.request('/', 'POST', f.body({ price_breakdown }))).status, 400);
    assert.equal(f.count(), 0); assert.equal(invoices.length, invoiceCount);
});

test('균형이 맞더라도 현재 상품과 다른 금액·요금 변경은 409로 차단한다', async t => {
    const f = await fixture(t), invoiceCount = invoices.length;
    for (const price_breakdown of [split(1, 1, 0), split(100000, 50000, 50000), split(1080000, 1080000, 0)]) {
        const response = await f.request('/', 'POST', f.body({ price_breakdown }));
        assert.equal(response.status, 409); assert.equal((await response.json()).code, 'PRICE_CHANGED');
    }
    f.updateProduct({ pricing_options: JSON.stringify([{ ...tier, pricePerPerson: 100000, depositPerPerson: 50000 }]) });
    const response = await f.request('/', 'POST', f.body()); assert.equal(response.status, 409);
    assert.equal(f.count(), 0); assert.equal(invoices.length, invoiceCount);
});

test('명시적인 0원 예약금과 정상 인원별 요금·옵션을 서버 원본에서 계산한다', async t => {
    const f = await fixture(t);
    f.updateProduct({ pricing_options: JSON.stringify([{ ...tier, depositPerPerson: 0 }]) });
    const zero = await f.request('/', 'POST', f.body({ price_breakdown: split(100000, 0, 100000) }));
    assert.equal(zero.status, 201); assert.equal(f.saved((await zero.json()).id).deposit_amount, 0);
    f.updateProduct({ pricing_options: JSON.stringify([{ people: 2, pricePerPerson: 100000, depositPerPerson: 30000, localPaymentPerPerson: 70000 }]),
        accommodation_options: JSON.stringify([{ id: 'camp', name: '캠프', priceModifier: 0, isDefault: true }, { id: 'hotel', name: '호텔', priceModifier: 50000 }]),
        vehicle_options: JSON.stringify([{ id: 'car', name: '차량', priceModifier: 10000, isDefault: true }, { id: 'discount-car', name: '할인 차량', priceModifier: -10000 }]) });
    const response = await f.request('/', 'POST', f.body({ selected_accom_id: 'hotel', selected_vehicle_id: 'discount-car', price_breakdown: split(240000, 60000, 180000) }));
    assert.equal(response.status, 201); const row = f.saved((await response.json()).id);
    assert.deepEqual([row.total_price, row.deposit_amount, row.balance_amount], [240000, 60000, 180000]);
    const invalid = await f.request('/', 'POST', f.body({ selected_accom_id: 'deleted-hotel', price_breakdown: split(210000, 60000, 150000) }));
    assert.equal(invalid.status, 400); assert.equal((await invalid.json()).code, 'INVALID_PRODUCT_PRICE'); assert.equal(f.count(), 2);
});

test('현재 상품의 전부 0원 요금표는 신규 예약을 받지 않고 과거 0원 예약은 그대로 조회한다', async t => {
    const f = await fixture(t);
    f.updateProduct({ price: 999999, pricing_options: JSON.stringify([{ ...tier, pricePerPerson: 0 }]) });
    const response = await f.request('/', 'POST', f.body({ price_breakdown: split(0, 0, 0) }));
    assert.equal(response.status, 400); assert.equal((await response.json()).code, 'INVALID_PRODUCT_PRICE'); assert.equal(f.count(), 0);
    f.raw.prepare('INSERT INTO reservations(id,product_id,user_id,total_price,deposit_amount,balance_amount) VALUES(?,?,?,?,?,?)').run('historic-zero', 'tour', 'customer', 0, 0, 0);
    const read = await (await f.request('/historic-zero')).json(); assert.deepEqual(read.price_breakdown, split(0, 0, 0));
});

test('요금표 없는 현재 상품은 접수를 막고 견적·관리자 수동 금액·기존 예약을 재산정하지 않는다', async t => {
    const f = await fixture(t);
    f.updateProduct({ pricing_options: '[]' });
    const legacy = await f.request('/', 'POST', f.body({ price_breakdown: split(1000000, 200000, 800000) }));
    assert.equal(legacy.status, 400); assert.equal((await legacy.json()).code, 'INVALID_PRODUCT_PRICE');
    const quote = await f.request('/', 'POST', f.body({ product_id: null, type: 'quote', price_breakdown: split(987654, 123456, 864198) }));
    assert.equal(quote.status, 201); assert.deepEqual((await quote.json()).priceBreakdown, split(987654, 123456, 864198));
    f.updateProduct({ pricing_options: JSON.stringify([tier]) });
    const manual = await f.request('/', 'POST', f.body({ id: 'manual', price_breakdown: split(999999, 12345, 987654) }), 'admin');
    assert.equal(manual.status, 201); assert.deepEqual((await manual.json()).priceBreakdown, split(999999, 12345, 987654));
    // A later catalog edit does not reprice stored bookings on read.
    f.updateProduct({ pricing_options: JSON.stringify([{ ...tier, pricePerPerson: 9999999 }]) });
    const saved = await (await f.request('/manual', 'GET', undefined, 'admin')).json();
    assert.deepEqual(saved.price_breakdown, split(999999, 12345, 987654));
});

test('0원·잘못된 행과 유효한 6인 요금이 섞여 있어도 실제 예약은 공개된 구간과 같은 금액을 저장한다', async t => {
    const f = await fixture(t);
    f.updateProduct({ pricing_options: JSON.stringify([null, { people: 0, pricePerPerson: 1 }, { ...tier, pricePerPerson: 0 },
        { people: '6', price_per_person: '400000', deposit_per_person: '50000', local_payment_per_person: '350000' }]) });
    const response = await f.request('/', 'POST', f.body({ total_people: 6, price_breakdown: split(2400000, 300000, 2100000) }));
    assert.equal(response.status, 201); const result = await response.json(), row = f.saved(result.id);
    assert.equal(row.travelers, 6); assert.deepEqual([row.total_price, row.deposit_amount, row.balance_amount], [2400000, 300000, 2100000]);
    assert.deepEqual(result.priceBreakdown, split(2400000, 300000, 2100000));
    const below = await f.request('/', 'POST', f.body({ total_people: 2, price_breakdown: split(800000, 100000, 700000) }));
    assert.equal(below.status, 400); assert.equal((await below.json()).code, 'MINIMUM_PEOPLE'); assert.equal(f.count(), 1);
    const above = await f.request('/', 'POST', f.body({ total_people: 8, price_breakdown: split(3200000, 400000, 2800000) }));
    assert.equal(above.status, 201, '최대 등록 인원보다 큰 그룹은 기존 최대 구간 계산을 유지');
    assert.equal((await f.request('/', 'POST', f.body({ total_people: 6, price_breakdown: split(0, 0, 0) }))).status, 409);
});

test('손상된 상품 요금표와 잘못된 JSON 요청은 가격을 추정하거나 저장하지 않는다', async t => {
    const f = await fixture(t);
    for (const pricing_options of ['{broken', '{}', JSON.stringify([{ ...tier, pricePerPerson: -1 }])]) {
        f.updateProduct({ pricing_options }); const response = await f.request('/', 'POST', f.body());
        assert.equal(response.status, 400); assert.equal((await response.json()).code, 'INVALID_PRODUCT_PRICE');
    }
    for (const body of [null, [], 'invalid']) assert.equal((await f.request('/', 'POST', body)).status, 400);
    assert.equal(f.count(), 0);
});
