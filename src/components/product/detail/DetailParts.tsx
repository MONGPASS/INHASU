import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { DesignBlockContent, DetailContentBlock, DetailSlide, DividerContent, ProductFAQ, TourProduct } from '../../../types/product';
import { ImageLightbox } from '../../common/ImageLightbox';
import { ResponsiveProductImage } from '../../common/ResponsiveProductImage';
import { MW, MW_FONT_EN, MW_GRADIENT, cleanTitle, won } from '../../desktop-primitives/mwTokens';
import type { DesktopReview } from '../../reviews-desktop/reviewsData';
import { durationLabel } from '../../tours-mobile/tourListFilters';
import { Stars } from '../../reviews-desktop/reviewUi';
import DesignBlockView from '../designTemplates/DesignBlockView';
import { DesignItinerary } from '../designTemplates/DesignItinerary';
import { priceRowsFromOptions } from '../designTemplates/pricing';
import {
    designShowsItinerary, detailFlags, openConsult, shortWon, tourDiscountPct, tourImageAlt,
    type DetailSectionId, type DetailTab, type ReviewSummary, type ShareResult, type TourPricing,
} from './productDetailData';

/**
 * Building blocks of the redesigned tour detail (Claude Design: Tour Detail), shared by the
 * PC and mobile screens. `compact` switches to the mobile sizes of the same design.
 */

const ICON = {
    heart: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
    share: 'M18 8a3 3 0 100-6 3 3 0 000 6zM6 15a3 3 0 100-6 3 3 0 000 6zM18 22a3 3 0 100-6 3 3 0 000 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
    check: 'M5 12l5 5 9-10',
    cross: 'M6 6l12 12M18 6L6 18',
    down: 'M6 9l6 6 6-6',
    chat: 'M4 5h16v11H9l-5 4z',
    shield: 'M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5',
} as const;

function Svg({ d, size, color, width = 1.8, fill = 'none', style }: { d: string; size: number; color: string; width?: number; fill?: string; style?: CSSProperties }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
            <path d={d} />
        </svg>
    );
}

const hideBroken = (e: { currentTarget: HTMLImageElement }) => {
    e.currentTarget.style.visibility = 'hidden';
};

// ───────────────────────── header ─────────────────────────

const chip: CSSProperties = { height: 24, padding: '0 10px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' };
const pillBtn: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 18px', borderRadius: 999, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' };

/** 찜 / 공유 pills next to the title. */
export function SaveShareButtons({ fav, onFav, onShare }: { fav: boolean; onFav: () => void; onShare: () => Promise<ShareResult> }) {
    const [copied, setCopied] = useState(false);
    const share = async () => {
        const result = await onShare();
        if (result === 'copied') setCopied(true);
    };
    return (
        <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={onFav} aria-pressed={fav} style={{ ...pillBtn, border: `1.5px solid ${fav ? MW.mint : MW.line}`, background: fav ? MW.mintBg : '#FFFFFF' }}>
                <Svg d={ICON.heart} size={18} color={fav ? MW.mint : MW.navy} fill={fav ? MW.mint : 'none'} />
                {fav ? '찜 완료' : '찜하기'}
            </button>
            <button type="button" onClick={share} aria-label="이 투어 공유하기" style={{ ...pillBtn, border: `1.5px solid ${MW.line}`, background: '#FFFFFF' }}>
                <Svg d={ICON.share} size={17} color={MW.navy} />
                {copied ? '복사 완료' : '공유'}
            </button>
        </div>
    );
}

