import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { quotes } from '../../src/db/schema';
import { initializeLucia } from '../lib/auth';
import { getCookie } from 'hono/cookie';
import { eq, desc } from 'drizzle-orm';
import { getSessionUser } from '../lib/userAuth';

// Define Env locally if global scope is not picked up
interface Env {
    DB: D1Database;
    BUCKET: R2Bucket;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    ENVIRONMENT: string;
}

const app = new Hono<{ Bindings: Env }>();

// Fields stored as JSON strings — parse for client convenience.
const JSON_ARRAY_FIELDS = ['travelTypes', 'travel_types', 'accommodations'] as const;
const parseNestedJson = (value: any, maxDepth = 2) => {
    let parsed = value;
    for (let depth = 0; depth < maxDepth && typeof parsed === 'string'; depth += 1) {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            break;
        }
    }
    return parsed;
};

const parseQuoteRow = (q: any) => {
    const out: any = { ...q };
    for (const f of JSON_ARRAY_FIELDS) {
        const v = out[f];
        if (typeof v === 'string' && v.trim().startsWith('[')) {
            try { out[f] = JSON.parse(v); } catch { /* leave as string */ }
        }
    }
    return out;
};

// GET /api/quotes
app.get('/', async (c) => {
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);

    if (!sessionId) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const { session, user } = await lucia.validateSession(sessionId);
    if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const db = drizzle(c.env.DB);

    // Admin gets all, User gets theirs
    let result;
    if (user.role === 'admin') {
        result = await db.select().from(quotes).orderBy(desc(quotes.createdAt)).all();
    } else {
        result = await db.select().from(quotes).where(eq(quotes.userId, user.id)).orderBy(desc(quotes.createdAt)).all();
    }

    return c.json(result.map(parseQuoteRow));
});

// GET /api/quotes/:id (public — no auth required so users can view own quotes from email link)
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = drizzle(c.env.DB);

    const result: any = await db.select().from(quotes).where(eq(quotes.id, id)).get();
    if (!result) {
        return c.json({ error: 'Not found' }, 404);
    }

    const parsed = parseQuoteRow(result);

    // 맞춤 일정표가 연결돼 있으면 템플릿의 일정(사진 포함)을 함께 내려줌 (고객 견적 페이지용)
    const tplId = result.itinerary_template_id ?? result.itineraryTemplateId;
    if (tplId) {
        try {
            const tpl: any = await c.env.DB.prepare('SELECT * FROM itinerary_templates WHERE id = ?').bind(tplId).first();
            if (tpl) {
                let days: any[] = [];
                try { days = tpl.days ? JSON.parse(tpl.days) : []; } catch { days = []; }
                parsed.itinerary = { id: tpl.id, name: tpl.name, description: tpl.description || '', days };
            }
        } catch (e) {
            console.error('[Quotes GET] itinerary template fetch failed', e);
        }
    }

    // 관리자가 문서 편집기로 저장한 내용이 있으면 그 일정을 우선 사용 (고객 견적 페이지에 편집본 노출)
    const dc = result.document_content ?? result.documentContent;
    if (dc) {
        try {
            const parsedDc = parseNestedJson(dc);
            if (parsedDc && Array.isArray(parsedDc.days) && parsedDc.days.length) {
                parsed.itinerary = {
                    id: 'doc',
                    name: parsedDc.name || parsed.itinerary?.name || '',
                    description: parsedDc.description || parsed.itinerary?.description || '',
                    days: parsedDc.days,
                };
            }
            parsed.documentContent = parsedDc;
        } catch (e) {
            console.error('[Quotes GET] document_content parse failed', e);
        }
    }

    return c.json(parsed);
});

