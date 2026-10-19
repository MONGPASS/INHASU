import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { productWorkspaceReservation, legacyWorkspaceReservation, productCustomerOverview, legacyCustomerOverview, sameAccountProductBookings } from '../src/utils/productCustomerWorkspace.ts';
import { reservationWorkspaceStatus, emptyReservationOperations } from '../src/utils/reservationWorkspace.ts';
import { readProductVehicle } from '../src/utils/reservationAssignment.ts';

const source = readFileSync(new URL('../src/pages/AdminReservationManage.tsx', import.meta.url), 'utf8');
const base = { id: 'reservation-same', user_id: 'customer-account', customer_name: '동명이인', customer_email: 'fixture@example.invalid', product_name: '테를지', total_price: 0, deposit_amount: 0, balance_amount: 0, status: 'confirmed', deposit_status: 'paid', balance_status: 'unpaid', total_people: 2, start_date: '2026-10-20', end_date: '2026-10-22' };
const overview = (row, days = [{ day: 1, title: '테를지' }], options = {}) => productCustomerOverview(row, days, reservationWorkspaceStatus({ ...row, days, travelers: [], agreement: row.contractData?.agreement }), { vehicle: '', itineraryReady: true, itinerarySent: false, contractSent: false, itineraryChanged: false, contractChanged: false, ...options });

test('상품 고객 요약은 실제 0원과 미확인 금액을 구분하고 정확한 예약만 표시한다', () => {
    const zero = productWorkspaceReservation(base);
    assert.deepEqual(overview(zero).payment, { total: 0, deposit: 0, balance: 0, depositPaid: true, balancePaid: false });
    const missing = productWorkspaceReservation({ ...base, total_price: null, deposit_amount: null, balance_amount: null });
    assert.deepEqual(overview(missing).payment, { total: null, deposit: null, balance: null, depositPaid: true, balancePaid: false });
    const q = legacyWorkspaceReservation({ id: base.id, name: '다른 출처', confirmed_price: null, deposit: null, status: 'new' });
    assert.equal(q.type, 'quote'); assert.equal(zero.type, 'product');
    assert.deepEqual(legacyCustomerOverview(q.quoteDetail, null).payment, { total: null, deposit: null, balance: null, depositPaid: null, balancePaid: null });
    const explicit = legacyWorkspaceReservation({ id: 'quote-zero', confirmed_price: 0, deposit: 0, deposit_status: 'paid' });
    assert.equal(legacyCustomerOverview(explicit.quoteDetail, null).payment.total, 0);
});

test('고객 요약은 관리자 메모·실제 배정·변경 후 재안내·기존 활동 이미지를 사용한다', () => {
    const row = productWorkspaceReservation({ ...base, source: 'kakao', history: [{ type: 'admin_memo', timestamp: '2026-10-19T10:00:00Z', description: '내부 상담 기록' }, { type: 'payment', description: '입금 처리' }], assigned_guide: { name: '현지 가이드' }, daily_accommodations: [], contract_data: { agreement: { agreed: true } } });
    const days = [{ day: 1, dateMode: 'manual', date: '', title: '수동 날짜', items: ['*중요 방문', '(선택 활동)'], activities: [{ images: ['/images/activity.webp'] }], accommodation: { name: '원본 상품 숙소' } }];
    const model = overview(row, days, { itineraryChanged: true, contractChanged: true, vehicle: '차량A' });
    assert.equal(model.customerName, base.customer_name); assert.equal(model.bookingNumber, base.id);
    assert.equal(model.days[0].date, ''); assert.equal(model.days[0].image, '/images/activity.webp');
    assert.equal(model.days[0].summary, '*중요 방문 · (선택 활동)');
    assert.deepEqual(model.notes.map(note => note.body), ['내부 상담 기록']);
    assert.ok(model.facts.some(fact => fact.label === '주문 경로' && fact.value === '카카오톡'));
    assert.equal(model.assignments.find(item => item.id === 'stay').state, 'pending');
    assert.ok(model.tasks.some(task => task.id === 'changed'));
    assert.equal(model.documents[0].action, 'itinerary');
    assert.deepEqual(row.dailyAccommodations, []);
});

