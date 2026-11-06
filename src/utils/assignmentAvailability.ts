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

/**
 * 가이드 일정 겹침을 두 가지로 나눈다.
 * - overlap: 같은 날을 함께 쓰는 진짜 중복 → 배정 전에 확인하고, 서버도 확인 없이는 저장하지 않는다.
 * - handover: 한 팀이 끝나는 날 다른 팀이 시작하는 경우(공항 인계 등) → 막지 않고 알림만 한다.
 * 취소·보류 예약과 현재 예약 자신은 빼며, 날짜가 올바르지 않은 예약은 판단하지 않는다.
 */
export type GuideOverlapKind = 'overlap' | 'handover';
export function guideOverlaps(bookings: any[], guide: { id?: string; name?: string }, current: { id: string; source: string; startDate?: string; endDate?: string }) {
    const start = toTourDateKey(current.startDate), end = toTourDateKey(current.endDate || current.startDate);
    return guideAssignmentConflicts(bookings, guide, current).map(booking => {
        const from = toTourDateKey(booking.startDate), to = toTourDateKey(booking.endDate || booking.startDate);
        const kind: GuideOverlapKind = (to === start && from < start) || (from === end && to > end) ? 'handover' : 'overlap';
        return { booking, kind };
    });
}
/** 가이드가 같은지 — 등록 ID가 둘 다 있으면 ID로, 아니면 공백을 뺀 이름으로 비교한다. */
export function sameGuide(a: { id?: string; name?: string } | null | undefined, b: { id?: string; name?: string } | null | undefined) {
    if (!a || !b) return false;
    if (a.id && b.id) return a.id === b.id;
    return !!normalized(a.name) && normalized(a.name) === normalized(b.name);
}
/** 저장 메시지·메뉴에 쓰는 짧은 설명: `홍길동 06.21~06.28` */
export function overlapLabel(booking: any) {
    const day = (value: unknown) => toTourDateKey(String(value || '')).slice(5).replace('-', '.');
    const name = String(booking?.leadName || booking?.customerName || '다른 예약').trim();
    return `${name} ${day(booking?.startDate)}~${day(booking?.endDate || booking?.startDate)}`;
}
