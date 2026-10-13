import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useHomeData } from '../../hooks/useHomeData';
import { useWishlist } from '../../hooks/useWishlist';
import { useNotification } from '../../contexts/NotificationContext';
import { toTourDateKey } from '../../utils/formatDate';
import { useHomeReviews, type HomeProduct } from '../home-desktop/homeDesktopData';
import { MW, MW_FONT_EN, MW_STICKY_TOP } from '../desktop-primitives/mwTokens';
import { Ico } from './myPageUi';
import { HAIR, ICON, PAPER, hover, mintBtn, mintHover } from './myPageTheme';
import { useMe, useMyPageData, useRecentActions, type MeUser } from './useMyPageData';
import {
    EstimatesSection, MatesSection, NoticeSection, OverviewSection, RecentSection, ReservationsSection, ReviewsSection, SupportCard, WishlistSection,
    type TripCardData,
} from './MyPageSections';

export type MyTab = 'overview' | 'reservations' | 'estimates' | 'travel-mates' | 'wishlist' | 'recently-viewed' | 'my-reviews' | 'notifications';

/** Left menu; each tab is its own route so header links and deep links keep working. */
const MENU: Array<{ tab: MyTab; label: string; d: string; path: string }> = [
    { tab: 'overview', label: '개요', d: ICON.overview, path: '/mypage' },
    { tab: 'reservations', label: '예약 내역', d: ICON.bookings, path: '/mypage/reservations' },
    { tab: 'estimates', label: '견적 내역', d: ICON.quotes, path: '/mypage/estimates' },
    { tab: 'travel-mates', label: '동행 찾기 글', d: ICON.mates, path: '/mypage/travel-mates' },
    { tab: 'wishlist', label: '찜 목록', d: ICON.wish, path: '/mypage/wishlist' },
    { tab: 'recently-viewed', label: '최근 본 상품', d: ICON.recent, path: '/mypage/recently-viewed' },
    { tab: 'my-reviews', label: '내 후기', d: ICON.reviews, path: '/mypage/reviews' },
    { tab: 'notifications', label: '알림', d: ICON.notice, path: '/mypage/notifications' },
];

