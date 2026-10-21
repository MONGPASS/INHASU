import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import type { DayInfoContent, DetailSlide, DividerContent, TimelineContent, TourProduct } from '../../../types/product';
import { isAutoDayLabel, stripDayLabelReading } from '../../../utils/dayLabel';
import { ImageLightbox } from '../../common/ImageLightbox';
import { ResponsiveProductImage } from '../../common/ResponsiveProductImage';
import { MW, MW_FONT_EN, MW_GRADIENT } from '../../desktop-primitives/mwTokens';
import { SlideGroup } from './DetailParts';
import { FACT_ICON, groupItinerary, type ItineraryBlock, type ItineraryDay } from './productDetailData';

/**
 * 일정: the admin's day-by-day itinerary (day cards, timeline spots, photos, meals, hotel)
 * as the redesign's accordion — one row per day, first day open.
 */

type OpenImages = (images: string[], startIndex: number) => void;

const D_DOWN = 'M6 9l6 6 6-6';
const D_BED = 'M3 19V6M3 15h18v4M21 15v-3a3 3 0 00-3-3h-7v6M6.5 12a1.5 1.5 0 100-3 1.5 1.5 0 000 3z';
const D_MEAL = 'M6 3v5a2 2 0 004 0V3M8 3v18M17 21V3c-2 1.5-3 4-3 7h3';
const D_PIN = 'M12 21s-6-5.5-6-11a6 6 0 1112 0c0 5.5-6 11-6 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z';

function Svg({ d, size, color, style }: { d: string; size: number; color: string; style?: CSSProperties }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>
            <path d={d} />
        </svg>
    );
}

const hideBroken = (e: { currentTarget: HTMLImageElement }) => {
    e.currentTarget.style.visibility = 'hidden';
};

/** 옛 일본어 자동 일차 라벨(「1日目」)을 한국어(「1일차」)로 바꾼다 — 그 밖의 라벨은 그대로 */
const koDayLabel = (label: string) => label.replace(/^\s*(\d+)\s*日目\s*$/, '$1일차');

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : []);

/** Up to two photos side by side; the rest open in the zoom viewer ("+N"). */
function PhotoPair({ images, alt, label, onOpen }: { images: string[]; alt: (i: number) => string; label: string; onOpen: OpenImages }) {
    const visible = images.slice(0, 2);
    const more = images.length - visible.length;
    if (visible.length === 0) return null;
    return (
        <div style={{ display: 'grid', gridTemplateColumns: visible.length === 1 ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            {visible.map((src, i) => (
                <button key={i} type="button" onClick={() => onOpen(images, i)} aria-label={`${label} 사진 ${i + 1} 확대`} style={{ position: 'relative', width: '100%', aspectRatio: visible.length === 1 ? '16/9' : '4/3', padding: 0, border: 0, borderRadius: 14, overflow: 'hidden', background: MW.chip, cursor: 'zoom-in' }}>
                    <ResponsiveProductImage src={src} alt={alt(i)} loading="lazy" decoding="async" onError={hideBroken} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    {more > 0 && i === visible.length - 1 && (
                        <span style={{ position: 'absolute', right: 8, bottom: 8, height: 26, padding: '0 10px', borderRadius: 999, background: 'rgba(10,31,46,0.7)', display: 'flex', alignItems: 'center', fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, color: '#FFFFFF' }}>+{more}</span>
                    )}
                </button>
            ))}
        </div>
    );
}

/** One block outside the timeline spine (products without day cards, or photos inside a day). */
function PlainBlock({ block, index, productName, compact }: { block: ItineraryBlock; index: number; productName: string; compact: boolean }) {
    if (block.type === 'image') {
        const url = typeof block.content === 'string' ? block.content : '';
        if (!url) return null;
        return <ResponsiveProductImage src={url} alt={`${productName} 일정 ${index + 1} | 몽골 여행·몽골 투어`} loading="lazy" decoding="async" onError={hideBroken} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 16 }} />;
    }
    if (block.type === 'slide') return <SlideGroup slide={block.content as DetailSlide} productName={productName} compact={compact} />;
    if (block.type === 'divider') {
        const divider = block.content as DividerContent;
        return <div aria-hidden="true" style={{ height: typeof divider.height === 'number' ? divider.height : 24, borderBottom: divider.style === 'line' ? `1px solid ${MW.line}` : 'none' }} />;
    }
    if (block.type === 'timeline') {
        const images = strings((block.content as TimelineContent | undefined)?.images);
        if (images.length === 0) return null;
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {images.map((src, i) => (
                    <ResponsiveProductImage key={i} src={src} alt={`${productName} ${index + 1}-${i + 1} | 몽골 여행·몽골 투어`} loading="lazy" decoding="async" onError={hideBroken} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 16 }} />
                ))}
            </div>
        );
    }
    return null;
}

/** A row on the day's spine: mint dot + content. */
function SpineRow({ children }: { children: ReactNode }) {
    return (
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: '12px minmax(0,1fr)', gap: 14, alignItems: 'start' }}>
            <span aria-hidden="true" style={{ width: 12, height: 12, marginTop: 5, borderRadius: '50%', background: MW.mint, border: '3px solid #FFFFFF', boxSizing: 'border-box', boxShadow: `0 0 0 1.5px ${MW.mint}` }} />
            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
        </div>
    );
}

