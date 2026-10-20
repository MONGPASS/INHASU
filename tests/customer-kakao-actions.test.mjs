import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
// Run the shipped handlers with deterministic hooks and real JSX/SSR. Every
// fetch is an in-memory adapter; no browser, customer or provider is contacted.
const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/components/admin/CustomerKakaoActions.tsx', import.meta.url))],
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', packages: 'external', write: false, loader: { '.css': 'empty' },
    plugins: [{ name: 'customer-notice-hooks', setup(builder) {
        builder.onResolve({ filter: /^react$|\/contexts\/UserContext$/ }, args => ({ path: args.path === 'react' ? 'react' : 'user', namespace: 'notice-fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'notice-fixture' }, ({ path }) => ({ loader: 'js', contents: path === 'user'
            ? 'export const useUser=()=>({user:globalThis.h.user});'
            : 'export const useState=(...a)=>globalThis.h.useState(...a),useRef=(...a)=>globalThis.h.useRef(...a),useEffect=(...a)=>globalThis.h.useEffect(...a);export default globalThis.react;' }));
    } }],
});
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = () => new Promise(setImmediate);
const nodes = root => Array.isArray(root) ? root.flatMap(nodes) : React.isValidElement(root) ? [root, ...nodes(root.props.children)] : [];
const text = root => Array.isArray(root) ? root.map(text).join('') : React.isValidElement(root) ? text(root.props.children) : typeof root === 'string' || typeof root === 'number' ? String(root) : '';
const notices = () => [
    { kind: 'contract', label: '여행 계약서', available: true },
    { kind: 'itinerary', label: '확정 일정표', available: true },
    { kind: 'travel_notice', label: '여행 주의사항', available: false, reason: '승인된 템플릿을 설정해 주세요.' },
];
const noticeButton = (h, label = '여행 계약서') => {
    const button = nodes(h.tree).find(node => node.type === 'button' && node.props['aria-label'] === `${label} 카카오 알림 발송`);
    assert.ok(button, `${label} 발송 버튼`); return button;
};
const posts = h => h.calls.filter(call => call.method === 'POST');

function mount(t, props = {}, adapter) {
    const values = [], effects = new Map(), listeners = new Map(), timers = new Map(), module = { exports: {} };
    let cursor = 0, pendingEffects = [], dirty = false, nextTimer = 0, nextKey = 0;
    const h = {
        props: { source: 'product', bookingId: 'local-booking', ...props }, user: { id: 'admin-local-a', role: 'admin' }, tree: null, calls: [],
        data() { return { source: h.props.source, bookingId: h.props.bookingId, recipient: { name: '로컬 고객', phone: '010****1234' }, notices: notices() }; },
        useState(initial) { const key = cursor++; if (!(key in values)) values[key] = typeof initial === 'function' ? initial() : initial;
            return [values[key], change => { const next = typeof change === 'function' ? change(values[key]) : change; if (!Object.is(next, values[key])) { values[key] = next; dirty = true; } }]; },
        useRef(initial) { const key = cursor++; if (!(key in values)) values[key] = { current: initial }; return values[key]; },
        useEffect(fn, deps) { const key = cursor++, old = effects.get(key);
            if (!old || !deps || deps.some((value, i) => !Object.is(value, old.deps?.[i]))) {
                const entry = { deps, cleanup: old?.cleanup }; effects.set(key, entry);
                pendingEffects.push(() => { old?.cleanup?.(); entry.cleanup = fn(); });
            } },
        render() { let passes = 0; do { dirty = false; cursor = 0; pendingEffects = []; context.h = h;
                h.tree = module.exports.CustomerKakaoActions(h.props); pendingEffects.forEach(run => run());
                assert.ok(++passes < 20, 'fixture render settles');
            } while (dirty); return h.tree; },
        async settle() { await tick(); h.render(); await tick(); h.render(); },
        unmount() { effects.forEach(entry => entry.cleanup?.()); },
        focus() { listeners.get('focus')?.(); h.render(); },
    };
    const context = vm.createContext({ module, exports: module.exports, require, react: React, AbortController,
        crypto: { randomUUID: () => `local-notice-key-${++nextKey}` },
        document: { hidden: false },
        window: { addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name),
            setInterval: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearInterval: id => timers.delete(id) },
        fetch: async (path, init = {}) => {
            assert.match(path, /^\/api\/admin\/customer-notices\/(product|quote_booking)\//, 'only the local notice endpoint is used');
            const call = { path, method: init.method || 'GET', init, ...(init.body ? { body: JSON.parse(init.body) } : {}) }; h.calls.push(call);
            if (adapter) { const result = adapter(call, h); if (result !== undefined) return await result; }
            if (call.method === 'GET') return Response.json(h.data());
            throw new Error('Test must explicitly provide every POST response');
        },
    });
    vm.runInContext(bundle.outputFiles[0].text, context);
    t.after(() => h.unmount()); h.render(); return h;
}

