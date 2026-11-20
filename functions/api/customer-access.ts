import { Hono } from 'hono';
import { accessJson, claimRequestsByGoogleEmail, customerAdminToken, customerResource, customerSession, customerWriteOrigin, isPersonalCustomerRequest,
    ensureCustomerAccessTables, readCustomerRequestData, validCustomerResource, type CustomerSource } from '../lib/customerAccess.ts';
import { sendEmail, baseLayout } from '../lib/mailer';
import { sendSms, kakaoDeliveryResult } from './_solapi.js';
import { isQuoteBooking, summarizeCustomerQuoteBooking } from '../lib/quoteBookings.ts';

const app = new Hono<{ Bindings: { DB: any; [key: string]: any } }>();
const TTL = 10 * 60_000;
const MAX_ATTEMPTS = 5;
const deny = (code: string, error: string, status = 400) => accessJson({ ok: false, code, error }, status);
const login = () => deny('login_required', 'Google 로그인 후 이용해 주세요.', 401);
const unavailable = () => deny('verification_unavailable', '기존 연락처로 인증할 수 없습니다. 관리자에게 기록 연결을 문의해 주세요.', 409);
const secret = (env: any) => env.CUSTOMER_LINK_SECRET || env.GOOGLE_CLIENT_SECRET;
const emailReady = (env: any) => !!env.RESEND_API_KEY;
const smsReady = (env: any) => !!(env.SOLAPI_API_KEY && env.SOLAPI_API_SECRET && env.SOLAPI_SENDER);
const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    const labels = domain.split('.');
    return `${local.slice(0, 1)}***@${labels[0].slice(0, 1)}***.${labels.slice(1).join('.')}`;
};
const maskPhone = (phone: string) => `${phone.slice(0, 3)}-****-${phone.slice(-4)}`;
function contacts(resource: NonNullable<Awaited<ReturnType<typeof customerResource>>>, env: any) {
    const channels: { kind: 'email' | 'sms'; masked: string; value: string }[] = [];
    if (resource.source === 'request' && !isPersonalCustomerRequest(resource.data.source, resource.data.name ?? resource.row.name)) return channels;
    if (emailReady(env) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(resource.email)) channels.push({ kind: 'email', masked: maskEmail(resource.email), value: resource.email });
    if (smsReady(env) && /^0\d{8,10}$/.test(resource.phone)) channels.push({ kind: 'sms', masked: maskPhone(resource.phone), value: resource.phone });
    return channels;
}

function canRequestStaffReview(data: any, name: unknown, status: unknown) {
    return isPersonalCustomerRequest(data.source, data.name ?? name) && (!!data.quote || isQuoteBooking({ booking: data.booking, status: status || data.status }));
}
async function digest(env: any, value: string) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const bytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('customer-link:v1:' + value));
    return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
function equal(a: string, b: string) {
    let diff = a.length ^ b.length;
    for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
    return diff === 0;
}
async function schema(env: any) {
    await ensureCustomerAccessTables(env, true);
}
async function limit(env: any, key: string, max: number, windowMs: number, now: number) {
    const result = await env.DB.prepare(`INSERT INTO customer_link_limits(key,window_start,count) VALUES(?,?,1)
        ON CONFLICT(key) DO UPDATE SET
        count=CASE WHEN window_start<=? THEN 1 ELSE count+1 END,
        window_start=CASE WHEN window_start<=? THEN excluded.window_start ELSE window_start END
        WHERE window_start<=? OR count<? RETURNING key`)
        .bind(key, now, now - windowMs, now - windowMs, now - windowMs, max).first();
    return !!result;
}
async function body(request: Request) {
    if (Number(request.headers.get('content-length') || 0) > 4096) throw new Error('body');
    const text = await request.text();
    if (text.length > 4096) throw new Error('body');
    return JSON.parse(text);
}
app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store'); c.header('Vary', 'Cookie');
    if (c.req.method !== 'GET') { const invalid = customerWriteOrigin(c.req.raw); if (invalid) return invalid; }
    await next();
});

