import test from 'node:test';
import assert from 'node:assert/strict';
import { productCustomerHref, quoteCustomerHref, legacyQuoteCustomerHref, customerWorkspaceReturnTo, customerWorkspaceBackLabel } from '../src/utils/customerWorkspaceRoutes.ts';
test('고객 업무 주소는 상품·실제 견적·이전 견적의 같은 ID를 분리한다', () => {
    const id = 'same/id + 고객';
    const links = [productCustomerHref(id), quoteCustomerHref(id), legacyQuoteCustomerHref(id)];
    assert.equal(new Set(links).size,3);
    for (const link of links) assert.ok(link.endsWith(encodeURIComponent(id)));
});
test('예약·견적 목록의 검색·필터·페이지를 내부 복귀 주소로 유지한다', () => {
    for (const path of ['/admin/reservations?q=고객&page=2','/admin/quote-desk/inbox?status=sent','/admin/calendar','/admin/quotes']) {
        const url = new URL(quoteCustomerHref('q',path),'https://workspace.invalid');
        assert.equal(customerWorkspaceReturnTo(url.searchParams.get('returnTo')),new URL(path,'https://workspace.invalid').pathname + new URL(path,'https://workspace.invalid').search);
    }
});
test('고객 업무 상단 경로는 돌아갈 목록 이름을 보여준다', () => {
    assert.equal(customerWorkspaceBackLabel('/admin/reservations?type=quote_booking&page=2'),'통합 예약 목록');
    assert.equal(customerWorkspaceBackLabel('/admin/calendar'),'투어 캘린더');
    assert.equal(customerWorkspaceBackLabel('/admin/quote-desk/inbox#top'),'견적 문의');
    assert.equal(customerWorkspaceBackLabel('/admin/unknown'),'고객 관리');
});
test('고객·관리자 토큰을 외부 주소로 전달하는 복귀 경로를 거부한다', () => {
    for (const path of ['https://other.invalid/admin','//other.invalid/admin','/\\other.invalid/admin','/admin/unknown','javascript:alert(1)','/admin%2f..%2fexternal','/admin\n']) assert.equal(customerWorkspaceReturnTo(path),'/admin/reservations');
});
