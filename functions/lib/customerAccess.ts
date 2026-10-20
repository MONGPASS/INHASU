import { initializeLucia } from './auth.ts';
import { CUSTOMER_ACCESS_TABLES } from './siteSchema.ts';

export type CustomerSource = 'request' | 'quote' | 'reservation';
type AccessEnv = { DB: any; ADMIN_TOKEN?: string; [key: string]: any };
export const accessJson = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Vary': 'Cookie' },
});

export function customerWriteOrigin(request: Request): Response | null {
    const origin = request.headers.get('Origin');
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
        return accessJson({ ok: false, code: 'invalid_origin', error: '이 사이트에서 다시 시도해 주세요.' }, 403);
    }
    return null;
}

export const customerAdminToken = (request: Request, env: AccessEnv) =>
    !!env.ADMIN_TOKEN && request.headers.get('x-admin-token') === env.ADMIN_TOKEN;

/** Identity comes only from the validated session, never client JSON or contact matching. */
export async function customerSession(request: Request, env: AccessEnv) {
    try {
        const lucia = initializeLucia(env.DB);
        const id = lucia.readSessionCookie(request.headers.get('Cookie') || '');
        if (!id) return null;
        const { user } = await lucia.validateSession(id);
        return user && (user.googleId || user.role === 'admin') ? user : null;
    } catch { return null; }
}

export async function ensureCustomerAccessTables(env: AccessEnv, challenges = false) {
    for (const table of challenges ? CUSTOMER_ACCESS_TABLES : CUSTOMER_ACCESS_TABLES.slice(0, 1)) {
        await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ${table.name} (${[...table.columns, ...(table.constraints || [])].join(', ')})`).run();
        for (const index of table.indexes || []) await env.DB.prepare(index).run();
    }
}

export function validCustomerResource(source: unknown, key: unknown): source is CustomerSource {
    return ['request', 'quote', 'reservation'].includes(String(source)) && typeof key === 'string' &&
        key.length >= 1 && key.length <= 160 && /^[a-zA-Z0-9_-]+$/.test(key);
}

export async function customerResource(env: AccessEnv, source: CustomerSource, key: string) {
    if (!validCustomerResource(source, key)) return null;
    const sql = source === 'request' ? 'SELECT * FROM requests WHERE token = ?'
        : source === 'quote' ? 'SELECT * FROM quotes WHERE id = ?' : 'SELECT * FROM reservations WHERE id = ?';
    const row = await env.DB.prepare(sql).bind(key).first();
    if (!row) return null;
    await ensureCustomerAccessTables(env);
    const link = await env.DB.prepare('SELECT user_id FROM customer_resource_links WHERE source = ? AND resource_id = ?')
        .bind(source, row.id).first();
    // Legacy request JSON accepted arbitrary client fields; it is not proof of ownership.
    const owner = source === 'request' ? link?.user_id : row.user_id || link?.user_id;
    let data: any = {};
    if (source === 'request') { try { data = JSON.parse(row.data || '{}'); } catch { /* unreadable legacy record */ } }
    return { source, key, id: String(row.id), owner: owner ? String(owner) : null, row, data,
        email: String(source === 'request' ? data.email || '' : source === 'quote' ? row.email || '' : row.customer_email || '').trim().toLowerCase(),
        phone: String(source === 'request' ? row.phone || data.phone || '' : source === 'quote' ? row.phone || '' : row.customer_phone || '').replace(/\D/g, ''),
    };
}

export async function requireResourceAccess(request: Request, env: AccessEnv, source: CustomerSource, key: string,
    options: { write?: boolean; adminOnly?: boolean } = {}): Promise<Response | null> {
    if (options.write) { const invalid = customerWriteOrigin(request); if (invalid) return invalid; }
    const user = await customerSession(request, env);
    const admin = customerAdminToken(request, env) || user?.role === 'admin';
    if (!user && !admin) return accessJson({ ok: false, code: 'login_required', error: 'Google 로그인 후 확인해 주세요.' }, 401);
    if (options.adminOnly && !admin) return accessJson({ ok: false, code: 'access_denied', error: '접근 권한이 없습니다.' }, 403);
    const resource = await customerResource(env, source, key);
    if (!resource) return accessJson({ ok: false, code: 'not_found', error: '기록을 찾을 수 없습니다.' }, 404);
    if (admin || resource.owner === user?.id) return null;
    if (resource.owner) return accessJson({ ok: false, code: 'access_denied', error: '이 계정으로 확인할 수 없는 기록입니다.' }, 403);
    return accessJson({ ok: false, code: 'claim_required', error: '기존 연락처로 본인 인증 후 연결해 주세요.' }, 403);
}

export function safeCustomerReturn(value: unknown, fallback = '/') {
    if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
    try {
        const decoded = decodeURIComponent(value);
        if (decoded.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(decoded)) return fallback;
        const url = new URL(value, 'https://customer.invalid'); return url.origin === 'https://customer.invalid' ? value : fallback;
    }
    catch { return fallback; }
}