app.get('/status', async c => {
    const user = await customerSession(c.req.raw, c.env);
    const admin = customerAdminToken(c.req.raw, c.env) || user?.role === 'admin';
    if (!user && !admin) return login();
    const source = c.req.query('source'), key = c.req.query('key');
    if (!validCustomerResource(source, key)) return deny('invalid_resource', '기존 안내 링크를 확인해 주세요.');
    const resource = await customerResource(c.env, source, key!);
    if (!resource) return deny('not_found', '기록을 찾을 수 없습니다.', 404);
    if (admin || resource.owner === user?.id) return accessJson({ ok: true, state: 'linked', channels: [], codeLength: 8 });
    if (resource.owner) return deny('access_denied', '이 계정으로 확인할 수 없는 기록입니다.', 403);
    // 견적에 적힌 이메일과 Google이 확인한 로그인 이메일이 같으면 인증번호 없이 바로 연결한다.
    if (source === 'request' && await claimRequestsByGoogleEmail(c.env, user, resource.id)) return accessJson({ ok: true, state: 'linked', channels: [], codeLength: 8 });
    const channels = secret(c.env) ? contacts(resource, c.env).map(({ kind, masked }) => ({ kind, masked })) : [];
    return accessJson({ ok: true, state: channels.length ? 'verification_required' : 'unavailable', channels, codeLength: 8,
        staffReviewAvailable: source === 'request' && canRequestStaffReview(resource.data, resource.row.name, resource.row.status) });
});

app.post('/challenge', async c => {
    const user = await customerSession(c.req.raw, c.env);
    if (!user?.googleId) return login();
    let input: any; try { input = await body(c.req.raw); } catch { return deny('invalid_request', '요청을 확인해 주세요.'); }
    const { source, key, channel } = input || {};
    if (!validCustomerResource(source, key) || !['email', 'sms'].includes(channel)) return deny('invalid_request', '기존 안내 링크와 인증 방법을 확인해 주세요.');
    const resource = await customerResource(c.env, source, key);
    if (!resource) return deny('not_found', '기록을 찾을 수 없습니다.', 404);
    if (resource.owner) return deny(resource.owner === user.id ? 'already_linked' : 'access_denied', '이미 연결된 기록입니다.', 409);
    if (!secret(c.env)) return unavailable();
    const contact = contacts(resource, c.env).find(item => item.kind === channel);
    if (!contact) return unavailable();
    await schema(c.env);
    const now = Date.now();
    // Shared across accounts and isolates: a forwarded link cannot flood its registered recipient.
    const resourceHash = await digest(c.env, `resource:${source}:${resource.id}`);
    const ipHash = await digest(c.env, `ip:${c.req.header('CF-Connecting-IP') || 'unknown'}`);
    for (const [id, max, window] of [[`cool:${resourceHash}`, 1, 60_000], [`record:${resourceHash}`, 5, 3600_000],
        [`user:${user.id}`, 10, 3600_000], [`ip:${ipHash}`, 30, 3600_000]] as const) {
        if (!await limit(c.env, id, max, window, now)) return deny('rate_limited', '잠시 후 다시 시도해 주세요.', 429);
    }
    const id = crypto.randomUUID();
    // Rejection sampling avoids modulo bias and uses Web Crypto only.
    let random: number; do { random = crypto.getRandomValues(new Uint32Array(1))[0]; } while (random >= 4_200_000_000);
    const code = String(random % 100_000_000).padStart(8, '0');
    const hash = await digest(c.env, `${id}:${user.id}:${code}`);
    const contactHash = await digest(c.env, `contact:${channel}:${contact.value}`);
    await c.env.DB.prepare(`INSERT INTO customer_link_challenges
        (id,user_id,source,resource_id,resource_key,channel,contact_hash,code_hash,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)`)
        .bind(id, user.id, source, resource.id, key, channel, contactHash, hash, now, now + TTL).run();
    try {
        if (channel === 'email') await sendEmail(c.env.RESEND_API_KEY, contact.value, '[몽골리아 은하수] 기존 여행 기록 연결 인증번호', baseLayout(
            `<div class="body"><h2>여행 기록 연결</h2><p>본인이 요청한 경우에만 아래 인증번호를 입력해 주세요.</p><div class="card" style="font-size:28px;letter-spacing:6px">${code}</div><p>10분 동안 유효합니다. 다른 사람에게 알려주지 마세요.</p></div>`), { env: c.env });
        else {
            const sent = await sendSms(c.env, { phone: contact.value, text: `[몽골리아 은하수] 여행 기록 연결 인증번호 ${code} (10분). 본인이 요청한 경우에만 입력하세요. 타인에게 알려주지 마세요.` });
            if (!kakaoDeliveryResult(sent).ok) throw new Error('delivery');
        }
        await c.env.DB.batch([
            c.env.DB.prepare('UPDATE customer_link_challenges SET used_at=? WHERE user_id=? AND source=? AND resource_id=? AND id<>? AND used_at IS NULL').bind(now, user.id, source, resource.id, id),
            c.env.DB.prepare('UPDATE customer_link_challenges SET ready=1 WHERE id=?').bind(id),
        ]);
    } catch {
        await c.env.DB.prepare('UPDATE customer_link_challenges SET used_at=? WHERE id=?').bind(now, id).run();
        return deny('delivery_unavailable', '인증번호를 보내지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.', 503);
    }
    return accessJson({ ok: true, challengeId: id, masked: contact.masked, expiresAt: new Date(now + TTL).toISOString(), retryAfter: 60, codeLength: 8 });
});

