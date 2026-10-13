// 실제 Hono·Lucia 로그인, 로컬 SQLite, 메모리 R2로 관리자 저장 → 홈 이미지 노출을 검증한다.
// 운영 DB·R2·알림 서비스에 연결하지 않는다. npm ci 후 node scripts/check-admin-media.mjs [--serve]
import { build } from 'esbuild';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { hashPassword } from '../functions/lib/password.ts';

const root = path.resolve(import.meta.dirname, '..');
const scratch = path.join(root, 'work/admin-media');
fs.mkdirSync(scratch, { recursive: true });
const entry = path.join(scratch, 'entry.ts');
fs.writeFileSync(entry, `import { Hono } from 'hono';
import auth from '../../functions/api/auth';
import products from '../../functions/api/products';
import categories from '../../functions/api/categories';
import banners from '../../functions/api/banners';
import magazines from '../../functions/api/magazines';
import upload from '../../functions/api/site-upload';
import * as images from '../../functions/api/images/[...path]';
import { onRequest as middleware } from '../../functions/_middleware.js';
const app = new Hono().basePath('/api');
app.route('/auth', auth); app.route('/products', products); app.route('/categories', categories);
app.route('/banners', banners); app.route('/magazines', magazines); app.route('/site-upload', upload);
if (images.default) app.route('/images', images.default);
export { images, middleware }; export default app;`);
const bundle = path.join(scratch, 'app.mjs');
await build({ entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'esm' });
const { default: app, images, middleware } = await import(pathToFileURL(bundle).href + '?v=' + Date.now());

