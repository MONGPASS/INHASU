import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { DayInfoContent, DesignBlockContent, ProductFAQ, TimelineContent, TourPricingOption, TourProduct } from '../../../types/product';
import { isPublished, type HomeProduct } from '../../home-desktop/homeDesktopData';
import { durationLabel } from '../../tours-mobile/tourListFilters';
import { mapReview, parseJsonArray, useDesktopReviews, type DesktopReview, type RawReview } from '../../reviews-desktop/reviewsData';
import { getDesignTemplate } from '../designTemplates/registry';
import { suffixOf, visibleInstances } from '../designTemplates/sections';
import { useDesignGlobalDefaults } from '../designTemplates/globalDefaults';

/**
 * Data helpers shared by the redesigned tour detail (PC + mobile).
 * Everything here reads the real product / review rows; nothing is sample data.
 */

/** Result of the page's share handler: drives the 공유 → 복사 완료 label. */
export type ShareResult = 'copied' | 'shared' | null;

export interface TourDetailViewProps {
    product: TourProduct;
    /** Approved reviews of this tour, newest first (raw API rows). */
    reviews: RawReview[];
    onBook: () => void;
    onShare: () => Promise<ShareResult>;
    previewNotice?: () => void;
}

// ───────────────────────── sections / tabs ─────────────────────────

export type DetailSectionId = 'td-about' | 'td-detail' | 'td-plan' | 'td-incl' | 'td-rev' | 'td-faq';

export interface DetailTab {
    id: DetailSectionId;
    label: string;
}

export interface ItineraryBlock {
    id?: string;
    type: string;
    content: unknown;
}

export interface ItineraryDay {
    key: string;
    info: DayInfoContent;
    events: ItineraryBlock[];
}

/** A day / timeline card only counts once the admin typed something into it. */
export function isMeaningfulItineraryBlock(b: ItineraryBlock): boolean {
    if (b.type === 'image' || b.type === 'slide' || b.type === 'divider') return true;
    if (b.type === 'dayInfo') {
        const c = (b.content ?? {}) as Partial<DayInfoContent>;
        return Boolean(c.title?.trim() || c.description?.trim() || c.accommodation?.trim() || c.meals?.breakfast || c.meals?.lunch || c.meals?.dinner);
    }
    if (b.type === 'timeline') {
        const c = (b.content ?? {}) as Partial<TimelineContent>;
        return Boolean(c.title?.trim() || c.description?.trim() || c.time?.trim() || (Array.isArray(c.images) && c.images.length > 0));
    }
    return false;
}

/**
 * Itinerary blocks grouped per day. Blocks created before the first day card belong to day 1
 * (admins usually add the day skeleton last); without any day card the blocks stay flat.
 */
export function groupItinerary(product: TourProduct): { days: ItineraryDay[]; flat: ItineraryBlock[]; legacyImages: string[] } {
    const blocks = ((product.itineraryBlocks ?? []) as ItineraryBlock[]).filter(isMeaningfulItineraryBlock);
    const days: ItineraryDay[] = [];
    const pre: ItineraryBlock[] = [];
    let current: ItineraryDay | null = null;
    blocks.forEach((b, i) => {
        if (b.type === 'dayInfo') {
            if (current) days.push(current);
            current = { key: b.id || `day-${i}`, info: (b.content ?? {}) as DayInfoContent, events: [] };
        } else if (current) {
            current.events.push(b);
        } else {
            pre.push(b);
        }
    });
    if (current) days.push(current);
    if (days.length > 0 && pre.length > 0) {
        days[0] = { ...days[0], events: [...pre, ...days[0].events] };
        return { days, flat: [], legacyImages: [] };
    }
    return { days, flat: pre, legacyImages: blocks.length === 0 ? (product.itineraryImages ?? []).filter(Boolean) : [] };
}

/** True when a design-template block actually has the slot the itinerary is inserted into. */
export function designShowsItinerary(content: DesignBlockContent | undefined): boolean {
    const def = getDesignTemplate(content?.templateId ?? '');
    if (!def?.itineraryAfter) return false;
    return visibleInstances(def, content?.sections).some((s) => s.def === def.itineraryAfter);
}

