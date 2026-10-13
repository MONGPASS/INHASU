import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEO } from '../seo/SEO';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { MobileShell } from '../mobile/MobileShell';
import { useMobileShell } from '../mobile/mobileShellContext';
import { M_HAIR } from '../mobile/mobileTheme';
import { MLoading } from '../mobile/mobileUi';
import { AnimalAvatar } from '../reviews-desktop/AnimalAvatar';
import { reviewsSeoProps, useDesktopReviews, type DesktopReview } from '../reviews-desktop/reviewsData';
import { PenIcon, Stars } from '../reviews-desktop/reviewUi';

type Sort = 'new' | 'top' | 'photo';

const SORTS: { key: Sort; label: string }[] = [
    { key: 'new', label: '최신순' },
    { key: 'top', label: '평점 높은순' },
    { key: 'photo', label: '사진 후기' },
];

/** Mobile review list (Claude Design: "M Reviews Page"). Same data and filters as the PC list. */
export function UserReviewsMobile() {
    const navigate = useNavigate();
    const { reviews, isLoading } = useDesktopReviews();
    const [sort, setSort] = useState<Sort>('new');
    const [tour, setTour] = useState('');
    const [star, setStar] = useState(0);

    const stats = useMemo(() => {
        const total = reviews.length;
        const avg = total ? reviews.reduce((n, r) => n + r.rating, 0) / total : 0;
        const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
        return {
            total,
            avg,
            avgLabel: total ? avg.toFixed(1) : '—',
            dist: [5, 4, 3, 2, 1].map((s) => ({ s, pct: pct(reviews.filter((r) => r.rating === s).length) })),
            recommend: total ? `${pct(reviews.filter((r) => r.rating >= 4).length)}%` : '—',
            photos: total ? String(reviews.reduce((n, r) => n + r.images.length, 0)) : '—',
            tours: [...new Set(reviews.map((r) => r.productName))],
        };
    }, [reviews]);

    const items = useMemo(() => {
        let list = reviews.filter((r) => (!tour || r.productName === tour) && (!star || r.rating === star));
        if (sort === 'photo') list = list.filter((r) => r.images.length > 0);
        const byNew = (a: DesktopReview, b: DesktopReview) => b.createdAt - a.createdAt;
        return [...list].sort(sort === 'top' ? (a, b) => b.rating - a.rating || b.helpful - a.helpful || byNew(a, b) : byNew);
    }, [reviews, sort, tour, star]);

    const reset = () => {
        setSort('new');
        setTour('');
        setStar(0);
    };
    const writeReview = () => navigate('/reviews/write');

    return (
        <MobileShell title="여행 후기">
            <SEO {...reviewsSeoProps(stats.total, stats.avg.toFixed(1))} />
            <section style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <nav aria-label="현재 위치" style={{ display: 'flex', gap: 6, fontSize: 12, color: MW.mute, minWidth: 0, whiteSpace: 'nowrap' }}>
                    <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ color: MW.mute, textDecoration: 'none' }}>홈</a>
                    <span>›</span>
                    <span style={{ color: MW.navy, fontWeight: 700 }}>후기</span>
                </nav>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>REAL REVIEWS</span>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, lineHeight: 1.3, whiteSpace: 'nowrap' }}>실제 여행자들의 후기</h1>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.75, color: MW.mute }}>한국어 가이드가 동행해 안심할 수 있는 몽골 투어, 고객들의 생생한 후기를 모았습니다.</p>
                </div>

                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, background: 'linear-gradient(160deg,#0F2A3B 0%,#1C8571 100%)', color: '#FFFFFF', padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <span style={{ position: 'absolute', right: -80, top: -80, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle,rgba(109,219,190,0.35),rgba(109,219,190,0) 70%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 44, fontWeight: 600, lineHeight: 1 }}>{stats.avgLabel}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Stars rating={Math.round(stats.avg)} size={16} spacing={2} color="#F2B544" emptyColor="rgba(255,255,255,0.28)" />
                            <span style={{ fontSize: 12, color: MW.mintTint, whiteSpace: 'nowrap' }}>누적 후기 {stats.total}건</span>
                        </span>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {stats.dist.map((d) => {
                            const on = star === d.s;
                            return (
                                <button
                                    key={d.s}
                                    type="button"
                                    onClick={() => setStar(on ? 0 : d.s)}
                                    aria-pressed={on}
                                    aria-label={`★${d.s} 후기만 보기 (${d.pct}%)`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, height: 28, padding: 0, border: 0, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', color: on ? MW.mintLight : '#FFFFFF' }}
                                >
                                    <span style={{ width: 28, fontSize: 12, fontWeight: on ? 900 : 500, textAlign: 'left' }}>★{d.s}</span>
                                    <span style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
                                        <span style={{ display: 'block', height: '100%', width: `${d.pct}%`, background: 'linear-gradient(90deg,#27AB8F,#6DDBBE)', borderRadius: 999 }} />
                                    </span>
                                    <span style={{ width: 36, fontFamily: MW_FONT_EN, fontSize: 10, textAlign: 'right' }}>{d.pct}%</span>
                                </button>
                            );
                        })}
                    </div>
                    {/* The design's per-category scores have no data behind them; the row carries the two figures the PC header shows. */}
                    <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.18)' }}>
                        <CardStat value={stats.recommend} label="★4 이상 평가" />
                        <CardStat value={stats.photos} label="등록된 사진" />
                    </div>
                </div>

                <button
                    type="button"
                    onClick={writeReview}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, border: `1.5px solid ${MW.navy}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                >
                    <PenIcon />
                    후기 쓰기
                </button>
            </section>

            <FilterBar tours={stats.tours} tour={tour} onTour={setTour} count={items.length} sort={sort} onSort={setSort} star={star} onClearStar={() => setStar(0)} />

            <section style={{ padding: '16px 16px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {isLoading ? (
                    <MLoading />
                ) : items.length > 0 ? (
                    items.map((r) => <ReviewCard key={r.id} r={r} />)
                ) : (
                    <div style={{ border: `1px dashed ${MW.line2}`, borderRadius: 20, padding: '44px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
                        {reviews.length > 0 ? (
                            <>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>조건에 맞는 후기가 없습니다</p>
                                <button type="button" onClick={reset} style={outlineBtn}>조건 초기화</button>
                            </>
                        ) : (
                            <>
                                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>아직 후기가 없습니다</p>
                                <p style={{ margin: 0, fontSize: 13, color: MW.mute }}>참가하신 투어의 소감을 들려주세요.</p>
                                <button type="button" onClick={writeReview} style={outlineBtn}>후기 쓰기</button>
                            </>
                        )}
                    </div>
                )}
            </section>
        </MobileShell>
    );
}

function CardStat({ value, label }: { value: string; label: string }) {
    return (
        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            <span style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 600 }}>{value}</span>
            <span style={{ fontSize: 11, color: MW.mintTint }}>{label}</span>
        </span>
    );
}

/** Tour chips, result count, sort tabs and the active star filter; sticks under the shell's back bar. */
function FilterBar({
    tours, tour, onTour, count, sort, onSort, star, onClearStar,
}: {
    tours: string[];
    tour: string;
    onTour: (t: string) => void;
    count: number;
    sort: Sort;
    onSort: (s: Sort) => void;
    star: number;
    onClearStar: () => void;
}) {
    const { stickyTop } = useMobileShell();
    return (
        <div style={{ position: 'sticky', top: stickyTop, zIndex: 10, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${M_HAIR}`, padding: '12px 0 10px', marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tours.length > 0 && (
                <div data-noscroll="" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '0 16px' }}>
                    {['', ...tours].map((t) => {
                        const on = tour === t;
                        return (
                            <button
                                key={t || 'all'}
                                type="button"
                                onClick={() => onTour(t)}
                                aria-pressed={on}
                                style={{ flexShrink: 0, height: 36, padding: '0 14px', borderRadius: 999, border: `1px solid ${on ? MW.mint : MW.line}`, background: on ? MW.mintTint : '#FFFFFF', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: on ? MW.mintDeep : MW.ink3, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                {t || '전체 투어'}
                            </button>
                        );
                    })}
                </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '0 16px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>{count}건</span>
                <div role="tablist" aria-label="정렬" style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 999, background: MW.chip }}>
                    {SORTS.map((s) => {
                        const on = sort === s.key;
                        return (
                            <button
                                key={s.key}
                                type="button"
                                role="tab"
                                aria-selected={on}
                                onClick={() => onSort(s.key)}
                                style={{ height: 32, padding: '0 11px', border: 0, borderRadius: 999, background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 2px 6px rgba(10,31,46,0.08)' : 'none', fontFamily: 'inherit', fontSize: 11, fontWeight: 700, color: on ? MW.navy : MW.mute, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                {s.label}
                            </button>
                        );
                    })}
                </div>
            </div>
            {star > 0 && (
                <div style={{ padding: '0 16px' }}>
                    <button type="button" onClick={onClearStar} style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: MW.navy, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}>
                        ★{star}만 보는 중 ×
                    </button>
                </div>
            )}
        </div>
    );
}

