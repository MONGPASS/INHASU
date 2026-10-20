import { calendarDateKey, type CalendarTourSource } from './adminTourCalendar.ts';

export interface AdminCalendarView {
    month: string; date: string; query: string; source: CalendarTourSource | 'all';
    attention: 'all' | 'needs' | 'conflicts'; legacy: boolean; mode: 'calendar' | 'list'; open: string;
}
export function readAdminCalendarView(search: string, now = new Date()): AdminCalendarView {
    const params = new URLSearchParams(search), today = calendarDateKey(now);
    const requestedDate = calendarDateKey(params.get('date'));
    const rawMonth = params.get('month') || '';
    const month = /^\d{4}-\d{2}$/.test(rawMonth) && calendarDateKey(`${rawMonth}-01`) ? rawMonth : (requestedDate || today).slice(0, 7);
    const date = requestedDate.startsWith(month) ? requestedDate : today.startsWith(month) ? today : `${month}-01`;
    const rawSource = params.get('source');
    const source = rawSource === 'product' || rawSource === 'quote_booking' || rawSource === 'legacy_quote' ? rawSource : 'all';
    const rawAttention = params.get('attention');
    return { month, date, query: (params.get('q') || '').slice(0, 120), source,
        attention: rawAttention === 'needs' || rawAttention === 'conflicts' ? rawAttention : 'all',
        legacy: params.get('legacy') === '1' || source === 'legacy_quote', mode: params.get('view') === 'list' ? 'list' : 'calendar', open: (params.get('open') || '').slice(0, 200) };
}
export function adminCalendarSearch(view: AdminCalendarView): string {
    const params = new URLSearchParams({ month: view.month, date: view.date });
    if (view.query) params.set('q', view.query);
    if (view.source !== 'all') params.set('source', view.source);
    if (view.attention !== 'all') params.set('attention', view.attention);
    if (view.legacy) params.set('legacy', '1');
    if (view.mode !== 'calendar') params.set('view', view.mode);
    if (view.open) params.set('open', view.open);
    return params.toString();
}
export function adminCalendarMonth(view: AdminCalendarView, delta: number, now = new Date()): AdminCalendarView {
    const [year, month] = view.month.split('-').map(Number);
    const target = calendarDateKey(new Date(Date.UTC(year, month - 1 + delta, 1, 12))).slice(0, 7);
    const today = calendarDateKey(now);
    return { ...view, month: target, date: today.startsWith(target) ? today : `${target}-01`, open: '' };
}
