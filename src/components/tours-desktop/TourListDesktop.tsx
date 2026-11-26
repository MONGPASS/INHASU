import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import { useHomeData } from '../../hooks/useHomeData';
import { useHomeSettings } from '../../hooks/useHomeSettings';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { BenefitBandDesktop } from '../home-desktop/BenefitBand.desktop';
import { MagazineCardsDesktop } from '../home-desktop/MagazineCards.desktop';
import { HeartButton } from '../home-desktop/TourCard.desktop';
import { categoryCircleImage, discountPct, inCategory, isPublished, useHomeReviews, type HomeProduct } from '../home-desktop/homeDesktopData';
import { SD, SD_CONTAINER, SIcon } from '../site-seed/seed';
import { durationLabel } from '../tours-mobile/tourListFilters';
import { TourTypeBadge } from './TourTypeBadge';
import { TOUR_STAY, tourQuotePath } from './tourTypes';

type Sort = 'rec' | 'low' | 'high' | 'rating' | 'reviews';
type TripKey = '' | 'value' | 'full';

/** 상품 구분(관리자에서 정한 여행 타입 packageType). */
const TRIP_TYPES = [
    { key: 'value', label: '실속형' },
    { key: 'full', label: '풀패키지' },
] as const;
const TYPE_OPTIONS: { key: TripKey; label: string }[] = [{ key: '', label: '전체' }, ...TRIP_TYPES];

const SORTS: { key: Sort; label: string }[] = [
    { key: 'rec', label: '추천순' },
    { key: 'low', label: '낮은 가격순' },
    { key: 'high', label: '높은 가격순' },
    { key: 'rating', label: '평점 높은 순' },
    { key: 'reviews', label: '후기 많은 순' },
];

/** 지역 동그라미: 180px, 사이 40px. 다섯 개보다 많으면 양옆 화살표로 넘긴다. */
const CIRCLE = 180, CIRCLE_GAP = 40;
/** 아래로 내리면 위에 붙는 지역 줄의 높이. */
const STUCK_BAR = 64;

const rank = (p: HomeProduct) => Number(p.isPopular) * 2 + Number(p.isFeatured);

/**
 * PC 투어 상품 목록(Claude Design ‘투어 상품’, 2026-11-26).
 * 위에서부터 지역 동그라미(관리자 분류) · 상품 구분과 정렬 · 판매 BEST 4개 · 상품 목록 · 혜택 띠 · 매거진.
 * 지역 동그라미가 화면 위로 지나가면 지역·상품 구분·정렬을 담은 줄이 화면 맨 위에 붙는다.
 * 지역은 주소의 ?category=, 검색어는 ?q=(상단 검색창)로 받는다.
 */
