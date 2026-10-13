import { SEO_CONSTANTS, isPublishedMagazine } from '../src/constants/seo.ts';
import { encodedId, matchesCategory, publicImageUrl, publicProductImages, validLastmod, PUBLIC_STATIC_META } from './lib/publicSeo.ts';

interface Env { DB: D1Database }
type Row = Record<string, any>;
interface SitemapEntry { path: string; lastmod?: string; images?: string[] }

export const xmlEscape = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]!));

export async function readSitemapEntries(db: any): Promise<SitemapEntry[]> {
    const products: Row[] = (await db.prepare("SELECT * FROM products WHERE status IN ('active', 'soldout')").all()).results || [];
    const categories: Row[] = (await db.prepare("SELECT * FROM categories WHERE (is_active = 1 OR is_active IS NULL) AND (type = 'product' OR type IS NULL OR type = '') AND id != 'all'").all()).results || [];
    const magazines: Row[] = (await db.prepare('SELECT * FROM magazines').all()).results || [];
    const promotions: Row[] = (await db.prepare('SELECT * FROM promotions WHERE is_active = 1').all()).results || [];
    // Do not invent today's date for unchanged static pages, priority or change frequency.
    const entries: SitemapEntry[] = Object.keys(PUBLIC_STATIC_META).filter(path => path !== '/guide-apply').map(path => ({ path }));
    for (const product of products) entries.push({ path: `/products/${encodedId(product.id)}`, lastmod: validLastmod(product.updated_at || product.created_at), images: publicProductImages(product).slice(0, 5) });
    for (const category of categories) {
        if (!products.some(product => product.status === 'active' && matchesCategory(product, category))) continue;
        entries.push({ path: `/category/${encodedId(category.id)}` });
    }
    for (const magazine of magazines.filter(isPublishedMagazine)) entries.push({ path: `/travel-guide/${encodedId(magazine.id)}`, lastmod: validLastmod(magazine.updated_at || magazine.created_at), images: [publicImageUrl(magazine.thumbnail || magazine.image)].filter((image): image is string => !!image) });
    for (const promotion of promotions) entries.push({ path: `/promotions/${encodedId(promotion.id)}`, lastmod: validLastmod(promotion.updated_at || promotion.created_at), images: [publicImageUrl(promotion.image)].filter((image): image is string => !!image) });
    return entries;
}

export const renderSitemap = (entries: SitemapEntry[]) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.map(entry => `  <url><loc>${xmlEscape(`${SEO_CONSTANTS.SITE_URL}${entry.path}`)}</loc>${entry.lastmod ? `<lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : ''}${(entry.images || []).map(image => `<image:image><image:loc>${xmlEscape(image)}</image:loc></image:image>`).join('')}</url>`).join('\n')}
</urlset>`;

export const onRequestGet: PagesFunction<Env> = async context => {
    try {
        return new Response(renderSitemap(await readSitemapEntries(context.env.DB)), { headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' } });
    } catch (error) {
        // Do not replace a complete sitemap with a misleading empty success response.
        // Google retries temporary failures while preserving previously known URLs.
        console.error('Sitemap unavailable:', error);
        return new Response('Sitemap temporarily unavailable', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60' } });
    }
};
