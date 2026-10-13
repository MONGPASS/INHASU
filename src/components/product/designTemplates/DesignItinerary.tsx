import { ResponsiveProductImage } from '../../common/ResponsiveProductImage';
import React, { useMemo, useState } from 'react';
import { stripDayLabelReading } from '../../../utils/dayLabel';
import type { TourProduct, DayInfoContent, TimelineContent, DetailSlide } from '../../../types/product';
import { ImageLightbox } from '../../common/ImageLightbox';
import { ScaledDesign } from './DesignBlockView';

/**
 * 「일정 상세 (1일차)」 — Claude Design(일정 상세 (1일차).dc.html / 일정 상세 (1일차, 모바일).dc.html)을
 * React로 이식한 일정표 디자인. 상품 「일정」 탭의 블록(dayInfo / timeline / image / slide)을
 * 그대로 읽어 일차마다 [히어로 사진 + 일차 제목 + DAY 진행 스트립] → [흰 카드: 제목·설명 →
 * 사진 그리드 → 세로 타임라인 → 식사 → 숙박 안내] 순으로 그린다.
 * 디자인 템플릿(공항 도착 뒤)에 끼워 넣기 위한 것이라 ScaledDesign으로 같은 배율로 축소된다.
 * PC는 860px, 모바일은 430px 디자인 파일의 치수를 각각 그대로 쓴다 (SIZES 표).
 */

const MINT = '#06C4A0';
const TEAL = '#029F85';
const INK = '#2b2b2b';
const PHOTO_BG = '#0B1513'; // 히어로 사진이 없거나 로딩 전일 때 사진 자리의 배경
const LINE = '#E3EEEA';

/** 디자인 파일의 치수 — [PC 860px, 모바일 430px] */
const SIZES = {
    desktop: {
        canvas: 860, heroH: 330, heroPad: '48px 50px 0', heroBottom: 40, h2: 40,
        stripTop: 34, stripGap: 8, lineTop: 8, dot: 18, colGap: 10, dayLabel: 16, daySub: 18, daySubTop: -6,
        cardMargin: 30, cardRadius: 32, cardPad: '54px 46px 90px', label: 22, h3: 44, h3Top: 10, desc: 21, descTop: 26, descMax: 640,
        gridTop: 40, gridGap: 14, gridH: 240, gridWideH: 400, gridRadius: 16,
        tlTop: 64, tlPadLeft: 64, dotLeft: -58, dotTop: 6, dotSize: 14, ring: 5, spineLeft: -52, spineTop: 26,
        itemTitle: 23, bodyTop: 10, body: 20, itemGap: 44, itemPadBottom: 12, photosTop: 22, photosGap: 14, photoH: 230, photoRadius: 14,
        boxTop: 20, boxPad: '24px 26px', boxRadius: 14, badgePad: '8px 16px', badge: 19, boxBodyTop: 14, boxBody: 19,
        accPad: '22px 26px', bulletsTop: 14, bulletsGap: '8px 22px', bullet: 19, accPhotosTop: 20, accPhotosGap: 12, accPhotoH: 180, accPhotoRadius: 12,
    },
    mobile: {
        canvas: 430, heroH: 300, heroPad: '34px 18px 0', heroBottom: 28, h2: 24,
        stripTop: 26, stripGap: 4, lineTop: 5, dot: 12, colGap: 7, dayLabel: 11, daySub: 11, daySubTop: -4,
        cardMargin: 12, cardRadius: 22, cardPad: '32px 18px 60px', label: 15, h3: 28, h3Top: 6, desc: 14, descTop: 16, descMax: 640,
        gridTop: 26, gridGap: 8, gridH: 140, gridWideH: 220, gridRadius: 12,
        tlTop: 40, tlPadLeft: 34, dotLeft: -32, dotTop: 4, dotSize: 11, ring: 4, spineLeft: -27, spineTop: 20,
        itemTitle: 16, bodyTop: 6, body: 14, itemGap: 30, itemPadBottom: 8, photosTop: 14, photosGap: 8, photoH: 120, photoRadius: 10,
        boxTop: 12, boxPad: '16px 16px', boxRadius: 12, badgePad: '6px 12px', badge: 13, boxBodyTop: 10, boxBody: 13,
        accPad: '14px 16px', bulletsTop: 10, bulletsGap: '6px 14px', bullet: 13, accPhotosTop: 12, accPhotosGap: 6, accPhotoH: 100, accPhotoRadius: 8,
    },
} as const;
type Sizes = typeof SIZES.desktop | typeof SIZES.mobile;

