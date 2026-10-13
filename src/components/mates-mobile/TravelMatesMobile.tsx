import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotImages } from '../../hooks/useSpotImages';
import { MW, MW_FONT_EN, cleanTitle } from '../desktop-primitives/mwTokens';
import { STATUS_LABEL, matePhoto, regionPhoto, seatText, type MatePost } from '../mates-desktop/matesData';
import { MobileShell } from '../mobile/MobileShell';
import { useMobileShell } from '../mobile/mobileShellContext';
import { D, M_GRADIENT, M_HAIR, M_PAPER } from '../mobile/mobileTheme';
import { Ico } from '../mobile/mobileUi';
import { MatesFilterSheet } from './MatesFilterSheet';
import { CARD_STATUS_PILL, MATE_ICON, MAX_SEAT_DOTS, MINT_SOLID, PANEL_BG, SEAT_FG, STEPS, WRITE_PATH } from './matesMobileTheme';
import { MateAvatar, MatePhoto } from './matesMobileUi';
import { ALL_DESTS, MATE_SORTS, useMatesList } from './useMatesList';

/** Mobile 동행 찾기 list (Claude Design: "M Mates" + "M Mates Filter"). */
export function TravelMatesMobile() {
    return (
        <MobileShell title="동행 찾기">
            <MatesList />
        </MobileShell>
    );
}

