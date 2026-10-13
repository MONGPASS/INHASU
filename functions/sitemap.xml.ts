import { drizzle } from 'drizzle-orm/d1';
import { products } from '../src/db/schema/products';
import { eq } from 'drizzle-orm';
import { SEO_CONSTANTS } from '../src/constants/seo';

// Define the Cloudflare Env interface
interface Env {
    DB: D1Database;
}

interface SitemapUrl {
    loc: string;
    lastmod: string;
    changefreq: string;
    priority: string;
    images?: string[];
}

// Escape XML reserved chars in URLs (& is the realistic one in image query strings).
const xmlEscape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

// Convert any image path/URL into an absolute URL fit for the sitemap, or null if unusable.
const toAbsoluteImageUrl = (raw: unknown, baseUrl: string): string | null => {
    if (typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('data:')) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    return `${baseUrl}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
};

export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const db = drizzle(context.env.DB);

        // Fetch all active products (now also pulling main_images for the image sitemap)
        const activeProducts = await db
            .select({
                id: products.id,
                updatedAt: products.updatedAt,
                mainImages: products.mainImages,
            })
            .from(products)
            .where(eq(products.status, 'active'));

        const today = new Date().toISOString().split('T')[0];
        const baseUrl = SEO_CONSTANTS.SITE_URL;

        // Base static URLs (homepage uses trailing slash to match <link rel="canonical">)
        const urls: SitemapUrl[] = [
            { loc: `${baseUrl}/`, lastmod: today, changefreq: 'daily', priority: '1.0' },
            { loc: `${baseUrl}/products`, lastmod: today, changefreq: 'daily', priority: '0.9' },
            { loc: `${baseUrl}/travel-guide`, lastmod: today, changefreq: 'daily', priority: '0.9' },
            { loc: `${baseUrl}/travel-mates`, lastmod: today, changefreq: 'weekly', priority: '0.8' },
            { loc: `${baseUrl}/reviews`, lastmod: today, changefreq: 'daily', priority: '0.8' },
            { loc: `${baseUrl}/custom-estimate`, lastmod: today, changefreq: 'monthly', priority: '0.7' },
            { loc: `${baseUrl}/promotions`, lastmod: today, changefreq: 'weekly', priority: '0.7' },
            { loc: `${baseUrl}/about`, lastmod: today, changefreq: 'monthly', priority: '0.5' },
            { loc: `${baseUrl}/faq`, lastmod: today, changefreq: 'monthly', priority: '0.5' },
            { loc: `${baseUrl}/booking-flow`, lastmod: today, changefreq: 'monthly', priority: '0.5' },
            { loc: `${baseUrl}/contact`, lastmod: today, changefreq: 'yearly', priority: '0.3' },
            { loc: `${baseUrl}/privacy-policy`, lastmod: today, changefreq: 'yearly', priority: '0.3' },
            { loc: `${baseUrl}/terms-of-service`, lastmod: today, changefreq: 'yearly', priority: '0.3' },
        ];

        // Add dynamic product URLs (with up to 5 images each for Google Image Search)
        activeProducts.forEach(product => {
            const lastModFormat = product.updatedAt ? product.updatedAt.split(' ')[0] : today;
            const images: string[] = [];
            try {
                const parsed = JSON.parse(product.mainImages || '[]');
                if (Array.isArray(parsed)) {
                    for (const raw of parsed) {
                        const abs = toAbsoluteImageUrl(raw, baseUrl);
                        if (abs) images.push(abs);
                        if (images.length >= 5) break;
                    }
                }
            } catch {
                // mainImages may be malformed JSON for legacy rows — skip images, keep the URL
            }
            urls.push({
                loc: `${baseUrl}/products/${product.id}`,
                lastmod: lastModFormat,
                changefreq: 'weekly',
                priority: '0.8',
                images,
            });
        });

        // Add dynamic category landing page URLs (/category/:slug)
        // NOTE: categories table has no updated_at/created_at columns, so we use today's date.
        try {
            const categoriesResult = await context.env.DB.prepare(
                "SELECT id FROM categories WHERE (type = 'product' OR type IS NULL) AND is_active = 1 AND id != 'all'"
            ).all();
            if (categoriesResult && categoriesResult.results) {
                categoriesResult.results.forEach((cat: any) => {
                    urls.push({
                        loc: `${baseUrl}/category/${cat.id}`,
                        lastmod: today,
                        changefreq: 'weekly',
                        priority: '0.8'
                    });
                });
            }
        } catch (e) {
            console.error('Failed to fetch categories for sitemap:', e);
        }

        // Add 여행 기획전 detail pages registered in the admin (/promotions/:id).
        // The table only exists after /api/migrate-db has run, so a failure just skips them.
        try {
            const promotionsResult = await context.env.DB.prepare(
                'SELECT id, updated_at, image FROM promotions WHERE is_active = 1 ORDER BY sort_order ASC'
            ).all();
            (promotionsResult?.results || []).forEach((promo: any) => {
                const images: string[] = [];
                const abs = toAbsoluteImageUrl(promo.image, baseUrl);
                if (abs) images.push(abs);
                urls.push({
                    loc: `${baseUrl}/promotions/${promo.id}`,
                    lastmod: promo.updated_at ? String(promo.updated_at).split(' ')[0] : today,
                    changefreq: 'weekly',
                    priority: '0.6',
                    images,
                });
            });
        } catch (e) {
            console.error('Failed to fetch promotions for sitemap:', e);
        }

        // Add dynamic travel guide (magazine) URLs using raw D1 query (with thumbnail image)
        let magazinesResult;
        try {
            magazinesResult = await context.env.DB.prepare(
                "SELECT id, updated_at, thumbnail FROM magazines WHERE is_published = 1"
            ).all();
        } catch (e) {
            // 표가 아직 준비되지 않은 환경이면 조건 없이 다시 시도한다:
            try {
                magazinesResult = await context.env.DB.prepare("SELECT id, updated_at, thumbnail FROM magazines").all();
            } catch (err) {
                console.error("Failed to fetch magazines for sitemap:", err);
            }
        }

        if (magazinesResult && magazinesResult.results) {
            magazinesResult.results.forEach((mag: any) => {
                const lastModFormat = mag.updated_at ? String(mag.updated_at).split(' ')[0] : today;
                const images: string[] = [];
                const abs = toAbsoluteImageUrl(mag.thumbnail, baseUrl);
                if (abs) images.push(abs);
                urls.push({
                    loc: `${baseUrl}/travel-guide/${mag.id}`,
                    lastmod: lastModFormat,
                    changefreq: 'monthly',
                    priority: '0.7',
                    images,
                });
            });
        }

        const renderUrl = (url: SitemapUrl) => {
            const imageBlock = (url.images && url.images.length > 0)
                ? '\n' + url.images.map(img =>
                    `    <image:image><image:loc>${xmlEscape(img)}</image:loc></image:image>`
                ).join('\n')
                : '';
            return `  <url>
    <loc>${xmlEscape(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>${imageBlock}
  </url>`;
        };

        const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(renderUrl).join('\n')}
</urlset>`;

        return new Response(sitemapXml, {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, max-age=3600' // Cache for 1 hour at edge
            }
        });
    } catch (error) {
        console.error('Failed to generate sitemap:', error);
        // Fallback to minimal sitemap on error so search engines don't get 500s
        const baseUrl = SEO_CONSTANTS.SITE_URL;
        const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

        return new Response(fallbackXml, {
            status: 200,
            headers: {
                'Content-Type': 'application/xml; charset=utf-8'
            }
        });
    }
};
