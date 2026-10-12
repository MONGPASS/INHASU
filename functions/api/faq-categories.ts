import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

// FAQ categories for the /faq page, managed at /admin/faq (category tab).
// FAQ rows point at a category by NAME (faqs.category), so a rename moves them along.

type Ctx = Context<{ Bindings: Env }>;

const app = new Hono<{ Bindings: Env }>();

/** Marker the admin page looks for; keep `/api/migrate-db` in the message. */
const MIGRATION_ERROR = 'faq_categories table is missing. Open /api/migrate-db once to create it.';

/** Category of the tour-common FAQ block (see tour-faqs.ts); never offered as a /faq category. */
const RESERVED_NAME = 'tour-common';
const MAX_NAME = 60;

interface CategoryRow {
    id: string;
    name: string | null;
    sort_order: number | null;
    is_active: number | boolean | null;
    created_at: string | null;
}

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isMissingTable = (e: unknown) => /no such table/i.test(errorMessage(e));

const writeError = (c: Ctx, e: unknown) =>
    isMissingTable(e)
        ? c.json({ error: MIGRATION_ERROR, code: 'MIGRATION_REQUIRED' }, 503)
        : c.json({ error: errorMessage(e) }, 500);

const readBody = async (c: Ctx): Promise<Record<string, unknown>> => {
    try {
        const body: unknown = await c.req.json();
        return body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
    } catch {
        return {};
    }
};

const nameOf = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, MAX_NAME) : '');
const activeFlag = (v: unknown) => (v === false || v === 0 || v === '0' || v === 'false' ? 0 : 1);
const sortOrder = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
};

// `order` is what the admin page reads and sends; `sort_order` is the column.
const toCategory = (row: CategoryRow) => ({
    id: row.id,
    name: row.name || '',
    is_active: row.is_active === 1 || row.is_active === true,
    order: row.sort_order || 0,
    sort_order: row.sort_order || 0,
    created_at: row.created_at || undefined,
});

/** Why a name cannot be used, or null. `exceptId` is the category being renamed. */
const nameProblem = async (db: Env['DB'], name: string, exceptId?: string) => {
    if (!name) return { status: 400 as const, error: 'name is required' };
    if (name === RESERVED_NAME) return { status: 400 as const, error: `"${RESERVED_NAME}" is reserved` };
    const taken = await db.prepare('SELECT id FROM faq_categories WHERE name = ? AND id != ?').bind(name, exceptId || '').first();
    return taken ? { status: 409 as const, error: 'A category with this name already exists' } : null;
};

// GET /api/faq-categories — public, in display order. Inactive rows are included: the
// public page filters on is_active and the admin page lists everything.
app.get('/', async (c) => {
    try {
        const result = await c.env.DB.prepare('SELECT * FROM faq_categories ORDER BY sort_order ASC, created_at ASC, id ASC').all<CategoryRow>();
        return c.json((result.results || []).map(toCategory));
    } catch (e) {
        // Before /api/migrate-db has run there are simply no categories; /faq then groups by the FAQ rows.
        if (isMissingTable(e)) return c.json([]);
        return c.json({ error: errorMessage(e) }, 500);
    }
});

// POST /api/faq-categories (admin) — body { id?, name, is_active?, order? }
app.post('/', requireAdmin, async (c) => {
    const data = await readBody(c);
    const db: Env['DB'] = c.env.DB;
    const name = nameOf(data.name);
    const id = typeof data.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(data.id)
        ? data.id
        : `faq-cat-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    try {
        const problem = await nameProblem(db, name);
        if (problem) return c.json({ error: problem.error }, problem.status);

        // New categories go to the end unless the caller places them.
        const requested = data.order ?? data.sort_order;
        let order = sortOrder(requested);
        if (requested === undefined || requested === null) {
            const last = await db.prepare('SELECT MAX(sort_order) AS max_order FROM faq_categories').first<{ max_order: number | null }>();
            order = last?.max_order == null ? 0 : last.max_order + 1;
        }
        const active = activeFlag(data.is_active ?? data.isActive);
        await db.prepare('INSERT INTO faq_categories (id, name, sort_order, is_active) VALUES (?, ?, ?, ?)')
            .bind(id, name, order, active)
            .run();
        return c.json({ success: true, id, name, is_active: active === 1, order, sort_order: order });
    } catch (e) {
        return writeError(c, e);
    }
});

// PUT /api/faq-categories/:id (admin) — only the fields present in the body are changed.
// A rename also moves the FAQ rows that carry the old name, in the same batch.
app.put('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const data = await readBody(c);
    const db: Env['DB'] = c.env.DB;
    try {
        const existing = await db.prepare('SELECT * FROM faq_categories WHERE id = ?').bind(id).first<CategoryRow>();
        if (!existing) return c.json({ error: 'Not found' }, 404);

        const sets: string[] = [];
        const values: (string | number)[] = [];
        const set = (column: string, value: string | number) => { sets.push(`${column} = ?`); values.push(value); };

        const oldName = existing.name || '';
        let newName = oldName;
        if (data.name !== undefined) {
            newName = nameOf(data.name);
            if (newName !== oldName) {
                const problem = await nameProblem(db, newName, id);
                if (problem) return c.json({ error: problem.error }, problem.status);
                set('name', newName);
            }
        }
        const active = data.is_active ?? data.isActive;
        if (active !== undefined) set('is_active', activeFlag(active));
        const order = data.order ?? data.sort_order;
        if (order !== undefined) set('sort_order', sortOrder(order));

        if (sets.length > 0) {
            const statements = [
                db.prepare(`UPDATE faq_categories SET ${sets.join(', ')} WHERE id = ?`).bind(...values, id),
            ];
            if (newName !== oldName && oldName) {
                statements.push(db.prepare('UPDATE faqs SET category = ? WHERE category = ?').bind(newName, oldName));
            }
            await db.batch(statements);
        }
        return c.json({ success: true });
    } catch (e) {
        return writeError(c, e);
    }
});

// DELETE /api/faq-categories/:id (admin) — refused while FAQ rows still use the category.
app.delete('/:id', requireAdmin, async (c) => {
    const id = c.req.param('id');
    const db: Env['DB'] = c.env.DB;
    try {
        const existing = await db.prepare('SELECT name FROM faq_categories WHERE id = ?').bind(id).first<{ name: string | null }>();
        if (!existing) return c.json({ success: true });
        const used = await db.prepare('SELECT COUNT(*) AS count FROM faqs WHERE category = ?').bind(existing.name || '').first<{ count: number }>();
        if (used && used.count > 0) {
            return c.json({ error: 'This category still has FAQs. Move or delete them first.', code: 'CATEGORY_IN_USE', count: used.count }, 409);
        }
        await db.prepare('DELETE FROM faq_categories WHERE id = ?').bind(id).run();
        return c.json({ success: true });
    } catch (e) {
        return writeError(c, e);
    }
});

export default app;
