import {
    BookingAgreeCard, BookingAmountCard, BookingCancelCard, BookingErrorAlert, BookingPayMethodCard, BookingPersonCard, BookingTourInfoCard,
} from '../reservation-shared/BookingStepTwo';
import { BookingSummaryCard } from '../reservation-shared/BookingSummaryCard';
import { BK_HINT_INVOICE, BK_STICKY_TOP_PC, findOption, type PaymentStepProps } from '../reservation-shared/bookingShared';
import { ReservationShell } from './ReservationShell';

/**
 * STEP 2 on PC — booking person form and payment confirmation.
 * State and the submit handler live in src/pages/Payment.tsx, so PC and mobile share
 * the exact same validation, request and e-mail flow.
 */
export function PaymentDesktop({
    product, isQuote, selectedStartDate, endDate, nights, days, totalPeople, baseOption, priceBreakdown, selectedAccomId, selectedVehicleId,
    customerInfo, setCustomerInfo, memo, setMemo, agreeToTerms, setAgreeToTerms, isProcessing, fieldError, onFieldEdit, onSubmit, onBack,
}: PaymentStepProps) {
    const handleSubmit = () => {
        if (isProcessing) return;
        onSubmit();
    };
    const general = fieldError && (fieldError.field === 'form' || fieldError.field === 'date') ? fieldError : null;

    return (
        <ReservationShell step={2} productName={product.name} onBack={onBack}>
            <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                {general && <BookingErrorAlert error={general} />}
                <BookingTourInfoCard pc product={product} start={selectedStartDate} end={endDate} nights={nights} days={days} totalPeople={totalPeople} baseOption={baseOption} />
                <BookingPersonCard pc customerInfo={customerInfo} setCustomerInfo={setCustomerInfo} memo={memo} setMemo={setMemo} fieldError={fieldError} onFieldEdit={onFieldEdit} />
                <BookingAmountCard pc priceBreakdown={priceBreakdown} baseOption={baseOption} totalPeople={totalPeople} />
                <BookingPayMethodCard pc deposit={priceBreakdown.deposit} />
                <BookingCancelCard pc />
                <BookingAgreeCard
                    pc
                    checked={agreeToTerms}
                    onToggle={() => {
                        setAgreeToTerms(!agreeToTerms);
                        onFieldEdit('terms');
                    }}
                    error={fieldError?.field === 'terms' ? fieldError.msg : undefined}
                />
            </div>

            <BookingSummaryCard
                pc
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
                stickyTop={BK_STICKY_TOP_PC}
                cta={{ label: isProcessing ? '처리 중…' : '예약 신청하기', onClick: handleSubmit, disabled: isProcessing, hint: fieldError?.msg || BK_HINT_INVOICE, hintError: !!fieldError }}
            />
        </ReservationShell>
    );
}
