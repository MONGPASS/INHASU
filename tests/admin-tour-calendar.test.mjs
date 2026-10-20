import test from 'node:test';
import assert from 'node:assert/strict';
import {
    adaptCalendarTours, calendarDateKey, calendarMonthDays, toursOnDate, toursInMonth,
    calendarConflicts, calendarConflictsInRange, calendarStats, calendarTourDay, filterCalendarTours,
} from '../src/utils/adminTourCalendar.ts';
import { summarizeQuoteBooking } from '../functions/lib/quoteBookings.ts';
import { productSignatureStatus } from '../src/utils/productContractSignature.ts';

const reservation = (extra = {}) => ({
    id: 'same-id', customerName: '합성 고객', productName: '테를지 여행', startDate: '2026-10-20', endDate: '2026-10-22',
    status: 'confirmed', travelers: 3, totalPrice: 3000000, depositAmount: 900000, balanceAmount: 2100000,
    depositStatus: 'paid', balanceStatus: 'unpaid', assignedGuide: { id: 'guide-a', name: '합성 가이드' },
    adminOperations: { vehicle: '하이에이스' }, contractData: { vehicle: { id: 'vehicle-a', type: '하이에이스' }, agreement: { agreed: true } },
    dailyAccommodations: [{ day: 1, accommodation: { name: '첫째 숙소' } }, { day: 2, accommodation: { name: '둘째 숙소' } }],
    itineraryUrl: '/documents/itinerary/same-id', ...extra,
});
const one = (extra = {}) => adaptCalendarTours({ reservations: [reservation(extra)] })[0];

test('날짜를 검증하고 UTC+9 출발일, 점 표기, 한 자리 월·일을 일관되게 읽는다', () => {
    for (const input of ['2026. 1. 2.', '2026/1/2', '2026-1-2', '2026-01-02 00:00:00', '2026-01-02T00:00:00.000']) assert.equal(calendarDateKey(input), '2026-01-02');
    assert.equal(calendarDateKey('2026-01-01T15:00:00.000Z'), '2026-01-02');
    assert.equal(calendarDateKey('2026-01-02T00:00:00+09:00'), '2026-01-02');
    assert.equal(calendarDateKey('2028-2-29'), '2028-02-29');
    for (const input of [null, '', '미정', '2026-2-29', '2026-13-01', '2026-02-30T00:00:00Z', '2026-10-20T25:00:00Z', '2026-10-20junk', new Date(NaN)]) assert.equal(calendarDateKey(input), '', String(input));
});

test('종류와 ID를 함께 구분하며 예약 문의를 확정 예약으로 집계하지 않는다', () => {
    const rows = adaptCalendarTours({ reservations: [reservation(), reservation()], bookings: [{ ...reservation(), quoteBooking: { signed: true, published: true } }],
        quotes: [{ id: 'same-id', name: '합성 문의', destination: '고비', period: '2026.10.20 ~ 2026.10.22', headcount: '성인 2명 / 아동 1명', status: 'answered' }] });
    assert.equal(rows.length, 3);
    assert.deepEqual(new Set(rows.map(row => row.key)), new Set(['product:same-id', 'quote_booking:same-id', 'legacy_quote:same-id']));
    const inquiry = rows.find(row => row.source === 'legacy_quote');
    assert.equal(inquiry.dateSource, 'requested'); assert.equal(inquiry.people, 3);
    assert.equal(inquiry.statusLabel, '견적 전달'); assert.deepEqual(inquiry.issues, [{ id: 'quote', label: '고객 견적 확인 대기', kind: 'waiting' }]);
    assert.equal(calendarStats(rows).tours, 2); assert.equal(calendarStats(rows).people, 6); assert.equal(calendarStats(rows).inquiries, 1);
});

test('취소·예약 전환 문의·누락 또는 역전된 날짜를 투어에 섞지 않는다', () => {
    const rows = adaptCalendarTours({ reservations: [reservation({ id: 'cancel', status: 'cancelled' }), reservation({ id: 'cancel-ko', status: '예약취소' }),
        reservation({ id: 'no-date', startDate: null }), reservation({ id: 'no-end', endDate: null }), reservation({ id: 'backwards', endDate: '2026-10-19' }),
        reservation({ id: 'invalid-end', endDate: '2026-02-30' }), reservation({ id: 'unbounded', endDate: '2028-10-22' }), reservation({ id: 'held', status: 'on_hold' })],
        quotes: [{ id: 'converted', status: 'converted', period: '2026-10-20 ~ 2026-10-22' }] });
    assert.deepEqual(rows.map(row => row.id), ['held']);
    assert.deepEqual(rows[0].issues, [{ id: 'hold', label: '예약 보류', kind: 'waiting' }]);
    assert.equal(calendarStats(rows).tours, 0);
});

