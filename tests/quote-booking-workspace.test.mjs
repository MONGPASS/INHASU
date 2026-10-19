import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../public/quote-booking-workspace.js', import.meta.url), 'utf8'), context);
const workspace = context.QuoteBookingWorkspace;
const record = { id: 'local-booking', status: '진행중', adult: 2, decision: { status: 'accepted' } };
test('공통 단계는 계약서 발송과 고객 실제 서명을 구분하고 일정 공개도 따로 표시한다', () => {
    const booking = { days: [{ d: 1, dest: '첫날' }], contractInfo: { depositStatus: '입금완료' }, contractRequest: { status: 'requested' },
        checklist: { contract: true }, publishStatus: 'draft', travelers: [{ nameKo: '로컬 고객' }] };
    const state = workspace.snapshot(record, booking, { guideOk: true, vehicleOk: false, lodgeCount: 0, lodgeNeeded: 1 });
    assert.equal(state.accepted, true); assert.equal(state.deposit, true); assert.equal(state.signed, false);
    assert.equal(state.published, false); assert.equal(state.confirmed, false); assert.equal(state.travelerCount, 1); assert.equal(state.expectedTravelers, 2);
    assert.equal(workspace.snapshot(record, { ...booking, contract: { signedAt: '2026-10-20' } }, {}).signed, true);
});
test('취소 예약과 가이드·차량·숙소 상태를 원본에서 읽고 고객 개인정보는 메시지 payload에서 제외한다', () => {
    const state = workspace.snapshot({ ...record, status: '취소', name: 'PRIVATE', phone: 'PRIVATE', token: 'PRIVATE' },
        { days: [], travelers: [{ passportNo: 'PRIVATE' }] }, { guideOk: false, vehicleOk: false, lodgeNeeded: 0 });
    assert.equal(state.cancelled, true); assert.equal(state.schedule, false); assert.equal(state.guideReady, false);
    assert.ok(!JSON.stringify(state).includes('PRIVATE'));
});
test('공통 작업 탭은 기존 예약 폼의 실제 섹션에만 연결된다', () => {
    const calls = [];
    const doc = { getElementById(id) { return { scrollIntoView() { calls.push(id); }, focus() { calls.push('focus:' + id); } }; } };
    for (const section of ['docs', 'info', 'pay', 'assign', 'log']) assert.equal(workspace.navigate(section, doc), true);
    assert.deepEqual(calls, ['documentsSection', 'bookingInfoSection', 'paymentSection', 'focus:ci_depositStatus', 'assignmentSection', 'focus:g_pick', 'admin-booking-history']);
    assert.equal(workspace.navigate('customer-send', doc), false);
});
test('기존 예약 관리가 공유 일정 카드 위젯을 사용하고 원래 저장 API를 유지한다', () => {
    const html = fs.readFileSync(new URL('../public/예약관리.html', import.meta.url), 'utf8');
    assert.ok(html.includes('window.QuoteDayEditor.mount(host, options())'));
    assert.ok(html.includes('method: "PATCH"')); assert.ok(html.includes('const patch = { booking: BK }'));
    assert.ok(html.includes('day.stay = { ...(day.stay || {}), ...value }'));
    for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)) if (match[1].trim()) assert.doesNotThrow(() => new vm.Script(match[1]));
});

const bookingHtml = fs.readFileSync(new URL('../public/예약관리.html', import.meta.url), 'utf8');
const functionCode = (name, next) => bookingHtml.slice(bookingHtml.indexOf(`function ${name}(`), bookingHtml.indexOf(`function ${next}(`));
const control = (disabled = false) => ({ disabled, dataset: {}, hasAttribute(name) { return name === 'data-recovery-lock' && Object.hasOwn(this.dataset, 'recoveryLock'); } });
function lockHarness({ cancelled = false, boot = false } = {}) {
    const ordinary = control(), intrinsicallyDisabled = control(true), day = control(boot), dayBoundary = control(true);
    const controls = { ordinary, intrinsicallyDisabled, day, dayBoundary };
    const calls = [];
    const ctx = vm.createContext({ PRE: { status: cancelled ? '예약취소' : '진행중' }, BK: {}, controls, calls,
        document: { querySelectorAll() { return Object.values(controls); } }, updateActionBar() { calls.push('actions'); },
        quoteDayEditor: { update({ disabled }) { calls.push(disabled ? 'widget:locked' : 'widget:editable'); controls.day.disabled = !!disabled; controls.dayBoundary.disabled = true; } },
    });
    vm.runInContext(functionCode('bookingLock', 'bookingSnapshot'), ctx);
    return { controls, calls, ctx, lock: value => vm.runInContext(`bookingLock(${value})`, ctx) };
}

