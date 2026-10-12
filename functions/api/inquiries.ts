import { Hono } from 'hono';
import type { Context } from 'hono';
import { BRAND, COMPANY_INFO } from '../../src/constants/company';
import { requireAdmin } from '../lib/adminAuth';
import { baseLayout, sendEmail } from '../lib/mailer';
import { getSessionUser } from '../lib/userAuth';

// 문의 (/contact form) intake. Guests may post; reading and managing is admin only.

type Bindings = Env & { RESEND_API_KEY?: string; ADMIN_EMAIL?: string };
type Ctx = Context<{ Bindings: Bindings }>;

const app = new Hono<{ Bindings: Bindings }>();

/** Same options as the form (src/components/support-mobile/contactMail.ts INQUIRY_TYPES). */
const KINDS = [
    '예약', '결제', '투어 내용', '기타',
    // 이전 일본어 폼이 보내던 값(캐시된 옛 화면 대비) — 계속 허용
    'ご予約', 'お支払い', 'ツアー内容', 'その他',
];
const DEFAULT_KIND = '기타';
const STATUSES = ['new', 'answered', 'closed'];

const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE = 2000;
const MAX_NAME = 80;
const MAX_EMAIL = 254;
const MAX_RESERVATION_NUMBER = 40;
const MAX_ADMIN_NOTE = 2000;
const MAX_LIST = 500;

// Abuse limits, counted from the table itself.
/** Inquiries one e-mail address or one account may send per hour. */
const SENDER_HOURLY_LIMIT = 5;
/** Inquiries the whole site accepts per hour (senders rotating addresses). */
const SITE_HOURLY_LIMIT = 30;
/** Notification mails per 24h; later inquiries are stored and shown in the admin page only. */
const DAILY_MAIL_LIMIT = 40;

/** Marker the admin page looks for; keep `/api/migrate-db` in the message. */
const MIGRATION_ERROR = 'inquiries table is missing. Open /api/migrate-db once to create it.';

interface InquiryRow {
    id: string;
    user_id: string | null;
    name: string | null;
    email: string | null;
    kind: string | null;
    reservation_number: string | null;
    message: string;
    status: string | null;
    admin_note: string | null;
    created_at: string | null;
    updated_at: string | null;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isMissingTable = (e: unknown) => /no such table/i.test(errorMessage(e));

const fail = (c: Ctx, status: 400 | 413 | 415 | 429, code: string, error: string) => c.json({ error, code }, status);

const dbError = (c: Ctx, e: unknown) =>
    isMissingTable(e)
        ? c.json({ error: MIGRATION_ERROR, code: 'MIGRATION_REQUIRED' }, 503)
        : c.json({ error: errorMessage(e), code: 'SERVER_ERROR' }, 500);

const escapeHtml = (value: unknown) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const isControl = (ch: string) => {
    const code = ch.charCodeAt(0);
    return code < 32 || code === 127;
};

/** One-line text: control characters and line breaks become spaces. */
const line = (v: unknown) =>
    typeof v === 'string' ? Array.from(v, (ch) => (isControl(ch) ? ' ' : ch)).join('').replace(/\s+/g, ' ').trim() : '';

/** Multi-line text: keeps line breaks and tabs, drops other control characters. */
const block = (v: unknown) =>
    typeof v === 'string'
        ? Array.from(v.replace(/\r\n?/g, '\n')).filter((ch) => ch === '\n' || ch === '\t' || !isControl(ch)).join('').trim()
        : '';

const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

const toInquiry = (row: InquiryRow) => ({
    id: row.id,
    user_id: row.user_id || null,
    name: row.name || '',
    email: row.email || '',
    kind: row.kind || DEFAULT_KIND,
    reservation_number: row.reservation_number || '',
    message: row.message || '',
    status: row.status && STATUSES.includes(row.status) ? row.status : 'new',
    admin_note: row.admin_note || '',
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
});

const notificationHtml = (q: { id: string; name: string; email: string; kind: string; reservationNumber: string; message: string; member: boolean }) => {
    const rows: Array<[string, string]> = [
        ['유형', escapeHtml(q.kind)],
        ['이름', `${escapeHtml(q.name || '(미입력)')}${q.member ? ' (회원)' : ''}`],
        ['이메일', `<a href="mailto:${escapeHtml(q.email)}">${escapeHtml(q.email)}</a>`],
    ];
    if (q.reservationNumber) rows.push(['예약 번호', escapeHtml(q.reservationNumber)]);
    return baseLayout(`
<div class="header"><h1>새 문의가 접수되었습니다</h1><p>${BRAND.name}</p></div>
<div class="body">
  <table>${rows.map(([k, v]) => `<tr><td style="width:96px;color:#6b8f88;font-weight:600;">${k}</td><td>${v}</td></tr>`).join('')}</table>
  <div class="card" style="white-space:pre-wrap;word-break:break-word;font-size:14px;line-height:1.7;">${escapeHtml(q.message)}</div>
  <p style="font-size:13px;color:#6b8f88;">이 메일에 회신하면 고객(${escapeHtml(q.email)})에게 전달됩니다.</p>
  <a class="btn" href="${BRAND.siteUrl}/admin/inquiries">관리 화면에서 확인하기</a>
</div>
<div class="footer">접수 번호: ${escapeHtml(q.id)}</div>`);
};

// POST /api/inquiries — public. The server decides id, status, timestamps and user_id.
app.post('/', async (c) => {
    if (!/^application\/json\b/i.test(c.req.header('Content-Type') || '')) {
        return fail(c, 415, 'UNSUPPORTED_TYPE', 'Content-Type must be application/json');
    }
    if (Number(c.req.header('Content-Length') || 0) > MAX_BODY_BYTES) {
        return fail(c, 413, 'TOO_LARGE', 'Request body is too large');
    }
    let raw = '';
    try {
        raw = await c.req.text();
    } catch {
        return fail(c, 400, 'INVALID_BODY', 'Request body could not be read');
    }
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
        return fail(c, 413, 'TOO_LARGE', 'Request body is too large');
    }
    let data: Record<string, unknown>;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
        data = parsed as Record<string, unknown>;
    } catch {
        return fail(c, 400, 'INVALID_BODY', 'Request body must be a JSON object');
    }

