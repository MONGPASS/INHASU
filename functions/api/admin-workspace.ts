import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';
import { readAdminWorkspace } from '../lib/adminWorkspace';
const app = new Hono<{ Bindings: { DB: any } }>();
app.get('/', requireAdmin, async c => {
    c.header('Cache-Control', 'private, no-store');
    try { return c.json(await readAdminWorkspace(c.env.DB)); }
    catch { return c.json({ error: '관리자 업무 현황을 불러오지 못했습니다. 다시 시도해 주세요.' }, 503); }
});
export default app;
