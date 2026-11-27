import { useEffect, useLayoutEffect, useRef, useState, type AriaRole, type CSSProperties, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../../lib/api';
import { useWishlist } from '../../../hooks/useWishlist';
import type { ProductFAQ, TourProduct } from '../../../types/product';
import { ResponsiveProductImage } from '../../common/ResponsiveProductImage';
import { isUsableImage, won } from '../../desktop-primitives/mwTokens';
import type { HomeProduct } from '../../home-desktop/homeDesktopData';
import { useMe } from '../../mypage-desktop/useMyPageData';
import type { DesktopReview } from '../../reviews-desktop/reviewsData';
import { SD, SIcon, SStar } from '../../site-seed/seed';
import { durationLabel } from '../../tours-mobile/tourListFilters';
import { TourTypeBadge } from '../../tours-desktop/TourTypeBadge';
import { useToast } from '../../ui/Toast';
import { designFaqItems, designLines, tourImageAlt, useDesignPartValues } from './productDetailData';

/**
 * 새 투어 상세(디자인 ‘투어 상품 상세’ · ‘… — 모바일’, 2026-11-26)의 본문 부품. PC(product-desktop)와 휴대폰(product-mobile)이 함께 쓰고,
 * `compact`면 휴대폰 크기(글자·사진·여백이 작다)로 그린다.
 */

/** 구역 제목(PC 22px · 휴대폰 18px). id는 목차가 찾아가는 자리다. */
export function SectionTitle({ id, children, right, marginBottom = 16, compact = false }: { id?: string; children: ReactNode; right?: ReactNode; marginBottom?: number; compact?: boolean }) {
    const h2 = <h2 id={id} style={{ margin: 0, fontSize: compact ? 18 : 22, fontWeight: 700, color: SD.gray900 }}>{children}</h2>;
    if (!right) return <div style={{ marginBottom }}>{h2}</div>;
    return <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom }}>{h2}{right}</div>;
}

// ───────────────────────── 사진(PC) ─────────────────────────

const BIG = 460, SMALL = 228, WIDE = 392, GAP = 4;

/**
 * PC 상품 사진 줄: 큰 정사각 · 작은 두 장 세로 · 넓은 한 장 묶음이 오른쪽 끝까지 이어지고 화살표로 넘긴다.
 * 사진을 누르거나 ‘사진 모두 보기’를 누르면 전체 사진 창이 열린다.
 */
