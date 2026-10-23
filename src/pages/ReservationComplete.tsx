import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { ReservationCompleteDesktop } from '../components/reservation-desktop/ReservationCompleteDesktop';
import { ReservationCompleteMobile } from '../components/reservation-mobile/ReservationCompleteMobile';
import { BookingFallback } from '../components/reservation-shared/BookingFallback';
import { reservationNoOf, type CompleteStepProps } from '../components/reservation-shared/bookingShared';
import { savedReservationPricing } from '../utils/savedReservationPricing';

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

    const priceBreakdown = savedReservationPricing(reservation);
    const productName = reservation.productName || reservation.product_name || '';
    const customerEmail =
        reservation.customerEmail ||
        reservation.customer_info?.email ||
        reservation.email ||
        '';
    const stepProps: CompleteStepProps = {
        reservationId: String(reservation.id || reservationId || ''),
        productName,
        email: customerEmail,
        reservationNo: reservationNoOf(reservation),
        ...priceBreakdown,
    };

    return isDesktop ? <ReservationCompleteDesktop {...stepProps} /> : <ReservationCompleteMobile {...stepProps} />;
};
