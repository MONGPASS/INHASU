import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { clearAdminReads, invalidateAdminReads, peekAdminRead, readAdminCached, setAdminReadAccount } from '../src/lib/adminReadCache.ts';

afterEach(clearAdminReads);
const url = '/api/reservations';
const deferred = () => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

test('concurrent admin views share one request, but a later refresh still reads the server', async () => {
    setAdminReadAccount('admin-a');
    const pending = deferred(); let calls = 0;
    const load = () => { calls++; return pending.promise; };
    const first = readAdminCached(url, load), second = readAdminCached(url, load);
    await Promise.resolve(); assert.equal(calls, 1);
    pending.resolve([{ id: 'booking-a' }]);
    const [a, b] = await Promise.all([first, second]);
    a[0].id = 'changed locally';
    assert.equal(b[0].id, 'booking-a');
    assert.equal(peekAdminRead(url, 'admin-a')[0].id, 'booking-a');
    await readAdminCached(url, async () => { calls++; return [{ id: 'updated on server' }]; });
    assert.equal(calls, 2);
    assert.equal(peekAdminRead(url)[0].id, 'updated on server');
});

test('snapshots are opt-in, expire, and are isolated from local editor mutations', async () => {
    setAdminReadAccount('admin-a');
    const now = Date.now; let time = 1000;
    Date.now = () => time;
    try {
        await readAdminCached(url, async () => [{ id: 'a' }]);
        const value = peekAdminRead(url); value.sort(); value[0].id = 'local';
        const cached = await readAdminCached(url, async () => assert.fail('snapshot should satisfy opt-in read'), { preferSnapshot: true });
        assert.equal(cached[0].id, 'a');
        time += 60_000;
        assert.equal(peekAdminRead(url), undefined);
        const fresh = await readAdminCached(url, async () => [{ id: 'b' }], { preferSnapshot: true });
        assert.equal(fresh[0].id, 'b');
    } finally { Date.now = now; }
});

test('account switches and logout block reuse and late responses from the previous account', async () => {
    setAdminReadAccount('admin-a');
    const late = deferred();
    const request = readAdminCached(url, () => late.promise);
    setAdminReadAccount('admin-b');
    await readAdminCached(url, async () => [{ id: 'b' }]);
    late.resolve([{ id: 'private-a' }]); await request;
    assert.equal(peekAdminRead(url, 'admin-a'), undefined);
    assert.equal(peekAdminRead(url, 'admin-b')[0].id, 'b');
    const beforeLogout = deferred();
    const finishing = readAdminCached(url, () => beforeLogout.promise);
    clearAdminReads(); beforeLogout.resolve([{ id: 'private-b' }]); await finishing;
    assert.equal(peekAdminRead(url), undefined);
    setAdminReadAccount('admin-b'); assert.equal(peekAdminRead(url), undefined);
});

test('invalidation around a write prevents an earlier GET from becoming the next snapshot', async () => {
    setAdminReadAccount('admin-a');
    const old = deferred();
    const request = readAdminCached(url, () => old.promise);
    invalidateAdminReads();
    await readAdminCached(url, async () => [{ status: 'confirmed' }]);
    old.resolve([{ status: 'pending' }]); await request;
    assert.equal(peekAdminRead(url)[0].status, 'confirmed');
});

test('forced refresh supersedes an older pending request without letting its finally delete the new request', async () => {
    setAdminReadAccount('admin-a');
    const old = deferred(), latest = deferred();
    const first = readAdminCached(url, () => old.promise);
    const refresh = readAdminCached(url, () => latest.promise, { force: true });
    old.resolve(['old']); await first;
    const third = readAdminCached(url, () => assert.fail('must share latest pending refresh'));
    latest.resolve(['new']);
    assert.deepEqual(await refresh, ['new']); assert.deepEqual(await third, ['new']);
    assert.deepEqual(peekAdminRead(url), ['new']);
});

test('rejections are not cached or left pending, and credentials/documents never enter snapshots', async () => {
    setAdminReadAccount('admin-a');
    await assert.rejects(readAdminCached(url, async () => { throw new Error('offline'); }), /offline/);
    assert.equal(peekAdminRead(url), undefined);
    assert.deepEqual(await readAdminCached(url, async () => ['recovered']), ['recovered']);
    for (const privateUrl of ['/api/auth/quote-desk', '/api/documents/contract/customer-a', '/api/products#different']) {
        let calls = 0;
        await Promise.all([readAdminCached(privateUrl, async () => ++calls), readAdminCached(privateUrl, async () => ++calls)]);
        assert.equal(calls, 2); assert.equal(peekAdminRead(privateUrl), undefined);
    }
    clearAdminReads();
    await readAdminCached(url, async () => ['anonymous']);
    assert.equal(peekAdminRead(url), undefined);
});

test('the shipped API adapter deduplicates GETs, retains no-store credentials, and invalidates on edits and expired auth', async () => {
    const output = await build({ stdin: { contents: `
        export { api } from './src/lib/api';
        export { setAdminReadAccount, peekAdminRead, clearAdminReads } from './src/lib/adminReadCache';
    `, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false });
    const adapter = await import('data:text/javascript;base64,' + Buffer.from(output.outputFiles[0].text).toString('base64'));
    adapter.setAdminReadAccount('admin-a');
    const originalFetch = globalThis.fetch, slow = deferred();
    const calls = [];
    globalThis.fetch = async (path, options) => {
        calls.push({ path, options });
        if (options.method === 'PUT') return Response.json({ success: true });
        return slow.promise;
    };
    try {
        const first = adapter.api.reservations.list(), second = adapter.api.reservations.list();
        await Promise.resolve();
        assert.equal(calls.length, 1);
        assert.equal(calls[0].options.credentials, 'include');
        assert.equal(calls[0].options.cache, 'no-store');
        await adapter.api.products.update('product-a', { name: 'edited' });
        slow.resolve(Response.json([{ id: 'before-write' }]));
        await Promise.all([first, second]);
        assert.equal(adapter.peekAdminRead(url), undefined);
        globalThis.fetch = async () => Response.json([{ id: 'after-write' }]);
        await adapter.api.reservations.list();
        assert.equal(adapter.peekAdminRead(url)[0].id, 'after-write');
        globalThis.fetch = async () => Response.json({ error: 'expired' }, { status: 401 });
        await assert.rejects(adapter.api.reservations.list(), /expired/);
        assert.equal(adapter.peekAdminRead(url), undefined);
    } finally { globalThis.fetch = originalFetch; adapter.clearAdminReads(); }
});
