import { Hono } from 'hono';
import type { Context } from 'hono';
import { getCookie } from 'hono/cookie';
import { initializeLucia } from '../lib/auth';
import { requireAdmin } from '../lib/adminAuth';

// 여행 기획전 (promotions). Field names follow src/components/promotions/promotionTypes.ts.

type Ctx = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

const THEME_KEYS = ['mint', 'navy', 'jade', 'deep', 'light', 'paper', 'night', 'soft'];
const MAX_PRODUCTS = 100;
const MAX_REORDER = 500;

/** Marker the admin page looks for; keep `/api/migrate-db` in the message. */
const MIGRATION_ERROR = 'promotions table is missing. Open /api/migrate-db once to create it.';

interface PromotionRow {
    id: string;
    title: string | null;
    subtitle: string | null;
    group_name: string | null;
    badge: string | null;
    art_text: string | null;
    theme: string | null;
    image: string | null;
    product_ids: string | null;
    is_active: number | boolean | null;
    sort_order: number | null;
    created_at: string | null;
    updated_at: string | null;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isMissingTable = (e: unknown) => /no such table/i.test(errorMessage(e));

/** Write failures: a missing table gets its own status so the admin UI can explain the fix. */
const writeError = (c: Ctx, e: unknown) =>
    isMissingTable(e)
        ? c.json({ error: MIGRATION_ERROR, code: 'MIGRATION_REQUIRED' }, 503)
        : c.json({ error: errorMessage(e) }, 500);

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Display lettering keeps its line breaks ("GO\nNOW"); everything else is one line. */
const artText = (v: unknown) =>
    typeof v === 'string'
        ? v.replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean).slice(0, 3).join('\n').slice(0, 40)
        : '';

const themeOf = (v: unknown) => (typeof v === 'string' && THEME_KEYS.includes(v) ? v : 'mint');

/** Only site-relative or absolute URLs are renderable on the public card. */
const imageUrl = (v: unknown) => {
    const url = text(v, 1000);
    return url.startsWith('/') || /^https?:\/\//i.test(url) ? url : '';
};

const productIds = (v: unknown): string[] => {
    let list: unknown = v;
    if (typeof v === 'string') {
        try { list = JSON.parse(v); } catch { list = []; }
    }
    if (!Array.isArray(list)) return [];
    const ids = list.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean);
    return [...new Set(ids)].slice(0, MAX_PRODUCTS);
};

const activeFlag = (v: unknown) => (v === false || v === 0 || v === '0' || v === 'false' ? 0 : 1);

const sortOrder = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
};

const toPromotion = (row: PromotionRow) => ({
    id: row.id,
    title: row.title || '',
    subtitle: row.subtitle || '',
    group_name: row.group_name || '',
    badge: row.badge || '',
    art_text: row.art_text || '',
    theme: themeOf(row.theme),
    image: row.image || '',
    product_ids: productIds(row.product_ids),
    is_active: row.is_active === 1 || row.is_active === true,
    sort_order: row.sort_order || 0,
    created_at: row.created_at || undefined,
    updated_at: row.updated_at || undefined,
});

/** Signed-in user for this request, or null. Never throws: public reads must work without a session. */
const sessionUser = async (c: Ctx) => {
    try {
        const lucia = initializeLucia(c.env.DB);
        const sessionId = getCookie(c, lucia.sessionCookieName);
        if (!sessionId) return null;
        const { session, user } = await lucia.validateSession(sessionId);
        return session ? user : null;
    } catch {
        return null;
    }
};

const readBody = async (c: Ctx): Promise<Record<string, unknown>> => {
    try {
        const body: unknown = await c.req.json();
        return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    } catch {
        return {};
    }
};

// GET /api/promotions — public: active rows. ?all=1 — every row, admin only.
app.get('/', async (c) => {
    const all = c.req.query('all') === '1';
    if (all) {
        const user = await sessionUser(c);
        if (!user) return c.json({ error: 'Unauthorized' }, 401);
        if (user.role !== 'admin') return c.json({ error: 'Forbidden' }, 403);
        c.header('Cache-Control', 'no-store');
    }
    try {
        const sql = `SELECT * FROM promotions ${all ? '' : 'WHERE is_active = 1'} ORDER BY sort_order ASC, created_at ASC, id ASC`;
        const result = await c.env.DB.prepare(sql).all<PromotionRow>();
        return c.json((result.results || []).map(toPromotion));
    } catch (e) {
        // Before /api/migrate-db has run there is simply nothing to show.
        if (isMissingTable(e)) return c.json([]);
        return c.json({ error: errorMessage(e) }, 500);
    }
});

