import test from 'node:test';
import assert from 'node:assert/strict';
import { readAdminCalendarView, adminCalendarSearch, adminCalendarMonth } from '../src/utils/adminCalendarView.ts';

test('검색·선택일·출처·처리 상태와 선택 예약을 URL로 왕복한다', () => {
    const view = readAdminCalendarView('?month=2026-10&date=2026-10-25&q=동명이인&source=product&attention=needs&view=list&open=product%3Asame-id');
    assert.deepEqual(readAdminCalendarView(adminCalendarSearch(view)), view);
    assert.equal(view.query, '동명이인'); assert.equal(view.open, 'product:same-id');
});
test('월 이동은 연도 경계를 처리하며 선택일도 표시 월 안으로 이동한다', () => {
    const view = readAdminCalendarView('?month=2026-12&date=2026-12-31&q=가이드');
    const next = adminCalendarMonth(view, 1, new Date('2026-10-20T12:00:00+09:00'));
    assert.equal(next.month, '2027-01'); assert.equal(next.date, '2027-01-01'); assert.equal(next.query, '가이드');
    assert.equal(adminCalendarMonth(view, -2, new Date('2026-10-20T12:00:00+09:00')).date, '2026-10-20');
});
test('잘못된 날짜와 필터를 복구하고 이전 문의를 선택하면 표시한다', () => {
    const now = new Date('2026-10-20T12:00:00+09:00');
    const invalid = readAdminCalendarView('?month=2026-02&date=2026-02-30&source=bad&attention=bad', now);
    assert.equal(invalid.date, '2026-02-01'); assert.equal(invalid.source, 'all'); assert.equal(invalid.attention, 'all');
    assert.equal(readAdminCalendarView('?month=2026-10&date=2026-11-02', now).date, '2026-10-20');
    assert.equal(readAdminCalendarView('?source=legacy_quote', now).legacy, true);
});
