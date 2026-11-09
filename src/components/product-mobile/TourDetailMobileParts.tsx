import type { CSSProperties, MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KAKAO_CHANNEL_CHAT_URL } from '../../constants/company';
import type { TourProduct } from '../../types/product';
import { MW, MW_FONT_EN, won } from '../desktop-primitives/mwTokens';
import { M_GRADIENT, M_HAIR } from '../mobile/mobileTheme';
import { Ico } from '../mobile/mobileUi';
import { shortWon, tourDiscountPct, type ReviewSummary, type TourPricing } from '../product/detail/productDetailData';
import type { DesktopReview } from '../reviews-desktop/reviewsData';
import { Stars } from '../reviews-desktop/reviewUi';

/**
 * Mobile-only parts of the tour detail (Claude Design: "Milkyway Japan Mobile" — Tour Detail):
 * the swipeable review cards and the booking card. The PC screen keeps the shared ones in
 * product/detail/DetailParts.
 */

/** The design shows this many review cards in the row; the rest are behind "전체 보기". */
const REVIEW_CARDS = 6;

const D_CHAT = 'M4 5h16v11H9l-5 4z';

// ───────────────────────── reviews ─────────────────────────

/** One review card of the row: initial + name + stars + date / title (1 line) / body (3 lines) / footer. */
function ReviewCardMobile({ r }: { r: DesktopReview }) {
    const navigate = useNavigate();
    const href = r.id ? `/reviews/${r.id}` : '/reviews';
    const open = (e: MouseEvent) => {
        e.preventDefault();
        navigate(href);
        window.scrollTo(0, 0);
    };
    return (
        <a
            href={href}
            onClick={open}
            style={{ flex: '0 0 82%', scrollSnapAlign: 'start', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10, padding: 16, border: `1px solid ${MW.line}`, borderRadius: 18, background: '#FFFFFF', color: MW.navy, minWidth: 0, textDecoration: 'none' }}
        >
            <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: MW.mintTint, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: MW.mintDeep }}>{r.author.charAt(0)}</span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.author} 님</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Stars rating={r.rating} size={11} spacing={1} />
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 9, color: MW.mute2 }}>{r.date}</span>
                    </span>
                </span>
            </span>
            {r.title && <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.45, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.title}</span>}
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.75, color: MW.ink3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.content}</p>
            <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8, borderTop: `1px solid ${M_HAIR}`, fontSize: 11, color: MW.mute }}>
                <span>도움이 됐어요 {r.helpful}</span>
                <span style={{ fontWeight: 700, color: MW.mintDeep }}>계속 읽기 →</span>
            </span>
        </a>
    );
}

/** 후기: the rating summary (real average + per-star counts) and the swipeable review cards. */
export function TourReviewsMobile({ summary }: { summary: ReviewSummary }) {
    const { list, count, avg, dist } = summary;

    if (count === 0) {
        return (
            <div style={{ padding: '28px 20px', borderRadius: 22, background: '#F7FAF9', textAlign: 'center', fontSize: 14, lineHeight: 1.8, color: MW.mute }}>
                이 투어에는 아직 후기가 없습니다. 참가 후 소중한 후기를 남겨 주세요.
            </div>
        );
    }

    const filled = Math.round(avg);

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
                {/* The design's guide / stay / meal scores are not collected; the per-star counts are the real breakdown. */}
                <div style={{ display: 'flex', gap: 18 }}>
                    {dist.map((d) => (
                        <span key={d.star} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, opacity: d.count > 0 ? 1 : 0.5 }}>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 16, fontWeight: 600 }}>{d.count}</span>
                            <span style={{ fontSize: 11, color: MW.mintTint, whiteSpace: 'nowrap' }}>★{d.star}</span>
                        </span>
                    ))}
                </div>
            </div>
            <div data-noscroll="" style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', margin: '0 -16px', padding: '2px 16px 6px', scrollPadding: '0 16px' }}>
                {list.slice(0, REVIEW_CARDS).map((r, i) => <ReviewCardMobile key={r.id || i} r={r} />)}
            </div>
        </>
    );
}

// ───────────────────────── booking card ─────────────────────────

const stepBtn: CSSProperties = { width: 40, height: 40, border: 0, borderRadius: '50%', fontSize: 18, lineHeight: 1, color: MW.navy, padding: 0, fontFamily: 'inherit' };

/**
 * Price, headcount (per-headcount tiers) and the two CTAs. The date is chosen on the booking page.
 * 무료 상담 opens the 카카오톡 채널 chat.
 */
export function BookingCardMobile({ product, pricing, onBook }: { product: TourProduct; pricing: TourPricing; onBook: () => void }) {
    const { options, people, unit, total } = pricing;
    const off = tourDiscountPct(product);
    // The original price belongs to the tour's "from" price; do not strike it against a dearer tier.
    const showOff = off > 0 && unit <= product.price;

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
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{won(unit)} × {people}명</span><span>{won(total)}</span></span>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>서비스 요금</span><span style={{ color: MW.mintDeep, fontWeight: 700 }}>무료</span></span>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 6, color: MW.navy }}>
                        <strong style={{ fontSize: 15 }}>합계</strong>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 24, fontWeight: 600 }}>{won(total)}</span>
                    </span>
                </div>
                <button type="button" onClick={onBook} style={{ height: 56, border: 0, borderRadius: 999, background: M_GRADIENT, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>예약하기</button>
                <a
                    href={KAKAO_CHANNEL_CHAT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, marginTop: -8, boxSizing: 'border-box', border: `1.5px solid ${MW.navy}`, borderRadius: 999, background: '#FFFFFF', fontSize: 14, fontWeight: 700, color: MW.navy, textDecoration: 'none' }}
                >
                    <Ico d={D_CHAT} size={17} />먼저 무료 상담
                </a>
            </div>
        </div>
    );
}