// GET /api/promotions/:id — inactive rows are visible to admins only.
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    try {
        const row = await c.env.DB.prepare('SELECT * FROM promotions WHERE id = ?').bind(id).first<PromotionRow>();
        if (!row) return c.json({ error: 'Not found' }, 404);
        const promotion = toPromotion(row);
        if (!promotion.is_active) {
            const user = await sessionUser(c);
            if (user?.role !== 'admin') return c.json({ error: 'Not found' }, 404);
            c.header('Cache-Control', 'no-store');
        }
        return c.json(promotion);
    } catch (e) {
        if (isMissingTable(e)) return c.json({ error: 'Not found' }, 404);
        return c.json({ error: errorMessage(e) }, 500);
    }
});

// POST /api/promotions (admin)
app.post('/', requireAdmin, async (c) => {
    const data = await readBody(c);
    const title = text(data.title, 120);
    if (!title) return c.json({ error: 'title is required' }, 400);
    const db: Env['DB'] = c.env.DB;
    const id = `promo-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    try {
        // New promotions go to the end unless the caller places them.
        let order = sortOrder(data.sort_order);
        if (data.sort_order === undefined || data.sort_order === null) {
            const last = await db.prepare('SELECT MAX(sort_order) AS max_order FROM promotions').first<{ max_order: number | null }>();
            order = last?.max_order == null ? 0 : last.max_order + 1;
        }
        await db.prepare(`
            INSERT INTO promotions (
                id, title, subtitle, group_name, badge, art_text, theme, image, product_ids, is_active, sort_order
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            title,
            text(data.subtitle, 200),
            text(data.group_name, 40),
            text(data.badge, 40),
            artText(data.art_text),
            themeOf(data.theme),
            imageUrl(data.image),
            JSON.stringify(productIds(data.product_ids)),
            activeFlag(data.is_active),
            order,
        ).run();
        return c.json({ success: true, id });
    } catch (e) {
        return writeError(c, e);
    }
});

// PUT /api/promotions/reorder (admin) — body { items: [{ id, sort_order }] }. Registered before /:id.
// An empty list changes nothing but still reports a missing table, which the admin page uses as a check.
app.put('/reorder', requireAdmin, async (c) => {
    const data = await readBody(c);
    const items = (Array.isArray(data.items) ? data.items : [])
        .filter((x): x is { id: string; sort_order: unknown } => !!x && typeof x === 'object' && typeof (x as { id?: unknown }).id === 'string')
        .slice(0, MAX_REORDER);
    const db: Env['DB'] = c.env.DB;
    try {
        if (items.length === 0) {
            await db.prepare('SELECT id FROM promotions LIMIT 1').first();
            return c.json({ success: true });
        }
        await db.batch(items.map((item) =>
            db.prepare("UPDATE promotions SET sort_order = ?, updated_at = datetime('now') WHERE id = ?").bind(sortOrder(item.sort_order), item.id),
        ));
        return c.json({ success: true });
    } catch (e) {
        return writeError(c, e);
    }
});

// PUT /api/promotions/:id (admin) — only the fields present in the body are changed.
app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const data = await readBody(c);
    const db: Env['DB'] = c.env.DB;

    const sets: string[] = [];
    const values: (string | number)[] = [];
    const set = (column: string, value: string | number) => { sets.push(`${column} = ?`); values.push(value); };

    if (data.title !== undefined) {
        const title = text(data.title, 120);
        if (!title) return c.json({ error: 'title is required' }, 400);
        set('title', title);
    }
    if (data.subtitle !== undefined) set('subtitle', text(data.subtitle, 200));
    if (data.group_name !== undefined) set('group_name', text(data.group_name, 40));
    if (data.badge !== undefined) set('badge', text(data.badge, 40));
    if (data.art_text !== undefined) set('art_text', artText(data.art_text));
    if (data.theme !== undefined) set('theme', themeOf(data.theme));
    if (data.image !== undefined) set('image', imageUrl(data.image));
    if (data.product_ids !== undefined) set('product_ids', JSON.stringify(productIds(data.product_ids)));
    if (data.is_active !== undefined) set('is_active', activeFlag(data.is_active));
    if (data.sort_order !== undefined) set('sort_order', sortOrder(data.sort_order));

    try {
        const existing = await db.prepare('SELECT id FROM promotions WHERE id = ?').bind(id).first();
        if (!existing) return c.json({ error: 'Not found' }, 404);
        if (sets.length > 0) {
            await db.prepare(`UPDATE promotions SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...values, id).run();
        }
        return c.json({ success: true });
    } catch (e) {
        return writeError(c, e);
    }
});

// DELETE /api/promotions/:id (admin)
app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    try {
        const db: Env['DB'] = c.env.DB;
        await db.prepare('DELETE FROM promotions WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (e) {
        return writeError(c, e);
    }
});

export default app;
