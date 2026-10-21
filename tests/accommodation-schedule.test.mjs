import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccommodationPlan, initialAccommodationRows, addMissingAccommodationNights, alignAccommodationDates } from '../src/utils/accommodationSchedule.ts';

const schedule = (days, source = 'customer') => ({ source, days, warnings: [] });
const tour = (patch = {}) => ({ startDate: '2026-10-20', endDate: '2026-10-22', schedule: schedule([
    { day: 1, date: '2026-10-20', title: '테를지 도착', region: '중앙몽골', summary: '공항 픽업 후 초원 산책' },
    { day: 2, date: '2026-10-21', title: '고비 이동', region: '고비사막', summary: '사막 투어' },
    { day: 3, date: '2026-10-22', title: '귀국', region: '울란바타르', summary: '공항 이동' },
]), ...patch });
const stay = (day, date, accommodation = {}) => ({ day, date, accommodation: { name: `배정 숙소 ${day}`, bookingStatus: 'Баталгаажсан', ...accommodation } });

test('초기 배정은 고객 일정의 일차별 지역과 귀국일을 제외한 숙박 날짜를 사용한다', () => {
    const booking = tour(), plan = getAccommodationPlan(booking);
    assert.equal(plan.needed, 2);
    assert.deepEqual(plan.nights.map(night => [night.day, night.date, night.region, night.title]), [
        [1, '2026-10-20', '중앙몽골', '테를지 도착'], [2, '2026-10-21', '고비사막', '고비 이동'],
    ]);
    assert.deepEqual(initialAccommodationRows(booking), [
        { day: 1, date: '2026-10-20', accommodation: { location: '중앙몽골', region: '중앙몽골' } },
        { day: 2, date: '2026-10-21', accommodation: { location: '고비사막', region: '고비사막' } },
    ]);
    assert.equal(plan.complete, false);
    assert.equal(Object.hasOwn(booking, 'dailyAccommodations'), false, '조회·진단은 저장 원본을 바꾸지 않는다');
});

test('명시적으로 비운 고객 일정과 숙소는 자동 부활하지 않고 명시 추가에서만 날짜 행을 만든다', () => {
    const booking = tour({ schedule: schedule([]), dailyAccommodations: [] });
    const before = structuredClone(booking), plan = getAccommodationPlan(booking);
    assert.deepEqual(initialAccommodationRows(booking), []);
    assert.equal(plan.needed, 2); assert.equal(plan.missingNights.length, 2);
    assert.match(plan.warnings.join(' '), /상세 일정이 없어/);
    assert.deepEqual(addMissingAccommodationNights(booking), [
        { day: 1, date: '2026-10-20', accommodation: {} }, { day: 2, date: '2026-10-21', accommodation: {} },
    ]);
    assert.deepEqual(booking, before);
});

test('2박 중 1박만 확정돼도 완료로 보이지 않으며 누락 추가는 기존 수배값과 순서를 보존한다', () => {
    const existing = stay(2, '2026-10-21', { id: 'saved', roomCount: 0, occupancy: '수동 인실', images: [], supplierNote: '원본 보존' });
    const booking = tour({ dailyAccommodations: [existing] }), plan = getAccommodationPlan(booking);
    assert.equal(plan.complete, false); assert.equal(plan.confirmed, 1); assert.equal(plan.needed, 2);
    const next = addMissingAccommodationNights(booking);
    assert.equal(next[0], existing); assert.equal(next[1].day, 1); assert.equal(next[1].date, '2026-10-20');
    assert.equal(next[0].accommodation.roomCount, 0); assert.equal(next[0].accommodation.supplierNote, '원본 보존');
    assert.equal(booking.dailyAccommodations.length, 1);
    assert.equal(getAccommodationPlan(tour({ dailyAccommodations: [stay(1, '2026-10-20'), existing] })).complete, true);
});

test('여행 기간 변경은 기존 날짜를 보존해 경고하고 명시 조정에서만 바뀐 날짜의 확정 상태를 초기화한다', () => {
    const old = stay(1, '2026-10-19', { roomCount: 2, occupancy: '2인실', images: ['/saved.webp'] });
    const unchanged = stay(2, '2026-10-21');
    const booking = tour({ dailyAccommodations: [old, unchanged] }), before = structuredClone(booking), plan = getAccommodationPlan(booking);
    assert.equal(plan.canAlignDates, true); assert.equal(plan.complete, false);
    assert.match(plan.rowWarnings[0].join(' '), /고객 일정은 2026-10-20/);
    assert.equal(plan.rows[0].date, '2026-10-19');
    const next = alignAccommodationDates(booking);
    assert.equal(next[0].day, 1); assert.equal(next[0].date, '2026-10-20');
    assert.deepEqual(next[0].accommodation, { ...old.accommodation, bookingStatus: 'Илгээгээгүй' });
    assert.equal(next[1], unchanged);
    assert.deepEqual(booking, before);
});

test('비연속 일차의 빈 날짜는 배열 순서 대신 실제 일차 기준으로 채우며 기존 확정 수배는 유지한다', () => {
    const booking = tour({ startDate: '2026-12-30', endDate: '2027-01-03', schedule: schedule([]),
        dailyAccommodations: [stay(3, ''), stay(1, '2026-12-30')] });
    const rows = initialAccommodationRows(booking);
    assert.equal(rows[0].day, 3); assert.equal(rows[0].date, '2027-01-01');
    assert.equal(rows[0].accommodation.bookingStatus, 'Баталгаажсан');
    assert.equal(rows[1], booking.dailyAccommodations[1]);
});

