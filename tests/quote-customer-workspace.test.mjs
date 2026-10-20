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

test('수동·자동 카카오 원장 접수는 과거 activity 없이도 견적 전달에 반영하고 failed·unknown은 고객 수락 대기로 바꾸지 않는다',()=>{
    const record={...inquiry,quote:{days:[]}},receipt={id:'notice',kind:'quote',channel:'kakao',state:'accepted',at:'2026-10-20T01:00:00Z'};
    const sent=model(record,{deliveryHistory:[receipt]});assert.equal(sent.steps.find(step=>step.id==='sent').done,true);assert.equal(sent.tasks[0].waiting,true);assert.equal(sent.documents[0].status,'안내 서비스 접수');
    for(const state of ['failed','unknown','sending']){
        const result=model({...record,activities:[{type:'quote_notification_queued'}]},{deliveryHistory:[{...receipt,state,error:'실제 발송 결과'}]});
        assert.equal(result.steps.find(step=>step.id==='sent').done,false);assert.equal(result.tasks[0].action,'history');assert.equal(result.tasks[0].waiting,undefined);assert.equal(result.tasks[0].detail,'실제 발송 결과');
    }
});

test('계약 알림 실패는 요청 플래그가 있어도 고객 서명·입력 대기로 추정하지 않고 접수 후에만 대기로 구분한다',()=>{
    const record={...inquiry,status:'예약확정',booking:{contractInfo:{depositStatus:'입금완료'},contractRequest:{status:'requested'},travelers:[]}};
    const receipt={id:'notice',kind:'contract',channel:'kakao',state:'failed',at:'2026-10-20T01:00:00Z'};
    const failed=model(record,{deliveryHistory:[receipt]});assert.equal(failed.tasks.find(task=>task.id==='contract-delivery').action,'history');
    assert.equal(failed.tasks.some(task=>task.id==='contract'),false);assert.equal(failed.tasks.find(task=>task.id==='travelers').waiting,undefined);
    const accepted=model(record,{deliveryHistory:[{...receipt,state:'accepted'}]});
    for(const id of ['contract','travelers','flights'])assert.equal(accepted.tasks.find(task=>task.id===id).waiting,true,id);
    const submitted=model({...record,booking:{...record.booking,travelerSubmission:{status:'submitted',submittedAt:'2026-10-20T02:00:00Z'}}},{deliveryHistory:[{...receipt,state:'accepted'}]});
    assert.equal(submitted.tasks.find(task=>task.id==='travelers').waiting,undefined);
});

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
    const queued=model({ ...record, activities: [{ type: 'quote_notification_queued' }] });
    assert.equal(queued.documents[0].status, '발송 요청 · 결과 확인 필요');assert.equal(queued.steps.find(step=>step.id==='sent').done,false);
    assert.equal(queued.tasks[0].action,'history');assert.equal(queued.tasks[0].waiting,undefined);
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

test('견적 예약의 항공·여행자·서명 정보는 실제 저장 필드에서만 투영한다', () => {
    const record = { ...inquiry, depart: '2026-10-20', return_: '2026-10-22', booking: {
        flight: { inDate: '2026-10-19', inDepTime: '20:30', inTime: '23:10', inNo: 'OM310', outDate: '2026-10-23', outTime: '01:20', outArrTime: '05:30', outNo: 'OM309' },
        travelers: [{ type: '성인', nameKo: '실제 여행자', passportName: 'ACTUAL PERSON', birth: '1990-01-02', gender: '여', phone: '01012345678', passportNo: 'M12345678' }],
        travelerSubmission: { status: 'submitted', submittedAt: '2026-10-19T04:00:00Z', submittedCount: 2 }, pickupLodge: '실제 픽업 호텔', travelerNote: '식이 제한 있음',
        contract: { signedAt: '2026-10-19T04:10:00Z', signImg: 'PRIVATE-SIGNATURE' }, checklist: { contract: true },
    } };
    const before = JSON.stringify(record), result = model(record);
    assert.equal(result.flights[0].date, '2026-10-19'); assert.equal(result.flights[0].time, '23:10');
    assert.equal(result.flights[0].flight, 'OM310'); assert.equal(result.flights[0].extra[0].value, '20:30');
    assert.equal(result.flights[1].date, '2026-10-23'); assert.equal(result.flights[1].time, '01:20'); assert.equal(result.flights[1].extra[0].value, '05:30');
    assert.equal(result.travelers.expected, 2); assert.equal(result.travelers.registered, 1);
    assert.equal(result.travelers.people[0].name, '실제 여행자');
    assert.equal(result.travelers.people[0].details.find(row => row.label === '여권 영문명').value, 'ACTUAL PERSON');
    assert.equal(result.travelers.people[0].details.find(row => row.label === '여권번호').value, 'M12345678');
    assert.match(result.tasks.find(task => task.id === 'travelers').detail, /1명 미등록/);
    assert.match(result.travelers.status, /고객 제출 기록/);
    assert.equal(result.agreement.at, record.booking.contract.signedAt);
    assert.equal(result.facts.find(row => row.label === '픽업·샌딩 숙소').value, '실제 픽업 호텔');
    assert.equal(result.facts.find(row => row.label === '여행자 특이사항').value, '식이 제한 있음');
    assert.ok(!JSON.stringify(result).includes('PRIVATE-SIGNATURE')); assert.equal(JSON.stringify(record), before);
    const empty = model({ ...record, booking: { days: [], travelers: [], checklist: { contract: true } } });
    assert.equal(empty.flights[0].date, ''); assert.equal(empty.flights[1].date, '');
    assert.equal(empty.travelers.registered, 0); assert.equal(empty.travelers.people.length, 0); assert.equal(empty.agreement.at, undefined);
    assert.match(empty.agreement.label, /미요청/); assert.match(empty.tasks.find(task => task.id === 'flights').detail, /도착편명/);
});