/** Whole card links to the review (stretched link); the tour chip keeps its own product link. */
function ReviewCard({ r }: { r: DesktopReview }) {
    const navigate = useNavigate();
    const href = `/reviews/${r.id}`;
    const thumbs = r.images.slice(0, 3);
    return (
        <article style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 12, padding: 18, border: `1px solid ${MW.line}`, borderRadius: 20, background: '#fff', color: MW.navy }}>
            <a
                href={href}
                onClick={(e) => { e.preventDefault(); navigate(href); }}
                aria-label={`${r.heading} 읽기`}
                style={{ position: 'absolute', inset: 0, borderRadius: 20 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex' }}>
                    <AnimalAvatar kind={r.animal} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.author} 님</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Stars rating={r.rating} size={12} spacing={1} />
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, color: MW.mute2 }}>{r.date}</span>
                    </span>
                </span>
            </div>
            {r.productId ? (
                <button type="button" onClick={() => navigate(`/products/${r.productId}`)} style={{ ...tourTag, position: 'relative', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {r.productName}
                </button>
            ) : (
                <span style={tourTag}>{r.productName}</span>
            )}
            {r.title && <span style={{ fontSize: 16, fontWeight: 900, lineHeight: 1.45 }}>{r.title}</span>}
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: MW.ink3, display: '-webkit-box', WebkitLineClamp: r.title ? 3 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {r.content.replace(/\s+/g, ' ')}
            </p>
            {thumbs.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6, pointerEvents: 'none' }}>
                    {thumbs.map((src, i) => (
                        <span key={src + i} style={{ position: 'relative', display: 'block', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', background: MW.chip }}>
                            <img
                                src={src}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            {i === 2 && r.images.length > 3 && (
                                <span style={{ position: 'absolute', inset: 0, background: 'rgba(10,31,46,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>
                                    +{r.images.length - 3}
                                </span>
                            )}
                        </span>
                    ))}
                </div>
            )}
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: MW.mute, paddingTop: 10, borderTop: `1px solid ${M_HAIR}` }}>
                <span>도움이 됐어요 {r.helpful}</span>
                <span style={{ fontWeight: 700, color: MW.mintDeep }}>자세히 보기 →</span>
            </span>
        </article>
    );
}

const tourTag: CSSProperties = {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    boxSizing: 'border-box',
    fontSize: 11,
    fontWeight: 700,
    color: MW.mintDeep,
    background: MW.mintBg,
    border: `1px solid ${MW.mintTint}`,
    padding: '3px 9px',
    borderRadius: 999,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
};

const outlineBtn: CSSProperties = {
    height: 44,
    padding: '0 20px',
    border: `1px solid ${MW.line}`,
    borderRadius: 999,
    background: '#fff',
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 700,
    color: MW.navy,
    cursor: 'pointer',
};