export function GalleryStrip({ images, name, onOpen }: { images: string[]; name: string; onOpen: () => void }) {
    const viewport = useRef<HTMLDivElement>(null);
    const track = useRef<HTMLDivElement>(null);
    const [room, setRoom] = useState(0);
    const [step, setStep] = useState(0);

    useLayoutEffect(() => {
        const measure = () => setRoom(Math.max(0, (track.current?.scrollWidth || 0) - (viewport.current?.clientWidth || 0) + 32));
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, [images.length]);

    if (images.length === 0) {
        return <div style={{ height: 320, borderRadius: 10, background: SD.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: SD.gray600 }}>사진 준비 중입니다</div>;
    }

    const shift = Math.min(step * (BIG + GAP), room);
    const img = (i: number, w: number, h: number) => (
        <button key={i} type="button" onClick={onOpen} aria-label={`사진 ${i + 1} 크게 보기`}
            style={{ position: 'relative', flex: 'none', width: w, height: h, padding: 0, border: 0, borderRadius: 10, overflow: 'hidden', background: SD.gray100, cursor: 'pointer' }}>
            <ResponsiveProductImage src={images[i]} alt={tourImageAlt(name, i)} sizes={`${w}px`} loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async"
                onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </button>
    );
    // 네 장씩: 큰 정사각 → 작은 두 장(세로) → 넓은 한 장
    const tiles: ReactNode[] = [];
    for (let i = 0; i < images.length; i += 4) {
        tiles.push(img(i, BIG, BIG));
        if (i + 1 < images.length) {
            tiles.push(
                <div key={`c${i}`} style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: GAP }}>
                    {img(i + 1, SMALL, SMALL)}
                    {i + 2 < images.length && img(i + 2, SMALL, SMALL)}
                </div>,
            );
        }
        if (i + 3 < images.length) tiles.push(img(i + 3, WIDE, BIG));
    }
    const arrow = (side: 'left' | 'right'): CSSProperties => ({ position: 'absolute', top: '50%', transform: 'translateY(-50%)', [side]: side === 'left' ? 16 : 48, width: 44, height: 44, border: 'none', borderRadius: 9999,
        background: SD.white, color: SD.gray900, boxShadow: '0 2px 6px rgba(0,0,0,0.16)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 });

    return (
        <div ref={viewport} role="region" aria-label="상품 사진" style={{ position: 'relative', marginRight: -32, overflow: 'hidden', borderRadius: '10px 0 0 10px' }}>
            <div ref={track} style={{ display: 'flex', gap: GAP, height: BIG, width: 'max-content', transition: 'transform 350ms ease', transform: `translateX(${-shift}px)` }}>{tiles}</div>
            {shift > 0 && <button type="button" aria-label="이전 사진" onClick={() => setStep(Math.max(0, Math.ceil(shift / (BIG + GAP)) - 1))} style={arrow('left')}><SIcon name="chevronLeft" size={20} stroke={2} /></button>}
            {shift < room && <button type="button" aria-label="다음 사진" onClick={() => setStep(step + 1)} style={arrow('right')}><SIcon name="chevronRight" size={20} stroke={2} /></button>}
            <button type="button" onClick={onOpen}
                style={{ position: 'absolute', right: 48, bottom: 16, display: 'inline-flex', alignItems: 'center', gap: 6, height: 40, padding: '0 14px', border: 'none', borderRadius: 8, background: SD.white, color: SD.gray900,
                    fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></svg>
                사진 모두 보기{images.length > 1 ? ` (${images.length})` : ''}
            </button>
        </div>
    );
}

// ───────────────────────── 상세 정보 접기 ─────────────────────────

/**
 * 상세 정보를 PC 360px · 휴대폰 480px까지만 보이고 아래를 흐리게 덮는다. 내용이 그보다 짧으면 단추 없이 다 보인다.
 * 휴대폰은 내용이 화면 끝까지 붙고(상세 그림), 단추만 좌우 여백을 둔다.
 */
export function CollapsibleDetail({ open, onToggle, children, compact = false }: { open: boolean; onToggle: () => void; children: ReactNode; compact?: boolean }) {
    const ref = useRef<HTMLDivElement>(null);
    const [tall, setTall] = useState(true);
    const limit = compact ? 480 : 360;
    useEffect(() => {
        const el = ref.current;
        if (!el || !window.ResizeObserver) return;
        const ro = new ResizeObserver(() => setTall(el.scrollHeight > limit + 60));
        ro.observe(el);
        return () => ro.disconnect();
    }, [limit]);
    const closed = tall && !open;
    return (
        <>
            <div style={{ position: 'relative', maxHeight: closed ? limit : 'none', overflow: 'hidden', borderRadius: compact ? 0 : 12 }}>
                <div ref={ref}>{children}</div>
                {closed && <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: compact ? 120 : 160, background: 'linear-gradient(to bottom, rgba(255,255,255,0), #ffffff 90%)' }} />}
            </div>
            {tall && (
                <div style={{ padding: compact ? '8px 20px 0' : '12px 0 0' }}>
                    <button type="button" onClick={onToggle} aria-expanded={open}
                        style={{ width: '100%', height: compact ? 48 : 52, border: `1px solid ${SD.gray200}`, borderRadius: 10, background: SD.white, fontFamily: 'inherit', fontSize: compact ? 14 : 15, fontWeight: 700, color: SD.gray900,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                        {open ? '상품 소개 접기' : '상품 소개 더보기'}<SIcon name={open ? 'chevronUp' : 'chevronDown'} size={18} stroke={1.8} />
                    </button>
                </div>
            )}
        </>
    );
}

// ───────────────────────── 포함·불포함 ─────────────────────────

/** 접기 한 칸: 제목 + 회색 설명 + 펼치기(처음에는 닫힘). 포함·불포함·유의 사항이 같은 모양을 쓴다. */
function Fold({ title, sub, defaultOpen, compact, children }: { title: string; sub: string; defaultOpen: boolean; compact: boolean; children: ReactNode }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ borderBottom: `1px solid ${SD.gray200}` }}>
            <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
                style={{ width: '100%', padding: '20px 0', border: 'none', background: 'transparent', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, textAlign: 'left', cursor: 'pointer' }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: compact ? 16 : 17, fontWeight: 700, color: SD.gray900 }}>{title}</span>
                    <span style={{ fontSize: 13, color: SD.gray500 }}>{sub}</span>
                </span>
                <span style={{ color: SD.gray500, display: 'flex' }}><SIcon name={open ? 'chevronUp' : 'chevronDown'} size={20} /></span>
            </button>
            {open && <div style={{ padding: '4px 0 24px' }}>{children}</div>}
        </div>
    );
}

