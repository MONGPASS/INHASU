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

/** A reusable course link only becomes personal when staff enter a customer's name. */
export function isPersonalCustomerRequest(source: unknown, name: unknown) {
    if (source !== 'course-share') return true;
    const recipient = typeof name === 'string' ? name.trim() : '';
    return !!recipient && recipient !== '여행 고객';
}

export function readCustomerRequestData(json: string | null) {
    try {
        const value = JSON.parse(json || '{}');
        if (value && typeof value === 'object' && !Array.isArray(value)) return value;
    } catch { /* Historical rows can contain incomplete JSON. */ }
    return {};
}

const VALID_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
/**
 * Google 로그인 이메일로 아직 아무 계정에도 연결되지 않은 맞춤 견적(`requests`)을 연결한다.
 * - Google이 로그인 때 `email_verified=true`로 이 이메일의 주인임을 확인했다. 기록에 적힌 이메일로
 *   인증번호를 보내 확인하는 것과 같은 수준의 본인 확인이다(오너 결정 2026-11-20).
 * - 기록의 이메일(`data.email`, 관리자가 견적서 만들기에서 입력하거나 고객이 문의 때 적은 값)과 정확히 같을 때만.
 * - 이미 다른 계정에 연결된 기록, 받는 사람이 정해지지 않은 공유 견적은 건드리지 않는다.
 * - 연결과 이메일 확인을 한 문장(조건부 INSERT)으로 해, 확인 뒤 이메일이 바뀐 기록은 연결하지 않는다.
 * `requestId`를 주면 그 기록만, 없으면 이 이메일의 기록을 모두(최대 50건) 연결한다. 연결한 건수를 돌려준다.
 */
export async function claimRequestsByGoogleEmail(env: AccessEnv, user: any, requestId?: string): Promise<number> {
    const email = String(user?.email || '').trim().toLowerCase();
    if (!user?.googleId || user.role === 'admin' || !VALID_EMAIL.test(email)) return 0;
    await ensureCustomerAccessTables(env);
    const unowned = "NOT EXISTS(SELECT 1 FROM customer_resource_links l WHERE l.source='request' AND l.resource_id=r.id)";
    const sameEmail = "lower(trim(COALESCE(json_extract(r.data,'$.email'),'')))=?";
    const candidates = requestId
        ? await env.DB.prepare(`SELECT r.id,r.name,r.data FROM requests r WHERE r.id=? AND ${unowned} AND json_valid(r.data) AND ${sameEmail}`).bind(requestId, email).all()
        : await env.DB.prepare(`SELECT r.id,r.name,r.data FROM requests r WHERE ${unowned} AND json_valid(r.data) AND ${sameEmail} ORDER BY r.received_at DESC LIMIT 50`).bind(email).all();
    let linked = 0;
    for (const row of candidates.results || []) {
        const data = readCustomerRequestData(row.data);
        if (!isPersonalCustomerRequest(data.source, data.name ?? row.name)) continue;
        const result = await env.DB.prepare(`INSERT OR IGNORE INTO customer_resource_links(source,resource_id,user_id,created_at)
            SELECT 'request',r.id,?,? FROM requests r WHERE r.id=? AND COALESCE(r.data,'')=? AND ${unowned} AND ${sameEmail}`)
            .bind(user.id, new Date().toISOString(), row.id, row.data || '', email).run();
        if (Number(result?.meta?.changes) === 1) linked++;
    }
    return linked;
}

const verificationPhone = (value: unknown) => String(value ?? '').replace(/\D/g, '').replace(/^(?:0082|82)0?(?=1\d{8,9}$)/, '0');

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
    const data = source === 'request' ? readCustomerRequestData(row.data) : {};
    const indexedPhone = verificationPhone(source === 'reservation' ? row.customer_phone : row.phone);
    const savedPhone = source === 'request' && data.phone != null ? verificationPhone(data.phone) : indexedPhone;
    return { source, key, id: String(row.id), owner: owner ? String(owner) : null, row, data,
        email: String(source === 'request' ? data.email || '' : source === 'quote' ? row.email || '' : row.customer_email || '').trim().toLowerCase(),
        // Older editors updated only JSON. Never send a code to a stale indexed number.
        phone: indexedPhone && savedPhone !== indexedPhone ? '' : savedPhone,
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

/**
 * 견적 열람 전용: 링크(토큰)를 가진 사람은 견적 내용을 볼 수 있다.
 * 소유자·관리자만 `full`이며, 나머지는 응답에서 신원·연락 정보를 뺀 `view`로 내려 준다.
 * 서명·여행자 정보·입금 신고 같은 쓰기와 개인정보 조회는 계속 requireResourceAccess를 쓴다.
 */
export async function resourceViewAccess(request: Request, env: AccessEnv, source: CustomerSource, key: string): Promise<Response | { full: boolean }> {
    const resource = await customerResource(env, source, key);
    if (!resource) return accessJson({ ok: false, code: 'not_found', error: '기록을 찾을 수 없습니다.' }, 404);
    if (customerAdminToken(request, env)) return { full: true };
    const user = await customerSession(request, env);
    return { full: !!user && (user.role === 'admin' || resource.owner === user.id) };
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
