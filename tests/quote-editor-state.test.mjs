import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/quote-editor-state.js', import.meta.url), 'utf8');
const html = name => fs.readFileSync(new URL(`../public/${name}`, import.meta.url), 'utf8');
function setup(account = 'admin-fixture') {
    const saved = new Map(), events = new Map();
    const storage = { getItem: key => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value), removeItem: key => saved.delete(key) };
    const context = vm.createContext({ structuredClone, URL, Blob, localStorage: storage, location: { origin: 'https://local.example.invalid' },
        fetch: async url => { assert.equal(url, '/api/auth/me'); return Response.json({ user: { id: account, role: 'admin' } }); },
        addEventListener: (name, listener) => events.set(name, listener), confirm: () => false });
    vm.runInContext(source, context);
    return { context, state: context.QuoteEditorState, saved, storage, events };
}
const quote = () => ({ customer: '로컬 고객', phone: '', days: [{ d: 1, date: '', dest: '초원', items: ['09:30 픽업'], meals: [], stay: { name: '', tags: [] } }], spots: [], options: [], balances: [], deposit: 0 });
const plain = value => JSON.parse(JSON.stringify(value));

test('계정·요청·편집 종류별 초안을 분리하고 토큰·서명·파일 바이트를 보관하지 않는다', () => {
    const { state, saved, storage } = setup();
    const scope = { account: 'admin-a', kind: 'quote', requestId: 'request-a' };
    state.write(storage, scope, quote(), { ...quote(), customer: '변경 고객', reqToken: 'private-customer-token', adminToken: 'private-admin-token',
        contract: { signedAt: 'today', signature: 'data:image/png;base64,private' }, agreement: { agreed: true },
        upload: new Blob(['private-file-bytes']), img: 'blob:temporary-file', photos: ['/img/uploaded.webp', 'data:image/png;base64,private'] });
    const encoded = saved.get(state.keyFor(scope.account, scope.kind, scope.requestId));
    for (const secret of ['private-customer-token', 'private-admin-token', 'private-file-bytes', 'base64', 'blob:', 'signedAt', 'agreement']) assert.ok(!encoded.includes(secret));
    assert.ok(encoded.includes('/img/uploaded.webp'));
    assert.notEqual(state.keyFor('admin-a', 'quote', 'request-a'), state.keyFor('admin-b', 'quote', 'request-a'));
    assert.notEqual(state.keyFor('admin-a', 'quote', 'request-a'), state.keyFor('admin-a', 'quote', 'request-b'));
    assert.notEqual(state.keyFor('admin-a', 'quote', 'request-a'), state.keyFor('admin-a', 'booking', 'request-a'));
    assert.equal(state.read(storage, { ...scope, account: 'admin-b' }, quote(), state.validQuote).kind, 'empty');
});

test('다시 진입하면 복원·버리기를 선택하기 전 초안을 덮어쓰지 않고 원본 충돌을 알린다', async () => {
    const { state, saved, storage } = setup();
    const scope = { account: 'admin-fixture', kind: 'quote', requestId: 'request-a' };
    const edited = { ...quote(), customer: '보관 고객', days: [], spots: [] };
    state.write(storage, scope, quote(), edited);
    let current = { ...quote(), customer: '새 서버 원본' };
    const copied = saved.get(state.keyFor(scope.account, scope.kind, scope.requestId));
    const read = state.read(storage, scope, current, state.validQuote);
    assert.equal(read.kind, 'draft'); assert.equal(read.conflict, true);
    const session = await state.create({ kind: 'quote', requestId: scope.requestId, get: () => current, apply: value => { current = value; } });
    assert.equal(session.state().pending, true);
    assert.equal(session.begin(), null);
    session.flush();
    assert.equal(saved.get(state.keyFor(scope.account, scope.kind, scope.requestId)), copied);
    assert.equal(current.customer, '새 서버 원본');
    assert.equal(session.restore(), true);
    assert.equal(current.customer, '보관 고객');
    assert.deepEqual(plain(current.days), []); assert.deepEqual(plain(current.spots), []);
    assert.equal(session.state().dirty, true);
});

