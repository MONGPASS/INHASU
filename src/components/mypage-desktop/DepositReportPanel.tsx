import { useId, type CSSProperties } from 'react';
import { formatDateTime, type ReservationDetail } from '../../utils/reservationDetail';
import { MW, MW_GRADIENT } from '../desktop-primitives/mwTokens';
import { DepositAccountBox } from '../reservation-shared/DepositAccountBox';
import { PAPER, TONE, mintHover } from './myPageTheme';
import { DEPOSITOR_NAME_MAX, useDepositReport } from './useDepositReport';

/**
 * 결제 현황 카드의 예약금 영역 — 입금이 확인되기 전까지 보인다 (PC·모바일 공용, `pc`는 치수만 바꾼다).
 *  · 입금 전: 입금 계좌 + "예약금 입금 완료했어요" → 입금자명 입력 → 신고
 *  · 신고 후: "입금 확인 중" + 입금자명·신고 시각 + 입금자명 정정
 * 입금 확인 뒤의 안내(잔금은 현지 결제)는 각 화면이 그린다.
 */
export function DepositReportPanel({ reservation, pc }: { reservation: ReservationDetail; pc: boolean }) {
    const d = useDepositReport(reservation);
    const inputId = useId();
    const hintId = `${inputId}-hint`;

    if (d.stage === 'paid') return null;
    if (d.cancelled) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, padding: '0 16px', borderRadius: 14, background: PAPER, fontSize: 13, fontWeight: 700, color: MW.mute, textAlign: 'center' }}>
                취소된 예약입니다
            </div>
        );
    }

    const reported = d.stage === 'reported' && !!d.report;
    const action: CSSProperties = {
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: pc ? 52 : 48, padding: '0 18px', border: 0, borderRadius: 14,
        background: pc ? MW.mint : MW_GRADIENT, fontFamily: 'inherit', fontSize: pc ? 15 : 14, fontWeight: 700, color: MW.navy, whiteSpace: 'nowrap',
        cursor: d.sending ? 'default' : 'pointer', opacity: d.sending ? 0.6 : 1,
    };

    const form = (
        <form
            onSubmit={(e) => { e.preventDefault(); void d.submit(); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: pc ? 18 : 14, borderRadius: 16, background: PAPER }}
        >
            <style>{'.mw-depositor:focus{border-color:#27AB8F !important}'}</style>
            <label htmlFor={inputId} style={{ fontSize: 13, fontWeight: 700 }}>입금자명</label>
            {/* 16px text on mobile keeps iOS from zooming the page when the field gets focus. */}
            <input
                id={inputId}
                className="mw-depositor"
                type="text"
                value={d.name}
                onChange={(e) => d.changeName(e.target.value)}
                maxLength={DEPOSITOR_NAME_MAX}
                placeholder="홍길동"
                autoComplete="name"
                autoFocus
                aria-required
                aria-invalid={!!d.error}
                aria-describedby={hintId}
                style={{ boxSizing: 'border-box', width: '100%', height: pc ? 48 : 50, border: `1.5px solid ${d.error ? MW.red : MW.line2}`, borderRadius: 12, padding: '0 14px', fontFamily: 'inherit', fontSize: pc ? 15 : 16, color: MW.navy, background: '#FFFFFF', outline: 'none', boxShadow: 'none' }}
            />
            <span id={hintId} style={{ fontSize: 12, lineHeight: 1.6, color: MW.mute }}>실제로 이체하신 분의 성함(통장에 표시되는 이름)을 적어 주세요.</span>
            {d.error && <span role="alert" style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.6, color: MW.redDeep }}>{d.error}</span>}
            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    type="button"
                    onClick={d.closeForm}
                    disabled={d.sending}
                    style={{ ...action, flex: '0 0 auto', background: '#FFFFFF', border: `1px solid ${MW.line2}`, color: MW.mute }}
                >
                    취소
                </button>
                <button type="submit" disabled={d.sending} style={{ ...action, flex: 1, minWidth: 0 }}>
                    {d.sending ? '보내는 중…' : reported ? '입금자명 정정하기' : '입금 완료 알리기'}
                </button>
            </div>
        </form>
    );

    if (reported && d.report) {
        const reportedAt = formatDateTime(d.report.reportedAt);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: pc ? 18 : 14, borderRadius: 16, background: '#FFF8EB', border: `1px solid ${TONE.warn.bd}` }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: TONE.warn.fg, background: TONE.warn.bg, padding: '4px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: TONE.warn.fg }} />
                            입금 확인 중
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                            입금자명 {d.report.name}{reportedAt ? ` · ${reportedAt} 신고` : ''}
                        </span>
                    </span>
                    <span style={{ fontSize: pc ? 13 : 12, lineHeight: 1.7, color: MW.ink3 }}>담당자가 확인하면 예약이 확정되고 알림을 보내 드립니다.</span>
                    {!d.formOpen && (
                        <button
                            type="button"
                            onClick={d.openForm}
                            style={{ alignSelf: 'flex-start', padding: 0, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: MW.mute, textDecoration: 'underline', textUnderlineOffset: 3, cursor: 'pointer' }}
                        >
                            입금자명 정정
                        </button>
                    )}
                </div>
                {d.formOpen && form}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <DepositAccountBox pc={pc} amount={d.amount} />
            {d.formOpen ? form : (
                <>
                    <button type="button" onClick={d.openForm} style={action} {...(pc ? mintHover : {})}>예약금 입금 완료했어요</button>
                    <span style={{ fontSize: 12, lineHeight: 1.7, color: MW.mute, textAlign: 'center' }}>
                        위 계좌로 예약금을 입금하신 뒤 눌러 주세요. 담당자가 확인하면 예약이 확정됩니다.
                    </span>
                </>
            )}
        </div>
    );
}
