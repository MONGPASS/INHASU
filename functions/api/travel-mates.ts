import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { initializeLucia } from '../lib/auth';
import { createNotification } from './notifications/index';

interface Env {
    DB: any;
}

const app = new Hono<{ Bindings: Env }>();

/** Signed-in user for this request, or null. Reads are public; writes need a user. */
const sessionUser = async (c: any) => {
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);
    if (!sessionId) return null;
    const { session, user } = await lucia.validateSession(sessionId);
    return session ? user : null;
};

/** Post/comment authors and admins may change or remove it. */
const canManage = (user: any, ownerId: string | null | undefined) =>
    !!user && (user.role === 'admin' || (!!ownerId && ownerId === user.id));

// GET /api/travel-mates
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM travel_mates ORDER BY created_at DESC').all();
        return c.json(result.results);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// GET /api/travel-mates/:id
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM travel_mates WHERE id=?').bind(id).first();
        if (!result) return c.json({ error: 'Not found' }, 404);
        return c.json(result);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/travel-mates
app.post('/', async (c) => {
    const user = await sessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const data = await c.req.json();
    const db = c.env.DB;
    const id = crypto.randomUUID();
    
    try {
        await db.prepare(
            `INSERT INTO travel_mates (
                id, user_id, user_name, user_avatar, title, content, destination, travel_date, max_members, current_members, status, tags, created_at,
                image, start_date, end_date, duration, recruit_count, gender, age_groups, region, styles, author_info, view_count, comment_count, author_name, author_image, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            id, 
            user.id, 
            data.user_name || user.name || '', 
            data.user_avatar || '', 
            data.title || '', 
            data.content || '', 
            data.destination || '', 
            data.travel_date || '', 
            data.max_members || 4, 
            data.current_members || 1, 
            data.status || 'open', 
            JSON.stringify(data.tags || []), 
            data.created_at || new Date().toISOString(),
            data.image || '',
            data.start_date || '',
            data.end_date || '',
            data.duration || '',
            data.recruit_count || 4,
            data.gender || 'any',
            JSON.stringify(data.age_groups || []),
            data.region || '',
            JSON.stringify(data.styles || []),
            data.author_info || '',
            0,
            0,
            data.author_name || user.name || '',
            data.author_image || user.avatarUrl || '',
            data.description || ''
        ).run();
        
        return c.json({ ...data, id, user_id: user.id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/travel-mates/:id
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const user = await sessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const post = await db.prepare('SELECT user_id FROM travel_mates WHERE id=?').bind(id).first();
    if (!post) return c.json({ error: 'Not found' }, 404);
    if (!canManage(user, post.user_id)) return c.json({ error: 'Forbidden' }, 403);
    const data = await c.req.json();
    
    try {
        const updateFields: string[] = [];
        const updateValues: any[] = [];
        
        const safeKeys = [
            'title', 'content', 'destination', 'travel_date', 'max_members', 'current_members', 'status', 'tags',
            'image', 'start_date', 'end_date', 'duration', 'recruit_count', 'gender', 'age_groups', 'region', 
            'styles', 'author_info', 'author_name', 'author_image', 'description'
        ];

        for (const key of safeKeys) {
            if (data[key] !== undefined) {
                updateFields.push(`${key}=?`);
                if (key === 'tags' || key === 'age_groups' || key === 'styles') {
                     updateValues.push(JSON.stringify(data[key]));
                } else {
                     updateValues.push(data[key]);
                }
            }
        }

        if (updateFields.length > 0) {
             updateValues.push(id);
             await db.prepare(
                 `UPDATE travel_mates SET ${updateFields.join(', ')} WHERE id=?`
             ).bind(...updateValues).run();
        }
        
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/travel-mates/:id
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    const user = await sessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const post = await db.prepare('SELECT user_id FROM travel_mates WHERE id=?').bind(id).first();
    if (!post) return c.json({ error: 'Not found' }, 404);
    if (!canManage(user, post.user_id)) return c.json({ error: 'Forbidden' }, 403);
    try {
        await ensureCommentsTable(db);
        await db.prepare('DELETE FROM travel_mate_comments WHERE post_id=?').bind(id).run();
        // The requests table only exists after /api/migrate-db has run.
        try {
            await db.prepare('DELETE FROM travel_mate_requests WHERE post_id=?').bind(id).run();
        } catch { /* nothing to clean up */ }
        await db.prepare('DELETE FROM travel_mates WHERE id=?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/travel-mates/:id/view — public view counter (the post itself is owner/admin-only to edit)
app.post('/:id/view', async (c) => {
    const id = c.req.param('id');
    try {
        await c.env.DB.prepare('UPDATE travel_mates SET view_count = COALESCE(view_count, 0) + 1 WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ===== Comments =====

const ensureCommentsTable = async (db: any) => {
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS travel_mate_comments (
            id TEXT PRIMARY KEY,
            post_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_name TEXT DEFAULT '',
            user_image TEXT DEFAULT '',
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (post_id) REFERENCES travel_mates(id) ON DELETE CASCADE
        )
    `).run();
};

// GET /api/travel-mates/:id/comments
app.get('/:id/comments', async (c) => {
    const postId = c.req.param('id');
    const db = c.env.DB;
    try {
        await ensureCommentsTable(db);
        const { results } = await db.prepare(
            'SELECT * FROM travel_mate_comments WHERE post_id = ? ORDER BY created_at ASC'
        ).bind(postId).all();
        return c.json(results || []);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/travel-mates/:id/comments
app.post('/:id/comments', async (c) => {
    const postId = c.req.param('id');
    const db = c.env.DB;
    const user = await sessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    try {
        await ensureCommentsTable(db);
        const data = await c.req.json();
        const id = crypto.randomUUID();

        await db.prepare(
            `INSERT INTO travel_mate_comments (id, post_id, user_id, user_name, user_image, content) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(id, postId, user.id, data.user_name || user.name || '', data.user_image || user.avatarUrl || '', data.content || '').run();

        // Increment comment_count on the post
        await db.prepare(
            `UPDATE travel_mates SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = ?`
        ).bind(postId).run();

        const newComment = await db.prepare('SELECT * FROM travel_mate_comments WHERE id = ?').bind(id).first();
        return c.json(newComment);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/travel-mates/:postId/comments/:commentId
app.delete('/:postId/comments/:commentId', async (c) => {
    const postId = c.req.param('postId');
    const commentId = c.req.param('commentId');
    const db = c.env.DB;
    const user = await sessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    try {
        await ensureCommentsTable(db);
        const comment = await db.prepare('SELECT user_id FROM travel_mate_comments WHERE id = ? AND post_id = ?').bind(commentId, postId).first();
        if (!comment) return c.json({ error: 'Not found' }, 404);
        const post = await db.prepare('SELECT user_id FROM travel_mates WHERE id = ?').bind(postId).first();
        if (!canManage(user, comment.user_id) && !canManage(user, post?.user_id)) return c.json({ error: 'Forbidden' }, 403);

        await db.prepare('DELETE FROM travel_mate_comments WHERE id = ? AND post_id = ?').bind(commentId, postId).run();

        // Decrement comment_count on the post
        await db.prepare(
            `UPDATE travel_mates SET comment_count = MAX(0, COALESCE(comment_count, 0) - 1) WHERE id = ?`
        ).bind(postId).run();

        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// ===== Join requests (참가 요청) =====
// A request only tells the host that someone wants to join. It never changes the post's
// member count or status: the host still decides (comments, closing the post).
// The table is created by /api/migrate-db; until then reads are empty and writes answer 503.

const REQUESTS_UNAVAILABLE = '지금은 참가 요청을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요.';
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isMissingTable = (e: unknown) => /no such table/i.test(errorText(e));

/** Same closed / full rule as the screens (src/components/mates-desktop/matesData.ts). */
const CLOSED_STATUSES = ['closed', 'full', 'matched', 'completed'];
const isClosed = (post: { status?: unknown; recruit_count?: unknown; current_members?: unknown }) => {
    const cap = Math.max(0, Number(post.recruit_count) || 0);
    const joined = Math.max(0, Number(post.current_members) || 0);
    return CLOSED_STATUSES.includes(String(post.status || '').toLowerCase()) || (cap > 0 && joined >= cap);
};

const requestCount = async (db: Env['DB'], postId: string) => {
    const row = await db.prepare('SELECT COUNT(*) AS n FROM travel_mate_requests WHERE post_id = ?').bind(postId).first();
    return Number(row?.n) || 0;
};

// GET /api/travel-mates/:id/requests — { count, mine } for anyone; the host / an admin also gets the list.
app.get('/:id/requests', async (c) => {
    const postId = c.req.param('id');
    const db = c.env.DB;
    try {
        const post = await db.prepare('SELECT user_id FROM travel_mates WHERE id = ?').bind(postId).first();
        if (!post) return c.json({ error: 'Not found' }, 404);
        const user = await sessionUser(c);
        const manage = canManage(user, post.user_id);
        try {
            const count = await requestCount(db, postId);
            const mine = user
                ? !!(await db.prepare('SELECT id FROM travel_mate_requests WHERE post_id = ? AND user_id = ?').bind(postId, user.id).first())
                : false;
            if (!manage) return c.json({ count, mine });
            const { results } = await db.prepare(
                'SELECT user_id, user_name, created_at FROM travel_mate_requests WHERE post_id = ? ORDER BY created_at ASC'
            ).bind(postId).all();
            return c.json({ count, mine, requesters: results || [] });
        } catch (e) {
            if (!isMissingTable(e)) throw e;
            return c.json(manage ? { count: 0, mine: false, requesters: [] } : { count: 0, mine: false });
        }
    } catch (e) {
        return c.json({ error: errorText(e) }, 500);
    }
});

// POST /api/travel-mates/:id/requests — signed-in members other than the host; idempotent.
app.post('/:id/requests', async (c) => {
    const postId = c.req.param('id');
    const db = c.env.DB;
    const user = await sessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    try {
        const post = await db.prepare(
            'SELECT user_id, title, status, recruit_count, current_members FROM travel_mates WHERE id = ?'
        ).bind(postId).first();
        if (!post) return c.json({ error: 'Not found' }, 404);
        if (post.user_id && post.user_id === user.id) return c.json({ error: '본인이 올린 모집에는 참가 요청을 보낼 수 없습니다.' }, 403);

        const existing = await db.prepare('SELECT id FROM travel_mate_requests WHERE post_id = ? AND user_id = ?').bind(postId, user.id).first();
        if (existing) return c.json({ success: true, requested: true, already: true, count: await requestCount(db, postId) });
        if (isClosed(post)) return c.json({ error: '이 모집은 마감되었습니다.' }, 409);

        const userName = String(user.name || '').trim() || String(user.email || '').split('@')[0] || '';
        const inserted = await db.prepare(
            'INSERT OR IGNORE INTO travel_mate_requests (id, post_id, user_id, user_name) VALUES (?, ?, ?, ?)'
        ).bind(crypto.randomUUID(), postId, user.id, userName).run();

        // Tell the host once: cancelling and asking again while the earlier notice is unread adds no new one.
        if (post.user_id && inserted?.meta?.changes !== 0) {
            const link = `/travel-mates/${postId}`;
            const message = `${userName || '회원'} 님이 '${String(post.title || '').trim() || '동행 찾기'}' 모집에 참가를 희망합니다.`;
            let unread = null;
            try {
                unread = await db.prepare(
                    'SELECT id FROM notifications WHERE user_id = ? AND link = ? AND body = ? AND read = 0 LIMIT 1'
                ).bind(post.user_id, link, message).first();
            } catch { /* fall through and notify */ }
            if (!unread) {
                await createNotification(db, { userId: post.user_id, type: 'comment', title: '참가 요청이 도착했습니다', message, link });
            }
        }
        return c.json({ success: true, requested: true, count: await requestCount(db, postId) });
    } catch (e) {
        if (isMissingTable(e)) return c.json({ error: REQUESTS_UNAVAILABLE }, 503);
        return c.json({ error: errorText(e) }, 500);
    }
});

// DELETE /api/travel-mates/:id/requests — the requester withdraws their own request.
app.delete('/:id/requests', async (c) => {
    const postId = c.req.param('id');
    const db = c.env.DB;
    const user = await sessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    try {
        await db.prepare('DELETE FROM travel_mate_requests WHERE post_id = ? AND user_id = ?').bind(postId, user.id).run();
        return c.json({ success: true, requested: false, count: await requestCount(db, postId) });
    } catch (e) {
        if (isMissingTable(e)) return c.json({ error: REQUESTS_UNAVAILABLE }, 503);
        return c.json({ error: errorText(e) }, 500);
    }
});

export default app;