test('이전 단일 초안은 현재 고객에서만 복원하고 다른 고객 초안을 정리하지 않는다', async () => {
    const { state, saved, storage } = setup();
    saved.set('leaders_quote_draft', JSON.stringify({ st: { ...quote(), customer: '이전 초안' }, reqId: 'old-customer', reqToken: 'private-token', savedAt: '2026-10-14' }));
    let current = quote();
    const other = await state.create({ kind: 'quote', requestId: 'another-customer', legacyKey: 'leaders_quote_draft', get: () => current, apply: value => { current = value; } });
    assert.equal(other.state().pending, false);
    other.commit();
    assert.ok(saved.has('leaders_quote_draft'));
    const matching = await state.create({ kind: 'quote', requestId: 'old-customer', legacyKey: 'leaders_quote_draft', get: () => current, apply: value => { current = value; } });
    assert.equal(matching.state().pending, true);
    assert.ok(!saved.get('leaders_quote_draft').includes('private-token'));
    matching.restore();
    assert.equal(current.customer, '이전 초안');
    matching.commit();
    assert.equal(saved.has('leaders_quote_draft'), false);
});

test('이동 직전 최신 입력을 수집하며 저장 실패 초안을 유지하고 성공 후 다시 만들지 않는다', async () => {
    const { state, saved } = setup();
    let current = quote(), latestInput = '';
    const session = await state.create({ kind: 'quote', requestId: 'request-a', get: () => current,
        pull: () => { if (latestInput) current.customer = latestInput; }, apply: value => { current = value; } });
    latestInput = '이동 직전 고객명';
    assert.equal(state.flushAll().ok, true);
    assert.ok([...saved.values()][0].includes(latestInput));
    await assert.rejects(session.run(async () => { throw new Error('서버 저장 실패'); }), /서버 저장 실패/);
    assert.equal(saved.size, 1);
    await session.run(async () => { session.commit(); });
    assert.equal(saved.size, 0);
    assert.equal(session.close(), true);
    state.flushAll(); assert.equal(saved.size, 0);
});

test('첫 await 전에 잠금이 걸려 중복 저장·발송이 한 번만 실행된다', async () => {
    const { state } = setup();
    let current = quote(), resolve, calls = 0;
    const session = await state.create({ kind: 'booking', requestId: 'request-a', get: () => current, apply: value => { current = value; } });
    const work = session.run(async () => { calls++; await new Promise(done => { resolve = done; }); });
    assert.equal(state.getState().busy, true);
    assert.equal(state.flushAll().ok, false);
    const duplicate = await session.run(async () => { calls++; });
    assert.equal(duplicate.ignored, true); assert.equal(calls, 1);
    assert.equal(session.close(), false);
    resolve(); await work;
    assert.equal(state.getState().busy, false);
});

test('저장소 실패와 계정 변경을 알리고 이동 승인 한 번만 native 경고를 생략한다', async () => {
    const { context, state, events, storage } = setup();
    let current = quote();
    const session = await state.create({ kind: 'quote', requestId: 'request-a', get: () => current, apply: value => { current = value; } });
    storage.setItem = () => { throw Object.assign(new Error('full'), { name: 'QuotaExceededError' }); };
    current.customer = '저장 안 된 고객';
    const failed = state.flushAll(); assert.equal(failed.ok, false); assert.match(failed.error, /저장 공간/);
    let prevented = 0;
    const event = () => ({ preventDefault() { prevented++; }, returnValue: undefined });
    events.get('beforeunload')(event()); assert.equal(prevented, 1);
    state.approveLeaveOnce(); events.get('beforeunload')(event()); assert.equal(prevented, 1);
    events.get('beforeunload')(event()); assert.equal(prevented, 2);
    context.parent = {};
    events.get('message')({ origin: 'https://local.example.invalid', source: context.parent, data: { type: 'inhasu-editor-account', version: 1, userId: 'other-admin' } });
    assert.equal(session.state().busy, true); assert.match(session.state().error, /계정이 변경/);
});

test('손상된 quote/day/booking 자료는 복원하지 않고 명시적인 빈 배열은 허용한다', () => {
    const { state } = setup();
    assert.equal(state.validQuote({ ...quote(), days: [null] }), false);
    assert.equal(state.validQuote({ ...quote(), days: [{ items: 'not-array' }] }), false);
    assert.equal(state.validQuote({ ...quote(), spots: [null] }), false);
    assert.equal(state.validQuote({ ...quote(), days: [], spots: [] }), true);
    assert.equal(state.validBooking({ days: [{ items: 'bad' }] }), false);
    assert.equal(state.validBooking({ assign: { lodges: [null] } }), false);
});

test('저장소 읽기가 거부되어도 명시적으로 복원 없이 편집을 계속하며 실패 경고를 유지한다', async () => {
    const { state } = setup();
    let current = quote();
    const unavailable = { getItem() { throw new Error('storage denied'); }, setItem() { throw new Error('storage denied'); }, removeItem() { throw new Error('storage denied'); } };
    const session = await state.create({ kind: 'quote', requestId: 'request-a', storage: unavailable, get: () => current, apply: value => { current = value; } });
    assert.equal(session.isBusy(), true);
    assert.equal(session.discard(), false);
    assert.equal(session.continueWithoutRecovery(), true);
    assert.equal(session.isBusy(), false);
    current.customer = '서버 직접 저장 예정';
    assert.equal(state.flushAll().ok, false);
    assert.match(state.getState().error, /저장소/);
});

