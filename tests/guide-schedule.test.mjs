import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { guideOverlaps, sameGuide, overlapLabel } from '../src/utils/assignmentAvailability.ts';
import { activeBooking, coversDay, guideRows, laneBookings, monthDays, shiftMonth } from '../src/components/admin/guides/guideScheduleModel.ts';

const booking = (id, startDate, endDate, guide, extra = {}) => ({ key: `product:${id}`, id, source: 'product', status: 'confirmed', startDate, endDate, customerName: id,
    assignment: { guide: guide ? { id: guide.id || '', name: guide.name } : { id: '', name: '' } }, ...extra });
const oyuka = { id: 'g-oyuka', name: 'Oyuka' }, bilguun = { id: 'g-bilguun', name: 'Bilguun' };

test('가이드 겹침: 같은 날을 함께 쓰면 중복, 끝나는 날=시작하는 날이면 교대, 취소·보류·자기 자신은 제외', () => {
    const current = { id: 'now', source: 'product', startDate: '2026-12-10', endDate: '2026-12-13' };
    const rows = [
        booking('overlap', '2026-12-12', '2026-12-15', oyuka),
        booking('handover-before', '2026-12-07', '2026-12-10', oyuka),
        booking('handover-after', '2026-12-13', '2026-12-16', oyuka),
        booking('cancelled', '2026-12-11', '2026-12-12', oyuka, { status: 'cancelled' }),
        booking('on-hold', '2026-12-11', '2026-12-12', oyuka, { status: '보류' }),
        booking('other-guide', '2026-12-11', '2026-12-12', bilguun),
        booking('now', '2026-12-10', '2026-12-13', oyuka),
        booking('by-name', '2026-12-11', '2026-12-11', { name: ' oyuka ' }),
    ];
    const found = guideOverlaps(rows, oyuka, current).map(x => [x.booking.id, x.kind]);
    assert.deepEqual(found, [['overlap', 'overlap'], ['handover-before', 'handover'], ['handover-after', 'handover'], ['by-name', 'overlap']], '이름만 적힌 같은 가이드도 중복으로 본다');
    assert.deepEqual(guideOverlaps(rows, { name: 'OYUKA' }, current).map(x => x.booking.id).sort(), ['by-name', 'handover-after', 'handover-before', 'overlap'].sort(), '등록 ID가 없으면 공백·대소문자를 무시한 이름으로 비교');
    assert.deepEqual(guideOverlaps([booking('same-day', '2026-12-10', '2026-12-10', oyuka)], oyuka, { id: 'x', source: 'product', startDate: '2026-12-10', endDate: '2026-12-10' }).map(x => x.kind), ['overlap'], '같은 날 당일 투어 두 건은 중복');
    assert.equal(guideOverlaps(rows, oyuka, { id: 'x', source: 'product', startDate: 'garbage' }).length, 0, '기간을 알 수 없으면 판단하지 않는다');
    assert.equal(sameGuide({ id: 'a', name: 'X' }, { id: 'b', name: 'X' }), false, '등록 ID가 둘 다 있으면 ID가 우선');
    assert.equal(sameGuide({ name: 'Ganaa ' }, { id: 'g', name: 'ganaa' }), true);
    assert.equal(overlapLabel({ leadName: '정선아', startDate: '2026-06-21', endDate: '2026-06-28' }), '정선아 06.21~06.28');
});