/** Badge row, title, tag line and the 찜 / 공유 buttons. */
export function TourTitleBlock({
    product, typeBadge, summary, compact = false, bookedFrom, onReviews, actions,
}: {
    product: TourProduct;
    /** 풀패키지 / 실속형 pill (platform primitive). */
    typeBadge: ReactNode;
    summary: ReviewSummary;
    compact?: boolean;
    /** Show "누적 N명 예약" from this many bookings. */
    bookedFrom: number;
    onReviews: () => void;
    actions: ReactNode;
}) {
    const off = tourDiscountPct(product);
    const tags = (product.tags ?? []).filter(Boolean);
    const booked = product.bookingCount ?? 0;
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, flex: compact ? '1 1 100%' : '1 1 520px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {typeBadge}
                    {product.category && <span style={{ ...chip, background: MW.mintBg, color: MW.mintDeep }}>{product.category}</span>}
                    {product.duration && <span style={{ ...chip, background: '#F4F6F5', color: MW.ink3 }}>{durationLabel(product.duration)}</span>}
                    {off > 0 && <span style={{ ...chip, background: MW.red, color: '#FFFFFF', fontFamily: MW_FONT_EN, fontSize: 10 }}>{off}% OFF</span>}
                    {summary.count > 0 && (
                        <a
                            href="#td-rev"
                            onClick={(e) => { e.preventDefault(); onReviews(); }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, color: MW.mute, textDecoration: 'none' }}
                        >
                            <span style={{ color: MW.star }}>★</span>
                            <strong style={{ color: MW.navy }}>{summary.avg.toFixed(1)}</strong> (후기 {summary.count}건)
                        </a>
                    )}
                    {booked >= bookedFrom && booked > 0 && (
                        <span style={{ fontSize: 13, color: MW.mute, whiteSpace: 'nowrap' }}>
                            누적 <strong style={{ color: MW.navy }}>{booked}명</strong> 예약
                        </span>
                    )}
                </div>
                <h1 style={{ margin: 0, fontSize: compact ? 22 : 'clamp(28px,3.4vw,40px)', fontWeight: 900, lineHeight: compact ? 1.4 : 1.3, letterSpacing: '-0.01em', textWrap: 'pretty' }}>
                    {cleanTitle(product.name) || product.name}
                </h1>
                {tags.length > 0 && <p style={{ margin: 0, fontSize: compact ? 13 : 14, lineHeight: 1.6, color: MW.mute }}>{tags.join(' · ')}</p>}
            </div>
            {actions}
        </div>
    );
}

// ───────────────────────── sticky tabs ─────────────────────────

