import type { AssignmentAccommodation, AssignmentSource, ContractPackageType } from '../../../utils/reservationAssignment';
import { NEW_LODGE_WORKFLOW, isLodgeBookingConfirmed, lodgeMailStatus, lodgeReservationStatus } from '../../../utils/lodgeBookingStatus';
import { packagePlanFromGrades, sheetAreaFor, type PackagePlan } from '../../../utils/accommodationSheet';
import { scheduleStayRegion, type AccommodationSchedule } from '../../../utils/accommodationSchedule';
import { toTourDateKey } from '../../../utils/formatDate';
import type { RegisteredLodge } from '../../../utils/registeredAssignmentResources';

/**
 * 숙소 배정 계산 — 표로 보기(LodgeAssignBoard)와 배정 보드(LodgeAssignQueue)가 같은 계산을 쓴다.
 * 숙박일 상태·계약 일정 지역 불러오기·패키지 판단은 여기 한 곳에서 정한다.
 */
export type LodgePatch = Partial<AssignmentAccommodation['accommodation']>;
/** none 미배정 · sel 배정(요청 전) · req 진행 중(요청 메일을 보내고 답을 기다림) · ok 배정 완료(숙소가 확정) */
export type NightState = 'none' | 'sel' | 'req' | 'ok';

/** 시트·보드에 필요한 예약 정보만 받는다(페이지의 Reservation과 호환). */
export interface LodgeBoardTour {
    id: string; bookingId: string; source: AssignmentSource; customerName?: string; startDate?: string; endDate?: string;
    travelers?: number; assignmentCategory?: string; reservationNumber?: string | null;
    /** 대표 1인 이름(서버 계산). 없으면 예약 이름을 쓴다. */
    leadName?: string;
    /** 고객이 고른 패키지(서버 계산). 숙박 등급을 고르면 그 등급으로 다시 판단한다. */
    packagePlan?: PackagePlan | null;
    contractPackageType?: ContractPackageType;
    /** 계약 일정 — 숙박일마다 지역을 불러온다 */
    schedule?: AccommodationSchedule;
}

/** 숙박일 상태: 숙소 없음 → 미배정, 미발송·배정X·취소완료 → 요청 전, 확정 계열 → 배정 완료, 나머지 → 진행 중 */
export const nightStateOf = (acc: LodgePatch | undefined): NightState => {
    if (!acc?.name?.trim()) return 'none';
    const status = lodgeReservationStatus(acc.bookingStatus);
    if (isLodgeBookingConfirmed(status)) return 'ok';
    if (status === '배정X' || status === '취소완료') return 'sel';
    return status || !['발송전', '배정X'].includes(lodgeMailStatus(acc)) ? 'req' : 'sel';
};

/** 숙소 선택 해제(직접 입력으로 바꿀 때도 이전 숙소 정보를 지운다). 수배는 새로 시작한다. */
export const CLEAR_LODGE: LodgePatch = { id: undefined, name: '', images: [], description: '', facilities: [], address: '', roomAmenities: [], sharedFacilities: [], ...NEW_LODGE_WORKFLOW };

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKeyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const dateOnly = (value?: string) => { const k = value ? toTourDateKey(value) : ''; return /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : ''; };
export const dotted = (k: string) => k ? `${k.slice(0, 4)}.${Number(k.slice(5, 7))}.${k.slice(8, 10)}` : '-';
export const tourNameOf = (t: { leadName?: string; customerName?: string }) => t.leadName?.trim() || t.customerName || '-';
export const withCurrent = (options: readonly string[], current?: string) => current && !options.includes(current) ? [current, ...options] : [...options];
export const sameText = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

export interface LodgeModelNight { night: AssignmentAccommodation; index: number; acc: LodgePatch; date: string; area: string; fromPlan: boolean; state: NightState }
export interface LodgeModel<T extends LodgeBoardTour = LodgeBoardTour> {
    tour: T;
    rows: AssignmentAccommodation[];
    nights: LodgeModelNight[];
    /** 지역이 비어 있는 숙박일(행 번호)에 함께 저장할 계약 일정 지역 */
    fill: Record<number, string>;
    /** 시트의 예약 상태(미배정이 하나라도 있으면 none, 모두 확정이면 ok, 나머지 req) */
    bs: NightState;
    start: string; end: string;
    plan: PackagePlan | null;
    /** 계약 일정상 숙박 수 — 이보다 뒤에 추가한 숙박만 지울 수 있다 */
    planned: number;
}

