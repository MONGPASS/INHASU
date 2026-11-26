import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// 견적서 만들기 화면(2026-11-26 디자인 ‘견적서 만들기 개선’)의 표시 계산 — 저장하는 견적 문서는 quote-builder.test.mjs가 따로 본다.
const load = async (entry) => {
    const out = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
};
const m = await load('src/components/admin/quoteBuilder.ts');
const v = await load('src/components/admin/quoteBuilderView.ts');

const state = (over = {}) => ({ ...m.emptyQuoteState({}), customer: '강민지', destination: '고비', pax: 2, ...over });
const day = (over = {}) => ({ ...m.emptyDay(1), ...over });

test('일차 날짜: 시작일에서 채운 날짜만 자리를 따라가고, 직접 적은 날짜는 그대로', () => {
    const days = [day({ date: '' }), day({ date: '첫날' }), day({ date: m.dayDateStr('2026-07-01', 2) })];
    const synced = v.syncDayDates(days, '2026-07-01');
    assert.deepEqual(synced.map(d => d.date), [m.dayDateStr('2026-07-01', 0), '첫날', m.dayDateStr('2026-07-01', 2)]);
    // 시작일을 바꾸면 자동 날짜만 새 날짜로
    const moved = v.syncDayDates(synced, '2026-07-05', '2026-07-01');
    assert.deepEqual(moved.map(d => d.date), [m.dayDateStr('2026-07-05', 0), '첫날', m.dayDateStr('2026-07-05', 2)]);
    // 시작일이 없으면 손대지 않는다
    assert.equal(v.syncDayDates(days, ''), days);
});

test('식사 칸은 조식·중식·석식 세 칸 배열과 쉼표 한 줄을 오간다', () => {
    assert.equal(v.mealsText(['x', '중식', '석식']), 'x, 중식, 석식');
    assert.deepEqual(v.mealsFromText('x, 중식, 석식'), ['x', '중식', '석식']);
    assert.deepEqual(v.mealsFromText('조식'), ['조식', '', '']);
    assert.deepEqual(v.mealsFromText('조식, 중식, 석식, 간식'), ['조식', '중식', '석식, 간식']);
});

test('코스 목록은 여행 기간과 맞는 코스가 먼저, 지역·검색으로 거른다', () => {
    const sorted = m.sortedCourses({
        '고비 4박5일': { destination: '고비', nights: '4박 5일' },
        '테를지 2박3일': { destination: '중앙몽골', nights: '2박 3일' },
        '홉스골 2박3일': { destination: '홉스골', days: [{}, {}, {}] },
    });
    const rows = v.courseRows(sorted, { region: 'all', query: '', length: '2박 3일' });
    assert.deepEqual(rows.map(r => [r.name, r.match]), [['테를지 2박3일', true], ['홉스골 2박3일', true], ['고비 4박5일', false]]);
    assert.deepEqual(v.courseRows(sorted, { region: '고비', query: '', length: '' }).map(r => r.name), ['고비 4박5일']);
    assert.deepEqual(v.courseRows(sorted, { region: 'all', query: '홉스골', length: '' }).map(r => r.name), ['홉스골 2박3일']);
    assert.deepEqual(v.courseRegions(sorted).map(r => [r.value, r.count]), [['all', 3], ['중앙몽골', 1], ['홉스골', 1], ['고비', 1]]);
});

test('고객 요청 반영: 명소·스타일·숙소·게르·차량을 지금 견적과 비교한다', () => {
    const ctx = { ...m.emptyContext(), fromReq: true, reqSpots: ['거북바위', '홍고린엘스'], reqVehicle: '스타렉스(6인)',
        reqProfile: { travelStyles: ['승마·액티비티', '휴양·힐링'], cityStay: '호텔(4성급)', gerStay: '고급 여행자 게르' } };
    const st = state({ spots: ['거북바위'], vehicle: '스타렉스 (6인)', roomType: m.ROOM_ECO,
        days: [day({ dest: '테를지', items: ['승마 트레킹'], stay: { name: '게르 캠프' } }), day({ dest: '울란바타르', stay: { name: '3성급 호텔' } })] });
    const items = v.requestItems(st, ctx);
    const mark = Object.fromEntries(items.map(i => [i.label, i.mark]));
    assert.deepEqual(mark, { '거북바위': 'ok', '홍고린엘스': 'warn', '승마·액티비티': 'ok', '휴양·힐링': 'info', '호텔(4성급)': 'warn', '고급 여행자 게르': 'warn', '스타렉스(6인)': 'ok' });
    assert.equal(items.find(i => i.label === '승마·액티비티').note, '1일차 일정에 포함');
    assert.equal(items.find(i => i.label === '거북바위').note, '대표 명소 1번');
    // 요청이 아닌 견적은 비교하지 않는다
    assert.deepEqual(v.requestItems(st, { ...ctx, fromReq: false }), []);
});

test('보내기 전 확인: 빈 일차·기간과 다른 일정 수·잔금 없는 인원을 할 일로 알린다', () => {
    const ctx = m.emptyContext();
    const st = state({ depart: '2026-07-01', return_: '2026-07-03', balances: [{ pax: 2, economy: 800000, full: 900000 }], spots: ['거북바위'],
        days: [day({ dest: '테를지' }), day({})] });
    const checks = Object.fromEntries(v.builderChecks(st, ctx, '').map(c => [c.key, c]));
    assert.equal(checks.basic.state, 'done');
    assert.equal(checks.course.note, '직접 작성');
    assert.equal(checks.days.state, 'todo');
    assert.equal(checks.days.note, '일정 2일 · 3일 필요');
    assert.equal(checks.price.state, 'done');
    assert.equal(checks.flight.state, 'optional');
    assert.equal(checks.request, undefined, '요청이 없으면 요청 반영 줄이 없다');
    const full = v.builderChecks({ ...st, days: [day({ dest: 'a' }), day({ dest: 'b' }), day({})], pax: 3 }, ctx, '고비 코스');
    const by = Object.fromEntries(full.map(c => [c.key, c]));
    assert.equal(by.days.note, '3일차 미작성');
    assert.equal(by.price.note, '3인 잔금 없음');
    assert.equal(by.course.note, '고비 코스');
});

test('금액 요약은 예약금 + 고른 숙소 잔금, 다른 숙소 총액도 함께', () => {
    const st = state({ deposit: 50000, pax: 2, balances: [{ pax: 2, economy: 850000, full: 950000 }] });
    assert.deepEqual(v.priceSummary(st), { full: false, balance: 850000, per: 900000, total: 1800000, deposit: 100000, rest: 1700000, otherTotal: 2000000 });
    assert.equal(v.priceSummary({ ...st, pax: 3 }), null);
    assert.equal(v.maskPhone('010-5717-7901'), '010-5717-7***');
    assert.equal(v.periodText({ depart: '2026-11-26', return_: '2026-11-28' }), '2026.11.26 – 11.28');
});
