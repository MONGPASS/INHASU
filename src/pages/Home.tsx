import React from 'react';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/seo/SEO';
import { useHomeData } from '../hooks/useHomeData';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { HomeDesktop } from '../components/home-desktop/HomeDesktop';
import { HomeMobile } from '../components/home-mobile/HomeMobile';
import { BRAND, COMPANY_INFO } from '../constants/company';
import { SEO_CONSTANTS } from '../constants/seo';

const SITE_URL = SEO_CONSTANTS.SITE_URL;

export const Home: React.FC = () => {
    const { data, isLoading } = useHomeData();
    const { t } = useTranslation();
    const isDesktop = useIsDesktop();

    const seo = (
        <SEO
            title={t('home.seo_title')}
            description={t('home.seo_description')}
            keywords={t('home.seo_keywords')}
            canonical="/"
            structuredData={[
                {
                    "@context": "https://schema.org",
                    "@type": "TravelAgency",
                    "@id": `${SITE_URL}/#organization`,
                    "name": BRAND.name,
                    "alternateName": BRAND.nameEn,
                    "image": `${SITE_URL}${SEO_CONSTANTS.OG_IMAGE}`,
                    "url": SITE_URL,
                    "email": COMPANY_INFO.email,
                    "address": {
                        "@type": "PostalAddress",
                        "addressCountry": "MN",
                        "addressLocality": "Ulaanbaatar"
                    },
                    "description": t('home.seo_description'),
                    "priceRange": "₩₩",
                    "areaServed": "KR",
                    "knowsLanguage": ["ko", "mn"],
                    "sameAs": []
                },
                {
                    "@context": "https://schema.org",
                    "@type": "WebSite",
                    "@id": `${SITE_URL}/#website`,
                    "url": SITE_URL,
                    "name": `${BRAND.name} | ${BRAND.tagline}`,
                    "alternateName": BRAND.nameEn,
                    "publisher": { "@id": `${SITE_URL}/#organization` },
                    "inLanguage": "ko",
                    "potentialAction": {
                        "@type": "SearchAction",
                        "target": {
                            "@type": "EntryPoint",
                            "urlTemplate": `${SITE_URL}/products?q={search_term_string}`
                        },
                        "query-input": "required name=search_term_string"
                    }
                }
            ]}
        />
    );

    // ====== DESKTOP RENDER ======
    if (isDesktop) {
        return (
            <>
                {seo}
                <HomeDesktop data={data} isLoading={isLoading} />
            </>
        );
    }

    // ====== MOBILE RENDER ======
    return (
        <>
            {seo}

            {/* SEO: H1 + Intro (Visually hidden but available for crawlers and screen readers) */}
            <section className="sr-only">
                <h1>몽골 투어·몽골 여행 전문 현지 여행사</h1>
                <p>
                    몽골리아 은하수는 한국어 가이드가 동행하는 안심 몽골 투어를 안내합니다. 승마 여행, 고비사막, 테를지 국립공원 등 다양한 일정을 준비했습니다.
                </p>
            </section>

            <HomeMobile data={data} isLoading={isLoading} />
        </>
    );
};
