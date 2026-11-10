import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCT_DEPOSIT_PER_PERSON } from '../src/constants/company.ts';
import { withAutomaticProductPricing } from '../src/utils/adminProductPricing.ts';
import { adminProductFromApi, productDraftFingerprint, writeAdminProductDraft, readAdminProductDraft } from '../src/utils/adminProductDraft.ts';

const tier = (pricePerPerson, extra = {}) => ({ people: 2, pricePerPerson, depositPerPerson: 540000, localPaymentPerPerson: 900000, ...extra });

test('상품 편집의 예약금은 1인 50,000원이고 낮은 총가격·0원은 초과하지 않는다', () => {
    assert.equal(PRODUCT_DEPOSIT_PER_PERSON, 50000);
    const form = { pricingOptions: [tier(0), tier(30000), tier(50000), tier(60000), tier(1000000)] };
    const normalized = withAutomaticProductPricing(form);
    assert.deepEqual(normalized.pricingOptions.map(row => [row.pricePerPerson, row.depositPerPerson, row.localPaymentPerPerson]), [
        [0, 0, 0], [30000, 30000, 0], [50000, 50000, 0], [60000, 50000, 10000], [1000000, 50000, 950000],
    ]);
});

test('인원별 행은 1인 가격 단위를 유지하며 과거 예약금·잔금을 교체한다', () => {
    const form = { pricingOptions: [tier(100000, { people: 2 }), tier(90000, { people: 4, depositPerPerson: 0 }), tier(80000, { people: 8 })] };
    const normalized = withAutomaticProductPricing(form);
    assert.deepEqual(normalized.pricingOptions.map(row => [row.people, row.depositPerPerson, row.localPaymentPerPerson]), [
        [2, 50000, 50000], [4, 50000, 40000], [8, 50000, 30000],
    ]);
    assert.equal(withAutomaticProductPricing(normalized), normalized, '같은 가격을 다시 계산해 불필요한 폼 변경을 만들지 않음');
});

test('유효한 숫자 문자열만 정규화하고 잘못된 가격·행을 임의의 0원으로 바꾸지 않는다', () => {
    const invalid = [null, false, true, '', ' ', '-1', '1.5', '50,000', '1e5', -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1];
    const rows = invalid.map(value => tier(value));
    const malformed = [null, false, '50000', ['50000']];
    const normalized = withAutomaticProductPricing({ pricingOptions: [...rows, ...malformed, tier('50000'), tier(' 60000 '), tier('0')] });
    for (let index = 0; index < rows.length + malformed.length; index++) {
        assert.equal(normalized.pricingOptions[index], [...rows, ...malformed][index], `잘못된 입력 ${index} 원본 유지`);
    }
    assert.deepEqual(normalized.pricingOptions.slice(-3).map(row => [row.pricePerPerson, row.depositPerPerson, row.localPaymentPerPerson]), [[50000, 50000, 0], [60000, 50000, 10000], [0, 0, 0]]);
});

test('상품 외의 필드·공통 자료·서버 기준값을 변경하지 않고 빈 요금표를 유지한다', () => {
    const product = { id: 'product', name: '편집한 상품', price: 123456, pricingOptions: [tier(100000)],
        itineraryBlocks: [{ id: 'day', type: 'dayInfo', content: { title: '저장된 일정' } }],
        accommodationOptions: [{ id: 'lodge', priceModifier: -10000 }],
        representativeSpots: [{ name: '선택한 여행지', img: '/picked.webp' }],
        savedReservation: { total: 1080000, deposit: 200000, local: 880000 } };
    const before = structuredClone(product), normalized = withAutomaticProductPricing(product);
    assert.notEqual(normalized, product); assert.notEqual(normalized.pricingOptions, product.pricingOptions);
    assert.deepEqual(product, before);
    for (const field of ['itineraryBlocks', 'accommodationOptions', 'representativeSpots', 'savedReservation']) assert.equal(normalized[field], product[field]);
    assert.equal(normalized.price, 100000, '상품 대표가격은 요금표에서 계산');
    for (const form of [{}, { pricingOptions: [] }, { pricingOptions: null }, { pricingOptions: 'broken' }]) assert.equal(withAutomaticProductPricing(form), form);
});

test('인원별 요금 변경·삭제 시 대표가격을 다시 계산하고 미등록 요금은 수동 가격으로 되살리지 않는다', () => {
    const initial = withAutomaticProductPricing({ price: 9999999, pricingOptions: [tier(500000), tier(400000, { people: 6 })] });
    assert.equal(initial.price, 400000);
    const edited = withAutomaticProductPricing({ ...initial, pricingOptions: [initial.pricingOptions[0]] });
    assert.equal(edited.price, 500000);
    assert.equal(withAutomaticProductPricing({ ...edited, pricingOptions: [] }).price, 0);
    assert.equal(withAutomaticProductPricing({ price: 9999999 }).price, 0);
});

test('기존 초안을 복원한 뒤 전체 폼에 같은 자동 계산을 적용하되 충돌 기준은 저장 원본을 유지한다', () => {
    const baseline = adminProductFromApi({ id: 'saved', name: '원본 상품', updated_at: '2026-10-23T01:00:00Z', pricing_options: JSON.stringify([tier(120000)]) });
    const original = structuredClone(baseline), originalFingerprint = productDraftFingerprint(baseline);
    const draft = { ...baseline, name: '복원할 상품명', description: '작성 중인 설명', pricingOptions: [tier('160000', { people: 4, depositPerPerson: 0, localPaymentPerPerson: 0 })] };
    const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const scope = { userId: 'admin', productId: baseline.id };
    assert.equal(writeAdminProductDraft(storage, scope, baseline, draft).ok, true);
    const restored = readAdminProductDraft(storage, scope, baseline);
    assert.equal(restored.kind, 'draft'); assert.equal(restored.conflict, false);
    const normalized = withAutomaticProductPricing(restored.draft.form);
    assert.equal(normalized.name, '복원할 상품명'); assert.equal(normalized.description, '작성 중인 설명');
    assert.deepEqual(normalized.pricingOptions, [{ people: 4, pricePerPerson: 160000, depositPerPerson: 50000, localPaymentPerPerson: 110000 }]);
    assert.equal(restored.draft.baseFingerprint, originalFingerprint);
    assert.equal(productDraftFingerprint(baseline), originalFingerprint); assert.deepEqual(baseline, original);
    assert.notEqual(productDraftFingerprint(normalized), originalFingerprint, '계산을 적용한 편집 폼은 저장 기준과 구분');
});
