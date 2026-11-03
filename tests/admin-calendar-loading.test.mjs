import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/pages/AdminCalendar.tsx', import.meta.url))],
    bundle: true, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', write: false,
    loader: { '.css': 'empty' },
    plugins: [{ name: 'calendar-context', setup(builder) {
        builder.onResolve({ filter: /\/(AdminLayout|UserContext|adminReadCache|api)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'calendar-fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'calendar-fixture' }, args => ({ loader: 'tsx', resolveDir: fileURLToPath(new URL('..', import.meta.url)), contents:
            args.path === 'AdminLayout' ? 'export const AdminLayout = ({children,actions}) => <><header>{actions}</header><main>{children}</main></>;'
            : args.path === 'UserContext' ? 'export const useUser = () => ({user:globalThis.__calendarLoading.user});'
            : args.path === 'api' ? 'export const api = {};'
            : 'export const peekAdminRead = (url,account) => account === globalThis.__calendarLoading.account ? globalThis.__calendarLoading.cache[url] : undefined;' }));
    } }],
});
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, module, module.exports);
const render = (cache, { account = 'admin-a', user = account, legacy = false } = {}) => {
    globalThis.__calendarLoading = { account, cache, user: { id: user, role: 'admin' } };
    return renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [`/admin/calendar?month=2026-10&date=2026-10-20${legacy ? '&legacy=1' : ''}`] }, React.createElement(module.exports.AdminCalendar)));
};
const reservation = { id: 'cached-tour', customerName: '캐시된 실제 예약', productName: '초원 여행', status: 'confirmed',
    startDate: '2026-10-20', endDate: '2026-10-22', travelers: 3, totalPrice: 3300000, depositAmount: 330000, balanceAmount: 2970000 };
const warm = () => ({ '/api/reservations': [reservation], '/api/admin/bookings/quote': { items: [], skipped: 0 } });

test('최근 조회한 예약이 있으면 캘린더 첫 렌더부터 실제 일정과 숫자를 표시한다', () => {
    const html = render(warm());
    assert.ok(html.includes('캐시된 실제 예약'));
    assert.ok(html.includes('초원 여행'));
    assert.ok(html.includes('3명'));
    assert.ok(!html.includes('예약 정보를 불러오고 있습니다'));
    assert.ok(!html.includes('일정을 불러오는 중입니다'));
});

test('기본 캘린더는 이전 문의 캐시 없이도 예약 집계를 바로 표시한다', () => {
    const html = render(warm());
    const metric = html.match(/tc-metric-label[^>]*>이번 달 투어<\/span><strong>(.*?)<\/strong>/)?.[1];
    assert.equal(metric, '1팀');
});

test('이전 문의를 포함할 때는 해당 출처를 읽기 전까지 전체 집계를 확정하지 않는다', () => {
    const html = render(warm(), { legacy: true });
    const metric = html.match(/tc-metric-label[^>]*>이번 달 투어<\/span><strong>(.*?)<\/strong>/)?.[1];
    assert.equal(metric, '—');
    assert.ok(html.includes('불러오는 중'));
});

test('필수 출처가 아직 없으면 합계를 확인된 0팀으로 표시하지 않는다', () => {
    const html = render({ '/api/reservations': [] });
    const metric = html.match(/tc-metric-label[^>]*>이번 달 투어<\/span><strong>(.*?)<\/strong>/)?.[1];
    assert.equal(metric, '—');
    assert.ok(html.includes('예약 정보를 불러오고 있습니다'));
});

test('관리자 계정이 달라지면 이전 계정의 즉시 표시 자료를 사용하지 않는다', () => {
    const html = render(warm(), { account: 'admin-a', user: 'admin-b' });
    assert.ok(!html.includes('캐시된 실제 예약'));
    assert.ok(!html.includes('초원 여행'));
    assert.ok(html.includes('예약 정보를 불러오고 있습니다'));
});