/**
 * 디자인 틀 섹션을 상품 상세의 어느 칸에 보여 줄지. 템플릿의 pageParts에 적힌 섹션만 아래 칸으로 가고
 * 나머지는 ‘투어 소개’(접힌 상세 정보). 상세 화면은 칸마다 DetailBlocks의 part로 그 섹션만 그린다.
 */
export type DesignPart = 'intro' | 'included' | 'notice' | 'faq';

export function designPartOf(templateId: string | undefined, sectionDefId: string): DesignPart | 'hidden' {
    return getDesignTemplate(templateId ?? '')?.pageParts?.[sectionDefId] ?? 'intro';
}

/** 디자인 블록 하나에 그 칸에 보일 섹션이 있는지. */
export function designBlockHasPart(content: DesignBlockContent | undefined, part: DesignPart): boolean {
    const def = getDesignTemplate(content?.templateId ?? '');
    return !!def && visibleInstances(def, content?.sections).some((i) => designPartOf(content?.templateId, i.def) === part);
}

/** 디자인 틀(들)에 그 칸에 보일 섹션이 있는지. */
export const designHasPart = (product: TourProduct, part: DesignPart) =>
    (product.detailBlocks ?? []).some((b) => b.type === 'design' && designBlockHasPart(b.content as DesignBlockContent, part));

/**
 * 디자인 틀의 한 칸(포함 사항·유의 사항·FAQ) 값을 읽는다 — 상품 상세는 이 값을 틀 그림 대신 접기 모양으로 그린다(2026-11-27 오너 요청).
 * 값 순서는 DesignBlockView와 같다: 상품에 적은 값 → 사이트 공통값 → 원본 디자인 기본값. 편집은 지금처럼 관리자 디자인 블록에서 한다.
 * 그 칸 섹션이 없거나 뺐으면 null.
 */
export function useDesignPartValues(product: TourProduct, part: DesignPart): ((key: string) => string) | null {
    const block = (product.detailBlocks ?? []).find((b) => b.type === 'design' && designBlockHasPart(b.content as DesignBlockContent, part));
    const content = block?.content as DesignBlockContent | undefined;
    const shared = useDesignGlobalDefaults(content?.templateId);
    const def = content ? getDesignTemplate(content.templateId) : undefined;
    if (!content || !def) return null;
    const instance = visibleInstances(def, content.sections).find((i) => designPartOf(content.templateId, i.def) === part);
    if (!instance) return null;
    // 복제한 섹션이면 그 섹션의 값(@2 접미사)을 읽는다
    const suffix = suffixOf(instance.id);
    const values = content.values || {};
    const defaults: Record<string, string> = {};
    for (const field of def.fields) defaults[field.key] = field.default ?? '';
    return (key: string) => {
        const own = values[key + suffix];
        if (own !== undefined && own !== '') return own;
        const common = shared[key];
        if (common !== undefined && common !== '') return common;
        return defaults[key] ?? '';
    };
}

/** 틀의 여러 줄 칸 → 목록 줄(앞의 ‘- · • *’ 표시는 떼고, 빈 줄은 뺀다) */
export const designLines = (text: string): string[] =>
    String(text || '').split('\n').map((line) => line.trim().replace(/^[-·•*]\s*/, '').trim()).filter(Boolean);

/** 상품 수정 ‘포함/불포함’ 탭에 목록이 있는지 — 있으면 상세 포함 사항은 그 목록을 보여 준다(디자인 틀 값보다 우선) */
export const hasIncludedLists = (product: TourProduct): boolean =>
    (product.included ?? []).some(Boolean) || (product.excluded ?? []).some(Boolean);

/** 틀의 FAQ 칸(질문·답변 1~5) → 상세 FAQ 목록 */
export function designFaqItems(v: ((key: string) => string) | null): ProductFAQ[] {
    if (!v) return [];
    const items: ProductFAQ[] = [];
    for (let n = 1; n <= 5; n++) {
        const q = v(`faq${n}_q`).trim(), a = v(`faq${n}_a`).trim();
        if (q) items.push({ q, a } as ProductFAQ);
    }
    return items;
}

export interface DetailFlags {
    hasDetail: boolean;
    hasItinerary: boolean;
    /** A design-template block draws the itinerary inside itself, so the separate 일정 section is skipped. */
    itineraryInDesign: boolean;
    hasIncluded: boolean;
    /** 디자인 틀이 포함/불포함·예약 전 확인사항·FAQ 섹션을 갖고 있으면 그 칸에서 틀의 섹션을 보여 준다. */
    designIncluded: boolean;
    designNotice: boolean;
    designFaq: boolean;
}

