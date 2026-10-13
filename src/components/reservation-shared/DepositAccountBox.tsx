import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { DEPOSIT_ACCOUNT } from '../../constants/company';
import { copyText } from '../../utils/copyText';
import { MW, MW_FONT_EN, won } from '../desktop-primitives/mwTokens';
import { Ico } from '../mobile/mobileUi';
import { BK_D } from './bookingShared';

const rowBase: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 0' };
const keyStyle: CSSProperties = { fontSize: 12, color: MW.mute, flexShrink: 0 };

/**
 * 예약금 입금 계좌 박스 — 은행, 계좌번호(복사), 예금주, 입금액.
 * 신청 완료 화면과 마이페이지 예약 상세(PC·모바일)가 함께 쓴다. 계좌는 constants/company.ts 의 DEPOSIT_ACCOUNT.
 */
export function DepositAccountBox({ pc, amount, style }: { pc: boolean; amount?: number; style?: CSSProperties }) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<number | undefined>(undefined);
    useEffect(() => () => window.clearTimeout(timer.current), []);

    const copyNumber = async () => {
        // 복사가 막힌 환경이면 조용히 넘어간다 — 계좌번호는 화면에 그대로 보인다.
        if (!(await copyText(DEPOSIT_ACCOUNT.number))) return;
        setCopied(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1800);
    };

    const line = `1px solid ${MW.mintTint}`;
    const value: CSSProperties = { fontSize: pc ? 14 : 13, fontWeight: 700, textAlign: 'right', lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' };

    return (
        <div style={{ boxSizing: 'border-box', width: '100%', display: 'flex', flexDirection: 'column', padding: pc ? '5px 20px' : '3px 16px', borderRadius: 18, background: MW.mintBg, border: line, textAlign: 'left', ...style }}>
            <div style={{ ...rowBase, borderBottom: line }}>
                <span style={keyStyle}>은행</span>
                <span style={value}>{DEPOSIT_ACCOUNT.bank}</span>
            </div>
            <div style={{ ...rowBase, borderBottom: line }}>
                <span style={keyStyle}>계좌번호</span>
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
                    <span style={{ ...value, fontSize: pc ? 16 : 15, fontWeight: 900, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>{DEPOSIT_ACCOUNT.number}</span>
                    <button
                        type="button"
                        onClick={copyNumber}
                        aria-label="계좌번호 복사"
                        style={{ display: 'flex', alignItems: 'center', gap: 4, height: 30, padding: '0 11px', border: `1px solid ${copied ? MW.mint : MW.line2}`, borderRadius: 999, background: '#FFFFFF', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: copied ? MW.mintDeep : MW.ink3, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                        <Ico d={copied ? BK_D.tick : BK_D.copy} size={13} width={2} color={copied ? MW.mintDeep : MW.ink3} />
                        <span aria-live="polite">{copied ? '복사됨' : '복사'}</span>
                    </button>
                </span>
            </div>
            <div style={{ ...rowBase, borderBottom: amount ? line : undefined }}>
                <span style={keyStyle}>예금주</span>
                <span style={value}>{DEPOSIT_ACCOUNT.holder}</span>
            </div>
            {!!amount && (
                <div style={{ ...rowBase, alignItems: 'baseline' }}>
                    <span style={keyStyle}>입금액 (예약금)</span>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: pc ? 20 : 18, fontWeight: 600, color: MW.mintDeep, whiteSpace: 'nowrap' }}>{won(amount)}</span>
                </div>
            )}
        </div>
    );
}
