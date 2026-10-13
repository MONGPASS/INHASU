import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import logoSquare from '../../assets/logo_horizontal.webp';
import { api } from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';
import { BRAND, KAKAO_CHANNEL_CHAT_URL, KAKAO_CHANNEL_URL } from '../../constants/company';
import { MW, MW_FONT, MW_FONT_EN, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { useMe } from '../mypage-desktop/useMyPageData';
import { useProductCategories } from '../../hooks/useProductCategories';
import { durationLabel } from '../tours-mobile/tourListFilters';
import { MobileShellContext } from './mobileShellContext';
import { MobileTabBar } from './MobileTabBar';
import { D, KAKAO_BUBBLE, KAKAO_INK, KAKAO_YELLOW, M_GRADIENT, M_HAIR, M_TILE, QUICK_MENU } from './mobileTheme';
import { Ico, MPhoto, QuickMenuBadge, TravellerAvatar } from './mobileUi';

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
    tabBar?: boolean;
    footer?: boolean;
}

const HOT_WORDS = ['고비사막', '승마', '별밤', '온천'];
const POPULAR_WORDS = ['고비사막', '승마', '별밤', '온천', '트레킹'];
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

/** `word`: 카테고리 랜딩으로 가는 링크 — 그 카테고리가 없으면 이 검색어로 투어 목록을 연다. */
const FOOT_GROUPS: { title: string; links: { label: string; path: string; word?: string }[] }[] = [
    {
        title: '서비스',
        links: [
            { label: '몽골 여행 가이드', path: '/travel-guide' },
            { label: '몽골 투어 상품 목록', path: '/products' },
            { label: '몽골 승마 여행', path: '/category/horse-riding-tour', word: '승마' },
            { label: '고비사막 투어', path: '/category/gobi-desert', word: '고비' },
            { label: '동행 찾기', path: '/travel-mates' },
            { label: '맞춤 견적 요청', path: '/custom-estimate' },
        ],
    },
    {
        title: '이용 안내',
        links: [
            { label: '예약 안내', path: '/booking-flow' },
            { label: '자주 묻는 질문 (FAQ)', path: '/faq' },
            { label: '이용약관', path: '/terms-of-service' },
            { label: '개인정보처리방침', path: '/privacy-policy' },
            { label: '예약 내역 확인', path: '/mypage/reservations' },
        ],
    },
    {
        title: '회사 정보',
        links: [
            { label: '회사 소개', path: '/about' },
            { label: '가이드 모집', path: '/guide-apply' },
            { label: '여행 후기', path: '/reviews' },
            { label: '마이페이지', path: '/mypage' },
            { label: '문의', path: '/contact' },
        ],
    },
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

/** /api/products sends the photo list as an array or a JSON string, in camelCase or snake_case. */
const firstImage = (v: unknown): string => {
    if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : '';
    if (typeof v !== 'string' || !v) return '';
    try {
        const parsed: unknown = JSON.parse(v);
        return Array.isArray(parsed) && typeof parsed[0] === 'string' ? parsed[0] : '';
    } catch {
        return v.startsWith('/') || v.startsWith('http') ? v : '';
    }
};

/** Same haystack as the tour list's ?q= match, so the panel's count equals the list it opens. */
const searchText = (p: SearchProduct) => {
    const days = durationLabel(p.duration);
    return `${p.name} ${p.tags.join(' ')} ${p.category} ${p.duration} ${days} ${days.replace(/\s+/g, '')}`.toLowerCase();
};

export function MobileShell({ children, home = false, title, onBack, bottomBar, tabBar = true, footer = true }: MobileShellProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const path = location.pathname;
    const queryClient = useQueryClient();
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
    const [hotIdx, setHotIdx] = useState(0);
    const [foot, setFoot] = useState<number | null>(null);

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

    // The HOT word rotates only while the search panel is closed.
    useEffect(() => {
        if (panelOpen) return;
        const t = window.setInterval(() => setHotIdx((i) => i + 1), 3000);
        return () => window.clearInterval(t);
    }, [panelOpen]);

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
                .map((p: { id: string; name: string; category?: string; duration?: string; price?: number; tags?: string[]; mainImages?: unknown; main_images?: unknown }) => ({
                    id: p.id,
                    name: (p.name || '').trim(),
                    category: p.category || '',
                    duration: p.duration || '',
                    price: p.price || 0,
                    tags: Array.isArray(p.tags) ? p.tags : [],
                    image: firstImage(p.mainImages) || firstImage(p.main_images),
                }));
        },
    });

    // Footer links to a category landing fall back to a tour search when that category is not set up.
    const categories = useProductCategories(footer && foot === 0);
    const categoriesLoaded = queryClient.getQueryState(['productCategories'])?.status === 'success';
    const footPath = (l: { path: string; word?: string }) => {
        const word = l.word;
        if (!word) return l.path;
        const slug = l.path.split('/').pop();
        const hit = categories.find((c) => c.id === slug) || categories.find((c) => c.name.includes(word));
        if (hit) return `/category/${hit.id}`;
        return categoriesLoaded ? `/products?q=${encodeURIComponent(word)}` : l.path;
    };

    const q = text.trim();
    const fix = FIXES[q.toLowerCase()] || '';
    const results = useMemo(() => {
        const toks = tokens(fix || q);
        if (!toks.length) return [];
        return products.filter((p) => {
            const hay = searchText(p);
            return toks.every((k) => hay.includes(k));
        });
    }, [products, q, fix]);
    const hot = HOT_WORDS[hotIdx % HOT_WORDS.length];

    const go = (to: string) => {
        setMenuOpen(false);
        setPanelOpen(false);
        setExpanded(false);
        navigate(to);
        window.scrollTo(0, 0);
    };

    const remember = (raw: string) => {
        const word = raw.trim();
        if (!word) return '';
        const next = [word, ...recent.filter((x) => x !== word)].slice(0, 6);
        setRecent(next);
        writeRecent(next);
        return word;
    };

    const runSearch = (raw: string) => {
        const word = remember(raw);
        if (!word) return;
        setText(word);
        go(`/products?q=${encodeURIComponent(word)}`);
    };

    /** A suggested tour opens directly; the word that found it is kept as a recent search. */
    const openResult = (id: string) => {
        remember(fix || text);
        go(`/products/${id}`);
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
        queryClient.removeQueries({ queryKey: ['authMe'] });
        queryClient.removeQueries({ queryKey: ['myPage'] });
        queryClient.removeQueries({ queryKey: ['wishlistIds'] });
        go('/');
    };

    const noticeOn = path === '/mypage/notifications';
    const stickyTop = hdrH - 1 + (title !== undefined ? BACK_BAR_H : 0);
    const shell = useMemo(() => ({ stickyTop }), [stickyTop]);
    const avatar = me?.avatarUrl || me?.image;

    return (
        <MobileShellContext.Provider value={shell}>
            <div data-mw-actionbar={bottomBar ? '' : undefined} style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF', color: MW.navy, fontFamily: MW_FONT, WebkitFontSmoothing: 'antialiased' }}>
                <header ref={hdrRef} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${M_HAIR}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px' }}>
                        <a
                            href="/"
                            onClick={(e) => { e.preventDefault(); go('/'); }}
                            aria-label={`${BRAND.name} 홈`}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, color: MW.navy, flex: 1, minWidth: 0, textDecoration: 'none' }}
                        >
                            <img src={logoSquare} alt="" width={34} height={34} style={{ width: 34, height: 34, objectFit: 'contain', flexShrink: 0 }} />
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 1, lineHeight: 1.15, minWidth: 0 }}>
                                <span style={{ fontFamily: MW_FONT, fontWeight: 900, fontSize: 17, letterSpacing: '-0.04em', whiteSpace: 'nowrap' }}>
                                    몽골리아<span style={{ color: MW.mint }}> 은하수</span>
                                </span>
                                <span style={{ fontSize: 10, color: MW.mute, whiteSpace: 'nowrap' }}>{BRAND.tagline}</span>
                            </span>
                        </a>
                        {!home && (
                            <button
                                type="button"
                                onClick={() => { setPanelOpen(!expanded); setExpanded(!expanded); }}
                                aria-label="검색"
                                aria-expanded={expanded}
                                style={{ width: 44, height: 44, border: 0, borderRadius: '50%', background: expanded ? MW.mintTint : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: -6, padding: 0 }}
                            >
                                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={MW.navy} strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => { if (!noticeOn) go('/mypage/notifications'); }}
                            aria-label="알림"
                            style={{ position: 'relative', width: 44, height: 44, border: 0, borderRadius: '50%', background: noticeOn ? MW.mintTint : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                        >
                            <Ico d={D.bell} size={23} width={1.7} />
                            {unreadCount > 0 && (
                                <span style={{ position: 'absolute', top: 7, right: 7, minWidth: 16, height: 16, padding: '0 4px', boxSizing: 'border-box', borderRadius: 999, background: MW.mint, border: '2px solid #FFFFFF', color: MW.navy, fontFamily: MW_FONT_EN, fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </span>
                            )}
                        </button>
                        <button type="button" onClick={() => setMenuOpen(true)} aria-label="전체 메뉴" style={{ width: 44, height: 44, border: 0, background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginRight: -8, padding: 0 }}>
                            <Ico d={D.menu} size={22} />
                        </button>
                    </div>

                    {showSearch && (
                        <div ref={searchRef} style={{ position: 'relative', padding: '0 16px 10px' }}>
                            <form
                                onSubmit={onSubmit}
                                role="search"
                                style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 6px 0 16px', border: `1.5px solid ${panelOpen ? MW.mint : MW.navy}`, borderRadius: 999, background: '#fff', boxShadow: panelOpen ? '0 0 0 4px rgba(39,171,143,0.15)' : 'none', transition: 'box-shadow .2s,border-color .2s', boxSizing: 'border-box' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={MW.navy} strokeWidth="2" strokeLinecap="round" aria-hidden="true" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>
                                <input
                                    value={text}
                                    onChange={(e) => { setText(e.target.value); setPanelOpen(true); }}
                                    onFocus={() => setPanelOpen(true)}
                                    autoFocus={!home}
                                    enterKeyHint="search"
                                    placeholder="고비사막, 승마, 별밤 투어 검색"
                                    aria-label="투어 검색"
                                    style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 16, color: MW.navy, padding: 0, boxShadow: 'none' }}
                                />
                                {!!q && (
                                    <button type="button" onClick={() => setText('')} aria-label="지우기" style={{ width: 32, height: 32, border: 0, borderRadius: '50%', background: MW.chip, color: MW.mute, fontSize: 14, cursor: 'pointer', flexShrink: 0, padding: 0 }}>×</button>
                                )}
                                {!q && !panelOpen && (
                                    <button type="button" onClick={() => runSearch(hot)} style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, height: 34, padding: '0 10px', border: 0, borderRadius: 999, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer' }}>
                                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 9, fontWeight: 700, color: MW.mintDeep, border: `1.5px solid ${MW.mint}`, borderRadius: 6, padding: '2px 5px' }}>HOT</span>
                                        <span style={{ fontSize: 12, color: MW.ink3, minWidth: 48, textAlign: 'left' }}>{hot}</span>
                                    </button>
                                )}
                            </form>

                            {panelOpen && (
                                <div style={{ position: 'absolute', left: 16, right: 16, top: 52, zIndex: 25, background: '#FFFFFF', border: `1px solid ${MW.line}`, borderRadius: 20, boxShadow: '0 16px 40px rgba(10,31,46,0.14)', padding: '14px 0 8px', maxHeight: '70vh', overflowY: 'auto' }}>
                                    {!q && (
                                        <>
                                            {recent.length > 0 && (
                                                <>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 8px' }}>
                                                        <span style={{ fontSize: 12, fontWeight: 700, color: MW.mute }}>최근 검색어</span>
                                                        <button type="button" onClick={() => { setRecent([]); writeRecent([]); }} style={{ border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: MW.mute2, cursor: 'pointer' }}>전체 삭제</button>
                                                    </div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 16px 14px' }}>
                                                        {recent.map((r) => (
                                                            <button key={r} type="button" onClick={() => runSearch(r)} style={{ height: 32, padding: '0 12px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 12, color: MW.ink3, cursor: 'pointer' }}>{r}</button>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                            <span style={{ display: 'block', padding: '0 16px 8px', fontSize: 12, fontWeight: 700, color: MW.mute }}>인기 검색어</span>
                                            {POPULAR_WORDS.map((w, i) => (
                                                <button key={w} type="button" onClick={() => runSearch(w)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, height: 44, padding: '0 16px', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: MW.navy, cursor: 'pointer', textAlign: 'left' }}>
                                                    <span style={{ width: 18, fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, color: i < 3 ? MW.mintDeep : MW.mute2 }}>{i + 1}</span>
                                                    {w}
                                                </button>
                                            ))}
                                        </>
                                    )}
                                    {!!q && (
                                        <>
                                            {!!fix && (
                                                <button type="button" onClick={() => setText(fix)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px 10px', border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: MW.mute, cursor: 'pointer', textAlign: 'left' }}>
                                                    추천 검색어:<strong style={{ color: MW.mintDeep }}>{fix}</strong>
                                                </button>
                                            )}
                                            {results.slice(0, 5).map((t) => (
                                                <button key={t.id} type="button" onClick={() => openResult(t.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', border: 0, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                                                    <span style={{ position: 'relative', width: 48, height: 48, borderRadius: 12, overflow: 'hidden', flexShrink: 0, pointerEvents: 'none' }}>
                                                        <MPhoto src={isUsableImage(t.image) ? t.image : undefined} sizes="48px" />
                                                    </span>
                                                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</span>
                                                        <span style={{ fontSize: 12, color: MW.mute }}>{[durationLabel(t.duration), t.price > 0 ? `${won(t.price)}~` : ''].filter(Boolean).join(' · ')}</span>
                                                    </span>
                                                </button>
                                            ))}
                                            {results.length === 0 && (
                                                <span style={{ display: 'block', padding: '12px 16px 16px', fontSize: 13, color: MW.mute }}>'{q}'에 해당하는 투어를 찾지 못했습니다.</span>
                                            )}
                                            {results.length > 0 && (
                                                <button type="button" onClick={() => runSearch(fix || text)} style={{ width: 'calc(100% - 32px)', margin: '8px 16px 6px', height: 44, border: 0, borderRadius: 999, background: MW.navy, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>
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
                        <nav data-noscroll="" aria-label="메뉴" style={{ display: 'flex', gap: 4, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 10px' }}>
                            {NAV_ROW.map((n) => {
                                const on = n.match(path);
                                return (
                                    <a
                                        key={n.path}
                                        href={n.path}
                                        onClick={(e) => { e.preventDefault(); go(n.path); }}
                                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, height: 42, padding: '0 10px', fontSize: 14, fontWeight: on ? 900 : 500, color: on ? MW.navy : MW.ink3, whiteSpace: 'nowrap', borderBottom: `2px solid ${on ? MW.navy : 'transparent'}`, boxSizing: 'border-box', textDecoration: 'none' }}
                                    >
                                        {n.label}
                                        {n.dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: MW.mint }} />}
                                    </a>
                                );
                            })}
                        </nav>
                    )}
                </header>

                {title !== undefined && (
                    <div style={{ position: 'sticky', top: hdrH - 1, zIndex: 10, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${M_HAIR}`, display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 44px', alignItems: 'center', padding: '2px 6px' }}>
                        <button type="button" onClick={goBack} aria-label="뒤로" style={{ width: 44, height: 44, border: 0, borderRadius: '50%', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                            <Ico d={D.back} size={22} width={2} />
                        </button>
                        <span style={{ textAlign: 'center', fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                        <span />
                    </div>
                )}

                <main style={{ flex: 1, minWidth: 0 }}>{children}</main>

                {footer && (
                    <footer style={{ marginTop: 48, borderTop: `1px solid ${MW.line}`, padding: '28px 16px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <span style={{ fontFamily: MW_FONT, fontWeight: 900, fontSize: 20, letterSpacing: '-0.04em' }}>몽골리아<span style={{ color: MW.mint }}> 은하수</span></span>
                            <span style={{ fontSize: 11, color: MW.mute }}>Mongolia Milky Way (SUUN ZAM)</span>
                            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: MW.mute }}>몽골 여행·몽골 투어 전문 현지 여행사입니다. 한국어에 능통한 전문 가이드가 동행하여 안심하고 떠날 수 있는 안전한 여행을 제안합니다.</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${M_HAIR}` }}>
                            {FOOT_GROUPS.map((g, i) => {
                                const open = foot === i;
                                return (
                                    <div key={g.title} style={{ borderBottom: `1px solid ${M_HAIR}` }}>
                                        <button type="button" onClick={() => setFoot(open ? null : i)} aria-expanded={open} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 52, padding: 0, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>
                                            {g.title}
                                            <span style={{ fontSize: 14, color: MW.mute, transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .2s' }}>⌄</span>
                                        </button>
                                        {open && (
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px 16px', padding: '0 0 18px' }}>
                                                {g.links.map((l) => {
                                                    const to = footPath(l);
                                                    return <a key={l.label} href={to} onClick={(e) => { e.preventDefault(); go(to); }} style={{ fontSize: 13, color: MW.mute, textDecoration: 'none' }}>{l.label}</a>;
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: 11, lineHeight: 1.8, color: MW.mute }}>
                            <div>
                                <strong style={{ color: MW.navy }}>[몽골본사]</strong><br />
                                상호명: 몽골리아 은하수(SUUN ZAM) | 대표: Davaasuren Bilguun<br />
                                사업자등록번호: 9011640064 | 관광사업등록번호: 6124313<br />
                                전화번호: +976 9594 5838 | Tel: +976-8010-7766<br />
                                위치: 울란바토르 바양주르흐구 13동 DACO센터 3층 306호
                            </div>
                            <div>
                                <strong style={{ color: MW.navy }}>[한국대리점]</strong><br />
                                상호명: 헬로볼라 | 대표자: Davaasuren Bolor<br />
                                사업자등록번호: 730-54-00614 | 통신판매업번호: 제2022-서울중랑-1776호<br />
                                이메일: bolor1@hanmail.net<br />
                                문의:{' '}
                                <a href={KAKAO_CHANNEL_URL} target="_blank" rel="noopener noreferrer" style={{ color: MW.mintDeep, fontWeight: 700, textDecoration: 'none' }}>카카오톡 채널</a>
                                {' '}또는 채팅으로 문의해 주세요.
                            </div>
                        </div>
                    </footer>
                )}

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