test('배정 현황표: 달의 날짜, 이동, 줄 나누기, 중복 표시, 미등록 가이드 줄', () => {
    assert.equal(monthDays('2026-02').length, 28); assert.equal(monthDays('2028-02').length, 29); assert.equal(monthDays('2026-12').at(-1), '2026-12-31');
    assert.equal(shiftMonth('2026-12', 1), '2027-01'); assert.equal(shiftMonth('2027-01', -1), '2026-12');
    const days = monthDays('2026-12');
    const tours = [booking('a', '2026-11-28', '2026-12-03', oyuka), booking('b', '2026-12-03', '2026-12-06', oyuka), booking('c', '2026-12-05', '2026-12-08', oyuka), booking('d', '2026-12-29', '2027-01-02', oyuka)];
    const placed = laneBookings(tours, days, tours, oyuka).map(p => [p.booking.id, p.lane, p.from, p.to, p.overlap, p.startsBefore, p.endsAfter]);
    assert.deepEqual(placed, [
        ['a', 0, 0, 2, false, true, false],
        ['b', 1, 2, 5, true, false, false],
        ['c', 0, 4, 7, true, false, false],
        ['d', 0, 28, 30, false, false, true],
    ], 'a·b는 같은 날 교대라 다른 줄, b·c는 진짜 중복');
    assert.equal(coversDay(tours[1], '2026-12-04'), true); assert.equal(coversDay(tours[1], '2026-12-07'), false);
    assert.equal(activeBooking(booking('x', '2026-12-01', '2026-12-02', oyuka, { status: 'cancelled' })), false);
    assert.equal(activeBooking(booking('x', '2026-12-05', '2026-12-01', oyuka)), false, '역전된 기간');
    const rows = guideRows([oyuka, bilguun], [...tours, booking('e', '2026-12-10', '2026-12-12', { name: 'Davaa ah' }), booking('f', '2026-12-10', '2026-12-12', null)]);
    assert.deepEqual(rows.map(r => [r.guide.name, r.registered, r.bookings.length]), [['Oyuka', true, 4], ['Bilguun', true, 0], ['Davaa ah', false, 1]], '배정이 없는 등록 가이드도 줄을 갖고, 예약에만 있는 이름은 미등록 줄');
});

test('가이드 선택 메뉴: 빈 가이드 → 같은 날 교대 → 겹치는 가이드 순서, 겹침은 확인 후에만 배정', async () => {
    const out = await build({ entryPoints: [fileURLToPath(new URL('../src/components/admin/v7/guideMenuItems.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false,
        // 공통 확인 창은 화면 부품이라, 같은 약속(Promise<boolean>)의 대역으로 바꾼다.
        plugins: [{ name: 'feedback-stub', setup(b) {
            b.onResolve({ filter: /\/ui\/adminFeedback$/ }, () => ({ path: 'feedback', namespace: 'stub' }));
            b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ loader: 'js', contents: "export const adminConfirm=async m=>!!globalThis.window.confirm(typeof m==='string'?m:m.message);" }));
        } }] });
    const { guideMenuItems } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
    const current = { id: 'now', source: 'product', startDate: '2026-12-10', endDate: '2026-12-13' };
    const bookings = [booking('busy', '2026-12-11', '2026-12-12', { id: 'g-a', name: 'Araa' }), booking('swap', '2026-12-13', '2026-12-15', { id: 'g-b', name: 'Baagii' })];
    const picks = [];
    const items = guideMenuItems([{ id: 'g-a', name: 'Araa' }, { id: 'g-b', name: 'Baagii' }, { id: 'g-c', name: 'Zulaa' }], bookings, current, 'Baagii', (g, confirmed) => picks.push([g.name, confirmed]));
    assert.deepEqual(items.map(i => [i.label, i.subTone, i.on]), [['Zulaa', 'ok', false], ['Baagii', 'muted', true], ['Araa', 'warn', false]]);
    assert.match(items[1].sub, /같은 날 교대 · swap 12\.13~12\.15/); assert.match(items[2].sub, /일정 겹침 · busy 12\.11~12\.12/);
    const answers = [false, true];
    globalThis.window = { confirm: () => answers.shift() };
    try {
        await items[2].onPick(); await items[2].onPick(); await items[0].onPick();
    } finally { delete globalThis.window; }
    assert.deepEqual(picks, [['Araa', true], ['Zulaa', false]], '겹치는 가이드는 확인했을 때만, 확인했다는 표시와 함께 배정');
});

