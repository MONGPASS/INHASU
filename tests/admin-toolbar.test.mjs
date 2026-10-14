import test from 'node:test';
import assert from 'node:assert/strict';
import { adminSearchGroups, adminTaskBadge, nextSearchIndex } from '../src/components/admin/adminToolbarHelpers.ts';

const item = (key, category, extra = {}) => ({ key, category, title: '김여행', subtitle: '테를지 초원 상품',
    keywords: ['MN123', 'customer@example.invalid', '010-1234-5678'], href: '/admin/reservations?open=fixture', statusLabel: '예약확정', ...extra });
const items = [item('product-booking', 'reservation'), item('quote-booking', 'reservation', { href: '/admin/quote-desk/bookings?id=fixture' }),
    item('quote-request', 'quote', { href: '/admin/quote-desk/inbox?id=fixture' }),
    item('product', 'product', { title: '테를지 초원 상품', href: '/admin/products?open=fixture' })];
const keys = query => adminSearchGroups(items, query).flatMap(group => group.items).map(result => result.key);

test('예약번호·고객명·이메일·공백과 기호가 있는 전화번호를 같은 실제 목록에서 검색한다', () => {
    for (const query of ['mn123', 'CUSTOMER@EXAMPLE.INVALID', '01012345678', '010 1234 5678', '테를지']) assert.equal(keys(query).length, 4, query);
    assert.equal(keys('김여행').length, 3);
    assert.deepEqual(keys('존재하지 않는 고객'), []);
    assert.deepEqual(keys('   '), []);
});
test('여러 검색어는 모두 일치해야 하고 예약·견적·상품의 실제 상세 경로를 보존한다', () => {
    const groups = adminSearchGroups(items, '테를지 MN123');
    assert.deepEqual(groups.map(group => group.category), ['reservation', 'quote', 'product']);
    assert.equal(groups[0].items[1].href, '/admin/quote-desk/bookings?id=fixture');
    assert.equal(groups[1].items[0].href, '/admin/quote-desk/inbox?id=fixture');
    assert.deepEqual(keys('김여행 다른번호'), []);
});
test('검색 결과는 종류마다 제한하고 정확히 일치한 항목을 먼저 표시한다', () => {
    const list = Array.from({ length: 9 }, (_, i) => item(`booking-${i}`, 'reservation', { title: i === 8 ? '김여행' : `김여행 일행 ${i}` }));
    const groups = adminSearchGroups(list, '김여행');
    assert.equal(groups[0].items.length, 4);
    assert.equal(groups[0].items[0].key, 'booking-8');
    assert.deepEqual(adminSearchGroups([item('bad', 'product', { href: 'javascript:alert(1)' })], '김여행'), []);
});
test('방향키는 첫·끝 결과를 순환하고 빈 목록에서 결과를 선택하지 않는다', () => {
    assert.equal(nextSearchIndex(3, 1, 4), 0);
    assert.equal(nextSearchIndex(0, -1, 4), 3);
    assert.equal(nextSearchIndex(-1, 1, 4), 0);
    assert.equal(nextSearchIndex(-1, -1, 4), 3);
    assert.equal(nextSearchIndex(0, 1, 0), -1);
});
const data = (count = 0, partial = false) => ({ tasks: Array.from({ length: count }, (_, i) => ({ key: `task-${i}` })),
    warnings: partial ? ['견적 자료 조회 실패'] : [], availability: { reservations: true, requests: !partial, quotes: true, products: true } });
test('첫 조회 중과 조회 실패를 미완료 0건으로 표시하지 않는다', () => {
    assert.equal(adminTaskBadge(null, true, false).text, '…');
    assert.equal(adminTaskBadge(null, false, true).text, '?');
    assert.equal(adminTaskBadge(data(), false, false).text, '0');
});
test('일부 자료 실패와 새로고침 실패의 알림 숫자는 완전한 집계처럼 보이지 않는다', () => {
    assert.equal(adminTaskBadge(data(0, true), false, false).text, '?');
    assert.equal(adminTaskBadge(data(2, true), false, false).text, '2+');
    assert.equal(adminTaskBadge(data(), false, true).text, '?');
    assert.equal(adminTaskBadge(data(2), false, true).text, '2?');
    assert.equal(adminTaskBadge(data(2), true, false).text, '2');
});
