import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardCreatedDay, dashboardOverview } from '../src/utils/adminDashboardOverview.ts';

const booking = (id, amount, createdAt, status = 'confirmed', type = 'product') => ({
    id, key: `${type}:${id}`, type, totalAmount: amount, createdAt, status, depositPaid: true, contractSigned: false,
});
const snapshot = () => ({ today: '2026-10-20', availability: { reservations: true, requests: true, quotes: true, products: true },
    metrics: { confirmedSales: 7654321 }, bookings: [
        booking('same-id', 0, '2026-10-19T15:00:00Z'), booking('same-id', 3000000, '2026-10-01 00:00:00', 'paid', 'quote_booking'),
        booking('old', 1500000, '2026-09-20'), booking('cancelled', 9999999, '2026-10-20', 'cancelled'),
    ] });

test('확정 매출의 전체 집계는 서버 값을 유지하고 조회 기간은 접수일·한국시간으로 계산한다', () => {
    const data = snapshot(), before = structuredClone(data);
    assert.equal(dashboardOverview(data).revenue, 7654321);
    assert.equal(dashboardOverview(data, 'month').revenue, 3000000);
    assert.equal(dashboardOverview(data, '30days').revenue, 3000000);
    assert.equal(dashboardOverview(data, 'year').revenue, 4500000);
    const view = dashboardOverview(data);
    assert.deepEqual(view.months.map(month => month.key), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    assert.equal(view.months.at(-1).amount, 3000000);
    assert.equal(view.days.at(-1).count, 2, '예약 접수 건수는 취소 여부와 구분한다');
    assert.deepEqual(view.sources.map(source => source.count), [3, 1], '같은 ID도 출처별로 분리한다');
    assert.deepEqual(data, before);
});

test('날짜·금액 누락과 부분 실패를 0원 또는 비어 있는 완전한 집계로 표시하지 않는다', () => {
    const data = snapshot();
    data.bookings[1].totalAmount = null;
    assert.equal(dashboardOverview(data, 'month').revenue, null);
    assert.equal(dashboardOverview(data).months.at(-1).amount, null);
    data.bookings[1].totalAmount = 0;
    assert.equal(dashboardOverview(data, 'month').revenue, 0);
    data.bookings[1].createdAt = '';
    assert.equal(dashboardOverview(data, 'month').revenue, null);
    assert.equal(dashboardOverview(data).undated, 1);
    assert.ok(dashboardOverview(data).days.every(day => day.count === null), '접수일 누락이 있으면 일별 건수를 0으로 단정하지 않는다');
    data.availability.requests = false;
    const partial = dashboardOverview(data);
    assert.equal(partial.revenue, null); assert.equal(partial.total, null);
    assert.ok(partial.days.every(day => day.count === null));
    assert.ok(partial.sources.every(source => source.count === null));
    assert.ok(partial.months.every(month => month.amount === null));
});

test('한국시간 월 경계·연도 경계와 잘못된 날짜를 처리하고 정상 빈 자료는 0을 유지한다', () => {
    assert.equal(dashboardCreatedDay('2026-09-30 15:01:00'), '2026-10-01');
    assert.equal(dashboardCreatedDay('2026-12-31T15:00:00Z'), '2027-01-01');
    for (const invalid of ['', 'invalid', '2026-02-30', '2026-02-30T12:00:00Z']) assert.equal(dashboardCreatedDay(invalid), '');
    const data = snapshot(); data.today = '2027-01-01'; data.bookings = []; data.metrics.confirmedSales = 0;
    const empty = dashboardOverview(data, 'month');
    assert.equal(empty.revenue, 0); assert.equal(empty.total, 0);
    assert.deepEqual(empty.months.map(month => month.key), ['2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01']);
    assert.ok(empty.months.every(month => month.amount === 0));
    assert.equal(dashboardOverview(null).revenue, null);
});
