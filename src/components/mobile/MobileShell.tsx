import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import logoMark from '../../assets/logo_horizontal.webp';
import { api } from '../../lib/api';
import { clearCustomerSessionCache } from '../../lib/customerSessionCache';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';
import { BRAND } from '../../constants/company';
import { MW_FONT, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { RECOMMENDED_WORDS, SEARCH_PLACEHOLDER } from '../home/homeContent';
import { DesktopFooter } from '../layout-desktop/DesktopFooter';
import { useMe } from '../mypage-desktop/useMyPageData';
import { SD, SD_BRAND_TEXT, SIcon } from '../site-seed/seed';
import { MobileShellContext } from './mobileShellContext';
import { MobileMenuSheet } from './MobileMenuSheet';
import { MobileTabBar } from './MobileTabBar';
import { D } from './mobileTheme';
import { Ico } from './mobileUi';

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
    /** 홈처럼 메뉴 줄을 보이고, 바닥 위 간격을 두지 않는다(본문이 문의 구역으로 끝나는 화면 — 투어 상품 목록). 홈은 늘 켜진다. */
    navRow?: boolean;
    /** Back bar title. Omit on screens that render their own title bar (SubPageBar). */
    title?: string;
    onBack?: () => void;
    /** 뒤로 가기 줄 오른쪽 단추(예: 상품 상세의 공유). */
    titleAction?: ReactNode;
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

export function MobileShell({ children, home = false, navRow = home, title, onBack, titleAction, bottomBar, headerScrolls = false, tabBar = true, footer = true }: MobileShellProps) {
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

    // 검색창은 접어 두고 돋보기 버튼으로 연다(홈 포함, 디자인 ‘홈 · 휴대폰’ 2026-11-25 2차).
    const showSearch = expanded;

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
                {/* 머리(디자인 ‘홈 · 휴대폰’, 2026-11-25): 이름 · 알림 · 전체 메뉴 → 검색 → 메뉴 줄(홈·투어 상품 목록). 홈이 아닌 화면은 돋보기로 검색을 연다. */}
                <header ref={hdrRef} style={{ position: headerScrolls ? 'relative' : 'sticky', top: 0, zIndex: 20, background: SD.white, borderBottom: navRow ? 'none' : `1px solid ${SD.gray200}` }}>
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
                            <button
                                type="button"
                                onClick={() => { setPanelOpen(!expanded); setExpanded(!expanded); }}
                                aria-label="검색"
                                aria-expanded={expanded}
                                style={{ width: 44, height: 44, border: 0, borderRadius: 9999, background: expanded ? SD.gray100 : 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                            >
                                <SIcon name="search" size={24} stroke={1.6} />
                            </button>
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
                                    autoFocus
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

                    {navRow && (
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
                        {titleAction ?? <span />}
                    </div>
                )}

                <main style={{ flex: 1, minWidth: 0 }}>{children}</main>

                {/* 바닥은 PC와 같은 부품을 좁은 여백으로 쓴다(디자인 ‘사이트 하단’). 홈은 바로 위가 문의 구역이라 간격을 두지 않는다. */}
                {footer && <div style={{ marginTop: navRow ? 0 : 48 }}><DesktopFooter compact /></div>}

                {bottomBar}

                {!bottomBar && tabBar && <MobileTabBar />}

                {menuOpen && (
                    <MobileMenuSheet onClose={() => setMenuOpen(false)} go={go} logged={logged} name={me?.name || me?.email?.split("@")[0] || "고객"}
                        avatar={avatar || undefined} unreadCount={unreadCount} onLogout={logout} />
                )}
            </div>
        </MobileShellContext.Provider>
    );
}
