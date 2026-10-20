import test from 'node:test';
import assert from 'node:assert/strict';
import {
    lodgingPeriod, lodgingSlots, lodgingSummary, materializeLodgingDays,
    isCancelledLodgingBooking, isConfirmedLodgingBooking, resetLodgingConfirmation, lodgingSupplierGroups, lodgingMonthCounts, LODGING_UNSENT,
} from '../src/utils/lodgingOperations.ts';

const stay = (day, name = '숙소', extra = {}) => ({ day, accommodation: { name, bookingStatus: 'Баталгаажсан', ...extra } });
const booking = (extra = {}) => ({ source: 'product', startDate: '2026-10-20', endDate: '2026-10-22', status: 'confirmed', ...extra });

test('두 박 중 한 박만 저장된 예약은 1/2 배정·확정이며 누락 밤을 별도 표시한다', () => {
    const summary = lodgingSummary(booking({ dailyAccommodations: [stay(1)] }));
    assert.deepEqual([summary.expected, summary.assigned, summary.confirmed, summary.missing, summary.allConfirmed], [2, 1, 1, 1, false]);
    assert.deepEqual(summary.slots.map(slot => [slot.day, slot.date, slot.rowIndex]), [[1, '2026-10-20', 0], [2, '2026-10-21', null]]);
    assert.equal(lodgingSummary(booking({ dailyAccommodations: [stay(1), stay(2)] })).allConfirmed, true);
});

test('중복·귀국일·빈 숙소의 확정 문자열로 수배 완료를 만들지 않는다', () => {
    const summary = lodgingSummary(booking({ dailyAccommodations: [stay(1, 'A'), stay(1, 'B'), stay(2, ''), stay(3, '귀국일')] }));
    assert.deepEqual([summary.assigned, summary.confirmed, summary.allConfirmed], [1, 0, false]);
    assert.deepEqual(summary.slots[0].rowIndices, [0, 1]); assert.equal(summary.slots[0].conflict, true);
    assert.equal(summary.slots[0].accommodation.name, 'B');
    assert.deepEqual(summary.issues, ['out_of_range:3', 'duplicate_identifier:1', 'duplicate_day:1']);
    const extras = lodgingSummary(booking({ dailyAccommodations: [stay(1), stay(2), stay(3)] }));
    assert.equal(extras.confirmed, 2); assert.equal(extras.allConfirmed, false);
    assert.equal(lodgingSummary(booking({ dailyAccommodations: [stay(1, '취소 숙소', { bookingStatus: 'cancelled' })] })).assigned, 0);
});

test('날짜를 우선 매핑하고 잘못된 명시 날짜는 일차로 보여 주되 확정으로 세지 않는다', () => {
    const rows = [
        { ...stay(99, '정상 날짜'), date: '2026.10.20' },
        { ...stay(2, '수정할 날짜'), date: '2026-02-30' },
        { ...stay(3, '기간 외 날짜'), date: '2026-10-22' },
    ];
    const summary = lodgingSummary(booking({ dailyAccommodations: rows }));
    assert.deepEqual(summary.slots.map(slot => [slot.day, slot.assigned, slot.confirmed, slot.invalid]), [[1, true, false, true], [2, true, false, true]]);
    assert.deepEqual(summary.issues, ['day_date_mismatch:0', 'invalid_date:1', 'out_of_range:2']);
    assert.equal(summary.slots[0].date, '2026-10-20');
    const utc = lodgingSlots(booking({ dailyAccommodations: [{ ...stay(1), date: '2026-10-19T15:00:00Z' }] }));
    assert.equal(utc[0].rowIndex, 0); assert.equal(utc[0].confirmed, true);
    const malformed = lodgingSummary(booking({ dailyAccommodations: [{ ...stay(1), date: 123 }] }));
    assert.equal(malformed.confirmed, 0); assert.deepEqual(malformed.issues, ['invalid_date:0']);
});

