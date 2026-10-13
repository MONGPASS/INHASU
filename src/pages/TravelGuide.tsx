
import React, { useState, useEffect } from 'react';
import { api } from '../lib/api'; 
import { SEO } from '../components/seo/SEO';
import { useTranslation } from 'react-i18next';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { DesktopLayout } from '../components/layout-desktop/DesktopLayout';
import { MagazineListDesktop } from '../components/magazine-desktop/MagazineListDesktop';
import { MobileShell } from '../components/mobile/MobileShell';
import { MagazineListMobile } from '../components/magazine-mobile/MagazineListMobile';
import { BRAND } from '../constants/company';
import { SEO_CONSTANTS, isPublishedMagazine } from '../constants/seo';

const SITE_URL = SEO_CONSTANTS.SITE_URL;

interface Magazine {
    id: string;
    title: string;
    description: string;
    content: string;
    category: string;
    image: string;
    tag?: string;
    isFeatured: boolean;
    isActive: boolean;
    order: number;
}

/** Rows as returned by /api/categories and /api/magazines (snake_case). */
interface RawCategory {
    name: string;
    type?: string;
    is_active?: boolean | number | null;
    order?: number;
}

interface RawMagazine {
    id: string;
    title: string;
    subtitle?: string;
    description?: string;
    content: string;
    category: string;
    thumbnail?: string;
    image?: string;
    tag?: string;
    is_featured: boolean;
    is_active: boolean;
    is_published?: boolean | number;
    order: number;
}

export const TravelGuide: React.FC = () => {
    const { t } = useTranslation();
    const isDesktop = useIsDesktop();
    const [magazineCategories, setMagazineCategories] = useState<string[]>([]);
    const [magazines, setMagazines] = useState<Magazine[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            // Fetch magazine categories
            try {
                const catData = await api.categories.list('magazine');
                if (Array.isArray(catData)) {
                    const magazineCats = catData
                        .filter((c: RawCategory) => c.type === 'magazine' && (c.is_active ?? true))
                        .sort((a: RawCategory, b: RawCategory) => (a.order || 0) - (b.order || 0))
                        .map((c: RawCategory) => c.name);
                    setMagazineCategories(magazineCats);
                }

                // Fetch magazines
                const magData = await api.magazines.list();
                if (Array.isArray(magData)) {
                    setMagazines(magData
                        .filter(isPublishedMagazine)
                        .sort((a: RawMagazine, b: RawMagazine) => (a.order || 0) - (b.order || 0))
                        .map((m: RawMagazine) => ({
                            id: m.id,
                            title: m.title,
                            description: m.subtitle || m.description || '',
                            content: m.content,
                            category: m.category,
                            image: m.thumbnail || m.image || '',
                            tag: m.tag,
                            isFeatured: m.is_featured,
                            isActive: m.is_active,
                            order: m.order
                        }))
                    );
                }
            } catch (error) {
                console.error('Error fetching travel guide data:', error);
            }
            setLoading(false);
        };
        fetchData();
    }, []);

    // ─── Structured Data (JSON-LD) — guide list collection schema ───
    const guideDescription = "몽골 여행 필수 정보! 몽골 기본 정보, 여행 팁, 지역별 가이드, 문화와 음식 정보를 확인해 보세요.";

    const breadcrumbLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: '여행 가이드', item: `${SITE_URL}/travel-guide` },
        ],
    };

    const itemListLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: '몽골 여행 가이드 글 목록',
        itemListElement: magazines.slice(0, 30).map((m, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE_URL}/travel-guide/${m.id}`,
            name: m.title,
        })),
    };

    const collectionLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `몽골 여행 가이드 | ${BRAND.name}`,
        description: guideDescription,
        url: `${SITE_URL}/travel-guide`,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: SITE_URL },
    };

    const seo = (
        <SEO
            title={t('travel_guide.title')}
            description={guideDescription}
            keywords="몽골 여행 가이드, 몽골 여행 정보, 몽골 문화, 몽골 음식, 몽골 여행 준비물"
            canonical="/travel-guide"
            structuredData={[collectionLd, breadcrumbLd, itemListLd]}
        />
    );

    if (isDesktop) {
        return (
            <>
                {seo}
                <DesktopLayout>
                    <MagazineListDesktop magazines={magazines} categories={magazineCategories} />
                </DesktopLayout>
            </>
        );
    }

    return (
        <>
            {seo}
            <MobileShell title="여행 매거진">
                <MagazineListMobile magazines={magazines} categories={magazineCategories} loading={loading} />
            </MobileShell>
        </>
    );
};
