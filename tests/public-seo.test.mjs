import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { readPublicPage, fallbackMarkup, publicImageUrl, plainText, productJsonLd } from '../functions/lib/publicSeo.ts';
import { readSitemapEntries, renderSitemap, onRequestGet as sitemap } from '../functions/sitemap.xml.ts';
import { onRequestGet as publicPage } from '../functions/[[path]].ts';
import { isPrivateSeoPath, isPublishedMagazine, SEO_CONSTANTS } from '../src/constants/seo.ts';

async function fixture() {
    const raw = new DatabaseSync(':memory:');
    const statement = (sql, args = []) => ({
        bind: (...values) => statement(sql, values),
        async all() { return { results: raw.prepare(sql).all(...args) }; },
        async first() { return raw.prepare(sql).get(...args) || null; },
        async run() { return raw.prepare(sql).run(...args); },
    });
    const db = { raw, prepare: sql => statement(sql), batch: async list => Promise.all(list.map(item => item.run())) };
    await ensureSiteSchema(db);
    raw.prepare("INSERT INTO products (id,name,description,category,duration,price,main_images,tags,status,updated_at,pricing_options) VALUES (?,?,?,?,?,?,?,?,?,?,?)").run(
        'tour & one', '테를지 & 고비 몽골 투어', '<p>한국어 가이드와 함께 여행합니다.</p>', '테를지', '3박 4일', 9990000,
        JSON.stringify(['/api/images/test.webp?v=1&size=2', '/api/file?token=customer-secret', 'javascript:alert(1)']), '["terelj"]', 'active', '2026-01-10 12:00:00',
        JSON.stringify([{ people: 2, pricePerPerson: 1590000 }, { people: 6, pricePerPerson: 1290000 }])
    );
    raw.prepare("INSERT INTO products (id,name,category,status) VALUES (?,?,?,?)").run('draft-tour', '비공개 상품', '고비', 'inactive');
    raw.prepare("INSERT INTO products (id,name,category,status) VALUES (?,?,?,?)").run('soldout-tour', '매진 상품', '고비', 'soldout');
    raw.prepare("INSERT INTO categories (id,name,type,is_active) VALUES (?,?,?,?)").run('terelj', '테를지', 'product', 1);
    raw.prepare("INSERT INTO categories (id,name,type,is_active) VALUES (?,?,?,?)").run('empty', '없는 지역', 'product', 1);
    raw.prepare("INSERT INTO categories (id,name,type,is_active) VALUES (?,?,?,?)").run('draft', '숨긴 지역', 'product', 0);
    raw.prepare("INSERT INTO categories (id,name,type,is_active) VALUES (?,?,?,?)").run('legacy-null', '테를지', '', null);
    raw.prepare("INSERT INTO magazines (id,title,subtitle,content,thumbnail,is_published,created_at) VALUES (?,?,?,?,?,?,?)").run('article-one', '몽골 여행 준비물', '여행 전 준비물 안내', '<h2>필수 준비물</h2><p>따뜻한 옷 &amp; 자외선 차단제</p><script>alert("bad")</script>', '/img/home/1.webp', 1, '2026-01-01 00:00:00');
    raw.prepare("INSERT INTO magazines (id,title,is_published) VALUES (?,?,?)").run('article-draft', '숨긴 글', 0);
    raw.prepare("INSERT INTO promotions (id,title,subtitle,is_active,product_ids) VALUES (?,?,?,?,?)").run('promo-one', '몽골 투어 기획전', '테를지 여행', 1, '["tour & one","draft-tour"]');
    return db;
}