test('영문 confirmed를 읽되 날짜와 일차 ID의 불일치·중복은 수리 전 확정으로 세지 않는다', () => {
    const english = booking({ dailyAccommodations: [stay(1, 'A', { bookingStatus: 'confirmed' }), stay(2, 'B', { bookingStatus: 'confirmed' })] });
    assert.equal(lodgingSummary(english).allConfirmed, true);
    const duplicate = booking({ id: 'duplicate-id', dailyAccommodations: [
        { ...stay(1, 'A'), date: '2026-10-20' }, { ...stay(1, 'B'), date: '2026-10-21' },
    ] });
    const summary = lodgingSummary(duplicate);
    assert.deepEqual(summary.slots.map(slot => [slot.day, slot.assigned, slot.confirmed, slot.invalid]), [[1, true, false, true], [2, true, false, true]]);
    assert.deepEqual(summary.issues, ['day_date_mismatch:1', 'duplicate_identifier:1']);
    assert.equal(summary.allConfirmed, false); assert.deepEqual(lodgingSupplierGroups([duplicate]), []);
    const offsets = booking({ dailyAccommodations: [{ ...stay(2, 'A'), date: '2026-10-20' }, { ...stay(3, 'B'), date: '2026-10-21' }] });
    assert.deepEqual(lodgingSummary(offsets).issues, ['day_date_mismatch:0', 'day_date_mismatch:1']);
    assert.deepEqual(materializeLodgingDays(offsets), offsets.dailyAccommodations);
    for (const day of [0, 101, NaN, 1.5, undefined, '1', true]) {
        const invalid = lodgingSummary(booking({ dailyAccommodations: [{ ...stay(day), date: '2026-10-20' }] }));
        assert.deepEqual(invalid.issues, ['invalid_day:0']); assert.equal(invalid.confirmed, 0);
        assert.equal(invalid.slots[0].assigned, true); assert.equal(invalid.slots[0].rowIndex, 0);
    }
});

test('파손·미정·역전·100박 초과 기간을 정상 수배 업무로 만들지 않는다', () => {
    for (const [extra, reason] of [
        [{ startDate: '' }, 'missing'], [{ endDate: null }, 'missing'], [{ startDate: '2026-02-30' }, 'invalid'],
        [{ endDate: '2026-10-19' }, 'reversed'], [{ endDate: '2027-10-20' }, 'too_long'],
    ]) {
        const row = booking(extra), period = lodgingPeriod(row), summary = lodgingSummary(row);
        assert.equal(period.valid, false); assert.equal(period.reason, reason);
        assert.equal(summary.valid, false); assert.equal(summary.notRequired, false); assert.equal(summary.allConfirmed, false);
        assert.deepEqual(summary.slots, []); assert.deepEqual(summary.issues, [`period_${reason}`]);
    }
    assert.equal(lodgingPeriod(booking({ startDate: '2026-01-01', endDate: '2026-04-11' })).nights, 100);
    assert.equal(lodgingPeriod(booking({ startDate: '2026-01-01', endDate: '2026-04-12' })).reason, 'too_long');
});

test('당일 투어는 숙박 불필요이며 미정 일정과 구분한다', () => {
    const row = booking({ endDate: '2026-10-20', dailyAccommodations: [] });
    const summary = lodgingSummary(row);
    assert.deepEqual([summary.valid, summary.expected, summary.notRequired, summary.allConfirmed], [true, 0, true, false]);
    assert.deepEqual(materializeLodgingDays(row), []);
    assert.equal(lodgingSummary(booking({ startDate: undefined, endDate: undefined })).notRequired, false);
});

test('누락 슬롯만 추가하며 원본 순서·중복·기간 외 행·객실 메타데이터를 보존한다', () => {
    const original = [
        { ...stay(3, '원본 기간 외'), note: { text: '보존' } },
        { ...stay(1, '첫 숙소', { roomCount: 2, occupancy: '2 хүн/өрөө', images: ['a.webp'], supplier: { note: '비고' } }), date: '2026.10.20' },
    ];
    const row = booking({ dailyAccommodations: original });
    const result = materializeLodgingDays(row);
    assert.equal(result.length, 3); assert.deepEqual(result.slice(0, 2), original);
    assert.deepEqual(result[2], { day: 2, date: '2026-10-21', accommodation: {} });
    assert.notEqual(result[0], original[0]); assert.notEqual(result[1].accommodation.images, original[1].accommodation.images);
    result[0].note.text = '수정'; result[1].accommodation.supplier.note = '수정';
    assert.equal(original[0].note.text, '보존'); assert.equal(original[1].accommodation.supplier.note, '비고');
    assert.equal(materializeLodgingDays({ ...row, endDate: undefined }).length, 2);
    assert.equal(materializeLodgingDays({ ...row, endDate: row.startDate }).length, 2);
    assert.equal(materializeLodgingDays(booking()).length, 2);
    assert.equal(materializeLodgingDays(booking({ dailyAccommodations: [] })).length, 2);
});

