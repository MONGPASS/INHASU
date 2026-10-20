import { Hono } from 'hono';
import { generateState, generateCodeVerifier, Google } from 'arctic';
import { initializeLucia } from '../lib/auth';
import { hashPassword, verifyPassword } from '../lib/password';
import { requireAdmin } from '../lib/adminAuth';
import { getSessionUser } from '../lib/userAuth';
import { setCookie, getCookie } from 'hono/cookie';
import { drizzle } from 'drizzle-orm/d1';
import { users } from '../../src/db/schema/auth';
import { eq } from 'drizzle-orm';
import { customerWriteOrigin, safeCustomerReturn } from '../lib/customerAccess';

const app = new Hono<{ Bindings: Env }>();

const LOCAL_ADMIN_EMAIL = 'gantumaidar@gmail.com';
const LOCAL_ADMIN_PASSWORD_HASH = '28546834df2b249812883d324084fad9:22d36a2d7088cbd1af0f4efac65282444f079fcc14781af664a800ee7a3c8fa2';

/** 로그인에 필요한 users · sessions 테이블이 없으면 만든다(있으면 그대로 둔다). */
async function ensureAuthTables(env: Env) {
    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            google_id TEXT UNIQUE,
            email TEXT UNIQUE,
            name TEXT,
            role TEXT DEFAULT 'user',
            avatar_url TEXT,
            password_hash TEXT
        )
    `).run();

    await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            expires_at INTEGER NOT NULL
        )
    `).run();
}

async function ensureLocalAuthData(env: Env) {
    if (env.ENVIRONMENT === 'production') return;

    await ensureAuthTables(env);

    await env.DB.prepare(`
        INSERT OR IGNORE INTO users (id, email, name, role, password_hash)
        VALUES (?, ?, ?, ?, ?)
    `).bind(
        'local-admin',
        LOCAL_ADMIN_EMAIL,
        'Local Admin',
        'admin',
        LOCAL_ADMIN_PASSWORD_HASH
    ).run();
}

// POST /api/auth/login - Admin email/password login
app.post('/login', async (c) => {
    try {
        const { email, password } = await c.req.json();

        if (!email || !password) {
            return c.json({ error: 'Email and password are required' }, 400);
        }

        if (!c.env.DB) {
            return c.json({ error: 'Database binding (DB) is missing in environment' }, 500);
        }

        await ensureLocalAuthData(c.env);

        const db = drizzle(c.env.DB);

        let existingUser;
        try {
            existingUser = await db.select().from(users).where(eq(users.email, email)).get();
            // "처음 설정"으로 만든 계정은 이메일을 소문자로 저장한다. 대소문자·앞뒤 공백만 다르게
            // 입력한 경우에도 로그인되도록 한 번 더 찾아 본다.
            const normalizedEmail = normalizeEmail(email);
            if (!existingUser && normalizedEmail && normalizedEmail !== email) {
                existingUser = await db.select().from(users).where(eq(users.email, normalizedEmail)).get();
            }
        } catch (dbError: any) {
            console.error('Database query failed:', dbError);
            return c.json({ error: `Database error: ${dbError.message || 'Unknown DB error'}` }, 500);
        }

        if (!existingUser || !existingUser.passwordHash) {
            return c.json({ error: 'Invalid email or password' }, 401);
        }

        if (existingUser.role !== 'admin') {
            return c.json({ error: 'Access denied' }, 403);
        }

        let isValid = false;
        try {
            isValid = await verifyPassword(password, existingUser.passwordHash);
        } catch (verifyError: any) {
            console.error('Password verification failed internally:', verifyError);
            return c.json({ error: `Crypto error: ${verifyError.message || 'Unknown crypto error'}` }, 500);
        }

        if (!isValid) {
            return c.json({ error: 'Invalid email or password' }, 401);
        }

        try {
            const lucia = initializeLucia(c.env.DB);
            const session = await lucia.createSession(existingUser.id, {});
            const sessionCookie = lucia.createSessionCookie(session.id);

            c.header("Set-Cookie", sessionCookie.serialize(), { append: true });

            return c.json({ success: true, user: { id: existingUser.id, email: existingUser.email, name: existingUser.name, role: existingUser.role } });
        } catch (sessionError: any) {
            console.error('Session creation failed:', sessionError);
            return c.json({ error: `Session error: ${sessionError.message || 'Unknown session error'}` }, 500);
        }
    } catch (globalError: any) {
        console.error('Global unhandled API error:', globalError);
        return c.json({ error: `Unhandled exception: ${globalError.message || 'Unknown error'}` }, 500);
    }
});

