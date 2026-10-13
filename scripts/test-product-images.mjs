import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/utils/productImage.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } });
const { productImageUrl, productImageSet, setImageTransformEnabled } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const path = '/api/images/product-details/example.webp';

// 기본값: 변환을 켜지 않으면 원본 주소를 그대로 쓴다 (존에서 Image Transformations 를 켜기 전에도 사진이 깨지지 않게)
assert.equal(productImageUrl(path, 248), path);
assert.equal(productImageSet(path), undefined);

// VITE_IMAGE_TRANSFORM=1 로 빌드했을 때의 동작
setImageTransformEnabled(true);
assert(productImageUrl(path, 248).includes('width=320,'));
assert(productImageUrl(path, 860).includes('width=960,'));
assert(productImageUrl(path, 20000).includes('width=1720,'));
assert(productImageUrl(path).includes('fit=scale-down/api/images/'));
assert(productImageUrl(path).startsWith('https://mongolia-milkyway.com/cdn-cgi/image/'));
assert.equal(productImageUrl(`https://mongolia-milkyway.com${path}`), productImageUrl(path));
assert.equal(productImageUrl(`https://branch.milkway-mongolia.pages.dev${path}`), productImageUrl(path));
// 다른 출처(옛 도메인 포함)의 사진은 변환하지 않는다 — 새 존이 원본을 가져올 수 없다
for (const src of ['data:image/png;base64,AA==', '/assets/logo.png', 'https://example.com/api/images/photo.png', `https://mongolryokou.com${path}`]) {
    assert.equal(productImageUrl(src), src);
    assert.equal(productImageSet(src), undefined);
}
assert.equal(productImageSet(path).split(', ').length, 6);
console.log('Product image URL and responsive source tests passed.');