test('public product has encoded canonical, actual won price and crawlable escaped content', async () => {
    const db = await fixture();
    try {
        const page = await readPublicPage(db, '/products/tour%20%26%20one');
        assert.equal(page.status, 200);
        assert.equal(page.canonical, 'https://mongolia-milkyway.com/products/tour%20%26%20one');
        assert.equal(page.jsonLd[0].offers.price, 1290000);
        assert.equal(page.jsonLd[0].offers.priceCurrency, 'KRW');
        assert.equal(page.jsonLd[0].offers.url, page.canonical);
        assert.equal(page.jsonLd[0].offers.description, '6명 예약 시 1인 요금');
        assert.deepEqual(page.jsonLd[0].image, ['https://mongolia-milkyway.com/api/images/test.webp?v=1&size=2']);
        assert.match(fallbackMarkup(page), /<h1>테를지 &amp; 고비 몽골 투어<\/h1>/);
        assert.match(page.body, /1,290,000원부터/);
        assert.match(page.body, /6명 기준/);
        assert.match(page.description, /1인 1,290,000원부터 · 6명 기준/);
        assert.doesNotMatch(page.body, /9,990,000/);
        assert.match(page.body, /한국어 가이드와 함께 여행합니다/);
        for (const invented of ['priceValidUntil', 'shippingDetails', 'hasMerchantReturnPolicy', 'aggregateRating']) assert.equal(invented in page.jsonLd[0], false);
    } finally { db.raw.close(); }
});

test('SEO omits offers for unconfigured tiers and never revives a legacy sale price', async () => {
    const db = await fixture();
    try {
        for (const pricing of [null, '[]', '[{"people":2,"pricePerPerson":0}]', '[{"people":2,"pricePerPerson":-1}]']) {
            db.raw.prepare('UPDATE products SET pricing_options=? WHERE id=?').run(pricing, 'tour & one');
            const page = await readPublicPage(db, '/products/tour%20%26%20one');
            assert.equal('offers' in page.jsonLd[0], false);
            assert.match(page.body, /요금 등록 필요/);
            assert.match(page.description, /요금 등록 필요/);
            assert.doesNotMatch(page.body, /9,990,000|0원부터/);
            for (const path of ['/', '/products', '/category/terelj', '/promotions/promo-one']) {
                const collection = await readPublicPage(db, path);
                assert.match(collection.body, /요금 등록 필요/);
                assert.doesNotMatch(collection.body, /9,990,000|0원부터/);
            }
        }
    } finally { db.raw.close(); }
});

test('missing/hidden details are genuine 404; empty valid categories are noindex', async () => {
    const db = await fixture();
    try {
        for (const path of ['/products/missing', '/products/draft-tour', '/travel-guide/article-draft', '/category/draft', '/category/missing', '/unknown']) {
            const page = await readPublicPage(db, path);
            assert.equal(page.status, 404, path);
            assert.match(page.robots, /noindex/, path);
        }
        assert.equal((await readPublicPage(db, '/products/soldout-tour')).status, 200);
        const empty = await readPublicPage(db, '/category/empty');
        assert.equal(empty.status, 200);
        assert.match(empty.robots, /noindex/);
        const category = await readPublicPage(db, '/category/terelj');
        assert.match(category.body, /href="\/products\/tour%20%26%20one"/);
        assert.doesNotMatch(category.body, /draft-tour/);
        const legacyCategory = await readPublicPage(db, '/category/legacy-null');
        assert.equal(legacyCategory.status, 200);
        assert.doesNotMatch(legacyCategory.robots, /noindex/);
        assert.match(legacyCategory.body, /href="\/products\/tour%20%26%20one"/);
    } finally { db.raw.close(); }
});

test('public article copy is server readable without executing stored HTML', async () => {
    const db = await fixture();
    try {
        const page = await readPublicPage(db, '/travel-guide/article-one');
        assert.equal(page.status, 200);
        assert.match(page.body, /필수 준비물/);
        assert.match(page.body, /따뜻한 옷 &amp; 자외선 차단제/);
        assert.doesNotMatch(page.body, /alert|<script/);
        assert.equal(page.jsonLd[0]['@type'], 'BlogPosting');
        const homepage = await readPublicPage(db, '/');
        assert.match(homepage.body, /href="\/products\/tour%20%26%20one"/);
        assert.match(homepage.body, /href="\/category\/terelj"/);
        assert.match(homepage.body, /href="\/category\/legacy-null"/);
        assert.doesNotMatch(homepage.body, /draft-tour|category\/empty/);
        assert.equal(fs.existsSync(new URL(`../public${SEO_CONSTANTS.OG_IMAGE}`, import.meta.url)), true);
    } finally { db.raw.close(); }
});