test('열기·상태 조회·포커스 복귀는 GET만 사용하고 SSR에 실제 수신자·불가 사유를 표시한다', async t => {
    const h = mount(t); await h.settle();
    assert.equal(h.calls.length, 1); assert.equal(h.calls[0].method, 'GET');
    assert.equal(h.calls[0].init.credentials, 'include'); assert.equal(h.calls[0].init.cache, 'no-store');
    const html = renderToStaticMarkup(h.tree);
    assert.match(html, /로컬 고객 · 010\*\*\*\*1234/);
    assert.match(html, /버튼을 누르면 등록된 고객에게 바로 발송합니다/);
    assert.match(html, /승인된 템플릿을 설정해 주세요/);
    assert.equal(noticeButton(h, '여행 주의사항').props.disabled, true);
    h.focus(); await h.settle(); assert.equal(h.calls.length, 2); assert.equal(posts(h).length, 0);
});

test('명시적 한 번 발송은 종류·예약별 endpoint와 요청 키를 사용하며 동시 클릭은 한 POST만 보낸다', async t => {
    const gate = deferred(), busy = [], h = mount(t, { source: 'quote_booking', bookingId: 'local/id ?1', onBusyChange: value => busy.push(value) }, call => call.method === 'POST' ? gate.promise : undefined);
    await h.settle(); const button = noticeButton(h); button.props.onClick(); button.props.onClick(); h.render();
    assert.equal(posts(h).length, 1);
    const sent = posts(h)[0]; assert.equal(sent.path, '/api/admin/customer-notices/quote_booking/local%2Fid%20%3F1');
    assert.deepEqual(Object.keys(sent.body).sort(), ['idempotencyKey', 'kind']); assert.equal(sent.body.kind, 'contract');
    assert.match(sent.body.idempotencyKey, /^local-notice-key-/);
    assert.equal(sent.init.credentials, 'include'); assert.equal(sent.init.headers['Content-Type'], 'application/json');
    assert.equal(noticeButton(h).props.disabled, true); assert.equal(noticeButton(h, '확정 일정표').props.disabled, true);
    assert.deepEqual(busy, [false, true]);
    gate.resolve(Response.json({ ok: true, state: 'accepted' })); await h.settle(); assert.deepEqual(busy, [false, true, false]);
    assert.match(text(h.tree), /카카오 발송을 접수했습니다\. 실제 수신 여부/); assert.doesNotMatch(text(h.tree), /수신 완료|전달 완료/);
});

