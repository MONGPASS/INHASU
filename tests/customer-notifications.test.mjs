import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { trackedDelivery } from '../functions/lib/adminDelivery.ts';
import { quoteDocumentRevisions } from '../functions/lib/adminDocumentRevision.ts';

const compiled = await build({ entryPoints: ['functions/lib/customerNotifications.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { dispatchCustomerNotification: dispatch, resolveNotificationTemplate, APPROVED_NOTIFICATION_PROFILE_ID } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].contents).toString('base64')}`);
async function fixture(t) {
    const raw = new DatabaseSync(':memory:'); t.after(() => raw.close()); let fail = '', beforeClaim;
    const statement = (sql, args = []) => ({ bind: (...values) => statement(sql, values),
        async run() { if (fail && sql.includes(fail)) throw Error('DB unavailable'); if (beforeClaim && sql.includes('INSERT INTO admin_delivery_attempts')) { const work = beforeClaim; beforeClaim = undefined; work(); } return { meta: raw.prepare(sql).run(...args) }; },
        async all() { if (fail && sql.includes(fail)) throw Error('DB unavailable'); return { results: raw.prepare(sql).all(...args) }; },
        async first() { if (fail && sql.includes(fail)) throw Error('DB unavailable'); return raw.prepare(sql).get(...args) ?? null; },
        exec() { return /^\s*(select|pragma)/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args), results: [] }; } });
    const DB = { prepare: sql => statement(sql), batch: async entries => entries.map(entry => entry.exec()) }; await ensureSiteSchema(DB);
    raw.exec('CREATE TABLE requests(id TEXT PRIMARY KEY,name TEXT,phone TEXT,token TEXT,status TEXT,data TEXT)');
    const quote = { name: 'JSON 이름 대신 정본 사용', phone: '01099999999', token: 'stale-json-token', destination: '테렐지', depart: '2026-11-01', return_: '2026-11-03', adult: 2, child: 0, infant: 0, quote: { name: '테렐지 견적', detailDays: [{ dest: '초원' }] },
        changeRequests: [{ message: '일정 변경 요청' }], decision: { status: 'accepted' }, booking: { publishStatus: 'published', days: [{ d: 1, dest: '테렐지', items: ['산책'] }], travelers: [{ nameKo: '여행자', passportNo: 'PRIVATE-PASSPORT' }],
            contractInfo: { depositStatus: '입금완료', totalAmount: 4000000, depositAmount: 1000000, balanceAmount: 3000000 }, contract: { signedAt: '2026-10-20T00:00:00Z', signImg: 'PRIVATE-SIGNATURE' } } };
    raw.prepare('INSERT INTO requests VALUES(?,?,?,?,?,?)').run('same-id', '정본 견적 고객', '01012345678', 'authoritative-customer-token', '예약확정', JSON.stringify(quote));
    raw.prepare(`INSERT INTO reservations(id,customer_name,customer_phone,product_name,start_date,end_date,status,deposit_status,total_price,deposit_amount,balance_amount,itinerary_url,document_content,contract_data)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('same-id', '상품 고객', '01022223333', '테렐지 상품', '2026-11-01', '2026-11-03', 'confirmed', 'paid', 4000000, 1000000, 3000000, 'https://example.invalid/documents/itinerary/same-id',
            JSON.stringify({ days: [{ day: 1, title: '테렐지', activities: [] }] }), JSON.stringify({ signature: { signedAt: '2026-10-20T00:00:00Z', signImg: 'PRIVATE-SIGNATURE' }, travelers: [{ passportName: 'PRIVATE-NAME' }] }));
    const env = { DB, SOLAPI_API_KEY: 'mock-key', SOLAPI_API_SECRET: 'mock-secret', SOLAPI_PF_ID: APPROVED_NOTIFICATION_PROFILE_ID,
        SOLAPI_TEMPLATE_QUOTE_ID: 'configured-quote', SOLAPI_TEMPLATE_CONTRACT_ID: 'configured-contract', SOLAPI_TEMPLATE_ITINERARY_ID: 'configured-itinerary', SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID: 'configured-travel-notice' };
    const sent = [], original = globalThis.fetch;
    globalThis.fetch = async (url, init) => { assert.equal(url, 'https://api.solapi.com/messages/v4/send'); sent.push(JSON.parse(init.body)); return Response.json({ groupId: `mock-receipt-${sent.length}`, statusCode: '2000' }); };
    t.after(() => { globalThis.fetch = original; });
    return { DB, raw, quote, env, sent, fail: sql => { fail = sql; }, beforeClaim: work => { beforeClaim = work; } };
}
const input = (kind, source = 'quote_booking', eventKey = `${kind}:first-event`) => ({ source, bookingId: 'same-id', kind, eventKey });

test('승인 registry와 명시 설정을 구분하고 다른 프로필의 fallback·서로 다른 종류의 ID 충돌을 차단한다', async t => {
    const { env, sent } = await fixture(t);
    assert.equal(resolveNotificationTemplate(env, 'request_received').id, 'KA01TP2607130715542944mHt7DCfdl6');
    assert.equal(resolveNotificationTemplate({ ...env, SOLAPI_TEMPLATE_REQUEST_RECEIVED_ID: 'explicit-approved-template' }, 'request_received').id, 'explicit-approved-template');
    assert.equal(resolveNotificationTemplate({ ...env, SOLAPI_PF_ID: 'other-profile' }, 'request_received'), null);
    assert.equal(resolveNotificationTemplate({ ...env, SOLAPI_TEMPLATE_ITINERARY_ID: 'configured-quote' }, 'itinerary'), null);
    assert.equal(resolveNotificationTemplate(env, 'not-a-kind'), null); assert.equal(sent.length, 0);
});

test('전 이벤트가 정본 고객·정확한 경로·승인 변수만 사용하고 업무 상태·민감정보를 변경하거나 보내지 않는다', async t => {
    const { env, raw, sent } = await fixture(t);
    const quoteBefore = raw.prepare('SELECT * FROM requests').get(), productBefore = raw.prepare('SELECT * FROM reservations').get();
    for (const kind of ['request_received', 'quote', 'change_requested', 'reservation_requested', 'deposit_requested', 'travelers_requested', 'contract', 'contract_signed', 'booking_confirmed', 'itinerary', 'travel_notice']) {
        const result = await dispatch(env, input(kind)); assert.equal(result.state, 'accepted', kind);
        const message = sent.at(-1).message; assert.equal(message.to, '01012345678'); assert.equal(message.kakaoOptions.disableSms, true); assert.equal(message.text, undefined);
        const variables = message.kakaoOptions.variables; assert.equal(variables['#{고객명}'], '정본 견적 고객');
        assert.deepEqual(Object.keys(variables).sort(), (kind === 'travel_notice' ? ['#{고객명}', '#{회사명}', '#{링크}', '#{출발일}'] : ['#{고객명}', '#{회사명}', '#{링크}']).sort());
        assert.ok(!JSON.stringify(message).includes('PRIVATE-')); assert.ok(!JSON.stringify(message).includes('stale-json-token'));
        const expected = kind === 'travel_notice' ? 'guidebooks/mongolia-travel-guidebook-2026.pdf' : `${encodeURI(kind === 'itinerary' ? '확정일정표.html' : kind === 'travelers_requested' ? '여행자정보.html' : '내견적.html')}?t=authoritative-customer-token`;
        assert.equal(variables['#{링크}'], expected);
    }
    for (const [kind, path] of [['contract', 'documents/contract/same-id'], ['itinerary', 'documents/itinerary/same-id'], ['travelers_requested', 'documents/contract/same-id'], ['booking_confirmed', 'mypage/reservations/same-id']]) {
        const result = await dispatch(env, input(kind, 'product')); assert.equal(result.state, 'accepted');
        assert.equal(sent.at(-1).message.to, '01022223333'); assert.equal(sent.at(-1).message.kakaoOptions.variables['#{링크}'], path);
    }
    assert.deepEqual(raw.prepare('SELECT * FROM requests').get(), quoteBefore); assert.deepEqual(raw.prepare('SELECT * FROM reservations').get(), productBefore);
});

test('같은 자동 이벤트와 문서 버전은 반복·다른 eventKey·동시 실행에서도 한 번만 접수한다', async t => {
    const { env, sent, raw } = await fixture(t);
    let result = await dispatch(env, input('request_received')); assert.equal(result.state, 'accepted');
    result = await dispatch(env, input('request_received')); assert.equal(result.duplicate, true); assert.equal(sent.length, 1);
    const [first, second] = await Promise.all([dispatch(env, input('contract')), dispatch(env, input('contract', 'quote_booking', 'different-trigger-same-document'))]);
    assert.equal(first.ok, true); assert.equal(second.duplicate, true); assert.equal(sent.length, 2);
    result = await dispatch(env, input('contract', 'quote_booking', 'third-trigger-same-document')); assert.equal(result.duplicate, true); assert.equal(sent.length, 2);
    assert.equal(raw.prepare('SELECT count(*) n FROM admin_delivery_attempts').get().n, 2);
});

test('이미 수동 안내한 현재 문서는 다시 자동 발송하지 않으며 실제 수정 버전만 새로 발송한다', async t => {
    const { env, DB, raw, quote, sent } = await fixture(t);
    const authoritative = { ...quote, id: 'same-id', name: '정본 견적 고객', phone: '01012345678', token: 'authoritative-customer-token', status: '예약확정' };
    const revision = (await quoteDocumentRevisions(authoritative)).contract;
    await trackedDelivery(DB, { source: 'quote_booking', bookingId: 'same-id', kind: 'contract', channel: 'kakao', key: 'manual-already-accepted', revision }, async () => ({ ok: true, id: 'manual-receipt' }));
    const result = await dispatch(env, input('contract')); assert.equal(result.duplicate, true); assert.equal(result.providerId, 'manual-receipt'); assert.equal(sent.length, 0);
    raw.prepare("UPDATE requests SET data=json_set(data,'$.booking.contractTerms',?) WHERE id=?").run('새 계약 문구', 'same-id');
    assert.equal((await dispatch(env, input('contract', 'quote_booking', 'changed-document'))).state, 'accepted'); assert.equal(sent.length, 1);
});

test('실패한 이벤트도 동일 키로 자동 재시도하지 않고 결과 불명은 다른 이벤트까지 중복 방지한다', async t => {
    const { env, raw } = await fixture(t); let calls = 0;
    globalThis.fetch = async () => { calls++; return Response.json({ errorCode: 'Rejected' }, { status: 400 }); };
    let result = await dispatch(env, input('contract')); assert.equal(result.state, 'failed');
    globalThis.fetch = async () => { calls++; return Response.json({ groupId: 'must-not-send' }); };
    result = await dispatch(env, input('contract')); assert.equal(result.state, 'failed'); assert.equal(result.duplicate, true); assert.equal(calls, 1);
    globalThis.fetch = async () => { calls++; throw Error('network timeout'); };
    result = await dispatch(env, input('travel_notice')); assert.equal(result.state, 'unknown');
    result = await dispatch(env, input('travel_notice', 'quote_booking', 'other-event')); assert.equal(result.state, 'unknown'); assert.equal(result.duplicate, true); assert.equal(calls, 2);
    assert.equal(raw.prepare("SELECT count(*) n FROM admin_delivery_attempts WHERE state='unknown'").get().n, 1);
});

test('부적합 상태·템플릿·설정은 저장된 실패만 남기고 외부로 보내지 않는다', async t => {
    const { env, raw, sent } = await fixture(t);
    assert.equal((await dispatch(env, input('request_received', 'product'))).state, 'failed');
    assert.equal((await dispatch(env, input('reservation_requested', 'product'))).state, 'failed');
    assert.equal((await dispatch({ ...env, SOLAPI_PF_ID: 'unverified-profile', SOLAPI_TEMPLATE_QUOTE_ID: '', SOLAPI_KAKAO_QUOTE_TEMPLATE_ID: '' }, input('quote'))).state, 'failed');
    assert.equal((await dispatch({ ...env, SOLAPI_API_KEY: '' }, input('deposit_requested'))).state, 'failed');
    raw.exec("UPDATE reservations SET status='cancelled'"); assert.equal((await dispatch(env, input('contract', 'product'))).state, 'failed');
    raw.exec("UPDATE requests SET phone=''"); assert.equal((await dispatch(env, input('request_received'))).state, 'failed');
    assert.equal(sent.length, 0);
});

test('발송 직전 최신 고객 연락처·링크를 읽고 문서 버전이 바뀌면 이전 버전으로 보내지 않는다', async t => {
    const { env, raw, sent, beforeClaim } = await fixture(t);
    beforeClaim(() => raw.prepare('UPDATE requests SET phone=?,token=? WHERE id=?').run('01055556666', 'new-token-before-send', 'same-id'));
    assert.equal((await dispatch(env, input('request_received'))).state, 'accepted');
    assert.equal(sent[0].message.to, '01055556666'); assert.match(sent[0].message.kakaoOptions.variables['#{링크}'], /new-token-before-send/);
    beforeClaim(() => raw.prepare("UPDATE requests SET data=json_set(data,'$.booking.contractTerms',?) WHERE id=?").run('동시에 변경한 약관', 'same-id'));
    assert.equal((await dispatch(env, input('contract'))).state, 'failed'); assert.equal(sent.length, 1);
});

test('HTTP 200의 개별 실패·영수증 없는 응답은 성공으로 처리하지 않는다', async t => {
    const { env } = await fixture(t);
    globalThis.fetch = async () => Response.json({ groupId: 'rejected', failedMessageList: [{ statusCode: '3010' }] });
    assert.equal((await dispatch(env, input('contract'))).state, 'failed');
    globalThis.fetch = async () => new Response('bad-json', { status: 200 });
    assert.equal((await dispatch(env, input('itinerary'))).state, 'unknown');
});

test('원장 저장 전 실패는 무발송이고 접수 후 기록 실패는 결과 불명으로 보존한다', async t => {
    const { env, raw, sent, fail } = await fixture(t);
    fail('INSERT INTO admin_delivery_attempts'); assert.equal((await dispatch(env, input('contract'))).state, 'failed'); assert.equal(sent.length, 0);
    fail('UPDATE admin_delivery_attempts'); assert.equal((await dispatch(env, input('contract'))).state, 'unknown'); assert.equal(sent.length, 1);
    assert.equal(raw.prepare('SELECT state FROM admin_delivery_attempts').get().state, 'sending');
});

test('최초 이벤트는 문서가 나중에 바뀌어도 다시 보내지 않고 다른 새 이벤트만 허용한다', async t => {
    const { env, raw, sent } = await fixture(t);
    const first = input('contract', 'product', 'first-deposit-paid');
    assert.equal((await dispatch(env, first)).state, 'accepted');
    raw.prepare("UPDATE reservations SET document_content=json_set(document_content,'$.documentSettings.contract.preamble',?) WHERE id=?").run('나중에 수정한 계약 본문', 'same-id');
    const repeat = await dispatch(env, first); assert.equal(repeat.duplicate, true); assert.equal(sent.length, 1);
    assert.equal((await dispatch(env, input('contract', 'product', 'explicit-new-document-event'))).state, 'accepted'); assert.equal(sent.length, 2);
});

test('서명 전 여행 준비는 보내지 않고 자동·수동 여행 준비 안내는 1분 내 접수를 합친다', async t => {
    const { env, raw, sent } = await fixture(t);
    const auto = input('travel_notice', 'product', 'first-contract-signature');
    assert.equal((await dispatch(env, auto)).state, 'accepted');
    let repeat = await dispatch(env, input('travel_notice', 'product', 'manual-travel-notice')); assert.equal(repeat.duplicate, true); assert.equal(sent.length, 1);
    raw.prepare('UPDATE admin_delivery_attempts SET created_at=?').run(new Date(Date.now() - 61_000).toISOString());
    assert.equal((await dispatch(env, input('travel_notice', 'product', 'manual-after-one-minute'))).state, 'accepted'); assert.equal(sent.length, 2);
    raw.exec("UPDATE requests SET data=json_remove(data,'$.booking.contract.signedAt')");
    assert.equal((await dispatch(env, input('travel_notice'))).state, 'failed'); assert.equal(sent.length, 2);
});

test('현재 승인 기본값은 옛 D7 가이드북 환경변수를 사용하지 않는다', async t => {
    const { env, sent } = await fixture(t);
    const result = await dispatch({ ...env, SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID: '', SOLAPI_TEMPLATE_GUIDEBOOK_ID: 'old-d7-guidebook-template' }, input('travel_notice'));
    assert.equal(result.state, 'accepted'); assert.equal(sent[0].message.kakaoOptions.templateId, 'KA01TP260820081146181ADPL9Ew1eIN');
});

test('provider 상세 거절 사유는 짧은 일반 텍스트로 보존하고 5xx는 결과 확인 필요로 남긴다', async t => {
    const { env, raw } = await fixture(t);
    globalThis.fetch = async () => Response.json({ errorCode: 'InvalidTemplate', errorMessage: '<b>승인되지 않은 템플릿입니다</b>\n추가 확인' }, { status: 400 });
    const refused = await dispatch(env, input('travel_notice')); assert.equal(refused.state, 'failed'); assert.match(refused.error, /승인되지 않은 템플릿입니다/); assert.ok(!/[<>\n]/.test(refused.error));
    assert.equal(raw.prepare("SELECT error FROM admin_delivery_attempts WHERE kind='travel_notice'").get().error, refused.error);
    globalThis.fetch = async () => Response.json({ errorCode: 'ServerError', errorMessage: '응답 확인 실패' }, { status: 503 });
    const uncertain = await dispatch(env, input('contract')); assert.equal(uncertain.state, 'unknown'); assert.match(uncertain.error, /자동 재발송을 중지/); assert.match(uncertain.error, /응답 확인 실패/);
});

test('같은 문서 자동 안내는 합치되 명시적 재안내는 1분 후 실제로 다시 발송한다', async t => {
    const { env, raw, sent } = await fixture(t);
    assert.equal((await dispatch(env, input('quote'))).state, 'accepted');
    assert.equal((await dispatch(env, input('quote', 'quote_booking', 'different-auto-event'))).duplicate, true); assert.equal(sent.length, 1);
    let manual = await dispatch(env, { ...input('quote', 'quote_booking', 'manual-share-now'), forceManual: true });
    assert.equal(manual.duplicate, true); assert.match(manual.error, /1분 후/); assert.equal(sent.length, 1);
    raw.prepare('UPDATE admin_delivery_attempts SET created_at=?').run(new Date(Date.now() - 61_000).toISOString());
    manual = await dispatch(env, { ...input('quote', 'quote_booking', 'manual-share-later'), forceManual: true });
    assert.equal(manual.state, 'accepted'); assert.equal(manual.duplicate, undefined); assert.equal(sent.length, 2);
    assert.equal((await dispatch(env, input('quote', 'quote_booking', 'auto-after-manual'))).duplicate, true); assert.equal(sent.length, 2);
});

test('명시 재안내와 자동 안내가 경합해도 현재 문서는 한 번만 보내며 미확인 결과를 성공으로 덮지 않는다', async t => {
    const { env, raw, sent } = await fixture(t);
    const [auto, manual] = await Promise.all([dispatch(env, input('contract')), dispatch(env, { ...input('contract', 'quote_booking', 'manual-share-race'), forceManual: true })]);
    assert.ok(auto.ok || manual.ok); assert.ok(auto.duplicate || manual.duplicate); assert.equal(sent.length, 1);
    raw.prepare(`INSERT INTO admin_delivery_attempts(id,source,booking_id,kind,channel,state,dispatch_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`)
        .run('unresolved-after-accepted', 'quote_booking', 'same-id', 'contract', 'kakao', 'unknown', 'old-unknown-request-key', new Date().toISOString(), new Date().toISOString());
    const blocked = await dispatch(env, { ...input('contract', 'quote_booking', 'manual-with-unresolved'), forceManual: true });
    assert.equal(blocked.state, 'unknown'); assert.equal(blocked.ok, false); assert.equal(blocked.duplicate, true); assert.equal(sent.length, 1);
});
