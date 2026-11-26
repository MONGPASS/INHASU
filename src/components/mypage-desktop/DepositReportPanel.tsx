import { useId, useState } from 'react';
import { DEPOSIT_ACCOUNT } from '../../constants/company';
import { formatDateTime, type ReservationDetail } from '../../utils/reservationDetail';
import { won } from '../desktop-primitives/mwTokens';
import { SD, SIcon } from '../site-seed/seed';
import { boxButton, tagStyle } from './myBookingView';
import { DEPOSITOR_NAME_MAX, useDepositReport } from './useDepositReport';

/**
 * 결제 현황 카드의 예약금 영역 — 입금이 확인되기 전까지 보인다 (PC·휴대폰 공용, `pc`는 크기만 바꾼다).
 * 디자인 ‘마이페이지 — 예약 상세’: 회색 계좌 칸(은행·예금주 · 계좌번호 + 복사) + 입금할 예약금 → ‘예약금 입금 완료했어요’.
 *  · 누르면 입금자명을 적고 신고 → 신고 후에는 ‘입금 확인 중’ + 입금자명·신고 시각 + 입금자명 정정.
 * 입금 확인 뒤의 안내는 각 화면이 그린다.
 */
export function DepositReportPanel({ reservation, pc }: { reservation: ReservationDetail; pc: boolean }) {
    const d = useDepositReport(reservation);
    const inputId = useId();
    const hintId = `${inputId}-hint`;

    if (d.stage === 'paid') return null;
    if (d.cancelled) {
        return (
            <div style={{ marginTop: 16, minHeight: 48, padding: '0 16px', borderRadius: 12, background: SD.gray50, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: SD.gray600 }}>
                취소된 예약이에요
            </div>
        );
    }

    const reported = d.stage === 'reported' && !!d.report;

    const form = (
        <form onSubmit={(e) => { e.preventDefault(); void d.submit(); }}
            style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10, padding: pc ? 18 : 14, borderRadius: 14, border: `1px solid ${SD.gray200}`, background: SD.white }}>
            <style>{'.my-depositor:focus{border-color:#212124 !important}'}</style>
            <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 700, color: SD.gray900 }}>입금자명</label>
            {/* 16px text on mobile keeps iOS from zooming the page when the field gets focus. */}
            <input id={inputId} className="my-depositor" type="text" value={d.name} onChange={(e) => d.changeName(e.target.value)} maxLength={DEPOSITOR_NAME_MAX}
                placeholder="홍길동" autoComplete="name" autoFocus aria-required aria-invalid={!!d.error} aria-describedby={hintId}
                style={{ boxSizing: 'border-box', width: '100%', height: 48, border: `1px solid ${d.error ? SD.red : SD.gray300}`, borderRadius: 10, padding: '0 14px', fontFamily: 'inherit', fontSize: pc ? 15 : 16,
                    color: SD.gray900, background: SD.white, outline: 'none' }} />
            <span id={hintId} style={{ fontSize: 12, lineHeight: 1.6, color: SD.gray600 }}>실제로 이체하신 분의 성함(통장에 표시되는 이름)을 적어 주세요.</span>
            {d.error && <span role="alert" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.6, color: SD.red }}>{d.error}</span>}
            <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={d.closeForm} disabled={d.sending} style={{ ...boxButton('tertiary', 'medium'), flex: '0 0 auto' }}>취소</button>
                <button type="submit" disabled={d.sending} style={{ ...boxButton('primary', 'medium'), flex: '1 1 auto', minWidth: 0, opacity: d.sending ? 0.6 : 1, cursor: d.sending ? 'default' : 'pointer' }}>
                    {d.sending ? '보내는 중…' : reported ? '입금자명 정정하기' : '입금 완료 알리기'}
                </button>
            </div>
        </form>
    );

    if (reported && d.report) {
        const reportedAt = formatDateTime(d.report.reportedAt);
        return (
            <div style={{ marginTop: 18 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: pc ? '16px 18px' : 14, borderRadius: 14, background: SD.gray50 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ ...tagStyle, color: SD.gray900 }}>입금 확인 중</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: SD.gray900, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                            입금자명 {d.report.name}{reportedAt ? ` · ${reportedAt} 알림` : ''}
                        </span>
                    </span>
                    <span style={{ fontSize: pc ? 13 : 12, lineHeight: 1.7, color: SD.gray700 }}>담당자가 입금을 확인하면 예약이 확정되고 알림을 보내 드려요.</span>
                    {!d.formOpen && (
                        <button type="button" onClick={d.openForm}
                            style={{ alignSelf: 'flex-start', padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: SD.gray600, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}>
                            입금자명 정정
                        </button>
                    )}
                </div>
                {d.formOpen && form}
            </div>
        );
    }

    return (
        <div style={{ marginTop: 18 }}>
            <AccountBox pc={pc} amount={d.amount} />
            {d.formOpen ? form : (
                <>
                    <button type="button" onClick={d.openForm} style={{ ...boxButton('primary', pc ? 'large' : 'medium', true), marginTop: 14 }}>예약금 입금 완료했어요</button>
                    <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 12, lineHeight: 1.6, color: SD.gray600 }}>위 계좌로 입금하신 뒤 눌러 주세요. 담당자가 확인하면 예약이 확정돼요.</p>
                </>
            )}
        </div>
    );
}

/** 입금 계좌 칸: 은행 · 예금주 → 계좌번호 + 복사 → 입금할 예약금. */
function AccountBox({ pc, amount }: { pc: boolean; amount: number }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try {
            await navigator.clipboard?.writeText(DEPOSIT_ACCOUNT.number);
        } catch {
            // 복사가 막혀 있어도 번호는 화면에 그대로 보인다.
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div style={{ border: `1px solid ${SD.gray200}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: pc ? '18px 20px' : '16px', background: SD.gray50 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: pc ? 13 : 12, color: SD.gray600 }}>
                    <span style={{ color: SD.gray900, display: 'flex' }}><SIcon name="bankHouse" size={18} stroke={1.7} /></span>
                    <strong style={{ color: SD.gray900 }}>{DEPOSIT_ACCOUNT.bank}</strong>
                    <span aria-hidden="true" style={{ width: 1, height: 11, background: SD.gray200 }} />
                    예금주 {DEPOSIT_ACCOUNT.holder}
                </div>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: pc ? 22 : 19, fontWeight: 700, letterSpacing: '0.02em', color: SD.gray900, fontVariantNumeric: 'tabular-nums' }}>{DEPOSIT_ACCOUNT.number}</span>
                    <button type="button" onClick={copy} aria-label="계좌번호 복사"
                        style={{ flex: 'none', height: 34, padding: '0 12px', border: `1px solid ${copied ? SD.gray400 : SD.gray200}`, borderRadius: 9999, background: copied ? SD.gray50 : SD.white,
                            color: copied ? SD.gray900 : SD.gray700, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                        <SIcon name={copied ? 'checkMark' : 'copyBox'} size={14} stroke={1.8} />{copied ? '복사됨' : '복사'}
                    </button>
                </div>
            </div>
            {amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: pc ? '14px 20px' : '12px 16px' }}>
                    <span style={{ fontSize: 14, color: SD.gray700 }}>입금할 예약금</span>
                    <span style={{ fontSize: pc ? 20 : 18, fontWeight: 700, color: SD.mint600, fontVariantNumeric: 'tabular-nums' }}>{won(amount)}</span>
                </div>
            )}
        </div>
    );
}
