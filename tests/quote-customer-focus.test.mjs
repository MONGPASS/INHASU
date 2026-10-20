import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';

const source = fs.readFileSync(new URL('../src/pages/AdminQuoteDesk.tsx', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('    const openCustomerEditor = '), source.indexOf('    const customerAction = '));
const { code } = await transform(handlers + '\nglobalThis.open = openCustomerEditor; globalThis.close = closeCustomerEditor;', { loader: 'ts' });

function harness() {
    const calls = [], frames = [];
    const context = vm.createContext({
        editorExpanded: false,
        customerPageRef: { current: { scrollTop: 640 } },
        overviewScrollRef: { current: 0 },
        customerEditorTitleRef: { current: { focus: options => calls.push(['focus', options.preventScroll]) } },
        customerEditorScope: 'admin-a:quote-a', bookingId: 'quote-a',
        flushFrame: () => ({ ok: true, busy: false }),
        requestAnimationFrame: callback => frames.push(callback),
        window: { confirm: () => false },
        setEditorNotice: value => calls.push(['notice', value]),
        setActiveSection: value => calls.push(['section', value]),
        setPendingSection: value => calls.push(['pending', value]),
        setEditorExpanded: value => { context.editorExpanded = value; calls.push(['expanded', value]); },
        setEditorMountScope: value => calls.push(['mount-scope', value]),
        setCustomerEditor: value => calls.push(['editor', value.tool]),
    });
    vm.runInContext(code, context);
    return { context, calls, flushAnimation: () => { while (frames.length) frames.shift()(); } };
}

test('실제 견적 편집 열기·현황 복귀는 이전 현황 위치를 복원하고 펼친 채 다른 업무를 선택해도 위치를 덮지 않는다', () => {
    const { context, calls, flushAnimation } = harness();
    context.open('bookings', 'docs'); flushAnimation();
    assert.equal(context.editorExpanded, true);
    assert.equal(context.overviewScrollRef.current, 640);
    assert.equal(context.customerPageRef.current.scrollTop, 0);
    assert.ok(calls.some(call => call[0] === 'focus' && call[1] === true));
    context.open('bookings', 'guide'); flushAnimation();
    assert.equal(context.overviewScrollRef.current, 640);
    assert.ok(calls.some(call => call[0] === 'section' && call[1] === 'assign'));
    calls.length = 0;
    context.close(); flushAnimation();
    assert.equal(context.editorExpanded, false);
    assert.equal(context.customerPageRef.current.scrollTop, 640);
    assert.ok(!calls.some(call => call[0] === 'editor' || call[0] === 'mount-scope'), '현황 복귀는 기존 편집기와 마운트 범위를 교체하지 않는다');
});

test('저장·발송 중 또는 초안 보관 실패 때 고객 현황 복귀를 막고 실패 상태와 현재 위치를 보존한다', () => {
    const { context, calls, flushAnimation } = harness();
    context.editorExpanded = true;
    context.overviewScrollRef.current = 640;
    for (const result of [{ ok: true, busy: true }, { ok: false, busy: false, error: '보관 실패' }]) {
        context.flushFrame = () => result;
        context.close(); flushAnimation();
        assert.equal(context.editorExpanded, true);
        assert.equal(context.customerPageRef.current.scrollTop, 640);
        assert.ok(!calls.some(call => call[0] === 'expanded' || call[0] === 'mount-scope'));
    }
    assert.ok(calls.some(call => call[0] === 'notice' && call[1] === '보관 실패'));
    calls.length = 0;
    context.flushFrame = () => ({ ok: true, busy: true });
    context.open('builder', 'docs'); flushAnimation();
    assert.ok(calls.every(call => call[0] === 'notice'), '처리 중 다른 편집기를 마운트하지 않는다');
});

const actions = source.slice(source.indexOf('    const customerAction = '), source.indexOf('    const customerEditorLabels:'));
const actionCode = (await transform(actions + '\nglobalThis.action = customerAction;', { loader: 'ts' })).code;
function actionHarness(booked) {
    const calls = [];
    const context = vm.createContext({ editorBusy: false, customerRefreshing: false, sendingKakao: false, customerRecord: { token: 'local-test', quote: { days: [] } }, returnTo: '/admin/reservations',
        navigate: href => calls.push(['navigate', href]), quoteCustomerIsBooking: () => booked,
        openCustomerEditor: (...args) => calls.push(['editor', ...args]), setEditorNotice: message => calls.push(['notice', message]),
        window: { open: () => assert.fail('Opening a work panel must not open a customer token link') } });
    vm.runInContext(actionCode, context);
    return { calls, context };
}

test('견적 예약 바로가기는 각 기존 업무를 열고 문서 확인은 발송·복사·고객 링크 열기를 실행하지 않는다', () => {
    const { calls, context } = actionHarness(true);
    const expected = { 'edit-itinerary': 'docs', 'view-info': 'view-info', 'customer-detail': 'view-info', payments: 'pay', assignments: 'assign', operations: 'notes', history: 'log', documents: 'docs' };
    for (const [action, section] of Object.entries(expected)) {
        calls.length = 0; context.action(action); assert.deepEqual(calls, [['editor', 'bookings', section]]);
    }
    for (const field of ['editorBusy', 'customerRefreshing', 'sendingKakao']) {
        context[field] = true; calls.length = 0;
        for (const action of Object.keys(expected)) context.action(action);
        assert.deepEqual(calls, []); context[field] = false;
    }
});

test('예약 전 문의의 문서 버튼은 저장된 견적 공유 단계 또는 새 견적 작성을 열고 배정·운영을 실행하지 않는다', () => {
    const { calls, context } = actionHarness(false);
    context.action('documents'); assert.deepEqual(calls, [['editor', 'builder', 'quote-share']]);
    calls.length = 0; context.customerRecord.quote = null; context.action('documents');
    assert.deepEqual(calls, [['editor', 'builder', 'docs']]);
    calls.length = 0;
    for (const action of ['payments', 'assignments', 'operations']) context.action(action);
    assert.equal(calls.length, 3); assert.ok(calls.every(call => call[0] === 'notice'));
});
