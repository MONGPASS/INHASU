/**
 * 코스 관리 계산 — 화면은 pages/AdminCourseManage.tsx.
 * 저장 형식은 옛 도구 public/코스관리.html과 같다: `courses`는 { 코스 이름: 코스 }.
 * 견적서 만들기의 ‘코스 불러오기’·상품의 코스 가져오기(courseImport.ts)가 같은 자료를 읽으므로 칸 이름을 바꾸지 않는다.
 * 옛 도구와 달리 이 화면이 다루지 않는 칸(코스·요금·일자의 다른 칸)은 지우지 않는다.
 */
import { moveText, splitMove, type Snippet, type SnippetLibrary } from './itinerarySnippets';

export interface CourseBalance { pax?: number; economy?: number; full?: number; amount?: number; [key: string]: unknown }
export interface CourseOption { label?: string; calc?: string; [key: string]: unknown }
export interface CoursePrice { deposit?: number; balances?: CourseBalance[]; options?: CourseOption[]; [key: string]: unknown }
export interface CourseDay {
    d?: number;
    dest?: string;
    move?: string;
    dist?: string;
    items?: string[];
    stay?: { name?: string; tags?: string[]; [key: string]: unknown };
    meals?: string[];
    [key: string]: unknown;
}
export interface CourseRecord {
    destination?: string;
    nights?: string;
    intensity?: number;
    /** 대표 1인 총액(예약금 + 가장 적은 인원 실속형 잔금) — 목록·필터와 옛 화면 호환용 */
    base?: number;
    price?: CoursePrice;
    vehicle?: string;
    /** 대표 명소: 여행지 관리(spots)의 이름을 고른 순서대로 */
    highlights?: string[];
    days?: CourseDay[];
    [key: string]: unknown;
}
export type CourseLibrary = Record<string, CourseRecord>;

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => String(item ?? '')) : []);
const num = (value: unknown) => { const n = Number(value); return Number.isFinite(n) ? n : 0; };
const brToSlash = (value: unknown) => String(value ?? '').replace(/<br\s*\/?>/gi, ' / ');
const brToSpace = (value: unknown) => String(value ?? '').replace(/<br\s*\/?>/gi, ' ');

export const won = (value: unknown) => `${num(value).toLocaleString('ko-KR')}원`;

/** 서버 자료 형식 확인. 없으면 빈 값. */
export const readCourses = (data: unknown): CourseLibrary => {
    if (data == null) return {};
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('코스 자료 형식을 확인할 수 없습니다.');
    return data as CourseLibrary;
};

/** 코스 일수 — 일자 배열 우선, 없으면 ‘4박5일’ 문구에서(옛 도구와 같은 정렬 기준). 모르면 99(맨 뒤). */
export const courseDayCount = (course: CourseRecord): number => {
    if (Array.isArray(course.days) && course.days.length) return course.days.length;
    const days = String(course.nights || '').match(/(\d+)\s*일/);
    if (days) return Number(days[1]);
    const nights = parseInt(String(course.nights ?? ''), 10);
    return Number.isFinite(nights) ? nights + 1 : 99;
};

/* ── 목록 거르기(옛 도구의 다섯 고르기 칸과 같은 값) ── */
export const PRICE_RANGES = [
    { value: '0-500000', label: '50만원 이하' },
    { value: '500001-800000', label: '50~80만원' },
    { value: '800001-1200000', label: '80~120만원' },
    { value: '1200001-999999999', label: '120만원 이상' },
];
export const INTENSITY_RANGES = [
    { value: '1-2', label: '여유로운 일정' },
    { value: '3', label: '보통 일정' },
    { value: '4-5', label: '활동적인 일정' },
];
export interface CourseFilter { query: string; days: string; dest: string; highlight: string; price: string; intensity: string }
export const EMPTY_FILTER: CourseFilter = { query: '', days: '', dest: '', highlight: '', price: '', intensity: '' };

export const filterCourses = (library: CourseLibrary, filter: CourseFilter): Array<[string, CourseRecord]> => {
    const q = filter.query.trim().toLowerCase();
    const [pMin, pMax] = filter.price ? filter.price.split('-').map(Number) : [0, Infinity];
    const [iMin, iMax] = filter.intensity ? filter.intensity.split('-').map(Number) : [0, Infinity];
    return Object.entries(library).filter(([name, course]) => {
        const hay = [name, course.destination, course.nights, ...strings(course.highlights)].join(' ').toLowerCase();
        const level = Number(course.intensity || 3), amount = num(course.base);
        return (!q || hay.includes(q))
            && (!filter.days || String((course.days || []).length) === filter.days)
            && (!filter.dest || course.destination === filter.dest)
            && (!filter.highlight || strings(course.highlights).includes(filter.highlight))
            && (!filter.price || (amount >= pMin && amount <= pMax))
            && (!filter.intensity || (level >= iMin && level <= (iMax || iMin)));
    }).sort((a, b) => courseDayCount(a[1]) - courseDayCount(b[1]) || a[0].localeCompare(b[0], 'ko'));
};