export function detailFlags(product: TourProduct): DetailFlags {
    const blocks = product.detailBlocks ?? [];
    return {
        hasDetail: blocks.length > 0 || (product.detailSlides?.length ?? 0) > 0 || (product.detailImages?.length ?? 0) > 0,
        hasItinerary: ((product.itineraryBlocks ?? []) as ItineraryBlock[]).some(isMeaningfulItineraryBlock) || (product.itineraryImages?.length ?? 0) > 0,
        itineraryInDesign: blocks.some((b) => b.type === 'design' && designShowsItinerary(b.content as DesignBlockContent)),
        hasIncluded: (product.included?.length ?? 0) > 0 || (product.excluded?.length ?? 0) > 0 || designHasPart(product, 'included'),
        designIncluded: designHasPart(product, 'included'),
        designNotice: designHasPart(product, 'notice'),
        designFaq: designHasPart(product, 'faq'),
    };
}


/** Tabs of the sticky row — 투어 소개 · 일정 · 포함 사항 · 후기 · 유의 사항·FAQ (디자인 순서). 상세 정보는 투어 소개 안에 접혀 있어 따로 칸이 없다. */
export function detailTabs(product: TourProduct): DetailTab[] {
    const f = detailFlags(product);
    const tabs: (DetailTab | false)[] = [
        { id: 'td-about', label: '투어 소개' },
        f.hasItinerary && { id: 'td-plan', label: '일정' },
        f.hasIncluded && { id: 'td-incl', label: '포함 사항' },
        { id: 'td-rev', label: '후기' },
        { id: 'td-faq', label: '유의 사항·FAQ' },
    ];
    return tabs.filter((t): t is DetailTab => !!t);
}

export function scrollToSection(id: DetailSectionId, offset: number) {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
}

