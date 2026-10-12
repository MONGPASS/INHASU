import React from 'react';
import { SEO } from '../components/seo/SEO';
import { SEO_CONSTANTS } from '../constants/seo';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { InfoLayoutDesktop } from '../components/info/InfoLayoutDesktop';
import { InfoLayoutMobile } from '../components/info/InfoLayoutMobile';
import { BookingFlowBody } from '../components/info/BookingFlowBody';
import { BOOKING_FLOW_STEPS } from '../components/info/bookingFlow';

const PAGE_URL = `${SEO_CONSTANTS.SITE_URL}/booking-flow`;

const structuredData = [
    {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: '홈', item: `${SEO_CONSTANTS.SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: '예약 안내', item: PAGE_URL },
        ],
    },
    {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: '몽골 여행·몽골 투어 예약 안내',
        description: '투어 선택·견적 요청부터 예약금 입금(계좌이체), 출발 전 안내, 출발까지의 절차입니다.',
        inLanguage: 'ko',
        url: PAGE_URL,
        step: BOOKING_FLOW_STEPS.map((s, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: s.title,
            text: s.text,
        })),
    },
];

export const BookingFlow: React.FC = () => {
    const isDesktop = useIsDesktop();
    const seo = (
        <SEO
            title="예약 안내"
            description="몽골 여행·몽골 투어 예약 절차를 안내합니다. 투어 선택·무료 견적부터 계좌이체를 통한 예약금 입금, 출발 전 안내, 출발까지 5단계로 설명해 드립니다."
            canonical="/booking-flow"
            structuredData={structuredData}
        />
    );

    if (isDesktop) {
        return (
            <>
                {seo}
                <InfoLayoutDesktop page="bookingFlow">
                    <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 20 }}>
                        <BookingFlowBody />
                    </div>
                </InfoLayoutDesktop>
            </>
        );
    }

    return (
        <>
            {seo}
            <InfoLayoutMobile page="bookingFlow">
                <BookingFlowBody compact />
            </InfoLayoutMobile>
        </>
    );
};
