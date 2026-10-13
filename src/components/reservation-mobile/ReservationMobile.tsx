import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { won } from '../desktop-primitives/mwTokens';
import { MobileShell } from '../mobile/MobileShell';
import { BookingDateCard, BookingOptionCard, BookingPeopleCard } from '../reservation-shared/BookingStepOne';
import { BookingSummaryCard } from '../reservation-shared/BookingSummaryCard';
import { PriceTableDialog } from '../reservation-shared/PriceTableDialog';
import {
    BK_HINT_DEPOSIT, BK_HINT_PICK_DATE, BK_PAGE_BG, addDays, findOption, sortTiers,
    type ReservationStepProps,
} from '../reservation-shared/bookingShared';
import { BookingActionBar } from './BookingActionBar';
import { BookingHeaderMobile } from './BookingHeaderMobile';

/**
 * STEP 1 on mobile (Claude Design: "Milkyway Japan Mobile" — Booking Date / People / Stay / Car).
 * State lives in src/pages/Reservation.tsx, shared with the PC layout; '다음' sits in the
 * sticky action bar that replaces the tab bar.
 */
export function ReservationMobile({
    product, parsedDuration, selectedStartDate, setSelectedStartDate, totalPeople, setTotalPeople,
    selectedAccomId, setSelectedAccomId, selectedVehicleId, setSelectedVehicleId, baseOption, priceBreakdown, onNext,
}: ReservationStepProps) {
    const navigate = useNavigate();
    const [showPriceTable, setShowPriceTable] = useState(false);
    const closePriceTable = useCallback(() => setShowPriceTable(false), []);

    const tiers = useMemo(() => sortTiers(product.pricingOptions), [product.pricingOptions]);
    const accommodations = product.accommodationOptions ?? [];
    const vehicles = product.vehicleOptions ?? [];
    const nights = Math.max(0, parsedDuration.nights);
    const endDate = selectedStartDate ? addDays(selectedStartDate, nights) : null;
    const ready = !!selectedStartDate;

    // Back from STEP 1 returns to the tour page (also when the booking URL was opened directly).
    const back = () => {
        if (window.history.length > 1) navigate(-1);
        else navigate(product.id ? `/products/${product.id}` : '/products');
    };

    return (
        <MobileShell
            title="예약"
            onBack={back}
            bottomBar={(
                <BookingActionBar
                    caption={`합계(${totalPeople}명)`}
                    amount={won(priceBreakdown.total)}
                    label="다음"
                    disabled={!ready}
                    onAction={onNext}
                    hint={ready ? BK_HINT_DEPOSIT : BK_HINT_PICK_DATE}
                    hintError={!ready}
                />
            )}
        >
            <BookingHeaderMobile step={1} />
            <section style={{ background: BK_PAGE_BG }}>
                <div style={{ padding: '16px 12px 40px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'stretch' }}>
                    <div style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <BookingDateCard pc={false} parsedDuration={parsedDuration} value={selectedStartDate} onChange={setSelectedStartDate} />
                        <BookingPeopleCard pc={false} tiers={tiers} totalPeople={totalPeople} setTotalPeople={setTotalPeople} baseOption={baseOption} onShowPrices={() => setShowPriceTable(true)} />
                        {accommodations.length > 0 && (
                            <BookingOptionCard pc={false} title="숙박 옵션" sub="원하시는 숙박 유형을 선택해 주세요" options={accommodations} selectedId={selectedAccomId} onSelect={setSelectedAccomId} />
                        )}
                        {vehicles.length > 0 && (
                            <BookingOptionCard pc={false} title="차량 옵션" sub="참가 인원에 맞춰 가장 알맞은 차량을 자동으로 배정합니다" options={vehicles} selectedId={selectedVehicleId} onSelect={setSelectedVehicleId} />
                        )}
                    </div>
                    <BookingSummaryCard
                        pc={false}
                        product={product}
                        start={selectedStartDate}
                        end={endDate}
                        nights={parsedDuration.nights}
                        days={parsedDuration.days}
                        people={totalPeople}
                        baseOption={baseOption}
                        priceBreakdown={priceBreakdown}
                        accom={findOption(accommodations, selectedAccomId)}
                        vehicle={findOption(vehicles, selectedVehicleId)}
                    />
                </div>
            </section>

            {showPriceTable && (
                <PriceTableDialog
                    pc={false}
                    options={tiers}
                    current={totalPeople}
                    onChange={(n) => {
                        setTotalPeople(n);
                        setShowPriceTable(false);
                    }}
                    onClose={closePriceTable}
                />
            )}
        </MobileShell>
    );
}
