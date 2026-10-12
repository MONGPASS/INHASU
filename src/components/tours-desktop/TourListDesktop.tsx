import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useHomeData } from '../../hooks/useHomeData';
import { MW, MW_FONT_EN, MW_GRADIENT, isUsableImage } from '../desktop-primitives/mwTokens';
import { categoryImage, inCategory, isPublished, useHomeReviews, type HomeProduct } from '../home-desktop/homeDesktopData';
import { durationLabel } from '../tours-mobile/tourListFilters';
import { TourCardDesktop } from './TourCardDesktop';

type Sort = 'rec' | 'low' | 'high' | 'rating' | 'reviews';

/**
 * Trip-type cards, driven by each tour's 여행 타입 set in the admin (packageType).
 * They always filter; a type with no tours yet shows the empty state, whose quote
 * button carries that type's stays (?stay=).
 * `stays`는 견적 폼(estimate-desktop/quoteForm.ts의 ACCOMMODATIONS) 값과 일치해야 선택된다.
 * 견적 폼이 일본어 값·한국어 값 어느 쪽이어도 맞도록 두 표기를 함께 보낸다(모르는 값은 견적 폼이 버린다).
 */
const TRIP_TYPES = [
    { key: 'full', label: '풀패키지 여행', sub: '4성급 호텔 + 디럭스 게르 숙박', tier: 'PREMIUM', stays: ['4성급 호텔', '디럭스 게르', '4つ星ホテル', 'デラックスゲル'], dark: true },
    { key: 'value', label: '가성비 여행', sub: '3성급 호텔 + 스탠다드 게르 숙박', tier: 'STANDARD', stays: ['3성급 호텔', '스탠다드 게르', '3つ星ホテル', 'スタンダードゲル'], dark: false },
];

