import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DEPOSIT_ACCOUNT, DEPOSIT_PAYMENT_METHOD } from '../../constants/company';
import type { TourPricingOption } from '../../types/product';
import { copyText } from '../../utils/copyText';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { SD, SIcon } from '../site-seed/seed';
import { BK_WEEK, addDays, bareName, optionPriceLabel, sameDay, startOfToday, type BookingOptionItem, type BookingProduct } from '../reservation-shared/bookingShared';

/**
 * PC 예약 1~3단계 부품(Claude Design ‘예약하기 — 1·2·3단계 (PC)’, 2026-11-26).
 * 휴대폰 예약 화면(reservation-mobile + reservation-shared 카드)은 따로 그린다.
 */

const WD = BK_WEEK;

/** 흰 구역 카드: 번호 동그라미 + 제목 + 설명, 오른쪽 자리(right). */
export function StepSection({ no, title, sub, right, children, id }: { no?: number; title: string; sub?: ReactNode; right?: ReactNode; children?: ReactNode; id?: string }) {
    return (
        <section id={id} style={{ background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 16, padding: '28px 32px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: children ? 20 : 0 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
                    {no !== undefined && (
                        <span style={{ flex: 'none', width: 26, height: 26, borderRadius: 9999, background: SD.gray900, color: SD.white, fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{no}</span>
                    )}
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: SD.gray900, lineHeight: '26px' }}>{title}</h2>
                        {sub && <span style={{ fontSize: 13, lineHeight: 1.6, color: SD.gray600 }}>{sub}</span>}
                    </span>
                </div>
                {right}
            </div>
            {children}
        </section>
    );
}

// ───────────────────────── 1단계: 달력 ─────────────────────────

/** 출발일 달력. 지난 날은 고를 수 없다(사이트의 유일한 예약 가능 규칙). 출발·도착은 검은 칸, 여행 기간은 옅은 민트 띠. */
export function TripCalendar({ value, onChange, nights }: { value: Date | null; onChange: (d: Date) => void; nights: number }) {
    const today = startOfToday();
    const [ym, setYm] = useState(() => {
        const seed = value ?? today;
        return { y: seed.getFullYear(), m: seed.getMonth() };
    });
    const { y, m } = ym;
    const first = new Date(y, m, 1).getDay();
    const last = new Date(y, m + 1, 0).getDate();
    const end = value ? addDays(value, nights) : null;
    const noPrev = y < today.getFullYear() || (y === today.getFullYear() && m <= today.getMonth());
    const move = (k: number) => {
        const nd = new Date(y, m + k, 1);
        setYm({ y: nd.getFullYear(), m: nd.getMonth() });
    };
    const navBtn = (disabled: boolean): CSSProperties => ({ width: 40, height: 40, borderRadius: 9999, border: `1px solid ${SD.gray200}`, background: SD.white, color: SD.gray900, display: 'flex',
        alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1, padding: 0 });

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button type="button" aria-label="이전 달" onClick={() => { if (!noPrev) move(-1); }} disabled={noPrev} style={navBtn(noPrev)}><SIcon name="chevronLeft" size={18} stroke={2} /></button>
                <span aria-live="polite" style={{ fontSize: 18, fontWeight: 700, color: SD.gray900 }}>{y}년 {m + 1}월</span>
                <button type="button" aria-label="다음 달" onClick={() => move(1)} style={navBtn(false)}><SIcon name="chevronRight" size={18} stroke={2} /></button>
            </div>
            <div role="grid" aria-label={`${y}년 ${m + 1}월 달력`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', rowGap: 4 }}>
                {WD.map((w) => <span key={w} style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: SD.gray500 }}>{w}</span>)}
                {Array.from({ length: first }, (_, i) => <span key={`b${i}`} />)}
                {Array.from({ length: last }, (_, i) => {
                    const dd = i + 1;
                    const date = new Date(y, m, dd);
                    const off = date < today;
                    const isS = sameDay(date, value);
                    const isE = nights > 0 && sameDay(date, end);
                    const inR = !!value && !!end && date > value && date < end;
                    const edge = isS || isE;
                    const banded = nights > 0 && !!value && (inR || edge);
                    const col = (first + i) % 7;
                    const L = isS || col === 0 || dd === 1;
                    const R = isE || col === 6 || dd === last;
                    const r = (on: boolean) => (on ? '12px' : '0');
                    return (
                        <div key={dd} style={{ height: 52, padding: '4px 0', boxSizing: 'border-box' }}>
                            <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', background: banded ? SD.mint50 : 'transparent', borderRadius: `${r(L)} ${r(R)} ${r(R)} ${r(L)}` }}>
                                <button type="button" onClick={() => onChange(date)} disabled={off} aria-pressed={isS} aria-label={`${m + 1}월 ${dd}일${off ? ' 예약 불가' : ''}`}
                                    style={{ width: 48, height: 44, borderRadius: 12, border: 'none', background: edge ? SD.gray900 : 'transparent', color: edge ? SD.white : off ? SD.gray400 : SD.gray900,
                                        fontFamily: 'inherit', fontSize: 15, fontWeight: edge || !off ? 700 : 400, cursor: off ? 'default' : 'pointer', padding: 0, display: 'flex', flexDirection: 'column',
                                        alignItems: 'center', justifyContent: 'center' }}>
                                    {dd}
                                    <span style={{ fontSize: 9, lineHeight: '10px', fontWeight: 700, color: edge ? SD.mint200 : 'transparent' }}>{isS ? '출발' : isE ? '도착' : ''}</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${SD.gray100}`, display: 'flex', gap: 20, fontSize: 12, color: SD.gray600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 9999, background: SD.gray900 }} />출발일·도착일</span>
                {nights > 0 && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 14, height: 14, borderRadius: 4, background: SD.mint50, border: `1px solid ${SD.mint200}`, boxSizing: 'border-box' }} />여행 기간</span>}
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ color: SD.gray400, fontWeight: 700 }}>12</span>예약 불가</span>
            </div>
        </div>
    );
}

// ───────────────────────── 1단계: 인원 ─────────────────────────

/** 인원별 1인 요금 말풍선(막대 + 금액) · 예약금/잔금 안내. */
export function TierPopover({ tiers, people, onPick, onClose, depositPer }: { tiers: TourPricingOption[]; people: number; onPick: (n: number) => void; onClose: () => void; depositPer: number }) {
    const top = tiers[0]?.pricePerPerson || 0;
    const groupSaves = tiers.length > 1 && tiers[tiers.length - 1].pricePerPerson < tiers[0].pricePerPerson;
    return (
        <div role="dialog" aria-label="인원별 요금"
            style={{ position: 'absolute', right: 0, width: 360, top: 44, zIndex: 30, background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 16, boxShadow: '0 16px 40px rgba(0,0,0,0.12)', padding: '18px 18px 16px' }}>
            <span aria-hidden="true" style={{ position: 'absolute', right: 56, top: -6, width: 10, height: 10, background: SD.white, borderLeft: `1px solid ${SD.gray200}`, borderTop: `1px solid ${SD.gray200}`, transform: 'rotate(45deg)' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900 }}>인원별 1인 요금</span>
                    {groupSaves && <span style={{ fontSize: 12, color: SD.gray600 }}>함께 가는 인원이 많을수록 저렴해요</span>}
                </span>
                <button type="button" aria-label="닫기" onClick={onClose} style={{ flex: 'none', width: 28, height: 28, margin: '-4px -6px 0 0', border: 'none', background: 'transparent', color: SD.gray600, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                    <SIcon name="close" size={16} />
                </button>
            </div>
            <div role="radiogroup" aria-label="인원 선택" style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {tiers.map((t) => {
                    const on = t.people === people;
                    const pct = top > 0 ? Math.max(8, Math.round((t.pricePerPerson / top) * 100)) : 100;
                    return (
                        <button key={t.people} type="button" role="radio" aria-checked={on} onClick={() => onPick(t.people)}
                            style={{ display: 'grid', gridTemplateColumns: '34px 1fr auto', alignItems: 'center', gap: 12, height: 38, padding: '0 10px', border: 'none', borderRadius: 10, background: on ? SD.mint50 : 'transparent', fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                            <span style={{ fontSize: 13, fontWeight: on ? 700 : 500, color: SD.gray900 }}>{t.people}명</span>
                            <span aria-hidden="true" style={{ height: 6, borderRadius: 9999, background: SD.gray100, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 9999, background: on ? SD.mint400 : SD.gray300 }} /></span>
                            <span style={{ fontSize: 14, fontWeight: 700, color: on ? SD.mint700 : SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(t.pricePerPerson)}</span>
                        </button>
                    );
                })}
            </div>
            {depositPer > 0 && (
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 12, background: SD.gray50, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, lineHeight: '18px', color: SD.gray700 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span><strong style={{ color: SD.mint700 }}>예약금</strong> 1인 {won(depositPer)}</span><span style={{ color: SD.gray600 }}>{DEPOSIT_PAYMENT_METHOD} · 예약 후 안내</span></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span><strong style={{ color: SD.gray900 }}>잔금</strong> 나머지 금액</span><span style={{ color: SD.gray600 }}>현지 현금 · 가이드에게 전달</span></div>
                </div>
            )}
        </div>
    );
}

/** 인원 칸(관리자 인원 단계마다 한 칸): 인원 · 라디오 · 1인 요금. */
export function TierGrid({ tiers, people, onPick }: { tiers: TourPricingOption[]; people: number; onPick: (n: number) => void }) {
    return (
        <div role="radiogroup" aria-label="인원" style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(Math.max(tiers.length, 1), 5)}, minmax(0, 1fr))`, gap: 10 }}>
            {tiers.map((t) => {
                const on = t.people === people;
                return (
                    <button key={t.people} type="button" role="radio" aria-checked={on} onClick={() => onPick(t.people)}
                        style={{ height: 96, padding: '14px 14px 12px', boxSizing: 'border-box', borderRadius: 12, border: on ? `1.5px solid ${SD.gray900}` : `1px solid ${SD.gray200}`, background: SD.white,
                            boxShadow: on ? '0 2px 8px rgba(0,0,0,0.06)' : 'none', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'stretch', textAlign: 'left' }}>
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 17, fontWeight: 700, color: SD.gray900 }}>{t.people}명</span>
                            <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: 9999, boxSizing: 'border-box', border: on ? 'none' : `1.5px solid ${SD.gray300}`, background: on ? SD.gray900 : SD.white, color: SD.white, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {on && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>}
                            </span>
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 11, color: SD.gray600 }}>1인 요금</span>
                            <span style={{ fontSize: 15, fontWeight: 700, color: on ? SD.mint700 : SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(t.pricePerPerson)}</span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/** 숙박·차량 옵션(관리자 등록): 라디오 목록. */
export function OptionList({ options, selectedId, onSelect }: { options: BookingOptionItem[]; selectedId: string; onSelect: (id: string) => void }) {
    return (
        <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {options.map((o) => {
                const on = o.id === selectedId;
                return (
                    <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => onSelect(o.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', borderRadius: 12, border: on ? `1.5px solid ${SD.gray900}` : `1px solid ${SD.gray200}`, background: SD.white, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                        <span aria-hidden="true" style={{ flex: 'none', width: 20, height: 20, borderRadius: 9999, boxSizing: 'border-box', border: on ? `6px solid ${SD.gray900}` : `1.5px solid ${SD.gray300}`, background: SD.white }} />
                        {isUsableImage(o.imageUrl) && <img src={o.imageUrl} alt="" loading="lazy" decoding="async" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flex: 'none' }} />}
                        <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, color: SD.gray900 }}>
                                {o.name}
                                {o.isDefault && <span style={{ height: 20, padding: '0 7px', borderRadius: 6, background: SD.gray100, color: SD.gray700, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center' }}>기본</span>}
                            </span>
                            {o.description && <span style={{ fontSize: 13, lineHeight: 1.6, color: SD.gray600 }}>{o.description}</span>}
                        </span>
                        <span style={{ flex: 'none', fontSize: 14, fontWeight: 700, color: on ? SD.mint700 : SD.gray600, whiteSpace: 'nowrap' }}>{optionPriceLabel(o.priceModifier, o.isDefault)}</span>
                    </button>
                );
            })}
        </div>
    );
}

// ───────────────────────── 오른쪽 예약 요약 ─────────────────────────

export interface SummaryMoney {
    total: number;
    deposit: number;
    balance: number;
    /** ‘1,100,000원 × 3명’ 같은 줄(옵션 추가 금액이 있으면 그 줄도). */
    lines: { k: string; v: string }[];
}

function SummaryRow({ icon, label, value, sub, valueColor }: { icon: ReactNode; label: string; value: string; sub?: string; valueColor?: string }) {
    return (
        <div style={{ display: 'flex', gap: 12, padding: '16px 0', borderBottom: `1px solid ${SD.gray100}` }}>
            <span style={{ flex: 'none', width: 36, height: 36, borderRadius: 10, background: SD.gray50, color: SD.gray700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 12, color: SD.gray600 }}>{label}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: valueColor || SD.gray900 }}>{value}</span>
                {sub && <span style={{ fontSize: 12, color: SD.gray600 }}>{sub}</span>}
            </span>
        </div>
    );
}

export function CalIcon() {
    return <SIcon name="calendarCheck" size={18} stroke={1.7} />;
}
export function PeopleIcon() {
    return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.5a6.5 6.5 0 0 1 3 5.5" />
    </svg>
    );
}

/** 결제 금액 상자: 총 여행 금액 → ① 지금 결제(예약금) ② 현지 결제(잔금). 예약금이 0이면 두 줄을 뺀다. */
export function MoneyBox({ money, style }: { money: SummaryMoney; style?: CSSProperties }) {
    return (
        <div style={{ padding: 18, borderRadius: 14, background: SD.gray50, display: 'flex', flexDirection: 'column', gap: 12, ...style }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>총 여행 금액</span>
                <span style={{ fontSize: 20, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(money.total)}</span>
            </div>
            {/* 옵션 추가 금액이 없으면 ‘1인 요금 × 인원’ 한 줄만 오른쪽에 둔다(디자인). 옵션이 있으면 줄마다 금액을 붙인다. */}
            {money.lines.length === 1
                ? <span style={{ marginTop: -8, fontSize: 12, color: SD.gray600, textAlign: 'right' }}>{money.lines[0].k}</span>
                : money.lines.map((l) => (
                    <span key={l.k} style={{ marginTop: -8, display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: SD.gray600 }}><span>{l.k}</span><span>{l.v}</span></span>
                ))}
            {money.deposit > 0 && (
                <>
                    <div style={{ height: 1, background: SD.gray200 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>총 결제금액</span>
                            <span style={{ fontSize: 12, color: SD.gray600 }}><strong style={{ color: SD.mint700 }}>지금 결제</strong> · 예약금 · {DEPOSIT_PAYMENT_METHOD}</span>
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: SD.mint600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(money.deposit)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>총 결제 예정 금액</span>
                            <span style={{ fontSize: 12, color: SD.gray600 }}><strong style={{ color: SD.gray700 }}>현지 결제</strong> · 잔금 · 현금</span>
                        </span>
                        <span style={{ fontSize: 16, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(money.balance)}</span>
                    </div>
                </>
            )}
        </div>
    );
}

/** 오른쪽 붙는 예약 요약: 상품(사진·꼬리표·이름) · 여행 기간 · 인원 · 결제 금액 · 단추 · 안내. */
export function BookingSummaryAside({ product, typeLabel, durationText, range, people, perText, money, cta, note, stickyTop }: {
    product: BookingProduct;
    typeLabel?: string;
    durationText: string;
    range: string | null;
    people: number;
    perText?: string;
    money: SummaryMoney;
    cta: { label: string; onClick: () => void; disabled?: boolean };
    note: ReactNode;
    stickyTop: number;
}) {
    const img = product.mainImages?.[0];
    const chip2 = [product.category, durationText].filter(Boolean).join(' · ');
    return (
        <aside aria-label="예약 요약" style={{ flex: '0 0 380px', position: 'sticky', top: stickyTop }}>
            <div style={{ background: SD.white, border: `1px solid ${SD.gray200}`, borderRadius: 20, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: 14, padding: 20, borderBottom: `1px solid ${SD.gray100}` }}>
                    <span style={{ flex: 'none', width: 84, height: 84, borderRadius: 12, overflow: 'hidden', background: SD.gray100 }}>
                        {isUsableImage(img) && <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                        {(typeLabel || chip2) && (
                            <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                {typeLabel && <span style={{ height: 22, padding: '0 7px', borderRadius: 6, border: `1px solid ${SD.gray200}`, fontSize: 11, fontWeight: 700, color: SD.gray900, display: 'inline-flex', alignItems: 'center' }}>{typeLabel}</span>}
                                {chip2 && <span style={{ height: 22, padding: '0 7px', borderRadius: 6, background: SD.gray100, fontSize: 11, color: SD.gray700, display: 'inline-flex', alignItems: 'center' }}>{chip2}</span>}
                            </span>
                        )}
                        <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: SD.gray900, wordBreak: 'keep-all' }}>{bareName(product.name)}</span>
                    </span>
                </div>
                <div style={{ padding: '0 20px' }}>
                    <SummaryRow icon={<CalIcon />} label="여행 기간" value={range || '여행 시작일을 선택해 주세요'} valueColor={range ? SD.gray900 : SD.gray500} sub={range ? durationText : undefined} />
                    <SummaryRow icon={<PeopleIcon />} label="인원" value={`성인 ${people}명`} sub={perText ? `${people}명 투어 시 1인 ${perText}` : undefined} />
                </div>
                <MoneyBox money={money} style={{ margin: '16px 20px 0' }} />
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button type="button" onClick={cta.onClick} disabled={cta.disabled}
                        style={{ width: '100%', height: 52, border: 'none', borderRadius: 10, background: cta.disabled ? SD.gray200 : SD.mint700, color: cta.disabled ? SD.gray500 : SD.white, fontFamily: 'inherit', fontSize: 16, fontWeight: 700,
                            cursor: cta.disabled ? 'default' : 'pointer' }}>
                        {cta.label}
                    </button>
                    <div style={{ display: 'flex', gap: 6, fontSize: 12, lineHeight: '18px', color: SD.gray600 }}>
                        <span style={{ flex: 'none', height: 18, display: 'flex', alignItems: 'center' }}><SIcon name="info" size={14} stroke={1.8} /></span>
                        <span>{note}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

// ───────────────────────── 입금 계좌 ─────────────────────────

/** 예약금 입금 계좌(은행 · 예금주 · 계좌번호 복사). `number=false`면 계좌번호 대신 ‘신청을 마치면 안내’(2단계). */
export function AccountPanel({ showNumber = true, big = false }: { showNumber?: boolean; big?: boolean }) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const copy = async () => {
        if (!(await copyText(DEPOSIT_ACCOUNT.number))) return;
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div style={{ padding: big ? '20px 22px' : '18px 20px', borderRadius: 14, background: SD.gray50 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: SD.gray600 }}>
                <span style={{ color: SD.gray900, display: 'flex' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" /></svg>
                </span>
                <strong style={{ color: SD.gray900 }}>{DEPOSIT_ACCOUNT.bank}</strong>
                <span aria-hidden="true" style={{ width: 1, height: 11, background: SD.gray200 }} />
                예금주 {DEPOSIT_ACCOUNT.holder}
            </div>
            {showNumber ? (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: big ? 24 : 20, fontWeight: 700, letterSpacing: '0.02em', color: SD.gray900, fontVariantNumeric: 'tabular-nums' }}>{DEPOSIT_ACCOUNT.number}</span>
                    <button type="button" onClick={copy} aria-label="계좌번호 복사"
                        style={{ height: 36, padding: '0 14px', border: `1px solid ${copied ? SD.mint200 : SD.gray200}`, borderRadius: 9999, background: copied ? SD.mint50 : SD.white, color: copied ? SD.mint700 : SD.gray700,
                            fontFamily: 'inherit', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={copied ? 'M5 12l5 5 9-10' : 'M9 9h11v11H9zM5 15V4h11'} /></svg>
                        <span aria-live="polite">{copied ? '복사됨' : '복사'}</span>
                    </button>
                </div>
            ) : (
                <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: SD.gray700 }}>계좌번호는 예약 신청을 마치면 바로 안내해 드려요.</p>
            )}
        </div>
    );
}
