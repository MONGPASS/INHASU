import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { build } from 'esbuild';
import ts from 'typescript';
import { fileURLToPath } from 'node:url';
import { matchRoutes } from 'react-router-dom';
import { customerWorkspaceReturnTo, productCustomerHref, quoteCustomerHref, legacyQuoteCustomerHref } from '../src/utils/customerWorkspaceRoutes.ts';

const origin = 'https://local-workspace.example.invalid';
// Use the app's actual registered routes, not a second manually maintained
// router. Parse JSX without running global providers, browser effects or APIs.
const appSource = ts.createSourceFile('App.tsx', fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const routes = [];
const visit = node => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(appSource) === 'Route') {
        const attributes = node.attributes.properties;
        const path = attributes.find(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(appSource) === 'path');
        if (path?.initializer && ts.isStringLiteral(path.initializer)) {
            let guarded = false;
            const findGuard = child => {
                if (ts.isJsxOpeningElement(child) && child.tagName.getText(appSource) === 'AdminGuard') guarded = true;
                ts.forEachChild(child, findGuard);
            };
            ts.forEachChild(node, findGuard);
            routes.push({ path: path.initializer.text, handle: { guarded } });
        }
    }
    ts.forEachChild(node, visit);
};
visit(appSource);

test('상품·견적 문의/예약·이전 견적은 같은 ID와 동명이인도 원본 출처별 URL로 구분한다', () => {
    const id = '같은 고객 / source?key=1#조회%';
    const hrefs = [productCustomerHref(id), quoteCustomerHref(id), legacyQuoteCustomerHref(id)];
    assert.equal(new Set(hrefs).size, 3);
    for (const [index, href] of hrefs.entries()) {
        const url = new URL(href, origin);
        assert.equal(url.origin, origin); assert.equal(url.search, ''); assert.equal(url.hash, '');
        const match = matchRoutes(routes, url.pathname);
        assert.equal(match.length, 1);
        assert.equal(match[0].route.path, `/admin/customer-workspace/${['product', 'quote', 'legacy-quote'][index]}/:id`);
        assert.equal(match[0].route.handle.guarded, true, '고객 내부 작업 화면은 관리자 권한으로 보호해야 한다');
        assert.equal(match[0].params.id, id);
    }
    assert.notEqual(productCustomerHref('same-account-booking-a'), productCustomerHref('same-account-booking-b'));
});

test('예약 목록 필터와 달력·숙소 목록 복귀 위치는 보존하며 외부/임의 경로는 허용하지 않는다', () => {
    const allowed = ['/admin', '/admin/reservations?q=고객&page=2&type=quote_booking', '/admin/calendar?month=2026-10#selected',
        '/admin/accommodation-ops?open=customer-a&source=quote_booking', '/admin/quote-desk/inbox?id=inquiry-a',
        '/admin/quote-desk/bookings', '/admin/quotes?open=legacy-a'];
    for (const value of allowed) {
        const normalized = customerWorkspaceReturnTo(value);
        const url = new URL(quoteCustomerHref('request-a', value), origin);
        assert.equal(url.searchParams.get('returnTo'), normalized);
        assert.equal(new URL(normalized, origin).pathname, new URL(value, origin).pathname);
    }
    for (const value of [null, undefined, '', 'https://foreign.example.invalid/admin', '//foreign.example.invalid/admin',
        '/\\foreign.example.invalid/admin', 'javascript:alert(1)', '/admin/login', '/api/auth/logout',
        '/admin/customer-workspace/quote/other', '/admin/reservations\r\nLocation: https://foreign.example.invalid']) {
        assert.equal(customerWorkspaceReturnTo(value), '/admin/reservations');
        if (value) assert.equal(new URL(productCustomerHref('booking-a', value), origin).searchParams.get('returnTo'), '/admin/reservations');
    }
});

const quoteBundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/components/admin/quoteDesk.ts', import.meta.url))],
    bundle: true, format: 'cjs', platform: 'node', write: false,
    plugins: [{ name: 'no-live-quote-api', setup(builder) {
        builder.onResolve({ filter: /\/lib\/api$/ }, () => ({ path: 'api', namespace: 'workspace-routing-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'workspace-routing-test' }, () => ({ loader: 'js', contents: 'export const api = {};' }));
    } }],
});
const module = { exports: {} };
vm.runInNewContext(quoteBundle.outputFiles[0].text, { module, exports: module.exports });

test('기존 견적 예약 진입 helper도 새 고객 전용 주소로 연결하며 고객/관리자 토큰을 URL에 넣지 않는다', () => {
    for (const id of ['request-a', '동일 ID /?#%']) {
        const href = module.exports.quoteBookingHref(id);
        assert.equal(href, quoteCustomerHref(id));
        const url = new URL(href, origin);
        assert.equal(url.searchParams.get('token'), null); assert.equal(url.searchParams.get('t'), null);
        assert.equal(url.searchParams.get('adminToken'), null);
        assert.equal(matchRoutes(routes, url.pathname)[0].params.id, id);
    }
});
