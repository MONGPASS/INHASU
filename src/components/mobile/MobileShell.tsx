import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import logoMark from '../../assets/logo_horizontal.webp';
import { api } from '../../lib/api';
import { clearCustomerSessionCache } from '../../lib/customerSessionCache';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';
import { BRAND, KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { MW, MW_FONT, MW_FONT_EN, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { RECOMMENDED_WORDS, SEARCH_PLACEHOLDER } from '../home/homeContent';
import { DesktopFooter } from '../layout-desktop/DesktopFooter';
import { useMe } from '../mypage-desktop/useMyPageData';
import { SD, SD_BRAND_TEXT, SIcon } from '../site-seed/seed';
import { MobileShellContext } from './mobileShellContext';
import { MobileTabBar } from './MobileTabBar';
import { D, KAKAO_BUBBLE, KAKAO_INK, KAKAO_YELLOW, M_GRADIENT, M_HAIR, M_TILE, QUICK_MENU } from './mobileTheme';
import { Ico, QuickMenuBadge, TravellerAvatar } from './mobileUi';

/**
 * Mobile app shell (Claude Design: "Milkyway Japan Mobile").
 * Sticky header with search, optional back bar, page content, footer, and the bottom tab bar
 * (or a page-specific action bar). The home screen also gets the always-open search box and
 * the horizontal menu row.
 */
interface MobileShellProps {
    children: ReactNode;
    /** Home screen: search box always visible + menu row under it. */
    home?: boolean;
    /** Back bar title. Omit on screens that render their own title bar (SubPageBar). */
    title?: string;
    onBack?: () => void;
    /** Replaces the tab bar (quote form, mate detail). */
    bottomBar?: ReactNode;
    /** 로고 머리를 고정하지 않고 본문과 함께 올려 보낸다(뒤로 가기 줄만 위에 남는다). 긴 상세 화면용. */
    headerScrolls?: boolean;
    tabBar?: boolean;
    footer?: boolean;
}

const RECENT_KEY = 'mw_recent_searches';
/** Spelling variants / romaji mapped to the word tours are actually tagged with. */
const FIXES: Record<string, string> = {
    '트래킹': '트레킹', '트랙킹': '트레킹', '온천욕': '온천', '낙타타기': '낙타', '겔': '게르',
    gobi: '고비', terelj: '테를지', trekking: '트레킹',
};
const BACK_BAR_H = 49;

const NAV_ROW: { label: string; path: string; match: (p: string) => boolean; dot?: boolean }[] = [
    { label: '홈', path: '/', match: (p) => p === '/' },
    { label: '투어 상품', path: '/products', match: (p) => p.startsWith('/products') || p.startsWith('/category/') },
    { label: '동행 찾기', path: '/travel-mates', match: (p) => p.startsWith('/travel-mates') },
    { label: '여행 후기', path: '/reviews', match: (p) => p.startsWith('/reviews') },
    { label: '여행 가이드', path: '/travel-guide', match: (p) => p.startsWith('/travel-guide') },
    { label: '맞춤 견적', path: '/custom-estimate', match: (p) => p.startsWith('/custom-estimate') },
    { label: '여행 기획전', path: '/promotions', match: (p) => p.startsWith('/promotions'), dot: true },
];

interface SearchProduct {
    id: string;
    name: string;
    category: string;
    duration: string;
    price: number;
    tags: string[];
    image: string;
}

const readRecent = (): string[] => {
    try {
        const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 6) : [];
    } catch {
        return [];
    }
};

const writeRecent = (list: string[]) => {
    try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
    } catch {
        /* storage unavailable — recent searches are a convenience only */
    }
};

const tokens = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean);