test('같은 고객 선택은 정확한 로그인 userId만 사용하고 이름·이메일·전화 일치는 합치지 않는다', () => {
    const rows = [base, { ...base, id: 'same-owner', product_name: '고비', customer_name: '다른 표시명' }, { ...base, id: 'other', user_id: 'other-account' }, { ...base, id: 'guest', user_id: null }];
    assert.deepEqual(sameAccountProductBookings(rows, 'customer-account').map(row => row.id), ['reservation-same', 'same-owner']);
    assert.deepEqual(sameAccountProductBookings(rows, null), []);
    assert.deepEqual(Object.keys(sameAccountProductBookings(rows, 'customer-account')[0]).sort(), ['id', 'label']);
    const identical = sameAccountProductBookings([{ ...base, reservation_number: 'LOCAL-CUSTOMER-1' }, { ...base, id: 'second', reservation_number: 'LOCAL-CUSTOMER-2', total_people: 3 }], 'customer-account');
    assert.notEqual(identical[0].label, identical[1].label); assert.match(identical[0].label, /LOCAL-CUSTOMER-1.*2명/); assert.match(identical[1].label, /LOCAL-CUSTOMER-2.*3명/);
});

const execute = (code, context) => {
    vm.createContext(context);
    vm.runInContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
    return context;
};
const pending = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
test('업무 패널 전환은 결제·주문·문서·운영의 작성 중 입력을 보호하고 현재 업무의 저장 경로를 유지한다', () => {
    const calls = [];
    const context = { fullPage: true, workflowOpen: false, overviewScrollPosition: {current: 0}, window: {scrollY: 123}, activeSec: 'pay', isEditing: true, inlineDirty: false, operationsDirty: false, quickAssignmentDirty: false,
        workspaceIsBusy: () => false, requestAnimationFrame: callback => callback(),
        bodyRef: { current: { scrollTo: options => calls.push(['scroll', options.top]), querySelector: selector => ({ scrollIntoView: () => calls.push(['scroll', selector]) }) } },
        setActiveSec: value => calls.push(['section', value]), setWorkflowOpen: value => calls.push(['open', value]), setNavigationNotice: value => calls.push(['notice', value]) };
    const start = source.indexOf('    const scrollToSec = ('), end = source.indexOf('\n    useEffect(', start);
    execute(source.slice(start, end) + '\nglobalThis.navigate = scrollToSec;', context);
    context.navigate('pay'); assert.ok(calls.some(call => call[0] === 'section' && call[1] === 'pay')); assert.equal(context.overviewScrollPosition.current, 123);
    calls.length = 0; context.navigate('info'); assert.equal(calls.length, 1); assert.match(calls[0][1], /저장/);
    for (const [field, current, allowed] of [['isEditing', 'info', 'info'], ['inlineDirty', 'inline-doc', 'docs'], ['operationsDirty', 'ops', 'ops']]) {
        context.isEditing = context.inlineDirty = context.operationsDirty = false; context[field] = true; context.activeSec = current;
        calls.length = 0; context.navigate(allowed); assert.ok(calls.some(call => call[0] === 'section' && call[1] === allowed));
        calls.length = 0; context.navigate('log'); assert.equal(calls.length, 1); assert.equal(calls[0][0], 'notice');
    }
    context.operationsDirty = false; context.quickAssignmentDirty = true; calls.length = 0; context.navigate('docs'); assert.equal(calls.length, 1);
    context.quickAssignmentDirty = false; context.workspaceIsBusy = () => true; calls.length = 0; context.navigate('pay'); assert.equal(calls.length, 0);
    context.fullPage = false; context.isEditing = true; context.navigate('log'); assert.ok(calls.some(call => call[0] === 'section' && call[1] === 'log'));
});

