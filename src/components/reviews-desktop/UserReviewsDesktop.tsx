import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SEO } from '../seo/SEO';
import { MW, MW_FONT_EN, MW_GRADIENT } from '../desktop-primitives/mwTokens';
import { AnimalAvatar } from './AnimalAvatar';
import { reviewsSeoProps, useDesktopReviews, type DesktopReview } from './reviewsData';
import { PenIcon, Stars } from './reviewUi';

type Sort = 'new' | 'top' | 'photo';

const SORTS: { key: Sort; label: string }[] = [
    { key: 'new', label: '최신순' },
    { key: 'top', label: '평점 높은순' },
    { key: 'photo', label: '사진 후기' },
];

export function UserReviewsDesktop() {
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
            photos: reviews.reduce((n, r) => n + r.images.length, 0),
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
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 104px', display: 'flex', flexDirection: 'column', gap: 40 }}>
            <SEO {...reviewsSeoProps(stats.total, stats.avg.toFixed(1))} />
            <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 13, color: MW.mute }}>
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={{ color: MW.mute, textDecoration: 'none' }}>홈</a>
                <span>›</span>
                <span style={{ color: MW.navy, fontWeight: 700 }}>후기</span>
            </nav>

            <div style={{ marginTop: -16, borderRadius: 32, overflow: 'hidden', background: 'linear-gradient(135deg,#F1FCF8 0%,#FFFFFF 60%)', border: `1px solid ${MW.mintTint}`, display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>
                <div style={{ flex: '1 1 440px', minWidth: 0, padding: 'clamp(28px,5vw,56px)', display: 'flex', flexDirection: 'column', gap: 18, justifyContent: 'center' }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>REAL REVIEWS</span>
                    <h1 style={{ margin: 0, fontSize: 'clamp(32px,4.2vw,48px)', fontWeight: 900, lineHeight: 1.25, wordBreak: 'keep-all' }}>실제 여행자들의 <wbr />후기</h1>
                    <p style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: MW.mute, maxWidth: 480, textWrap: 'pretty' }}>
                        한국어 가이드가 동행해 안심할 수 있는 몽골 투어, 고객들의 생생한 후기를 모았습니다.
                    </p>
                    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: 4 }}>
                        <HeaderStat value={stats.recommend} label="★4 이상 평가" />
                        <HeaderStat value={stats.total ? String(stats.photos) : '—'} label="등록된 사진" />
                    </div>
                    <GradientButton onClick={writeReview} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                        <PenIcon />
                        후기 쓰기
                    </GradientButton>
                </div>

                <div style={{ flex: '1 1 380px', minWidth: 280, position: 'relative', overflow: 'hidden', background: 'linear-gradient(160deg,#0F2A3B 0%,#1C8571 100%)', color: '#FFFFFF', padding: 'clamp(28px,4vw,44px)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
                    <span style={{ position: 'absolute', right: -90, top: -90, width: 260, height: 260, borderRadius: '50%', background: 'radial-gradient(circle,rgba(109,219,190,0.35),rgba(109,219,190,0) 70%)', pointerEvents: 'none' }} />
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18 }}>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 56, fontWeight: 600, lineHeight: 1 }}>{stats.avgLabel}</span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <Stars rating={Math.round(stats.avg)} size={18} spacing={2} color="#F2B544" emptyColor="rgba(255,255,255,0.28)" />
                            <span style={{ fontSize: 12, color: MW.mintTint }}>누적 후기 {stats.total}건</span>
                        </span>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {stats.dist.map((d) => {
                            const on = star === d.s;
                            return (
                                <button
                                    key={d.s}
                                    type="button"
                                    onClick={() => setStar(on ? 0 : d.s)}
                                    aria-pressed={on}
                                    aria-label={`★${d.s} 후기만 보기 (${d.pct}%)`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, height: 24, padding: 0, border: 0, background: 'transparent', fontFamily: 'inherit', cursor: 'pointer', color: on ? MW.mintLight : '#FFFFFF' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                >
                                    <span style={{ width: 28, fontSize: 12, fontWeight: on ? 900 : 500, textAlign: 'left' }}>★{d.s}</span>
                                    <span style={{ flex: 1, height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
                                        <span style={{ display: 'block', height: '100%', width: `${d.pct}%`, background: 'linear-gradient(90deg,#27AB8F,#6DDBBE)', borderRadius: 999 }} />
                                    </span>
                                    <span style={{ width: 36, fontFamily: MW_FONT_EN, fontSize: 11, textAlign: 'right' }}>{d.pct}%</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, letterSpacing: '0.06em', color: MW.mintDeep }}>ALL REVIEWS</span>
                        <h2 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
                            전체 후기 <span style={{ fontFamily: MW_FONT_EN, fontSize: 18, fontWeight: 600, color: MW.mintDeep }}>{items.length}</span>
                        </h2>
                    </div>
                    <div role="tablist" aria-label="정렬" style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: MW.chip }}>
                        {SORTS.map((s) => {
                            const on = sort === s.key;
                            return (
                                <button
                                    key={s.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={on}
                                    onClick={() => setSort(s.key)}
                                    style={{ height: 36, padding: '0 16px', border: 0, borderRadius: 999, background: on ? '#FFFFFF' : 'transparent', boxShadow: on ? '0 2px 6px rgba(10,31,46,0.08)' : 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: on ? MW.navy : MW.mute, cursor: 'pointer', whiteSpace: 'nowrap' }}
                                >
                                    {s.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
                {stats.tours.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {['', ...stats.tours].map((t) => (
                            <TourChip key={t || 'all'} label={t || '전체 투어'} on={tour === t} onClick={() => setTour(t)} />
                        ))}
                        {star > 0 && (
                            <button
                                type="button"
                                onClick={() => setStar(0)}
                                style={{ height: 36, padding: '0 14px', borderRadius: 999, border: 0, background: MW.navy, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}
                            >
                                ★{star}만 보는 중 ×
                            </button>
                        )}
                    </div>
                )}
            </div>

            {isLoading ? (
                <p style={{ margin: '-16px 0 0', padding: '56px 0', textAlign: 'center', fontSize: 14, color: MW.mute }}>불러오는 중…</p>
            ) : items.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,320px),1fr))', gap: 20, marginTop: -16 }}>
                    {items.map((r) => (
                        <ReviewCard key={r.id} r={r} />
                    ))}
                </div>
            ) : (
                <div style={{ border: `1px dashed ${MW.line2}`, borderRadius: 20, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center', marginTop: -16 }}>
                    {reviews.length > 0 ? (
                        <>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>조건에 맞는 후기가 없습니다</p>
                            <button type="button" onClick={reset} style={outlineBtn}>조건 초기화</button>
                        </>
                    ) : (
                        <>
                            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>아직 후기가 없습니다</p>
                            <p style={{ margin: 0, fontSize: 13, color: MW.mute }}>참가하신 투어의 소감을 들려주세요.</p>
                            <button type="button" onClick={writeReview} style={outlineBtn}>후기 쓰기</button>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}

function HeaderStat({ value, label }: { value: string; label: string }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontFamily: MW_FONT_EN, fontSize: 22, fontWeight: 600 }}>{value}</span>
            <span style={{ fontSize: 12, color: MW.mute }}>{label}</span>
        </div>
    );
}

function GradientButton({ onClick, style, children }: { onClick: () => void; style?: CSSProperties; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 26px', border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer', ...style }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.92')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
            {children}
        </button>
    );
}

function TourChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
    const border = on ? MW.mint : MW.line;
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={on}
            style={{ height: 36, padding: '0 16px', borderRadius: 999, border: `1px solid ${border}`, background: on ? MW.mintTint : '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: on ? MW.mintDeep : MW.ink3, cursor: 'pointer', whiteSpace: 'nowrap' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = MW.mint)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = border)}
        >
            {label}
        </button>
    );
}

/** Whole card links to the review (stretched link); the tour chip keeps its own product link. */
function ReviewCard({ r }: { r: DesktopReview }) {
    const navigate = useNavigate();
    const href = `/reviews/${r.id}`;
    const thumbs = r.images.slice(0, 3);
    return (
        <article
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 14, padding: 24, border: `1px solid ${MW.line}`, borderRadius: 24, background: '#fff', color: MW.navy, transition: 'border-color .15s,transform .15s' }}
            onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = MW.mint;
                e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = MW.line;
                e.currentTarget.style.transform = '';
            }}
        >
            <a
                href={href}
                onClick={(e) => { e.preventDefault(); navigate(href); }}
                aria-label={`${r.heading} 읽기`}
                style={{ position: 'absolute', inset: 0, borderRadius: 24 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex' }}>
                    <AnimalAvatar kind={r.animal} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.author} 님</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Stars rating={r.rating} size={12} spacing={1} />
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, color: MW.mute2 }}>{r.date}</span>
                    </span>
                </span>
            </div>
            {r.productId ? (
                <button
                    type="button"
                    onClick={() => navigate(`/products/${r.productId}`)}
                    style={{ ...tourTag, position: 'relative', cursor: 'pointer', fontFamily: 'inherit' }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = MW.mint)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = MW.mintTint)}
                >
                    {r.productName}
                </button>
            ) : (
                <span style={tourTag}>{r.productName}</span>
            )}
            {r.title && <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.45 }}>{r.title}</span>}
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, color: MW.ink3, display: '-webkit-box', WebkitLineClamp: r.title ? 3 : 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {r.content.replace(/\s+/g, ' ')}
            </p>
            {thumbs.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, marginTop: 'auto', pointerEvents: 'none' }}>
                    {thumbs.map((src, i) => (
                        <span key={src + i} style={{ position: 'relative', display: 'block', aspectRatio: '1/1', borderRadius: 14, overflow: 'hidden', background: MW.chip }}>
                            <img
                                src={src}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                            />
                            {i === 2 && r.images.length > 3 && (
                                <span style={{ position: 'absolute', inset: 0, background: 'rgba(10,31,46,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 600, color: '#FFFFFF' }}>
                                    +{r.images.length - 3}
                                </span>
                            )}
                        </span>
                    ))}
                </div>
            )}
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: MW.mute, paddingTop: 12, borderTop: '1px solid #EEF1EF', marginTop: thumbs.length ? 0 : 'auto' }}>
                <span>도움이 됐어요 {r.helpful}</span>
                <span style={{ fontWeight: 700, color: MW.mintDeep }}>자세히 보기 →</span>
            </span>
        </article>
    );
}

const tourTag: CSSProperties = {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 11,
    fontWeight: 700,
    color: MW.mintDeep,
    background: MW.mintBg,
    border: `1px solid ${MW.mintTint}`,
    padding: '4px 10px',
    borderRadius: 999,
    lineHeight: 1.5,
};

const outlineBtn: CSSProperties = {
    height: 44,
    padding: '0 20px',
    border: `1px solid ${MW.line}`,
    borderRadius: 999,
    background: '#fff',
    fontFamily: 'inherit',
    fontSize: 14,
    fontWeight: 700,
    color: MW.navy,
    cursor: 'pointer',
};
