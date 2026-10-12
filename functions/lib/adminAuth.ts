import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { initializeLucia } from './auth';

/**
 * Admin authentication middleware for Hono.
 * Verifies the session cookie and checks that the user has 'admin' role.
 * Use this on any API route that should only be accessible by admins.
 */
export const requireAdmin = async (c: Context<{ Bindings: any }>, next: Next) => {
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);

    if (!sessionId) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const { session, user } = await lucia.validateSession(sessionId);

    if (!session) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    if (user.role !== 'admin') {
        return c.json({ error: 'Forbidden' }, 403);
    }

    // Refresh session cookie if needed
    if (session.fresh) {
        const sessionCookie = lucia.createSessionCookie(session.id);
        c.header('Set-Cookie', sessionCookie.serialize(), { append: true });
    }

    await next();
};