test('고객 현황 복귀는 처리 중·초안 보관 실패를 차단하고 성공 때 입력과 편집 상태를 유지하며 기존 스크롤을 복원한다', () => {
    const calls = [], draft = { name: '작성 중 일정' }, order = { customerName: '작성 중 주문자' }, operations = { opsNote: '작성 중 운영 메모' };
    const context = {
        workspaceIsBusy: () => true, overviewScrollPosition: { current: 612 }, workflowOpen: true,
        isEditing: true, operationsDirty: true, inlineDirty: true, quickAssignmentDirty: true, inlineEditorOpen: true,
        draft, editForm: order, operationsDraft: operations,
        inlineControlRef: { current: { flush: () => { calls.push(['flush']); return { ok: true }; } } },
        setNavigationNotice: value => calls.push(['notice', value]),
        setWorkflowOpen: value => { context.workflowOpen = value; calls.push(['open', value]); },
        requestAnimationFrame: callback => callback(), window: { scrollTo: options => calls.push(['scroll', options.top]) },
    };
    for (const name of ['setIsEditing', 'setOperationsDirty', 'setInlineDirty', 'setQuickAssignmentDirty', 'setInlineEditorOpen', 'setEditForm', 'setActiveSec']) {
        context[name] = () => assert.fail('returning to the overview must not clear or close editing state');
    }
    const start = source.indexOf('    const returnToCustomerOverview = () => {'), end = source.indexOf('\n\n    useEffect(', start);
    execute(source.slice(start, end) + '\nglobalThis.returnToOverview = returnToCustomerOverview;', context);
    context.returnToOverview();
    assert.equal(calls.length, 1); assert.match(calls[0][1], /끝난 뒤/); assert.equal(context.workflowOpen, true);
    calls.length = 0; context.workspaceIsBusy = () => false;
    context.inlineControlRef.current.flush = () => { calls.push(['flush']); return { ok: false, error: '브라우저 보관 실패' }; };
    context.returnToOverview();
    assert.deepEqual(calls, [['flush'], ['notice', '브라우저 보관 실패']]); assert.equal(context.workflowOpen, true);
    calls.length = 0; context.inlineControlRef.current.flush = () => { calls.push(['flush']); return { ok: true }; };
    context.returnToOverview();
    assert.deepEqual(calls, [['flush'], ['notice', ''], ['open', false], ['scroll', 612]]);
    assert.equal(context.draft, draft); assert.equal(context.editForm, order); assert.equal(context.operationsDraft, operations);
    for (const key of ['isEditing', 'operationsDirty', 'inlineDirty', 'quickAssignmentDirty', 'inlineEditorOpen']) assert.equal(context[key], true, key);
    calls.length = 0; context.inlineControlRef.current = null; context.workflowOpen = true;
    context.returnToOverview();
    assert.deepEqual(calls, [['notice', ''], ['open', false], ['scroll', 612]], 'overview return also works when no document editor is mounted');
});

test('고객 일정 행은 해당 일차 편집을 열고 집중 작업 이동은 본문을 처음부터 보여주며 요약 위치를 덮지 않는다', () => {
    const calls = [];
    let scheduledFrames = 0;
    const context = {
        fullPage: true, workflowOpen: false, isEditing: false, inlineDirty: false, operationsDirty: false, quickAssignmentDirty: false,
        reservation: { status: 'confirmed' }, workspaceIsBusy: () => false, overviewScrollPosition: { current: 0 }, documentFocusRevision: 0,
        overview: { days: [{ id: 'saved-day-one', day: 1 }, { id: 'saved-day-three', day: 3 }] },
        window: { scrollY: 420 }, requestAnimationFrame: callback => { scheduledFrames++; callback(); },
        bodyRef: { current: { scrollTo: options => calls.push(['scroll', options.top]), querySelector: () => assert.fail('full-page work must not jump through the old overview to an anchor') } },
        setWorkflowOpen: value => { context.workflowOpen = value; calls.push(['open', value]); },
        setDocumentFocusRevision: value => { context.documentFocusRevision = typeof value === 'function' ? value(context.documentFocusRevision) : value; },
        setRequestedDocumentDay: value => calls.push(['day', value]), setActiveDocument: value => calls.push(['mode', value]),
        setInlineEditorOpen: value => calls.push(['editor', value]), setActiveSec: value => calls.push(['section', value]),
        setNavigationNotice: value => calls.push(['notice', value]), alert: value => calls.push(['alert', value]),
    };
    const openStart = source.indexOf('    const openInlineDocument = ('), openEnd = source.indexOf('    const closeInlineDocument =', openStart);
    const actionStart = source.indexOf('    const overviewAction = ('), actionEnd = source.indexOf('\n\n    return (<>', actionStart);
    const navigationStart = source.indexOf('    const scrollToSec = ('), navigationEnd = source.indexOf('    const returnToCustomerOverview =', navigationStart);
    execute(source.slice(openStart, openEnd) + source.slice(actionStart, actionEnd) + source.slice(navigationStart, navigationEnd)
        + '\nglobalThis.action = overviewAction; globalThis.navigate = scrollToSec;', context);
    context.action('edit-itinerary', 'saved-day-three');
    assert.deepEqual(calls, [['scroll', 0], ['open', true], ['day', 3], ['mode', 'itinerary'], ['editor', true], ['section', 'inline-doc']]);
    assert.equal(scheduledFrames, 0, 'a delayed parent reset must not cancel the child widget’s requested day jump');
    assert.equal(context.overviewScrollPosition.current, 420);
    assert.equal(context.documentFocusRevision, 1);
    calls.length = 0; context.workflowOpen = false;
    context.action('edit-itinerary', 'saved-day-three');
    assert.ok(calls.some(call => call[0] === 'day' && call[1] === 3));
    assert.equal(context.documentFocusRevision, 2, 'opening the same mounted editor and day again still requests focus');
    calls.length = 0; context.window.scrollY = 999;
    context.action('edit-itinerary', 'unknown-day');
    assert.ok(calls.some(call => call[0] === 'day' && call[1] === undefined)); assert.equal(context.overviewScrollPosition.current, 420);
    calls.length = 0; context.action('contract');
    assert.ok(calls.some(call => call[0] === 'mode' && call[1] === 'contract')); assert.ok(calls.some(call => call[0] === 'day' && call[1] === undefined));
    calls.length = 0; context.navigate('log');
    assert.deepEqual(calls, [['notice', ''], ['section', 'log'], ['open', true], ['scroll', 0]]);
    assert.equal(context.overviewScrollPosition.current, 420, 'switching work sections retains the original overview scroll position');
    calls.length = 0; context.reservation.status = 'cancelled'; context.action('edit-itinerary', 'saved-day-one'); assert.deepEqual(calls, []);
    context.reservation.status = 'confirmed'; context.workspaceIsBusy = () => true; context.action('edit-itinerary', 'saved-day-one'); assert.deepEqual(calls, []);
    assert.equal(context.documentFocusRevision, 4, 'blocked editor entries do not create focus requests');
});

