import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// 일정 관리(React) 계산을 묶어서 불러온다. 저장 형식은 옛 도구 public/일정관리.html과 같아야 한다.
const bundled = await build({
    entryPoints: ['src/components/admin/itinerarySnippets.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const m = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));

const desert = {
    cat: '고비', dest: '차강소브라가<br>욜린암', move: '이동 10시간', dist: '(600 km)',
    items: ['가이드 접선 후 여행시작', '(선셋투어, 모래썰매)', '*캠프파이어'],
    stay: { name: 'LV4.디럭스<br>숙소', tags: ['전기 O'], img: '/img/quote/lodge-lux.webp', desc: '숙소 설명' },
    meals: ['현지식당', '현지식당', '캠프식'], images: ['/img/home/1.webp'],
};

test('편집 칸 → 저장: 옛 도구와 같은 칸 이름·이동 나누기, 고치지 않은 칸(사진·설명·<br>)은 그대로', () => {
    const form = m.formFromSnippet('차강소브라가', desert);
    assert.equal(form.dest, '차강소브라가 욜린암');
    assert.equal(form.move, '이동 10시간 (600 km)');
    assert.equal(form.items, '가이드 접선 후 여행시작\n(선셋투어, 모래썰매)\n*캠프파이어');
    const saved = m.snippetFromForm(form, desert);
    assert.deepEqual(saved, desert, '아무것도 고치지 않으면 저장 내용이 원래와 같다');

    const edited = m.snippetFromForm({ ...form, dest: '욜린암', move: '이동 5시간 (250 km)', items: ' 출발 \n\n도착 ', tags: '샤워 O, , 인터넷 O', dinner: '' }, desert);
    assert.equal(edited.dest, '욜린암');
    assert.deepEqual([edited.move, edited.dist], ['이동 5시간', '(250 km)']);
    assert.deepEqual(edited.items, ['출발', '도착']);
    assert.deepEqual(edited.stay, { name: 'LV4.디럭스<br>숙소', tags: ['샤워 O', '인터넷 O'], img: '/img/quote/lodge-lux.webp', desc: '숙소 설명' });
    assert.deepEqual(edited.meals, ['현지식당', '현지식당', '']);
    assert.deepEqual(edited.images, ['/img/home/1.webp'], '사진 칸을 지우지 않는다');
    assert.deepEqual(m.splitMove('이동 3시간'), { move: '이동 3시간', dist: '' });
});

test('새 일정은 옛 도구와 같은 모양으로 저장되고, 이름을 바꿔도 목록 자리는 그대로', () => {
    const fresh = m.snippetFromForm({ ...m.formFromSnippet('', undefined, '중앙몽골'), name: '테를지', items: '거북바위' });
    assert.deepEqual(fresh, { cat: '중앙몽골', dest: '', move: '', dist: '', items: ['거북바위'], stay: { name: '', tags: [] }, meals: ['', '', ''] });
    const library = { a: { cat: '' }, b: { cat: '' }, c: { cat: '' } };
    assert.deepEqual(Object.keys(m.putSnippet(library, 'b', 'B2', { cat: 'x' })), ['a', 'B2', 'c']);
    assert.deepEqual(Object.keys(m.putSnippet(library, null, 'd', {})), ['a', 'b', 'c', 'd']);
    assert.deepEqual(Object.keys(m.removeSnippet(library, 'a')), ['b', 'c']);
});

test('지역: 일정에만 있는 지역은 목록 끝에 붙이고, 이름 바꾸기·삭제는 일정을 함께 옮긴다(삭제해도 일정은 남음)', () => {
    const library = { 사막: { cat: '고비' }, 호수: { cat: '홉스골' }, 공항: {} };
    assert.deepEqual(m.mergeCats(library, ['중앙몽골', '고비', '고비']), ['중앙몽골', '고비', '홉스골']);
    const renamed = m.renameCategory(library, ['고비', '홉스골'], '고비', '남고비');
    assert.deepEqual(renamed.cats, ['남고비', '홉스골']);
    assert.equal(renamed.library.사막.cat, '남고비');
    const removed = m.deleteCategory(library, ['고비', '홉스골'], '고비');
    assert.deepEqual(removed.cats, ['홉스골']);
    assert.equal(removed.library.사막.cat, '');
    assert.equal(Object.keys(removed.library).length, 3);
    assert.equal(m.categoryNameProblem(' ', []), 'empty');
    assert.equal(m.categoryNameProblem('미분류', []), 'reserved');
    assert.equal(m.categoryNameProblem('고비', ['고비']), 'duplicate');
    assert.equal(m.categoryNameProblem('고비', ['고비'], '고비'), null, '같은 이름 그대로는 문제 아님');
});

test('거르기: 전체·지역·미분류와 이름·목적지·숙소·세부 일정 검색', () => {
    const library = { 사막: desert, 호수: { cat: '홉스골', dest: '홉스골', items: ['보트'] }, 공항: { dest: '울란바토르', stay: { name: '시내 호텔' } } };
    assert.equal(m.filterSnippets(library, m.ALL, '').length, 3);
    assert.deepEqual(m.filterSnippets(library, '고비', '').map(([name]) => name), ['사막']);
    assert.deepEqual(m.filterSnippets(library, m.NONE, '').map(([name]) => name), ['공항']);
    assert.deepEqual(m.filterSnippets(library, m.ALL, '캠프파이어').map(([name]) => name), ['사막']);
    assert.deepEqual(m.filterSnippets(library, m.ALL, '시내').map(([name]) => name), ['공항']);
    assert.deepEqual(m.filterSnippets(library, m.ALL, '욜린암').map(([name]) => name), ['사막'], '<br>을 띄어쓰기로 보고 찾는다');
    assert.equal(m.countNone(library), 1);
    assert.throws(() => m.readLibrary([]));
    assert.throws(() => m.readCats([1]));
    assert.deepEqual(m.readLibrary(null), {});
});

test('일정 관리 메뉴는 React 화면으로 열리고, 같은 자료(/api/data/snippets·snippet_cats)를 쓴다', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const own = app.indexOf('path="/admin/quote-desk/itinerary"');
    assert.ok(own > 0 && own < app.indexOf('path="/admin/quote-desk/:tool?"'), '일정 관리 주소는 견적 도구 iframe보다 앞에서 잡는다');
    const page = readFileSync('src/pages/AdminItineraryManage.tsx', 'utf8');
    assert.match(page, /mapKey: 'snippets'/);
    assert.match(page, /catsKey: 'snippet_cats'/);
    assert.match(page, /quoteDeskPageId\('itinerary'\)/, '사이드바의 일정 관리 메뉴가 선택된다');
    const hook = readFileSync('src/components/admin/useQuoteLibrary.ts', 'utf8');
    assert.match(hook, /readQuoteLibrary\(mapKey/, '공통 저장 훅이 항목·지역 목록을 함께 읽는다');
    const store = readFileSync('src/components/admin/quoteLibraryStore.ts', 'utf8');
    assert.match(store, /base=/, '충돌 확인(?base=)을 보낸다');
    assert.match(store, /force=1/);
    assert.match(store, /leaders_snippets/, '옛 도구의 브라우저 캐시 키를 그대로 쓴다');
});
