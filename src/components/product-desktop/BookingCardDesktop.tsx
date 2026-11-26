import { useState, type CSSProperties } from 'react';
import { won } from '../desktop-primitives/mwTokens';
import { tourDiscountPct, type TourPricing } from '../product/detail/productDetailData';
import { SD, SIcon } from '../site-seed/seed';
import type { TourProduct } from '../../types/product';

interface Props {
    product: TourProduct;
    pricing: TourPricing;
    onBook: () => void;
    fav: boolean;
    onFav: () => void;
}

/** 동전 그림(‘인원별 요금’ 단추 위로 떠오르는 안내 효과). */
function Coin() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill={SD.mint400} />
            <circle cx="12" cy="12" r="8" fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" />
            <text x="12" y="16.2" textAnchor="middle" fontSize="11" fontWeight="700" fill="#ffffff" fontFamily="Arial, sans-serif">₩</text>
        </svg>
    );
}

/**
 * PC 상품 상세 오른쪽 예약 상자(디자인 ‘투어 상품 상세’).
 * 1인 요금 + ‘인원별 요금’ 말풍선(관리자 인원 단계별 1인 요금) · 인원 − / + · 총 여행 금액 → ① 예약금(지금, 계좌이체) ② 잔금(현지, 현금)
 * · 예약하기 · 찜하기 · 예약금 환불 안내. 예약금·잔금은 고른 인원 단계의 값이고, 관리자가 넣지 않았으면 두 단계 표시를 뺀다.
 */
