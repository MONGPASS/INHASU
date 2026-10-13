import { useNavigate } from 'react-router-dom';
import { MW, MW_EYEBROW, MW_SEE_ALL } from '../desktop-primitives/mwTokens';
import type { HomeReview } from './homeDesktopData';
import { ANIMALS, AnimalAvatar } from '../reviews-desktop/AnimalAvatar';

interface Props {
    reviews: HomeReview[];
}

export function ReviewCardsDesktop({ reviews }: Props) {
    const navigate = useNavigate();
    const items = reviews.slice(0, 4);
    if (items.length === 0) return null;

    return (
        <section id="reviews" style={{ marginTop: 104, background: '#FFFFFF' }}>
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <span style={MW_EYEBROW}>REAL REVIEWS</span>
                        <h2 style={{ margin: 0, fontSize: 32, fontWeight: 900 }}>실제 여행객 후기</h2>
                        <p style={{ margin: 0, fontSize: 14, color: MW.mute }}>한국어 가이드 동행으로 안심되는 몽골 투어, 고객님들의 생생한 이야기</p>
                    </div>
                    <a href="/reviews" onClick={(e) => { e.preventDefault(); navigate('/reviews'); }} style={MW_SEE_ALL}>
                        전체 보기 →
                    </a>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 20 }}>
                    {items.map((r, i) => (
                        <a
                            key={r.id || i}
                            href={`/reviews/${r.id}`}
                            onClick={(e) => { e.preventDefault(); navigate(`/reviews/${r.id}`); }}
                            style={{ background: '#fff', border: `1px solid ${MW.line}`, borderRadius: 22, padding: 26, display: 'flex', flexDirection: 'column', gap: 14, color: MW.navy, textDecoration: 'none', transition: 'border-color .15s' }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = MW.mintLight)}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = MW.line)}
                        >
                            <span style={{ color: MW.star, fontSize: 15, letterSpacing: 2 }} aria-label={`평점 ${r.rating} / 5`}>
                                {'★'.repeat(r.rating)}
                                <span style={{ color: MW.line2 }}>{'★'.repeat(5 - r.rating)}</span>
                            </span>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.85, color: MW.ink2, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                {r.content}
                            </p>
                            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 12, paddingTop: 14, borderTop: `1px solid ${MW.line3}` }}>
                                <span style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex' }}>
                                    <AnimalAvatar kind={ANIMALS[i % ANIMALS.length]} />
                                </span>
                                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                    <span style={{ fontSize: 14, fontWeight: 700 }}>{r.author ? `${r.author} 님` : '고객님'}</span>
                                    <span style={{ fontSize: 12, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.productName}</span>
                                </span>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </section>
    );
}