/** Active tab follows the section under the sticky bars; a tapped tab wins until its scroll settles. */
export function useSectionTabs(tabs: DetailTab[], offset: number) {
    const [active, setActive] = useState<DetailSectionId>('td-about');

    useEffect(() => {
        let locked = 0;
        const onScroll = () => {
            if (Date.now() < locked) return;
            let cur: DetailSectionId = tabs[0]?.id ?? 'td-about';
            for (const t of tabs) {
                const el = document.getElementById(t.id);
                if (el && el.getBoundingClientRect().top - offset - 12 < 0) cur = t.id;
            }
            setActive(cur);
        };
        const onPick = (e: Event) => {
            locked = Date.now() + 800;
            setActive((e as CustomEvent<DetailSectionId>).detail);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener(PICK_EVENT, onPick);
        return () => {
            window.removeEventListener('scroll', onScroll);
            window.removeEventListener(PICK_EVENT, onPick);
        };
    }, [tabs, offset]);

    const pick = (id: DetailSectionId) => {
        window.dispatchEvent(new CustomEvent<DetailSectionId>(PICK_EVENT, { detail: id }));
        scrollToSection(id, offset);
    };

    return { active, pick };
}

const PICK_EVENT = 'mw:tour-detail-tab';

// ───────────────────────── gallery / facts ─────────────────────────

/** Main + gallery photos without duplicates. */
export function tourGallery(product: TourProduct): string[] {
    const all = [...(product.mainImages ?? []), ...(product.galleryImages ?? [])].filter((x): x is string => typeof x === 'string' && x.length > 0);
    return Array.from(new Set(all));
}

export const tourImageAlt = (name: string, index: number) => `${name} ${index + 1} | 몽골 여행·몽골 투어`;

export const FACT_ICON = {
    calendar: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
    guide: 'M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c-1 4-4 7-7 8M13 20l4-9 4 9M14.5 17h5',
    people: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 010 6.5M18 14c2 .7 3 3 3 6',
    included: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 12l3 3 5-6',
} as const;

export interface TourFact {
    label: string;
    value: string;
    d: string;
}

const INCLUDED_GROUPS: [string, RegExp][] = [
    ['식사', /食事|朝食|昼食|夕食|全食|식사|조식|중식|석식|아침|점심|저녁/],
    ['숙박', /宿泊|ホテル|ゲル|숙박|숙소|호텔|게르/],
    ['픽업·샌딩', /送迎|専用車|車両|ドライバー|픽업|샌딩|송영|차량|기사/],
    ['입장료', /入場|입장/],
];

/** 포함 사항 summary taken from the tour's own "included" list (never a fixed phrase). */
function includedSummary(included: string[], joiner: string): string {
    const hits = INCLUDED_GROUPS.filter(([, re]) => included.some((x) => re.test(x))).map(([label]) => label);
    if (hits.length >= 2) return hits.slice(0, 2).join(joiner);
    return `${included.length}개 항목`;
}

/** The fact row under the gallery. Cells without real data are left out. */
export function tourFacts(product: TourProduct, minPeople: number | undefined, compact: boolean): TourFact[] {
    const facts: TourFact[] = [];
    const duration = (product.duration || '').trim();
    if (duration) facts.push({ label: '기간', value: durationLabel(duration), d: FACT_ICON.calendar });
    facts.push({ label: '가이드', value: compact ? '한국어 가이드' : '한국어 가이드 동행', d: FACT_ICON.guide });
    if (minPeople && minPeople > 0) facts.push({ label: '최소 인원', value: `${minPeople}명~`, d: FACT_ICON.people });
    const included = (product.included ?? []).filter(Boolean);
    if (included.length > 0) facts.push({ label: '포함 사항', value: includedSummary(included, compact ? '·' : ' + '), d: FACT_ICON.included });
    return facts;
}

/** Whole-percent discount (5%+) of the tour's "from" price against the admin-set original price. */
export function tourDiscountPct(product: TourProduct): number {
    if (!product.originalPrice || product.originalPrice <= product.price) return 0;
    const pct = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
    return pct >= 5 ? pct : 0;
}

// ───────────────────────── pricing ─────────────────────────

export interface TourPricing {
    options: TourPricingOption[];
    people: number;
    setPeople: (n: number) => void;
    canDec: boolean;
    canInc: boolean;
    dec: () => void;
    inc: () => void;
    /** Per-person price of the tier that applies to the chosen headcount. */
    unit: number;
    total: number;
    minPeople: number | undefined;
    /** Larger groups pay less per person (drives the "인원이 많을수록 이득" hint). */
    groupSaves: boolean;
    /** 고른 인원 단계의 1인 예약금(계좌이체)·1인 현지 잔금. 관리자가 넣지 않았으면 0. 예약 화면(Reservation)과 같은 값. */
    depositPer: number;
    localPer: number;
}

/**
 * Headcount → price, from the admin's per-headcount tiers (the same matching the booking page uses).
 * Falls back to the flat product price when no tiers are configured.
 */
export function useTourPricing(product: TourProduct): TourPricing {
    const options = useMemo(
        () => (product.pricingOptions ?? []).filter((o) => o && o.people > 0).slice().sort((a, b) => a.people - b.people),
        [product.pricingOptions],
    );
    const first = options[0];
    const last = options[options.length - 1];
    const [people, setPeople] = useState(first?.people ?? 2);

    const tier = useMemo(() => {
        if (options.length === 0) return null;
        const exact = options.find((o) => o.people === people);
        if (exact) return exact;
        if (people < options[0].people) return options[0];
        return options.filter((o) => o.people <= people).pop() ?? options[0];
    }, [options, people]);

    const unit = tier?.pricePerPerson ?? product.price ?? 0;
    const min = first?.people ?? 1;
    const max = last?.people;
    const canDec = people > min;
    const canInc = max === undefined || people < max;

    return {
        options,
        people,
        setPeople,
        canDec,
        canInc,
        dec: () => setPeople(Math.max(min, people - 1)),
        inc: () => setPeople(max === undefined ? people + 1 : Math.min(max, people + 1)),
        unit,
        total: unit * people,
        minPeople: first?.people,
        groupSaves: !!first && !!last && last.pricePerPerson < first.pricePerPerson,
        depositPer: Number(tier?.depositPerPerson) || 0,
        localPer: Number(tier?.localPaymentPerPerson) || 0,
    };
}

/** Tier button price: 1,890,000원 → 189만원, 1,895,000원 → 189.5만원 (exact when it is not a round thousand). */

// ───────────────────────── reviews ─────────────────────────

export interface ReviewSummary {
    list: DesktopReview[];
    count: number;
    /** One decimal; 0 when there are no reviews. */
    avg: number;
    /** Number of reviews per star, 5 → 1. */
    dist: { star: number; count: number }[];
}

export function summariseReviews(raw: RawReview[]): ReviewSummary {
    const list = raw.map(mapReview);
    const count = list.length;
    const sum = raw.reduce((s, r) => s + (Number(r.rating) || 0), 0);
    const buckets: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of list) buckets[r.rating] += 1;
    return {
        list,
        count,
        avg: count > 0 ? Math.round((sum / count) * 10) / 10 : 0,
        dist: [5, 4, 3, 2, 1].map((star) => ({ star, count: buckets[star] })),
    };
}

