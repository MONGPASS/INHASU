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

const dayKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
const addDays = (day: string, n: number) => { const d = new Date(`${day}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return dayKey(d); };
/** 두 날짜 사이의 일 수(b - a) */
export const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);

/** 월간 달력의 주(일요일 시작, 앞뒤 달 날짜 포함). 디자인 v4 ‘월간’ 보기 */
export function monthWeeks(month: string): string[][] {
    const days = monthDays(month), first = new Date(`${days[0]}T00:00:00Z`).getUTCDay();
    const start = addDays(days[0], -first), count = Math.ceil((first + days.length) / 7);
    return Array.from({ length: count }, (_, w) => Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
}

/**
 * 한 주(7일)에 걸친 예약을 막대 줄로 나눈다. maxLanes를 넘는 예약은 막대 대신 날짜별 ‘+N개 더보기’로 센다.
 * 반환 bars: { booking, lane, from, to(0~6), clipStart(지난주부터 이어짐), clipEnd(다음 주로 이어짐) }
 */
export function weekLanes<T extends ScheduleBooking>(bookings: T[], week: string[], maxLanes = 3) {
    const wS = week[0], wE = week[6];
    const list = bookings.filter(b => key(b.startDate) <= wE && key(b.endDate || b.startDate) >= wS)
        .sort((a, b) => key(a.startDate).localeCompare(key(b.startDate)) || key(b.endDate).localeCompare(key(a.endDate)));
    const ends: number[] = [], more = Array(7).fill(0) as number[], bars: Array<{ booking: T; lane: number; from: number; to: number; clipStart: boolean; clipEnd: boolean }> = [];
    for (const booking of list) {
        const s = key(booking.startDate), e = key(booking.endDate || booking.startDate);
        const from = Math.max(0, dayDiff(wS, s)), to = Math.min(6, dayDiff(wS, e));
        let lane = ends.findIndex(last => last < from);
        if (lane < 0) { lane = ends.length; ends.push(to); } else ends[lane] = to;
        if (lane >= maxLanes) { for (let c = from; c <= to; c++) more[c]++; continue; }
        bars.push({ booking, lane, from, to, clipStart: s < wS, clipEnd: e > wE });
    }
    return { bars, more };
}

export type TimelineRange = 'w1' | 'w2' | 'm';
/**
 * 가이드별 타임라인에 보일 날짜 범위(달 안의 칸 번호, 0부터). 1주·2주는 start가 없으면 오늘이 든 주의 월요일부터.
 * 반환: { from, to } (포함)
 */
export function timelineWindow(dayCount: number, range: TimelineRange, start: number | null, todayIndex: number, todayWeekday = 1) {
    const length = range === 'w1' ? 7 : range === 'w2' ? 14 : dayCount;
    if (length >= dayCount) return { from: 0, to: dayCount - 1 };
    const auto = todayIndex >= 0 ? Math.max(0, todayIndex - (todayWeekday + 6) % 7) : 0;
    const from = Math.max(0, Math.min(dayCount - length, start ?? auto));
    return { from, to: from + length - 1 };
}

/** 같은 차량(등록 이름)이 날짜가 겹치는 다른 예약에도 배정됐는지. 같은 날 교대는 겹침이 아니다. */
export function vehicleClash<T extends ScheduleBooking & { assignment?: { vehicle?: { type?: string } } }>(pool: T[], vehicleName: string, booking: ScheduleBooking) {
    const target = norm(vehicleName);
    if (!target) return undefined;
    const s = key(booking.startDate), e = key(booking.endDate || booking.startDate);
    return pool.find(other => !(other.source === booking.source && other.id === booking.id) && activeBooking(other)
        && norm(other.assignment?.vehicle?.type) === target && key(other.startDate) < e && s < key(other.endDate || other.startDate));
}

/**
 * 담당 가이드에게 전달하는 일정표.
 * - 상품 예약: `/documents/itinerary/:id?guide=1` (가이드용 일정표). 가이드 전용 정보는 고객용 응답에 없으므로
 *   여는 쪽이 `guideDoc:<id>` localStorage로 한 번만 넘긴다(관리자 예약관리의 가이드용 PDF와 같은 방식).
 * - 견적 예약: `/가이드시트?id=` (항공편·고객 명단·일차별 숙소). 관리자 토큰은 sessionStorage에서 읽는다.
 */
interface GuideDocFlight { date?: string; time?: string; flight?: string }
export interface GuideDocBooking {
    source: string; id: string; customerName?: string; leadName?: string; travelers?: number;
    contractData?: { arrival?: GuideDocFlight; departure?: GuideDocFlight };
    assignment?: { guide?: { name?: string; phone?: string }; vehicle?: { type?: string; phone?: string; driver?: string } };
}
export const guideItineraryHref = (b: Pick<GuideDocBooking, 'source' | 'id'>) => b.source === 'quote_booking'
    ? `/가이드시트?id=${encodeURIComponent(b.id)}`
    : `/documents/itinerary/${encodeURIComponent(b.id)}?guide=1`;
const flightLine = (f?: GuideDocFlight) => [f?.date, f?.time, f?.flight].map(v => String(v || '').trim()).filter(Boolean).join(' · ');
export const guideItineraryExtra = (b: GuideDocBooking) => ({
    customerName: (b.leadName || b.customerName || '').trim(),
    people: b.travelers ? `${b.travelers}명` : '',
    arrival: flightLine(b.contractData?.arrival),
    departure: flightLine(b.contractData?.departure),
    guideName: String(b.assignment?.guide?.name || '').trim(),
    guidePhone: String(b.assignment?.guide?.phone || '').trim(),
    vehicleType: String(b.assignment?.vehicle?.type || '').trim(),
    vehiclePhone: String(b.assignment?.vehicle?.phone || '').trim(),
    driverName: String(b.assignment?.vehicle?.driver || '').trim(),
});

/** 목록의 배정 상태: 중복(가이드·차량) > 배정완료(가이드+차량) > 부분 배정 > 미배정 */
export type AssignState = '중복' | '배정완료' | '부분 배정' | '미배정';
export const assignState = (guide: boolean, vehicle: boolean, duplicated: boolean): AssignState =>
    duplicated ? '중복' : guide && vehicle ? '배정완료' : guide || vehicle ? '부분 배정' : '미배정';

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