test('시간별 일정·이동·식사·실제 배정 숙소를 표시하고 귀국일 숙박은 요구하지 않는다', () => {
    const result = model({ ...inquiry, depart: '2026-10-20', return_: '2026-10-21', booking: {
        days: [{ dest: '테를지', regions: ['중앙몽골'], move: '2시간', dist: '80', items: ['09:30 공항 픽업', '거북바위 방문'], stay: { name: '계획 숙소' }, meals: ['조식', '중식', '석식'] },
            { dest: '울란바토르', items: [], activities: [{ title: '삭제한 관광지' }], stay: { name: '' }, meals: [] }],
        assign: { lodges: [{ day: 1, name: '확정 호텔' }] },
    } });
    const first = result.days[0];
    assert.equal(first.activities[0].time, '09:30'); assert.equal(first.activities[0].title, '공항 픽업');
    assert.equal(first.activities[1].title, '거북바위 방문'); assert.equal(first.region, '중앙몽골');
    assert.equal(first.travel, '2시간 · 80km'); assert.equal(first.meals, '조식 · 중식 · 석식');
    assert.equal(first.stay, '확정 호텔'); assert.equal(first.stayAssigned, true); assert.equal(first.stayRequired, true);
    assert.equal(result.days[1].summary, ''); assert.equal(result.days[1].activities.length, 0); assert.equal(result.days[1].stayRequired, false);
    assert.equal(result.tasks.some(task => task.id === 'stay'), false);
    assert.equal(model({ ...inquiry, depart: '2026-10-20', return_: '2026-10-20', booking: { days: [{ dest: '시내 투어' }] } }).days[0].stayRequired, false);
});

test('남은 업무는 실제 입금 신고·서명 요청·일정 부족·배정 누락을 설명하고 검토 화면만 연다', () => {
    const record = { ...inquiry, status: '예약확정', depart: '2026-10-20', return_: '2026-10-22', booking: {
        days: [{ dest: '첫날' }], contractInfo: { totalAmount: 3000000, depositAmount: 900000, depositStatus: '미입금', balanceAmount: 2100000, balanceStatus: '미수령' },
        depositReport: { status: 'reported', name: '입금 신고자' }, contractRequest: { status: 'requested', requestedAt: '2026-10-19T05:00:00Z' },
        travelers: [{ nameKo: '이름만 입력' }], assign: { lodges: [{ day: 1, name: '호텔' }] },
    } };
    const result = model(record), tasks = result.tasks;
    assert.match(tasks.find(task => task.id === 'deposit').label, /입금 신고/); assert.match(tasks.find(task => task.id === 'deposit').detail, /900,000원.*입금 신고자/);
    const contract = tasks.find(task => task.id === 'contract');
    assert.equal(contract.waiting, true); assert.match(contract.label, /서명 확인/); assert.match(contract.detail, /고객 서명 기록이 없습니다/);
    assert.match(tasks.find(task => task.id === 'travelers').detail, /1명 미등록.*1명 필수 정보 누락/);
    assert.match(tasks.find(task => task.id === 'schedule').detail, /여행 3일 · 저장된 일정 1일/);
    assert.match(tasks.find(task => task.id === 'stay').detail, /1\/2박 배정 · 1박 미배정/);
    assert.equal(tasks.find(task => task.id === 'published').action, 'documents');
    assert.match(tasks.find(task => task.id === 'balance-review').detail, /2,100,000원.*미수령/);
    assert.ok(tasks.every(task => task.actionLabel && task.detail));
    assert.equal(result.steps.find(step => step.id === 'published').done, false);
    assert.equal(result.steps.find(step => step.id === 'schedule').done, false);
    record.booking.contractInfo.depositStatus = '입금완료'; record.booking.contract = { signedAt: '2026-10-19' };
    const paid = model(record); assert.equal(paid.tasks.some(task => ['deposit', 'contract'].includes(task.id)), false);
});

