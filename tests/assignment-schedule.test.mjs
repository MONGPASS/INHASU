import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssignmentScheduleReader } from '../functions/lib/assignmentSchedule.ts';
import { mergeProductDays } from '../functions/lib/productItinerary.ts';

const product = { id: 'tour', itinerary_blocks: JSON.stringify([
    { type: 'dayInfo', content: { title: '상품 첫날', region: '중앙몽골', description: '초원 탐방' } },
    { type: 'timeline', content: { time: '10:00', title: '거북바위', phone: 'PRIVATE-PHONE' } },
    { type: 'dayInfo', content: { title: '상품 귀환' } },
]), itinerary_images: '[]' };
const fixture = () => {
    const queries = [], records = new Map([['products:tour', product], ['itinerary_templates:tpl', { id: 'tpl', days: JSON.stringify([{ day: 1, title: '템플릿 첫날', region: '고비' }]) }]]);
    return { queries, records, read: createAssignmentScheduleReader({ prepare(sql) { return { bind(id) { return { async first() {
        const table = sql.includes('FROM products') ? 'products' : 'itinerary_templates';
        queries.push(`${table}:${id}`); return records.get(`${table}:${id}`) || null;
    } }; } }; } }) };
};

test('고객별 일정의 제목·지역·공개 줄만 투영하고 빈 배열도 템플릿·상품보다 우선한다', async () => {
    const f = fixture(), row = { start_date: '2026-10-19T15:00:00.000Z', product_id: 'tour', itinerary_template_id: 'tpl',
        document_content: JSON.stringify({ days: [{ day: 1, title: '고객 첫날', region: '테를지', items: ['10:00 공항 픽업'],
            privateNote: 'PRIVATE-NOTE', phone: 'PRIVATE-PHONE', passport: 'PRIVATE-PASSPORT', images: ['PRIVATE-PHOTO'] }] }),
        daily_accommodations: JSON.stringify([{ day: 5, accommodation: { name: 'PRIVATE-STAY' } }]) };
    let result = await f.read('product', row);
    assert.equal(result.schedule.source, 'customer'); assert.deepEqual(result.schedule.days, [
        { day: 1, date: '2026-10-20', title: '고객 첫날', region: '테를지', summary: '10:00 공항 픽업' },
    ]); assert.ok(!JSON.stringify(result.schedule).includes('PRIVATE-')); assert.deepEqual(f.queries, []);
    result = await f.read('product', { ...row, document_content: '{"days":[]}' });
    assert.equal(result.schedule.source, 'customer'); assert.deepEqual(result.schedule.days, []); assert.deepEqual(f.queries, []);
});

test('선택 템플릿과 정확한 상품 ID만 사용하며 요청 안에서 같은 원본 조회를 재사용한다', async () => {
    const f = fixture();
    const template = await f.read('product', { start_date: '2026-12-31', itinerary_template_id: 'tpl', product_id: 'tour' });
    assert.equal(template.schedule.source, 'template'); assert.equal(template.schedule.days[0].title, '템플릿 첫날');
    assert.deepEqual(template.guards, [{ table: 'itinerary_templates', id: 'tpl', values: { days: f.records.get('itinerary_templates:tpl').days } }]);
    const [first, second] = await Promise.all([1, 2].map(() => f.read('product', { start_date: '2026-12-31', product_id: 'tour' })));
    assert.equal(first.schedule.source, 'product'); assert.equal(first.schedule.days[1].date, '2027-01-01');
    assert.equal(first.schedule.days[0].region, '중앙몽골'); assert.equal(first.schedule.days[0].summary, '초원 탐방\n10:00 거북바위');
    assert.deepEqual(first.schedule, second.schedule); assert.equal(f.queries.filter(q => q === 'products:tour').length, 1);
    assert.equal((await f.read('product', { product_name: '상품 첫날' })).schedule.source, 'none');
    assert.equal((await f.read('product', { product_id: 'missing', product_name: '상품 첫날' })).schedule.source, 'unavailable');
});

test('선택 원본이 손상되거나 사라져도 하위 원본과 배정 숙소를 일정으로 추측하지 않는다', async () => {
    const f = fixture();
    for (const row of [
        { document_content: '{', product_id: 'tour' },
        { document_content: '{"days":{}}', product_id: 'tour' },
        { itinerary_template_id: 'missing', product_id: 'tour' },
    ]) {
        const result = await f.read('product', row);
        assert.equal(result.schedule.source, 'unavailable'); assert.deepEqual(result.schedule.days, []); assert.equal(result.schedule.warnings.length, 1);
    }
    f.records.set('products:broken', { itinerary_blocks: '[{"type":"dayInfo","content":"{"}]' });
    assert.equal((await f.read('product', { product_id: 'broken' })).schedule.source, 'unavailable');
});

test('견적의 저장 확정 일정과 명시빈배열은 견적 초안보다 우선하고 사용하지 않는 손상 초안은 무시한다', async () => {
    const read = createAssignmentScheduleReader();
    for (const days of [[], [{ d: 1, dest: '확정 목적지', region: '고비', items: ['확정 줄'] }]]) {
        const result = await read('quote_booking', { data: JSON.stringify({ depart: '2026-10-20', booking: { days }, quote: '{' }) });
        assert.equal(result.schedule.source, 'booking'); assert.equal(result.schedule.days.length, days.length);
        if (days.length) assert.equal(result.schedule.days[0].summary, '확정 줄');
    }
    const fallback = await read('quote_booking', { data: { depart: '2026-10-20', quote: { days: [{ d: 1, dest: '견적 목적지' }] } } });
    assert.equal(fallback.schedule.source, 'quote'); assert.equal(fallback.schedule.days[0].title, '견적 목적지');
});

test('견적의 월일 요일 표기를 여행 연도와 연말 경계에 맞추되 명시 빈날짜·잘못된 일차는 보존하고 경고한다', async () => {
    const read = createAssignmentScheduleReader();
    const result = await read('quote_booking', { data: { depart: '2026-12-31', booking: { days: [
        { d: 1, date: '12.31(목)' }, { d: 2, date: '1.1(금)' }, { d: 3, date: '2027-01-01T15:00:00.000Z' },
        { d: 0, date: '' }, { d: 'invalid', date: 'garbage' },
    ] } } });
    assert.deepEqual(result.schedule.days.slice(0, 3).map(d => d.date), ['2026-12-31', '2027-01-01', '2027-01-02']);
    assert.equal(result.schedule.days[3].day, 0); assert.equal(result.schedule.days[3].date, '');
    assert.equal(result.schedule.days[4].day, 0); assert.equal(result.schedule.days[4].date, 'garbage');
    assert.ok(result.schedule.warnings.some(w => w.includes('일차 번호'))); assert.ok(result.schedule.warnings.some(w => w.includes('날짜')));
});

test('상품의 수동 날짜·빈날짜는 유지하며 자동 날짜는 고객 문서와 같은 영업일을 사용한다', async () => {
    const row = { start_date: '2026-10-19T15:00:00.000Z', document_content: JSON.stringify({ days: [
        { day: 1, title: '자동' }, { day: 2, dateMode: 'manual', date: '2026-10-24' }, { day: 3, dateMode: 'manual', date: '' },
    ] }) };
    const result = await createAssignmentScheduleReader()('product', row);
    assert.deepEqual(result.schedule.days.map(d => d.date), ['2026-10-20', '2026-10-24', '']);
    assert.match(result.schedule.warnings[0], /3일차.*날짜/);
    assert.deepEqual(mergeProductDays(row, null, null).map(d => d.date), ['2026-10-20', '2026-10-24', '']);
});