/** 고르기 칸의 선택지(자료에 있는 일수·여행지·명소) */
export const filterChoices = (library: CourseLibrary) => {
    const courses = Object.values(library);
    return {
        days: [...new Set(courses.map((course) => (course.days || []).length))].filter(Boolean).sort((a, b) => a - b),
        dests: [...new Set(courses.map((course) => course.destination).filter((value): value is string => !!value))].sort(),
        highlights: [...new Set(courses.flatMap((course) => strings(course.highlights)).filter(Boolean))].sort(),
    };
};

/* ── 복제·이름 ── */
export const copyName = (library: CourseLibrary, name: string) => {
    let candidate = `${name} 복사본`, n = 2;
    while (library[candidate]) candidate = `${name} 복사본 ${n++}`;
    return candidate;
};
export const duplicateCourse = (library: CourseLibrary, name: string): { library: CourseLibrary; name: string } => {
    const next = copyName(library, name);
    return { library: { ...library, [next]: structuredClone(library[name]) }, name: next };
};

/** 이름을 바꿔도 목록 자리 그대로(옛 도구는 끝으로 보냈다). */
export const putCourse = (library: CourseLibrary, previousName: string | null, name: string, course: CourseRecord): CourseLibrary => {
    if (!previousName || previousName === name) return { ...library, [name]: course };
    const out: CourseLibrary = {};
    Object.entries(library).forEach(([key, value]) => {
        if (key === name) return;
        if (key === previousName) out[name] = course; else out[key] = value;
    });
    return out;
};
export const removeCourse = (library: CourseLibrary, name: string): CourseLibrary => {
    const out = { ...library };
    delete out[name];
    return out;
};

/* ── 편집 칸 ── */
export interface DayForm {
    /** 화면 안에서만 쓰는 구분 값(저장하지 않음) */
    key: string;
    dest: string;
    move: string;
    items: string;
    stay: string;
    tags: string;
    breakfast: string;
    lunch: string;
    dinner: string;
    /** 원래 일자(이 화면이 다루지 않는 칸 보존용). 일정 불러오기로 바꾼 일자는 없음 */
    original?: CourseDay;
}
export interface BalanceForm { pax: number; economy: string; full: string; original?: CourseBalance }
export interface CourseForm {
    name: string;
    destination: string;
    nights: string;
    vehicle: string;
    intensity: string;
    deposit: string;
    options: CourseOption[];
    balances: BalanceForm[];
    highlights: string[];
    days: DayForm[];
}

let dayKeySeed = 0;
const dayKey = () => `day-${++dayKeySeed}`;

export const blankDay = (): DayForm => ({ key: dayKey(), dest: '', move: '', items: '', stay: '', tags: '', breakfast: '', lunch: '', dinner: '' });
const mealFields = (meals: unknown) => { const list = strings(meals); return { breakfast: list[0] || '', lunch: list[1] || '', dinner: list[2] || '' }; };

export const dayFormFrom = (day: CourseDay): DayForm => ({
    key: dayKey(),
    dest: brToSlash(day.dest),
    move: moveText(day as Snippet),
    items: strings(day.items).join('\n'),
    stay: brToSpace(day.stay?.name),
    tags: strings(day.stay?.tags).join(', '),
    ...mealFields(day.meals),
    original: day,
});

/** 일정 관리의 하루 일정으로 이 일자를 채운다(옛 도구와 같이 일자 내용을 통째로 바꾼다). */
export const dayFormFromSnippet = (snippet: Snippet): DayForm => ({
    key: dayKey(),
    dest: brToSlash(snippet.dest),
    move: moveText(snippet),
    items: strings(snippet.items).join('\n'),
    stay: brToSpace(snippet.stay?.name),
    tags: strings(snippet.stay?.tags).join(', '),
    ...mealFields(snippet.meals),
});

const balanceEconomy = (b: CourseBalance) => (b.economy != null ? b.economy : (b.amount || 0));
const balanceFull = (b: CourseBalance) => (b.full != null ? b.full : (b.amount || 0));

export const formFromCourse = (name: string, course?: CourseRecord): CourseForm => {
    const price = course?.price;
    const balances = Array.isArray(price?.balances) ? price!.balances! : [];
    return {
        name,
        destination: String(course?.destination ?? ''),
        nights: String(course?.nights ?? ''),
        vehicle: String(course?.vehicle ?? ''),
        intensity: String(course?.intensity || 3),
        deposit: String(price?.deposit ?? 50000),
        options: Array.isArray(price?.options) ? price!.options!.map((option) => ({ ...option })) : [],
        // 새 코스(또는 잔금이 없는 코스)는 자주 쓰는 2~6인 줄을 미리 깐다 — 0원 줄은 저장할 때 빠진다(옛 도구와 같음)
        balances: (balances.length ? balances : [2, 3, 4, 5, 6].map((pax) => ({ pax, economy: 0, full: 0 })))
            .map((b) => ({ pax: num(b.pax), economy: String(balanceEconomy(b)), full: String(balanceFull(b)), original: balances.includes(b) ? b : undefined }))
            .sort((a, b) => a.pax - b.pax),
        highlights: strings(course?.highlights),
        days: Array.isArray(course?.days) && course!.days!.length ? course!.days!.map(dayFormFrom) : [blankDay()],
    };
};