    // Honeypot: the form keeps this field hidden and empty.
    if (data.website !== undefined && data.website !== null && String(data.website).trim() !== '') {
        return fail(c, 400, 'REJECTED', 'Request rejected');
    }

    const message = block(data.message);
    if (!message) return fail(c, 400, 'MESSAGE_REQUIRED', 'message is required');
    if (message.length > MAX_MESSAGE) return fail(c, 400, 'MESSAGE_TOO_LONG', `message must be ${MAX_MESSAGE} characters or fewer`);

    const user = await getSessionUser(c);

    const name = line(data.name) || line(user?.name);
    if (name.length > MAX_NAME) return fail(c, 400, 'NAME_TOO_LONG', `name must be ${MAX_NAME} characters or fewer`);

    const email = line(data.email) || line(user?.email);
    if (!email) return fail(c, 400, 'EMAIL_REQUIRED', 'email is required');
    if (email.length > MAX_EMAIL || !EMAIL_PATTERN.test(email)) return fail(c, 400, 'EMAIL_INVALID', 'email is not valid');

    const kind = line(data.kind) || DEFAULT_KIND;
    if (!KINDS.includes(kind)) return fail(c, 400, 'KIND_INVALID', 'kind is not one of the form options');

    const reservationNumber = line(data.reservation_number);
    if (reservationNumber.length > MAX_RESERVATION_NUMBER) {
        return fail(c, 400, 'RESERVATION_NUMBER_TOO_LONG', `reservation_number must be ${MAX_RESERVATION_NUMBER} characters or fewer`);
    }

