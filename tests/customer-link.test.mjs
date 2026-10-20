// Real Hono/Lucia/SQLite; every provider request is intercepted and never leaves this process.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';

const result = await build({ entryPoints: ['functions/api/customer-access.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const app = (await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'))).default;
const token = 'fixture-legacy-request-token';
const storedEmail = 'legacy.customer@stored.example.invalid';
const storedPhone = '01012345678';

async function fixture(t) {
    const raw = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true });
    t.after(() => raw.close());
    let beforeBatch;
    const statement = (sql, args = []) => ({
        sql, bind: (...values) => statement(sql, values),
        first: async () => raw.prepare(sql).get(...args) ?? null,
        all: async () => ({ results: raw.prepare(sql).all(...args) }),
        raw: async () => raw.prepare(sql).all(...args).map(row => Object.values(row)),
        run: async () => ({ meta: raw.prepare(sql).run(...args) }),
        exec: () => /^\s*(SELECT|PRAGMA)/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args), results: [] },
    });
    const DB = { prepare: sql => statement(sql), batch: async rows => {
        beforeBatch?.(rows.map(row => row.sql));
        raw.exec('BEGIN IMMEDIATE');
        try { const results = rows.map(row => row.exec()); raw.exec('COMMIT'); return results; }
        catch (error) { raw.exec('ROLLBACK'); throw error; }
    } };
    await ensureSiteSchema(DB);
    raw.exec(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
    raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
        CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);`);
    for (const id of ['owner', 'other', 'password-only']) {
        raw.prepare('INSERT INTO users(id,google_id,email,name,role) VALUES(?,?,?,?,?)').run(id,
            id === 'password-only' ? null : `google-${id}`, `${id}@account.example.invalid`, id, 'user');
        raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run(`link-session-${id}`, id, Date.now() + 90 * 86400000);
    }
    raw.prepare('INSERT INTO requests(id,name,phone,destination,status,data,token,received_at) VALUES(?,?,?,?,?,?,?,?)').run('legacy-request', 'PRIVATE-CUSTOMER', storedPhone, '공개 가능한 여행지', '신규',
        JSON.stringify({ name: 'PRIVATE-CUSTOMER', email: storedEmail, phone: storedPhone, adult: 2, depart: '2026-11-01', return_: '2026-11-03',
            userId: 'other', user_id: 'other', memo: 'PRIVATE-MEMO', booking: { travelers: [{ passportNo: 'PRIVATE-PASSPORT' }], contract: { signImg: 'PRIVATE-SIGNATURE' } } }), token, '2026-10-20');
    raw.prepare('INSERT INTO quotes(id,name,type,email,phone,user_id,destination,created_at,admin_note) VALUES(?,?,?,?,?,?,?,?,?)')
        .run('legacy-quote', 'PRIVATE-QUOTE-CUSTOMER', 'personal', storedEmail, storedPhone, null, '예전 여행', '2026-10-19', 'PRIVATE-QUOTE-MEMO');
    raw.prepare('INSERT INTO reservations(id,customer_name,customer_email,customer_phone,user_id,product_name,status) VALUES(?,?,?,?,?,?,?)')
        .run('legacy-reservation', 'PRIVATE-BOOKING-CUSTOMER', storedEmail, storedPhone, null, '예전 예약', 'confirmed');
    const oldFetch = globalThis.fetch, oldNow = Date.now;
    const clock = { now: oldNow() };
    Date.now = () => clock.now;
    const outbox = [];
    let delivery = 'accepted';
    globalThis.fetch = async (url, options = {}) => {
        const target = String(url);
        assert.ok(['https://api.resend.com/emails', 'https://api.solapi.com/messages/v4/send'].includes(target), `Unmocked external request: ${target}`);
        const body = JSON.parse(options.body), content = body.html || body.message?.text || '';
        const code = content.match(/(?:>|인증번호\s)(\d{8})(?:<|\s)/)?.[1];
        assert.match(code || '', /^\d{8}$/, 'The synthetic provider receives an eight-digit code');
        outbox.push({ url: target, body, code });
        if (delivery === 'failed') return Response.json({ message: 'fixture rejection' }, { status: 503 });
        if (delivery === 'rejected-200') return Response.json({ statusCode: '4001', errorCode: 'REJECTED', failedMessageList: [{ reason: 'fixture rejection' }] });
        return Response.json(target.includes('resend') ? { id: 'fixture-email-receipt' } : { messageId: 'fixture-sms-receipt', statusCode: '2000' });
    };
    t.after(() => { globalThis.fetch = oldFetch; Date.now = oldNow; });
    const env = { DB, ENVIRONMENT: 'production', GOOGLE_CLIENT_SECRET: 'test-secret', RESEND_API_KEY: 'test',
        SOLAPI_API_KEY: 'fixture-api-key', SOLAPI_API_SECRET: 'fixture-api-secret', SOLAPI_SENDER: '01099990000' };
    const request = (path, { user = 'owner', method = 'GET', body, headers = {}, overrides = {} } = {}) => app.request('https://site.test' + path, {
        method, headers: { ...(user ? { cookie: `auth_session=link-session-${user}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            'CF-Connecting-IP': user === 'other' ? '192.0.2.2' : '192.0.2.1', ...headers },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }, { ...env, ...overrides });
    const challenge = async (source = 'request', key = token, options = {}) => {
        const response = await request('/challenge', { method: 'POST', body: { source, key, channel: 'email', ...options }, ...(options.request || {}) });
        assert.equal(response.status, 200, await response.clone().text());
        return { ...(await response.json()), code: outbox.at(-1).code };
    };
    const verify = (issued, options = {}) => request('/verify', { method: 'POST', body: { challengeId: issued.challengeId, code: issued.code }, ...options });
    const linkOwner = (source, id) => raw.prepare('SELECT user_id FROM customer_resource_links WHERE source=? AND resource_id=?').get(source, id)?.user_id;
    return { raw, DB, env, request, challenge, verify, outbox, clock, linkOwner,
        setDelivery(value) { delivery = value; }, beforeBatch(callback) { beforeBatch = callback; } };
}

