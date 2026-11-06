import { toTourDateKey } from './formatDate.ts';

/**
 * 숙소 배정 시트 — 현지 운영팀이 쓰던 숙소 배정 스프레드시트(A~S열)를 보드에서 그대로 쓰기 위한 목록과 계산.
 * 저장 값은 기존 데이터와 같은 표기를 유지하고(객실당 인원 `N хүн/өрөө` 등), 새 값만 시트 표기로 저장한다.
 */

/** M열 숙소지역 — 시트의 지명 목록. 등록 숙소의 지역과 기존 값도 함께 고를 수 있다. */
export const LODGE_AREA_OPTIONS = ['Bayanzag', 'Elsen tasarkhai', 'Erdenet', 'Hustai', 'Huvsgul', 'Kharkhorin', 'Khongoriin els', 'Moron',
    'Orkhon hurhree', 'Terelj', 'Baga gazriin chuluu', 'Tsagaannuur', 'Tsagaansuvarga', 'Tsenher', 'UB', 'UgiiNuur', 'Yoliin am', 'Shine-Eder', 'Bulgan'];

/** N열 등급 — 기존 저장 표기를 유지하고 시트에만 있던 등급을 더한다. */
export const LODGE_GRADE_OPTIONS = ['고급 게르', '디럭스 게르', '일반 게르', '5성급 호텔', '4성급호텔', '3성급 호텔', '목조하우스', '게스트하우스', '골프장', 'Tureesiin bair', '이용x/개별'];

/** O열 방수 — 객실당 인원. 1~6인은 기존 저장 값(`N хүн/өрөө`)을 쓰고 골프·개별 이용은 시트 표기로 저장한다. */
export const ROOM_PLAN_OPTIONS: Array<{ value: string; label: string }> = [
    ...[1, 2, 3, 4, 5, 6].map(n => ({ value: `${n} хүн/өрөө`, label: `${n}인1실` })),
    { value: '골프오전', label: '골프오전' }, { value: '골프오후', label: '골프오후' }, { value: '이용x/개별', label: '이용x/개별' },
];
export const roomPlanLabel = (value: unknown) => {
    const v = typeof value === 'string' ? value : '';
    return ROOM_PLAN_OPTIONS.find(o => o.value === v)?.label ?? v;
};

/** P열 배정 구분 — 실제로 배정한 객실 구성. 시트 표기 그대로 저장한다. */
export const ASSIGN_TYPE_OPTIONS = ['1인1실', '2인1실', '3인1실', '4인1실', '골프오전', '골프오후', '이용x/개별'];

const dayMs = 86400000;
const dateKey = (value?: string) => { const key = value ? toTourDateKey(value) : ''; return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : ''; };

/**
 * 오늘 이후(오늘 포함)에 진행되는 투어만 숙소 배정 대상이다.
 * 끝난 날(없으면 출발일)이 오늘보다 앞이면 지난 투어. 날짜가 하나도 없는 예약은 확인이 필요하므로 남긴다.
 */
export function isUpcomingTour(tour: { startDate?: string; endDate?: string }, today: string) {
    const start = dateKey(tour.startDate), end = dateKey(tour.endDate);
    if (!start && !end) return true;
    return [start, end].some(key => key && key >= today);
}

/** F열 일정 — 날짜로 계산한 `N박M일`. 시트 목록처럼 당일·10박이상·미정을 쓴다. */
export function tripLengthLabel(startDate?: string, endDate?: string) {
    const start = dateKey(startDate), end = dateKey(endDate);
    if (!start || !end) return '미정';
    const nights = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / dayMs);
    if (nights < 0) return '미정';
    if (nights === 0) return '당일';
    return nights >= 10 ? '10박이상' : `${nights}박${nights + 1}일`;
}

/** I열 투어 월 */
export const tourMonthLabel = (startDate?: string) => { const key = dateKey(startDate); return key ? `${Number(key.slice(5, 7))}월` : '미정'; };