const raw = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true });
const statement = (sql, args = []) => ({
    bind: (...values) => statement(sql, values),
    async first(column) {
        const row = raw.prepare(sql).get(...args) ?? null;
        return column && row ? row[column] : row;
    },
    async all() { return { results: raw.prepare(sql).all(...args) }; },
    async run() {
        const result = raw.prepare(sql).run(...args);
        return { success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    },
    async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
});
const DB = {
    prepare: sql => statement(sql),
    async batch(list) {
        raw.exec('BEGIN');
        try {
            const results = await Promise.all(list.map(item => item.all()));
            raw.exec('COMMIT');
            return results;
        } catch (error) {
            raw.exec('ROLLBACK');
            throw error;
        }
    },
};
await ensureSiteSchema(DB);
raw.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, google_id TEXT, email TEXT, name TEXT, role TEXT, avatar_url TEXT, password_hash TEXT);
CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER);`);
const password = 'local-media-test-2026';
const passwordHash = await hashPassword(password);
for (const role of ['admin', 'user']) {
    raw.prepare('INSERT INTO users (id,name,email,role,password_hash) VALUES (?,?,?,?,?)')
        .run(role, role === 'admin' ? '로컬 이미지 테스트 관리자' : '로컬 테스트 회원', `${role}@example.invalid`, role, passwordHash);
    raw.prepare('INSERT INTO sessions VALUES (?,?,?)').run(`local-media-${role}-session`, role, Date.now() + 86400000);
}

// R2 API 표면만 재현하며, 사이트 BUCKET과 견적 비공개 FILES를 섞지 않는다.
const objects = new Map();
let bucketReads = 0;
const r2Object = (key, record, includeBody = true) => ({
    key,
    size: record.bytes.length,
    uploaded: record.uploaded,
    etag: record.etag,
    httpEtag: `"${record.etag}"`,
    httpMetadata: record.httpMetadata,
    customMetadata: record.customMetadata,
    ...(includeBody ? { body: new Uint8Array(record.bytes) } : {}),
    writeHttpMetadata(headers) {
        const names = { contentType: 'Content-Type', cacheControl: 'Cache-Control', contentDisposition: 'Content-Disposition' };
        for (const [name, value] of Object.entries(record.httpMetadata)) {
            if (names[name] && value) headers.set(names[name], value);
        }
    },
});
const BUCKET = {
    async put(key, value, options = {}) {
        const bytes = Buffer.from(value instanceof ReadableStream ? await new Response(value).arrayBuffer() : value);
        const record = {
            bytes, uploaded: new Date(), etag: createHash('sha256').update(bytes).digest('hex'),
            httpMetadata: options.httpMetadata || {}, customMetadata: options.customMetadata || {},
        };
        objects.set(key, record);
        return r2Object(key, record, false);
    },
    async get(key, options = {}) {
        bucketReads += 1;
        const record = objects.get(key);
        if (!record) return null;
        const condition = options.onlyIf;
        const doesNotMatch = condition instanceof Headers ? condition.get('if-none-match') : condition?.etagDoesNotMatch;
        const matches = condition instanceof Headers ? condition.get('if-match') : condition?.etagMatches;
        const tag = `"${record.etag}"`;
        const includeBody = !(doesNotMatch === '*' || doesNotMatch === record.etag || doesNotMatch === tag)
            && (!matches || matches === '*' || matches === record.etag || matches === tag);
        return r2Object(key, record, includeBody);
    },
    async head(key) {
        const record = objects.get(key);
        return record ? r2Object(key, record, false) : null;
    },
    async delete(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key); },
};
const env = { DB, BUCKET, ENVIRONMENT: 'production', ADMIN_TOKEN: 'local-media-quote-fixture' };
const admin = { cookie: 'auth_session=local-media-admin-session' };
const member = { cookie: 'auth_session=local-media-user-session' };
const edgeCache = new Map();
globalThis.caches = { default: {
    async match(request) { return edgeCache.get(request.url)?.clone(); },
    async put(request, response) { edgeCache.set(request.url, response.clone()); },
} };

const catalogPhoto = '/img/home/1.webp';
const longDetail = JSON.stringify([{ type: 'text', content: '고비사막 여행 상세 일정 '.repeat(5000) }]);
for (const [id, name, status] of [
    ['gobi-public', '고비사막 별빛 여행 4박 5일', 'active'],
    ['gobi-draft', '미공개 초안 상품', 'draft'],
]) {
    raw.prepare(`INSERT INTO products
        (id,name,description,category,duration,price,original_price,main_images,images,thumbnail,status,
         is_featured,is_popular,featured,popular,tags,detail_blocks,package_type,sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .run(id, name, '고비사막과 은하수를 만나는 로컬 검증용 여행입니다.', '고비사막', '4박 5일', 1290000, 1490000,
            JSON.stringify([catalogPhoto]), JSON.stringify([catalogPhoto]), catalogPhoto, status,
            0, 0, 1, 1, JSON.stringify(['고비사막', '별빛 여행']), longDetail, 'full', status === 'active' ? 0 : 1);
}
for (const [id, name, active] of [['gobi', '고비사막', 1], ['hidden-category', '미공개 카테고리', 0]]) {
    raw.prepare(`INSERT INTO categories (id,name,description,image,is_active,type,sort_order,landing_hero_image,landing_hero_images)
        VALUES (?,?,?,?,?,?,?,?,?)`)
        .run(id, name, '몽골 여행', catalogPhoto, active, 'product', active ? 0 : 1, catalogPhoto, JSON.stringify([catalogPhoto]));
}
for (const [id, title, published] of [['published-magazine', '몽골 고비사막 여행 준비', 1], ['draft-magazine', '미공개 매거진', 0]]) {
    raw.prepare('INSERT INTO magazines (id,title,subtitle,content,thumbnail,category,author,is_published) VALUES (?,?,?,?,?,?,?,?)')
        .run(id, title, '로컬 이미지 검증 자료', '<p>고비사막에서 별을 만나는 여행.</p>', catalogPhoto, '관광', '몽골리아 은하수', published);
}
raw.prepare('INSERT INTO banners (id,image,pc_image,tag,title,subtitle,link,pc_title,pc_subtitle,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run('main-local-banner', catalogPhoto, catalogPhoto, '몽골 여행', '고비사막의 별빛을 만나세요', '몽골리아 은하수와 함께하는 특별한 여행',
        '/products/gobi-public', '고비사막의 별빛을 만나세요', '로컬 검증 화면 · 저장한 이미지를 바로 확인합니다', 0);

