import { MW } from '../desktop-primitives/mwTokens';
import type { HomeReview } from '../home-desktop/homeDesktopData';
import { ANIMALS, AnimalAvatar } from '../reviews-desktop/AnimalAvatar';
import { linkTo, useGo } from './homeMobileData';
import { SectionHeadMobile } from './SectionHead.mobile';

/** "REAL REVIEWS": swipeable cards with the latest approved reviews. */
export function ReviewCardsMobile({ reviews }: { reviews: HomeReview[] }) {
    const go = useGo();
    const items = reviews.slice(0, 4);
    if (items.length === 0) return null;

    return (
        <section id="reviews" style={{ padding: '48px 0 0' }}>
            <SectionHeadMobile eyebrow="REAL REVIEWS" title="실제 여행객 후기" link="/reviews" />

            <div data-noscroll="" style={{ display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', padding: '18px 16px 2px', scrollPadding: '0 16px' }}>
                {items.map((r, i) => (
                    <a
                        key={r.id || i}
                        {...linkTo(go, `/reviews/${r.id}`)}
                        style={{ flex: '0 0 80%', minWidth: 0, scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', gap: 12, padding: 20, border: `1px solid ${MW.line}`, borderRadius: 22, background: '#fff', color: MW.navy, boxSizing: 'border-box', textDecoration: 'none' }}
                    >
                        <span style={{ color: MW.star, fontSize: 14, letterSpacing: 2 }} aria-label={`평점 ${r.rating} / 5`}>
                            {'★'.repeat(r.rating)}
                            <span style={{ color: MW.line2 }}>{'★'.repeat(5 - r.rating)}</span>
                        </span>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.85, color: MW.ink2, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {r.content}
                        </p>
                        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: `1px solid ${MW.line3}` }}>
                            <span style={{ width: 40, height: 40, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, display: 'flex' }}>
                                <AnimalAvatar kind={ANIMALS[i % ANIMALS.length]} />
                            </span>
                            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span style={{ fontSize: 13, fontWeight: 700 }}>{r.author ? `${r.author} 님` : '고객님'}</span>
                                <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.productName}</span>
                            </span>
                        </div>
                    </a>
                ))}
            </div>
        </section>
    );
}
