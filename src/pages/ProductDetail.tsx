import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { SEO } from '../components/seo/SEO';
import { useToast } from '../components/ui/Toast';
import { useTranslation } from 'react-i18next';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MW } from '../components/desktop-primitives/mwTokens';
import { BRAND } from '../constants/company';
import { SEO_CONSTANTS } from '../constants/seo';
import { MobileShell } from '../components/mobile/MobileShell';
import { MEmpty } from '../components/mobile/mobileUi';
import { ProductDetailDesktop, ProductDetailDesktopSkeleton } from '../components/product-desktop/ProductDetailDesktop';
import { getProductStartingPrice } from '../utils/productStartingPrice';
import { productPriceLabel, productPriceBasis, withPublicProductPrice } from '../utils/publicProductPrice';
import { ProductDetailMobile, ProductDetailMobileSkeleton } from '../components/product-mobile/ProductDetailMobile';
import type { ShareResult } from '../components/product/detail/productDetailData';
import type { RawReview } from '../components/reviews-desktop/reviewsData';

import type { TourProduct } from '../types/product';

const MOBILE_TITLE = '투어 상세';
const SITE_URL = SEO_CONSTANTS.SITE_URL;

/** Review row as returned by /api/reviews (fields the structured data reads on top of the shared shape). */
interface ReviewRow extends RawReview {
    is_approved?: number | boolean;
    author_name?: string;
}

/**
 * Tour detail page: loads the tour + its reviews, owns the SEO / structured data, share and
 * recently-viewed tracking, then hands over to the PC or mobile screen
 * (components/product-desktop, components/product-mobile).
 */
