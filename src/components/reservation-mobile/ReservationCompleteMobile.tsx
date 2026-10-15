import { useNavigate } from 'react-router-dom';
import { MobileShell } from '../mobile/MobileShell';
import { BookingDoneCard } from '../reservation-shared/BookingDoneCard';
import { BookingSummaryCard } from '../reservation-shared/BookingSummaryCard';
import { BK_PAGE_BG, type CompleteStepProps } from '../reservation-shared/bookingShared';
import { BookingHeaderMobile } from './BookingHeaderMobile';
import { DONE_NEXT_STEPS_MOBILE } from './completeSummary';

/**
 * 완료 on mobile (Claude Design: "Booking Done" + "Booking Summary").
 * As on the other booking steps the tab bar stays hidden; STEP 3 has no action bar either —
 * the card's own buttons (내 예약 → 카카오톡 → 홈) lead on.
 */
export function ReservationCompleteMobile(props: CompleteStepProps) {
    const navigate = useNavigate();
    const { summary } = props;
    const home = () => {
        navigate('/');
        window.scrollTo(0, 0);
    };
    const myBooking = () => {
        navigate(props.reservationId ? `/mypage/reservations/${props.reservationId}` : '/mypage/reservations');
        window.scrollTo(0, 0);
    };
    return (
        <MobileShell title="예약" onBack={home} tabBar={false}>
            <BookingHeaderMobile step={3} />
            <section style={{ background: BK_PAGE_BG }}>
                <div style={{ padding: '16px 12px 40px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'stretch' }}>
                    <div style={{ width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* The tour and the amounts move to the summary card below, as in the design. */}
                        <BookingDoneCard pc={false} {...props} hideAmounts={!!summary} nextSteps={DONE_NEXT_STEPS_MOBILE} onMyBookings={myBooking} onHome={home} />
                    </div>
                    {summary && (
                        <BookingSummaryCard
                            pc={false}
                            product={summary.product}
                            isQuote={summary.isQuote}
                            start={summary.start}
                            end={summary.end}
                            nights={summary.nights}
                            days={summary.days}
                            people={summary.people}
                            baseOption={summary.baseOption}
                            priceBreakdown={{ total: props.total, deposit: props.deposit, local: props.local }}
                            accom={summary.accom}
                            vehicle={summary.vehicle}
                        />
                    )}
                </div>
            </section>
        </MobileShell>
    );
}
