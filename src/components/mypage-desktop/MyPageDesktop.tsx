import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { clearCustomerSessionCache } from '../../lib/customerSessionCache';
import { useUser } from '../../contexts/UserContext';
import { useHomeData } from '../../hooks/useHomeData';
import { useWishlist } from '../../hooks/useWishlist';
import { useNotification } from '../../contexts/NotificationContext';
import { toTourDateKey } from '../../utils/formatDate';
import { useHomeReviews, type HomeProduct } from '../home-desktop/homeDesktopData';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';
import { BookingListPanel, MyMenuNav, MyProfileBand, OverviewPanel } from './MyPageHome.desktop';
import { QuoteDetailPanel, QuoteListPanel } from './MyQuotes.desktop';
import { MY_MENU_GROUPS, bookingStage, boxButton } from './myBookingView';
import { useMe, useMyPageData, useRecentActions } from './useMyPageData';
import {
    MatesSection, NoticeSection, RecentSection, ReviewsSection, WishlistSection,
    type TripCardData,
} from './MyPageSections';

export type MyTab = 'overview' | 'reservations' | 'estimates' | 'travel-mates' | 'wishlist' | 'recently-viewed' | 'my-reviews' | 'notifications';

const LABEL: Record<string, string> = Object.fromEntries(MY_MENU_GROUPS.flatMap((g) => g.items.map((m) => [m.key, m.label])));

/**
 * PC 마이페이지(Claude Design ‘마이페이지 — 개요’·‘예약 내역’): 흰 프로필 띠 → 회색 바탕에 왼쪽 메뉴(나의 여행·커뮤니티·계정) + 내용.
 * 메뉴마다 자기 주소가 있어 상단 링크·바로가기가 그대로 동작한다. 개요·예약 내역은 새 디자인, 나머지 메뉴는 기존 내용을 흰 판에 담는다.
 */
