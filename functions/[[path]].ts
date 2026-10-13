import { drizzle } from 'drizzle-orm/d1';
import { products } from '../src/db/schema/products';

import { eq } from 'drizzle-orm';
import { SEO_CONSTANTS } from '../src/constants/seo';

interface Env {
    DB: D1Database;
}

// Helper to construct absolute image URLs
const getAbsoluteImageUrl = (url: string) => {
    if (!url) return `${SEO_CONSTANTS.SITE_URL}${SEO_CONSTANTS.OG_IMAGE}`;
    if (url.startsWith('http')) return url;
    return `${SEO_CONSTANTS.SITE_URL}${url.startsWith('/') ? url : `/${url}`}`;
};

// 301 redirects from legacy hand-coded SEO pages.
// Targets must exist (verify before adding). For `/category/...` targets the admin-managed
// category row must have a matching id; use the slug editor in the admin panel if not.
const LEGACY_REDIRECTS: Record<string, string> = {
    '/gobi-desert': '/category/gobi-desert',
    '/horse-riding-tour': '/category/horse-riding-tour',
    '/mongol-travel': '/travel-guide',
    '/mongol-tour': '/products',
};

// Per-page SEO configurations for static routes
const STATIC_PAGE_META: Record<string, { title: string; description: string }> = {
    '/products': {
        title: '몽골 투어 상품 목록 | 몽골리아 은하수',
        description: '몽골 승마 여행, 고비사막 투어, 테를지 국립공원, 홉스굴 호수 등 지역·테마별로 몽골 투어를 찾아보세요. 한국어 가이드가 동행해 안심할 수 있습니다.'
    },
    '/travel-guide': {
        title: '몽골 여행 가이드 | 몽골리아 은하수',
        description: '몽골의 대자연, 유목 문화, 추천 명소, 준비물 목록 등 몽골 여행 전에 알아 두면 좋은 정보를 한데 모아 소개합니다.'
    },
    '/faq': {
        title: '자주 묻는 질문(FAQ) | 몽골리아 은하수',
        description: '몽골 여행에 관한 자주 묻는 질문과 답변. 예약 방법, 투어 내용, 준비물, 비자, 결제·취소 등 몽골 투어의 궁금증을 풀어 드립니다.'
    },
    '/reviews': {
        title: '고객의 몽골 여행 후기 | 몽골리아 은하수',
        description: '몽골 투어에 참가한 고객의 생생한 여행 후기. 실제 체험담을 투어 선택에 참고해 보세요.'
    },
    '/custom-estimate': {
        title: '맞춤 견적 | 몽골리아 은하수',
        description: '고객의 요청에 맞춘 몽골 투어 맞춤 플랜을 제안해 드립니다. 일정·인원·가고 싶은 곳을 알려 주시면 견적서를 보내 드립니다.'
    },
    '/travel-mates': {
        title: '동행 찾기 | 몽골리아 은하수',
        description: '몽골 여행 동행을 모집하고 찾아보세요. 혼자 떠나기 망설여지는 분도 동행을 만나 몽골 투어를 함께 즐길 수 있습니다.'
    },
    '/promotions': {
        title: '여행 기획전 | 몽골 여행 특집·캠페인 | 몽골리아 은하수',
        description: '몽골 여행 특집과 캠페인을 한데 모아 소개합니다. 고비사막·승마·중앙 몽골 등 테마별 몽골 투어 특집에서 골라 보세요.'
    },
    '/booking-flow': {
        title: '예약 안내 | 몽골리아 은하수',
        description: '몽골 여행·몽골 투어의 예약 절차를 안내합니다. 투어 선택과 무료 견적부터 예약금 입금, 출발까지의 순서를 정리했습니다.'
    },
    '/contact': {
        title: '문의 | 몽골리아 은하수',
        description: '몽골리아 은하수(몽골 여행·몽골 투어 전문 현지 여행사) 문의. 예약·결제·투어 내용에 관한 질문을 한국어로 답변해 드립니다.'
    },
    '/terms-of-service': {
        title: '이용약관 | 몽골리아 은하수',
        description: '몽골리아 은하수의 이용약관입니다.'
    },
    '/privacy-policy': {
        title: '개인정보처리방침 | 몽골리아 은하수',
        description: '몽골리아 은하수의 개인정보처리방침입니다.'
    },
    '/about': {
        title: '회사 소개 – 몽골 현지 여행사 | 몽골리아 은하수',
        description: "몽골 현지 여행사 '몽골리아 은하수'. 한국에서 호텔경영학과를 졸업하고 몽골에서 생활하는 대표와 부대표가 설립한 가족 경영 여행사입니다. 한국인 여행객에 맞춘 일정과 합리적인 가격으로 어디에도 없는 몽골 여행을 제안합니다."
    }
};

