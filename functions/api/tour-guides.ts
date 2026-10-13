import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';
import { BRAND } from '../../src/constants/company';

interface Env {
    DB: any;
    RESEND_API_KEY: string;
    ADMIN_EMAIL: string;
}

const app = new Hono<{ Bindings: Env }>();

const escapeHtml = (value: unknown) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
const joinList = (value: unknown) => (Array.isArray(value) ? value.join(', ') : '');

// GET /api/tour-guides (admin) — rows carry guides' and applicants' phone numbers
app.get('/', requireAdmin, async (c) => {
    const db = c.env.DB;
    try {
        const result = await db.prepare('SELECT * FROM guides ORDER BY created_at DESC').all();
        return c.json(result.results);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/tour-guides/apply (public — no auth required)
app.post('/apply', async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    const id = crypto.randomUUID();

    if (!data.name || !data.phone) {
        return c.json({ error: 'name and phone are required' }, 400);
    }

    try {
        await db.prepare(
            `INSERT INTO guides (id, name, bio, phone, languages, specialties, image, experience_years, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
        ).bind(
            id,
            String(data.name),
            String(data.bio || ''),
            String(data.phone),
            JSON.stringify(data.languages || []),
            JSON.stringify(data.specialties || []),
            String(data.image || ''),
            Number(data.experience_years || 0),
        ).run();

        // Admin notification email
        if (c.env.RESEND_API_KEY) {
            const adminEmail = c.env.ADMIN_EMAIL || 'arvijixmeat@gmail.com';
            await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    // 발신 주소는 Resend 인증 도메인이라 그대로 둔다(표시 이름만 브랜드명).
                    from: `${BRAND.name} <noreply@mongolryokou.com>`,
                    to: [adminEmail],
                    subject: `[가이드 지원] ${String(data.name).slice(0, 80)} 님`,
                    html: `<p>새 가이드 지원서가 접수되었습니다.</p>
                           <p><strong>이름:</strong> ${escapeHtml(data.name)}</p>
                           <p><strong>전화:</strong> ${escapeHtml(data.phone)}</p>
                           <p><strong>언어:</strong> ${escapeHtml(joinList(data.languages))}</p>
                           <p><strong>전문 분야:</strong> ${escapeHtml(joinList(data.specialties))}</p>
                           <p><a href="${BRAND.siteUrl}/admin/guides">관리 화면에서 확인하기</a></p>`,
                }),
            }).catch(() => {});
        }

        return c.json({ success: true, id });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// POST /api/tour-guides (admin create)
app.post('/', requireAdmin, async (c) => {
    const data = await c.req.json();
    const db = c.env.DB;
    const id = data.id || crypto.randomUUID();
    try {
        await db.prepare(
            `INSERT INTO guides (id, name, bio, phone, languages, specialties, image, experience_years, status, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`
        ).bind(
            id,
            String(data.name || ''),
            String(data.bio || ''),
            String(data.phone || ''),
            JSON.stringify(data.languages || []),
            JSON.stringify(data.specialties || []),
            String(data.image || ''),
            Number(data.experience_years || 0),
        ).run();
        return c.json({ id, ...data });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/tour-guides/:id (admin)
app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const data = await c.req.json();
    const db = c.env.DB;
    try {
        await db.prepare(
            `UPDATE guides SET name=?, bio=?, phone=?, languages=?, specialties=?, image=?, experience_years=?, status=? WHERE id=?`
        ).bind(
            String(data.name || ''),
            String(data.bio || ''),
            String(data.phone || ''),
            JSON.stringify(data.languages || []),
            JSON.stringify(data.specialties || []),
            String(data.image || ''),
            Number(data.experience_years || 0),
            String(data.status || 'active'),
            id
        ).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// DELETE /api/tour-guides/:id (admin)
app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const db = c.env.DB;
    try {
        await db.prepare('DELETE FROM guides WHERE id=?').bind(id).run();
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;