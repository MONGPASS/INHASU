import type { HighlightCardData, HighlightSectionData } from '../../types/category';
import { MW } from '../desktop-primitives/mwTokens';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { withPublicProductPrice } from '../../utils/publicProductPrice';

/**
 * Content model of the category landing page (/category/:slug) and the helpers
 * shared by its PC and mobile screens. Everything here is admin-managed data.
 */
export type HighlightCard = HighlightCardData;
export type HighlightSection = HighlightSectionData;

export interface CategoryLandingContent {
    /** Category display name (breadcrumb). */
    name: string;
    /** First hero image (kept for backward compatibility). */
    heroImage: string;
    /** Slider images; falls back to [heroImage] when empty. */
    heroImages?: string[];
    heroTagline?: string;
    heroTitle: string;
    heroSubtitle?: string;
    /** Admin accent colour (hex) for the highlight section labels. */
    accentColor?: string;
    highlights: HighlightSection[];
    productGridTitle?: string;
}

export interface CategoryLandingProps {
    /** Category id (= URL slug). */
    slug: string;
    content: CategoryLandingContent;
    products: HomeProduct[];
    isLoadingProducts?: boolean;
}

/** Anchor id of the tour lineup section ("투어 상품 보기" scrolls here). */
export const CATEGORY_LINEUP_ID = 'category-products';

export const scrollToLineup = () => {
    document.getElementById(CATEGORY_LINEUP_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const heroSlides = (c: CategoryLandingContent): string[] => {
    const list = (c.heroImages || []).filter(Boolean);
    return list.length > 0 ? list : [c.heroImage].filter(Boolean);
};

/** Highlight sections that have something to show, with empty cards dropped. */
export const visibleHighlights = (c: CategoryLandingContent): HighlightSection[] =>
    (Array.isArray(c.highlights) ? c.highlights : [])
        .filter(Boolean)
        .map((s) => ({ ...s, cards: (Array.isArray(s.cards) ? s.cards : []).filter((card) => card && (card.image || card.title)) }))
        .filter((s) => s.title || s.cards.length > 0);

// The admin colour picker's default from the previous (teal) design.
const LEGACY_ACCENT = '#0f766e';

/** Admin accent colour when one was chosen on purpose; the redesign's mint otherwise. */
export const accentOf = (c: CategoryLandingContent): string => {
    const a = (c.accentColor || '').trim();
    return /^#[0-9a-f]{3,8}$/i.test(a) && a.toLowerCase() !== LEGACY_ACCENT ? a : MW.mintDeep;
};

/** Highlight card links are admin-entered: site paths or full URLs. */
export const resolveCardLink = (link?: string): { href: string; external: boolean } | null => {
    const raw = (link || '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) {
        try {
            const url = new URL(raw);
            // 현재 도메인과 옛 도메인(mongolryokou.com)으로 저장된 링크는 사이트 내부 경로로 처리한다.
            if (/(^|\.)(mongolia-milkyway|mongolryokou)\.com$/i.test(url.hostname)) return { href: url.pathname + url.search + url.hash, external: false };
        } catch {
            return null;
        }
        return { href: raw, external: true };
    }
    return { href: raw.startsWith('/') ? raw : `/${raw}`, external: false };
};

/** Row of /api/products (snake_case and camelCase are both served). */
export interface RawProduct {
    id: string;
    name: string;
    category?: string;
    price: number;
    originalPrice?: number | null;
    original_price?: number | null;
    isPopular?: unknown;
    is_popular?: unknown;
    isFeatured?: unknown;
    is_featured?: unknown;
    status?: string;
    packageType?: string | null;
    mainImages?: unknown;
    main_images?: unknown;
    duration?: string;
    tags?: unknown;
    pricingOptions?: unknown;
    pricing_options?: unknown;
    startingPrice?: number | null;
    priceBasisPeople?: number | null;
    priceReady?: boolean;
}

const strings = (val: unknown): string[] => {
    if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (typeof val !== 'string' || !val) return [];
    try {
        const parsed: unknown = JSON.parse(val);
        return Array.isArray(parsed) ? strings(parsed) : [];
    } catch {
        return val.startsWith('/') || val.startsWith('http') ? [val] : [];
    }
};

/** Same shape as the home / tour list products, so the shared tour cards can render it. */
export const toTourProduct = (p: RawProduct): HomeProduct => ({
    ...withPublicProductPrice(p),
    id: p.id,
    name: p.name,
    category: p.category || '',
    originalPrice: undefined,
    isPopular: !!(p.isPopular ?? p.is_popular),
    isFeatured: !!(p.isFeatured ?? p.is_featured),
    status: p.status,
    packageType: p.packageType === 'full' || p.packageType === 'value' ? p.packageType : null,
    mainImages: strings(p.mainImages || p.main_images),
    duration: p.duration || '',
    tags: strings(p.tags),
});