function customerLoader(get) {
    const state = {};
    const context = { customerPage: true, customerSource: 'product', customerScope: 'admin-a:product:a', customerReservationId: 'a', userLoading: false, user: { id: 'admin-a', role: 'admin' }, currentScope: { current: 'admin-a:product:a' }, fetchSequence: { current: 0 }, api: { reservations: { get }, quotes: { get }, products: { list: async () => [] } }, productWorkspaceReservation, legacyWorkspaceReservation, String, Array };
    for (const key of ['isLoading', 'customerLoadError', 'selectedReservation', 'loadedCustomerScope', 'products', 'loadWarnings', 'reservations', 'loadedOnce']) context['set' + key[0].toUpperCase() + key.slice(1)] = value => { state[key] = value; };
    const start = source.indexOf('    const fetchReservations = async () => {');
    const end = source.indexOf('    // End of fetchReservations', start);
    execute(source.slice(start, end) + '\nglobalThis.load = fetchReservations;', context);
    return { context, state };
}

test('실제 전용 페이지 로더는 source별 정확한 GET을 읽고 없는 예약은 이전 고객 대신 오류를 표시한다', async () => {
    const calls = [];
    const { context, state } = customerLoader(async id => { calls.push(id); return { ...base, id }; });
    await context.load(); assert.deepEqual(calls, ['a']); assert.equal(state.selectedReservation.id, 'a');
    context.api.reservations.get = async () => { const error = new Error('missing'); error.status = 404; throw error; };
    await context.load(); assert.equal(state.selectedReservation, null); assert.deepEqual(Array.from(state.reservations), []); assert.match(state.customerLoadError, /없습니다/);
    context.customerSource = 'quote'; context.customerReservationId = 'legacy'; context.customerScope = 'admin-a:quote:legacy'; context.currentScope.current = context.customerScope;
    context.api.quotes.get = async id => ({ id, name: '이전 문의', status: 'new' });
    await context.load(); assert.equal(state.selectedReservation.type, 'quote'); assert.equal(state.selectedReservation.id, 'legacy');
});

test('계정·예약 변경 전의 늦은 조회 응답은 고객 상세와 로딩 상태를 덮지 않는다', async () => {
    const old = pending(), fresh = pending();
    const { context, state } = customerLoader(id => id === 'a' ? old.promise : fresh.promise);
    const previous = context.load();
    context.customerScope = 'admin-b:product:b'; context.currentScope.current = context.customerScope; context.customerReservationId = 'b'; context.user = { id: 'admin-b', role: 'admin' };
    const current = context.load(); fresh.resolve({ ...base, id: 'b', customer_name: '현재 고객' }); await current;
    old.resolve({ ...base, id: 'a', customer_name: '이전 고객' }); await previous;
    assert.equal(state.selectedReservation.id, 'b'); assert.equal(state.loadedCustomerScope, context.customerScope); assert.equal(state.isLoading, false);
});

