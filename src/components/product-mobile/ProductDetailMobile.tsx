import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../hooks/useWishlist';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import { MW, MW_FONT_EN, cleanTitle, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { useHomeReviews } from '../home-desktop/homeDesktopData';
import { MobileShell } from '../mobile/MobileShell';
import { useMobileShell } from '../mobile/mobileShellContext';
import { D, M_GRADIENT } from '../mobile/mobileTheme';
import { Ico, MPhoto, TypeBadge } from '../mobile/mobileUi';
import {
    BookingCard, CancelNote, DetailBlocks, DetailSection, DetailTabsBar, FaqList, IncludedCards, OverviewBody, PhotoOverlay, ReviewsBlock,
    SaveShareButtons, SectionHead, TourTitleBlock,
} from '../product/detail/DetailParts';
import { ItineraryAccordion } from '../product/detail/ItineraryAccordion';
import {
    detailFlags, detailTabs, summariseReviews, tourFacts, tourGallery, tourImageAlt, useRecentlyViewedTours, useRelatedTours, useSectionTabs,
    useTourFaqItems, useTourPricing, type TourDetailViewProps, type TourFact, type TourPricing,
} from '../product/detail/productDetailData';
import { TourCardMobile } from '../tours-mobile/TourCardMobile';
import { StartingPrice } from '../product/StartingPrice';

const TAB_ROW_H = 55;

/**
 * Mobile tour detail (Claude Design: "Milkyway Japan Mobile" — Tour Detail).
 * Owns the shell because the sticky action bar shares the headcount / total with the booking card.
 */
export function ProductDetailMobile(props: TourDetailViewProps) {
    const { product, onBook } = props;
    const pricing = useTourPricing(product);
    const wishlist = useWishlist();
    const fav = wishlist.has(product.id);
    const toggleFav = () => wishlist.toggle(product);

    // A tour opened from another tour's page starts at the top.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <MobileShell title="투어 상세" bottomBar={<TourActionBar fav={fav} onFav={toggleFav} people={pricing.people} total={pricing.total} onBook={onBook} />}>
            <TourDetailBody {...props} pricing={pricing} fav={fav} onFav={toggleFav} />
        </MobileShell>
    );
}

function TourDetailBody({ product, reviews, onBook, onShare, pricing, fav, onFav }: TourDetailViewProps & { pricing: TourPricing; fav: boolean; onFav: () => void }) {
    const { stickyTop } = useMobileShell();
    const tabs = useMemo(() => detailTabs(product), [product]);
    const { active, pick } = useSectionTabs(tabs, stickyTop + TAB_ROW_H + 14);
    const summary = useMemo(() => summariseReviews(reviews), [reviews]);
    const gallery = useMemo(() => tourGallery(product), [product]);
    const faq = useTourFaqItems(product);
    const flags = detailFlags(product);
    const facts = tourFacts(product, pricing.minPeople, true);
    const [photosOpen, setPhotosOpen] = useState(false);
    const title = cleanTitle(product.name) || product.name;

    return (
        <>
            <section style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <TourTitleBlock
                    product={product}
                    summary={summary}
                    compact
                    bookedFrom={5}
                    onReviews={() => pick('td-rev')}
                    typeBadge={(
                        <TypeBadge
                            type={product.packageType}
                            style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 10px', boxSizing: 'border-box', fontSize: 10, letterSpacing: '0.05em', background: product.packageType === 'full' ? MW.mintDeep : '#FFFFFF', border: `1px solid ${product.packageType === 'full' ? MW.mintDeep : '#A6E8D4'}` }}
                        />
                    )}
                    actions={<SaveShareButtons fav={fav} onFav={onFav} onShare={onShare} />}
                />
                <TourGallery images={gallery} name={product.name} onOpenAll={() => setPhotosOpen(true)} />
                {facts.length > 0 && <FactCard facts={facts} />}
            </section>

            <DetailTabsBar tabs={tabs} active={active} onPick={pick} top={stickyTop} padX={16} />

            <section style={{ padding: '36px 16px 0', display: 'flex', flexDirection: 'column', gap: 52 }}>
                <DetailSection>
                    <SectionHead id="td-about" eyebrow="ABOUT THIS TOUR" title="투어 소개" compact />
                    <OverviewBody product={product} compact />
                </DetailSection>

                {flags.hasDetail && (
                    <DetailSection>
                        <SectionHead id="td-detail" eyebrow="TOUR DETAILS" title="상세 정보" compact />
                        <DetailBlocks product={product} compact />
                    </DetailSection>
                )}

                {flags.hasItinerary && !flags.itineraryInDesign && (
                    <DetailSection>
                        <SectionHead id="td-plan" eyebrow="ITINERARY" title="일정" compact />
                        <ItineraryAccordion product={product} compact />
                    </DetailSection>
                )}

                {flags.hasIncluded && (
                    <DetailSection>
                        <SectionHead id="td-incl" eyebrow="WHAT'S INCLUDED" title="포함 사항" compact />
                        <IncludedCards product={product} />
                    </DetailSection>
                )}

                <DetailSection>
                    <SectionHead id="td-rev" eyebrow="REVIEWS" title="후기" compact right={<AllLink to="/reviews" />} />
                    <ReviewsBlock summary={summary} compact />
                </DetailSection>

                <DetailSection>
                    <SectionHead id="td-faq" eyebrow="NOTES & FAQ" title="유의 사항·FAQ" compact />
                    <FaqList items={faq} />
                </DetailSection>

                <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <BookingCard product={product} pricing={pricing} onBook={onBook} />
                    <CancelNote />
                </aside>
            </section>

            <RelatedTours productId={product.id} category={product.category} />
            <RecentlyViewed productId={product.id} />

            {photosOpen && <PhotoOverlay title={title} images={gallery} onClose={() => setPhotosOpen(false)} />}
        </>
    );
}

