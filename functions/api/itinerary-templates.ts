import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

interface Env { DB: any; }
const app = new Hono<{ Bindings: Env }>();

// Internal itinerary library: only admin screens read or write it.
// Customers get their itinerary through /api/documents and /api/quotes/:id.
app.use('*', requireAdmin);

app.get('/', async (c) => {
    try {
        const result = await c.env.DB.prepare('SELECT * FROM itinerary_templates ORDER BY created_at DESC').all();
        return c.json(result.results);
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.post('/', async (c) => {
    const data = await c.req.json();
    const id = crypto.randomUUID();
    try {
        await c.env.DB.prepare(
            `INSERT INTO itinerary_templates (id, name, description, days, created_at) VALUES (?, ?, ?, ?, datetime('now'))`
        ).bind(id, String(data.name || ''), String(data.description || ''), JSON.stringify(data.days || [])).run();
        return c.json({ id });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    try {
        await c.env.DB.prepare(
            `UPDATE itinerary_templates SET name=?, description=?, days=? WHERE id=?`
        ).bind(String(data.name || ''), String(data.description || ''), JSON.stringify(data.days || []), id).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    try {
        await c.env.DB.prepare('DELETE FROM itinerary_templates WHERE id=?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default app;