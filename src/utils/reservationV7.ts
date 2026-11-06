import { getAccommodationPlan, initialAccommodationRows, type AccommodationSchedule } from './accommodationSchedule.ts';
import { reservationSigned } from './adminReservationBoard.ts';
import { dashboardDayDiff } from './adminDashboard.ts';
import { toTourDateKey } from './formatDate.ts';
import type { AssignmentAccommodation, AssignmentGuide, AssignmentSource, AssignmentVehicle, BookingAssignment } from './reservationAssignment';
import { LODGE_BOOKING_STATUSES } from './lodgeBookingStatus.ts';

/** 예약 관리 v7 목록·상세가 읽는 예약 필드. 상품 예약과 견적 예약을 같은 모양으로 다룬다. */
export interface V7Source {
    id: string; type: 'product' | 'quote' | 'quote_booking'; status: string; reservationNumber?: string;
    customerName: string; phone?: string; email?: string; productName: string;
    startDate?: string; endDate?: string; bookedAtMs?: number; totalPeople?: number; headcount?: string;
    totalAmount: number; deposit: number; balance: number;
    depositStatus: 'unpaid' | 'paid'; balanceStatus: 'unpaid' | 'paid';
    itineraryUrl?: string;
    quoteBooking?: { signed?: boolean; published?: boolean; label?: string } | null;
    contractData?: { agreement?: { agreed?: boolean; agreedAt?: string }; region?: string; category?: string; vehicle?: Record<string, unknown> };
    assignedGuide?: { name?: string; phone?: string };
    dailyAccommodations?: Array<{ day: number; date?: string; accommodation?: Record<string, any> }>;
    adminOperations?: { joining?: string; region?: string; category?: string; vehicle?: string; driverPhone?: string; serviceType?: string; airfare?: string; receipt?: { status?: string } };
}

/** GET /api/admin/assignments 의 한 행. */
export interface V7AssignmentItem {
    key: string; source: AssignmentSource; id: string; version: string; status: string;
    startDate?: string; endDate?: string; accommodationsInitialized?: boolean;
    schedule?: AccommodationSchedule;
    assignment: BookingAssignment;
}

export type V7Tab = 'contract' | 'ongoing' | 'ended' | 'cancel';
export const V7_TABS: Array<{ key: V7Tab; label: string }> = [
    { key: 'contract', label: '계약 완료' }, { key: 'ongoing', label: '투어 진행중' }, { key: 'ended', label: '투어 종료' }, { key: 'cancel', label: '예약 취소' },
];
export const BOOKING_STATUS = { unsent: 'Илгээгээгүй', mailed: 'Имэйл илгээсэн', replied: 'Хариу ирсэн', confirmed: 'Баталгаажсан' } as const;
/** 숙소 수배 상태. 정본은 utils/lodgeBookingStatus.ts(현지 운영 보드와 공유), 화면은 한국어. */
export const BOOKING_STATUS_OPTIONS = LODGE_BOOKING_STATUSES;
export const bookingStatusMeta = (value?: string) => BOOKING_STATUS_OPTIONS.find(o => o.value === value)
    || (value ? { value, label: value, color: '#adb5bd', tone: 'gray' as const } : BOOKING_STATUS_OPTIONS[0]);
/** 객실당 인원. 저장 값은 현지 운영 보드와 같은 `N хүн/өрөө`. */
export const OCCUPANCY_OPTIONS = ['1 хүн/өрөө', '2 хүн/өрөө', '3 хүн/өрөө', '4 хүн/өрөө', '5 хүн/өрөө', '6 хүн/өрөө'];
export const occupancyLabel = (value?: string) => {
    const n = /^(\d+)\s*хүн\/өрөө$/.exec(value || '')?.[1];
    return n ? `${n}인 / 객실` : value || '객실 미정';
};