export function buildLodgeModel<T extends LodgeBoardTour>(tour: T, options: {
    rows: AssignmentAccommodation[]; planned: number; clearedAreas: Set<string>; lodgeRegions: string[];
}): LodgeModel<T> {
    const { rows, planned: plannedCount, clearedAreas, lodgeRegions } = options;
    const storedAreaOf = (acc: LodgePatch) => (typeof acc.region === 'string' && acc.region) || acc.location || '';
    // 저장된 지역 → (관리자가 비우지 않았으면) 계약 일정의 그날 지역을 시트 지명으로. 한 칸이라도 고치면 함께 저장한다.
    const planned = rows.map((night, index) => {
        const d = tour.schedule?.days?.find(item => item.day === night.day);
        return !storedAreaOf(night.accommodation || {}) && !clearedAreas.has(`${tour.id}:${index}`) && d ? sheetAreaFor(scheduleStayRegion(d, lodgeRegions, tour.schedule?.source)) : '';
    });
    const fill = Object.fromEntries(planned.map((area, index) => [index, area]).filter(([, area]) => area)) as Record<number, string>;
    const nights = rows.map((night, index) => {
        const acc = night.accommodation || {}, stored = storedAreaOf(acc);
        return { night, index, acc, date: dateOnly(night.date), area: stored || planned[index], fromPlan: !stored && !!planned[index], state: nightStateOf(acc) };
    });
    const states = nights.map(n => n.state);
    const bs: NightState = states.some(s => s === 'none') ? 'none' : states.some(s => s !== 'ok') ? 'req' : 'ok';
    const plan = tour.contractPackageType || packagePlanFromGrades(rows.map(n => n.accommodation?.type)) || tour.packagePlan || null;
    return { tour, rows, nights, fill, bs, start: dateOnly(tour.startDate), end: dateOnly(tour.endDate), plan, planned: plannedCount };
}

/**
 * 배정 보드의 예약 상태 — 가장 덜 된 숙박을 따른다.
 * 미배정 숙박이 있으면 미배정, 요청 전 숙박이 있으면 배정(요청 메일을 보낼 차례), 답을 기다리는 숙박이 있으면 진행 중, 모두 확정이면 배정 완료.
 * 숙박일이 하나도 없으면(기간 확인 필요) 미배정으로 둔다.
 */
export const tourStateOf = (nights: Array<{ state: NightState }>): NightState => {
    if (!nights.length || nights.some(n => n.state === 'none')) return 'none';
    if (nights.some(n => n.state === 'sel')) return 'sel';
    if (nights.some(n => n.state === 'req')) return 'req';
    return 'ok';
};

/** 숙소 연락 단계: 숙소 배정 → 1메일 → 2메일 → 3메일. 끝낸 단계 수(0~4)를 센다. */
export const LODGE_CONTACT_STEPS = ['숙소 배정', '1메일', '2메일', '3메일'] as const;
const MAIL_DONE: Record<string, number> = { '1메일완료': 1, '2메일완료': 2, '3메일완료': 3 };
export const contactStepsDone = (acc: LodgePatch) => acc.name?.trim() ? 1 + (MAIL_DONE[lodgeMailStatus(acc)] || 0) : 0;
/** 다음에 표시할 메일 회차(발송전 → 1메일완료 …). 끝났거나 배정X면 null. */
export const nextMailStage = (acc: LodgePatch): string | null => {
    const mail = lodgeMailStatus(acc);
    if (mail === '배정X') return null;
    const done = MAIL_DONE[mail] || 0;
    return done >= 3 ? null : `${done + 1}메일완료`;
};

/** 출발까지 남은 일수(오늘 기준, 날짜를 모르면 null) */
export const daysUntil = (dateKey: string, today = new Date()) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
    return Math.round((Date.parse(`${dateKey}T00:00:00Z`) - Date.parse(`${dateKeyOf(today)}T00:00:00Z`)) / 86400000);
};

/** 숙소 고르기: 등록 숙소의 지역(지역이 없으면 ‘지역 미정’) */
export const NO_LODGE_REGION = '지역 미정';
export const lodgeRegionOf = (l: Pick<RegisteredLodge, 'region' | 'location'>) => (l.region || l.location || '').trim() || NO_LODGE_REGION;
const squash = (value: string) => value.toLowerCase().replace(/\s+/g, '');
/** 숙소 고르기 검색: 이름·지역·등급·주소 어디에 있어도 찾는다(대소문자·띄어쓰기 무시) */
export const lodgeMatches = (l: Pick<RegisteredLodge, 'name' | 'region' | 'location' | 'type' | 'address'>, query: string) => {
    const q = squash(query);
    return !q || squash([l.name, l.region, l.location, l.type, l.address].filter(Boolean).join(' ')).includes(q);
};
