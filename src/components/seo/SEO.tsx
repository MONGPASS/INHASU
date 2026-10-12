import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { SEO_CONSTANTS } from '../../constants/seo';
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
    const metaImage = image ? (image.startsWith('http') ? image : `${SEO_CONSTANTS.SITE_URL}${image}`) : `${SEO_CONSTANTS.SITE_URL}${SEO_CONSTANTS.OG_IMAGE}`;
    // Without an explicit canonical the page points at itself (query string dropped). It used to fall
    // back to the home URL, which told search engines that e.g. the terms page duplicates the home page.
    const { pathname } = useLocation();
    const selfPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
    const canonicalUrl = `${SEO_CONSTANTS.SITE_URL}${canonical ?? url ?? selfPath}`;
    const metaUrl = url ? `${SEO_CONSTANTS.SITE_URL}${url}` : canonicalUrl;

    // Normalize structuredData to always be an array
    const structuredDataArray = structuredData
        ? (Array.isArray(structuredData) ? structuredData : [structuredData])
        : [];

    return (
        <Helmet htmlAttributes={{ lang: 'ko' }}>
            <title>{metaTitle}</title>
            <meta name="description" content={metaDescription} />
            <meta name="keywords" content={metaKeywords} />
            {robots && <meta name="robots" content={robots} />}

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
            <meta property="twitter:card" content="summary_large_image" />
            <meta property="twitter:url" content={metaUrl} />
            <meta property="twitter:title" content={metaTitle} />
            <meta property="twitter:description" content={metaDescription} />
            <meta property="twitter:image" content={metaImage} />

            {/* Structured Data (JSON-LD) — supports single or multiple schemas */}
            {structuredDataArray.map((data, index) => (
                <script key={`jsonld-${index}`} type="application/ld+json">
                    {JSON.stringify(data)}
                </script>
            ))}
        </Helmet>
    );
};

