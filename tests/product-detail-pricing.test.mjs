import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { getProductStartingPrice } from '../src/utils/productStartingPrice.ts';

const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const bundled = await build({ stdin: { contents: `
    import React from 'react';
    import { BookingCard } from './src/components/product/detail/DetailParts';
    import { useTourPricing } from './src/components/product/detail/productDetailData';
    export function DetailPrice({product}) {
        const pricing = useTourPricing(product);
        return <BookingCard product={product} pricing={pricing} onBook={()=>{}} />;
    }
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external',
    jsx: 'automatic', write: false, loader: { '.css': 'empty', '.webp': 'empty' }, define: { 'import.meta.env': '{}' } });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, module, module.exports);
const render = product => renderToStaticMarkup(React.createElement(module.exports.DetailPrice, { product }));

test('상세 예약 카드는 최저가의 인원이 아닌 실제 선택 인원의 1인 기본요금·합계를 표시한다', () => {
    const product = { id: 'priced', price: 9999999, originalPrice: 19999999, pricingOptions: [
        { people: 6, pricePerPerson: 400000, depositPerPerson: 50000, localPaymentPerPerson: 350000 },
        { people: 2, pricePerPerson: 500000, depositPerPerson: 50000, localPaymentPerPerson: 450000 },
    ] };
    assert.equal(getProductStartingPrice(product).price, 400000);
    const html = render(product);
    assert.match(html, /1인 기본요금.*?2명 기준/s);
    assert.match(html, /500,000원.*?\/ 1인/s);
    assert.match(html, /500,000원.*?× 2명.*?1,000,000원/s);
    assert.match(html, /옵션 추가요금.*?예약 단계에서 확인/s);
    assert.doesNotMatch(html, /9,999,999|19,999,999|OFF/);
    assert.doesNotMatch(html, /<button[^>]*disabled=""[^>]*>예약하기<\/button>/);
});

test('요금표 없는 상세는 예전 수동 판매가를 노출하거나 0원으로 예약시키지 않는다', () => {
    for (const pricingOptions of [undefined, [], [{ people: 2, pricePerPerson: 0 }], [{ people: 0, pricePerPerson: 100000 }]]) {
        const html = render({ id: 'unpriced', price: 500000, pricingOptions });
        assert.match(html, /요금 등록 필요/);
        assert.doesNotMatch(html, /500,000원|>0원</);
        assert.match(html, /<button[^>]*disabled=""[^>]*>예약하기<\/button>/);
    }
});

test('레거시 snake_case 인원별 요금도 대표가격과 선택 인원 기본요금을 일치시킨다', () => {
    const html = render({ id: 'legacy', price: 9999999, pricingOptions: [{ people: '6', price_per_person: '400000' }] });
    assert.match(html, /6명 기준/);
    assert.match(html, /400,000원.*?× 6명.*?2,400,000원/s);
    assert.doesNotMatch(html, /NaN|요금 등록 필요|9,999,999/);
});
