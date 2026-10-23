import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import logoSquare from '../../assets/logo_horizontal.webp';
import { api } from '../../lib/api';
import { openKakaoConsultation } from '../../lib/consultation';
import { useWishlist } from '../../hooks/useWishlist';
import { useProductCategories } from '../../hooks/useProductCategories';
import { BRAND } from '../../constants/company';
import { isPublishedMagazine } from '../../constants/seo';
import { getProductStartingPrice } from '../../utils/productStartingPrice';
import { MW, MW_FONT, MW_FONT_EN, isUsableImage, won } from '../desktop-primitives/mwTokens';

const NAV_ITEMS: { id: string; label: string; path: string; match: (p: string) => boolean }[] = [
    { id: 'home', label: '홈', path: '/', match: (p) => p === '/' },
    { id: 'tours', label: '투어 상품', path: '/products', match: (p) => p === '/products' || p.startsWith('/category/') || p.startsWith('/products/') },
    { id: 'mates', label: '동행 찾기', path: '/travel-mates', match: (p) => p.startsWith('/travel-mates') },
    { id: 'reviews', label: '여행 후기', path: '/reviews', match: (p) => p.startsWith('/reviews') },
    { id: 'magazine', label: '여행 가이드', path: '/travel-guide', match: (p) => p.startsWith('/travel-guide') },
    { id: 'quote', label: '맞춤 견적', path: '/custom-estimate', match: (p) => p.startsWith('/custom-estimate') || p.startsWith('/estimate') },
    { id: 'promo', label: '여행 기획전', path: '/promotions', match: (p) => p.startsWith('/promotions') },
];

const HOT_WORDS = ['고비사막', '승마', '별밤', '온천'];
const POPULAR_WORDS = [...HOT_WORDS, '낙타', '게르'];
const RECENT_KEY = 'mw_recent_searches';

interface SearchProduct {
    id: string;
    name: string;
    category: string;
    duration: string;
    startingPrice: ReturnType<typeof getProductStartingPrice>;
    tags: string[];
    image: string;
}