app.post('/verify', async c => {
    const user = await customerSession(c.req.raw, c.env);
    if (!user?.googleId) return login();
    let input: any; try { input = await body(c.req.raw); } catch { return deny('invalid_request', '인증번호를 확인해 주세요.'); }
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(input?.challengeId || '') || !/^\d{8}$/.test(input?.code || '')) return deny('invalid_code', '8자리 인증번호를 입력해 주세요.');
    if (!secret(c.env)) return unavailable();
    await schema(c.env);
    const now = Date.now();
    const attempt = await c.env.DB.prepare(`UPDATE customer_link_challenges SET attempts=attempts+1
        WHERE id=? AND user_id=? AND used_at IS NULL AND ready=1 AND expires_at>? AND attempts<? RETURNING *`)
        .bind(input.challengeId, user.id, now, MAX_ATTEMPTS).first();
    if (!attempt) return deny('invalid_code', '인증번호가 만료되었거나 사용할 수 없습니다. 다시 요청해 주세요.', 400);
    const expected = await digest(c.env, `${attempt.id}:${user.id}:${input.code}`);
    if (!equal(expected, attempt.code_hash)) return deny('invalid_code', '인증번호가 일치하지 않습니다. 다시 확인해 주세요.');
    const resource = await customerResource(c.env, attempt.source as CustomerSource, attempt.resource_key);
    const contact = resource && contacts(resource, c.env).find(item => item.kind === attempt.channel);
    if (!resource || resource.id !== attempt.resource_id || !contact ||
        !equal(attempt.contact_hash, await digest(c.env, `contact:${attempt.channel}:${contact.value}`))) return unavailable();
    if (resource.owner && resource.owner !== user.id) return deny('access_denied', '이미 다른 계정에 연결된 기록입니다.', 409);
    // Recheck the recipient snapshot inside the same transaction that assigns ownership.
    // An administrator changing contact details or rotating a legacy link invalidates the old proof.
    const snapshotSql = attempt.source === 'request'
        ? "EXISTS(SELECT 1 FROM requests WHERE id=? AND token=? AND COALESCE(data,'')=? AND COALESCE(phone,'')=?)"
        : `EXISTS(SELECT 1 FROM ${attempt.source === 'quote' ? 'quotes' : 'reservations'} WHERE id=? AND COALESCE(${attempt.source === 'quote' ? 'email' : 'customer_email'},'')=? AND COALESCE(${attempt.source === 'quote' ? 'phone' : 'customer_phone'},'')=?)`;
    const snapshotArgs = attempt.source === 'request'
        ? [resource.id, resource.row.token, resource.row.data || '', resource.row.phone || '']
        : [resource.id, (attempt.source === 'quote' ? resource.row.email : resource.row.customer_email) || '', (attempt.source === 'quote' ? resource.row.phone : resource.row.customer_phone) || ''];
    const valid = `EXISTS (SELECT 1 FROM customer_link_challenges WHERE id=? AND user_id=? AND used_at IS NULL AND ready=1 AND expires_at>?) AND ${snapshotSql}`;
    const validArgs = [attempt.id, user.id, now, ...snapshotArgs];
    const commands = [];
    if (attempt.source !== 'request') {
        const table = attempt.source === 'quote' ? 'quotes' : 'reservations';
        commands.push(c.env.DB.prepare(`UPDATE ${table} SET user_id=? WHERE id=? AND (user_id IS NULL OR user_id='' OR user_id=?) AND ${valid}`)
            .bind(user.id, resource.id, user.id, ...validArgs));
    }
    const nativeOwner = attempt.source === 'request' ? '' : ` AND EXISTS(SELECT 1 FROM ${attempt.source === 'quote' ? 'quotes' : 'reservations'} WHERE id=? AND user_id=?)`;
    const linkArgs = [attempt.source, resource.id, user.id, new Date(now).toISOString(), ...validArgs];
    if (nativeOwner) linkArgs.push(resource.id, user.id);
    commands.push(c.env.DB.prepare(`INSERT OR IGNORE INTO customer_resource_links(source,resource_id,user_id,created_at)
        SELECT ?,?,?,? WHERE ${valid}${nativeOwner}`).bind(...linkArgs));
    commands.push(c.env.DB.prepare(`UPDATE customer_link_challenges SET used_at=? WHERE id=? AND user_id=? AND used_at IS NULL
        AND EXISTS(SELECT 1 FROM customer_resource_links WHERE source=? AND resource_id=? AND user_id=?) AND ${snapshotSql}`)
        .bind(now, attempt.id, user.id, attempt.source, resource.id, user.id, ...snapshotArgs));
    const results = await c.env.DB.batch(commands);
    if (Number(results[results.length - 1]?.meta?.changes) !== 1) return deny('invalid_code', '이미 사용된 인증번호입니다. 기록을 다시 확인해 주세요.', 409);
    return accessJson({ ok: true });
});