function TimelineEvent({ block, index, productName, compact, onOpen }: { block: ItineraryBlock; index: number; productName: string; compact: boolean; onOpen: OpenImages }) {
    if (block.type !== 'timeline') {
        if (block.type === 'divider') return <PlainBlock block={block} index={index} productName={productName} compact={compact} />;
        return (
            <SpineRow>
                <PlainBlock block={block} index={index} productName={productName} compact={compact} />
            </SpineRow>
        );
    }
    const c = (block.content ?? {}) as Partial<TimelineContent>;
    const images = strings(c.images);
    const title = c.title?.trim();
    const badge = c.badge?.trim();
    return (
        <SpineRow>
            {(title || badge) && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {title && <span style={{ fontSize: compact ? 15 : 16, fontWeight: 900, lineHeight: 1.45 }}>{title}</span>}
                    {badge && <span style={{ height: 22, padding: '0 9px', borderRadius: 999, background: MW.mintTint, display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, color: MW.mintDeep }}>{badge}</span>}
                </span>
            )}
            {c.time?.trim() && <span style={{ fontSize: 13, lineHeight: 1.6, color: MW.mute }}>{c.time}</span>}
            <PhotoPair images={images} alt={(i) => `${title || productName} ${i + 1} | 몽골 여행·몽골 투어`} label={title || '사진'} onOpen={onOpen} />
            {c.description?.trim() && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.85, color: MW.ink3, whiteSpace: 'pre-wrap' }}>{c.description}</p>}
        </SpineRow>
    );
}

const tile: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 10, padding: '16px 18px', borderRadius: 18, background: '#F7FAF9', minWidth: 0 };
const tileLabel: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, color: MW.mintDeep };

/** 숙박 tile. Older itineraries stored only the hotel id, so photos / description fall back to the hotel master. */
function StayTile({ info, onOpen }: { info: DayInfoContent; onOpen: OpenImages }) {
    const snapshotImages = strings(info.accommodationImages);
    const hasSnapshot = ['accommodationImages', 'accommodationDescription', 'accommodationAddress', 'accommodationSubtitle', 'accommodationAmenities']
        .some(field => Object.prototype.hasOwnProperty.call(info, field));
    const needsFetch = !!info.accommodationHotelId && !hasSnapshot;
    const { data: live } = useQuery({
        queryKey: ['hotel', info.accommodationHotelId],
        queryFn: () => api.hotels.get(info.accommodationHotelId!),
        enabled: needsFetch,
        staleTime: 1000 * 60 * 60,
    });
    const images = hasSnapshot ? snapshotImages : strings(live?.images);
    const description = hasSnapshot ? info.accommodationDescription || '' : live?.description || '';
    const address = hasSnapshot ? info.accommodationAddress || '' : live?.address || '';
    const subtitle = hasSnapshot ? info.accommodationSubtitle || '' : live?.name_local || '';
    const name = info.accommodation || '';

    return (
        <div style={tile}>
            <span style={tileLabel}><Svg d={D_BED} size={16} color={MW.mintDeep} />숙박</span>
            <span style={{ fontSize: 15, fontWeight: 900, lineHeight: 1.45 }}>
                {name}
                {subtitle && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: MW.mute }}>{subtitle}</span>}
            </span>
            <PhotoPair images={images} alt={(i) => `${name} ${i + 1} | 몽골 여행·숙박`} label={name} onOpen={onOpen} />
            {description && <p style={{ margin: 0, fontSize: 13, lineHeight: 1.8, color: MW.ink3, whiteSpace: 'pre-wrap' }}>{description}</p>}
            {address && (
                <span style={{ display: 'flex', alignItems: 'flex-start', gap: 4, fontSize: 12, lineHeight: 1.6, color: MW.mute }}>
                    <Svg d={D_PIN} size={14} color={MW.mute2} style={{ marginTop: 2 }} />{address}
                </span>
            )}
            <span style={{ fontSize: 11, color: MW.mute2 }}>* 숙소는 출발 1일 전까지 안내해 드립니다.</span>
        </div>
    );
}

