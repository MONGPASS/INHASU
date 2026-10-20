import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { accommodationOpsHref, readAccommodationReturnTo } from '../src/utils/accommodationOpsRoutes.ts';
import { productCustomerHref, quoteCustomerHref, legacyQuoteCustomerHref } from '../src/utils/customerWorkspaceRoutes.ts';
import { consumedCalendarWorkspaceSearch, readCalendarWorkspaceAction } from '../src/utils/calendarWorkspaceAction.ts';

const origin = 'https://workspace.invalid';
const calendar = '/admin/calendar?month=2026-10&date=2026-10-22&q=김&source=product#selected';
const customer = '/admin/customer-workspace/product/shared-id?returnTo=' + encodeURIComponent(calendar) + '#assign';
const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const execute = (code, values) => {
    const context = vm.createContext({ URL, URLSearchParams, accommodationOpsHref, consumedCalendarWorkspaceSearch, readCalendarWorkspaceAction, ...values });
    vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
    return context;
};

test('숙소 보드 진입은 같은 ID의 상품·견적을 구분하고 복귀 주소와 숙박 일차를 보존한다', () => {
    for (const source of ['product', 'quote_booking']) {
        const url = new URL(accommodationOpsHref(source, '동일 ID /?#%', customer, 2), origin);
        assert.equal(url.pathname, '/admin/accommodation-ops'); assert.equal(url.origin, origin);
        assert.equal(url.searchParams.get('source'), source); assert.equal(url.searchParams.get('open'), '동일 ID /?#%');
        assert.equal(url.searchParams.get('returnTo'), customer); assert.equal(url.searchParams.get('day'), '2');
    }
    for (const day of [undefined, null, 0, -1, 1.5, 101, NaN]) assert.equal(new URL(accommodationOpsHref('product', 'a', calendar, day), origin).searchParams.has('day'), false);
});

test('숙소 보드 복귀는 정해진 목록과 정확한 상품·견적 고객 화면만 허용하고 소모된 업무는 제거한다', () => {
    for (const href of [calendar, '/admin/reservations?q=김&page=3', '/admin/accommodation-ops?source=quote_booking&open=a', customer, '/admin/customer-workspace/quote/a%2Fb?returnTo=%2Fadmin%2Freservations#stay']) assert.equal(new URL(readAccommodationReturnTo(href), origin).href, new URL(href, origin).href);
    assert.equal(readAccommodationReturnTo(customer.replace('#assign', '&action=stay#assign')), customer);
    for (const href of [null, '', 'https://foreign.invalid/admin/calendar', '//foreign.invalid/admin/calendar', '/\\foreign.invalid/admin/calendar', '/admin/calendar\r\nLocation: bad', '/admin/login', '/api/reservations', '/admin/customer-workspace/legacy-quote/a', '/admin/customer-workspace/product/a/extra', '/admin/customer-workspace/product/', '/admin/customer-workspace/product/a%5Cb', customer.replace('#assign', '&returnTo=%2Fadmin#assign'), customer.replace('#assign', '&action=stay&action=guide#assign')]) assert.equal(readAccommodationReturnTo(href, '/admin/reservations'), '/admin/reservations', String(href));
});

