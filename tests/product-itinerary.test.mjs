import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import { productScheduleDays, mergeProductDays, loadProductDocument, buildProductQuote, hasProductSchedule, productItineraryPublished, documentImage, normalizeRepresentativeSpots } from '../functions/lib/productItinerary.ts';
import { productDocumentSections, escapeDocumentText } from '../public/product-itinerary.js';
import { documentUrl, documentImageAttribute, documentTextWithoutBreaks } from '../public/document-safe.js';
import { productLodgingSnapshot } from '../src/utils/lodgingItinerarySnapshot.ts';

const reservation = { id: 'booking-uuid', product_id: 'tour-a', product_name: '고비 3일', customer_name: '테스트 고객',
    start_date: '2026-10-20', end_date: '2026-10-22', travelers: 3, total_price: 1234567, deposit_amount: 234567,
    balance_amount: 0, status: 'confirmed', created_at: '2026-10-13T12:00:00Z' };
const product = { main_images: '["/img/tour.jpg"]', included: '["가이드"]', excluded: '["항공권"]', itinerary_blocks: JSON.stringify([
    { type: 'dayInfo', content: { title: '고비', description: '사막 탐방', meals: { lunch: '현지식' } } },
    { type: 'timeline', content: { time: '10:00', title: '모래언덕', description: '일몰을 감상합니다.', images: ['/img/dune.jpg'] } },
    { type: 'slide', content: { title: '캠프', images: ['/img/camp.jpg'] } },
    { type: 'dayInfo', content: { title: '귀환' } },
]) };

test('상품의 DAY·타임라인·슬라이드 일정과 사진을 보존한다', () => {
    const days = productScheduleDays(product);
    assert.equal(days.length, 2);
    assert.equal(days[0].activities[0].time, '10:00');
    assert.deepEqual(days[0].activities[1].images, ['/img/camp.jpg']);
    assert.equal(days[0].meals.lunch, '현지식');
    assert.ok(hasProductSchedule(days));
});

test('공통 숙소 선택 snapshot의 출처·등급·지역·시설과 명시빈값을 고객 일정에 연결한다', () => {
    const selected = { id: 'resource-lodge:등록 숙소', name_kr: '등록 숙소', grade: '고급 게르', region: '중앙몽골',
        address: '저장된 실제 주소', occupancy: '2인실', images: [], description: '', amenities: ['온수', '식당'],
        roomAmenities: ['온수'], sharedFacilities: ['식당'], phone: 'PRIVATE-PHONE', operatingNotes: 'PRIVATE-ARCHIVE' };
    const snapshot = productLodgingSnapshot(selected);
    const selectedProduct = { itineraryBlocks: [{ type: 'dayInfo', content: { title: '초원', ...snapshot } }] };
    const days = mergeProductDays(reservation, null, selectedProduct);
    const stay = days[0].accommodation;
    assert.equal(stay.id, selected.id); assert.equal(stay.type, '고급 게르'); assert.equal(stay.region, '중앙몽골');
    assert.equal(stay.occupancy, '2인실'); assert.equal(stay.address, '저장된 실제 주소');
    assert.deepEqual(stay.images, []); assert.equal(stay.description, '');
    assert.deepEqual(stay.facilities, ['온수', '식당']); assert.deepEqual(stay.roomAmenities, ['온수']);
    stay.roomAmenities.push('문서에서 추가'); assert.deepEqual(snapshot.accommodationRoomAmenities, ['온수']);
    const q = buildProductQuote({ reservation, product: selectedProduct, days, assignmentsVisible: true });
    const lodge = q.booking.assign.lodges[0];
    assert.equal(lodge.address, '저장된 실제 주소'); assert.equal(lodge.region, '중앙몽골'); assert.equal(lodge.grade, '고급 게르');
    assert.equal(lodge.roomAmenities, '온수\n문서에서 추가'); assert.equal(lodge.sharedFacilities, '식당');
    assert.deepEqual(lodge.imgs, []); assert.equal(lodge.desc, ''); assert.ok(!JSON.stringify(q).includes('PRIVATE-'));
    const emptyProduct = { itineraryBlocks: [{ type: 'dayInfo', content: { title: '초원', ...productLodgingSnapshot({ id: selected.id, name_kr: selected.name_kr }) } }] };
    const empty = buildProductQuote({ reservation, days: mergeProductDays(reservation, null, emptyProduct), assignmentsVisible: true }).booking.assign.lodges[0];
    for (const field of ['address', 'region', 'grade', 'desc', 'roomAmenities', 'sharedFacilities']) assert.equal(empty[field], '');
    assert.deepEqual(empty.imgs, []);
    const legacyDays = productScheduleDays({ itineraryBlocks: [{ type: 'dayInfo', content: { accommodation: '옛 숙소', accommodationAddress: '옛 주소' } }] });
    const legacy = buildProductQuote({ reservation, days: legacyDays, assignmentsVisible: true }).booking.assign.lodges[0];
    assert.equal(legacy.region, '옛 주소'); assert.equal(legacy.address, '옛 주소');
    assert.equal(Object.hasOwn(legacy, 'roomAmenities'), false, '옛 기록에 없는 필드는 새 빈 snapshot으로 만들지 않는다');
});

