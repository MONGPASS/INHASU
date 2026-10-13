import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { imageUploadPlan } from '../src/utils/imageUploadPlan.ts';
import { productImageUrl, productImageSet, uploadedImageDimensions, setImageTransformEnabled } from '../src/utils/productImage.ts';
import { parseImageManifest, webpDimensions, variantMatches, rasterContentType } from '../functions/lib/imageVariants.ts';
import { onRequest } from '../functions/_middleware.js';

const ab = buffer => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

test('긴 상세 이미지는 높이 기준으로 축소하거나 자르지 않고 가로 폭과 전체 비율을 유지한다', () => {
    const long = imageUploadPlan(3000, 18000, 'product-details');
    assert.deepEqual([long.width, long.height, long.canEncode, long.variants], [1720, 10320, true, []]);
    assert.deepEqual([imageUploadPlan(900, 10000, 'product-details').width, imageUploadPlan(900, 10000, 'product-details').height], [900, 10000]);
    assert.equal(imageUploadPlan(900, 30000, 'product-details').canEncode, false);
    const photo = imageUploadPlan(4000, 3000, 'products');
    assert.deepEqual([photo.width, photo.height, photo.variants], [1920, 1440, [320, 640, 960, 1280]]);
    assert.deepEqual(imageUploadPlan(240, 160, 'products').variants, []);
    assert.throws(() => imageUploadPlan(0, 600, 'products'));
});

test('R2에 실제로 저장된 너비만 srcset으로 광고하고 원본 및 비공개·외부 주소는 유지한다', () => {
    setImageTransformEnabled(false);
    const src = '/api/images/products/abc_v1_1920x1440_320-640-960-1280.webp';
    const values = productImageSet(src).split(', ');
    assert.deepEqual(values.map(value => Number(value.match(/ (\d+)w$/)[1])), [320, 640, 960, 1280, 1920]);
    assert.equal(productImageUrl(src, 220), src.replace('.webp', '.w320.webp'));
    assert.equal(productImageUrl(src, 860), src.replace('.webp', '.w960.webp'));
    assert.equal(productImageUrl(src, 3000), src);
    assert.deepEqual(uploadedImageDimensions(src), { width: 1920, height: 1440 });
    assert.equal(productImageUrl(`https://feature.inhasu.pages.dev${src}`, 600), `https://feature.inhasu.pages.dev${src.replace('.webp', '.w640.webp')}`);
    const long = '/api/images/product-details/abc_v1_900x10000_none.webp';
    assert.equal(productImageSet(long), `${long} 900w`);
    for (const unsafe of ['/api/file/uploads/private.jpg', '/api/images/products/old.webp', 'https://example.com' + src, src.replace('320-640-960-1280', '320-450')]) {
        assert.equal(productImageUrl(unsafe, 220), unsafe);
        assert.equal(productImageSet(unsafe), undefined);
        assert.equal(uploadedImageDimensions(unsafe), undefined);
    }
});

test('유손실·무손실·알파 WebP 실제 헤더에서 너비를 읽고 거짓 축소본 크기를 거부한다', async () => {
    for (const options of [{ quality: 82 }, { lossless: true }, { quality: 82, alphaQuality: 90 }]) {
        const input = { create: { width: 1200, height: 800, channels: 4, background: { r: 10, g: 40, b: 70, alpha: options.alphaQuality ? 0.5 : 1 } } };
        const bytes = ab(await sharp(input).webp(options).toBuffer());
        const dims = webpDimensions(bytes);
        assert.deepEqual(dims, { width: 1200, height: 800 });
        const value = JSON.stringify({ version: 1, width: 1200, height: 800, widths: [960, 320, 640] });
        assert.deepEqual(parseImageManifest(value, dims).widths, [320, 640, 960]);
        assert.equal(rasterContentType('image/webp', bytes), 'image/webp');
        assert.throws(() => parseImageManifest(value.replace('1200', '1920'), dims));
        for (const bad of ['null', '1', '"bad"', '{']) assert.throws(() => parseImageManifest(bad, dims));
        assert.throws(() => parseImageManifest(JSON.stringify({ version: 1, width: 1200, height: 800, widths: [320, 320] }), dims));
        assert.throws(() => parseImageManifest(JSON.stringify({ version: 1, width: 1200, height: 800, widths: [1280] }), dims));
        assert.equal(variantMatches({ width: 320, height: 213 }, 320, parseImageManifest(value, dims)), true);
        assert.equal(variantMatches({ width: 320, height: 320 }, 320, parseImageManifest(value, dims)), false);
        assert.equal(webpDimensions(bytes.slice(0, 25)), null);
    }
    const disguised = ab(Buffer.from('<svg onload="alert(1)"></svg>'));
    assert.equal(rasterContentType('image/webp', disguised), null);
    assert.equal(rasterContentType('image/svg+xml', disguised), null);
});

