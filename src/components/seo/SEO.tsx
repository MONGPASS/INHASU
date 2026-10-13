import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { SEO_CONSTANTS, isPrivateSeoPath } from '../../constants/seo';
import { BRAND } from '../../constants/company';

interface SEOProps {
    title?: string;
    description?: string;
    keywords?: string;
    image?: string;
    url?: string;
    canonical?: string;
    robots?: string;
    structuredData?: Record<string, any> | Record<string, any>[];
}

export const SEO: React.FC<SEOProps> = ({
    title,
    description,
    keywords,
    image,
    url,
    canonical,
    robots,
    structuredData
}) => {
    const metaTitle = title
        ? `${title} | ${BRAND.name}`
        : SEO_CONSTANTS.TITLE;

    const metaDescription = description || SEO_CONSTANTS.DESCRIPTION;
    const metaKeywords = keywords || SEO_CONSTANTS.KEYWORDS;
    const absoluteUrl = (value: string) => new URL(value, `${SEO_CONSTANTS.SITE_URL}/`).href;
    const metaImage = absoluteUrl(image || SEO_CONSTANTS.OG_IMAGE);
    // Without an explicit canonical the page points at itself (query string dropped). It used to fall
    // back to the home URL, which told search engines that e.g. the terms page duplicates the home page.
    const { pathname } = useLocation();
    const selfPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
    const canonicalUrl = absoluteUrl(canonical ?? url ?? selfPath);
    const metaUrl = url ? absoluteUrl(url) : canonicalUrl;
    const previewHost = typeof window !== 'undefined' && window.location.hostname.endsWith('.pages.dev');
    const robotsRule = previewHost ? 'noindex, nofollow' : (robots || (isPrivateSeoPath(pathname) ? 'noindex, nofollow' : 'index, follow, max-image-preview:large'));

    // Normalize structuredData to always be an array
    const structuredDataArray = structuredData
        ? (Array.isArray(structuredData) ? structuredData : [structuredData])
        : [];

    return (
        <Helmet htmlAttributes={{ lang: 'ko' }}>
            <title>{metaTitle}</title>
            <meta name="description" content={metaDescription} />
            <meta name="keywords" content={metaKeywords} />
            <meta name="robots" content={robotsRule} />

            {/* Canonical URL */}
            <link rel="canonical" href={canonicalUrl} />

            {/* Open Graph / Facebook */}
            <meta property="og:type" content="website" />
            <meta property="og:locale" content="ko_KR" />
            <meta property="og:url" content={metaUrl} />
            <meta property="og:title" content={metaTitle} />
            <meta property="og:description" content={metaDescription} />
            <meta property="og:image" content={metaImage} />
            <meta property="og:site_name" content={BRAND.name} />

            {/* Twitter */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:url" content={metaUrl} />
            <meta name="twitter:title" content={metaTitle} />
            <meta name="twitter:description" content={metaDescription} />
            <meta name="twitter:image" content={metaImage} />

            {/* Structured Data (JSON-LD) — supports single or multiple schemas */}
            {structuredDataArray.map((data, index) => (
                <script key={`jsonld-${index}`} type="application/ld+json">
                    {JSON.stringify(data).replace(/</g, '\\u003c')}
                </script>
            ))}
        </Helmet>
    );
};

