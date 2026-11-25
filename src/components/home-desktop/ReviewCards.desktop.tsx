import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { isUsableImage } from '../desktop-primitives/mwTokens';
import { SD, SD_CONTAINER, SIcon, SSectionHead, SStar } from '../site-seed/seed';
import { HOME_IMG } from '../home/homeContent';
import type { HomeProduct, HomeReview } from './homeDesktopData';

interface Props {
    reviews: HomeReview[];
    products: HomeProduct[];
}

const CARD = 240, GAP = 14;
/** 후기에 연결된 상품 사진이 없을 때 돌려 쓰는 사진. */
const FALLBACK = [HOME_IMG.winterGer, HOME_IMG.steppeGallop, HOME_IMG.winterLake, HOME_IMG.miniDesert, HOME_IMG.winterForest];

/** 믿고 보는 여행 리뷰: 사진 + 별점 + 세 줄 후기 + 상품·작성자. 옆으로 한 장씩 넘긴다. */
export function ReviewCardsDesktop({ reviews, products }: Props) {
    const navigate = useNavigate();
    const items = reviews.slice(0, 10);
    const viewport = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
    const [room, setRoom] = useState(0);

    useEffect(() => {
        const measure = () => {
            const width = viewport.current?.clientWidth || 0;
            setRoom(Math.max(0, items.length * CARD + Math.max(0, items.length - 1) * GAP - width));
        };
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [items.length]);

    if (items.length === 0) return null;

    const step = CARD + GAP;
    const maxIndex = Math.ceil(room / step);
    const shift = Math.min(index * step, room);
    const arrow = (side: 'left' | 'right') => ({ position: 'absolute', top: 120, [side]: -22, transform: 'translateY(-50%)', width: 44, height: 44, border: 'none', borderRadius: 9999,
        background: SD.white, color: SD.gray900, boxShadow: '0 2px 6px rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, zIndex: 1 } as const);

    return (
        <section id="reviews" style={{ ...SD_CONTAINER, paddingTop: 96, paddingBottom: 96, display: 'flex', flexDirection: 'column', gap: 28 }}>
            <SSectionHead icon="reviewStar" title="믿고 보는 여행 리뷰, REAL VIEW" sub="다녀온 분들이 직접 남긴 몽골 여행 후기예요" />
            <div role="region" aria-label="여행 후기 목록" style={{ position: 'relative' }}>
                <div ref={viewport} style={{ overflow: 'hidden', borderRadius: 12 }}>
                    <div style={{ display: 'flex', gap: GAP, transition: 'transform 300ms ease', transform: `translateX(${-shift}px)` }}>
                        {items.map((review, i) => {
                            const product = products.find((p) => p.id === review.productId);
                            const photo = product?.mainImages.find(isUsableImage) || FALLBACK[i % FALLBACK.length];
                            const href = review.productId ? `/products/${review.productId}` : '/reviews';
                            return (
                                <article key={review.id || i} style={{ flex: `0 0 ${CARD}px`, display: 'flex', flexDirection: 'column', border: `1px solid ${SD.gray200}`, borderRadius: 12, overflow: 'hidden', background: SD.white }}>
                                    <img src={photo} alt={`${review.productName} 여행 사진`} loading="lazy" decoding="async" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block', background: SD.gray100 }} />
                                    <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
                                        <span role="img" aria-label={`별점 5점 만점에 ${review.rating}점`} style={{ display: 'flex', gap: 1, color: SD.mint500 }}>
                                            {Array.from({ length: 5 }, (_, k) => <span key={k} style={{ display: 'flex', color: k < review.rating ? SD.mint500 : SD.gray300 }}><SStar /></span>)}
                                        </span>
                                        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: SD.gray900, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 65 }}>
                                            {review.content}
                                        </p>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, marginTop: 'auto', borderTop: `1px solid ${SD.gray200}` }}>
                                            <img src={photo} alt="" loading="lazy" decoding="async" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flex: 'none' }} />
                                            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                <a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }}
                                                    style={{ fontSize: 13, color: SD.gray700, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{review.productName}</a>
                                                {review.author && <span style={{ fontSize: 12, color: SD.gray600 }}>{review.author} 님</span>}
                                            </div>
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
                {index > 0 && <button type="button" aria-label="이전 후기" onClick={() => setIndex(index - 1)} style={arrow('left')}><SIcon name="chevronLeft" size={22} stroke={2} /></button>}
                {index < maxIndex && <button type="button" aria-label="다음 후기" onClick={() => setIndex(index + 1)} style={arrow('right')}><SIcon name="chevronRight" size={22} stroke={2} /></button>}
            </div>
            <a href="/reviews" onClick={(e) => { e.preventDefault(); navigate('/reviews'); }}
                style={{ alignSelf: 'center', marginTop: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, width: 176, height: 52, border: `1px solid ${SD.gray900}`,
                    borderRadius: 6, color: SD.gray900, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
                후기 더 보기<SIcon name="chevronRight" size={16} stroke={1.6} />
            </a>
        </section>
    );
}