for (const share of [false, true]) {
    test(`PC 실제 ${share ? '공유' : '저장'} handler가 중복 실행을 차단하고 실패 초안을 보존한다`, async () => {
        const { context, state, saved } = setup();
        context.ST = { ...quote(), customer: '원본 고객', pax: 3, depart: '', return_: '', destination: '초원' };
        const session = await state.create({ kind: 'quote', requestId: 'request-a', get: () => context.ST, apply: value => { context.ST = value; } });
        context.ST.customer = '저장할 고객';
        const buttons = new Map();
        const button = id => { if (!buttons.has(id)) buttons.set(id, { disabled: false, textContent: '저장', focus() {} }); return buttons.get(id); };
        Object.assign(context, { quoteRecovery: session, quoteEditorBooting: false, buildQuote: () => state.clean(context.ST),
            ANONYMOUS_SHARE: false, REQ_ID: 'request-a', REQ_TOKEN: 'server-only-customer-token', ADMIN_TOKEN: 'server-only-admin-token',
            REQ_PAX0: { adult: 3, child: 0, infant: 0 }, nights: () => 0, $: button, pubBtn: button('pub'), saveBtn: button('save'),
            confirm: () => true, toast: () => {}, setStep: () => {}, showLinkBox: () => {},
            clearDraft: () => session.commit(context.REQ_ID), navigator: { clipboard: { writeText: async () => {} } },
            history: { replaceState(_state, _title, url) { context.location.href = String(url); } } });
        context.location.href = 'https://local.example.invalid/견적만들기.html?id=request-a';
        const builder = html('견적만들기.html'), start = builder.indexOf('async function runSave({ share })');
        vm.runInContext(builder.slice(start, builder.indexOf('$("resetBtn").onclick', start)), context);
        let resolve, calls = 0, lastBody;
        context.fetch = (_url, options) => { calls++; lastBody = JSON.parse(options.body); return new Promise(done => { resolve = done; }); };
        const pending = context.runSave({ share });
        assert.equal(calls, 1); assert.equal(state.getState().busy, true);
        await context.runSave({ share }); assert.equal(calls, 1);
        assert.equal(lastBody[share ? 'notifyQuote' : 'silentQuote'], true);
        assert.ok([...saved.values()][0].includes('저장할 고객'));
        assert.ok(![...saved.values()][0].includes('server-only'));
        resolve(Response.json({ ok: false, error: '로컬 테스트 실패' }, { status: 500 })); await pending;
        assert.equal(state.getState().busy, false); assert.equal(saved.size, 1);
        context.fetch = async () => Response.json({ ok: true, notifications: [] });
        await context.runSave({ share }); assert.equal(saved.size, 0);
        assert.equal(new URL(context.location.href).searchParams.get('id'), 'request-a');
        state.flushAll(); assert.equal(saved.size, 0);
    });
}

test('모바일 실제 발송 handler가 확인창부터 잠금을 유지하고 실패 초안을 보존한다', async () => {
    const { context, state, saved } = setup();
    context.QE = { ...quote(), customer: '원본 고객', pax: 3, depart: '', return_: '', reqId: 'request-a', reqToken: 'live-customer-token', pax0: { adult: 3 } };
    const session = await state.create({ kind: 'quote', requestId: 'request-a', get: () => context.QE, apply: value => { context.QE = value; } });
    context.QE.customer = '발송할 고객';
    let confirmResolve, saveResolve, confirms = 0, calls = 0;
    Object.assign(context, { App: {}, qeRecovery: session, qeEditorOpening: false, toast: () => {}, renderOverlays: () => {},
        appConfirm: () => { confirms++; return new Promise(done => { confirmResolve = done; }); }, qeBuild: () => state.clean(context.QE),
        nightsBetween: () => 0, recById: () => null, renderTabbar: () => {}, copyText: async () => true,
        apiPatch: (_id, patch) => { calls++; assert.equal(patch.notifyQuote, true); return new Promise((_done, reject) => { saveResolve = reject; }); },
        history: { replaceState(_state, _title, url) { context.location.href = String(url); } } });
    context.location.href = 'https://local.example.invalid/견적관리-모바일.html?qe=request-a';
    const mobile = html('견적관리-모바일.html'), start = mobile.indexOf('App.qeSave = async share =>');
    vm.runInContext(mobile.slice(start, mobile.indexOf('/* data-qe 바인딩 */', start)), context);
    const pending = context.App.qeSave(true);
    assert.equal(confirms, 1); assert.equal(calls, 0); assert.equal(state.getState().busy, true);
    await context.App.qeSave(true); assert.equal(confirms, 1);
    confirmResolve(true); await new Promise(setImmediate); assert.equal(calls, 1);
    await context.App.qeSave(false); assert.equal(calls, 1);
    saveResolve(new Error('로컬 테스트 실패')); await pending;
    assert.equal(state.getState().busy, false); assert.equal(saved.size, 1);
    context.appConfirm = async () => true; context.apiPatch = async () => ({ ok: true, notifications: [] });
    await context.App.qeSave(false); assert.equal(saved.size, 0);
    assert.equal(new URL(context.location.href).searchParams.get('qe'), 'request-a');
});

