/**
 * 일정 관리(하루 일정 조각) 계산 — 화면은 pages/AdminItineraryManage.tsx.
 * 저장 형식은 옛 도구 public/일정관리.html과 같다: `snippets`는 { 일정 이름: 일정 }, `snippet_cats`는 지역 이름 배열(순서·빈 지역 보존).
 * 견적서 만들기·예약 일정표 편집의 ‘일정 불러오기’가 같은 자료를 읽으므로 칸 이름을 바꾸지 않는다.
 */
export interface SnippetStay { name?: string; tags?: string[]; [key: string]: unknown }
export interface Snippet {
    cat?: string;
    dest?: string;
    move?: string;
    dist?: string;
    items?: string[];
    stay?: SnippetStay;
    meals?: string[];
    /** 사진·설명 등 이 화면이 고치지 않는 칸 — 저장할 때 그대로 둔다 */
    [key: string]: unknown;
}
export type SnippetLibrary = Record<string, Snippet>;

export const UNCAT = '미분류';
/** 칩 값: 전체·미분류는 지역 이름과 겹치지 않는 값 */
export const ALL = '__all';
export const NONE = '__none';

export const stripBr = (value: unknown) => String(value ?? '').replace(/<br\s*\/?>/gi, ' ');
export const catOf = (snippet: Snippet | undefined) => (snippet && snippet.cat ? String(snippet.cat).trim() : '');
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.map((item) => String(item ?? '')) : []);

/** 저장된 지역 목록 + 일정에 들어 있는데 목록에 없는 지역(옛 도구와 같이 끝에 붙인다). */
export const mergeCats = (library: SnippetLibrary, cats: string[]): string[] => {
    const out = cats.filter((cat, index) => cat && cats.indexOf(cat) === index);
    Object.values(library).forEach((snippet) => { const cat = catOf(snippet); if (cat && !out.includes(cat)) out.push(cat); });
    return out;
};

export const countIn = (library: SnippetLibrary, cat: string) => Object.values(library).filter((snippet) => catOf(snippet) === cat).length;
export const countNone = (library: SnippetLibrary) => Object.values(library).filter((snippet) => !catOf(snippet)).length;

/** 지역 칩과 검색으로 거른 [이름, 일정] 목록(저장 순서 그대로). */
export const filterSnippets = (library: SnippetLibrary, active: string, query: string): Array<[string, Snippet]> => {
    const q = query.trim().toLowerCase();
    return Object.entries(library).filter(([name, snippet]) => {
        if (active === NONE ? catOf(snippet) : active !== ALL && catOf(snippet) !== active) return false;
        if (!q) return true;
        return [name, stripBr(snippet.dest), stripBr(snippet.stay?.name), ...strings(snippet.items)].some((text) => text.toLowerCase().includes(q));
    });
};

/** 이동 칸 한 줄: ‘이동 5시간 (250 km)’ */
export const moveText = (snippet: Snippet) => [snippet.move, snippet.dist].map((value) => String(value ?? '').trim()).filter(Boolean).join(' ');

/** 옛 도구와 같은 규칙으로 이동 칸을 시간·거리로 나눈다: 마지막 괄호가 거리. */
export const splitMove = (raw: string): { move: string; dist: string } => {
    const match = raw.trim().match(/^(.*?)(\(.*\))?\s*$/);
    return { move: (match?.[1] || '').trim(), dist: (match?.[2] || '').trim() };
};

export interface SnippetForm {
    name: string;
    cat: string;
    dest: string;
    move: string;
    items: string;
    stay: string;
    tags: string;
    breakfast: string;
    lunch: string;
    dinner: string;
}

export const formFromSnippet = (name: string, snippet: Snippet | undefined, defaultCat = ''): SnippetForm => {
    const meals = strings(snippet?.meals);
    return {
        name,
        cat: snippet ? catOf(snippet) : defaultCat,
        dest: stripBr(snippet?.dest),
        move: snippet ? moveText(snippet) : '',
        items: strings(snippet?.items).join('\n'),
        stay: stripBr(snippet?.stay?.name),
        tags: strings(snippet?.stay?.tags).join(', '),
        breakfast: meals[0] || '',
        lunch: meals[1] || '',
        dinner: meals[2] || '',
    };
};

