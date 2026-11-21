import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// 여행지 관리(React) 계산을 묶어서 불러온다. 저장 형식은 옛 도구 public/명소관리.html과 같아야 한다.
const bundled = await build({
    entryPoints: ['src/components/admin/spotLibrary.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const m = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));

const white = {
    nameMn: 'Цагаан суварга', region: '고비', short: '‘하얀 탑’ 침식지형', aliases: ['화이트스투파', '차강 소브라가'],
    desc: '긴 설명', lat: 44.7, lng: 105.7, img: '/api/img/a.webp', subImgs: ['/api/img/b.webp', '', '', ''], mapNote: '추가 정보',
};

test('편집 칸 → 저장: 옛 도구와 같은 칸 이름, 고치지 않으면 그대로이고 이 화면이 모르는 칸도 남긴다', () => {
    const form = m.formFromSpot('차강소브라가', white);
    assert.equal(form.aliases, '화이트스투파, 차강 소브라가');
    assert.equal(form.lat, '44.7');
    assert.equal(form.subImgs.length, m.SUB_SLOTS);
    assert.deepEqual(m.spotFromForm(form, white), white, '아무것도 고치지 않으면 저장 내용이 원래와 같다');

    const edited = m.spotFromForm({ ...form, aliases: ' 미니고비, ,미니고비 ', lat: '', lng: 'abc', short: '  짧은 소개 ' }, white);
    assert.deepEqual(edited.aliases, ['미니고비'], '빈 이름·중복은 뺀다');
    assert.equal('lat' in edited, false, '좌표가 비면 칸을 저장하지 않는다');
    assert.equal('lng' in edited, false);
    assert.equal(edited.short, '짧은 소개');
    assert.equal(edited.mapNote, '추가 정보');

    const fresh = m.spotFromForm({ ...m.formFromSpot('', undefined, '중앙몽골'), name: '테를지' });
    assert.deepEqual(fresh, { nameMn: '', region: '중앙몽골', short: '', aliases: [], desc: '', img: '', subImgs: ['', '', '', ''] });
    assert.deepEqual(m.aliasList('가, 나 ,가'), ['가', '나'], '옛 자료의 쉼표 문자열도 읽는다');
});

test('사진 수: 대표 + 추가 사진을 합쳐 두 장보다 적으면 사진 필요', () => {
    assert.equal(m.photoCount(white), 2);
    assert.equal(m.needsPhoto(white), false);
    assert.equal(m.needsPhoto({ img: '/a.webp', subImgs: ['', ''] }), true);
    assert.equal(m.needsPhoto({ subImgs: ['/a.webp', '/b.webp'] }), false, '대표가 없어도 추가 사진 두 장이면 된다');
    assert.equal(m.countNeedsPhoto({ a: white, b: {}, c: { img: '/x' } }), 2);
});

test('거르기: 전체·지역·미분류·사진 필요와 이름·몽골어 지명·소개·다른 이름 검색', () => {
    const library = { 차강소브라가: white, 테를지: { region: '중앙몽골', short: '거북바위', img: '/t.webp' }, 공항: {} };
    assert.equal(m.filterSpots(library, m.ALL, '').length, 3);
    assert.deepEqual(m.filterSpots(library, '고비', '').map(([name]) => name), ['차강소브라가']);
    assert.deepEqual(m.filterSpots(library, m.NONE, '').map(([name]) => name), ['공항']);
    assert.deepEqual(m.filterSpots(library, m.PHOTO, '').map(([name]) => name), ['테를지', '공항']);
    assert.deepEqual(m.filterSpots(library, m.ALL, 'цагаан').map(([name]) => name), ['차강소브라가'], '몽골어 지명(대소문자 무시)');
    assert.deepEqual(m.filterSpots(library, m.ALL, '화이트').map(([name]) => name), ['차강소브라가'], '다른 이름');
    assert.deepEqual(m.filterSpots(library, m.ALL, '거북').map(([name]) => name), ['테를지']);
    assert.throws(() => m.readSpots([]));
    assert.deepEqual(m.readSpots(null), {});
});

test('지역: 여행지에만 있는 지역은 끝에 붙이고, 이름 바꾸기·삭제는 여행지를 함께 옮긴다(삭제해도 여행지는 남음)', () => {
    const library = { a: { region: '고비' }, b: { region: '홉스골' }, c: {} };
    assert.deepEqual(m.mergeRegions(library, ['중앙몽골', '고비', '고비']), ['중앙몽골', '고비', '홉스골']);
    const renamed = m.renameRegion(library, ['고비', '홉스골'], '고비', '남고비');
    assert.deepEqual(renamed.cats, ['남고비', '홉스골']);
    assert.equal(renamed.library.a.region, '남고비');
    const removed = m.deleteRegion(library, ['고비', '홉스골'], '고비');
    assert.deepEqual(removed.cats, ['홉스골']);
    assert.equal(removed.library.a.region, '');
    assert.equal(Object.keys(removed.library).length, 3);
    assert.deepEqual(Object.keys(m.putSpot({ a: {}, b: {}, c: {} }, 'b', 'B2', {})), ['a', 'B2', 'c'], '이름을 바꿔도 목록 자리는 그대로');
    assert.deepEqual(Object.keys(m.removeSpot({ a: {}, b: {} }, 'a')), ['b']);
});

test('문구 초안: 한 줄 소개는 비었거나 replaceShort일 때만, 다른 이름은 없는 것만, 새 여행지는 소개가 있을 때만', () => {
    const library = { 차강소브라가: white, 테를지: { region: '중앙몽골', short: '', aliases: '거북바위' } };
    const draft = { spots: {
        차강소브라가: { short: '새 소개', aliases: ['화이트스투파', '하얀탑'] },
        테를지: { short: '국립공원', aliases: '거북바위, 아리야발' },
        엘승타사르해: { short: '미니 사막', region: '중앙몽골', aliases: ['미니고비'] },
        별명만: { aliases: ['x'] },
        욜린암: { short: '얼음 협곡', replaceShort: true },
    } };
    const changes = m.copyChanges(draft, library);
    assert.deepEqual(changes, [
        { name: '차강소브라가', kind: 'aliases', aliases: ['하얀탑'] },
        { name: '테를지', kind: 'short', short: '국립공원', before: '' },
        { name: '테를지', kind: 'aliases', aliases: ['아리야발'] },
        { name: '엘승타사르해', kind: 'new', short: '미니 사막', aliases: ['미니고비'], region: '중앙몽골' },
        { name: '욜린암', kind: 'new', short: '얼음 협곡', aliases: [], region: '' },
    ]);
    assert.equal(m.copyChanges({ spots: { 차강소브라가: { short: '바꿈', replaceShort: true } } }, library)[0].kind, 'short');

    const applied = m.applyCopyChanges(library, ['중앙몽골'], changes);
    assert.deepEqual(applied.library.차강소브라가.aliases, ['화이트스투파', '차강 소브라가', '하얀탑']);
    assert.equal(applied.library.차강소브라가.desc, '긴 설명', '상세 설명은 바꾸지 않는다');
    assert.equal(applied.library.차강소브라가.img, white.img, '사진은 바꾸지 않는다');
    assert.deepEqual(applied.library.테를지.aliases, ['거북바위', '아리야발']);
    assert.equal(applied.library.엘승타사르해.desc, '미니 사막');
    assert.equal(m.needsPhoto(applied.library.엘승타사르해), true);
    assert.deepEqual(applied.cats, ['중앙몽골']);
    assert.equal(library.테를지.aliases, '거북바위', '원래 자료는 바꾸지 않는다');
});

test('여행지 관리 메뉴는 React 화면으로 열리고, 같은 자료(/api/data/spots·spot_cats)와 사진 올리기를 쓴다', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const own = app.indexOf('path="/admin/quote-desk/spots"');
    assert.ok(own > 0 && own < app.indexOf('path="/admin/quote-desk/:tool?"'), '여행지 관리 주소는 견적 도구 iframe보다 앞에서 잡는다');
    const page = readFileSync('src/pages/AdminSpotManage.tsx', 'utf8');
    assert.match(page, /mapKey: 'spots'/);
    assert.match(page, /catsKey: 'spot_cats'/);
    assert.match(page, /quoteDeskPageId\('spots'\)/, '사이드바의 여행지 관리 메뉴가 선택된다');
    assert.match(page, /\/spot-copy-draft\.json/);
    const store = readFileSync('src/components/admin/quoteLibraryStore.ts', 'utf8');
    assert.match(store, /\/api\/upload\?folder=images/, '옛 도구와 같은 사진 저장소에 올린다');
});