test('모바일 명소 inline handler는 실제 이름을 JS 인수로 인코딩하고 코드 실행을 막는다', () => {
    const { state } = setup();
    const mobile = html('견적관리-모바일.html');
    const start = mobile.indexOf('function qeStep4()');
    const renderer = mobile.slice(start, mobile.indexOf('function qeStep5()', start));
    const malicious = `'); globalThis.pwned = true; // <img src=x onerror=alert(1)>`;
    const context = vm.createContext({ QE: { spots: [] }, getSpots: () => ({ [malicious]: { region: '중앙', short: '설명' } }), esc: state.escapeText, jsArg: state.jsArgument });
    vm.runInContext(renderer, context);
    const output = context.qeStep4();
    const encoded = output.match(/onclick="(App\.qeSpotToggle\([^"]+\))"/)[1];
    const decoded = encoded.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    let received;
    context.App = { qeSpotToggle: value => { received = value; } };
    vm.runInContext(decoded, context);
    assert.equal(received, malicious); assert.equal(context.pwned, undefined);
    assert.ok(!output.includes('<img src=x'));
});

test('예약 초안은 편집 입력만 수집하고 서버의 서명 정본과 원시 토큰을 제외한다', () => {
    const booking = html('예약관리.html');
    const start = booking.indexOf('function bookingSnapshot()');
    const declaration = booking.slice(start, booking.indexOf('async function runBookingAction', start));
    const context = vm.createContext({ BK: { days: [], contractInfo: { totalAmount: 0 }, contract: { signedAt: 'today', signImg: 'data:image/png;base64,private' } },
        PRE: { id: 'request-a', name: '고객', adminToken: 'private-admin-token', token: 'private-customer-token' } });
    vm.runInContext(declaration, context);
    const snapshot = context.bookingSnapshot();
    assert.equal(Object.hasOwn(snapshot, 'contract'), false);
    assert.equal(snapshot.contractInfo.totalAmount, 0);
    assert.ok(!JSON.stringify(snapshot).includes('private'));
});

test('PC 기존 고객 진입은 저장 전에도 고객 ID를 주소에 남기고 다른 원본을 거절한다', async () => {
    const builder = html('견적만들기.html'), start = builder.indexOf('async function readCurrentRequest(id)');
    const declaration = builder.slice(start, builder.indexOf('/* 발행된 견적', start));
    const context = vm.createContext({ ST: quote(), URL, ADMIN_TOKEN: 'server-admin-token', REQ_ID: '', REQ_TOKEN: '',
        location: { href: 'https://local.example.invalid/견적만들기.html?m=0' },
        history: { replaceState(_state, _title, url) { context.location.href = String(url); } },
        fetch: async () => Response.json({ ok: true, item: { id: 'request-a', name: '원본 고객', adult: 3, token: 'server-customer-token', quote: { days: [] } } }) });
    vm.runInContext(declaration, context);
    await context.readCurrentRequest('request-a');
    const url = new URL(context.location.href);
    assert.equal(url.searchParams.get('id'), 'request-a'); assert.equal(url.searchParams.get('m'), '0');
    assert.ok(!context.location.href.includes('token')); assert.equal(context.ST.customer, '원본 고객');
    await assert.rejects(context.readCurrentRequest('request-b'), /원본을 불러오지 못했습니다/);
    assert.equal(context.REQ_ID, 'request-a');
});

test('모든 실제 견적·예약 편집 HTML의 inline script가 파싱된다', () => {
    for (const name of ['견적만들기.html', '견적관리-모바일.html', '예약관리.html']) {
        for (const match of html(name).matchAll(/<script>([\s\S]*?)<\/script>/g)) assert.doesNotThrow(() => new vm.Script(match[1]), name);
    }
});
