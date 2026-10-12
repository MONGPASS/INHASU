import { Hono } from 'hono';
import { requireAuth } from '../lib/userAuth';

type Env = { DB: any; };

const app = new Hono<{ Bindings: Env; Variables: { user: any } }>();

// Wishlists are private: every route acts on the signed-in user's rows only.
app.use('*', requireAuth);

const ensureTable = async (db: any) => {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS wishlist (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        )
    `).run();
};

// GET /api/wishlist
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        await ensureTable(db);
        const userId = c.get('user').id;
        const result = await db.prepare(`
            SELECT w.id, w.user_id, w.product_id, w.created_at,
                   p.name as title, p.thumbnail as image, p.price, p.category
            FROM wishlist w
            LEFT JOIN products p ON w.product_id = p.id
            WHERE w.user_id = ? ORDER BY w.created_at DESC
        `).bind(userId).all();
        return c.json(result.results || []);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/wishlist
app.post('/', async (c) => {
    try {
        const db = c.env.DB;
        await ensureTable(db);
        const data = await c.req.json();
        const id = data.id || `wl-${Date.now()}`;
        const userId = c.get('user').id;
        const productId = data.product_id || data.productId || '';

        // Check if already exists
        const existing = await db.prepare('SELECT id FROM wishlist WHERE user_id = ? AND product_id = ?').bind(userId, productId).first();
        if (existing) {
            return c.json({ success: true, id: existing.id, message: 'Already in wishlist' });
        }

        await db.prepare('INSERT INTO wishlist (id, user_id, product_id) VALUES (?, ?, ?)').bind(id, userId, productId).run();
        return c.json({ success: true, id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/wishlist/:id
app.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const db = c.env.DB;
        await ensureTable(db);
        // Accepts either the wishlist row id or the product id.
        await db.prepare('DELETE FROM wishlist WHERE user_id = ? AND (id = ? OR product_id = ?)').bind(c.get('user').id, id, id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