// A reference identifies the signed-in applicant. Only a staff session that verifies the
// booking holder separately can approve it on that specific quote.
app.post('/staff-request', async c => {
    const user = await customerSession(c.req.raw, c.env);
    if (!user?.googleId || user.role === 'admin') return login();
    const input = await body(c.req.raw).catch(() => null);
    if (!validCustomerResource(input?.source, input?.key) || input.source !== 'request') return deny('invalid_request', '견적 링크를 확인해 주세요.');
    const resource = await customerResource(c.env, 'request', input.key);
    if (resource?.owner === user.id) return accessJson({ ok: true, state: 'linked' });
    if (!resource || resource.owner || !canRequestStaffReview(resource.data, resource.row.name, resource.row.status)) return unavailable();
    await schema(c.env);
    const now = Date.now();
    const find = () => c.env.DB.prepare(`SELECT reference, expires_at FROM customer_quote_link_requests
        WHERE request_id=? AND resource_key=? AND user_id=? AND approved_at IS NULL AND expires_at>?`)
        .bind(resource.id, resource.key, user.id, now).first();
    let pending = await find();
    if (!pending) {
        const day = 24 * 3600_000;
        if (!await limit(c.env, 'staff-request:' + user.id, 10, day, now)) return deny('rate_limited', '잠시 후 다시 시도해 주세요.', 429);
        const reference = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
        await c.env.DB.prepare(`INSERT INTO customer_quote_link_requests(reference,request_id,resource_key,user_id,expires_at)
            VALUES(?,?,?,?,?) ON CONFLICT(request_id,user_id) DO UPDATE SET reference=excluded.reference,
            resource_key=excluded.resource_key, expires_at=excluded.expires_at, approved_at=NULL, approved_by=NULL
            WHERE approved_at IS NULL AND (expires_at<=? OR resource_key<>excluded.resource_key)`)
            .bind(reference, resource.id, resource.key, user.id, now + day, now).run();
        pending = await find();
    }
    if (!pending) return unavailable();
    return accessJson({ ok: true, state: 'pending', reference: pending.reference, expiresAt: new Date(pending.expires_at).toISOString() });
});

const pendingReview = `FROM customer_quote_link_requests s JOIN requests r ON r.id=s.request_id AND r.token=s.resource_key
    JOIN users u ON u.id=s.user_id AND COALESCE(u.google_id,'')<>'' AND COALESCE(u.role,'user')<>'admin'
    WHERE s.request_id=? AND s.reference=? AND s.expires_at>? AND s.approved_at IS NULL`;

