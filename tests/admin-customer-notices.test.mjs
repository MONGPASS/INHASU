import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { Hono } from 'hono';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { onRequestGet as readCustomerQuote } from '../functions/api/my/[token].js';

const output = await build({ entryPoints: ['functions/api/admin-customer-notices.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const notices = (await import(`data:text/javascript;base64,${Buffer.from(output.outputFiles[0].contents).toString('base64')}`)).default;
const envConfig = { ENVIRONMENT: 'production', SOLAPI_API_KEY: 'mock-key', SOLAPI_API_SECRET: 'mock-secret', SOLAPI_PF_ID: 'mock-channel',
    SOLAPI_TEMPLATE_QUOTE_ID: 'template-quote', SOLAPI_TEMPLATE_CONTRACT_ID: 'template-contract', SOLAPI_TEMPLATE_ITINERARY_ID: 'template-itinerary', SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID: 'template-travel-notice' };
async function fixture(t) {
    const raw = new DatabaseSync(':memory:'); t.after(() => raw.close());
    let failLedger = '';
    let claimMutation;
    const statement = (sql, args = []) => ({ bind: (...values) => statement(sql, values),
        async run() { if (failLedger && sql.includes(failLedger)) throw Error('ledger unavailable'); const meta = raw.prepare(sql).run(...args); if (claimMutation && sql.includes('INSERT INTO admin_delivery_attempts')) { const mutate = claimMutation; claimMutation = undefined; mutate(); } return { meta }; },
        async all() { if (failLedger && sql.includes(failLedger)) throw Error('ledger unavailable'); return { results: raw.prepare(sql).all(...args) }; },
        async first() { if (failLedger && sql.includes(failLedger)) throw Error('ledger unavailable'); return raw.prepare(sql).get(...args) ?? null; },
        async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
        exec() { return /^\s*(select|pragma)/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args), results: [] }; } });
    const DB = { prepare: sql => statement(sql), batch: async entries => entries.map(entry => entry.exec()) }; await ensureSiteSchema(DB);
    raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
        CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);
        CREATE TABLE requests(id TEXT PRIMARY KEY,name TEXT,phone TEXT,token TEXT,status TEXT,data TEXT);`);
    raw.prepare('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)').run('admin', 'admin@example.invalid', '테스트 관리자', 'admin');
    raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run('notice-admin', 'admin', Date.now() + 86_400_000);
    raw.prepare('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)').run('member', 'member@example.invalid', '회원', 'user');
    raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run('notice-member', 'member', Date.now() + 86_400_000);
    raw.prepare(`INSERT INTO reservations(id,customer_name,customer_phone,product_name,status,deposit_status,start_date,itinerary_url,document_content,contract_data)
        VALUES(?,?,?,?,?,?,?,?,?,?)`).run('same-id', '상품 고객', '01012345678', '상품', 'confirmed', 'paid', '2026-11-01', 'https://example.invalid/documents/itinerary/same-id', JSON.stringify({ days: [{ day: 1, title: '테렐지', activities: [] }] }), JSON.stringify({ agreement: { agreed: false }, travelers: [] }));
    const quote = { name: '견적 고객', phone: '01022223333', token: 'private-customer-token-1234', depart: '2026-11-01', adult: 2, child: 1, infant: 0, quote: { name: '고비 견적', detailDays: [{ dest: '고비' }] }, decision: { status: 'accepted' },
        booking: { days: [{ d: 1, dest: '고비', items: ['초원 산책'] }], contractInfo: { depositStatus: '입금완료' }, publishStatus: 'published', contract: { signedAt: null } } };
    raw.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?)').run('same-id', quote.name, quote.phone, quote.token, '예약확정', JSON.stringify(quote));
    const app = new Hono(); app.route('/api/admin/customer-notices', notices);
    const request = (source = 'product', { body, id = 'same-id', session = 'admin', headers = {}, env = {} } = {}) => app.request(`https://admin.example.invalid/api/admin/customer-notices/${source}/${id}`, {
        method: body === undefined ? 'GET' : 'POST', headers: { ...(session ? { cookie: `auth_session=notice-${session}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json', Origin: 'https://admin.example.invalid' }), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }, { ...envConfig, DB, ...env });
    const originalFetch = globalThis.fetch;
    const sent = [];
    globalThis.fetch = async (url, init) => { assert.equal(url, 'https://api.solapi.com/messages/v4/send'); sent.push(JSON.parse(init.body)); return Response.json({ groupId: `provider-${sent.length}`, statusCode: '2000' }); };
    t.after(() => globalThis.fetch = originalFetch);
    return { raw, DB, request, sent, quote, fail: sql => { failLedger = sql; }, onClaim: mutate => { claimMutation = mutate; } };
}
const body = (kind, key = `request-${kind}-123456789`) => ({ kind, idempotencyKey: key });
const updateQuote = (raw, quote) => raw.prepare('UPDATE requests SET data=? WHERE id=?').run(JSON.stringify(quote), 'same-id');

test('알림 상태 조회는 발송·고객 정보 변경 없이 관리자에게만 수신자와 가능 여부를 보여 준다', async t => {
    const { request, sent, raw } = await fixture(t);
    const before = raw.prepare('SELECT * FROM reservations').get();
    const response = await request(); const data = await response.json();
    assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(data.recipient, { name: '상품 고객', phone: '***-****-5678' });
    assert.deepEqual(data.notices.map(item => item.kind), ['contract', 'itinerary', 'travel_notice']);
    assert.ok(data.notices.filter(item => item.kind !== 'travel_notice').every(item => item.available));
    assert.equal(data.notices.find(item => item.kind === 'travel_notice').available, false);
    assert.match(data.notices.find(item => item.kind === 'travel_notice').reason, /계약서 작성 완료/);
    assert.deepEqual(data.automation.notices.map(item => item.kind), ['contract', 'contract_signed', 'booking_confirmed', 'itinerary', 'travel_notice']);
    assert.equal(sent.length, 0); assert.deepEqual(raw.prepare('SELECT * FROM reservations').get(), before);
    assert.equal((await request('product', { session: '' })).status, 401);
    assert.equal((await request('product', { session: 'member' })).status, 403);
    assert.equal((await request('bad')).status, 400);
    assert.equal((await request('product', { id: 'missing' })).status, 404);
    assert.equal((await request('product', { body: body('contract'), headers: { Origin: 'https://evil.invalid' } })).status, 403);
    assert.equal((await request('product', { body: body('contract'), headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.equal(sent.length, 0);
});

test('각 원본의 실제 문서 경로·수신자를 사용하고 카카오만 발송하며 업무 상태는 변경하지 않는다', async t => {
    const { request, sent, raw } = await fixture(t);
    raw.exec("UPDATE reservations SET contract_data=json_set(contract_data,'$.signature.signedAt','2026-10-20T00:00:00Z')");
    const beforeProduct = raw.prepare('SELECT * FROM reservations').get(), beforeQuote = raw.prepare('SELECT * FROM requests').get();
    const cases = [['product', 'contract', 'documents/contract/same-id'], ['product', 'itinerary', 'documents/itinerary/same-id'], ['product', 'travel_notice', 'guidebooks/mongolia-travel-guidebook-2026.pdf'],
        ['quote_booking', 'quote', `${encodeURI('내견적.html')}?t=private-customer-token-1234`], ['quote_booking', 'contract', `${encodeURI('내견적.html')}?t=private-customer-token-1234`], ['quote_booking', 'itinerary', `${encodeURI('확정일정표.html')}?t=private-customer-token-1234`]];
    for (const [source, kind, path] of cases) {
        const response = await request(source, { body: body(kind) }); assert.equal(response.status, 200);
        const result = await response.json(); assert.equal(result.state, 'accepted'); assert.equal(result.ok, true);
        const message = sent.at(-1).message;
        assert.equal(message.to, source === 'product' ? '01012345678' : '01022223333');
        assert.equal(message.kakaoOptions.variables['#{링크}'], path);
        assert.equal(message.kakaoOptions.disableSms, true); assert.equal(message.text, undefined); assert.equal(message.kakaoOptions.buttons, undefined);
    }
    assert.deepEqual(raw.prepare('SELECT * FROM reservations').get(), beforeProduct);
    const afterQuote = raw.prepare('SELECT * FROM requests').get();
    assert.deepEqual({ ...afterQuote, data: '' }, { ...beforeQuote, data: '' });
    const beforeData = JSON.parse(beforeQuote.data), afterData = JSON.parse(afterQuote.data);
    assert.equal(afterData.booking.contractRequest.status, 'requested'); assert.equal(afterData.booking.travelerSubmission.status, 'requested');
    assert.equal(afterData.activities.at(-1).type, 'contract_requested');
    beforeData.booking.contractRequest = afterData.booking.contractRequest; beforeData.booking.travelerSubmission = afterData.booking.travelerSubmission; beforeData.activities = afterData.activities;
    assert.deepEqual(afterData, beforeData, '발송 요청 메타데이터 외의 여행·서명·금액·공개 정보는 보존한다');
    assert.equal(raw.prepare('SELECT count(*) n FROM admin_delivery_attempts').get().n, cases.length);
    const state = await (await request()).json(); assert.equal(state.notices[0].lastAttempt.state, 'accepted'); assert.equal(state.notices[0].available, false); assert.ok(state.notices[0].cooldownUntil);
    assert.ok(!(await (await request()).text()).includes('private-customer-token'));
});

test('중복 키는 같은 영수증을 반환하며 새 키도 1분 동안 중복 발송하지 않는다', async t => {
    const { request, sent, raw } = await fixture(t);
    const initial = await (await request('product', { body: body('contract') })).json();
    const repeat = await (await request('product', { body: body('contract') })).json();
    assert.equal(repeat.duplicate, true); assert.equal(repeat.id, initial.id); assert.equal(sent.length, 1);
    assert.equal((await request('product', { body: body('contract', 'different-key-123456789') })).status, 409); assert.equal(sent.length, 1);
    raw.prepare('UPDATE admin_delivery_attempts SET created_at=?').run(new Date(Date.now() - 61_000).toISOString());
    assert.equal((await request('product', { body: body('contract', 'after-minute-key-123456') })).status, 200); assert.equal(sent.length, 2);
});

test('삭제·취소·없는 연락처·미완료 문서·없는 템플릿·다른 수신자 입력을 실제 발송 전에 거부한다', async t => {
    const { request, sent, raw, quote } = await fixture(t);
    assert.equal((await request('product', { body: { ...body('contract'), phone: '01099998888' } })).status, 400);
    assert.equal((await request('product', { body: { kind: 'contract', idempotencyKey: 1234567890123456 } })).status, 400);
    assert.equal((await request('product', { body: body('quote') })).status, 409);
    assert.equal((await request('product', { body: body('contract'), env: { SOLAPI_TEMPLATE_CONTRACT_ID: '' } })).status, 409);
    assert.equal((await request('product', { body: body('itinerary'), env: { SOLAPI_TEMPLATE_ITINERARY_ID: 'template-quote' } })).status, 409);
    raw.exec("UPDATE reservations SET deposit_status='unpaid'"); assert.equal((await request('product', { body: body('contract') })).status, 409);
    raw.exec("UPDATE reservations SET itinerary_url=NULL"); assert.equal((await request('product', { body: body('itinerary') })).status, 409);
    raw.exec("UPDATE reservations SET customer_phone=NULL"); assert.equal((await request('product', { body: body('travel_notice') })).status, 409);
    raw.exec("UPDATE reservations SET status='cancelled'"); assert.equal((await request('product', { body: body('contract') })).status, 409);
    raw.exec('DELETE FROM reservations'); assert.equal((await request('product', { body: body('contract') })).status, 404);
    quote.booking.contractInfo.depositStatus = '미입금'; updateQuote(raw, quote); assert.equal((await request('quote_booking', { body: body('contract') })).status, 409);
    quote.booking.days = []; updateQuote(raw, quote); assert.equal((await request('quote_booking', { body: body('itinerary') })).status, 409);
    raw.exec("UPDATE requests SET status='예약취소'"); assert.equal((await request('quote_booking', { body: body('quote') })).status, 409);
    assert.equal(sent.length, 0); assert.equal(raw.prepare('SELECT count(*) n FROM admin_delivery_attempts').get().n, 0);
});

test('provider 거절은 실패, 응답 불명은 확인 필요로 남겨 재발송을 막는다', async t => {
    const { request, raw } = await fixture(t);
    globalThis.fetch = async () => Response.json({ errorCode: 'InvalidTemplate' }, { status: 400 });
    let response = await request('product', { body: body('contract') }); assert.equal((await response.json()).state, 'failed');
    globalThis.fetch = async () => Response.json({ groupId: 'retry-accepted', statusCode: '2000' });
    assert.equal((await request('product', { body: body('contract', 'retry-explicit-failed-123456') })).status, 200);
    globalThis.fetch = async () => { throw Error('network timeout'); };
    response = await request('product', { body: body('itinerary') }); assert.equal(response.status, 502); assert.equal((await response.json()).state, 'unknown');
    let sends = 0; globalThis.fetch = async () => { sends++; return Response.json({ groupId: 'must-not-send' }); };
    assert.equal((await request('product', { body: body('itinerary', 'retry-uncertain-1234567') })).status, 409); assert.equal(sends, 0);
    const state = await (await request()).json(); const itinerary = state.notices.find(item => item.kind === 'itinerary');
    assert.equal(itinerary.available, false); assert.equal(itinerary.lastAttempt.state, 'unknown'); assert.ok(itinerary.lastAttempt.error);
    assert.equal(raw.prepare("SELECT count(*) n FROM admin_delivery_attempts WHERE state='unknown'").get().n, 1);
});

test('동시에 누른 다른 탭도 한 번만 provider에 요청한다', async t => {
    const { request } = await fixture(t); let release, started;
    const hold = new Promise(resolve => { release = resolve; }); const began = new Promise(resolve => { started = resolve; }); let sends = 0;
    globalThis.fetch = async () => { sends++; started(); await hold; return Response.json({ groupId: 'concurrent-receipt' }); };
    const first = request('product', { body: body('contract') }); await began;
    const second = await request('product', { body: body('contract', 'another-tab-key-12345678') }); assert.equal(second.status, 409);
    release(); assert.equal((await first).status, 200); assert.equal(sends, 1);
});

test('원장 저장 전 실패는 발송하지 않고 provider 접수 후 기록 실패는 결과 불명으로 알린다', async t => {
    const { request, raw, sent, fail } = await fixture(t);
    fail('INSERT INTO admin_delivery_attempts');
    let response = await request('product', { body: body('contract') }); assert.equal(response.status, 503); assert.equal((await response.json()).state, 'failed'); assert.equal(sent.length, 0);
    fail('UPDATE admin_delivery_attempts');
    response = await request('product', { body: body('contract', 'post-provider-ledger-12345') }); assert.equal(response.status, 503); assert.equal((await response.json()).state, 'unknown'); assert.equal(sent.length, 1);
    assert.equal(raw.prepare('SELECT state FROM admin_delivery_attempts').get().state, 'sending');
    fail(''); assert.equal((await request('product', { body: body('contract', 'blocked-unrecorded-12345') })).status, 409); assert.equal(sent.length, 1);
});

test('2xx의 깨진 응답은 접수 성공으로 표시하지 않으며 기존 견적 미확인 발송도 차단한다', async t => {
    const { request, raw, sent } = await fixture(t);
    globalThis.fetch = async () => new Response('broken', { status: 200 });
    let response = await request('product', { body: body('contract') }); assert.equal((await response.json()).state, 'unknown');
    globalThis.fetch = async () => Response.json({ groupId: 'rejected-group', failedMessageList: [{ statusCode: '3010' }] });
    response = await request('product', { body: body('itinerary') }); assert.equal((await response.json()).state, 'failed');
    raw.exec(`CREATE TABLE itinerary_notice_dispatches(request_id TEXT,dispatch_key TEXT,state TEXT,created_at TEXT,result TEXT);`);
    raw.prepare('INSERT INTO itinerary_notice_dispatches VALUES(?,?,?,?,?)').run('same-id', 'legacy-inflight-key', 'unknown', new Date().toISOString(), null);
    response = await request('quote_booking', { body: body('itinerary') }); assert.equal(response.status, 409); assert.equal((await response.json()).state, 'unknown'); assert.equal(sent.length, 0);
});

test('다른 알림 이력이 많아져도 오래된 미확인 요청은 조회와 발송 모두 차단한다', async t => {
    const { request, raw, sent } = await fixture(t);
    const insert = raw.prepare('INSERT INTO admin_delivery_attempts(id,source,booking_id,kind,channel,state,dispatch_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)');
    insert.run('old-unknown', 'product', 'same-id', 'contract', 'kakao', 'unknown', 'old-unknown-key', '2026-01-01', '2026-01-01');
    for (let i = 0; i < 201; i++) insert.run(`newer-${i}`, 'product', 'same-id', 'travel_notice', 'kakao', 'accepted', `newer-key-${i}`, '2026-09-01', '2026-09-01');
    const data = await (await request()).json();
    assert.equal(data.notices.find(item => item.kind === 'contract').available, false);
    const response = await request('product', { body: body('contract') }); assert.equal(response.status, 409); assert.equal((await response.json()).state, 'unknown'); assert.equal(sent.length, 0);
});

test('첫 계약 안내 접수 후 기존 고객 허브에 계약 확인·서명과 여행자 정보 요청이 실제로 열린다', async t => {
    const { request, raw, DB, quote } = await fixture(t);
    const before = await (await readCustomerQuote({ request:new Request('https://admin.example.invalid/api/my/'+quote.token,{headers:{cookie:'auth_session=notice-admin'}}),env: { DB }, params: { token: quote.token } })).json();
    assert.equal(before.booking.contractRequest.status, 'not_sent');
    const response = await request('quote_booking', { body: body('contract') }); assert.equal(response.status, 200); assert.equal((await response.json()).state, 'accepted');
    const after = await (await readCustomerQuote({ request:new Request('https://admin.example.invalid/api/my/'+quote.token,{headers:{cookie:'auth_session=notice-admin'}}),env: { DB }, params: { token: quote.token } })).json();
    assert.equal(after.booking.contractRequest.status, 'requested'); assert.match(after.booking.contractRequest.requestedAt, /^\d{4}-/);
    assert.equal(after.booking.travelerSubmission.status, 'requested'); assert.equal(after.booking.travelerSubmission.expectedCount, 3); assert.equal(after.booking.travelerSubmission.submittedCount, 0);
    assert.equal(after.booking.contractInfo.depositStatus, '입금완료'); assert.equal(after.booking.publishStatus, before.booking.publishStatus);
    const data = JSON.parse(raw.prepare('SELECT data FROM requests').get().data); assert.deepEqual(data.booking.contract, quote.booking.contract);
    assert.equal(data.activities.at(-1).type, 'contract_requested');
    const repeated = await (await request('quote_booking', { body: body('contract') })).json(); assert.equal(repeated.duplicate, true);
    assert.equal(JSON.parse(raw.prepare('SELECT data FROM requests').get().data).activities.length, 1);
});

test('이미 요청·제출한 여행자 정보와 기존 요청일은 재안내해도 보존한다', async t => {
    const { request, raw, quote } = await fixture(t);
    quote.booking.contractRequest = { status: 'requested', requestedAt: '2026-10-01T00:00:00Z', staffNote: '보존할 메타데이터' };
    quote.booking.travelerSubmission = { status: 'submitted', requestedAt: '2026-10-01T00:00:00Z', submittedAt: '2026-10-02T00:00:00Z', expectedCount: 3, submittedCount: 3 };
    quote.booking.travelers = [{ nameKo: '기존 여행자', passportNo: 'PRIVATE-PASSPORT' }]; updateQuote(raw, quote);
    assert.equal((await request('quote_booking', { body: body('contract') })).status, 200);
    const after = JSON.parse(raw.prepare('SELECT data FROM requests').get().data);
    assert.deepEqual(after.booking.contractRequest, quote.booking.contractRequest); assert.deepEqual(after.booking.travelerSubmission, quote.booking.travelerSubmission); assert.deepEqual(after.booking.travelers, quote.booking.travelers);
});

test('알림 실패·불확실 응답은 고객 허브의 요청 상태나 이력을 바꾸지 않는다', async t => {
    const { request, raw } = await fixture(t); const before = raw.prepare('SELECT * FROM requests').get();
    globalThis.fetch = async () => Response.json({ errorCode: 'InvalidTemplate' }, { status: 400 });
    let response = await request('quote_booking', { body: body('contract') }); assert.equal((await response.json()).state, 'failed'); assert.deepEqual(raw.prepare('SELECT * FROM requests').get(), before);
    globalThis.fetch = async () => { throw Error('timeout'); };
    response = await request('quote_booking', { body: body('contract', 'unknown-contract-key-1234') }); assert.equal((await response.json()).state, 'unknown'); assert.deepEqual(raw.prepare('SELECT * FROM requests').get(), before);
});

test('발송 중 접수한 고객 서명과 여행자 정보는 새 요청 메타데이터로 덮어쓰지 않는다', async t => {
    const { request, raw, quote } = await fixture(t);
    const contract = { signedAt: '2026-10-20T09:00:00Z', signImg: 'PRIVATE-SIGNATURE', snapshot: { customer: '원본' } };
    const travelers = [{ nameKo: '막 제출한 여행자', passportNo: 'PRIVATE-NEW-PASSPORT' }];
    globalThis.fetch = async () => {
        raw.prepare("UPDATE requests SET data=json_set(data,'$.booking.contract',json(?),'$.booking.travelers',json(?),'$.booking.travelerSubmission',json(?)) WHERE id=?")
            .run(JSON.stringify(contract), JSON.stringify(travelers), JSON.stringify({ status: 'submitted', submittedAt: contract.signedAt }), 'same-id');
        return Response.json({ groupId: 'signed-during-send' });
    };
    assert.equal((await request('quote_booking', { body: body('contract') })).status, 200);
    const after = JSON.parse(raw.prepare('SELECT data FROM requests').get().data);
    assert.deepEqual(after.booking.contract, contract); assert.deepEqual(after.booking.travelers, travelers); assert.equal(after.booking.travelerSubmission.status, 'submitted'); assert.equal(after.booking.contractRequest, undefined); assert.equal(after.activities, undefined);
    assert.equal(raw.prepare('SELECT state FROM admin_delivery_attempts').get().state, 'accepted');
});

test('미서명 상태의 동시 여행자·메모 저장도 현재 행을 기준으로 요청 정보를 추가해 보존한다', async t => {
    const { request, raw } = await fixture(t);
    const travelers = [{ nameKo: '동시에 입력한 여행자', passportNo: 'PRIVATE-CONCURRENT-PASSPORT' }];
    globalThis.fetch = async () => {
        raw.prepare("UPDATE requests SET data=json_set(data,'$.booking.travelers',json(?),'$.memo',?) WHERE id=?").run(JSON.stringify(travelers), '동시에 추가한 메모', 'same-id');
        return Response.json({ groupId: 'unsigned-concurrent-save' });
    };
    const result = await (await request('quote_booking', { body: body('contract') })).json(); assert.equal(result.state, 'accepted'); assert.equal(result.warning, undefined);
    const after = JSON.parse(raw.prepare('SELECT data FROM requests').get().data); assert.deepEqual(after.booking.travelers, travelers); assert.equal(after.memo, '동시에 추가한 메모');
    assert.equal(after.booking.contractRequest.status, 'requested'); assert.equal(after.booking.travelerSubmission.submittedCount, 1);
});

test('발송 중 링크 회전과 요청 상태 저장 실패는 접수 영수증을 보존하고 별도 경고로 알려 준다', async t => {
    const { request, raw, fail } = await fixture(t);
    globalThis.fetch = async () => {
        raw.prepare("UPDATE requests SET token=?,data=json_set(data,'$.token',?,'$.memo',?) WHERE id=?").run('new-rotated-token', 'new-rotated-token', '동시에 저장한 메모', 'same-id');
        return Response.json({ groupId: 'rotated-after-send' });
    };
    let result = await (await request('quote_booking', { body: body('contract') })).json(); assert.equal(result.state, 'accepted'); assert.ok(result.warning);
    let after = JSON.parse(raw.prepare('SELECT data FROM requests').get().data); assert.equal(after.memo, '동시에 저장한 메모'); assert.equal(after.booking.contractRequest, undefined);
    raw.prepare('UPDATE admin_delivery_attempts SET created_at=?').run(new Date(Date.now() - 61_000).toISOString());
    globalThis.fetch = async () => Response.json({ groupId: 'metadata-write-failed' }); fail('UPDATE requests');
    result = await (await request('quote_booking', { body: body('contract', 'metadata-write-retry-1234') })).json(); assert.equal(result.state, 'accepted'); assert.match(result.warning, /상태를 저장하지 못했습니다/);
    assert.equal(raw.prepare("SELECT count(*) n FROM admin_delivery_attempts WHERE state='accepted'").get().n, 2);
    fail(''); after = JSON.parse(raw.prepare('SELECT data FROM requests').get().data); assert.equal(after.booking.contractRequest, undefined);
});

test('자동 안내 조회는 문의 단계부터 11종과 실제 원장 결과를 읽으며 외부 호출을 하지 않는다', async t => {
    const { request, raw, sent, quote } = await fixture(t);
    delete quote.booking; delete quote.decision; updateQuote(raw, quote);
    raw.exec("UPDATE requests SET status='접수'");
    raw.prepare('INSERT INTO admin_delivery_attempts(id,source,booking_id,kind,channel,state,error,dispatch_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
        .run('receipt-event', 'quote_booking', 'same-id', 'request_received', 'kakao', 'failed', '승인 템플릿을 확인해 주세요.', 'receipt-event-key', '2026-10-20', '2026-10-20');
    let data = await (await request('quote_booking')).json();
    assert.equal(data.automation.notices.length, 11);
    assert.equal(data.automation.notices.find(item => item.kind === 'request_received').state, 'failed');
    assert.match(data.automation.notices.find(item => item.kind === 'request_received').reason, /승인 템플릿/);
    assert.equal(data.automation.notices.find(item => item.kind === 'contract_signed').state, 'unavailable', 'unverified profile has no default event template');
    data = await (await request('quote_booking', { env: { SOLAPI_PF_ID: '' } })).json();
    assert.equal(data.automation.notices.find(item => item.kind === 'contract_signed').state, 'not_triggered', 'verified default profile and approved registry are ready');
    assert.equal(sent.length, 0);
    assert.equal(raw.prepare('SELECT count(*) n FROM admin_delivery_attempts').get().n, 1);
});

test('여행 주의사항은 실제 서명이 필요하며 예전 D7 템플릿으로 대체하지 않는다', async t => {
    const { request, raw, sent } = await fixture(t);
    raw.exec("UPDATE reservations SET contract_data=json_set(contract_data,'$.agreement.agreed',json('true'))");
    assert.equal((await request('product', { body: body('travel_notice') })).status, 409);
    raw.exec("UPDATE reservations SET contract_data=json_set(contract_data,'$.signature.signedAt','2026-10-20T00:00:00Z')");
    const state = await (await request('product', { env: { SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID: '', SOLAPI_TEMPLATE_GUIDEBOOK_ID: 'old-d7-template' } })).json();
    assert.equal(state.notices.find(item => item.kind === 'travel_notice').available, false);
    assert.equal(sent.length, 0);
    assert.equal((await request('product', { body: body('travel_notice') })).status, 200);
    assert.equal(sent[0].message.kakaoOptions.templateId, 'template-travel-notice');
});

test('발송 원장 확보 중 바뀐 취소·연락처·고객 링크·문서는 이전 값으로 발송하지 않는다', async t => {
    for (const kind of ['cancel', 'phone', 'token', 'document']) await t.test(kind, async inner => {
        const { request, raw, sent, onClaim } = await fixture(inner);
        onClaim(() => {
            if (kind === 'cancel') raw.exec("UPDATE requests SET status='예약취소'");
            if (kind === 'phone') raw.exec("UPDATE requests SET phone='01099990000'");
            if (kind === 'token') raw.exec("UPDATE requests SET token='new-private-token'");
            if (kind === 'document') raw.exec("UPDATE requests SET data=json_set(data,'$.booking.contractInfo.productName','새 계약 내용')");
        });
        const response = await request('quote_booking', { body: body('contract') });
        assert.equal(response.status, 409); assert.equal((await response.json()).state, 'failed');
        assert.equal(sent.length, 0); assert.equal(raw.prepare('SELECT state FROM admin_delivery_attempts').get().state, 'failed');
    });
});
