import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHomeData } from '../../hooks/useHomeData';
import { useHomeSettings } from '../../hooks/useHomeSettings';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { HeartButton } from '../home-desktop/TourCard.desktop';
import { categoryImage, discountPct, inCategory, isPublished, useHomeReviews, type HomeProduct } from '../home-desktop/homeDesktopData';
import { ConnectSection } from '../home/ConnectSection';
import { BenefitBandMobile } from '../home-mobile/BenefitBand.mobile';
import { MagazineCardsMobile } from '../home-mobile/MagazineCards.mobile';
import { linkTo, useGo } from '../home-mobile/homeMobileData';
import { useMobileShell } from '../mobile/mobileShellContext';
import { MLoading, MPhoto } from '../mobile/mobileUi';
import { SD, SIcon } from '../site-seed/seed';
import { TourTypeBadge } from '../tours-desktop/TourTypeBadge';
import { TOUR_STAY, tourQuotePath } from '../tours-desktop/tourTypes';
import { SORT_OPTIONS, durationLabel, matchQuery, sortTours, type Sort } from './tourListFilters';

type TripKey = '' | 'value' | 'full';
const TYPE_OPTIONS: { key: TripKey; label: string }[] = [{ key: '', label: '전체' }, { key: 'value', label: '실속형' }, { key: 'full', label: '풀패키지' }];

const rank = (p: HomeProduct) => Number(p.isPopular) * 2 + Number(p.isFeatured);

/**
 * 휴대폰 투어 상품 목록(Claude Design ‘투어 상품 — 모바일’, 2026-11-26). 머리·메뉴 줄·바닥·하단 메뉴는 MobileShell이 그린다.
 * 제목 → 지역 칩(관리자 분류, 사진 동그라미) → 위에 붙는 상품 구분·정렬 줄 → 판매 BEST 3개 → 2열 목록 → 혜택 띠 · 매거진 · 문의(홈과 같은 부품).
 * 지역은 주소의 ?category=, 상품 구분은 ?type=(full·value), 검색어는 ?q=(머리 검색창)로 받는다.
 */
