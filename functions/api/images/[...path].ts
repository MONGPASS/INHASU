import { Hono } from 'hono';
import { PUBLIC_IMAGE_CACHE } from '../../lib/imageVariants';

type Env = {
    BUCKET: any;
};

const app = new Hono<{ Bindings: Env }>();

app.on(['GET', 'HEAD'], '/*', async (c) => {
    // The path will be something like `/api/images/banners/1234.webp`
    // We can extract the relative path from the request URL
    const url = new URL(c.req.url);
    const path = url.pathname.replace('/api/images/', '');

    if (!path || path.split('/').some(part => !part || part === '.' || part === '..')) {
        return c.json({ error: 'No image path provided' }, 400);
    }

    if (!c.env.BUCKET) {
        return c.json({ error: 'Storage not configured properly' }, 500);
    }

    try {
        // Pages Functions are dynamic: a browser cache header alone does not cache R2 at the edge.
        const cache = (globalThis as any).caches?.default;
        const cacheKey = new Request(url.toString(), { method: 'GET' });
        const cached: Response | undefined = cache ? await cache.match(cacheKey) : undefined;
        if (cached) {
            if (c.req.header('If-None-Match')?.split(',').map(value => value.trim().replace(/^W\//, '')).includes(cached.headers.get('ETag') || '')) {
                return new Response(null, { status: 304, headers: cached.headers });
            }
            return c.req.method === 'HEAD' ? new Response(null, { headers: cached.headers }) : cached;
        }
        const object = await c.env.BUCKET.get(path);

        if (!object) {
            return c.json({ error: 'Image not found' }, 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        if (Number.isFinite(object.size)) headers.set('Content-Length', String(object.size));
        // Add cache control for better performance
        const isImage = /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/.test(headers.get('Content-Type') || '');
        headers.set('Cache-Control', isImage ? PUBLIC_IMAGE_CACHE : 'no-store');
        // Serve uploads strictly as the type they were stored with.
        headers.set('X-Content-Type-Options', 'nosniff');

        if (!isImage) headers.set('Content-Disposition', 'attachment');
        const response = new Response(object.body, { headers });
        if (cache && isImage) {
            // Only bytes from the public BUCKET enter this cache; customer FILES never do.
            const write = cache.put(cacheKey, response.clone()).catch(() => {});
            try { c.executionCtx.waitUntil(write); } catch { await write; }
        }
        if (c.req.header('If-None-Match')?.split(',').map(value => value.trim().replace(/^W\//, '')).includes(object.httpEtag)) {
            return new Response(null, { status: 304, headers });
        }
        return c.req.method === 'HEAD' ? new Response(null, { headers }) : response;
    } catch (e: any) {
        console.error('API Images Error:', e);
        return c.json({ error: 'Failed to fetch image' }, 500);
    }
});

export default app;
