import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
    defaultReservationListView, readReservationListView, reservationListViewSearch, reservationPage, reservationPageSummary,
} from '../src/utils/reservationListView.ts';
import { reservationExportRows, reservationsByKeys } from '../src/utils/adminReservationList.ts';

test('통합 예약 목록의 탭·빠른 필터·검색·정렬·페이지·쪽당 건수를 주소로 복원한다', () => {
    const view = { tab: 'ongoing', quick: 'bal', q: '가족 여행', sort: 'dep', page: 3, size: 50 };
    const search = reservationListViewSearch(view, '?open=abc&returnTo=%2Fadmin');
    assert.deepEqual(readReservationListView(search), view);
    assert.ok(search.includes('open=abc') && search.includes('returnTo='));
    // 기본값은 주소에 적지 않는다
    assert.equal(reservationListViewSearch(defaultReservationListView), '');
    // 옛 목록의 주소 값은 정리한다
    assert.equal(reservationListViewSearch(defaultReservationListView, '?status=예약 확정&payment=x&type=product&kind=1'), '?kind=1');
});

test('잘못된 주소 값은 기본값으로 돌린다', () => {
    assert.deepEqual(readReservationListView('?tab=evil&quick=x&sort=amount&page=-4&size=13'), defaultReservationListView);
    assert.equal(readReservationListView('?page=2.7').page, 2);
    assert.equal(readReservationListView(`?q=${'a'.repeat(400)}`).q.length, 200);
});

test('쪽 나누기는 넘친 쪽 번호를 마지막 쪽으로 맞추고 요약을 만든다', () => {
    const rows = Array.from({ length: 46 }, (_, i) => i);
    const last = reservationPage(rows, 9, 20);
    assert.deepEqual([last.page, last.totalPages, last.start, last.end, last.rows.length], [3, 3, 40, 46, 6]);
    assert.equal(reservationPageSummary(46, last.start, last.end), '41–46 / 46건');
    assert.equal(reservationPage([], 5, 20).page, 1);
    assert.equal(reservationPageSummary(0, 0, 0), '0건');
});

test('Excel ‘지금 보이는 목록’은 목록이 알려 준 출처:ID 순서를 따른다', () => {
    const all = [{ id: 'same', type: 'product', status: 'paid' }, { id: 'same', type: 'quote_booking', status: 'confirmed' }, { id: 'x', type: 'product', status: 'pending_payment' }];
    const visible = reservationsByKeys(all, ['quote_booking:same', 'product:x', 'product:missing']);
    assert.deepEqual(visible, [all[1], all[2]]);
    assert.deepEqual(reservationExportRows(all, visible, new Set(), 'filtered'), [all[1], all[2]]);
});

test('통합 예약 목록 화면은 옛 목록 주소 동기화를 쓰지 않고 머리 Excel 메뉴가 목록 범위를 받는다', () => {
    const page = readFileSync(new URL('../src/pages/AdminReservationManage.tsx', import.meta.url), 'utf8');
    assert.ok(!page.includes('reservationListSearch(') && !page.includes('readReservationList('));
    assert.ok(page.includes('onScopeChange={setListScope}') && page.includes('<AdminMenu') && page.includes('<AdminDialog'));
    const list = readFileSync(new URL('../src/components/admin/v7/ReservationListV7.tsx', import.meta.url), 'utf8');
    assert.ok(list.includes('readReservationListView(window.location.search)') && list.includes('reservationListViewSearch(view'));
});
