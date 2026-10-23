import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { priceRowsFromOptions } from '../src/components/product/designTemplates/pricing.ts';
import { productPricingIssues } from '../src/utils/productPricingValidation.ts';

const stale = { people: 2, pricePerPerson: 50000, depositPerPerson: 540000, localPaymentPerPerson: 0 };
const tier = (people, price, deposit, local) => ({ people, pricePerPerson: price, depositPerPerson: deposit, localPaymentPerPerson: local });

test('상품 인원별 표는 오래된 예약금을 총가격에 맞춰 계산하고 1인 기준을 유지한다', () => {
    assert.equal(priceRowsFromOptions([stale]), '2명일 때|50,000원|0원|50,000원');
    assert.equal(priceRowsFromOptions([{ people: '2', price_per_person: '50000', deposit_per_person: '540000', local_payment_per_person: '0' }]), '2명일 때|50,000원|0원|50,000원');
    assert.deepEqual(stale, tier(2, 50000, 540000, 0), 'rendering must not rewrite source product or historical documents');
    assert.equal(priceRowsFromOptions([tier(4, 800000, 200000, 600000), tier(2, 1000000, 300000, 700000)]),
        '2명일 때|300,000원|700,000원|1,000,000원\n4명일 때|200,000원|600,000원|800,000원');
});

test('0원은 예전 예약금·잔금으로 되살리지 않고, 알 수 없는 요금은 0원이나 샘플로 바꾸지 않는다', () => {
    assert.equal(priceRowsFromOptions([tier(2, 0, 540000, 200000)]), '2명일 때|0원|0원|0원');
    assert.equal(priceRowsFromOptions([tier(2, 50000, 0, 0)]), '2명일 때|0원|50,000원|50,000원');
    for (const amount of [undefined, null, NaN, Infinity, -1, 1.5]) {
        const output = priceRowsFromOptions([tier(2, amount, 10000, 20000)]);
        assert.equal(output, '2명일 때|요금 확인 필요|요금 확인 필요|요금 확인 필요');
    }
    assert.equal(priceRowsFromOptions([null]), '인원 확인 필요|요금 확인 필요|요금 확인 필요|요금 확인 필요');
    assert.equal(priceRowsFromOptions([]), undefined, 'products without configured tiers retain their existing authored price table');
});

const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const bundled = await build({ stdin: { contents: `
    export { DetailBlocks } from './src/components/product/detail/DetailParts';
    export { default as Desktop } from './src/components/product/designTemplates/HorseTrekTemplate';
    export { default as Mobile } from './src/components/product/designTemplates/HorseTrekMobileTemplate';
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', packages: 'external',
    jsx: 'automatic', write: false, loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } });
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled.outputFiles[0].text)(require, module, module.exports);
const nodes = root => !React.isValidElement(root) ? Array.isArray(root) ? root.flatMap(nodes) : []
    : [root, ...nodes(root.props.children)];

test('실제 상품 상세 PC·모바일 디자인 모두 상품 정본으로 같은 요금표를 렌더링한다', () => {
    const product = { id: 'local-price-regression', name: '합성 요금 상품', pricingOptions: [stale], detailBlocks: [
        { id: 'design', type: 'design', content: { templateId: 'horse-trek', values: { price_rows: '2명일 때|540,000원|0원|50,000원' } } },
    ] };
    for (const [compact, Component] of [[false, module.exports.Desktop], [true, module.exports.Mobile]]) {
        const design = nodes(module.exports.DetailBlocks({ product, compact })).find(node => node.props.valueOverrides);
        assert.ok(design, 'real DetailBlocks passes a canonical price override');
        assert.equal(design.props.variant, compact ? 'mobile' : 'desktop');
        const html = renderToStaticMarkup(React.createElement(Component, {
            instances: [{ id: '18 투어 가격', def: '18 투어 가격' }],
            v: key => design.props.valueOverrides[key] ?? (key === 'price_head' ? '참가 인원|예약금 (원)|잔금 (원)|1인당 합계 금액' : ''),
        }));
        assert.ok(html.includes('2명일 때'));
        assert.equal((html.match(/50,000원/g) ?? []).length, 2, 'deposit and per-person total both show 50,000');
        assert.ok(html.includes('0원'));
        assert.ok(!html.includes('540,000원'));
        assert.ok(!html.includes('100,000원'), 'a per-person table must not show the whole-team deposit');
    }
});

test('관리자는 모순된 인원별 요금을 저장하기 전에 수정해야 하며 입력값은 보존한다', () => {
    const rows = [structuredClone(stale), tier(3, 100000, 0, 100000), tier(4, 0, 0, 0)];
    const before = structuredClone(rows), errors = productPricingIssues(rows);
    assert.match(errors[0], /예약금이.*총가격보다 큽니다/);
    assert.equal(errors[1], null);
    assert.equal(errors[2], null);
    assert.deepEqual(productPricingIssues([{ people: '2', pricePerPerson: '100000', depositPerPerson: '20000', localPaymentPerPerson: '80000' }]), [null]);
    assert.deepEqual(rows, before);
    assert.match(productPricingIssues([tier(2, 100000, 20000, 0)])[0], /합계/);
    assert.match(productPricingIssues([tier(2, 100000, 20000, 80000), tier(2, 50000, 50000, 0)])[0], /중복/);
    for (const amount of [null, undefined, NaN, -1, 1.5]) assert.match(productPricingIssues([tier(2, amount, 0, 0)])[0], /정수/);
    assert.deepEqual(productPricingIssues(undefined), []);
});
