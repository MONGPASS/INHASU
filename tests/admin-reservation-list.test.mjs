import test from 'node:test';
import assert from 'node:assert/strict';
import { readReservationList, reservationListSearch, reservationReturnTo, reservationExportRows, defaultReservationList } from '../src/utils/adminReservationList.ts';
import { guideAssignmentConflicts, validAssignmentPeriod } from '../src/utils/assignmentAvailability.ts';
test('예약 목록의 검색·필터·정렬·페이지를 URL로 복원한다', () => {
    const state = { ...defaultReservationList, searchTerm: '가족 여행', filterType: '맞춤 견적 예약', filterStatus: '예약 확정', filterDeparture: '2026-10-20', filterPayment: '잔금 미입금', filterSource: 'kakao', sortOrder: 'departure', currentPage: 4 };
    const query = reservationListSearch(state, '?open=id&localDraftStorage=blocked');
    assert.deepEqual(readReservationList(query), state); assert.ok(query.includes('open=id'));
    assert.deepEqual(readReservationList('?page=-2&status=bad&type=bad&departure=bad'), defaultReservationList);
});
test('예약 목록 복귀는 관리자의 내부 목록만 허용한다', () => {
    assert.equal(reservationReturnTo('/admin/reservations?q=test&page=2'), '/admin/reservations?q=test&page=2');
    for (const value of ['https://evil.example/admin/reservations', '//evil.example/admin/reservations', '/admin/other', 'javascript:alert(1)']) assert.equal(reservationReturnTo(value), '/admin/reservations?type=quote_booking');
});
test('Excel 범위는 조회 결과·선택 source/id·전체 확정/결제를 구분한다', () => {
    const all = [{id:'same',type:'product',status:'paid'},{id:'same',type:'quote_booking',status:'confirmed'},{id:'old',type:'quote',status:'confirmed'},{id:'pending',type:'product',status:'pending_payment'}];
    assert.deepEqual(reservationExportRows(all,[all[3]],new Set(),'filtered'),[all[3]]);
    assert.deepEqual(reservationExportRows(all,[],new Set(['quote_booking:same']),'selected'),[all[1]]);
    assert.deepEqual(reservationExportRows(all,[],new Set(),'confirmed'),all.slice(0,2));
});
test('가이드 기간 중복은 상품·견적을 함께 확인하고 취소와 현재 예약은 제외한다', () => {
    const current = {id:'same',source:'product',startDate:'2026-10-20',endDate:'2026-10-22'};
    const row = {id:'same',source:'quote_booking',status:'confirmed',startDate:'2026-10-22',endDate:'2026-10-24',assignment:{guide:{id:'guide-1',name:'가이드'}}};
    const rows = [row,{...row,source:'product'},{...row,id:'cancelled',status:'cancelled'},{...row,id:'other',startDate:'2026-10-23'},{...row,id:'other-guide',assignment:{guide:{id:'g2',name:'다른 가이드'}}}];
    assert.deepEqual(guideAssignmentConflicts(rows,{id:'guide-1',name:'가이드'},current),[row]);
});
test('알 수 없는 날짜와 역전된 기간은 배정 확인 완료로 취급하지 않는다', () => {
    for (const current of [{startDate:'garbage'}, {startDate:'2026-02-30'}, {startDate:'2026-10-23',endDate:'2026-10-20'}, {startDate:'2026-13-01'}]) assert.equal(validAssignmentPeriod(current),false);
    assert.equal(validAssignmentPeriod({startDate:'2026-10-20',endDate:'2026-10-22'}),true);
});