export function TourListMobile() {
    const [params, setParams] = useSearchParams();
    const go = useGo();
    const { stickyTop } = useMobileShell();
    const { data, isLoading } = useHomeData();
    const { settings, isPending: settingsPending } = useHomeSettings();
    const { stats } = useHomeReviews();
    const { categories, magazines } = data;
    const products = useMemo(() => data.products.filter(isPublished), [data.products]);

    const query = (params.get('q') || '').trim();
    const cat = params.get('category') || 'all';
    const rawType = params.get('type');
    const type: TripKey = rawType === 'full' || rawType === 'value' ? rawType : '';
    const [sort, setSort] = useState<Sort>('rec');

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    };

    const currentCat = categories.find((c) => c.id === cat);
    const scoped = useMemo(
        () => products.filter((p) => (!currentCat || inCategory(p, currentCat)) && (!type || p.packageType === type)),
        [products, currentCat, type],
    );
    const items = useMemo(() => sortTours(scoped.filter((p) => matchQuery(p, query)), sort, stats), [scoped, query, sort, stats]);
    // 판매 BEST: 인기·추천 표시 → 후기 수 순으로 3개. 검색 중에는 숨긴다.
    const best = useMemo(
        () => [...scoped].sort((a, b) => rank(b) - rank(a) || (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0)).slice(0, 3),
        [scoped, stats],
    );

    const regions = [
        { id: 'all', label: '전체', img: products.find((p) => isUsableImage(p.mainImages[0]))?.mainImages[0] || '' },
        ...categories.map((c) => ({
            id: c.id,
            label: c.name,
            img: categoryImage(c) || products.find((p) => inCategory(p, c) && isUsableImage(p.mainImages[0]))?.mainImages[0] || '',
        })),
    ];
    const regionId = currentCat ? cat : 'all';

    const regionName = currentCat?.name || '';
    const typeName = TYPE_OPTIONS.find((o) => o.key === type && o.key)?.label || '';
    const bestTitle = regionName ? `${regionName} 판매 BEST` : '몽골 여행 판매 BEST';
    const listTitle = query ? `‘${query}’ 검색 결과` : regionName || '몽골 전체 여행';
    const emptyTitle = query ? `‘${query}’에 맞는 투어를 찾지 못했어요` : `${[regionName, typeName].filter(Boolean).join(' ') || '이 조건의'} 투어를 준비하고 있어요`;
    const quotePath = tourQuotePath(type);

    const loaded = !isLoading;
    const pickRegion = (id: string) => setParam('category', id === 'all' ? '' : id);

    // 지역 칩이 위에 붙는 줄 뒤로 지나가면, 그 줄 위쪽에 지역 글자 탭을 보인다(PC의 붙는 지역 줄과 같은 역할).
    const chipsRef = useRef<HTMLDivElement>(null);
    const [stuck, setStuck] = useState(false);
    useEffect(() => {
        const onScroll = () => {
            const el = chipsRef.current;
            if (el) setStuck(el.getBoundingClientRect().bottom < stickyTop);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [stickyTop]);

    return (
        <div style={{ background: SD.white, color: SD.gray900 }}>
            <div style={{ padding: '16px 20px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <nav aria-label="현재 위치" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: SD.gray600 }}>
                    <a {...linkTo(go, '/')} style={{ color: SD.gray600, textDecoration: 'none' }}>홈</a>
                    <span aria-hidden="true">/</span>
                    <span style={{ color: SD.gray900 }}>투어 상품</span>
                </nav>
                <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: SD.gray900 }}>몽골 투어 상품</h1>
            </div>

            <div ref={chipsRef} style={{ padding: '8px 0 4px' }}>
                <div role="radiogroup" aria-label="여행 지역" data-noscroll="" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 20px' }}>
                    {regions.map((r) => {
                        const on = r.id === regionId;
                        return (
                            <button key={r.id} type="button" role="radio" aria-checked={on} onClick={() => pickRegion(r.id)}
                                style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, height: 48, padding: '0 18px 0 4px', borderRadius: 9999, border: on ? `1.5px solid ${SD.gray900}` : `1px solid ${SD.gray200}`,
                                    background: SD.white, fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 400, color: SD.gray900, whiteSpace: 'nowrap', cursor: 'pointer', boxSizing: 'border-box' }}>
                                <span style={{ position: 'relative', width: 40, height: 40, borderRadius: 9999, overflow: 'hidden', flex: 'none', background: SD.gray100 }}>
                                    {isUsableImage(r.img) && <MPhoto src={r.img} sizes="48px" />}
                                </span>
                                <span>{r.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div style={{ position: 'sticky', top: stickyTop, zIndex: 8, background: SD.white, borderBottom: `1px solid ${SD.gray200}`, padding: stuck ? '0 0 12px' : '10px 0 12px' }}>
                {stuck && (
                    <nav aria-label="여행 지역 바로가기" data-noscroll="" style={{ display: 'flex', gap: 22, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 20px', marginBottom: 10, borderBottom: `1px solid ${SD.gray100}` }}>
                        {regions.map((r) => {
                            const on = r.id === regionId;
                            return (
                                <button key={r.id} type="button" aria-pressed={on} onClick={() => pickRegion(r.id)}
                                    style={{ flex: 'none', height: 44, padding: '2px 2px 0', border: 'none', borderBottom: `2px solid ${on ? SD.mint500 : 'transparent'}`, background: 'transparent', fontFamily: 'inherit',
                                        fontSize: 15, fontWeight: on ? 700 : 400, color: on ? SD.gray900 : SD.gray600, whiteSpace: 'nowrap', cursor: 'pointer', boxSizing: 'border-box' }}>
                                    {r.label}
                                </button>
                            );
                        })}
                    </nav>
                )}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '0 20px' }}>
                    <div role="radiogroup" aria-label="상품 구분" style={{ display: 'flex', gap: 6 }}>
                        {TYPE_OPTIONS.map((o) => {
                            const on = o.key === type;
                            return (
                                <button key={o.key || 'all'} type="button" role="radio" aria-checked={on} onClick={() => setParam('type', o.key)}
                                    style={{ height: 34, padding: '0 12px', borderRadius: 9999, border: `1px solid ${on ? SD.gray900 : SD.gray200}`, background: on ? SD.gray900 : SD.white, fontFamily: 'inherit',
                                        fontSize: 13, fontWeight: on ? 700 : 400, color: on ? SD.white : SD.gray700, whiteSpace: 'nowrap', cursor: 'pointer' }}>
                                    {o.label}
                                </button>
                            );
                        })}
                    </div>
                    <select aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as Sort)}
                        style={{ height: 34, minWidth: 0, padding: '0 26px 0 10px', border: `1px solid ${SD.gray200}`, borderRadius: 9999, backgroundColor: SD.white, fontFamily: 'inherit', fontSize: 13, color: SD.gray900,
                            appearance: 'none', backgroundImage: `linear-gradient(45deg,transparent 50%,${SD.gray700} 50%),linear-gradient(135deg,${SD.gray700} 50%,transparent 50%)`,
                            backgroundPosition: 'calc(100% - 15px) 15px,calc(100% - 10px) 15px', backgroundSize: '5px 5px', backgroundRepeat: 'no-repeat' }}>
                        {SORT_OPTIONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                    </select>
                </div>
            </div>

            {isLoading && <MLoading />}

            {loaded && !query && best.length > 0 && (
                <section aria-label="판매 BEST" style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <h2 style={{ margin: 0, padding: '0 20px', fontSize: 18, fontWeight: 700, color: SD.gray900 }}>{bestTitle}</h2>
                    <ol style={{ margin: 0, padding: '0 20px', listStyle: 'none', display: 'flex', flexDirection: 'column' }}>
                        {best.map((p, i) => (
                            <li key={p.id} style={{ borderBottom: `1px solid ${SD.gray100}` }}><BestRow p={p} rankNo={i + 1} /></li>
                        ))}
                    </ol>
                </section>
            )}

            {loaded && (
                <section aria-label="투어 목록" style={{ padding: '32px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <h2 style={{ margin: 0, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: SD.gray900 }}>
                            <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listTitle}</span>
                            <span style={{ flex: 'none', height: 22, padding: '0 8px', display: 'inline-flex', alignItems: 'center', borderRadius: 9999, background: SD.gray100, color: SD.gray600, fontSize: 12, fontWeight: 700 }}>
                                {items.length}개
                            </span>
                        </h2>
                        {query && (
                            <button type="button" onClick={() => setParam('q', '')} aria-label={`검색어 ‘${query}’ 지우기`}
                                style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 44, padding: 0, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: SD.gray700, cursor: 'pointer' }}>
                                지우기<SIcon name="close" size={14} />
                            </button>
                        )}
                    </div>

                    {items.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '24px 12px' }}>
                            {items.map((p) => <GridCard key={p.id} p={p} />)}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '28px 20px', borderRadius: 14, background: SD.gray50, textAlign: 'center' }}>
                            <span style={{ width: 52, height: 52, borderRadius: 9999, background: SD.white, color: SD.gray700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <SIcon name="mapFold" size={24} stroke={1.6} />
                            </span>
                            <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: SD.gray900, wordBreak: 'keep-all' }}>{emptyTitle}</p>
                            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: SD.gray600 }}>원하는 일정과 인원을 알려주시면<br />맞춤 일정을 짜 드려요. 견적은 무료예요.</p>
                            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                <button type="button" onClick={() => setParams({}, { replace: true })} style={{ ...SMALL_BUTTON, background: SD.white, color: SD.gray900, border: `1px solid ${SD.gray300}` }}>전체 투어 보기</button>
                                <a {...linkTo(go, quotePath)} style={{ ...SMALL_BUTTON, background: SD.mint700, color: SD.white }}>맞춤 견적 요청</a>
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* 혜택 배너를 모두 지웠으면 띠가 빠지므로 그 자리의 여백만 둔다 */}
            {!settingsPending && (settings.bands.length > 0 ? <BenefitBandMobile bands={settings.bands} /> : <div aria-hidden="true" style={{ height: 44 }} />)}
            <MagazineCardsMobile magazines={magazines} />
            <ConnectSection compact />
        </div>
    );
}