test('저장된 0원·0명을 보존하고 알 수 없는 금액·인원을 0이나 결제 완료로 만들지 않는다', () => {
    const free = one({ totalPrice: 0, depositAmount: 0, balanceAmount: 0, travelers: 0 });
    assert.deepEqual([free.total, free.deposit, free.balance, free.people], [0, 0, 0, 0]);
    const unknown = one({ totalPrice: null, depositAmount: null, balanceAmount: null, travelers: null, depositStatus: '', balanceStatus: '' });
    assert.deepEqual([unknown.total, unknown.deposit, unknown.balance, unknown.people], [null, null, null, null]);
    assert.equal(unknown.depositStatus, 'unknown'); assert.equal(unknown.balanceStatus, 'unknown');
    assert.equal(unknown.paymentLabel, '입금 상태 확인');
    assert.equal(calendarStats([unknown]).unknownPeople, 1);
    assert.equal(one({ totalPrice: 100, depositAmount: 25, balanceAmount: null }).balance, 75);
    assert.equal(one({ totalPrice: 100, depositAmount: null, balanceAmount: null }).balance, null);
});

test('두 번 인코딩한 JSON과 snake_case 배정을 읽되 파손된 JSON은 완료로 처리하지 않는다', () => {
    const row = adaptCalendarTours({ reservations: [{ id: 'snake', customer_name: '원본 고객', product_name: '원본 상품', start_date: '2026.10.20', end_date: '2026.10.22',
        total_price: 0, deposit_amount: 0, balance_amount: 0, total_people: 2, status: 'paid', deposit_status: 'paid', balance_status: 'unpaid',
        assigned_guide: JSON.stringify(JSON.stringify({ id: 'guide-snake', name: '원본 가이드' })), contract_data: '{"vehicle":{"id":"vehicle-snake","model":"원본 차량"}}',
        admin_operations: '{"region":"테를지"}', daily_accommodations: '[{"day":1,"accommodation":{"name":"첫 숙소"}}]' }] })[0];
    assert.equal(row.guide.id, 'guide-snake'); assert.equal(row.vehicle.id, 'vehicle-snake'); assert.equal(row.vehicle.name, '원본 차량');
    assert.equal(row.stays.assigned, 1); assert.equal(row.stays.expected, 2); assert.deepEqual(row.stays.missingDays, [2]);
    const malformed = one({ assignedGuide: '{', contractData: '{', adminOperations: '{', dailyAccommodations: '{', itineraryUrl: '' });
    assert.equal(malformed.guide, null); assert.equal(malformed.vehicle, null); assert.equal(malformed.stays.state, 'unknown');
    assert.equal(malformed.contract, 'unknown'); assert.equal(malformed.publication, 'unknown');
    assert.ok(malformed.issues.some(issue => issue.kind === 'unknown'));
});

test('숙소는 여행 일수가 아닌 실제 숙박 일차를 세며 중복·빈칸·귀국일로 채워진 길이를 믿지 않는다', () => {
    const row = one({ dailyAccommodations: [
        { day: 1, accommodation: { name: '첫 숙소' } }, { day: 1, accommodation: { name: '동일 밤 중복' } },
        { day: 2, accommodation: { name: '' } }, { day: 3, accommodation: { name: '귀국일 숙소' } }, { accommodation: { name: '일차 없음' } },
    ] });
    assert.deepEqual([row.days, row.nights, row.stays.assigned, row.stays.expected], [3, 2, 1, 2]);
    assert.deepEqual(row.stays.missingDays, [2]); assert.equal(row.stays.namesByDay[1], '동일 밤 중복');
    assert.equal(row.stays.namesByDay[3], undefined);
    assert.equal(row.issues.find(issue => issue.id === 'stays').label, '숙소 1박 미배정');
    assert.equal(one({ dailyAccommodations: [{ day: 1, accommodation: { name: '있음' } }, { day: 1, accommodation: { name: '' } }] }).stays.assigned, 0);
});

test('날짜별 배정은 해당 밤에 연결하고 취소된 숙소를 배정 완료에서 제외한다', () => {
    const row = one({ dailyAccommodations: [{ date: '2026.10.20', accommodation: { name: '날짜 숙소' } },
        { day: 2, accommodation: { name: '취소 숙소', bookingStatus: 'cancelled' } }, { date: '2026-02-30', day: 2, accommodation: { name: '깨진 날짜' } }] });
    assert.equal(row.stays.assigned, 1); assert.equal(row.stays.namesByDay[1], '날짜 숙소'); assert.deepEqual(row.stays.missingDays, [2]);
    assert.deepEqual(calendarTourDay(row, '2026-10-20'), { day: 1, totalDays: 3, night: 1, stay: '날짜 숙소' });
    assert.deepEqual(calendarTourDay(row, '2026-10-22'), { day: 3, totalDays: 3, night: null, stay: null });
    assert.equal(calendarTourDay(row, '2026-10-23'), null);
    const dayTrip = one({ endDate: '2026-10-20', dailyAccommodations: undefined });
    assert.equal(dayTrip.stays.expected, 0); assert.equal(dayTrip.stays.state, 'ready');
});

