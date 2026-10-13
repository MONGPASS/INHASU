import { SEO_CONSTANTS, isPrivateSeoPath, isPublishedMagazine } from '../../src/constants/seo.ts';
import { BRAND, COMPANY_INFO, KAKAO_CHANNEL_URL } from '../../src/constants/company.ts';

type Row = Record<string, any>;
type PublicDb = { prepare(sql: string): { bind(...args: unknown[]): any; all(): Promise<{ results?: Row[] }>; first(): Promise<Row | null> } };

export interface PublicPage {
    title: string;
    description: string;
    canonical: string;
    image: string;
    robots: string;
    status: number;
    jsonLd: Row[];
    body: string;
}

export const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));

/** Plain text preserves article copy without executing stored editor HTML. */
export const plainText = (value: unknown) => String(value ?? '')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?(?:p|div|h[1-6]|li|br|section|article)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g, entity => ({ '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' }[entity]!))
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => {
        const point = /^x/i.test(code) ? parseInt(code.slice(1), 16) : Number(code);
        return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    }).replace(/[ \t]+/g, ' ').replace(/\n\s*\n/g, '\n').trim();

export const arrayValue = (raw: unknown): any[] => {
    if (Array.isArray(raw)) return raw;
    if (typeof raw !== 'string') return [];
    try { const value = JSON.parse(raw); return Array.isArray(value) ? value : []; } catch { return []; }
};

/** Public image URLs only: never put customer attachment links/tokens in search feeds. */
export const publicImageUrl = (raw: unknown): string | null => {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
        const url = new URL(raw.trim(), `${SEO_CONSTANTS.SITE_URL}/`);
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
        if (/\/api\/(?:file|my|documents)(?:\/|$)|\/uploads\//i.test(url.pathname)) return null;
        for (const [name, value] of url.searchParams) {
            if (/^(?:t|token|adminToken|adminId|reservationId|signature)$/i.test(name) || /(?:^|\/)uploads\//i.test(value)) return null;
        }
        return url.href;
    } catch { return null; }
};

export const publicProductImages = (product: Row) => [...new Set(arrayValue(product.main_images ?? product.mainImages).map(publicImageUrl).filter((url): url is string => !!url))];

export const validLastmod = (raw: unknown): string | undefined => {
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:[ T]|$)/.test(raw)) return undefined;
    const date = new Date(raw.includes(' ') ? `${raw.replace(' ', 'T')}Z` : raw);
    if (Number.isNaN(date.getTime()) || date.getTime() > Date.now()) return undefined;
    return date.toISOString();
};

export const encodedId = (id: unknown) => encodeURIComponent(String(id));
export const productPath = (product: Row) => `/products/${encodedId(product.id)}`;
export const normalizeCategory = (value: unknown) => typeof value === 'string' ? value.toLowerCase().replace(/\s+/g, '') : '';
export const matchesCategory = (product: Row, category: Row) => {
    const targets = [category.id, category.name].map(normalizeCategory).filter(Boolean);
    const name = normalizeCategory(product.category);
    const tags = arrayValue(product.tags).map(normalizeCategory);
    return targets.some(target => name === target || name.includes(target) || tags.some(tag => tag === target || tag.includes(target)));
};

export const productJsonLd = (product: Row, canonical: string): Row => ({
    '@context': 'https://schema.org', '@type': ['Product', 'TouristTrip'], '@id': `${canonical}#product`,
    name: product.name, description: plainText(product.description),
    image: publicProductImages(product).length ? publicProductImages(product) : undefined,
    brand: { '@type': 'Brand', name: BRAND.name }, category: product.category || '몽골 투어', touristType: product.category || '몽골 투어',
    ...(product.duration ? { additionalProperty: [{ '@type': 'PropertyValue', name: '소요 기간', value: product.duration }] } : {}),
    // Use only the actual displayed price. Tours have no fictional shipping/return policy or expiry.
    ...(Number(product.price) > 0 ? { offers: {
        '@type': 'Offer', url: canonical, priceCurrency: 'KRW', price: Number(product.price),
        availability: product.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: BRAND.name },
    } } : {}),
});

