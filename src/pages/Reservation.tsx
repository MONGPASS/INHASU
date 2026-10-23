import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TourProduct } from '../types/product';
import { api } from '../lib/api';
import { SEO } from '../components/seo/SEO';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { ReservationDesktop } from '../components/reservation-desktop/ReservationDesktop';
import { ReservationMobile } from '../components/reservation-mobile/ReservationMobile';
import { BookingFallback } from '../components/reservation-shared/BookingFallback';
import { readBookingDraft, saveBookingDraft, startOfToday, type ReservationStepProps } from '../components/reservation-shared/bookingShared';
import { resolveBookingPricing } from '../utils/bookingPricing';

export const Reservation: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isDesktop = useIsDesktop();
    const [product, setProduct] = useState<TourProduct | null>(null);
    const [loading, setLoading] = useState(true);

    // State
    const [totalPeople, setTotalPeople] = useState<number>(2);
    const [selectedAccomId, setSelectedAccomId] = useState<string>('');
    const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');

    // Selected departure date
    const [selectedStartDate, setSelectedStartDate] = useState<Date | null>(null);

    // Parse duration to get number of nights and days (robust to handle multiple languages)
    const parsedDuration = useMemo(() => {
        if (!product?.duration) return { nights: 0, days: 0 };
        
        // Extract all numbers
        const matches = product.duration.match(/\d+/g);
        if (!matches || matches.length === 0) return { nights: 0, days: 0 };

        const firstNum = parseInt(matches[0], 10);

        // Case 1: Two numbers (e.g., "3박 4일", "4泊5日")
        if (matches.length >= 2) {
            const secondNum = parseInt(matches[1], 10);
            return { nights: firstNum, days: secondNum };
        }

        // Case 2: One number (e.g., "3박", "4일")
        const durationStr = product.duration;
        if (durationStr.includes('박') || durationStr.includes('泊') || durationStr.toLowerCase().includes('night')) {
            return { nights: firstNum, days: firstNum + 1 };
        }
        if (durationStr.includes('일') || durationStr.includes('日') || durationStr.toLowerCase().includes('day')) {
            return { nights: Math.max(0, firstNum - 1), days: firstNum };
        }

        // Fallback for one number: assume it's days if not specified
        return { nights: Math.max(0, firstNum - 1), days: firstNum };
    }, [product?.duration]);

    // Load Product
    useEffect(() => {
        const loadProduct = async () => {
            if (!id) return;
            try {
                const data = await api.products.get(id);

                if (data) {
                    // /api/products responds with mixed camelCase + snake_case
                    // (see CLAUDE.md §6.3). Accept both so we never miss a
                    // field — without this, mainImages was always empty and
                    // the booking summary fell back to a gradient.
                    const pickArr = (camel: unknown, snake: unknown): any[] => {
                        const v = camel ?? snake;
                        if (Array.isArray(v)) return v;
                        if (typeof v === 'string') {
                            try {
                                const parsed = JSON.parse(v);
                                return Array.isArray(parsed) ? parsed : [];
                            } catch {
                                return [];
                            }
                        }
                        return [];
                    };
                    const found: TourProduct = {
                        id: data.id,
                        name: data.name,
                        price: data.price,
                        originalPrice: data.originalPrice ?? data.original_price,
                        duration: data.duration,
                        category: data.category,
                        mainImages: pickArr(data.mainImages, data.main_images),
                        isPopular: data.isPopular ?? data.is_popular,
                        tags: pickArr(data.tags, data.tags),
                        description: data.description,
                        galleryImages: pickArr(data.galleryImages, data.gallery_images),
                        detailImages: pickArr(data.detailImages, data.detail_images),
                        itineraryImages: pickArr(data.itineraryImages, data.itinerary_images),
                        detailSlides: pickArr(data.detailSlides, data.detail_slides),
                        status: data.status,
                        isFeatured: data.isFeatured ?? data.is_featured,
                        highlights: pickArr(data.highlights, data.highlights),
                        included: pickArr(data.included, data.included),
                        excluded: pickArr(data.excluded, data.excluded),
                        // Older pricing JSON stores headcounts as digit strings.
                        // Normalize those once so the initial count, tier buttons and
                        // price dialog all pass numbers to the shared calculator.
                        pricingOptions: pickArr(data.pricingOptions, data.pricing_options).map(option => {
                            const people = option?.people;
                            if (typeof people !== 'string' || !/^\d+$/.test(people.trim())) return option;
                            const count = Number(people);
                            return Number.isSafeInteger(count) && count > 0 ? { ...option, people: count } : option;
                        }),
                        accommodationOptions: pickArr(data.accommodationOptions, data.accommodation_options),
                        vehicleOptions: pickArr(data.vehicleOptions, data.vehicle_options),
                        viewCount: data.viewCount ?? data.view_count ?? 0,
                        bookingCount: data.bookingCount ?? data.booking_count ?? 0,
                        createdAt: data.createdAt ?? data.created_at,
                        updatedAt: data.updatedAt ?? data.updated_at,
                    };

                    setProduct(found);
                    // Set defaults
                    if (found.accommodationOptions && found.accommodationOptions.length > 0) {
                        const def = found.accommodationOptions.find(o => o.isDefault) || found.accommodationOptions[0];
                        setSelectedAccomId(def.id);
                    }
                    if (found.vehicleOptions && found.vehicleOptions.length > 0) {
                        const def = found.vehicleOptions.find(o => o.isDefault) || found.vehicleOptions[0];
                        setSelectedVehicleId(def.id);
                    }
                    // Set initial people count to first pricing tier
                    if (found.pricingOptions && found.pricingOptions.length > 0) {
                        const sorted = [...found.pricingOptions].sort((a, b) => a.people - b.people);
                        setTotalPeople(sorted[0].people);
                    }
                    // Coming back from STEP 2 remounts this page — put the visitor's
                    // choices back instead of the defaults (only values still valid).
                    const draft = readBookingDraft(found.id);
                    if (draft) {
                        if (found.pricingOptions?.some(o => o.people === draft.totalPeople)) setTotalPeople(draft.totalPeople);
                        if (found.accommodationOptions?.some(o => o.id === draft.selectedAccomId)) setSelectedAccomId(draft.selectedAccomId);
                        if (found.vehicleOptions?.some(o => o.id === draft.selectedVehicleId)) setSelectedVehicleId(draft.selectedVehicleId);
                        if (draft.startDate && draft.startDate >= startOfToday()) setSelectedStartDate(draft.startDate);
                    }
                }
            } catch (error) {
                console.error('Product not found or error:', error);
            } finally {
                setLoading(false);
            }
        };
        loadProduct();
    }, [id]);

    const pricing = useMemo(() => {
        if (!product) return null;
        try { return { value: resolveBookingPricing(product, totalPeople, selectedAccomId, selectedVehicleId), error: '' }; }
        catch (error) { return { value: null, error: error instanceof Error ? error.message : '상품 가격을 확인해 주세요.' }; }
    }, [product, totalPeople, selectedVehicleId, selectedAccomId]);

    if (loading) return <BookingFallback pc={isDesktop} />;
    if (!product) return <BookingFallback pc={isDesktop} text={t('reservation.messages.not_found')} />;
    if (!pricing?.value) return <BookingFallback pc={isDesktop} text={pricing?.error || '상품 가격을 확인해 주세요.'} action={{ label: '상품으로 돌아가기', onClick: () => navigate(`/products/${product.id}`) }} />;
    const { baseOption, priceBreakdown } = pricing.value;

    // Shared "Next" handler — used by both mobile and desktop CTAs so any
    // future flow change only needs to be made in one place.
    const handleNext = () => {
        if (!selectedStartDate) {
            alert(t('reservation.messages.please_select_date'));
            return;
        }
        saveBookingDraft(product.id, { startDate: selectedStartDate, totalPeople, selectedAccomId, selectedVehicleId });
        navigate('/payment', {
            state: {
                product,
                selectedStartDate,
                totalPeople,
                parsedDuration,
                priceBreakdown,
                selectedAccomId,
                selectedVehicleId,
            },
        });
    };

    // PC and mobile get the same state and handlers; only the layout differs.
    const stepProps: ReservationStepProps = {
        product,
        parsedDuration,
        selectedStartDate,
        setSelectedStartDate,
        totalPeople,
        setTotalPeople,
        selectedAccomId,
        setSelectedAccomId,
        selectedVehicleId,
        setSelectedVehicleId,
        baseOption,
        priceBreakdown,
        onNext: handleNext,
    };

    return (
        <>
            <SEO
                title={`${product.name} - ${t('reservation.title')}`}
                description={`${product.name} 예약 페이지입니다. 원하시는 일정과 인원을 선택해 주세요.`}
            />
            {isDesktop ? <ReservationDesktop {...stepProps} /> : <ReservationMobile {...stepProps} />}
        </>
    );
};
