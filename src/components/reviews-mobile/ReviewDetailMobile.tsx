import { useEffect, useState, type CSSProperties } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { formatRelativeTime } from '../../utils/formatDate';
import { ImageLightbox } from '../common/ImageLightbox';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { MobileShell } from '../mobile/MobileShell';
import { D, M_GRADIENT, M_HAIR, M_PAPER } from '../mobile/mobileTheme';
import { Ico, MLoading } from '../mobile/mobileUi';
import { AnimalAvatar } from '../reviews-desktop/AnimalAvatar';
import { useReviewTour, type DesktopReview } from '../reviews-desktop/reviewsData';
import { Stars, ThumbIcon } from '../reviews-desktop/reviewUi';
import { useReviewDetail } from './useReviewDetail';

/** Mobile review detail (Claude Design: "M Review Detail"). */
export function ReviewDetailMobile({ id }: { id: string }) {
    const navigate = useNavigate();
    const location = useLocation();
    // Opened directly (search result, shared link): there is no in-app history, so "back" means the list.
    const back = () => {
        if (location.key !== 'default') navigate(-1);
        else navigate('/reviews');
    };
    return (
        <MobileShell title="여행 후기" onBack={back}>
            <ReviewDetailBody key={id} id={id} onBack={back} />
        </MobileShell>
    );
}

