import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { BK_HEAD, BK_STEPS, type BookingStepNo } from '../reservation-shared/bookingShared';

const BAR_ON = 'linear-gradient(90deg,#27AB8F,#3FC2A4)';

/** "STEP n / 3", the step title and the 3-cell progress bar (Claude Design: mobile "Booking Header"). */
export function BookingHeaderMobile({ step }: { step: BookingStepNo }) {
    const { title, sub } = BK_HEAD[step];
    return (
        <div style={{ background: '#FFFFFF', borderBottom: `1px solid ${MW.line}` }}>
            <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintDeep }}>STEP {step} / 3</span>
                    <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, lineHeight: 1.4 }}>{title}</h1>
                    <span style={{ fontSize: 12, lineHeight: 1.6, color: MW.mute }}>{sub}</span>
                </div>
                <ol aria-label="예약 진행 상황" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6, margin: 0, padding: 0, listStyle: 'none' }}>
                    {BK_STEPS.map((s, i) => {
                        const n = i + 1;
                        const past = n < step;
                        const on = n === step;
                        return (
                            <li key={s.short} aria-current={on || undefined} style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                                <span style={{ display: 'block', height: 4, borderRadius: 999, background: past || on ? BAR_ON : MW.line }} />
                                <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                                    <span style={{ width: 16, height: 16, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 8, fontWeight: 600, background: on ? MW.navy : past ? MW.mint : '#FFFFFF', color: on ? '#FFFFFF' : MW.navy, border: `1px solid ${on ? MW.navy : past ? MW.mint : MW.line2}`, boxSizing: 'border-box' }}>
                                        {past ? '✓' : n}
                                    </span>
                                    <span style={{ fontSize: 10, fontWeight: on ? 900 : 700, color: on ? MW.navy : past ? MW.ink3 : MW.mute2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.short}</span>
                                </span>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </div>
    );
}