export function DetailTabsBar({ tabs, active, onPick, top, padX, zIndex = 15 }: { tabs: DetailTab[]; active: DetailSectionId; onPick: (id: DetailSectionId) => void; top: number; padX: number; zIndex?: number }) {
    const navRef = useRef<HTMLElement>(null);

    // Keep the active tab in view when the row scrolls sideways (mobile).
    useEffect(() => {
        const nav = navRef.current;
        const btn = nav?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
        if (!nav || !btn || nav.scrollWidth <= nav.clientWidth) return;
        nav.scrollTo({ left: btn.offsetLeft - (nav.clientWidth - btn.clientWidth) / 2, behavior: 'smooth' });
    }, [active]);

    return (
        <div style={{ position: 'sticky', top, zIndex, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${MW.line}`, marginTop: 36 }}>
            <nav ref={navRef} data-noscroll="" aria-label="투어 상세 목차" style={{ maxWidth: 1200, margin: '0 auto', padding: `0 ${padX}px`, boxSizing: 'border-box', display: 'flex', gap: 28, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {tabs.map((t) => {
                    const on = t.id === active;
                    return (
                        <button
                            key={t.id}
                            type="button"
                            data-tab={t.id}
                            aria-current={on ? 'true' : undefined}
                            onClick={() => onPick(t.id)}
                            style={{
                                flexShrink: 0, height: 54, padding: '0 2px', border: 0, borderBottom: `3px solid ${on ? MW.mint : 'transparent'}`, background: 'transparent',
                                fontFamily: 'inherit', fontSize: 14, fontWeight: on ? 900 : 700, color: on ? MW.navy : MW.mute, cursor: 'pointer', whiteSpace: 'nowrap',
                            }}
                        >
                            {t.label}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
}

// ───────────────────────── sections ─────────────────────────

export function SectionHead({ id, eyebrow, title, compact = false, right }: { id?: DetailSectionId; eyebrow: string; title: string; compact?: boolean; right?: ReactNode }) {
    const head = (
        <div id={id} style={{ display: 'flex', flexDirection: 'column', gap: 6, scrollMarginTop: 140, minWidth: 0 }}>
            <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintDeep }}>{eyebrow}</span>
            <h2 style={{ margin: 0, fontSize: compact ? 22 : 26, fontWeight: 900, lineHeight: 1.3 }}>{title}</h2>
        </div>
    );
    if (!right) return head;
    return <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 }}>{head}{right}</div>;
}

export function DetailSection({ children }: { children: ReactNode }) {
    return <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>{children}</div>;
}

/** 투어 소개: the admin-written description (HTML). */
export function OverviewBody({ product, compact = false }: { product: TourProduct; compact?: boolean }) {
    const text: CSSProperties = { margin: 0, fontSize: compact ? 15 : 16, lineHeight: compact ? 1.9 : 2, color: MW.ink2, textWrap: 'pretty', overflowWrap: 'anywhere' };
    if (product.description) {
        return <div style={{ ...text, whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: product.description }} />;
    }
    return (
        <p style={text}>
            몽골의 대자연을 만끽하는{product.duration ? ` ${durationLabel(product.duration)}` : ''} 투어입니다.
            한국어로 응대하는 스태프와 한국어 가이드가 동행하며, 현지 여행사만의 세심한 안내로 안심하고 즐기실 수 있습니다.
        </p>
    );
}

/** A titled photo group: swipeable on mobile, a grid on PC. `bleed` = the parent runs edge to edge (mobile). */
export function SlideGroup({ slide, productName, compact, bleed = false }: { slide: DetailSlide; productName: string; compact: boolean; bleed?: boolean }) {
    const images = (slide.images ?? []).filter(Boolean);
    if (images.length === 0) return null;
    const alt = (i: number) => `${slide.title || productName} ${i + 1} | 몽골 여행·몽골 투어`;
    const counter = (i: number) => (
        <span style={{ position: 'absolute', right: 10, bottom: 10, height: 24, padding: '0 10px', borderRadius: 999, background: 'rgba(10,31,46,0.7)', display: 'flex', alignItems: 'center', fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, color: '#FFFFFF' }}>
            {i + 1} / {images.length}
        </span>
    );
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: bleed ? '0 16px' : 0, minWidth: 0 }}>
            {slide.title && <h3 style={{ margin: 0, fontSize: compact ? 16 : 18, fontWeight: 900, lineHeight: 1.4 }}>{slide.title}</h3>}
            {compact ? (
                <div data-noscroll="" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', ...(bleed ? { margin: '0 -16px', padding: '0 16px', scrollPadding: '0 16px' } : null) }}>
                    {images.map((img, i) => (
                        <div key={i} style={{ position: 'relative', flex: images.length === 1 ? '0 0 100%' : '0 0 85%', scrollSnapAlign: 'start' }}>
                            <ResponsiveProductImage src={img} alt={alt(i)} loading="lazy" decoding="async" onError={hideBroken} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 16 }} />
                            {images.length > 1 && counter(i)}
                        </div>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: images.length === 1 ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))', gap: 12 }}>
                    {images.map((img, i) => (
                        <div key={i} style={{ position: 'relative', aspectRatio: images.length === 1 ? '16/9' : '3/4', borderRadius: 20, overflow: 'hidden', background: MW.chip }}>
                            <ResponsiveProductImage src={img} alt={alt(i)} loading="lazy" decoding="async" onError={hideBroken} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            {images.length > 2 && counter(i)}
                        </div>
                    ))}
                </div>
            )}
            {slide.description && <p style={{ margin: 0, fontSize: compact ? 13 : 14, lineHeight: 1.8, color: MW.ink3, whiteSpace: 'pre-wrap' }}>{slide.description}</p>}
        </div>
    );
}

/**
 * 상세 정보: the admin-authored detail content (long images, slides, dividers, design templates).
 * A design template draws the day-by-day itinerary inside itself; that slot is the 일정 tab target.
 */
export function DetailBlocks({ product, compact = false }: { product: TourProduct; compact?: boolean }) {
    const blocks: DetailContentBlock[] = product.detailBlocks ?? [];
    const { hasItinerary } = detailFlags(product);
    const variant = compact ? 'mobile' : 'desktop';
    const imageStyle: CSSProperties = { width: '100%', height: 'auto', display: 'block', borderRadius: compact ? 0 : 16 };
    // Mobile detail content runs edge to edge, like the uploaded long artwork it usually is.
    const wrap: CSSProperties = { display: 'flex', flexDirection: 'column', gap: compact ? 24 : 28, margin: compact ? '0 -16px' : 0, minWidth: 0 };
    const priceRows = priceRowsFromOptions(product.pricingOptions);
    // The first template that draws the itinerary carries the 일정 tab's anchor.
    const planAnchor = blocks.findIndex((b) => b.type === 'design' && designShowsItinerary(b.content as DesignBlockContent));

    if (blocks.length > 0) {
        return (
            <div style={wrap}>
                {blocks.map((b, i) => {
                    const key = b.id || i;
                    if (b.type === 'image') {
                        const url = typeof b.content === 'string' ? b.content : '';
                        if (!url) return null;
                        return <ResponsiveProductImage key={key} src={url} alt={`${product.name} 상세 ${i + 1} | 몽골 여행·몽골 투어`} loading="lazy" decoding="async" onError={hideBroken} style={imageStyle} />;
                    }
                    if (b.type === 'slide') return <SlideGroup key={key} slide={b.content as DetailSlide} productName={product.name} compact={compact} bleed={compact} />;
                    if (b.type === 'divider') {
                        const divider = b.content as DividerContent;
                        return <div key={key} style={{ height: divider.height, margin: compact ? '0 16px' : 0, borderBottom: divider.style === 'line' ? `1px solid ${MW.line}` : 'none' }} />;
                    }
                    if (b.type === 'design') {
                        return (
                            <div key={key} style={{ borderRadius: compact ? 0 : 20, overflow: 'hidden' }}>
                                <DesignBlockView
                                    content={b.content as DesignBlockContent}
                                    variant={variant}
                                    itinerarySlot={hasItinerary ? (
                                        <div id={i === planAnchor ? 'td-plan' : undefined} style={{ scrollMarginTop: 140 }}>
                                            <DesignItinerary product={product} variant={variant} />
                                        </div>
                                    ) : undefined}
                                    valueOverrides={priceRows ? { price_rows: priceRows } : undefined}
                                />
                            </div>
                        );
                    }
                    return null;
                })}
            </div>
        );
    }

    return (
        <div style={wrap}>
            {(product.detailImages ?? []).map((img, i) => (
                <ResponsiveProductImage key={i} src={img} alt={`${product.name} 상세 ${i + 1} | 몽골 여행·몽골 투어`} loading="lazy" decoding="async" onError={hideBroken} style={imageStyle} />
            ))}
            {(product.detailSlides ?? []).map((s) => (
                <SlideGroup key={s.id} slide={s} productName={product.name} compact={compact} bleed={compact} />
            ))}
        </div>
    );
}

/** 포함 사항 / 불포함 사항 cards from the tour's own lists. */
export function IncludedCards({ product }: { product: TourProduct }) {
    const included = (product.included ?? []).filter(Boolean);
    const excluded = (product.excluded ?? []).filter(Boolean);
    const card: CSSProperties = { padding: 22, borderRadius: 22, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 };
    const row: CSSProperties = { display: 'flex', gap: 10, fontSize: 14, lineHeight: 1.6 };
    return (
        <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 12 }}>
                {included.length > 0 && (
                    <div style={{ ...card, background: MW.mintBg }}>
                        <span style={{ fontSize: 15, fontWeight: 900, color: MW.mintDeep }}>포함 사항</span>
                        {included.map((x, i) => (
                            <span key={i} style={{ ...row, color: MW.navy }}><Svg d={ICON.check} size={18} color={MW.mintDeep} width={2.2} style={{ marginTop: 2 }} />{x}</span>
                        ))}
                    </div>
                )}
                {excluded.length > 0 && (
                    <div style={{ ...card, background: '#F7F7F7' }}>
                        <span style={{ fontSize: 15, fontWeight: 900, color: MW.mute }}>불포함 사항</span>
                        {excluded.map((x, i) => (
                            <span key={i} style={{ ...row, color: MW.ink3 }}><Svg d={ICON.cross} size={18} color={MW.mute2} width={2} style={{ marginTop: 2 }} />{x}</span>
                        ))}
                    </div>
                )}
            </div>
            <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: MW.mute }}>국제선 항공권 준비도 도와드립니다. 비자 필요 여부는 출발 시점의 규정에 따라 달라질 수 있어, 예약 시 안내해 드립니다.</p>
        </>
    );
}

// ───────────────────────── reviews ─────────────────────────

function ReviewCard({ r, compact }: { r: DesktopReview; compact: boolean }) {
    const navigate = useNavigate();
    const href = r.id ? `/reviews/${r.id}` : undefined;
    const open = (e: MouseEvent) => {
        e.preventDefault();
        if (href) navigate(href);
    };
    const photos = r.images.slice(0, 4);
    const thumbs = photos.length > 0 && (
        <span style={{ display: 'flex', gap: 6 }}>
            {photos.map((img, i) => (
                <ResponsiveProductImage key={i} src={img} alt={`${r.author} 님의 후기 사진 ${i + 1}`} loading="lazy" decoding="async" onError={hideBroken} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
            ))}
        </span>
    );
    const body = (
        <p style={{ margin: 0, fontSize: compact ? 12 : 13, lineHeight: compact ? 1.75 : 1.8, color: MW.ink3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.content}</p>
    );

    if (compact) {
        return (
            <a href={href} onClick={open} style={{ flex: '0 0 82%', scrollSnapAlign: 'start', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10, padding: 16, border: `1px solid ${MW.line}`, borderRadius: 18, background: '#FFFFFF', color: MW.navy, minWidth: 0, textDecoration: 'none' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: MW.mintTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: MW.mintDeep }}>{r.author.charAt(0)}</span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.author} 님</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Stars rating={r.rating} size={11} spacing={1} />
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 9, color: MW.mute2 }}>{r.date}</span>
                        </span>
                    </span>
                </span>
                {r.title && <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>}
                {body}
                {thumbs}
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid #EEF1EF', fontSize: 11, color: MW.mute }}>
                    <span>도움이 됐어요 {r.helpful}</span>
                    {href && <span style={{ fontWeight: 700, color: MW.mintDeep }}>자세히 보기 →</span>}
                </span>
            </a>
        );
    }

    return (
        <a
            href={href}
            onClick={open}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 20, border: `1px solid ${MW.line}`, borderRadius: 20, color: MW.navy, minWidth: 0, textDecoration: 'none', transition: 'border-color .15s' }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = MW.mint)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = MW.line)}
        >
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.author} 님</span>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, color: MW.mute2, flexShrink: 0 }}>{r.date}</span>
            </span>
            <Stars rating={r.rating} size={13} spacing={1} />
            {r.title && <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.45 }}>{r.title}</span>}
            {body}
            {thumbs}
        </a>
    );
}

/** Rating summary (real average + per-star counts) and the review cards. */
export function ReviewsBlock({ summary, compact = false }: { summary: ReviewSummary; compact?: boolean }) {
    const [all, setAll] = useState(false);
    const { list, count, avg, dist } = summary;

    if (count === 0) {
        return (
            <div style={{ padding: compact ? '28px 20px' : '36px 24px', borderRadius: 22, background: '#F7FAF9', textAlign: 'center', fontSize: 14, lineHeight: 1.8, color: MW.mute }}>
                이 투어에는 아직 후기가 없습니다. 참가 후 소중한 후기를 남겨 주세요.
            </div>
        );
    }

    const filled = Math.round(avg);
    const shown = compact ? list.slice(0, 10) : all ? list : list.slice(0, 4);

    return (
        <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '22px 24px', borderRadius: 22, background: 'linear-gradient(160deg,#0F2A3B 0%,#1C8571 100%)', color: '#FFFFFF', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 44, fontWeight: 600, lineHeight: 1 }}>{avg.toFixed(1)}</span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span role="img" aria-label={`별점 5점 만점에 ${avg.toFixed(1)}점`} style={{ color: '#F2B544', fontSize: 16, letterSpacing: 2 }}>
                        {'★'.repeat(filled)}<span style={{ color: 'rgba(255,255,255,0.3)' }}>{'★'.repeat(5 - filled)}</span>
                    </span>
                    <span style={{ fontSize: 13, color: MW.mintTint }}>후기 {count}건</span>
                </span>
                <span style={{ flex: 1 }} />
                <div style={{ display: 'flex', gap: compact ? 18 : 24 }}>
                    {dist.map((d) => (
                        <span key={d.star} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: d.count > 0 ? 1 : 0.5 }}>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 16, fontWeight: 600 }}>{d.count}</span>
                            <span style={{ fontSize: 11, color: MW.mintTint, whiteSpace: 'nowrap' }}>★{d.star}</span>
                        </span>
                    ))}
                </div>
            </div>
            {compact ? (
                <div data-noscroll="" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', margin: '0 -16px', padding: '2px 16px 6px', scrollPadding: '0 16px' }}>
                    {shown.map((r, i) => <ReviewCard key={r.id || i} r={r} compact />)}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,260px),1fr))', gap: 12 }}>
                    {shown.map((r, i) => <ReviewCard key={r.id || i} r={r} compact={false} />)}
                </div>
            )}
            {!compact && !all && list.length > shown.length && (
                <button type="button" onClick={() => setAll(true)} style={{ alignSelf: 'flex-start', height: 46, padding: '0 22px', border: `1.5px solid ${MW.navy}`, borderRadius: 999, background: '#FFFFFF', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>
                    후기 {count}건 전체 보기
                </button>
            )}
        </>
    );
}

// ───────────────────────── FAQ ─────────────────────────

export function FaqList({ items }: { items: ProductFAQ[] }) {
    const [open, setOpen] = useState<number | null>(0);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', borderTop: `1px solid ${MW.line}` }}>
            {items.map((item, i) => {
                const on = open === i;
                return (
                    <div key={i} style={{ borderBottom: `1px solid ${MW.line}` }}>
                        <button
                            type="button"
                            onClick={() => setOpen(on ? null : i)}
                            aria-expanded={on}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '20px 4px', border: 0, background: 'transparent', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: MW.navy }}
                        >
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 14, fontWeight: 600, color: MW.mintDeep }}>Q</span>
                            <span style={{ flex: 1, fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>{item.q}</span>
                            <Svg d={ICON.down} size={18} color={MW.mute2} width={2} style={{ transform: `rotate(${on ? 180 : 0}deg)`, transition: 'transform .2s' }} />
                        </button>
                        <p hidden={!on} style={{ margin: '0 0 20px', padding: '16px 18px', borderRadius: 16, background: '#F7FAF9', fontSize: 14, lineHeight: 1.8, color: MW.ink3, whiteSpace: 'pre-wrap' }}>{item.a}</p>
                    </div>
                );
            })}
        </div>
    );
}

// ───────────────────────── booking card ─────────────────────────

/** Price, headcount (per-headcount tiers) and the two CTAs. The date is chosen on the booking page. */
export function BookingCard({ product, pricing, onBook }: { product: TourProduct; pricing: TourPricing; onBook: () => void }) {
    const { options, people, unit, total } = pricing;
    const off = tourDiscountPct(product);
    // The original price belongs to the tour's "from" price; do not strike it against a dearer tier.
    const showOff = off > 0 && unit <= product.price;
    const stepBtn: CSSProperties = { width: 40, height: 40, border: 0, borderRadius: '50%', fontSize: 18, lineHeight: 1, color: MW.navy, padding: 0 };

    return (
        <div style={{ border: `1px solid ${MW.line}`, borderRadius: 28, background: '#FFFFFF', overflow: 'hidden' }}>
            <div style={{ padding: '24px 24px 20px', background: 'linear-gradient(160deg,#F1FCF8 0%,#FFFFFF 100%)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: MW.mute }}>
                    1인 요금
                    {showOff && <span style={{ textDecoration: 'line-through', color: MW.mute2 }}>{won(product.originalPrice!)}</span>}
                    {showOff && <span style={{ height: 20, padding: '0 8px', borderRadius: 999, background: MW.red, display: 'inline-flex', alignItems: 'center', fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 700, color: '#FFFFFF' }}>{off}% OFF</span>}
                </span>
                <span style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 34, fontWeight: 600, color: MW.navy, letterSpacing: '-0.02em' }}>{won(unit)}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: MW.mute }}>~ / 1인</span>
                </span>
            </div>
            <div style={{ padding: '20px 24px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: 13, fontWeight: 900 }}>인원</span>
                        {pricing.groupSaves && <span style={{ fontSize: 11, color: MW.mintDeep, fontWeight: 700 }}>인원이 많을수록 이득</span>}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56, padding: '0 8px 0 18px', borderRadius: 16, border: `1.5px solid ${MW.line}`, boxSizing: 'border-box' }}>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>성인 {people}명</span>
                        <span style={{ display: 'flex', gap: 6 }}>
                            <button type="button" onClick={pricing.dec} disabled={!pricing.canDec} aria-label="줄이기" style={{ ...stepBtn, background: '#F1F4F3', cursor: pricing.canDec ? 'pointer' : 'default', opacity: pricing.canDec ? 1 : 0.4 }}>−</button>
                            <button type="button" onClick={pricing.inc} disabled={!pricing.canInc} aria-label="늘리기" style={{ ...stepBtn, background: MW.mint, cursor: pricing.canInc ? 'pointer' : 'default', opacity: pricing.canInc ? 1 : 0.4 }}>+</button>
                        </span>
                    </div>
                    {options.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(options.length, 5)},minmax(0,1fr))`, gap: 4 }}>
                            {options.map((o) => {
                                const on = o.people === people;
                                return (
                                    <button
                                        key={o.people}
                                        type="button"
                                        aria-pressed={on}
                                        aria-label={`${o.people}명 · 1인 ${won(o.pricePerPerson)}`}
                                        onClick={() => pricing.setPeople(o.people)}
                                        style={{ minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '8px 2px', borderRadius: 12, border: 0, background: on ? MW.navy : '#F4F6F5', fontFamily: 'inherit', cursor: 'pointer', color: on ? '#FFFFFF' : MW.ink3 }}
                                    >
                                        <span style={{ fontSize: 11, fontWeight: 700 }}>{o.people}명</span>
                                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>{shortWon(o.pricePerPerson)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 16, borderTop: `1px dashed ${MW.line2}`, fontSize: 13, color: MW.mute }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>{won(unit)} × {people}명</span><span>{won(total)}</span></span>
                    <span style={{ display: 'flex', justifyContent: 'space-between' }}><span>서비스 요금</span><span style={{ color: MW.mintDeep, fontWeight: 700 }}>무료</span></span>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6, color: MW.navy }}>
                        <strong style={{ fontSize: 15 }}>합계</strong>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 24, fontWeight: 600 }}>{won(total)}</span>
                    </span>
                </div>
                <button type="button" onClick={onBook} style={{ height: 56, border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>예약하기</button>
                <button type="button" onClick={openConsult} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, marginTop: -8, border: `1.5px solid ${MW.navy}`, borderRadius: 999, background: '#FFFFFF', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>
                    <Svg d={ICON.chat} size={17} color={MW.navy} />먼저 무료 상담
                </button>
            </div>
        </div>
    );
}

export function CancelNote() {
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '16px 18px', borderRadius: 20, background: MW.mintBg }}>
            <Svg d={ICON.shield} size={20} color={MW.mintDeep} />
            <span style={{ fontSize: 12, lineHeight: 1.7, color: MW.ink3 }}>
                <strong style={{ color: MW.mintDeep, marginRight: 10 }}>예약금 안내</strong>예약금은 호텔·숙박 시설의 선결제 금액으로 사용되므로, 취소 시에도 환불되지 않습니다. 궁금한 점은 한국어 상담 스태프에게 편하게 문의해 주세요.
            </span>
        </div>
    );
}

