import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MW, MW_FONT_EN, cleanTitle, isUsableImage } from '../desktop-primitives/mwTokens';
import { ALL, KEYWORDS, categoryLabel, categoryTabs, queryNeedles } from '../magazine/magazineShared';
import type { MagazineListItem } from '../magazine-desktop/MagazineListDesktop';
import { useMobileShell } from '../mobile/mobileShellContext';
import { M_HAIR } from '../mobile/mobileTheme';
import { MLoading, MPhoto } from '../mobile/mobileUi';
import { MagazineQuoteCta } from './MagazineQuoteCta';

interface Props {
    magazines: MagazineListItem[];
    categories: string[];
    loading?: boolean;
}

const CLAMP = (lines: number) => ({ display: '-webkit-box', WebkitLineClamp: lines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) as const;

/** Mobile 여행 가이드(매거진) list (Claude Design: "M Magazine"): search, keyword chips, category tabs, pick-up card + rows. */
export function MagazineListMobile({ magazines, categories, loading = false }: Props) {
    const navigate = useNavigate();
    const { stickyTop } = useMobileShell();
    const [cat, setCat] = useState(ALL);
    const [query, setQuery] = useState('');

    const q = query.trim();
    const needles = queryNeedles(q);
    const list = magazines.filter((m) => {
        if (cat !== ALL && categoryLabel(m.category) !== cat) return false;
        const text = `${m.title} ${m.description}`.toLowerCase();
        return needles.length === 0 || needles.some((n) => text.includes(n));
    });
    // Admin-featured article leads the page when it is in the current result set (same rule as PC).
    const featureIdx = Math.max(0, list.findIndex((m) => m.isFeatured));
    const feature = list[featureIdx];
    const rest = list.filter((_, i) => i !== featureIdx);

    const tabs = [ALL, ...categoryTabs(categories)].map((label) => ({
        label,
        count: label === ALL ? magazines.length : magazines.filter((m) => categoryLabel(m.category) === label).length,
    }));

    const open = (id: string) => {
        navigate(`/travel-guide/${id}`);
        window.scrollTo(0, 0);
    };

    return (
        <>
            <section style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>TRAVEL MAGAZINE</span>
                    <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, lineHeight: 1.25, whiteSpace: 'nowrap' }}>몽골 여행 가이드</h1>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: MW.mute }}>
                        몽골의 대자연, 유목 문화, 추천 명소 등 여행 전에 알아 두면 좋은 정보를 모아 소개합니다.
                    </p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, height: 50, padding: '0 6px 0 18px', borderRadius: 999, background: '#fff', border: `1.5px solid ${MW.line}`, boxSizing: 'border-box' }}>
                    <span aria-hidden="true" style={{ width: 15, height: 15, border: `2px solid ${MW.mintDeep}`, borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0 }} />
                    <input
                        type="text"
                        inputMode="search"
                        enterKeyHint="search"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setCat(ALL); }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                e.currentTarget.blur();
                                setCat(ALL);
                            }
                        }}
                        placeholder="여행 정보 검색"
                        aria-label="기사 검색"
                        style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', fontSize: 16, fontFamily: 'inherit', color: MW.navy, background: 'transparent', padding: 0, boxShadow: 'none' }}
                    />
                    {query && (
                        <button type="button" onClick={() => setQuery('')} aria-label="지우기" style={{ width: 38, height: 38, border: 0, borderRadius: '50%', background: MW.chip, color: MW.mute, fontSize: 16, cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                            ×
                        </button>
                    )}
                </label>
                <div data-noscroll="" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: '-4px -16px 0', padding: '0 16px' }}>
                    {KEYWORDS.map((k) => {
                        const on = q === k;
                        return (
                            <button
                                key={k}
                                type="button"
                                aria-pressed={on}
                                onClick={() => { setQuery(on ? '' : k); setCat(ALL); }}
                                style={{ flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${on ? MW.mint : MW.mintTint}`, background: on ? MW.mintTint : '#FFFFFF', color: MW.mintDeep, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                            >
                                #{k}
                            </button>
                        );
                    })}
                </div>
            </section>

            <div style={{ position: 'sticky', top: stickyTop, zIndex: 10, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${MW.line}`, marginTop: 12 }}>
                <div role="tablist" data-noscroll="" style={{ display: 'flex', gap: 22, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px' }}>
                    {tabs.map((t) => {
                        const on = t.label === cat;
                        return (
                            <button
                                key={t.label}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                onClick={() => setCat(t.label)}
                                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 48, padding: '0 2px', border: 0, borderBottom: `3px solid ${on ? MW.mint : 'transparent'}`, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 700 : 500, color: on ? MW.navy : MW.mute, cursor: 'pointer', whiteSpace: 'nowrap', boxSizing: 'border-box' }}
                            >
                                {t.label}
                                <span style={{ minWidth: 20, height: 20, padding: '0 6px', boxSizing: 'border-box', borderRadius: 999, background: on ? MW.mintTint : MW.chip, color: on ? MW.mintDeep : MW.mute2, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {t.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {loading ? (
                <MLoading />
            ) : (
                <section style={{ padding: '18px 16px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <span style={{ fontSize: 12, color: MW.mute }}>기사 {list.length}건</span>

                    {feature && (
                        <a
                            href={`/travel-guide/${feature.id}`}
                            onClick={(e) => { e.preventDefault(); open(feature.id); }}
                            style={{ position: 'relative', display: 'block', aspectRatio: '4/5', borderRadius: 22, overflow: 'hidden', color: '#fff', background: MW.navySoft, marginTop: -10, textDecoration: 'none' }}
                        >
                            {isUsableImage(feature.image) && <MPhoto src={feature.image} alt={`${cleanTitle(feature.title)} | 몽골 여행 가이드`} eager sizes="(max-width: 480px) 100vw, 480px" />}
                            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0) 35%,rgba(10,31,46,0.9) 100%)' }} />
                            <div style={{ position: 'absolute', left: 18, right: 18, bottom: 18, display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: MW.navy, background: MW.mint, padding: '5px 10px', borderRadius: 999 }}>PICK UP</span>
                                    {feature.category && <span style={{ fontSize: 11, fontWeight: 700, color: MW.navy, background: '#fff', padding: '4px 10px', borderRadius: 999 }}>{categoryLabel(feature.category)}</span>}
                                </div>
                                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, lineHeight: 1.45, ...CLAMP(3) }}>{cleanTitle(feature.title)}</h2>
                                {feature.description && <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: '#DDE6EC', ...CLAMP(2) }}>{feature.description}</p>}
                            </div>
                        </a>
                    )}

                    {rest.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {rest.map((m) => {
                                const title = cleanTitle(m.title);
                                return (
                                    <a
                                        key={m.id}
                                        href={`/travel-guide/${m.id}`}
                                        onClick={(e) => { e.preventDefault(); open(m.id); }}
                                        style={{ display: 'grid', gridTemplateColumns: '112px minmax(0,1fr)', gap: 14, alignItems: 'center', padding: '14px 0', borderTop: `1px solid ${M_HAIR}`, color: MW.navy, textDecoration: 'none' }}
                                    >
                                        <div style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 14, overflow: 'hidden', pointerEvents: 'none', background: MW.chip }}>
                                            {isUsableImage(m.image) && <MPhoto src={m.image} alt={`${title} | 몽골 여행 가이드`} />}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                                            {m.category && <span style={{ alignSelf: 'flex-start', fontSize: 10, fontWeight: 700, color: MW.mintDeep, background: MW.mintTint, padding: '3px 8px', borderRadius: 999 }}>{categoryLabel(m.category)}</span>}
                                            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, lineHeight: 1.5, ...CLAMP(2) }}>{title}</h3>
                                            {m.description && <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: MW.mute, ...CLAMP(2) }}>{m.description}</p>}
                                        </div>
                                    </a>
                                );
                            })}
                        </div>
                    )}

                    {list.length === 0 && (
                        <div style={{ borderRadius: 22, background: MW.mintBg, border: `1px solid ${MW.mintTint}`, padding: '44px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>조건에 맞는 기사를 찾지 못했습니다.</p>
                            <button
                                type="button"
                                onClick={() => { setCat(ALL); setQuery(''); }}
                                style={{ height: 44, padding: '0 20px', border: `1.5px solid ${MW.mint}`, borderRadius: 999, background: '#fff', fontSize: 13, fontWeight: 700, color: MW.mintDeep, cursor: 'pointer', fontFamily: 'inherit' }}
                            >
                                전체 기사 보기 →
                            </button>
                        </div>
                    )}
                </section>
            )}

            <MagazineQuoteCta />
        </>
    );
}