test('기록 확인·인증·이력 API는 비로그인과 Google 연결 없는 세션에 닫혀 있다', async t => {
    const f = await fixture(t);
    for (const user of [null, 'password-only']) {
        for (const [path, method, body] of [[`/status?source=request&key=${token}`, 'GET'], ['/history', 'GET'], ['/challenge', 'POST', { source: 'request', key: token, channel: 'email' }], ['/verify', 'POST', { challengeId: 'unknown', code: '12345678' }]]) {
            const response = await f.request(path, { user, method, body });
            assert.equal(response.status, 401); assert.equal((await response.json()).code, 'login_required');
        }
    }
    assert.equal(f.outbox.length, 0);
});

test('상태는 마스킹 연락처만 반환하고 예전 JSON의 임의 userId를 소유권으로 인정하지 않는다', async t => {
    const f = await fixture(t);
    for (const user of ['owner', 'other']) {
        const response = await f.request(`/status?source=request&key=${token}`, { user });
        assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
        const text = await response.text(), body = JSON.parse(text);
        assert.equal(body.state, 'verification_required'); assert.equal(body.codeLength, 8);
        assert.deepEqual(body.channels.map(channel => channel.kind), ['email', 'sms']);
        for (const secret of [storedEmail, storedPhone, 'PRIVATE-CUSTOMER', 'PRIVATE-PASSPORT', 'PRIVATE-SIGNATURE']) assert.ok(!text.includes(secret), secret);
        assert.match(body.channels[0].masked, /\*\*\*/); assert.equal(body.channels[1].masked, '010-****-5678');
    }
    assert.equal(f.outbox.length, 0);
});

