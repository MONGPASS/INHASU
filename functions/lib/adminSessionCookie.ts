import type { Cookie } from 'lucia';

/** A browser-session preference never changes the server-side session lifetime. */
export const ADMIN_SESSION_MODE_COOKIE = 'admin_session_mode';

export function serializeAdminSessionCookie(cookie: Cookie, browserSession: boolean): string {
    if (browserSession) {
        delete cookie.attributes.maxAge;
        delete cookie.attributes.expires;
    }
    return cookie.serialize();
}
