import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

const app = new Hono<{ Bindings: Env }>();

/**
 * Tour-common FAQ — shared FAQ block displayed at the bottom of every
 * product detail page (PC + mobile). Stored in the existing `faqs` table
 * under the fixed category `'tour-common'` so we don't need a new table.
 *
 * Per-product `product.faqs` (when set) still overrides this list.
 */
const CATEGORY = 'tour-common';

// GET /api/tour-faqs - public, returns active rows ordered by sort_order
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        const result = await db
            .prepare("SELECT id, question, answer, sort_order FROM faqs WHERE category = ? AND is_active = 1 ORDER BY sort_order ASC")
            .bind(CATEGORY)
            .all();
        return c.json(result.results || []);
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/tour-faqs - admin-only bulk replace (deletes only this category,
// leaves the standalone /faq page's other categories untouched)
app.put('/', requireAdmin, async (c) => {
    const body = await c.req.json();
    const faqs: Array<{ id?: string; question?: string; answer?: string }> =
        Array.isArray(body?.faqs) ? body.faqs : [];
    const db = c.env.DB;
    try {
        const stmts: D1PreparedStatement[] = [
            db.prepare('DELETE FROM faqs WHERE category = ?').bind(CATEGORY),
        ];
        for (let i = 0; i < faqs.length; i++) {
            const f = faqs[i];
            const q = (f.question || '').trim();
            const a = (f.answer || '').trim();
            if (!q && !a) continue; // skip blank rows
            stmts.push(
                db.prepare(
                    "INSERT INTO faqs (id, question, answer, category, sort_order, is_active) VALUES (?, ?, ?, ?, ?, 1)"
                ).bind(f.id || crypto.randomUUID(), q, a, CATEGORY, i)
            );
        }
        await db.batch(stmts);
        return c.json({ success: true, count: stmts.length - 1 });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
