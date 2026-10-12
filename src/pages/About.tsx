import React from 'react';
import { SEO } from '../components/seo/SEO';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { AboutDesktop } from '../components/about-desktop/AboutDesktop';
import { AboutMobile } from '../components/about-mobile/AboutMobile';
import { BRAND } from '../constants/company';
import { SEO_CONSTANTS } from '../constants/seo';

const SITE_URL = SEO_CONSTANTS.SITE_URL;

// Social share (og:image) picture: the former full-length company introduction image.
// The page itself is now built from src/assets/about/* (see components/about-desktop).
const DETAIL_IMAGE = '/assets/about/detail.jpg';

export const About: React.FC = () => {
    // <Layout> in App.tsx already supplies the PC / mobile shell; only the content differs here.
    const isDesktop = useIsDesktop();
    const structuredData = [
        {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: `회사 소개 | ${BRAND.name}`,
            url: `${SITE_URL}/about`,
            inLanguage: 'ko',
            mainEntity: {
                '@type': 'TravelAgency',
                name: BRAND.name,
                alternateName: [BRAND.nameEn],
                url: SITE_URL,
                logo: `${SITE_URL}/favicon.png`,
                founder: [
                    { '@type': 'Person', name: 'Bilguun', jobTitle: '대표' },
                    { '@type': 'Person', name: 'Gantuu', jobTitle: '부대표' },
                ],
                employee: [
                    { '@type': 'Person', name: 'Bolor', jobTitle: '여행 디자이너' },
                ],
                areaServed: { '@type': 'Country', name: '몽골' },
                address: {
                    '@type': 'PostalAddress',
                    streetAddress: '바양주르흐구 13동 DACO센터 3층 306호',
                    addressLocality: '울란바토르',
                    addressCountry: 'MN',
                },
            },
        },
        {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
                { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` },
                { '@type': 'ListItem', position: 2, name: '회사 소개', item: `${SITE_URL}/about` },
            ],
        },
    ];

    return (
        <>
            <SEO
                title="회사 소개"
                description="몽골 현지 여행사 '몽골리아 은하수'. 한국에서 호텔경영학과를 졸업하고 몽골에서 살고 있는 대표와 부대표가 설립한 가족 경영 몽골 여행사입니다. 현지인만의 시선과 한국인 여행객의 정서에 맞춘 일정으로, 합리적인 가격에 어디에도 없는 몽골 여행을 선사합니다."
                canonical="/about"
                image={DETAIL_IMAGE}
                structuredData={structuredData}
            />

            {isDesktop ? <AboutDesktop /> : <AboutMobile />}
        </>
    );
};
