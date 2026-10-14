import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildProductQuote, mergeProductDays } from '../functions/lib/productItinerary.ts';

// The helper intentionally uses the real template defaults; bundle TSX and its
// static imports in memory rather than inventing a second defaults fixture.
const bundle = buildSync({
    entryPoints: [fileURLToPath(new URL('../src/utils/reservationInline.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', write: false,
    loader: { '.webp': 'dataurl', '.jpg': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl', '.css': 'empty' },
    define: { 'import.meta.env': '{}' },
}).outputFiles[0].text;
const module = { exports: {} };
new Function('require', 'module', 'exports', bundle)(createRequire(import.meta.url), module, module.exports);
const { createInlineDocument, applyQuoteSnippet, groupQuoteLibrary, quoteDayFields, updateQuoteDay, quoteDateForStart, fillQuoteDayDates, parseQuoteMove } = module.exports;

const product = { name: '정확히 예약한 상품', description: '실제 상품 소개', price: 1200000,
    included: JSON.stringify(['한국어 가이드', '예약 숙소']), excluded: ['국제선 항공권'],
    itinerary_blocks: [
        { type: 'dayInfo', content: { title: '테렐지 여행', heroImage: '/img/day.webp', meals: { breakfast: '조식' },
            accommodation: '기본 캠프', accommodationImages: ['/img/lodge.webp'] } },
        { type: 'timeline', content: { time: '09:30', title: '공항 픽업', description: '원본 픽업 설명', images: ['/img/pickup.webp'] } },
        { type: 'slide', content: { title: '은하수', description: '원본 밤하늘 설명', images: ['/img/night.webp'] } },
    ] };

test('최초 inline 문서만 실제 상품 일정·시간·사진·포함조건으로 초기화한다', () => {
    const doc = createInlineDocument(null, product, product.name);
    assert.equal(doc.days[0].activities[0].time, '09:30');
    assert.equal(doc.days[0].activities[0].description, '원본 픽업 설명');
    assert.deepEqual(doc.days[0].images, ['/img/day.webp']);
    assert.deepEqual(doc.days[0].activities[1].images, ['/img/night.webp']);
    assert.equal(doc.documentSettings.overview.includedText, '한국어 가이드\n예약 숙소');
    assert.equal(doc.documentSettings.contract.includedText, '한국어 가이드\n예약 숙소');
    assert.equal(doc.documentSettings.contract.excludedText, '국제선 항공권');
    assert.deepEqual(doc.highlights, []);
    assert.equal(doc.days[0].date, '');
    assert.equal(doc.days[0].dateMode, 'manual');
});

test('기존 고객 문서는 의도적으로 빈 일정·포함조건·명소와 추가 설정까지 그대로 복사한다', () => {
    const saved = { name: '고객 문서', description: '', days: [], highlights: [],
        documentSettings: { overview: { included: [], includedText: '', excludedText: '' }, contract: { intro: '고객 특약' } },
        extraCustomerSetting: { value: '보존' } };
    const copied = createInlineDocument(saved, product, product.name);
    assert.deepEqual(copied, saved);
    copied.documentSettings.contract.intro = '편집';
    assert.equal(saved.documentSettings.contract.intro, '고객 특약');
    assert.deepEqual(copied.days, []);
    assert.deepEqual(copied.highlights, []);
});

test('상품이 없으면 샘플 가격·포함조건·가짜 일정을 보충하지 않는다', () => {
    const doc = createInlineDocument(null, null, '예약 상품');
    assert.equal(doc.name, '예약 상품');
    assert.deepEqual(doc.days, []);
    assert.deepEqual(doc.documentSettings.overview.included, []);
    assert.equal(doc.documentSettings.overview.includedText, '');
    assert.equal(doc.documentSettings.overview.excludedText, '');
    assert.equal(doc.documentSettings.overview.pricePerPerson, '');
    assert.equal(doc.documentSettings.contract.includedText, '');
});

test('일정 조각 적용은 동일 활동의 시간·설명·사진과 DAY 사진을 보존한다', () => {
    const original = createInlineDocument(null, product, product.name).days[0];
    const applied = applyQuoteSnippet(original, { dest: '초원 탐방', move: '이동 2시간', dist: '(100 km)',
        items: ['은하수', '10:45 공항 픽업'], stay: { name: '확정 캠프', tags: ['샤워실', '난방'] }, meals: ['캠프식', '현지식', '한식'] });
    assert.equal(applied.day, original.day);
    assert.equal(applied.title, '초원 탐방');
    assert.equal(applied.move, '이동 2시간');
    assert.equal(applied.dist, '(100 km)');
    assert.equal(applied.activities[0].description, '원본 밤하늘 설명');
    assert.deepEqual(applied.activities[0].images, ['/img/night.webp']);
    assert.equal(applied.activities[1].time, '10:45');
    assert.equal(applied.activities[1].description, '원본 픽업 설명');
    assert.deepEqual(applied.activities[1].images, ['/img/pickup.webp']);
    assert.deepEqual(applied.images, ['/img/day.webp']);
    assert.equal(applied.accommodation.name, '확정 캠프');
    assert.deepEqual(applied.accommodation.images, ['/img/lodge.webp']);
    assert.equal(applied.accommodation.tags, '샤워실, 난방');
    assert.deepEqual(applied.meals, { breakfast: '캠프식', lunch: '현지식', dinner: '한식' });
    assert.equal(original.activities[0].time, '09:30');
    assert.equal(original.accommodation.name, '기본 캠프');
});

test('일정 조각에 없는 기존 활동과 해제된 숙소의 사진도 DAY 갤러리에 남는다', () => {
    const original = createInlineDocument(null, product, product.name).days[0];
    const applied = applyQuoteSnippet(original, { dest: '새 일정', items: [], stay: null, meals: [] });
    assert.deepEqual(applied.activities, []);
    assert.equal(applied.accommodation, null);
    assert.deepEqual(applied.images, ['/img/day.webp', '/img/pickup.webp', '/img/night.webp', '/img/lodge.webp']);
    assert.deepEqual(applied.meals, { breakfast: '', lunch: '', dinner: '' });
    assert.deepEqual(applyQuoteSnippet(original, null), original);
});

test('이름이 바뀐 조각 행은 같은 순서의 기존 활동 설명·시간·사진을 유지한다', () => {
    const original = createInlineDocument(null, product, product.name).days[0];
    const applied = applyQuoteSnippet(original, { dest: '새 목적지', items: ['공항 출발'], stay: { name: '', tags: [] } });
    assert.equal(applied.activities[0].time, '09:30');
    assert.equal(applied.activities[0].description, '원본 픽업 설명');
    assert.deepEqual(applied.activities[0].images, ['/img/pickup.webp']);
    assert.ok(applied.images.includes('/img/night.webp'));
    assert.equal(applied.accommodation.name, '');
    assert.equal(applied.accommodation.tags, '');
});

test('앞의 새 활동이 뒤쪽 동일 제목 활동의 설명·사진을 가져가지 않는다', () => {
    const original = createInlineDocument(null, product, product.name).days[0];
    const applied = applyQuoteSnippet(original, { dest: '새 일정', items: ['새 활동', '공항 픽업'] });
    assert.equal(applied.activities[1].description, '원본 픽업 설명');
    assert.equal(applied.activities[1].time, '09:30');
    assert.deepEqual(applied.activities[1].images, ['/img/pickup.webp']);
    assert.equal(applied.activities[0].description, '');
    assert.ok(applied.images.includes('/img/night.webp'));
});

test('견적 라이브러리를 실제 등록된 카테고리 순서로 묶고 실패 응답에는 샘플을 넣지 않는다', () => {
    const library = { '고비 일정': { cat: '고비', dest: '사막' }, '초원 명소': { region: '중앙', nameMn: 'Local' },
        '미분류 일정': { dest: '귀환' }, '잘못된 행': null, '빈 행': {}, '문자': 'bad' };
    const groups = groupQuoteLibrary(library, ['중앙', '고비', '고비', '없는 그룹']);
    assert.deepEqual(groups.map(group => group.name), ['중앙', '고비', '기타']);
    assert.equal(groups[1].items[0].name, '고비 일정');
    assert.equal(groups[1].items[0].value, library['고비 일정']);
    for (const invalid of [null, undefined, [], 'failed', { error: 'failed' }, { data: {} }]) assert.deepEqual(groupQuoteLibrary(invalid, []), []);
});

test('inline 이동·거리·선택 명소와 전체 사진·시간은 실제 고객 PDF 데이터까지 전달된다', () => {
    const doc = createInlineDocument(null, product, product.name);
    doc.days[0].move = '이동 3시간';
    doc.days[0].dist = '(180 km)';
    doc.highlights = [{ name: '거북바위', nameMn: 'Мэлхий хад', desc: '실제 선택한 명소\n상세 설명', img: '/img/spot.webp',
        subImgs: ['/img/detail-1.webp', '/img/detail-2.webp', '/img/detail-3.webp'] }];
    const reservation = { id: 'inline-check', product_name: product.name, start_date: '2026-10-20', end_date: '2026-10-22',
        travelers: 3, total_price: 3600000, deposit_amount: 360000, balance_amount: 3240000, document_content: JSON.stringify(doc) };
    const quote = buildProductQuote({ reservation, product, days: mergeProductDays(reservation, null, product), assignmentsVisible: true });
    assert.equal(quote.days[0].move, '이동 3시간');
    assert.equal(quote.days[0].dist, '(180 km)');
    assert.deepEqual(quote.highlights, doc.highlights);
    assert.equal(quote.detailDays[0].activities[0].time, '09:30');
    assert.deepEqual(quote.detailDays[0].activities[0].images, ['/img/pickup.webp']);
    assert.equal(quote.detailDays[0].activities[0].description, '원본 픽업 설명');
    assert.equal(quote.price.total, 3600000);
    doc.highlights = [];
    reservation.document_content = JSON.stringify(doc);
    assert.deepEqual(buildProductQuote({ reservation, product, days: doc.days, assignmentsVisible: true }).highlights, []);
});

test('견적 DAY 필드에는 기존 일정 설명·시간과 명시적인 빈 항목을 정확히 표시한다', () => {
    const day = createInlineDocument(null, product, product.name).days[0];
    day.summary = '안내 한 줄\n둘째 줄';
    assert.deepEqual(quoteDayFields(day).items, ['안내 한 줄', '둘째 줄', '09:30 공항 픽업', '은하수']);
    day.items = [];
    assert.deepEqual(quoteDayFields(day).items, []);
    day.dateMode = undefined;
    day.date = '2000-01-01';
    assert.equal(quoteDayFields(day).date, '', 'legacy automatic date is a placeholder, not a manual input value');
});

test('한줄씩 일정 수정은 강조·회색 문법과 기존 rich 설명·시간·사진을 함께 보존한다', () => {
    const day = createInlineDocument(null, product, product.name).days[0];
    day.summary = '이전 일정 안내';
    const lines = ['*09:45 공항 픽업', '(상황에 따라 이동시간이 달라집니다)', '은하수'];
    const edited = updateQuoteDay(day, { items: lines });
    assert.deepEqual(quoteDayFields(edited).items, lines);
    assert.equal(edited.summary, '');
    assert.equal(edited.retainedSummary, '이전 일정 안내');
    assert.equal(edited.activities[0].time, '09:45');
    assert.equal(edited.activities[0].description, '원본 픽업 설명');
    assert.deepEqual(edited.activities[0].images, ['/img/pickup.webp']);
    assert.equal(edited.activities[2].description, '원본 밤하늘 설명');
    assert.deepEqual(edited.activities[2].images, ['/img/night.webp']);
    assert.equal(day.activities[0].time, '09:30');
});

test('직접 입력에서 시간 접두사를 지우면 상세 PDF 시간도 지우고 조각 적용만 기존 시간을 유지한다', () => {
    const day = createInlineDocument(null, product, product.name).days[0];
    const lines = ['공항 픽업', '은하수'];
    const edited = updateQuoteDay(day, { items: lines });
    assert.deepEqual(edited.items, lines);
    assert.equal(edited.activities[0].time, '');
    assert.equal(edited.activities[0].description, '원본 픽업 설명');
    assert.deepEqual(edited.activities[0].images, ['/img/pickup.webp']);
    const reservation = { id: 'time-cleared-check', product_name: product.name, start_date: '2026-10-20',
        document_content: JSON.stringify({ days: [edited] }) };
    const quote = buildProductQuote({ reservation, product, days: mergeProductDays(reservation, null, product), assignmentsVisible: true });
    assert.deepEqual(quote.days[0].items, lines);
    assert.equal(quote.detailDays[0].activities[0].time, '');
    const imported = applyQuoteSnippet(day, { dest: day.title, items: lines });
    assert.equal(imported.activities[0].time, '09:30');
    assert.equal(day.activities[0].time, '09:30');
});

test('삭제한 일정 행은 고객에게 다시 노출되지 않고 원본 metadata로 복구할 수 있다', () => {
    const day = createInlineDocument(null, product, product.name).days[0];
    const cleared = updateQuoteDay(day, { items: [] });
    assert.deepEqual(cleared.items, []);
    assert.deepEqual(cleared.activities, []);
    assert.deepEqual(cleared.retainedActivities, day.activities);
    assert.ok(cleared.images.includes('/img/pickup.webp'));
    assert.ok(cleared.images.includes('/img/night.webp'));
    const restored = updateQuoteDay(cleared, { items: ['09:30 공항 픽업'] });
    assert.equal(restored.activities[0].time, '09:30');
    assert.equal(restored.activities[0].description, '원본 픽업 설명');
    assert.deepEqual(restored.activities[0].images, ['/img/pickup.webp']);
    assert.equal(restored.retainedActivities[0].title, '은하수');
});

test('숙소 한칸과 조·중·석 comma 필드는 순서대로 기존숙소 사진을 유지하며 저장한다', () => {
    const day = createInlineDocument(null, product, product.name).days[0];
    const edited = updateQuoteDay(day, { stay: { name: '변경된 캠프' }, meals: ['', '현지식', '한식'] });
    assert.deepEqual(edited.meals, { breakfast: '', lunch: '현지식', dinner: '한식' });
    assert.deepEqual(quoteDayFields(edited).meals, ['', '현지식', '한식']);
    assert.deepEqual(edited.accommodation.images, ['/img/lodge.webp']);
    assert.equal(quoteDayFields(edited).stay.name, '변경된 캠프');
    assert.deepEqual(edited.activities, day.activities);
    assert.deepEqual(parseQuoteMove('이동 6시간 (300 km)'), { move: '이동 6시간', dist: '(300 km)' });
    assert.deepEqual(parseQuoteMove(' 이동 30분 '), { move: '이동 30분', dist: '' });
    assert.deepEqual(parseQuoteMove(''), { move: '', dist: '' });
});

test('자유 날짜는 명시적으로 수정·자동 채우기 할 때만 문서에 반영된다', () => {
    const day = createInlineDocument(null, product, product.name).days[0];
    assert.equal(quoteDateForStart('2026-10-20', 0), '10.20(화)');
    assert.equal(quoteDateForStart('2026-10-20', 1), '10.21(수)');
    assert.equal(quoteDateForStart('2026-02-30', 0), '');
    assert.equal(day.date, '');
    const filled = fillQuoteDayDates([day, { ...day, day: 2 }], '2026-10-20');
    assert.deepEqual(filled.map(row => row.date), ['10.20(화)', '10.21(수)']);
    assert.ok(filled.every(row => row.dateMode === 'manual'));
    assert.equal(day.date, '');
    const manual = updateQuoteDay(filled[0], { date: '10.21 수요일 · 오전 출발' });
    assert.equal(quoteDayFields(manual).date, '10.21 수요일 · 오전 출발');
    assert.equal(updateQuoteDay(manual, { date: '' }).date, '');
    assert.deepEqual(fillQuoteDayDates([manual], ''), [manual]);
});

test('수동 날짜·빈 날짜·전체 raw 일정 행은 고객 PDF에서 재추론하거나 자르지 않는다', () => {
    const day = createInlineDocument(null, product, product.name).days[0];
    const lines = ['*확정 픽업 안내', '(날씨에 따라 장소 조정)', ...Array.from({ length: 8 }, (_, index) => `일정 ${index + 1}`)];
    const edited = updateQuoteDay(day, { date: '10.21 수요일', items: lines });
    const blank = updateQuoteDay(day, { date: '', items: [] });
    blank.day = 2;
    const doc = { days: [edited, blank] };
    const reservation = { id: 'compact-check', product_name: product.name, start_date: '2026-10-20', end_date: '2026-10-22', document_content: JSON.stringify(doc) };
    const days = mergeProductDays(reservation, null, product);
    const quote = buildProductQuote({ reservation, product, days, assignmentsVisible: true });
    assert.deepEqual(quote.days.map(row => row.date), ['10.21 수요일', '']);
    assert.deepEqual(quote.days[0].items, lines);
    assert.deepEqual(quote.days[1].items, []);
    assert.equal(quote.detailDays[0].date, '10.21 수요일');
    assert.equal(quote.detailDays[1].date, '');
});