test('응답 불명과 네트워크 실패 뒤에는 같은 종류의 키를 보존하고 다른 문서와 키를 공유하지 않는다', async t => {
    let result = 'unknown'; const h = mount(t, {}, call => {
        if (call.method !== 'POST') return;
        if (result === 'network') return Promise.reject(Error('simulated lost response'));
        return Response.json({ ok: false, state: 'unknown' }, { status: 502 });
    });
    await h.settle(); noticeButton(h).props.onClick(); await h.settle();
    assert.match(text(h.tree), /발송 결과를 확인 중/); assert.equal(nodes(h.tree).filter(node => node.props.role === 'alert').length, 1);
    result = 'network'; noticeButton(h).props.onClick(); await h.settle(); assert.equal(posts(h)[0].body.idempotencyKey, posts(h)[1].body.idempotencyKey);
    assert.match(text(h.tree), /발송 응답을 확인하지 못했습니다/);
    noticeButton(h).props.onClick(); await h.settle(); assert.equal(posts(h)[2].body.idempotencyKey, posts(h)[0].body.idempotencyKey);
    noticeButton(h, '확정 일정표').props.onClick(); await h.settle(); assert.notEqual(posts(h)[3].body.idempotencyKey, posts(h)[0].body.idempotencyKey);
    assert.equal(posts(h)[3].body.kind, 'itinerary');
});

test('명확한 실패는 성공으로 표시하지 않으며 재시도 키를 갱신하고 접수 완료도 다음 전송과 키를 분리한다', async t => {
    let state = 'failed', duplicate = false, changed = 0;
    const h = mount(t, { onResult: () => changed++ }, call => call.method === 'POST' ? Response.json({ ok: state === 'accepted', state, duplicate,
        ...(state === 'failed' ? { error: '승인 템플릿 설정을 확인하세요.' } : {}) }, { status: state === 'accepted' ? 200 : 409 }) : undefined);
    await h.settle(); noticeButton(h).props.onClick(); await h.settle(); assert.match(text(h.tree), /승인 템플릿 설정을 확인하세요/);
    assert.doesNotMatch(text(h.tree), /카카오 발송을 접수했습니다/); assert.equal(changed, 1);
    state = 'accepted'; noticeButton(h).props.onClick(); await h.settle(); assert.notEqual(posts(h)[0].body.idempotencyKey, posts(h)[1].body.idempotencyKey);
    assert.equal(nodes(h.tree).filter(node => node.props.role === 'alert').length, 0); assert.match(text(h.tree), /실제 수신 여부는 발송 서비스에서/);
    duplicate = true; noticeButton(h).props.onClick(); await h.settle(); assert.notEqual(posts(h)[1].body.idempotencyKey, posts(h)[2].body.idempotencyKey);
    assert.match(text(h.tree), /이미 접수된 발송입니다/); assert.equal(changed, 3);
});

test('관리자 로그인·상위 잠금·저장 전 검사·알림 불가 상태는 handler 직접 호출에도 전송을 막는다', async t => {
    let allow = false, checked = 0; const h = mount(t, { disabled: true, disabledReason: '수정한 내용을 먼저 저장하세요.', beforeSend: () => { checked++; return allow; } });
    await h.settle(); assert.equal(noticeButton(h).props.disabled, true); noticeButton(h).props.onClick(); assert.equal(posts(h).length, 0); assert.equal(checked, 0);
    h.props = { ...h.props, disabled: false }; h.render(); noticeButton(h).props.onClick(); assert.equal(posts(h).length, 0); assert.equal(checked, 1);
    allow = true; noticeButton(h, '여행 주의사항').props.onClick(); assert.equal(posts(h).length, 0); assert.equal(checked, 1);
    h.user = { id: 'member-local', role: 'user' }; h.render(); await h.settle(); assert.match(text(h.tree), /관리자 로그인이 필요합니다/);
    assert.equal(posts(h).length, 0); assert.equal(h.calls.length, 1, 'non-admin scope does not fetch');
});

