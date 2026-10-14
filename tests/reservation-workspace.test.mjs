import test from 'node:test';
import assert from 'node:assert/strict';
import { reservationWorkspaceStatus } from '../src/utils/reservationWorkspace.ts';

const fixture = (patch = {}) => ({
    status: 'confirmed', depositStatus: 'paid', totalPeople: 2,
    startDate: '2026-10-20', endDate: '2026-10-22',
    days: [
        { day: 1, title: '테를지 도착', accommodation: { name: '게르' } },
        { day: 2, title: '초원 여행', accommodation: { name: '게르' } },
        { day: 3, title: '공항 이동' },
    ], ...patch,
});

test('메일 요청과 달리 계약 완료는 고객의 실제 동의가 있어야 한다', () => {
    assert.equal(reservationWorkspaceStatus(fixture({ agreement: { agreed: false } })).signed, false);
    assert.equal(reservationWorkspaceStatus(fixture({ agreement: { agreed: true } })).signed, true);
});
test('공개 링크가 있어도 취소·입금 대기·빈 일정이면 공개 완료로 표시하지 않는다', () => {
    assert.equal(reservationWorkspaceStatus(fixture({ itineraryUrl: '/documents/itinerary/fixture' })).published, true);
    for (const patch of [{ status: 'cancelled' }, { status: 'pending_payment' }, { days: [] }]) {
        assert.equal(reservationWorkspaceStatus(fixture({ itineraryUrl: '/documents/itinerary/fixture', ...patch })).published, false);
    }
});
test('귀국일 숙소와 중복 배정은 필요한 숙박 수에 더하지 않는다', () => {
    const state = reservationWorkspaceStatus(fixture({ dailyAccommodations: [
        { day: 1, accommodation: { name: '호텔' } }, { day: 3, accommodation: { name: '마지막날 호텔' } },
    ] }));
    assert.equal(state.nights, 2); assert.equal(state.stayCount, 2); assert.equal(state.accommodationsReady, true);
});
test('빠진 숙박일과 미입력 여행자를 준비 완료로 표시하지 않는다', () => {
    const state = reservationWorkspaceStatus(fixture({ days: [{ day: 1, title: '도착', accommodation: { name: '게르' } }], travelers: [{ name: '김여행' }, { name: ' ' }] }));
    assert.equal(state.accommodationsReady, false); assert.equal(state.travelerCount, 1); assert.equal(state.travelersReady, false);
});
test('사진형 일정은 준비된 일정이고 빈 DAY만 있는 문서는 작성 필요다', () => {
    assert.equal(reservationWorkspaceStatus(fixture({ days: [{ day: 1, activities: [{ images: ['/photo.webp'] }] }] })).scheduleReady, true);
    assert.equal(reservationWorkspaceStatus(fixture({ days: [{ day: 1, activities: [] }] })).scheduleReady, false);
});
test('당일 투어는 숙소 배정 없이 숙박 준비가 완료된다', () => {
    const state = reservationWorkspaceStatus(fixture({ endDate: '2026-10-20', days: [{ day: 1, title: '시내 관광' }] }));
    assert.equal(state.nights, 0); assert.equal(state.accommodationsReady, true);
});
