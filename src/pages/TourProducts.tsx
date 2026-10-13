import React from 'react';
import { useTranslation } from 'react-i18next';
import { SEO } from '../components/seo/SEO';
import { useHomeData } from '../hooks/useHomeData';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { TourListDesktop } from '../components/tours-desktop/TourListDesktop';
import { MobileShell } from '../components/mobile/MobileShell';
import { TourListMobile } from '../components/tours-mobile/TourListMobile';
import { BRAND } from '../constants/company';
import { SEO_CONSTANTS } from '../constants/seo';

const SITE_URL = SEO_CONSTANTS.SITE_URL;

export const TourProducts: React.FC = () => {
    const { t } = useTranslation();
    const isDesktop = useIsDesktop();
    // Same query the list components read, so the structured data costs no extra request.
    const { data } = useHomeData();

    // ====== DESKTOP RENDER ======
    if (isDesktop) {
        return (
            <>
                <SEO
                    title={t('products.seo_title')}
                    description={t('products.seo_description')}
                    keywords={t('products.seo_keywords')}
                    canonical="/products"
                />
                <DesktopLayout>
                    <TourListDesktop />
                </DesktopLayout>
            </>
        );
    }

    const products = data.products.filter((p) => p.status === 'active');

    // ─── Structured Data (JSON-LD) — list page collection schema ───
    const breadcrumbLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: '몽골 투어 상품', item: `${SITE_URL}/products` },
        ],
    };

    const itemListLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '몽골 투어 상품 목록',
        itemListElement: products.slice(0, 30).map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE_URL}/products/${p.id}`,
            name: p.name,
        })),
    };

    const collectionLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `몽골 투어 상품 목록 | ${BRAND.name}`,
        description: t('products.seo_description'),
        url: `${SITE_URL}/products`,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: SITE_URL },
    };

    // ====== MOBILE RENDER ======
    return (
        <>
            <SEO
                title={t('products.seo_title')}
                description={t('products.seo_description')}
                keywords={t('products.seo_keywords')}
                canonical="/products"
                structuredData={[collectionLd, breadcrumbLd, itemListLd]}
            />
            <MobileShell title="투어 상품">
                <TourListMobile />
            </MobileShell>
        </>
    );
};
