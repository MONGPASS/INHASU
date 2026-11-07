import assert from 'node:assert/strict';
import test from 'node:test';
import { savedReservationPricing } from '../src/utils/savedReservationPricing.ts';

test('completion reads the saved split for both layouts, without using current product prices', () => {
    assert.deepEqual(savedReservationPricing({
        price_breakdown: { total: 100000, deposit: 100000, local: 0 },
        product: { pricePerPerson: 540000 },
    }), { total: 100000, deposit: 100000, local: 0 });
    assert.deepEqual(savedReservationPricing({
        priceBreakdown: { total: 300000, deposit: 0, local: 300000 },
    }), { total: 300000, deposit: 0, local: 300000 });
});

test('explicit saved zero amounts take priority over legacy aliases', () => {
    assert.deepEqual(savedReservationPricing({
        price_breakdown: { total: 0, deposit: 0, local: 0 },
        totalPrice: 100000, depositAmount: 50000, balanceAmount: 50000,
    }), { total: 0, deposit: 0, local: 0 });
});

test('legacy camel and database aliases retain their saved negotiated split', () => {
    assert.deepEqual(savedReservationPricing({ totalPrice: 200000, depositAmount: 60000, balanceAmount: 140000 }),
        { total: 200000, deposit: 60000, local: 140000 });
    assert.deepEqual(savedReservationPricing({ total_price: 200000, deposit_amount: 60000, balance_amount: 140000 }),
        { total: 200000, deposit: 60000, local: 140000 });
    assert.deepEqual(savedReservationPricing({ totalAmount: 200000, deposit: 60000 }),
        { total: 200000, deposit: 60000, local: 140000 });
});