interface SearchMagazine {
    id: string;
    title: string;
    description: string;
    category: string;
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

const tokens = (q: string) => q.split(/[\s\u3000]+/).filter(Boolean);

export function DesktopHeader() {
    const navigate = useNavigate();
    const location = useLocation();
    const wishlist = useWishlist();
    const inputRef = useRef<HTMLInputElement>(null);
    const blurTimer = useRef<number | undefined>(undefined);

    const [text, setText] = useState('');
    const [focused, setFocused] = useState(false);
    const [recent, setRecent] = useState<string[]>(readRecent);
    const [hotIdx, setHotIdx] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const t = window.setInterval(() => setHotIdx((i) => i + 1), 3000);
        return () => window.clearInterval(t);
    }, []);

    // Close the full menu whenever the route changes.
    useEffect(() => {
        setMenuOpen(false);
    }, [location.pathname]);

    // Search suggestions only load once the user opens the search box.
    const { data: products = [] } = useQuery<SearchProduct[]>({
        queryKey: ['headerSearch', 'products'],
        enabled: focused,
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
                    startingPrice: getProductStartingPrice(p),
                    tags: Array.isArray(p.tags) ? p.tags : [],
                    image: p.mainImages?.[0] || '',
                }));
        },
    });

    const { data: magazines = [] } = useQuery<SearchMagazine[]>({
        queryKey: ['headerSearch', 'magazines'],
        enabled: focused,
        staleTime: 1000 * 60 * 5,
        queryFn: async () => {
            const data = await api.magazines.list();
            if (!Array.isArray(data)) return [];
            return data
                .filter(isPublishedMagazine)
                .map((m: { id: string; title?: string; subtitle?: string; description?: string; category?: string }) => ({
                    id: m.id,
                    title: m.title || '',
                    description: m.subtitle || m.description || '',
                    category: m.category || '',
                }));
        },
    });

    const categories = useProductCategories(menuOpen);

    const q = text.trim();
    const toks = tokens(q);
    const hitTours = useMemo(
        () => (toks.length ? products.filter((p) => toks.every((k) => `${p.name} ${p.category} ${p.duration} ${p.tags.join(' ')}`.includes(k))).slice(0, 5) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [products, q],
    );
    const hitArticles = useMemo(
        () => (toks.length ? magazines.filter((m) => toks.every((k) => `${m.title} ${m.description} ${m.category}`.includes(k))).slice(0, 3) : []),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [magazines, q],
    );

    const closeSearch = () => {
        setFocused(false);
        inputRef.current?.blur();
    };

    const search = (raw: string) => {
        const word = raw.trim();
        if (!word) return;
        const next = [word, ...recent.filter((x) => x !== word)].slice(0, 6);
        setRecent(next);
        writeRecent(next);
        setText(word);
        closeSearch();
        navigate(`/products?q=${encodeURIComponent(word)}`);
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        search(text);
    };

    const onConsult = openKakaoConsultation;

    const go = (path: string) => {
        setMenuOpen(false);
        navigate(path);
    };

    const hot = HOT_WORDS[hotIdx % HOT_WORDS.length];
    const showIdle = focused && !q;
    const showResults = focused && !!q;

    const menu: { en: string; title: string; items: { label: string; onClick: () => void }[] }[] = [
        {
            en: 'TOURS',
            title: '투어 상품',
            items: [
                { label: '전체 투어', onClick: () => go('/products') },
                ...categories.map((c) => ({ label: c.name, onClick: () => go(`/category/${c.id}`) })),
            ],
        },
        {
            en: 'GUIDE',
            title: '여행 정보',
            items: [
                { label: '여행 기획전', onClick: () => go('/promotions') },
                { label: '여행 가이드', onClick: () => go('/travel-guide') },
                { label: '여행 후기', onClick: () => go('/reviews') },
                { label: '동행 찾기', onClick: () => go('/travel-mates') },
                { label: '회사 소개', onClick: () => go('/about') },
            ],
        },
        {
            en: 'SUPPORT',
            title: '고객 지원',
            items: [
                { label: '맞춤 견적', onClick: () => go('/custom-estimate') },
                { label: '예약 내역 확인', onClick: () => go('/mypage/reservations') },
                { label: '자주 묻는 질문 (FAQ)', onClick: () => go('/faq') },
                { label: '문의', onClick: () => { setMenuOpen(false); onConsult(); } },
            ],
        },
    ];

    return (
        <>
            <div style={{ background: '#fff' }}>
                {/* Utility row */}
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '10px 24px 0', display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 12, color: MW.mute }}>
                    <span style={{ color: MW.mintDeep, fontWeight: 700 }}>한국어 완벽 지원·현지 여행사</span>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <HoverLink onClick={() => navigate('/login')}>로그인</HoverLink>
                        <HoverLink onClick={() => navigate('/login')}>회원가입</HoverLink>
                        <HoverLink onClick={() => navigate('/faq')}>고객센터</HoverLink>
                    </div>
                </div>

                {/* Logo + search + account icons */}
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '14px 24px 18px', display: 'flex', alignItems: 'center', gap: 24 }}>
                    <a
                        href="/"
                        onClick={(e) => { e.preventDefault(); navigate('/'); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, color: MW.navy, flexShrink: 0, textDecoration: 'none' }}
                    >
                        <img src={logoSquare} alt={BRAND.name} width={44} height={44} style={{ width: 44, height: 44, objectFit: 'contain' }} />
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.2 }}>
                            <span style={{ fontFamily: MW_FONT, fontWeight: 900, fontSize: 22, letterSpacing: '-0.04em', whiteSpace: 'nowrap' }}>
                                몽골리아<span style={{ color: MW.mint }}> 은하수</span>
                            </span>
                            <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap' }}>{BRAND.tagline}</span>
                        </span>
                    </a>

                    <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 440, minWidth: 180 }}>
                        <form
                            onSubmit={onSubmit}
                            role="search"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                height: 52,
                                padding: '0 8px 0 22px',
                                border: `2px solid ${focused ? MW.mint : MW.navy}`,
                                borderRadius: 999,
                                boxSizing: 'border-box',
                                background: '#fff',
                                transition: 'border-color .15s',
                            }}
                        >
                            <input
                                ref={inputRef}
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onFocus={() => { window.clearTimeout(blurTimer.current); setFocused(true); }}
                                onBlur={() => { blurTimer.current = window.setTimeout(() => setFocused(false), 150); }}
                                onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
                                placeholder="고비사막, 승마, 별밤 투어 검색"
                                aria-label="투어 검색"
                                autoComplete="off"
                                style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', fontSize: 15, fontFamily: 'inherit', color: MW.navy, background: 'transparent' }}
                            />
                            {text && (
                                <button
                                    type="button"
                                    onMouseDown={(e) => { e.preventDefault(); setText(''); inputRef.current?.focus(); }}
                                    aria-label="지우기"
                                    style={{ width: 32, height: 32, border: 0, borderRadius: '50%', background: MW.chip, color: MW.mute, fontSize: 14, cursor: 'pointer', flexShrink: 0, marginRight: 2 }}
                                >
                                    ×
                                </button>
                            )}
                            <button
                                type="submit"
                                aria-label="검색"
                                style={{ width: 40, height: 40, border: 0, borderRadius: '50%', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                            >
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={MW.navy} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                                    <circle cx="11" cy="11" r="6.5" />
                                    <path d="M16 16l4.5 4.5" />
                                </svg>
                            </button>
                        </form>

                        {focused && (
                            <div
                                onMouseDown={(e) => e.preventDefault()}
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    top: 'calc(100% + 8px)',
                                    zIndex: 60,
                                    background: '#fff',
                                    border: `1px solid ${MW.line}`,
                                    borderRadius: 20,
                                    boxShadow: '0 18px 40px rgba(10,31,46,0.14)',
                                    padding: 18,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 16,
                                    maxHeight: '70vh',
                                    overflowY: 'auto',
                                }}
                            >
                                {showIdle && (
                                    <>
                                        {recent.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={dropLabel}>최근 검색어</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => { setRecent([]); writeRecent([]); }}
                                                        style={{ border: 0, background: 'transparent', fontSize: 12, color: MW.mute, cursor: 'pointer', fontFamily: 'inherit' }}
                                                    >
                                                        전체 삭제
                                                    </button>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                    {recent.map((k) => (
                                                        <button
                                                            key={k}
                                                            type="button"
                                                            onClick={() => search(k)}
                                                            style={{ height: 34, padding: '0 14px', borderRadius: 999, border: `1px solid ${MW.line}`, background: '#fff', fontSize: 13, color: MW.navy, cursor: 'pointer', fontFamily: 'inherit' }}
                                                        >
                                                            {k}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <span style={{ ...dropLabel, marginBottom: 4 }}>인기 검색어</span>
                                            {POPULAR_WORDS.map((k, i) => (
                                                <HoverButton key={k} onClick={() => search(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, height: 40, padding: '0 10px', borderRadius: 10, fontSize: 14, color: MW.navy }}>
                                                    <span style={{ width: 20, fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 700, color: MW.mintDeep }}>{i + 1}</span>
                                                    {k}
                                                </HoverButton>
                                            ))}
                                        </div>
                                    </>
                                )}

                                {showResults && (
                                    <>
                                        {hitTours.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span style={{ ...dropLabel, marginBottom: 4 }}>투어</span>
                                                {hitTours.map((t) => (
                                                    <HoverButton
                                                        key={t.id}
                                                        onClick={() => { closeSearch(); navigate(`/products/${t.id}`); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12 }}
                                                    >
                                                        <span
                                                            style={{
                                                                width: 48,
                                                                height: 48,
                                                                borderRadius: 10,
                                                                flexShrink: 0,
                                                                background: isUsableImage(t.image) ? `center/cover url(${t.image})` : MW.mintTint,
                                                            }}
                                                        />
                                                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                            <span style={{ fontSize: 14, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {t.duration ? `[${t.duration}] ` : ''}{t.name}
                                                            </span>
                                                            <span style={{ fontSize: 12, color: MW.mute }}>{t.category}</span>
                                                        </span>
                                                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
                                                            <span style={{ fontSize: 14, fontWeight: 900, color: MW.navy }}>{t.startingPrice.price === null ? '요금 등록 필요' : `1인 ${won(t.startingPrice.price)}부터`}</span>
                                                            {t.startingPrice.people !== null && <span style={{ fontSize: 12, color: MW.mute }}>{t.startingPrice.people}명 기준</span>}
                                                        </span>
                                                    </HoverButton>
                                                ))}
                                            </div>
                                        )}
                                        {hitArticles.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 12, borderTop: `1px solid ${MW.line}` }}>
                                                <span style={{ ...dropLabel, marginBottom: 4 }}>여행 가이드</span>
                                                {hitArticles.map((m) => (
                                                    <HoverButton
                                                        key={m.id}
                                                        onClick={() => { closeSearch(); navigate(`/travel-guide/${m.id}`); }}
                                                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, fontSize: 13, color: MW.navy }}
                                                    >
                                                        {m.category && (
                                                            <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintDeep, background: MW.mintTint, padding: '2px 8px', borderRadius: 999, flexShrink: 0 }}>{m.category}</span>
                                                        )}
                                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</span>
                                                    </HoverButton>
                                                ))}
                                            </div>
                                        )}
                                        {hitTours.length === 0 && hitArticles.length === 0 && (
                                            <p style={{ margin: 0, padding: '8px 10px', fontSize: 14, color: MW.mute }}>'{q}'에 대한 검색 결과가 없습니다.</p>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => search(q)}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, padding: '0 16px', border: 0, borderRadius: 12, background: MW.mintBg, fontSize: 14, fontWeight: 700, color: MW.mintDeep, cursor: 'pointer', fontFamily: 'inherit' }}
                                        >
                                            '{q}' 투어 검색<span>→</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => search(hot)}
                        className="mw-hide-narrow"
                        style={{ display: 'flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 0', flexShrink: 0, whiteSpace: 'nowrap' }}
                    >
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', color: MW.mintDeep, border: `1.5px solid ${MW.mint}`, borderRadius: 6, padding: '3px 6px' }}>HOT</span>
                        <span style={{ fontSize: 14, color: MW.ink3 }}>{hot}</span>
                    </button>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
                        <IconLink label="마이페이지" onClick={() => navigate('/mypage')}>
                            <circle cx="10" cy="8" r="4" />
                            <path d="M3 20c0-3.9 3.1-6.5 7-6.5" />
                            <path d="M15 15h6M15 18h6M15 21h6" />
                        </IconLink>
                        <IconLink label="예약 확인" onClick={() => navigate('/mypage/reservations')}>
                            <rect x="5" y="3" width="14" height="18" rx="2" />
                            <path d="M9 8h6M9 12h6M9 16h4" />
                        </IconLink>
                        <IconLink label="찜 목록" onClick={() => navigate('/mypage/wishlist')} badge={wishlist.count}>
                            <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
                        </IconLink>
                    </div>
                </div>
            </div>

            {/* Sticky nav */}
            <header
                style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 50,
                    background: 'rgba(255,255,255,0.97)',
                    backdropFilter: 'blur(8px)',
                    borderTop: `1px solid ${MW.line}`,
                    borderBottom: `1px solid ${MW.line}`,
                }}
            >
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'stretch', height: 56 }}>
                    <button
                        type="button"
                        onClick={() => setMenuOpen((v) => !v)}
                        aria-expanded={menuOpen}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '0 clamp(16px,2vw,28px) 0 0',
                            marginRight: 'clamp(16px,2vw,28px)',
                            border: 0,
                            borderRight: `1px solid ${MW.line}`,
                            background: 'transparent',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 15,
                            fontWeight: 700,
                            color: MW.navy,
                            flexShrink: 0,
                        }}
                    >
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 18 }}>
                            <span style={burgerLine} />
                            <span style={burgerLine} />
                            <span style={burgerLine} />
                        </span>
                        전체 메뉴
                    </button>
                    <nav style={{ display: 'flex', alignItems: 'stretch', gap: 'clamp(16px,2.2vw,28px)', fontSize: 15, flex: 1, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
                        {NAV_ITEMS.map((it) => {
                            const on = it.match(location.pathname);
                            const promo = it.id === 'promo';
                            return (
                                <a
                                    key={it.id}
                                    href={it.path}
                                    onClick={(e) => { e.preventDefault(); navigate(it.path); }}
                                    aria-current={on ? 'page' : undefined}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', textDecoration: 'none', color: promo && on ? MW.mintDeep : on || promo ? MW.navy : MW.ink3, fontWeight: on || promo ? 700 : 500 }}
                                >
                                    {it.label}
                                    {promo && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: MW.mint }} />}
                                </a>
                            );
                        })}
                    </nav>
                    <a
                        href="tel:+97695945838"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, paddingLeft: 20, whiteSpace: 'nowrap', fontSize: 14, fontWeight: 700, color: MW.navy, textDecoration: 'none' }}
                    >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: MW.mint }} />
                        +976 9594 5838
                    </a>
                </div>

                {menuOpen && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: '#fff', borderBottom: `1px solid ${MW.line}`, boxShadow: '0 20px 40px rgba(10,31,46,0.10)' }}>
                        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 36px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 32 }}>
                            {menu.map((g) => (
                                <div key={g.en} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>{g.en}</span>
                                    <span style={{ fontSize: 15, fontWeight: 900, color: MW.navy, marginBottom: 4 }}>{g.title}</span>
                                    {g.items.map((it) => (
                                        <HoverLink key={it.label} onClick={it.onClick} style={{ fontSize: 14, color: MW.ink3, textAlign: 'left' }} hoverColor={MW.mintDeep}>
                                            {it.label}
                                        </HoverLink>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </header>
        </>
    );
}

function HoverLink({
    children,
    onClick,
    style,
    hoverColor = MW.navy,
}: {
    children: ReactNode;
    onClick: () => void;
    style?: CSSProperties;
    hoverColor?: string;
}) {
    const base = style?.color || MW.mute;
    return (
        <button
            type="button"
            onClick={onClick}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: base, ...style }}
            onMouseEnter={(e) => (e.currentTarget.style.color = hoverColor)}
            onMouseLeave={(e) => (e.currentTarget.style.color = base)}
        >
            {children}
        </button>
    );
}

function HoverButton({ children, onClick, style }: { children: ReactNode; onClick: () => void; style?: CSSProperties }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', ...style }}
            onMouseEnter={(e) => (e.currentTarget.style.background = MW.mintBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
            {children}
        </button>
    );
}

function IconLink({ label, onClick, badge = 0, children }: { label: string; onClick: () => void; badge?: number; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 56, color: MW.navy, fontSize: 11, fontWeight: 500, background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = MW.mintDeep)}
            onMouseLeave={(e) => (e.currentTarget.style.color = MW.navy)}
        >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={MW.navy} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {children}
            </svg>
            {label}
            {badge > 0 && (
                <span
                    style={{
                        position: 'absolute',
                        top: -4,
                        right: 8,
                        minWidth: 18,
                        height: 18,
                        padding: '0 5px',
                        boxSizing: 'border-box',
                        borderRadius: 999,
                        background: MW.mint,
                        color: MW.navy,
                        fontSize: 10,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    {badge}
                </span>
            )}
        </button>
    );
}

const dropLabel: CSSProperties = { fontSize: 12, fontWeight: 700, color: MW.mute };
const burgerLine: CSSProperties = { height: 2, background: MW.navy, borderRadius: 1 };
