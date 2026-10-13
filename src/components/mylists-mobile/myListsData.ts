import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useHomeData } from '../../hooks/useHomeData';
import { useWishlist } from '../../hooks/useWishlist';
import { useHomeReviews, type HomeProduct } from '../home-desktop/homeDesktopData';
import { cleanTitle } from '../desktop-primitives/mwTokens';
import type { TripCardData } from '../mypage-desktop/MyPageSections';
import { parseDbTime, type MyReservation, type RecentItem } from '../mypage-desktop/useMyPageData';

/**
 * Data helpers for the mobile my-page list screens (최근 본 상품 / 찜 목록 / 동행 찾기 글 /
 * 내 후기). Same sources and rules as the PC My Page (MyPageDesktop / MyPageSections).
 */

const WISH_KEY = ['wishlistIds'];
const WEEK = '일월화수목금토';

export const dateRange = (start: string, end: string) => [start, end].filter(Boolean).join(' ~ ');

/** Route change that also resets the scroll position (screens share one scroll container). */
export function useGo() {
    const navigate = useNavigate();
    return useCallback((path: string) => {
        navigate(path);
        window.scrollTo(0, 0);
    }, [navigate]);
}

/** Published tour data the cards are resolved against, per-tour ratings and the wishlist. */
export function useTripCatalog() {
    const queryClient = useQueryClient();
    const wishlist = useWishlist();
    const { data: home, isLoading: productsLoading } = useHomeData();
    const { stats } = useHomeReviews();
    const productById = useMemo(() => new Map(home.products.map((p) => [p.id, p])), [home.products]);
    const wishItems = useMemo(
        () => wishlist.ids.map((id) => productById.get(id)).filter((p): p is HomeProduct => !!p),
        [wishlist.ids, productById],
    );
    // useWishlist does not expose its load state; subscribing here keeps the first load from
    // flashing the empty card.
    useIsFetching({ queryKey: WISH_KEY });
    const wishLoading = queryClient.getQueryState(WISH_KEY)?.status === 'pending' || (wishlist.ids.length > 0 && productsLoading);

    return { productById, stats, wishlist, wishItems, wishLoading };
}

export const productCard = (p: HomeProduct): TripCardData => ({
    key: p.id,
    productId: p.id,
    title: cleanTitle(p.name),
    image: p.mainImages[0],
    duration: p.duration,
    category: p.category,
    price: p.price,
});

/** Wishlist payload for a card whose product is no longer in the published list. */
export const cardAsWishProduct = (t: TripCardData) => ({
    id: t.productId,
    name: t.title,
    price: t.price,
    category: t.category || '',
    mainImages: t.image ? [t.image] : [],
});

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

/** Viewing history (newest first) split into 오늘 / 어제 / M월 D일(요일) groups. */
export function groupRecentByDay(items: RecentItem[], now: number, productById: Map<string, HomeProduct>) {
    const today = dayKey(new Date(now));
    const yesterday = dayKey(new Date(now - 86_400_000));
    const label = (d: Date) =>
        dayKey(d) === today ? '오늘' : dayKey(d) === yesterday ? '어제' : `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEK[d.getDay()]})`;

    const groups: Array<{ label: string; cards: TripCardData[] }> = [];
    for (const it of items) {
        const d = parseDbTime(it.viewedAt);
        const g = Number.isNaN(d.getTime()) ? '이전' : label(d);
        const p = productById.get(it.productId);
        const card: TripCardData = p
            ? productCard(p)
            : { key: it.productId, productId: it.productId, title: cleanTitle(it.title), image: it.image, category: it.category, price: it.price };
        const last = groups[groups.length - 1];
        if (last && last.label === g) last.cards.push(card);
        else groups.push({ label: g, cards: [card] });
    }
    return groups;
}

/** Tours that ended without a review yet (same eligibility rule as the review API). */
export const pendingReviewList = (reservations: MyReservation[], today: string) =>
    reservations.filter((r) => ['confirmed', 'paid', 'completed'].includes(r.status) && (r.status === 'completed' || (!!r.end && r.end < today)) && !r.reviewed);
