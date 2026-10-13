import { Hono } from 'hono';

type Env = {
    BUCKET: any;
};

const app = new Hono<{ Bindings: Env }>();

app.get('/*', async (c) => {
    // The path will be something like `/api/images/banners/1234.webp`
    // We can extract the relative path from the request URL
    const url = new URL(c.req.url);
    const path = url.pathname.replace('/api/images/', '');

    if (!path) {
        return c.json({ error: 'No image path provided' }, 400);
    }

    if (!c.env.BUCKET) {
        return c.json({ error: 'Storage not configured properly' }, 500);
    }

    try {
        const object = await c.env.BUCKET.get(path);

        if (!object) {
            return c.json({ error: 'Image not found' }, 404);
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        // Add cache control for better performance
        headers.set('Cache-Control', 'public, max-age=31536000');
        // Serve uploads strictly as the type they were stored with.
        headers.set('X-Content-Type-Options', 'nosniff');

        return new Response(object.body, {
            headers,
        });
    } catch (e: any) {
        console.error('API Images Error:', e);
        return c.json({ error: 'Failed to fetch image' }, 500);
    }
});

export default app;