async function dispatch(request) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/images/') && !images.default) {
        const handler = request.method === 'HEAD' ? (images.onRequestHead || images.onRequestGet) : (images.onRequestGet || images.onRequest);
        if (handler) return handler({ request, env, params: { path: url.pathname.slice('/api/images/'.length).split('/') } });
    }
    return app.fetch(request, env);
}
const apiRequest = (route, options = {}) => {
    const request = new Request(`http://localhost:8793${route}`, options);
    return middleware({ request, env, next: () => dispatch(request) });
};
const jsonWrite = (route, method, data, headers = admin) => apiRequest(route, {
    method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(data),
});

// 외부 접속 없는 실제 Lucia 로그인, 초안 공개 차단, 홈용 경량 목록.
const login = await jsonWrite('/api/auth/login', 'POST', { email: 'admin@example.invalid', password }, {});
assert.equal(login.status, 200);
assert.match(login.headers.get('set-cookie') || '', /auth_session=/);
const loginCookie = login.headers.get('set-cookie').split(';')[0];
assert.equal((await apiRequest('/api/auth/me', { headers: { cookie: loginCookie } })).status, 200);
for (const [route, visibleId, draftId] of [
    ['/api/products', 'gobi-public', 'gobi-draft'],
    ['/api/categories', 'gobi', 'hidden-category'],
    ['/api/magazines', 'published-magazine', 'draft-magazine'],
]) {
    const publicResponse = await apiRequest(route);
    assert.equal(publicResponse.status, 200, route);
    assert.equal(publicResponse.headers.get('cache-control'), 'no-store');
    const publicRows = await publicResponse.json();
    assert.ok(publicRows.some(row => row.id === visibleId), `공개 목록 누락: ${route}`);
    assert.ok(!publicRows.some(row => row.id === draftId), `공개 목록에 초안 노출: ${route}`);
    const memberRows = await (await apiRequest(route, { headers: member })).json();
    assert.ok(!memberRows.some(row => row.id === draftId), `일반 회원에게 초안 노출: ${route}`);
    const adminRows = await (await apiRequest(route, { headers: admin })).json();
    assert.ok(adminRows.some(row => row.id === draftId), `관리자 초안 관리 불가: ${route}`);
    assert.equal((await apiRequest(`${route}/${draftId}`)).status, 404);
    assert.equal((await apiRequest(`${route}/${draftId}`, { headers: admin })).status, 200);
}
const fullPayload = await (await apiRequest('/api/products')).text();
const summaryPayload = await (await apiRequest('/api/products?summary=1')).text();
assert.ok(Buffer.byteLength(summaryPayload) < Buffer.byteLength(fullPayload) / 5, '홈 목록에 긴 상세 일정이 포함됐습니다.');
const summary = JSON.parse(summaryPayload);
assert.equal(summary[0].name, '고비사막 별빛 여행 4박 5일');
assert.deepEqual(summary[0].mainImages, [catalogPhoto]);
assert.ok(!('detail_blocks' in summary[0]));
assert.equal(summary[0].isFeatured, true, '레거시 추천 플래그가 홈에서 사라졌습니다.');
assert.equal(summary[0].isPopular, true, '레거시 인기 플래그가 홈에서 사라졌습니다.');