test('이메일·SMS 수신자는 저장된 연락처로만 결정하며 인증번호 원문은 응답이나 DB에 남지 않는다', async t => {
    const f = await fixture(t);
    const issued = await f.challenge('request', token, { email: 'attacker@example.invalid', phone: '01000000000', to: 'attacker@example.invalid' });
    assert.deepEqual(f.outbox[0].body.to, [storedEmail]);
    const stored = f.raw.prepare('SELECT * FROM customer_link_challenges WHERE id=?').get(issued.challengeId);
    assert.equal(stored.ready, 1); assert.equal(stored.user_id, 'owner'); assert.equal(stored.resource_id, 'legacy-request');
    assert.match(stored.code_hash, /^[a-f0-9]{64}$/); assert.match(stored.contact_hash, /^[a-f0-9]{64}$/);
    for (const secret of [issued.code, storedEmail, storedPhone]) assert.ok(!JSON.stringify(stored).includes(secret), secret);
    assert.ok(!JSON.stringify({ ...issued, code: undefined }).includes(issued.code));
    f.clock.now += 61000;
    await f.challenge('request', token, { channel: 'sms', phone: '01000000000' });
    assert.equal(f.outbox.at(-1).body.message.to, storedPhone); assert.equal(f.outbox.at(-1).body.message.from, '01099990000');
    assert.notEqual(f.raw.prepare('SELECT used_at FROM customer_link_challenges WHERE id=?').get(issued.challengeId).used_at, null);
});

test('인증 성공은 requests의 전용 링크와 quotes·reservations의 정식 user_id에 각각 귀속된다', async t => {
    const f = await fixture(t);
    for (const [source, key, id] of [['request', token, 'legacy-request'], ['quote', 'legacy-quote', 'legacy-quote'], ['reservation', 'legacy-reservation', 'legacy-reservation']]) {
        const issued = await f.challenge(source, key), response = await f.verify(issued);
        assert.equal(response.status, 200, await response.clone().text()); assert.deepEqual(await response.json(), { ok: true });
        assert.equal(f.linkOwner(source, id), 'owner');
        if (source !== 'request') assert.equal(f.raw.prepare(`SELECT user_id FROM ${source === 'quote' ? 'quotes' : 'reservations'} WHERE id=?`).get(id).user_id, 'owner');
        const state = await (await f.request(`/status?source=${source}&key=${key}`)).json(); assert.equal(state.state, 'linked');
        assert.equal((await f.request(`/status?source=${source}&key=${key}`, { user: 'other' })).status, 403);
        assert.notEqual(f.raw.prepare('SELECT used_at FROM customer_link_challenges WHERE id=?').get(issued.challengeId).used_at, null);
    }
});

test('다른 로그인 계정의 인증번호 제출·소비된 번호 재사용은 소유권을 바꾸지 않는다', async t => {
    const f = await fixture(t), issued = await f.challenge();
    assert.equal((await f.verify(issued, { user: 'other' })).status, 400);
    assert.equal(f.raw.prepare('SELECT attempts FROM customer_link_challenges WHERE id=?').get(issued.challengeId).attempts, 0);
    assert.equal(f.linkOwner('request', 'legacy-request'), undefined);
    assert.equal((await f.verify(issued)).status, 200);
    assert.equal((await f.verify(issued)).status, 400);
    assert.equal(f.linkOwner('request', 'legacy-request'), 'owner');
});

test('만료되거나 다섯 번 틀린 인증번호는 올바른 번호로도 연결되지 않는다', async t => {
    const f = await fixture(t), expired = await f.challenge();
    f.clock.now += 10 * 60000 + 1;
    assert.equal((await f.verify(expired)).status, 400); assert.equal(f.linkOwner('request', 'legacy-request'), undefined);
    const issued = await f.challenge(), wrong = issued.code === '00000000' ? '11111111' : '00000000';
    for (let attempt = 0; attempt < 5; attempt++) assert.equal((await f.verify({ ...issued, code: wrong })).status, 400);
    assert.equal((await f.verify(issued)).status, 400);
    assert.equal(f.raw.prepare('SELECT attempts FROM customer_link_challenges WHERE id=?').get(issued.challengeId).attempts, 5);
    assert.equal(f.linkOwner('request', 'legacy-request'), undefined);
});

