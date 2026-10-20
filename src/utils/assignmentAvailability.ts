import { toTourDateKey } from './formatDate.ts';
const normalized = (value: any) => String(value || '').replace(/\s+/g, '').toLowerCase();
export function validAssignmentPeriod(value: { startDate?: string; endDate?: string }) {
    const valid = (raw?: string) => {
        const key = toTourDateKey(raw);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
        const date = new Date(`${key}T00:00:00Z`);
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : '';
    };
    const start = valid(value.startDate), end = valid(value.endDate);
    return !!start && !!end && start <= end;
}
export function guideAssignmentConflicts(bookings: any[], guide: { id?: string; name?: string }, current: { id: string; source: string; startDate?: string; endDate?: string }) {
    const start = toTourDateKey(current.startDate), end = toTourDateKey(current.endDate || current.startDate);
    if (!validAssignmentPeriod(current)) return [];
    return bookings.filter(row => {
        if ((row.source === current.source && row.id === current.id) || ['cancelled', 'on_hold', '취소', '예약취소', '보류'].includes(row.status)) return false;
        const assigned = row.assignment?.guide || row.assignedGuide;
        const matches = assigned && ((guide.id && assigned.id && guide.id === assigned.id) || (normalized(guide.name) && normalized(guide.name) === normalized(assigned.name)));
        const from = toTourDateKey(row.startDate), to = toTourDateKey(row.endDate || row.startDate);
        return matches && from && to && from <= end && to >= start;
    });
}
