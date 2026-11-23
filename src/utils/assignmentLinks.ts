/**
 * 예약 상세는 배정을 보여 주기만 하고, 바꾸는 일은 각 메뉴에서 한다(2026-11-23 오너 결정).
 * - 숙소: 숙소 배정(`/admin/accommodation-ops?open=<예약ID>&source=<출처>`) — 그 예약을 펼쳐서 연다.
 * - 가이드·차량: 가이드·숙소·차량 > 가이드 배정 현황의 ‘가이드 배정하기’
 *   (`/admin/quote-desk/resources?view=schedule&booking=<출처>:<예약ID>&pick=guide|car`) — 그 예약을 강조하고 고르기 창을 연다.
 * 두 화면 모두 `returnTo`가 있으면 ‘예약 상세로 돌아가기’ 버튼을 보여 준다.
 */
export type AssignmentSourceType = 'product' | 'quote_booking';
export type AssignmentPick = 'guide' | 'car';

/** 관리자 안의 상대 경로만 돌아갈 주소로 쓴다(외부 주소·프로토콜 상대 주소·줄바꿈 거절). */
export function safeAdminReturnTo(value?: string | null): string {
    const text = String(value || '');
    return text.startsWith('/admin/') && !text.startsWith('//') && !/[\r\n\\]/.test(text) && text.length <= 600 ? text : '';
}

const query = (entries: Record<string, string>) => new URLSearchParams(Object.entries(entries).filter(([, v]) => v)).toString();

export function lodgeAssignHref(type: AssignmentSourceType, id: string, returnTo?: string): string {
    return `/admin/accommodation-ops?${query({ open: id, source: type, returnTo: safeAdminReturnTo(returnTo) })}`;
}

export function guideAssignHref(type: AssignmentSourceType, id: string, pick: AssignmentPick, returnTo?: string): string {
    return `/admin/quote-desk/resources?${query({ view: 'schedule', booking: `${type}:${id}`, pick, returnTo: safeAdminReturnTo(returnTo) })}`;
}

/** 가이드 배정 현황 주소의 예약 지정(`booking`·`pick`·`returnTo`). 형식이 틀리면 지정 없음. */
export function readAssignmentFocus(search: string): { key: string; pick: AssignmentPick; returnTo: string } | null {
    const params = new URLSearchParams(search);
    const key = params.get('booking') || '';
    if (!/^(product|quote_booking):[^\s:]{1,120}$/.test(key)) return null;
    return { key, pick: params.get('pick') === 'car' ? 'car' : 'guide', returnTo: safeAdminReturnTo(params.get('returnTo')) };
}
