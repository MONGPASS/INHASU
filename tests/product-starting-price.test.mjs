import test from 'node:test';
import assert from 'node:assert/strict';
import { getProductPricedOptions, getProductStartingPrice } from '../src/utils/productStartingPrice.ts';

test('대표 가격은 인원별 최저 양수 가격과 실제 적용 인원을 함께 반환한다', () => {
    const product = { price: 1, originalPrice: 9999999, pricingOptions: [
        { people: 2, pricePerPerson: 700000 }, { people: 6, pricePerPerson: 400000 }, { people: 4, pricePerPerson: 500000 },
    ] };
    const before = structuredClone(product);
    assert.deepEqual(getProductStartingPrice(product), { price: 400000, people: 6, isTiered: true });
    assert.deepEqual(product, before);
});

test('동일한 최저 가격에는 더 작은 출발 인원을 선택하고 배열 순서에 의존하지 않는다', () => {
    const tiers = [{ people: 8, pricePerPerson: 400000 }, { people: 6, pricePerPerson: 400000 }, { people: 2, pricePerPerson: 600000 }];
    for (const pricingOptions of [tiers, [...tiers].reverse()]) assert.deepEqual(getProductStartingPrice({ pricingOptions }), { price: 400000, people: 6, isTiered: true });
});

test('레거시 snake_case·JSON·정수 문자열을 지원하며 명시적인 빈 camel 배열을 되살리지 않는다', () => {
    assert.deepEqual(getProductStartingPrice({ pricing_options: '[{"people":"6","price_per_person":"400000"}]' }), { price: 400000, people: 6, isTiered: true });
    assert.deepEqual(getProductStartingPrice({ pricingOptions: [], pricing_options: [{ people: 6, pricePerPerson: 400000 }], price: 400000 }), { price: null, people: null, isTiered: false });
});

test('비어 있거나 손상된 요금표는 별도 대표 가격으로 추정하지 않는다', () => {
    for (const pricingOptions of [undefined, null, [], '[]', '{broken', {}, '[null]', [{ people: 2, pricePerPerson: 0 }]]) {
        const result = getProductStartingPrice({ price: 500000, original_price: 900000, pricingOptions });
        assert.equal(result.price, null); assert.equal(result.people, null);
    }
    assert.deepEqual(getProductStartingPrice(null), { price: null, people: null, isTiered: false });
});

test('유효하지 않은 금액·인원은 제외하며 0원·음수·소수·불리언을 최저가로 노출하지 않는다', () => {
    const invalid = [0, -1, 1.5, null, '', ' ', true, '400,000', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1];
    const badPrices = invalid.map(pricePerPerson => ({ people: 2, pricePerPerson }));
    const badPeople = invalid.map(people => ({ people, pricePerPerson: 1 }));
    assert.deepEqual(getProductStartingPrice({ pricingOptions: [...badPrices, ...badPeople] }), { price: null, people: null, isTiered: true });
    assert.deepEqual(getProductStartingPrice({ pricingOptions: [...badPrices, ...badPeople, { people: 6, pricePerPerson: 400000 }] }), { price: 400000, people: 6, isTiered: true });
});

test('실제 예약 선택도 같은 유효한 양수 구간만 쓰고 별칭·분할 금액·원본을 보존한다', () => {
    const usable = { people: '6', price_per_person: '400000', deposit_per_person: '50000', local_payment_per_person: '350000', note: '등록한 설명' };
    const tiers = [null, { people: 0, pricePerPerson: 100 }, { people: 2, pricePerPerson: 0 }, usable, { people: 8, pricePerPerson: 350000, depositPerPerson: 0, localPaymentPerPerson: 350000 }];
    const before = structuredClone(tiers), options = getProductPricedOptions({ pricing_options: JSON.stringify(tiers) });
    assert.deepEqual(options, [{ ...usable, people: 6, pricePerPerson: 400000 }, tiers[4]]);
    assert.deepEqual(tiers, before);
    assert.notEqual(getProductPricedOptions({ pricingOptions: tiers })[1], tiers[4], '선택 목록은 원본 행을 수정하지 않는 사본');
    assert.deepEqual(getProductPricedOptions({ pricingOptions: [], pricing_options: [usable] }), []);
    assert.deepEqual(getProductPricedOptions({ pricingOptions: [{ people: 2, pricePerPerson: 0 }] }), []);
});
