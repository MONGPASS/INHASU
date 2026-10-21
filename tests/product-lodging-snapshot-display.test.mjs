import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

const result = await build({ entryPoints: [fileURLToPath(new URL('../src/components/product/detail/ItineraryAccordion.tsx', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, external: ['react', 'react/jsx-runtime'], define: { 'import.meta.env.DEV': 'false' },
    loader: { '.jpg': 'empty', '.png': 'empty', '.webp': 'empty', '.css': 'empty' },
    plugins: [{ name: 'product-snapshot-query', setup(builder) {
        builder.onResolve({ filter: /^@tanstack\/react-query$/ }, () => ({ path: 'query', namespace: 'product-snapshot-test' }));
        builder.onResolve({ filter: /\/lib\/api$/ }, () => ({ path: 'api', namespace: 'product-snapshot-test' }));
        builder.onResolve({ filter: /\/common\/ResponsiveProductImage$/ }, () => ({ path: 'image', namespace: 'product-snapshot-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'product-snapshot-test' }, ({ path }) => ({ loader: 'js', contents: path === 'query'
            ? 'export const useQuery=options=>{globalThis.queryCalls.push(options);return {data:globalThis.live};};'
            : path === 'api' ? 'export const api={hotels:{get:async id=>{globalThis.lookups.push(id);return globalThis.live;}}};'
                : 'import {createElement} from "react";export const ResponsiveProductImage=props=>createElement("img",props);' }));
    } }],
});
function setup() {
    const module = { exports: {} };
    const context = vm.createContext({ module, exports: module.exports, require: createRequire(import.meta.url), queryCalls: [], lookups: [], live: { name_local: '변경된 이름', address: '변경된 주소', description: '변경된 소개', images: ['/changed-catalog.webp'] } });
    vm.runInContext(result.outputFiles[0].text, context);
    const render = info => renderToStaticMarkup(React.createElement(module.exports.ItineraryAccordion, { product: { name: '테스트 상품', itineraryBlocks: [{ id: 'saved-day', type: 'dayInfo', content: { dayLabel: '1일차', accommodation: '저장된 숙소', ...info } }] } }));
    return { context, render };
}

test('상품 상세는 명시적으로 비운 숙소 사진·소개를 공통 목록이나 이전 조회 캐시로 되살리지 않는다', () => {
    const { context, render } = setup();
    const html = render({ accommodationHotelId: 'resource-lodge:빈 대표사진', accommodationImages: [], accommodationDescription: '', accommodationAddress: '', accommodationSubtitle: '' });
    assert.equal(context.queryCalls.at(-1).enabled, false);
    assert.ok(!html.includes('/changed-catalog.webp')); assert.ok(!html.includes('변경된 소개')); assert.ok(!html.includes('변경된 주소')); assert.ok(!html.includes('변경된 이름'));
    assert.ok(html.includes('저장된 숙소'));
    const saved = render({ accommodationHotelId: 'resource-lodge:선택 당시 숙소', accommodationImages: ['/picked.webp'], accommodationDescription: '선택 당시 소개', accommodationAddress: '선택 당시 주소', accommodationSubtitle: '선택 당시 현지명' });
    assert.equal(context.queryCalls.at(-1).enabled, false); assert.ok(saved.includes('/picked.webp')); assert.ok(saved.includes('선택 당시 소개'));
    assert.ok(!saved.includes('변경된 소개')); assert.equal(context.lookups.length, 0);
});

test('snapshot이 없는 옛 상품 일정은 저장된 정확한 호텔 ID 조회를 유지한다', async () => {
    const { context, render } = setup();
    const id = 'legacy-hotel / #?';
    const html = render({ accommodationHotelId: id });
    assert.equal(context.queryCalls.at(-1).enabled, true); assert.ok(html.includes('변경된 소개')); assert.ok(html.includes('/changed-catalog.webp'));
    await context.queryCalls.at(-1).queryFn(); assert.deepEqual([...context.lookups], [id]);
});
