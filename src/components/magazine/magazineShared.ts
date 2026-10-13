import { BRAND } from '../../constants/company';

/** Constants and pure helpers shared by the PC and mobile 여행 가이드(매거진) screens. */

export const ALL = '전체';
export const KEYWORDS = ['울란바토르', '별밤', '초원', '게르'];

// 인기 키워드로 검색할 때, DB에 남아 있는 일본어 기사도 함께 찾도록 하는 별칭.
const KEYWORD_ALIASES: Record<string, string[]> = {
    울란바토르: ['ウランバートル'],
    별밤: ['星空', '밤하늘'],
    초원: ['草原'],
    게르: ['ゲル'],
};

/** Search terms for a query: the query itself plus its known aliases (all lowercase). */
export const queryNeedles = (query: string): string[] => {
    const q = query.trim().toLowerCase();
    return q ? [q, ...(KEYWORD_ALIASES[q] ?? [])] : [];
};

// 매거진 카테고리는 DB 값이다. 기존 일본어 값과 새 한국어 값을 같은 카테고리로 묶고, 화면에는 한국어로 표시한다.
const CATEGORY_LABELS: Record<string, string> = {
    観光: '관광',
    準備: '준비',
    情報: '정보',
    グルメ: '미식',
    文化: '문화',
};

/** Display label of a stored magazine category (Japanese legacy values → Korean). */
export const categoryLabel = (category?: string | null): string => {
    const c = (category ?? '').trim();
    return CATEGORY_LABELS[c] ?? c;
};

/** Category tabs: stored names mapped to their labels, without duplicates. */
export const categoryTabs = (categories: string[]): string[] => [...new Set(categories.map(categoryLabel).filter(Boolean))];

export const SITE = BRAND.siteUrl;
export const EDITORIAL = `${BRAND.name} 편집부`;

export const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
};
