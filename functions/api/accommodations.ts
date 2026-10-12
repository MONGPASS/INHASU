import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

const app = new Hono<{ Bindings: Env }>();

// GET /api/accommodations
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM accommodations ORDER BY name ASC').all();
        return c.json(result.results);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/accommodations/:id
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM accommodations WHERE id=?').bind(id).first();
        if (!result) return c.json({ error: 'Not found' }, 404);
        return c.json(result);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/accommodations/bulk
app.post('/bulk', requireAdmin, async (c) => {
    const body = await c.req.json();
    const db = c.env.DB;
    const items: any[] = body.accommodations || [];
    try {
        for (const a of items) {
            const id = a.id || crypto.randomUUID();
            const existing = await db.prepare('SELECT id FROM accommodations WHERE id=?').bind(id).first();
            if (existing) {
                await db.prepare(
                    "UPDATE accommodations SET name=?, description=?, location=?, type=?, images=?, thumbnail=?, amenities=?, facilities=?, is_active=? WHERE id=?"
                ).bind(
                    a.name || '',
                    a.description || '',
                    a.location || '',
                    a.type || '',
                    JSON.stringify(Array.isArray(a.images) ? a.images : []),
                    a.thumbnail || (Array.isArray(a.images) && a.images[0]) || '',
                    JSON.stringify(a.amenities || []),
                    JSON.stringify(a.facilities || []),
                    a.is_active ?? 1,
                    id
                ).run();
            } else {
                await db.prepare(
                    "INSERT INTO accommodations (id, name, description, location, type, images, thumbnail, amenities, facilities, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                ).bind(
                    id,
                    a.name || '',
                    a.description || '',
                    a.location || '',
                    a.type || '',
                    JSON.stringify(Array.isArray(a.images) ? a.images : []),
                    a.thumbnail || (Array.isArray(a.images) && a.images[0]) || '',
                    JSON.stringify(a.amenities || []),
                    JSON.stringify(a.facilities || []),
                    a.is_active ?? 1
                ).run();
            }
        }
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/accommodations
app.post('/', requireAdmin, async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    const id = data.id || crypto.randomUUID();
    try {
        await db.prepare(
            "INSERT INTO accommodations (id, name, description, location, price_per_night, images, thumbnail, amenities, rating, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(id, data.name, data.description || '', data.location || '', data.price_per_night || 0,
            JSON.stringify(data.images || []), data.thumbnail || '', JSON.stringify(data.amenities || []), data.rating || 0, data.is_active ?? 1).run();
        return c.json({ id, ...data });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/accommodations/:id
app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const db = c.env.DB;
    try {
        await db.prepare(
            "UPDATE accommodations SET name=?, description=?, location=?, price_per_night=?, images=?, thumbnail=?, amenities=?, rating=?, is_active=? WHERE id=?"
        ).bind(data.name, data.description || '', data.location || '', data.price_per_night || 0,
            JSON.stringify(data.images || []), data.thumbnail || '', JSON.stringify(data.amenities || []), data.rating || 0, data.is_active ?? 1, id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/accommodations/:id
app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        await db.prepare('DELETE FROM accommodations WHERE id=?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
