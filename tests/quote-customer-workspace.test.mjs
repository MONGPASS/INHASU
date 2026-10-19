import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const code = await build({ entryPoints: [fileURLToPath(new URL('../src/utils/quoteCustomerWorkspace.ts', import.meta.url))], bundle: true, format: 'cjs', platform: 'node', write: false });
const module = { exports: {} };
vm.runInNewContext(code.outputFiles[0].text, { module, exports: module.exports, fetch, Date, URL });
const { quoteCustomerWorkspaceModel: model, quoteCustomerIsBooking: isBooking, loadQuoteCustomerRequest: load } = module.exports;
const inquiry = { id: 'inquiry-only', name: '같은 표시명', adult: 2, status: '신규', memo: '직원 상담 메모', request: '고객 요청' };

test('미예약 문의도 실제 문의 상태로 열리고 결제·배정 완료로 추정하지 않는다', () => {
    const before = JSON.stringify(inquiry), result = model(inquiry);
    assert.equal(isBooking(inquiry), false); assert.equal(result.sourceLabel, '맞춤 견적 문의');
    assert.equal(result.payment.total, null); assert.equal(result.payment.depositPaid, null);
    assert.equal(result.days.length, 0); assert.equal(result.notes[0].body, inquiry.memo);
    assert.ok(result.assignments.every(item => item.state === 'pending'));
    assert.equal(result.canSendItinerary, false); assert.equal(JSON.stringify(inquiry), before);
    assert.notEqual(model({ ...inquiry, id: 'another-same-name' }).bookingNumber, result.bookingNumber);
});
test('견적 내부 저장 시각·알림 건너뜀은 발송 완료가 아니며 명시한 0원은 보존한다', () => {
    const record = { ...inquiry, quoteIssuedAt: '2026-10-19', quote: { pax: 2, days: [], price: { deposit: 0, balances: [{ pax: 2, economy: 0 }] } }, activities: [{ type: 'quote_notification_skipped' }] };
    const result = model(record);
    assert.equal(result.payment.total, 0); assert.equal(result.payment.deposit, 0); assert.equal(result.payment.balance, 0);
    assert.equal(result.steps.find(step => step.id === 'sent').done, false);
    assert.equal(result.documents[0].status, '저장됨');
    assert.equal(model({ ...record, activities: [{ type: 'quote_notification_queued' }] }).documents[0].status, '발송 요청 기록 있음');
    const empty = model({ ...record, quote: { price: {} } });
    assert.equal(empty.payment.total, null); assert.equal(empty.payment.deposit, null); assert.equal(empty.payment.balance, null);
});
test('빈 일정과 부족·중복 숙소는 준비 완료로 표시하지 않고 명시적으로 비운 활동을 되살리지 않는다', () => {
    const record = { ...inquiry, depart: '2026-10-20', return_: '2026-10-22', booking: { days: [{ d: 1, dest: '', items: [], activities: [{ title: '삭제했던 활동' }] }], assign: { lodges: [{ day: 1, name: '호텔' }, { day: 1, name: '중복' }] }, contractRequest: { status: 'requested' } } };
    const result = model(record);
    assert.equal(result.steps.find(step => step.id === 'schedule').done, false);
    assert.equal(result.steps.find(step => step.id === 'contract').done, false);
    assert.equal(result.days[0].summary, '');
    assert.equal(result.assignments[2].state, 'pending'); assert.equal(result.assignments[2].statusLabel, '1/2박 배정');
    record.booking.assign.lodges[1].day = 2;
    assert.equal(model(record).assignments[2].state, 'ready');
    record.booking.contract = { signedAt: '2026-10-19T00:00:00Z' };
    assert.equal(model(record).steps.find(step => step.id === 'contract').done, true);
});
test('고객 GET은 선택한 ID·관리자 헤더·최신 응답만 사용하고 다른 ID·실패·표본을 거절한다', async () => {
    const calls = [], controller = new AbortController();
    const record = await load('quote/a', 'verified-connection', controller.signal, async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, json: async () => ({ ok: true, item: { ...inquiry, id: 'quote/a' } }) }; });
    assert.equal(record.id, 'quote/a'); assert.equal(calls[0].url, '/api/requests/quote%2Fa');
    assert.equal(calls[0].options.headers['x-admin-token'], 'verified-connection'); assert.equal(calls[0].options.cache, 'no-store'); assert.equal(calls[0].options.signal, controller.signal);
    for (const payload of [{ ok: true, item: { id: 'someone-else' } }, { ok: true, items: [inquiry] }, { ok: false, item: inquiry }]) await assert.rejects(load(inquiry.id, 'verified-connection', undefined, async () => ({ ok: true, status: 200, json: async () => payload })));
    await assert.rejects(load(inquiry.id, 'verified-connection', undefined, async () => ({ ok: false, status: 404, json: async () => ({ ok: false }) })), /찾을 수 없습니다/);
});
test('견적·예약 목록은 고객 전용 페이지로 연결하고 기존 상세·편집 API는 유지한다', () => {
    const inbox = fs.readFileSync(new URL('../public/견적관리.html', import.meta.url), 'utf8');
    const bookings = fs.readFileSync(new URL('../public/예약목록.html', import.meta.url), 'utf8');
    const editor = fs.readFileSync(new URL('../public/예약관리.html', import.meta.url), 'utf8');
    assert.ok(inbox.includes('openCustomer(tr.dataset.id')); assert.ok(inbox.includes('function openRequestedInquiry()'));
    assert.ok(inbox.includes('InhasuQuoteInquiryWorkspace')); assert.ok(inbox.includes('memoLast[id] = m'));
    assert.ok(inbox.includes('detailId ? CFG.apiBase + "/" + encodeURIComponent(detailId)'));
    assert.ok(inbox.indexOf('  if (detailId) {\n    mode = "offline"') < inbox.indexOf('  if (IS_LOCAL) {'));
    assert.ok(bookings.includes('openCustomer(String(id), "/admin/quote-desk/bookings")'));
    assert.ok(editor.includes('const patch = { booking: BK }')); assert.ok(editor.includes('notifySaved(PRE.id)'));
    for (const html of [inbox, bookings, editor]) for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) if (match[1].trim()) assert.doesNotThrow(() => new vm.Script(match[1]));
});