export interface V7Night { day: number; date: string; region: string; hotel: string; grade: string; occupancy: string; bookingStatus: string; rowIndex: number }
export interface V7Row {
    key: string; source: V7Source; tab: V7Tab; dday: number | null; ended: boolean; nights: number;
    signed: boolean; depositPaid: boolean; balancePaid: boolean;
    guide: { name: string; phone: string } | null; vehicle: { type: string; phone: string } | null;
    stays: V7Night[]; accN: number; accA: number; accC: number; accDone: boolean;
    board: '배정 완료' | '진행 중' | '미배정';
    region: string; category: string; serviceType: string; joining: string; airfare: string; receipt: string;
    todos: string[]; steps: Array<{ label: string; done: boolean }>;
    assignment?: V7AssignmentItem;
}

const dateKey = (value?: string) => { const key = toTourDateKey(value || ''); return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : ''; };
const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function v7Tab(r: Pick<V7Source, 'status' | 'startDate' | 'endDate'>, today: string): V7Tab {
    if (r.status === 'cancelled') return 'cancel';
    const start = dateKey(r.startDate), end = dateKey(r.endDate) || start;
    if (r.status === 'completed' || (end && end < today)) return 'ended';
    if (start && start <= today && end >= today) return 'ongoing';
    return 'contract';
}

/** 화면이 저장 전 행을 펼칠 때와 같은 기준: 배정 기록이 없으면 여행 기간의 빈 숙박 행. */
export function editableAccommodations(item: V7AssignmentItem): AssignmentAccommodation[] {
    const unassigned = item.accommodationsInitialized === false || (!item.assignment.accommodations.length && !!item.schedule?.days?.length);
    return initialAccommodationRows({ startDate: item.startDate, endDate: item.endDate, schedule: item.schedule, dailyAccommodations: unassigned ? undefined : item.assignment.accommodations });
}

export function v7Row(source: V7Source, item: V7AssignmentItem | undefined, today: string): V7Row {
    const start = dateKey(source.startDate), end = dateKey(source.endDate);
    const tab = v7Tab(source, today);
    const ops = source.adminOperations || {};
    const guideName = text(item ? item.assignment.guide?.name : source.assignedGuide?.name);
    const guidePhone = text(item ? item.assignment.guide?.phone : source.assignedGuide?.phone);
    const vehicleType = text(item ? item.assignment.vehicle?.type : ops.vehicle || (source.contractData?.vehicle as any)?.type);
    const vehiclePhone = text(item ? item.assignment.vehicle?.phone : ops.driverPhone || (source.contractData?.vehicle as any)?.phone);
    const plan = getAccommodationPlan(item
        ? { startDate: item.startDate || start, endDate: item.endDate || end, schedule: item.schedule, dailyAccommodations: editableAccommodations(item) }
        : { startDate: start, endDate: end, dailyAccommodations: source.dailyAccommodations as AssignmentAccommodation[] | undefined });
    const stays: V7Night[] = plan.nights.map(night => {
        const rowIndex = plan.rows.findIndex(row => Number(row.day) === night.day), acc = rowIndex >= 0 ? plan.rows[rowIndex].accommodation || {} : {};
        const hotel = text(acc.name);
        return { day: night.day, date: night.date || night.calendarDate, region: text(acc.region) || text(acc.location) || night.region || night.title,
            hotel, grade: text(acc.type), occupancy: text(acc.occupancy), bookingStatus: hotel ? text(acc.bookingStatus) || BOOKING_STATUS.unsent : '', rowIndex };
    });
    const accN = plan.needed ?? 0, accA = plan.assigned, accC = plan.confirmed, accDone = accN === 0 || plan.complete;
    const board: V7Row['board'] = accDone && guideName && vehicleType ? '배정 완료' : accA || guideName || vehicleType ? '진행 중' : '미배정';
    const signed = reservationSigned(source as any), depositPaid = source.depositStatus === 'paid', balancePaid = source.balanceStatus === 'paid';
    const dday = start ? dashboardDayDiff(today, start) : null;
    const receipt = text(ops.receipt?.status) || 'not_requested';
    const todos: string[] = [];
    if (tab !== 'cancel') {
        if (!signed) todos.push('계약서');
        if (!depositPaid) todos.push('예약금');
        if (tab === 'contract') { if (!guideName) todos.push('가이드'); if (!vehicleType) todos.push('차량'); if (!accDone) todos.push('숙소'); }
        if (!balancePaid && (tab !== 'contract' || (dday !== null && dday <= 30))) todos.push('잔금');
        if (tab === 'ended' && ['pending', 'info_missing'].includes(receipt)) todos.push('영수증');
    }
    return {
        key: `${source.type}:${source.id}`, source, tab, dday, ended: tab === 'ended', nights: start && end ? Math.max(0, dashboardDayDiff(start, end) ?? 0) : 0,
        signed, depositPaid, balancePaid,
        guide: guideName ? { name: guideName, phone: guidePhone } : null, vehicle: vehicleType ? { type: vehicleType, phone: vehiclePhone } : null,
        stays, accN, accA, accC, accDone, board,
        region: text(ops.region) || text(source.contractData?.region) || source.productName || '지역 미정',
        category: text(ops.category) || text(source.contractData?.category), serviceType: text(ops.serviceType), joining: text(ops.joining) || 'undecided',
        airfare: text(ops.airfare), receipt, todos,
        steps: [{ label: '계약서', done: signed }, { label: '예약금', done: depositPaid }, { label: '배정', done: board === '배정 완료' },
            { label: '잔금', done: balancePaid }, { label: '출발', done: tab === 'ongoing' || tab === 'ended' }],
        assignment: item,
    };
}