    const db = c.env.DB;
    const userId = user?.id ?? null;
    const id = `inq-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    let mailsToday = 0;

    try {
        const recent = await db.prepare(`
            SELECT
                COALESCE(SUM(CASE WHEN created_at >= datetime('now', '-1 hour') AND (LOWER(email) = ? OR user_id = ?) THEN 1 ELSE 0 END), 0) AS by_sender,
                COALESCE(SUM(CASE WHEN created_at >= datetime('now', '-1 hour') THEN 1 ELSE 0 END), 0) AS last_hour,
                COUNT(*) AS last_day
            FROM inquiries
            WHERE created_at >= datetime('now', '-1 day')
        `).bind(email.toLowerCase(), userId ?? '').first<{ by_sender: number; last_hour: number; last_day: number }>();

        if (Number(recent?.by_sender) >= SENDER_HOURLY_LIMIT) {
            c.header('Retry-After', '3600');
            return fail(c, 429, 'RATE_LIMITED', 'Too many inquiries from this sender. Try again later.');
        }
        if (Number(recent?.last_hour) >= SITE_HOURLY_LIMIT) {
            c.header('Retry-After', '3600');
            return fail(c, 429, 'BUSY', 'Too many inquiries right now. Try again later.');
        }
        mailsToday = Number(recent?.last_day) || 0;

        await db.prepare(`
            INSERT INTO inquiries (id, user_id, name, email, kind, reservation_number, message, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'new', datetime('now'))
        `).bind(id, userId, name, email, kind, reservationNumber, message).run();
    } catch (e) {
        return dbError(c, e);
    }

    // Company notification only. No auto-reply goes to the visitor's address,
    // so the form cannot be used to send mail to third parties.
    if (c.env.RESEND_API_KEY && mailsToday < DAILY_MAIL_LIMIT) {
        const sending = sendEmail(
            c.env.RESEND_API_KEY,
            c.env.ADMIN_EMAIL || COMPANY_INFO.email,
            `[문의] ${kind}${name ? ` ${name} 님` : ''}`,
            notificationHtml({ id, name, email, kind, reservationNumber, message, member: !!userId }),
            { replyTo: email },
        ).catch((e: unknown) => {
            console.error('[inquiries] notification mail failed', errorMessage(e));
        });
        try {
            c.executionCtx.waitUntil(sending);
        } catch {
            await sending;
        }
    }

    return c.json({ success: true, id });
});

// GET /api/inquiries (admin) — newest first, optional ?status=
app.get('/', requireAdmin, async (c) => {
    const status = c.req.query('status');
    if (status && !STATUSES.includes(status)) return c.json({ error: 'Unknown status', code: 'STATUS_INVALID' }, 400);
    c.header('Cache-Control', 'no-store');
    try {
        const db: Env['DB'] = c.env.DB;
        const statement = status
            ? db.prepare(`SELECT * FROM inquiries WHERE status = ? ORDER BY created_at DESC, rowid DESC LIMIT ${MAX_LIST}`).bind(status)
            : db.prepare(`SELECT * FROM inquiries ORDER BY created_at DESC, rowid DESC LIMIT ${MAX_LIST}`);
        const result = await statement.all<InquiryRow>();
        return c.json((result.results || []).map(toInquiry));
    } catch (e) {
        return dbError(c, e);
    }
});

// PUT /api/inquiries/:id (admin) — body { status?, admin_note? }; only the fields present are changed.
app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    let data: Record<string, unknown> = {};
    try {
        const parsed: unknown = await c.req.json();
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
    } catch {
        return c.json({ error: 'Request body must be a JSON object', code: 'INVALID_BODY' }, 400);
    }

    const sets: string[] = [];
    const values: string[] = [];
    if (data.status !== undefined) {
        if (typeof data.status !== 'string' || !STATUSES.includes(data.status)) {
            return c.json({ error: 'Unknown status', code: 'STATUS_INVALID' }, 400);
        }
        sets.push('status = ?');
        values.push(data.status);
    }
    if (data.admin_note !== undefined) {
        const note = block(data.admin_note);
        if (note.length > MAX_ADMIN_NOTE) {
            return c.json({ error: `admin_note must be ${MAX_ADMIN_NOTE} characters or fewer`, code: 'NOTE_TOO_LONG' }, 400);
        }
        sets.push('admin_note = ?');
        values.push(note);
    }

    try {
        const db: Env['DB'] = c.env.DB;
        const existing = await db.prepare('SELECT id FROM inquiries WHERE id = ?').bind(id).first();
        if (!existing) return c.json({ error: 'Not found' }, 404);
        if (sets.length > 0) {
            await db.prepare(`UPDATE inquiries SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`).bind(...values, id).run();
        }
        return c.json({ success: true });
    } catch (e) {
        return dbError(c, e);
    }
});

// DELETE /api/inquiries/:id (admin)
app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    try {
        const db: Env['DB'] = c.env.DB;
        await db.prepare('DELETE FROM inquiries WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (e) {
        return dbError(c, e);
    }
});

export default app;