test('예약 시작일로 날짜를 계산하고 날짜를 건너뛴 숙소 배정도 반영한다', () => {
    const days = mergeProductDays({ ...reservation, daily_accommodations: JSON.stringify([{ day: 3, accommodation: { name: '배정 숙소' } }]) },
        { days: [{ day: 1, title: '방문', date: '2000-01-01' }] }, product);
    assert.deepEqual(days.map(d => [d.day, d.date]), [[1, '2026-10-20'], [3, '2026-10-22']]);
    assert.equal(days[1].accommodation.name, '배정 숙소');
});

test('고객별 저장 일정은 템플릿과 상품보다 우선하며 빈 일정도 존중한다', () => {
    assert.deepEqual(mergeProductDays({ ...reservation, document_content: '{"days":[]}' }, { days: [{ title: '템플릿' }] }, product), []);
    assert.equal(mergeProductDays({ ...reservation, document_content: '{"days":[{"title":"고객 일정"}]}' }, null, product)[0].title, '고객 일정');
    assert.equal(hasProductSchedule([{ accommodation: { name: '숙소만 있음' } }]), false);
});

test('수동 DAY 날짜와 raw 견적 항목은 빈 값도 그대로이며 옛 자동 날짜는 예약일 기준이다', () => {
    const custom = { days: [
        { day: 1, title: '첫날', dateMode: 'manual', date: '10.21 수요일', items: ['*강조', '(회색 안내)'], activities: [] },
        { day: 2, title: '둘째날', dateMode: 'manual', date: '', items: [], activities: [{ title: '기존 rich 정보', images: ['/img/keep.webp'] }] },
        { day: 3, title: '옛 자동 날짜', date: '2000-01-01' },
    ] };
    const r = { ...reservation, document_content: JSON.stringify(custom) };
    const days = mergeProductDays(r, null, product);
    assert.deepEqual(days.map(day => day.date), ['10.21 수요일', '', '2026-10-22']);
    const q = buildProductQuote({ reservation: r, product, days, assignmentsVisible: false });
    assert.deepEqual(q.days[0].items, ['*강조', '(회색 안내)']);
    assert.deepEqual(q.days[1].items, []);
    assert.deepEqual(q.detailDays[1].activities[0].images, ['/img/keep.webp']);
    assert.ok(hasProductSchedule([{ items: ['초원 탐방'] }]));
});

