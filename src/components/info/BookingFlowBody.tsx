import { useNavigate } from 'react-router-dom';
import { MW, MW_FONT_EN, MW_GRADIENT } from '../desktop-primitives/mwTokens';
import { M_PAPER } from '../mobile/mobileTheme';
import { BOOKING_FLOW_STEPS } from './bookingFlow';

const CLOCK = 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2';

/** 예약 안내 body (Claude Design: "Booking Flow"): numbered timeline + quote CTA. Shared by PC and mobile. */
export function BookingFlowBody({ compact = false }: { compact?: boolean }) {
    const navigate = useNavigate();
    const go = (path: string) => {
        navigate(path);
        window.scrollTo(0, 0);
    };
    const last = BOOKING_FLOW_STEPS.length - 1;

    return (
        <>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
                {BOOKING_FLOW_STEPS.map((s, i) => (
                    <li key={s.title} style={{ display: 'grid', gridTemplateColumns: '56px minmax(0,1fr)', columnGap: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span
                                aria-hidden="true"
                                style={{
                                    width: 56, height: 56, borderRadius: 18, background: i === last ? MW_GRADIENT : MW.mintBg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontFamily: MW_FONT_EN, fontSize: 16, fontWeight: 600, color: i === last ? MW.navy : MW.mintDeep,
                                }}
                            >
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            {i < last && <span aria-hidden="true" style={{ flex: 1, width: 2, margin: '8px 0', background: MW.line }} />}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: `6px 0 ${i < last || compact ? 36 : 8}px` }}>
                            <h2 style={{ margin: 0, fontSize: 19, fontWeight: 900, lineHeight: 1.45 }}>{s.title}</h2>
                            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.85, color: MW.ink3 }}>{s.text}</p>
                            <span style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6, minHeight: 28, padding: '0 12px', borderRadius: 999, background: M_PAPER, fontSize: 12, fontWeight: 700, color: MW.mute }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MW.mintDeep} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d={CLOCK} />
                                </svg>
                                {s.when}
                            </span>
                        </div>
                    </li>
                ))}
            </ol>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', padding: '24px 28px', borderRadius: 24, background: MW.mintBg }}>
                <span style={{ fontSize: 15, fontWeight: 900 }}>먼저 무료 견적부터 받아 보세요</span>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => go('/custom-estimate')} style={{ height: 48, padding: '0 22px', border: 0, borderRadius: 999, background: MW_GRADIENT, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>
                        맞춤 견적
                    </button>
                    <button type="button" onClick={() => go('/products')} style={{ height: 48, padding: '0 22px', border: `1.5px solid ${MW.navy}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>
                        투어 보기
                    </button>
                </div>
            </div>
        </>
    );
}