const NEXT: Record<string, string> = { 계약서: '계약서 서명', 예약금: '예약금 확인', 배정: '배정 필요', 잔금: '잔금 확인', 출발: '출발 대기 중' };
/** 진행 단계 머리의 '지금 단계' 문구. */
export function v7StepLabel(row: V7Row) {
    if (row.tab === 'cancel') return { label: '취소된 예약', tone: 'gray' as const };
    const cur = row.steps.findIndex(s => !s.done);
    if (cur < 0) return { label: '모든 단계 완료', tone: 'mint' as const };
    return { label: NEXT[row.steps[cur].label] + (row.todos.length > 1 ? ` +${row.todos.length - 1}` : ''), tone: 'red' as const };
}

export const v7Won = (n: number | null | undefined) => typeof n === 'number' && Number.isFinite(n) ? `₩${n.toLocaleString('ko-KR')}` : '–';
/** 진행 단계 아래 줄. */
export function v7StepSubs(row: V7Row) {
    const r = row.source, d = row.dday;
    return [row.signed ? '서명 완료' : '서명 전', row.depositPaid ? `${v7Won(r.deposit)} 입금` : '미입금',
        `${row.accC}/${row.accN}박 · ${row.guide && row.vehicle ? '가이드·차량 완료' : '가이드·차량 필요'}`,
        row.balancePaid ? '완납' : `${v7Won(r.balance)} 미수`,
        row.ended ? '투어 종료' : d === null ? '일정 미정' : d < 0 ? '투어 중' : d === 0 ? '오늘 출발' : `D-${d}`];
}

export function v7Dday(row: V7Row): { label: string; tone: 'red' | 'mint' | 'gray' | 'amber'; dot: boolean } {
    const d = row.dday;
    if (row.ended) return { label: '종료', tone: 'gray', dot: false };
    if (d === null) return { label: '미정', tone: 'gray', dot: false };
    if (d < 0) return { label: '진행 중', tone: 'mint', dot: false };
    return { label: d === 0 ? 'D-DAY' : `D-${d}`, tone: d <= 7 ? 'red' : 'amber', dot: d <= 7 };
}

export function v7Range(row: V7Row) {
    const s = dateKey(row.source.startDate), e = dateKey(row.source.endDate);
    if (!s) return { range: '일정 미정', sch: '' };
    return { range: `${s.replaceAll('-', '.')}${e && e !== s ? ` – ${e.slice(5).replace('-', '.')}` : ''}`, sch: e && e !== s ? `${row.nights}박${row.nights + 1}일` : '당일' };
}