function Price({ p, size }: { p: HomeProduct; size: number }) {
    const off = discountPct(p);
    return (
        <span style={{ fontSize: size, fontWeight: 700, color: SD.gray900 }}>
            {off > 0 && <span style={{ marginRight: 5, color: SD.red }}>{off}%</span>}
            {won(p.price)}<span style={{ fontSize: 12, fontWeight: 400, color: SD.gray600 }}> ~</span>
        </span>
    );
}

/** 판매 BEST 한 줄: 128px 정사각 사진(순위 · 상품 구분) + 구분·기간 · 이름 · 숙박 · 가격. */
function BestRow({ p, rankNo }: { p: HomeProduct; rankNo: number }) {
    const go = useGo();
    const img = p.mainImages[0];
    const days = durationLabel(p.duration);
    const kind = p.packageType ? (p.packageType === 'full' ? '풀패키지' : '실속형') : p.category;
    return (
        <a {...linkTo(go, `/products/${p.id}`)} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px 0', color: SD.gray900, textDecoration: 'none' }}>
            <span style={{ position: 'relative', flex: 'none', width: 128, height: 128, borderRadius: 10, overflow: 'hidden', background: SD.gray100 }}>
                <MPhoto src={isUsableImage(img) ? img : undefined} alt={`${p.name} | ${p.category}`} sizes="128px" />
                <span style={{ position: 'absolute', left: 0, top: 0, width: 26, height: 26, borderRadius: '10px 0 10px 0', background: SD.gray900, color: SD.white, fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {rankNo}<span style={HIDDEN}>위</span>
                </span>
                <TourTypeBadge type={p.packageType} size="sm" style={{ left: 6, bottom: 6 }} />
            </span>
            <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, color: SD.gray600 }}>{[kind, days].filter(Boolean).join(' · ')}</span>
                <span style={{ ...CLAMP2, fontSize: 15, fontWeight: 700, lineHeight: 1.4 }}>{p.name}</span>
                {p.packageType && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: SD.gray700 }}>
                        <SIcon name="homeRoof" size={14} stroke={1.6} />{TOUR_STAY[p.packageType]}
                    </span>
                )}
                <span style={{ marginTop: 2 }}><Price p={p} size={17} /></span>
            </span>
        </a>
    );
}