test('취소는 입금 여부보다 우선하고 견적이라는 type만으로 확정 예약이 되지 않는다', () => {
    for (const status of ['cancelled', 'canceled', '취소', '예약취소', 'Цуцлагдсан']) {
        const row = booking({ status, depositStatus: 'paid' });
        assert.equal(isCancelledLodgingBooking(row), true); assert.equal(isConfirmedLodgingBooking(row), false);
    }
    for (const source of ['product', 'quote_booking']) {
        for (const status of ['confirmed', 'paid', 'completed']) assert.equal(isConfirmedLodgingBooking(booking({ source, status })), true);
        assert.equal(isConfirmedLodgingBooking(booking({ source, status: 'pending_payment', depositStatus: 'paid' })), true);
        assert.equal(isConfirmedLodgingBooking(booking({ source, status: 'on_hold', depositStatus: 'paid' })), false);
    }
    assert.equal(isConfirmedLodgingBooking(booking({ status: 'processing', type: 'quote' })), false);
    assert.equal(isConfirmedLodgingBooking(booking({ source: 'legacy_quote' })), false);
    assert.equal(isConfirmedLodgingBooking(booking({ source: 'quote_booking', status: 'pending_payment' })), false);
});

test('출처가 다른 같은 ID의 숙소 요약을 합치지 않는다', () => {
    const product = booking({ id: 'same', source: 'product', dailyAccommodations: [stay(1), stay(2)] });
    const quote = booking({ id: 'same', source: 'quote_booking', dailyAccommodations: [stay(2)] });
    assert.equal(lodgingSummary(product).confirmed, 2); assert.equal(lodgingSummary(quote).confirmed, 1);
    assert.deepEqual(materializeLodgingDays(quote)[1], { day: 1, date: '2026-10-20', accommodation: {} });
});

test('숙소·객실 수·인실·숙박일 변경 시 업체 확정을 초기화하고 단순 상태/사진 변경은 보존한다', () => {
    const previous = { ...stay(1, '숙소 A', { id: 'hotel-a', roomCount: 2, occupancy: '2 хүн/өрөө', type: '게르', location: '테를지' }), date: '2026-10-20' };
    const change = patch => ({ ...previous, accommodation: { ...previous.accommodation, ...patch } });
    for (const next of [change({ id: 'hotel-b' }), change({ name: '숙소 B' }), change({ roomCount: 3 }), change({ occupancy: '3 хүн/өрөө' }),
        { ...previous, date: '2026-10-21' }, change({ name: '', id: '' })]) {
        assert.equal(resetLodgingConfirmation(previous, next).accommodation.bookingStatus, LODGING_UNSENT);
    }
    assert.equal(previous.accommodation.bookingStatus, 'Баталгаажсан');
    assert.equal(resetLodgingConfirmation(previous, change({ images: ['new.webp'] })).accommodation.bookingStatus, 'Баталгаажсан');
    assert.equal(resetLodgingConfirmation(previous, change({ bookingStatus: 'Хариу ирсэн' })).accommodation.bookingStatus, 'Хариу ирсэн');
    assert.equal(resetLodgingConfirmation(previous, { ...previous, date: '2026.10.20' }).accommodation.bookingStatus, 'Баталгаажсан');
});

test('예약 시작일로 계산한 밤과 명시 날짜가 같으면 확정을 보존하고 실제 숙박일 변경만 초기화한다', () => {
    const previous = { ...stay(1, '숙소 A'), date: '' };
    const sameNight = { ...previous, date: '2026-10-20' };
    assert.equal(resetLodgingConfirmation(previous, sameNight, '2026-10-20').accommodation.bookingStatus, 'Баталгаажсан');
    assert.equal(resetLodgingConfirmation(sameNight, previous, '2026-10-20').accommodation.bookingStatus, 'Баталгаажсан');
    const secondNight = { ...stay(2, '숙소 A'), date: undefined };
    assert.equal(resetLodgingConfirmation(secondNight, { ...secondNight, date: '2026-10-21' }, '2026-10-20').accommodation.bookingStatus, 'Баталгаажсан');
    assert.equal(resetLodgingConfirmation(previous, { ...previous, day: 2 }, '2026-10-20').accommodation.bookingStatus, LODGING_UNSENT);
    assert.equal(resetLodgingConfirmation(sameNight, { ...sameNight, day: 2 }, '2026-10-20').accommodation.bookingStatus, 'Баталгаажсан');
    assert.equal(resetLodgingConfirmation(previous, { ...previous, date: '2026-10-21' }, '2026-10-20').accommodation.bookingStatus, LODGING_UNSENT);
    assert.equal(resetLodgingConfirmation(previous, sameNight, '2026-10-19T15:00:00Z').accommodation.bookingStatus, 'Баталгаажсан');
    assert.equal(resetLodgingConfirmation(previous, { ...previous, day: 2 }).accommodation.bookingStatus, 'Баталгаажсан');
});

