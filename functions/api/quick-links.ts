import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

// GET /api/quick-links
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM quick_links ORDER BY sort_order ASC').all();
        return c.json(result.results || []);
    } catch (e: any) {
        return c.json([], 200);
    }
});

export default app;