export function TourListDesktop() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const { data, isLoading } = useHomeData();
    const { stats } = useHomeReviews();
    const { categories } = data;
    const products = useMemo(() => data.products.filter(isPublished), [data.products]);

    const query = (params.get('q') || '').trim();
    const cat = params.get('category') || 'all';
    const [sort, setSort] = useState<Sort>('rec');
    const [type, setType] = useState('');

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(params);
        if (value) next.set(key, value);
        else next.delete(key);
        setParams(next, { replace: true });
    };

    const currentCat = categories.find((c) => c.id === cat);

    const items = useMemo(() => {
        const words = query.toLowerCase().split(/[\s\u3000]+/).filter(Boolean);
        const tripType = TRIP_TYPES.find((t) => t.key === type);
        const list = products.filter((p) => {
            if (currentCat && !inCategory(p, currentCat)) return false;
            if (tripType && p.packageType !== tripType.key) return false;
            if (words.length) {
                // 기간은 DB 원본 표기와 한국어 표기("3박 4일", "3박4일")를 모두 검색 대상에 넣는다.
                const days = durationLabel(p.duration);
                const hay = `${p.name} ${p.tags.join(' ')} ${p.category} ${p.duration} ${days} ${days.replace(/\s+/g, '')}`.toLowerCase();
                if (!words.every((w) => hay.includes(w))) return false;
            }
            return true;
        });
        const rank = (p: HomeProduct) => Number(p.isPopular) * 2 + Number(p.isFeatured);
        const sorters: Record<Sort, (a: HomeProduct, b: HomeProduct) => number> = {
            rec: (a, b) => rank(b) - rank(a),
            low: (a, b) => a.price - b.price,
            high: (a, b) => b.price - a.price,
            rating: (a, b) => (stats[b.id]?.avg ?? 0) - (stats[a.id]?.avg ?? 0) || (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0),
            reviews: (a, b) => (stats[b.id]?.count ?? 0) - (stats[a.id]?.count ?? 0),
        };
        return [...list].sort(sorters[sort]);
    }, [products, currentCat, type, query, sort, stats]);

    const dests = [
        { id: 'all', label: '전체', img: products.find((p) => p.mainImages[0])?.mainImages[0] || '' },
        ...categories.map((c) => ({
            id: c.id,
            label: c.name,
            img: categoryImage(c) || products.find((p) => inCategory(p, c) && p.mainImages[0])?.mainImages[0] || '',
        })),
    ];

    const selectedType = TRIP_TYPES.find((t) => t.key === type);
    const quotePath = selectedType ? `/custom-estimate?stay=${encodeURIComponent(selectedType.stays.join(','))}` : '/custom-estimate';

    const reset = () => {
        setType('');
        setParams({}, { replace: true });
    };

    return (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 104px', display: 'flex', flexDirection: 'column', gap: 40 }}>
            <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 13, color: MW.mute }}>
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ color: MW.mute, textDecoration: 'none' }}>홈</a>
                <span>›</span>
                <span style={{ color: MW.navy, fontWeight: 700 }}>투어 상품</span>
            </nav>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: -8 }}>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>TOURS</span>
                <h1 style={{ margin: 0, fontSize: 'clamp(32px,4.2vw,48px)', fontWeight: 900, lineHeight: 1.2 }}>몽골 투어 상품</h1>
                <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: MW.mute, maxWidth: 640 }}>
                    한국어 가이드 동행, 게르 숙박·유목민 문화 체험이 포함된 몽골 투어. 테마와 일정에 맞춰 골라 보세요.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 16 }}>
                {TRIP_TYPES.map((t) => {
                    const on = type === t.key;
                    return (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setType(on ? '' : t.key)}
                            aria-pressed={on}
                            style={{
                                position: 'relative',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 16,
                                height: 96,
                                padding: '0 28px',
                                borderRadius: 18,
                                border: `2px solid ${on ? (t.dark ? MW.navy : MW.mint) : t.dark ? 'transparent' : MW.mintTint}`,
                                background: t.dark ? 'linear-gradient(180deg,#1C8571 0%,#27AB8F 45%,#3FC2A4 100%)' : 'linear-gradient(180deg,#F1FCF8 0%,#FFFFFF 100%)',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                textAlign: 'left',
                                boxShadow: on ? '0 10px 24px rgba(39,171,143,0.28)' : '0 2px 10px rgba(10,31,46,0.06)',
                                transition: 'border-color .15s,box-shadow .15s',
                            }}
                        >
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em', color: t.dark ? '#FFFFFF' : MW.navy }}>
                                    몽골리아<span style={{ color: t.dark ? '#A3ECD6' : MW.mintDeep }}> 은하수</span>
                                </span>
                                <span style={{ alignSelf: 'flex-start', fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: t.dark ? '#FFFFFF' : MW.mintDeep, background: t.dark ? 'rgba(255,255,255,0.18)' : MW.mintTint, padding: '3px 8px', borderRadius: 999 }}>
                                    {t.tier}
                                </span>
                            </span>
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 900, color: t.dark ? '#FFFFFF' : MW.navy }}>
                                    {t.label}
                                    <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: '50%', background: on ? (t.dark ? '#FFFFFF' : MW.mintDeep) : 'transparent', color: t.dark ? MW.mintDeep : '#FFFFFF', fontSize: 11, fontWeight: 900, lineHeight: '20px', textAlign: 'center' }}>
                                        {on ? '✓' : ''}
                                    </span>
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: t.dark ? MW.mintTint : MW.ink3 }}>{t.sub}</span>
                            </span>
                        </button>
                    );
                })}
            </div>

            <div role="tablist" aria-label="여행지" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollbarWidth: 'none', padding: '4px 2px', margin: '-8px -2px 0' }}>
                {dests.map((d) => {
                    const on = d.id === (currentCat ? cat : 'all');
                    return (
                        <button
                            key={d.id}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            onClick={() => setParam('category', d.id === 'all' ? '' : d.id)}
                            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 20px 0 6px', borderRadius: 999, border: `1.5px solid ${on ? MW.navy : MW.line}`, background: on ? MW.navy : '#FFFFFF', color: on ? '#FFFFFF' : MW.navy, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .15s' }}
                        >
                            <span style={{ position: 'relative', width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: MW.mintTint }}>
                                {isUsableImage(d.img) && <img src={d.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                {on && (
                                    <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(10,31,46,0.45)', color: '#fff', fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>
                                )}
                            </span>
                            {d.label}
                        </button>
                    );
                })}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', paddingBottom: 16, borderBottom: `1px solid ${MW.line}` }}>
                    <span style={{ fontSize: 15, color: MW.mute }}>
                        <strong style={{ fontSize: 20, fontWeight: 900, color: MW.navy }}>{items.length}</strong>건의 투어
                    </span>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: MW.mute }}>
                        정렬
                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value as Sort)}
                            style={{ height: 44, padding: '0 36px 0 16px', border: `1.5px solid ${MW.line2}`, borderRadius: 999, background: '#fff', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer', appearance: 'none', fontFamily: 'inherit', backgroundImage: `linear-gradient(45deg,transparent 50%,${MW.navy} 50%),linear-gradient(135deg,${MW.navy} 50%,transparent 50%)`, backgroundPosition: 'calc(100% - 20px) 19px,calc(100% - 15px) 19px', backgroundSize: '5px 5px', backgroundRepeat: 'no-repeat' }}
                        >
                            <option value="rec">추천순</option>
                            <option value="low">낮은 가격순</option>
                            <option value="high">높은 가격순</option>
                            <option value="rating">평점 높은 순</option>
                            <option value="reviews">후기 많은 순</option>
                        </select>
                    </label>
                </div>

                {query && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: -8, fontSize: 14, color: MW.mute }}>
                        <span>'<strong style={{ color: MW.navy }}>{query}</strong>' 검색 결과</span>
                        <button type="button" onClick={() => setParam('q', '')} style={chipBtn}>지우기 ×</button>
                    </div>
                )}
                {type && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: -8 }}>
                        <button type="button" onClick={() => setType('')} style={chipBtn}>
                            {TRIP_TYPES.find((t) => t.key === type)?.label} ×
                        </button>
                    </div>
                )}

                {!isLoading && items.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,250px),1fr))', gap: '40px 20px' }}>
                        {items.map((p) => (
                            <TourCardDesktop key={p.id} p={p} />
                        ))}
                    </div>
                )}

                {!isLoading && items.length === 0 && (
                    <div style={{ borderRadius: 28, background: `linear-gradient(135deg,${MW.mintBg},#FFFFFF)`, border: `1px solid ${MW.mintTint}`, padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: MW.navy }}>
                            {selectedType && products.every((p) => p.packageType !== type)
                                ? `'${selectedType.label}' 투어는 준비 중입니다.`
                                : '조건에 맞는 투어를 찾지 못했습니다.'}
                        </p>
                        <p style={{ margin: 0, fontSize: 14, color: MW.mute }}>원하시는 조건에 맞춘 플랜은 맞춤 견적으로 상담해 주세요.</p>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
                            <button type="button" onClick={reset} style={{ height: 44, padding: '0 22px', border: `1.5px solid ${MW.mint}`, borderRadius: 999, background: '#fff', fontSize: 14, fontWeight: 700, color: MW.mintDeep, cursor: 'pointer', fontFamily: 'inherit' }}>
                                조건 초기화
                            </button>
                            <a
                                href={quotePath}
                                onClick={(e) => { e.preventDefault(); navigate(quotePath); }}
                                style={{ display: 'inline-flex', alignItems: 'center', height: 44, padding: '0 22px', borderRadius: 999, background: MW_GRADIENT, fontSize: 14, fontWeight: 700, color: MW.navy, textDecoration: 'none' }}
                            >
                                맞춤 견적
                            </a>
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}

const chipBtn = { border: 0, background: MW.mintTint, color: MW.mintDeep, fontSize: 12, fontWeight: 700, borderRadius: 999, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' } as const;
