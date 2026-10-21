import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useHomeData } from '../../hooks/useHomeData';
import { useWishlist } from '../../hooks/useWishlist';
import { MW, MW_FONT_EN, isUsableImage } from '../desktop-primitives/mwTokens';
import { categoryImage, inCategory, isPublished, useHomeReviews } from '../home-desktop/homeDesktopData';
import { useMobileShell } from '../mobile/mobileShellContext';
import { D, M_HAIR } from '../mobile/mobileTheme';
import { Ico, MLoading, MPhoto } from '../mobile/mobileUi';
import { TourCardMobile } from './TourCardMobile';
import { TourFilterSheet } from './TourFilterSheet';
import { EMPTY_FILTERS, PERKS, SORT_OPTIONS, TRIP_TYPES, activeCount, durationOptions, matchFilters, matchQuery, sortTours, type Sort, type TourFilters } from './tourListFilters';

/**
 * Mobile tour list (Claude Design: "Milkyway Japan Mobile" — M Tours).
 * 여행지 (?category=), 여행 타입 (?type=) and the header search word (?q=) live in the URL;
 * the 필터 sheet's 일정 / 요금 / 혜택 and the sort order are page state.
 */
export function TourListMobile() {
    const [params, setParams] = useSearchParams();
    const { stickyTop } = useMobileShell();
    const { data, isLoading } = useHomeData();
    const { stats } = useHomeReviews();
    const wishlist = useWishlist();
    const { categories } = data;
    const products = useMemo(() => data.products.filter(isPublished), [data.products]);

    const query = (params.get('q') || '').trim();
    const cat = params.get('category') || 'all';
    const type = TRIP_TYPES.find((t) => t.key === params.get('type'))?.key ?? '';
    const [sort, setSort] = useState<Sort>('rec');
    const [filters, setFilters] = useState<TourFilters>(EMPTY_FILTERS);
    const [sheet, setSheet] = useState(false);

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    };

    const currentCat = categories.find((c) => c.id === cat);

    // Tours matching the page-level conditions; the sheet counts its options against these.
    const base = useMemo(
        () => products.filter((p) => (!currentCat || inCategory(p, currentCat)) && (!type || p.packageType === type) && matchQuery(p, query)),
        [products, currentCat, type, query],
    );
    const items = useMemo(() => sortTours(base.filter((p) => matchFilters(p, filters)), sort, stats), [base, filters, sort, stats]);

    const dayOptions = useMemo(() => durationOptions(products), [products]);
    const perks = useMemo(() => PERKS.filter((k) => products.some(k.test)), [products]);

    const dests = [
        { id: 'all', label: '전체', img: products.find((p) => p.mainImages[0])?.mainImages[0] || '' },
        ...categories.map((c) => ({
            id: c.id,
            label: c.name,
            img: categoryImage(c) || products.find((p) => inCategory(p, c) && p.mainImages[0])?.mainImages[0] || '',
        })),
    ];

    const active = activeCount(filters);
    const selectedType = TRIP_TYPES.find((t) => t.key === type);

    const reset = () => {
        setFilters(EMPTY_FILTERS);
        setParams({}, { replace: true });
    };

    return (
        <section style={{ padding: '16px 0 0' }}>
            <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep, marginTop: 10 }}>TOURS</span>
                <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.3 }}>몽골 투어 상품</h1>
                {/* Intro copy kept from the previous mobile page for search engines. */}
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: MW.mute }}>
                    몽골 승마 여행, 고비사막 투어, 테를지 국립공원, 홉스굴 호수 등 지역·테마별로 몽골 투어를 찾아보세요.
                </p>
                {query && (
                    <button type="button" onClick={() => setParam('q', '')} aria-label={`검색어 '${query}' 지우기`} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, maxWidth: '100%', height: 34, marginTop: 6, padding: '0 12px', border: 0, borderRadius: 999, background: MW.navy, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>
                        <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>검색: {query}</span>
                        <span style={{ color: MW.mintLight }}>×</span>
                    </button>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, padding: '20px 16px 0' }}>
                {TRIP_TYPES.map((t) => {
                    const on = type === t.key;
                    const full = t.key === 'full';
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setParam('type', on ? '' : t.key)}
                            aria-pressed={on}
                            style={{
                                position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, padding: '16px 10px', minWidth: 0, overflow: 'hidden', borderRadius: 18,
                                border: `1.5px solid ${on ? MW.navy : full ? MW.mintDeep : MW.mintTint}`,
                                background: full ? 'linear-gradient(160deg,#1C8571 0%,#27AB8F 50%,#3FC2A4 100%)' : 'linear-gradient(160deg,#F1FCF8 0%,#FFFFFF 100%)',
                                boxShadow: on ? '0 8px 20px rgba(10,31,46,0.14)' : 'none',
                                fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: full ? '#FFFFFF' : MW.navy,
                            }}
                        >
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>
                                몽골리아<span style={{ color: full ? '#FFFFFF' : MW.mint }}> 은하수</span>
                            </span>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 700, letterSpacing: '-0.01em', padding: '3px 8px', borderRadius: 999, background: full ? 'rgba(255,255,255,0.22)' : MW.mintTint, color: full ? '#FFFFFF' : MW.mintDeep }}>{t.en}</span>
                            <span style={{ fontSize: 14, fontWeight: 900, marginTop: 4 }}>{t.label}</span>
                            <span style={{ fontSize: 'clamp(8px,2.4vw,9.5px)', lineHeight: 1.5, fontWeight: 700, letterSpacing: '-0.04em', whiteSpace: 'nowrap', color: full ? MW.mintTint : MW.ink3 }}>{t.desc}</span>
                            {on && (
                                <span style={{ position: 'absolute', right: 10, top: 10, width: 20, height: 20, borderRadius: '50%', background: MW.navy, color: '#FFFFFF', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
                            )}
                        </button>
                    );
                })}
            </div>

            <div role="tablist" aria-label="여행지" data-noscroll="" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '16px 16px 2px' }}>
                {dests.map((d) => {
                    const on = d.id === (currentCat ? cat : 'all');
                    return (
                        <button
                            key={d.id}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            onClick={() => setParam('category', d.id === 'all' ? '' : d.id)}
                            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px 0 4px', borderRadius: 999, border: `1px solid ${on ? MW.navy : MW.line}`, background: on ? MW.navy : '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: on ? '#FFFFFF' : MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                            <span style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: MW.mintTint, pointerEvents: 'none' }}>
                                {isUsableImage(d.img) && <MPhoto src={d.img} sizes="48px" />}
                                {on && (
                                    <span style={{ position: 'absolute', inset: 0, background: 'rgba(10,31,46,0.45)', color: '#fff', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
                                )}
                            </span>
                            {d.label}
                        </button>
                    );
                })}
            </div>

            <div style={{ position: 'sticky', top: stickyTop, zIndex: 10, background: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 14, padding: '10px 16px', borderTop: `1px solid ${M_HAIR}`, borderBottom: `1px solid ${M_HAIR}` }}>
                <span style={{ fontSize: 13, color: MW.mute, whiteSpace: 'nowrap' }}>
                    <strong style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 600, color: MW.navy }}>{items.length}</strong>건의 투어
                </span>
                <div style={{ display: 'flex', gap: 8, minWidth: 0 }}>
                    <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', borderRadius: 999, border: `1px solid ${active ? MW.mint : MW.line}`, background: active ? MW.mintBg : '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <Ico d={D.filter} size={15} width={2} />
                        필터
                        {active > 0 && (
                            <span style={{ minWidth: 18, height: 18, borderRadius: 999, background: MW.mint, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{active}</span>
                        )}
                    </button>
                    <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="정렬" style={{ height: 38, minWidth: 0, padding: '0 10px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy }}>
                        {SORT_OPTIONS.map(([k, label]) => (
                            <option key={k} value={k}>{label}</option>
                        ))}
                    </select>
                </div>
            </div>

            {isLoading && <MLoading />}

            {!isLoading && items.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '24px 12px', padding: '18px 16px 0' }}>
                    {items.map((p, i) => (
                        <TourCardMobile key={p.id} p={p} eager={i < 4} fav={wishlist.has(p.id)} onFav={() => wishlist.toggle(p)} />
                    ))}
                </div>
            )}

            {!isLoading && items.length === 0 && (
                <div style={{ margin: '18px 16px 0', padding: '44px 20px', border: `1px dashed ${MW.line2}`, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>
                        {selectedType && products.every((p) => p.packageType !== type)
                            ? `'${selectedType.label}' 투어는 준비 중입니다`
                            : '조건에 맞는 투어를 찾지 못했습니다'}
                    </span>
                    <button type="button" onClick={reset} style={{ height: 44, padding: '0 20px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>조건 초기화</button>
                </div>
            )}

            {sheet && (
                <TourFilterSheet
                    base={base}
                    count={items.length}
                    filters={filters}
                    dayOptions={dayOptions}
                    perks={perks}
                    onChange={setFilters}
                    onClose={() => setSheet(false)}
                />
            )}
        </section>
    );
}
