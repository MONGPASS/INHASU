import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { productWorkspaceReservation, legacyWorkspaceReservation, productCustomerOverview, legacyCustomerOverview, sameAccountProductBookings } from '../src/utils/productCustomerWorkspace.ts';
import { reservationWorkspaceStatus } from '../src/utils/reservationWorkspace.ts';

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
    const context = { workspaceIsBusy: () => false, workspace: { published: true }, canStartDelivery: () => true, inlineDirty: false, operationsDirty: false, isEditing: false, itineraryPreviewUrl: '/preview', contractUrl: '/contract', window: { open: (...args) => calls.push(['open', ...args]) } };
    for (const name of ['closeWorkspace', 'copyCustomerMessage', 'sendItineraryToCustomer', 'openInlineDocument', 'printGuideSheet', 'setIsEditing', 'scrollToSec', 'setNavigationNotice']) context[name] = (...args) => calls.push([name, ...args]);
    const start = source.indexOf('    const overviewAction = (action: string) => {');
    const end = source.indexOf('\n\n    return (<>', start);
    execute(source.slice(start, end) + '\nglobalThis.action = overviewAction;', context);
    for (const action of ['back', 'customer-link', 'send-itinerary', 'edit-itinerary', 'contract', 'itinerary', 'contract-preview', 'guide-pdf', 'edit-info', 'payments', 'guide', 'stay', 'vehicle', 'history', 'notes', 'documents']) context.action(action);
    for (const expected of [['closeWorkspace'], ['copyCustomerMessage', 'itinerary'], ['sendItineraryToCustomer'], ['openInlineDocument', 'itinerary'], ['openInlineDocument', 'contract'], ['printGuideSheet'], ['scrollToSec', 'pay'], ['scrollToSec', 'assign'], ['scrollToSec', 'ops'], ['scrollToSec', 'log'], ['scrollToSec', 'docs']]) assert.ok(calls.some(call => JSON.stringify(call) === JSON.stringify(expected)), JSON.stringify(expected));
    const count = calls.length; context.workspaceIsBusy = () => true;
    for (const action of ['back', 'customer-link', 'send-itinerary', 'edit-info', 'guide', 'itinerary']) context.action(action);
    assert.equal(calls.length, count);
    context.workspaceIsBusy = () => false; context.canStartDelivery = () => false; context.action('itinerary'); assert.equal(calls.length, count);
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