function DayRow({ day, index, open, onToggle, productName, compact, onOpen }: { day: ItineraryDay; index: number; open: boolean; onToggle: () => void; productName: string; compact: boolean; onOpen: OpenImages }) {
    const c = day.info;
    const label = koDayLabel(stripDayLabelReading(c.dayLabel)) || `${index + 1}일차`;
    const auto = isAutoDayLabel(c.dayLabel);
    const dayTitle = c.title?.trim();
    const sub = [dayTitle && !auto ? label : '', c.dayDate?.trim()].filter(Boolean).join(' · ');
    const meals: [string, string][] = [];
    if (c.meals?.breakfast) meals.push(['아침', c.meals.breakfast]);
    if (c.meals?.lunch) meals.push(['점심', c.meals.lunch]);
    if (c.meals?.dinner) meals.push(['저녁', c.meals.dinner]);
    const bodyId = `td-day-${index + 1}`;
    const badge = 48;

    return (
        <div style={{ borderBottom: `1px solid ${MW.line}` }}>
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={open}
                aria-controls={bodyId}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 4px', border: 0, background: 'transparent', fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', color: MW.navy }}
            >
                <span style={{ width: badge, height: badge, flexShrink: 0, borderRadius: 16, background: open ? MW_GRADIENT : MW.mintBg, color: open ? MW.navy : MW.mintDeep, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontFamily: MW_FONT_EN }}>
                    <span style={{ fontSize: 8, fontWeight: 600, letterSpacing: '0.08em' }}>DAY</span>
                    <span style={{ fontSize: 16, fontWeight: 600, lineHeight: 1 }}>{index + 1}</span>
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ fontSize: compact ? 15 : 17, fontWeight: 900, lineHeight: 1.45 }}>{dayTitle || label}</span>
                    {sub && <span style={{ fontSize: 12, color: MW.mute }}>{sub}</span>}
                </span>
                <Svg d={D_DOWN} size={18} color={MW.mute2} style={{ transform: `rotate(${open ? 180 : 0}deg)`, transition: 'transform .2s' }} />
            </button>

            {/* Kept in the DOM while closed so the whole itinerary stays readable to crawlers. */}
            <div id={bodyId} hidden={!open} style={{ padding: compact ? '4px 0 24px' : `4px 0 28px ${badge + 14}px` }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {c.description?.trim() && <p style={{ margin: 0, fontSize: 14, lineHeight: 1.9, color: MW.ink2, whiteSpace: 'pre-wrap' }}>{c.description}</p>}

                    {day.events.length > 0 && (
                        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 22 }}>
                            <span aria-hidden="true" style={{ position: 'absolute', left: 5, top: 10, bottom: 10, width: 2, borderRadius: 2, background: MW.mintTint }} />
                            {day.events.map((b, i) => (
                                <TimelineEvent key={b.id || i} block={b} index={i} productName={productName} compact={compact} onOpen={onOpen} />
                            ))}
                        </div>
                    )}

                    {(meals.length > 0 || c.accommodation) && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {c.accommodation && <StayTile info={c} onOpen={onOpen} />}
                            {meals.length > 0 && (
                                <div style={tile}>
                                    <span style={tileLabel}><Svg d={D_MEAL} size={16} color={MW.mintDeep} />식사</span>
                                    <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 18px', fontSize: 14, lineHeight: 1.6 }}>
                                        {meals.map(([k, v]) => (
                                            <span key={k}><strong style={{ color: MW.mintDeep, marginRight: 6 }}>{k}</strong>{v}</span>
                                        ))}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function ItineraryAccordion({ product, compact = false }: { product: TourProduct; compact?: boolean }) {
    const { days, flat, legacyImages } = useMemo(() => groupItinerary(product), [product]);
    const [openDays, setOpenDays] = useState<Set<number>>(() => new Set([0]));
    const [lightbox, setLightbox] = useState<{ images: string[]; startIndex: number } | null>(null);
    const openImages: OpenImages = (images, startIndex) => setLightbox({ images, startIndex });

    const toggle = (i: number) =>
        setOpenDays((cur) => {
            const next = new Set(cur);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });
    const allOpen = days.length > 0 && openDays.size === days.length;

    return (
        <>
            {days.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: `1px solid ${MW.line}` }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: MW.mute }}>
                            <Svg d={FACT_ICON.calendar} size={16} color={MW.mintDeep} />총 {days.length}일 일정
                        </span>
                        {days.length > 1 && (
                            <button
                                type="button"
                                onClick={() => setOpenDays(allOpen ? new Set() : new Set(days.map((_, i) => i)))}
                                style={{ height: 34, padding: '0 14px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#FFFFFF', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap' }}
                            >
                                {allOpen ? '모두 접기' : '모두 펼치기'}
                            </button>
                        )}
                    </div>
                    {days.map((day, i) => (
                        <DayRow key={day.key} day={day} index={i} open={openDays.has(i)} onToggle={() => toggle(i)} productName={product.name} compact={compact} onOpen={openImages} />
                    ))}
                </div>
            )}

            {flat.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    {flat.map((b, i) => <PlainBlock key={b.id || i} block={b} index={i} productName={product.name} compact={compact} />)}
                </div>
            )}

            {legacyImages.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 0 : 16, margin: compact ? '0 -16px' : 0 }}>
                    {legacyImages.map((src, i) => (
                        <ResponsiveProductImage key={i} src={src} alt={`${product.name} 일정 ${i + 1} | 몽골 여행·몽골 투어`} loading="lazy" decoding="async" onError={hideBroken} style={{ width: '100%', height: 'auto', display: 'block', borderRadius: compact ? 0 : 16 }} />
                    ))}
                </div>
            )}

            {lightbox && <ImageLightbox images={lightbox.images} startIndex={lightbox.startIndex} onClose={() => setLightbox(null)} />}
        </>
    );
}
