import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatRelativeTime } from '../../utils/formatDate';
import { ImageLightbox } from '../common/ImageLightbox';
import { MW, MW_FONT_EN, MW_GRADIENT, MW_STICKY_TOP } from '../desktop-primitives/mwTokens';
import { AnimalAvatar } from './AnimalAvatar';
import { mapReview, normalizeComments, parseJsonArray, useDesktopReviews, useReviewTour, type DesktopReview, type RawComment, type RawReview } from './reviewsData';
import { PenIcon, Stars, ThumbIcon } from './reviewUi';

interface Me {
    id: string;
    name: string;
    image?: string;
}

interface ApiUser {
    id?: string;
    name?: string;
    email?: string;
    avatar_url?: string;
    user_metadata?: { full_name?: string; avatar_url?: string };
}

/** PC review detail. Keyed by review id by the page, so all state resets on prev/next navigation. */
export function ReviewDetailDesktop({ id }: { id: string }) {
    const navigate = useNavigate();
    const { reviews } = useDesktopReviews();
    const [raw, setRaw] = useState<RawReview | null>(null);
    const [loading, setLoading] = useState(true);
    const [me, setMe] = useState<Me | null>(null);
    const [helpful, setHelpful] = useState(false);
    const [helpfulSubmitting, setHelpfulSubmitting] = useState(false);
    const [draft, setDraft] = useState('');
    const [posting, setPosting] = useState(false);
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
        let cancelled = false;
        (async () => {
            try {
                const [r, user] = await Promise.all([api.reviews.get(id), api.auth.me().catch(() => null) as Promise<ApiUser | null>]);
                if (cancelled) return;
                if (user?.id) {
                    setMe({
                        id: user.id,
                        name: user.user_metadata?.full_name || user.name || user.email?.split('@')[0] || '여행자',
                        image: user.user_metadata?.avatar_url || user.avatar_url,
                    });
                }
                let helpfulCount = r?.helpful_count;
                if (user?.id && r) {
                    try {
                        const state = await api.reviews.getHelpfulStatus(id);
                        setHelpful(Boolean(state.helpful));
                        helpfulCount = state.helpful_count ?? helpfulCount;
                    } catch (error) {
                        console.error('Helpful status fetch error:', error);
                    }
                }
                if (!cancelled && r && !r.error) setRaw({ ...r, helpful_count: helpfulCount ?? 0 });
            } catch (e) {
                console.error('Review detail fetch error:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id]);

    const listIdx = reviews.findIndex((r) => r.id === id);
    const review = useMemo(() => (raw ? mapReview(raw, Math.max(0, listIdx)) : null), [raw, listIdx]);
    const tour = useReviewTour(review?.productId ?? '', review?.productName ?? '');

    if (loading || !review || !raw) {
        return (
            <section style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px 160px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: loading ? 400 : 700, color: loading ? MW.mute : MW.navy }}>
                    {loading ? '불러오는 중…' : '후기를 찾을 수 없습니다'}
                </p>
                {!loading && (
                    <button type="button" onClick={() => navigate('/reviews')} style={outlineBtn}>
                        후기 목록으로 돌아가기
                    </button>
                )}
            </section>
        );
    }

    const comments = normalizeComments(raw.comments);
    const paragraphs = review.content.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    const prev = listIdx > 0 ? reviews[listIdx - 1] : undefined;
    const next = listIdx >= 0 ? reviews[listIdx + 1] : undefined;
    const others = reviews.filter((r) => r.id !== review.id);
    const more = [...others.filter((r) => r.productName === review.productName), ...others.filter((r) => r.productName !== review.productName)].slice(0, 3);
    const productPath = tour ? `/products/${tour.id}` : review.productId ? `/products/${review.productId}` : '';
    const goReview = (r: DesktopReview) => navigate(`/reviews/${r.id}`);
    const loginPath = { state: { from: `/reviews/${id}` } };

    const toggleHelpful = async () => {
        if (!me) {
            alert('\'도움이 됐어요\'를 누르려면 로그인해 주세요.');
            navigate('/login', loginPath);
            return;
        }
        if (helpfulSubmitting) return;
        setHelpfulSubmitting(true);
        try {
            const result = await api.reviews.toggleHelpful(id);
            setHelpful(Boolean(result.helpful));
            setRaw((cur) => (cur ? { ...cur, helpful_count: Number(result.helpful_count || 0) } : cur));
        } catch (error) {
            console.error('Failed to toggle helpful:', error);
            alert('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setHelpfulSubmitting(false);
        }
    };

    // Same comment shape the mobile page writes; existing entries are kept untouched.
    const postComment = async () => {
        const content = draft.trim();
        if (!me || !content || posting) return;
        setPosting(true);
        const nextComments = [
            ...parseJsonArray<RawComment>(raw.comments),
            { id: Date.now().toString(), author: me.name, content, date: new Date().toISOString(), userImage: me.image, userId: me.id },
        ];
        try {
            await api.reviews.update(id, { comments: nextComments });
            setRaw((cur) => (cur ? { ...cur, comments: nextComments } : cur));
            setDraft('');
        } catch (error) {
            console.error('Failed to add comment:', error);
            alert('댓글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        } finally {
            setPosting(false);
        }
    };

    const canPost = !!draft.trim() && !posting;

    return (
        <section style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px 104px', display: 'flex', flexDirection: 'column', gap: 32 }}>
            <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 13, color: MW.mute, minWidth: 0 }}>
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('/'); }} style={crumbLink}>홈</a>
                <span>›</span>
                <a href="/reviews" onClick={(e) => { e.preventDefault(); navigate('/reviews'); }} style={crumbLink}>후기</a>
                <span>›</span>
                <span style={{ color: MW.navy, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{review.heading}</span>
            </nav>

            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <article style={{ flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                            <span style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex' }}>
                                <AnimalAvatar kind={review.animal} size={56} />
                            </span>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                                <span style={{ fontSize: 16, fontWeight: 900 }}>{review.author} 님</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <Stars rating={review.rating} size={15} spacing={2} />
                                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, color: MW.mute2 }}>{review.date}</span>
                                </span>
                            </span>
                        </div>
                        <h1 style={{ margin: 0, fontSize: 'clamp(26px,3.4vw,38px)', fontWeight: 900, lineHeight: 1.35, textWrap: 'pretty' }}>{review.heading}</h1>
                        {productPath ? (
                            <a
                                href={productPath}
                                onClick={(e) => { e.preventDefault(); navigate(productPath); }}
                                style={tourChip}
                                onMouseEnter={(e) => (e.currentTarget.style.borderColor = MW.mint)}
                                onMouseLeave={(e) => (e.currentTarget.style.borderColor = MW.mintTint)}
                            >
                                {review.productName} →
                            </a>
                        ) : (
                            <span style={tourChip}>{review.productName}</span>
                        )}
                    </div>

                    {paragraphs.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                            {paragraphs.map((p, i) => (
                                <p key={i} style={{ margin: 0, fontSize: 16, lineHeight: 2, color: MW.ink2, textWrap: 'pretty' }}>{p}</p>
                            ))}
                        </div>
                    )}

                    {review.images.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <span style={{ fontSize: 14, fontWeight: 900 }}>
                                사진 <span style={{ color: MW.mintDeep }}>{review.images.length}장</span>
                            </span>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,160px),1fr))', gap: 10 }}>
                                {review.images.map((src, i) => (
                                    <button
                                        key={src + i}
                                        type="button"
                                        onClick={() => setLightboxIdx(i)}
                                        aria-label={`후기 사진 ${i + 1} 크게 보기`}
                                        style={{ position: 'relative', display: 'block', aspectRatio: '1/1', borderRadius: 18, overflow: 'hidden', background: MW.chip, border: 0, padding: 0, cursor: 'zoom-in' }}
                                    >
                                        <img
                                            src={src}
                                            alt={`${review.author} 님의 후기 사진 ${i + 1}`}
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform .2s' }}
                                            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.transform = '')}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'center', padding: '28px 0', borderTop: `1px solid ${LINE_SOFT}`, borderBottom: `1px solid ${LINE_SOFT}` }}>
                        <button
                            type="button"
                            onClick={toggleHelpful}
                            disabled={helpfulSubmitting}
                            aria-pressed={helpful}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, height: 52, padding: '0 26px', borderRadius: 999, border: `1.5px solid ${helpful ? MW.mint : MW.line}`, background: helpful ? MW.mint : '#FFFFFF', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: helpfulSubmitting ? 'wait' : 'pointer', opacity: helpfulSubmitting ? 0.65 : 1, transition: 'all .15s' }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = MW.mint)}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = helpful ? MW.mint : MW.line)}
                        >
                            <ThumbIcon />
                            도움이 됐어요
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600 }}>{review.helpful}</span>
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
                            댓글 <span style={{ fontFamily: MW_FONT_EN, fontSize: 16, fontWeight: 600, color: MW.mintDeep }}>{comments.length}</span>
                        </h2>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                            <span style={{ width: 40, height: 40, borderRadius: '50%', background: MW_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 14, fontWeight: 600, color: MW.navy, flexShrink: 0 }}>
                                {me ? me.name.charAt(0).toUpperCase() : <PenIcon />}
                            </span>
                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', border: `1.5px solid ${MW.line}`, borderRadius: 18, background: '#fff', overflow: 'hidden' }}>
                                <textarea
                                    value={draft}
                                    onChange={(e) => setDraft(e.target.value)}
                                    rows={3}
                                    disabled={!me || posting}
                                    placeholder={me ? '후기에 대한 소감이나 질문을 남겨 보세요' : '댓글을 쓰려면 로그인해 주세요'}
                                    aria-label="댓글"
                                    style={{ border: 0, outline: 'none', resize: 'vertical', padding: '16px 18px 8px', fontFamily: 'inherit', fontSize: 14, lineHeight: 1.7, color: MW.navy, background: 'transparent' }}
                                />
                                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 10px 10px' }}>
                                    {me ? (
                                        <button
                                            type="button"
                                            onClick={postComment}
                                            disabled={!canPost}
                                            style={{ height: 38, padding: '0 20px', border: 0, borderRadius: 999, background: canPost ? MW.mint : MW.chip, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: canPost ? MW.navy : MW.mute2, cursor: canPost ? 'pointer' : 'default' }}
                                        >
                                            {posting ? '등록 중…' : '등록'}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/login', loginPath)}
                                            style={{ height: 38, padding: '0 20px', border: 0, borderRadius: 999, background: MW.mint, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                                        >
                                            로그인하고 댓글 쓰기
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                        {comments.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {comments.map((c) => (
                                    <div key={c.id} style={{ display: 'flex', gap: 12, padding: '16px 0', borderTop: `1px solid ${LINE_SOFT}` }}>
                                        <span style={{ width: 40, height: 40, borderRadius: '50%', background: MW.mintTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 14, fontWeight: 600, color: MW.mintDeep, flexShrink: 0 }}>
                                            {c.author.charAt(0).toUpperCase()}
                                        </span>
                                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <strong style={{ fontSize: 14 }}>{c.author}</strong>
                                                <span style={{ fontSize: 12, color: MW.mute2 }}>{formatRelativeTime(c.date, 'ko')}</span>
                                            </span>
                                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: MW.ink3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.content}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ padding: '36px 20px', borderRadius: 18, background: SOFT_BG, textAlign: 'center', fontSize: 13, color: MW.mute }}>첫 댓글을 남겨 보세요</div>
                        )}
                    </div>

                    {(prev || next) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 12 }}>
                            {prev && <PagerLink label="← 이전 후기" title={prev.heading} onClick={() => goReview(prev)} href={`/reviews/${prev.id}`} />}
                            {next && <PagerLink label="다음 후기 →" title={next.heading} onClick={() => goReview(next)} href={`/reviews/${next.id}`} alignRight />}
                        </div>
                    )}
                </article>

                <aside style={{ flex: '0 1 330px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: MW_STICKY_TOP + 24 }}>
                    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, background: 'linear-gradient(160deg,#0F2A3B 0%,#1C8571 100%)', color: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
                        {tour?.image && (
                            <span style={{ position: 'relative', display: 'block', aspectRatio: '16/10', background: 'rgba(255,255,255,0.08)' }}>
                                <img src={tour.image} alt={tour.name} loading="lazy" decoding="async" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </span>
                        )}
                        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintLight }}>REVIEWED TOUR</span>
                            <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.4 }}>{tour?.name || review.productName}</span>
                            {tour && (tour.duration || tour.summary) && (
                                <span style={{ fontSize: 13, lineHeight: 1.7, color: MW.mintTint, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {[tour.duration, tour.summary].filter(Boolean).join(' · ')}
                                </span>
                            )}
                            <AsideButton primary onClick={() => navigate(productPath || '/products')}>
                                {productPath ? '이 투어 보기' : '투어 목록 보기'}
                            </AsideButton>
                            <AsideButton onClick={() => navigate('/custom-estimate')}>같은 여행 견적 받기</AsideButton>
                        </div>
                    </div>
                    <div style={{ border: `1px solid ${MW.line}`, borderRadius: 24, padding: 20, background: '#fff', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 900, marginBottom: 8 }}>다른 후기</span>
                        {more.map((m) => (
                            <a
                                key={m.id}
                                href={`/reviews/${m.id}`}
                                onClick={(e) => { e.preventDefault(); goReview(m); }}
                                style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 12, margin: '0 -12px', borderRadius: 14, color: MW.navy, textDecoration: 'none' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = SOFT_BG)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                            >
                                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Stars rating={m.rating} size={11} spacing={1} />
                                    <span style={{ fontSize: 12, color: MW.mute }}>{m.author} 님</span>
                                </span>
                                <span style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                    {m.title || m.content.replace(/\s+/g, ' ')}
                                </span>
                            </a>
                        ))}
                        <a href="/reviews" onClick={(e) => { e.preventDefault(); navigate('/reviews'); }} style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: MW.mintDeep, textDecoration: 'none' }}>
                            전체 후기 보기 →
                        </a>
                    </div>
                </aside>
            </div>

            {lightboxIdx !== null && review.images.length > 0 && (
                <ImageLightbox images={review.images} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
            )}
        </section>
    );
}