// POST /api/quotes (Create new quote — no auth required, guests can submit)
app.post('/', async (c) => {
    try {
        const body = await c.req.json();

        if (!body.name || !body.type) {
            return c.json({ error: 'Missing required fields: name, type' }, 400);
        }

        // Guests may ask for a quote. The owner, status and timestamp come from the
        // server unless an admin is entering the quote on someone's behalf.
        const user = await getSessionUser(c);
        const isAdmin = user?.role === 'admin';

        const db = drizzle(c.env.DB);
        const id = crypto.randomUUID();

        await db.insert(quotes).values({
            id,
            userId: isAdmin ? (body.user_id || null) : (user?.id ?? null),
            type: body.type,
            name: body.name,
            phone: body.phone || null,
            email: body.email || null,
            destination: body.destination || null,
            headcount: body.headcount || null,
            period: body.period || null,
            budget: body.budget || null,
            travelTypes: Array.isArray(body.travel_types)
                ? JSON.stringify(body.travel_types)
                : (body.travel_types || null),
            accommodations: Array.isArray(body.accommodations)
                ? JSON.stringify(body.accommodations)
                : (body.accommodations || null),
            vehicle: body.vehicle || null,
            additionalRequest: body.additional_request || null,
            status: (isAdmin && body.status) || 'new',
            createdAt: (isAdmin && body.created_at) || new Date().toISOString(),
        }).run();

        return c.json({ id, success: true });
    } catch (e: any) {
        console.error('[Quotes POST Error]', e);
        const cause = e?.cause?.message || e?.cause || '';
        const msg = cause ? String(cause) : (e?.message?.split('\n')[0] || 'Internal server error');
        return c.json({ error: msg }, 500);
    }
});

// PUT /api/quotes/:id
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    // Auth check
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);
    if (!sessionId) return c.json({ error: "Unauthorized" }, 401);
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session || user.role !== 'admin') return c.json({ error: "Forbidden" }, 403);

    const db = drizzle(c.env.DB);
    const body = await c.req.json();

    const updates: Record<string, any> = {};
    const assign = (property: string, ...keys: string[]) => {
        const key = keys.find(candidate => Object.prototype.hasOwnProperty.call(body, candidate));
        if (key) updates[property] = body[key];
    };

    assign('userId', 'user_id', 'userId');
    assign('type', 'type');
    assign('name', 'name');
    assign('phone', 'phone');
    assign('email', 'email');
    assign('destination', 'destination');
    assign('headcount', 'headcount');
    assign('period', 'period');
    assign('budget', 'budget');
    assign('travelTypes', 'travel_types', 'travelTypes');
    assign('accommodations', 'accommodations');
    assign('vehicle', 'vehicle');
    assign('additionalRequest', 'additional_request', 'additionalRequest');
    assign('attachmentUrl', 'attachment_url', 'attachmentUrl');
    assign('status', 'status');
    assign('adminNote', 'admin_note', 'adminNote');
    assign('estimateUrl', 'estimate_url', 'estimateUrl');
    assign('confirmedStartDate', 'confirmed_start_date', 'confirmedStartDate');
    assign('confirmedEndDate', 'confirmed_end_date', 'confirmedEndDate');
    assign('confirmedPrice', 'confirmed_price', 'confirmedPrice');
    assign('deposit', 'deposit');
    assign('depositStatus', 'deposit_status', 'depositStatus');
    assign('balanceStatus', 'balance_status', 'balanceStatus');
    assign('itineraryTemplateId', 'itinerary_template_id', 'itineraryTemplateId');
    assign('documentContent', 'document_content', 'documentContent');

    if (Array.isArray(updates.travelTypes)) updates.travelTypes = JSON.stringify(updates.travelTypes);
    if (Array.isArray(updates.accommodations)) updates.accommodations = JSON.stringify(updates.accommodations);
    if (updates.documentContent !== undefined && updates.documentContent !== null && typeof updates.documentContent !== 'string') {
        updates.documentContent = JSON.stringify(updates.documentContent);
    }

    await db.update(quotes).set({
        ...updates,
        updatedAt: new Date().toISOString(),
    }).where(eq(quotes.id, id)).run();

    return c.json({ success: true });
});

// DELETE /api/quotes/:id
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    // Auth check
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);
    if (!sessionId) return c.json({ error: "Unauthorized" }, 401);
    const { session, user } = await lucia.validateSession(sessionId);
    if (!session || user.role !== 'admin') return c.json({ error: "Forbidden" }, 403);

    const db = drizzle(c.env.DB);
    await db.delete(quotes).where(eq(quotes.id, id)).run();

    return c.json({ success: true });
});

export default app;
