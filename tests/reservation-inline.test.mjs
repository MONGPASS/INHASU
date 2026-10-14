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
const { createInlineDocument, applyQuoteSnippet, groupQuoteLibrary } = module.exports;

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