test('실제 bookingLock은 초기 잠금 상태를 캡처해도 위젯을 해제하고 원래 비활성 일반 필드는 보존한다', () => {
    const { controls, lock, calls } = lockHarness({ boot: true });
    lock(true); lock(true);
    assert.ok(Object.values(controls).every(el => el.disabled));
    lock(false);
    assert.equal(controls.ordinary.disabled, false);
    assert.equal(controls.intrinsicallyDisabled.disabled, true);
    assert.equal(controls.day.disabled, false, '부팅 때 disabled였던 일자 입력도 위젯의 최종 해제 상태를 따라야 한다');
    assert.equal(controls.dayBoundary.disabled, true);
    assert.ok(Object.values(controls).every(el => !el.hasAttribute('data-recovery-lock')));
    assert.deepEqual(calls, ['widget:locked','widget:locked','widget:editable','actions']);
    lock(true); lock(false); assert.equal(controls.day.disabled, false);
});

test('잠금 중 일자 카드가 재렌더되어 새 DOM이 생겨도 해제 후 편집할 수 있다', () => {
    const { controls, lock } = lockHarness();
    lock(true);
    controls.day = control(true); controls.dayBoundary = control(true);
    // render/bindEvents may reapply the same busy lock to these fresh controls.
    lock(true); lock(false);
    assert.equal(controls.day.disabled, false);
    assert.equal(controls.dayBoundary.disabled, true);
    assert.equal(controls.ordinary.disabled, false);
    assert.ok(Object.values(controls).every(el => !el.hasAttribute('data-recovery-lock')));
});

test('취소 예약의 위젯은 복구 잠금 해제 후에도 잠겨 있고 취소 해제 후에는 다시 편집할 수 있다', () => {
    const { controls, lock, ctx } = lockHarness({ cancelled: true });
    lock(true); lock(false); assert.equal(controls.day.disabled, true);
    controls.day = control(true); lock(false); assert.equal(controls.day.disabled, true);
    ctx.PRE.status = '진행중'; lock(false); assert.equal(controls.day.disabled, false);
    assert.equal(controls.intrinsicallyDisabled.disabled, true);
});

function statsFor(period, days, lodges = []) {
    const ctx = vm.createContext({ PRE: { status:'예약확정', ...period }, BK: { days, assign: { guide:{name:'가이드'}, vehicle:{model:'차량'}, lodges }, contract:{signedAt:'fixture'}, contractInfo:{depositStatus:'입금완료'} } });
    vm.runInContext(functionCode('assignStats', 'workflowUi'), ctx);
    return vm.runInContext('assignStats()', ctx);
}

test('실제 assignStats는 작성 카드가 한 개여도 유효한 여행 기간의 숙박 일수를 우선한다', () => {
    const period = { depart:'2026-10-20', return_:'2026-10-22' };
    for (const days of [[{d:1}], [{d:1,stay:{name:'작성한 숙소'}}], []]) {
        const stats = statsFor(period, days);
        assert.equal(stats.lodgeNeeded, 2); assert.ok(stats.missing.includes('숙소 2일 미배정'));
    }
    const one = statsFor(period,[{d:1}],[{day:1,name:'배정 숙소'}]);
    assert.equal(one.lodgeNeeded,2);assert.equal(one.lodgeCount,1);assert.ok(one.missing.includes('숙소 1일 미배정'));
    assert.equal(statsFor({depart:'2026-10-20',return_:'2026-10-20'},[{d:1},{d:2},{d:3}]).lodgeNeeded,0);
    assert.equal(statsFor({depart:'2028-02-28',return_:'2028-03-01'},[{d:1}]).lodgeNeeded,2);
});

test('여행 기간이 없거나 잘못됐으면 일정 카드 수로만 숙박 일수를 계산한다', () => {
    for (const period of [{}, {depart:'2026-10-20'}, {depart:'2026-10-22',return_:'2026-10-20'}, {depart:'2026-02-30',return_:'2026-03-02'}, {depart:'invalid',return_:'2026-10-22'}]) {
        assert.equal(statsFor(period,[{d:1},{d:2},{d:3}]).lodgeNeeded,2);
    }
    assert.equal(statsFor({},[]).lodgeNeeded,0);
    assert.equal(statsFor({},[{d:1}]).lodgeNeeded,0);
});
