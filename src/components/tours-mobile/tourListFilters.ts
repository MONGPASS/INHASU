import type { HomeProduct, ReviewStat } from '../home-desktop/homeDesktopData';

/**
 * Filter / sort logic of the mobile tour list (Claude Design: "Milkyway Japan Mobile" — M Tours).
 * Same data decisions as the PC list (TourListDesktop); the 필터 sheet adds 일정 / 요금 / 혜택.
 */

export type Sort = 'rec' | 'low' | 'high' | 'rating' | 'reviews';
export type TripTypeKey = 'full' | 'value';
export type PriceKey = 'p1' | 'p2' | 'p3';
export type PerkKey = 'best' | 'pick';

export interface TourFilters {
    days: string[];
    prices: PriceKey[];
    perks: PerkKey[];
}

export const EMPTY_FILTERS: TourFilters = { days: [], prices: [], perks: [] };

/** Trip-type cards, driven by each tour's 여행 타입 set in the admin (packageType). */
export const TRIP_TYPES: { key: TripTypeKey; label: string; desc: string; en: string }[] = [
    { key: 'full', label: '풀패키지 여행', desc: '4성급 호텔 + 디럭스 게르 숙박', en: '풀패키지' },
    { key: 'value', label: '실속형 여행', desc: '3성급 호텔 + 스탠다드 게르 숙박', en: '실속형' },
];

export const SORT_OPTIONS: [Sort, string][] = [
    ['rec', '추천순'],
    ['low', '낮은 가격순'],
    ['high', '높은 가격순'],
    ['rating', '평점순'],
    ['reviews', '후기 많은 순'],
];

/** 1인 요금(원화) 구간. 예전 통화 기준 구간(10만 / 15만)을 ×10 한 임시값 — 실제 상품 가격대에 맞춰 조정할 것. */
export const PRICE_BANDS: { key: PriceKey; label: string; hint: string; test: (price: number) => boolean }[] = [
    { key: 'p1', label: '100만 원 미만', hint: '부담 없는 3~4박 플랜', test: (n) => n < 1000000 },
    { key: 'p2', label: '100만~150만 원', hint: '온천·사막을 만끽하는 인기 코스', test: (n) => n >= 1000000 && n < 1500000 },
    { key: 'p3', label: '150만 원 이상', hint: '고비사막·장기 일주', test: (n) => n >= 1500000 },
];

export interface Perk {
    key: PerkKey;
    tag: string;
    label: string;
    hint: string;
    chip: string;
    tagBg: string;
    tagBd: string;
    tagFg: string;
    test: (p: HomeProduct) => boolean;
}

/**
 * 혜택 toggles backed by the admin's 인기 / 추천 flags. The design's 최저가 보장 has no
 * product field behind it, so it is not offered.
 */
export const PERKS: Perk[] = [
    { key: 'best', tag: 'BEST', label: '인기 No.1급', hint: '예약 수·만족도가 특히 높은 투어', chip: 'BEST', tagBg: '#D93A2B', tagBd: '#D93A2B', tagFg: '#FFFFFF', test: (p) => p.isPopular },
    { key: 'pick', tag: '추천', label: '스태프 추천', hint: '현지 스태프가 자신 있게 추천', chip: '스태프 추천', tagBg: '#FFFFFF', tagBd: '#F3C7C2', tagFg: '#B3261E', test: (p) => p.isFeatured },
];

/**
 * 상품 기간은 DB 값이다. 기존 일본어 표기(`3泊4日`, `5日間`, `日帰り`)와 한국어 표기(`3박4일`, `3박 4일`)를
 * 같은 값으로 인식하도록 한국어 표기 하나(`3박 4일`)로 통일한다. 필터 옵션·비교·화면 표시에 모두 이 값을 쓴다.
 */
export function durationLabel(raw?: string | null): string {
    return (raw || '')
        .trim()
        .replace(/日帰り/g, '당일')
        .replace(/(\d+)\s*(?:泊|박)\s*/g, '$1박 ')
        .replace(/(\d+)\s*(?:日間|日|일)/g, '$1일')
        .trim();
}

export const durationOf = (p: HomeProduct) => durationLabel(p.duration);

/** Distinct durations that exist in the list, shortest trip first. */
export function durationOptions(products: HomeProduct[]): string[] {
    const nums = (d: string) => (d.match(/\d+/g) || []).map(Number);
    return [...new Set(products.map(durationOf).filter(Boolean))].sort((a, b) => {
        const [an = 0, ad = 0] = nums(a);
        const [bn = 0, bd = 0] = nums(b);
        return an - bn || ad - bd || a.localeCompare(b, 'ko');
    });
}

/** "3박 4일" (또는 기존 "3泊4日") → ["3박", "4일"]; anything else stays on one line. */
export function splitDuration(d: string): [string, string] {
    const m = durationLabel(d).match(/^(\d+)\s*박\s*(.+)$/);
    return m ? [`${m[1]}박`, m[2]] : [d, ''];
}

export function matchFilters(p: HomeProduct, f: TourFilters): boolean {
    if (f.days.length && !f.days.includes(durationOf(p))) return false;
    if (f.prices.length && !PRICE_BANDS.some((b) => f.prices.includes(b.key) && b.test(p.price))) return false;
    return PERKS.every((k) => !f.perks.includes(k.key) || k.test(p));
}

/** Tours left if `value` were the pick in its group (혜택 toggles add up instead). */
export function countWith<K extends keyof TourFilters>(base: HomeProduct[], f: TourFilters, group: K, value: TourFilters[K][number]): number {
    const next = { ...f, [group]: group === 'perks' ? [...new Set([...f.perks, value])] : [value] } as TourFilters;
    return base.filter((p) => matchFilters(p, next)).length;
}

export function toggleFilter<K extends keyof TourFilters>(f: TourFilters, group: K, value: TourFilters[K][number]): TourFilters {
    const cur = f[group] as string[];
    return { ...f, [group]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] } as TourFilters;
}

export const activeCount = (f: TourFilters) => f.days.length + f.prices.length + f.perks.length;

/** Text match on the header search word (?q=), same haystack as the PC list. */
export function matchQuery(p: HomeProduct, query: string): boolean {
    // \s also covers the full-width space Japanese keyboards insert.
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;
    // 기간은 DB 원본 표기와 한국어 표기("3박 4일", "3박4일")를 모두 검색 대상에 넣는다.
    const days = durationLabel(p.duration);
    const hay = `${p.name} ${p.tags.join(' ')} ${p.category} ${p.duration} ${days} ${days.replace(/\s+/g, '')}`.toLowerCase();
    return words.every((w) => hay.includes(w));
}

export function sortTours(list: HomeProduct[], sort: Sort, stats: Record<string, ReviewStat>): HomeProduct[] {
    const rank = (p: HomeProduct) => Number(p.isPopular) * 2 + Number(p.isFeatured);
    const sorters: Record<Sort, (a: HomeProduct, b: HomeProduct) => number> = {
        rec: (a, b) => rank(b) - rank(a),
        low: (a, b) => a.price - b.price,
        high: (a, b) => b.price - a.price,
        rating: (a, b) => (stats[b.id]?.avg ?? 0) - (stats[a.id]?.avg ?? 0) || (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0),
        reviews: (a, b) => (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0),
    };
    return [...list].sort(sorters[sort]);
}
