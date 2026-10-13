import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

const app = new Hono<{ Bindings: Env }>();

// GET /api/guides
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM travel_guides ORDER BY created_at DESC').all();
        return c.json(result.results);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/guides/:id
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM travel_guides WHERE id=?').bind(id).first();
        if (!result) return c.json({ error: 'Not found' }, 404);
        return c.json(result);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/guides
app.post('/', requireAdmin, async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    const id = data.id || crypto.randomUUID();
    try {
        await db.prepare(
            "INSERT INTO travel_guides (id, title, subtitle, content, thumbnail, category, tags, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(id, data.title, data.subtitle || '', data.content || '', data.thumbnail || '', data.category || '',
            JSON.stringify(data.tags || []), data.is_published ?? 1).run();
        return c.json({ id, ...data });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/guides/:id
app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const db = c.env.DB;
    try {
        await db.prepare(
            "UPDATE travel_guides SET title=?, subtitle=?, content=?, thumbnail=?, category=?, tags=?, is_published=?, updated_at=datetime('now') WHERE id=?"
        ).bind(data.title, data.subtitle || '', data.content || '', data.thumbnail || '', data.category || '',
            JSON.stringify(data.tags || []), data.is_published ?? 1, id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/guides/:id
app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        await db.prepare('DELETE FROM travel_guides WHERE id=?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