test('조회 실패·잘못된 예약 응답은 이전 표시가 있어도 발송을 차단한다', async t => {
    let fail = false, malformed = false; const h = mount(t, {}, (call, current) => {
        if (call.method !== 'GET') return;
        if (fail) return Response.json({ error: '조회 권한을 다시 확인하세요.' }, { status: 403 });
        if (malformed) return Response.json({ ...current.data(), bookingId: 'different-customer' });
    });
    await h.settle(); fail = true; h.focus(); await h.settle(); assert.match(text(h.tree), /조회 권한을 다시 확인하세요/);
    assert.equal(noticeButton(h).props.disabled, true); noticeButton(h).props.onClick(); assert.equal(posts(h).length, 0);
    fail = false; malformed = true; h.focus(); await h.settle(); assert.match(text(h.tree), /카카오 알림 응답을 확인해 주세요/);
    noticeButton(h).props.onClick(); assert.equal(posts(h).length, 0);
});

test('고객·예약 종류·계정이 바뀌면 늦게 온 GET을 버리고 각 범위의 요청 키를 분리한다', async t => {
    const oldRead = deferred(); let first = true;
    const h = mount(t, {}, (call, current) => {
        if (call.method === 'GET' && first) { first = false; return oldRead.promise; }
        if (call.method === 'POST') return Response.json({ ok: false, state: 'unknown' }, { status: 502 });
    });
    const oldSignal = h.calls[0].init.signal;
    h.props = { ...h.props, bookingId: 'other-local' }; h.render(); await h.settle();
    assert.equal(oldSignal.aborted, true); oldRead.resolve(Response.json({ source: 'product', bookingId: 'local-booking', recipient: { name: 'OLD-CUSTOMER', phone: 'OLD-PHONE' }, notices: notices() }));
    await h.settle(); assert.doesNotMatch(text(h.tree), /OLD-CUSTOMER|OLD-PHONE/);
    noticeButton(h).props.onClick(); await h.settle();
    h.props = { ...h.props, source: 'quote_booking' }; h.render(); await h.settle(); noticeButton(h).props.onClick(); await h.settle();
    h.user = { id: 'admin-local-b', role: 'admin' }; h.render(); await h.settle(); noticeButton(h).props.onClick(); await h.settle();
    assert.equal(new Set(posts(h).map(call => call.body.idempotencyKey)).size, 3);
    assert.deepEqual(posts(h).map(call => call.path), ['/api/admin/customer-notices/product/other-local', '/api/admin/customer-notices/quote_booking/other-local', '/api/admin/customer-notices/quote_booking/other-local']);
});

test('POST 중 고객·계정 전환은 늦은 이전 결과와 callback을 버리고 새 고객 작업 잠금을 해제한다', async t => {
    const gate = deferred(), oldBusy = [], currentBusy = []; let oldResults = 0, currentResults = 0;
    const h = mount(t, { onBusyChange: value => oldBusy.push(value), onResult: () => oldResults++ }, call => call.method === 'POST' ? gate.promise : undefined);
    await h.settle(); noticeButton(h).props.onClick(); h.render();
    h.user = { id: 'admin-local-b', role: 'admin' };
    h.props = { ...h.props, bookingId: 'new-local-customer', onBusyChange: value => currentBusy.push(value), onResult: () => currentResults++ };
    h.render(); await h.settle(); gate.resolve(Response.json({ ok: true, state: 'accepted' })); await h.settle();
    assert.doesNotMatch(text(h.tree), /카카오 발송을 접수했습니다|이미 접수된 발송입니다/);
    assert.equal(oldResults, 0); assert.equal(currentResults, 0); assert.deepEqual(oldBusy.filter(Boolean), [true]);
    assert.equal(currentBusy.includes(true), false, 'old completion never starts a current-customer operation');
    assert.equal(h.tree.props['aria-busy'], false, 'old sending state must not strand the new customer');
    assert.equal(noticeButton(h).props.disabled, false, 'current customer can continue after old operation settles');
    assert.equal(posts(h).length, 1);
});

