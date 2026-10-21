import test from 'node:test';
import assert from 'node:assert/strict';
import {
    highlightMatch, reservationAssignments, reservationDday, reservationKpis, reservationPayNote, reservationPeriod, reservationSteps,
} from '../src/utils/adminReservationBoard.ts';
import { defaultReservationList, readReservationList, reservationListSearch } from '../src/utils/adminReservationList.ts';

const today = '2026-10-21';
const row = (id, overrides = {}) => ({ id, type: 'product', status: 'pending_payment', customerName: `${id} 고객`, productName: '중앙몽골',
    startDate: '2026-11-01', endDate: '2026-11-04', totalAmount: 1000000, deposit: 300000, balance: 700000,
    depositStatus: 'unpaid', balanceStatus: 'unpaid', ...overrides });

test('요약 카드 건수는 카드를 눌렀을 때 보이는 예약과 같고 금액은 취소 예약을 빼고 합산한다', () => {
    const rows = [
        row('wait-a'),
        row('wait-b', { type: 'quote_booking', status: 'reservation_requested', depositStatus: 'paid', quoteBooking: { signed: true } }),
        row('ok-a', { status: 'confirmed', depositStatus: 'paid', balanceStatus: 'paid', startDate: '2026-10-25', endDate: '2026-10-27' }),
        row('ok-b', { status: 'paid', depositStatus: 'paid', startDate: '2027-03-01', endDate: '2027-03-03' }),
        row('cancel', { status: 'cancelled', totalAmount: 9000000, startDate: '2026-10-22' }),
        row('legacy', { type: 'quote', status: 'new' }),
        row('past', { status: 'completed', depositStatus: 'paid', balanceStatus: 'paid', startDate: '2026-09-01', endDate: '2026-09-03' }),
    ];
    const kpis = Object.fromEntries(reservationKpis(rows, today).map(kpi => [kpi.key, kpi]));
    assert.equal(kpis.all.value, 6, 'legacy quote inquiries are not bookings');
    assert.deepEqual(kpis.all.rows.map(r => r.v), ['₩5,000,000', '₩1,200,000']);
    assert.equal(kpis.waiting.value, 2);
    assert.deepEqual(kpis.waiting.rows.map(r => [r.v, r.alert]), [['1건', true], ['₩2,000,000', false]], 'only the unsigned waiting booking needs a signature');
    assert.equal(kpis.confirmed.value, 2);
    assert.deepEqual(kpis.confirmed.rows.map(r => r.v), ['₩2,000,000', '1건']);
    assert.equal(kpis.balanceDue.value, 4, 'same set as the 잔금 미입금 filter, cancelled included');
    assert.equal(kpis.balanceDue.rows[0].v, '₩2,100,000', 'cancelled balance is not outstanding money');
    assert.equal(kpis.departing.value, 5, 'every booking departing today or later, as the 출발일 filter shows');
    assert.deepEqual(kpis.departing.rows.map(r => r.v), ['D-4 · ok-a 고객', '3건'], 'cancelled and 2027 departures are not within 30 days');
    assert.equal(kpis.waiting.pct, '33%');

    rows[0].totalAmount = Number.NaN;
    const unknown = Object.fromEntries(reservationKpis(rows, today).map(kpi => [kpi.key, kpi]));
    assert.equal(unknown.waiting.rows[1].v, '—', 'an unknown amount makes the total unavailable, not smaller');
    assert.equal(reservationKpis([], today)[0].rows[0].v, '₩0');
});

test('진행 단계는 예약금·서명·잔금·일정표 공개를 실제 필드로 판단한다', () => {
    const steps = r => reservationSteps(r).map(step => step.done);
    assert.deepEqual(steps(row('p', { depositStatus: 'paid', contractData: { agreement: { agreed: true } } })), [true, true, false, false]);
    assert.deepEqual(steps(row('p2', { status: 'confirmed', depositStatus: 'paid', balanceStatus: 'paid', itineraryUrl: '/documents/itinerary/p2' })), [true, false, true, true]);
    assert.deepEqual(steps(row('p3', { status: 'pending_payment', itineraryUrl: '/documents/itinerary/p3' })), [false, false, false, false], 'an itinerary is public only for confirmed teams');
    assert.deepEqual(steps(row('q', { type: 'quote_booking', status: 'confirmed', depositStatus: 'paid', quoteBooking: { signed: true, published: true } })), [true, true, false, true]);
    assert.equal(reservationSteps(row('c', { type: 'quote_booking', status: 'cancelled', quoteBooking: { published: true } }))[3].done, false);
});

