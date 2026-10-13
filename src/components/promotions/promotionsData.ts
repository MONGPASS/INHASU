import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useHomeData } from '../../hooks/useHomeData';
import { won } from '../desktop-primitives/mwTokens';
import { categoryImage, inCategory, isPublished, type HomeProduct } from '../home-desktop/homeDesktopData';
import { PROMO_THEME_KEYS, type Promotion, type PromoThemeKey } from './promotionTypes';

export interface PromoTheme {
    bg: string;
    fg: string;
    subFg: string;
    artFg: string;
    artShadow: string;
    badgeBg: string;
    badgeFg: string;
    glow: string;
    edge: string;
}

/** The design's eight card themes, in the order of `PROMO_THEME_KEYS` (mint, navy, jade, deep, light, paper, night, soft). */
export const PROMO_THEMES: PromoTheme[] = [
    ['linear-gradient(160deg,#6DDBBE 0%,#A3ECD6 100%)', '#0A1F2E', '#23323D', '#FFFFFF', '#1C8571', '#0A1F2E', '#FFFFFF', 'rgba(255,255,255,0.35)', 'transparent'],
    ['linear-gradient(160deg,#0A1F2E 0%,#16344A 100%)', '#FFFFFF', '#C4D0D8', '#6DDBBE', '#1C8571', '#0A1F2E', '#6DDBBE', 'rgba(109,219,190,0.18)', 'transparent'],
    ['linear-gradient(160deg,#27AB8F 0%,#1C8571 100%)', '#FFFFFF', '#D1F6EA', '#FFFFFF', '#0A1F2E', '#0A1F2E', '#FFFFFF', 'rgba(255,255,255,0.18)', 'transparent'],
    ['linear-gradient(160deg,#1C8571 0%,#0A1F2E 100%)', '#FFFFFF', '#D1F6EA', '#A3ECD6', '#0A1F2E', '#0A1F2E', '#A3ECD6', 'rgba(163,236,214,0.16)', 'transparent'],
    ['linear-gradient(160deg,#D1F6EA 0%,#F1FCF8 100%)', '#0A1F2E', '#33434F', '#27AB8F', '#0A1F2E', '#FFFFFF', '#0A1F2E', 'rgba(109,219,190,0.35)', '#D1F6EA'],
    ['linear-gradient(160deg,#FFFFFF 0%,#F1FCF8 100%)', '#0A1F2E', '#5C6B75', '#0A1F2E', '#A3ECD6', '#27AB8F', '#0A1F2E', 'rgba(163,236,214,0.45)', '#E3E6E2'],
    ['radial-gradient(120% 80% at 50% 0%,#16344A 0%,#0A1F2E 70%)', '#FFFFFF', '#C4D0D8', '#FFFFFF', '#27AB8F', '#27AB8F', '#0A1F2E', 'rgba(39,171,143,0.22)', 'transparent'],
    ['linear-gradient(160deg,#A3ECD6 0%,#F1FCF8 100%)', '#0A1F2E', '#33434F', '#1C8571', '#FFFFFF', '#0A1F2E', '#FFFFFF', 'rgba(255,255,255,0.45)', 'transparent'],
].map(([bg, fg, subFg, artFg, artShadow, badgeBg, badgeFg, glow, edge]) => ({ bg, fg, subFg, artFg, artShadow, badgeBg, badgeFg, glow, edge }));

/** Theme key stored on a promotion → its card colours. Unknown keys fall back to mint. */
export const themeOf = (key?: string | null): PromoTheme => PROMO_THEMES[PROMO_THEME_KEYS.indexOf(key as PromoThemeKey)] ?? PROMO_THEMES[0];

export interface PromoItem {
    key: string;
    group: string;
    title: string;
    sub: string;
    /** Large display lettering in the middle of the card; empty for none. */
    art: string;
    badge: string;
    tags: string[];
    image: string;
    path: string;
    theme: PromoTheme;
}

export const PROMO_ALL = '전체';
const GROUP_FEATURE = '특집';
/** 그룹명이 비어 있거나, 예전에 일본어 기본값('特集')으로 저장된 경우 모두 기본 그룹으로 묶는다. */
const groupOf = (name?: string | null) => {
    const g = (name || '').trim();
    return !g || g === '特集' ? GROUP_FEATURE : g;
};
/** Short, like the home data: a card saved in the admin shows up on the next visit to the page. */
const STALE = 1000 * 30;

// ── API ────────────────────────────────────────────────────────────────────────────────────

const LIST_KEY = ['promotions', 'list'] as const;

/** Active promotions in the admin's order; `[]` while none is registered (or the table is not migrated yet). */
const fetchPromotions = async (): Promise<Promotion[]> => {
    const rows = await api.promotions.list();
    return Array.isArray(rows) ? rows : [];
};

/** One promotion; `null` when the API answers 404 (missing or no longer published). */
const fetchPromotion = async (id: string): Promise<Promotion | null> => {
    try {
        return await api.promotions.get(id);
    } catch (e) {
        if (e instanceof Error && /^(not found|http 404)$/i.test(e.message)) return null;
        throw e;
    }
};

// ── Cards ──────────────────────────────────────────────────────────────────────────────────