function MatesList() {
    const navigate = useNavigate();
    const { stickyTop } = useMobileShell();
    const { pick } = useSpotImages();
    const list = useMatesList();
    const { posts, isLoading, items, query, q, setQuery, dest, setDest, tabs, sort, setSort, activeCount } = list;
    const [sheet, setSheet] = useState(false);
    const closeSheet = useCallback(() => setSheet(false), []);

    const write = () => navigate(WRITE_PATH);

    return (
        <section style={{ padding: '14px 0 0', color: MW.navy }}>
            {/* Header: search, popular keywords, stats and the write button */}
            <div style={{ margin: '0 16px', borderRadius: 24, overflow: 'hidden', border: `1px solid ${MW.mintTint}` }}>
                <div style={{ padding: '22px 18px 20px', background: `linear-gradient(135deg,${MW.mintBg} 0%,#FFFFFF 60%)`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>TRAVEL MATES</span>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, lineHeight: 1.3 }}>동행을 찾아보세요</h1>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: MW.mute }}>
                        몽골을 함께 여행할 동행을 모집하거나 모집글에 참가할 수 있습니다. 취향·예산·일정이 맞는 사람과 경비를 나누고, 현지를 더 깊이 즐겨 보세요.
                    </p>
                    <label style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 6px 0 16px', borderRadius: 999, background: '#fff', border: `1px solid ${MW.line}`, boxShadow: '0 8px 24px rgba(10,31,46,0.08)', boxSizing: 'border-box' }}>
                        <Ico d={MATE_ICON.search} size={18} color={MW.mintDeep} width={2.2} style={{ flexShrink: 0 }} />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            enterKeyHint="search"
                            placeholder="여행지·키워드로 검색"
                            aria-label="동행 찾기 검색"
                            style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 16, color: MW.navy, padding: 0, boxShadow: 'none' }}
                        />
                        {!!query && (
                            <button type="button" onClick={() => setQuery('')} aria-label="지우기" style={{ width: 34, height: 34, border: 0, borderRadius: '50%', background: MW.chip, color: MW.mute, fontSize: 14, cursor: 'pointer', flexShrink: 0, padding: 0 }}>×</button>
                        )}
                    </label>
                    {list.keywords.length > 0 && (
                        <div data-noscroll="" aria-label="인기 키워드" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -18px', padding: '0 18px' }}>
                            {list.keywords.map((k) => {
                                const on = q === k;
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => setQuery(on ? '' : k)}
                                        style={{ flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 999, border: `1px solid ${on ? MW.mint : MW.mintTint}`, background: on ? MW.mintTint : '#FFFFFF', color: MW.mintDeep, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                    >
                                        #{k}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div style={{ position: 'relative', overflow: 'hidden', padding: '20px 18px', background: PANEL_BG, color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <span aria-hidden="true" style={{ position: 'absolute', right: -60, top: -60, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(109,219,190,0.3),rgba(109,219,190,0) 70%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 10 }}>
                        {list.stats.map((s) => (
                            <div key={s.l} style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>{isLoading ? '–' : s.n}</span>
                                <span style={{ fontSize: 11, color: MW.mintTint, whiteSpace: 'nowrap' }}>{s.l}</span>
                            </div>
                        ))}
                    </div>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button type="button" onClick={write} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, border: 0, borderRadius: 999, background: M_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>동행 모집하기
                        </button>
                        <span style={{ fontSize: 11, color: MW.mintTint, textAlign: 'center' }}>무료로 올릴 수 있습니다</span>
                    </div>
                </div>
            </div>

            {/* Destination tabs */}
            {tabs.length > 1 && (
                <div role="tablist" aria-label="여행지" data-noscroll="" style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', padding: '18px 16px 2px' }}>
                    {tabs.map((t) => {
                        const on = dest === t.key;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                onClick={() => setDest(t.key)}
                                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px 0 4px', borderRadius: 999, border: `1.5px solid ${on ? MW.mint : MW.line}`, background: on ? MW.mintBg : '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: on ? MW.mintDeep : MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                <span aria-hidden="true" style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: MW.mintTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: MW.mintDeep, pointerEvents: 'none' }}>
                                    {t.label.charAt(0)}
                                    <MatePhoto src={t.key === ALL_DESTS ? pick(['モンゴルの大草原', '몽골 대초원', '몽골의 대초원']) : regionPhoto(t.key, pick)} alt="" />
                                    {on && <span style={{ position: 'absolute', inset: 0, background: 'rgba(10,31,46,0.45)', color: '#fff', fontSize: 13, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
                                </span>
                                {t.label}
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, color: on ? MW.mintDeep : MW.mute2 }}>{t.n}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Count, filter button and sort */}
            <div style={{ position: 'sticky', top: stickyTop, zIndex: 10, background: '#FFFFFF', marginTop: 14, padding: '10px 16px', borderTop: `1px solid ${M_HAIR}`, borderBottom: `1px solid ${M_HAIR}`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6, whiteSpace: 'nowrap', fontSize: 17, fontWeight: 900 }}>
                        모집 중인 여행
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 14, fontWeight: 600, color: MW.mintDeep }}>{isLoading ? '–' : items.length}</span>
                    </h2>
                    <button
                        type="button"
                        onClick={() => setSheet(true)}
                        aria-haspopup="dialog"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px', borderRadius: 999, border: `1px solid ${activeCount ? MW.mint : MW.line}`, background: activeCount ? MW.mintBg : '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                        <Ico d={D.filter} size={15} width={2} />
                        필터
                        {activeCount > 0 && (
                            <span style={{ minWidth: 18, height: 18, padding: '0 4px', boxSizing: 'border-box', borderRadius: 999, background: MW.mint, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeCount}</span>
                        )}
                    </button>
                </div>
                <div role="tablist" aria-label="정렬" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 4, padding: 4, borderRadius: 999, background: MW.chip }}>
                    {MATE_SORTS.map(([k, label]) => {
                        const on = sort === k;
                        return (
                            <button
                                key={k}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                onClick={() => setSort(k)}
                                style={{ height: 32, padding: 0, border: 0, borderRadius: 999, background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 2px 6px rgba(10,31,46,0.08)' : 'none', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: on ? MW.navy : MW.mute, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {isLoading ? (
                <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '20px 16px 0' }}>
                    {[0, 1, 2].map((i) => (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ aspectRatio: '16/10', borderRadius: 20, background: MW.chip }} />
                            <div style={{ height: 18, width: '80%', borderRadius: 6, background: MW.chip }} />
                            <div style={{ height: 14, width: '50%', borderRadius: 6, background: MW.chip }} />
                        </div>
                    ))}
                </div>
            ) : items.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '20px 16px 0' }}>
                    {items.map((p) => (
                        <MateCard key={p.id} p={p} photo={matePhoto(p, pick)} onOpen={() => navigate(`/travel-mates/${p.id}`)} />
                    ))}
                </div>
            ) : (
                <div style={{ margin: '20px 16px 0', padding: '40px 20px', border: `1px dashed ${MW.line2}`, borderRadius: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700 }}>{posts.length ? '조건에 맞는 모집글이 없습니다' : '아직 모집글이 없습니다'}</span>
                    <span style={{ fontSize: 12, color: MW.mute }}>{posts.length ? '조건을 바꾸거나 직접 모집해 보세요.' : '첫 번째 동행 모집글을 올려 보세요.'}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 6 }}>
                        {posts.length > 0 && (
                            <button type="button" onClick={list.resetAll} style={{ height: 44, padding: '0 20px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>조건 초기화</button>
                        )}
                        <button type="button" onClick={write} style={{ height: 44, padding: '0 20px', border: 0, borderRadius: 999, background: M_GRADIENT, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>+ 동행 모집하기</button>
                    </div>
                </div>
            )}

            {/* How it works */}
            <div style={{ margin: '40px 16px 0', borderRadius: 24, padding: '24px 18px', background: `radial-gradient(260px 180px at 100% 0%,rgba(39,171,143,0.14),rgba(39,171,143,0) 70%),${M_PAPER}`, border: `1px solid ${MW.line}`, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>HOW IT WORKS</span>
                    <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, lineHeight: 1.35 }}>안심하고 동행과 여행하려면</h2>
                </div>
                {STEPS.map(([n, title, body]) => (
                    <div key={n} style={{ display: 'flex', gap: 14, padding: '18px 16px', borderRadius: 18, background: '#FFFFFF', border: `1px solid ${MW.line}` }}>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600, color: MW.mintDeep, flexShrink: 0, paddingTop: 1 }}>{n}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 15, fontWeight: 900 }}>{title}</span>
                            <span style={{ fontSize: 12, lineHeight: 1.7, color: MW.mute, textWrap: 'pretty' }}>{body}</span>
                        </span>
                    </div>
                ))}
            </div>

            {sheet && (
                <MatesFilterSheet
                    groups={list.groups}
                    has={list.has}
                    toggle={list.toggle}
                    activeCount={activeCount}
                    resultCount={items.length}
                    onReset={list.resetFilters}
                    onClose={closeSheet}
                />
            )}
        </section>
    );
}