function PagerLink({ label, title, href, onClick, alignRight }: { label: string; title: string; href: string; onClick: () => void; alignRight?: boolean }) {
    return (
        <a
            href={href}
            onClick={(e) => { e.preventDefault(); onClick(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '16px 20px', border: `1px solid ${MW.line}`, borderRadius: 18, color: MW.navy, textDecoration: 'none', textAlign: alignRight ? 'right' : 'left', minWidth: 0 }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = MW.mint)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = MW.line)}
        >
            <span style={{ fontSize: 12, color: MW.mute }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
        </a>
    );
}

function AsideButton({ primary, onClick, children }: { primary?: boolean; onClick: () => void; children: ReactNode }) {
    return (
        <button
            type="button"
            onClick={onClick}
            style={
                primary
                    ? { height: 50, border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }
                    : { height: 46, border: '1px solid rgba(255,255,255,0.35)', borderRadius: 999, background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }
            }
            onMouseEnter={(e) => {
                if (primary) e.currentTarget.style.opacity = '0.92';
                else e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
            }}
            onMouseLeave={(e) => {
                if (primary) e.currentTarget.style.opacity = '1';
                else e.currentTarget.style.background = 'transparent';
            }}
        >
            {children}
        </button>
    );
}

const LINE_SOFT = '#EEF1EF';
const SOFT_BG = '#F7FAF9';

const crumbLink: CSSProperties = { color: MW.mute, flexShrink: 0, textDecoration: 'none' };

const tourChip: CSSProperties = {
    alignSelf: 'flex-start',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    height: 36,
    padding: '0 16px',
    borderRadius: 999,
    background: MW.mintBg,
    border: `1px solid ${MW.mintTint}`,
    fontSize: 13,
    fontWeight: 700,
    color: MW.mintDeep,
    textDecoration: 'none',
    maxWidth: '100%',
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
