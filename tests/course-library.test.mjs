import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// 코스 관리(React) 계산을 묶어서 불러온다. 저장 형식은 옛 도구 public/코스관리.html과 같아야 한다.
const bundled = await build({
    entryPoints: ['src/components/admin/courseLibrary.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const m = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const plain = (value) => JSON.parse(JSON.stringify(value));

const gobi = {
    destination: '고비', nights: '4박5일', intensity: 4, vehicle: '스타렉스급', base: 1350000, note: '관리 메모(이 화면이 모르는 칸)',
    highlights: ['차강소브라가', '욜린암', '홍고린엘스'],
    price: { deposit: 50000, balances: [{ pax: 2, economy: 1300000, full: 1500000 }, { pax: 4, economy: 1100000, full: 1300000 }], options: [{ label: '게르 업그레이드', calc: '50,000원*1박' }], currency: 'KRW' },
    days: [
        { d: 1, dest: '울란바토르<br>차강소브라가', move: '이동 7시간', dist: '(420 km)', items: ['*가이드 접선', '(휴게소 점심)'], stay: { name: '여행자<br>캠프', tags: ['전기 O'], img: '/img/camp.webp' }, meals: ['', '현지식당', '캠프식'], images: ['/img/day1.webp'] },
        { d: 2, dest: '욜린암', move: '', dist: '', items: ['트레킹'], stay: { name: '캠프', tags: [] }, meals: ['캠프식', '현지식당', '캠프식', '간식'] },
    ],
};

test('편집 칸 → 저장: 고치지 않으면 저장 내용이 원래와 같다(사진·메모·<br>·네 번째 식사 칸 보존)', () => {
    const form = m.formFromCourse('고비 4박5일', gobi);
    assert.equal(form.days[0].dest, '울란바토르 / 차강소브라가');
    assert.equal(form.days[0].move, '이동 7시간 (420 km)');
    assert.equal(form.days[0].stay, '여행자 캠프');
    assert.deepEqual([form.days[0].breakfast, form.days[0].lunch, form.days[0].dinner], ['', '현지식당', '캠프식']);
    assert.deepEqual(form.balances.map((b) => [b.pax, b.economy, b.full]), [[2, '1300000', '1500000'], [4, '1100000', '1300000']]);
    assert.deepEqual(plain(m.courseFromForm(form, gobi)), plain({ ...gobi, base: 50000 + 1300000 }));
});

test('입력 규칙은 옛 도구와 같다: 목적지 “ / ”는 <br>, 이동은 마지막 괄호가 거리, 0원 잔금 줄은 빠지고 기본가는 예약금+최소 인원 실속형', () => {
    const form = m.formFromCourse('고비 4박5일', gobi);
    form.days[0] = { ...form.days[0], dest: '울란바토르 / 바양작', move: '이동 6시간 (300 km)', items: ' 출발 \n\n도착 ', breakfast: '호텔식' };
    form.balances = m.addBalance(form.balances, 3, '1200000', '');
    form.balances = m.addBalance(form.balances, 6, '0', '0');
    form.deposit = '100000';
    const saved = m.courseFromForm(form, gobi);
    assert.equal(saved.days[0].dest, '울란바토르<br>바양작');
    assert.deepEqual([saved.days[0].move, saved.days[0].dist], ['이동 6시간', '(300 km)']);
    assert.deepEqual(saved.days[0].items, [' 출발 ', '도착 '], '빈 줄만 빼고 옛 도구처럼 줄 그대로');
    assert.deepEqual(saved.days[0].meals, ['호텔식', '현지식당', '캠프식']);
    assert.deepEqual(saved.days[0].images, ['/img/day1.webp'], '이 화면이 모르는 일자 칸 보존');
    assert.deepEqual(saved.price.balances.map((b) => b.pax), [2, 3, 4], '0원 줄(6인)은 빠지고 인원 순');
    assert.equal(saved.price.balances[1].full, 0);
    assert.equal(saved.base, 100000 + 1300000);
    assert.equal(saved.price.currency, 'KRW', '요금의 다른 칸 보존');
    assert.equal(saved.note, gobi.note);
});

test('새 코스: 예약금 5만원·2~6인 빈 줄·하루 일정 한 칸으로 시작하고, 빈 잔금은 저장하지 않는다', () => {
    const form = m.formFromCourse('', undefined);
    assert.equal(form.deposit, '50000');
    assert.deepEqual(form.balances.map((b) => b.pax), [2, 3, 4, 5, 6]);
    assert.equal(form.days.length, 1);
    const saved = m.courseFromForm({ ...form, name: '새 코스', destination: ' 중앙 ' }, undefined);
    assert.deepEqual(plain(saved), {
        destination: '중앙', nights: '', intensity: 3, base: 0, price: { deposit: 50000, balances: [], options: [] }, vehicle: '', highlights: [],
        days: [{ d: 1, dest: '', move: '', dist: '', items: [], stay: { name: '', tags: [] }, meals: ['', '', ''] }],
    });
});

test('예전 형식(잔금 amount 한 칸)도 실속형·풀패키지 칸으로 읽는다', () => {
    const form = m.formFromCourse('옛 코스', { price: { deposit: 30000, balances: [{ pax: 2, amount: 900000 }] } });
    assert.deepEqual(form.balances.map((b) => [b.pax, b.economy, b.full]), [[2, '900000', '900000']]);
    const saved = m.courseFromForm(form, { price: { deposit: 30000, balances: [{ pax: 2, amount: 900000 }] } });
    assert.deepEqual(saved.price.balances, [{ pax: 2, economy: 900000, full: 900000 }]);
});

test('목록 거르기·정렬은 옛 도구와 같다(짧은 일정 먼저, 같으면 이름 순)', () => {
    const library = {
        '중앙 2박3일': { destination: '중앙', nights: '2박3일', intensity: 2, base: 600000, highlights: ['테를지'], days: [{}, {}, {}] },
        '고비 4박5일': { ...gobi },
        '홉스골 6박7일': { destination: '홉스골', nights: '6박7일', intensity: 3, base: 1500000, highlights: ['홉스골'], days: [] },
        '가나 3일': { destination: '중앙', intensity: 5, base: 400000, days: [{}, {}, {}] },
    };
    const names = (filter) => m.filterCourses(library, { ...m.EMPTY_FILTER, ...filter }).map(([name]) => name);
    assert.deepEqual(names({}), ['고비 4박5일', '가나 3일', '중앙 2박3일', '홉스골 6박7일'], '일자 배열 길이 순(고비 예시는 2일), 일자 없는 코스는 ‘6박7일’ 문구로 7일');
    assert.deepEqual(names({ query: '욜린' }), ['고비 4박5일'], '명소 이름으로도 찾는다');
    assert.deepEqual(names({ days: '3' }), ['가나 3일', '중앙 2박3일']);
    assert.deepEqual(names({ dest: '중앙' }), ['가나 3일', '중앙 2박3일']);
    assert.deepEqual(names({ highlight: '테를지' }), ['중앙 2박3일']);
    assert.deepEqual(names({ price: '500001-800000' }), ['중앙 2박3일']);
    assert.deepEqual(names({ intensity: '4-5' }), ['고비 4박5일', '가나 3일']);
    assert.deepEqual(names({ intensity: '3' }), ['홉스골 6박7일']);
    const choices = m.filterChoices(library);
    assert.deepEqual(choices.days, [2, 3]);
    assert.deepEqual(choices.dests, ['고비', '중앙', '홉스골']);
});

test('복제 이름·이름 바꾸기 자리·삭제', () => {
    const library = { A: { destination: 'x' }, 'A 복사본': {}, B: {} };
    const copied = m.duplicateCourse(library, 'A');
    assert.equal(copied.name, 'A 복사본 2');
    assert.deepEqual(copied.library['A 복사본 2'], { destination: 'x' });
    assert.notEqual(copied.library['A 복사본 2'], library.A, '복사본은 따로 고칠 수 있다');
    assert.deepEqual(Object.keys(m.putCourse(library, 'A', 'Z', {})), ['Z', 'A 복사본', 'B'], '이름을 바꿔도 자리 그대로');
    assert.deepEqual(Object.keys(m.removeCourse(library, 'B')), ['A', 'A 복사본']);
});

test('일정 불러오기·명소 고르기·일자 순서 바꾸기', () => {
    const groups = m.snippetGroups({ s1: { cat: '고비' }, s2: { cat: '' }, s3: { cat: '서부' }, s4: { cat: '중앙' }, s5: { cat: '고비' } }, ['중앙', '고비', '북부']);
    assert.deepEqual(groups, [{ group: '중앙', names: ['s4'] }, { group: '고비', names: ['s1', 's5'] }, { group: '서부', names: ['s3'] }, { group: '기타', names: ['s2'] }]);
    const day = m.dayFormFromSnippet({ dest: '욜린암<br>홍고린엘스', move: '이동 5시간', dist: '(250 km)', items: ['트레킹'], stay: { name: '캠프', tags: ['샤워 O'] }, meals: ['캠프식', '', '캠프식'] });
    assert.equal(day.dest, '욜린암 / 홍고린엘스');
    assert.equal(day.move, '이동 5시간 (250 km)');
    assert.equal(day.tags, '샤워 O');
    assert.equal(day.original, undefined, '불러온 일자는 원래 일자의 다른 칸을 이어받지 않는다(옛 도구와 같음)');
    assert.deepEqual(m.toggleHighlight(['a', 'b'], 'a'), ['b']);
    assert.deepEqual(m.toggleHighlight(['b'], 'c'), ['b', 'c']);
    const days = [m.blankDay(), m.blankDay(), m.blankDay()];
    assert.deepEqual(m.moveDay(days, 2, -1).map((d) => d.key), [days[0].key, days[2].key, days[1].key]);
    assert.equal(m.moveDay(days, 0, -1), days, '첫 일자는 위로 못 간다');
});

test('코스 관리 메뉴는 React 화면으로 열리고, 같은 자료(/api/data/courses)와 공유 견적 약속을 쓴다', async () => {
    const { readFileSync } = await import('node:fs');
    const app = readFileSync('src/App.tsx', 'utf8');
    const own = app.indexOf('path="/admin/quote-desk/courses"');
    assert.ok(own > 0 && own < app.indexOf('path="/admin/quote-desk/:tool?"'), '코스 관리 주소는 견적 도구 iframe보다 앞에서 잡는다');
    const page = readFileSync('src/pages/AdminCourseManage.tsx', 'utf8');
    assert.match(page, /mapKey: 'courses'/);
    assert.doesNotMatch(page, /catsKey/, '코스에는 지역 목록이 없다');
    assert.match(page, /quoteDeskPageId\('courses'\)/, '사이드바의 코스 관리 메뉴가 선택된다');
    assert.match(page, /'leaders_course_share'/, '견적서 만들기가 읽는 공유 견적 값(옛 도구와 같은 키)');
    assert.match(readFileSync('public/견적만들기.html', 'utf8'), /sessionStorage\.getItem\("leaders_course_share"\)/, '견적서 만들기가 그 값을 읽는다');
    assert.match(readFileSync('src/components/admin/quoteLibraryStore.ts', 'utf8'), /courses: 'leaders_courses'/, '옛 도구의 브라우저 캐시 키를 그대로 쓴다');
});

test('공통 저장 훅의 token()·isSaving()은 렌더마다 같은 함수다(effect 의존 값으로 써도 반복 조회하지 않는다)', async () => {
    const { readFileSync } = await import('node:fs');
    const hook = readFileSync('src/components/admin/useQuoteLibrary.ts', 'utf8');
    assert.match(hook, /const isSaving = useCallback\(/);
    assert.match(hook, /const currentToken = useCallback\(/);
    assert.doesNotMatch(hook, /token: \(\) => token\.current/);
});