/** 점 목록(· 항목) */
function DotList({ items, compact }: { items: string[]; compact: boolean }) {
    return (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: compact ? 14 : 15, lineHeight: compact ? 1.75 : 1.8, color: SD.gray700 }}>
            {items.map((x, i) => (
                <li key={i} style={{ display: 'flex', gap: 8 }}><span aria-hidden="true" style={{ flex: 'none', color: SD.gray500 }}>·</span><span>{x}</span></li>
            ))}
        </ul>
    );
}

function IncludeFold({ title, sub, items, note, defaultOpen, compact }: { title: string; sub: string; items: string[]; note?: string; defaultOpen: boolean; compact: boolean }) {
    return (
        <Fold title={title} sub={sub} defaultOpen={defaultOpen} compact={compact}>
            <DotList items={items} compact={compact} />
            {note && <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.7, color: SD.gray600 }}>※ {note}</p>}
        </Fold>
    );
}

/** 상품 디자인 틀의 ‘17 포함/불포함’ 값을 접기 모양으로(편집은 관리자 디자인 블록) */
export function DesignIncludedFolds({ product, compact = false }: { product: TourProduct; compact?: boolean }) {
    const v = useDesignPartValues(product, 'included');
    if (!v) return null;
    const included = designLines(v('inc_items')), excluded = designLines(v('exc_items'));
    return (
        <div>
            {included.length > 0 && <IncludeFold title="포함사항" sub="아래 항목들이 상품 가격에 포함돼요" items={included} defaultOpen={false} compact={compact} />}
            {excluded.length > 0 && <IncludeFold title="불포함사항" sub="아래 항목들이 상품 가격에 불포함돼요" items={excluded} defaultOpen={false} compact={compact} />}
        </div>
    );
}

// 화면 읽기 역할 이름(따옴표 낱말이 아이콘 이름 검사에 걸리지 않게 나눠 적는다 — CLAUDE.md 3.6)
const ROLE_TABLE = ['ta', 'ble'].join('') as AriaRole;

/** 유의 사항 안의 소제목 한 묶음 */
function NoticeGroup({ title, compact, children }: { title: string; compact: boolean; children: ReactNode }) {
    return (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {title && <h4 style={{ margin: 0, fontSize: compact ? 15 : 16, fontWeight: 700, color: SD.gray900 }}>{title}</h4>}
            {children}
        </section>
    );
}

/**
 * 상품 디자인 틀의 ‘19 예약 전 확인사항’ 값을 유의사항 접기 하나로(2026-11-27 오너 요청):
 * 예약금 취소 규정(강조 상자) · 투어 안내(검은 띠) · 숙박 안내(유형·사진·설비 표) · 동물 체험. 편집은 관리자 디자인 블록.
 */