export function MyPageDesktop({ tab = 'overview' }: { tab?: MyTab }) {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const { setUser } = useUser();
    const meQuery = useMe();
    const me = meQuery.data;
    const { reservations, quotes, mates, reviews, recent } = useMyPageData(me);
    const recentActions = useRecentActions(me?.id);
    const { unreadCount } = useNotification();
    const wishlist = useWishlist();
    const { data: home } = useHomeData();
    const { stats } = useHomeReviews();
    // Captured once so render stays pure.
    const [now] = useState(() => Date.now());
    const today = useMemo(() => toTourDateKey(new Date(now)), [now]);

    const productById = useMemo(() => new Map(home.products.map((p) => [p.id, p])), [home.products]);
    const wishItems = useMemo(
        () => wishlist.ids.map((id) => productById.get(id)).filter((p): p is HomeProduct => !!p),
        [wishlist.ids, productById],
    );
    const resList = useMemo(() => reservations.data ?? [], [reservations.data]);
    const quoteList = useMemo(() => quotes.data ?? [], [quotes.data]);
    // Tours that ended without a review yet (same eligibility rule as the review API).
    const pendingReviews = useMemo(
        () => resList.filter((r) => r.source === 'reservation' && ['confirmed', 'paid', 'completed'].includes(r.status) && (r.status === 'completed' || (!!r.end && r.end < today)) && !r.reviewed),
        [resList, today],
    );

    const go = (path: string) => {
        if (/\.html(?:[?#]|$)/i.test(path)) { window.location.assign(path); return; }
        navigate(path);
        window.scrollTo(0, 0);
    };

    const handleLogout = async () => {
        try {
            await api.auth.logout();
        } catch {
            // ignore
        }
        await clearCustomerSessionCache(queryClient);
        setUser(null);
        navigate('/login');
    };

    const removeWish = (p: HomeProduct) => wishlist.toggle(p);
    const clearWish = async () => {
        if (!window.confirm('찜 목록을 모두 삭제하시겠습니까?')) return;
        for (const p of wishItems) await wishlist.toggle(p);
    };
    const toggleRecentFav = (t: TripCardData) =>
        wishlist.toggle(productById.get(t.productId) ?? { id: t.productId, name: t.title, price: t.price, category: t.category || '', mainImages: t.image ? [t.image] : [] });

    // A cached "logged out" answer is re-checked before showing the login prompt.
    if (meQuery.isPending || (!me && meQuery.isFetching)) {
        return <div style={{ padding: 80, textAlign: 'center', color: SD.gray600, fontSize: 14, background: SD.gray50 }}>불러오는 중…</div>;
    }
    if (!me) return <LoginGate onLogin={() => navigate('/login')} />;

    const bookingsLoading = reservations.isPending;
    const openId = searchParams.get('id');
    const openQuote = openId ? quoteList.find((x) => x.id === openId) : undefined;
    const myStats = {
        bookings: resList.length,
        active: resList.filter((r) => bookingStage(r, today).tab !== 'done').length,
        quotes: quoteList.length,
        wish: wishItems.length,
    };
    const old = (node: ReactNode) => (
        <div style={{ background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>{node}</div>
    );

    return (
        <div style={{ background: SD.gray50, color: SD.gray900 }}>
            <MyProfileBand me={me} stats={myStats} crumb={tab === 'overview' ? undefined : LABEL[tab]} onLogout={handleLogout} go={go} />
            <div style={{ ...SD_CONTAINER, paddingTop: 32, paddingBottom: 64, display: 'flex', gap: 32, alignItems: 'flex-start' }}>
                <MyMenuNav current={tab} counts={{ reservations: resList.length, notifications: unreadCount }} go={go} />
                <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {tab === 'overview' && (
                        <OverviewPanel bookings={resList} quotes={quoteList} productById={productById} today={today} loading={bookingsLoading || quotes.isPending} go={go} />
                    )}
                    {tab === 'reservations' && <BookingListPanel bookings={resList} productById={productById} today={today} loading={bookingsLoading} go={go} />}
                    {tab === 'estimates' && (openQuote
                        ? <QuoteDetailPanel q={openQuote} onBack={() => go('/mypage/estimates')} />
                        : <QuoteListPanel quotes={quoteList} loading={quotes.isPending} go={go}
                            onOpen={(q) => (q.source === 'request' ? go(`/mypage/estimates?id=${encodeURIComponent(q.id)}`) : go(q.href))} />)}
                    {tab === 'travel-mates' && old(<MatesSection me={me} posts={mates.data ?? []} loading={mates.isPending} go={go} />)}
                    {tab === 'wishlist' && old(<WishlistSection items={wishItems} stats={stats} onRemove={removeWish} onClearAll={clearWish} go={go} />)}
                    {tab === 'recently-viewed' && old(
                        <RecentSection
                            items={recent.data ?? []}
                            now={now}
                            productById={productById}
                            stats={stats}
                            isFav={wishlist.has}
                            onFav={toggleRecentFav}
                            onRemove={recentActions.remove}
                            onClearAll={recentActions.clear}
                            loading={recent.isPending}
                            go={go}
                        />,
                    )}
                    {tab === 'my-reviews' && old(
                        <ReviewsSection me={me} reviews={reviews.data ?? []} pending={pendingReviews} productById={productById} loading={reviews.isPending || reservations.isPending} go={go} />,
                    )}
                    {tab === 'notifications' && old(<NoticeSection go={go} />)}
                </div>
            </div>
        </div>
    );
}

function LoginGate({ onLogin }: { onLogin: () => void }) {
    return (
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: SD.gray50 }}>
            <div style={{ textAlign: 'center', padding: '60px 40px', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 72, height: 72, borderRadius: 9999, background: SD.white, border: `1px solid ${SD.gray200}`, color: SD.gray700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <SIcon name="user" size={32} stroke={1.6} />
                </span>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>로그인이 필요해요</h1>
                <p style={{ margin: 0, fontSize: 14, color: SD.gray600, lineHeight: 1.7 }}>마이페이지를 이용하시려면 로그인해 주세요.</p>
                <button type="button" onClick={onLogin} style={{ ...boxButton('primary', 'large'), marginTop: 10, padding: '0 32px' }}>로그인</button>
            </div>
        </div>
    );
}
