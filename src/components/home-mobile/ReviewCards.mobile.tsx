import { homeReviewPhoto, orderHomeReviews, type HomeProduct, type HomeReview } from '../home-desktop/homeDesktopData';
import { linkTo, useGo } from './homeMobileData';
import { MPhoto } from '../mobile/mobileUi';
import { SD, SIcon, SStar } from '../site-seed/seed';
import { HSCROLL, SectionHeadMobile } from './SectionHead.mobile';

/** 믿고 보는 여행 리뷰(휴대폰, 여행 후기의 실제 후기 — 사진 있는 후기 먼저, 누르면 후기 상세): 4:3 후기 사진 + 별점 + 세 줄 후기 + 상품·작성자 카드(240px)를 옆으로 넘긴다. 제목 옆 동그란 화살표가 후기 전체로. 후기가 없으면 구역을 뺀다. */
export function ReviewCardsMobile({ reviews, products }: { reviews: HomeReview[]; products: HomeProduct[] }) {
    const go = useGo();
    const items = orderHomeReviews(reviews).slice(0, 10);
    if (items.length === 0) return null;

    return (
        <section id="reviews" style={{ paddingTop: 44, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <SectionHeadMobile icon="reviewStar" title="믿고 보는 여행 리뷰, REAL VIEW" sub="다녀온 분들이 직접 남긴 몽골 여행 후기예요" link="/reviews" linkStyle="round" linkLabel="여행 후기 전체 보기" />
            <div data-noscroll="" style={{ ...HSCROLL, gap: 12 }}>
                {items.map((review, i) => {
                    const product = products.find((p) => p.id === review.productId);
                    const photo = homeReviewPhoto(review, product);
                    return (
                        <a key={review.id || i} {...linkTo(go, review.id ? `/reviews/${review.id}` : '/reviews')} style={{ textDecoration: 'none', color: SD.gray900, flex: '0 0 240px', display: 'flex', flexDirection: 'column', border: `1px solid ${SD.gray200}`, borderRadius: 12, overflow: 'hidden', background: SD.white }}>
                            <div style={{ position: 'relative', aspectRatio: '4 / 3', background: SD.gray100 }}>
                                {photo
                                    ? <MPhoto src={photo} alt={`${review.productName} 후기 사진`} sizes="240px" />
                                    : <span aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SD.gray400 }}><SIcon name="reviewStar" size={36} stroke={1.4} /></span>}
                            </div>
                            <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
                                <span role="img" aria-label={`별점 5점 만점에 ${review.rating}점`} style={{ display: 'flex', gap: 1 }}>
                                    {Array.from({ length: 5 }, (_, k) => <span key={k} style={{ display: 'flex', color: k < review.rating ? SD.mint500 : SD.gray300 }}><SStar size={12} /></span>)}
                                </span>
                                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: SD.gray900, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 58 }}>
                                    {review.content}
                                </p>
                                <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${SD.gray200}`, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                    <span style={{ fontSize: 12, color: SD.gray700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{review.productName}</span>
                                    {review.author && <span style={{ fontSize: 11, color: SD.gray600 }}>{review.author} 님</span>}
                                </div>
                            </div>
                        </a>
                    );
                })}
            </div>
        </section>
    );
}
