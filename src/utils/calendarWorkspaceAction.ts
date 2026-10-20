import { customerWorkspaceReturnTo } from './customerWorkspaceRoutes.ts';

export type CalendarWorkspaceAction = 'guide' | 'vehicle' | 'stay' | 'payments';
const actions = new Set<CalendarWorkspaceAction>(['guide', 'vehicle', 'stay', 'payments']);

/** Calendar shortcuts only open an existing work panel; they never save or send. */
export function readCalendarWorkspaceAction(search: string): CalendarWorkspaceAction | null {
    const params = new URLSearchParams(search);
    if (params.getAll('action').length !== 1 || params.getAll('returnTo').length !== 1) return null;
    const action = params.get('action') as CalendarWorkspaceAction;
    const returnTo = customerWorkspaceReturnTo(params.get('returnTo'), '');
    if (!actions.has(action) || !returnTo) return null;
    return new URL(returnTo, 'https://workspace.invalid').pathname === '/admin/calendar' ? action : null;
}

/** Preserve the calendar return address and any unrelated workspace parameters. */
export function consumedCalendarWorkspaceSearch(search: string): string {
    const params = new URLSearchParams(search);
    params.delete('action');
    const value = params.toString();
    return value ? `?${value}` : '';
}
