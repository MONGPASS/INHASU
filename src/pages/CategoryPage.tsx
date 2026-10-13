import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { SEO } from '../components/seo/SEO';
import { toTourProduct, type CategoryLandingContent, type RawProduct } from '../components/category/categoryContent';
import { CategoryLandingDesktop } from '../components/category-desktop/CategoryLandingDesktop';
import { CategoryLandingMobile } from '../components/category-mobile/CategoryLandingMobile';
import { MW, MW_GRADIENT } from '../components/desktop-primitives/mwTokens';
import { BRAND } from '../constants/company';
import { SEO_CONSTANTS } from '../constants/seo';
import { useIsDesktop } from '../hooks/useIsDesktop';
import type { Category } from '../types/category';

const SITE_URL = SEO_CONSTANTS.SITE_URL;

// Fallback hero when admin hasn't configured the landing page yet.
const FALLBACK_HERO = 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200';

/** Row of /api/categories/:slug. */
type CategoryRow = Category & { image?: string };

export const CategoryPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const isDesktop = useIsDesktop();

    const { data: category, isLoading: isLoadingCategory } = useQuery<CategoryRow | null>({
        queryKey: ['category', slug],
        queryFn: async () => {
            if (!slug) return null;
            try {
                return await api.categories.get(slug);
            } catch {
                return null;
            }
        },
        staleTime: 1000 * 60 * 5,
    });

    const categoryName: string | undefined = category?.name;

    const { data: products = [], isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products-by-category', slug, categoryName],
        enabled: !!slug,
        queryFn: async () => {
            if (!slug) return [];
            const data: unknown = await api.products.list();
            if (!Array.isArray(data)) return [];
            const normalize = (t: unknown) => (typeof t === 'string' && t ? t.toLowerCase().replace(/\s+/g, '') : '');
            const targets = [normalize(slug), categoryName ? normalize(categoryName) : ''].filter(Boolean);
            return (data as RawProduct[])
                .filter((item) => {
                    if (item.status !== 'active') return false;
                    const cat = normalize(item.category || '');
                    const tags = (Array.isArray(item.tags) ? item.tags : []).map(normalize);
                    // Match if the product's stored category OR any of its tags matches the slug or the category display name.
                    return targets.some((t) => cat === t || cat.includes(t) || tags.some((tag) => tag === t || tag.includes(t)));
                })
                .map(toTourProduct);
        },
        staleTime: 1000 * 60 * 5,
    });

    if (isLoadingCategory) {
        return (
            <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: MW.mute }}>
                불러오는 중…
            </div>
        );
    }

    if (!category || !slug) {
        return (
            <div style={{ minHeight: '60vh', padding: isDesktop ? '96px 24px' : '72px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, textAlign: 'center' }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: MW.navy }}>카테고리를 찾을 수 없습니다</p>
                <p style={{ margin: 0, fontSize: 14, color: MW.mute }}>URL을 확인해 주세요.</p>
                <Link to="/products" style={{ marginTop: 12, display: 'flex', alignItems: 'center', height: 46, padding: '0 22px', borderRadius: 999, background: MW_GRADIENT, fontSize: 14, fontWeight: 700, color: MW.navy, textDecoration: 'none' }}>
                    투어 상품 전체 보기
                </Link>
            </div>
        );
    }

    const heroImages: string[] = (() => {
        const arr = Array.isArray(category.landing_hero_images) ? category.landing_hero_images.filter(Boolean) : [];
        if (arr.length > 0) return arr;
        const single = category.landing_hero_image || category.image;
        if (single) return [single];
        return [FALLBACK_HERO];
    })();

    const content: CategoryLandingContent = {
        name: category.name,
        heroImage: heroImages[0],
        heroImages,
        heroTagline: category.landing_hero_tagline || undefined,
        heroTitle: category.landing_hero_title || category.name,
        heroSubtitle: category.landing_hero_subtitle || category.description || undefined,
        accentColor: category.landing_accent_color || undefined,
        highlights: Array.isArray(category.landing_highlights) ? category.landing_highlights : [],
        productGridTitle: category.landing_product_grid_title || `${category.name} 투어`,
    };

    // ─── Structured Data (JSON-LD) for SEO ──────────────────────────
    const seoDescription = category.landing_hero_subtitle || category.description || `${category.name} 몽골 투어를 안내합니다.`;
    const seoUrl = `${SITE_URL}/category/${slug}`;
    const heroOgImage = heroImages[0]?.startsWith('http') ? heroImages[0] : undefined;

    const breadcrumbLd = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: '홈', item: `${SITE_URL}/` },
            { '@type': 'ListItem', position: 2, name: '투어 상품', item: `${SITE_URL}/products` },
            { '@type': 'ListItem', position: 3, name: category.name, item: seoUrl },
        ],
    };

    const itemListLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: `${category.name} 투어 상품`,
        itemListElement: products.slice(0, 20).map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${SITE_URL}/products/${p.id}`,
            name: p.name,
        })),
    };

    const collectionLd = {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: `${category.name} | ${BRAND.name}`,
        description: seoDescription,
        url: seoUrl,
        inLanguage: 'ko',
        isPartOf: { '@type': 'WebSite', name: BRAND.name, url: SITE_URL },
    };

    return (
        <>
            <SEO
                title={category.name}
                description={seoDescription}
                canonical={`/category/${slug}`}
                image={heroOgImage}
                structuredData={[collectionLd, breadcrumbLd, itemListLd]}
            />
            {isDesktop ? (
                <CategoryLandingDesktop key={slug} slug={slug} content={content} products={products} isLoadingProducts={isLoadingProducts} />
            ) : (
                <CategoryLandingMobile key={slug} slug={slug} content={content} products={products} isLoadingProducts={isLoadingProducts} />
            )}
        </>
    );
};