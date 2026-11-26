import { useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { clearCustomerSessionCache } from '../../lib/customerSessionCache';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';
import { DEPOSIT_ACCOUNT } from '../../constants/company';
import { useHomeData } from '../../hooks/useHomeData';
import { useWishlist } from '../../hooks/useWishlist';
import { toTourDateKey } from '../../utils/formatDate';
import { won } from '../desktop-primitives/mwTokens';
import { Avatar, CountPill, TripThumb } from '../mypage-desktop/MyPageHome.desktop';
import { DDAY_COLOR, MY_MENU_GROUPS, bookingStage, boxButton, chipStyle, dateRangeText, ddayText, pickNextTrip, productImageOf } from '../mypage-desktop/myBookingView';
import { QUOTE_STATUS } from '../mypage-desktop/myPageTheme';
import { useMe, useMyPageData, type MyReservation } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { MLoading } from '../mobile/mobileUi';
import { SD, SIcon } from '../site-seed/seed';

/**
 * 휴대폰 마이페이지(Claude Design ‘마이페이지 — 모바일’·‘예약 없을 때’): 프로필 + 숫자 4칸 → 다음 여행(입금 안내) →
 * 바로가기 3칸 → 최근 견적 요청 → 메뉴(나의 여행·커뮤니티·계정) → 로그아웃. 자료는 PC 마이페이지와 같은 훅.
 */
export function MyPageMobile() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { setUser } = useUser();
    const meQuery = useMe();
    const me = meQuery.data;
    const { reservations, quotes } = useMyPageData(me);
    const { unreadCount } = useNotification();
    const wishlist = useWishlist();
    const { data: home, isLoading: homeLoading } = useHomeData();
    // Captured once so render stays pure.
    const [today] = useState(() => toTourDateKey(new Date()));

    const productById = useMemo(() => new Map(home.products.map((p) => [p.id, p])), [home.products]);
    const resList = useMemo(() => reservations.data ?? [], [reservations.data]);
    const quoteList = quotes.data ?? [];
    const next = useMemo(() => pickNextTrip(resList, today), [resList, today]);
    // Same rule as the wishlist screen: only tours that still exist are counted.
    const wishCount = useMemo(() => {
        const live = new Set(home.products.map((p) => p.id));
        return wishlist.ids.filter((id) => live.has(id)).length;
    }, [home.products, wishlist.ids]);

    const go = (path: string) => {
        if (/\.html(?:[?#]|$)/i.test(path)) { window.location.assign(path); return; }
        navigate(path);
        window.scrollTo(0, 0);
    };
    const link = (to: string) => ({ href: to, onClick: (e: MouseEvent) => { e.preventDefault(); go(to); } });

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

    const bell = (
        <button type="button" aria-label="알림" onClick={() => go('/mypage/notifications')}
            style={{ position: 'relative', width: 44, height: 44, border: 'none', background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <SIcon name="bell" size={22} stroke={1.7} />
            {unreadCount > 0 && <span aria-hidden="true" style={{ position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: 9999, background: SD.mint500 }} />}
        </button>
    );
    const shell = (children: ReactNode) => (
        <MobileShell title="마이페이지" brandHeader={false} titleAction={bell} footer={false}>{children}</MobileShell>
    );

    // A cached "logged out" answer is re-checked before sending the visitor to the login screen.
    if (meQuery.isPending || (!me && meQuery.isFetching)) return shell(<MLoading pad={120} />);
    if (!me) return <Navigate to="/login" replace state={{ from: '/mypage' }} />;

    const name = me.name || me.email?.split('@')[0] || '고객';
    const loading = reservations.isPending;
    const wishLoading = homeLoading && wishlist.ids.length > 0;
    const stats: Array<{ label: string; value: number | undefined; to: string }> = [
        { label: '예약', value: loading ? undefined : resList.length, to: '/mypage/reservations' },
        { label: '진행 중', value: loading ? undefined : resList.filter((r) => bookingStage(r, today).tab !== 'done').length, to: '/mypage/reservations' },
        { label: '견적', value: quotes.isPending ? undefined : quoteList.length, to: '/mypage/estimates' },
        { label: '찜', value: wishLoading ? undefined : wishCount, to: '/mypage/wishlist' },
    ];
    const counts: Record<string, number> = { reservations: resList.length, notifications: unreadCount };

    return shell(
        <div style={{ background: SD.white, color: SD.gray900 }}>
            <section style={sec('20px 20px')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <Avatar src={me.avatarUrl || me.image} name={name} size={56} />
                    <div style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 18, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name} 님</span>
                        {me.email && <span style={{ fontSize: 12, color: SD.gray600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me.email}</span>}
                    </div>
                </div>
                <div style={{ marginTop: 18, padding: '14px 0', borderRadius: 12, background: SD.gray50, display: 'flex' }}>
                    {stats.map((s, i) => (
                        <a key={s.label} {...link(s.to)} style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textDecoration: 'none', borderLeft: i ? `1px solid ${SD.gray200}` : 'none' }}>
                            <span style={{ fontSize: 18, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums' }}>{s.value ?? '—'}</span>
                            <span style={{ fontSize: 12, color: SD.gray600 }}>{s.label}</span>
                        </a>
                    ))}
                </div>
            </section>

            <section style={sec('20px 20px 24px')}>
                <Head title="다음 여행" more={resList.length > 0 ? link('/mypage/reservations') : undefined} />
                {loading ? <MLoading pad={24} /> : next ? <NextTrip r={next} today={today} img={productImageOf(next, productById)} go={go} link={link} /> : (
                    <div style={{ padding: '24px 16px', borderRadius: 12, border: `1px dashed ${SD.gray200}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, textAlign: 'center' }}>
                        <span style={{ width: 44, height: 44, borderRadius: 12, background: SD.gray50, color: SD.gray600, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 }}>
                            <SIcon name="calendarPlain" size={22} stroke={1.7} />
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>아직 예약한 여행이 없어요</span>
                        <span style={{ fontSize: 12, color: SD.gray600 }}>몽골 투어를 둘러보고 첫 여행을 계획해 보세요.</span>
                        <div style={{ marginTop: 10, width: '100%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                            <button type="button" onClick={() => go('/products')} style={boxButton('primary', 'medium', true)}>투어 둘러보기</button>
                            <button type="button" onClick={() => go('/custom-estimate')} style={boxButton('tertiary', 'medium', true)}>맞춤 견적 요청</button>
                        </div>
                    </div>
                )}
            </section>

            <section style={sec('16px 20px')}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                        { label: '견적 요청', icon: 'pencil', to: '/custom-estimate' },
                        { label: '동행 찾기', icon: 'userPlus', to: '/travel-mates' },
                        { label: '후기 쓰기', icon: 'reviewBubble', to: '/mypage/reviews' },
                    ].map((q) => (
                        <a key={q.label} {...link(q.to)}
                            style={{ height: 84, border: `1px solid ${SD.gray200}`, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textDecoration: 'none', color: SD.gray900 }}>
                            <SIcon name={q.icon} size={22} stroke={1.7} />
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{q.label}</span>
                        </a>
                    ))}
                </div>
            </section>

            <section style={sec('20px 20px 24px')}>
                <Head title="최근 견적 요청" more={quoteList.length > 0 ? link('/mypage/estimates') : undefined} />
                {quotes.isPending ? <MLoading pad={24} /> : quoteList.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {quoteList.slice(0, 2).map((q, i) => {
                            const st = QUOTE_STATUS[q.status] || QUOTE_STATUS.new;
                            return (
                                <a key={q.id} {...link(q.href)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderTop: i ? `1px solid ${SD.gray100}` : 'none', textDecoration: 'none', color: SD.gray900 }}>
                                    <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                        <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.destination ? `맞춤 견적 (${q.destination})` : '맞춤 견적'}</span>
                                        <span style={{ fontSize: 12, color: SD.gray600 }}>{[q.period, q.headcount].filter(Boolean).join(' · ') || (q.createdAt ? `요청일 ${q.createdAt.slice(0, 10)}` : '')}</span>
                                    </span>
                                    <span style={chipStyle(q.status === 'converted' ? 'solid' : q.status === 'cancelled' || q.status === 'completed' ? 'muted' : 'line', 'sm')}>{st.label}</span>
                                </a>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ padding: '18px 16px', border: `1px dashed ${SD.gray200}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>아직 요청한 견적이 없어요</span>
                            <span style={{ fontSize: 12, color: SD.gray600 }}>일정과 인원을 알려주시면 맞춤 견적을 보내드려요.</span>
                        </span>
                        <button type="button" onClick={() => go('/custom-estimate')} style={boxButton('tertiary', 'small')}>요청하기</button>
                    </div>
                )}
            </section>

            {MY_MENU_GROUPS.map((g) => (
                <section key={g.title} style={sec('16px 20px 8px')}>
                    <p style={{ margin: '0 0 4px', fontSize: 12, color: SD.gray500 }}>{g.title}</p>
                    {g.items.filter((m) => m.key !== 'overview').map((m) => (
                        <a key={m.key} {...link(m.path)} style={{ height: 52, display: 'flex', alignItems: 'center', gap: 12, color: SD.gray900, textDecoration: 'none' }}>
                            <span style={{ color: SD.gray700, display: 'flex' }}><SIcon name={m.icon} size={22} stroke={1.7} /></span>
                            <span style={{ flex: '1 1 auto', fontSize: 15 }}>{m.label}</span>
                            {(counts[m.key] ?? 0) > 0 && <CountPill n={counts[m.key]} />}
                            <span style={{ color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>
                        </a>
                    ))}
                </section>
            ))}

            <div style={{ padding: 20, textAlign: 'center' }}>
                <button type="button" onClick={logout} style={{ padding: 8, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: SD.gray500, textDecoration: 'underline', cursor: 'pointer' }}>로그아웃</button>
            </div>
        </div>,
    );
}

const sec = (padding: string): CSSProperties => ({ padding, borderBottom: `8px solid ${SD.gray50}` });

function Head({ title, more }: { title: string; more?: { href: string; onClick: (e: MouseEvent) => void } }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>
            {more && <a {...more} style={{ display: 'inline-flex', alignItems: 'center', fontSize: 12, color: SD.gray600, textDecoration: 'none' }}>전체 보기<SIcon name="chevronRight" size={14} stroke={2} /></a>}
        </div>
    );
}

function NextTrip({ r, today, img, go, link }: { r: MyReservation; today: string; img: string; go: (to: string) => void; link: (to: string) => { href: string; onClick: (e: MouseEvent) => void } }) {
    const stage = bookingStage(r, today);
    const dd = ddayText(r, today);
    return (
        <>
            <a {...link(r.href)} style={{ display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: SD.gray900 }}>
                <TripThumb src={img} alt={r.productName} size={72} />
                <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={chipStyle(stage.chip, 'sm')}>{stage.label}</span>
                        {dd && <strong style={{ fontSize: 12, color: DDAY_COLOR }}>{dd}</strong>}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.productName}</span>
                    <span style={{ fontSize: 12, color: SD.gray600 }}>{[dateRangeText(r.start, r.end, false), r.travelers > 0 ? `성인 ${r.travelers}명` : ''].filter(Boolean).join(' · ')}</span>
                </span>
                <span style={{ flex: 'none', color: SD.gray400, display: 'flex' }}><SIcon name="chevronRight" size={16} stroke={2} /></span>
            </a>
            {stage.needsDeposit && <DepositHint r={r} onReport={() => go(r.href)} />}
        </>
    );
}

/** 입금 안내(휴대폰): 예약금 · 계좌번호 + 복사 · ‘입금 완료 알리기’(예약 상세에서 입금자명을 적는다). */
export function DepositHint({ r, onReport }: { r: MyReservation; onReport: () => void }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard?.writeText(DEPOSIT_ACCOUNT.number);
        } catch {
            // 복사가 막혀 있어도 번호는 화면에 보인다.
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: SD.gray50, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ display: 'flex', gap: 8, fontSize: 12, lineHeight: 1.6, color: SD.gray700 }}>
                <span style={{ flex: 'none', color: SD.gray700, display: 'flex', paddingTop: 1 }}><SIcon name="bankHouse" size={16} stroke={1.7} /></span>
                <span>
                    예약금{r.deposit > 0 && <> <strong style={{ color: SD.gray900 }}>{won(r.deposit)}</strong>을</>} 입금하고 ‘입금 완료’를 알려 주세요.
                    <span style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ color: SD.gray900, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{DEPOSIT_ACCOUNT.bank} {DEPOSIT_ACCOUNT.number}</span>
                        <button type="button" onClick={copy} aria-label="계좌번호 복사"
                            style={{ height: 26, padding: '0 9px', border: `1px solid ${copied ? SD.gray400 : SD.gray200}`, borderRadius: 9999, background: SD.white, color: copied ? SD.gray900 : SD.gray700,
                                fontFamily: 'inherit', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                            <SIcon name={copied ? 'checkMark' : 'copyBox'} size={12} stroke={1.8} />{copied ? '복사됨' : '복사'}
                        </button>
                    </span>
                </span>
            </span>
            <button type="button" onClick={onReport} style={boxButton('primary', 'medium', true)}>입금 완료 알리기</button>
        </div>
    );
}