test('문의 메모 이동 보호는 실제 저장을 한 번만 실행하고 실패한 입력·오류를 유지한다', async () => {
    const html = fs.readFileSync(new URL('../public/견적관리.html', import.meta.url), 'utf8');
    const memo = { value: '수정한 메모', disabled: false, dataset: {}, hasAttribute(name) { return name === 'data-inquiry-lock' && Object.hasOwn(this.dataset, 'inquiryLock'); } };
    const calls = [], pending = [];
    const window = { addEventListener() {} }; window.parent = window;
    const context = vm.createContext({ window, URLSearchParams, location: { search: '?id=local-inquiry', origin: 'http://localhost' },
        RECORDS: [{ id: 'local-inquiry', memo: '저장된 메모' }], toast() {},
        $: id => id === 'memo' ? memo : { querySelectorAll: () => [memo] },
        persistBody: (id, patch) => { calls.push({ id, patch }); return new Promise(resolve => pending.push(resolve)); } });
    vm.runInContext(html.slice(html.indexOf('let inquirySaving = '), html.indexOf('function openDrawer(id)')), context);
    vm.runInContext(html.slice(html.indexOf('async function persist(id, patch)'), html.indexOf('async function persistBody(id, patch)')), context);
    const start = html.indexOf('const memoLast = {}');
    vm.runInContext(html.slice(start, html.indexOf('/* ═══════════════ 문의 삭제', start)), context);
    const guard = window.InhasuQuoteInquiryWorkspace;
    assert.equal(guard.getState().dirty, true);
    assert.equal(guard.flushAll().busy, true); assert.equal(guard.flushAll().busy, true);
    assert.equal(calls.length, 1); assert.equal(memo.disabled, true);
    pending[0]({ ok: false, error: '로컬 검증 실패' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(memo.value, '수정한 메모'); assert.equal(memo.disabled, false);
    assert.equal(guard.getState().dirty, true); assert.match(guard.getState().error, /저장 실패/);
    const result = guard.flushAll(); assert.equal(result.busy, false); assert.equal(result.ok, false); assert.equal(calls.length, 1);
});
