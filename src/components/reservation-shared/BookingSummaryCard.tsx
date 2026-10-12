import { useState } from 'react';
import type { AccommodationOption, TourPricingOption, VehicleOption } from '../../types/product';
import { MW, MW_FONT_EN, MW_GRADIENT, isUsableImage, won } from '../desktop-primitives/mwTokens';
import { D } from '../mobile/mobileTheme';
import { Ico } from '../mobile/mobileUi';
import {
    BK_D, BK_DARK_GRADIENT, bareName, durationLabel, optionPriceLabel, periodShort, priceLines,
    type BookingProduct, type PriceBreakdown,
} from './bookingShared';

export interface SummaryCta {
    label: string;
    onClick: () => void;
    disabled: boolean;
    hint: string;
    /** Hint is a problem to fix (shown in red) rather than a reassurance. */
    hintError: boolean;
}

interface BookingSummaryCardProps {
    pc: boolean;
    product: BookingProduct;
    isQuote?: boolean;
    start: Date | null;
    end: Date | null;
    nights: number;
    days: number;
    people: number;
    baseOption: TourPricingOption | null;
    priceBreakdown: PriceBreakdown;
    accom?: AccommodationOption;
    vehicle?: VehicleOption;
    /** PC only: the step's main button lives in the sticky card (mobile uses the bottom action bar). */
    cta?: SummaryCta;
    /** PC only: sticky offset from the top of the viewport. */
    stickyTop?: number;
}

function Row({ icon, k, v, sub, warn }: { icon: string; k: string; v: string; sub?: string; warn?: boolean }) {
    return (
        <div style={{ display: 'flex', gap: 12, padding: '14px 0', borderBottom: `1px dashed ${MW.line}` }}>
            <Ico d={icon} size={18} color={MW.mute} style={{ flexShrink: 0 }} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: MW.mute2 }}>{k}</span>
                <span style={{ fontSize: 14, fontWeight: 900, lineHeight: 1.5, color: warn ? MW.red : MW.navy }}>{v}</span>
                {sub && <span style={{ fontSize: 11, color: MW.mute2 }}>{sub}</span>}
            </span>
        </div>
    );
}

/**
 * Booking summary (Claude Design: "Booking Summary"): tour photo, the current selection and the
 * total / deposit / pay-on-site split. Sticky right column on PC, a card under the form on mobile.
 */
export function BookingSummaryCard({
    pc, product, isQuote = false, start, end, nights, days, people, baseOption, priceBreakdown, accom, vehicle, cta, stickyTop = 24,
}: BookingSummaryCardProps) {
    const hero = product.mainImages?.[0];
    const [broken, setBroken] = useState(false);
    const title = bareName(product.name);
    const length = durationLabel(nights, days, product.duration);
    const tagLine = [product.category, length].filter(Boolean).join(' | ');
    const lines = priceLines(baseOption, people, accom, vehicle);
    const period = start && end ? periodShort(start, end) : '';
    const showPeriod = !!period || !isQuote || !!product.duration;

    return (
        <aside style={{ flex: pc ? '0 1 380px' : 'none', minWidth: pc ? 300 : 0, position: pc ? 'sticky' : 'static', top: pc ? stickyTop : undefined, background: '#FFFFFF', borderRadius: 28, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ position: 'relative', aspectRatio: '16/10', background: MW.navySoft }}>
                {!broken && isUsableImage(hero) && (
                    <img src={hero} alt={title} loading="lazy" decoding="async" onError={() => setBroken(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(180deg,rgba(10,31,46,0) 45%,rgba(10,31,46,0.85) 100%)' }} />
                <div style={{ position: 'absolute', left: 20, right: 20, bottom: 16, display: 'flex', flexDirection: 'column', gap: 4, color: '#FFFFFF', pointerEvents: 'none' }}>
                    {tagLine && <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintTint }}>{tagLine}</span>}
                    <span style={{ fontSize: 18, fontWeight: 900, lineHeight: 1.35 }}>{title}</span>
                </div>
            </div>

            <div style={{ padding: '6px 22px 0', display: 'flex', flexDirection: 'column' }}>
                {showPeriod && (
                    <Row
                        icon={D.calendar}
                        k="여행 기간"
                        v={period || (isQuote ? product.duration || '' : '미선택')}
                        sub={period ? length || undefined : undefined}
                        warn={!period && !isQuote}
                    />
                )}
                <Row icon={D.people} k="인원" v={`${people}명`} sub={baseOption ? `1인당 ${won(baseOption.pricePerPerson)}` : undefined} />
                {accom && <Row icon={BK_D.stay} k="숙박" v={accom.name} sub={optionPriceLabel(accom.priceModifier, accom.isDefault)} />}
                {vehicle && <Row icon={BK_D.car} k="차량" v={vehicle.name} sub={optionPriceLabel(vehicle.priceModifier, vehicle.isDefault)} />}
            </div>

            <div style={{ padding: '16px 22px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {lines.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: MW.mute }}>
                        {lines.map((l) => (
                            <span key={l.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <span>{l.k}</span>
                                <span style={{ fontFamily: MW_FONT_EN, fontSize: 12, color: MW.navy, whiteSpace: 'nowrap' }}>{l.v}</span>
                            </span>
                        ))}
                    </div>
                )}
                <div style={{ padding: 18, borderRadius: 20, background: BK_DARK_GRADIENT, color: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: MW.mintTint }}>총 금액</span>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 30, fontWeight: 600, letterSpacing: '-0.02em' }}>{won(priceBreakdown.total)}</span>
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: MW.mintTint }}>예약금(계좌이체)</span>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 600, color: MW.mintLight }}>{won(priceBreakdown.deposit)}</span>
                        </span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 11, color: MW.mintTint }}>잔금(현지 현금)</span>
                            <span style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 600 }}>{won(priceBreakdown.local)}</span>
                        </span>
                    </div>
                </div>
                {cta && (
                    <>
                        <button
                            type="button"
                            onClick={cta.onClick}
                            disabled={cta.disabled}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 56, border: 0, borderRadius: 999, background: cta.disabled ? MW.line : MW_GRADIENT, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, color: cta.disabled ? MW.mute2 : MW.navy, cursor: cta.disabled ? 'not-allowed' : 'pointer' }}
                        >
                            {cta.label}
                            <Ico d={BK_D.arrow} size={18} width={2} color={cta.disabled ? MW.mute2 : MW.navy} />
                        </button>
                        <span role={cta.hintError ? 'alert' : undefined} style={{ marginTop: -6, textAlign: 'center', fontSize: 12, lineHeight: 1.6, color: cta.hintError ? MW.red : MW.mute }}>{cta.hint}</span>
                    </>
                )}
            </div>
        </aside>
    );
}
