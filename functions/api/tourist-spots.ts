import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

const app = new Hono<{ Bindings: Env }>();

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

const decorate = (row: any) => ({
    ...row,
    images: safeArr(row.images),
    is_active: row.is_active === 1 || row.is_active === true,
});

// GET /api/tourist-spots?q=&active=&region=central|gobi|hovsgol|uncat
app.get('/', async (c) => {
    const db = c.env.DB;
    const q = (c.req.query('q') || '').trim();
    const onlyActive = c.req.query('active') !== '0';
    const region = (c.req.query('region') || '').trim();
    try {
        const where: string[] = [];
        const bind: any[] = [];
        if (onlyActive) where.push('is_active = 1');
        if (q) {
            where.push('(name_kr LIKE ? OR name_local LIKE ?)');
            const like = `%${q}%`;
            bind.push(like, like);
        }
        if (region === 'uncat') {
            // Sentinel — admin picked "미분류" tab. Match rows with no region.
            where.push("(region IS NULL OR region = '')");
        } else if (region && ['central', 'gobi', 'hovsgol', 'ulaanbaatar', 'experience', 'food'].includes(region)) {
            where.push('region = ?');
            bind.push(region);
        }
        const sql = `SELECT * FROM tourist_spots ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY name_kr ASC LIMIT 500`;
        const result = await db.prepare(sql).bind(...bind).all();
        return c.json((result.results || []).map(decorate));
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        const row = await db.prepare('SELECT * FROM tourist_spots WHERE id = ?').bind(id).first();
        if (!row) return c.json({ error: 'Not found' }, 404);
        return c.json(decorate(row));
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// Normalize region input — only allow the known values, fall back to ''.
const VALID_REGIONS = ['central', 'gobi', 'hovsgol', 'ulaanbaatar', 'experience', 'food'];
const validRegion = (r: unknown): string => {
    if (typeof r !== 'string') return '';
    return VALID_REGIONS.includes(r) ? r : '';
};

app.post('/', requireAdmin, async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    const id = data.id || `spot-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    try {
        await db.prepare(`
            INSERT INTO tourist_spots (
                id, name_kr, name_local, address, description, images, region, is_active
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            id,
            data.name_kr || data.nameKr || '',
            data.name_local || data.nameLocal || '',
            data.address || '',
            data.description || '',
            JSON.stringify(safeArr(data.images)),
            validRegion(data.region),
            data.is_active === false || data.is_active === 0 ? 0 : 1
        ).run();
        return c.json({ id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const db = c.env.DB;
    try {
        await db.prepare(`
            UPDATE tourist_spots SET
                name_kr = ?, name_local = ?, address = ?, description = ?, images = ?, region = ?, is_active = ?,
                updated_at = datetime('now')
            WHERE id = ?
        `).bind(
            data.name_kr || data.nameKr || '',
            data.name_local || data.nameLocal || '',
            data.address || '',
            data.description || '',
            JSON.stringify(safeArr(data.images)),
            validRegion(data.region),
            data.is_active === false || data.is_active === 0 ? 0 : 1,
            id
        ).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        await db.prepare('DELETE FROM tourist_spots WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