test('sitemap publishes only canonical public pages/images and real update times', async () => {
    const db = await fixture();
    try {
        const entries = await readSitemapEntries(db);
        const xml = renderSitemap(entries);
        assert.match(xml, /products\/tour%20%26%20one/);
        assert.match(xml, /products\/soldout-tour/);
        assert.match(xml, /travel-guide\/article-one/);
        assert.match(xml, /category\/legacy-null/);
        assert.doesNotMatch(xml, /draft-tour|article-draft|category\/empty|category\/draft|customer-secret|\/admin|\/mypage/);
        assert.match(xml, /test.webp\?v=1&amp;size=2/);
        assert.match(xml, /2026-01-10T12:00:00.000Z/);
        assert.equal(entries.find(entry => entry.path === '/').lastmod, undefined);
        assert.doesNotMatch(xml, /<priority>|<changefreq>/);
        assert.equal(entries.find(entry => entry.path === '/category/terelj').lastmod, undefined);
    } finally { db.raw.close(); }
});

test('private paths do not read customer tables and never enter indexing', async () => {
    const forbiddenDb = { prepare() { throw new Error('private page should not query'); } };
    for (const path of ['/admin', '/admin/products', '/mypage/reservations', '/documents/contract/private', '/estimate/private', '/reservation/private', '/payment', '/chats/a']) {
        assert.equal(isPrivateSeoPath(path), true, path);
        const page = await readPublicPage(forbiddenDb, path);
        assert.equal(page.robots, 'noindex, nofollow');
        assert.equal(page.body, '');
    }
    assert.equal(isPublishedMagazine({ is_published: 1, is_active: 0 }), false);
    assert.equal(isPublishedMagazine({ is_active: 1 }), true);
    assert.equal(isPublishedMagazine({}), false);
});

test('invalid/private image schemes and HTML payloads cannot leak into markup', () => {
    for (const image of ['data:image/png;base64,a', 'blob:https://example.com/a', 'javascript:alert(1)', '/api/file?key=a', '/api/img?key=uploads/passport.jpg', '/img/a.jpg?t=secret', 'https://user:pass@example.com/photo']) assert.equal(publicImageUrl(image), null, image);
    assert.equal(publicImageUrl('//images.example.com/a.webp'), 'https://images.example.com/a.webp');
    assert.equal(plainText('<script>steal()</script><p>&lt;img src=x onerror=bad&gt;</p>'), '<img src=x onerror=bad>');
    const page = { body: '<h1>실제 본문</h1>' };
    assert.match(fallbackMarkup(page), /id="public-page-content"/);
    assert.equal('offers' in productJsonLd({ name: '가격 문의', price: 0 }, 'https://mongolia-milkyway.com/products/a'), false);
});

