import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveBookingPricing } from '../src/utils/bookingPricing.ts';

const tier = (people = 2, price = 50000, deposit = 540000, local = 0) => ({ people, pricePerPerson: price, depositPerPerson: deposit, localPaymentPerPerson: local });
const price = (product, people = 2, ...ids) => resolveBookingPricing(product, people, ...ids).priceBreakdown;

test('낮아진 여행 총가격보다 오래된 예약금이 클 때 총액을 넘겨 입금하도록 안내하지 않는다', () => {
    const product = { pricingOptions: [tier()] }, before = structuredClone(product);
    assert.deepEqual(price(product), { total: 100000, deposit: 100000, local: 0 });
    assert.deepEqual(product, before);
});

test('정상 인원별 요금과 정확한 인원·하위·최소·최대 구간을 일관되게 선택한다', () => {
    const product = { pricingOptions: [tier(4, 400000, 50000, 350000), tier(2, 500000, 60000, 440000)] };
    assert.deepEqual(price(product, 2), { total: 1000000, deposit: 120000, local: 880000 });
    assert.equal(resolveBookingPricing(product, 3).baseOption.people, 2);
    assert.equal(resolveBookingPricing(product, 1).baseOption.people, 2);
    assert.equal(resolveBookingPricing(product, 8).baseOption.people, 4);
});

test('명시적 예약금·총금액 0과 없는 예약금의 유효한 잔금 보완을 구분한다', () => {
    assert.deepEqual(price({ pricingOptions: [tier(2, 50000, 0, 0)] }), { total: 100000, deposit: 0, local: 100000 });
    assert.deepEqual(price({ pricingOptions: [tier(2, 0, 540000, 0)] }), { total: 0, deposit: 0, local: 0 });
    assert.deepEqual(price({ pricingOptions: [{ people: 2, pricePerPerson: 100000, localPaymentPerPerson: 70000 }] }), { total: 200000, deposit: 60000, local: 140000 });
    assert.throws(() => price({ pricingOptions: [{ people: 2, pricePerPerson: 100000 }] }), /현지 잔금/);
    assert.throws(() => price({ pricingOptions: [{ people: 2, pricePerPerson: 100000, localPaymentPerPerson: 100001 }] }), /현지 잔금/);
});

test('숙소·차량 금액은 인원당 중복 가산하지 않고 최종 예약금과 잔금의 합계를 맞춘다', () => {
    const product = { pricingOptions: [tier(2, 100000, 50000, 50000)],
        accommodationOptions: [{ id: 'basic', priceModifier: 0 }, { id: 'hotel', isDefault: true, priceModifier: 30000 }],
        vehicleOptions: [{ id: 'van', priceModifier: -10000 }] };
    const result = resolveBookingPricing(product, 2);
    assert.equal(result.selectedAccomId, 'hotel'); assert.equal(result.selectedVehicleId, 'van');
    assert.deepEqual(result.priceBreakdown, { total: 220000, deposit: 100000, local: 120000 });
    assert.deepEqual(price(product, 2, 'basic', 'van'), { total: 190000, deposit: 100000, local: 90000 });
    assert.throws(() => price(product, 2, 'deleted'), /숙소 옵션/);
    assert.throws(() => price({ pricingOptions: [tier()], vehicleOptions: [] }, 2, '', 'deleted'), /차량 옵션/);
});

test('기존 snake_case·JSON 배열도 같은 계산을 쓰고 명시적인 빈 목록은 되살리지 않는다', () => {
    assert.deepEqual(price({ pricing_options: JSON.stringify([{ people: '2', price_per_person: '50000', deposit_per_person: '540000', local_payment_per_person: '0' }]),
        accommodation_options: JSON.stringify([{ id: 'stay', price_modifier: '0', is_default: 1 }]) }), { total: 100000, deposit: 100000, local: 0 });
    assert.throws(() => price({ pricingOptions: [], pricing_options: [tier()] }), /인원별 가격/);
    assert.throws(() => price({ pricing_options: 'broken' }), /인원별 가격/);
    assert.deepEqual(price({ pricing_options: JSON.stringify([tier()]), accommodation_options: null, vehicle_options: null }), { total: 100000, deposit: 100000, local: 0 });
});

test('비정상 금액·인원·음수 최종금액·중복 구간을 임의의 0원 견적으로 바꾸지 않는다', () => {
    for (const invalid of [NaN, Infinity, -1, 1.5, null, '', '50,000', true, Number.MAX_SAFE_INTEGER + 1]) {
        assert.throws(() => price({ pricingOptions: [tier(2, invalid)] }), /여행 금액/);
        assert.throws(() => price({ pricingOptions: [tier(2, 50000, invalid)] }), /예약금/);
    }
    for (const people of [0, -1, 1.5, Infinity, '2']) assert.throws(() => price({ pricingOptions: [tier()] }, people), /예약 인원/);
    assert.throws(() => price({ pricingOptions: [tier(), tier()] }), /인원별 가격/);
    assert.throws(() => price({ pricingOptions: [tier(2, Number.MAX_SAFE_INTEGER, 0)] }), /총 여행 금액/);
    assert.throws(() => price({ pricingOptions: [tier()], vehicleOptions: [{ id: 'v', priceModifier: -100001 }] }), /총 여행 금액/);
});
