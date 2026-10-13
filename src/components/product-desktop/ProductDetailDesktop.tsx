import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../../hooks/useWishlist';
import { productImageUrl } from '../../utils/productImage';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import { COMPANY_INFO, KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import { MW, MW_CONTAINER, MW_FONT_EN, MW_GRADIENT, MW_STICKY_TOP, cleanTitle, won } from '../desktop-primitives/mwTokens';
import { TypePill } from '../desktop-primitives/TypePill';
import { useHomeReviews } from '../home-desktop/homeDesktopData';
import {
    BookingCard, CancelNote, DetailBlocks, DetailSection, DetailTabsBar, FaqList, IncludedCards, OverviewBody, PhotoOverlay, ReviewsBlock,
    SaveShareButtons, SectionHead, TourTitleBlock,
} from '../product/detail/DetailParts';
import { ItineraryAccordion } from '../product/detail/ItineraryAccordion';
import {
    detailFlags, detailTabs, openConsult, summariseReviews, tourFacts, tourGallery, tourImageAlt, useRelatedTours, useSectionTabs,
    useTourFaqItems, useTourPricing, type TourDetailViewProps, type TourFact,
} from '../product/detail/productDetailData';
import { TourCardDesktop } from '../tours-desktop/TourCardDesktop';

const TAB_ROW_H = 55;
/** Where a section heading lands under the sticky nav + tab row. */
const SECTION_OFFSET = MW_STICKY_TOP + TAB_ROW_H + 24;
/** Sticky offset of the booking card. */
const ASIDE_TOP = MW_STICKY_TOP + TAB_ROW_H + 20;

/** PC tour detail (Claude Design: "Milkyway Japan Home" — Tour Detail). */
export function ProductDetailDesktop({ product, reviews, onBook, onShare }: TourDetailViewProps) {
    const navigate = useNavigate();
    const pricing = useTourPricing(product);
    const wishlist = useWishlist();
    const fav = wishlist.has(product.id);
    const tabs = useMemo(() => detailTabs(product), [product]);
    const { active, pick } = useSectionTabs(tabs, SECTION_OFFSET);
    const summary = useMemo(() => summariseReviews(reviews), [reviews]);
    const gallery = useMemo(() => tourGallery(product), [product]);
    const faq = useTourFaqItems(product);
    const flags = detailFlags(product);
    const facts = tourFacts(product, pricing.minPeople, false);
    const [photosOpen, setPhotosOpen] = useState(false);
    const [showBar, setShowBar] = useState(false);
    const asideRef = useRef<HTMLElement>(null);
    const title = cleanTitle(product.name) || product.name;

    // A tour opened from another tour's page starts at the top.
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }, []);

    // The bottom bar takes over once the booking card has scrolled out of view.
    useEffect(() => {
        const onScroll = () => {
            const rect = asideRef.current?.getBoundingClientRect();
            if (rect) setShowBar(rect.bottom < 0);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // On short windows the card is taller than the space under the tab row: stick it by its
    // bottom edge instead, so 예약하기 never ends up below the fold.
    useEffect(() => {
        const el = asideRef.current;
        if (!el) return;
        const place = () => {
            el.style.top = `${Math.min(ASIDE_TOP, window.innerHeight - el.offsetHeight - 16)}px`;
        };
        place();
        const observer = new ResizeObserver(place);
        observer.observe(el);
        window.addEventListener('resize', place);
        return () => {
            observer.disconnect();
            window.removeEventListener('resize', place);
        };
    }, []);

    const go = (to: string) => (e: { preventDefault: () => void }) => {
        e.preventDefault();
        navigate(to);
    };

    return (
        <div style={{ background: '#FFFFFF' }}>
            <section style={{ ...MW_CONTAINER, padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <nav aria-label="이동 경로" style={{ display: 'flex', gap: 8, fontSize: 13, color: MW.mute, whiteSpace: 'nowrap', minWidth: 0 }}>
                    <a href="/" onClick={go('/')} style={crumb}>홈</a>
                    <span aria-hidden="true">›</span>
                    <a href="/products" onClick={go('/products')} style={crumb}>투어 상품</a>
                    <span aria-hidden="true">›</span>
                    <span style={{ color: MW.navy, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                </nav>

                <TourTitleBlock
                    product={product}
                    summary={summary}
                    bookedFrom={1}
                    onReviews={() => pick('td-rev')}
                    typeBadge={<TypePill type={product.packageType} style={{ height: 24, padding: '0 10px', fontSize: 10 }} />}
                    actions={<SaveShareButtons fav={fav} onFav={() => wishlist.toggle(product)} onShare={onShare} />}
                />

                <TourGallery images={gallery} name={product.name} onOpen={() => setPhotosOpen(true)} />

                {facts.length > 0 && <FactRow facts={facts} />}
            </section>

            <DetailTabsBar tabs={tabs} active={active} onPick={pick} top={MW_STICKY_TOP} padX={24} zIndex={30} />

            {/* minmax(0, …) + minWidth 0: wide detail content must not push the booking card off screen. */}
            <section style={{ ...MW_CONTAINER, padding: '40px 24px 0', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 48, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 64 }}>
                    <DetailSection>
                        <SectionHead id="td-about" eyebrow="ABOUT THIS TOUR" title="투어 소개" />
                        <OverviewBody product={product} />
                    </DetailSection>

                    {flags.hasDetail && (
                        <DetailSection>
                            <SectionHead id="td-detail" eyebrow="TOUR DETAILS" title="상세 정보" />
                            <DetailBlocks product={product} />
                        </DetailSection>
                    )}

                    {flags.hasItinerary && !flags.itineraryInDesign && (
                        <DetailSection>
                            <SectionHead id="td-plan" eyebrow="ITINERARY" title="일정" />
                            <ItineraryAccordion product={product} />
                        </DetailSection>
                    )}

                    {flags.hasIncluded && (
                        <DetailSection>
                            <SectionHead id="td-incl" eyebrow="WHAT'S INCLUDED" title="포함 사항" />
                            <IncludedCards product={product} />
                        </DetailSection>
                    )}

                    <DetailSection>
                        <SectionHead
                            id="td-rev"
                            eyebrow="REVIEWS"
                            title="후기"
                            right={<a href="/reviews" onClick={go('/reviews')} style={{ fontSize: 13, fontWeight: 700, color: MW.mintDeep, whiteSpace: 'nowrap', textDecoration: 'none' }}>전체 보기 →</a>}
                        />
                        <ReviewsBlock summary={summary} />
                    </DetailSection>

                    <DetailSection>
                        <SectionHead id="td-faq" eyebrow="NOTES & FAQ" title="유의 사항·FAQ" />
                        <FaqList items={faq} />
                        <ContactCard />
                    </DetailSection>
                </div>

                <aside ref={asideRef} style={{ position: 'sticky', top: ASIDE_TOP, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <BookingCard product={product} pricing={pricing} onBook={onBook} />
                    <CancelNote />
                </aside>
            </section>

            <RelatedTours productId={product.id} category={product.category} />

            <div style={{ height: 104 }} />

            {showBar && (
                <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 100, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${MW.line}` }}>
                    <div style={{ ...MW_CONTAINER, padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 20 }}>
                        {gallery[0] && <img src={productImageUrl(gallery[0], 320)} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }} />}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 14, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</span>
                            <span style={{ fontSize: 12, color: MW.mute }}>성인 {pricing.people}명 · 1인 {won(pricing.unit)}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                            <span style={{ fontSize: 11, color: MW.mute }}>합계</span>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 20, fontWeight: 600 }}>{won(pricing.total)}</span>
                        </div>
                        <button type="button" onClick={openConsult} style={{ height: 48, padding: '0 22px', border: `1.5px solid ${MW.navy}`, borderRadius: 999, background: '#FFFFFF', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>무료 상담</button>
                        <button type="button" onClick={onBook} style={{ height: 48, padding: '0 28px', border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}>예약하기</button>
                    </div>
                </div>
            )}

            {photosOpen && <PhotoOverlay title={title} images={gallery} onClose={() => setPhotosOpen(false)} />}
        </div>
    );
}

const crumb: CSSProperties = { color: MW.mute, textDecoration: 'none' };

// ───────────────────────── gallery ─────────────────────────

function Tile({ src, alt, eager = false, style, onOpen, children }: { src: string; alt: string; eager?: boolean; style?: CSSProperties; onOpen: () => void; children?: ReactNode }) {
    return (
        <button type="button" onClick={onOpen} aria-label="전체 사진 보기" style={{ position: 'relative', width: '100%', height: '100%', minWidth: 0, minHeight: 0, padding: 0, border: 0, background: MW.chip, cursor: 'pointer', overflow: 'hidden', ...style }}>
            <ResponsiveProductImage
                src={src}
                alt={alt}
                loading={eager ? 'eager' : 'lazy'}
                fetchPriority={eager ? 'high' : 'auto'}
                decoding="async"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {children}
        </button>
    );
}

/** 1 large + up to 4 small photos; fewer photos get a layout without empty tiles. */
function TourGallery({ images, name, onOpen }: { images: string[]; name: string; onOpen: () => void }) {
    const frame: CSSProperties = { height: 'clamp(320px,38vw,460px)', borderRadius: 28, overflow: 'hidden' };
    const n = images.length;

    if (n === 0) {
        return <div style={{ ...frame, height: 320, background: MW.chip, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: MW.mute }}>사진 준비 중입니다</div>;
    }

    const shown = images.slice(0, 5);
    const columns = n === 1 ? 'minmax(0,1fr)' : n === 2 ? 'repeat(2,minmax(0,1fr))' : n === 3 ? 'minmax(0,2fr) minmax(0,1fr)' : 'minmax(0,2fr) minmax(0,1fr) minmax(0,1fr)';
    const rows = n <= 2 ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))';
    // With four photos the second one fills its column, like the large one.
    const span = (i: number): CSSProperties | undefined => (n >= 3 && (i === 0 || (n === 4 && i === 1)) ? { gridRow: '1 / span 2' } : undefined);

    return (
        <div style={{ ...frame, display: 'grid', gridTemplateColumns: columns, gridTemplateRows: rows, gap: 8 }}>
            {shown.map((img, i) => (
                <Tile key={i} src={img} alt={tourImageAlt(name, i)} eager={i === 0} style={span(i)} onOpen={onOpen}>
                    {n > 1 && i === shown.length - 1 && (
                        <span style={{ position: 'absolute', right: 14, bottom: 14, display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px', borderRadius: 999, background: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={MW.navy} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 4h16v16H4zM4 15l5-5 4 4 3-3 4 4" /></svg>
                            전체 사진 ({n})
                        </span>
                    )}
                </Tile>
            ))}
        </div>
    );
}

// ───────────────────────── facts ─────────────────────────

function FactRow({ facts }: { facts: TourFact[] }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 12 }}>
            {facts.map((f) => (
                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 20, background: '#F7FAF9', minWidth: 0 }}>
                    <span style={{ width: 44, height: 44, borderRadius: 14, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={MW.mintDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={f.d} /></svg>
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: MW.mute }}>{f.label}</span>
                        <span style={{ fontSize: 15, fontWeight: 900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.value}</span>
                    </span>
                </div>
            ))}
        </div>
    );
}

// ───────────────────────── contact ─────────────────────────

const CONTACTS: { d: string; label: string; sub?: string; href: string; external?: boolean }[] = [
    { d: 'M6 3h4l2 5-2.5 1.5a11 11 0 005 5L16 12l5 2v4a2 2 0 01-2 2A16 16 0 014 5a2 2 0 012-2z', label: '+976 9594 5838', sub: '평일 9:00-18:00 (KST)', href: 'tel:+97695945838' },
    { d: 'M3 6h18v12H3zM3 7l9 6 9-6', label: COMPANY_INFO.email, href: `mailto:${COMPANY_INFO.email}` },
    { d: 'M4 5h16v11H9l-5 4z', label: '카카오톡 상담', sub: '24시간 응대', href: KAKAO_CHANNEL_CHAT_URL, external: true },
];

/** 문의: phone, mail and the 카카오톡 채널 chat. */
function ContactCard() {
    return (
        <div style={{ marginTop: 12, padding: 22, borderRadius: 22, background: '#F7FAF9', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <span style={{ fontSize: 15, fontWeight: 900 }}>문의</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,200px),1fr))', gap: 12 }}>
                {CONTACTS.map((c) => (
                    <a key={c.label} href={c.href} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : null)} style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, color: MW.navy, textDecoration: 'none' }}>
                        <span style={{ width: 40, height: 40, borderRadius: 12, background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={MW.mintDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={c.d} /></svg>
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                            {c.sub && <span style={{ fontSize: 11, color: MW.mute }}>{c.sub}</span>}
                        </span>
                    </a>
                ))}
            </div>
        </div>
    );
}

// ───────────────────────── related tours ─────────────────────────

/** 비슷한 투어 찾기: other published tours of the same category. */
function RelatedTours({ productId, category }: { productId: string; category: string }) {
    const navigate = useNavigate();
    const tours = useRelatedTours(productId, category, 4);
    const { stats } = useHomeReviews();
    if (tours.length === 0) return null;
    return (
        <section style={{ ...MW_CONTAINER, padding: '88px 24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <SectionHead
                eyebrow="YOU MAY ALSO LIKE"
                title="비슷한 투어 찾기"
                right={(
                    <a href="/products" onClick={(e) => { e.preventDefault(); navigate('/products'); }} style={{ fontSize: 14, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap', textDecoration: 'none' }}>
                        전체 투어 보기 →
                    </a>
                )}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 20 }}>
                {tours.map((p) => <TourCardDesktop key={p.id} p={p} stat={stats[p.id]} />)}
            </div>
        </section>
    );
}

// ───────────────────────── loading ─────────────────────────

/** Loading placeholder in the shape of the screen. */
export function ProductDetailDesktopSkeleton() {
    const bar = (w: string | number, h: number, r = 10): CSSProperties => ({ width: w, height: h, borderRadius: r, background: MW.chip, flexShrink: 0 });
    return (
        <section aria-busy="true" aria-label="불러오는 중" style={{ ...MW_CONTAINER, padding: '20px 24px 160px', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <span style={bar(280, 16)} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <span style={bar(84, 24, 999)} />
                    <span style={bar(112, 24, 999)} />
                    <span style={bar(72, 24, 999)} />
                </div>
                <span style={bar('60%', 44)} />
                <span style={bar('36%', 16)} />
            </div>
            <span style={bar('100%', 420, 28)} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
                {[0, 1, 2, 3].map((i) => <span key={i} style={bar('100%', 76, 20)} />)}
            </div>
        </section>
    );
}
