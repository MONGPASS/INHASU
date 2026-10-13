import { won } from '../desktop-primitives/mwTokens';
import { MobileShell } from '../mobile/MobileShell';
import {
    BookingAgreeCard, BookingAmountCard, BookingCancelCard, BookingErrorAlert, BookingPayMethodCard, BookingPersonCard, BookingTourInfoCard,
} from '../reservation-shared/BookingStepTwo';
import { BookingSummaryCard } from '../reservation-shared/BookingSummaryCard';
import { BK_HINT_INVOICE, BK_PAGE_BG, findOption, type PaymentStepProps } from '../reservation-shared/bookingShared';
import { BookingActionBar } from './BookingActionBar';
import { BookingHeaderMobile } from './BookingHeaderMobile';

/**
 * STEP 2 on mobile (Claude Design: "Milkyway Japan Mobile" — Booking Tour Info / Person / Amount /
 * Pay Method / Cancel). Validation, the reservation request and the e-mail all stay in
 * src/pages/Payment.tsx; the sticky action bar only calls its submit handler.
 */
export function PaymentMobile({
    product, isQuote, selectedStartDate, endDate, nights, days, totalPeople, baseOption, priceBreakdown, selectedAccomId, selectedVehicleId,
    customerInfo, setCustomerInfo, memo, setMemo, agreeToTerms, setAgreeToTerms, isProcessing, fieldError, onFieldEdit, onSubmit, onBack,
}: PaymentStepProps) {
    const general = fieldError && (fieldError.field === 'form' || fieldError.field === 'date') ? fieldError : null;

    return (
        <MobileShell
            title="예약"
            onBack={onBack}
            bottomBar={(
                <BookingActionBar
                    caption="예약금(계좌이체)"
                    amount={won(priceBreakdown.deposit)}
                    label={isProcessing ? '처리 중…' : '예약 신청하기'}
                    disabled={isProcessing}
                    onAction={onSubmit}
                    hint={fieldError?.msg || BK_HINT_INVOICE}
                    hintError={!!fieldError}
                />
            )}
        >
            <BookingHeaderMobile step={2} />
            <section style={{ background: BK_PAGE_BG }}>
                <div style={{ padding: '16px 12px 40px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'stretch' }}>
                    <div style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {general && <BookingErrorAlert error={general} />}
                        <BookingTourInfoCard pc={false} product={product} start={selectedStartDate} end={endDate} nights={nights} days={days} totalPeople={totalPeople} baseOption={baseOption} />
                        <BookingPersonCard pc={false} customerInfo={customerInfo} setCustomerInfo={setCustomerInfo} memo={memo} setMemo={setMemo} fieldError={fieldError} onFieldEdit={onFieldEdit} />
                        <BookingAmountCard pc={false} priceBreakdown={priceBreakdown} baseOption={baseOption} totalPeople={totalPeople} />
                        <BookingPayMethodCard pc={false} deposit={priceBreakdown.deposit} />
                        <BookingCancelCard pc={false} />
                        <BookingAgreeCard
                            pc={false}
                            checked={agreeToTerms}
                            onToggle={() => {
                                setAgreeToTerms(!agreeToTerms);
                                onFieldEdit('terms');
                            }}
                            error={fieldError?.field === 'terms' ? fieldError.msg : undefined}
                        />
                    </div>
                    <BookingSummaryCard
                        pc={false}
                        product={product}
                        isQuote={isQuote}
                        start={selectedStartDate}
                        end={endDate}
                        nights={nights}
                        days={days}
                        people={totalPeople}
                        baseOption={baseOption}
                        priceBreakdown={priceBreakdown}
                        accom={findOption(product.accommodationOptions, selectedAccomId)}
                        vehicle={findOption(product.vehicleOptions, selectedVehicleId)}
                    />
                </div>
            </section>
        </MobileShell>
    );
}
