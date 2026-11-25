import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import logoMark from '../../assets/logo_horizontal.webp';
import { api } from '../../lib/api';
import { useUser } from '../../contexts/UserContext';
import { openKakaoConsultation } from '../../lib/consultation';
import { useWishlist } from '../../hooks/useWishlist';
import { useProductCategories } from '../../hooks/useProductCategories';
import { BRAND } from '../../constants/company';
import { isPublishedMagazine } from '../../constants/seo';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { SD, SD_BRAND_TEXT, SD_CONTAINER, SIcon } from '../site-seed/seed';
import { HOME_IMG, RECOMMENDED_WORDS, SEARCH_PLACEHOLDER } from '../home/homeContent';

const NAV_ITEMS: { id: string; label: string; path: string; match: (p: string) => boolean }[] = [
    { id: 'tours', label: '투어 상품', path: '/products', match: (p) => p === '/products' || p.startsWith('/category/') || p.startsWith('/products/') },
    { id: 'mates', label: '동행 찾기', path: '/travel-mates', match: (p) => p.startsWith('/travel-mates') },
    { id: 'reviews', label: '여행 후기', path: '/reviews', match: (p) => p.startsWith('/reviews') },
    { id: 'magazine', label: '여행 가이드', path: '/travel-guide', match: (p) => p.startsWith('/travel-guide') },
    { id: 'quote', label: '맞춤 견적', path: '/custom-estimate', match: (p) => p.startsWith('/custom-estimate') || p.startsWith('/estimate') },
];
/** 오른쪽 보조 메뉴(아이콘 + 글자). */
const SUB_NAV_ITEMS: { id: string; label: string; path: string; icon: string; match: (p: string) => boolean }[] = [
    { id: 'promo', label: '여행 기획전', path: '/promotions', icon: 'gift', match: (p) => p.startsWith('/promotions') },
    { id: 'support', label: '고객센터', path: '/faq', icon: 'headsetHelp', match: (p) => p.startsWith('/faq') },
];

const RECENT_KEY = 'mw_recent_searches';

interface SearchProduct {
    id: string;
    name: string;
    category: string;
    duration: string;
    price: number;
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
    const [searchTab, setSearchTab] = useState<'rec' | 'recent'>('rec');
    const [menuOpen, setMenuOpen] = useState(false);
    const { user } = useUser();

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
                    price: p.price || 0,
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

    const account = user ? { label: '마이페이지', path: '/mypage' } : { label: '로그인', path: '/login' };
    const rolling = [...RECOMMENDED_WORDS.slice(0, 5), RECOMMENDED_WORDS[0]];
    const tabButton = (on: boolean): CSSProperties => ({ height: 52, padding: '0 4px', border: 'none', borderBottom: `2px solid ${on ? SD.gray900 : 'transparent'}`, background: 'transparent',
        color: on ? SD.gray900 : SD.gray600, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' });

    return (
        <>
            {/* 윗줄: 이름 · 검색창 · 추천 검색어 · 알림/찜/로그인/예약 확인 (디자인 ‘홈’ 상단, 2026-11-25) */}
            <div style={{ background: SD.white }}>
                <div style={{ ...SD_CONTAINER, minHeight: 84, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 32px' }}>
                    <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} aria-label={`${BRAND.name} 홈`}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: SD.gray900, flexShrink: 0 }}>
                        <img src={logoMark} alt="" width={48} height={48} style={{ width: 48, height: 48, objectFit: 'contain', flex: 'none' }} />
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ ...SD_BRAND_TEXT, fontSize: 24 }}>몽골리아 <span style={{ color: SD.brandMint }}>은하수</span></span>
                            <span style={{ fontSize: 12, color: SD.gray600, whiteSpace: 'nowrap' }}>{BRAND.tagline}</span>
                        </span>
                    </a>

