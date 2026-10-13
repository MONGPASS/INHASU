import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

const app = new Hono<{ Bindings: Env }>();

// Helper — parse JSON columns safely.
const safeArr = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    if (typeof v === 'string') {
        try {
            const p = JSON.parse(v);
            return Array.isArray(p) ? p.filter((x: unknown): x is string => typeof x === 'string') : [];
        } catch { return []; }
    }
    return [];
};

// Decorate a raw DB row with parsed JSON fields so the admin/picker doesn't
// have to do JSON.parse on the client.
const decorate = (row: any) => ({
    ...row,
    images: safeArr(row.images),
    amenities: safeArr(row.amenities),
    is_active: row.is_active === 1 || row.is_active === true,
});

// ─── GET /api/hotels ─────────────────────────────────────────────
// Public list — admin picker + (future) public-facing pages can use this.
// Supports basic search via ?q= and country/city filters.
app.get('/', async (c) => {
    const db = c.env.DB;
    const q = (c.req.query('q') || '').trim();
    const country = (c.req.query('country') || '').trim();
    const city = (c.req.query('city') || '').trim();
    const onlyActive = c.req.query('active') !== '0'; // default: hide inactive
    try {
        const where: string[] = [];
        const bind: any[] = [];
        if (onlyActive) where.push('is_active = 1');
        if (q) {
            where.push('(name_kr LIKE ? OR name_local LIKE ? OR code LIKE ?)');
            const like = `%${q}%`;
            bind.push(like, like, like);
        }
        if (country) { where.push('country = ?'); bind.push(country); }
        if (city) { where.push('city = ?'); bind.push(city); }
        const sql = `SELECT * FROM hotels ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name_kr ASC LIMIT 500`;
        const result = await db.prepare(sql).bind(...bind).all();
        return c.json((result.results || []).map(decorate));
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ─── GET /api/hotels/:id ─────────────────────────────────────────
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        const row = await db.prepare('SELECT * FROM hotels WHERE id = ?').bind(id).first();
        if (!row) return c.json({ error: 'Not found' }, 404);
        return c.json(decorate(row));
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ─── POST /api/hotels ────────────────────────────────────────────
// Admin only.
app.post('/', requireAdmin, async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    const id = data.id || `hotel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
        await db.prepare(`
            INSERT INTO hotels (
                id, code, name_kr, name_local, country, city, region,
                star_rating, address, latitude, longitude,
                description, website, images, amenities, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            data.code || '',
            data.name_kr || data.nameKr || '',
            data.name_local || data.nameLocal || '',
            data.country || '',
            data.city || '',
            data.region || '',
            Number(data.star_rating ?? data.starRating ?? 0) || 0,
            data.address || '',
            data.latitude != null ? Number(data.latitude) : null,
            data.longitude != null ? Number(data.longitude) : null,
            data.description || '',
            data.website || '',
            JSON.stringify(safeArr(data.images)),
            JSON.stringify(safeArr(data.amenities)),
            data.is_active === false || data.is_active === 0 ? 0 : 1
        ).run();
        return c.json({ id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ─── PUT /api/hotels/:id ─────────────────────────────────────────
// Admin only.
app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const db = c.env.DB;
    try {
        await db.prepare(`
            UPDATE hotels SET
                code = ?, name_kr = ?, name_local = ?, country = ?, city = ?, region = ?,
                star_rating = ?, address = ?, latitude = ?, longitude = ?,
                description = ?, website = ?, images = ?, amenities = ?, is_active = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `).bind(
            data.code || '',
            data.name_kr || data.nameKr || '',
            data.name_local || data.nameLocal || '',
            data.country || '',
            data.city || '',
            data.region || '',
            Number(data.star_rating ?? data.starRating ?? 0) || 0,
            data.address || '',
            data.latitude != null ? Number(data.latitude) : null,
            data.longitude != null ? Number(data.longitude) : null,
            data.description || '',
            data.website || '',
            JSON.stringify(safeArr(data.images)),
            JSON.stringify(safeArr(data.amenities)),
            data.is_active === false || data.is_active === 0 ? 0 : 1,
            id
        ).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ─── DELETE /api/hotels/:id ──────────────────────────────────────
// Admin only.
app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        await db.prepare('DELETE FROM hotels WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