test('동명 상품 조회 대신 예약된 상품 ID로 일정·포함사항을 가져온다', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec('CREATE TABLE products (id TEXT, name TEXT, itinerary_blocks TEXT); CREATE TABLE itinerary_templates (id TEXT, days TEXT, description TEXT);');
    raw.prepare('INSERT INTO products VALUES (?,?,?)').run('tour-b', reservation.product_name, '[]');
    raw.prepare('INSERT INTO products VALUES (?,?,?)').run('tour-a', reservation.product_name, product.itinerary_blocks);
    const db = { prepare: sql => ({ bind: (...args) => ({ first: async () => raw.prepare(sql).get(...args) }) }) };
    try {
        const loaded = await loadProductDocument(db, reservation);
        assert.equal(loaded.product.id, 'tour-a');
        assert.equal(loaded.days[0].title, '고비');
    } finally { raw.close(); }
});

const quote = (overrides = {}, extra = {}) => buildProductQuote({ reservation: { ...reservation, ...overrides }, product,
    days: mergeProductDays(reservation, null, product), brand: { company: '몽골리아 은하수' }, assignmentsVisible: false, ...extra });

test('팀 금액은 원 단위 그대로이며 잔금 0원을 다른 값으로 대체하지 않는다', () => {
    const q = quote();
    assert.equal(q.price.total, 1234567);
    assert.equal(q.price.deposit, 234567);
    assert.equal(q.price.balanceFinal, 0);
    assert.equal(quote({ balance_amount: null }).price.balanceFinal, 1000000);
    assert.equal(q.customer, reservation.customer_name);
    assert.equal(q.period, '2026-10-20 ~ 2026-10-22');
    assert.deepEqual(q.included, ['가이드']);
});

test('템플릿의 고객 안내와 상품 사진을 사용하고 샘플 표지는 넣지 않는다', () => {
    const q = quote({}, { template: { documentSettings: { overview: { includedText: '전용 차량\n숙소', excludedText: '' } } } });
    assert.deepEqual(q.included, ['전용 차량', '숙소']);
    assert.deepEqual(q.excluded, []);
    assert.equal(q.images.cover, '/img/tour.jpg');
    assert.equal(quote({}, { product: {}, days: [] }).images.cover, '');
});

test('고객 공개 전에는 가이드·차량 배정 정보가 문서에 들어가지 않는다', () => {
    const hidden = quote({ assigned_guide: '{"name":"가이드 비공개","phone":"010-private"}', contract_data: '{"vehicle":{"model":"비공개차량"}}' });
    assert.equal(hidden.booking.assign.guide.name, '');
    assert.equal(hidden.vehicle, '차량 배정 확인 중');
    const shown = quote({ assigned_guide: '{"name":"담당 가이드"}' }, { assignmentsVisible: true });
    assert.equal(shown.booking.assign.guide.name, '담당 가이드');
});

test('확정·공개가 모두 충족되어야 고객 문서를 열 수 있다', () => {
    assert.equal(productItineraryPublished(reservation), false);
    assert.equal(productItineraryPublished({ ...reservation, itinerary_url: '/documents/itinerary/id' }), true);
    for (const status of ['pending_payment', 'cancelled']) assert.equal(productItineraryPublished({ ...reservation, status, itinerary_url: 'issued' }), false);
});

test('상세 일정의 긴 설명·사진은 요약표 제한과 관계없이 모두 렌더링한다', () => {
    const description = '고비 상세 여행 설명 '.repeat(200);
    const images = ['/img/1.jpg', '/img/2.jpg', '/img/3.jpg', '/img/4.jpg', '/img/5.jpg'];
    const sections = productDocumentSections({ included: [], excluded: [], detailDays: [{ day: 1, title: '고비', activities: [{ title: '산책', description, images }] }] });
    for (const src of images) assert.ok(sections.details.includes(src));
    assert.ok(sections.details.includes('· 계속'));
    assert.equal(sections.details.match(/고비 상세 여행 설명/g).length >= 190, true);
});