// 관리자 매거진의 임시저장/공개 선택은 실제 공개 조회와 일치해야 한다.
const draftArticle = { id: 'saved-draft', title: '저장한 초안', content: '<p>아직 공개하지 않은 글</p>', is_active: false };
assert.equal((await jsonWrite('/api/magazines', 'POST', draftArticle, {})).status, 401);
assert.equal((await jsonWrite('/api/magazines', 'POST', draftArticle)).status, 200);
assert.equal((await apiRequest('/api/magazines/saved-draft')).status, 404);
assert.equal(raw.prepare('SELECT is_published FROM magazines WHERE id=?').get('saved-draft').is_published, 0);
assert.equal((await jsonWrite('/api/magazines/saved-draft', 'PUT', { ...draftArticle, is_published: true })).status, 200);
assert.equal((await apiRequest('/api/magazines/saved-draft')).status, 200);
assert.equal((await jsonWrite('/api/magazines', 'POST', { id: 'default-draft', title: '공개 선택 없는 새 글' })).status, 200);
assert.equal((await apiRequest('/api/magazines/default-draft')).status, 404);

// 구 DB에 두 공개 플래그가 있더라도 재저장하면 둘이 같은 상태가 된다.
raw.exec('ALTER TABLE magazines ADD COLUMN is_active INTEGER');
raw.prepare('UPDATE magazines SET is_active=0 WHERE id=?').run('saved-draft');
assert.equal((await apiRequest('/api/magazines/saved-draft')).status, 404);
assert.equal((await jsonWrite('/api/magazines/saved-draft', 'PUT', { title: '공개 선택을 바꾸지 않은 재저장' })).status, 200);
assert.equal(raw.prepare('SELECT is_published FROM magazines WHERE id=?').get('saved-draft').is_published, 0);
assert.equal((await apiRequest('/api/magazines/saved-draft')).status, 404);
assert.equal((await jsonWrite('/api/magazines/saved-draft', 'PUT', { ...draftArticle, is_published: true })).status, 200);
assert.equal(raw.prepare('SELECT is_active FROM magazines WHERE id=?').get('saved-draft').is_active, 1);
assert.equal((await apiRequest('/api/magazines/saved-draft')).status, 200);
assert.equal((await jsonWrite('/api/magazines/saved-draft', 'PUT', { ...draftArticle, is_published: false })).status, 200);
assert.equal(raw.prepare('SELECT is_active FROM magazines WHERE id=?').get('saved-draft').is_active, 0);
assert.equal((await apiRequest('/api/magazines/saved-draft')).status, 404);

// 같은 WebP 사진으로 실제 multipart 원본+반응형 파생본을 만든다.
const photoBytes = fs.readFileSync(path.join(root, 'public', catalogPhoto));
const original = await sharp(photoBytes).resize({ width: 1200 }).webp({ quality: 82 }).toBuffer();
const metadata = await sharp(original).metadata();
const widths = [320, 640, 960];
const variants = await Promise.all(widths.map(async width => ({ width, bytes: await sharp(original).resize({ width }).webp({ quality: 78 }).toBuffer() })));
fs.writeFileSync(path.join(scratch, 'upload-fixture.webp'), original);
const uploadForm = (responsive = true) => {
    const form = new FormData();
    form.append('file', new File([original], 'local-gobi.webp', { type: 'image/webp' }));
    form.append('folder', 'products');
    if (responsive) {
        form.append('imageManifest', JSON.stringify({ version: 1, width: metadata.width, height: metadata.height, widths }));
        for (const variant of variants) form.append(`variant_${variant.width}`, new File([variant.bytes], `gobi-${variant.width}.webp`, { type: 'image/webp' }));
    }
    return form;
};
for (const [headers, expected] of [[{}, 401], [member, 403], [{ cookie: 'auth_session=expired-media-session' }, 401]]) {
    assert.equal((await apiRequest('/api/site-upload', { method: 'POST', headers, body: uploadForm() })).status, expected);
}
assert.equal(objects.size, 0, '권한 없는 업로드가 R2에 저장됐습니다.');
const uploaded = await apiRequest('/api/site-upload', { method: 'POST', headers: { cookie: loginCookie }, body: uploadForm() });
assert.equal(uploaded.status, 200);
assert.equal(uploaded.headers.get('cache-control'), 'no-store');
const upload = await uploaded.json();
assert.equal(upload.success, true);
assert.match(upload.url, /^\/api\/images\/products\/.+\.webp$/);
assert.equal(objects.size, widths.length + 1);
for (const width of widths) assert.ok(objects.has(upload.url.slice('/api/images/'.length).replace(/\.webp$/, `.w${width}.webp`)), `파생 이미지 ${width}px 누락`);

