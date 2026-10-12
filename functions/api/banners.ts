import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { requireAdmin } from '../lib/adminAuth';

const app = new Hono<{ Bindings: Env }>();

// GET /api/banners - Get all banner data
app.get('/', async (c) => {
    const db = c.env.DB;
    try {
        const [banners, quickLinks, eventBanners, categoryTabs] = await Promise.all([
            db.prepare('SELECT * FROM banners ORDER BY sort_order ASC').all(),
            db.prepare('SELECT * FROM quick_links ORDER BY sort_order ASC').all(),
            db.prepare('SELECT * FROM event_banners ORDER BY sort_order ASC').all(),
            db.prepare('SELECT * FROM category_tabs ORDER BY sort_order ASC').all(),
        ]);
        return c.json({
            banners: banners.results,
            quickLinks: quickLinks.results,
            eventBanners: eventBanners.results,
            categoryTabs: categoryTabs.results,
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// PUT /api/banners - Save all banner data (admin)
app.put('/', requireAdmin, async (c) => {
    const { banners, quickLinks, eventBanners, categoryTabs } = await c.req.json();
    const db = c.env.DB;

    try {
        // Clear and re-insert all data in a batch
        const stmts: D1PreparedStatement[] = [];

        stmts.push(db.prepare('DELETE FROM banners'));
        stmts.push(db.prepare('DELETE FROM quick_links'));
        stmts.push(db.prepare('DELETE FROM event_banners'));
        stmts.push(db.prepare('DELETE FROM category_tabs'));

        if (banners) {
            for (let i = 0; i < banners.length; i++) {
                const b = banners[i];
                // Accept either camelCase (from admin form) or snake_case (raw DB)
                // for every PC-specific field so callers can use either convention.
                const pcImg = b.pcImage ?? b.pc_image ?? '';
                const pcTitle = b.pcTitle ?? b.pc_title ?? '';
                const pcSubtitle = b.pcSubtitle ?? b.pc_subtitle ?? '';
                const pcTag = b.pcTag ?? b.pc_tag ?? '';
                stmts.push(db.prepare(
                    'INSERT INTO banners (id, image, pc_image, tag, title, subtitle, link, pc_title, pc_subtitle, pc_tag, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(
                    b.id, b.image || '', pcImg,
                    b.tag || '', b.title || '', b.subtitle || '', b.link || '',
                    pcTitle, pcSubtitle, pcTag,
                    i,
                ));
            }
        }

        if (quickLinks) {
            for (let i = 0; i < quickLinks.length; i++) {
                const l = quickLinks[i];
                stmts.push(db.prepare(
                    'INSERT INTO quick_links (id, icon, image, label, path, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
                ).bind(l.id, l.icon || '', l.image || '', l.label || '', l.path || '', i));
            }
        }

        if (eventBanners) {
            for (let i = 0; i < eventBanners.length; i++) {
                const e = eventBanners[i];
                stmts.push(db.prepare(
                    'INSERT INTO event_banners (id, image, background_color, tag, title, icon, link, location, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
                ).bind(e.id, e.image || '', e.backgroundColor || '#0F766E', e.tag || '', e.title || '', e.icon || '', e.link || '', e.location || 'all', i));
            }
        }

        if (categoryTabs) {
            for (let i = 0; i < categoryTabs.length; i++) {
                const ct = categoryTabs[i];
                stmts.push(db.prepare(
                    'INSERT INTO category_tabs (id, name, title, subtitle, banner_image, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
                ).bind(ct.id, ct.name || '', ct.title || '', ct.subtitle || '', ct.bannerImage || '', i));
            }
        }

        await db.batch(stmts);
        return c.json({ success: true });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default app;