/** A열 일련번호 — 예약 순서(접수일, 같으면 출발일·ID)대로 1부터. 지난 투어를 숨겨도 번호는 바뀌지 않는다. */
export function tourSerials(tours: Array<{ id: string; createdAt?: string; startDate?: string }>) {
    const order = [...tours].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')
        || (a.startDate || '').localeCompare(b.startDate || '') || a.id.localeCompare(b.id));
    return new Map(order.map((tour, index) => [tour.id, index + 1]));
}

/**
 * 계약 일정의 지역 표기를 숙소 배정 시트의 지명(M열 목록)으로 바꾼다.
 * 목록에 없는 지역(예: 중앙몽골·남고비)은 일정 표기 그대로 둔다.
 */
const AREA_ALIASES: Array<[RegExp, string]> = [
    [/테[를렐]지|terelj|거북바위|아리야발/i, 'Terelj'],
    [/울란바[토타]르|칭기스칸\s*공항|자이산|간단\s*사원|수흐바타르|^ub$/i, 'UB'],
    [/엘[승선]\s*타사르|미니\s*고비|elsen/i, 'Elsen tasarkhai'],
    [/하르허린|카라코룸|에르덴\s*조|kharkhorin|karakorum/i, 'Kharkhorin'],
    [/홉스[굴골]|하트갈|khuvsgul|huvsgul/i, 'Huvsgul'],
    [/무릉|므릉|murun|moron/i, 'Moron'],
    [/에르데넷|erdenet/i, 'Erdenet'],
    [/후스타이|hustai/i, 'Hustai'],
    [/어르[헝홍]|오르[홍혼헝]|orkhon/i, 'Orkhon hurhree'],
    [/바양작|bayanzag/i, 'Bayanzag'],
    [/홍고린\s*엘스|khongor/i, 'Khongoriin els'],
    [/바가\s*가즈링|baga\s*gaz/i, 'Baga gazriin chuluu'],
    [/차강\s*소브라가|tsagaan\s*suvarga/i, 'Tsagaansuvarga'],
    [/차강\s*[노누]르|tsagaan\s*nuur/i, 'Tsagaannuur'],
    [/쳉헤르|tsenkher|tsenher/i, 'Tsenher'],
    [/어기\s*호수|오기\s*호수|ugii/i, 'UgiiNuur'],
    [/욜[링린]\s*암|yol[iy]n\s*am/i, 'Yoliin am'],
    [/신\s*에드|shine[-\s]*ed/i, 'Shine-Eder'],
    [/불[간강]|bulgan/i, 'Bulgan'],
];
export function sheetAreaFor(region: unknown) {
    const value = typeof region === 'string' ? region.trim() : '';
    if (!value) return '';
    return AREA_ALIASES.find(([pattern]) => pattern.test(value))?.[1] ?? value;
}

/** 고객명 괄호 — 풀패키지·실속·혼합 */
export type PackagePlan = 'full' | 'value' | 'mixed';
export const PACKAGE_LABELS: Record<PackagePlan, string> = { full: '풀패키지', value: '실속', mixed: '혼합' };
const HIGH_GRADE = /고급|디럭스|최고급|5성|4성/;
const STANDARD_GRADE = /일반|스탠[다더]드|3성|게스트|목조|tureesiin/i;
/**
 * 배정한 숙박 등급으로 패키지를 판단한다. 고급(고급·디럭스 게르, 4·5성급)만이면 풀패키지,
 * 일반(일반 게르, 3성급, 게스트하우스 등)만이면 실속, 둘이 섞이면 혼합. 등급이 없으면 null.
 */
export function packagePlanFromGrades(grades: unknown[]): PackagePlan | null {
    let high = false, standard = false;
    for (const grade of grades) {
        const value = typeof grade === 'string' ? grade : '';
        if (HIGH_GRADE.test(value)) high = true;
        else if (STANDARD_GRADE.test(value)) standard = true;
    }
    return high && standard ? 'mixed' : high ? 'full' : standard ? 'value' : null;
}