/** 화면에 보이는 값이 같으면 저장된 원래 값(`<br>` 줄바꿈 포함)을 그대로 둔다. */
const keepIfSame = (original: unknown, shown: string, edited: string, saved: string) => (original != null && shown === edited ? String(original) : saved);

const dayFromForm = (form: DayForm, index: number): CourseDay => {
    const original = form.original;
    const { move, dist } = splitMove(form.move);
    const dest = form.dest;
    const stay = form.stay;
    return {
        ...(original || {}),
        d: index + 1,
        dest: keepIfSame(original?.dest, brToSlash(original?.dest), dest, dest.replace(/ \/ /g, '<br>')),
        move,
        dist,
        items: form.items.split('\n').filter((line) => line.trim()),
        stay: { ...(original?.stay || {}), name: keepIfSame(original?.stay?.name, brToSpace(original?.stay?.name), stay, stay), tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) },
        // 조·중·석 세 칸 + 원래 일자의 네 번째 이후 식사 칸(보존)
        meals: [form.breakfast, form.lunch, form.dinner].map((meal) => meal.trim()).concat(strings(original?.meals).slice(3)),
    };
};

/** 편집 칸 → 저장할 코스. 요금·명소·일자는 옛 도구와 같은 규칙으로 만들고, 이 화면이 모르는 칸은 남긴다. */
export const courseFromForm = (form: CourseForm, original?: CourseRecord): CourseRecord => {
    const deposit = parseInt(form.deposit, 10) || 0;
    const balances = form.balances
        .map((b) => ({ ...(b.original || {}), pax: num(b.pax), economy: parseInt(b.economy, 10) || 0, full: parseInt(b.full, 10) || 0 }))
        .map(({ amount: _amount, ...rest }) => rest as CourseBalance)
        .filter((b) => num(b.pax) > 0 && (num(b.economy) > 0 || num(b.full) > 0))
        .sort((a, b) => num(a.pax) - num(b.pax));
    const options = form.options.filter((option) => String(option.label || '').trim());
    return {
        ...(original || {}),
        destination: form.destination.trim(),
        nights: form.nights.trim(),
        intensity: parseInt(form.intensity, 10) || 3,
        base: balances.length ? deposit + (num(balances[0].economy) || num(balances[0].full)) : num(original?.base),
        price: { ...(original?.price || {}), deposit, balances, options },
        vehicle: form.vehicle.trim(),
        highlights: [...form.highlights],
        days: form.days.map(dayFromForm),
    };
};

/** 인원별 잔금 줄 더하기 — 같은 인원이 있으면 금액만 바꾼다(옛 도구와 같음). */
export const addBalance = (balances: BalanceForm[], pax: number, economy: string, full: string): BalanceForm[] => {
    const exists = balances.find((b) => b.pax === pax);
    const next = exists
        ? balances.map((b) => (b === exists ? { ...b, economy: economy || '0', full: full || '0' } : b))
        : [...balances, { pax, economy: economy || '0', full: full || '0' }];
    return next.sort((a, b) => a.pax - b.pax);
};

/** 명소 고르기: 이미 있으면 빼고 없으면 끝에 더한다(고른 순서가 견적서 명소 순서). */
export const toggleHighlight = (highlights: string[], name: string) =>
    (highlights.includes(name) ? highlights.filter((item) => item !== name) : [...highlights, name]);

export const moveDay = (days: DayForm[], index: number, delta: number): DayForm[] => {
    const target = index + delta;
    if (target < 0 || target >= days.length) return days;
    const next = [...days];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return next;
};

/**
 * ‘일정 불러오기’ 고르기 칸: 일정 관리의 지역 순서대로 묶고, 목록에 없는 지역은 그 뒤, 지역 없는 일정은 ‘기타’로 맨 끝.
 * (옛 도구와 같은 순서)
 */
export const snippetGroups = (snippets: SnippetLibrary, cats: string[]): Array<{ group: string; names: string[] }> => {
    const byCat: Record<string, string[]> = {};
    Object.entries(snippets).forEach(([name, snippet]) => {
        const cat = (snippet && snippet.cat ? String(snippet.cat).trim() : '') || '기타';
        (byCat[cat] = byCat[cat] || []).push(name);
    });
    const ordered = [...cats.filter((cat) => byCat[cat]), ...Object.keys(byCat).filter((cat) => !cats.includes(cat) && cat !== '기타')];
    if (byCat['기타'] && !ordered.includes('기타')) ordered.push('기타');
    return ordered.map((group) => ({ group, names: byCat[group] }));
};
