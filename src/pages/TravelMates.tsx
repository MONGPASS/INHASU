import React from 'react';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { TravelMatesDesktop } from '../components/mates-desktop/TravelMatesDesktop';
import { TravelMatesMobile } from '../components/mates-mobile/TravelMatesMobile';
import { SEO } from '../components/seo/SEO';
import { SEO_CONSTANTS } from '../constants/seo';

const SITE_URL = SEO_CONSTANTS.SITE_URL;

export const TravelMates: React.FC = () => {
    const isDesktop = useIsDesktop();
    const breadcrumbLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: '동행 찾기', item: `${SITE_URL}/travel-mates` },
        ],
    };

    return (
        <>
            <SEO
                title="몽골 여행 동행 찾기"
                description="몽골 여행을 함께할 동행을 모집하고 찾아볼 수 있습니다. 여행 일정과 지역, 여행 스타일로 나에게 맞는 동행을 찾아보세요."
                canonical="/travel-mates"
                structuredData={breadcrumbLd}
            />
            {isDesktop ? (
            <DesktopLayout>
                <TravelMatesDesktop />
            </DesktopLayout>
            ) : <TravelMatesMobile />}
        </>
    );
};