export function TourListDesktop() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { data, isLoading } = useHomeData();
    const { settings, isPending: settingsPending } = useHomeSettings();
    const { stats } = useHomeReviews();
    const { categories, magazines } = data;
    const products = useMemo(() => data.products.filter(isPublished), [data.products]);

    const query = (params.get('q') || '').trim();
    const cat = params.get('category') || 'all';
    const [sort, setSort] = useState<Sort>('rec');
    const [type, setType] = useState<TripKey>('');

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    };

    const currentCat = categories.find((c) => c.id === cat);
    const selectedType = TRIP_TYPES.find((t) => t.key === type);

    // 지역·상품 구분만 맞춘 상품(판매 BEST와 목록이 같이 쓴다)
    const scoped = useMemo(
        () => products.filter((p) => (!currentCat || inCategory(p, currentCat)) && (!type || p.packageType === type)),
        [products, currentCat, type],
    );

    const items = useMemo(() => {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        const list = scoped.filter((p) => {
            if (!words.length) return true;
            // 기간은 DB 원본 표기와 한국어 표기("3박 4일", "3박4일")를 모두 검색 대상에 넣는다.
            const days = durationLabel(p.duration);
            const hay = `${p.name} ${p.tags.join(' ')} ${p.category} ${p.duration} ${days} ${days.replace(/\s+/g, '')}`.toLowerCase();
            return words.every((w) => hay.includes(w));
        });
        const sorters: Record<Sort, (a: HomeProduct, b: HomeProduct) => number> = {
            rec: (a, b) => rank(b) - rank(a),
            low: (a, b) => a.price - b.price,
            high: (a, b) => b.price - a.price,
            rating: (a, b) => (stats[b.id]?.avg ?? 0) - (stats[a.id]?.avg ?? 0) || (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0),
            reviews: (a, b) => (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0),
        };
        return [...list].sort(sorters[sort]);
    }, [scoped, query, sort, stats]);

    // 판매 BEST: 인기·추천 표시 → 후기 수 순으로 4개. 검색 중에는 숨긴다.
    const best = useMemo(
        () => [...scoped].sort((a, b) => rank(b) - rank(a) || (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0)).slice(0, 4),
        [scoped, stats],
    );
    const suggest = useMemo(() => [...products].sort((a, b) => rank(b) - rank(a)).slice(0, 3), [products]);

    const regions = [
        { id: 'all', label: '전체', img: products.find((p) => isUsableImage(p.mainImages[0]))?.mainImages[0] || '' },
        ...categories.map((c) => ({
            id: c.id,
            label: c.name,
            img: categoryCircleImage(c) || products.find((p) => inCategory(p, c) && isUsableImage(p.mainImages[0]))?.mainImages[0] || '',
        })),
    ];
    const regionId = currentCat ? cat : 'all';
    const pickRegion = (id: string) => setParam('category', id === 'all' ? '' : id);

    const regionName = currentCat?.name || '';
    const bestTitle = regionName ? `${regionName} 판매 BEST` : '몽골 인기 상품 BEST';
    const listTitle = query ? `‘${query}’ 검색 결과` : regionName || '몽골 전체 여행';
    const emptyTitle = query
        ? `‘${query}’에 맞는 투어를 찾지 못했어요`
        : `${[regionName, selectedType?.label].filter(Boolean).join(' ') || '이 조건의'} 투어를 준비하고 있어요`;
    const quotePath = tourQuotePath(type);

    const showAll = () => {
        setType('');
        setParams({}, { replace: true });
    };

    // 지역 동그라미 구역이 화면 위로 지나가면 위에 붙는 줄을 보인다.
    const filterRef = useRef<HTMLElement>(null);
    const [stuck, setStuck] = useState(false);
    useEffect(() => {
        const onScroll = () => {
            const el = filterRef.current;
            if (el) setStuck(el.getBoundingClientRect().bottom < 0);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const loaded = !isLoading;

    return (
        <>
            {stuck && (
                <StuckBar regions={regions} regionId={regionId} onRegion={pickRegion} type={type} onType={setType} sort={sort} onSort={setSort} />
            )}

            <div style={{ ...SD_CONTAINER, paddingTop: 32, paddingBottom: 16, display: 'flex', flexDirection: 'column', gap: 32 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <nav aria-label="현재 위치" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: SD.gray600 }}>
                        <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ color: SD.gray600, textDecoration: 'none' }}>홈</a>
                        <span aria-hidden="true">/</span>
                        <span style={{ color: SD.gray900 }}>투어 상품</span>
                    </nav>
                    <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, lineHeight: 1.3, color: SD.gray900 }}>몽골 투어 상품</h1>
                </div>

                <RegionCircles regions={regions} regionId={regionId} onRegion={pickRegion} />

                <section ref={filterRef} aria-label="투어 찾기" style={{ border: `1px solid ${SD.gray200}`, borderRadius: 16, padding: '8px 24px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px 16px', padding: '14px 0' }}>
                        <span style={{ flex: 'none', width: 72, fontSize: 14, fontWeight: 700, color: SD.gray900 }}>상품 구분</span>
                        <div style={{ flex: '1 1 auto' }}>
                            <TypePills type={type} onType={setType} />
                        </div>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 700, color: SD.gray900 }}>
                            정렬
                            <SortSelect sort={sort} onSort={setSort} />
                        </label>
                    </div>
                </section>

                {loaded && !query && best.length > 0 && (
                    <section aria-label="판매 BEST" style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '8px 0 16px' }}>
                        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: SD.gray900 }}>{bestTitle}</h2>
                        <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 500px), 1fr))', gap: '28px 40px' }}>
                            {best.map((p, i) => (
                                <li key={p.id}><BestCard p={p} rankNo={i + 1} /></li>
                            ))}
                        </ol>
                    </section>
                )}

                <section aria-label="투어 목록" style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 700, lineHeight: 1.35, color: SD.gray900 }}>
                            {listTitle}
                            {loaded && (
                                <span style={{ height: 26, padding: '0 10px', display: 'inline-flex', alignItems: 'center', borderRadius: 9999, background: SD.gray100, color: SD.gray600, fontSize: 13, fontWeight: 700 }}>
                                    {items.length}개
                                </span>
                            )}
                        </h2>
                        {query && (
                            <button type="button" onClick={() => setParam('q', '')}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 44, padding: 0, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 14, color: SD.gray700, cursor: 'pointer' }}>
                                검색어 지우기<SIcon name="close" size={16} />
                            </button>
                        )}
                    </div>

                    {loaded && items.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: '40px 24px' }}>
                            {items.map((p) => (
                                <TourGridCard key={p.id} p={p} />
                            ))}
                        </div>
                    )}

                    {loaded && items.length === 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 40, padding: '24px 0 8px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 24, padding: 32, borderRadius: 16, background: SD.gray50 }}>
                                <span style={{ flex: 'none', width: 64, height: 64, borderRadius: 9999, background: SD.white, color: SD.gray700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <SIcon name="mapFold" size={28} stroke={1.6} />
                                </span>
                                <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: SD.gray900 }}>{emptyTitle}</p>
                                    <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: SD.gray600 }}>원하는 일정과 인원을 알려주시면 맞춤 일정을 짜 드려요. 견적은 무료예요.</p>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button type="button" onClick={showAll} style={{ ...BOX_BUTTON, background: SD.white, color: SD.gray900, border: `1px solid ${SD.gray300}` }}>전체 투어 보기</button>
                                    <a href={quotePath} onClick={(e) => { e.preventDefault(); navigate(quotePath); }} style={{ ...BOX_BUTTON, background: SD.mint700, color: SD.white }}>맞춤 견적 요청</a>
                                </div>
                            </div>
                            {suggest.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: SD.gray900 }}>이런 투어는 어떠세요?</p>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))', gap: 24 }}>
                                        {suggest.map((p) => <SuggestCard key={p.id} p={p} />)}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>

            {/* 혜택 배너를 모두 지웠으면 띠가 빠지므로 그 자리의 여백만 둔다 */}
            {!settingsPending && (settings.bands.length > 0 ? <BenefitBandDesktop bands={settings.bands} /> : <div aria-hidden="true" style={{ height: 96 }} />)}
            <div style={{ paddingTop: 80 }}>
                <MagazineCardsDesktop magazines={magazines} />
            </div>
        </>
    );
}