/** Google 로그인 중 문제가 생기면 날것의 오류 대신 로그인 화면으로 돌려보내 안내한다. */
const loginError = (c: any, code: string) => {
    const returnTo = safeCustomerReturn(c.req.query('redirect') || getCookie(c, 'post_login_redirect'), '');
    return c.redirect(`/login?${new URLSearchParams({ error: code, ...(returnTo ? { returnTo } : {}) })}`);
};

// GET /api/auth/login/google
app.get('/login/google', async (c) => {
    // 키가 없으면 Google 쪽 오류 화면(client_id=undefined)으로 가 버리므로 여기서 막는다.
    if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
        console.error('Google OAuth is not configured: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing');
        return loginError(c, 'google_setup');
    }
    const origin = new URL(c.req.url).origin;
    const callbackUrl = `${origin}/api/auth/login/google/callback`;
    const google = new Google(c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET, callbackUrl);

    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    const url = await google.createAuthorizationURL(state, codeVerifier, ["profile", "email"]);

    setCookie(c, "google_oauth_state", state, {
        path: "/",
        secure: c.env.ENVIRONMENT === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "Lax"
    });

    setCookie(c, "google_code_verifier", codeVerifier, {
        path: "/",
        secure: c.env.ENVIRONMENT === "production",
        httpOnly: true,
        maxAge: 60 * 10,
        sameSite: "Lax"
    });

    // Persist the post-login destination across the Google OAuth bounce so the
    // callback can land the user back on the page they were originally trying
    // to reach. Only same-origin absolute paths are accepted (no //external).
    const requestedRedirect = c.req.query('redirect');
    const redirect = safeCustomerReturn(requestedRedirect, '');
    if (redirect) {
        setCookie(c, "post_login_redirect", redirect, {
            path: "/",
            secure: c.env.ENVIRONMENT === "production",
            httpOnly: true,
            maxAge: 60 * 10,
            sameSite: "Lax"
        });
    } else setCookie(c, 'post_login_redirect', '', { path: '/', maxAge: 0 });

    return c.redirect(url.toString());
});

// GET /api/auth/login/google/callback
app.get('/login/google/callback', async (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const storedState = getCookie(c, "google_oauth_state");
    const storedCodeVerifier = getCookie(c, "google_code_verifier");
    // OAuth state and PKCE values are single use, even when the callback fails.
    setCookie(c, 'google_oauth_state', '', { path: '/', maxAge: 0 });
    setCookie(c, 'google_code_verifier', '', { path: '/', maxAge: 0 });

    if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) return loginError(c, 'google_setup');
    // 사용자가 Google 화면에서 취소했거나(code 없음), 로그인 시작 후 10분이 지났거나, 다른 브라우저에서 돌아온 경우
    if (!code || !state || !storedState || !storedCodeVerifier || state !== storedState) {
        return loginError(c, c.req.query("error") ? 'google_cancelled' : 'google_state');
    }

    const origin = new URL(c.req.url).origin;
    const callbackUrl = `${origin}/api/auth/login/google/callback`;
    const google = new Google(c.env.GOOGLE_CLIENT_ID, c.env.GOOGLE_CLIENT_SECRET, callbackUrl);

    try {
        const tokens = await google.validateAuthorizationCode(code, storedCodeVerifier);
        const accessToken = tokens.accessToken();
        const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        });
        const googleUser: any = await response.json();

        if (!response.ok || !googleUser?.sub || googleUser.email_verified !== true || !googleUser.email) return loginError(c, 'google_failed');
        googleUser.email = String(googleUser.email).trim().toLowerCase();

        // 첫 고객 로그인이 관리자 계정 설정보다 먼저일 수 있다 — 계정 표가 없으면 만든다.
        await ensureAuthTables(c.env);

        const lucia = initializeLucia(c.env.DB);
        const db = drizzle(c.env.DB);

        // Check if user already exists for this Google account.
        let existingUser = await db.select().from(users).where(eq(users.googleId, googleUser.sub)).get();

        // The Google subject is the identity. Email equality must never transfer
        // an older account (and all its reservations) into a different Google identity.
        if (!existingUser && googleUser.email) {
            const byEmail = await db.select().from(users).where(eq(users.email, googleUser.email)).get();
            if (byEmail) {
                return loginError(c, 'google_linked');
            }
        }

        let userId = "";

        if (existingUser) {
            userId = existingUser.id;
        } else {
            userId = crypto.randomUUID();
            await db.insert(users).values({
                id: userId,
                googleId: googleUser.sub,
                email: googleUser.email,
                name: googleUser.name,
                avatarUrl: googleUser.picture, // Fixed mapping
                role: 'user' // Default role
            }).run();
        }

        const session = await lucia.createSession(userId, {});
        const sessionCookie = lucia.createSessionCookie(session.id);

        c.header("Set-Cookie", sessionCookie.serialize(), { append: true });

        // Land the user back where they came from when AuthGuard redirected them
        // here. Validate it's a same-origin path before honoring it (defense
        // against open-redirect via crafted cookie). Default to home.
        const stashed = getCookie(c, "post_login_redirect");
        const safeTarget = safeCustomerReturn(stashed);
        // Clear the one-shot redirect cookie regardless of whether it was used.
        setCookie(c, "post_login_redirect", "", { path: "/", maxAge: 0 });

        return c.redirect(safeTarget);
    } catch (e: any) {
        console.error('Google OAuth callback error:', e);
        return loginError(c, 'google_failed');
    }
});