export const PUBLIC_STATIC_META: Record<string, { title: string; description: string }> = {
    '/': { title: SEO_CONSTANTS.TITLE, description: SEO_CONSTANTS.DESCRIPTION },
    '/products': { title: '몽골 여행·몽골 투어 상품 | 몽골리아 은하수', description: '고비사막, 테를지, 홉스굴, 승마 등 몽골 여행 상품을 비교하세요. 상품별 일정, 포함 사항과 원화 가격을 확인하고 한국어로 상담하세요.' },
    '/travel-guide': { title: '몽골 여행 가이드·준비 정보 | 몽골리아 은하수', description: '몽골 여행 전 알아 둘 명소, 일정, 준비물과 현지 정보를 몽골리아 은하수의 여행 가이드에서 확인하세요.' },
    '/faq': { title: '몽골 여행 자주 묻는 질문 | 몽골리아 은하수', description: '몽골 투어 예약, 준비물, 결제와 취소에 관한 자주 묻는 질문을 확인하세요.' },
    '/reviews': { title: '몽골 여행 고객 후기 | 몽골리아 은하수', description: '몽골리아 은하수 여행 고객의 몽골 투어 후기를 확인하세요.' },
    '/custom-estimate': { title: '몽골 여행 맞춤 견적 | 몽골리아 은하수', description: '몽골 여행 일정과 인원, 희망 지역을 알려 주세요. 요청에 맞춘 몽골 투어 일정과 견적을 상담해 드립니다.' },
    '/travel-mates': { title: '몽골 여행 동행 찾기 | 몽골리아 은하수', description: '몽골 여행 동행을 모집하고 함께 여행할 동행을 찾아보세요.' },
    '/promotions': { title: '몽골 여행 기획전 | 몽골리아 은하수', description: '지역과 테마별 몽골 투어 기획전을 확인하세요.' },
    '/booking-flow': { title: '몽골 투어 예약 안내 | 몽골리아 은하수', description: '상품 선택, 견적 상담, 예약금 입금과 출발 준비까지 몽골 여행 예약 절차를 확인하세요.' },
    '/contact': { title: '몽골 여행 상담 문의 | 몽골리아 은하수', description: '몽골 투어 일정, 예약과 결제에 관한 궁금한 점을 한국어로 문의하세요.' },
    '/terms-of-service': { title: '이용약관 | 몽골리아 은하수', description: '몽골리아 은하수 이용약관입니다.' },
    '/privacy-policy': { title: '개인정보처리방침 | 몽골리아 은하수', description: '몽골리아 은하수 개인정보처리방침입니다.' },
    '/about': { title: '몽골 현지 여행사 소개 | 몽골리아 은하수', description: '한국인 고객을 위한 몽골 현지 여행사 몽골리아 은하수를 소개합니다.' },
    '/guide-apply': { title: '가이드 지원 | 몽골리아 은하수', description: '몽골리아 은하수 가이드 지원 안내입니다.' },
};

const canonicalUrl = (path: string) => `${SEO_CONSTANTS.SITE_URL}${path}`;
const paragraphs = (copy: unknown) => plainText(copy).split('\n').filter(Boolean).map(text => `<p>${escapeHtml(text)}</p>`).join('');
const imageMarkup = (image: unknown, alt: string) => {
    const url = publicImageUrl(image);
    return url ? `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" width="960" height="600" style="max-width:100%;height:auto" decoding="async">` : '';
};
const itemLinks = (items: Row[], prefix: string, nameKey = 'name') => `<ul>${items.map(item => `<li><a href="${prefix}/${encodedId(item.id)}">${escapeHtml(item[nameKey])}</a>${item.duration ? ` · ${escapeHtml(item.duration)}` : ''}${Number(item.price) > 0 ? ` · ${Number(item.price).toLocaleString('ko-KR')}원부터` : ''}</li>`).join('')}</ul>`;
const breadcrumbs = (name: string, path: string, section = '몽골 투어 상품', sectionPath = '/products') => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
    { '@type': 'ListItem', position: 1, name: '홈', item: canonicalUrl('/') },
    { '@type': 'ListItem', position: 2, name: section, item: canonicalUrl(sectionPath) },
    { '@type': 'ListItem', position: 3, name, item: canonicalUrl(path) },
] });

export const fallbackMarkup = (page: PublicPage) => `<main id="public-page-content" style="max-width:1040px;margin:0 auto;padding:40px 24px;font-family:Pretendard,sans-serif;color:#0A1F2E;line-height:1.8"><nav aria-label="주요 메뉴"><a href="/">몽골리아 은하수</a> · <a href="/products">몽골 투어 상품</a> · <a href="/travel-guide">몽골 여행 가이드</a> · <a href="/custom-estimate">맞춤 견적</a></nav>${page.body}</main>`;