test('재발송은 이전 인증번호를 폐기하고 레코드 쿨다운은 계정이 달라도 DB에 유지된다', async t => {
    const f = await fixture(t), first = await f.challenge();
    const throttled = await f.request('/challenge', { user: 'other', method: 'POST', body: { source: 'request', key: token, channel: 'email' } });
    assert.equal(throttled.status, 429); assert.equal((await throttled.json()).code, 'rate_limited'); assert.equal(f.outbox.length, 1);
    assert.equal(f.raw.prepare("SELECT COUNT(*) AS n FROM customer_link_limits WHERE key LIKE 'cool:%'").get().n, 1);
    f.clock.now += 61000; const second = await f.challenge();
    assert.notEqual(first.challengeId, second.challengeId); assert.equal((await f.verify(first)).status, 400);
    assert.equal((await f.verify(second)).status, 200);
});

test('저장 연락처 또는 고객 링크가 바뀌면 기존 번호가 맞아도 연결을 거부한다', async t => {
    const f = await fixture(t), issued = await f.challenge('quote', 'legacy-quote');
    f.raw.prepare('UPDATE quotes SET email=? WHERE id=?').run('changed@example.invalid', 'legacy-quote');
    assert.equal((await f.verify(issued)).status, 409); assert.equal(f.linkOwner('quote', 'legacy-quote'), undefined);
    const requestCode = await f.challenge();
    f.raw.prepare('UPDATE requests SET token=? WHERE id=?').run('fixture-rotated-request-token', 'legacy-request');
    assert.equal((await f.verify(requestCode)).status, 409); assert.equal(f.linkOwner('request', 'legacy-request'), undefined);
});

test('검증 중 상품·견적 소유자가 달라진 CAS 경쟁은 다른 계정의 소유권을 덮어쓰지 않는다', async t => {
    const f = await fixture(t);
    for (const [source, table, id] of [['quote', 'quotes', 'legacy-quote'], ['reservation', 'reservations', 'legacy-reservation']]) {
        const issued = await f.challenge(source, id);
        let injected = false;
        f.beforeBatch(commands => { if (!injected && commands.some(sql => sql.startsWith(`UPDATE ${table} SET user_id`))) {
            injected = true; f.raw.prepare(`UPDATE ${table} SET user_id=? WHERE id=?`).run('other', id);
        } });
        assert.equal((await f.verify(issued)).status, 409);
        assert.equal(injected, true); assert.equal(f.raw.prepare(`SELECT user_id FROM ${table} WHERE id=?`).get(id).user_id, 'other');
        assert.equal(f.linkOwner(source, id), undefined);
    }
});

test('최종 연결 직전 연락처·고객 링크가 바뀐 CAS 경쟁도 과거 인증으로 연결하지 않는다', async t => {
    const f = await fixture(t);
    for (const [source, key, id, change] of [
        ['quote', 'legacy-quote', 'legacy-quote', () => f.raw.prepare('UPDATE quotes SET email=? WHERE id=?').run('changed-during-verify@example.invalid', 'legacy-quote')],
        ['reservation', 'legacy-reservation', 'legacy-reservation', () => f.raw.prepare('UPDATE reservations SET customer_email=? WHERE id=?').run('changed-during-verify@example.invalid', 'legacy-reservation')],
        ['request', token, 'legacy-request', () => f.raw.prepare('UPDATE requests SET token=? WHERE id=?').run('rotated-during-verify-token', 'legacy-request')],
    ]) {
        f.beforeBatch(undefined);
        const issued = await f.challenge(source, key);
        let injected = false;
        f.beforeBatch(commands => { if (!injected && commands.some(sql => sql.startsWith('INSERT OR IGNORE INTO customer_resource_links'))) { injected = true; change(); } });
        const response = await f.verify(issued);
        assert.equal(injected, true); assert.equal(response.status, 409, source);
        assert.equal(f.linkOwner(source, id), undefined, source);
        if (source !== 'request') assert.equal(f.raw.prepare(`SELECT user_id FROM ${source === 'quote' ? 'quotes' : 'reservations'} WHERE id=?`).get(id).user_id, null);
    }
});

