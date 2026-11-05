import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');

// 사이드바·상단 바는 스텁으로 두고 레이아웃의 머리 부분만 그린다.
const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/components/admin/AdminLayout.tsx', import.meta.url))],
    bundle: true, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', write: false, loader: { '.css': 'empty' },
    plugins: [{ name: 'layout-shell', setup(builder) {
        builder.onResolve({ filter: /\/AdminSidebar$/ }, () => ({ path: 'sidebar', namespace: 'layout-test' }));
        builder.onResolve({ filter: /\/AdminToolbar$/ }, () => ({ path: 'toolbar', namespace: 'layout-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'layout-test' }, args => ({ loader: 'tsx', resolveDir: fileURLToPath(new URL('..', import.meta.url)),
            contents: args.path === 'sidebar' ? 'export const AdminSidebar = () => <nav className="side-stub" />;' : 'export const AdminToolbar = () => <div className="admin-toolbar">toolbar</div>;' }));
    } }],
});
const mod = { exports: {} };
new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(require, mod, mod.exports);
const { AdminLayout } = mod.exports;
const render = (props, path = '/admin/customer-workspace/quote/x') => renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: [path] },
    React.createElement(AdminLayout, { activePage: 'reservations', title: '고객 통합 작업', description: '화면 설명', actions: React.createElement('button', { type: 'button' }, '목록으로'), ...props },
        React.createElement('div', null, '본문'))));

test('hideHeading은 제목·설명·작업 버튼만 숨기고 상단 바·사이드바·좁은 화면 메뉴 토글은 유지한다', () => {
    const shown = render({});
    for (const value of ['page-title', '고객 통합 작업', '화면 설명', '목록으로', 'admin-toolbar', 'side-stub', 'admin-customer-menu-toggle', '본문']) assert.ok(shown.includes(value), value);
    assert.equal(shown.includes('is-heading-hidden'), false);
    const hidden = render({ hideHeading: true });
    for (const value of ['page-title', '고객 통합 작업', '화면 설명', '목록으로', 'admin-layout-heading']) assert.equal(hidden.includes(value), false, value);
    for (const value of ['is-heading-hidden', 'admin-toolbar', 'side-stub', 'admin-customer-menu-toggle', '본문', 'is-side-rail']) assert.ok(hidden.includes(value), value);
    assert.equal(shown.includes('is-side-rail'), false, '저장된 접기 설정이 없으면 평소에는 펼친 사이드바');
    const plain = render({ hideHeading: true }, '/admin/reservations');
    assert.equal(plain.includes('admin-page-actions'), false); assert.ok(plain.includes('is-heading-hidden'));
});