test('요약 버튼들은 실제 기존 업무 제어에 연결되고 저장 중에는 어떤 동작도 실행하지 않는다', () => {
    const calls = [];
    const context = { workspaceIsBusy: () => false, workspace: { published: true }, canStartDelivery: () => true, inlineDirty: false, operationsDirty: false, isEditing: false, quickAssignmentDirty: false, fullPage: false, itineraryPreviewUrl: '/preview', contractUrl: '/contract', window: { open: (...args) => calls.push(['open', ...args]) } };
    for (const name of ['closeWorkspace', 'copyCustomerMessage', 'sendItineraryToCustomer', 'openInlineDocument', 'printGuideSheet', 'setIsEditing', 'scrollToSec', 'setNavigationNotice']) context[name] = (...args) => calls.push([name, ...args]);
    const start = source.indexOf('    const overviewAction = (');
    const end = source.indexOf('\n\n    return (<>', start);
    execute(source.slice(start, end) + '\nglobalThis.action = overviewAction;', context);
    for (const action of ['back', 'customer-link', 'send-itinerary', 'edit-itinerary', 'contract', 'itinerary', 'contract-preview', 'guide-pdf', 'edit-info', 'payments', 'guide', 'stay', 'vehicle', 'history', 'notes', 'documents']) context.action(action);
    for (const expected of [['closeWorkspace'], ['copyCustomerMessage', 'itinerary'], ['sendItineraryToCustomer'], ['openInlineDocument', 'itinerary'], ['openInlineDocument', 'contract'], ['printGuideSheet'], ['scrollToSec', 'pay'], ['scrollToSec', 'assign'], ['scrollToSec', 'ops'], ['scrollToSec', 'log'], ['scrollToSec', 'docs']]) assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(expected)), JSON.stringify(expected));
    const count = calls.length; context.workspaceIsBusy = () => true;
    for (const action of ['back', 'customer-link', 'send-itinerary', 'edit-info', 'guide', 'itinerary']) context.action(action);
    assert.equal(calls.length, count);
    context.workspaceIsBusy = () => false; context.canStartDelivery = () => false; context.action('itinerary'); assert.equal(calls.length, count);
});

test('고객 카드 배정은 기존 상세로 이동하지 않고 바로 선택하며 미저장 차량·문서·운영·취소·처리 중을 보호한다', () => {
    const calls = [];
    const context = { fullPage: true, quickAssignmentDirty: false, inlineDirty: false, operationsDirty: false, isEditing: false,
        reservation: { id: 'local-product', status: 'confirmed' }, workspaceIsBusy: () => false };
    for (const name of ['setNavigationNotice', 'setQuickAssignment', 'setShowGuideModal', 'setWorkflowOpen', 'scrollToSec', 'closeWorkspace']) context[name] = (...args) => calls.push([name, ...args]);
    const start = source.indexOf('    const overviewAction = ('), end = source.indexOf('\n\n    return (<>', start);
    execute(source.slice(start, end) + '\nglobalThis.action = overviewAction;', context);
    for (const action of ['guide', 'stay', 'vehicle']) context.action(action);
    assert.deepEqual(calls.filter(call => call[0] !== 'setNavigationNotice'), [['setWorkflowOpen', false], ['setQuickAssignment', null], ['setShowGuideModal', true], ['setWorkflowOpen', false], ['setQuickAssignment', 'stay'], ['setWorkflowOpen', false], ['setQuickAssignment', 'vehicle']]);
    for (const blockedField of ['quickAssignmentDirty', 'inlineDirty', 'operationsDirty', 'isEditing']) {
        calls.length = 0; context[blockedField] = true;
        for (const action of ['guide', 'stay', 'vehicle']) context.action(action);
        assert.equal(calls.length, 3); assert.ok(calls.every(call => call[0] === 'setNavigationNotice'));
        context[blockedField] = false;
    }
    calls.length = 0; context.reservation.status = 'cancelled';
    for (const action of ['guide', 'stay', 'vehicle']) context.action(action);
    assert.equal(calls.length, 3); assert.ok(calls.every(call => call[0] === 'setNavigationNotice' && /취소/.test(call[1])));
    calls.length = 0; context.reservation.status = 'confirmed'; context.workspaceIsBusy = () => true;
    for (const action of ['guide', 'stay', 'vehicle']) context.action(action);
    assert.deepEqual(calls, []);
    context.workspaceIsBusy = () => false; context.quickAssignmentDirty = true; context.action('back');
    assert.deepEqual(calls, [['closeWorkspace']]);
});

