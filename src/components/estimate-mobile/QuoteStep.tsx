import type { ReactNode } from 'react';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { pad, quoteStepId } from '../estimate-desktop/quoteForm';
import { useMobileShell } from '../mobile/mobileShellContext';
import type { StepState } from './quoteMobile';

const DASHED = `repeating-linear-gradient(180deg,${MW.line2} 0 4px,transparent 4px 9px)`;

/** Number badge per state: done = mint ✓, current = navy with a mint glow, to do = outlined. */
const BADGE: Record<StepState, { bg: string; fg: string; bd: string; sh: string }> = {
    done: { bg: MW.mint, fg: MW.navy, bd: MW.mint, sh: `0 0 0 4px ${MW.mintBg}` },
    current: { bg: MW.navy, fg: '#FFFFFF', bd: MW.navy, sh: '0 0 0 5px rgba(39,171,143,0.2)' },
    todo: { bg: '#FFFFFF', fg: MW.mute2, bd: MW.line2, sh: 'none' },
};

/**
 * One row of the form: the step rail on the left, the title and fields on the right.
 * The id lets the action bar scroll to the first unfinished step (below the sticky header).
 */
export function QuoteStep({ n, state, title, hint, last = false, children }: { n: number; state: StepState; title: string; hint?: string; last?: boolean; children: ReactNode }) {
    const badge = BADGE[state];
    const { stickyTop } = useMobileShell();
    return (
        <div id={quoteStepId(n)} style={{ display: 'grid', gridTemplateColumns: '30px minmax(0,1fr)', columnGap: 12, scrollMarginTop: stickyTop + 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                    style={{
                        position: 'relative', zIndex: 1, width: 30, height: 30, borderRadius: '50%', boxSizing: 'border-box',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: MW_FONT_EN, fontSize: 11, fontWeight: 600,
                        background: badge.bg, color: badge.fg, border: `1.5px solid ${badge.bd}`, boxShadow: badge.sh, transition: 'all .25s',
                    }}
                >
                    {state === 'done' ? '✓' : pad(n)}
                </span>
                {!last && <span style={{ flex: 1, width: 2, margin: '6px 0 2px', borderRadius: 2, background: state === 'done' ? MW.mint : DASHED, transition: 'background .25s' }} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: `3px 0 ${last ? 0 : 36}px`, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap', minHeight: 30 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, lineHeight: 1.3 }}>{title}</h2>
                    {hint && <span style={{ fontSize: 11, color: MW.mute, overflow: 'hidden', textOverflow: 'ellipsis' }}>{hint}</span>}
                </div>
                {children}
            </div>
        </div>
    );
}
