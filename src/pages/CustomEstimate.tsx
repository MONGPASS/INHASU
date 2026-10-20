import React from 'react';

import { SEO } from '../components/seo/SEO';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { CustomEstimateDesktop } from '../components/estimate-desktop/CustomEstimateDesktop';
import { CustomEstimateMobile } from '../components/estimate-mobile/CustomEstimateMobile';
import { BRAND } from '../constants/company';
import { SEO_CONSTANTS } from '../constants/seo';

// 브랜드 접미(` | 몽골리아 은하수`)는 SEO 컴포넌트가 붙인다.
const TITLE = '몽골 여행 맞춤 견적 요청';
const DESCRIPTION = `인원·일정·가고 싶은 곳만 알려 주시면 몽골 현지 여행사 ${BRAND.name}가 24시간 이내에 맞춤 견적서를 준비해 카카오 알림톡으로 알려 드립니다. Google 로그인 후 무료로 요청하고, 마이페이지에서 견적 확인부터 예약까지 진행하세요.`;
const KEYWORDS = `몽골 여행 견적, 몽골 맞춤 여행, 몽골 투어 견적, 몽골 프라이빗 투어, 몽골 자유여행, 고비사막 투어 견적, 홉스굴 여행 견적, ${BRAND.name}`;
const PAGE_URL = `${SEO_CONSTANTS.SITE_URL}/custom-estimate`;

const STRUCTURED_DATA = [
    {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${TITLE} | ${BRAND.name}`,
        description: DESCRIPTION,
        url: PAGE_URL,
        inLanguage: 'ko-KR',
        isPartOf: { '@type': 'WebSite', name: BRAND.name, alternateName: BRAND.nameEn, url: BRAND.siteUrl },
        mainEntity: {
            '@type': 'Service',
            name: '몽골 맞춤 여행 견적',
            serviceType: '맞춤 여행 견적·일정 설계',
            description: '여행 인원, 일정, 희망 투어 지역, 숙소·차량 등급을 알려 주시면 담당자가 맞춤 일정과 견적서를 만들어 드립니다.',
            areaServed: 'KR',
            provider: { '@type': 'TravelAgency', name: BRAND.name, alternateName: BRAND.nameEn, url: BRAND.siteUrl },
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW', description: '견적 요청 무료' },
        },
    },
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: '홈', item: `${SEO_CONSTANTS.SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: '맞춤 견적', item: PAGE_URL },
        ],
    },
];

/** 맞춤 견적 요청(`/custom-estimate`). 접수된 요청은 견적 시스템(`POST /api/requests`)으로 들어간다. */
export const CustomEstimate: React.FC = () => {
    const isDesktop = useIsDesktop();
    return (
        <>
            <SEO title={TITLE} description={DESCRIPTION} keywords={KEYWORDS} canonical="/custom-estimate" structuredData={STRUCTURED_DATA} />
            {isDesktop ? (
                <DesktopLayout>
                    <CustomEstimateDesktop />
                </DesktopLayout>
            ) : (
                <CustomEstimateMobile />
            )}
        </>
    );
};