test('고객 카드 차량 저장은 기존 운영·현금영수증·계약·가이드·숙소를 보존하고 실패 뒤 성공으로 오인하지 않는다', async () => {
    const reservation = { ...base, id: 'local-product', adminOperations: { vehicle: '이전 차량', driverPhone: 'OLD-PRIVATE', opsNote: '내부 운영 기록', receipt: { number: 'receipt-123' } },
        contractData: { agreement: { agreed: true }, travelers: [{ name: '고객' }], vehicle: { type: '이전 차량' } }, assignedGuide: { id: 'guide-a', name: '담당 가이드' }, dailyAccommodations: [{ day: 1, accommodation: { name: '확정 숙소' } }], history: [{ type: 'payment', description: '이전 입금 이력' }] };
    const payloads = [], notices = [];
    const context = { reservation, workspaceIsBusy: () => false, isEditing: false, inlineDirty: false, operationsDirty: false,
        readProductVehicle, emptyReservationOperations, Date, setNavigationNotice: value => notices.push(value),
        onUpdate: async (...args) => { payloads.push(args); return false; } };
    const start = source.indexOf('    const saveQuickVehicle = async'), end = source.indexOf('    const quickAssignmentEditor =', start);
    execute(source.slice(start, end) + '\nglobalThis.save = saveQuickVehicle;', context);
    const next = { type: '하이이스', phone: 'NEW-PRIVATE' };
    assert.equal(await context.save(next), false); assert.deepEqual(notices, []);
    const [updated, quiet] = payloads[0];
    assert.equal(quiet, true); assert.equal(updated.adminOperations.vehicle, next.type); assert.equal(updated.adminOperations.driverPhone, next.phone);
    for (const key of ['opsNote', 'receipt']) assert.equal(updated.adminOperations[key], reservation.adminOperations[key]);
    for (const key of ['contractData', 'assignedGuide', 'dailyAccommodations']) assert.equal(updated[key], reservation[key]);
    assert.equal(reservation.adminOperations.vehicle, '이전 차량'); assert.equal(reservation.history.length, 1);
    assert.equal(updated.history.length, 2); assert.equal(updated.history.at(-1).type, 'modification');
    assert.match(updated.history.at(-1).description, /차량/);
    context.onUpdate = async (...args) => { payloads.push(args); return true; };
    assert.equal(await context.save({ type: '', phone: '' }), true); assert.match(notices.at(-1), /해제/);
    assert.equal(payloads.at(-1)[0].adminOperations.vehicle, ''); assert.equal(payloads.at(-1)[0].adminOperations.driverPhone, '');
    const count = payloads.length;
    for (const field of ['isEditing', 'inlineDirty', 'operationsDirty']) { context[field] = true; assert.equal(await context.save(next), false); context[field] = false; }
    context.workspaceIsBusy = () => true; assert.equal(await context.save(next), false); assert.equal(payloads.length, count);
});

test('등록 차량 선택은 사진·소개·좌석을 계약에 저장하고 기사 연락처만 수정할 때 저장된 차량 자료를 보존한다', async () => {
    const agreement = { agreed: true, name: '서명 고객' }, travelers = [{ name: '고객' }], payloads = [];
    const reservation = { ...base, adminOperations: { vehicle: '이전 차량', driverPhone: 'OLD-PRIVATE', receipt: { number: 'existing-receipt' } },
        contractData: { agreement, travelers, vehicle: { type: '이전 차량', img: '/old-car.webp', desc: '이전 설명' } }, assignedGuide: { name: '기존 가이드' }, dailyAccommodations: [{ day: 1, accommodation: { name: '기존 숙소' } }], history: [] };
    const context = { reservation, workspaceIsBusy: () => false, isEditing: false, inlineDirty: false, operationsDirty: false, readProductVehicle, emptyReservationOperations, Date,
        setNavigationNotice: () => {}, onUpdate: async (...args) => { payloads.push(args); return true; } };
    const start = source.indexOf('    const saveQuickVehicle = async'), end = source.indexOf('    const quickAssignmentEditor =', start);
    execute(source.slice(start, end) + '\nglobalThis.save = saveQuickVehicle;', context);
    const snapshot = { img: '/registered-car.webp', images: ['/registered-car.webp', '/registered-interior.webp'], imgs: ['/registered-car.webp', '/registered-interior.webp'], description: '등록 차량 설명', desc: '등록 차량 설명', seats: '6인', luggage: '캐리어 4개', plate: 'REGISTERED-PLATE', model: '리소스 차종', type: '리소스 차종' };
    assert.equal(await context.save({ type: '등록 하이이스', phone: 'REGISTERED-DRIVER', resource: snapshot }), true);
    const first = payloads[0][0];
    assert.equal(first.contractData.agreement, agreement); assert.equal(first.contractData.travelers, travelers);
    assert.equal(first.assignedGuide, reservation.assignedGuide); assert.equal(first.dailyAccommodations, reservation.dailyAccommodations); assert.equal(first.adminOperations.receipt, reservation.adminOperations.receipt);
    assert.equal(first.contractData.vehicle.type, '등록 하이이스'); assert.equal(first.contractData.vehicle.model, '등록 하이이스'); assert.equal(first.contractData.vehicle.phone, 'REGISTERED-DRIVER');
    for (const key of ['img', 'images', 'imgs', 'description', 'desc', 'seats', 'luggage', 'plate']) assert.equal(first.contractData.vehicle[key], snapshot[key]);
    assert.equal(snapshot.type, '리소스 차종'); assert.equal(reservation.contractData.vehicle.img, '/old-car.webp');
    context.reservation = first;
    assert.equal(await context.save({ type: '등록 하이이스', phone: 'UPDATED-DRIVER' }), true);
    const second = payloads[1][0];
    assert.equal(second.adminOperations.driverPhone, 'UPDATED-DRIVER'); assert.equal(second.contractData, first.contractData);
    assert.equal(second.contractData.vehicle.img, '/registered-car.webp'); assert.equal(second.contractData.vehicle.desc, '등록 차량 설명'); assert.equal(second.contractData.vehicle.seats, '6인');
    assert.equal(first.adminOperations.driverPhone, 'REGISTERED-DRIVER'); assert.equal(second.history.length, 2); assert.equal(payloads[1][1], true);
});

