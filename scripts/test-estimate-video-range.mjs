import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../functions/media/estimate-journey/journey.mp4.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { onRequestGet } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const asset = Uint8Array.from({ length: 100 }, (_, index) => index);
const request = (range, status = 200) => onRequestGet({
    request: new Request('https://example.com/media/estimate-journey/journey.mp4', { headers: range ? { Range: range } : {} }),
    next: async () => new Response(asset, { status, headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(asset.length) } }),
});
for (const [range, start, end] of [['bytes=0-9', 0, 9], ['bytes=50-', 50, 99], ['bytes=-10', 90, 99], ['bytes=95-200', 95, 99]]) {
    const response = await request(range);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('Content-Range'), `bytes ${start}-${end}/100`);
    assert.equal(response.headers.get('Content-Length'), String(end - start + 1));
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), asset.slice(start, end + 1));
}
for (const range of ['bytes=100-', 'bytes=20-10', 'bytes=-0', 'bytes=-', 'bytes=abc', 'bytes=0-1,4-5']) {
    const response = await request(range);
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('Content-Range'), 'bytes */100');
}
const full = await request();
assert.equal(full.status, 200);
assert.equal(full.headers.get('Accept-Ranges'), 'bytes');
assert.deepEqual(new Uint8Array(await full.arrayBuffer()), asset);
assert.equal((await request('bytes=0-9', 404)).status, 404);
console.log('Video byte ranges: 12 cases passed.');
