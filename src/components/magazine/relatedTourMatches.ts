import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { withPublicProductPrice, type PublicProductPriceFields } from '../../utils/publicProductPrice';

export interface RelatedTourQuery {
    category?: string;
    tag?: string;
    title?: string;
    description?: string;
    limit?: number;
}

export interface RelatedTour extends PublicProductPriceFields {
    id: string;
    name: string;
    price: number;
    originalPrice?: number;
    category: string;
    duration: string;
    mainImages: string[];
}

interface RawProduct {
    id: string;
    name?: string;
    description?: string;
    category?: string;
    duration?: string;
    price?: number;
    originalPrice?: number;
    original_price?: number;
    status?: string;
    tags?: unknown;
    pricingOptions?: unknown;
    pricing_options?: unknown;
    mainImages?: unknown;
    main_images?: unknown;
    is_popular?: number | boolean;
    is_featured?: number | boolean;
    isPopular?: number | boolean;
    isFeatured?: number | boolean;
    sort_order?: number;
    sortOrder?: number;
    created_at?: string;
    createdAt?: string;
}

const truthy = (v: unknown) => v === 1 || v === true;

const fallbackRank = (p: RawProduct): number => {
    const popular = truthy(p.is_popular) || truthy(p.isPopular) ? 1000 : 0;
    const featured = truthy(p.is_featured) || truthy(p.isFeatured) ? 500 : 0;
    const sort = -1 * (p.sort_order ?? p.sortOrder ?? 0);
    return popular + featured + sort;
};

const norm = (v: unknown) => String(v ?? '').toLowerCase().trim();

const toArray = (v: unknown): unknown[] => {
    if (Array.isArray(v)) return v;
    if (typeof v !== 'string') return [];
    try {
        const parsed = JSON.parse(v);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return v.split(',');
    }
};

const toStringArray = (v: unknown): string[] =>
    toArray(v).map(norm).filter(Boolean);

const toImageArray = (v: unknown): string[] =>
    toArray(v).filter((x): x is string => typeof x === 'string' && x.length > 0);

const keywordAliases: Record<string, string[]> = {
    // 일본어 키워드는 기존 DB 데이터(기사·상품)용으로 남기고, 같은 묶음에 한국어 키워드를 함께 둔다.
    ゴビ: ['ゴビ', '砂漠', '南部', '고비', '고비사막', '사막', '남부'],
    乗馬: ['乗馬', '馬', '草原', '승마', '말타기', '초원'],
    ゲル: ['ゲル', 'キャンプ', '遊牧民', '게르', '캠프', '유목민'],
    星空: ['星空', '天の川', '夜空', '별밤', '은하수', '밤하늘'],
    ナーダム: ['ナーダム', '祭り', '競馬', '나담', '축제', '경마'],
    テレルジ: ['テレルジ', '国立公園', '亀石', '테를지', '국립공원', '거북바위'],
    ウランバートル: ['ウランバートル', '市内', '首都', '울란바토르', '시내', '수도'],
    フブスグル: ['フブスグル', '湖', '北部', '홉스굴', '홉스골', '호수', '북부'],
};

const buildKeywords = (...values: Array<string | undefined>): string[] => {
    const source = values.map(norm).filter(Boolean).join(' ');
    const tokens = source
        .split(/[\s、。・·｜|/【】()[\]（）「」『』,:：!?！？]+/)
        .filter((token) => token.length >= 2);

    Object.entries(keywordAliases).forEach(([key, aliases]) => {
        if (aliases.some((alias) => source.includes(norm(alias)))) {
            tokens.push(key, ...aliases);
        }
    });

    return [...new Set(tokens.map(norm).filter(Boolean))];
};

const scoreProduct = (p: RawProduct, keywords: string[], magCategory: string): number => {
    const pCategory = norm(p.category);
    const pName = norm(p.name);
    const pDescription = norm(p.description);
    const pTags = toStringArray(p.tags);
    const searchable = [pCategory, pName, pDescription, ...pTags].join(' ');

    let score = 0;

    if (magCategory && pCategory && magCategory === pCategory) score += 100;

    for (const kw of keywords) {
        if (!searchable.includes(kw)) continue;
        if (pName.includes(kw)) score += 35;
        if (pCategory.includes(kw)) score += 25;
        if (pDescription.includes(kw)) score += 12;
        if (pTags.some((tagValue) => tagValue.includes(kw))) score += 20;
    }

    return score;
};

/**
 * Tours that best match a magazine article (category, title keywords, tags),
 * topped up with popular/featured tours when there are too few matches.
 */
export function useRelatedTourMatches({ category, tag, title, description, limit = 3 }: RelatedTourQuery): RelatedTour[] {
    const { data: products = [] } = useQuery<RawProduct[]>({
        queryKey: ['products', 'related-tours'],
        queryFn: async () => {
            const data = await api.products.list();
            return Array.isArray(data) ? (data as RawProduct[]) : [];
        },
        staleTime: 1000 * 60 * 30,
    });

    const matches = useMemo(() => {
        const magCategory = norm(category);
        const keywords = buildKeywords(title, category, tag, description);

        const eligible = products.filter((p) => {
            const imgs = toImageArray(p.mainImages ?? p.main_images);
            return p.status === 'active' && imgs.length > 0;
        });

        const scored = eligible
            .map((p) => ({ product: p, score: scoreProduct(p, keywords, magCategory) }))
            .filter((r) => r.score > 0)
            .sort((a, b) => b.score - a.score);

        const picked = scored.slice(0, limit).map((r) => r.product);

        if (picked.length >= limit) return picked;

        const pickedIds = new Set(picked.map((p) => p.id));
        const fallback = eligible
            .filter((p) => !pickedIds.has(p.id))
            .sort((a, b) => fallbackRank(b) - fallbackRank(a))
            .slice(0, limit - picked.length);

        return [...picked, ...fallback];
    }, [products, category, tag, title, description, limit]);

    return matches.map((p) => ({
        ...withPublicProductPrice(p),
        id: p.id,
        name: p.name ?? '',
        originalPrice: undefined,
        category: p.category ?? '',
        duration: p.duration ?? '',
        mainImages: toImageArray(p.mainImages ?? p.main_images),
    }));
}
