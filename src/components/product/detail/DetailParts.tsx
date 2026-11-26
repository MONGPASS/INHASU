import { useEffect, useState, type CSSProperties } from 'react';
import type { DesignBlockContent, DetailContentBlock, DetailSlide, DividerContent, TourProduct } from '../../../types/product';
import { ImageLightbox } from '../../common/ImageLightbox';
import { ResponsiveProductImage } from '../../common/ResponsiveProductImage';
import { MW, MW_FONT_EN } from '../../desktop-primitives/mwTokens';
import { durationLabel } from '../../tours-mobile/tourListFilters';
import DesignBlockView from '../designTemplates/DesignBlockView';
import { DesignItinerary } from '../designTemplates/DesignItinerary';
import { priceRowsFromOptions } from '../designTemplates/pricing';
import { designShowsItinerary, detailFlags, tourImageAlt } from './productDetailData';

/**
 * 투어 상세(PC·휴대폰)가 함께 쓰는 관리자 작성 내용 부품: 투어 소개 글 · 상세 정보 블록(긴 그림, 사진 묶음, 디자인 틀) · 전체 사진 창.
 * 화면 틀(목차·예약 상자·후기·FAQ 등)은 TourDetailSections.tsx와 각 화면 파일에 있다. `compact`는 휴대폰 크기.
 */

const hideBroken = (e: { currentTarget: HTMLImageElement }) => {
    e.currentTarget.style.visibility = 'hidden';
};

// ───────────────────────── sections ─────────────────────────

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
/** withItinerary=false: 디자인 틀이 끼워 넣던 일정표를 빼고 그린다(상세 화면은 일정을 따로 ‘일정’ 구역에 둔다). */
export function DetailBlocks({ product, compact = false, withItinerary = true }: { product: TourProduct; compact?: boolean; withItinerary?: boolean }) {
    const blocks: DetailContentBlock[] = product.detailBlocks ?? [];
    const hasItinerary = withItinerary && detailFlags(product).hasItinerary;
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
