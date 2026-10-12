import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotImages } from '../../hooks/useSpotImages';
import { MW, MW_FONT_EN, MW_GRADIENT, cleanTitle, isUsableImage } from '../desktop-primitives/mwTokens';
import { ALL, KEYWORDS, categoryLabel, categoryTabs, queryNeedles } from '../magazine/magazineShared';

export interface MagazineListItem {
    id: string;
    title: string;
    description: string;
    category: string;
    image: string;
    isFeatured?: boolean;
}

interface Props {
    magazines: MagazineListItem[];
    categories: string[];
}

export function MagazineListDesktop({ magazines, categories }: Props) {
    const navigate = useNavigate();
    const { pick } = useSpotImages();
    const [cat, setCat] = useState(ALL);
    const [query, setQuery] = useState('');

    const q = query.trim();
    const needles = queryNeedles(q);
    const list = magazines.filter((m) => {
        if (cat !== ALL && categoryLabel(m.category) !== cat) return false;
        const text = `${m.title} ${m.description}`;
        return !q || text.includes(q) || needles.some((n) => text.toLowerCase().includes(n));
    });
    // Admin-featured article leads the page when it is in the current result set.
    const featureIdx = Math.max(0, list.findIndex((m) => m.isFeatured));
    const feature = list[featureIdx];
    const rest = list.filter((_, i) => i !== featureIdx);
    const heroImage = pick(['テレルジ', '테를지'], 1) || pick(['大草原', '대초원']);
    const open = (id: string) => navigate(`/travel-guide/${id}`);

    const tabs = [ALL, ...categoryTabs(categories)].map((label) => ({
        label,
        count: label === ALL ? magazines.length : magazines.filter((m) => categoryLabel(m.category) === label).length,
    }));

    return (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 104px', display: 'flex', flexDirection: 'column', gap: 48 }}>
            <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 13, color: MW.mute }}>
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ color: MW.mute, textDecoration: 'none' }}>홈</a>
                <span>›</span>
                <span style={{ color: MW.navy, fontWeight: 700 }}>여행 가이드</span>
            </nav>

            <div style={{ marginTop: -24, borderRadius: 32, overflow: 'hidden', background: `linear-gradient(135deg,${MW.mintBg} 0%,#FFFFFF 60%)`, border: `1px solid ${MW.mintTint}`, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
                <div style={{ flex: '1 1 460px', minWidth: 0, padding: 'clamp(28px,5vw,56px)', display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center' }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>TRAVEL MAGAZINE</span>
                    <h1 style={{ margin: 0, fontSize: 'clamp(34px,4.4vw,52px)', fontWeight: 900, lineHeight: 1.2 }}>몽골 여행 가이드</h1>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: MW.mute, maxWidth: 520 }}>
                        몽골의 대자연, 유목 문화, 추천 명소 등 여행 전에 알아 두면 좋은 정보를 모아 소개합니다.
                    </p>
                    <label style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, height: 56, padding: '0 8px 0 22px', borderRadius: 999, background: '#fff', boxShadow: '0 8px 24px rgba(10,31,46,0.08)', border: `1px solid ${MW.line}`, maxWidth: 520 }}>
                        <span aria-hidden="true" style={{ width: 16, height: 16, border: `2px solid ${MW.mintDeep}`, borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0 }} />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="궁금한 여행 정보를 검색해 보세요"
                            aria-label="기사 검색"
                            style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', fontSize: 15, fontFamily: 'inherit', color: MW.navy, background: 'transparent' }}
                        />
                        {query && (
                            <button type="button" onClick={() => setQuery('')} aria-label="지우기" style={{ width: 40, height: 40, border: 0, borderRadius: '50%', background: MW.chip, color: MW.mute, fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>
                                ×
                            </button>
                        )}
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: MW.mute, marginRight: 4 }}>인기 키워드</span>
                        {KEYWORDS.map((k) => {
                            const on = q === k;
                            return (
                                <button
                                    key={k}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => { setQuery(on ? '' : k); setCat(ALL); }}
                                    style={{ height: 34, padding: '0 14px', borderRadius: 999, border: `1px solid ${on ? MW.mint : MW.mintTint}`, background: on ? MW.mintTint : '#FFFFFF', color: MW.mintDeep, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                                >
                                    #{k}
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div style={{ flex: '1 1 360px', minHeight: 280, position: 'relative' }}>
                    <div style={{ position: 'absolute', inset: 16, borderRadius: 24, overflow: 'hidden', background: MW.mintTint }}>
                        {isUsableImage(heroImage) && (
                            <img src={heroImage} alt="몽골의 대초원과 게르 | 몽골 여행 가이드" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        )}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, borderBottom: `1px solid ${MW.line}` }}>
                <div role="tablist" style={{ display: 'flex', gap: 28, overflowX: 'auto', scrollbarWidth: 'none', marginBottom: -1 }}>
                    {tabs.map((t) => {
                        const on = t.label === cat;
                        return (
                            <button
                                key={t.label}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                onClick={() => setCat(t.label)}
                                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 2px', border: 0, borderBottom: `3px solid ${on ? MW.mint : 'transparent'}`, background: 'transparent', fontFamily: 'inherit', fontSize: 15, fontWeight: on ? 700 : 500, color: on ? MW.navy : MW.mute, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                {t.label}
                                <span style={{ minWidth: 22, height: 22, padding: '0 7px', boxSizing: 'border-box', borderRadius: 999, background: on ? MW.mintTint : MW.chip, color: on ? MW.mintDeep : MW.mute2, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {t.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
                <span style={{ flexShrink: 0, fontSize: 13, color: MW.mute, paddingBottom: 16 }}>기사 {list.length}건</span>
            </div>

            {feature && (
                <a
                    href={`/travel-guide/${feature.id}`}
                    onClick={(e) => { e.preventDefault(); open(feature.id); }}
                    style={{ position: 'relative', display: 'block', minHeight: 'clamp(360px,40vw,480px)', borderRadius: 32, overflow: 'hidden', color: '#fff', background: MW.navySoft, marginTop: -16, textDecoration: 'none' }}
                >
                    {isUsableImage(feature.image) && (
                        <img src={feature.image} alt={cleanTitle(feature.title)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(90deg,rgba(10,31,46,0.85) 0%,rgba(10,31,46,0.45) 50%,rgba(10,31,46,0) 80%)' }} />
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, maxWidth: 600, padding: 'clamp(28px,4vw,48px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14, pointerEvents: 'none' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.navy, background: MW.mint, padding: '6px 12px', borderRadius: 999 }}>PICK UP</span>
                            {feature.category && <span style={{ fontSize: 12, fontWeight: 700, color: MW.navy, background: '#fff', padding: '5px 12px', borderRadius: 999 }}>{categoryLabel(feature.category)}</span>}
                        </div>
                        <h2 style={{ margin: 0, fontSize: 'clamp(24px,2.8vw,34px)', fontWeight: 900, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {cleanTitle(feature.title)}
                        </h2>
                        {feature.description && (
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: '#DDE6EC', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{feature.description}</p>
                        )}
                        <span style={{ marginTop: 6, alignSelf: 'flex-start', fontSize: 14, fontWeight: 700, color: MW.navy, background: MW_GRADIENT, padding: '11px 22px', borderRadius: 999 }}>계속 읽기 →</span>
                    </div>
                </a>
            )}

            {rest.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,260px),1fr))', gap: '44px 24px' }}>
                    {rest.map((m) => (
                        <ArticleCard key={m.id} m={m} onOpen={() => open(m.id)} showMore />
                    ))}
                </div>
            )}

            {list.length === 0 && (
                <div style={{ borderRadius: 28, background: `linear-gradient(135deg,${MW.mintBg},#FFFFFF)`, border: `1px solid ${MW.mintTint}`, padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: MW.navy }}>조건에 맞는 기사를 찾지 못했습니다.</p>
                    <button
                        type="button"
                        onClick={() => { setCat(ALL); setQuery(''); }}
                        style={{ height: 44, padding: '0 22px', border: `1.5px solid ${MW.mint}`, borderRadius: 999, background: '#fff', fontSize: 14, fontWeight: 700, color: MW.mintDeep, cursor: 'pointer', fontFamily: 'inherit' }}
                    >
                        전체 기사 보기 →
                    </button>
                </div>
            )}
        </section>
    );
}

/** Magazine card used by the list page and the article page's "다른 기사". */
export function ArticleCard({ m, onOpen, showMore = false }: { m: MagazineListItem; onOpen: () => void; showMore?: boolean }) {
    const title = cleanTitle(m.title);
    return (
        <a
            href={`/travel-guide/${m.id}`}
            onClick={(e) => { e.preventDefault(); onOpen(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 14, color: MW.navy, transition: 'transform .2s', textDecoration: 'none' }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
        >
            <div style={{ position: 'relative', aspectRatio: '4/3', borderRadius: 22, overflow: 'hidden', background: MW.mintTint }}>
                {isUsableImage(m.image) && (
                    <img src={m.image} alt={`${title} | 몽골 여행 가이드`} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                {m.category && (
                    <span style={{ position: 'absolute', left: 12, top: 12, fontSize: 11, fontWeight: 700, color: MW.navy, background: '#fff', padding: '4px 10px', borderRadius: 999 }}>{categoryLabel(m.category)}</span>
                )}
            </div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, lineHeight: 1.5, height: '3em', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{title}</h3>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, height: '3.4em', color: MW.mute, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{m.description}</p>
            {showMore && <span style={{ fontSize: 13, fontWeight: 700, color: MW.mintDeep }}>계속 읽기 →</span>}
        </a>
    );
}