const calendarSource = read('../src/pages/AdminCalendar.tsx');
const workspaceFunction = calendarSource.slice(calendarSource.indexOf('function workspaceHref('), calendarSource.indexOf('\nfunction TourCard('));
test('실제 캘린더의 숙소 바로가기는 보드의 해당 출처·예약·숙박 일차로 연결하고 다른 업무는 유지한다', () => {
    const context = execute(workspaceFunction + '\nglobalThis.href = workspaceHref;', { productCustomerHref, quoteCustomerHref, legacyQuoteCustomerHref });
    for (const source of ['product', 'quote_booking']) {
        const tour = { id: 'shared-id', key: `${source}:shared-id`, source };
        const url = new URL(context.href(tour, calendar, 'stay', 2), origin);
        assert.equal(url.pathname, '/admin/accommodation-ops'); assert.equal(url.searchParams.get('source'), source);
        assert.equal(url.searchParams.get('open'), 'shared-id'); assert.equal(url.searchParams.get('day'), '2');
        const back = new URL(url.searchParams.get('returnTo'), origin);
        assert.equal(back.searchParams.get('open'), tour.key); assert.equal(back.searchParams.get('q'), '김'); assert.equal(back.searchParams.get('date'), '2026-10-22'); assert.equal(back.hash, '#selected');
        const guide = new URL(context.href(tour, calendar, 'guide'), origin);
        assert.match(guide.pathname, /^\/admin\/customer-workspace\//); assert.equal(guide.searchParams.get('action'), 'guide');
    }
    const legacy = new URL(context.href({ id: 'a', key: 'legacy_quote:a', source: 'legacy_quote' }, calendar, 'stay'), origin);
    assert.equal(legacy.pathname, '/admin/customer-workspace/legacy-quote/a'); assert.equal(legacy.searchParams.has('action'), false);
});

const quoteSource = read('../src/pages/AdminQuoteDesk.tsx');
const quoteAction = quoteSource.slice(quoteSource.indexOf('    const customerAction = '), quoteSource.indexOf('    const customerEditorLabels:'));
test('견적 고객의 숙소 버튼은 저장·발송·편집 중과 취소를 보호하고 깨끗한 상태에서만 통합 보드로 이동한다', () => {
    const calls = [];
    const context = execute(quoteAction + '\nglobalThis.action = customerAction;', {
        editorBusy: false, customerRefreshing: false, sendingKakao: false, editorDirty: false,
        customerRecord: { id: 'shared-id', status: '예약확정', booking: {} }, bookingId: 'shared-id', bookingWorkspace: null,
        workspaceLocation: { pathname: '/admin/customer-workspace/quote/shared-id', search: '?returnTo=' + encodeURIComponent(calendar) + '&action=stay', hash: '#assign' },
        quoteCustomerIsBooking: () => true, flushFrame: () => ({ ok: true, busy: false }),
        navigate: href => calls.push(['navigate', href]), setEditorNotice: message => calls.push(['notice', message]),
        openCustomerEditor: () => assert.fail('숙소는 별도 고객 편집기를 열지 않는다'),
    });
    for (const field of ['editorBusy', 'customerRefreshing', 'sendingKakao', 'editorDirty']) {
        context[field] = true; context.action('stay'); assert.equal(calls.some(call => call[0] === 'navigate'), false); context[field] = false; calls.length = 0;
    }
    for (const state of [{ ok: false, busy: false }, { ok: true, busy: true }]) {
        context.flushFrame = () => state; context.action('stay'); assert.equal(calls.some(call => call[0] === 'navigate'), false); calls.length = 0;
    }
    context.flushFrame = () => ({ ok: true, busy: false });
    for (const status of ['취소', '예약취소', 'cancelled']) {
        context.customerRecord.status = status; context.action('stay'); assert.equal(calls.length, 1); assert.match(calls[0][1], /취소/); calls.length = 0;
    }
    context.customerRecord.status = '예약확정'; assert.equal(context.action('stay'), true);
    const href = new URL(calls[0][1], origin); assert.equal(href.pathname, '/admin/accommodation-ops');
    assert.equal(href.searchParams.get('source'), 'quote_booking'); assert.equal(href.searchParams.get('open'), 'shared-id');
    const back = new URL(href.searchParams.get('returnTo'), origin); assert.equal(back.pathname, context.workspaceLocation.pathname); assert.equal(back.searchParams.has('action'), false); assert.equal(back.searchParams.get('returnTo'), calendar); assert.equal(back.hash, '#assign');
});

function calendarEffects(path) {
    const text = read(path), source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), callbacks = [];
    function visit(node) {
        if (ts.isCallExpression(node) && node.expression.getText(source) === 'useEffect' && node.arguments[0]?.getText(source).includes('readCalendarWorkspaceAction')) callbacks.push(node.arguments[0].getText(source));
        ts.forEachChild(node, visit);
    }
    visit(source); return callbacks;
}
test('이전 캘린더 숙소 URL의 보드 이동은 뒤이은 업무 소비 replace에 의해 덮어쓰이지 않는다', () => {
    const calls = [], search = '?action=stay&returnTo=' + encodeURIComponent(calendar);
    const [product] = calendarEffects('../src/pages/AdminReservationManage.tsx');
    const productContext = execute('globalThis.effect = ' + product, {
        fullPage: true, userLoading: false, user: { role: 'admin', id: 'admin' }, reservation: { id: 'shared-id' }, editForm: { id: 'shared-id' },
        workspaceLocation: { pathname: '/admin/customer-workspace/product/shared-id', search, key: 'key', hash: '' },
        calendarActionHandler: { current: action => { calls.push(['handler', action]); return true; } }, handledCalendarAction: { current: '' },
        workspaceNavigate: () => assert.fail('보드 이동 뒤 현재 고객 URL로 다시 이동하면 안 된다'), workspaceIsBusy: () => false,
        isEditing: false, inlineDirty: false, operationsDirty: false, quickAssignmentDirty: false, docDraftPending: false, memoDraft: '',
    });
    productContext.effect(); productContext.effect(); assert.deepEqual(calls, [['handler', 'stay']]);
    const [quoteStart, quoteComplete] = calendarEffects('../src/pages/AdminQuoteDesk.tsx');
    const request = { current: null }, quoteValues = {
        customerPage: true, linked: true, customerRecord: { id: 'shared-id' }, bookingId: 'shared-id', accountId: 'admin', customerRefreshing: false, editorBusy: false, sendingKakao: false, editorDirty: false,
        workspaceLocation: { pathname: '/admin/customer-workspace/quote/shared-id', search, key: 'key', hash: '' }, calendarActionRequest: request,
        flushFrame: () => ({ ok: true, busy: false }), customerAction: () => true,
        editorExpanded: true, customerEditorMounted: true, frameIsMounted: true, frameLoading: false, pendingSection: '', navigate: () => assert.fail('보드 이동 뒤 업무 소비가 재이동하면 안 된다'),
    };
    execute('globalThis.effect = ' + quoteStart, quoteValues).effect(); assert.equal(request.current.consumed, true);
    execute('globalThis.effect = ' + quoteComplete, quoteValues).effect();
});
