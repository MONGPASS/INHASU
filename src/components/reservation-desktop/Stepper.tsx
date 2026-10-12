import { Fragment } from 'react';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { BK_STEPS, type BookingStepNo } from '../reservation-shared/bookingShared';

/** Horizontal 3-step progress shown in the PC booking header. */
export function Stepper({ step }: { step: BookingStepNo }) {
    return (
        <ol aria-label="예약 진행 상황" style={{ display: 'flex', alignItems: 'center', gap: 14, margin: 0, padding: 0, listStyle: 'none' }}>
            {BK_STEPS.map((s, i) => {
                const n = i + 1;
                const past = n < step;
                const on = n === step;
                return (
                    <Fragment key={s.label}>
                        <li aria-current={on || undefined} style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <span style={{ width: 36, height: 36, borderRadius: '50%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 12, fontWeight: 600, background: on ? MW.navy : past ? MW.mint : '#FFFFFF', color: on ? '#FFFFFF' : MW.navy, border: `1.5px solid ${on ? MW.navy : past ? MW.mint : MW.line2}` }}>
                                {past ? '✓' : n}
                            </span>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', color: on || past ? MW.mintDeep : MW.mute2 }}>STEP {n}</span>
                                <span style={{ fontSize: 14, fontWeight: on ? 900 : 700, color: on ? MW.navy : past ? MW.ink3 : MW.mute2, whiteSpace: 'nowrap' }}>{s.label}</span>
                            </span>
                        </li>
                        {n < BK_STEPS.length && <li aria-hidden="true" style={{ flex: 1, minWidth: 24, height: 2, borderRadius: 2, background: past ? MW.mint : MW.line }} />}
                    </Fragment>
                );
            })}
        </ol>
    );
}