test('배정 현황표 줄: 예전 ID로 저장된 같은 이름은 등록 가이드 줄에 합치고, 미등록 이름은 그 달에 투어가 있을 때만 보인다', async () => {
    const { guideRows, matchesGuide, monthDays } = await import('../src/components/admin/guides/guideScheduleModel.ts');
    const registered = { id: 'resource-guide:Oyuka', name: 'Oyuka' };
    const tours = [booking('old-id', '2026-12-02', '2026-12-04', { id: 'legacy-7', name: 'Oyuka' }), booking('nov', '2026-11-02', '2026-11-04', { name: 'Davaa ah' }), booking('dec', '2026-12-10', '2026-12-12', { name: 'Ganaa' })];
    assert.equal(matchesGuide({ id: 'legacy-7', name: ' oyuka' }, registered), true);
    assert.equal(matchesGuide({ id: 'a', name: 'X' }, { id: 'b', name: 'Y' }), false);
    const rows = guideRows([registered], tours, monthDays('2026-12'));
    assert.deepEqual(rows.map(r => [r.guide.name, r.registered, r.bookings.map(b => b.id)]), [['Oyuka', true, ['old-id']], ['Ganaa', false, ['dec']]]);
});

test('배정 현황 v4 달력 계산: 월간 주(일요일 시작), 주별 막대 줄과 더보기, 타임라인 범위, 차량 겹침, 목록 배정 상태', async () => {
    const { monthWeeks, weekLanes, timelineWindow, vehicleClash, assignState, dayDiff } = await import('../src/components/admin/guides/guideScheduleModel.ts');
    // 2026-12-01은 화요일 → 첫 주는 11-29(일)부터, 5주
    const weeks = monthWeeks('2026-12');
    assert.equal(weeks.length, 5);
    assert.deepEqual([weeks[0][0], weeks[0][2], weeks[4][6]], ['2026-11-29', '2026-12-01', '2027-01-02']);
    assert.equal(dayDiff('2026-12-30', '2027-01-02'), 3);

    const week = weeks[1]; // 12-06(일) ~ 12-12(토)
    const tours = [
        booking('long', '2026-12-03', '2026-12-08', oyuka), booking('a', '2026-12-07', '2026-12-09', bilguun),
        booking('b', '2026-12-07', '2026-12-07', null), booking('c', '2026-12-07', '2026-12-10', null), booking('next', '2026-12-12', '2026-12-15', oyuka),
    ];
    const { bars, more } = weekLanes(tours, week, 3);
    const byId = Object.fromEntries(bars.map(b => [b.booking.id, b]));
    assert.deepEqual([byId.long.from, byId.long.to, byId.long.clipStart, byId.long.clipEnd], [0, 2, true, false], '지난주부터 이어진 막대는 앞이 잘린다');
    assert.deepEqual([byId.next.from, byId.next.to, byId.next.clipEnd], [6, 6, true], '다음 주로 이어지는 막대는 뒤가 잘린다');
    assert.equal(bars.length, 4, '세 줄을 넘는 투어는 막대 대신 더보기로 센다');
    assert.equal(more.reduce((n, x) => n + x, 0) > 0, true);
    assert.equal(new Set(bars.filter(b => b.from <= 1 && b.to >= 1).map(b => b.lane)).size, bars.filter(b => b.from <= 1 && b.to >= 1).length, '같은 날 막대는 서로 다른 줄');

    assert.deepEqual(timelineWindow(31, 'm', 5, 10), { from: 0, to: 30 }, '한 달은 전체');
    assert.deepEqual(timelineWindow(31, 'w2', null, 16, 4), { from: 13, to: 26 }, '2주는 오늘이 든 주의 월요일부터');
    assert.deepEqual(timelineWindow(31, 'w1', 28, -1), { from: 24, to: 30 }, '끝을 넘지 않게 당긴다');
    assert.deepEqual(timelineWindow(31, 'w1', null, -1), { from: 0, to: 6 }, '오늘이 다른 달이면 1일부터');

    const withCar = (id, s, e, type, extra) => ({ ...booking(id, s, e, null, extra), assignment: { guide: { name: '' }, vehicle: { type, phone: '' } } });
    const pool = [withCar('v1', '2026-12-01', '2026-12-04', '현대 스타렉스'), withCar('v2', '2026-12-04', '2026-12-06', ' 현대스타렉스 '), withCar('v3', '2026-12-03', '2026-12-05', '현대 스타렉스', { status: 'cancelled' })];
    assert.equal(vehicleClash(pool, '현대 스타렉스', pool[0]), undefined, '끝나는 날=시작하는 날 교대·취소 예약은 겹침이 아니다');
    assert.equal(vehicleClash(pool, '현대 스타렉스', { id: 'new', source: 'quote_booking', startDate: '2026-12-02', endDate: '2026-12-03' })?.id, 'v1');
    assert.equal(vehicleClash(pool, '', pool[0]), undefined);

    assert.deepEqual([assignState(true, true, false), assignState(true, false, false), assignState(false, true, false), assignState(false, false, false), assignState(true, true, true)],
        ['배정완료', '부분 배정', '부분 배정', '미배정', '중복']);
});

