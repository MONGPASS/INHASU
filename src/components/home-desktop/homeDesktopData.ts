import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import type { HomeData } from '../../hooks/useHomeData';
import type { Category } from '../../types/category';

export type HomeProduct = HomeData['products'][number];

export interface HomeReview {
    id: string;
    author: string;
    rating: number;
    content: string;
    productName: string;
    productId: string;
}

export interface ReviewStat {
    avg: number;
    count: number;
}

interface RawReview {
    id?: string | number;
    user_name?: string;
    rating?: number;
    content?: string;
    product_id?: string;
    product_name?: string;
}

/** Approved reviews + per-product rating aggregates, shared by the home sections. */
export function useHomeReviews() {
    const { data } = useQuery({
        queryKey: ['homeReviewsDesktop', 'all'],
        staleTime: 1000 * 60 * 10,
        queryFn: async () => {
            const raw = await api.reviews.list();
            const list: HomeReview[] = (Array.isArray(raw) ? (raw as RawReview[]) : []).map((r) => ({
                id: String(r.id ?? ''),
                author: (r.user_name || '').trim(),
                rating: Math.max(0, Math.min(5, Math.round(r.rating || 5))),
                content: (r.content || '').replace(/\s+/g, ' ').trim(),
                productName: (r.product_name || '몽골 투어').trim(),
                productId: r.product_id || '',
            }));
            const stats: Record<string, ReviewStat> = {};
            for (const r of list) {
                if (!r.productId) continue;
                const s = (stats[r.productId] ||= { avg: 0, count: 0 });
                s.avg = (s.avg * s.count + r.rating) / (s.count + 1);
                s.count += 1;
            }
            return { list, stats };
        },
    });
    return { reviews: data?.list ?? [], stats: data?.stats ?? {} };
}

/**
 * Whole-percent discount when the admin set an original price above the sale price.
 * Token reductions (under 5%) are not advertised as a sale.
 */
export const discountPct = (p: HomeProduct) => {
    if (!p.originalPrice || p.originalPrice <= p.price) return 0;
    const pct = Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100);
    return pct >= 5 ? pct : 0;
};

/** /api/products also returns unpublished tours; PC listings show published ones only. */
export const isPublished = (p: HomeProduct) => !p.status || p.status === 'active';

/** Products store the category *name*; categories are addressed by slug id. */
export const inCategory = (p: HomeProduct, c: Pick<Category, 'id' | 'name'>) => p.category === c.name || p.category === c.id;

export const categoryImage = (c?: Category) => c?.landing_hero_images?.[1] || c?.landing_hero_images?.[0] || c?.landing_hero_image || '';
