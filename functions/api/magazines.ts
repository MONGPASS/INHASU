import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

const app = new Hono<{ Bindings: Env }>();

/**
 * Extract `src` from a pasted Google Maps iframe HTML, or pass through
 * a raw URL. Anything else returns null so the frontend can hide the map.
 */
const sanitizeEmbedUrl = (raw: string | null | undefined): string | null => {
    if (!raw) return null;
    const v = String(raw).trim();
    if (!v) return null;
    const srcMatch = v.match(/src=["']([^"']+)["']/i);
    const url = srcMatch ? srcMatch[1] : v;
    if (!/^https?:\/\//i.test(url)) return null;
    if (!/google\.com\/maps/i.test(url)) return null;
    return url;
};

// GET /api/magazines
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM magazines ORDER BY created_at DESC').all();
        return c.json(result.results);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/magazines/:id
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM magazines WHERE id=?').bind(id).first();
        if (!result) return c.json({ error: 'Not found' }, 404);
        return c.json(result);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/magazines
app.post('/', requireAdmin, async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    const id = data.id || crypto.randomUUID();
    const mapEmbedUrl = sanitizeEmbedUrl(data.map_embed_url ?? data.mapEmbedUrl);
    const locationHours = typeof data.location_hours === 'string'
        ? data.location_hours
        : (data.location_hours ? JSON.stringify(data.location_hours) : null);
    try {
        await db.prepare(
            `INSERT INTO magazines
                (id, title, subtitle, content, thumbnail, category, author, author_image, is_published,
                 location_name, location_address, location_phone, location_website,
                 location_hours, map_embed_url, map_query)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id,
            data.title,
            data.subtitle || '',
            data.content || '',
            data.thumbnail || '',
            data.category || '',
            data.author || '',
            data.author_image ?? data.authorImage ?? null,
            data.is_published ?? 1,
            data.location_name ?? data.locationName ?? null,
            data.location_address ?? data.locationAddress ?? null,
            data.location_phone ?? data.locationPhone ?? null,
            data.location_website ?? data.locationWebsite ?? null,
            locationHours,
            mapEmbedUrl,
            data.map_query ?? data.mapQuery ?? null,
        ).run();
        return c.json({ id, ...data });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/magazines/:id
app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const db = c.env.DB;
    const mapEmbedUrl = sanitizeEmbedUrl(data.map_embed_url ?? data.mapEmbedUrl);
    const locationHours = typeof data.location_hours === 'string'
        ? data.location_hours
        : (data.location_hours ? JSON.stringify(data.location_hours) : null);
    try {
        await db.prepare(
            `UPDATE magazines SET
                title=?, subtitle=?, content=?, thumbnail=?, category=?, author=?, author_image=?, is_published=?,
                location_name=?, location_address=?, location_phone=?, location_website=?,
                location_hours=?, map_embed_url=?, map_query=?,
                updated_at=datetime('now')
             WHERE id=?`
        ).bind(
            data.title,
            data.subtitle || '',
            data.content || '',
            data.thumbnail || '',
            data.category || '',
            data.author || '',
            data.author_image ?? data.authorImage ?? null,
            data.is_published ?? 1,
            data.location_name ?? data.locationName ?? null,
            data.location_address ?? data.locationAddress ?? null,
            data.location_phone ?? data.locationPhone ?? null,
            data.location_website ?? data.locationWebsite ?? null,
            locationHours,
            mapEmbedUrl,
            data.map_query ?? data.mapQuery ?? null,
            id,
        ).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/magazines/:id
app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        await db.prepare('DELETE FROM magazines WHERE id=?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