test('D-day·여행 기간·입금 안내는 한국시간 날짜 키로 계산한다', () => {
    assert.deepEqual(reservationDday('2026-10-21', today), { label: 'D-DAY', days: 0, tone: 'soon' });
    assert.deepEqual(reservationDday('2026-10-28', today), { label: 'D-7', days: 7, tone: 'soon' });
    assert.deepEqual(reservationDday('2026-12-01', today), { label: 'D-41', days: 41, tone: 'near' });
    assert.deepEqual(reservationDday('2027-03-01', today), { label: 'D-131', days: 131, tone: 'far' });
    assert.deepEqual(reservationDday('2026-10-01', today), { label: '출발 완료', days: -20, tone: 'past' });
    assert.deepEqual(reservationDday('', today), { label: '일정 미정', days: null, tone: 'none' });
    assert.deepEqual(reservationPeriod('2026-12-31', '2027-01-03'), { range: '2026.12.31 – 2027.01.03', nights: '3박 4일' });
    assert.deepEqual(reservationPeriod('2026-10-21', ''), { range: '2026.10.21', nights: '' });
    assert.deepEqual(reservationPayNote(row('a', { depositStatus: 'paid' })), { text: '잔금 입금 대기', done: false });
    assert.deepEqual(reservationPayNote(row('b', { depositStatus: 'paid', balanceStatus: 'paid' })), { text: '잔금까지 입금 완료', done: true });
    assert.equal(reservationPayNote(row('c', { type: 'quote' })), null);
});

test('배정 칩은 가이드·차량과 박수만큼 저장된 숙소를 확인한다', () => {
    const chips = (r, vehicle = '') => reservationAssignments(r, vehicle).map(chip => chip.done);
    const stays = days => days.map(day => ({ day, accommodation: { name: `숙소 ${day}` } }));
    assert.deepEqual(chips(row('a')), [false, false, false]);
    assert.deepEqual(chips(row('b', { assignedGuide: { name: '바트' }, dailyAccommodations: stays([1, 2]) }), '스타렉스'), [true, true, false], '3박에 숙소 2박만 배정');
    assert.deepEqual(chips(row('c', { dailyAccommodations: stays([1, 2, 3]) })), [false, false, true]);
    assert.deepEqual(chips(row('d', { endDate: '2026-11-01' })), [false, false, true], 'a day trip needs no lodging');
});

test('검색어 강조는 하이픈이 들어간 전화번호도 숫자만으로 찾는다', () => {
    assert.deepEqual(highlightMatch('010-9099-0472', '90990'), { a: '010-', b: '9099-0', c: '472' });
    assert.deepEqual(highlightMatch('박유린(2인)', '유린'), { a: '박', b: '유린', c: '(2인)' });
    assert.deepEqual(highlightMatch('B0322B94', 'b03'), { a: '', b: 'B03', c: '22B94' });
    assert.deepEqual(highlightMatch('중앙몽골', ''), { a: '중앙몽골', b: '', c: '' });
});

test('목록 URL은 상태 탭 묶음과 금액순 정렬을 유지하고 모르는 값은 버린다', () => {
    const state = { ...defaultReservationList, filterStatus: '확정 대기', sortOrder: 'amount', filterDeparture: '2026-10-21' };
    assert.deepEqual(readReservationList(reservationListSearch(state)), state);
    assert.equal(readReservationList('?status=확정 팀').filterStatus, '확정 팀');
    assert.equal(readReservationList('?sort=random').sortOrder, 'recent');
});
