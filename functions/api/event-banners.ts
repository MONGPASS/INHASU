import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

// GET /api/event-banners
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM event_banners ORDER BY sort_order ASC').all();
        return c.json(result.results || []);
    } catch (e: any) {
        return c.json([], 200);
    }
});

export default app;