test('공개 이미지 캐시만 보존하며 고객 첨부·JSON·실패 응답은 no-store이다', async () => {
    const run = async (path, status, type, cache = 'public, max-age=31536000, immutable') => onRequest({
        request: new Request('https://example.invalid' + path),
        next: async () => new Response(status === 304 ? null : 'body', { status, headers: { 'Content-Type': type, 'Cache-Control': cache } }),
    });
    for (const path of ['/api/images/products/a.webp', '/api/img/a.webp']) {
        for (const status of [200, 304]) assert.equal((await run(path, status, 'image/webp')).headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
        assert.equal((await run(path, 404, 'image/webp')).headers.get('Cache-Control'), 'no-store');
        assert.equal((await run(path, 200, 'text/html')).headers.get('Cache-Control'), 'no-store');
        assert.equal((await run(path, 200, 'image/svg+xml')).headers.get('Cache-Control'), 'no-store');
    }
    for (const path of ['/api/file/uploads/passport.png', '/api/my/private', '/api/products']) {
        assert.equal((await run(path, 200, 'image/png')).headers.get('Cache-Control'), 'no-store');
    }
    assert.equal((await run('/api/images/products/a.webp', 200, 'image/webp', 'private, max-age=10')).headers.get('Cache-Control'), 'no-store');
});

test('다중 사진 업로드는 두 개씩 처리하며 한 건 실패 후에도 대기 중 업로드를 계속한다', async () => {
    const bundled = buildSync({ entryPoints: [fileURLToPath(new URL('../src/utils/upload.ts', import.meta.url))], bundle: true, format: 'esm', write: false });
    const { uploadImage } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
    const previousFetch = globalThis.fetch;
    const pending = [];
    let active = 0, peak = 0;
    globalThis.fetch = async (_url, options) => {
        // GIF must keep its animated original, with no falsely advertised WebP variants.
        assert.equal(options.body.get('file').type, 'image/gif');
        assert.equal(options.body.has('imageManifest'), false);
        peak = Math.max(peak, ++active);
        return new Promise(resolve => pending.push(status => {
            active--;
            resolve(new Response(JSON.stringify(status === 200 ? { url: '/api/images/reviews/test.gif' } : { error: 'test upload failure' }), { status, headers: { 'Content-Type': 'application/json' } }));
        }));
    };
    try {
        const all = Promise.allSettled(Array.from({ length: 5 }, () => uploadImage(new File(['GIF89a'], 'animation.gif', { type: 'image/gif' }), 'reviews')));
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(pending.length, 2);
        pending.shift()(503);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(pending.length, 2, '실패 후에도 다음 업로드가 시작되어야 합니다.');
        while (pending.length) {
            pending.shift()(200);
            await new Promise(resolve => setImmediate(resolve));
        }
        const results = await all;
        assert.equal(peak, 2);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 4);
        assert.equal(results.filter(result => result.status === 'rejected').length, 1);
    } finally { globalThis.fetch = previousFetch; }
});