// The standalone mobile quote desk still authenticates with the legacy admin
// header. Verify it without issuing a session or returning any credentials.
app.post('/legacy-admin/check', async (c) => {
    c.header('Cache-Control', 'no-store');
    c.header('Vary', 'Cookie');
    const invalidOrigin = customerWriteOrigin(c.req.raw);
    if (invalidOrigin) return invalidOrigin;
    const supplied = c.req.header('x-admin-token');
    if (supplied && c.env.ADMIN_TOKEN && await timingSafeEqualText(supplied, c.env.ADMIN_TOKEN)) {
        return c.json({ ok: true, legacyAdmin: true });
    }
    if ((await getSessionUser(c))?.role === 'admin') return c.json({ ok: true, legacyAdmin: false });
    return c.json({ ok: false, code: 'access_denied' }, 401);
});

// GET /api/auth/me
app.get('/me', async (c) => {
    // The auth state must never be cached by the browser or any proxy — a stale
    // { user: null } served right after login is exactly what produces an
    // infinite login loop.
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate');

    try {
        const lucia = initializeLucia(c.env.DB);
        const sessionId = getCookie(c, lucia.sessionCookieName);

        if (!sessionId) {
            return c.json({ user: null });
        }

        const { session, user } = await lucia.validateSession(sessionId);

        if (session && session.fresh) {
            const sessionCookie = lucia.createSessionCookie(session.id);
            c.header("Set-Cookie", sessionCookie.serialize(), { append: true });
        }

        if (!session) {
            const sessionCookie = lucia.createBlankSessionCookie();
            c.header("Set-Cookie", sessionCookie.serialize(), { append: true });
        }

        return c.json({ user });
    } catch (e: any) {
        // Never surface a 500 here: the frontend treats a non-OK /me as
        // "logged out" and bounces back to /login, so a transient validation
        // error would loop the user forever. Fail soft to { user: null }.
        console.error('/api/auth/me failed:', e?.message || e);
        return c.json({ user: null });
    }
});

// POST /api/auth/logout
app.post('/logout', async (c) => {
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);

    if (!sessionId) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    await lucia.invalidateSession(sessionId);
    const sessionCookie = lucia.createBlankSessionCookie();
    c.header("Set-Cookie", sessionCookie.serialize(), { append: true });

    return c.json({ success: true });
});

// ─────────────────────────────────────────────────────────────
// 관리자 통합: 견적 데스크 연결 · 최초 관리자 계정 만들기
// ─────────────────────────────────────────────────────────────

const MIN_ADMIN_PASSWORD_LENGTH = 10;
const MAX_ADMIN_PASSWORD_LENGTH = 200;

function normalizeEmail(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

/**
 * 타이밍에 안전한 문자열 비교. 두 값을 SHA-256으로 줄여 길이를 32바이트로 맞춘 뒤
 * 끝까지 비교하므로, 걸린 시간으로 길이나 앞부분이 맞았는지를 알아낼 수 없다.
 */
async function timingSafeEqualText(a: string, b: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const [digestA, digestB] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(a)),
        crypto.subtle.digest('SHA-256', encoder.encode(b)),
    ]);
    const x = new Uint8Array(digestA);
    const y = new Uint8Array(digestB);
    let diff = 0;
    for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
    return diff === 0;
}

/** role='admin' 사용자 수. users 테이블이 아직 없으면 0. */
async function countAdmins(env: Env): Promise<number> {
    try {
        const row = await env.DB
            .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'")
            .first<{ n: number }>();
        return Number(row?.n ?? 0);
    } catch (e: any) {
        if (/no such table/i.test(String(e?.message ?? e))) return 0;
        throw e;
    }
}