export function DesignNoticeFold({ product, compact = false }: { product: TourProduct; compact?: boolean }) {
    const v = useDesignPartValues(product, 'notice');
    if (!v) return null;
    const text: CSSProperties = { margin: 0, fontSize: compact ? 14 : 15, lineHeight: compact ? 1.75 : 1.8, color: SD.gray700, whiteSpace: 'pre-line' };
    const cancel = designLines(v('cancel_body')), cancelBox = designLines(v('cancel_box'));
    const tour = designLines(v('tour_body')), animal = designLines(v('animal_body'));
    const head = v('gt_head').split('|').map((h) => h.trim());
    const rows = [1, 2, 3, 4].map((n) => ({ name: v(`gt${n}_name`).trim(), img: v(`gt${n}_img`).trim(), spec: v(`gt${n}_spec`).trim() })).filter((r) => r.name || r.spec);
    const cols = compact ? 'minmax(0,1fr) 84px minmax(0,1.5fr)' : 'minmax(0,1fr) 140px minmax(0,1.6fr)';
    const sub = v('terms_title').replace(/[!！]+$/, '').trim() || '예약 전에 꼭 확인해 주세요';
    return (
        <Fold title="유의사항" sub={sub} defaultOpen={false} compact={compact}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 24 : 28 }}>
                {(cancel.length > 0 || cancelBox.length > 0) && (
                    <NoticeGroup title={v('cancel_title')} compact={compact}>
                        {cancel.length > 0 && <DotList items={cancel} compact={compact} />}
                        {cancelBox.length > 0 && (
                            <div style={{ padding: compact ? '12px 14px' : '14px 18px', borderRadius: 10, background: SD.mint50, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                {cancelBox.map((line, i) => <p key={i} style={{ margin: 0, fontSize: compact ? 14 : 15, fontWeight: 700, color: SD.mint800 }}>{line}</p>)}
                            </div>
                        )}
                    </NoticeGroup>
                )}
                {(tour.length > 0 || v('tour_banner').trim()) && (
                    <NoticeGroup title={v('tour_title')} compact={compact}>
                        {tour.length > 0 && <DotList items={tour} compact={compact} />}
                        {v('tour_banner').trim() && <p style={{ margin: 0, padding: '11px 14px', borderRadius: 8, background: SD.gray900, color: SD.white, fontSize: 14, fontWeight: 700, textAlign: 'center' }}>{v('tour_banner')}</p>}
                    </NoticeGroup>
                )}
                {(v('gerstay_lead').trim() || v('gerstay_body').trim() || rows.length > 0) && (
                    <NoticeGroup title={v('gerstay_title')} compact={compact}>
                        {v('gerstay_lead').trim() && <p style={{ ...text, fontWeight: 700, color: SD.mint700 }}>{v('gerstay_lead')}</p>}
                        {v('gerstay_body').trim() && <p style={text}>{v('gerstay_body')}</p>}
                        {rows.length > 0 && (
                            <div role={ROLE_TABLE} aria-label={v('gerstay_title') || '숙박 안내'} style={{ marginTop: 4, border: `1px solid ${SD.gray200}`, borderRadius: 12, overflow: 'hidden' }}>
                                <div role="row" style={{ display: 'grid', gridTemplateColumns: cols, background: SD.gray50, fontSize: 13, fontWeight: 700, color: SD.gray700, textAlign: 'center' }}>
                                    {[0, 1, 2].map((i) => <span key={i} role="columnheader" style={{ padding: '10px 6px' }}>{head[i] || ''}</span>)}
                                </div>
                                {rows.map((r, i) => (
                                    <div key={i} role="row" style={{ display: 'grid', gridTemplateColumns: cols, alignItems: 'center', borderTop: `1px solid ${SD.gray200}` }}>
                                        <span role="cell" style={{ padding: '12px 6px', fontSize: compact ? 13 : 14, fontWeight: 700, lineHeight: 1.45, color: SD.gray900, textAlign: 'center', whiteSpace: 'pre-line' }}>{r.name}</span>
                                        <span role="cell" style={{ padding: '8px 4px' }}>
                                            <span style={{ display: 'block', position: 'relative', aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden', background: SD.gray100 }}>
                                                {isUsableImage(r.img) && <ResponsiveProductImage src={r.img} alt={r.name.replace(/\s+/g, ' ')} loading="lazy" decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                                            </span>
                                        </span>
                                        <span role="cell" style={{ padding: '10px 10px', fontSize: compact ? 13 : 14, lineHeight: 1.7, color: SD.gray700, whiteSpace: 'pre-line' }}>{r.spec}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </NoticeGroup>
                )}
                {animal.length > 0 && (
                    <NoticeGroup title={v('animal_title')} compact={compact}>
                        <DotList items={animal} compact={compact} />
                    </NoticeGroup>
                )}
            </div>
        </Fold>
    );
}

/** 포함사항(처음에 펼침) · 불포함사항(접힘). 상품에 적은 목록 그대로. */
export function IncludedFolds({ product, compact = false }: { product: TourProduct; compact?: boolean }) {
    const included = (product.included ?? []).filter(Boolean);
    const excluded = (product.excluded ?? []).filter(Boolean);
    return (
        <div>
            {included.length > 0 && <IncludeFold title="포함사항" sub="아래 항목들이 상품 가격에 포함돼요" items={included} defaultOpen={false} compact={compact} />}
            {excluded.length > 0 && (
                <IncludeFold title="불포함사항" sub="아래 항목들이 상품 가격에 불포함돼요" items={excluded} defaultOpen={false} compact={compact}
                    note="국제선 항공권 준비도 도와드려요. 비자 필요 여부는 출발 시점의 규정에 따라 달라질 수 있어 예약 시 안내해 드려요." />
            )}
        </div>
    );
}

// ───────────────────────── 후기 ─────────────────────────

function Stars({ rating, size }: { rating: number; size: number }) {
    return (
        <span role="img" aria-label={`별점 ${rating}점`} style={{ display: 'flex', gap: size > 14 ? 2 : 1 }}>
            {[1, 2, 3, 4, 5].map((k) => <span key={k} style={{ display: 'flex', color: k <= rating ? SD.gray900 : SD.gray300 }}><SStar size={size} /></span>)}
        </span>
    );
}

const TOUR_CHIP: CSSProperties = { alignSelf: 'flex-start', maxWidth: '100%', display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 8px', borderRadius: 6, background: SD.gray100, color: SD.gray700,
    fontSize: 12, fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', boxSizing: 'border-box' };

function ReviewItem({ r, last, helpfulOn, count, onHelpful, compact, otherTour }: { r: DesktopReview; last: boolean; helpfulOn: boolean; count: number; onHelpful: () => void; compact: boolean; otherTour: boolean }) {
    const navigate = useNavigate();
    const textRef = useRef<HTMLParagraphElement>(null);
    const [open, setOpen] = useState(false);
    const [long, setLong] = useState(false);
    useLayoutEffect(() => {
        const el = textRef.current;
        if (el) setLong(el.scrollHeight > el.clientHeight + 2);
    }, [r.content]);
    const photos = r.images.filter(isUsableImage).slice(0, compact ? 8 : 4);
    const photo = compact ? 104 : 148;
    return (
        <article style={{ padding: compact ? '20px 0' : '28px 0', borderBottom: last ? 'none' : `1px solid ${SD.gray200}`, display: 'flex', flexDirection: 'column', gap: compact ? 10 : 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Stars rating={r.rating} size={compact ? 14 : 16} />
                <span style={{ fontSize: compact ? 12 : 13, color: SD.gray500 }}>{[r.author, r.date].filter(Boolean).join(' · ')}</span>
            </div>
            {otherTour && r.productName && (r.productId ? (
                <a href={`/products/${r.productId}`} onClick={(e) => { e.preventDefault(); navigate(`/products/${r.productId}`); }} style={TOUR_CHIP}>
                    {r.productName}
                </a>
            ) : <span style={TOUR_CHIP}>{r.productName}</span>)}
            {r.title && <p style={{ margin: 0, fontSize: compact ? 15 : 16, fontWeight: 700, color: SD.gray900 }}>{r.title}</p>}
            <p ref={textRef} style={{ margin: 0, fontSize: compact ? 14 : 15, lineHeight: 1.7, color: SD.gray900, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                ...(open ? null : { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>{r.content}</p>
            {(long || open) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: compact ? 0 : -4 }}>
                    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
                        style={{ minHeight: compact ? 32 : undefined, padding: 0, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: compact ? 12 : 13, color: SD.gray700, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>
                        {open ? '접기' : '리뷰 더보기'}
                    </button>
                </div>
            )}
            {photos.length > 0 && (
                <div data-noscroll="" style={{ display: 'flex', gap: compact ? 6 : 8, overflowX: compact ? 'auto' : 'visible', scrollbarWidth: 'none' }}>
                    {photos.map((src, i) => (
                        <ResponsiveProductImage key={i} src={src} sizes={`${photo}px`} alt={`${r.author} 님의 후기 사진 ${i + 1}`} loading="lazy" decoding="async"
                            onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                            style={{ flex: 'none', width: photo, height: photo, borderRadius: 8, objectFit: 'cover', display: 'block', background: SD.gray100 }} />
                    ))}
                </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button type="button" onClick={onHelpful} aria-pressed={helpfulOn}
                    style={{ height: compact ? 32 : 28, padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: compact ? 12 : 13, color: helpfulOn ? SD.mint700 : SD.gray600, fontWeight: helpfulOn ? 700 : 400,
                        display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                    <svg width={compact ? 14 : 16} height={compact ? 14 : 16} viewBox="0 0 24 24" fill={helpfulOn ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M7 10v10H4V10zM7 10l4-7c1.5 0 2.5 1.2 2.2 2.7L12.6 9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7" />
                    </svg>
                    도움돼요{count > 0 ? ` ${count}` : ''}
                </button>
            </div>
        </article>
    );
}

/**
 * 후기 3개(별점 · 작성자 · 날짜 · 세 줄 + 리뷰 더보기 · 사진 · 도움돼요). ‘도움돼요’는 로그인한 고객만 누른다.
 * 다른 투어(같은 지역)의 후기에는 그 투어 이름 꼬리표를 붙인다(누르면 그 투어로).
 */
export function ReviewList({ reviews, productId, compact = false }: { reviews: DesktopReview[]; productId: string; compact?: boolean }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { showToast } = useToast();
    const { data: me } = useMe();
    const shown = reviews.slice(0, 3);
    const ids = shown.map((r) => r.id).join(',');
    const [helpful, setHelpful] = useState<Record<string, { on: boolean; count: number }>>({});

    // 로그인했으면 내가 누른 후기를 읽어 둔다(보이는 3개만).
    useEffect(() => {
        if (!me || !ids) return;
        let alive = true;
        Promise.all(ids.split(',').map((id) => api.reviews.getHelpfulStatus(id).then((s: { helpful?: boolean; helpful_count?: number }) => [id, s] as const).catch(() => null)))
            .then((rows) => {
                if (!alive) return;
                const next: Record<string, { on: boolean; count: number }> = {};
                for (const row of rows) if (row) next[row[0]] = { on: Boolean(row[1].helpful), count: Number(row[1].helpful_count || 0) };
                setHelpful((cur) => ({ ...cur, ...next }));
            });
        return () => { alive = false; };
    }, [me, ids]);

    const toggle = async (r: DesktopReview) => {
        if (!me) {
            showToast('warning', '‘도움돼요’를 누르려면 로그인해 주세요.');
            navigate('/login', { state: { from: location.pathname } });
            return;
        }
        try {
            const res = await api.reviews.toggleHelpful(r.id);
            setHelpful((cur) => ({ ...cur, [r.id]: { on: Boolean(res.helpful), count: Number(res.helpful_count || 0) } }));
        } catch {
            showToast('error', '처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
        }
    };

    if (shown.length === 0) {
        return <p style={{ margin: '12px 0 0', padding: compact ? '24px 0' : '32px 0', textAlign: 'center', fontSize: compact ? 14 : 15, color: SD.gray600, borderRadius: 12, background: SD.gray50 }}>아직 이 투어의 후기가 없어요</p>;
    }
    return (
        <div>
            {shown.map((r, i) => (
                <ReviewItem key={r.id || i} r={r} last={i === shown.length - 1} helpfulOn={!!helpful[r.id]?.on} count={helpful[r.id]?.count ?? r.helpful} onHelpful={() => toggle(r)} compact={compact} otherTour={r.productId !== productId} />
            ))}
        </div>
    );
}

// ───────────────────────── FAQ ─────────────────────────

/** 유의 사항·FAQ: 처음에는 모두 닫혀 있고(2026-11-26 오너 요청), 한 번에 하나만 펼친다. */
export function FaqFolds({ items, compact = false }: { items: ProductFAQ[]; compact?: boolean }) {
    const [openIndex, setOpenIndex] = useState(-1);
    return (
        <div>
            {items.map((f, i) => {
                const open = openIndex === i;
                return (
                    <div key={i} style={{ borderBottom: `1px solid ${SD.gray200}` }}>
                        <button type="button" onClick={() => setOpenIndex(open ? -1 : i)} aria-expanded={open}
                            style={{ width: '100%', minHeight: compact ? 56 : 64, padding: compact ? '16px 0' : '18px 0', border: 'none', background: 'transparent', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', cursor: 'pointer' }}>
                            <span style={{ flex: 'none', fontSize: 15, fontWeight: 700, color: SD.mint500 }}>Q</span>
                            <span style={{ flex: '1 1 auto', fontSize: compact ? 15 : 16, fontWeight: 700, lineHeight: 1.45, color: SD.gray900 }}>{f.q}</span>
                            <span style={{ flex: 'none', color: SD.gray500, display: 'flex' }}><SIcon name={open ? 'chevronUp' : 'chevronDown'} size={20} /></span>
                        </button>
                        {open && (
                            <div style={{ margin: '0 0 20px', padding: compact ? '16px 18px' : '20px 24px', borderRadius: compact ? 12 : 14, background: SD.gray50, fontSize: compact ? 14 : 15, lineHeight: 1.75, color: SD.gray700, whiteSpace: 'pre-wrap' }}>{f.a}</div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

/** 상품 디자인 틀의 ‘20 FAQ’ 값(질문·답변 1~5)을 FAQ 접기로(편집은 관리자 디자인 블록) */
export function DesignFaqFolds({ product, compact = false }: { product: TourProduct; compact?: boolean }) {
    const items = designFaqItems(useDesignPartValues(product, 'faq'));
    return items.length ? <FaqFolds items={items} compact={compact} /> : null;
}

// ───────────────────────── 관련 상품 ─────────────────────────

function RelatedCard({ p, compact }: { p: HomeProduct; compact: boolean }) {
    const navigate = useNavigate();
    const wishlist = useWishlist();
    const on = wishlist.has(p.id);
    const href = `/products/${p.id}`;
    const days = durationLabel(p.duration).replace(/\s+/g, '');
    const prefix = ['몽골', p.category, days].filter(Boolean).join('/');
    const w = compact ? 148 : 200, h = compact ? 148 : 180;
    return (
        <li style={{ flex: `0 0 ${w}px`, width: w, display: 'flex', flexDirection: 'column', gap: compact ? 4 : 6 }}>
            <div style={{ position: 'relative', width: w, height: h, borderRadius: compact ? 10 : 12, overflow: 'hidden', background: SD.gray100 }}>
                <a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }} tabIndex={-1} aria-hidden="true" style={{ position: 'absolute', inset: 0 }}>
                    {isUsableImage(p.mainImages[0]) && (
                        <ResponsiveProductImage src={p.mainImages[0]} sizes={`${w}px`} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                </a>
                <TourTypeBadge type={p.packageType} size="sm" style={compact ? { left: 6, top: 6, height: 20, fontSize: 10, borderRadius: 5 } : { left: 8, top: 8 }} />
                <button type="button" aria-label={on ? '찜 목록에서 삭제' : '찜하기'} aria-pressed={on} onClick={() => wishlist.toggle(p)}
                    style={{ position: 'absolute', right: compact ? 0 : 2, top: compact ? 0 : 2, width: compact ? 40 : 40, height: compact ? 40 : 40, border: 'none', background: 'transparent', color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))' }}>
                    <svg width={compact ? 20 : 22} height={compact ? 20 : 22} viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M6 3.5h12v17l-6-4-6 4z" /></svg>
                </button>
            </div>
            <a href={href} onClick={(e) => { e.preventDefault(); navigate(href); }}
                style={{ marginTop: 4, fontSize: compact ? 13 : 14, lineHeight: 1.45, color: SD.gray900, textDecoration: 'none', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: compact ? 38 : 41 }}>
                [{prefix}] {p.name}
            </a>
            <span style={{ fontSize: compact ? 14 : 15, fontWeight: 700, color: SD.gray900 }}>{won(p.price)}</span>
            <span style={{ fontSize: compact ? 11 : 12, color: SD.gray500 }}>투어</span>
        </li>
    );
}

/** 옆으로 넘기는 상품 줄(PC 200px · 휴대폰 148px 카드). 상품이 없으면 줄을 뺀다. 휴대폰은 좌우 20px 안쪽에서 시작한다. */
export function RelatedRow({ title, tours, compact = false }: { title: string; tours: HomeProduct[]; compact?: boolean }) {
    if (tours.length === 0) return null;
    return (
        <section aria-label={title} style={{ display: 'flex', flexDirection: 'column', gap: compact ? 14 : 16 }}>
            <h2 style={{ margin: 0, padding: compact ? '0 20px' : 0, fontSize: compact ? 18 : 20, fontWeight: 700, color: SD.gray900 }}>{title}</h2>
            <ul data-noscroll="" style={{ margin: 0, padding: compact ? '0 20px' : '0 0 4px', listStyle: 'none', display: 'flex', gap: compact ? 10 : 14, overflowX: 'auto', scrollbarWidth: 'none', scrollPadding: compact ? '0 20px' : undefined }}>
                {tours.map((p) => <RelatedCard key={p.id} p={p} compact={compact} />)}
            </ul>
        </section>
    );
}
