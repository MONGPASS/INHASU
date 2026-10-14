import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { initializeLucia } from '../lib/auth';
import { MAX_IMAGE_UPLOAD_BYTES, PUBLIC_IMAGE_CACHE, parseImageManifest, rasterContentType, variantMatches, webpDimensions } from '../lib/imageVariants';

type Env = {
    BUCKET: any;
    DB: any;
};

const app = new Hono<{ Bindings: Env }>();

// Folders any authenticated user is allowed to upload to. Everything else
// (banners, products, magazines, etc.) stays admin-only.
const PUBLIC_FOLDERS = new Set([
    'reviews',
    'travel-mates',
]);

// Members upload photos only. Uploads are served back from this origin, so anything
// a browser would render as a page (HTML, SVG) must not get in through this path.
const MEMBER_IMAGE_TYPES: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    heic: 'image/heic',
    heif: 'image/heif',
};

app.post('/', async (c) => {
    try {
        const body = await c.req.parseBody();
        const file = body['file'];
        const folder = String(body['folder'] || 'common');

        if (!file || typeof file === 'string') {
            return c.json({ error: 'No file uploaded' }, 400);
        }
        if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)*$/.test(folder)) {
            return c.json({ error: '올바른 이미지 폴더를 선택해 주세요.' }, 400);
        }
        if (file.size > MAX_IMAGE_UPLOAD_BYTES) return c.json({ error: '이미지는 10MB 이하로 업로드해 주세요.' }, 413);

        // ---- Auth: any logged-in session ----
        const lucia = initializeLucia(c.env.DB);
        const sessionId = getCookie(c, lucia.sessionCookieName);
        if (!sessionId) {
            return c.json({ error: 'Unauthorized' }, 401);
        }
        const { session, user } = await lucia.validateSession(sessionId);
        if (!session || !user) {
            return c.json({ error: 'Unauthorized' }, 401);
        }

        // Refresh session cookie if it's near expiry, mirroring requireAdmin.
        if (session.fresh) {
            const sessionCookie = lucia.createSessionCookie(session.id);
            c.header('Set-Cookie', sessionCookie.serialize(), { append: true });
        }

        // ---- Authz: only admins may upload to non-public folders ----
        const folderRoot = folder.split('/')[0];
        const isPublic = PUBLIC_FOLDERS.has(folderRoot);
        if (!isPublic && user.role !== 'admin') {
            return c.json({ error: 'Forbidden' }, 403);
        }

        // Generate a unique filename
        let ext = (file.name.split('.').pop() || 'webp').toLowerCase();
        let contentType = file.type;
        let targetFolder = folder;
        if (user.role !== 'admin') {
            // Trust the declared type when it is an allowed image type; fall back to the
            // file extension only when the browser could not name one (some HEIC uploads).
            const declaredType = (file.type || '').toLowerCase();
            const untyped = !declaredType || declaredType === 'application/octet-stream';
            const imageType = Object.values(MEMBER_IMAGE_TYPES).includes(declaredType)
                ? declaredType
                : (untyped ? MEMBER_IMAGE_TYPES[ext] : undefined);
            if (!imageType) {
                return c.json({ error: 'Only image files can be uploaded' }, 400);
            }
            contentType = imageType;
            ext = Object.keys(MEMBER_IMAGE_TYPES).find((key) => MEMBER_IMAGE_TYPES[key] === imageType) || 'webp';
            targetFolder = folderRoot;
        }
        // Convert the file to an ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        // All uploads are publicly served; verify raster bytes even for admin uploads.
        const verifiedType = rasterContentType(contentType, arrayBuffer);
        if (!verifiedType) return c.json({ error: 'JPG, PNG, WebP 등 사진 파일만 업로드할 수 있습니다.' }, 415);
        contentType = verifiedType;
        ext = Object.keys(MEMBER_IMAGE_TYPES).find(key => MEMBER_IMAGE_TYPES[key] === verifiedType) || 'webp';
        let manifest;
        try { manifest = parseImageManifest(body['imageManifest'], webpDimensions(arrayBuffer)); }
        catch (error: any) { return c.json({ error: error.message }, 400); }
        const copies: { width: number; buffer: ArrayBuffer }[] = [];
        for (const width of manifest?.widths || []) {
            const copy = body[`variant_${width}`];
            if (!copy || typeof copy === 'string' || copy.size > MAX_IMAGE_UPLOAD_BYTES || copy.type !== 'image/webp') {
                return c.json({ error: '이미지 축소본이 올바르지 않습니다.' }, 400);
            }
            const buffer = await copy.arrayBuffer();
            if (!variantMatches(webpDimensions(buffer), width, manifest!)) {
                return c.json({ error: '이미지 축소본 크기가 실제 파일과 일치하지 않습니다.' }, 400);
            }
            copies.push({ width, buffer });
        }
        if (arrayBuffer.byteLength + copies.reduce((sum, copy) => sum + copy.buffer.byteLength, 0) > 20 * 1024 * 1024) {
            return c.json({ error: '이미지 파일의 합계는 20MB 이하여야 합니다.' }, 413);
        }
        const suffix = manifest ? `_v1_${manifest.width}x${manifest.height}_${manifest.widths.join('-') || 'none'}` : '';
        const filePath = `${targetFolder}/${crypto.randomUUID()}${suffix}.${ext}`;

        // Ensure R2 bucket is bound
        if (!c.env.BUCKET) {
            console.error('R2 BUCKET is not defined in environment bindings');
            return c.json({ error: 'Storage not configured properly' }, 500);
        }

        // Upload to Cloudflare R2
        const stored: string[] = [];
        try {
            for (const copy of copies) {
                const copyPath = filePath.replace(/\.webp$/, `.w${copy.width}.webp`);
                await c.env.BUCKET.put(copyPath, copy.buffer, { httpMetadata: { contentType: 'image/webp', cacheControl: PUBLIC_IMAGE_CACHE } });
                stored.push(copyPath);
            }
            await c.env.BUCKET.put(filePath, arrayBuffer, { httpMetadata: { contentType, cacheControl: PUBLIC_IMAGE_CACHE } });
            stored.push(filePath);
        } catch (error) {
            // Never return a manifest that advertises missing sizes after a partial upload.
            if (c.env.BUCKET.delete) await Promise.allSettled(stored.map(path => c.env.BUCKET.delete(path)));
            throw error;
        }

        // The public URL requires a custom domain or a dev URL for R2 if not using workers.dev.
        // Assuming we serve them directly from the bucket via Cloudflare Pages or a custom subdomain
        // For Cloudflare Pages, we might need a separate route to serve them, or an R2 custom domain.
        // If the user hasn't set up an R2 Custom Domain, returning a path that the Pages can intercept:
        const publicUrl = `/api/images/${filePath}`;

        return c.json({ success: true, url: publicUrl, ...(manifest ? { width: manifest.width, height: manifest.height } : {}) });

    } catch (e: any) {
        console.error('File upload API error:', e);
        return c.json({ error: e.message || 'File upload failed' }, 500);
    }
});

export default app;