interface Block { id?: string; type: string; content: unknown }
interface DayGroup { dayInfo: DayInfoContent; events: Block[] }

/** 관리자가 내용을 넣은 블록만 (ProductDetailDesktop / MobileItineraryTimeline과 같은 기준) */
function isMeaningful(b: Block): boolean {
    if (b.type === 'image' || b.type === 'slide') return true;
    if (b.type === 'dayInfo') {
        const c = b.content as DayInfoContent | undefined;
        if (!c) return false;
        const hasMeals = !!(c.meals?.breakfast || c.meals?.lunch || c.meals?.dinner);
        return !!(c.title || c.description || c.accommodation || hasMeals);
    }
    if (b.type === 'timeline') {
        const c = b.content as TimelineContent | undefined;
        if (!c) return false;
        return !!(c.title || c.description || c.time || (Array.isArray(c.images) && c.images.length > 0));
    }
    return false;
}

function groupByDay(blocks: Block[]): { pre: Block[]; days: DayGroup[] } {
    const days: DayGroup[] = [];
    const pre: Block[] = [];
    let cur: DayGroup | null = null;
    for (const b of blocks) {
        if (b.type === 'dayInfo') {
            if (cur) days.push(cur);
            cur = { dayInfo: b.content as DayInfoContent, events: [] };
        } else if (cur) cur.events.push(b);
        else pre.push(b);
    }
    if (cur) days.push(cur);
    // dayInfo보다 앞에 만든 블록은 1일차 일정으로 본다 (기존 렌더러와 동일)
    if (pre.length > 0 && days.length > 0) {
        days[0] = { dayInfo: days[0].dayInfo, events: [...pre, ...days[0].events] };
        return { pre: [], days };
    }
    return { pre, days };
}

/** image / slide 블록의 사진 (타임라인 사진과 별도 — 카드 상단 그리드에 쓴다) */
function blockImages(b: Block): string[] {
    if (b.type === 'image') return typeof b.content === 'string' && b.content ? [b.content] : [];
    if (b.type === 'slide') return ((b.content as DetailSlide)?.images ?? []).filter(Boolean);
    return [];
}

const img = (src: string) => src;

/** 옛 일본어 자동 일차 라벨(「1日目」)을 한국어(「1일차」)로 바꾼다 — 그 밖의 라벨은 그대로 */
const koDayLabel = (label: string) => label.replace(/^\s*(\d+)\s*日目\s*$/, '$1일차');

export function DesignItinerary({ product, variant = 'desktop' }: { product: TourProduct; variant?: 'desktop' | 'mobile' }) {
    const S: Sizes = SIZES[variant];

    const [lightbox, setLightbox] = useState<{ images: string[]; startIndex: number } | null>(null);
    const open = (images: string[], startIndex: number) => setLightbox({ images, startIndex });

    const { days, pre, legacy } = useMemo(() => {
        const blocks = ((product.itineraryBlocks ?? []) as Block[]).filter(isMeaningful);
        const g = groupByDay(blocks);
        return { ...g, legacy: blocks.length === 0 ? (product.itineraryImages ?? []) : [] };
    }, [product.itineraryBlocks, product.itineraryImages]);

    // dayInfo 없이 사진/타임라인만 있는 상품 → 하나의 일정으로 묶어서 같은 디자인으로
    const groups: DayGroup[] = days.length > 0
        ? days
        : pre.length > 0
            ? [{ dayInfo: { id: 'all', dayLabel: '', title: product.name }, events: pre }]
            : [];

    if (groups.length === 0 && legacy.length === 0) return null;

    return (
        <ScaledDesign canvasWidth={S.canvas}>
            <div className="dit-design" style={{ width: S.canvas, margin: '0 auto', background: '#fff', color: INK, overflow: 'hidden', fontFamily: '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, sans-serif', WebkitFontSmoothing: 'antialiased' }}>
                <style>{`
                    .dit-design { word-break: keep-all; overflow-wrap: break-word; line-break: strict; }
                    .dit-design * { text-wrap: pretty; }
                    .dit-design h2, .dit-design h3 { text-wrap: balance; }
                    @keyframes ditPulse { 0%,100% { box-shadow: 0 0 0 4px rgba(255,255,255,0.45); } 50% { box-shadow: 0 0 0 10px rgba(6,196,160,0.25); } }
                    .dit-design .dit-photo { cursor: zoom-in; }
                `}</style>

                {/* 레거시(사진만 올린 상품) — 세로로 이어 붙인다 */}
                {groups.length === 0 && legacy.map((src, i) => (
                    <ResponsiveProductImage key={i} src={img(src)} alt={`${product.name} 일정 ${i + 1}`} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', display: 'block' }} />
                ))}

                {groups.map((day, i) => (
                    <DaySection key={day.dayInfo.id || i} day={day} index={i} all={groups} S={S} onOpen={open} />
                ))}
            </div>
            {lightbox && <ImageLightbox images={lightbox.images} startIndex={lightbox.startIndex} onClose={() => setLightbox(null)} />}
        </ScaledDesign>
    );
}

