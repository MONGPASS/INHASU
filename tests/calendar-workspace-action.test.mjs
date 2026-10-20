import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { build, transform } from 'esbuild';
import { fileURLToPath } from 'node:url';

const bundle = await build({ entryPoints: [fileURLToPath(new URL('../src/utils/calendarWorkspaceAction.ts', import.meta.url))], bundle: true, format: 'cjs', platform: 'node', write: false });
const module = { exports: {} };
vm.runInNewContext(bundle.outputFiles[0].text, { module, exports: module.exports, URL, URLSearchParams });
const { readCalendarWorkspaceAction, consumedCalendarWorkspaceSearch } = module.exports;
const search = action => '?action=' + action + '&returnTo=' + encodeURIComponent('/admin/calendar?month=2026-11&date=2026-11-03&needs=guide') + '&keep=1';

test('캘린더 업무 바로가기는 허용된 업무와 검증된 캘린더 복귀 주소만 받는다', () => {
    for (const action of ['guide', 'vehicle', 'stay', 'payments']) assert.equal(readCalendarWorkspaceAction(search(action)), action);
    for (const value of ['', '?action=guide', search('send-itinerary'), search('guide') + '&action=payments', search('guide') + '&returnTo=/admin/calendar']) assert.equal(readCalendarWorkspaceAction(value), null);
    for (const returnTo of ['/admin/reservations', '/admin/calendar/other', '/admin/calendarish', 'https://foreign.invalid/admin/calendar', '//foreign.invalid/admin/calendar', '/\\foreign.invalid/admin/calendar', '/admin/calendar\r\nLocation: bad']) {
        assert.equal(readCalendarWorkspaceAction('?action=guide&returnTo=' + encodeURIComponent(returnTo)), null);
    }
    const cleaned = new URLSearchParams(consumedCalendarWorkspaceSearch(search('vehicle')));
    assert.equal(cleaned.has('action'), false);
    assert.equal(cleaned.get('returnTo'), '/admin/calendar?month=2026-11&date=2026-11-03&needs=guide');
    assert.equal(cleaned.get('keep'), '1');
});

async function calendarEffects(path) {
    const source = ts.createSourceFile(path, fs.readFileSync(new URL(path, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const effects = [];
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('readCalendarWorkspaceAction')) effects.push(node.arguments[0].getText(source));
        ts.forEachChild(node, visit);
    }
    visit(source);
    return Promise.all(effects.map(async callback => (await transform('globalThis.effect = ' + callback, { loader: 'ts' })).code));
}
const [productEffect] = await calendarEffects('../src/pages/AdminReservationManage.tsx');
const [quoteStart, quoteComplete] = await calendarEffects('../src/pages/AdminQuoteDesk.tsx');
const run = (code, values) => { const context = vm.createContext({ readCalendarWorkspaceAction, consumedCalendarWorkspaceSearch, JSON, ...values }); vm.runInContext(code, context); context.effect(); return context; };

test('상품 캘린더 바로가기는 준비된 현재 예약에서 한 번만 열고 미저장·처리 중에는 기다린다', () => {
    const opened = [], navigated = [], handled = { current: '' };
    const base = { fullPage: true, userLoading: false, user: { role: 'admin', id: 'admin-a' }, reservation: { id: 'a' }, editForm: { id: 'a' },
        workspaceLocation: { pathname: '/admin/customer-workspace/product/a', search: search('guide'), key: 'navigation-a', hash: '#keep' },
        calendarActionHandler: { current: action => opened.push(action) }, handledCalendarAction: handled, workspaceNavigate: (...args) => navigated.push(args),
        workspaceIsBusy: () => false, isEditing: false, inlineDirty: false, operationsDirty: false, quickAssignmentDirty: false, docDraftPending: false, memoDraft: '' };
    for (const patch of [{ userLoading: true }, { user: { role: 'user' } }, { editForm: { id: 'other' } }, { workspaceIsBusy: () => true }, { isEditing: true }, { inlineDirty: true }, { operationsDirty: true }, { quickAssignmentDirty: true }, { docDraftPending: true }, { memoDraft: '미저장 메모' }, { fullPage: false }]) run(productEffect, { ...base, ...patch });
    assert.deepEqual(opened, []); assert.deepEqual(navigated, []);
    run(productEffect, base); run(productEffect, base);
    assert.deepEqual(opened, ['guide']); assert.equal(navigated.length, 1);
    assert.equal(navigated[0][1].replace, true); assert.equal(navigated[0][0].hash, '#keep');
    assert.equal(new URLSearchParams(navigated[0][0].search).has('action'), false);
});

test('견적 캘린더 바로가기는 실제 편집기 준비와 성공한 패널 이동을 기다린 뒤 소비한다', () => {
    const opened = [], navigated = [], request = { current: null };
    const base = { customerPage: true, linked: true, customerRecord: { id: 'a' }, bookingId: 'a', accountId: 'admin-a', customerRefreshing: false,
        editorBusy: false, sendingKakao: false, editorDirty: false, workspaceLocation: { pathname: '/admin/customer-workspace/quote/a', search: search('stay'), key: 'navigation-a', hash: '' },
        calendarActionRequest: request, flushFrame: () => ({ ok: true, busy: false }), customerAction: action => opened.push(action),
        editorExpanded: false, customerEditorMounted: false, frameIsMounted: false, frameLoading: true, pendingSection: 'stay', navigate: (...args) => navigated.push(args) };
    for (const patch of [{ linked: false }, { customerRecord: null }, { customerRefreshing: true }, { editorBusy: true }, { sendingKakao: true }, { editorDirty: true }, { flushFrame: () => ({ ok: false, busy: false }) }]) run(quoteStart, { ...base, ...patch });
    assert.deepEqual(opened, []);
    run(quoteStart, base); run(quoteStart, base); assert.deepEqual(opened, ['stay']);
    run(quoteComplete, base); assert.deepEqual(navigated, []);
    const ready = { ...base, editorExpanded: true, customerEditorMounted: true, frameIsMounted: true, frameLoading: false, pendingSection: '' };
    run(quoteComplete, { ...ready, bookingId: 'other' }); assert.deepEqual(navigated, []);
    run(quoteComplete, { ...ready, pendingSection: 'stay' }); assert.deepEqual(navigated, []);
    run(quoteComplete, ready); run(quoteComplete, ready);
    assert.equal(navigated.length, 1); assert.equal(navigated[0][1].replace, true);
    assert.equal(new URLSearchParams(navigated[0][0].search).get('keep'), '1');
});
