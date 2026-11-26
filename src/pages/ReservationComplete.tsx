import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { ReservationCompleteDesktop } from '../components/reservation-desktop/ReservationCompleteDesktop';
import { ReservationCompleteMobile } from '../components/reservation-mobile/ReservationCompleteMobile';
import { BookingFallback } from '../components/reservation-shared/BookingFallback';
import { reservationNoOf, type CompleteStepProps } from '../components/reservation-shared/bookingShared';

/** ‘2026-11-27’ → 그날 0시(현지 날짜 그대로). 못 읽으면 null. */
const toDate = (v: unknown): Date | null => {
    const m = typeof v === 'string' ? v.match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};

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
        image: typeof location.state?.image === 'string' ? location.state.image : undefined,
        startDate: toDate(reservation.startDate || reservation.start_date || reservation.date),
        endDate: toDate(reservation.endDate || reservation.end_date),
        people: Number(reservation.totalPeople || reservation.travelers) || undefined,
    };

    return isDesktop ? <ReservationCompleteDesktop {...stepProps} /> : <ReservationCompleteMobile {...stepProps} />;
};
