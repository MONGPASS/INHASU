import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { sendNotificationEmail } from '../lib/email';
import { SEO } from '../components/seo/SEO';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { PaymentDesktop } from '../components/reservation-desktop/PaymentDesktop';
import { PaymentMobile } from '../components/reservation-mobile/PaymentMobile';
import { BookingFallback } from '../components/reservation-shared/BookingFallback';
import { clearBookingDraft, type PaymentStepProps } from '../components/reservation-shared/bookingShared';
import { toLocalDateKey } from '../utils/formatDate';

export const Payment: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const isDesktop = useIsDesktop();
    const [fieldError, setFieldError] = useState<{ field: string; msg: string } | null>(null);

    // Customer info state
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        phone: '',
        email: ''
    });
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    // Free-form memo (optional textarea on both layouts). Forwarded with the
    // customer info so it lands on the reservation record when filled in.
    const [memo, setMemo] = useState('');

    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);

    // Auto-fill user info
    useEffect(() => {
        const loadUserInfo = async () => {
            try {
                const me = await api.auth.me();
                if (me) {
                    setCustomerInfo(prev => ({
                        ...prev,
                        name: me.name || me.full_name || prev.name,
                        email: me.email || prev.email,
                        phone: me.phone || prev.phone
                    }));
                }
            } catch (e) {
                // Ignore if not logged in
            }
        };
        loadUserInfo();
    }, []);

    // Extract reservation data from navigation state
    const reservationData = location.state as {
        product: any;
        selectedStartDate?: Date;
        totalPeople: number;
        parsedDuration?: { nights: number; days: number };
        priceBreakdown: { total: number; deposit: number; local: number };
        selectedAccomId?: string;
        selectedVehicleId?: string;
        // Quote specific fields
        isQuote?: boolean;
        quoteId?: string;
        customerInfo?: { name: string; phone: string; email: string };
    } | null;

    // Derived state from reservationData
    const product = reservationData?.product;
    const isQuote = reservationData?.isQuote || false;
    const quoteId = reservationData?.quoteId;
    const selectedStartDate = reservationData?.selectedStartDate;
    const totalPeople = reservationData?.totalPeople;
    const parsedDuration = reservationData?.parsedDuration;
    const priceBreakdown = reservationData?.priceBreakdown;

    useEffect(() => {
        if (!fieldError || isDesktop) return;
        const target = document.querySelector(`[data-payment-field="${fieldError.field}"]`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [fieldError, isDesktop]);

    // Safety check for 0 won payments (especially for quotes)
    useEffect(() => {
        if (priceBreakdown && priceBreakdown.total <= 0) {
            console.error('[payment] Invalid price breakdown', priceBreakdown);
            navigate(-1);
        }
    }, [priceBreakdown, navigate]);

    // Auto-fill customer info from quote if passed
    useEffect(() => {
        if (reservationData?.customerInfo) {
            setCustomerInfo(prev => ({
                ...prev,
                name: reservationData.customerInfo?.name || prev.name,
                phone: reservationData.customerInfo?.phone || prev.phone,
                email: reservationData.customerInfo?.email || prev.email
            }));
        }
    }, [reservationData?.customerInfo]);

    // Calculate endDate safely (for regular products)
    const endDate = React.useMemo(() => {
        if (!selectedStartDate || !parsedDuration) return null;
        
        const start = new Date(selectedStartDate);
        // Use nights as primary offset, fallback to days-1 if nights is 0 but days > 0
        const offsetDays = parsedDuration.nights > 0 
            ? parsedDuration.nights 
            : Math.max(0, parsedDuration.days - 1);
            
        return new Date(start.getTime() + offsetDays * 24 * 60 * 60 * 1000);
    }, [selectedStartDate, parsedDuration]);

    const formatPrice = (price: number) => price ? price.toLocaleString() : '0';

    const handlePayment = async () => {
        // Prevent double click
        if (isProcessing) return;

        // For regular products, dates are required; for quotes, they are optional
        if (!reservationData || !product || !priceBreakdown) {
            setFieldError({ field: 'form', msg: '예약 정보를 확인할 수 없습니다. 상품 페이지에서 다시 시도해 주세요.' });
            return;
        }

        // For regular products, require dates
        if (!isQuote && (!selectedStartDate || !parsedDuration)) {
            setFieldError({ field: 'date', msg: '여행 일정을 선택해 주세요.' });
            return;
        }

        // Validate customer info
        if (!customerInfo.name.trim()) {
            setFieldError({ field: 'name', msg: '이름을 입력해 주세요.' });
            return;
        }
        if (!customerInfo.phone.trim()) {
            setFieldError({ field: 'phone', msg: '휴대폰 번호를 입력해 주세요.' });
            return;
        }
        if (!customerInfo.email.trim()) {
            setFieldError({ field: 'email', msg: '이메일 주소를 입력해 주세요.' });
            return;
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(customerInfo.email)) {
            setFieldError({ field: 'email', msg: '올바른 이메일 주소를 입력해 주세요.' });
            return;
        }
        if (!agreeToTerms) {
            setFieldError({ field: 'terms', msg: '이용약관과 개인정보처리방침에 동의해 주세요.' });
            return;
        }

        try {
            setFieldError(null);
            setIsProcessing(true);
            const me = await api.auth.me();
            if (!me) {
                setFieldError({ field: 'form', msg: '예약을 계속하려면 로그인해 주세요.' });
                setIsProcessing(false);
                return;
            }

            const now = new Date().toISOString();

            // Tuck the optional memo into customer_info so admin sees it
            // alongside the customer's contact details on the reservation
            // detail page (no schema change required).
            const customerInfoForSave = memo
                ? { ...customerInfo, memo }
                : customerInfo;

            const newReservation: any = {
                user_id: me.id,
                type: isQuote ? 'quote' : 'tour',
                status: 'pending_payment',
                product_name: product.name,
                product_id: isQuote ? null : product.id,
                total_people: totalPeople,
                customer_info: customerInfoForSave,
                price_breakdown: priceBreakdown,
                created_at: now
            };

            // Add date fields only for regular products
            if (!isQuote && selectedStartDate && parsedDuration) {
                // 캘린더에서 고른 날짜는 로컬 자정 Date다. toISOString()을 씌우면 JST/KST(UTC+9)
                // 기준으로 전날 15:00Z가 되어 출발일이 하루 앞당겨 저장된다 → "YYYY-MM-DD"로 저장.
                newReservation.start_date = toLocalDateKey(selectedStartDate);
                newReservation.end_date = endDate ? toLocalDateKey(endDate) : null;
                newReservation.duration = `${parsedDuration.nights}박 ${parsedDuration.days}일`;
            } else if (isQuote) {
                // For quotes, use duration string from product if available
                newReservation.duration = product.duration || null;
            }

            const data = await api.reservations.create(newReservation);
            const reservationId = data.id;
            const reservationNumber = data.reservationNumber
                ? String(data.reservationNumber)
                : `MN-${data.id.slice(0, 8).toUpperCase()}`;

            // Update quote status if this is a quote reservation
            if (isQuote && quoteId) {
                try {
                    await (api.quotes as any).update(quoteId, { status: 'converted' });
                } catch (quoteUpdateError) {
                    console.error('Failed to update quote status:', quoteUpdateError);
                    // We don't block the reservation flow, but log it
                }
            }

            // The reservation is already persisted at this point. Notification
            // failures must not turn a successful booking into a customer-facing error.
            try {
                await sendNotificationEmail(
                    newReservation.customer_info.email,
                    'RESERVATION_REQUESTED',
                    {
                        customerName: newReservation.customer_info.name,
                        productName: newReservation.product_name,
                        reservationId: reservationNumber,
                        reservationDbId: reservationId,
                        userId: me.id,
                        depositAmount: formatPrice(newReservation.price_breakdown.deposit),
                        customerPhone: newReservation.customer_info.phone,
                        customerEmail: newReservation.customer_info.email,
                        totalAmount: formatPrice(newReservation.price_breakdown.total),
                        localAmount: formatPrice(newReservation.price_breakdown.local),
                    }
                );
            } catch (notificationError) {
                console.error('Reservation created, but notification email failed:', notificationError);
            }

            // Proceed to reservation complete
            if (product?.id) clearBookingDraft(String(product.id));
            navigate('/reservation-complete', { state: { reservationId }, replace: true });
        } catch (e) {
            console.error('Failed to save reservation', e);
            setIsProcessing(false);

            setFieldError({ field: 'form', msg: '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.' });
        }
    };

    // Redirect if no reservation data (quotes don't require dates)
    if (!reservationData || !product || !priceBreakdown || priceBreakdown.total <= 0) {
        return (
            <BookingFallback
                pc={isDesktop}
                text={t('payment.no_reservation')}
                action={{ label: t('payment.return_to_products'), onClick: () => navigate('/products') }}
            />
        );
    }

    // Find the matching pricing tier so the summary can show the per-person
    // price the customer is about to be charged (quotes have no tiers).
    const baseOption = (() => {
        const options = product.pricingOptions;
        if (!Array.isArray(options) || options.length === 0 || !totalPeople) return null;
        const sorted = [...options].sort((a: any, b: any) => a.people - b.people);
        const exact = sorted.find((p: any) => p.people === totalPeople);
        if (exact) return exact;
        if (totalPeople < sorted[0].people) return sorted[0];
        if (totalPeople > sorted[sorted.length - 1].people) return sorted[sorted.length - 1];
        return sorted.filter((p: any) => p.people <= totalPeople).pop() || sorted[0];
    })();

    // PC and mobile get the same state and handlers (step 2 of 3); only the layout differs.
    const stepProps: PaymentStepProps = {
        product,
        isQuote,
        selectedStartDate: selectedStartDate ? new Date(selectedStartDate) : null,
        endDate,
        nights: parsedDuration?.nights ?? 0,
        days: parsedDuration?.days ?? 0,
        totalPeople: totalPeople ?? 0,
        baseOption,
        priceBreakdown,
        selectedAccomId: reservationData.selectedAccomId,
        selectedVehicleId: reservationData.selectedVehicleId,
        customerInfo,
        setCustomerInfo,
        memo,
        setMemo,
        agreeToTerms,
        setAgreeToTerms,
        isProcessing,
        fieldError,
        onFieldEdit: (field) => setFieldError((prev) => (prev?.field === field ? null : prev)),
        onSubmit: handlePayment,
        onBack: () => navigate(-1),
    };

    return (
        <>
            <SEO
                title={`${product?.name || ''} - ${t('payment.title')}`}
                description="예약 내용 확인 페이지입니다. 내용을 확인한 뒤 예약을 신청해 주세요. 예약금은 계좌이체로 받습니다."
            />
            {isDesktop ? <PaymentDesktop {...stepProps} /> : <PaymentMobile {...stepProps} />}
        </>
    );
};