test('업체별 숙박일 수요는 출처·팀별로 집계하고 미등록 객실·인원과 저장된 0을 구분한다', () => {
    const product = booking({ id: 'product:same', bookingId: 'same', customerName: '상품 팀', productName: '테를지', travelers: 0,
        dailyAccommodations: [stay(1, '호텔', { id: 'hotel-a', roomCount: 0, occupancy: '2 хүн/өрөө' })] });
    const quote = booking({ source: 'quote_booking', id: 'quote_booking:same', bookingId: 'same', customerName: '견적 팀', productName: '고비', travelers: null,
        dailyAccommodations: [stay(1, '호텔 이름 변경', { id: 'hotel-a' }), stay(2, '호텔', { id: 'hotel-a', roomCount: 2 })] });
    const groups = lodgingSupplierGroups([product, quote, product]);
    assert.equal(groups.length, 2);
    const first = groups[0];
    assert.equal(first.date, '2026-10-20'); assert.equal(first.id, 'hotel-a'); assert.equal(first.manual, false);
    assert.deepEqual([first.assigned, first.confirmed, first.roomCountTotal, first.unknownRoomCount, first.peopleTotal, first.unknownPeople], [2, 2, 0, 1, 0, 1]);
    assert.deepEqual(first.bookings.map(row => [row.key, row.id, row.people, row.roomCount]), [['product:same', 'same', 0, 0], ['quote_booking:same', 'same', null, null]]);
    assert.equal(groups[1].roomCountTotal, 2); assert.equal(groups[1].bookings[0].day, 2);
});

test('직접 입력 숙소는 등록 숙소와 합치지 않고 위치를 구분하며 취소·불명확 슬롯은 업체 수요에서 제외한다', () => {
    const make = (id, acc, extra = {}) => booking({ id, travelers: 3, dailyAccommodations: [stay(1, '동일 숙소', acc)], ...extra });
    const groups = lodgingSupplierGroups([
        make('registered', { id: 'hotel-a', location: '테를지', roomCount: 1 }),
        make('manual', { location: '테를지', roomCount: 2 }), make('another-region', { location: '고비', roomCount: 1 }),
        make('cancel', { roomCount: 10 }, { status: 'cancelled', depositStatus: 'paid' }),
        make('held', { roomCount: 10 }, { status: 'on_hold' }),
        make('invalid', { roomCount: 10 }, { dailyAccommodations: [{ ...stay(1), date: '2026-02-30' }] }),
        make('duplicate', {}, { dailyAccommodations: [stay(1), stay(1)] }),
        make('legacy', {}, { source: 'legacy_quote' }),
        make('bad-period', {}, { endDate: '2026-10-19' }),
    ]);
    assert.equal(groups.length, 3); assert.equal(groups.reduce((sum, group) => sum + group.assigned, 0), 3);
    assert.equal(groups.reduce((sum, group) => sum + group.roomCountTotal, 0), 4);
    assert.equal(groups.reduce((sum, group) => sum + group.peopleTotal, 0), 9);
    assert.equal(groups.filter(group => group.manual).length, 2);
});

test('월별 팀 수는 여행기간과 겹치는 각 월에 한 번씩 집계하며 월초 체크아웃과 연도 경계를 포함한다', () => {
    const rows = [
        booking({ id: 'month-boundary', startDate: '2026-10-30', endDate: '2026-11-01' }),
        booking({ id: 'year-boundary', startDate: '2026-12-30', endDate: '2027-01-02' }),
        booking({ id: 'day-tour', startDate: '2026-10-01', endDate: '2026-10-01' }),
    ];
    assert.deepEqual(lodgingMonthCounts(rows, 2026), [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1]);
    assert.deepEqual(lodgingMonthCounts(rows, 2027), [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
});

test('월별 팀 수는 취소·무효 기간을 제외하고 출처를 구분하여 중복 입력만 제거한다', () => {
    const product = booking({ id: 'same', key: 'product:same' });
    const quote = booking({ id: 'same', key: 'quote_booking:same', source: 'quote_booking' });
    const rows = [product, product, { ...product, id: 'duplicate-feed-row' }, quote, quote,
        booking({ id: 'cancel', status: 'cancelled', depositStatus: 'paid' }),
        booking({ id: 'invalid', startDate: '2026-02-30' }), booking({ id: 'reversed', endDate: '2026-10-19' }),
        booking({ id: 'unset', startDate: '' }), booking({ id: 'too-long', endDate: '2027-10-22' }),
        booking({ id: 'inquiry', source: 'legacy_quote' }),
    ];
    assert.deepEqual(lodgingMonthCounts(rows, 2026), [0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0]);
    assert.deepEqual(lodgingMonthCounts(rows, NaN), Array(12).fill(0));
    assert.deepEqual(lodgingMonthCounts(rows, 2026.5), Array(12).fill(0));
    assert.deepEqual(lodgingMonthCounts(rows, 999), Array(12).fill(0));
});