export function MyPageDesktop({ tab = 'overview' }: { tab?: MyTab }) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
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
    const quoteList = quotes.data ?? [];
    // Tours that ended without a review yet (same eligibility rule as the review API).
    const pendingReviews = useMemo(
        () => resList.filter((r) => ['confirmed', 'paid', 'completed'].includes(r.status) && (r.status === 'completed' || (!!r.end && r.end < today)) && !r.reviewed),
        [resList, today],
    );

    const go = (path: string) => {
        navigate(path);
        window.scrollTo(0, 0);
    };

    const handleLogout = async () => {
        try {
            await api.auth.logout();
        } catch {
            // ignore
        }
        queryClient.removeQueries({ queryKey: ['authMe'] });
        queryClient.removeQueries({ queryKey: ['myPage'] });
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
        return <div style={{ padding: 80, textAlign: 'center', color: MW.mute, fontSize: 14 }}>불러오는 중…</div>;
    }
    if (!me) return <LoginGate onLogin={() => navigate('/login')} />;

    const counts: Partial<Record<MyTab, number>> = {
        reservations: reservations.data?.length,
        estimates: quotes.data?.length,
        wishlist: wishItems.length,
        notifications: unreadCount,
    };
    const current = MENU.find((m) => m.tab === tab) ?? MENU[0];

    return (
        <section style={{ background: '#fff' }}>
            <div style={{ background: `linear-gradient(180deg,${PAPER} 0%,#FFFFFF 100%)`, borderBottom: `1px solid ${MW.line}` }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 40px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 13, color: MW.mute }}>
                        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ color: MW.mute, textDecoration: 'none' }}>홈</a>
                        <span>›</span>
                        {tab === 'overview' ? (
                            <span style={{ color: MW.navy, fontWeight: 700 }}>마이페이지</span>
                        ) : (
                            <>
                                <a href="/mypage" onClick={(e) => { e.preventDefault(); go('/mypage'); }} style={{ color: MW.mute, textDecoration: 'none' }}>마이페이지</a>
                                <span>›</span>
                                <span style={{ color: MW.navy, fontWeight: 700 }}>{current.label}</span>
                            </>
                        )}
                    </nav>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep, marginTop: 10 }}>MY PAGE</span>
                    <h1 style={{ margin: 0, fontSize: 'clamp(32px,4.2vw,48px)', fontWeight: 900, lineHeight: 1.2 }}>마이페이지</h1>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: MW.mute }}>예약 현황, 견적, 찜 목록 등을 한곳에서 관리할 수 있습니다.</p>
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 104px', display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <aside style={{ flex: '0 1 280px', minWidth: 240, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: MW_STICKY_TOP + 24 }}>
                    <ProfileCard me={me} onLogout={handleLogout} />
                    <nav aria-label="마이페이지 메뉴" style={{ border: `1px solid ${MW.line}`, borderRadius: 20, overflow: 'hidden', background: '#fff', display: 'flex', flexDirection: 'column' }}>
                        {MENU.map((m, i) => {
                            const on = m.tab === current.tab;
                            const count = counts[m.tab] ?? 0;
                            const bg = on ? MW.mintBg : '#FFFFFF';
                            return (
                                <button
                                    key={m.tab}
                                    type="button"
                                    onClick={() => go(m.path)}
                                    aria-current={on ? 'page' : undefined}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 14, height: 52, padding: '0 20px', border: 0, borderTop: `1px solid ${i ? HAIR : 'transparent'}`,
                                        background: bg, fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 500, color: on ? MW.mintDeep : MW.navy, cursor: 'pointer', textAlign: 'left',
                                    }}
                                    {...hover({ background: MW.mintBg }, { background: bg })}
                                >
                                    <Ico d={m.d} color={on ? MW.mintDeep : MW.mute} width={1.7} />
                                    <span style={{ flex: 1 }}>{m.label}</span>
                                    {count > 0 && (
                                        <span style={{ minWidth: 22, height: 22, padding: '0 7px', boxSizing: 'border-box', borderRadius: 999, background: MW.mintTint, color: MW.mintDeep, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {count}
                                        </span>
                                    )}
                                    <span style={{ color: MW.mute2, fontSize: 16 }}>›</span>
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                <div style={{ flex: '1 1 600px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {tab === 'overview' && (
                        <OverviewSection
                            reservations={resList}
                            quotes={quoteList}
                            wishCount={wishItems.length}
                            today={today}
                            productById={productById}
                            loading={reservations.isPending || quotes.isPending}
                            go={go}
                        />
                    )}
                    {tab === 'reservations' && <ReservationsSection reservations={resList} today={today} loading={reservations.isPending} go={go} />}
                    {tab === 'estimates' && <EstimatesSection quotes={quoteList} loading={quotes.isPending} go={go} />}
                    {tab === 'travel-mates' && <MatesSection me={me} posts={mates.data ?? []} loading={mates.isPending} go={go} />}
                    {tab === 'wishlist' && <WishlistSection items={wishItems} stats={stats} onRemove={removeWish} onClearAll={clearWish} go={go} />}
                    {tab === 'recently-viewed' && (
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
                        />
                    )}
                    {tab === 'my-reviews' && (
                        <ReviewsSection me={me} reviews={reviews.data ?? []} pending={pendingReviews} productById={productById} loading={reviews.isPending || reservations.isPending} go={go} />
                    )}
                    {tab === 'notifications' && <NoticeSection go={go} />}
                    <SupportCard go={go} />
                </div>
            </div>
        </section>
    );
}

function ProfileCard({ me, onLogout }: { me: MeUser; onLogout: () => void }) {
    const photo = me.image || me.avatarUrl;
    const name = me.name || me.email || '게스트';
    return (
        <div style={{ border: `1px solid ${MW.line}`, borderRadius: 20, padding: '24px 22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#fff' }}>
            <div style={{ position: 'relative', width: 96, height: 96, marginBottom: 12 }}>
                <div role="img" aria-label={`${name} 님의 아바타`} style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', background: MW.mintTint, boxShadow: '0 10px 24px rgba(39,171,143,0.22)' }}>
                    {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <DefaultAvatar />}
                </div>
                <span title="로그인 중" style={{ position: 'absolute', right: 4, bottom: 4, width: 18, height: 18, borderRadius: '50%', background: MW.mint, border: '3px solid #FFFFFF', boxSizing: 'border-box' }} />
            </div>
            <span style={{ fontSize: 17, fontWeight: 900, textAlign: 'center', wordBreak: 'break-all' }}>{name} 님</span>
            {me.email && <span style={{ fontSize: 13, color: MW.mute, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me.email}</span>}
            <button
                type="button"
                onClick={onLogout}
                style={{ marginTop: 14, width: '100%', height: 44, border: `1px solid ${MW.line}`, borderRadius: 12, background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                {...hover({ borderColor: MW.mint, color: MW.mintDeep }, { borderColor: MW.line, color: MW.navy })}
            >
                로그아웃
            </button>
        </div>
    );
}

/** Illustrated traveller from the design, used when the account has no photo. */
function DefaultAvatar() {
    return (
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
            <circle cx="48" cy="48" r="48" fill="#D1F6EA" />
            <circle cx="78" cy="22" r="10" fill="#FFFFFF" opacity="0.7" />
            <path d="M14 96c2-18 16-28 34-28s32 10 34 28z" fill="#1C8571" />
            <path d="M48 68l-16 4c4 4 10 7 16 8z" fill="#27AB8F" />
            <path d="M48 68c6 0 12 1 17 4L44 96h-7z" fill="#27AB8F" />
            <path d="M65 72L44 96" stroke="#F2B544" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <path d="M36 68c3 3 7 4 12 4s9-1 12-4" stroke="#F2B544" strokeWidth="3.5" fill="none" strokeLinecap="round" />
            <circle cx="55" cy="84" r="2" fill="#F2B544" />
            <rect x="42" y="58" width="12" height="12" rx="4" fill="#E9B98F" />
            <ellipse cx="48" cy="48" rx="17" ry="16" fill="#F4C9A0" />
            <ellipse cx="31" cy="50" rx="3" ry="4" fill="#E9B98F" />
            <ellipse cx="65" cy="50" rx="3" ry="4" fill="#E9B98F" />
            <circle cx="41" cy="49" r="2" fill="#0A1F2E" />
            <circle cx="55" cy="49" r="2" fill="#0A1F2E" />
            <ellipse cx="37" cy="55" rx="3.5" ry="2.2" fill="#F08A7A" opacity="0.55" />
            <ellipse cx="59" cy="55" rx="3.5" ry="2.2" fill="#F08A7A" opacity="0.55" />
            <path d="M44 56c2 2 6 2 8 0" stroke="#0A1F2E" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M48 12c-12 0-20 10-21 24h42c-1-14-9-24-21-24z" fill="#C8453A" />
            <path d="M40 16l8-6 8 6" stroke="#F2B544" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M48 10v26" stroke="#F2B544" strokeWidth="1.6" opacity="0.8" />
            <circle cx="48" cy="9" r="4" fill="#F2B544" />
            <path d="M24 38c0-5 6-7 12-6 4 .6 8 .6 12 .6s8 0 12-.6c6-1 12 1 12 6 0 3-3 4-6 3-5-1-12-1.5-18-1.5S35 40 30 41c-3 1-6 0-6-3z" fill="#6B4A36" />
            <path d="M26 37c6-2 14-2.5 22-2.5s16 .5 22 2.5" stroke="#8C6649" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
    );
}

function LoginGate({ onLogin }: { onLogin: () => void }) {
    return (
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(180deg,${PAPER} 0%,#FFFFFF 100%)` }}>
            <div style={{ textAlign: 'center', padding: '60px 40px', maxWidth: 440, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 72, height: 72, borderRadius: '50%', background: MW.mintTint, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                    <Ico d={ICON.user} size={34} />
                </span>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>MY PAGE</span>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>로그인이 필요합니다</h1>
                <p style={{ margin: 0, fontSize: 14, color: MW.mute, lineHeight: 1.8 }}>마이페이지를 이용하시려면 로그인해 주세요.</p>
                <button type="button" onClick={onLogin} style={{ ...mintBtn, marginTop: 10, height: 48, padding: '0 32px', fontSize: 14 }} {...mintHover}>
                    로그인
                </button>
            </div>
        </div>
    );
}
