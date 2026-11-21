import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// 사이드바 계산(adminSidebarModel.ts)을 묶어서 불러온다. 메뉴 정의(adminNav.ts)를 그대로 쓰므로 실제 메뉴로 검사한다.
const bundled = await build({
    entryPoints: ['src/components/admin/adminSidebarModel.ts'], bundle: true, write: false, format: 'esm', platform: 'node',
    logLevel: 'silent', loader: { '.css': 'empty' },
});
const model = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const { navBadges, groupSummary, resolveOpenGroups, findMenus, moveIndex, pushRecent, recentMenus, badgeText } = model;
const { navGroups } = await import('data:text/javascript;base64,' + Buffer.from((await build({
    entryPoints: ['src/components/admin/adminNav.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
})).outputFiles[0].text).toString('base64'));

const task = (kind, i = 0) => ({ key: `${kind}:${i}`, kind, title: '', description: '', href: '/admin', createdAt: '', priority: 'normal' });

test('메뉴 옆 숫자는 업무 알림과 같은 자료를 센다(예약 처리 필요·새 견적 문의·배정 필요)', () => {
    const badges = navBadges([task('deposit_report'), task('contract', 1), task('quote'), task('quote', 2), task('quote', 3), task('assignment')]);
    assert.deepEqual(badges.reservations, { count: 2, kind: 'alert', label: '처리 필요 2건' });
    assert.deepEqual(badges['quote-desk-inbox'], { count: 3, kind: 'new', label: '새 문의 3건' });
    assert.deepEqual(badges['accommodation-ops'], { count: 1, kind: 'alert', label: '배정 필요 1건' });
    assert.deepEqual(navBadges([]), {}, '할 일이 없으면 숫자를 붙이지 않는다');
    assert.deepEqual(navBadges(null), {}, '자료를 못 읽었으면 숫자를 붙이지 않는다(0으로 단정하지 않음)');
    assert.equal(badgeText(120), '99+');
});

test('접힌 묶음은 안의 숫자를 합쳐 보이고, 처리 필요가 있으면 빨간 배지', () => {
    const booking = navGroups.find((g) => g.id === 'booking-work');
    const quote = navGroups.find((g) => g.id === 'quote-work');
    const badges = navBadges([task('deposit_report'), task('quote')]);
    assert.equal(groupSummary(booking, badges).kind, 'alert');
    assert.equal(groupSummary(quote, badges).kind, 'new');
    assert.equal(groupSummary(navGroups.find((g) => g.id === 'site-management'), badges), null);
});

test('묶음 6개: 고객·콘텐츠·사이트 관리는 처음에 접혀 있고, 지금 화면이 든 묶음은 늘 펼친다', () => {
    assert.deepEqual(navGroups.map((g) => g.label), ['예약 관리', '견적 관리', '상품 관리', '배정·자원', '고객·콘텐츠', '사이트 관리']);
    const first = resolveOpenGroups({}, 'reservations');
    assert.equal(first['booking-work'], true);
    assert.equal(first['customer-content'], false);
    assert.equal(first['site-management'], false);
    assert.equal(resolveOpenGroups({ 'customer-content': false }, 'faq')['customer-content'], true, '지금 화면(FAQ)이 들어 있으면 펼친다');
    assert.equal(resolveOpenGroups({ 'booking-work': false }, 'faq')['booking-work'], false, '사용자가 접은 묶음은 접힌 채로');
});

test('메뉴 이름 통일: 일정 관리, 숙소 배정', () => {
    const labels = navGroups.flatMap((g) => g.items.map((i) => i.label));
    assert.ok(labels.includes('일정 관리'));
    assert.ok(labels.includes('숙소 배정'));
    assert.ok(!labels.some((l) => l === '일정관리' || l.includes('현지 운영')));
});

test('메뉴 찾기: 메뉴 이름·묶음 이름으로 찾고, 띄어쓰기는 무시하며 이름에 든 글자를 표시한다', () => {
    const found = findMenus('숙소');
    assert.deepEqual(found.map((m) => m.item.label), ['숙소 배정', '가이드·숙소·차량']);
    assert.deepEqual([found[1].start, found[1].length], [4, 2]);
    assert.equal(findMenus('일정관리')[0].item.label, '일정 관리', '띄어쓰기 없이 쳐도 찾는다');
    assert.equal(findMenus('일정관리')[0].start, -1, '이름과 글자가 다르면 표시하지 않는다');
    assert.ok(findMenus('사이트 관리').some((m) => m.item.label === '홈 화면 관리'), '묶음 이름으로도 찾는다');
    assert.equal(findMenus('대시')[0].item.label, '대시보드');
    assert.deepEqual(findMenus('   '), []);
    assert.equal(moveIndex(1, 1, 2), 0);
    assert.equal(moveIndex(0, -1, 2), 1);
});

test('최근 연 화면: 메뉴에 있는 화면만, 지금 화면은 빼고 최대 3개', () => {
    let list = [];
    for (const page of ['reservations', 'customer-workspace', 'faq', 'categories', 'faq', 'calendar']) list = pushRecent(list, page);
    assert.deepEqual(list, ['calendar', 'faq', 'categories', 'reservations']);
    assert.deepEqual(recentMenus(list, 'calendar').map((i) => i.label), ['FAQ 관리', '상품 카테고리', '통합 예약 목록']);
});