// GET /api/auth/quote-desk
// 관리자 세션이 있으면 맞춤 견적 도구(public/견적관리.html 등)가 쓰는 x-admin-token 값을 내려 준다.
// 견적 도구는 원래도 이 값을 브라우저 sessionStorage에 두므로 노출 범위는 같다. 미설정이면 null.
app.get('/quote-desk', requireAdmin, async (c) => {
    c.header('Cache-Control', 'no-store');
    const user = await getSessionUser(c);
    if (user?.role !== 'admin') return c.json({ error: 'Unauthorized' }, 401);
    return c.json({ token: c.env.ADMIN_TOKEN || null, userId: user.id });
});

// GET /api/auth/admin-setup
// 관리자 계정이 아직 하나도 없으면(테이블이 없는 경우 포함) { needsSetup: true }.
app.get('/admin-setup', async (c) => {
    c.header('Cache-Control', 'no-store');
    try {
        return c.json({ needsSetup: (await countAdmins(c.env)) === 0 });
    } catch (e: any) {
        console.error('GET /api/auth/admin-setup failed:', e?.message || e);
        // 상태를 확인하지 못했으면 설정 폼을 띄우지 않는다(일반 로그인 폼 유지).
        return c.json({ needsSetup: false, error: '관리자 계정 상태를 확인하지 못했습니다.' }, 500);
    }
});

// POST /api/auth/admin-setup
// 최초 관리자 계정 만들기. 헤더 x-admin-token 이 env.ADMIN_TOKEN(기존 견적 관리자 비밀번호)과
// 일치하고, 관리자가 아직 0명일 때만 { email, password } 로 관리자 계정을 만든다.
app.post('/admin-setup', async (c) => {
    c.header('Cache-Control', 'no-store');
    try {
        if (!c.env.DB) {
            return c.json({ error: '데이터베이스(DB)가 연결되어 있지 않습니다.' }, 500);
        }

        // 이미 관리자가 있으면 비밀번호를 대조하지 않고 끝낸다.
        // (설정이 끝난 뒤에는 이 주소로 견적 관리자 비밀번호를 추측해 볼 수 없다.)
        if ((await countAdmins(c.env)) > 0) {
            return c.json({ error: '이미 관리자 계정이 있습니다. 로그인해 주세요.' }, 409);
        }

        const expected = c.env.ADMIN_TOKEN || '';
        if (!expected) {
            return c.json({ error: '서버에 견적 관리자 비밀번호(ADMIN_TOKEN)가 설정되어 있지 않아 처음 설정을 진행할 수 없습니다.' }, 503);
        }
        const provided = c.req.header('x-admin-token') || '';
        if (!provided || !(await timingSafeEqualText(provided, expected))) {
            return c.json({ error: '기존 견적 관리자 비밀번호가 올바르지 않습니다.' }, 401);
        }

        let body: any = null;
        try { body = await c.req.json(); } catch { body = null; }
        const email = normalizeEmail(body?.email);
        const password = typeof body?.password === 'string' ? body.password : '';

        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return c.json({ error: '이메일 주소를 정확히 입력해 주세요.' }, 400);
        }
        if (password.length < MIN_ADMIN_PASSWORD_LENGTH || password.length > MAX_ADMIN_PASSWORD_LENGTH) {
            return c.json({ error: `비밀번호는 ${MIN_ADMIN_PASSWORD_LENGTH}자 이상 ${MAX_ADMIN_PASSWORD_LENGTH}자 이하로 정해 주세요.` }, 400);
        }

        await ensureAuthTables(c.env);
        const passwordHash = await hashPassword(password);

        // 같은 이메일의 일반 회원(Google 로그인 등)이 이미 있으면 그 계정을 관리자로 올린다.
        const existing = await c.env.DB
            .prepare('SELECT id FROM users WHERE email = ? LIMIT 1')
            .bind(email)
            .first<{ id: string }>();

        // 요청 두 개가 동시에 들어와도 관리자가 하나만 생기도록
        // "관리자가 아직 없을 때만"이라는 조건을 SQL 한 문장 안에 넣는다.
        const result = existing
            ? await c.env.DB.prepare(`
                UPDATE users SET role = 'admin', password_hash = ?
                WHERE id = ? AND NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
            `).bind(passwordHash, existing.id).run()
            : await c.env.DB.prepare(`
                INSERT INTO users (id, email, name, role, password_hash)
                SELECT ?, ?, ?, 'admin', ?
                WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'admin')
            `).bind(crypto.randomUUID(), email, '관리자', passwordHash).run();

        if (!result.meta?.changes) {
            return c.json({ error: '이미 관리자 계정이 있습니다. 로그인해 주세요.' }, 409);
        }

        return c.json({ success: true, email }, 201);
    } catch (e: any) {
        console.error('POST /api/auth/admin-setup failed:', e?.message || e);
        return c.json({ error: '관리자 계정을 만들지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 500);
    }
});

export default app;
