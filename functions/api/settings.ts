import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

const app = new Hono<{ Bindings: Env }>();

// GET /api/settings          → 전체 설정을 { 키: 값 } 으로
// GET /api/settings?key=xxx  → 그 설정 하나만 { key, value } 로 (없으면 value: null)
app.get('/', async (c) => {
    const db = c.env.DB;
    const key = c.req.query('key');
    try {
        if (key) {
            const row = await db.prepare('SELECT key, value FROM settings WHERE key = ?').bind(key).first();
            return c.json({ key, value: (row as any)?.value ?? null });
        }
        const result = await db.prepare('SELECT * FROM settings').all();
        const settings: Record<string, string> = {};
        for (const row of result.results as any[]) {
            settings[row.key] = row.value;
        }
        return c.json(settings);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/settings (admin)
app.put('/', requireAdmin, async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    try {
        const stmts: D1PreparedStatement[] = [];
        for (const [key, value] of Object.entries(data)) {
            stmts.push(db.prepare(
                "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
            ).bind(key, String(value)));
        }
        if (stmts.length > 0) await db.batch(stmts);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