// 업로드만으로 상품을 바꾸지 않고, 저장 완료 직후 홈 조회가 새 URL을 반환한다.
const beforeSave = await (await apiRequest('/api/products/gobi-public')).json();
assert.deepEqual(beforeSave.mainImages, [catalogPhoto]);
assert.equal((await jsonWrite('/api/products/gobi-public', 'PUT', { mainImages: [upload.url] }, {})).status, 401);
const saved = await jsonWrite('/api/products/gobi-public', 'PUT', { mainImages: [upload.url] }, { cookie: loginCookie });
assert.equal(saved.status, 200);
assert.equal(saved.headers.get('cache-control'), 'no-store');
const homeAfterSave = await (await apiRequest('/api/products?summary=1')).json();
assert.deepEqual(homeAfterSave[0].mainImages, [upload.url]);
const savedProduct = raw.prepare('SELECT thumbnail,images,main_images FROM products WHERE id=?').get('gobi-public');
assert.equal(savedProduct.thumbnail, upload.url);
assert.deepEqual(JSON.parse(savedProduct.images), [upload.url]);
assert.deepEqual(JSON.parse(savedProduct.main_images), [upload.url]);
const bannersSaved = await jsonWrite('/api/banners', 'PUT', {
    banners: [{ id: 'main-local-banner', image: upload.url, pcImage: upload.url, tag: '몽골 여행',
        title: '고비사막의 별빛을 만나세요', subtitle: '저장한 사진이 바로 반영되는 로컬 검증 화면', link: '/products/gobi-public' }],
    quickLinks: [], eventBanners: [], categoryTabs: [],
});
assert.equal(bannersSaved.status, 200);
assert.equal((await (await apiRequest('/api/banners')).json()).banners[0].pc_image, upload.url);

