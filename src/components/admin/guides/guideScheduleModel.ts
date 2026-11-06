import { toTourDateKey } from '../../../utils/formatDate.ts';
import { guideOverlaps, validAssignmentPeriod } from '../../../utils/assignmentAvailability.ts';

/**
 * 가이드 배정 현황표의 계산. 화면과 테스트가 함께 쓴다.
 * 예약 한 건 = { id, source, status, startDate, endDate, assignment.guide } (배정 API 응답 그대로).
 */
export interface ScheduleBooking {
    key?: string; id: string; source: string; status?: string; startDate?: string; endDate?: string;
    customerName?: string; leadName?: string; assignment?: { guide?: { id?: string; name?: string; phone?: string } };
}
export interface ScheduleGuide { id?: string; name: string }

const INACTIVE = ['cancelled', 'on_hold', '취소', '예약취소', '보류'];
/** 취소·보류가 아니고 기간이 올바른 예약만 현황표에 올린다. */
export const activeBooking = (b: ScheduleBooking) => !INACTIVE.includes(String(b.status || '')) && validAssignmentPeriod(b);
const key = (value?: string) => toTourDateKey(value || '');
export const hasGuide = (b: ScheduleBooking) => !!(b.assignment?.guide?.id || b.assignment?.guide?.name?.trim());
const norm = (value: unknown) => String(value || '').replace(/\s+/g, '').toLowerCase();
/** 현황표 줄 맞추기: 등록 ID가 같거나 이름이 같으면 같은 가이드(예전 예약은 다른 ID로 저장됐을 수 있다). 중복 판단과 같은 기준. */
export const matchesGuide = (a?: { id?: string; name?: string } | null, b?: { id?: string; name?: string } | null) =>
    !!a && !!b && ((!!a.id && !!b.id && a.id === b.id) || (!!norm(a.name) && norm(a.name) === norm(b.name)));

/** `YYYY-MM`의 모든 날짜 */
export function monthDays(month: string) {
    const [y, m] = month.split('-').map(Number);
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}
export const shiftMonth = (month: string, delta: number) => {
    const [y, m] = month.split('-').map(Number), d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};
/** 이 달에 하루라도 걸치는 예약인지 */
export const inMonth = (b: ScheduleBooking, days: string[]) => key(b.startDate) <= days[days.length - 1] && key(b.endDate || b.startDate) >= days[0];
/** 그날 진행 중인 예약인지 */
export const coversDay = (b: ScheduleBooking, day: string) => key(b.startDate) <= day && key(b.endDate || b.startDate) >= day;

/**
 * 한 가이드의 예약을 겹치지 않게 줄(lane)로 나눈다. 같은 날 교대(끝나는 날=시작하는 날)도 같은 칸을 쓰므로 다른 줄에 둔다.
 * 반환: [{ booking, lane, from, to(달 안의 칸 번호 0부터), overlap(같은 날 다른 예약과 진짜 겹침) }]
 */
export function laneBookings(bookings: ScheduleBooking[], days: string[], conflictPool: ScheduleBooking[], guide?: ScheduleGuide) {
    const sorted = bookings.filter(b => inMonth(b, days)).sort((a, b) => key(a.startDate).localeCompare(key(b.startDate)) || key(a.endDate).localeCompare(key(b.endDate)));
    const laneEnds: string[] = [];
    return sorted.map(booking => {
        const start = key(booking.startDate), end = key(booking.endDate || booking.startDate);
        let lane = laneEnds.findIndex(last => last < start);
        if (lane < 0) { lane = laneEnds.length; laneEnds.push(end); } else laneEnds[lane] = end;
        const from = Math.max(0, days.indexOf(start) < 0 ? 0 : days.indexOf(start));
        const to = days.indexOf(end) < 0 ? days.length - 1 : days.indexOf(end);
        const overlap = !!guide && guideOverlaps(conflictPool, guide, booking).some(item => item.kind === 'overlap');
        return { booking, lane, from: start < days[0] ? 0 : from, to: end > days[days.length - 1] ? days.length - 1 : to, overlap, startsBefore: start < days[0], endsAfter: end > days[days.length - 1] };
    });
}

/**
 * 현황표의 가이드 줄: 등록 가이드 전원(배정이 없어도) + 예약에만 있는 미등록 이름.
 * days를 주면 미등록 이름은 그 달에 투어가 있을 때만 줄을 만든다. 각 줄에는 그 가이드의 예약(취소·보류 제외)을 담는다.
 */
export function guideRows(guides: ScheduleGuide[], bookings: ScheduleBooking[], days?: string[]) {
    const active = bookings.filter(activeBooking);
    const rows = guides.map(guide => ({ guide, registered: true, bookings: active.filter(b => hasGuide(b) && matchesGuide(b.assignment?.guide, guide)) }));
    for (const b of active) {
        if (!hasGuide(b) || (days && !inMonth(b, days)) || rows.some(row => matchesGuide(b.assignment?.guide, row.guide))) continue;
        const guide = { id: b.assignment?.guide?.id, name: b.assignment?.guide?.name?.trim() || '이름 없는 가이드' };
        rows.push({ guide, registered: false, bookings: active.filter(x => hasGuide(x) && matchesGuide(x.assignment?.guide, guide)) });
    }
    return rows;
}
