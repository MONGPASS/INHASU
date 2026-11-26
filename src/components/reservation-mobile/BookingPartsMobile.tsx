import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { DEPOSIT_ACCOUNT, DEPOSIT_PAYMENT_METHOD } from '../../constants/company';
import type { TourPricingOption } from '../../types/product';
import { copyText } from '../../utils/copyText';
import { isUsableImage, won } from '../desktop-primitives/mwTokens';
import { SD, SIcon } from '../site-seed/seed';
import { BK_WEEK, addDays, sameDay, startOfToday, tierPrice, type BookingStepNo } from '../reservation-shared/bookingShared';

/**
 * 휴대폰 예약 1~3단계 부품(Claude Design ‘예약하기 1·2·3단계 — 모바일’, 2026-11-26).
 * 구역은 8px 회색 띠로 나누고, 아래에 붙는 결제 줄이 하단 메뉴 자리를 대신한다. PC는 reservation-desktop이 따로 그린다.
 */

const STEPS = ['날짜·인원', '정보·결제', '완료'];

/** 3단계 막대: 지난 단계 ✓, 지금 단계 민트 굵게. */
export function StepBars({ step, divider = true }: { step: BookingStepNo; divider?: boolean }) {
    return (
        <ol aria-label="예약 단계" style={{ margin: 0, padding: '14px 20px', listStyle: 'none', display: 'flex', gap: 8, borderBottom: divider ? `8px solid ${SD.gray50}` : 'none' }}>
            {STEPS.map((label, i) => {
                const n = i + 1;
                const on = n === step;
                const done = n < step;
                return (
                    <li key={label} aria-current={on || undefined} style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <span aria-hidden="true" style={{ height: 3, borderRadius: 9999, background: on || done ? SD.mint500 : SD.gray200 }} />
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: on ? 700 : 500, color: on ? SD.mint700 : done ? SD.gray700 : SD.gray500 }}>
                            {n}. {label}
                            {done && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="완료"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

/** 구역: 번호 동그라미 + 제목 + 설명, 아래 8px 회색 띠(마지막 구역은 없음). */
export function MSection({ no, title, sub, right, last = false, children, dataField }: { no?: number; title?: string; sub?: ReactNode; right?: ReactNode; last?: boolean; children: ReactNode; dataField?: string }) {
    return (
        <section data-payment-field={dataField} style={{ padding: '20px 20px 24px', borderBottom: last ? 'none' : `8px solid ${SD.gray50}` }}>
            {title && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 700, color: SD.gray900 }}>
                            {no !== undefined && <span style={{ flex: 'none', width: 22, height: 22, borderRadius: 9999, background: SD.gray900, color: SD.white, fontSize: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{no}</span>}
                            {title}
                        </h2>
                        {sub && <span style={{ paddingLeft: no !== undefined ? 30 : 0, fontSize: 12, lineHeight: 1.5, color: SD.gray600 }}>{sub}</span>}
                    </div>
                    {right}
                </div>
            )}
            {children}
        </section>
    );
}

// ───────────────────────── 1단계 ─────────────────────────

/** 출발일 달력(휴대폰). 지난 날은 고를 수 없다. 출발·도착은 검은 칸, 기간은 민트 띠. */
export function TripCalendarMobile({ value, onChange, nights }: { value: Date | null; onChange: (d: Date) => void; nights: number }) {
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
    const nav = (disabled: boolean): CSSProperties => ({ width: 36, height: 36, borderRadius: 9999, border: `1px solid ${SD.gray200}`, background: SD.white, color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1 });
    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <button type="button" aria-label="이전 달" disabled={noPrev} onClick={() => { if (!noPrev) move(-1); }} style={nav(noPrev)}><SIcon name="chevronLeft" size={16} stroke={2} /></button>
                <span aria-live="polite" style={{ fontSize: 16, fontWeight: 700, color: SD.gray900 }}>{y}년 {m + 1}월</span>
                <button type="button" aria-label="다음 달" onClick={() => move(1)} style={nav(false)}><SIcon name="chevronRight" size={16} stroke={2} /></button>
            </div>
            <div role="grid" aria-label={`${y}년 ${m + 1}월 달력`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                {BK_WEEK.map((w) => <span key={w} style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: SD.gray500 }}>{w}</span>)}
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
                    const r = (on: boolean) => (on ? '10px' : '0');
                    return (
                        <div key={dd} style={{ height: 48, padding: '3px 0', boxSizing: 'border-box' }}>
                            <div style={{ height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', background: banded ? SD.mint50 : 'transparent', borderRadius: `${r(L)} ${r(R)} ${r(R)} ${r(L)}` }}>
                                <button type="button" onClick={() => onChange(date)} disabled={off} aria-pressed={isS} aria-label={`${m + 1}월 ${dd}일${off ? ' 예약 불가' : ''}`}
                                    style={{ width: 42, height: 42, borderRadius: 10, border: 'none', background: edge ? SD.gray900 : 'transparent', color: edge ? SD.white : off ? SD.gray400 : SD.gray900, fontFamily: 'inherit',
                                        fontSize: 14, fontWeight: edge || !off ? 700 : 400, cursor: off ? 'default' : 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    {dd}
                                    <span style={{ fontSize: 8, lineHeight: '9px', fontWeight: 700, color: edge ? SD.mint200 : 'transparent' }}>{isS ? '출발' : isE ? '도착' : ''}</span>
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/** 인원 −/+ (관리자 인원 단계만 오간다). */
export function PeopleStepper({ people, canDec, canInc, onDec, onInc }: { people: number; canDec: boolean; canInc: boolean; onDec: () => void; onInc: () => void }) {
    const btn = (on: boolean, primary: boolean): CSSProperties => ({ width: 36, height: 36, borderRadius: 9999, border: 'none', background: primary ? (on ? SD.gray900 : SD.gray300) : SD.white, color: primary ? SD.white : on ? SD.gray900 : SD.gray400,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: on ? 'pointer' : 'default', boxShadow: primary ? 'none' : '0 1px 2px rgba(0,0,0,0.06)' });
    return (
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', height: 44, padding: '0 4px', borderRadius: 9999, background: SD.gray50 }}>
            <button type="button" aria-label="인원 줄이기" disabled={!canDec} onClick={onDec} style={btn(canDec, false)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
            </button>
            <span aria-live="polite" style={{ minWidth: 48, textAlign: 'center', fontSize: 17, fontWeight: 700, color: SD.gray900 }}>{people}명</span>
            <button type="button" aria-label="인원 늘리기" disabled={!canInc} onClick={onInc} style={btn(canInc, true)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
        </div>
    );
}

/** 인원 칸(인원 · 1인 요금 짧게), 가장 싼 칸에 ‘최저가’. */
export function TierChips({ tiers, people, onPick }: { tiers: TourPricingOption[]; people: number; onPick: (n: number) => void }) {
    const lowest = Math.min(...tiers.map((t) => t.pricePerPerson));
    const highest = Math.max(...tiers.map((t) => t.pricePerPerson));
    const compact = tiers.every((t) => t.pricePerPerson % 10000 === 0);
    return (
        <div role="radiogroup" aria-label="인원별 1인 요금" style={{ marginTop: 16, display: 'grid', gridTemplateColumns: `repeat(${Math.min(tiers.length, 5)}, minmax(0, 1fr))`, gap: 6 }}>
            {tiers.map((t) => {
                const on = t.people === people;
                return (
                    <button key={t.people} type="button" role="radio" aria-checked={on} onClick={() => onPick(t.people)}
                        style={{ position: 'relative', height: 72, padding: 0, borderRadius: 12, border: on ? `1.5px solid ${SD.gray900}` : `1px solid ${SD.gray200}`, background: on ? SD.white : SD.white, fontFamily: 'inherit', cursor: 'pointer',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 0 }}>
                        {t.pricePerPerson === lowest && lowest < highest && (
                            <span style={{ position: 'absolute', top: -9, left: '50%', transform: 'translateX(-50%)', height: 18, padding: '0 6px', borderRadius: 9999, background: SD.gray900, color: SD.white, fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap' }}>최저가</span>
                        )}
                        <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>{t.people}명</span>
                        <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? SD.mint700 : SD.gray600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{tierPrice(t.pricePerPerson, compact)}</span>
                    </button>
                );
            })}
        </div>
    );
}

/** ‘n명 기준 1인 ○원 · 요금표’ 접이 칸: 펼치면 인원별 1인 요금 막대. */
export function RateTable({ tiers, people, unit }: { tiers: TourPricingOption[]; people: number; unit: number }) {
    const [open, setOpen] = useState(false);
    const top = tiers[0]?.pricePerPerson || 0;
    return (
        <div style={{ marginTop: 12, borderRadius: 12, background: SD.gray50, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '12px 14px' }}>
                <span style={{ fontSize: 13, color: SD.gray700 }}>{people}명 기준 1인 <strong style={{ color: SD.mint700, fontVariantNumeric: 'tabular-nums' }}>{won(unit)}</strong></span>
                {tiers.length > 1 && (
                    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
                        style={{ flex: 'none', height: 32, padding: '0 10px', border: `1px solid ${SD.gray200}`, borderRadius: 9999, background: SD.white, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: SD.gray900, display: 'inline-flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}>
                        요금표<SIcon name={open ? 'chevronUp' : 'chevronDown'} size={14} stroke={2} />
                    </button>
                )}
            </div>
            {open && (
                <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tiers.map((t) => {
                        const on = t.people === people;
                        const pct = top > 0 ? Math.max(8, Math.round((t.pricePerPerson / top) * 100)) : 100;
                        return (
                            <div key={t.people} style={{ display: 'grid', gridTemplateColumns: '30px 1fr auto', alignItems: 'center', gap: 10 }}>
                                <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: SD.gray900 }}>{t.people}명</span>
                                <span aria-hidden="true" style={{ height: 6, borderRadius: 9999, background: SD.white, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${pct}%`, borderRadius: 9999, background: on ? SD.mint400 : SD.gray300 }} /></span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: on ? SD.mint700 : SD.gray900, fontVariantNumeric: 'tabular-nums' }}>{won(t.pricePerPerson)}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

/** 결제 금액 상자(1단계): 총 여행 금액 → 총 결제금액(지금·예약금) → 총 결제 예정 금액(현지·잔금). */
export function MoneyBoxMobile({ total, deposit, balance, lineLabel }: { total: number; deposit: number; balance: number; lineLabel?: string }) {
    return (
        <div style={{ padding: 16, borderRadius: 14, background: SD.gray50, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>총 여행 금액</span>
                    {lineLabel && <span style={{ fontSize: 12, color: SD.gray600 }}>{lineLabel}</span>}
                </span>
                <span style={{ fontSize: 17, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(total)}</span>
            </div>
            {deposit > 0 && (
                <>
                    <div style={{ height: 1, background: SD.gray200 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>총 결제금액</span>
                            <span style={{ fontSize: 12, color: SD.gray600 }}><strong style={{ color: SD.mint700 }}>지금 결제</strong> · 예약금 · {DEPOSIT_PAYMENT_METHOD}</span>
                        </span>
                        <span style={{ fontSize: 18, fontWeight: 700, color: SD.mint600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(deposit)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: SD.gray900 }}>총 결제 예정 금액</span>
                            <span style={{ fontSize: 12, color: SD.gray600 }}><strong style={{ color: SD.gray700 }}>현지 결제</strong> · 잔금 · 현금</span>
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{won(balance)}</span>
                    </div>
                </>
            )}
        </div>
    );
}

/** 작은 안내 줄(ⓘ + 글). */
export function InfoNote({ children, style }: { children: ReactNode; style?: CSSProperties }) {
    return (
        <p style={{ margin: '12px 0 0', display: 'flex', gap: 6, fontSize: 12, lineHeight: '18px', color: SD.gray600, ...style }}>
            <span style={{ flex: 'none', height: 18, display: 'flex', alignItems: 'center' }}><SIcon name="info" size={13} stroke={1.8} /></span>
            <span>{children}</span>
        </p>
    );
}

// ───────────────────────── 아래 결제 줄 ─────────────────────────

/** 아래에 붙는 결제 줄(하단 메뉴 자리): 왼쪽 ‘지금 결제 · …’ 금액, 오른쪽 단추. */
export function PayBar({ caption, amount, label, disabled, onAction, width = 150, hint }: { caption: ReactNode; amount?: string; label: string; disabled?: boolean; onAction: () => void; width?: number; hint?: ReactNode }) {
    return (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 30, background: SD.white, borderTop: `1px solid ${SD.gray200}`, padding: '10px 16px calc(14px + env(safe-area-inset-bottom))' }}>
            {hint && <div style={{ marginBottom: 8 }}>{hint}</div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {amount !== undefined && (
                    <span style={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 11, color: SD.gray600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{caption}</span>
                        <span aria-live="polite" style={{ fontSize: 18, fontWeight: 700, color: SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{amount}</span>
                    </span>
                )}
                <button type="button" onClick={onAction} disabled={disabled}
                    style={{ flex: amount !== undefined ? `0 0 ${width}px` : '1 1 auto', height: 52, border: 'none', borderRadius: 10, background: disabled ? SD.gray200 : SD.mint700, color: disabled ? SD.gray500 : SD.white,
                        fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                    {label}
                </button>
            </div>
        </div>
    );
}

// ───────────────────────── 입금 계좌 ─────────────────────────

/** 입금 계좌 상자(은행·예금주·계좌번호 복사 + 아래 입금할 예약금). `showNumber=false`면 계좌번호 대신 ‘신청을 마치면 안내’(2단계). */
export function AccountCardMobile({ deposit, showNumber = true }: { deposit: number; showNumber?: boolean }) {
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
        <div style={{ border: `1px solid ${SD.gray200}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: 16, background: SD.gray50 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: SD.gray600 }}>
                    <span style={{ color: SD.gray900, display: 'flex' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9.5L12 4l9 5.5" /><path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" /></svg>
                    </span>
                    <strong style={{ color: SD.gray900 }}>{DEPOSIT_ACCOUNT.bank}</strong>
                    <span aria-hidden="true" style={{ width: 1, height: 10, background: SD.gray200 }} />
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>예금주 {DEPOSIT_ACCOUNT.holder}</span>
                </div>
                {showNumber ? (
                    <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: '0.02em', color: SD.gray900, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{DEPOSIT_ACCOUNT.number}</span>
                        <button type="button" onClick={copy} aria-label="계좌번호 복사"
                            style={{ flex: 'none', height: 32, padding: '0 12px', border: `1px solid ${copied ? SD.mint200 : SD.gray200}`, borderRadius: 9999, background: copied ? SD.mint50 : SD.white, color: copied ? SD.mint700 : SD.gray700,
                                fontFamily: 'inherit', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={copied ? 'M5 12l5 5 9-10' : 'M9 9h11v11H9zM5 15V4h11'} /></svg>
                            <span aria-live="polite">{copied ? '복사됨' : '복사'}</span>
                        </button>
                    </div>
                ) : (
                    <p style={{ margin: '8px 0 0', fontSize: 14, fontWeight: 700, color: SD.gray700 }}>계좌번호는 신청을 마치면 바로 안내해 드려요.</p>
                )}
            </div>
            {deposit > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
                    <span style={{ fontSize: 13, color: SD.gray700 }}>입금할 예약금</span>
                    <span style={{ fontSize: 19, fontWeight: 700, color: SD.mint600, fontVariantNumeric: 'tabular-nums' }}>{won(deposit)}</span>
                </div>
            )}
        </div>
    );
}

/** 뒤로 가기 줄 오른쪽 ✕(예약을 그만두고 나가기). */
export function CloseButton({ onClick }: { onClick: () => void }) {
    return (
        <button type="button" aria-label="닫기" onClick={onClick}
            style={{ width: 44, height: 44, border: 'none', background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <SIcon name="close" size={22} stroke={1.8} />
        </button>
    );
}

/** 예약 상품 한 줄(사진 · 구분·분류·기간 · 이름). */
export function ProductLine({ image, meta, name }: { image?: string; meta: string; name: string }) {
    return (
        <div style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: `8px solid ${SD.gray50}` }}>
            <span style={{ flex: 'none', width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: SD.gray100 }}>
                {isUsableImage(image) && <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
            </span>
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {meta && <span style={{ fontSize: 12, color: SD.gray600 }}>{meta}</span>}
                <span style={{ fontSize: 15, fontWeight: 700, color: SD.gray900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
            </span>
        </div>
    );
}