/** "gobi-desert" → "GOBI\nDESERT". Only latin slugs make display lettering. */
const artFrom = (source: string) => {
    const words = source.trim().split(/[\s_-]+/).filter(Boolean);
    if (words.length === 0 || !words.every((w) => /^[a-z]{2,}$/i.test(w))) return '';
    return words.slice(0, 2).join('\n').toUpperCase();
};

const oneLine = (v?: string) => (v || '').replace(/\s+/g, ' ').trim();

/** A promotion as a card. `tourCount` = how many of its tours are currently published (0 hides the tag). */
export const promoItemOf = (p: Promotion, tourCount = 0): PromoItem => ({
    key: `promotion-${p.id}`,
    group: groupOf(p.group_name),
    title: p.title,
    sub: oneLine(p.subtitle),
    art: p.art_text,
    badge: p.badge,
    tags: tourCount > 0 ? [`투어 ${tourCount}건`] : [],
    image: p.image,
    path: `/promotions/${encodeURIComponent(p.id)}`,
    theme: themeOf(p.theme),
});

/** The promotion's tours in the admin's order; unpublished or deleted tours are skipped. */
const toursOf = (p: Promotion, published: HomeProduct[]) => {
    const byId = new Map(published.map((x) => [x.id, x]));
    return [...new Set(p.product_ids ?? [])].map((id) => byId.get(id)).filter((x): x is HomeProduct => !!x);
};

/**
 * Cards for /promotions: the promotions registered in the admin. While none is registered the
 * page shows one 특집 card per active tour category instead, so it is never empty.
 */
export function usePromotions() {
    const { data, isLoading: homeLoading } = useHomeData();
    const { data: rows, isLoading: rowsLoading } = useQuery({
        queryKey: LIST_KEY,
        staleTime: STALE,
        retry: 1,
        queryFn: fetchPromotions,
    });

    const { items, groups } = useMemo(() => {
        const products = data.products.filter(isPublished);
        const promos = rows ?? [];

        const list: PromoItem[] = promos.length > 0
            ? promos.map((p) => promoItemOf(p, toursOf(p, products).length))
            : data.categories.map((c, i) => {
                const tours = products.filter((p) => inCategory(p, c));
                return {
                    key: `category-${c.id}`,
                    group: GROUP_FEATURE,
                    title: c.name,
                    sub: oneLine(c.description),
                    art: artFrom(c.id),
                    badge: tours.length > 0 ? `${won(Math.min(...tours.map((p) => p.price)))}~` : '',
                    tags: tours.length > 0 ? [`투어 ${tours.length}건`] : [],
                    image: categoryImage(c),
                    path: `/category/${c.id}`,
                    theme: PROMO_THEMES[i % PROMO_THEMES.length],
                };
            });

        return { items: list, groups: [...new Set(list.map((x) => x.group))] };
    }, [data.products, data.categories, rows]);

    return { items, groups, isLoading: homeLoading || rowsLoading };
}

export interface PromotionDetailView {
    promotion: Promotion | null;
    /** The promotion as a card item (hero colours and copy); null until it is loaded. */
    item: PromoItem | null;
    /** Published tours of the promotion, in the admin's order. */
    tours: HomeProduct[];
    isLoading: boolean;
    toursLoading: boolean;
    notFound: boolean;
}

/** One promotion and its tours for /promotions/:id. Opens instantly when the list already loaded it. */
export function usePromotionDetail(id: string): PromotionDetailView {
    const queryClient = useQueryClient();
    const { data, isLoading: toursLoading } = useHomeData();
    const { data: row, isLoading } = useQuery({
        queryKey: ['promotions', 'detail', id],
        enabled: !!id,
        staleTime: STALE,
        retry: 1,
        queryFn: () => fetchPromotion(id),
        initialData: () => queryClient.getQueryData<Promotion[]>(LIST_KEY)?.find((p) => p.id === id),
        initialDataUpdatedAt: () => queryClient.getQueryState(LIST_KEY)?.dataUpdatedAt,
    });

    const promotion = row ?? null;
    const tours = useMemo(() => (promotion ? toursOf(promotion, data.products.filter(isPublished)) : []), [promotion, data.products]);
    const item = useMemo(() => (promotion ? promoItemOf(promotion, tours.length) : null), [promotion, tours.length]);

    return { promotion, item, tours, isLoading, toursLoading, notFound: !isLoading && !promotion };
}

/** Tab state: 전체 + one tab per group. A single group needs no tabs. */
export function usePromoFilter(items: PromoItem[], groups: string[]) {
    const [picked, setPicked] = useState(PROMO_ALL);
    const tabs = groups.length > 1 ? [PROMO_ALL, ...groups] : [];
    const current = tabs.includes(picked) ? picked : PROMO_ALL;
    const list = current === PROMO_ALL ? items : items.filter((x) => x.group === current);
    return { tabs, current, setCurrent: setPicked, list };
}

/** Shrink the display lettering when a word is too long for the card ("MONGOLIA"). */
export const artScale = (art: string) => {
    const longest = Math.max(...art.split('\n').map((w) => w.length));
    return longest > 7 ? 7 / longest : 1;
};