                    <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 400, minWidth: 180 }}>
                        <form onSubmit={onSubmit} role="search"
                            style={{ display: 'flex', alignItems: 'center', gap: 10, height: 46, padding: '0 6px 0 20px', borderRadius: 9999, background: SD.gray100, boxSizing: 'border-box' }}>
                            <input
                                ref={inputRef}
                                type="search"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onFocus={() => { window.clearTimeout(blurTimer.current); setFocused(true); }}
                                onBlur={() => { blurTimer.current = window.setTimeout(() => setFocused(false), 150); }}
                                onKeyDown={(e) => { if (e.key === 'Escape') closeSearch(); }}
                                placeholder={SEARCH_PLACEHOLDER}
                                aria-label="투어 검색"
                                aria-expanded={focused}
                                aria-controls="site-search-panel"
                                autoComplete="off"
                                style={{ flex: '1 1 auto', minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontFamily: 'inherit', color: SD.gray900 }}
                            />
                            <button type="submit" aria-label="검색"
                                style={{ width: 40, height: 40, border: 'none', background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                                <SIcon name="search" size={22} />
                            </button>
                        </form>

                        {focused && (
                            <div id="site-search-panel" onMouseDown={(e) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault(); }}
                                style={{ position: 'absolute', left: -8, top: 54, zIndex: 60, width: 560, maxWidth: 'calc(100vw - 32px)', background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 12,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)', overflow: 'hidden' }}>
                                {showIdle && (
                                    <>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', borderBottom: `1px solid ${SD.gray200}` }}>
                                            <div role="tablist" style={{ display: 'flex', gap: 24 }}>
                                                <button type="button" role="tab" aria-selected={searchTab === 'rec'} onClick={() => setSearchTab('rec')} style={tabButton(searchTab === 'rec')}>추천 검색어</button>
                                                <button type="button" role="tab" aria-selected={searchTab === 'recent'} onClick={() => setSearchTab('recent')} style={tabButton(searchTab === 'recent')}>최근 검색어</button>
                                            </div>
                                            <button type="button" aria-label="검색 패널 닫기" onClick={closeSearch}
                                                style={{ width: 44, height: 44, marginRight: -12, border: 'none', background: 'transparent', color: SD.gray600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                                <SIcon name="close" size={20} />
                                            </button>
                                        </div>
                                        <div style={{ padding: 24 }}>
                                            {searchTab === 'rec' ? (
                                                <>
                                                    <p style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: SD.gray900 }}>지금 떠나기 좋은 몽골 여행</p>
                                                    <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateRows: 'repeat(4, auto)', gridAutoFlow: 'column', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 24 }}>
                                                        {RECOMMENDED_WORDS.map((word, i) => (
                                                            <li key={word}>
                                                                <HoverButton onClick={() => search(word)} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 40, color: SD.gray900, fontSize: 15, borderRadius: 8, padding: '0 4px' }}>
                                                                    <span style={{ width: 14, fontSize: 15, fontWeight: 700 }}>{i + 1}</span>{word}
                                                                </HoverButton>
                                                            </li>
                                                        ))}
                                                    </ol>
                                                </>
                                            ) : recent.length === 0 ? (
                                                <p style={{ margin: 0, padding: '40px 0', textAlign: 'center', fontSize: 15, color: SD.gray600 }}>최근 검색어가 없어요</p>
                                            ) : (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                                        {recent.map((k) => (
                                                            <button key={k} type="button" onClick={() => search(k)}
                                                                style={{ height: 36, padding: '0 14px', borderRadius: 9999, border: `1px solid ${SD.gray200}`, background: SD.white, fontSize: 14, color: SD.gray900, cursor: 'pointer', fontFamily: 'inherit' }}>
                                                                {k}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button type="button" onClick={() => { setRecent([]); writeRecent([]); }}
                                                        style={{ alignSelf: 'flex-end', border: 0, background: 'transparent', fontSize: 13, color: SD.gray600, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline', textUnderlineOffset: 3 }}>
                                                        전체 삭제
                                                    </button>
                                                </div>
                                            )}
                                            <a href="/products?q=%EC%8A%B9%EB%A7%88" onClick={(e) => { e.preventDefault(); search('승마'); }}
                                                style={{ position: 'relative', display: 'block', marginTop: 20, height: 96, borderRadius: 12, overflow: 'hidden', textDecoration: 'none' }}>
                                                <img src={HOME_IMG.steppeGallop} alt="초원에서 말을 타고 달리는 여행자들" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                                <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 55%, rgba(0,0,0,0) 80%)' }} />
                                                <span style={{ position: 'absolute', left: 20, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4, color: SD.white }}>
                                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.9)' }}>초원질주여행</span>
                                                    <span style={{ fontSize: 18, fontWeight: 700 }}>몽골 승마 투어</span>
                                                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)' }}>대초원에서 승마 질주 여행</span>
                                                </span>
                                            </a>
                                        </div>
                                    </>
                                )}

                                {showResults && (
                                    <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '70vh', overflowY: 'auto' }}>
                                        {hitTours.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                <span style={{ ...dropLabel, marginBottom: 4 }}>투어</span>
                                                {hitTours.map((t) => (
                                                    <HoverButton key={t.id} onClick={() => { closeSearch(); navigate(`/products/${t.id}`); }} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12 }}>
                                                        <span style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0, background: isUsableImage(t.image) ? `center/cover url(${t.image})` : SD.gray100 }} />
                                                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                            <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                {t.duration ? `[${t.duration}] ` : ''}{t.name}
                                                            </span>
                                                            <span style={{ fontSize: 12, color: SD.gray600 }}>{t.category}</span>
                                                        </span>
                                                        <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900, flexShrink: 0 }}>{won(t.price)}~</span>
                                                    </HoverButton>
                                                ))}
                                            </div>
                                        )}
                                        {hitArticles.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 12, borderTop: `1px solid ${SD.gray200}` }}>
                                                <span style={{ ...dropLabel, marginBottom: 4 }}>여행 가이드</span>
                                                {hitArticles.map((m) => (
                                                    <HoverButton key={m.id} onClick={() => { closeSearch(); navigate(`/travel-guide/${m.id}`); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, fontSize: 13, color: SD.gray900 }}>
                                                        {m.category && <span style={{ fontSize: 11, fontWeight: 700, color: SD.mint700, background: SD.mint50, padding: '2px 8px', borderRadius: 9999, flexShrink: 0 }}>{m.category}</span>}
                                                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</span>
                                                    </HoverButton>
                                                ))}
                                            </div>
                                        )}
                                        {hitTours.length === 0 && hitArticles.length === 0 && (
                                            <p style={{ margin: 0, padding: '8px 10px', fontSize: 14, color: SD.gray600 }}>'{q}'에 대한 검색 결과가 없습니다.</p>
                                        )}
                                        <button type="button" onClick={() => search(q)}
                                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 48, padding: '0 16px', border: 0, borderRadius: 8, background: SD.gray100, color: SD.gray900, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                            '{q}' 투어 검색<SIcon name="arrowRight" size={16} stroke={2} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="mw-hide-narrow" style={{ flex: '0 1 220px', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontSize: 13, color: SD.gray600, whiteSpace: 'nowrap' }}>추천 검색어</span>
                        <button type="button" aria-label="추천 검색어 보기" onClick={() => inputRef.current?.focus()}
                            style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, height: 44, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}>
                            <span style={{ display: 'block', height: 24, overflow: 'hidden' }}>
                                <span className="home-kw-track" style={{ display: 'flex', flexDirection: 'column' }}>
                                    {rolling.map((word, i) => (
                                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, height: 24 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: SD.mint700 }}>{i % 5 === 0 ? 'HOT' : (i % 5) + 1}</span>
                                            <span style={{ fontSize: 14, color: SD.gray900, whiteSpace: 'nowrap' }}>{word}</span>
                                        </span>
                                    ))}
                                </span>
                            </span>
                            <span style={{ color: SD.gray500, display: 'flex' }}><SIcon name="chevronDown" size={18} /></span>
                        </button>
                    </div>

                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <IconLink label="알림" icon="bell" onClick={() => navigate('/mypage/notifications')} />
                        <IconLink label="찜 목록" icon="heart" onClick={() => navigate('/mypage/wishlist')} badge={wishlist.count} />
                        <IconLink label={account.label} icon="user" onClick={() => navigate(account.path)} />
                        <IconLink label="예약 확인" icon="calendarCheck" onClick={() => navigate('/mypage/reservations')} />
                    </div>
                </div>
            </div>

            {/* 메뉴 줄: 스크롤해도 위에 붙는다 */}
            <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${SD.gray200}` }}>
                <div style={{ ...SD_CONTAINER, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0 32px', minHeight: 56 }}>
                    <nav aria-label="주 메뉴" style={{ display: 'flex', alignItems: 'center', gap: '0 clamp(16px,2.6vw,36px)', minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
                        <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 10, height: 56, padding: 0, border: 'none', background: 'transparent', color: SD.mint700, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}>
                            <SIcon name="menu" size={24} stroke={2} />전체 메뉴
                        </button>
                        {NAV_ITEMS.map((it) => (
                            <a key={it.id} href={it.path} onClick={(e) => { e.preventDefault(); navigate(it.path); }} aria-current={it.match(location.pathname) ? 'page' : undefined} className="home-gnb" style={gnbLink}>
                                {it.label}
                            </a>
                        ))}
                    </nav>
                    <nav aria-label="보조 메뉴" style={{ display: 'flex', alignItems: 'center', gap: '0 28px', flexShrink: 0 }}>
                        {SUB_NAV_ITEMS.map((it) => (
                            <a key={it.id} href={it.path} onClick={(e) => { e.preventDefault(); navigate(it.path); }} aria-current={it.match(location.pathname) ? 'page' : undefined} className="home-gnb" style={{ ...gnbLink, gap: 6 }}>
                                <span style={{ display: 'flex', color: SD.mint700 }}><SIcon name={it.icon} size={20} stroke={1.7} /></span>
                                {it.label}
                                {it.id === 'promo' && <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: 9999, background: SD.mint500 }} />}
                            </a>
                        ))}
                    </nav>
                </div>

                {menuOpen && (
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', background: SD.white, borderBottom: `1px solid ${SD.gray200}`, boxShadow: '0 20px 40px rgba(0,0,0,0.10)' }}>
                        <div style={{ ...SD_CONTAINER, paddingTop: 32, paddingBottom: 36, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 32 }}>
                            {menu.map((g) => (
                                <div key={g.en} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900, marginBottom: 4 }}>{g.title}</span>
                                    {g.items.map((it) => (
                                        <HoverLink key={it.label} onClick={it.onClick} style={{ fontSize: 14, color: SD.gray700, textAlign: 'left' }} hoverColor={SD.mint700}>
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

function HoverLink({ children, onClick, style, hoverColor = SD.gray900 }: { children: ReactNode; onClick: () => void; style?: CSSProperties; hoverColor?: string }) {
    const base = style?.color || SD.gray600;
    return (
        <button type="button" onClick={onClick}
            style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: base, ...style }}
            onMouseEnter={(e) => (e.currentTarget.style.color = hoverColor)}
            onMouseLeave={(e) => (e.currentTarget.style.color = base)}>
            {children}
        </button>
    );
}

function HoverButton({ children, onClick, style }: { children: ReactNode; onClick: () => void; style?: CSSProperties }) {
    return (
        <button type="button" onClick={onClick}
            style={{ border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', ...style }}
            onMouseEnter={(e) => (e.currentTarget.style.background = SD.gray50)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            {children}
        </button>
    );
}

function IconLink({ label, icon, onClick, badge = 0 }: { label: string; icon: string; onClick: () => void; badge?: number }) {
    return (
        <button type="button" onClick={onClick}
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 56, color: SD.gray900, fontSize: 12, background: 'none', border: 0, padding: 0, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = SD.mint700)}
            onMouseLeave={(e) => (e.currentTarget.style.color = SD.gray900)}>
            <SIcon name={icon} size={26} stroke={1.5} />
            {label}
            {badge > 0 && (
                <span style={{ position: 'absolute', top: -4, right: 8, minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 9999, background: SD.mint400, color: SD.mint950, fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {badge}
                </span>
            )}
        </button>
    );
}

const dropLabel: CSSProperties = { fontSize: 12, fontWeight: 700, color: SD.gray600 };
const gnbLink: CSSProperties = { display: 'inline-flex', alignItems: 'center', height: 56, color: SD.gray900, fontSize: 16, fontWeight: 700, textDecoration: 'none', boxSizing: 'border-box', whiteSpace: 'nowrap', flexShrink: 0 };
