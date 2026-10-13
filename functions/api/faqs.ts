import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

const app = new Hono<{ Bindings: Env }>();

const activeFlag = (v: unknown) => (v === false || v === 0 || v === '0' || v === 'false' ? 0 : 1);

// GET /api/faqs (public). `order` mirrors sort_order for the admin page.
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM faqs ORDER BY sort_order ASC').all();
        return c.json((result.results as any[]).map((r) => ({ ...r, order: r.sort_order })));
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/faqs (admin)
app.post('/', requireAdmin, async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    const id = typeof data.id === 'string' && data.id ? data.id : crypto.randomUUID();
    try {
        await db.prepare(
            "INSERT INTO faqs (id, question, answer, category, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(
            id,
            String(data.question ?? ''),
            String(data.answer ?? ''),
            data.category || 'general',
            Number(data.sort_order ?? data.order) || 0,
            activeFlag(data.is_active ?? data.isActive),
        ).run();
        return c.json({ ...data, id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/faqs/:id (admin) — only the fields present in the body are changed.
app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const db = c.env.DB;

    const sets: string[] = [];
    const values: (string | number)[] = [];
    const set = (column: string, value: string | number) => { sets.push(`${column} = ?`); values.push(value); };

    if (data.question !== undefined) set('question', String(data.question ?? ''));
    if (data.answer !== undefined) set('answer', String(data.answer ?? ''));
    if (data.category !== undefined) set('category', data.category || 'general');
    const order = data.sort_order ?? data.order;
    if (order !== undefined) set('sort_order', Number(order) || 0);
    const active = data.is_active ?? data.isActive;
    if (active !== undefined) set('is_active', activeFlag(active));

    try {
        if (sets.length > 0) {
            await db.prepare(`UPDATE faqs SET ${sets.join(', ')} WHERE id = ?`).bind(...values, id).run();
        }
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/faqs/:id (admin)
app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        await db.prepare('DELETE FROM faqs WHERE id=?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/faqs/bulk (admin) — replace all. Registered after /:id, so it is not reachable today.
app.put('/bulk', requireAdmin, async (c) => {
    const { faqs } = await c.req.json();
    const db = c.env.DB;
    try {
        const stmts: D1PreparedStatement[] = [db.prepare('DELETE FROM faqs')];
        for (let i = 0; i < faqs.length; i++) {
            const f = faqs[i];
            stmts.push(db.prepare(
                "INSERT INTO faqs (id, question, answer, category, sort_order, is_active) VALUES (?, ?, ?, ?, ?, ?)"
            ).bind(f.id || crypto.randomUUID(), f.question, f.answer, f.category || 'general', i, f.is_active ?? 1));
        }
        await db.batch(stmts);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