test('외부 발송 실패·설정 없음은 사용 가능한 인증번호를 만들지 않는다', async t => {
    const f = await fixture(t); f.setDelivery('failed');
    const response = await f.request('/challenge', { method: 'POST', body: { source: 'request', key: token, channel: 'email' } });
    assert.equal(response.status, 503); assert.equal((await response.json()).code, 'delivery_unavailable');
    const row = f.raw.prepare('SELECT * FROM customer_link_challenges').get(); assert.equal(row.ready, 0); assert.notEqual(row.used_at, null);
    assert.equal((await f.verify({ challengeId: row.id, code: f.outbox[0].code })).status, 400);
    const noConfig = await f.request('/challenge', { method: 'POST', overrides: { RESEND_API_KEY: '' }, body: { source: 'quote', key: 'legacy-quote', channel: 'email' } });
    assert.equal(noConfig.status, 409); assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM customer_link_challenges').get().n, 1);
});

test('Solapi가 200 응답 안에서 발송을 거절한 경우도 인증을 활성화하지 않는다', async t => {
    const f = await fixture(t); f.setDelivery('rejected-200');
    const response = await f.request('/challenge', { method: 'POST', body: { source: 'request', key: token, channel: 'sms' } });
    assert.equal(response.status, 503);
    const row = f.raw.prepare('SELECT * FROM customer_link_challenges').get(); assert.equal(row.ready, 0); assert.notEqual(row.used_at, null);
});

test('타 사이트 Origin과 cross-site 요청은 인증번호 발송·검증을 실행하지 않는다', async t => {
    const f = await fixture(t);
    for (const headers of [{ Origin: 'https://attacker.invalid' }, { 'Sec-Fetch-Site': 'cross-site' }]) for (const path of ['/challenge', '/verify']) {
        const response = await f.request(path, { method: 'POST', headers, body: { source: 'request', key: token, channel: 'email', challengeId: 'unknown', code: '12345678' } });
        assert.equal(response.status, 403); assert.equal((await response.json()).code, 'invalid_origin');
    }
    assert.equal(f.outbox.length, 0);
});

test('마이페이지 이력은 연결된 요청·본인 견적만 반환하고 내부 정보·타계정·JSON userId를 배제한다', async t => {
    const f = await fixture(t);
    for (const user of ['owner', 'other']) assert.deepEqual((await (await f.request('/history', { user })).json()).items, []);
    for (const [source, key] of [['request', token], ['quote', 'legacy-quote']]) assert.equal((await f.verify(await f.challenge(source, key))).status, 200);
    const response = await f.request('/history'), text = await response.text(), body = JSON.parse(text);
    assert.deepEqual(new Set(body.items.map(item => `${item.source}:${item.id}`)), new Set(['request:legacy-request', 'quote:legacy-quote']));
    assert.equal(body.items.find(item => item.source === 'request').href, `/내견적.html?t=${token}`);
    assert.equal(body.items.find(item => item.source === 'quote').href, '/estimate/legacy-quote');
    for (const secret of [storedEmail, storedPhone, 'PRIVATE-CUSTOMER', 'PRIVATE-PASSPORT', 'PRIVATE-MEMO', 'PRIVATE-SIGNATURE', 'PRIVATE-QUOTE-MEMO']) assert.ok(!text.includes(secret), secret);
    assert.deepEqual((await (await f.request('/history', { user: 'other' })).json()).items, []);
});
