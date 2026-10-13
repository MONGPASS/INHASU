import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { ReservationCompleteDesktop } from '../components/reservation-desktop/ReservationCompleteDesktop';
import { ReservationCompleteMobile } from '../components/reservation-mobile/ReservationCompleteMobile';
import { readCompleteSummary } from '../components/reservation-mobile/completeSummary';
import { BookingFallback } from '../components/reservation-shared/BookingFallback';
import { reservationNoOf, type CompleteStepProps } from '../components/reservation-shared/bookingShared';

export const ReservationComplete: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isDesktop = useIsDesktop();
    const [reservation, setReservation] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const reservationId = location.state?.reservationId;

    useEffect(() => {
        if (!reservationId) {
            navigate('/', { replace: true });
            return;
        }

        const fetchReservation = async () => {
            try {
                const data = await api.reservations.get(reservationId);
                setReservation(data);
            } catch (error) {
                console.error('Error fetching reservation:', error);
                alert('예약 정보를 불러오지 못했습니다.');
                navigate('/', { replace: true });
            } finally {
                setLoading(false);
            }
        };

        fetchReservation();
    }, [reservationId, navigate]);

    if (loading) return <BookingFallback pc={isDesktop} />;

    if (!reservation) return null;

    const priceBreakdown = reservation.priceBreakdown || reservation.price_breakdown || {
        total: reservation.totalPrice || reservation.totalAmount || 0,
        deposit: reservation.depositAmount || reservation.deposit || 0,
        local: reservation.balanceAmount || reservation.balance || 0,
    };
    const productName = reservation.productName || reservation.product_name || '';
    const customerEmail =
        reservation.customerEmail ||
        reservation.customer_info?.email ||
        reservation.email ||
        '';
    const total = priceBreakdown.total || 0;
    const deposit = priceBreakdown.deposit || 0;

    // Final step of the wizard. The pay-on-site figure keeps each layout's existing rule:
    // PC shows total − deposit, mobile shows the saved pay-on-site amount.
    const stepProps: CompleteStepProps = {
        reservationId: String(reservation.id || reservationId || ''),
        productName,
        email: customerEmail,
        reservationNo: reservationNoOf(reservation),
        total,
        deposit,
        local: isDesktop ? Math.max(0, total - deposit) : priceBreakdown.local || 0,
        // Mobile shows the booking summary card under the confirmation card (same card as STEP 1 · 2).
        summary: isDesktop ? undefined : readCompleteSummary(location.state?.summary, reservation),
    };

    return isDesktop ? <ReservationCompleteDesktop {...stepProps} /> : <ReservationCompleteMobile {...stepProps} />;
};
