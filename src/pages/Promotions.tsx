import React from 'react';
import { SEO } from '../components/seo/SEO';
import { SEO_CONSTANTS } from '../constants/seo';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MobileShell } from '../components/mobile/MobileShell';
import { PromotionsDesktop } from '../components/promotions/PromotionsDesktop';
import { PromotionsMobile } from '../components/promotions/PromotionsMobile';

const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: `${SEO_CONSTANTS.SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: '여행 기획전', item: `${SEO_CONSTANTS.SITE_URL}/promotions` },
    ],
};

export const Promotions: React.FC = () => {
    const isDesktop = useIsDesktop();

    const seo = (
        <SEO
            title="여행 기획전 | 몽골 여행 특집·프로모션"
            description="몽골 여행 특집과 프로모션을 한곳에 모았습니다. 고비사막·승마·중앙 몽골 등 테마별 몽골 투어 기획전에서 골라 보세요."
            canonical="/promotions"
            structuredData={breadcrumbLd}
        />
    );

    if (isDesktop) {
        return (
            <>
                {seo}
                <DesktopLayout>
                    <PromotionsDesktop />
                </DesktopLayout>
            </>
        );
    }

    return (
        <>
            {seo}
            <MobileShell title="여행 기획전">
                <PromotionsMobile />
            </MobileShell>
        </>
    );
};