test('등록 가이드 배정 실패는 선택창을 유지하고 성공한 뒤에만 닫으며 전화·QR·소개·사진을 저장한다', async () => {
    const calls = [], payloads = [];
    const reservation = { ...base, assignedGuide: { name: '이전 가이드' }, history: [{ type: 'payment', description: '입금 기록' }] };
    const context = { reservation, workspaceIsBusy: () => false, resourceLoading: false, registeredPending: false, fullPage: true, guideConflicts: () => [], validAssignmentPeriod: () => true, resourceBookings: [], resourceNotice: '', Date,
        onUpdate: async (...args) => { payloads.push(args); return false; } };
    for (const name of ['setPickerSaveError', 'setGuideConfirmation', 'rememberAssignment', 'setShowGuideModal', 'setNavigationNotice']) context[name] = (...args) => calls.push([name, ...args]);
    const start = source.indexOf('    const handleGuideAssign = async'), end = source.indexOf('    const handleAccommodationAssign =', start);
    execute(source.slice(start, end) + '\nglobalThis.assign = handleGuideAssign;', context);
    const guide = { id: 'resource-guide:등록 가이드', name: '등록 가이드', image: '/guide.webp', introduction: '등록 소개', phone: 'REGISTERED-PHONE', qr: '/guide-qr.webp', nameEn: 'Saved Guide', role: '전문 가이드', languages: ['한국어'], specialties: ['고비'], _fromResources: true };
    await context.assign(guide);
    assert.equal(payloads.length, 1); assert.equal(payloads[0][1], true); assert.equal(calls.some(call => call[0] === 'setShowGuideModal'), false); assert.equal(calls.some(call => call[0] === 'rememberAssignment'), false);
    assert.ok(calls.some(call => call[0] === 'setPickerSaveError' && /저장하지 못했습니다/.test(call[1])));
    const saved = payloads[0][0].assignedGuide;
    for (const key of ['id', 'name', 'image', 'introduction', 'phone', 'qr', 'nameEn', 'role']) assert.equal(saved[key], guide[key]);
    assert.equal(saved.languages, guide.languages); assert.equal(saved.specialties, guide.specialties);
    assert.equal(reservation.assignedGuide.name, '이전 가이드'); assert.equal(reservation.history.length, 1);
    calls.length = 0; context.onUpdate = async (...args) => { payloads.push(args); return true; }; await context.assign(guide);
    assert.ok(calls.some(call => call[0] === 'setShowGuideModal' && call[1] === false)); assert.ok(calls.some(call => call[0] === 'rememberAssignment' && call[1] === 'guides' && call[2] === guide.id));
    assert.ok(calls.some(call => call[0] === 'setNavigationNotice' && /배정했습니다/.test(call[1])));
});

