import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';
import { readAdminAssignments, saveAdminAssignment, validateBookingAssignment } from '../lib/adminAssignments';
import type { AssignmentSource } from '../../src/utils/reservationAssignment';
const app = new Hono<{ Bindings: { DB: any } }>();
app.use('*', async (c, next) => { c.header('Cache-Control', 'private, no-store'); return requireAdmin(c, next); });
app.get('/', async c => {
    try { return c.json(await readAdminAssignments(c.env.DB)); }
    catch { return c.json({ error: '예약 배정을 불러오지 못했습니다.' }, 503); }
});
app.patch('/:source/:id', async c => {
    const source = c.req.param('source'), id = c.req.param('id');
    if (!['product','quote_booking'].includes(source) || !id || id.length > 150) return c.json({ error: '예약 종류와 ID를 확인해 주세요.' }, 400);
    let body: any; try { body = await c.req.json(); } catch { return c.json({ error: '저장할 배정 정보를 확인해 주세요.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !['expectedVersion','assignment'].includes(k)) || !/^[a-f0-9]{64}$/.test(body.expectedVersion || '')) return c.json({ error: '배정 버전과 저장 항목을 확인해 주세요.' }, 400);
    const assignment = validateBookingAssignment(body.assignment);
    if (!assignment) return c.json({ error: '배정 입력값을 확인해 주세요.' }, 400);
    try {
        const result = await saveAdminAssignment(c.env.DB, source as AssignmentSource, id, body.expectedVersion, assignment);
        return result.status === 200 ? c.json({ item: result.item }) : c.json({ error: result.error }, result.status as 404 | 409);
    } catch { return c.json({ error: '배정을 저장하지 못했습니다. 초안은 유지됩니다.' }, 503); }
});
export default app;