test('차량 명시적 비우기와 변경은 오래된 계약 차량 ID를 되살리지 않는다', () => {
    assert.equal(one({ adminOperations: { vehicle: '' } }).vehicle, null);
    const changed = one({ adminOperations: { vehicle: '새 차량' } });
    assert.equal(changed.vehicle.name, '새 차량'); assert.equal(changed.vehicle.id, '');
    const inherited = one({ adminOperations: { region: '고비' } });
    assert.equal(inherited.vehicle.id, 'vehicle-a'); assert.equal(inherited.vehicle.name, '하이에이스');
});

test('실제 입금 신고는 관리자 처리로, 단순 입금·서명 대기는 기다림으로 구분한다', () => {
    const waiting = one({ depositStatus: 'unpaid', contractData: { vehicle: { type: '하이에이스' }, agreement: { agreed: false } } });
    assert.deepEqual(waiting.issues.map(issue => issue.kind), ['waiting', 'waiting']);
    assert.equal(calendarStats([waiting]).attention, 0);
    const reported = one({ depositStatus: 'unpaid', depositReport: '{"status":"reported"}' });
    assert.equal(reported.paymentLabel, '입금 신고 접수');
    assert.deepEqual(reported.issues[0], { id: 'deposit_report', label: '고객 입금 신고 확인', kind: 'payment' });
    assert.equal(calendarStats([reported]).attention, 1);
    assert.deepEqual(one({ status: 'completed', assignedGuide: null, dailyAccommodations: [] }).issues, []);
});

test('상품 계약 동의는 기존 루트·중첩 서명과 안전한 공개 메타데이터를 같은 기준으로 읽는다', () => {
    const signImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jGUYAAAAASUVORK5CYII=';
    const signature = { signedAt: '2026-10-01T00:00:00Z', signImg };
    assert.equal(productSignatureStatus(signature).hasImage, true);
    for (const contractData of [signature, { signature }, { contract: signature }, { signature: {}, contract: signature }, { signature: { signedAt: signature.signedAt, hasImage: true } }]) {
        const row = one({ contractData });
        assert.equal(row.contract, 'signed', JSON.stringify(contractData));
        assert.equal(row.issues.some(issue => issue.id === 'contract_unknown'), false);
    }
    for (const signature of [{ signedAt: '2026-10-01T00:00:00Z', signImg: 'broken' }, { signedAt: 'invalid', hasImage: true }]) {
        assert.equal(one({ contractData: { signature } }).contract, 'unknown');
    }
});

test('상품 일정표는 고객 공개 조건을 따르고 보류·입금 대기의 이전 URL을 공개로 표시하지 않는다', () => {
    for (const status of ['confirmed', 'paid', 'completed']) assert.equal(one({ status }).publication, 'published');
    for (const status of ['pending_payment', 'on_hold', 'reservation_requested']) {
        const row = one({ status });
        assert.equal(row.publication, 'draft', status);
    }
    assert.equal(one({ status: 'confirmed', itineraryUrl: '' }).publication, 'unknown');
    const quote = adaptCalendarTours({ bookings: [{ ...reservation(), status: 'pending_payment', quoteBooking: { published: true } }] })[0];
    assert.equal(quote.publication, 'published');
});

test('가이드·차량 충돌은 겹치는 날짜와 실제 자원 ID로만 판정한다', () => {
    const a = one({ id: 'a' }), sameName = one({ id: 'same-name', assignedGuide: { id: 'different-guide', name: a.guide.name }, contractData: { vehicle: { id: 'different-vehicle', type: '하이에이스' } } });
    assert.deepEqual(calendarConflicts([a, sameName]), []);
    const noIds = one({ id: 'no-ids', assignedGuide: { name: a.guide.name }, contractData: { vehicle: { type: '하이에이스' } } });
    assert.deepEqual(calendarConflicts([a, noIds]), []);
    const overlap = one({ id: 'b', startDate: '2026-10-22', endDate: '2026-10-23' });
    const conflicts = calendarConflicts([a, overlap, one({ id: 'later', startDate: '2026-10-24', endDate: '2026-10-25' })]);
    assert.equal(conflicts.length, 2);
    assert.deepEqual(conflicts.map(conflict => conflict.resource), ['guide', 'vehicle']);
    assert.deepEqual(conflicts[0].tourKeys, ['product:a', 'product:b']);
    assert.deepEqual(calendarConflicts([a, { ...overlap, status: 'completed' }, { ...overlap, key: 'held', status: 'on_hold' }, { ...overlap, key: 'inquiry', source: 'legacy_quote' }]), []);
    assert.deepEqual(calendarConflicts([a, a]), []);
});

