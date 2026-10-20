import { Hono } from 'hono';
import type { D1PreparedStatement } from '@cloudflare/workers-types';
import { hasAdminSession, requireAdmin } from '../lib/adminAuth';
import { categoryChanges, categoryOrder } from '../lib/categoryUpdate';

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
        const adminView = await hasAdminSession(c);
        const rows = (result.results || []).filter((r: any) => adminView || (r.is_active !== 0 && r.is_active !== false)).map((r: any) => ({
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
        if (!row || ((row.is_active === 0 || row.is_active === false) && !await hasAdminSession(c))) return c.json({ error: 'Not found' }, 404);
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

// POST accepts the same validated values and legacy order alias as partial PUT.
app.post('/', requireAdmin, async (c) => {
    let data: Record<string, any>, id: string, type: string;
    try {
        const input = await c.req.json();
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('카테고리 내용을 확인해 주세요.');
        const { id: suppliedId, type: suppliedType, ...fields } = input;
        id = suppliedId ?? crypto.randomUUID(); type = suppliedType ?? 'product';
        if (typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,149}$/.test(id) || !['product', 'magazine'].includes(type)) throw new Error('카테고리 ID와 종류를 확인해 주세요.');
        data = categoryChanges(fields);
        if (!data.name) throw new Error('카테고리 이름을 입력해 주세요.');
    } catch (error: any) { return c.json({ error: error.message || '카테고리 내용을 확인해 주세요.' }, 400); }
    const db = c.env.DB;
    try {
        if (await db.prepare('SELECT id FROM categories WHERE id=?').bind(id).first()) return c.json({ error: '이미 사용 중인 카테고리 ID입니다.' }, 409);
        await db.prepare(
            'INSERT INTO categories (id,name,description,icon,image,sort_order,is_active,type,landing_hero_image,landing_hero_images,landing_hero_tagline,landing_hero_title,landing_hero_subtitle,landing_accent_color,landing_highlights,landing_product_grid_title) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(id, data.name, data.description ?? '', data.icon ?? '', data.image ?? '', data.sort_order ?? 0, data.is_active ?? 1, type,
            data.landing_hero_image ?? null, data.landing_hero_images ?? null, data.landing_hero_tagline ?? null, data.landing_hero_title ?? null,
            data.landing_hero_subtitle ?? null, data.landing_accent_color ?? null, data.landing_highlights ?? null, data.landing_product_grid_title ?? null).run();
        return c.json({ id, ...data, type });
    } catch { return c.json({ error: '카테고리를 만들지 못했습니다. 다시 시도해 주세요.' }, 500); }
});

// One batch keeps a category move from leaving half of a two-row swap saved.
app.put('/reorder', requireAdmin, async (c) => {
    let order: ReturnType<typeof categoryOrder>;
    try { order = categoryOrder(await c.req.json()); }
    catch (error: any) { return c.json({ error: error.message || '순서 내용을 확인해 주세요.' }, 400); }
    const db = c.env.DB;
    try {
        const rows = await db.prepare("SELECT id FROM categories WHERE COALESCE(NULLIF(type,''),'product')=?").bind(order.type).all();
        const ids = new Set((rows.results || []).map((row: any) => row.id));
        if (ids.size !== order.items.length || order.items.some(item => !ids.has(item.id))) return c.json({ error: '카테고리 목록이 변경되었습니다. 새로고침한 뒤 순서를 다시 변경해 주세요.' }, 409);
        if (order.items.length) await db.batch(order.items.map(item => db.prepare("UPDATE categories SET sort_order=? WHERE id=? AND COALESCE(NULLIF(type,''),'product')=?").bind(item.sort_order, item.id, order.type)));
        return c.json({ success: true });
    } catch { return c.json({ error: '순서를 저장하지 못했습니다. 다시 시도해 주세요.' }, 500); }
});

// PUT changes only supplied columns; a toggle must never erase landing artwork.
app.put('/:id', requireAdmin, async (c) => {
    let changes: Record<string, any>;
    try { changes = categoryChanges(await c.req.json()); }
    catch (error: any) { return c.json({ error: error.message || '변경 내용을 확인해 주세요.' }, 400); }
    const db = c.env.DB, id = c.req.param('id');
    try {
        if (!await db.prepare('SELECT id FROM categories WHERE id=?').bind(id).first()) return c.json({ error: '카테고리를 찾을 수 없습니다.' }, 404);
        const fields = Object.keys(changes);
        const sql = 'UPDATE categories SET ' + fields.map(field => field + '=?').join(',') + ' WHERE id=?';
        const result = await db.prepare(sql).bind(...fields.map(field => changes[field]), id).run();
        if (result.meta?.changes === 0) return c.json({ error: '카테고리를 찾을 수 없습니다.' }, 404);
        return c.json({ success: true });
    } catch { return c.json({ error: '카테고리를 저장하지 못했습니다. 다시 시도해 주세요.' }, 500); }
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