interface Region {
    id: string;
    label: string;
    img: string;
}

/** 지역 동그라미(사진 + 이름). 고른 지역은 민트 테두리. 넘칠 때만 양옆 화살표가 움직인다. */
function RegionCircles({ regions, regionId, onRegion }: { regions: Region[]; regionId: string; onRegion: (id: string) => void }) {
    const viewport = useRef<HTMLDivElement>(null);
    const [room, setRoom] = useState(0);
    const [step, setStep] = useState(0);
    const n = regions.length;

    useEffect(() => {
        const measure = () => {
            // 좌우 6px은 고른 동그라미의 바깥 테두리 자리
            const width = (viewport.current?.clientWidth || 0) - 12;
            setRoom(Math.max(0, n * CIRCLE + Math.max(0, n - 1) * CIRCLE_GAP - width));
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [n]);

    const shift = Math.min(step * (CIRCLE + CIRCLE_GAP), room);
    const maxStep = Math.ceil(room / (CIRCLE + CIRCLE_GAP));
    const arrows = room > 0;

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
            {arrows && <ArrowButton label="이전 지역" icon="chevronLeft" disabled={shift <= 0} onClick={() => setStep(Math.max(0, Math.min(step, maxStep) - 1))} />}
            <div ref={viewport} style={{ flex: '1 1 auto', minWidth: 0, overflow: 'hidden', padding: '8px 6px' }}>
                <div role="radiogroup" aria-label="여행 지역"
                    style={{ display: 'flex', justifyContent: arrows ? 'flex-start' : 'center', alignItems: 'flex-start', gap: CIRCLE_GAP, transform: `translateX(${-shift}px)`, transition: 'transform 0.35s ease' }}>
                    {regions.map((r) => {
                        const on = r.id === regionId;
                        return (
                            <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => onRegion(r.id)}
                                style={{ flex: 'none', position: 'relative', width: CIRCLE, height: CIRCLE, padding: 0, border: 'none', borderRadius: 9999, overflow: 'hidden', background: SD.gray200,
                                    fontFamily: 'inherit', cursor: 'pointer', outline: on ? `3px solid ${SD.mint400}` : '0 solid transparent', outlineOffset: 3 }}>
                                {isUsableImage(r.img) && (
                                    <ResponsiveProductImage src={r.img} sizes="180px" alt="" loading="lazy" decoding="async"
                                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                )}
                                <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${on ? 0.28 : 0.4})` }} />
                                <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 18px', textAlign: 'center', color: SD.white,
                                    textShadow: '0 1px 4px rgba(0,0,0,0.35)', fontSize: 20, fontWeight: 700, lineHeight: 1.25, wordBreak: 'keep-all' }}>
                                    {r.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>
            {arrows && <ArrowButton label="다음 지역" icon="chevronRight" disabled={shift >= room} onClick={() => setStep(Math.min(maxStep, step + 1))} />}
        </div>
    );
}

function ArrowButton({ label, icon, disabled, onClick }: { label: string; icon: string; disabled: boolean; onClick: () => void }) {
    return (
        <button type="button" aria-label={label} onClick={onClick} disabled={disabled}
            style={{ flex: 'none', width: 44, height: 44, borderRadius: 9999, border: `1px solid ${SD.gray200}`, background: SD.white, color: SD.gray900, display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: 0, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.3 : 1, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <SIcon name={icon} size={20} stroke={2} />
        </button>
    );
}

/** 화면 맨 위에 붙는 줄: 지역 글자 탭 · 상품 구분 · 정렬. */
function StuckBar({ regions, regionId, onRegion, type, onType, sort, onSort }: {
    regions: Region[]; regionId: string; onRegion: (id: string) => void; type: TripKey; onType: (t: TripKey) => void; sort: Sort; onSort: (s: Sort) => void;
}) {
    return (
        <nav aria-label="여행 지역 바로가기"
            style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60, background: SD.white, borderBottom: `1px solid ${SD.gray200}`, boxShadow: '0 2px 6px rgba(0,0,0,0.06)' }}>
            <div style={{ ...SD_CONTAINER, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'stretch', gap: 36, minWidth: 0, overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {regions.map((r) => {
                        const on = r.id === regionId;
                        return (
                            <button key={r.id} type="button" aria-pressed={on} onClick={() => onRegion(r.id)}
                                style={{ flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', height: STUCK_BAR, padding: '3px 4px 0', border: 'none',
                                    borderBottom: `3px solid ${on ? SD.mint500 : 'transparent'}`, background: 'transparent', fontFamily: 'inherit', fontSize: 16, lineHeight: 1,
                                    fontWeight: on ? 700 : 400, color: on ? SD.gray900 : SD.gray600, cursor: 'pointer', whiteSpace: 'nowrap', boxSizing: 'border-box' }}>
                                {r.label}
                            </button>
                        );
                    })}
                </div>
                <div style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <TypePills type={type} onType={onType} small />
                    <SortSelect sort={sort} onSort={onSort} small />
                </div>
            </div>
        </nav>
    );
}

function TypePills({ type, onType, small = false }: { type: TripKey; onType: (t: TripKey) => void; small?: boolean }) {
    return (
        <div role="radiogroup" aria-label="상품 구분" style={{ display: 'flex', gap: small ? 6 : 8 }}>
            {TYPE_OPTIONS.map((o) => {
                const on = o.key === type;
                return (
                    <button key={o.key || 'all'} type="button" role="radio" aria-checked={on} onClick={() => onType(o.key)}
                        style={{ height: small ? 36 : 40, padding: small ? '0 14px' : '0 18px', borderRadius: 9999, border: `1px solid ${on ? SD.gray900 : SD.gray200}`,
                            background: on ? SD.gray900 : SD.white, fontFamily: 'inherit', fontSize: small ? 13 : 14, fontWeight: on ? 700 : 400, color: on ? SD.white : SD.gray700,
                            cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {o.label}
                    </button>
                );
            })}
        </div>
    );
}

function SortSelect({ sort, onSort, small = false }: { sort: Sort; onSort: (s: Sort) => void; small?: boolean }) {
    const h = small ? 36 : 40;
    return (
        <select aria-label="정렬" value={sort} onChange={(e) => onSort(e.target.value as Sort)}
            style={{ height: h, padding: small ? '0 30px 0 12px' : '0 36px 0 14px', border: `1px solid ${SD.gray200}`, borderRadius: 9999, backgroundColor: SD.white,
                fontFamily: 'inherit', fontSize: small ? 13 : 14, color: SD.gray900, cursor: 'pointer', appearance: 'none',
                backgroundImage: `linear-gradient(45deg,transparent 50%,${SD.gray700} 50%),linear-gradient(135deg,${SD.gray700} 50%,transparent 50%)`,
                backgroundPosition: `calc(100% - ${small ? 17 : 20}px) ${h / 2 - 2}px,calc(100% - ${small ? 12 : 15}px) ${h / 2 - 2}px`, backgroundSize: '5px 5px', backgroundRepeat: 'no-repeat' }}>
            {SORTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
    );
}

function Price({ p, size }: { p: HomeProduct; size: number }) {
    const off = discountPct(p);
    return (
        <span style={{ fontSize: size, fontWeight: 700, color: SD.gray900 }}>
            {off > 0 && <span style={{ marginRight: 6, color: SD.red }}>{off}%</span>}
            {won(p.price)}<span style={{ fontSize: 14, fontWeight: 400, color: SD.gray600 }}> ~</span>
        </span>
    );
}

const productHref = (p: HomeProduct) => `/products/${p.id}`;

function useOpen(p: HomeProduct) {
    const navigate = useNavigate();
    const href = productHref(p);
    return { href, onClick: (e: MouseEvent) => { e.preventDefault(); navigate(href); } };
}

/** 판매 BEST 한 줄: 왼쪽 사진(순위 · 상품 구분) + 이름 · 해시태그 · 가격. */
function BestCard({ p, rankNo }: { p: HomeProduct; rankNo: number }) {
    const open = useOpen(p);
    const img = p.mainImages[0];
    const tags = [...new Set([p.category, durationLabel(p.duration), ...p.tags].filter(Boolean).map((t) => `#${t.replace(/\s+/g, '')}`))].slice(0, 5).join(' ');
    return (
        <a {...open} style={{ display: 'flex', gap: 20, alignItems: 'flex-start', minWidth: 0, color: SD.gray900, textDecoration: 'none' }}>
            <span style={{ position: 'relative', flex: 'none', width: 240, height: 170, borderRadius: 12, overflow: 'hidden', background: SD.gray100 }}>
                {isUsableImage(img) && (
                    <ResponsiveProductImage src={img} sizes="240px" alt={`${p.name} | ${p.category}`} loading="lazy" decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                <span style={{ position: 'absolute', left: 0, top: 0, width: 34, height: 34, borderRadius: '12px 0 12px 0', background: SD.gray900, color: SD.white, fontSize: 16, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {rankNo}<span style={HIDDEN}>위</span>
                </span>
                <TourTypeBadge type={p.packageType} style={{ left: 10, bottom: 10 }} />
            </span>
            <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
                <span style={{ ...CLAMP2, fontSize: 16, fontWeight: 700, lineHeight: 1.45 }}>{p.name}</span>
                {tags && <span style={{ ...CLAMP2, fontSize: 13, lineHeight: 1.5, color: SD.gray600 }}>{tags}</span>}
                <Price p={p} size={20} />
            </span>
        </a>
    );
}

/** 목록 카드: 4:3 사진(상품 구분 · 찜) · 지역 · 기간 · 이름(두 줄) · 숙박 · 가격. */
function TourGridCard({ p }: { p: HomeProduct }) {
    const open = useOpen(p);
    const img = p.mainImages[0];
    const stay = p.packageType ? `${TOUR_STAY[p.packageType]} 숙박` : '';
    return (
        <a {...open} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, color: SD.gray900, textDecoration: 'none' }}>
            <div style={{ position: 'relative', aspectRatio: '4 / 3', borderRadius: 12, overflow: 'hidden', background: SD.gray100 }}>
                {isUsableImage(img) && (
                    <ResponsiveProductImage src={img} sizes="(max-width: 700px) 50vw, 260px" alt={`${p.name} | ${p.category}`} loading="lazy" decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                <TourTypeBadge type={p.packageType} style={{ left: 12, top: 12 }} />
                <HeartButton product={p} inset={12} />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: SD.gray600 }}>{[p.category, durationLabel(p.duration)].filter(Boolean).join(' · ')}</p>
            <h3 style={{ ...CLAMP2, margin: 0, minHeight: 48, fontSize: 17, fontWeight: 700, lineHeight: 1.4 }}>{p.name}</h3>
            {stay && <p style={{ margin: 0, fontSize: 13, color: SD.gray700 }}>{stay}</p>}
            <p style={{ margin: '6px 0 0' }}><Price p={p} size={20} /></p>
        </a>
    );
}

/** 빈 목록 아래 ‘이런 투어는 어떠세요?’ 작은 카드. */
function SuggestCard({ p }: { p: HomeProduct }) {
    const open = useOpen(p);
    const img = p.mainImages[0];
    const type = TRIP_TYPES.find((t) => t.key === p.packageType)?.label || p.category;
    return (
        <a {...open} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 12, border: `1px solid ${SD.gray200}`, borderRadius: 12, minWidth: 0, color: SD.gray900, textDecoration: 'none' }}>
            <span style={{ flex: 'none', width: 72, height: 72, borderRadius: 8, overflow: 'hidden', background: SD.gray100 }}>
                {isUsableImage(img) && (
                    <ResponsiveProductImage src={img} sizes="72px" alt={`${p.name} | ${p.category}`} loading="lazy" decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
            </span>
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {type && <span style={{ fontSize: 12, color: SD.gray600 }}>{type}</span>}
                <span style={{ ...CLAMP2, fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}>{p.name}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{won(p.price)}~</span>
            </span>
        </a>
    );
}

const CLAMP2: CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
const HIDDEN: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };
const BOX_BUTTON: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 44, padding: '0 18px', borderRadius: 8, boxSizing: 'border-box',
    fontFamily: 'inherit', fontSize: 15, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer' };