test('이전 고객의 POST 완료는 새 고객의 진행 중 발송을 풀거나 새 결과 callback을 호출하지 않는다', async t => {
    const oldPost = deferred(), newPost = deferred(), busy = []; let currentResults = 0;
    const h = mount(t, {}, call => call.method === 'POST' ? (call.path.endsWith('/local-booking') ? oldPost.promise : newPost.promise) : undefined);
    await h.settle(); noticeButton(h).props.onClick(); h.render();
    h.props = { ...h.props, bookingId: 'new-local-booking', onBusyChange: value => busy.push(value), onResult: () => currentResults++ };
    h.render(); await h.settle(); noticeButton(h).props.onClick(); h.render();
    assert.equal(posts(h).length, 2); assert.equal(h.tree.props['aria-busy'], true); assert.deepEqual(busy, [false, true]);
    oldPost.resolve(Response.json({ ok: true, state: 'accepted' })); await h.settle();
    assert.equal(h.tree.props['aria-busy'], true); assert.equal(noticeButton(h).props.disabled, true); assert.equal(currentResults, 0);
    assert.deepEqual(busy, [false, true]); noticeButton(h).props.onClick(); assert.equal(posts(h).length, 2);
    newPost.resolve(Response.json({ ok: false, state: 'failed', error: '현재 고객 발송 실패' }, { status: 409 })); await h.settle();
    assert.deepEqual(busy, [false, true, false]); assert.equal(currentResults, 1); assert.match(text(h.tree), /현재 고객 발송 실패/);
    assert.equal(h.tree.props['aria-busy'], false);
});

test('발송 후 대기 시간은 비활성 버튼과 handler 양쪽에서 차단하고 발송 이력은 조회 액션만 연다', async t => {
    let history = 0;
    const h = mount(t, { onHistory: () => history++ }, (call, current) => call.method === 'GET' ? Response.json({ ...current.data(), notices: [
        { kind: 'contract', label: '여행 계약서', available: true, cooldownUntil: new Date(Date.now() + 60000).toISOString(), lastAttempt: { state: 'accepted', at: '2026-10-20T01:00:00Z' } },
    ] }) : undefined);
    await h.settle(); assert.equal(noticeButton(h).props.disabled, true); assert.match(text(noticeButton(h)), /초 후 재발송/);
    noticeButton(h).props.onClick(); assert.equal(posts(h).length, 0); assert.match(text(h.tree), /발송 서비스 접수/);
    const historyButton = nodes(h.tree).find(node => node.type === 'button' && text(node).includes('발송 이력'));
    assert.ok(historyButton); historyButton.props.onClick(); assert.equal(history, 1); assert.equal(posts(h).length, 0);
});

test('자동 안내와 수동 재안내는 기본 접힌 상태로 나뉘며 기록 없음·설정 누락·서비스 접수를 실제 수신으로 표시하지 않는다', async t => {
    const h = mount(t, {}, (call, current) => call.method === 'GET' ? Response.json({ ...current.data(), automation: { enabled: true, notices: [
        { kind: 'request_received', label: '문의 접수 안내', trigger: '신규 문의 저장 시', state: 'accepted', lastAttempt: { state: 'accepted', at: '2026-10-20T01:00:00Z' } },
        { kind: 'contract_signed', label: '계약 서명 안내', trigger: '고객 서명 저장 시', state: 'not_triggered' },
        { kind: 'booking_confirmed', label: '예약 확정 안내', trigger: '예약 확정 시', state: 'unavailable', reason: '전용 승인 템플릿이 없습니다.' },
    ] } }) : undefined);
    await h.settle(); assert.equal(h.tree.type, 'details'); assert.equal(h.tree.props.open, undefined); assert.equal(h.tree.props.onToggle, undefined);
    const summary = nodes(h.tree).find(node => node.type === 'summary'); assert.ok(summary); assert.equal(summary.props.onClick, undefined);
    assert.equal(nodes(summary).some(node => node.type === 'button'), false); assert.match(text(summary), /고객 알림 자동발송 · 이력\/다시 보내기/);
    assert.match(text(summary), /발송 상태 확인 1건/);
    const html = renderToStaticMarkup(h.tree);
    for (const value of ['자동 안내', '수동 재안내', '문의 접수 안내', '신규 문의 저장 시', '자동 발송 기록 없음', '발송 설정 필요', '전용 승인 템플릿이 없습니다.', '발송 서비스 접수']) assert.ok(html.includes(value), value);
    assert.doesNotMatch(html, /수신 완료<|전달 완료<|자동발송 켜기/); assert.equal(posts(h).length, 0);
});

