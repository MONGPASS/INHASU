import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { clearCustomerSessionCache } from '../../lib/customerSessionCache';
import { useUser } from '../../contexts/UserContext';
import { useHomeData } from '../../hooks/useHomeData';
import { useWishlist } from '../../hooks/useWishlist';
import { toTourDateKey } from '../../utils/formatDate';
import { reservationStatusLabel } from '../../utils/reservationDetail';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { reservationTone } from '../mypage-desktop/myPageTheme';
import { useMe, useMyPageData } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { D, M_HAIR, M_PAPER } from '../mobile/mobileTheme';
import { Ico, MEmpty, MLoading, TravellerAvatar } from '../mobile/mobileUi';
import { MY_MENU, type MyCountKey, type MyMenuItem } from './myMenu';
import { ddayLabel, tripPeriod, tripPhase } from './tripFormat';

/**
 * Mobile my page (Claude Design: "M My Page"): profile + stats, the next booking and the
 * three menu cards. Same data layer as the PC my page.
 */
export function MyPageMobile() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { setUser } = useUser();
    const meQuery = useMe();
    const me = meQuery.data;
    const { reservations, quotes, mates, reviews, recent } = useMyPageData(me);
    const wishlist = useWishlist();
    const { data: home, isLoading: homeLoading } = useHomeData();
    // Captured once so render stays pure.
    const [today] = useState(() => toTourDateKey(new Date()));

    const resList = useMemo(() => reservations.data ?? [], [reservations.data]);
    // The trip in progress, otherwise the nearest departure.
    const next = useMemo(
        () => resList.filter((r) => !!r.start && tripPhase(r, today) !== 'past').sort((a, b) => a.start.localeCompare(b.start))[0],
        [resList, today],
    );
    // Same rule as the wishlist screen: only tours that still exist are counted.
    const wishCount = useMemo(() => {
        const live = new Set(home.products.map((p) => p.id));
        return wishlist.ids.filter((id) => live.has(id)).length;
    }, [home.products, wishlist.ids]);

    const go = (path: string) => {
        navigate(path);
        window.scrollTo(0, 0);
    };

    const logout = async () => {
        try {
            await api.auth.logout();
        } catch {
            // ignore
        }
        await clearCustomerSessionCache(queryClient);
        setUser(null);
        go('/');
    };

    // A cached "logged out" answer is re-checked before sending the visitor to the login screen.
    if (meQuery.isPending || (!me && meQuery.isFetching)) {
        return (
            <MobileShell title="마이페이지">
                <MLoading pad={120} />
            </MobileShell>
        );
    }
    if (!me) return <Navigate to="/login" replace state={{ from: '/mypage' }} />;

    const photo = me.avatarUrl || me.image;
    const name = me.name || me.email?.split('@')[0] || '고객';
    const wishLoading = homeLoading && wishlist.ids.length > 0;
    const stats: Array<{ label: string; value: number | undefined; path: string }> = [
        { label: '예약', value: reservations.data?.length, path: '/mypage/reservations' },
        { label: '견적', value: quotes.data?.length, path: '/mypage/estimates' },
        { label: '찜', value: wishLoading ? undefined : wishCount, path: '/mypage/wishlist' },
    ];
    const counts: Record<MyCountKey, number | undefined> = {
        mates: mates.data?.length,
        quotes: quotes.data?.length,
        wish: wishLoading ? undefined : wishCount,
        recent: recent.data?.length,
        reviews: reviews.data?.length,
    };

    return (
        <MobileShell title="마이페이지">
            <section style={{ background: M_PAPER, padding: '20px 16px 36px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>MY PAGE</span>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1.25 }}>마이페이지</h1>
                </div>

                <div style={{ borderRadius: 24, background: '#fff', border: `1px solid ${MW.line}`, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 16px' }}>
                        <div style={{ position: 'relative', flexShrink: 0, width: 64, height: 64 }}>
                            <div role="img" aria-label={`${name} 님의 아바타`} style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', background: MW.mintTint }}>
                                {photo ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : <TravellerAvatar size={64} />}
                            </div>
                            <span title="로그인 중" style={{ position: 'absolute', right: 0, bottom: 0, width: 16, height: 16, borderRadius: '50%', background: MW.mint, border: '3px solid #FFFFFF', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 17, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name} 님</span>
                            {me.email && <span style={{ fontSize: 12, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.email}</span>}
                        </div>
                        <button
                            type="button"
                            onClick={logout}
                            style={{ flexShrink: 0, height: 36, padding: '0 14px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            로그아웃
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', borderTop: `1px solid ${M_HAIR}` }}>
                        {stats.map((st, i) => (
                            <a
                                key={st.label}
                                href={st.path}
                                onClick={(e) => { e.preventDefault(); go(st.path); }}
                                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '14px 4px', borderLeft: `1px solid ${i ? M_HAIR : 'transparent'}`, color: MW.navy, textDecoration: 'none' }}
                            >
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 18, fontWeight: 600 }}>{st.value ?? '—'}</span>
                                <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap' }}>{st.label}</span>
                            </a>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px' }}>
                        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900 }}>내 예약</h2>
                        <a href="/mypage/reservations" onClick={(e) => { e.preventDefault(); go('/mypage/reservations'); }} style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep, textDecoration: 'none' }}>전체 →</a>
                    </div>
                    {reservations.isPending ? (
                        <div style={{ borderRadius: 22, background: '#fff', border: `1px solid ${MW.line}` }}>
                            <MLoading pad={44} />
                        </div>
                    ) : next ? (
                        <a
                            href={`/mypage/reservations/${next.id}`}
                            onClick={(e) => { e.preventDefault(); go(`/mypage/reservations/${next.id}`); }}
                            style={{ position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 14, padding: 20, borderRadius: 22, background: `linear-gradient(160deg,${MW.navySoft} 0%,${MW.mintDeep} 100%)`, color: '#FFFFFF', textDecoration: 'none' }}
                        >
                            <span style={{ position: 'absolute', right: -70, top: -70, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(109,219,190,0.35),rgba(109,219,190,0) 70%)', pointerEvents: 'none' }} />
                            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: reservationTone(next.status).fg, background: reservationTone(next.status).bg, padding: '4px 10px', borderRadius: 999 }}>
                                    {reservationStatusLabel(next.status, next.depositReported, next.status || '준비 중')}
                                </span>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600, color: MW.mintLight }}>{ddayLabel(next, today)}</span>
                            </div>
                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{next.productName}</span>
                                <span style={{ fontSize: 12, color: MW.mintTint, whiteSpace: 'nowrap' }}>
                                    {[tripPeriod(next.start, next.end), next.travelers > 0 ? `${next.travelers}명` : ''].filter(Boolean).join(' · ')}
                                </span>
                            </div>
                            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.18)', fontSize: 12 }}>
                                <span style={{ color: MW.mintTint, whiteSpace: 'nowrap' }}>{resList.length > 1 ? `외 ${resList.length - 1}건의 예약` : ''}</span>
                                <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>예약 상세 보기 →</span>
                            </div>
                        </a>
                    ) : (
                        <MEmpty text="예정된 예약이 없습니다." action={{ label: '투어 찾기', onClick: () => go('/products') }} />
                    )}
                </div>

                {MY_MENU.map((group) => (
                    <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <h2 style={{ margin: 0, padding: '0 4px', fontSize: 15, fontWeight: 900 }}>{group.title}</h2>
                        <div style={{ border: `1px solid ${MW.line}`, borderRadius: 20, background: '#fff', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {group.items.map((item, i) => (
                                <MenuRow key={item.key} item={item} first={i === 0} count={item.count ? counts[item.count] : undefined} onOpen={() => go(item.path)} />
                            ))}
                        </div>
                    </div>
                ))}
            </section>
        </MobileShell>
    );
}

function MenuRow({ item, first, count, onOpen }: { item: MyMenuItem; first: boolean; count?: number; onOpen: () => void }) {
    return (
        <a
            href={item.path}
            onClick={(e) => { e.preventDefault(); onOpen(); }}
            // content-box: the design's 64px min-height excludes the row padding.
            style={{ boxSizing: 'content-box', display: 'flex', alignItems: 'center', gap: 14, minHeight: 64, padding: '10px 16px', borderTop: `1px solid ${first ? 'transparent' : M_HAIR}`, color: MW.navy, textDecoration: 'none' }}
        >
            <span style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#E6FAF3', display: 'flex', flexShrink: 0 }}>
                <img src={item.icon} alt="" width={44} height={44} loading="lazy" decoding="async" style={{ width: 44, height: 44, display: 'block', pointerEvents: 'none' }} />
            </span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                {item.sub && <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.sub}</span>}
            </span>
            {!!count && (
                <span style={{ minWidth: 22, height: 22, padding: '0 7px', boxSizing: 'border-box', borderRadius: 999, background: MW.mintTint, color: MW.mintDeep, fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {count}
                </span>
            )}
            <Ico d={D.chevron} size={16} color={MW.mute2} width={2} />
        </a>
    );
}
