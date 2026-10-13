import React, { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { SEO } from '../components/seo/SEO';
import { SEO_CONSTANTS } from '../constants/seo';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { isUsableImage } from '../components/desktop-primitives/mwTokens';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MobileShell } from '../components/mobile/MobileShell';
import { PromotionDetailDesktop } from '../components/promotions/PromotionDetailDesktop';
import { PromotionDetailMobile } from '../components/promotions/PromotionDetailMobile';
import { usePromotionDetail } from '../components/promotions/promotionsData';

const SITE = SEO_CONSTANTS.SITE_URL;

/** 여행 기획전 detail (/promotions/:id): one admin-registered promotion and the tours picked for it. */
export const PromotionDetail: React.FC = () => {
    const { id = '' } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const isDesktop = useIsDesktop();
    const view = usePromotionDetail(id);
    const { promotion, tours, notFound } = view;

    // Opened from a card far down the list: start at the top.
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [id]);

    const path = `/promotions/${encodeURIComponent(id)}`;

    const seo = promotion ? (
        <SEO
            title={`${promotion.title} | 여행 기획전`}
            description={[
                promotion.subtitle,
                tours.length > 0
                    ? `여행 기획전 '${promotion.title}'의 몽골 투어 ${tours.length}건을 소개합니다.`
                    : `여행 기획전 '${promotion.title}' 안내 페이지입니다.`,
            ].filter(Boolean).join(' ')}
            canonical={path}
            url={path}
            image={[promotion.image, tours[0]?.mainImages[0]].find(isUsableImage)}
            structuredData={[
                {
                    '@context': 'https://schema.org',
                    '@type': 'BreadcrumbList',
                    itemListElement: [
                        { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE}/` },
                        { '@type': 'ListItem', position: 2, name: '여행 기획전', item: `${SITE}/promotions` },
                        { '@type': 'ListItem', position: 3, name: promotion.title, item: `${SITE}${path}` },
                    ],
                },
                ...(tours.length > 0
                    ? [{
                        '@context': 'https://schema.org',
                        '@type': 'ItemList',
                        name: promotion.title,
                        itemListElement: tours.slice(0, 30).map((p, i) => ({
                            '@type': 'ListItem',
                            position: i + 1,
                            url: `${SITE}/products/${p.id}`,
                            name: p.name,
                        })),
                    }]
                    : []),
            ]}
        />
    ) : (
        // Loading, or a promotion that no longer exists: nothing for search engines to index yet.
        <SEO title="여행 기획전" canonical={notFound ? '/promotions' : path} robots={notFound ? 'noindex, follow' : undefined} />
    );

    if (isDesktop) {
        return (
            <>
                {seo}
                <DesktopLayout>
                    <PromotionDetailDesktop view={view} />
                </DesktopLayout>
            </>
        );
    }

    // location.key is "default" only on the first entry of this visit, i.e. there is no in-app page to go back to.
    const back = () => (location.key === 'default' ? navigate('/promotions') : navigate(-1));

    return (
        <>
            {seo}
            <MobileShell title="여행 기획전" onBack={back}>
                <PromotionDetailMobile view={view} />
            </MobileShell>
        </>
    );
};
