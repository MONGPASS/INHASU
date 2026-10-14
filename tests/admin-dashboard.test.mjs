import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { dashboardAvailability, dashboardDate, dashboardNumber, dashboardPeriod, dashboardTimestamp } from '../src/utils/adminDashboard.ts';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');

// Render the shipped dashboard body. Only its surrounding app shell and shared
// context adapter are substituted; no duplicated card or list renderer is used.
const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/pages/AdminDashboard.tsx', import.meta.url))],
    bundle: true, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', write: false,
    loader: { '.css': 'empty' },
    plugins: [{ name: 'dashboard-shell', setup(builder) {
        builder.onResolve({ filter: /\/AdminLayout$/ }, () => ({ path: 'layout', namespace: 'dashboard-test' }));
        builder.onResolve({ filter: /\/AdminWorkspaceContext$/ }, () => ({ path: 'context', namespace: 'dashboard-test' }));
        builder.onResolve({ filter: /\.css$/ }, () => ({ path: 'styles', namespace: 'dashboard-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'dashboard-test' }, args => ({ loader: 'tsx', resolveDir: fileURLToPath(new URL('..', import.meta.url)), contents: args.path === 'styles'
            ? 'export default {};' : args.path === 'layout'
            ? 'export const AdminLayout = ({children}) => <main>{children}</main>;'
            : 'export const useAdminWorkspace = () => globalThis.__dashboardWorkspaceFixture;' }));
    } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, module, module.exports);
const { AdminDashboardBody, AdminDashboard } = module.exports;

const booking = (id, type, amount) => ({ id, key: `${type}:${id}`, type, reservationNumber: `예약-${id}`,
    customerName: type === 'product' ? '상품 고객' : '견적 고객', productName: '중앙 몽골 3일', email: '', phone: '',
    status: 'confirmed', statusLabel: '예약 확정', totalAmount: amount, startDate: '2026-10-14', endDate: '2026-10-16',
    createdAt: '2026-10-13T15:05:00Z', href: type === 'product' ? `/admin/reservations?id=${id}` : `/admin/quote-desk/bookings?id=${id}`,
    depositPaid: true, depositReported: false, contractSigned: true });
const inquiry = (id, type, pending = true) => ({ id, key: `${type}:${id}`, type, name: `${id} 고객`, destination: '고비 사막',
    email: '', phone: '', status: 'new', statusLabel: '신규', createdAt: '2026-10-13T15:10:00Z', pending,
    href: type === 'quote_request' ? `/admin/quote-desk/inbox?id=${id}` : `/admin/quotes?id=${id}` });
const fixture = () => ({ generatedAt: '2026-10-13T15:15:00Z', today: '2026-10-14',
    bookings: [booking('product-1', 'product', 0), booking('quote-1', 'quote_booking', 3300000)],
    inquiries: [inquiry('custom-request', 'quote_request'), inquiry('legacy-request', 'legacy_quote'), inquiry('answered-request', 'legacy_quote', false)],
    products: [], searchItems: [], tasks: [
        { key: 'deposit:product-1', kind: 'deposit_report', title: '상품 고객 입금 신고 확인', description: '한국시간 오늘 신고',
            href: '/admin/reservations?id=product-1', createdAt: '', priority: 'urgent' },
        { key: 'contract:quote-1', kind: 'contract', title: '견적 고객 계약 확인', description: '서명 후 최종 확정',
            href: '/admin/quote-desk/bookings?id=quote-1', createdAt: '', priority: 'normal' },
    ], warnings: [], availability: { reservations: true, requests: true, quotes: true, products: true },
    // Deliberately different from this shortened fixture: the server is the count source.
    metrics: { todayReservations: 41, unpaidReservations: 9, newQuotes: 15, ongoingTours: 4, confirmedSales: 7654321, depositReports: 2 },
});
const render = (state) => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/admin'] },
    React.createElement(AdminDashboardBody, { loading: false, error: '', refresh: async () => {}, ...state })));

test('대시보드는 서버 통합 집계를 그대로 사용하고 팀 금액 0원을 표시한다', () => {
    const data = fixture();
    const before = structuredClone(data);
    const html = render({ data });
    assert.ok(html.includes('오늘 신규 예약: 41건'));
    assert.ok(html.includes('답변 대기 견적: 15건'));
    assert.ok(html.includes('입금 대기: 9건'));
    assert.ok(html.includes('확정 매출: 7,654,321원'));
    assert.ok(html.includes('0원'));
    assert.ok(html.includes('3,300,000원'));
    assert.ok(!html.includes('9,900,000원'));
    assert.deepEqual(data, before);
});

test('최근 상품·견적 예약과 신규 문의·오늘 업무를 각 원본 상세 주소로 연결한다', () => {
    const html = render({ data: fixture() });
    for (const href of ['/admin/reservations?id=product-1', '/admin/quote-desk/bookings?id=quote-1',
        '/admin/quote-desk/inbox?id=custom-request', '/admin/quotes?id=legacy-request']) assert.ok(html.includes(`href="${href}"`), href);
    assert.ok(html.includes('상품 예약'));
    assert.ok(html.includes('견적 예약'));
    assert.ok(html.includes('상품 고객 입금 신고 확인'));
    assert.ok(html.includes('견적 고객 계약 확인'));
    assert.ok(!html.includes('answered-request 고객'), 'answered inquiries are not new work');
    assert.ok(html.includes('2026.10.14 ~ 2026.10.16'));
});

