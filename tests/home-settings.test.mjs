// 홈의 테마 줄·추천 PICK 탭·혜택 배너 설정(src/components/home/homeSettings.ts)을 실제 코드로 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const code = buildSync({ entryPoints: [fileURLToPath(new URL('../src/components/home/homeSettings.ts', import.meta.url))], bundle: true, format: 'cjs', platform: 'node', write: false }).outputFiles[0].text;
const module = { exports: {} };
new Function('module', 'exports', code)(module, module.exports);
const { parseHomeSettings, serializeHomeSettings, slotProducts, slotLink, safeBandLink, defaultHomeSettings, youtubeId, videoThumb, safeVideoLink } = module.exports;

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

test('영상: 유튜브 주소에서 id를 꺼내 썸네일을 만들고, 링크는 https만 쓴다', () => {
    const id = 'dQw4w9WgXcQ';
    for (const url of [`https://www.youtube.com/watch?v=${id}&t=1s`, `https://youtu.be/${id}?si=x`, `https://m.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`, `https://youtube.com/live/${id}`]) {
        assert.equal(youtubeId(url), id, url);
    }
    for (const url of ['', 'not a url', 'https://www.youtube.com/@mongolia_inhasu', 'https://vimeo.com/12345', `https://evil.example/watch?v=${id}`]) assert.equal(youtubeId(url), '', url);
    assert.equal(videoThumb({ image: '', url: `https://youtu.be/${id}` }, 0), `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
    assert.equal(videoThumb({ image: '/api/images/a.webp', url: `https://youtu.be/${id}` }, 0), '/api/images/a.webp', '직접 올린 사진이 먼저');
    assert.match(videoThumb({ image: '', url: '' }, 1), /^\/img\/home\/v2\//, '링크가 없으면 기본 사진');
    assert.equal(safeVideoLink(' https://youtu.be/x '), 'https://youtu.be/x');
    for (const bad of ['http://youtu.be/x', 'javascript:alert(1)', '//youtu.be/x']) assert.equal(safeVideoLink(bad), '', bad);
});

test('영상 목록: 기본 4개, 제목 없는 영상은 빼고, 모두 지우면 빈 목록', () => {
    assert.equal(defaultHomeSettings().videos.length, 4);
    assert.ok(defaultHomeSettings().videos.every(v => v.url === ''), '기본은 모두 준비 중');
    const s = parseHomeSettings({ videos: [{ id: 'a', title: '승마', url: ' https://youtu.be/dQw4w9WgXcQ ' }, { id: 'b', title: ' ' }, 'x'] });
    assert.deepEqual(s.videos.map(v => v.id), ['a']); assert.equal(s.videos[0].url, 'https://youtu.be/dQw4w9WgXcQ');
    assert.equal(parseHomeSettings({ videos: [] }).videos.length, 0);
    assert.equal(parseHomeSettings({ bands: [] }).videos.length, 4, '영상을 저장한 적이 없으면 기본값');
});

test('혜택 배너 바탕색: #RRGGBB만 저장하고, 어두운 바탕이면 글자를 흰색으로', () => {
    const colors = buildSync({ entryPoints: [fileURLToPath(new URL('../src/components/home/bandColors.tsx', import.meta.url))], bundle: true, format: 'cjs', platform: 'node', write: false, jsx: 'automatic', packages: 'external' }).outputFiles[0].text;
    const m = { exports: {} };
    new Function('module', 'exports', 'require', colors)(m, m.exports, () => ({ jsx: () => null, jsxs: () => null }));
    const { normalizeBandColor, bandTextColors, BAND_PRESETS } = m.exports;
    assert.equal(normalizeBandColor(' #ffe4e1 '), '#FFE4E1');
    for (const bad of ['red', '#fff', '#12345g', 'url(x)', '#1234567']) assert.equal(normalizeBandColor(bad), '', bad);
    assert.equal(bandTextColors('#1E3A5F').title, '#ffffff', '어두운 남색');
    assert.equal(bandTextColors('#ECFDF7').title, '#212124', '옅은 민트');
    assert.ok(BAND_PRESETS.every(p => bandTextColors(p.color).title === '#212124'), '기본 색은 모두 밝은 바탕');
    const s = parseHomeSettings({ bands: [{ id: 'a', title: 'x', bg: '#fff1e8' }, { id: 'b', title: 'y', bg: 'javascript:1' }] });
    assert.deepEqual(s.bands.map(b => b.bg), ['#FFF1E8', '']);
    assert.ok(defaultHomeSettings().bands.every(b => b.bg === ''), '기본 배너는 기본 민트');
});