/** 루트 바로 아래의 한글 이름 문서 = 견적 시스템 정적 페이지 (public/*.html) */
const isQuoteStaticPage = (pathname: string): boolean => {
    let decoded = pathname;
    try { decoded = decodeURIComponent(pathname); } catch { /* 잘못된 인코딩은 원문으로 판정 */ }
    return /^\/[^/]*[가-힣][^/]*$/.test(decoded);
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    const url = new URL(context.request.url);
    const path = url.pathname;

    // Legacy Redirects
    if (path.startsWith('/shop_view') || url.searchParams.has('idx')) {
        return Response.redirect(`${SEO_CONSTANTS.SITE_URL}/products`, 301);
    }
    if (LEGACY_REDIRECTS[path]) {
        return Response.redirect(`${SEO_CONSTANTS.SITE_URL}${LEGACY_REDIRECTS[path]}`, 301);
    }

    // 견적 시스템의 정적 페이지(/견적서.html, /내견적 등 한글 파일명)는 자체 메타태그를 가진
    // 독립 문서라 SPA용 메타 주입을 하지 않고 그대로 내보낸다.
    if (isQuoteStaticPage(path)) {
        return context.next();
    }

    // 1. Get the original response from the asset (usually index.html for unknown routes in an SPA)
    const response = await context.next();

    // Only process responses that are HTML. We don't want to rewrite assets, images, API JSON, etc.
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
        return response;
    }


    let pageTitle = SEO_CONSTANTS.TITLE;
    let pageDescription = SEO_CONSTANTS.DESCRIPTION;
    let pageImage = getAbsoluteImageUrl(SEO_CONSTANTS.OG_IMAGE);
    const pageUrl = url.href;
    const canonicalUrl = `${SEO_CONSTANTS.SITE_URL}${path === '/' ? '/' : path.replace(/\/$/, '')}`;

    // Server-rendered JSON-LD blocks. These are appended inside <head> so that crawlers
    // that do NOT execute JavaScript (LINE, Kakao, Facebook, some Rich Results previewers)
    // can still see structured data. React's react-helmet still injects its own blocks
    // client-side — schema.org allows multiple valid JSON-LD scripts on one page.
    const extraJsonLd: string[] = [];

    // Check static routes first
    const normalizedPath = path.replace(/\/$/, '') || '/';
    if (STATIC_PAGE_META[normalizedPath]) {
        pageTitle = STATIC_PAGE_META[normalizedPath].title;
        pageDescription = STATIC_PAGE_META[normalizedPath].description;
    }

    try {
        const db = drizzle(context.env.DB);

        // --- Logic for Products ---
        const productMatch = path.match(/^\/products\/([^/]+)$/);
        if (productMatch) {
            const productId = productMatch[1];
            const productArr = await db.select().from(products).where(eq(products.id, productId)).limit(1);
            if (productArr.length > 0) {
                const product = productArr[0];
                pageTitle = `${product.name} | 몽골리아 은하수`;
                pageDescription = product.description || SEO_CONSTANTS.DESCRIPTION;

                // Parse images if stored as stringified JSON
                let images: string[] = [];
                try {
                    images = typeof product.mainImages === 'string' ? JSON.parse(product.mainImages) : (product.mainImages || []);
                } catch (e) { }
                const absoluteImages = (Array.isArray(images) ? images : [])
                    .filter((img: string) => img && !img.startsWith('data:'))
                    .map((img: string) => getAbsoluteImageUrl(img));

                if (absoluteImages.length > 0) {
                    pageImage = absoluteImages[0];
                }

                // Build Product + BreadcrumbList JSON-LD on the server so crawlers that
                // don't run JS still see structured data (LINE, Kakao, FB, some previewers).
                const priceValidUntil = new Date(new Date().setFullYear(new Date().getFullYear() + 1))
                    .toISOString().split('T')[0];

                const productLd: any = {
                    '@context': 'https://schema.org/',
                    '@type': ['Product', 'TouristTrip'],
                    name: product.name,
                    image: absoluteImages.length > 0 ? absoluteImages : undefined,
                    description: product.description || SEO_CONSTANTS.DESCRIPTION,
                    brand: { '@type': 'Brand', name: '몽골리아 은하수' },
                    category: product.category || '몽골 투어',
                    touristType: product.category || '몽골 투어',
                    ...(product.duration ? {
                        additionalProperty: [
                            { '@type': 'PropertyValue', name: '소요 시간', value: product.duration }
                        ]
                    } : {}),
                    offers: {
                        '@type': 'Offer',
                        url: pageUrl,
                        priceCurrency: 'KRW',
                        price: product.price,
                        priceValidUntil: priceValidUntil,
                        itemCondition: 'https://schema.org/NewCondition',
                        availability: product.status === 'active'
                            ? 'https://schema.org/InStock'
                            : 'https://schema.org/OutOfStock',
                        seller: { '@type': 'Organization', name: '몽골리아 은하수' },
                        // Tour bookings are digital — no shipping is required. Declaring a
                        // free, zero-delay shipping policy satisfies Google's Merchant Listing
                        // requirement and avoids the "shippingDetails missing" warning.
                        shippingDetails: {
                            '@type': 'OfferShippingDetails',
                            shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'KRW' },
                            shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'KR' },
                            deliveryTime: {
                                '@type': 'ShippingDeliveryTime',
                                handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
                                transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 0, unitCode: 'DAY' },
                            },
                        },
                        // The deposit is non-refundable (it prepays the hotels and camps), so the policy
                        // is "not permitted"; declaring a policy is what satisfies Google's requirement.
                        hasMerchantReturnPolicy: {
                            '@type': 'MerchantReturnPolicy',
                            applicableCountry: 'KR',
                            returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
                        },
                    },
                };
                extraJsonLd.push(JSON.stringify(productLd));

                const breadcrumbLd = {
                    '@context': 'https://schema.org',
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: '홈', item: `${SEO_CONSTANTS.SITE_URL}/` },
                        { '@type': 'ListItem', position: 2, name: '몽골 투어 상품', item: `${SEO_CONSTANTS.SITE_URL}/products` },
                        { '@type': 'ListItem', position: 3, name: product.name, item: canonicalUrl },
                    ],
                };
                extraJsonLd.push(JSON.stringify(breadcrumbLd));
            }
        }
        // --- Logic for Travel Guides (Magazines) ---
        else {
            const guideMatch = path.match(/^\/travel-guide\/([^/]+)$/);
            if (guideMatch) {
                const guideId = guideMatch[1];
                try {
                    // Fetch magazine using raw D1 prepare as Drizzle schema limits import
                    const guide = await context.env.DB.prepare("SELECT * FROM magazines WHERE id = ?").bind(guideId).first();
                    if (guide) {
                        pageTitle = `${guide.title} | 몽골리아 은하수 여행 가이드`;
                        pageDescription = (guide.subtitle || guide.description || SEO_CONSTANTS.DESCRIPTION) as string;

                        const imageStr = (guide.thumbnail || guide.image) as string;
                        const absoluteGuideImage = imageStr ? getAbsoluteImageUrl(imageStr) : pageImage;
                        if (imageStr) {
                            pageImage = absoluteGuideImage;
                        }

                        const articleLd = {
                            '@context': 'https://schema.org',
                            '@type': 'BlogPosting',
                            headline: guide.title,
                            description: pageDescription,
                            image: [absoluteGuideImage],
                            datePublished: guide.created_at,
                            dateModified: guide.updated_at || guide.created_at,
                            author: {
                                '@type': guide.author ? 'Person' : 'Organization',
                                name: guide.author || '몽골리아 은하수',
                            },
                            publisher: {
                                '@type': 'Organization',
                                name: '몽골리아 은하수',
                                logo: {
                                    '@type': 'ImageObject',
                                    url: `${SEO_CONSTANTS.SITE_URL}/favicon.png`,
                                },
                            },
                            mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
                            articleSection: guide.category || undefined,
                            inLanguage: 'ko',
                        };
                        extraJsonLd.push(JSON.stringify(articleLd));

                        const breadcrumbLd = {
                            '@context': 'https://schema.org',
                            '@type': 'BreadcrumbList',
                            itemListElement: [
                                { '@type': 'ListItem', position: 1, name: '홈', item: `${SEO_CONSTANTS.SITE_URL}/` },
                                { '@type': 'ListItem', position: 2, name: '여행 가이드', item: `${SEO_CONSTANTS.SITE_URL}/travel-guide` },
                                { '@type': 'ListItem', position: 3, name: guide.title, item: canonicalUrl },
                            ],
                        };
                        extraJsonLd.push(JSON.stringify(breadcrumbLd));
                    }
                } catch (e) {
                    console.log("Guide meta fetch skipped/failed:", e);
                }
            }
        }

    } catch (error) {
        console.error("Meta injection DB error:", error);
        // On error, we just fallback to default meta tags (do not block the user response)
    }

    // 2. Use HTMLRewriter to update existing tags in-place.
    //    Crawlers (LINE, Facebook, Twitter) read the FIRST occurrence,
    //    so we must replace — not append — the tags already in index.html.
    const escape = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    return new HTMLRewriter()
        .on('title', {
            element(el) { el.setInnerContent(pageTitle); }
        })
        .on('meta[name="description"]', {
            element(el) { el.setAttribute('content', pageDescription); }
        })
        .on('link[rel="canonical"]', {
            element(el) { el.setAttribute('href', canonicalUrl); }
        })
        // Open Graph — replace existing tags in index.html
        .on('meta[property="og:title"]', {
            element(el) { el.setAttribute('content', escape(pageTitle)); }
        })
        .on('meta[property="og:description"]', {
            element(el) { el.setAttribute('content', escape(pageDescription)); }
        })
        .on('meta[property="og:image"]', {
            element(el) { el.setAttribute('content', pageImage); }
        })
        .on('meta[property="og:url"]', {
            element(el) { el.setAttribute('content', pageUrl); }
        })
        // Twitter Card — replace existing tags
        .on('meta[name="twitter:title"]', {
            element(el) { el.setAttribute('content', escape(pageTitle)); }
        })
        .on('meta[name="twitter:description"]', {
            element(el) { el.setAttribute('content', escape(pageDescription)); }
        })
        .on('meta[name="twitter:image"]', {
            element(el) { el.setAttribute('content', pageImage); }
        })
        // Append server-rendered JSON-LD blocks inside <head> so crawlers without JS see them.
        // Escape `</script>` inside payloads (JSON.stringify leaves forward slashes raw).
        .on('head', {
            element(el) {
                for (const ld of extraJsonLd) {
                    const safe = ld.replace(/<\/script>/gi, '<\\/script>');
                    el.append(`<script type="application/ld+json">${safe}</script>`, { html: true });
                }
            }
        })
        .transform(response);
};