test('문서의 고객 입력은 HTML로 실행되지 않고 위험한 이미지 URL은 제외한다', () => {
    const sections = productDocumentSections({ included: ['<script>alert(1)</script>'], excluded: [], detailDays: [{ day: 1, title: '<img src=x onerror=alert(1)>', activities: [{ title: '"악성"', images: ['javascript:alert(1)', '/img/real.jpg'] }] }] });
    assert.ok(sections.inclusions.includes('&lt;script&gt;'));
    assert.ok(!sections.details.includes('javascript:'));
    assert.ok(sections.details.includes('&lt;img'));
    assert.equal(documentImage('data:text/html,abc'), '');
    assert.equal(documentImage('//bad.example/a'), '');
    assert.equal(escapeDocumentText('"<&'), '&quot;&lt;&amp;');
});

test('상품 PDF는 저장한 이동·거리·명소 사진을 사용하며 빈 명소 선택을 재생성하지 않는다', () => {
    const custom = { days: [{ day: 1, title: '초원', move: '이동 2시간', dist: '(120 km)' }], highlights: [
        { name: '거북바위', nameMn: 'Мэлхий хад', desc: '<script>내용</script>', img: '/img/spot.webp',
            subImgs: ['/img/detail.webp', 'javascript:alert(1)', '/img/second.webp'] },
        { name: '', img: '/img/empty.webp' }, null,
    ] };
    const q = quote({ document_content: JSON.stringify(custom) }, { days: custom.days });
    assert.equal(q.days[0].move, '이동 2시간');
    assert.equal(q.days[0].dist, '(120 km)');
    assert.deepEqual(q.highlights, [{ name: '거북바위', nameMn: 'Мэлхий хад', desc: '<script>내용</script>',
        img: '/img/spot.webp', subImgs: ['/img/detail.webp', '/img/second.webp'] }]);
    custom.highlights = [];
    assert.deepEqual(quote({ document_content: JSON.stringify(custom) }, { product: { highlights: [{ name: '상품 기본 명소' }] } }).highlights, []);
});

test('대표 명소 정규화는 순서·설명·지역·사진을 보존하고 판매 포인트·손상된 자료를 추정하지 않는다', () => {
    const snapshots = [{ name: '거북바위', nameMn: 'Мэлхий хад', short: '초원 명소', region: '중앙', desc: '설명\n두 번째 줄',
        img: '/img/spot.webp', subImgs: ['/img/first.webp', 'javascript:alert(1)', '/img/second.webp'], ignored: 'discard' },
        { name: '고비 사막', img: 'javascript:alert(1)', subImgs: [] },
        { icon: 'star', title: '판매 포인트', description: '명소가 아님' }, null, { name: '  ' }];
    assert.deepEqual(normalizeRepresentativeSpots(JSON.stringify(snapshots)), [
        { name: '거북바위', nameMn: 'Мэлхий хад', short: '초원 명소', region: '중앙', desc: '설명\n두 번째 줄',
            img: '/img/spot.webp', subImgs: ['/img/first.webp', '/img/second.webp'] },
        { name: '고비 사막', img: '', subImgs: [] },
    ]);
    assert.equal(snapshots[0].subImgs.length, 3, 'source snapshot is never mutated');
    for (const value of [undefined, null, '{}', '{broken', 'failed', { name: '단일 객체' }]) assert.deepEqual(normalizeRepresentativeSpots(value), []);
});

