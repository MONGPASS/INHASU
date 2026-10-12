import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { MW, MW_FONT } from '../desktop-primitives/mwTokens';
import { D } from '../mobile/mobileTheme';
import { Ico } from '../mobile/mobileUi';
import { BK_HEAD, BK_PAGE_BG, bareName, type BookingStepNo } from '../reservation-shared/bookingShared';
import { Stepper } from './Stepper';

interface ReservationShellProps {
    step: BookingStepNo;
    productName?: string;
    /** Custom back behaviour. Defaults to navigate(-1). */
    onBack?: () => void;
    /** No back button on the final "complete" step. */
    hideBack?: boolean;
    children: ReactNode;
}

const crumb: CSSProperties = { color: MW.mute2, textDecoration: 'none' };

/**
 * Chrome shared by the three PC booking pages (Claude Design: "Booking Header" + "Booking Body"):
 * breadcrumb, step title, stepper and the grey body that holds the cards.
 * The URL changes between steps, so this keeps the pages visually continuous.
 */
export function ReservationShell({ step, productName, onBack, hideBack, children }: ReservationShellProps) {
    const navigate = useNavigate();
    const { title, sub } = BK_HEAD[step];
    const handleBack = onBack ?? (() => navigate(-1));
    const name = productName ? bareName(productName) : '';
    const go = (to: string) => (e: { preventDefault: () => void }) => {
        e.preventDefault();
        navigate(to);
    };

    return (
        <div style={{ minHeight: '100vh', background: BK_PAGE_BG, color: MW.navy, fontFamily: MW_FONT, WebkitFontSmoothing: 'antialiased' }}>
            <div style={{ background: '#FFFFFF', borderBottom: `1px solid ${MW.line}` }}>
                <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px 28px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                        {!hideBack && (
                            <button type="button" onClick={handleBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 36, padding: '0 14px 0 8px', border: `1px solid ${MW.line2}`, borderRadius: 999, background: '#FFFFFF', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', flexShrink: 0 }}>
                                <Ico d={D.back} size={16} width={2} />
                                뒤로
                            </button>
                        )}
                        <nav aria-label="현재 위치" style={{ display: 'flex', gap: 8, fontSize: 12, color: MW.mute2, whiteSpace: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
                            <a href="/" onClick={go('/')} style={crumb}>홈</a>
                            <span>›</span>
                            <a href="/products" onClick={go('/products')} style={crumb}>투어 상품</a>
                            {name && (
                                <>
                                    <span>›</span>
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                                </>
                            )}
                            <span>›</span>
                            <span style={{ color: MW.navy, fontWeight: 700 }}>예약</span>
                        </nav>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <h1 style={{ margin: 0, fontSize: 'clamp(26px,3vw,34px)', fontWeight: 900, lineHeight: 1.3 }}>{title}</h1>
                        <span style={{ fontSize: 14, color: MW.mute }}>{sub}</span>
                    </div>
                    <Stepper step={step} />
                </div>
            </div>

            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px 104px', display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {children}
            </div>
        </div>
    );
}
