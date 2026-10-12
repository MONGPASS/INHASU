import { useQuery } from '@tanstack/react-query';
import { BRAND } from '../../constants/company';
import { api } from '../../lib/api';
import { shouldShowTitle } from '../review/ReviewStars';
import { isUsableImage } from '../desktop-primitives/mwTokens';
import { ANIMALS, type Animal } from './AnimalAvatar';

export interface RawReview {
    id?: string | number;
    user_id?: string;
    user_name?: string;
    rating?: number;
    title?: string;
    content?: string;
    images?: string | string[];
    product_id?: string;
    product_name?: string;
    created_at?: string;
    comments?: string | RawComment[];
    helpful_count?: number;
}

/** Comments are stored as a JSON array; mobile writes author/date, older PC code wrote user_name/created_at. */
export interface RawComment {
    id?: string | number;
    author?: string;
    user_name?: string;
    userName?: string;
    content?: string;
    date?: string;
    created_at?: string;
    createdAt?: string;
}

export interface DesktopReview {
    id: string;
    author: string;
    animal: Animal;
    rating: number;
    date: string;
    createdAt: number;
    /** Reviewer-written title; empty when it only repeats the tour name or the body. */
    title: string;
    /** Title for headings / links, falling back to the reviewer's name. */
    heading: string;
    content: string;
    productName: string;
    productId: string;
    images: string[];
    helpful: number;
}

export function parseJsonArray<T>(val: unknown): T[] {
    if (Array.isArray(val)) return val as T[];
    if (typeof val !== 'string' || !val) return [];
    try {
        const parsed = JSON.parse(val);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function formatDotDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** Normalises full-width / compatibility characters and spacing so tour names compare reliably. */
export const tourKey = (name: string) => name.normalize('NFKC').replace(/\s+/g, ' ').trim();

export function mapReview(r: RawReview, index: number): DesktopReview {
    const author = (r.user_name || '').trim() || '고객';
    const content = (r.content || '').trim();
    const productName = tourKey(r.product_name || '') || '몽골 투어';
    const rawTitle = (r.title || '').trim();
    // The write form's auto title: "<tour> レビュー" on older reviews, "<tour> 후기" (or 리뷰) on Korean ones.
    const autoTitle = ['レビュー', '후기', '리뷰'].some((suffix) => tourKey(rawTitle).replace(/\s/g, '') === `${productName}${suffix}`.replace(/\s/g, ''));
    const title = shouldShowTitle(rawTitle, content) && !autoTitle ? rawTitle : '';
    const created = new Date(r.created_at || '').getTime();
    return {
        id: String(r.id ?? ''),
        author,
        animal: ANIMALS[index % ANIMALS.length],
        rating: Math.max(1, Math.min(5, Math.round(r.rating || 5))),
        date: formatDotDate(r.created_at),
        createdAt: Number.isNaN(created) ? 0 : created,
        title,
        heading: title || `${author} 님의 후기`,
        content,
        productName,
        productId: r.product_id || '',
        images: parseJsonArray<string>(r.images).filter(isUsableImage),
        helpful: Number(r.helpful_count || 0),
    };
}

/**
 * All reviews in API order (newest first). The avatar animal follows that order,
 * matching the PC home review cards.
 */
export function useDesktopReviews() {
    const { data, isLoading } = useQuery({
        queryKey: ['userReviews', 'desktop'],
        staleTime: 1000 * 60 * 5,
        queryFn: async () => {
            const raw = await api.reviews.list();
            return (Array.isArray(raw) ? (raw as RawReview[]) : []).map(mapReview);
        },
    });
    return { reviews: data ?? [], isLoading };
}

export interface ReviewTour {
    id: string;
    name: string;
    duration: string;
    summary: string;
    image: string;
}

/** Tour shown next to a review: by product id, else by a tour name that matches exactly one published product. */
export function useReviewTour(productId: string, productName: string) {
    const { data } = useQuery({
        queryKey: ['reviewTourProducts'],
        staleTime: 1000 * 60 * 10,
        queryFn: async () => {
            const raw = await api.products.list();
            const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
            return list
                .filter((p) => !p.status || p.status === 'active')
                .map((p): ReviewTour => {
                    const images = parseJsonArray<string>(p.mainImages ?? p.main_images).filter(isUsableImage);
                    const firstLine = String(p.description || '')
                        .split('\n')
                        .map((l) => l.replace(/^[#>\-*\s]+/, '').trim())
                        .find(Boolean);
                    return {
                        id: String(p.id),
                        name: String(p.name || '').trim(),
                        duration: String(p.duration || ''),
                        summary: firstLine || '',
                        image: images[0] || '',
                    };
                });
        },
    });
    const tours = data ?? [];
    if (productId) return tours.find((t) => t.id === productId);
    const byName = tours.filter((t) => tourKey(t.name) === productName);
    return byName.length === 1 ? byName[0] : undefined;
}

export interface ReviewComment {
    id: string;
    author: string;
    content: string;
    date?: string;
}

export function normalizeComments(val: unknown): ReviewComment[] {
    return parseJsonArray<RawComment>(val)
        .filter((c) => c && (c.content || '').trim())
        .map((c, i) => ({
            id: String(c.id ?? i),
            author: (c.author || c.user_name || c.userName || '').trim() || '익명',
            content: (c.content || '').trim(),
            date: c.date || c.created_at || c.createdAt,
        }));
}

/** SEO props shared by the mobile and PC review list. */
export function reviewsSeoProps(total: number, average: string) {
    return {
        title: '고객들의 몽골 여행 후기',
        description: `몽골 투어에 참가한 고객들의 생생한 여행 후기${total > 0 ? ` (${total}건·평균 ${average}점)` : ''}. 실제 경험담을 투어 선택에 참고해 보세요.`,
        keywords: `몽골 여행 후기, 몽골 투어 후기, 몽골 여행 경험담, ${BRAND.name} 후기`,
        canonical: '/reviews',
        structuredData:
            total > 0
                ? {
                      '@context': 'https://schema.org',
                      '@type': 'TravelAgency',
                      name: BRAND.name,
                      alternateName: BRAND.nameEn,
                      url: BRAND.siteUrl,
                      aggregateRating: {
                          '@type': 'AggregateRating',
                          ratingValue: average,
                          reviewCount: total.toString(),
                          bestRating: '5',
                          worstRating: '1',
                      },
                  }
                : undefined,
    };
}