function MateCard({ p, photo, onOpen }: { p: MatePost; photo: string; onOpen: () => void }) {
    const [sbg, sfg] = CARD_STATUS_PILL[p.status];
    const dots = Math.min(p.cap, MAX_SEAT_DOTS);
    const title = cleanTitle(p.title) || p.title;
    return (
        <a
            href={`/travel-mates/${p.id}`}
            onClick={(e) => { e.preventDefault(); onOpen(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, color: MW.navy, opacity: p.status === 'done' ? 0.75 : 1, textDecoration: 'none', minWidth: 0 }}
        >
            <div style={{ position: 'relative', aspectRatio: '16/10', borderRadius: 20, overflow: 'hidden', background: PANEL_BG }}>
                <MatePhoto src={photo} alt={p.image ? title : `${p.region} 이미지`} />
                <span style={{ position: 'absolute', inset: 'auto 0 0 0', height: '55%', background: 'linear-gradient(180deg,rgba(10,31,46,0),rgba(10,31,46,0.6))', pointerEvents: 'none' }} />
                <span style={{ position: 'absolute', left: 10, top: 10, height: 24, padding: '0 10px', display: 'flex', alignItems: 'center', borderRadius: 999, background: sbg, color: sfg, fontSize: 11, fontWeight: 700, pointerEvents: 'none' }}>{STATUS_LABEL[p.status]}</span>
                <span style={{ position: 'absolute', right: 10, top: 10, height: 24, padding: '0 10px', display: 'flex', alignItems: 'center', borderRadius: 999, background: 'rgba(255,255,255,0.92)', color: MW.navy, fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, pointerEvents: 'none' }}>{p.period}</span>
                <span style={{ position: 'absolute', left: 14, right: 14, bottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8, color: '#FFFFFF', pointerEvents: 'none' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintTint }}>{p.region}</span>
                        {p.nightsLabel && <span style={{ fontSize: 14, fontWeight: 700 }}>{p.nightsLabel}</span>}
                    </span>
                    {dots > 0 && (
                        <span aria-label={`${p.joined}/${p.cap}명`} style={{ display: 'flex', paddingLeft: 5, flexShrink: 0 }}>
                            {Array.from({ length: dots }, (_, k) => (
                                <span key={k} style={{ width: 20, height: 20, marginLeft: -5, borderRadius: '50%', border: '2px solid #FFFFFF', boxSizing: 'border-box', background: k < p.joined ? MINT_SOLID : 'rgba(255,255,255,0.35)' }} />
                            ))}
                        </span>
                    )}
                </span>
            </div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h3>
            {p.styles.length > 0 && (
                <div data-noscroll="" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
                    {p.styles.map((s) => (
                        <span key={s} style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: MW.mintDeep, background: MW.mintBg, border: `1px solid ${MW.mintTint}`, padding: '3px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>#{s}</span>
                    ))}
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: `1px solid ${M_HAIR}` }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <MateAvatar initial={p.initial} image={p.hostImage} size={30} fontSize={12} />
                    <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.host}</span>
                        <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[p.hostInfo, p.posted].filter(Boolean).join(' · ')}</span>
                    </span>
                </span>
                {p.cap > 0 && (
                    <span style={{ flexShrink: 0, display: 'flex', alignItems: 'baseline', gap: 4, fontSize: 12, color: MW.mute, whiteSpace: 'nowrap' }}>
                        <strong style={{ fontFamily: MW_FONT_EN, fontSize: 14, fontWeight: 600, color: SEAT_FG[p.status] }}>{p.joined}/{p.cap}</strong>
                        {seatText(p)}
                    </span>
                )}
            </div>
        </a>
    );
}
