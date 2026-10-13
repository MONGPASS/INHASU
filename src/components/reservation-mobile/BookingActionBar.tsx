import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { M_GRADIENT } from '../mobile/mobileTheme';

interface BookingActionBarProps {
    /** Caption above the amount ("합계(2명)" / "예약금(계좌이체)"). */
    caption: string;
    amount: string;
    label: string;
    disabled: boolean;
    onAction: () => void;
    hint: string;
    /** Hint is a problem to fix (shown in red) rather than a reassurance. */
    hintError: boolean;
}

/** Sticky bottom bar of the booking steps (Claude Design: "M Booking Action Bar"); replaces the tab bar. */
export function BookingActionBar({ caption, amount, label, disabled, onAction, hint, hintError }: BookingActionBarProps) {
    return (
        <div style={{ position: 'sticky', bottom: 0, zIndex: 30, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${MW.line}`, padding: '10px 16px calc(10px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 11, color: MW.mute, whiteSpace: 'nowrap' }}>{caption}</span>
                    <span aria-live="polite" style={{ fontFamily: MW_FONT_EN, fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap' }}>{amount}</span>
                </span>
                <button
                    type="button"
                    onClick={onAction}
                    disabled={disabled}
                    style={{ flexShrink: 0, height: 50, padding: '0 22px', border: 0, borderRadius: 999, background: disabled ? MW.line : M_GRADIENT, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: disabled ? MW.mute2 : MW.navy, cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                >
                    {label}
                </button>
            </div>
            <span role={hintError ? 'alert' : undefined} style={{ fontSize: 11, color: hintError ? MW.red : MW.mute, lineHeight: 1.5, whiteSpace: hintError ? 'normal' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{hint}</span>
        </div>
    );
}