/** 화면에서 보이는 값이 같으면 저장된 원래 값(줄바꿈 `<br>` 포함)을 그대로 둔다. */
const keepIfSame = (original: unknown, edited: string) => (original != null && stripBr(original).trim() === edited ? String(original) : edited);

/**
 * 입력 칸 → 저장할 일정. 원래 일정이 있으면 이 화면이 다루지 않는 칸(사진·설명 등)과
 * 숙소의 다른 칸, 네 번째 이후 식사 칸은 보존한다(옛 도구는 이 칸들을 지웠다).
 */
export const snippetFromForm = (form: SnippetForm, original?: Snippet): Snippet => {
    const { move, dist } = splitMove(form.move);
    const dest = form.dest.trim();
    const stayName = form.stay.trim();
    const meals = [form.breakfast, form.lunch, form.dinner].map((meal) => meal.trim());
    const extraMeals = strings(original?.meals).slice(3);
    return {
        ...(original || {}),
        cat: form.cat.trim(),
        dest: keepIfSame(original?.dest, dest),
        move,
        dist,
        items: form.items.split('\n').map((line) => line.trim()).filter(Boolean),
        stay: { ...(original?.stay || {}), name: keepIfSame(original?.stay?.name, stayName), tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) },
        meals: [...meals, ...extraMeals],
    };
};

/** 이름을 바꿔도 목록 순서는 그 자리 그대로. */
export const putSnippet = (library: SnippetLibrary, previousName: string | null, name: string, snippet: Snippet): SnippetLibrary => {
    if (!previousName || previousName === name) return { ...library, [name]: snippet };
    const out: SnippetLibrary = {};
    Object.entries(library).forEach(([key, value]) => {
        if (key === name) return;
        if (key === previousName) out[name] = snippet; else out[key] = value;
    });
    return out;
};

export const removeSnippet = (library: SnippetLibrary, name: string): SnippetLibrary => {
    const out = { ...library };
    delete out[name];
    return out;
};

export type CategoryNameProblem = 'empty' | 'reserved' | 'duplicate' | null;
export const categoryNameProblem = (name: string, cats: string[], current?: string): CategoryNameProblem => {
    const value = name.trim();
    if (!value) return 'empty';
    if (value === UNCAT || value === ALL || value === NONE) return 'reserved';
    if (value !== current && cats.includes(value)) return 'duplicate';
    return null;
};

/** 지역 이름 바꾸기: 목록 자리 그대로, 그 지역의 일정도 함께 옮긴다. */
export const renameCategory = (library: SnippetLibrary, cats: string[], from: string, to: string) => ({
    cats: cats.map((cat) => (cat === from ? to : cat)),
    library: Object.fromEntries(Object.entries(library).map(([name, snippet]) => [name, catOf(snippet) === from ? { ...snippet, cat: to } : snippet])) as SnippetLibrary,
});

/** 지역 삭제: 그 지역의 일정은 지우지 않고 미분류로 옮긴다. */
export const deleteCategory = (library: SnippetLibrary, cats: string[], cat: string) => ({
    cats: cats.filter((item) => item !== cat),
    library: Object.fromEntries(Object.entries(library).map(([name, snippet]) => [name, catOf(snippet) === cat ? { ...snippet, cat: '' } : snippet])) as SnippetLibrary,
});

/** 서버 자료 형식 확인(예약 일정표 편집기와 같은 기준). 없으면 빈 값. */
export const readLibrary = (data: unknown): SnippetLibrary => {
    if (data == null) return {};
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('일정 자료 형식을 확인할 수 없습니다.');
    return data as SnippetLibrary;
};
export const readCats = (data: unknown): string[] => {
    if (data == null) return [];
    if (!Array.isArray(data) || data.some((item) => typeof item !== 'string')) throw new Error('일정 지역 목록을 확인할 수 없습니다.');
    return data as string[];
};
