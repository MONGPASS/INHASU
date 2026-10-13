import { MW, MW_FONT } from '../desktop-primitives/mwTokens';
import { MobileShell } from '../mobile/MobileShell';
import { MEmpty, MLoading } from '../mobile/mobileUi';
import { BK_PAGE_BG } from './bookingShared';

interface BookingFallbackProps {
    pc: boolean;
    /** Message for the empty state; omit while loading. */
    text?: string;
    action?: { label: string; onClick: () => void };
}

/** Loading / "nothing to book" state of the booking pages, in the same chrome as the steps. */
export function BookingFallback({ pc, text, action }: BookingFallbackProps) {
    if (!pc) {
        return (
            <MobileShell title="예약">
                <section style={{ background: BK_PAGE_BG, padding: '16px 12px 40px' }}>
                    {text ? <MEmpty text={text} action={action} /> : <MLoading />}
                </section>
            </MobileShell>
        );
    }
    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24, background: BK_PAGE_BG, color: MW.navy, fontFamily: MW_FONT, textAlign: 'center' }}>
            <span style={{ fontSize: 15, lineHeight: 1.7, color: MW.mute }}>{text || '불러오는 중…'}</span>
            {action && (
                <button type="button" onClick={action.onClick} style={{ height: 48, padding: '0 24px', border: 0, borderRadius: 999, background: MW.mint, fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>
                    {action.label}
                </button>
            )}
        </div>
    );
}