// ───────────────────────── FAQ ─────────────────────────

/** Shown only when neither the tour nor /admin/tour-faqs has any question. */
const DEFAULT_PRODUCT_FAQS: ProductFAQ[] = [
    { q: '출발 전에 무엇을 준비해야 하나요?', a: '국제선 항공권과 여권(유효기간 6개월 이상)을 준비해 주세요. 비자 필요 여부는 출발 시점의 규정에 따라 달라질 수 있어, 예약 시 안내해 드립니다. 일교차가 크므로 계절에 관계없이 겉옷은 꼭 챙겨 주세요.' },
    { q: '취소 규정을 알려 주세요.', a: '예약금은 호텔 및 숙박 시설의 선결제 금액으로 사용되므로, 일정을 취소하시는 경우 환불되지 않습니다. 취소나 일정 변경을 원하시면 서둘러 카카오톡 채널 또는 이메일로 연락해 주세요.' },
    { q: '게르 숙박 시 침구가 있나요?', a: '모든 게르 캠프에 침대·매트리스·담요·수건이 갖춰져 있습니다. 겨울철에는 전기담요도 준비해 드립니다.' },
    { q: '혼자 여행해도 참가할 수 있나요?', a: '물론 가능합니다. 1인 참가 추가 요금 180,000원을 받고 있습니다 (1인실 추가 요금). 동행 찾기 게시판도 이용해 보세요.' },
    { q: '음식 알레르기가 있어도 괜찮나요?', a: '미리 알려 주시면 음식 알레르기나 종교상의 식사 제한에 개별적으로 맞춰 드립니다. 베지테리언·비건 식단도 가능합니다.' },
    { q: '현지에서 통신은 어떻게 하나요?', a: '울란바토르 시내는 4G를 이용할 수 있습니다. 고비·테를지에는 신호가 약한 곳도 있습니다. 가이드가 위성 전화를 가지고 있어 긴급 연락은 가능합니다.' },
];

/** FAQ precedence: the tour's own questions → site-wide tour FAQ (/admin/tour-faqs) → built-in defaults. */
export function useTourFaqItems(product: TourProduct): ProductFAQ[] {
    const { data: common = [] } = useQuery({
        queryKey: ['tourFaqs'],
        staleTime: 1000 * 60 * 5,
        queryFn: async () => {
            try {
                const rows = await api.tourFaqs.list();
                return Array.isArray(rows) ? rows.map((r): ProductFAQ => ({ q: r.question, a: r.answer })) : [];
            } catch (e) {
                console.error('tour-faqs fetch failed:', e);
                return [] as ProductFAQ[];
            }
        },
    });
    const own = parseJsonArray<ProductFAQ>(product.faqs).filter((f) => f && f.q);
    if (own.length > 0) return own;
    return common.length > 0 ? common : DEFAULT_PRODUCT_FAQS;
}

// ───────────────────────── related ─────────────────────────

interface RawProduct {
    id: string;
    name?: string;
    category?: string;
    price?: number;
    originalPrice?: number;
    original_price?: number;
    isPopular?: boolean | number;
    is_popular?: boolean | number;
    isFeatured?: boolean | number;
    is_featured?: boolean | number;
    status?: string;
    packageType?: string | null;
    mainImages?: unknown;
    main_images?: unknown;
    duration?: string;
    tags?: unknown;
    bookingCount?: number;
    booking_count?: number;
}

