import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { productScheduleDays, mergeProductDays, loadProductDocument, buildProductQuote, hasProductSchedule, productItineraryPublished, documentImage } from '../functions/lib/productItinerary.ts';
import { productDocumentSections, escapeDocumentText } from '../public/product-itinerary.js';

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