test('미작성 고객 PDF만 상품 대표 명소를 상속하고 확정한 고객 snapshot과 빈 선택을 유지한다', () => {
    const selected = [{ name: '거북바위', nameMn: 'Мэлхий хад', short: '초원 명소', region: '중앙', desc: '상품 선택 설명',
        img: '/img/product-spot.webp', subImgs: ['/img/product-detail.webp'] }];
    const selectedProduct = { ...product, representative_spots: JSON.stringify(selected),
        highlights: [{ icon: 'star', title: '판매 포인트', description: '기존 홍보 문구' }] };
    assert.deepEqual(quote({}, { product: selectedProduct }).highlights, selected);
    assert.deepEqual(quote({}, { product: { ...product, representativeSpots: selected } }).highlights, selected);
    assert.deepEqual(quote({ document_content: JSON.stringify({ highlights: [] }) }, { product: selectedProduct }).highlights, []);
    assert.deepEqual(quote({ document_content: JSON.stringify({ highlights: null }) }, { product: selectedProduct }).highlights, [], 'an existing invalid selection field is not inferred from current product');
    const saved = [{ name: '고객 확정 명소', nameMn: '', desc: '확정 당시 설명', img: '/img/customer.webp', subImgs: [] }];
    assert.deepEqual(quote({ document_content: JSON.stringify({ highlights: saved }) }, { product: selectedProduct }).highlights, saved);
    assert.deepEqual(quote({}, { product: { ...product, highlights: selectedProduct.highlights } }).highlights, []);
});

// Execute the actual customer HTML's small render functions and assembly
// expression. This checks the shipped templates without a duplicate renderer.
const htmlSource = filename => fs.readFileSync(new URL(`../public/${filename}`, import.meta.url), 'utf8');
const declaration = (source, name) => {
    const start = source.indexOf(`const ${name} =`);
    assert.ok(start >= 0, `${name} declaration missing`);
    const end = source.slice(start).search(/;\r?\n/);
    assert.ok(end >= 0);
    return source.slice(start, start + end + 1);
};
const blockDeclaration = (source, name) => {
    const start = source.indexOf(`const ${name} =`);
    assert.ok(start >= 0, `${name} declaration missing`);
    const end = source.slice(start).search(/\r?\n\};/);
    assert.ok(end >= 0);
    return source.slice(start, start + end).trimEnd() + '\n};';
};
// These extraction tests exercise the product/plain-text branch and existing
// trusted formatting. Actual rich-HTML sanitization is checked in browser QA.
const documentBindings = {
    escapeQuoteDocumentText: escapeDocumentText,
    sanitizeDocumentHTML: value => String(value ?? ''),
    documentUrl, documentImageAttribute, documentTextWithoutBreaks,
};
const documentRenderer = (code, q) => new Function('Q', ...Object.keys(documentBindings), code)(q, ...Object.values(documentBindings));