// ───────────────────────── all-photos overlay ─────────────────────────

/** 전체 사진: every gallery photo in a grid; a photo opens the zoom viewer. */
export function PhotoOverlay({ title, images, onClose }: { title: string; images: string[]; onClose: () => void }) {
    const [zoom, setZoom] = useState<number | null>(null);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && zoom === null) onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => {
            document.body.style.overflow = prev;
            window.removeEventListener('keydown', onKey);
        };
    }, [onClose, zoom]);

    return (
        <div role="dialog" aria-modal="true" aria-label="전체 사진" data-mw-overlay="" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(10,31,46,0.92)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '16px 24px', color: '#FFFFFF' }}>
                <span style={{ fontSize: 15, fontWeight: 700, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title} · 사진 {images.length}장</span>
                <button type="button" onClick={onClose} aria-label="닫기" style={{ width: 44, height: 44, flexShrink: 0, border: 0, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', fontSize: 22, color: '#FFFFFF', cursor: 'pointer', padding: 0 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 32px' }}>
                <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(100%,300px),1fr))', gap: 10 }}>
                    {images.map((img, i) => (
                        <button key={i} type="button" onClick={() => setZoom(i)} aria-label={`사진 ${i + 1} 확대`} style={{ position: 'relative', width: '100%', aspectRatio: '4/3', borderRadius: 16, overflow: 'hidden', background: '#1F3647', border: 0, padding: 0, cursor: 'zoom-in' }}>
                            <ResponsiveProductImage src={img} alt={tourImageAlt(title, i)} loading="lazy" decoding="async" onError={hideBroken} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </button>
                    ))}
                </div>
            </div>
            {zoom !== null && <ImageLightbox images={images} startIndex={zoom} onClose={() => setZoom(null)} />}
        </div>
    );
}
