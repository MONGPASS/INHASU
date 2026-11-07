import { customerWorkspaceReturnTo } from './customerWorkspaceRoutes';

export type CalendarWorkspaceAction = 'guide' | 'vehicle' | 'stay' | 'payments' | 'edit-itinerary' | 'contract' | 'documents' | 'notes' | 'history';
const calendarActions = new Set<CalendarWorkspaceAction>(['guide', 'vehicle', 'stay', 'payments']);
/** 예약 관리 v7 목록은 일정표 편집·계약서·문서·메모·이력 바로가기도 넘긴다. */
const listActions = new Set<CalendarWorkspaceAction>([...calendarActions, 'edit-itinerary', 'contract', 'documents', 'notes', 'history']);

/** Calendar and reservation-list shortcuts only open an existing work panel; they never save or send. */
export function readCalendarWorkspaceAction(search: string): CalendarWorkspaceAction | null {
    const params = new URLSearchParams(search);
    if (params.getAll('action').length !== 1 || params.getAll('returnTo').length !== 1) return null;
    const action = params.get('action') as CalendarWorkspaceAction;
    const returnTo = customerWorkspaceReturnTo(params.get('returnTo'), '');
    if (!returnTo) return null;
    const path = new URL(returnTo, 'https://workspace.invalid').pathname;
    return path === '/admin/calendar' && calendarActions.has(action) ? action
        // 가이드·숙소·차량(가이드 배정 현황)의 일정표 바로가기도 목록과 같은 허용 목록을 쓴다.
        : (path === '/admin/reservations' || path === '/admin/quote-desk/resources') && listActions.has(action) ? action : null;
}

/** Preserve the calendar return address and any unrelated workspace parameters. */
export function consumedCalendarWorkspaceSearch(search: string): string {
    const params = new URLSearchParams(search);
    params.delete('action');
    const value = params.toString();
    return value ? `?${value}` : '';
}