function DaySection({ day, index, all, S, onOpen }: {
    day: DayGroup; index: number; all: DayGroup[]; S: Sizes;
    onOpen: (images: string[], startIndex: number) => void;
}) {
    const d = day.dayInfo;
    // 「1日目（いちにちめ）」처럼 저장된 후리가나는 표시하지 않고, 옛 일본어 자동 라벨(「1日目」)은 「1일차」로 바꿔 표시한다
    const dayLabel = koDayLabel(stripDayLabelReading(d.dayLabel)) || `${index + 1}일차`;
    const timeline = day.events.filter(b => b.type === 'timeline').map(b => b.content as TimelineContent);
    // 카드 상단 그리드: 일차 정보에 직접 올린 사진(최대 5장) 우선, 없으면 이미지 블록 사진
    const gallery = (d.galleryImages ?? []).filter(Boolean).slice(0, 5);
    const gridPhotos = gallery.length > 0 ? gallery : day.events.flatMap(blockImages);
    const timelinePhotos = timeline.flatMap(t => (t.images ?? []).filter(Boolean));
    const accPhotos = (d.accommodationImages ?? []).filter(Boolean);
    // 히어로 사진: 직접 올린 히어로 사진 → 상단 그리드 → 타임라인 → 숙소 순
    const hero = d.heroImage || gridPhotos[0] || timelinePhotos[0] || accPhotos[0] || '';
    const meals = [
        d.meals?.breakfast && `아침: ${d.meals.breakfast}`,
        d.meals?.lunch && `점심: ${d.meals.lunch}`,
        d.meals?.dinner && `저녁: ${d.meals.dinner}`,
    ].filter(Boolean) as string[];
    const amenities = (d.accommodationAmenities ?? []).filter(Boolean);
    const multi = all.length > 1;
    const progress = multi ? (index / (all.length - 1)) * 80 : 0;

    const dot: React.CSSProperties = { position: 'absolute', left: S.dotLeft, top: S.dotTop, width: S.dotSize, height: S.dotSize, borderRadius: '50%', background: INK, boxShadow: `0 0 0 ${S.ring}px #fff` };
    const spine: React.CSSProperties = { position: 'absolute', left: S.spineLeft, top: S.spineTop, bottom: 0, width: 2, background: LINE };
    const itemTitle: React.CSSProperties = { fontSize: S.itemTitle, fontWeight: 800, color: INK, letterSpacing: '-0.03em' };
    const itemBody: React.CSSProperties = { marginTop: S.bodyTop, fontSize: S.body, lineHeight: 1.7, fontWeight: 600, color: '#4a4a4a', letterSpacing: '-0.02em', whiteSpace: 'pre-line' };
    const badge: React.CSSProperties = { display: 'inline-block', padding: S.badgePad, borderRadius: 6, background: INK, color: '#fff', fontSize: S.badge, fontWeight: 800, letterSpacing: '-0.03em' };
    const bullets: React.CSSProperties = { marginTop: S.bulletsTop, display: 'flex', flexWrap: 'wrap', gap: S.bulletsGap, fontSize: S.bullet, fontWeight: 700, color: TEAL, letterSpacing: '-0.02em' };

    const Photo = ({ src, group, idx, height, radius }: { src: string; group: string[]; idx: number; height: number; radius: number }) => (
        <div className="dit-photo" onClick={() => onOpen(group, idx)} style={{ position: 'relative', height, borderRadius: radius, overflow: 'hidden', background: '#EFFEF9' }}>
            <ResponsiveProductImage src={img(src)} alt="" loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
    );

    return (
        <section style={{ position: 'relative', background: '#fff' }}>
            {/* ── 히어로: 사진 위에 일차 제목 + DAY 진행 스트립 (사진 위 어두운 오버레이만, 바탕은 흰색) ── */}
            <div style={{ position: 'relative', minHeight: S.heroH, overflow: 'hidden' }}>
                <div style={{ position: 'absolute', inset: 0, background: PHOTO_BG }}>
                    {hero && (
                        <ResponsiveProductImage src={img(hero)} alt="" loading={index === 0 ? 'eager' : 'lazy'} decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                </div>
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.5) 100%)' }} />
                <div style={{ position: 'relative', padding: S.heroPad, paddingBottom: S.heroBottom, textAlign: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: S.h2, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff', textShadow: '0 2px 18px rgba(0,0,0,0.4)' }}>
                        {dayLabel}{d.title ? `. ${d.title}` : ''}
                    </h2>
                    {multi && (
                        <div style={{ marginTop: S.stripTop, position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${all.length}, 1fr)`, gap: S.stripGap }}>
                            <div style={{ position: 'absolute', left: '10%', right: '10%', top: S.lineTop, height: 2, background: 'rgba(255,255,255,0.28)' }} />
                            <div style={{ position: 'absolute', left: '10%', width: `${progress}%`, top: S.lineTop, height: 2, background: MINT }} />
                            {all.map((other, j) => {
                                const active = j === index;
                                return (
                                    <div key={j} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: S.colGap, opacity: active ? 1 : 0.45 }}>
                                        <div style={{ width: S.dot, height: S.dot, borderRadius: '50%', background: active ? MINT : '#fff', animation: active ? 'ditPulse 2.2s ease-in-out infinite' : undefined }} />
                                        <div style={{ fontSize: S.dayLabel, fontWeight: active ? 800 : 700, color: '#fff', letterSpacing: '0.02em' }}>{j + 1}DAY</div>
                                        <div style={{ marginTop: S.daySubTop, fontSize: S.daySub, fontWeight: active ? 800 : 600, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.3 }}>
                                            {other.dayInfo.title || koDayLabel(stripDayLabelReading(other.dayInfo.dayLabel)) || ''}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── 흰 카드 ── */}
            <div style={{ margin: `0 ${S.cardMargin}px`, position: 'relative', background: '#fff', borderRadius: `${S.cardRadius}px ${S.cardRadius}px 0 0`, padding: S.cardPad }}>
                <div style={{ textAlign: 'center' }}>
                    {(d.dayDate || dayLabel) && (
                        <div style={{ fontSize: S.label, fontWeight: 800, color: INK, letterSpacing: '-0.03em' }}>{d.dayDate || dayLabel}</div>
                    )}
                    <h3 style={{ margin: `${S.h3Top}px 0 0`, fontSize: S.h3, fontWeight: 800, letterSpacing: '-0.045em', color: TEAL }}>{d.title || dayLabel}</h3>
                    {d.description && (
                        <div style={{ margin: `${S.descTop}px auto 0`, maxWidth: S.descMax, fontSize: S.desc, lineHeight: 1.7, fontWeight: 600, color: '#3a3a3a', letterSpacing: '-0.02em', whiteSpace: 'pre-line' }}>{d.description}</div>
                    )}
                </div>

                {/* 상단 사진 그리드: 2열, 홀수면 마지막 한 장은 와이드 */}
                {gridPhotos.length > 0 && (
                    <div style={{ marginTop: S.gridTop, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: S.gridGap }}>
                        {gridPhotos.map((src, i) => {
                            const wide = gridPhotos.length % 2 === 1 && i === gridPhotos.length - 1;
                            return (
                                <div key={i} style={wide ? { gridColumn: '1 / -1' } : undefined}>
                                    <Photo src={src} group={gridPhotos} idx={i} height={wide ? S.gridWideH : S.gridH} radius={S.gridRadius} />
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* 세로 타임라인 */}
                {(timeline.length > 0 || meals.length > 0 || d.accommodation) && (
                    <div style={{ marginTop: S.tlTop, position: 'relative', paddingLeft: S.tlPadLeft }}>
                        {timeline.map((t, i) => {
                            const photos = (t.images ?? []).filter(Boolean);
                            return (
                                <div key={t.id || i} style={{ position: 'relative', marginTop: i === 0 ? 0 : S.itemGap, paddingBottom: S.itemPadBottom }}>
                                    <div style={dot} />
                                    <div style={spine} />
                                    <div style={itemTitle}>{[t.time, t.title].filter(Boolean).join(' ')}</div>
                                    {t.badge ? (
                                        // 강조 박스 — 검은 배지 + 설명 (디자인의 「환전 / 장보기」 박스)
                                        <div style={{ marginTop: S.boxTop, padding: S.boxPad, borderRadius: S.boxRadius, background: '#F3F8F6' }}>
                                            <div style={badge}>{t.badge}</div>
                                            {t.description && <div style={{ ...itemBody, marginTop: S.boxBodyTop, fontSize: S.boxBody }}>{t.description}</div>}
                                        </div>
                                    ) : (
                                        t.description && <div style={itemBody}>{t.description}</div>
                                    )}
                                    {photos.length > 0 && (
                                        <div style={{ marginTop: S.photosTop, display: 'grid', gridTemplateColumns: photos.length === 1 ? '1fr' : '1fr 1fr', gap: S.photosGap }}>
                                            {photos.map((src, j) => <Photo key={j} src={src} group={photos} idx={j} height={S.photoH} radius={S.photoRadius} />)}
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {meals.length > 0 && (
                            <div style={{ position: 'relative', marginTop: timeline.length ? S.itemGap : 0, paddingBottom: S.itemPadBottom }}>
                                <div style={dot} />
                                <div style={spine} />
                                <div style={itemTitle}>식사</div>
                                <div style={{ marginTop: S.boxTop, padding: S.boxPad, borderRadius: S.boxRadius, background: '#F3F8F6' }}>
                                    <div style={badge}>식사 안내</div>
                                    <div style={bullets}>
                                        {meals.map((m, i) => <div key={i}>· {m}</div>)}
                                    </div>
                                </div>
                            </div>
                        )}

                        {d.accommodation && (
                            <div style={{ position: 'relative', marginTop: (timeline.length || meals.length) ? S.itemGap : 0, paddingBottom: S.itemPadBottom }}>
                                <div style={dot} />
                                <div style={{ ...spine, bottom: S.itemPadBottom }} />
                                <div style={itemTitle}>{d.accommodation}</div>
                                <div style={{ marginTop: S.boxTop, padding: S.accPad, borderRadius: S.boxRadius, border: `2px solid ${LINE}` }}>
                                    <div style={badge}>숙박 안내</div>
                                    {(amenities.length > 0 || d.accommodationSubtitle || d.accommodationAddress) && (
                                        <div style={bullets}>
                                            {amenities.map((a, i) => <div key={i}>· {a}</div>)}
                                            {d.accommodationSubtitle && <div>· {d.accommodationSubtitle}</div>}
                                            {d.accommodationAddress && <div>· {d.accommodationAddress}</div>}
                                        </div>
                                    )}
                                    {d.accommodationDescription && (
                                        <div style={{ ...itemBody, marginTop: S.boxBodyTop, fontSize: S.boxBody }}>{d.accommodationDescription}</div>
                                    )}
                                </div>
                                {accPhotos.length > 0 && (
                                    <div style={{ marginTop: S.accPhotosTop, display: 'grid', gridTemplateColumns: `repeat(${Math.min(accPhotos.length, 3)}, 1fr)`, gap: S.accPhotosGap }}>
                                        {accPhotos.slice(0, 3).map((src, j) => <Photo key={j} src={src} group={accPhotos} idx={j} height={S.accPhotoH} radius={S.accPhotoRadius} />)}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </section>
    );
}

export default DesignItinerary;
