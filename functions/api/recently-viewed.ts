import { Hono } from 'hono';
import { requireAuth } from '../lib/userAuth';

type Env = { DB: any; };

const app = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Viewing history is private: every route acts on the signed-in user's rows only.
app.use('*', requireAuth);

const ensureTable = async (db: any) => {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS recently_viewed (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            viewed_at TEXT DEFAULT (datetime('now'))
        )
    `).run();
};

// Pull the first usable image URL out of a products.main_images JSON
// blob (or fall back to legacy thumbnail / images columns). Strips quotes
// and brackets from the raw substr so the simple SQL we use doesn't have
// to know about JSON parsing.
const firstImageFromMainImages = (row: any): string | null => {
    const candidates: Array<unknown> = [row.main_images, row.images, row.thumbnail];
    for (const raw of candidates) {
        if (!raw || typeof raw !== 'string') continue;
        try {
            const arr = JSON.parse(raw);
            if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'string') return arr[0];
        } catch { /* not JSON — try as plain string */ }
        if (raw.startsWith('http') || raw.startsWith('/')) return raw;
    }
    return null;
};

// GET /api/recently-viewed
//   * INNER JOIN with products so entries pointing to deleted products
//     don't return blank rows (which the UI rendered as empty placeholder
//     cards).
//   * Returns main_images / images / thumbnail so the server can pick the
//     first usable image post-fetch.
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        await ensureTable(db);
        const userId = c.get('user').id;
        const joinQuery = `
            SELECT rv.id, rv.user_id, rv.product_id, rv.viewed_at as created_at,
                   p.name as title, p.thumbnail, p.main_images, p.images, p.price, p.category
            FROM recently_viewed rv
            INNER JOIN products p ON rv.product_id = p.id
        `;
        const result = await db.prepare(joinQuery + ' WHERE rv.user_id = ? ORDER BY rv.viewed_at DESC LIMIT 20').bind(userId).all();
        const rows = (result.results || []).map((r: any) => ({
            id: r.id,
            user_id: r.user_id,
            product_id: r.product_id,
            created_at: r.created_at,
            title: r.title,
            image: firstImageFromMainImages(r),
            price: r.price,
            category: r.category,
            type: 'product',
        }));
        // Defensive — title shouldn't be NULL with INNER JOIN, but skip any
        // row that somehow lacks both title and image so we never paint a
        // blank card.
        const cleaned = rows.filter((r: any) => r.title || r.image);
        return c.json(cleaned);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/recently-viewed (upsert)
app.post('/', async (c) => {
    try {
        const db = c.env.DB;
        await ensureTable(db);
        const data = await c.req.json();
        const userId = c.get('user').id;
        const productId = data.product_id || data.productId || '';

        // Remove existing entry for same user+product
        await db.prepare('DELETE FROM recently_viewed WHERE user_id = ? AND product_id = ?').bind(userId, productId).run();

        // Insert new entry (moves it to top)
        const id = `rv-${Date.now()}`;
        await db.prepare('INSERT INTO recently_viewed (id, user_id, product_id) VALUES (?, ?, ?)').bind(id, userId, productId).run();

        // Keep only last 20 items per user
        await db.prepare(`
            DELETE FROM recently_viewed WHERE user_id = ? AND id NOT IN (
                SELECT id FROM recently_viewed WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 20
            )
        `).bind(userId, userId).run();

        return c.json({ success: true, id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/recently-viewed — clear the caller's whole history
app.delete('/', async (c) => {
    try {
        const db = c.env.DB;
        await ensureTable(db);
        await db.prepare('DELETE FROM recently_viewed WHERE user_id = ?').bind(c.get('user').id).run();
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
});

// DELETE /api/recently-viewed/:id — one entry, only when it is the caller's own
app.delete('/:id', async (c) => {
    try {
        const db = c.env.DB;
        await ensureTable(db);
        const id = c.req.param('id');
        const userId = c.get('user').id;
        const row = await db.prepare('SELECT id FROM recently_viewed WHERE id = ? AND user_id = ?').bind(id, userId).first();
        if (!row) return c.json({ error: 'Not found' }, 404);
        await db.prepare('DELETE FROM recently_viewed WHERE id = ? AND user_id = ?').bind(id, userId).run();
        return c.json({ success: true });
    } catch (e) {
        return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
    }
});

export default app;
