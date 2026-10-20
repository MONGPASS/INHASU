import { Hono } from 'hono';
import { requireAuth } from '../lib/userAuth';
import { requireResourceAccess } from '../lib/customerAccess';

type Variables = { user: { id: string; name?: string; email?: string; avatarUrl?: string; role?: string } };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const REVIEW_MIN_LENGTH = 10;
const REVIEW_MAX_LENGTH = 2000;

function parseHistory(value: unknown): Array<Record<string, unknown>> {
    if (typeof value !== 'string' || !value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function todayInJapan() {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

// GET /api/reviews  — optional filters: ?product_id=... & ?approved=1
app.get('/', async (c) => {
    const db = c.env.DB;
    const productId = c.req.query('product_id');
    const approvedParam = c.req.query('approved');
    try {
        const where: string[] = [];
        const binds: any[] = [];
        if (productId) { where.push('product_id = ?'); binds.push(productId); }
        if (approvedParam === '1' || approvedParam === 'true') { where.push('is_approved = 1'); }
        const sql = `
            SELECT reviews.*,
                   COALESCE((SELECT COUNT(*) FROM review_helpful WHERE review_id = reviews.id), 0) AS helpful_count
            FROM reviews
            ${where.length ? ' WHERE ' + where.join(' AND ') : ''}
            ORDER BY reviews.created_at DESC
        `;
        const result = await (binds.length ? db.prepare(sql).bind(...binds) : db.prepare(sql)).all();
        return c.json(result.results);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/reviews/reservation/:reservationId — login required.
// The reservation controls the author/tour identity, and a history marker prevents
// the same reservation from being reviewed twice through the invitation flow.
app.post('/reservation/:reservationId', requireAuth, async (c) => {
    const reservationId = c.req.param('reservationId');
    const denied = await requireResourceAccess(c.req.raw, c.env, 'reservation', reservationId, { write: true });
    if (denied) return denied;
    const data = await c.req.json();
    const db = c.env.DB;
    const sessionUser = c.get('user');

    const reservation = await db.prepare(`
        SELECT id, user_id, customer_email, customer_name, product_id, product_name,
               start_date, end_date, status, history
        FROM reservations
        WHERE id = ?
    `).bind(reservationId).first<{
        id: string;
        user_id: string | null;
        customer_email: string | null;
        customer_name: string | null;
        product_id: string | null;
        product_name: string | null;
        start_date: string | null;
        end_date: string | null;
        status: string | null;
        history: string | null;
    }>();

    if (!reservation) return c.json({ error: 'Reservation not found' }, 404);

    const endDate = reservation.end_date?.slice(0, 10) || '';
    const eligibleStatus = ['confirmed', 'paid', 'completed'].includes(reservation.status || '');
    const tourHasEnded = reservation.status === 'completed' || (!!endDate && endDate < todayInJapan());
    if (!eligibleStatus || !tourHasEnded) {
        return c.json({ error: 'This tour is not eligible for a review yet' }, 400);
    }

    const history = parseHistory(reservation.history);
    if (history.some((entry) => entry.type === 'review_submitted')) {
        return c.json({ error: 'A review has already been submitted for this reservation' }, 409);
    }

    const rating = Number(data.rating);
    const content = typeof data.content === 'string' ? data.content.trim() : '';
    const images = Array.isArray(data.images)
        ? data.images.filter((image: unknown) => typeof image === 'string').slice(0, 10)
        : [];
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return c.json({ error: 'Rating must be an integer between 1 and 5' }, 400);
    }
    if (content.length < REVIEW_MIN_LENGTH || content.length > REVIEW_MAX_LENGTH) {
        return c.json({ error: `Review must be between ${REVIEW_MIN_LENGTH} and ${REVIEW_MAX_LENGTH} characters` }, 400);
    }

    const id = crypto.randomUUID();
    const productName = reservation.product_name || '몽골 투어';
    const userName = sessionUser.name || reservation.customer_name || sessionUser.email?.split('@')[0] || '';
    const submittedAt = new Date().toISOString();
    const nextHistory = history.concat({ type: 'review_submitted', date: submittedAt, reviewId: id });

    try {
        await db.batch([
            db.prepare(
                'INSERT INTO reviews (id, user_id, user_name, user_avatar, product_id, product_name, rating, title, content, images, is_approved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            ).bind(
                id,
                sessionUser.id,
                userName,
                sessionUser.avatarUrl || '',
                reservation.product_id || '',
                productName,
                rating,
                `${productName} 후기`,
                content,
                JSON.stringify(images),
                1,
                submittedAt,
            ),
            db.prepare('UPDATE reservations SET history = ? WHERE id = ?')
                .bind(JSON.stringify(nextHistory), reservation.id),
        ]);
        return c.json({ id });
    } catch (e: unknown) {
        return c.json({ error: e instanceof Error ? e.message : 'Failed to save review' }, 500);
    }
});

// GET /api/reviews/:id
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        const result = await db.prepare(`
            SELECT reviews.*,
                   COALESCE((SELECT COUNT(*) FROM review_helpful WHERE review_id = reviews.id), 0) AS helpful_count
            FROM reviews
            WHERE reviews.id = ?
        `).bind(id).first();
        if (!result) return c.json({ error: 'Not found' }, 404);
        return c.json(result);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/reviews/:id/helpful — current user's reaction state.
app.get('/:id/helpful', requireAuth, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const sessionUser = c.get('user');

    const state = await db.prepare(`
        SELECT
            EXISTS(SELECT 1 FROM review_helpful WHERE review_id = ? AND user_id = ?) AS helpful,
            (SELECT COUNT(*) FROM review_helpful WHERE review_id = ?) AS helpful_count
    `).bind(id, sessionUser.id, id).first<{ helpful: number; helpful_count: number }>();

    return c.json({
        helpful: Boolean(state?.helpful),
        helpful_count: Number(state?.helpful_count || 0),
    });
});

// POST /api/reviews/:id/helpful — toggle only the authenticated user's reaction.
app.post('/:id/helpful', requireAuth, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const sessionUser = c.get('user');

    const review = await db.prepare('SELECT id FROM reviews WHERE id = ?').bind(id).first();
    if (!review) return c.json({ error: 'Review not found' }, 404);

    const existing = await db.prepare(
        'SELECT 1 AS found FROM review_helpful WHERE review_id = ? AND user_id = ?'
    ).bind(id, sessionUser.id).first();

    if (existing) {
        await db.prepare('DELETE FROM review_helpful WHERE review_id = ? AND user_id = ?')
            .bind(id, sessionUser.id)
            .run();
    } else {
        await db.prepare('INSERT OR IGNORE INTO review_helpful (review_id, user_id) VALUES (?, ?)')
            .bind(id, sessionUser.id)
            .run();
    }

    // Read the final state back from D1 so concurrent/repeated requests cannot
    // leave the client displaying a guessed count or selection state.
    const state = await db.prepare(`
        SELECT
            EXISTS(SELECT 1 FROM review_helpful WHERE review_id = ? AND user_id = ?) AS helpful,
            (SELECT COUNT(*) FROM review_helpful WHERE review_id = ?) AS helpful_count
    `).bind(id, sessionUser.id, id).first<{ helpful: number; helpful_count: number }>();

    return c.json({
        helpful: Boolean(state?.helpful),
        helpful_count: Number(state?.helpful_count || 0),
    });
});

// POST /api/reviews — login required.
//
// Identity rules:
// - Regular users: user_id / user_name / user_avatar are forced from the validated
//   session to prevent spoofing or scripted submissions.
// - Admins: may post on behalf of off-platform customers (Instagram DMs, custom-quote
//   travelers, etc.) via the admin review-manage page, so the client-supplied
//   user_name / user_avatar are honored. user_id is still tagged with the admin's id
//   for audit purposes.
//
// Approval policy:
// - Reviews from authenticated users (regular or admin) publish immediately
//   (is_approved = 1). Spam/abuse risk is mitigated by the requireAuth gate
//   (Google login required) and the admin's ability to soft-hide or delete bad
//   reviews from /admin/reviews after the fact.
// - An admin may explicitly post a pending review by sending { is_approved: 0 }
//   when they want to vet content before publishing.
app.post('/', requireAuth, async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    const sessionUser = c.get('user');
    const isAdmin = sessionUser.role === 'admin';
    const id = data.id || crypto.randomUUID();

    const userName = isAdmin
        ? (data.user_name || data.author_name || sessionUser.name || '')
        : (sessionUser.name || sessionUser.email?.split('@')[0] || '');
    const userAvatar = isAdmin
        ? (data.user_avatar || sessionUser.avatarUrl || '')
        : (sessionUser.avatarUrl || '');
    const isApproved = isAdmin ? (data.is_approved ?? 1) : 1;

    try {
        await db.prepare(
            "INSERT INTO reviews (id, user_id, user_name, user_avatar, product_id, product_name, rating, title, content, images, is_approved, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(
            id,
            sessionUser.id, // always the actor's id (= admin id for proxy posts) for audit
            userName,
            userAvatar,
            data.product_id || '',
            data.product_name || '',
            data.rating || 5,
            data.title || '',
            data.content || '',
            JSON.stringify(data.images || []),
            isApproved ? 1 : 0,
            data.created_at || new Date().toISOString()
        ).run();
        return c.json({ id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

type ReviewComment = Record<string, unknown>;

function parseComments(value: unknown): ReviewComment[] {
    let parsed = value;
    if (typeof value === 'string') {
        try { parsed = JSON.parse(value || '[]'); } catch { return []; }
    }
    return Array.isArray(parsed)
        ? parsed.filter((entry): entry is ReviewComment => !!entry && typeof entry === 'object' && !Array.isArray(entry))
        : [];
}

// A member sends the whole comment list back. Keep what the server has for everyone
// else's comments and take only this member's own entries (new, edited or removed)
// from the request, so nobody can rewrite or drop another person's comment.
function mergeOwnComments(stored: ReviewComment[], requested: ReviewComment[], userId: string): ReviewComment[] {
    const key = (entry: ReviewComment) => String(entry.id ?? '');
    const requestedById = new Map(requested.map((entry) => [key(entry), entry]));
    const storedIds = new Set(stored.map(key));
    const merged: ReviewComment[] = [];
    for (const entry of stored) {
        if (entry.userId !== userId) {
            merged.push(entry);
            continue;
        }
        const mine = requestedById.get(key(entry));
        if (mine) merged.push({ ...mine, userId });
    }
    for (const entry of requested) {
        if (!storedIds.has(key(entry))) merged.push({ ...entry, userId });
    }
    return merged;
}

// PUT /api/reviews/:id — login required.
// - rating / title / content / images: the review's author or an admin.
// - comments: any member, limited to their own entries (see mergeOwnComments); admins may replace the list.
// - is_approved: admin only.
app.put('/:id', requireAuth, async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const db = c.env.DB;
    const sessionUser = c.get('user');
    const isAdmin = sessionUser.role === 'admin';

    try {
        const existing: { user_id: string | null; comments: string | null } | null = await db
            .prepare('SELECT user_id, comments FROM reviews WHERE id = ?')
            .bind(id)
            .first();
        if (!existing) return c.json({ error: 'Not found' }, 404);

        const editsReview = data.rating !== undefined || data.title !== undefined
            || data.content !== undefined || data.images !== undefined;
        if (editsReview && !isAdmin && existing.user_id !== sessionUser.id) {
            return c.json({ error: 'Forbidden' }, 403);
        }

        const fields: string[] = [];
        const binds: any[] = [];

        if (data.rating !== undefined) {
            fields.push('rating = ?');
            binds.push(data.rating || 5);
        }
        if (data.title !== undefined) {
            fields.push('title = ?');
            binds.push(data.title || '');
        }
        if (data.content !== undefined) {
            fields.push('content = ?');
            binds.push(data.content || '');
        }
        if (data.images !== undefined) {
            fields.push('images = ?');
            binds.push(JSON.stringify(data.images || []));
        }
        if (data.comments !== undefined) {
            fields.push('comments = ?');
            if (isAdmin) {
                binds.push(typeof data.comments === 'string' ? data.comments : JSON.stringify(data.comments));
            } else {
                binds.push(JSON.stringify(
                    mergeOwnComments(parseComments(existing.comments), parseComments(data.comments), sessionUser.id),
                ));
            }
        }
        // is_approved is admin-only.
        if (data.is_approved !== undefined && isAdmin) {
            fields.push('is_approved = ?');
            binds.push(data.is_approved ? 1 : 0);
        }

        if (fields.length === 0) {
            return c.json({ success: true, updated: 0 });
        }

        binds.push(id);
        await db.prepare(`UPDATE reviews SET ${fields.join(', ')} WHERE id = ?`).bind(...binds).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/reviews/:id — review author OR admin.
//
// The review's owner can remove their own post; admins can remove any review
// (used for moderation from /admin/reviews). All other callers get 403.
app.delete('/:id', requireAuth, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const sessionUser = c.get('user');
    const isAdmin = sessionUser.role === 'admin';
    try {
        const existing = await db.prepare('SELECT user_id FROM reviews WHERE id=?').bind(id).first<{ user_id: string }>();
        if (!existing) {
            return c.json({ error: 'Not found' }, 404);
        }
        if (!isAdmin && existing.user_id !== sessionUser.id) {
            return c.json({ error: 'Forbidden' }, 403);
        }
        await db.prepare('DELETE FROM reviews WHERE id=?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
