import { Lucia } from 'lucia';
import { DrizzleSQLiteAdapter } from '@lucia-auth/adapter-drizzle';
import { drizzle } from 'drizzle-orm/d1';
import { users, sessions } from '../../src/db/schema/auth';
import { D1Database } from '@cloudflare/workers-types';

// This function needs to be called within the request handler where we have access to Env
export function initializeLucia(D1: D1Database) {
    const db = drizzle(D1);
    const adapter = new DrizzleSQLiteAdapter(db, sessions, users);

    return new Lucia(adapter, {
        sessionCookie: {
            // Explicit, reliable attributes. `process.env.NODE_ENV` is NOT
            // available in the Cloudflare Workers runtime (no nodejs_compat),
            // so the previous `secure: process.env.NODE_ENV === 'production'`
            // was fragile and inconsistent with the OAuth cookies, which use
            // `c.env.ENVIRONMENT`. Every deployed environment (production and
            // Cloudflare previews) is served over HTTPS, so Secure is correct.
            // (Lucia always applies HttpOnly to the session cookie itself.)
            attributes: {
                secure: true,
                sameSite: 'lax',
                path: '/',
            },
        },
        getUserAttributes: (attributes) => {
            return {
                googleId: attributes.googleId,
                email: attributes.email,
                name: attributes.name,
                role: attributes.role,
                avatarUrl: attributes.avatarUrl,
            };
        },
    });
}

declare module 'lucia' {
    interface Register {
        Lucia: ReturnType<typeof initializeLucia>;
        DatabaseUserAttributes: {
            googleId: string;
            email: string;
            name: string;
            role: string;
            avatarUrl: string;
        };
    }
}