/** Keyed by review id, so every piece of state resets on prev / next navigation. */
function ReviewDetailBody({ id, onBack }: { id: string; onBack: () => void }) {
    const navigate = useNavigate();
    const { loading, review, comments, me, canDelete, helpful, helpfulBusy, posting, prev, next, more, toggleHelpful, postComment, remove } = useReviewDetail(id);
    const tour = useReviewTour(review?.productId ?? '', review?.productName ?? '');
    const [draft, setDraft] = useState('');
    const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }, []);

    if (loading) return <MLoading pad={120} />;

    if (!review) {
        return (
            <section style={{ padding: '96px 16px 120px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>후기를 찾을 수 없습니다</p>
                <button type="button" onClick={() => navigate('/reviews')} style={outlineBtn}>후기 목록으로 돌아가기</button>
            </section>
        );
    }

    const paragraphs = review.content.split(/\n+/).map((p) => p.trim()).filter(Boolean);
    const productPath = tour ? `/products/${tour.id}` : review.productId ? `/products/${review.productId}` : '';
    const loginPath = { state: { from: `/reviews/${id}` } };
    const canPost = !!draft.trim() && !posting;

    const onHelpful = async () => {
        if (!me) {
            alert('\'도움이 됐어요\'를 누르려면 로그인해 주세요.');
            navigate('/login', loginPath);
            return;
        }
        if (!(await toggleHelpful())) alert('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    };

    const onPost = async () => {
        if (!canPost) return;
        if (await postComment(draft)) setDraft('');
        else alert('댓글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    };

    const onDelete = async () => {
        if (!window.confirm('이 후기를 삭제하시겠습니까?\n삭제하면 되돌릴 수 없습니다.')) return;
        try {
            await remove();
            navigate('/reviews');
        } catch (error) {
            console.error('Failed to delete review:', error);
            alert('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
    };

    return (
        <section style={{ padding: '14px 16px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <button type="button" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 14px 0 10px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>
                    <Ico d={D.back} size={16} color="currentColor" width={2} />
                    뒤로
                </button>
                {/* Not in the design: authors and admins could already delete from this screen. */}
                {canDelete && (
                    <button type="button" onClick={onDelete} style={{ height: 36, padding: '0 14px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.redDeep, cursor: 'pointer' }}>
                        삭제
                    </button>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex' }}>
                        <AnimalAvatar kind={review.animal} size={48} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <span style={{ fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{review.author} 님</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Stars rating={review.rating} size={14} spacing={2} />
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, color: MW.mute2 }}>{review.date}</span>
                        </span>
                    </span>
                </div>
                <h1 style={{ margin: 0, fontSize: 23, fontWeight: 900, lineHeight: 1.4, textWrap: 'pretty' }}>{review.heading}</h1>
                {productPath ? (
                    <a href={productPath} onClick={(e) => { e.preventDefault(); navigate(productPath); }} style={tourChip}>
                        <span style={chipText}>{review.productName}</span>
                        <span style={{ flexShrink: 0 }}>→</span>
                    </a>
                ) : (
                    <span style={tourChip}>
                        <span style={chipText}>{review.productName}</span>
                    </span>
                )}
            </div>

            {paragraphs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {paragraphs.map((p, i) => (
                        <p key={i} style={{ margin: 0, fontSize: 15, lineHeight: 1.95, color: MW.ink2, textWrap: 'pretty', overflowWrap: 'anywhere' }}>{p}</p>
                    ))}
                </div>
            )}

            {review.images.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 900 }}>
                        사진 <span style={{ color: MW.mintDeep }}>{review.images.length}장</span>
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6 }}>
                        {review.images.map((src, i) => (
                            <button
                                key={src + i}
                                type="button"
                                onClick={() => setLightboxIdx(i)}
                                aria-label={`후기 사진 ${i + 1} 크게 보기`}
                                style={{ position: 'relative', display: 'block', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', background: MW.chip, border: 0, padding: 0, cursor: 'zoom-in' }}
                            >
                                <img
                                    src={src}
                                    alt={`${review.author} 님의 후기 사진 ${i + 1}`}
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                                />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0', borderTop: `1px solid ${M_HAIR}`, borderBottom: `1px solid ${M_HAIR}` }}>
                <button
                    type="button"
                    onClick={onHelpful}
                    disabled={helpfulBusy}
                    aria-pressed={helpful}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, height: 48, padding: '0 24px', borderRadius: 999, border: `1.5px solid ${helpful ? MW.mint : MW.line}`, background: helpful ? MW.mint : '#FFFFFF', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: helpfulBusy ? 'wait' : 'pointer', opacity: helpfulBusy ? 0.65 : 1, whiteSpace: 'nowrap' }}
                >
                    <ThumbIcon />
                    도움이 됐어요
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600 }}>{review.helpful}</span>
                </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
                    댓글 <span style={{ fontFamily: MW_FONT_EN, fontSize: 14, fontWeight: 600, color: MW.mintDeep }}>{comments.length}</span>
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', border: `1.5px solid ${MW.line}`, borderRadius: 16, background: '#fff', overflow: 'hidden' }}>
                    <textarea
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        rows={3}
                        disabled={!me || posting}
                        placeholder={me ? '후기에 대한 소감이나 질문을 남겨 보세요' : '댓글을 쓰려면 로그인해 주세요'}
                        aria-label="댓글"
                        style={{ border: 0, outline: 'none', boxShadow: 'none', resize: 'none', padding: '14px 16px 6px', fontFamily: 'inherit', fontSize: 16, lineHeight: 1.6, color: MW.navy, background: 'transparent' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 8px 8px' }}>
                        {me ? (
                            <button
                                type="button"
                                onClick={onPost}
                                disabled={!canPost}
                                style={{ height: 38, padding: '0 18px', border: 0, borderRadius: 999, background: canPost ? MW.mint : MW.chip, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: canPost ? MW.navy : MW.mute2, cursor: canPost ? 'pointer' : 'default' }}
                            >
                                {posting ? '등록 중…' : '등록'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => navigate('/login', loginPath)}
                                style={{ height: 38, padding: '0 18px', border: 0, borderRadius: 999, background: MW.mint, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                            >
                                로그인하고 댓글 쓰기
                            </button>
                        )}
                    </div>
                </div>
                {comments.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {comments.map((c) => (
                            <div key={c.id} style={{ display: 'flex', gap: 10, padding: '14px 0', borderTop: `1px solid ${M_HAIR}` }}>
                                <span style={{ width: 36, height: 36, borderRadius: '50%', background: MW.mintTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 13, fontWeight: 600, color: MW.mintDeep, flexShrink: 0 }}>
                                    {c.author.charAt(0).toUpperCase()}
                                </span>
                                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, whiteSpace: 'nowrap' }}>
                                        <strong style={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.author}</strong>
                                        <span style={{ fontSize: 11, color: MW.mute2, flexShrink: 0 }}>{formatRelativeTime(c.date, 'ko')}</span>
                                    </span>
                                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: MW.ink3, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{c.content}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div style={{ padding: '28px 16px', borderRadius: 16, background: M_PAPER, textAlign: 'center', fontSize: 13, color: MW.mute }}>첫 댓글을 남겨 보세요</div>
                )}
            </div>

            {(prev || next) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                    {prev && <PagerLink label="← 이전 후기" review={prev} column={1} />}
                    {next && <PagerLink label="다음 후기 →" review={next} column={2} />}
                </div>
            )}

            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 22, background: 'linear-gradient(160deg,#0F2A3B 0%,#1C8571 100%)', color: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
                {tour?.image && (
                    <span style={{ position: 'relative', display: 'block', aspectRatio: '16/9', background: 'rgba(255,255,255,0.08)' }}>
                        <img
                            src={tour.image}
                            alt={tour.name}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    </span>
                )}
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintLight }}>REVIEWED TOUR</span>
                    <span style={{ fontSize: 17, fontWeight: 900, lineHeight: 1.4 }}>{tour?.name || review.productName}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
                        <button type="button" onClick={() => navigate(productPath || '/products')} style={{ height: 46, border: 0, borderRadius: 999, background: M_GRADIENT, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {productPath ? '투어 보기' : '투어 목록 보기'}
                        </button>
                        <button type="button" onClick={() => navigate('/custom-estimate')} style={{ height: 46, border: '1px solid rgba(255,255,255,0.4)', borderRadius: 999, background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            견적 받기
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 15, fontWeight: 900 }}>다른 후기</span>
                    <a href="/reviews" onClick={(e) => { e.preventDefault(); navigate('/reviews'); }} style={{ fontSize: 12, fontWeight: 700, color: MW.mintDeep, textDecoration: 'none' }}>전체 →</a>
                </div>
                {more.map((m) => (
                    <a
                        key={m.id}
                        href={`/reviews/${m.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/reviews/${m.id}`); }}
                        style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '12px 0', borderTop: `1px solid ${M_HAIR}`, color: MW.navy, textDecoration: 'none' }}
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
            </div>

            {lightboxIdx !== null && review.images.length > 0 && (
                <ImageLightbox images={review.images} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
            )}
        </section>
    );
}

function PagerLink({ label, review, column }: { label: string; review: DesktopReview; column: 1 | 2 }) {
    const navigate = useNavigate();
    const href = `/reviews/${review.id}`;
    return (
        <a
            href={href}
            onClick={(e) => { e.preventDefault(); navigate(href); }}
            style={{ gridColumn: column, display: 'flex', flexDirection: 'column', gap: 4, padding: 14, border: `1px solid ${MW.line}`, borderRadius: 16, color: MW.navy, textDecoration: 'none', textAlign: column === 2 ? 'right' : 'left', minWidth: 0 }}
        >
            <span style={{ fontSize: 11, color: MW.mute }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{review.heading}</span>
        </a>
    );
}

const tourChip: CSSProperties = {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    height: 34,
    padding: '0 14px',
    borderRadius: 999,
    background: MW.mintBg,
    border: `1px solid ${MW.mintTint}`,
    fontSize: 12,
    fontWeight: 700,
    color: MW.mintDeep,
    whiteSpace: 'nowrap',
    textDecoration: 'none',
};

const chipText: CSSProperties = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' };

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