export const ProductDetail: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { t } = useTranslation();
    const { showToast } = useToast();
    const isDesktop = useIsDesktop();
    const [isLoading, setIsLoading] = useState(true);
    const [product, setProduct] = useState<TourProduct | null>(null);
    const [productReviews, setProductReviews] = useState<ReviewRow[]>([]);

    useEffect(() => {
        const fetchProduct = async () => {
            if (!id) return;
            setIsLoading(true);

            try {
                const data = await api.products.get(id);
                if (data) {
                    const mappedProduct: TourProduct = {
                        id: data.id,
                        name: data.name,
                        price: data.price,
                        originalPrice: undefined,
                        duration: data.duration,
                        category: data.category,
                        mainImages: data.mainImages ?? data.main_images ?? [],
                        galleryImages: data.galleryImages ?? data.gallery_images ?? [],
                        detailImages: data.detailImages ?? data.detail_images ?? [],
                        itineraryImages: data.itineraryImages ?? data.itinerary_images ?? [],
                        detailSlides: data.detailSlides ?? data.detail_slides ?? [],
                        detailBlocks: data.detailBlocks ?? data.detail_blocks ?? [],
                        itineraryBlocks: data.itineraryBlocks ?? data.itinerary_blocks ?? [],
                        tags: data.tags ?? [],
                        included: data.included ?? [],
                        excluded: data.excluded ?? [],
                        highlights: data.highlights ?? [],
                        pricingOptions: Array.isArray(data.pricingOptions ?? data.pricing_options) ? (data.pricingOptions ?? data.pricing_options) : (typeof (data.pricingOptions ?? data.pricing_options) === 'string' ? JSON.parse(data.pricingOptions ?? data.pricing_options) : []),
                        accommodationOptions: Array.isArray(data.accommodationOptions ?? data.accommodation_options) ? (data.accommodationOptions ?? data.accommodation_options) : (typeof (data.accommodationOptions ?? data.accommodation_options) === 'string' ? JSON.parse(data.accommodationOptions ?? data.accommodation_options) : []),
                        vehicleOptions: Array.isArray(data.vehicleOptions ?? data.vehicle_options) ? (data.vehicleOptions ?? data.vehicle_options) : (typeof (data.vehicleOptions ?? data.vehicle_options) === 'string' ? JSON.parse(data.vehicleOptions ?? data.vehicle_options) : []),
                        isFeatured: data.isFeatured ?? data.is_featured ?? false,
                        isPopular: data.isPopular ?? data.is_popular ?? false,
                        // 풀패키지 / 실속형 badge and the tour's own FAQ (both already returned by /api/products/:id).
                        packageType: data.packageType === 'full' || data.packageType === 'value' ? data.packageType : null,
                        faqs: Array.isArray(data.faqs) ? data.faqs : [],
                        description: data.description,
                        status: data.status,
                        viewCount: data.viewCount ?? data.view_count ?? 0,
                        bookingCount: data.bookingCount ?? data.booking_count ?? 0,
                        createdAt: data.createdAt ?? data.created_at,
                        updatedAt: data.updatedAt ?? data.updated_at
                    };
                    const pricedProduct = withPublicProductPrice(mappedProduct);
                    setProduct(pricedProduct);
                    addToRecentlyViewed(pricedProduct);
                }
            } catch (error) {
                console.error("Product fetch error:", error);
            }
            setIsLoading(false);
        };

        const addToRecentlyViewed = async (product: TourProduct) => {
            try {
                const me = await api.auth.me();
                if (!me) return;
                await api.recentlyViewed.upsert({
                    product_id: product.id,
                    title: product.name,
                    image: product.mainImages[0],
                    price: product.price,
                    type: 'product'
                });
            } catch {
                // Silently fail for non-logged in users
            }
        };

        const fetchReviews = async () => {
            if (!id) return;
            try {
                const list = await api.reviews.listForProduct(id, true);
                if (Array.isArray(list)) setProductReviews(list);
            } catch {
                // Reviews are optional for rendering — silently ignore.
            }
        };

        fetchProduct();
        fetchReviews();
    }, [id]);

    const handleShare = async (): Promise<ShareResult> => {
        const shareUrl = window.location.href;
        const shareTitle = product?.name ? `${product.name} | ${BRAND.name}` : BRAND.name;
        const shareText = product?.description || product?.name || '';

        // Prefer native share sheet on mobile; silently ignore AbortError when user cancels.
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
                await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
                return 'shared';
            } catch (err) {
                if ((err as { name?: string } | null)?.name === 'AbortError') return null; // user dismissed — nothing to do
                // Fall through to clipboard fallback on other errors.
            }
        }

        // Clipboard fallback
        try {
            await navigator.clipboard.writeText(shareUrl);
            showToast('success', t('product_detail.share_copied'));
            return 'copied';
        } catch {
            // Last-resort manual prompt
            window.prompt(t('product_detail.share_prompt'), shareUrl);
            return null;
        }
    };

    if (isLoading) {
        return isDesktop ? (
            <DesktopLayout>
                <ProductDetailDesktopSkeleton />
            </DesktopLayout>
        ) : (
            <MobileShell title={MOBILE_TITLE}>
                <ProductDetailMobileSkeleton />
            </MobileShell>
        );
    }

    if (!product) {
        const toList = () => navigate('/products');
        return isDesktop ? (
            <DesktopLayout>
                <section style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px 160px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
                    <p style={{ margin: 0, fontSize: 16, color: MW.mute }}>{t('product_detail.error_not_found')}</p>
                    <button type="button" onClick={toList} style={{ height: 48, padding: '0 24px', border: 0, borderRadius: 999, background: MW.mint, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}>
                        투어 목록으로
                    </button>
                </section>
            </DesktopLayout>
        ) : (
            <MobileShell title={MOBILE_TITLE}>
                <div style={{ padding: '24px 16px 36px' }}>
                    <MEmpty text={t('product_detail.error_not_found')} action={{ label: '투어 목록으로', onClick: toList }} />
                </div>
            </MobileShell>
        );
    }

    const safeMainImages = Array.isArray(product.mainImages) ? product.mainImages : [];

    // Pre-process images for JSON-LD (exclude data URIs as Google prefers absolute URLs)
    const validImages = safeMainImages
        .filter(img => !img.startsWith('data:'))
        .map(img => new URL(img, `${SITE_URL}/`).href);

    // Enhanced Product description for meta
    const startingPrice = getProductStartingPrice(product);
    const productMetaDescription = [
        product.name,
        product.duration ? `(${product.duration})` : '',
        product.category ? `[${product.category}]` : '',
        productPriceLabel(product), productPriceBasis(product),
        product.description || product.highlights?.[0]?.description || '',
    ].filter(Boolean).join(' ').substring(0, 160);

    // ── Aggregate rating + sample reviews from approved user reviews ──
    const approvedReviews = productReviews.filter((r: any) =>
        (r.is_approved === 1 || r.is_approved === true) && Number(r.rating) >= 1 && Number(r.rating) <= 5
    );
    const ratingSum = approvedReviews.reduce((sum: number, r: any) => sum + (Number(r.rating) || 0), 0);
    const avgRating = approvedReviews.length > 0 ? Number((ratingSum / approvedReviews.length).toFixed(1)) : 0;
    // Google requires a minimum to show rich rating snippets; be conservative.
    const aggregateRating = approvedReviews.length >= 1 ? {
        "@type": "AggregateRating",
        "ratingValue": avgRating,
        "reviewCount": approvedReviews.length,
        "bestRating": 5,
        "worstRating": 1,
    } : undefined;

    // Up to 5 most recent reviews embedded as Review nodes
    const reviewLd = approvedReviews.slice(0, 5).map((r: any) => ({
        "@type": "Review",
        "author": { "@type": "Person", "name": r.user_name || r.author_name || '익명' },
        "datePublished": r.created_at ? String(r.created_at).split(' ')[0] : undefined,
        "reviewRating": { "@type": "Rating", "ratingValue": Number(r.rating), "bestRating": 5, "worstRating": 1 },
        "reviewBody": r.content || r.title || '',
        "name": r.title || undefined,
    }));

    const availability = product.status === 'active' ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
    // Only the actual displayed tour price and availability belong in an offer.
    const offersLd = {
        "@type": "Offer",
        "url": `${SITE_URL}/products/${encodeURIComponent(id || product.id)}`,
        "priceCurrency": "KRW",
        "price": startingPrice.price,
        "description": startingPrice.people ? `${startingPrice.people}명 기준 · 1인 기본요금` : undefined,
        "availability": availability,
        "seller": { "@type": "Organization", "name": BRAND.name },
    };

    // Create JSON-LD Product Schema (enhanced) — dual-typed for travel rich results.
    const productStructuredData: any = {
        "@context": "https://schema.org/",
        "@type": ["Product", "TouristTrip"],
        "name": product.name,
        "image": validImages.length > 0 ? validImages : undefined,
        "description": (product.included && product.included.length > 0)
            ? `${product.description || ''} 투어 포함 사항: ${product.included.join(', ')}`
            : (product.description || product.highlights?.[0]?.description || t('product_detail.header_title')),
        "brand": { "@type": "Brand", "name": BRAND.name },
        "category": product.category || "몽골 투어",
        "touristType": product.category || "몽골 투어",
        ...(product.duration ? { "additionalProperty": [
            { "@type": "PropertyValue", "name": "소요 기간", "value": product.duration }
        ]} : {}),
        ...(startingPrice.price !== null ? { "offers": offersLd } : {}),
        ...(aggregateRating ? { "aggregateRating": aggregateRating } : {}),
        ...(reviewLd.length > 0 ? { "review": reviewLd } : {}),
    };

    // BreadcrumbList for navigation context
    const breadcrumbData = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            { "@type": "ListItem", "position": 1, "name": "홈", "item": `${SITE_URL}/` },
            { "@type": "ListItem", "position": 2, "name": "몽골 투어 상품", "item": `${SITE_URL}/products` },
            { "@type": "ListItem", "position": 3, "name": product.name, "item": `${SITE_URL}/products/${id}` }
        ]
    };

    const seo = (
        <SEO
            title={product.name}
            description={productMetaDescription}
            image={product.mainImages?.find(img => !img.startsWith('data:'))}
            keywords={`${product.category}, ${product.tags.join(', ')}, 몽골 투어, 몽골 여행`}
            canonical={`/products/${id}`}
            structuredData={[productStructuredData, breadcrumbData]}
        />
    );
    const onBook = () => {
        if (startingPrice.price === null) { showToast('error', '요금 등록이 필요합니다. 상담으로 문의해 주세요.'); return; }
        navigate(`/reservation/${product.id}`);
    };

    // Keyed by tour so headcount, open rows and scroll position reset when moving to another tour.
    if (isDesktop) {
        return (
            <>
                {seo}
                <DesktopLayout>
                    <ProductDetailDesktop key={product.id} product={product} reviews={approvedReviews} onBook={onBook} onShare={handleShare} />
                </DesktopLayout>
            </>
        );
    }

    return (
        <>
            {seo}
            <ProductDetailMobile key={product.id} product={product} reviews={approvedReviews} onBook={onBook} onShare={handleShare} />
        </>
    );
};