function AllLink({ to }: { to: string }) {
    const navigate = useNavigate();
    return (
        <a href={to} onClick={(e) => { e.preventDefault(); navigate(to); window.scrollTo(0, 0); }} style={{ fontSize: 13, fontWeight: 700, color: MW.mintDeep, whiteSpace: 'nowrap', textDecoration: 'none' }}>
            전체 보기 →
        </a>
    );
}

/** Swipeable gallery with the "1 / 5" counter; the counter (or a photo) opens every photo. */
function TourGallery({ images, name, onOpenAll }: { images: string[]; name: string; onOpenAll: () => void }) {
    const [index, setIndex] = useState(0);
    const slide: CSSProperties = { position: 'relative', flex: '0 0 100%', aspectRatio: '4/3', scrollSnapAlign: 'start', background: MW.chip };

    if (images.length === 0) {
        return (
            <div style={{ ...slide, flex: 'none', margin: '0 -16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: MW.mute }}>
                사진 준비 중입니다
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', margin: '0 -16px' }}>
            <div
                data-noscroll=""
                onScroll={(e) => {
                    const el = e.currentTarget;
                    const i = Math.round(el.scrollLeft / (el.clientWidth || 1));
                    if (i !== index) setIndex(i);
                }}
                style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
            >
                {images.map((img, i) => (
                    <div key={i} onClick={onOpenAll} style={slide}>
                        <ResponsiveProductImage
                            src={img}
                            alt={tourImageAlt(name, i)}
                            loading={i === 0 ? 'eager' : 'lazy'}
                            fetchPriority={i === 0 ? 'high' : 'auto'}
                            decoding="async"
                            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        />
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={onOpenAll}
                aria-label={`전체 사진 (${images.length}장) 보기`}
                style={{ position: 'absolute', right: 12, bottom: 12, height: 30, padding: '0 12px', border: 0, borderRadius: 999, background: 'rgba(10,31,46,0.7)', fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, color: '#FFFFFF', cursor: 'pointer' }}
            >
                {Math.min(index, images.length - 1) + 1} / {images.length}
            </button>
        </div>
    );
}

/** The compact fact card (기간·가이드·최소 인원·포함 사항). */
function FactCard({ facts }: { facts: TourFact[] }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${facts.length},minmax(0,1fr))`, borderRadius: 20, background: '#F7FAF9', padding: '16px 4px' }}>
            {facts.map((f, i) => (
                <div key={f.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 0, padding: '0 4px', textAlign: 'center', borderLeft: i ? `1px solid ${MW.line}` : 0 }}>
                    <span style={{ width: 40, height: 40, borderRadius: '50%', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Ico d={f.d} size={20} color={MW.mintDeep} />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, width: '100%' }}>
                        <span style={{ fontSize: 10, color: MW.mute2 }}>{f.label}</span>
                        <span style={{ fontSize: 12, fontWeight: 900, lineHeight: 1.35, color: MW.navy, wordBreak: 'keep-all', overflowWrap: 'anywhere' }}>{f.value}</span>
                    </span>
                </div>
            ))}
        </div>
    );
}

/** Sticky bottom bar: 찜, the running total and 예약하기. Replaces the tab bar on this screen. */
function TourActionBar({ fav, onFav, people, total, onBook }: { fav: boolean; onFav: () => void; people: number; total: number; onBook: () => void }) {
    return (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 30, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${MW.line}`, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', color: MW.navy }}>
            <button
                type="button"
                onClick={onFav}
                aria-pressed={fav}
                aria-label="찜하기"
                style={{ width: 48, height: 48, flexShrink: 0, borderRadius: '50%', border: `1.5px solid ${fav ? MW.mint : MW.line}`, background: fav ? MW.mintBg : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
            >
                <Ico d={D.heart} size={20} color={fav ? MW.mint : MW.navy} fill={fav ? MW.mint : 'none'} />
            </button>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap' }}>성인 {people}명 · 합계</span>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap' }}>{total > 0 ? won(total) : '요금 등록 필요'}</span>
            </span>
            <button type="button" onClick={onBook} disabled={total <= 0} style={{ height: 50, padding: '0 22px', border: 0, borderRadius: 999, background: M_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                예약하기
            </button>
        </div>
    );
}

const rowTitle: CSSProperties = { margin: 0, padding: '0 16px', fontSize: 18, fontWeight: 900, lineHeight: 1.4 };
const rowScroller: CSSProperties = { display: 'flex', gap: 12, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', padding: '2px 16px 6px', scrollPadding: '0 16px' };

/** 이런 투어도 추천해요: other published tours of the same category. */
function RelatedTours({ productId, category }: { productId: string; category: string }) {
    const tours = useRelatedTours(productId, category, 6);
    const { stats } = useHomeReviews();
    const wishlist = useWishlist();
    if (tours.length === 0) return null;
    return (
        <section style={{ paddingTop: 52, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={rowTitle}>이런 투어도 추천해요</h2>
            <div data-noscroll="" style={rowScroller}>
                {tours.map((p) => (
                    <div key={p.id} style={{ flex: '0 0 46%', minWidth: 0, scrollSnapAlign: 'start' }}>
                        <TourCardMobile p={p} stat={stats[p.id]} fav={wishlist.has(p.id)} onFav={() => wishlist.toggle(p)} />
                    </div>
                ))}
            </div>
        </section>
    );
}

/** 최근 본 상품 (signed-in visitors only). */
function RecentlyViewed({ productId }: { productId: string }) {
    const navigate = useNavigate();
    const items = useRecentlyViewedTours(productId);
    if (items.length === 0) return null;
    return (
        <section style={{ paddingTop: 44, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2 style={rowTitle}>최근 본 상품</h2>
            <div data-noscroll="" style={rowScroller}>
                {items.map((item) => (
                    <a
                        key={item.product_id}
                        href={`/products/${item.product_id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/products/${item.product_id}`); }}
                        style={{ flex: '0 0 132px', minWidth: 0, scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', gap: 6, color: MW.navy, textDecoration: 'none' }}
                    >
                        <span style={{ position: 'relative', display: 'block', aspectRatio: '1/1', borderRadius: 16, overflow: 'hidden', background: MW.chip }}>
                            <MPhoto src={isUsableImage(item.image) ? item.image : undefined} alt={`${item.title ?? ''} | 몽골 여행·몽골 투어`} />
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.title}</span>
                        <StartingPrice product={item} amountStyle={{ fontSize: 13, fontWeight: 900 }} />
                    </a>
                ))}
            </div>
        </section>
    );
}

/** Loading placeholder in the shape of the screen. */
export function ProductDetailMobileSkeleton() {
    const bar = (w: string | number, h: number, r = 8): CSSProperties => ({ width: w, height: h, borderRadius: r, background: MW.chip, flexShrink: 0 });
    return (
        <div aria-busy="true" aria-label="불러오는 중" style={{ padding: '20px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
                <span style={bar(72, 24, 999)} />
                <span style={bar(96, 24, 999)} />
                <span style={bar(64, 24, 999)} />
            </div>
            <span style={bar('88%', 26)} />
            <span style={bar('56%', 26)} />
            <span style={{ aspectRatio: '4/3', margin: '8px -16px 0', background: MW.chip }} />
            <span style={bar('100%', 104, 20)} />
            <span style={bar('100%', 16)} />
            <span style={bar('92%', 16)} />
            <span style={bar('70%', 16)} />
        </div>
    );
}
