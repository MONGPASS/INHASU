import type { HomeProduct, ReviewStat } from '../home-desktop/homeDesktopData';

/** 휴대폰 투어 목록의 검색·정렬과 상품 기간 표기(여러 화면이 함께 쓴다). */

export type Sort = 'rec' | 'low' | 'high' | 'rating' | 'reviews';
export const SORT_OPTIONS: [Sort, string][] = [
    ['rec', '추천순'],
    ['low', '낮은 가격순'],
    ['high', '높은 가격순'],
    ['rating', '평점 높은 순'],
    ['reviews', '후기 많은 순'],
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