test('temporary database failures return retryable 503 instead of false 200 or 404', async context => {
    context.mock.method(console, 'error', () => {});
    const db = { prepare() { throw new Error('fixture unavailable'); } };
    const sitemapResponse = await sitemap({ env: { DB: db } });
    assert.equal(sitemapResponse.status, 503);
    assert.equal(sitemapResponse.headers.get('Retry-After'), '60');
    const response = await publicPage({ request: new Request('https://mongolia-milkyway.com/products/a'), env: { DB: db }, next: async () => new Response('<div id="root"></div>', { headers: { 'Content-Type': 'text/html' } }) });
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('fixed Korean document URLs preserve their content but send noindex', async () => {
    const response = await publicPage({ request: new Request('https://mongolia-milkyway.com/확정일정표.html?t=private'), next: async () => new Response('original customer document', { headers: { 'Content-Type': 'text/html' } }) });
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex, nofollow');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.equal(await response.text(), 'original customer document');
});

test('Cloudflare HTMLRewriter serves real product HTML, safe JSON-LD and noindex status headers', async () => {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const shell = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const googleVerification = fs.readFileSync(path.join(root, 'public/google9b777fb4d640732b.html'), 'utf8');
    const mapDocument = fs.readFileSync(path.join(root, 'public/designs/mongolia-map.html'), 'utf8');
    const staticDocuments = {
        '/google9b777fb4d640732b.html': googleVerification,
        '/google9b777fb4d640732b': googleVerification,
        '/designs/mongolia-map.html': mapDocument,
        '/designs/mongolia-map': mapDocument,
    };
    const bundled = await build({
        stdin: { resolveDir: root, contents: `
            import { onRequestGet } from './functions/[[path]].ts';
            import { onRequestGet as sitemap } from './functions/sitemap.xml.ts';
            const html = ${JSON.stringify(shell)};
            const staticDocuments = ${JSON.stringify(staticDocuments)};
            export default { fetch(request, env) {
                const assets = { fetch: async (assetRequest = request) => {
                    const path = new URL(assetRequest.url).pathname;
                    const type = path === '/assets/runtime.js' ? 'application/javascript' : path === '/img/runtime.webp' ? 'image/webp' : 'text/html';
                    const headers = {'Content-Type':type,ETag:'"fixture-app-v1"','Last-Modified':'Sun, 11 Oct 2026 00:00:00 GMT'};
                    if (assetRequest.headers.get('If-None-Match') === headers.ETag || assetRequest.headers.get('If-Modified-Since') === headers['Last-Modified']) return new Response(null,{status:304,headers});
                    return new Response(staticDocuments[path] || html,{headers});
                }};
                const context = {request,env:{...env,ASSETS:assets},next:(nextRequest = request) => assets.fetch(nextRequest)};
                return new URL(request.url).pathname === '/sitemap.xml' ? sitemap(context) : onRequestGet(context);
            } };
        ` }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', logLevel: 'silent',
    });
    const mf = new Miniflare({ modules: true, script: bundled.outputFiles[0].text, compatibilityDate: '2026-10-13', d1Databases: ['DB'] });
    try {
        const db = await mf.getD1Database('DB');
        await ensureSiteSchema(db);
        await db.prepare('INSERT INTO products (id,name,description,category,duration,price,main_images,status,pricing_options) VALUES (?,?,?,?,?,?,?,?,?)')
            .bind('runtime-tour', '몽골 투어 <특가> & "상담"', '한국어 여행 가이드 </script><script>bad()</script>', '테를지', '3박 4일', 9990000, '["/img/home/1.webp"]', 'active', '[{"people":6,"pricePerPerson":1230000}]').run();
        await db.prepare('INSERT INTO products (id,name,status) VALUES (?,?,?)').bind('runtime-draft', '비공개 상품', 'inactive').run();
        const response = await mf.dispatchFetch('https://mongolia-milkyway.com/products/runtime-tour?ref=sample');
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('X-Robots-Tag'), 'index, follow, max-image-preview:large');
        assert.equal(response.headers.get('ETag'), null);
        assert.equal(response.headers.get('Last-Modified'), null);
        const html = await response.text();
        assert.match(html, /<h1>몽골 투어 &lt;특가&gt; &amp; &quot;상담&quot;<\/h1>/);
        assert.match(html, /한국어 여행 가이드/);
        assert.doesNotMatch(html, /<script>bad\(\)<\/script>/);
        assert.match(html, /<link[^>]+rel="canonical"[^>]+href="https:\/\/mongolia-milkyway.com\/products\/runtime-tour"/);
        assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
        assert.doesNotMatch(html, /ref=sample|og-image.jpg/);
        const scripts = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match => JSON.parse(match[1]));
        assert.equal(scripts[0].offers.price, 1230000);
        assert.equal(scripts[0].offers.priceCurrency, 'KRW');
        assert.equal(scripts[0].offers.description, '6명 예약 시 1인 요금');
        assert.match(html, /1인 1,230,000원부터 · 6명 기준/);
        assert.doesNotMatch(html, /9,990,000/);
        assert.equal(scripts[0].shippingDetails, undefined);
        const preview = await mf.dispatchFetch('https://review.inhasu.pages.dev/products/runtime-tour');
        assert.equal(preview.headers.get('X-Robots-Tag'), 'noindex, nofollow');
        assert.match(await preview.text(), /name="robots"[^>]+content="noindex, nofollow"/);
        for (const [path, originalDocument] of Object.entries(staticDocuments)) {
            const document = await mf.dispatchFetch(`https://mongolia-milkyway.com${path}?stops=terelj`);
            assert.equal(document.status, 200, path);
            assert.equal(await document.text(), originalDocument, path);
            const previewDocument = await mf.dispatchFetch(`https://review.inhasu.pages.dev${path}`);
            assert.equal(previewDocument.status, 200, path);
            assert.equal(previewDocument.headers.get('X-Robots-Tag'), 'noindex, nofollow', path);
            assert.equal(await previewDocument.text(), originalDocument, path);
        }
        const conditionalHeaders = { 'If-None-Match': '"fixture-app-v1"', 'If-Modified-Since': 'Sun, 11 Oct 2026 00:00:00 GMT' };
        await db.prepare('UPDATE products SET name = ? WHERE id = ?').bind('관리자 수정 몽골 투어', 'runtime-tour').run();
        const updated = await mf.dispatchFetch('https://mongolia-milkyway.com/products/runtime-tour', { headers: conditionalHeaders });
        assert.equal(updated.status, 200);
        assert.match(await updated.text(), /관리자 수정 몽골 투어/);
        assert.equal(updated.headers.get('ETag'), null);
        assert.equal(updated.headers.get('Last-Modified'), null);
        await db.prepare('UPDATE products SET status = ? WHERE id = ?').bind('inactive', 'runtime-tour').run();
        const unpublished = await mf.dispatchFetch('https://mongolia-milkyway.com/products/runtime-tour', { headers: conditionalHeaders });
        assert.equal(unpublished.status, 404);
        assert.doesNotMatch(await unpublished.text(), /관리자 수정 몽골 투어/);
        await db.prepare('UPDATE products SET status = ? WHERE id = ?').bind('active', 'runtime-tour').run();
        for (const path of ['/assets/runtime.js', '/img/runtime.webp', '/google9b777fb4d640732b.html', '/designs/mongolia-map']) {
            const unchangedAsset = await mf.dispatchFetch(`https://mongolia-milkyway.com${path}`, { headers: conditionalHeaders });
            assert.equal(unchangedAsset.status, 304, path);
            assert.equal(unchangedAsset.headers.get('ETag'), '"fixture-app-v1"', path);
        }
        for (const id of ['missing', 'runtime-draft']) {
            const missing = await mf.dispatchFetch(`https://mongolia-milkyway.com/products/${id}`);
            assert.equal(missing.status, 404);
            assert.match(missing.headers.get('X-Robots-Tag'), /noindex/);
        }
        const admin = await mf.dispatchFetch('https://mongolia-milkyway.com/admin/products');
        assert.equal(admin.headers.get('X-Robots-Tag'), 'noindex, nofollow');
        assert.equal(admin.headers.get('Cache-Control'), 'private, no-store');
        const sitemapResponse = await mf.dispatchFetch('https://mongolia-milkyway.com/sitemap.xml');
        assert.equal(sitemapResponse.status, 200);
        assert.match(await sitemapResponse.text(), /products\/runtime-tour/);
    } finally { await mf.dispose(); }
});
