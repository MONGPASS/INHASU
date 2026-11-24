import type { RepresentativeSpotSnapshot } from '../../types/product';
import type { Course } from './courseImport';

export type QuoteSpotLibrary = Record<string, Omit<RepresentativeSpotSnapshot, 'name'>>;
interface QuotePresets { courses: Record<string, Course>; spots: QuoteSpotLibrary; snippets: Record<string, unknown> }
let presets: Promise<QuotePresets> | undefined;

// presets.js also defines globals for the quote editor. Read its fallback data in isolation.
function loadPresets(): Promise<QuotePresets> {
    presets ??= new Promise<QuotePresets>((resolve, reject) => {
        const frame = document.createElement('IFRAME') as HTMLIFrameElement;
        frame.hidden = true;
        frame.setAttribute('aria-hidden', 'true');
        document.body.appendChild(frame);
        const fail = () => { frame.remove(); reject(new Error('기본 코스·명소를 불러오지 못했습니다.')); };
        const doc = frame.contentDocument;
        if (!doc) return fail();
        const script = doc.createElement('script');
        script.src = '/presets.js';
        script.onload = () => {
            const data = (frame.contentWindow as (Window & { PRESETS?: QuotePresets }) | null)?.PRESETS;
            if (!data?.courses || !data.spots) return fail();
            resolve(structuredClone({ courses: data.courses, spots: data.spots, snippets: data.snippets || {} }));
            frame.remove();
        };
        script.onerror = fail;
        doc.head.appendChild(script);
    }).catch(error => { presets = undefined; throw error; });
    return presets;
}

let quoteBase: Promise<Record<string, any>> | undefined;
/**
 * 견적 문서의 기본값(public/data.js의 QUOTE — 회사 정보·표지 사진·기본 요금 등). 옛 견적서 만들기가 BASE로 쓰던 값이다.
 * data.js는 전역 값을 만들므로 숨긴 창 안에서 읽는다.
 */
export function loadQuoteBase(): Promise<Record<string, any>> {
    quoteBase ??= new Promise<Record<string, any>>((resolve, reject) => {
        const frame = document.createElement('IFRAME') as HTMLIFrameElement;
        frame.hidden = true;
        frame.setAttribute('aria-hidden', 'true');
        document.body.appendChild(frame);
        const fail = () => { frame.remove(); reject(new Error('견적서 기본 정보(data.js)를 불러오지 못했습니다.')); };
        const doc = frame.contentDocument;
        if (!doc) return fail();
        const script = doc.createElement('script');
        script.src = '/data.js';
        script.onload = () => {
            const data = (frame.contentWindow as (Window & { QUOTE?: Record<string, any> }) | null)?.QUOTE;
            if (!data || typeof data !== 'object') return fail();
            resolve(structuredClone(data));
            frame.remove();
        };
        script.onerror = fail;
        doc.head.appendChild(script);
    }).catch(error => { quoteBase = undefined; throw error; });
    return quoteBase;
}

function localMap(key: string) {
    try {
        const data = JSON.parse(localStorage.getItem('leaders_' + key) ?? 'null');
        return data && typeof data === 'object' && !Array.isArray(data) ? data : null;
    } catch { return null; }
}

async function readQuoteData(key: string, signal: AbortSignal) {
    const response = await fetch('/api/data/' + key, { cache: 'no-store', signal });
    const payload = await response.json();
    if (!response.ok || payload?.ok !== true) throw new Error('견적 자료를 불러오지 못했습니다. 다시 시도해 주세요.');
    return payload.data;
}

export async function loadCourses(signal: AbortSignal): Promise<Record<string, Course>> {
    const isCourseMap = (value: unknown): value is Record<string, Course> =>
        !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0;
    try {
        const courses = await readQuoteData('courses', signal);
        if (isCourseMap(courses)) return courses;
    } catch { /* 코스 관리와 같은 순서로 브라우저 저장분과 기본 코스를 확인한다. */ }
    const cached = localMap('courses');
    if (isCourseMap(cached)) return cached;
    try { return (await loadPresets()).courses; } catch { return {}; }
}

export async function loadQuoteSpots(signal: AbortSignal): Promise<QuoteSpotLibrary> {
    const data = await readQuoteData('spots', signal);
    if (data == null) return localMap('spots') ?? (await loadPresets()).spots;
    if (typeof data !== 'object' || Array.isArray(data)) throw new Error('명소 자료 형식을 확인할 수 없습니다.');
    return data;
}

/**
 * 기본 일정 조각(presets.js의 PRESETS.snippets). 서버·이 브라우저에 저장된 일정이 없을 때 옛 일정 관리·견적서 만들기가 보여 주던 값.
 * 이 브라우저 저장분(localStorage `leaders_snippets`)이 있으면 그것을 먼저 쓴다.
 */
export async function loadFallbackSnippets(): Promise<Record<string, unknown>> {
    return localMap('snippets') ?? (await loadPresets()).snippets;
}

/** 기본 코스(presets.js의 PRESETS.courses). 서버에 저장된 코스가 없을 때 옛 코스 관리가 보여 주던 값(이 브라우저 저장분 우선). */
export async function loadFallbackCourses(): Promise<Record<string, unknown>> {
    return localMap('courses') ?? (await loadPresets()).courses;
}

/** 기본 여행지(presets.js의 PRESETS.spots). 서버에 저장된 여행지가 없을 때 옛 여행지 관리가 보여 주던 값(이 브라우저 저장분 우선). */
export async function loadFallbackSpots(): Promise<QuoteSpotLibrary> {
    return localMap('spots') ?? (await loadPresets()).spots;
}

export async function loadQuoteSpotCategories(signal: AbortSignal): Promise<string[]> {
    const data = (await readQuoteData('spot_cats', signal)) ?? [];
    if (!Array.isArray(data) || data.some(item => typeof item !== 'string')) throw new Error('명소 카테고리 형식을 확인할 수 없습니다.');
    return data;
}
