import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';
import { readAdminDeliveries } from '../lib/adminDeliveryRead';

const app = new Hono<{ Bindings: { DB: any } }>();
app.use('*', async (c, next) => { c.header('Cache-Control', 'private, no-store'); return requireAdmin(c, next); });
app.get('/', async c => {
    c.header('Cache-Control', 'private, no-store');
    const source = c.req.query('source'), id = c.req.query('id');
    if (!['product', 'quote_booking'].includes(source || '') || !id || id.length > 150) return c.json({ error: '예약 종류와 ID를 확인해 주세요.' }, 400);
    try {
        const data = await readAdminDeliveries(c.env.DB, source as 'product' | 'quote_booking', id);
        return data ? c.json(data) : c.json({ error: '예약을 찾을 수 없습니다.' }, 404);
    } catch { return c.json({ error: '발송 이력을 불러오지 못했습니다. 다시 시도해 주세요.' }, 503); }
});
export default app;