export async function readPublicPage(db: PublicDb, path: string): Promise<PublicPage> {
    path = path.replace(/\/+$/, '') || '/';
    const meta = PUBLIC_STATIC_META[path] ?? { title: SEO_CONSTANTS.TITLE, description: SEO_CONSTANTS.DESCRIPTION };
    const page: PublicPage = { ...meta, canonical: canonicalUrl(path), image: canonicalUrl(SEO_CONSTANTS.OG_IMAGE), robots: 'index, follow, max-image-preview:large', status: 200, jsonLd: [], body: '' };
    if (isPrivateSeoPath(path)) return { ...page, robots: 'noindex, nofollow' };
    const missing = () => ({ ...page, title: '페이지를 찾을 수 없습니다 | 몽골리아 은하수', description: '요청하신 페이지를 찾을 수 없습니다.', robots: 'noindex, follow', status: 404, body: '<h1>페이지를 찾을 수 없습니다</h1><p><a href="/products">몽골 투어 상품 보기</a></p>' });
    const decodedId = (match: RegExpMatchArray) => { try { return decodeURIComponent(match[1]); } catch { return ''; } };
    const productMatch = path.match(/^\/products\/([^/]+)$/);
    if (productMatch) {
        const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(decodedId(productMatch)).first();
        if (!product || !['active', 'soldout'].includes(product.status)) return missing();
        page.title = `${product.name} | ${BRAND.name}`;
        page.description = [product.name, product.duration, plainText(product.description)].filter(Boolean).join(' · ').slice(0, 160);
        page.image = publicProductImages(product)[0] || page.image;
        page.canonical = canonicalUrl(productPath(product));
        page.jsonLd = [productJsonLd(product, page.canonical), breadcrumbs(product.name, productPath(product))];
        page.body = `<article><h1>${escapeHtml(product.name)}</h1>${imageMarkup(page.image, product.name)}${paragraphs(product.description)}<dl><dt>여행 기간</dt><dd>${escapeHtml(product.duration)}</dd><dt>여행 가격</dt><dd>${Number(product.price) > 0 ? `${Number(product.price).toLocaleString('ko-KR')}원부터` : '견적 문의'}</dd></dl>`;
        for (const [field, title] of [['included', '포함 사항'], ['excluded', '불포함 사항']]) {
            const values = arrayValue(product[field]).filter(value => typeof value === 'string');
            if (values.length) page.body += `<h2>${title}</h2><ul>${values.map(value => `<li>${escapeHtml(plainText(value))}</li>`).join('')}</ul>`;
        }
        page.body += '<p><a href="/custom-estimate">몽골 여행 상담·맞춤 견적 요청</a></p></article>';
        return page;
    }
    const articleMatch = path.match(/^\/travel-guide\/([^/]+)$/);
    if (articleMatch) {
        const article = await db.prepare('SELECT * FROM magazines WHERE id = ?').bind(decodedId(articleMatch)).first();
        if (!article || !isPublishedMagazine(article)) return missing();
        page.title = `${article.title} | ${BRAND.name} 여행 가이드`;
        page.description = plainText(article.subtitle || article.description || article.content).slice(0, 160);
        page.image = publicImageUrl(article.thumbnail || article.image) || page.image;
        page.canonical = canonicalUrl(`/travel-guide/${encodedId(article.id)}`);
        page.jsonLd = [{ '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': `${page.canonical}#article`, headline: article.title, description: page.description,
            image: [page.image], datePublished: validLastmod(article.created_at), dateModified: validLastmod(article.updated_at || article.created_at),
            author: { '@type': article.author ? 'Person' : 'Organization', name: article.author || BRAND.name },
            publisher: { '@type': 'Organization', name: BRAND.name, logo: { '@type': 'ImageObject', url: canonicalUrl('/favicon.png') } },
            mainEntityOfPage: { '@type': 'WebPage', '@id': page.canonical }, inLanguage: 'ko',
        }, breadcrumbs(article.title, `/travel-guide/${encodedId(article.id)}`, '몽골 여행 가이드', '/travel-guide')];
        page.body = `<article><h1>${escapeHtml(article.title)}</h1>${paragraphs(article.subtitle || article.description)}${imageMarkup(page.image, article.title)}${article.author ? `<p>글: ${escapeHtml(article.author)}</p>` : ''}${paragraphs(article.content)}</article>`;
        return page;
    }
    const categoryMatch = path.match(/^\/category\/([^/]+)$/);
    if (categoryMatch) {
        const category = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(decodedId(categoryMatch)).first();
        if (!category || category.is_active === 0 || category.is_active === false || !['product', '', null, undefined].includes(category.type) || category.id === 'all') return missing();
        const products = ((await db.prepare("SELECT * FROM products WHERE status = 'active' ORDER BY sort_order ASC").all()).results || []).filter(product => matchesCategory(product, category));
        page.title = `${category.name} 몽골 여행·투어 | ${BRAND.name}`;
        page.description = plainText(category.landing_hero_subtitle || category.description || `${category.name} 몽골 투어 상품을 확인하세요.`).slice(0, 160);
        page.image = publicImageUrl(arrayValue(category.landing_hero_images)[0] || category.landing_hero_image || category.image) || page.image;
        page.canonical = canonicalUrl(`/category/${encodedId(category.id)}`);
        if (!products.length) page.robots = 'noindex, follow';
        page.jsonLd = [breadcrumbs(category.name, `/category/${encodedId(category.id)}`), { '@context': 'https://schema.org', '@type': 'CollectionPage', name: page.title, description: page.description, url: page.canonical, inLanguage: 'ko' }];
        page.body = `<h1>${escapeHtml(category.landing_hero_title || category.name)}</h1>${paragraphs(page.description)}${itemLinks(products, '/products')}`;
        return page;
    }
    const promotionMatch = path.match(/^\/promotions\/([^/]+)$/);
    if (promotionMatch) {
        const promotion = await db.prepare('SELECT * FROM promotions WHERE id = ?').bind(decodedId(promotionMatch)).first();
        if (!promotion || ![1, true].includes(promotion.is_active)) return missing();
        page.title = `${promotion.title} | ${BRAND.name}`;
        page.description = plainText(promotion.subtitle || promotion.title).slice(0, 160);
        page.image = publicImageUrl(promotion.image) || page.image;
        const ids = arrayValue(promotion.product_ids);
        const products = ((await db.prepare("SELECT * FROM products WHERE status = 'active' ORDER BY sort_order ASC").all()).results || []).filter(product => ids.includes(product.id));
        page.body = `<h1>${escapeHtml(promotion.title)}</h1>${paragraphs(promotion.subtitle)}${imageMarkup(promotion.image, promotion.title)}${itemLinks(products, '/products')}`;
        page.jsonLd = [breadcrumbs(promotion.title, path, '몽골 여행 기획전', '/promotions')];
        return page;
    }
    if (!PUBLIC_STATIC_META[path]) {
        // Public user-generated detail routes have their own API; exclude them until their pages render.
        if (/^\/(?:reviews|travel-mates)\/[^/]+$/.test(path)) return { ...page, robots: 'noindex, follow' };
        return missing();
    }
    if (path === '/' || path === '/products') {
        const products = (await db.prepare("SELECT * FROM products WHERE status = 'active' ORDER BY sort_order ASC").all()).results || [];
        const categories = (await db.prepare("SELECT * FROM categories WHERE (is_active = 1 OR is_active IS NULL) AND (type = 'product' OR type IS NULL OR type = '') AND id != 'all' ORDER BY sort_order ASC").all()).results || [];
        page.body = `<h1>${escapeHtml(path === '/' ? '몽골 여행·몽골 투어 전문 현지 여행사 몽골리아 은하수' : '몽골 여행·몽골 투어 상품')}</h1>${paragraphs(page.description)}<h2>지역·테마별 몽골 여행</h2>${itemLinks(categories.filter(category => products.some(product => matchesCategory(product, category))), '/category')}<h2>몽골 투어 상품</h2>${itemLinks(products.slice(0, 100), '/products')}`;
        page.jsonLd = [{ '@context': 'https://schema.org', '@type': path === '/' ? 'WebSite' : 'CollectionPage', '@id': `${page.canonical}#${path === '/' ? 'website' : 'collection'}`, name: page.title, url: page.canonical, inLanguage: 'ko' }];
        if (path === '/') {
            page.jsonLd.push({ '@context': 'https://schema.org', '@type': 'TravelAgency', '@id': `${SEO_CONSTANTS.SITE_URL}/#organization`,
                name: BRAND.name, alternateName: BRAND.nameEn, url: SEO_CONSTANTS.SITE_URL, logo: canonicalUrl('/favicon.png'), image: page.image,
                telephone: COMPANY_INFO.phoneKR, email: COMPANY_INFO.email, description: page.description,
                address: { '@type': 'PostalAddress', streetAddress: COMPANY_INFO.addressJa, addressLocality: '울란바토르', addressCountry: 'MN' },
                areaServed: { '@type': 'Country', name: '몽골' }, knowsLanguage: ['ko', 'mn'], sameAs: [KAKAO_CHANNEL_URL],
            });
            page.body += `<footer><p>${escapeHtml(BRAND.name)} · ${escapeHtml(COMPANY_INFO.addressJa)}</p><p><a href="tel:${escapeHtml(COMPANY_INFO.phoneKR)}">${escapeHtml(COMPANY_INFO.phoneKR)}</a> · <a href="mailto:${escapeHtml(COMPANY_INFO.email)}">${escapeHtml(COMPANY_INFO.email)}</a></p></footer>`;
        }
    } else if (path === '/travel-guide') {
        const articles = ((await db.prepare('SELECT * FROM magazines ORDER BY created_at DESC').all()).results || []).filter(isPublishedMagazine);
        page.body = `<h1>몽골 여행 가이드</h1>${paragraphs(page.description)}${itemLinks(articles.slice(0, 100), '/travel-guide', 'title')}`;
    }
    return page;
}