test('가이드·숙소·차량 화면에서 연 고객 화면은 그 화면으로 돌아오고 일정표 바로가기를 연다', async () => {
    const out = await build({ stdin: { contents: "export * from './src/utils/calendarWorkspaceAction.ts'; export * from './src/utils/customerWorkspaceRoutes.ts';", resolveDir: fileURLToPath(new URL('..', import.meta.url)), loader: 'ts' },
        bundle: true, format: 'esm', platform: 'node', write: false });
    const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
    const back = '/admin/quote-desk/resources?view=schedule';
    assert.equal(mod.customerWorkspaceReturnTo(back), back);
    assert.equal(mod.customerWorkspaceBackLabel(back), '가이드·숙소·차량');
    const href = `${mod.quoteCustomerHref('req-1', back)}&action=edit-itinerary`;
    assert.equal(mod.readCalendarWorkspaceAction(new URL(href, 'https://x.invalid').search), 'edit-itinerary');
    assert.equal(mod.readCalendarWorkspaceAction(new URL(`${mod.productCustomerHref('p-1', back)}&action=send-itinerary`, 'https://x.invalid').search), null, '허용 목록 밖 동작은 열지 않는다');
});

test('가이드 상세의 일정표는 담당 가이드에게 전달하는 문서를 연다(상품=가이드용 일정표, 견적=가이드 시트)', async () => {
    const { guideItineraryExtra, guideItineraryHref } = await import('../src/components/admin/guides/guideScheduleModel.ts');
    assert.equal(guideItineraryHref({ source: 'product', id: 'r 1/#' }), '/documents/itinerary/r%201%2F%23?guide=1');
    assert.equal(guideItineraryHref({ source: 'quote_booking', id: 'q-7' }), '/가이드시트?id=q-7');
    assert.deepEqual(guideItineraryExtra({ source: 'product', id: 'r1', customerName: ' 김고객 ', travelers: 3,
        contractData: { arrival: { date: '2026-10-20', time: '21:40', flight: 'OM302' }, departure: { date: '2026-10-22' } },
        assignment: { guide: { name: 'Oyuka', phone: '+976 1' }, vehicle: { type: '스타렉스', phone: '+976 2', driver: ' Bat ' } } }), {
        customerName: '김고객', people: '3명', arrival: '2026-10-20 · 21:40 · OM302', departure: '2026-10-22',
        guideName: 'Oyuka', guidePhone: '+976 1', vehicleType: '스타렉스', vehiclePhone: '+976 2', driverName: 'Bat',
    });
    const source = (await import('node:fs')).readFileSync(fileURLToPath(new URL('../src/components/admin/guides/GuideSchedule.tsx', import.meta.url)), 'utf8');
    assert.doesNotMatch(source, /연락처 복사|예약 상세 열기/);
});

test('가이드 상세의 배정 내역과 가이드 일정표에 차종·기사 이름·연락처를 보여 주고, 예전 배정은 등록 차량의 기사로 보충한다', () => {
    const read = p => fs.readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
    const schedule = read('src/components/admin/guides/GuideSchedule.tsx');
    assert.match(schedule, /driver: String\(v\?\.driver \|\| reg\?\.driver \|\| ''\)/);
    assert.match(schedule, /기사 \{\[car\.driver, car\.phone\]/);
    assert.match(schedule, /onClick=\{\(\) => openItinerary\(b\)\}/, '일정표에도 보충한 기사 정보를 넘긴다');
    const sheet = read('public/가이드시트.html');
    assert.match(sheet, /fetch\("\/api\/data\/vehicles", \{ cache:"no-store", headers:adminHeaders \}\)/);
    assert.match(sheet, /if \(!\(vehicle\.driver \|\| vehicle\.driverName\)\) vehicle\.driver = vehicleLib\.driver/);
});
