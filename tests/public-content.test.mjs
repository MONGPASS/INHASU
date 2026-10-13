import test from 'node:test';
import assert from 'node:assert/strict';
import { changedContentResource, isPublicContentQuery, notifyContentSaved, subscribeContentSaved } from '../src/lib/publicContent.ts';

test('only successful catalog mutation callers identify public content; uploads and customer data do not', () => {
    assert.equal(changedContentResource('/api/products/p1', 'PUT'), 'products');
    assert.equal(changedContentResource('/api/banners', 'put'), 'banners');
    assert.equal(changedContentResource('/api/products'), null);
    assert.equal(changedContentResource('/api/site-upload', 'POST'), null);
    assert.equal(changedContentResource('/api/reservations/private-customer', 'PUT'), null);
    assert.ok(isPublicContentQuery(['heroBannersDesktop']));
    assert.ok(isPublicContentQuery(['tourDetail', 'products']));
    assert.equal(isPublicContentQuery(['tourDetail', 'recentlyViewed']), false);
    assert.equal(isPublicContentQuery(['myPage', 'reservations']), false);
});

test('saved content signals refresh same and other tabs without transmitting form or customer payloads', () => {
    const previous = globalThis.window;
    const surface = new EventTarget();
    const written = [];
    surface.localStorage = { setItem: (key, value) => written.push({ key, value }) };
    globalThis.window = surface;
    try {
        let refreshes = 0;
        const unsubscribe = subscribeContentSaved(() => refreshes++);
        notifyContentSaved('products');
        assert.equal(refreshes, 1);
        assert.deepEqual(Object.keys(JSON.parse(written[0].value)).sort(), ['nonce', 'resource', 'savedAt']);
        const signal = new Event('storage');
        Object.assign(signal, { key: written[0].key, newValue: written[0].value });
        surface.dispatchEvent(signal);
        assert.equal(refreshes, 2);
        surface.localStorage.setItem = () => { throw new Error('storage unavailable'); };
        assert.doesNotThrow(() => notifyContentSaved('banners'));
        assert.equal(refreshes, 3);
        notifyContentSaved('reservations');
        assert.equal(refreshes, 3);
        unsubscribe();
        notifyContentSaved('products');
        assert.equal(refreshes, 3);
    } finally {
        if (previous === undefined) delete globalThis.window;
        else globalThis.window = previous;
    }
});