for (const [device, filename, spotsVariable] of [
    ['PC', '확정일정표.html', 'pgSpots'], ['모바일', '확정일정표-모바일.html', 'secSpots'],
]) {
    test(`${device} 고객 PDF 명소 렌더러가 상품 설명을 텍스트로 표시하고 사진을 보존한다`, () => {
        const source = htmlSource(filename);
        const renderer = q => documentRenderer(
            `${declaration(source, 'esc')} ${declaration(source, 'rich')} ${declaration(source, 'ph')} ${declaration(source, 'spotBlock')} return spotBlock;`, q);
        const spot = { name: '<b>명소</b>', nameMn: '현지 이름', desc: '<img src=x onerror=alert(1)>\n두 번째 설명',
            img: '/img/spot.webp', subImgs: ['/img/one.webp', '/img/two.webp', '/img/three.webp'] };
        const productHtml = renderer({ source: 'product' })(spot);
        assert.ok(productHtml.includes('&lt;img src=x onerror=alert(1)&gt;<br>두 번째 설명'));
        assert.ok(!productHtml.includes('<img src=x'));
        assert.ok(productHtml.includes('&lt;b&gt;명소&lt;/b&gt;'));
        for (const photo of [spot.img, ...spot.subImgs]) assert.ok(productHtml.includes(photo));
        const quoteHtml = renderer({ source: 'quote' })({ ...spot, name: '기존 명소', desc: '<b>기존 견적 서식</b>' });
        assert.ok(quoteHtml.includes('<b>기존 견적 서식</b>'), 'existing quote formatting stays compatible');
    });

    test(`${device} 상품 PDF 조립에도 실제 선택 명소 화면이 포함된다`, () => {
        const source = htmlSource(filename);
        const assembly = source.match(/(?:document\.getElementById\("root"\)|root)\.innerHTML = productSections([\s\S]*?);\r?\n/);
        assert.ok(assembly);
        const expression = 'productSections' + assembly[1];
        const sections = [...new Set(expression.match(/\b(?:pg|sec)[A-Z]\w*/g))];
        const assemble = new Function(...sections, 'productSections', `return ${expression};`);
        const values = sections.map(name => name === spotsVariable ? '<section>선택한 명소 화면</section>' : '');
        assert.ok(assemble(...values, { details: '전체 일정 사진', inclusions: '포함 조건' }).includes('선택한 명소 화면'));
        assert.ok(assemble(...values, null).includes('선택한 명소 화면'));
    });

    test(`${device} 상품에 저장한 명소 사진과 빈 갤러리를 최신 라이브러리로 덮어쓰지 않는다`, async () => {
        const source = htmlSource(filename);
        const hydration = source.match(/if \(Q[^\n]*Array\.isArray\(Q\.highlights\)[^\n]*\) \{[\s\S]*?\n\}/);
        assert.ok(hydration);
        const hydrate = new Function('Q', 'fetch', `return (async () => { ${hydration[0]} })();`);
        let calls = 0;
        const libraryFetch = async () => { calls++; return Response.json({ ok: true, data: { '선택 명소': { img: '/img/new-library.webp', subImgs: ['/img/new-detail.webp'] } } }); };
        const savedProduct = { source: 'product', highlights: [{ name: '선택 명소', img: '/img/saved.webp', subImgs: [] }] };
        await hydrate(savedProduct, libraryFetch);
        assert.equal(calls, 0);
        assert.equal(savedProduct.highlights[0].img, '/img/saved.webp');
        assert.deepEqual(savedProduct.highlights[0].subImgs, []);
        const legacyQuote = { source: 'quote', highlights: [{ name: '선택 명소', img: '/img/old.webp', subImgs: [] }] };
        await hydrate(legacyQuote, libraryFetch);
        assert.equal(calls, 1);
        assert.equal(legacyQuote.highlights[0].img, '/img/new-library.webp');
    });

    test(`${device} 상품 일정표에 수동 날짜와 강조·회색 일정을 안전하게 표시한다`, () => {
        const source = htmlSource(filename);
        const dayRenderer = device === 'PC' ? 'dayRow' : 'dayCard';
        const helpers = device === 'PC' ? declaration(source, 'DAY_CUBE') : declaration(source, 'noBr');
        const render = q => documentRenderer(`${declaration(source, 'esc')} ${declaration(source, 'rich')} ${helpers}
            ${blockDeclaration(source, 'itemHtml')} ${blockDeclaration(source, dayRenderer)} return ${dayRenderer};`, q);
        const day = { d: 1, date: '10.21 <img src=x onerror=alert(1)>', dest: '초원 여행', move: '', dist: '',
            items: ['*확정 픽업', '(현지 상황에 따라 조정)'], stay: { name: '', tags: [] }, meals: ['', '', ''] };
        const html = render({ source: 'product' })(day, 0);
        assert.ok(html.includes('10.21 &lt;img src=x onerror=alert(1)&gt;'));
        assert.ok(!html.includes('<img src=x'));
        assert.ok(html.includes('color:#1C8571; font-weight:600;'));
        assert.ok(html.includes('color:#8A9895;'));
        assert.ok(!render({ source: 'product' })({ ...day, date: '' }, 0).includes('10.21'));
        assert.ok(!render({ source: 'quote' })(day, 0).includes('10.21'), 'legacy quote renderer is unchanged');
    });
}