export function MobileShell({ children, home = false, title, onBack, bottomBar, headerScrolls = false, tabBar = true, footer = true }: MobileShellProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;
    const queryClient = useQueryClient();
    const { setUser } = useUser();
    const { unreadCount } = useNotification();
    const { data: me } = useMe();
    const logged = !!me;

    const hdrRef = useRef<HTMLElement>(null);
    const searchRef = useRef<HTMLDivElement>(null);
    const [hdrH, setHdrH] = useState(64);
    const [menuOpen, setMenuOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [panelOpen, setPanelOpen] = useState(false);
    const [text, setText] = useState('');
    const [recent, setRecent] = useState<string[]>(readRecent);

    const showSearch = home || expanded;

    // The header changes height between the home screen and sub screens; sticky bars follow it.
    useLayoutEffect(() => {
        const el = hdrRef.current;
        if (!el) return;
        const measure = () => setHdrH(Math.round(el.getBoundingClientRect().height));
        measure();
        if (!window.ResizeObserver) return;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Tapping anywhere outside the search box closes its panel.
    useEffect(() => {
        if (!panelOpen) return;
        const onDown = (e: PointerEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setPanelOpen(false);
        };
        document.addEventListener('pointerdown', onDown);
        return () => document.removeEventListener('pointerdown', onDown);
    }, [panelOpen]);

    useEffect(() => {
        if (!menuOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [menuOpen]);

    // Search suggestions only load once the user opens the search box.
    const { data: products = [] } = useQuery<SearchProduct[]>({
        queryKey: ['headerSearch', 'products'],
        enabled: panelOpen,
        staleTime: 1000 * 60 * 5,
        queryFn: async () => {
            const data = await api.products.list();
            if (!Array.isArray(data)) return [];
            return data
                .filter((p: { status?: string }) => p.status === 'active' || !p.status)
                .map((p: { id: string; name: string; category?: string; duration?: string; price?: number; tags?: string[]; mainImages?: string[] }) => ({
                    id: p.id,
                    name: (p.name || '').trim(),
                    category: p.category || '',
                    duration: p.duration || '',
                    price: p.price || 0,
                    tags: Array.isArray(p.tags) ? p.tags : [],
                    image: p.mainImages?.[0] || '',
                }));
        },
    });

    const q = text.trim();
    const fix = FIXES[q.toLowerCase()] || '';
    const results = useMemo(() => {
        const toks = tokens(fix || q);
        return toks.length ? products.filter((p) => toks.every((k) => `${p.name} ${p.category} ${p.duration} ${p.tags.join(' ')}`.toLowerCase().includes(k))) : [];
    }, [products, q, fix]);

    const go = (to: string) => {
        setMenuOpen(false);
        setPanelOpen(false);
        setExpanded(false);
        navigate(to);
        window.scrollTo(0, 0);
    };

    const runSearch = (raw: string) => {
        const word = raw.trim();
        if (!word) return;
        const next = [word, ...recent.filter((x) => x !== word)].slice(0, 6);
        setRecent(next);
        writeRecent(next);
        setText(word);
        go(`/products?q=${encodeURIComponent(word)}`);
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        runSearch(fix || text);
    };

    const goBack = () => {
        if (onBack) onBack();
        else if (window.history.length > 1) navigate(-1);
        else go('/');
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

    const noticeOn = path === '/mypage/notifications';
    const backBarTop = headerScrolls ? 0 : hdrH - 1;
    const stickyTop = backBarTop + (title !== undefined ? BACK_BAR_H : 0);
    const shell = useMemo(() => ({ stickyTop }), [stickyTop]);
    const avatar = me?.avatarUrl || me?.image;

    return (
        <MobileShellContext.Provider value={shell}>
            <div data-mw-actionbar={bottomBar ? '' : undefined} style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: SD.white, color: SD.gray900, fontFamily: MW_FONT, WebkitFontSmoothing: 'antialiased' }}>
                {/* 머리(디자인 ‘홈 · 휴대폰’, 2026-11-25): 이름 · 알림 · 전체 메뉴 → 검색 → 메뉴 줄(홈만). 홈이 아닌 화면은 돋보기로 검색을 연다. */}
                <header ref={hdrRef} style={{ position: headerScrolls ? 'relative' : 'sticky', top: 0, zIndex: 20, background: SD.white, borderBottom: home ? 'none' : `1px solid ${SD.gray200}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 56, padding: '0 8px 0 20px' }}>
                        <a
                            href="/"
                            onClick={(e) => { e.preventDefault(); go('/'); }}
                            aria-label={`${BRAND.name} 홈`}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, color: SD.gray900, textDecoration: 'none' }}
                        >
                            <img src={logoMark} alt="" width={36} height={36} style={{ width: 36, height: 36, objectFit: 'contain', flex: 'none' }} />
                            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ ...SD_BRAND_TEXT, fontSize: 19 }}>몽골리아 <span style={{ color: SD.brandMint }}>은하수</span></span>
                                <span style={{ fontSize: 10, color: SD.gray600, whiteSpace: 'nowrap' }}>{BRAND.tagline}</span>
                            </span>
                        </a>
                        <div style={{ display: 'flex', flex: 'none' }}>
                            {!home && (
                                <button
                                    type="button"
                                    onClick={() => { setPanelOpen(!expanded); setExpanded(!expanded); }}
                                    aria-label="검색"
                                    aria-expanded={expanded}
                                    style={{ width: 44, height: 44, border: 0, borderRadius: 9999, background: expanded ? SD.gray100 : 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                                >
                                    <SIcon name="search" size={24} stroke={1.6} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => { if (!noticeOn) go('/mypage/notifications'); }}
                                aria-label="알림"
                                style={{ position: 'relative', width: 44, height: 44, border: 0, borderRadius: 9999, background: noticeOn ? SD.gray100 : 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                            >
                                <SIcon name="bell" size={24} stroke={1.6} />
                                {unreadCount > 0 && (
                                    <span style={{ position: 'absolute', top: 6, right: 4, minWidth: 16, height: 16, padding: '0 4px', boxSizing: 'border-box', borderRadius: 9999, background: SD.mint400, color: SD.mint950, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                            </button>
                            <button type="button" onClick={() => setMenuOpen(true)} aria-label="전체 메뉴" style={{ width: 44, height: 44, border: 0, background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                <SIcon name="menu" size={24} stroke={1.6} />
                            </button>
                        </div>
                    </div>

                    {showSearch && (
                        <div ref={searchRef} style={{ position: 'relative', padding: '4px 20px 10px' }}>
                            <form
                                onSubmit={onSubmit}
                                role="search"
                                style={{ display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 6px 0 16px', borderRadius: 9999, background: SD.gray100, boxShadow: panelOpen ? `inset 0 0 0 1px ${SD.gray900}` : 'none', boxSizing: 'border-box' }}
                            >
                                {/* 글자 16px: 그보다 작으면 iOS가 입력할 때 화면을 확대한다 */}
                                <input
                                    value={text}
                                    onChange={(e) => { setText(e.target.value); setPanelOpen(true); }}
                                    onFocus={() => setPanelOpen(true)}
                                    autoFocus={!home}
                                    enterKeyHint="search"
                                    placeholder={SEARCH_PLACEHOLDER}
                                    aria-label="투어 검색"
                                    style={{ flex: '1 1 auto', minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 16, color: SD.gray900, padding: 0, boxShadow: 'none' }}
                                />
                                {!!q && (
                                    <button type="button" onClick={() => setText('')} aria-label="지우기" style={{ width: 32, height: 32, border: 0, borderRadius: 9999, background: SD.gray300, color: SD.gray700, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
                                        <SIcon name="close" size={14} stroke={2.2} />
                                    </button>
                                )}
                                <button type="submit" aria-label="검색" style={{ width: 36, height: 36, border: 0, background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', padding: 0 }}>
                                    <SIcon name="search" size={20} stroke={1.8} />
                                </button>
                            </form>

                            {panelOpen && (
                                <div style={{ position: 'absolute', left: 20, right: 20, top: 52, zIndex: 25, background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '14px 0 8px', maxHeight: '70vh', overflowY: 'auto' }}>
                                    {!q && (
                                        <>
                                            {recent.length > 0 && (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 8px' }}>
                                                        <span style={{ fontSize: 13, fontWeight: 700, color: SD.gray900 }}>최근 검색어</span>
                                                        <button type="button" onClick={() => { setRecent([]); writeRecent([]); }} style={{ border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: SD.gray600, cursor: 'pointer' }}>전체 삭제</button>
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 14px' }}>
                                                        {recent.map((r) => (
                                                            <button key={r} type="button" onClick={() => runSearch(r)} style={{ height: 32, padding: '0 12px', border: `1px solid ${SD.gray200}`, borderRadius: 9999, background: SD.white, fontFamily: 'inherit', fontSize: 13, color: SD.gray700, cursor: 'pointer' }}>{r}</button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                            <span style={{ display: 'block', padding: '0 16px 8px', fontSize: 13, fontWeight: 700, color: SD.gray900 }}>추천 검색어</span>
                                            {RECOMMENDED_WORDS.map((w, i) => (
                                                <button key={w} type="button" onClick={() => runSearch(w)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 16px', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: SD.gray900, cursor: 'pointer', textAlign: 'left' }}>
                                                    <span style={{ width: 18, fontSize: 13, fontWeight: 700, color: i < 3 ? SD.mint700 : SD.gray600 }}>{i + 1}</span>
                                                    {w}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    {!!q && (
                                        <>
                                            {!!fix && (
                                                <button type="button" onClick={() => setText(fix)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px 10px', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: SD.gray600, cursor: 'pointer', textAlign: 'left' }}>
                                                    추천 검색어:<strong style={{ color: SD.mint700 }}>{fix}</strong>
                                                </button>
                                            )}
                                            {results.slice(0, 5).map((t) => (
                                                <button key={t.id} type="button" onClick={() => go(`/products/${t.id}`)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', border: 0, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                                                    <span style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: SD.gray100 }}>
                                                        {isUsableImage(t.image) && <img src={t.image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                                    </span>
                                                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                                                        <span style={{ fontSize: 12, color: SD.gray600 }}>{[t.duration, t.price > 0 ? `${won(t.price)}~` : ''].filter(Boolean).join(' · ')}</span>
                                                    </span>
                                                </button>
                                            ))}
                                            {results.length === 0 && (
                                                <span style={{ display: 'block', padding: '12px 16px 16px', fontSize: 13, color: SD.gray600 }}>'{q}'에 해당하는 투어를 찾지 못했습니다.</span>
                                            )}
                                            {results.length > 0 && (
                                                <button type="button" onClick={() => runSearch(fix || text)} style={{ width: 'calc(100% - 32px)', margin: '8px 16px 6px', height: 44, border: 0, borderRadius: 6, background: SD.gray900, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: SD.white, cursor: 'pointer' }}>
                                                    '{q}' 검색 결과 {results.length}건 전체 보기
                                                </button>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {home && (
                        <nav data-noscroll="" aria-label="주 메뉴" style={{ display: 'flex', gap: 22, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 20px', borderBottom: `1px solid ${SD.gray200}` }}>
                            {NAV_ROW.map((n) => {
                                const on = n.match(path);
                                const strong = on || !!n.dot;
                                return (
                                    <a
                                        key={n.path}
                                        href={n.path}
                                        onClick={(e) => { e.preventDefault(); go(n.path); }}
                                        aria-current={on ? 'page' : undefined}
                                        style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, height: 44, borderBottom: `2px solid ${on ? SD.gray900 : 'transparent'}`, color: strong ? SD.gray900 : SD.gray700, fontSize: 15, fontWeight: strong ? 700 : 400, textDecoration: 'none', boxSizing: 'border-box', whiteSpace: 'nowrap' }}
                                    >
                                        {n.label}
                                        {n.dot && <span aria-label="새 소식" style={{ width: 5, height: 5, borderRadius: 9999, background: SD.mint500 }} />}
                                    </a>
                                );
                            })}
                        </nav>
                    )}
                </header>

                {title !== undefined && (
                    <div style={{ position: 'sticky', top: backBarTop, zIndex: 10, background: SD.white, borderBottom: `1px solid ${SD.gray200}`, display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 44px', alignItems: 'center', padding: '2px 6px' }}>
                        <button type="button" onClick={goBack} aria-label="뒤로" style={{ width: 44, height: 44, border: 0, borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                            <Ico d={D.back} size={22} width={2} />
                        </button>
                        <span style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                        <span />
                    </div>
                )}

                <main style={{ flex: 1, minWidth: 0 }}>{children}</main>

                {/* 바닥은 PC와 같은 부품을 좁은 여백으로 쓴다(디자인 ‘사이트 하단’). 홈은 바로 위가 문의 구역이라 간격을 두지 않는다. */}
                {footer && <div style={{ marginTop: home ? 0 : 48 }}><DesktopFooter compact /></div>}

                {bottomBar}

                {!bottomBar && tabBar && <MobileTabBar />}

                {menuOpen && (
                    <div role="dialog" aria-modal="true" aria-label="전체 메뉴" data-mw-overlay="" style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', justifyContent: 'center' }}>
                        <div onClick={() => setMenuOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(10,31,46,0.45)' }} />
                        <div style={{ position: 'relative', width: '100%', maxWidth: 480, height: '100%', display: 'flex', justifyContent: 'flex-end', pointerEvents: 'none' }}>
                            <div style={{ position: 'relative', width: '84%', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', overflowY: 'auto', pointerEvents: 'auto', fontFamily: MW_FONT, color: MW.navy }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: `1px solid ${M_HAIR}` }}>
                                    <span style={{ fontSize: 15, fontWeight: 900 }}>전체 메뉴</span>
                                    <button type="button" onClick={() => setMenuOpen(false)} aria-label="닫기" style={{ width: 44, height: 44, border: 0, background: 'transparent', fontSize: 22, color: MW.navy, cursor: 'pointer', marginRight: -10, padding: 0 }}>×</button>
                                </div>

                                <div style={{ margin: 16, padding: 16, borderRadius: 18, background: 'linear-gradient(135deg,#F1FCF8 0%,#E3F8F1 100%)', border: `1px solid ${MW.mintTint}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {logged ? (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                                <span style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: MW.mintTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <TravellerAvatar size={40} />}
                                                </span>
                                                <span style={{ fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(me?.name || me?.email?.split('@')[0] || '고객')} 님</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                                                <a href="/mypage" onClick={(e) => { e.preventDefault(); go('/mypage'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: 999, background: M_GRADIENT, fontSize: 14, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', textDecoration: 'none' }}>마이페이지</a>
                                                <button type="button" onClick={logout} style={{ height: 46, borderRadius: 999, background: '#FFFFFF', border: `1.5px solid ${MW.navy}`, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap', cursor: 'pointer' }}>로그아웃</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, color: MW.navy, whiteSpace: 'nowrap' }}>로그인하고 예약·견적을 관리하세요</span>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                                                <a href="/login" onClick={(e) => { e.preventDefault(); go('/login'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 999, background: '#FFFFFF', border: `1.5px solid ${MW.navy}`, fontSize: 14, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap', textDecoration: 'none', boxSizing: 'border-box' }}>
                                                    <Ico d="M10 17l5-5-5-5M15 12H3M14 4h5a1 1 0 011 1v14a1 1 0 01-1 1h-5" size={16} width={2} />로그인
                                                </a>
                                                <a href="/login" onClick={(e) => { e.preventDefault(); go('/login'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 46, borderRadius: 999, background: M_GRADIENT, fontSize: 14, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', textDecoration: 'none' }}>
                                                    <Ico d="M10 11a4 4 0 100-8 4 4 0 000 8zM3 20c.7-3.4 3.6-6 7-6 1.4 0 2.7.4 3.8 1.1M18 14v6M15 17h6" size={16} width={2} color="#FFFFFF" />회원가입
                                                </a>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintDeep, padding: '0 4px' }}>MENU</span>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
                                        {QUICK_MENU.map((item) => (
                                            <a key={item.key} href={item.path} onClick={(e) => { e.preventDefault(); go(item.path); }} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '14px 4px 12px', borderRadius: 16, background: M_TILE, color: MW.navy, minWidth: 0, textDecoration: 'none' }}>
                                                <span style={{ width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <img src={item.icon} alt="" width={46} height={46} style={{ width: 46, height: 46, objectFit: 'contain' }} />
                                                </span>
                                                <span style={{ maxWidth: '100%', fontSize: 12, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                                                <QuickMenuBadge item={item} />
                                            </a>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ padding: '24px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintDeep, padding: '0 4px' }}>SUPPORT</span>
                                    <div style={{ border: `1px solid ${MW.line}`, borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                        {([['알림', 'M6 16V11a6 6 0 1112 0v5l1.5 2h-15zM10 20a2 2 0 004 0', '/mypage/notifications'], ['자주 묻는 질문', D.faq, '/faq'], ['문의', D.mail, '/contact']] as const).map(([label, d, to], i) => (
                                            <a key={to} href={to} onClick={(e) => { e.preventDefault(); go(to); }} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52, padding: '0 14px', borderTop: `1px solid ${i ? M_HAIR : 'transparent'}`, color: MW.navy, textDecoration: 'none' }}>
                                                <span style={{ width: 32, height: 32, borderRadius: 10, background: MW.mintBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Ico d={d} size={17} color={MW.mintDeep} />
                                                </span>
                                                <span style={{ flex: 1, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{label}</span>
                                                <Ico d={D.chevron} size={16} color={MW.mute2} width={2} />
                                            </a>
                                        ))}
                                    </div>
                                </div>

                                <div style={{ margin: '24px 16px 24px', padding: 16, borderRadius: 18, background: MW.navySoft, color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                        <span style={{ fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap' }}>한국어 완벽 지원·현지 여행사</span>
                                        <span style={{ fontSize: 11, color: '#C4D0D8', whiteSpace: 'nowrap' }}>카카오톡 상담, 평균 3시간 이내 답변</span>
                                    </div>
                                    <a href={KAKAO_CHANNEL_CHAT_URL} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 44, borderRadius: 999, background: KAKAO_YELLOW, fontSize: 14, fontWeight: 700, color: KAKAO_INK, whiteSpace: 'nowrap', textDecoration: 'none' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill={KAKAO_INK} d={KAKAO_BUBBLE} /></svg>카카오톡으로 상담하기
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MobileShellContext.Provider>
    );
}