// 정상 공개 이미지만 장기 캐시. API JSON·로그인·실패 응답은 no-store.
const readsBeforeImage = bucketReads;
const image = await apiRequest(upload.url);
assert.equal(image.status, 200);
assert.equal(image.headers.get('content-type'), 'image/webp');
assert.match(image.headers.get('cache-control') || '', /public.*max-age=31536000.*immutable/);
assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
const etag = image.headers.get('etag');
assert.ok(etag);
assert.deepEqual(Buffer.from(await image.arrayBuffer()), original);
assert.equal(bucketReads, readsBeforeImage + 1);
assert.ok(edgeCache.has(`http://localhost:8793${upload.url}`));
const notModified = await apiRequest(upload.url, { headers: { 'If-None-Match': etag } });
assert.equal(notModified.status, 304);
assert.equal((await notModified.arrayBuffer()).byteLength, 0);
assert.equal(notModified.headers.get('etag'), etag);
const head = await apiRequest(upload.url, { method: 'HEAD' });
assert.equal(head.status, 200);
assert.equal((await head.arrayBuffer()).byteLength, 0);
assert.equal(head.headers.get('etag'), etag);
assert.equal(bucketReads, readsBeforeImage + 1, '캐시 적중·조건부 GET·HEAD가 R2를 다시 읽었습니다.');
const absentImage = await apiRequest('/api/images/products/does-not-exist.webp');
assert.equal(absentImage.status, 404);
assert.equal(absentImage.headers.get('cache-control'), 'no-store');
const account = await apiRequest('/api/auth/me', { headers: admin });
assert.equal(account.headers.get('cache-control'), 'no-store');
const privateAttachment = await middleware({
    request: new Request('http://localhost:8793/api/file/private-customer-document'), env,
    next: () => new Response(original, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000' } }),
});
assert.equal(privateAttachment.headers.get('cache-control'), 'no-store', '견적 고객 첨부는 공개 이미지 캐시 예외에 포함할 수 없습니다.');
console.log(`관리자 이미지 API: 실제 로그인·권한·초안 차단·반응형 업로드·저장 후 홈 반영·ETag/304/HEAD·엣지 캐시/R2 재조회 방지·비공개 첨부 캐시 금지 검사 통과 (홈 목록 ${Buffer.byteLength(fullPayload).toLocaleString()} → ${Buffer.byteLength(summaryPayload).toLocaleString()} bytes)`);

if (process.argv.includes('--serve')) {
    const mutablePrefixes = ['/api/products', '/api/categories', '/api/banners', '/api/magazines', '/api/site-upload'];
    const emptyLists = new Set(['/api/reviews', '/api/notifications', '/api/reservations', '/api/quotes', '/api/guides', '/api/promotions', '/api/hotels', '/api/tourist-spots', '/api/design-spots', '/api/quick-links', '/api/event-banners', '/api/faqs', '/api/tour-faqs', '/api/wishlist', '/api/recently-viewed', '/api/travel-mates']);
    const server = http.createServer(async (req, res) => {
        try {
            const url = new URL(req.url, 'http://localhost:8793');
            if (url.pathname.startsWith('/api/')) {
                const chunks = [];
                for await (const chunk of req) chunks.push(chunk);
                const options = { method: req.method, headers: req.headers };
                if (chunks.length) options.body = Buffer.concat(chunks);
                let response;
                const canMutate = mutablePrefixes.some(prefix => url.pathname === prefix || url.pathname.startsWith(prefix + '/'))
                    || url.pathname === '/api/auth/login' || url.pathname === '/api/auth/logout';
                if (!['GET', 'HEAD'].includes(req.method) && !canMutate) {
                    response = Response.json({ error: '로컬 이미지·카탈로그 검증 범위 밖의 변경입니다.' }, { status: 403 });
                } else if (req.method === 'GET' && emptyLists.has(url.pathname)) {
                    response = Response.json([]);
                } else if (req.method === 'GET' && url.pathname === '/api/settings') {
                    response = Response.json({});
                } else if (req.method === 'GET' && url.pathname === '/api/requests') {
                    response = Response.json({ ok: true, items: [] });
                } else if (req.method === 'GET' && url.pathname.startsWith('/api/data/')) {
                    response = Response.json({ ok: true, data: [] });
                } else response = await apiRequest(url.pathname + url.search, options);
                res.writeHead(response.status, Object.fromEntries(response.headers));
                res.end(Buffer.from(await response.arrayBuffer()));
                return;
            }
            let relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
            if (!path.extname(relative) && fs.existsSync(path.join(root, 'public', relative + '.html'))) relative += '.html';
            let file = path.resolve(root, 'public', relative);
            if (!file.startsWith(path.join(root, 'public') + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                file = path.resolve(root, 'dist', relative);
                if (!file.startsWith(path.join(root, 'dist') + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'dist', 'index.html');
            }
            const types = { '.html': 'text/html;charset=utf-8', '.js': 'text/javascript;charset=utf-8', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.woff2': 'font/woff2', '.mp4': 'video/mp4' };
            res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(file));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'text/plain;charset=utf-8', 'Cache-Control': 'no-store' });
            res.end(String(error));
        }
    });
    server.listen(8793, '127.0.0.1', () => console.log('관리자 이미지 로컬 검증: http://localhost:8793/admin/login · admin@example.invalid / local-media-test-2026 · 업로드 테스트 사진 work/admin-media/upload-fixture.webp'));
} else raw.close();
