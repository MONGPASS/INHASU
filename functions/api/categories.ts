import { Hono } from 'hono';
import type { D1PreparedStatement } from '@cloudflare/workers-types';
import { requireAdmin } from '../lib/adminAuth';

type Env = {
    DB: any; // Using any for simplicity or you can use D1Database if imported
};

const app = new Hono<{ Bindings: Env }>();

// GET /api/categories
app.get('/', async (c) => {
    const db = c.env.DB;
    const type = c.req.query('type');
    try {
        let result;
        if (type) {
            result = await db.prepare('SELECT * FROM categories WHERE type = ? ORDER BY sort_order ASC').bind(type).all();
        } else {
            result = await db.prepare('SELECT * FROM categories ORDER BY sort_order ASC').all();
        }
        // Parse JSON landing_highlights / landing_hero_images if present
        const rows = (result.results || []).map((r: any) => ({
            ...r,
            landing_highlights: (() => {
                if (!r.landing_highlights) return [];
                if (typeof r.landing_highlights !== 'string') return r.landing_highlights;
                try { return JSON.parse(r.landing_highlights); } catch { return []; }
            })(),
            landing_hero_images: (() => {
                if (!r.landing_hero_images) return [];
                if (typeof r.landing_hero_images !== 'string') return r.landing_hero_images;
                try { return JSON.parse(r.landing_hero_images); } catch { return []; }
            })(),
        }));
        return c.json(rows);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/categories/:slug — single category by id (used by /category/:slug page)
app.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    const db = c.env.DB;
    try {
        const row: any = await db.prepare('SELECT * FROM categories WHERE id = ? LIMIT 1').bind(slug).first();
        if (!row) return c.json({ error: 'Not found' }, 404);
        row.landing_highlights = (() => {
            if (!row.landing_highlights) return [];
            if (typeof row.landing_highlights !== 'string') return row.landing_highlights;
            try { return JSON.parse(row.landing_highlights); } catch { return []; }
        })();
        row.landing_hero_images = (() => {
            if (!row.landing_hero_images) return [];
            if (typeof row.landing_hero_images !== 'string') return row.landing_hero_images;
            try { return JSON.parse(row.landing_hero_images); } catch { return []; }
        })();
        return c.json(row);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/categories
app.post('/', requireAdmin, async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    const id = data.id || crypto.randomUUID();
    const type = data.type || 'product'; // Default to product
    const highlightsJson = Array.isArray(data.landing_highlights)
        ? JSON.stringify(data.landing_highlights)
        : (typeof data.landing_highlights === 'string' ? data.landing_highlights : null);
    const heroImagesJson = Array.isArray(data.landing_hero_images)
        ? JSON.stringify(data.landing_hero_images)
        : (typeof data.landing_hero_images === 'string' ? data.landing_hero_images : null);
    try {
        await db.prepare(
            `INSERT INTO categories (
                id, name, description, icon, image, sort_order, is_active, type,
                landing_hero_image, landing_hero_images, landing_hero_tagline, landing_hero_title,
                landing_hero_subtitle, landing_accent_color, landing_highlights,
                landing_product_grid_title
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id, data.name, data.description || '', data.icon || '', data.image || '',
            data.sort_order || 0, data.is_active ?? 1, type,
            data.landing_hero_image || null,
            heroImagesJson,
            data.landing_hero_tagline || null,
            data.landing_hero_title || null,
            data.landing_hero_subtitle || null,
            data.landing_accent_color || null,
            highlightsJson,
            data.landing_product_grid_title || null,
        ).run();
        return c.json({ id, ...data });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/categories/:id
app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const db = c.env.DB;
    const highlightsJson = Array.isArray(data.landing_highlights)
        ? JSON.stringify(data.landing_highlights)
        : (typeof data.landing_highlights === 'string' ? data.landing_highlights : null);
    const heroImagesJson = Array.isArray(data.landing_hero_images)
        ? JSON.stringify(data.landing_hero_images)
        : (typeof data.landing_hero_images === 'string' ? data.landing_hero_images : null);
    try {
        await db.prepare(
            `UPDATE categories SET
                name=?, description=?, icon=?, image=?, sort_order=?, is_active=?,
                landing_hero_image=?, landing_hero_images=?, landing_hero_tagline=?, landing_hero_title=?,
                landing_hero_subtitle=?, landing_accent_color=?, landing_highlights=?,
                landing_product_grid_title=?
             WHERE id=?`
        ).bind(
            data.name, data.description || '', data.icon || '', data.image || '',
            data.sort_order || 0, data.is_active ?? 1,
            data.landing_hero_image || null,
            heroImagesJson,
            data.landing_hero_tagline || null,
            data.landing_hero_title || null,
            data.landing_hero_subtitle || null,
            data.landing_accent_color || null,
            highlightsJson,
            data.landing_product_grid_title || null,
            id,
        ).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/categories/:id/rename - change the category's id (URL slug)
app.post('/:id/rename', requireAdmin, async (c) => {
    const oldId = c.req.param('id');
    const db = c.env.DB;
    let body: any = {};
    try { body = await c.req.json(); } catch { /* empty body */ }
    const newId: string = (body.new_id || '').trim();

    if (!newId) return c.json({ error: 'new_id is required' }, 400);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(newId)) {
        return c.json({ error: 'new_id must be lowercase alphanumeric/hyphens and start with a letter or digit' }, 400);
    }
    if (newId === oldId) return c.json({ success: true, message: 'no change' });
    if (oldId === 'all') return c.json({ error: 'cannot rename the "all" category' }, 400);

    try {
        const existing: any = await db.prepare('SELECT id FROM categories WHERE id = ? LIMIT 1').bind(newId).first();
        if (existing) return c.json({ error: `id "${newId}" already in use` }, 409);

        const current: any = await db.prepare('SELECT id, name FROM categories WHERE id = ? LIMIT 1').bind(oldId).first();
        if (!current) return c.json({ error: 'category not found' }, 404);

        // SQLite allows updating a PK value in place as long as no FK references block it.
        await db.prepare('UPDATE categories SET id = ? WHERE id = ?').bind(newId, oldId).run();

        // Products store the category by NAME (not id), so product rows are unaffected.
        // Still, update any product rows that happen to store the id literally (defensive).
        try {
            await db.prepare('UPDATE products SET category = ? WHERE category = ?').bind(newId, oldId).run();
        } catch { /* products.category may not exist in legacy schemas; ignore */ }

        return c.json({ success: true, old_id: oldId, new_id: newId });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/categories/:id
app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        await db.prepare('DELETE FROM categories WHERE id=?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/categories/bulk - Replace all categories
app.put('/bulk', requireAdmin, async (c) => {
    const { categories } = await c.req.json();
    const db = c.env.DB;
    try {
        const stmts: D1PreparedStatement[] = [db.prepare('DELETE FROM categories')];
        for (let i = 0; i < categories.length; i++) {
            const cat = categories[i];
            const type = cat.type || 'product';
            stmts.push(db.prepare(
                "INSERT INTO categories (id, name, description, icon, image, sort_order, is_active, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).bind(cat.id || crypto.randomUUID(), cat.name, cat.description || '', cat.icon || '', cat.image || '', i, cat.is_active ?? 1, type));
        }
        await db.batch(stmts);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