test('부분 조회 실패에는 영향 집계를 0으로 표시하지 않고 확인한 예약과 경고를 함께 표시한다', () => {
    const data = fixture();
    data.availability.requests = false;
    data.warnings = ['견적 예약·문의 자료를 불러오지 못했습니다.'];
    data.metrics = { todayReservations: null, unpaidReservations: null, newQuotes: null, ongoingTours: null, confirmedSales: null, depositReports: null };
    data.bookings = [data.bookings[0]];
    data.tasks = [];
    data.inquiries = [];
    const html = render({ data });
    assert.ok(html.includes('견적 예약·문의 자료를 불러오지 못했습니다.'));
    assert.ok(html.includes('오늘 신규 예약: —'));
    assert.ok(!html.includes('오늘 신규 예약: 0건'));
    assert.ok(html.includes('상품 고객'));
    assert.ok(html.includes('불러온 예약만 표시합니다.'));
    assert.ok(html.includes('추가 업무가 있을 수 있습니다.'));
    assert.ok(!html.includes('확인된 0건'));
    assert.ok(!html.includes('답변을 기다리는 문의가 없습니다.'));
    assert.ok(!html.includes('확인이 필요한 업무가 없습니다.'));
});

test('첫 조회 중에는 실제 빈 목록·0건으로 오해하게 하는 메시지를 표시하지 않는다', () => {
    const html = render({ data: null, loading: true });
    assert.ok(html.includes('aria-busy="true"'));
    assert.ok(html.includes('조회 중…'));
    assert.ok(html.includes('disabled=""'));
    assert.ok(html.includes('자료를 불러오고 있습니다.'));
    assert.ok(!html.includes('접수된 예약이 없습니다.'));
    assert.ok(!html.includes('오늘 신규 예약: 0건'));
});

test('첫 조회 실패는 재조회 화면을 표시하며 최근 자료가 있으면 새 실패에도 유지한다', () => {
    const error = '운영 자료 조회에 실패했습니다.';
    const failed = render({ data: null, error });
    assert.ok(failed.includes('role="alert"'));
    assert.ok(failed.includes(error));
    assert.ok(failed.includes('새로고침'));
    assert.ok(!failed.includes('접수된 예약이 없습니다.'));
    const cached = render({ data: fixture(), error });
    assert.ok(cached.includes('마지막으로 불러온 자료를 표시하고 있습니다.'));
    assert.ok(cached.includes('상품 고객'));
    assert.ok(cached.includes('확정 매출: 7,654,321원'));
});

test('성공한 빈 자료는 실제 0건과 빈 상태를 표시한다', () => {
    const data = fixture();
    data.bookings = []; data.inquiries = []; data.tasks = [];
    data.metrics = { todayReservations: 0, unpaidReservations: 0, newQuotes: 0, ongoingTours: 0, confirmedSales: 0, depositReports: 0 };
    const html = render({ data });
    assert.ok(html.includes('오늘 신규 예약: 0건'));
    assert.ok(html.includes('확정 매출: 0원'));
    assert.ok(html.includes('접수된 예약이 없습니다.'));
    assert.ok(html.includes('답변을 기다리는 문의가 없습니다.'));
    assert.ok(html.includes('확인이 필요한 업무가 없습니다.'));
});

test('대시보드 entry도 공통 workspace hook의 같은 자료를 사용한다', () => {
    globalThis.__dashboardWorkspaceFixture = { data: fixture(), loading: false, error: '', refresh: async () => {} };
    try {
        const html = renderToStaticMarkup(React.createElement(MemoryRouter, null, React.createElement(AdminDashboard)));
        assert.ok(html.includes('오늘 신규 예약: 41건'));
        assert.ok(html.includes('견적 고객'));
    } finally { delete globalThis.__dashboardWorkspaceFixture; }
});

test('표시 날짜는 한국시간으로 고정하고 여행 날짜·팀 금액 0·조회 불가를 구분한다', () => {
    assert.equal(dashboardNumber(0), '0');
    assert.equal(dashboardNumber(null), '—');
    assert.equal(dashboardNumber(NaN), '—');
    assert.equal(dashboardDate('2026-10-14'), '10월 14일 (수)');
    assert.equal(dashboardDate('2026-02-30'), '');
    assert.equal(dashboardTimestamp('2026-10-13 15:05:00'), dashboardTimestamp('2026-10-13T15:05:00Z'));
    assert.match(dashboardTimestamp('2026-10-13T15:05:00Z'), /10\.\s*14\./);
    assert.equal(dashboardTimestamp('invalid'), '접수일 미정');
    assert.equal(dashboardPeriod('', ''), '일정 미정');
    assert.equal(dashboardPeriod('2026-10-14', '2026-10-14'), '2026.10.14');
    assert.deepEqual(dashboardAvailability(null), { bookings: false, inquiries: false, tasks: false });
    const data = fixture(); data.availability.requests = false;
    assert.deepEqual(dashboardAvailability(data), { bookings: false, inquiries: false, tasks: false });
});