test('등록 숙소 배정 실패는 선택창을 유지하고 성공 후 닫으며 방·인실·날짜를 보존하고 변경 숙소의 수배 상태를 초기화한다', async () => {
    const calls = [], payloads = [];
    const previous = { day: 1, date: '2026-10-20', accommodation: { name: '이전 숙소', roomCount: 2, occupancy: '2인실', bookingStatus: 'Баталгаажсан' } };
    const other = { day: 2, accommodation: { name: '다음 숙소' } }, reservation = { ...base, dailyAccommodations: [previous, other], history: [] };
    const context = { reservation, workspaceIsBusy: () => false, registeredPending: false, fullPage: true, selectedDay: 1, Date, onUpdate: async (...args) => { payloads.push(args); return false; } };
    for (const name of ['setPickerSaveError', 'rememberAssignment', 'setShowAccommodationModal', 'setNavigationNotice']) context[name] = (...args) => calls.push([name, ...args]);
    const start = source.indexOf('    const handleAccommodationAssign = async'), end = source.indexOf('    // 확정 숙소 배정 해제', start);
    execute(source.slice(start, end) + '\nglobalThis.assign = handleAccommodationAssign;', context);
    const stay = { id: 'resource-lodge:등록 숙소', name: '등록 숙소', type: '고급게르', location: '테를지', images: ['/selected-hotel.webp'], description: '등록 숙소 설명', facilities: ['온수'], _fromResources: true };
    await context.assign(stay);
    assert.equal(payloads[0][1], true); assert.equal(calls.some(call => call[0] === 'setShowAccommodationModal'), false); assert.equal(calls.some(call => call[0] === 'rememberAssignment'), false);
    assert.ok(calls.some(call => call[0] === 'setPickerSaveError' && /저장하지 못했습니다/.test(call[1])));
    const days = payloads[0][0].dailyAccommodations, saved = days[0].accommodation;
    for (const key of ['id', 'name', 'type', 'location', 'images', 'description', 'facilities']) assert.equal(saved[key], stay[key]);
    assert.equal(saved.roomCount, 2); assert.equal(saved.occupancy, '2인실'); assert.equal(saved.bookingStatus, 'Илгээгээгүй'); assert.equal(days[0].date, previous.date); assert.equal(days[1], other);
    assert.equal(previous.accommodation.name, '이전 숙소'); assert.equal(previous.accommodation.bookingStatus, 'Баталгаажсан'); assert.equal(reservation.history.length, 0);
    calls.length = 0; context.onUpdate = async (...args) => { payloads.push(args); return true; }; await context.assign(stay);
    assert.ok(calls.some(call => call[0] === 'setShowAccommodationModal' && call[1] === false)); assert.ok(calls.some(call => call[0] === 'rememberAssignment' && call[1] === 'stays' && call[2] === stay.id));
    assert.ok(calls.some(call => call[0] === 'setNavigationNotice' && /1일차/.test(call[1])));
});

test('실제 메모 저장은 실패 때 입력을 보존하고 성공 때만 비우며 원래 이력을 변경하지 않는다', async () => {
    const history = [{ timestamp: 'old', type: 'payment', description: '기존 입금 기록' }];
    const context = { memoDraft: '  고객 상담 메모  ', workspaceIsBusy: () => false, isEditing: false, operationsDirty: false, inlineDirty: false,
        reservation: { id: 'fixture', history }, setMemoDraft: value => { context.memoDraft = typeof value === 'function' ? value(context.memoDraft) : value; }, setMemoFocused: () => {}, setNavigationNotice: () => {}, Date };
    const payloads = [];
    context.onUpdate = async payload => { payloads.push(payload); return false; };
    const start = source.indexOf('    const addMemo = async () => {'), end = source.indexOf('    const deleteMemo', start);
    execute(source.slice(start, end) + '\nglobalThis.add = addMemo;', context);
    await context.add(); assert.equal(context.memoDraft, '  고객 상담 메모  '); assert.equal(history.length, 1);
    assert.equal(payloads[0].history.at(-1).type, 'admin_memo');
    context.onUpdate = async () => true; await context.add(); assert.equal(context.memoDraft, '');
    context.memoDraft = '수정 중 보존'; context.isEditing = true; const count = payloads.length;
    await context.add(); assert.equal(context.memoDraft, '수정 중 보존'); assert.equal(payloads.length, count);
});

test('실제 예약 저장의 늦은 응답은 교체된 계정의 상태를 덮거나 후속 고객 알림을 발송하지 않는다', async () => {
    const response = pending(), effects = [];
    const old = productWorkspaceReservation({ ...base, deposit_status: 'unpaid', status: 'pending_payment' });
    const context = { customerScope: 'admin-a', currentScope: { current: 'admin-a' }, userLoading: false, user: { id: 'admin-a', role: 'admin' }, reservations: [old],
        setUpdatingCount: () => {}, api: { reservations: { update: async () => response.promise } },
        setReservations: () => effects.push('list'), setSelectedReservation: () => effects.push('detail'),
        sendNotification: async () => effects.push('notification'), sendNotificationEmail: async () => effects.push('email'), alert: () => effects.push('alert'), console, Date, Math };
    const start = source.indexOf('    const handleUpdateReservation = async'), end = source.indexOf('    const handleStatusChange', start);
    execute(source.slice(start, end) + '\nglobalThis.save = handleUpdateReservation;', context);
    const saved = context.save({ ...old, status: 'confirmed', depositStatus: 'paid' });
    context.currentScope.current = 'admin-b'; response.resolve({ success: true });
    assert.equal(await saved, false); assert.deepEqual(effects, []);
});