/** Other published tours of the same category, popular / most booked first. */
function useTourCatalog() {
    const { data = [] } = useQuery({
        queryKey: ['tourDetail', 'products'],
        staleTime: 1000 * 60 * 5,
        queryFn: async () => {
            const raw = await api.products.list();
            return (Array.isArray(raw) ? (raw as RawProduct[]) : []).map((p) => ({
                booked: Number(p.bookingCount ?? p.booking_count ?? 0),
                product: {
                    id: String(p.id),
                    name: String(p.name ?? ''),
                    category: p.category ?? '',
                    price: Number(p.price ?? 0),
                    originalPrice: p.originalPrice ?? p.original_price ?? undefined,
                    isPopular: !!(p.isPopular ?? p.is_popular),
                    isFeatured: !!(p.isFeatured ?? p.is_featured),
                    status: p.status,
                    packageType: p.packageType === 'full' || p.packageType === 'value' ? p.packageType : null,
                    mainImages: parseJsonArray<string>(p.mainImages ?? p.main_images).filter((x) => typeof x === 'string' && x.length > 0),
                    duration: p.duration ?? '',
                    tags: parseJsonArray<string>(p.tags),
                } satisfies HomeProduct,
            }));
        },
    });
    return data;
}

/** 같은 분류의 다른 판매 중 투어(인기 표시 → 예약 수 순). */
export function useRelatedTours(productId: string, category: string, limit: number): HomeProduct[] {
    const data = useTourCatalog();
    return useMemo(
        () =>
            data
                .filter((x) => x.product.id !== productId && x.product.category === category && isPublished(x.product))
                .sort((a, b) => Number(b.product.isPopular) - Number(a.product.isPopular) || b.booked - a.booked)
                .slice(0, limit)
                .map((x) => x.product),
        [data, productId, category, limit],
    );
}

/**
 * 상세 화면 후기: 이 투어의 후기 먼저, 그 뒤에 ‘여행 후기’에 올라온 같은 지역(분류) 다른 투어의 후기(최신순).
 * 분류는 상품 목록에서 후기의 상품 id로 찾는다.
 */
/**
 * 지역 이름 표기 차이를 맞춘다. 옛 사이트에서 옮겨 온 후기는 상품 연결 없이 ‘중앙몽골 투어’·‘남고비 투어’·‘훕스골 투어’처럼
 * 지역 이름만 갖고 있고, 상품 분류는 ‘중앙몽골’·‘고비사막’·‘홉스굴’이다. 지역이 없는 ‘몽골 투어’는 어느 지역에도 넣지 않는다.
 */
const REGION_WORDS: Record<string, string[]> = {
    고비사막: ['고비'],
    홉스굴: ['홉스굴', '홉스골', '훕스골', '훕스굴', '흡스굴', '흡스골'],
};
const squash = (s: string) => s.normalize('NFKC').replace(/\s+/g, '');
export const tourNameInRegion = (tourName: string, category: string) => {
    const name = squash(tourName);
    const cat = squash(category);
    if (!name || !cat) return false;
    return [cat, ...(REGION_WORDS[cat] ?? [])].some((w) => name.includes(w));
};

export function useTourReviews(product: TourProduct, own: DesktopReview[]): DesktopReview[] {
    const { reviews: all } = useDesktopReviews();
    const catalog = useTourCatalog();
    return useMemo(() => {
        const categoryOf = new Map(catalog.map((x) => [x.product.id, x.product.category]));
        const seen = new Set(own.map((r) => r.id));
        // 상품에 연결된 후기는 그 상품의 분류로, 연결이 없거나 없어진 상품의 후기는 적힌 투어 이름의 지역으로 묶는다.
        const inRegion = (r: DesktopReview) => {
            const cat = r.productId ? categoryOf.get(r.productId) : undefined;
            return cat !== undefined ? cat === product.category : tourNameInRegion(r.productName, product.category);
        };
        const sameRegion = product.category
            ? all.filter((r) => !seen.has(r.id) && r.productId !== product.id && inRegion(r))
            : [];
        return [...own, ...sameRegion];
    }, [all, catalog, own, product.id, product.category]);
}

/** 다른 여행자가 많이 예약한 판매 중 투어(분류 무관, 예약 수 → 인기 표시 순). 지금 보는 투어는 뺀다. */
export function usePopularTours(productId: string, limit: number): HomeProduct[] {
    const data = useTourCatalog();
    return useMemo(
        () =>
            data
                .filter((x) => x.product.id !== productId && isPublished(x.product))
                .sort((a, b) => b.booked - a.booked || Number(b.product.isPopular) - Number(a.product.isPopular))
                .slice(0, limit)
                .map((x) => x.product),
        [data, productId, limit],
    );
}

