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
    const out = await build({ entryPoints: [fileURLToPath(new URL('../src/components/admin/v7/guideMenuItems.ts', import.meta.url))], bundle: true, format: 'esm', platform: 'node', write: false });
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
        items[2].onPick(); items[2].onPick(); items[0].onPick();
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
