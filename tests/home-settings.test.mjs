// 홈의 테마 줄·추천 PICK 탭·혜택 배너 설정(src/components/home/homeSettings.ts)을 실제 코드로 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const code = buildSync({ entryPoints: [fileURLToPath(new URL('../src/components/home/homeSettings.ts', import.meta.url))], bundle: true, format: 'cjs', platform: 'node', write: false }).outputFiles[0].text;
const module = { exports: {} };
new Function('module', 'exports', code)(module, module.exports);
const { parseHomeSettings, serializeHomeSettings, slotProducts, slotLink, safeBandLink, defaultHomeSettings } = module.exports;

const categories = [{ id: 'gobi-desert', name: '고비사막' }, { id: 'horse-riding-tour', name: '승마 여행' }];
const products = [
    { id: 'a', name: '고비 4박 5일', category: '고비사막', tags: [] },
    { id: 'b', name: '테렐지 초원 여행', category: '중앙몽골', tags: [] },
    { id: 'c', name: '말타기 체험', category: 'horse-riding-tour', tags: [] },
];

test('저장한 적이 없거나 깨진 값이면 기본 문구·배너 3장을 쓴다', () => {
    for (const value of [null, '', '{not json', '[]', 42]) {
        const s = parseHomeSettings(value);
        assert.equal(s.themeRows.length, 2); assert.equal(s.pickTabs.length, 3); assert.equal(s.bands.length, 3);
        assert.equal(s.themeRows[1].title, '#초원질주 #몽골 승마 투어'); assert.equal(s.themeRows[0].categoryId, '');
    }
});

test('자리 수는 고정이고 빈 제목·이름은 기본값, 제목 없는 혜택 배너는 뺀다', () => {
    const s = parseHomeSettings({ themeRows: [{ title: ' ', sub: 'x', categoryId: 'gobi-desert' }, null, { title: '넘침' }], pickTabs: [{ label: '', categoryId: 'c' }],
        bands: [{ id: 'x', title: '' }, { id: 'y', title: '혜택', link: '/a', image: 7 }] });
    assert.equal(s.themeRows.length, 2); assert.equal(s.themeRows[0].title, '지금 떠나기 좋은 겨울 몽골'); assert.equal(s.themeRows[0].categoryId, 'gobi-desert');
    assert.equal(s.themeRows[1].title, '#초원질주 #몽골 승마 투어');
    assert.equal(s.pickTabs[0].label, '겨울 한정'); assert.equal(s.pickTabs[0].categoryId, 'c');
    assert.deepEqual(s.bands.map(b => b.id), ['y']); assert.equal(s.bands[0].image, '');
    assert.deepEqual(parseHomeSettings(serializeHomeSettings(s)), s, '저장 후 다시 읽어도 같다');
    assert.equal(parseHomeSettings({ bands: [] }).bands.length, 0, '모두 지운 혜택 배너는 빈 채로 둔다');
});

test('카테고리를 고르면 그 카테고리 상품만, 안 고르거나 지워진 카테고리면 낱말로 묶는다', () => {
    assert.deepEqual(slotProducts(products, categories, 'gobi-desert', 'ride').map(p => p.id), ['a']);
    assert.deepEqual(slotProducts(products, categories, 'horse-riding-tour', 'winter').map(p => p.id), ['c'], '카테고리 id로 저장된 상품도 잡는다');
    assert.deepEqual(slotProducts(products, categories, '', 'ride').map(p => p.id), ['b', 'c'], '‘초원’·‘말타기’ 낱말');
    assert.deepEqual(slotProducts(products, categories, 'deleted', 'desert').map(p => p.id), ['a'], '지워진 카테고리는 자동');
    assert.equal(slotLink(categories, 'gobi-desert'), '/category/gobi-desert');
    assert.equal(slotLink(categories, ''), '/products');
});

test('혜택 배너 링크는 사이트 안 경로와 https만 쓴다', () => {
    assert.equal(safeBandLink('/custom-estimate'), '/custom-estimate');
    assert.equal(safeBandLink(' https://pf.kakao.com/x '), 'https://pf.kakao.com/x');
    for (const bad of ['//evil.example', 'javascript:alert(1)', 'http://x.com', 'products']) assert.equal(safeBandLink(bad), '', bad);
    assert.ok(defaultHomeSettings().bands.every(b => safeBandLink(b.link)), '기본 배너 링크는 모두 사용 가능');
});
