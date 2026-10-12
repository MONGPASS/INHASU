import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { initializeLucia } from '../lib/auth';

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
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 11)}.${ext}`;
        const filePath = `${targetFolder}/${fileName}`;

        // Convert the file to an ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Ensure R2 bucket is bound
        if (!c.env.BUCKET) {
            console.error('R2 BUCKET is not defined in environment bindings');
            return c.json({ error: 'Storage not configured properly' }, 500);
        }

        // Upload to Cloudflare R2
        await c.env.BUCKET.put(filePath, arrayBuffer, {
            httpMetadata: {
                contentType,
            },
        });

        // The public URL requires a custom domain or a dev URL for R2 if not using workers.dev.
        // Assuming we serve them directly from the bucket via Cloudflare Pages or a custom subdomain
        // For Cloudflare Pages, we might need a separate route to serve them, or an R2 custom domain.
        // If the user hasn't set up an R2 Custom Domain, returning a path that the Pages can intercept:
        const publicUrl = `/api/images/${filePath}`;

        return c.json({ success: true, url: publicUrl });

    } catch (e: any) {
        console.error('File upload API error:', e);
        return c.json({ error: e.message || 'File upload failed' }, 500);
    }
});

export default app;