app.post('/staff-review/:action', async c => {
    const admin = await customerSession(c.req.raw, c.env);
    if (admin?.role !== 'admin') return deny('access_denied', '관리자 로그인이 필요합니다.', 403);
    const input = await body(c.req.raw).catch(() => null);
    const action = c.req.param('action'), reference = String(input?.reference || '').toUpperCase();
    if (!['lookup', 'approve'].includes(action) || typeof input?.requestId !== 'string' || input.requestId.length > 256 || !/^[0-9A-F]{12}$/.test(reference)) {
        return deny('invalid_request', '고객이 보내 준 연결 요청번호를 확인해 주세요.');
    }
    if (action === 'approve' && input.identityConfirmed !== true) return deny('confirmation_required', '예약자 본인 확인을 완료해 주세요.');
    await schema(c.env);
    const now = Date.now(), args = [input.requestId, reference, now];
    const row = await c.env.DB.prepare(`SELECT s.user_id,u.email,r.name,r.status,r.data ${pendingReview}
        AND NOT EXISTS(SELECT 1 FROM customer_resource_links l WHERE l.source='request' AND l.resource_id=s.request_id)`).bind(...args).first();
    if (!row) {
        if (action === 'approve' && typeof input.accountId === 'string') {
            const approved = await c.env.DB.prepare(`SELECT 1 FROM customer_quote_link_requests s
                JOIN requests r ON r.id=s.request_id AND r.token=s.resource_key
                JOIN customer_resource_links l ON l.source='request' AND l.resource_id=s.request_id AND l.user_id=s.user_id
                WHERE s.request_id=? AND s.reference=? AND s.user_id=? AND s.approved_at IS NOT NULL`)
                .bind(input.requestId, reference, input.accountId).first();
            if (approved) return accessJson({ ok: true });
        }
        return deny('unavailable', '이 견적의 유효한 연결 요청을 찾을 수 없습니다.', 409);
    }
    if (!canRequestStaffReview(readCustomerRequestData(row.data), row.name, row.status)) return unavailable();
    if (action === 'lookup') return accessJson({ ok: true, accountId: row.user_id, email: row.email });
    if (input.accountId !== row.user_id) return deny('account_changed', '연결할 계정을 다시 확인해 주세요.', 409);
    const results = await c.env.DB.batch([
        c.env.DB.prepare(`INSERT OR IGNORE INTO customer_resource_links(source,resource_id,user_id,created_at)
            SELECT 'request',s.request_id,s.user_id,? ${pendingReview} AND s.user_id=?
            AND COALESCE(r.name,'')=? AND COALESCE(r.status,'')=? AND COALESCE(r.data,'')=?`)
            .bind(new Date(now).toISOString(), ...args, row.user_id, row.name || '', row.status || '', row.data || ''),
        c.env.DB.prepare(`UPDATE customer_quote_link_requests SET approved_at=?,approved_by=?
            WHERE request_id=? AND reference=? AND user_id=? AND approved_at IS NULL AND expires_at>?
            AND EXISTS(SELECT 1 FROM requests r WHERE r.id=request_id AND r.token=resource_key)
            AND EXISTS(SELECT 1 FROM customer_resource_links l WHERE l.source='request' AND l.resource_id=customer_quote_link_requests.request_id AND l.user_id=customer_quote_link_requests.user_id)`)
            .bind(now, admin.id, input.requestId, reference, row.user_id, now),
    ]);
    if (!Number(results[1]?.meta?.changes)) return deny('unavailable', '연결 상태가 변경되었습니다. 다시 확인해 주세요.', 409);
    return accessJson({ ok: true });
});

app.get('/history', async c => {
    const user = await customerSession(c.req.raw, c.env);
    if (!user?.googleId) return login();
    await ensureCustomerAccessTables(c.env);
    // 마이페이지를 열면 이 Google 이메일로 받은 견적·예약(아직 미연결)을 먼저 연결한다.
    await claimRequestsByGoogleEmail(c.env, user);
    const requests = await c.env.DB.prepare(`SELECT r.* FROM requests r JOIN customer_resource_links l
        ON l.source='request' AND l.resource_id=r.id WHERE l.user_id=? ORDER BY r.received_at DESC LIMIT 200`).bind(user.id).all();
    const quotes = await c.env.DB.prepare('SELECT id,status,destination,period,headcount,created_at FROM quotes WHERE user_id=? ORDER BY created_at DESC LIMIT 200').bind(user.id).all();
    const items = (requests.results || []).map((row: any) => {
        const data = readCustomerRequestData(row.data);
        const record = { ...data, id: row.id, status: row.status || data.status, destination: row.destination || data.destination, receivedAt: row.received_at };
        const booking = summarizeCustomerQuoteBooking(record);
        return { id: row.id, source: 'request', status: record.status, destination: record.destination || '',
            ...(booking ? { booking } : {}),
            period: [data.depart, data.return_].filter(Boolean).join(' ~ '), headcount: Number(data.adult || 0) + Number(data.child || 0) + Number(data.infant || 0),
            createdAt: row.received_at, href: `/내견적.html?t=${encodeURIComponent(row.token)}` };
    });
    for (const row of quotes.results || []) items.push({ id: row.id, source: 'quote', status: row.status, destination: row.destination,
        period: row.period, headcount: row.headcount, createdAt: row.created_at, href: `/estimate/${encodeURIComponent(row.id)}` });
    items.sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return accessJson({ ok: true, items });
});

app.onError(() => deny('temporarily_unavailable', '일시적으로 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.', 503));
export default app;