test('중복 일차·중복 날짜·귀국일 배정은 완료가 아니며 자동 재번호나 삭제를 하지 않는다', () => {
    const rows = [stay(1, '2026-10-20'), stay(1, '2026-10-20'), stay(3, '2026-10-22')];
    const booking = tour({ dailyAccommodations: rows }), before = structuredClone(rows), plan = getAccommodationPlan(booking);
    assert.equal(plan.complete, false); assert.equal(plan.confirmed, 0);
    assert.match(plan.warnings.join(' '), /중복/); assert.match(plan.warnings.join(' '), /숙박 범위 밖/);
    const aligned = alignAccommodationDates(booking);
    assert.deepEqual(aligned, before); assert.deepEqual(booking.dailyAccommodations, before);
    assert.equal(addMissingAccommodationNights(booking).length, 4);
});

test('고객이 지정한 유효한 수동 날짜는 일정표 날짜로 사용하고 충돌 날짜는 추정해서 수정하지 않는다', () => {
    const booking = tour({ startDate: '2026-10-20', endDate: '2026-10-24', schedule: schedule([
        { day: 1, date: '2026-10-21', title: '수동 날짜', region: '새 지역', summary: '' },
        { day: 2, date: '2026-10-20', title: '', region: '', summary: '' },
        { day: 3, date: '2026-10-22', title: '', region: '', summary: '' },
        { day: 4, date: '2026-10-23', title: '', region: '', summary: '' },
        { day: 5, date: '2026-10-24', title: '귀국', region: '', summary: '' },
    ]) });
    assert.equal(getAccommodationPlan(booking).nights[0].date, '2026-10-21');
    const bad = tour({ schedule: schedule([
        { day: 1, date: '2026-10-22', title: '귀국일 숙박 오류', region: '', summary: '' },
        { day: 2, date: '2026-10-21', title: '', region: '', summary: '' },
    ]), dailyAccommodations: [stay(1, '2026-10-19')] });
    assert.equal(getAccommodationPlan(bad).nights[0].usable, false);
    assert.match(getAccommodationPlan(bad).warnings.join(' '), /여행 기간 밖/);
    assert.equal(alignAccommodationDates(bad)[0].date, '2026-10-19');
    const duplicated = tour({ schedule: schedule([1, 2].map(day => ({ day, date: '2026-10-20', title: '', region: '', summary: '' }))), dailyAccommodations: [] });
    assert.equal(getAccommodationPlan(duplicated).addableNights.length, 0);
});

test('서울 자정 ISO·윤년·당일 여행·잘못된 날짜와 일정 조회 실패를 구분한다', () => {
    const iso = tour({ startDate: '2026-10-19T15:00:00.000Z', endDate: '2026-10-21T15:00:00.000Z' });
    assert.equal(getAccommodationPlan(iso).nights[0].date, '2026-10-20');
    const leap = { startDate: '2028-02-28', endDate: '2028-03-01' };
    assert.deepEqual(getAccommodationPlan(leap).nights.map(night => night.date), ['2028-02-28', '2028-02-29']);
    const dayTrip = tour({ endDate: '2026-10-20', schedule: schedule([]), dailyAccommodations: [] });
    assert.equal(getAccommodationPlan(dayTrip).needed, 0); assert.equal(getAccommodationPlan(dayTrip).complete, true);
    for (const dates of [{ startDate: '2026-02-30' }, { endDate: '' }, { endDate: '2026-10-19' }]) {
        const booking = tour(dates); assert.equal(getAccommodationPlan(booking).needed, null); assert.deepEqual(addMissingAccommodationNights(booking), []);
    }
    const unavailable = tour({ schedule: { source: 'unavailable', days: [], warnings: ['조회 실패'] }, dailyAccommodations: [stay(1, '2026-10-20')] });
    assert.equal(getAccommodationPlan(unavailable).complete, false); assert.deepEqual(addMissingAccommodationNights(unavailable), unavailable.dailyAccommodations);
});

test('비워 둔 수동 일정 날짜는 추정하지 않고 기존 숙박이 차지한 날짜로 새 충돌을 만들지 않는다', () => {
    const blank = tour({ schedule: schedule([{ day: 1, date: '', title: '수동 날짜 확인 필요', region: '', summary: '' }]), dailyAccommodations: [] });
    const blankPlan = getAccommodationPlan(blank);
    assert.equal(blankPlan.nights[0].usable, false);
    assert.deepEqual(blankPlan.addableNights.map(night => night.day), [2]);
    const blocked = tour({ dailyAccommodations: [stay(1, '2026-10-19'), stay(3, '2026-10-20')] });
    assert.equal(getAccommodationPlan(blocked).canAlignDates, false);
    assert.deepEqual(alignAccommodationDates(blocked), blocked.dailyAccommodations);
    const swapped = tour({ dailyAccommodations: [stay(1, '2026-10-21'), stay(2, '2026-10-20')] });
    assert.deepEqual(alignAccommodationDates(swapped).map(row => row.date), ['2026-10-20', '2026-10-21']);
    assert.ok(alignAccommodationDates(swapped).every(row => row.accommodation.bookingStatus === 'Илгээгээгүй'));
});