test('상품과 견적 예약의 ID가 같아도 실제 배정 자원의 중복은 출처를 구분해 감지한다', () => {
    const summary = summarizeQuoteBooking({ id: 'same-id', name: '견적 합성 고객', status: '예약확정', depart: '2026-10-21', return_: '2026-10-23', adult: 2,
        booking: { assign: { guide: { id: 'guide-a', name: '합성 가이드' }, vehicle: { id: 'vehicle-a', model: '하이에이스' } } } });
    const rows = adaptCalendarTours({ reservations: [reservation()], bookings: [summary] });
    assert.equal(rows.length, 2);
    const conflict = calendarConflicts(rows);
    assert.equal(conflict.length, 2);
    assert.equal(conflict.find(item => item.resource === 'vehicle').resourceId, 'vehicle-a');
    assert.deepEqual(new Set(conflict[0].tourKeys), new Set(['product:same-id', 'quote_booking:same-id']));
});

test('월 경계에서 실제 겹침이 발생한 달만 충돌로 집계하며 원본 기간은 변경하지 않는다', () => {
    const rows = adaptCalendarTours({ reservations: [reservation({ id: 'oct-nov', startDate: '2026-10-30', endDate: '2026-11-02' }),
        reservation({ id: 'nov-only', startDate: '2026-11-02', endDate: '2026-11-03' })] });
    const before = JSON.stringify(rows);
    assert.deepEqual(calendarConflictsInRange(rows, '2026-10-01', '2026-10-31'), []);
    const november = calendarConflictsInRange(rows, '2026-11-01', '2026-11-30');
    assert.equal(november.length, 2);
    assert.equal(november.find(item => item.resource === 'guide').resourceId, 'guide-a');
    assert.equal(november.find(item => item.resource === 'vehicle').resourceId, 'vehicle-a');
    assert.deepEqual(november[0].tourKeys, ['product:oct-nov', 'product:nov-only']);
    assert.equal(calendarConflictsInRange(rows, '2026-11-01', '2026-11-01').length, 0);
    assert.equal(calendarConflictsInRange(rows, '2026-11-02', '2026-11-02').length, 2);
    for (const [start, end] of [['', '2026-11-30'], ['2026-11-01', '2026-11-31'], ['2026-11-03', '2026-11-01']]) assert.deepEqual(calendarConflictsInRange(rows, start, end), []);
    assert.equal(JSON.stringify(rows), before);
});

test('6주 달력과 월·일 집계는 월을 넘는 투어를 포함하고 잘못된 날짜는 제외한다', () => {
    const rows = adaptCalendarTours({ reservations: [reservation({ id: 'cross-month', startDate: '2026-09-29', endDate: '2026-10-02' }), reservation({ id: 'last', startDate: '2026-10-31', endDate: '2026-11-02' })] });
    const days = calendarMonthDays(new Date(2026, 9, 1));
    assert.equal(days.length, 42); assert.equal(days[0].dateKey, '2026-09-27'); assert.equal(days[0].inMonth, false);
    assert.equal(days.filter(day => day.inMonth).length, 31); assert.equal(days.at(-1).dateKey, '2026-11-07');
    assert.equal(toursInMonth(rows, new Date(2026, 9, 1)).length, 2);
    assert.deepEqual(toursOnDate(rows, '2026.10.1').map(row => row.id), ['cross-month']);
    assert.deepEqual(toursOnDate(rows, '2026-10-32'), []);
    assert.deepEqual(toursInMonth(rows, new Date(NaN)), []); assert.deepEqual(calendarMonthDays(new Date(NaN)), []);
});

test('검색·종류·처리 필요 필터가 원본을 변경하지 않는다', () => {
    const input = { reservations: [reservation({ id: 'ready', phone: '01011112222' }), reservation({ id: 'missing', assignedGuide: null })] };
    const before = JSON.stringify(input), rows = adaptCalendarTours(input);
    assert.deepEqual(filterCalendarTours(rows, { query: '0101111' }).map(row => row.id), ['ready']);
    assert.deepEqual(filterCalendarTours(rows, { attentionOnly: true }).map(row => row.id), ['missing']);
    assert.equal(filterCalendarTours(rows, { query: '하이에이스', source: 'product' }).length, 2);
    assert.equal(filterCalendarTours(rows, { source: 'quote_booking' }).length, 0);
    assert.equal(JSON.stringify(input), before);
});