export type V7Quick = 'all' | 'week' | 'bal' | 'asg' | 'ct' | 'dep';
export const V7_QUICK: Array<{ key: V7Quick; label: string; icon: string; sub: string; test: (r: V7Row) => boolean }> = [
    { key: 'all', label: '전체', icon: 'lc-list', sub: '이 탭의 모든 예약', test: () => true },
    { key: 'week', label: '이번 주 출발', icon: 'lc-plane-takeoff', sub: '7일 안에 출발', test: r => r.dday !== null && r.dday >= 0 && r.dday <= 7 },
    { key: 'bal', label: '잔금 미수', icon: 'lc-wallet', sub: '', test: r => !r.balancePaid },
    { key: 'asg', label: '미배정', icon: 'lc-user-round', sub: '가이드 · 차량 · 숙소', test: r => r.tab === 'contract' && r.board !== '배정 완료' },
    { key: 'ct', label: '계약서 미작성', icon: 'lc-file-text', sub: '서명 요청 필요', test: r => !r.signed },
    { key: 'dep', label: '예약금 미입금', icon: 'lc-circle-alert', sub: '입금 확인 필요', test: r => !r.depositPaid },
];

export type V7Sort = 'pri' | 'dep' | 'bk';
export function v7Sort(rows: V7Row[], sort: V7Sort) {
    const list = [...rows];
    if (sort === 'pri') list.sort((a, b) => b.todos.length - a.todos.length || Math.abs(a.dday ?? 9999) - Math.abs(b.dday ?? 9999));
    if (sort === 'dep') list.sort((a, b) => dateKey(a.source.startDate || '9999').localeCompare(dateKey(b.source.startDate || '9999')) || 0);
    if (sort === 'bk') list.sort((a, b) => (b.source.bookedAtMs || 0) - (a.source.bookedAtMs || 0));
    return list;
}

/** 이름·전화번호(숫자만도)·가이드 이름·예약번호 검색. */
export function v7Matches(row: V7Row, query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const r = row.source, digits = q.replace(/[-\s]/g, '');
    return [r.customerName, r.phone || '', row.guide?.name || '', r.reservationNumber || '', r.productName].some(v => v.toLowerCase().includes(q))
        || (/^\d+$/.test(digits) && (r.phone || '').replace(/\D/g, '').includes(digits));
}

/** 가이드·차량만 바꿀 때는 숙소 행을 서버 원본 그대로 보낸다. */
export function withGuide(item: V7AssignmentItem, guide: AssignmentGuide): BookingAssignment {
    return { guide, vehicle: item.assignment.vehicle, accommodations: item.assignment.accommodations };
}
export function withVehicle(item: V7AssignmentItem, vehicle: AssignmentVehicle): BookingAssignment {
    return { guide: item.assignment.guide, vehicle, accommodations: item.assignment.accommodations };
}
/** 박별 숙소를 바꿀 때는 화면에 펼친 행(빈 숙박 포함)을 저장한다. */
export function withNight(item: V7AssignmentItem, day: number, change: (row: AssignmentAccommodation) => AssignmentAccommodation): BookingAssignment {
    const rows = editableAccommodations(item);
    return { guide: item.assignment.guide, vehicle: item.assignment.vehicle, accommodations: rows.map(row => Number(row.day) === day ? change(row) : row) };
}

export async function fetchV7Assignments(signal?: AbortSignal): Promise<{ items: V7AssignmentItem[]; warnings: string[] }> {
    const response = await fetch('/api/admin/assignments', { credentials: 'same-origin', cache: 'no-store', signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || '배정 정보를 불러오지 못했습니다.');
    return { items: Array.isArray(body.items) ? body.items : [], warnings: Array.isArray(body.warnings) ? body.warnings : [] };
}
/** allowGuideConflict: 관리자가 같은 기간 가이드 중복을 확인한 경우에만 true. 서버가 중복으로 거절하면 error.code === 'guide_conflict'. */
export async function saveV7Assignment(item: V7AssignmentItem, assignment: BookingAssignment, options: { allowGuideConflict?: boolean } = {}): Promise<V7AssignmentItem> {
    const response = await fetch(`/api/admin/assignments/${item.source}/${encodeURIComponent(item.id)}`, { method: 'PATCH', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: item.version, assignment, ...(options.allowGuideConflict ? { allowGuideConflict: true } : {}) }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || '배정을 저장하지 못했습니다.'), { code: body.code, conflicts: body.conflicts });
    return body.item;
}