test('금액 0원·빈 결제 상태·취소 진행·희망 기간은 완료로 추정하지 않는다', () => {
    const record = { ...inquiry, booking: { contractInfo: { totalAmount: 0, depositAmount: 0, balanceAmount: 0 }, travelers: [] } };
    const result = model(record);
    assert.equal(result.payment.total, 0); assert.equal(result.payment.depositPaid, null); assert.equal(result.payment.balancePaid, null);
    assert.equal(result.steps.find(step => step.id === 'deposit').done, false); assert.match(result.tasks.find(task => task.id === 'deposit').detail, /0원.*기록 없음/);
    assert.equal(result.tasks.some(task => task.id === 'period'), true);
    assert.equal(model({ ...record, progress: '예약취소' }).tasks.length, 0);
    assert.equal(model({ ...record, progress: '예약취소' }).canSendItinerary, false);
    assert.equal(model({ ...record, booking: { contractInfo: { balanceStatus: '현지현금전달' } } }).payment.balancePaid, true);
    assert.equal(model({ ...record, booking: { contractInfo: { balanceStatus: '알 수 없는 상태' } } }).payment.balancePaid, null);
    const unknownParty = model({ id: 'no-requested-party', booking: { travelers: [{ nameKo: '이름' }] } });
    assert.equal(unknownParty.travelers.expected, null); assert.match(unknownParty.tasks.find(task => task.id === 'travelers').detail, /1\/미정명 등록/);
});

test('발권 확인 체크만으로 누락된 항공편 정보를 완료 처리하지 않고 숫자 이동 거리를 보존한다', () => {
    const record = { ...inquiry, booking: { checklist: { flight: true }, flight: { inDate: '2026-10-20', outDate: '2026-10-22' },
        days: [{ dest: '시내', move: '도보', dist: 0 }, { dest: '테를지', dist: 85 }, { dest: '귀국', dist: Number.NaN }] } };
    const result = model(record), flightTask = result.tasks.find(task => task.id === 'flights');
    assert.ok(flightTask); assert.match(flightTask.detail, /도착시간 · 도착편명 · 출발시간 · 출발편명 미입력/);
    assert.equal(result.days[0].travel, '도보 · 0km'); assert.equal(result.days[1].travel, '85km'); assert.equal(result.days[2].travel, '');
    record.booking.days[1].dist = '120km'; assert.equal(model(record).days[1].travel, '120km');
    record.booking.flight = { ...record.booking.flight, inTime: '08:20', inNo: 'OM310', outTime: '12:30', outNo: 'OM309' };
    assert.equal(model(record).tasks.some(task => task.id === 'flights'), false);
});

test('미예약 문의에는 예약 배정·항공·여행자·잔금 업무를 만들지 않고 실제 견적 단계를 안내한다', () => {
    const stages = [model(inquiry), model({ ...inquiry, quote: { days: [] } }),
        model({ ...inquiry, quote: { days: [] }, activities: [{ type: 'quote_notification_queued' }] }),
        model({ ...inquiry, quote: { days: [] }, activities: [{ type: 'quote_sent' }], decision: { status: 'accepted' } })];
    assert.equal(stages[0].tasks[0].action, 'edit-itinerary'); assert.match(stages[0].tasks[0].label, /견적서 작성/);
    assert.equal(stages[1].tasks[0].action, 'quote-share'); assert.match(stages[1].tasks[0].detail, /발송 접수 기록이 없습니다/);
    assert.equal(stages[2].tasks[0].waiting, undefined); assert.match(stages[2].tasks[0].label, /발송 결과/);
    assert.equal(stages[3].tasks[0].id, 'prepare');
    for (const result of stages) {
        assert.equal(result.flights, undefined); assert.equal(result.travelers, undefined); assert.equal(result.agreement, undefined);
        assert.ok(result.tasks.every(task => !['deposit', 'balance-review', 'guide', 'vehicle', 'stay', 'flights', 'travelers', 'published'].includes(task.id)));
    }
});
test('고객 GET은 선택한 ID·관리자 헤더·최신 응답만 사용하고 다른 ID·실패·표본을 거절한다', async () => {
    const calls = [], controller = new AbortController();
    const record = await load('quote/a', 'verified-connection', controller.signal, async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, json: async () => ({ ok: true, item: { ...inquiry, id: 'quote/a' } }) }; });
    assert.equal(record.id, 'quote/a'); assert.equal(calls[0].url, '/api/requests/quote%2Fa');
    assert.equal(calls[0].options.headers['x-admin-token'], 'verified-connection'); assert.equal(calls[0].options.cache, 'no-store'); assert.equal(calls[0].options.signal, controller.signal);
    for (const payload of [{ ok: true, item: { id: 'someone-else' } }, { ok: true, items: [inquiry] }, { ok: false, item: inquiry }]) await assert.rejects(load(inquiry.id, 'verified-connection', undefined, async () => ({ ok: true, status: 200, json: async () => payload })));
    await assert.rejects(load(inquiry.id, 'verified-connection', undefined, async () => ({ ok: false, status: 404, json: async () => ({ ok: false }) })), /찾을 수 없습니다/);
    for (const status of [401, 403]) await assert.rejects(load(inquiry.id, 'verified-connection', undefined, async () => ({ ok: false, status, json: async () => ({ ok: false }) })), error => error.status === status && /관리자 인증/.test(error.message));
    await assert.rejects(load(inquiry.id, 'verified-connection', undefined, async () => ({ ok: true, status: 200, json: async () => ({ ok: true, item: { id: 'another-customer' } }) })), error => error.status === 404);
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