export function BookingCardDesktop({ product, pricing, onBook, fav, onFav }: Props) {
    const { options, people, unit, total, depositPer, localPer } = pricing;
    const [tipOpen, setTipOpen] = useState(false);
    const [tipSeen, setTipSeen] = useState(false);
    const off = tourDiscountPct(product);
    // 정가는 상품 ‘~부터’ 가격 기준이라 더 비싼 인원 단계에는 할인율을 붙이지 않는다.
    const showOff = off > 0 && unit <= product.price;
    const deposit = depositPer * people;
    const balance = localPer > 0 ? localPer * people : Math.max(0, total - deposit);
    const top = options[0]?.pricePerPerson || 0;
    const hasTiers = options.length > 1;

    const openTip = () => { setTipOpen(true); setTipSeen(true); };

    return (
        <div style={{ border: `1px solid ${SD.gray200}`, borderRadius: 20, background: SD.white, boxShadow: '0 8px 24px rgba(0,0,0,0.05)', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <style>{TIP_CSS}</style>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }} onMouseLeave={() => setTipOpen(false)}>
                {tipOpen && hasTiers && (
                    <div role="dialog" aria-label="인원별 요금"
                        style={{ position: 'absolute', left: -12, right: -12, top: 30, zIndex: 30, background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 16, boxShadow: '0 16px 40px rgba(0,0,0,0.12)', padding: '18px 18px 16px' }}>
                        <span aria-hidden="true" style={{ position: 'absolute', left: 66, top: -6, width: 10, height: 10, background: SD.white, borderLeft: `1px solid ${SD.gray200}`, borderTop: `1px solid ${SD.gray200}`, transform: 'rotate(45deg)' }} />
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900 }}>인원별 1인 요금</span>
                                {pricing.groupSaves && <span style={{ fontSize: 12, color: SD.gray600 }}>함께 가는 인원이 많을수록 저렴해요</span>}
                            </span>
                            <button type="button" aria-label="닫기" onClick={() => setTipOpen(false)}
                                style={{ flex: 'none', width: 28, height: 28, margin: '-4px -6px 0 0', border: 'none', background: 'transparent', color: SD.gray600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                                <SIcon name="close" size={16} />
                            </button>
                        </div>
                        <div role="radiogroup" aria-label="인원 선택" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {options.map((o) => {
                                const on = o.people === people;
                                const pct = top > 0 ? Math.max(8, Math.round((o.pricePerPerson / top) * 100)) : 100;
                                return (
                                    <button key={o.people} type="button" role="radio" aria-checked={on} onClick={() => pricing.setPeople(o.people)}
                                        style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto', alignItems: 'center', gap: 12, height: 38, padding: '0 10px', border: 'none', borderRadius: 10,
                                            background: on ? SD.mint50 : 'transparent', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                                        <span style={{ fontSize: 13, fontWeight: on ? 700 : 500, color: SD.gray900 }}>{o.people}명</span>
                                        <span aria-hidden="true" style={{ height: 6, borderRadius: 9999, background: SD.gray100, overflow: 'hidden' }}>
                                            <span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 9999, background: on ? SD.mint400 : SD.gray300 }} />
                                        </span>
                                        <span style={{ fontSize: 14, fontWeight: 700, color: on ? SD.mint700 : SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(o.pricePerPerson)}</span>
                                    </button>
                                );
                            })}
                        </div>
                        {depositPer > 0 && (
                            <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: SD.gray50, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, lineHeight: '18px', color: SD.gray700 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                    <span><strong style={{ color: SD.mint700 }}>예약금</strong> 1인 {won(depositPer)}</span>
                                    <span style={{ color: SD.gray600 }}>계좌이체 · 예약 후 안내</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                    <span><strong style={{ color: SD.gray900 }}>잔금</strong> 나머지 금액</span>
                                    <span style={{ color: SD.gray600 }}>현지 현금 · 가이드에게 전달</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: SD.gray600 }}>
                        1인 요금
                        {hasTiers && (
                            <button type="button" className={tipOpen || tipSeen ? undefined : 'tip-hint'} aria-label="인원별 요금 보기" aria-expanded={tipOpen}
                                onClick={() => (tipOpen ? setTipOpen(false) : openTip())} onMouseEnter={openTip}
                                style={{ position: 'relative', height: 22, padding: '0 6px', marginLeft: 2, border: 'none', borderRadius: 6, background: SD.gray100, color: SD.gray700, fontFamily: 'inherit',
                                    fontSize: 11, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                                {!tipOpen && !tipSeen && [4, 30, 56].map((left, i) => (
                                    <span key={left} aria-hidden="true" className="tip-coin" style={{ left, animationDelay: `${i * 0.6}s` }}><Coin /></span>
                                ))}
                                <SIcon name="info" size={12} stroke={2} />인원별 요금
                            </button>
                        )}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                        {showOff && <span style={{ fontSize: 20, fontWeight: 700, color: SD.red }}>{off}%</span>}
                        <span style={{ fontSize: 26, fontWeight: 700, color: SD.gray900, letterSpacing: '-0.3px' }}>{won(unit)}</span>
                    </span>
                </span>
                <div style={{ flex: 'none', display: 'flex', alignItems: 'center', height: 40, border: `1px solid ${SD.gray200}`, borderRadius: 9999 }}>
                    <button type="button" aria-label="인원 줄이기" onClick={pricing.dec} disabled={!pricing.canDec} style={{ ...STEP, opacity: pricing.canDec ? 1 : 0.3, cursor: pricing.canDec ? 'pointer' : 'default' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
                    </button>
                    <span aria-live="polite" style={{ minWidth: 36, textAlign: 'center', fontSize: 15, fontWeight: 700, color: SD.gray900 }}>{people}명</span>
                    <button type="button" aria-label="인원 늘리기" onClick={pricing.inc} disabled={!pricing.canInc} style={{ ...STEP, opacity: pricing.canInc ? 1 : 0.3, cursor: pricing.canInc ? 'pointer' : 'default' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                    </button>
                </div>
            </div>
            <p style={{ margin: '-12px 0 0', fontSize: 12, color: SD.gray600 }}><strong style={{ color: SD.gray900, fontWeight: 700 }}>{people}명</strong> 투어 시 1인 가격입니다.</p>

            <div style={{ borderRadius: 14, background: SD.gray50, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: 2, alignItems: 'center' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, lineHeight: '22px', color: SD.gray900 }}>총 여행 금액</span>
                    <span style={{ fontSize: 16, fontWeight: 700, lineHeight: '22px', color: SD.gray900, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{won(total)}</span>
                    <span style={{ gridColumn: '1 / 3', fontSize: 12, lineHeight: '18px', color: SD.gray600 }}>{won(unit)} × {people}명</span>
                </div>
                {depositPer > 0 && (
                    <>
                        <div style={{ height: 1, background: SD.gray200 }} />
                        <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                            <li style={{ ...STEP_ROW, paddingBottom: 16 }}>
                                <span aria-hidden="true" style={{ position: 'absolute', left: 9, top: 24, bottom: 2, width: 2, background: SD.gray200 }} />
                                <span style={{ ...STEP_NO, background: SD.mint500, color: SD.white }}>1</span>
                                <span style={STEP_LABEL}>총 결제금액</span>
                                <span style={{ ...STEP_AMOUNT, fontSize: 18, color: SD.mint600 }}>{won(deposit)}</span>
                                <span />
                                <span style={STEP_NOTE}><strong style={{ color: SD.mint700, fontWeight: 700 }}>지금 결제</strong> · 예약금 · 계좌이체</span>
                            </li>
                            <li style={STEP_ROW}>
                                <span style={{ ...STEP_NO, background: SD.white, border: `1.5px solid ${SD.gray300}`, color: SD.gray700 }}>2</span>
                                <span style={STEP_LABEL}>총 결제 예정 금액</span>
                                <span style={{ ...STEP_AMOUNT, fontSize: 16, color: SD.gray900 }}>{won(balance)}</span>
                                <span />
                                <span style={STEP_NOTE}><strong style={{ color: SD.gray700, fontWeight: 700 }}>현지 결제</strong> · 잔금 · 현금</span>
                            </li>
                        </ol>
                    </>
                )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button type="button" onClick={onBook} style={{ ...BIG_BUTTON, background: SD.mint700, color: SD.white }}>예약하기</button>
                <button type="button" onClick={onFav} aria-pressed={fav} style={{ ...BIG_BUTTON, background: SD.white, color: SD.gray900, border: `1px solid ${SD.gray300}` }}>
                    <span style={{ display: 'flex', color: fav ? SD.red : SD.gray900 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill={fav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />
                        </svg>
                    </span>
                    {fav ? '찜한 상품' : '찜하기'}
                </button>
            </div>
            <p style={{ margin: '-6px 0 0', display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, lineHeight: '20px', color: SD.gray600 }}>
                <span style={{ flex: 'none', height: 20, display: 'flex', alignItems: 'center' }}><SIcon name="info" size={14} stroke={1.8} /></span>
                <span>예약금은 호텔·숙박 시설의 선결제 금액으로 사용되므로 <br />취소 시에도 환불되지 않아요.</span>
            </p>
        </div>
    );
}

const STEP: CSSProperties = { width: 38, height: 38, border: 'none', background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };
const STEP_ROW: CSSProperties = { position: 'relative', display: 'grid', gridTemplateColumns: '20px 1fr auto', columnGap: 10, rowGap: 2, alignItems: 'center' };
const STEP_NO: CSSProperties = { width: 20, height: 20, borderRadius: 9999, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' };
const STEP_LABEL: CSSProperties = { fontSize: 14, fontWeight: 700, lineHeight: '22px', color: SD.gray900, whiteSpace: 'nowrap' };
const STEP_AMOUNT: CSSProperties = { lineHeight: '22px', fontWeight: 700, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', textAlign: 'right' };
const STEP_NOTE: CSSProperties = { gridColumn: '2 / 4', fontSize: 12, lineHeight: '18px', color: SD.gray600 };
const BIG_BUTTON: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: 52, border: 'none', borderRadius: 10, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' };

/** ‘인원별 요금’ 단추가 처음에 살짝 맥박치고 동전이 떠오른다(한 번 열면 멈춤, 움직임 줄이기 설정이면 안 움직임). */
const TIP_CSS = `
.tip-hint { animation: tipPulse 1.8s ease-out infinite; }
.tip-hint svg { animation: tipNudge 1.8s ease-in-out infinite; transform-origin: 50% 50%; }
@keyframes tipPulse { 0% { box-shadow: 0 0 0 0 rgba(54,209,167,0.55); } 70% { box-shadow: 0 0 0 7px rgba(54,209,167,0); } 100% { box-shadow: 0 0 0 0 rgba(54,209,167,0); } }
@keyframes tipNudge { 0%, 60%, 100% { transform: scale(1); } 30% { transform: scale(1.25); } }
.tip-coin { position: absolute; bottom: 100%; pointer-events: none; opacity: 0; animation: coinFloat 1.8s ease-out infinite; }
.tip-coin svg { animation: none; }
@keyframes coinFloat { 0% { transform: translateY(8px) scale(0.7); opacity: 0; } 25% { opacity: 1; } 100% { transform: translateY(-14px) scale(1); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .tip-hint, .tip-hint svg { animation: none; } .tip-coin { display: none; } }
`;