test('자동 안내 응답의 알 수 없는 상태는 발송 가능으로 추정하지 않고 조회 오류로 차단한다', async t => {
    const h = mount(t, {}, (call, current) => call.method === 'GET' ? Response.json({ ...current.data(), automation: { enabled: true, notices: [
        { kind: 'request_received', label: '문의 접수 안내', trigger: '신규 문의 저장', state: 'invented-delivery-success' },
    ] } }) : undefined);
    await h.settle(); assert.match(text(h.tree), /카카오 알림 응답을 확인해 주세요/);
    assert.equal(nodes(h.tree).some(node => node.props['aria-label'] === '여행 계약서 카카오 알림 발송'), false); assert.equal(posts(h).length, 0);
});

test('두 부모의 안정적인 원장 revision은 자동 알림 결과 변경 때만 GET을 갱신하고 이전 조회 응답을 취소한다', async t => {
    for (const page of ['AdminReservationManage', 'AdminQuoteDesk']) {
        const source = fs.readFileSync(new URL(`../src/pages/${page}.tsx`, import.meta.url), 'utf8');
        const line = source.split(/\r?\n/).find(line => line.includes('revision={JSON.stringify([') && line.includes('recordedDelivery?.items.map'));
        assert.ok(line, `${page} ties the notice query to ledger state`);
        const expression = line.slice(line.indexOf('revision={') + 10, line.indexOf('} disabled='));
        const project = new Function('deliveryRevision', 'reservation', 'customerCheckedAt', 'customerRecord', 'recordedDelivery', `return ${expression};`);
        const item = { id: 'auto-receipt', kind: 'contract', channel: 'kakao', state: 'sending', at: '2026-10-20T01:00:00Z' };
        const revision = state => project(0, { id: 'local-booking' }, '2026-10-20', { id: 'local-booking' }, { items: [{ ...item, state }] });
        assert.equal(revision('sending'), revision('sending'), `${page} does not refetch solely because a new equal object was read`);
        assert.notEqual(revision('sending'), revision('accepted'));
        const old = deferred(); let first = true;
        const h = mount(t, { revision: revision('sending') }, (call, current) => {
            if (call.method !== 'GET') return;
            if (first) { first = false; return old.promise; }
            return Response.json({ ...current.data(), automation: { enabled: true, notices: [{ kind: 'contract', label: '계약 안내', trigger: '입금 확인 후', state: 'accepted' }] } });
        });
        const signal = h.calls[0].init.signal;
        h.props = { ...h.props, revision: revision('accepted') }; h.render(); await h.settle();
        assert.equal(signal.aborted, true); assert.equal(h.calls.length, 2); assert.equal(posts(h).length, 0);
        old.resolve(Response.json({ ...h.data(), automation: { enabled: true, notices: [{ kind: 'contract', label: '계약 안내', trigger: '입금 확인 후', state: 'sending' }] } })); await h.settle();
        const automation = nodes(h.tree).find(node => node.props['aria-label'] === '자동 고객 알림 상태'); assert.ok(automation);
        assert.match(text(automation), /발송 서비스 접수/); assert.doesNotMatch(text(automation), /발송 처리 중/);
        h.props = { ...h.props, revision: revision('accepted') }; h.render(); await h.settle(); assert.equal(h.calls.length, 2, 'equal receipt revisions do not form a render/query loop');
    }
});
