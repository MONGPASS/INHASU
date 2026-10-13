import { Hono } from 'hono';
import { initializeLucia } from '../../lib/auth';
import { getCookie } from 'hono/cookie';
import { requireAdmin } from '../../lib/adminAuth';

interface Env {
    DB: any;
    RESEND_API_KEY: string;
    ADMIN_EMAIL: string;
}

const app = new Hono<{ Bindings: Env }>();

// Shape returned to frontend (matches NotificationContext.Notification)
const rowToNotification = (r: any) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    message: r.body || '',
    link: r.link || undefined,
    is_read: !!r.read,
    created_at: r.created_at,
});

// GET /api/notifications — list my notifications
app.get('/', async (c) => {
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);
    if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);

    try {
        const { results } = await c.env.DB.prepare(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100'
        ).bind(user.id).all();
        return c.json((results || []).map(rowToNotification));
    } catch (e: any) {
        console.error('[Notifications GET] error', e);
        return c.json([]);
    }
});

// POST /api/notifications — create a notification for any user (admin)
app.post('/', requireAdmin, async (c) => {
    const body = await c.req.json();
    const { userId, type, title, message, body: bodyText, link } = body;
    if (!userId || !title) return c.json({ error: 'userId and title required' }, 400);

    try {
        const id = crypto.randomUUID();
        await c.env.DB.prepare(
            'INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, datetime("now"))'
        ).bind(id, userId, type || 'system', title, message || bodyText || '', link || null).run();
        return c.json({ success: true, id });
    } catch (e: any) {
        console.error('[Notifications POST] error', e);
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/notifications/mark-all-read
app.put('/mark-all-read', async (c) => {
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);
    if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);

    try {
        await c.env.DB.prepare(
            'UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0'
        ).bind(user.id).run();
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[Notifications mark-all-read] error', e);
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/notifications/:id — mark single as read (or update fields)
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);
    if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json();
    const readFlag = body.is_read === true || body.read === 1 ? 1 : 0;

    try {
        await c.env.DB.prepare(
            'UPDATE notifications SET read = ? WHERE id = ? AND user_id = ?'
        ).bind(readFlag, id, user.id).run();
        return c.json({ success: true });
    } catch (e: any) {
        console.error('[Notifications PUT] error', e);
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/notifications/:id
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);
    if (!sessionId) return c.json({ error: 'Unauthorized' }, 401);
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session) return c.json({ error: 'Unauthorized' }, 401);

    try {
        await c.env.DB.prepare(
            'DELETE FROM notifications WHERE id = ? AND user_id = ?'
        ).bind(id, user.id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;

// Internal helper — called from other routes when we want to persist an in-app notification
// (e.g. the email route calls this so sending an email also creates a bell notification)
export async function createNotification(
    DB: any,
    params: { userId: string; type: string; title: string; message?: string; link?: string }
) {
    if (!params.userId) return;
    try {
        const id = crypto.randomUUID();
        await DB.prepare(
            'INSERT INTO notifications (id, user_id, type, title, body, link, read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, datetime("now"))'
        ).bind(id, params.userId, params.type, params.title, params.message || '', params.link || null).run();
    } catch (e) {
        console.error('[createNotification] error', e);
    }
}