/** 2열 목록 카드: 정사각 사진(상품 구분 · 찜) · 지역 · 기간 · 이름 두 줄 · 가격. */
function GridCard({ p }: { p: HomeProduct }) {
    const go = useGo();
    const img = p.mainImages[0];
    return (
        <a {...linkTo(go, `/products/${p.id}`)} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, color: SD.gray900, textDecoration: 'none' }}>
            <div style={{ position: 'relative', aspectRatio: '1 / 1', borderRadius: 10, overflow: 'hidden', background: SD.gray100 }}>
                <MPhoto src={isUsableImage(img) ? img : undefined} alt={`${p.name} | ${p.category}`} sizes="50vw" />
                <TourTypeBadge type={p.packageType} size="md" style={{ left: 8, top: 8 }} />
                <HeartButton product={p} inset={8} small />
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: SD.gray600 }}>{[p.category, durationLabel(p.duration)].filter(Boolean).join(' · ')}</p>
            <h3 style={{ ...CLAMP2, margin: 0, minHeight: 39, fontSize: 14, fontWeight: 700, lineHeight: 1.4, wordBreak: 'keep-all' }}>{p.name}</h3>
            <p style={{ margin: 0 }}><Price p={p} size={16} /></p>
        </a>
    );
}

const CLAMP2: CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
const HIDDEN: CSSProperties = { position: 'absolute', width: 1, height: 1, margin: -1, padding: 0, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 };
const SMALL_BUTTON: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 40, padding: '0 14px', borderRadius: 8, boxSizing: 'border-box',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', cursor: 'pointer' };
