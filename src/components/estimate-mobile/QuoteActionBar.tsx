import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { QuoteErrorBox } from '../estimate-desktop/quoteParts';
import { M_GRADIENT } from '../mobile/mobileTheme';

/**
 * Sticky bottom bar of the quote form: 입력 현황 progress and the submit button (replaces the tab bar).
 * 아직 못 채운 항목이 있으면 버튼에 그 항목을 적어 두고, 누르면 해당 스텝으로 이동한다(onSubmit이 처리).
 */
export function QuoteActionBar({ done, total, canSubmit, missingText, submitting, error, onSubmit }: {
    done: number;
    total: number;
    canSubmit: boolean;
    missingText: string;
    submitting: boolean;
    error: string;
    onSubmit: () => void;
}) {
    const ready = canSubmit && !submitting;
    return (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 30, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${MW.line}`, display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))' }}>
            {error && <QuoteErrorBox message={error} compact />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: MW.mute, whiteSpace: 'nowrap' }}>입력 현황</span>
                <span
                    role="progressbar"
                    aria-label="입력 현황"
                    aria-valuemin={0}
                    aria-valuemax={total}
                    aria-valuenow={done}
                    style={{ flex: 1, height: 5, borderRadius: 3, background: MW.line3, overflow: 'hidden' }}
                >
                    <span style={{ display: 'block', height: '100%', width: `${Math.round((done / total) * 100)}%`, background: 'linear-gradient(90deg,#27AB8F,#3FC2A4)', borderRadius: 3, transition: 'width .3s' }} />
                </span>
                <span style={{ fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600, color: MW.mintDeep, whiteSpace: 'nowrap' }}>{done} / {total}</span>
            </div>
            <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                aria-disabled={!ready}
                style={{ height: 50, border: 0, borderRadius: 999, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, background: ready ? M_GRADIENT : MW.line3, color: ready ? MW.navy : MW.mute, cursor: submitting ? 'progress' : 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 16px' }}
            >
                {submitting ? '접수 중…' : canSubmit ? '견적 요청하기' : missingText}
            </button>
        </div>
    );
}
