import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { initializeLucia } from './auth';

/**
 * Authenticated-user middleware for Hono.
 * Verifies the session cookie and ensures any logged-in user is making the request
 * (admin OR regular user). Use on routes where login is required but admin role is not.
 *
 * On success, the validated user is stored on the context as `user` so handlers can
 * read `c.get('user')` instead of trusting client-supplied identity fields.
 */
export const requireAuth = async (c: Context<{ Bindings: any; Variables: { user: any } }>, next: Next) => {
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);

    if (!sessionId) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const { session, user } = await lucia.validateSession(sessionId);

    if (!session || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    // Refresh session cookie if needed
    if (session.fresh) {
        const sessionCookie = lucia.createSessionCookie(session.id);
        c.header('Set-Cookie', sessionCookie.serialize(), { append: true });
    }

    c.set('user', user);

    await next();
};

/**
 * Signed-in user for this request, or null. Never throws.
 * For routes that stay public but act differently for the owner or an admin.
 */
export const getSessionUser = async (c: Context<any>) => {
    try {
        const lucia = initializeLucia(c.env.DB);
        const sessionId = getCookie(c, lucia.sessionCookieName);
        if (!sessionId) return null;
        const { session, user } = await lucia.validateSession(sessionId);
        return session ? user : null;
    } catch {
        return null;
    }
};
