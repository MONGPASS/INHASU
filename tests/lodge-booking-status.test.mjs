import test from 'node:test';
import assert from 'node:assert/strict';
import { LODGE_BOOKING_STATUSES, LODGE_BOOKING_UNSENT, isLodgeBookingConfirmed, lodgeBookingLabel } from '../src/utils/lodgeBookingStatus.ts';
import { getAccommodationPlan } from '../src/utils/accommodationSchedule.ts';

test('숙소 예약 상태 선택지는 기존 네 상태(몽골어 저장 값)를 유지하고 새 상태를 추가한다', () => {
    assert.deepEqual(LODGE_BOOKING_STATUSES.map(s => s.label), ['미발송', '예약요청', '메일 발송', '회신 받음', '예약완료', '확정', '취소요청', '취소완료', '변경요청', '변경완료', '배정X']);
    for (const [value, label] of [['Илгээгээгүй', '미발송'], ['Имэйл илгээсэн', '메일 발송'], ['Хариу ирсэн', '회신 받음'], ['Баталгаажсан', '확정']]) {
        assert.equal(lodgeBookingLabel(value), label, '이미 저장된 몽골어 값은 그대로 읽는다');
    }
    assert.equal(LODGE_BOOKING_UNSENT, 'Илгээгээгүй');
    assert.equal(new Set(LODGE_BOOKING_STATUSES.map(s => s.value)).size, LODGE_BOOKING_STATUSES.length, '중복 없음');
    assert.equal(lodgeBookingLabel('예전 상태'), '예전 상태', '목록에 없는 값은 그대로 보여 준다');
    assert.equal(lodgeBookingLabel(undefined), '');
});

test('확정·예약완료·변경완료만 숙소 배정 완료로 집계한다', () => {
    for (const value of ['Баталгаажсан', '예약완료', '변경완료']) assert.equal(isLodgeBookingConfirmed(value), true, value);
    for (const value of ['Илгээгээгүй', '예약요청', 'Имэйл илгээсэн', 'Хариу ирсэн', '취소요청', '취소완료', '변경요청', '배정X', '', undefined]) assert.equal(isLodgeBookingConfirmed(value), false, String(value));

    const booking = status => ({ startDate: '2026-10-20', endDate: '2026-10-22',
        schedule: { source: 'customer', warnings: [], days: [
            { day: 1, date: '2026-10-20', title: '테를지', region: '중앙몽골' },
            { day: 2, date: '2026-10-21', title: '고비', region: '고비사막' },
            { day: 3, date: '2026-10-22', title: '귀국', region: '울란바타르' }] },
        dailyAccommodations: [
            { day: 1, date: '2026-10-20', accommodation: { name: '숙소 1', bookingStatus: '예약완료' } },
            { day: 2, date: '2026-10-21', accommodation: { name: '숙소 2', bookingStatus: status } }] });
    const done = getAccommodationPlan(booking('변경완료'));
    assert.equal(done.confirmed, 2); assert.deepEqual(done.nightStates, ['confirmed', 'confirmed']);
    const pending = getAccommodationPlan(booking('취소요청'));
    assert.equal(pending.confirmed, 1); assert.deepEqual(pending.nightStates, ['confirmed', 'assigned']); assert.equal(pending.complete, false);
});
