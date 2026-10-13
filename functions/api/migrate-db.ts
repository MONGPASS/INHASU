import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';

type Env = {
    DB: any;
};

const app = new Hono<{ Bindings: Env }>();

// Stays a GET so a signed-in admin can run it by opening /api/migrate-db in the browser.
app.get('/', requireAdmin, async (c) => {
    let migrationResults: string[] = [];

    // Add reservation_number column to reservations table
    try {
        await c.env.DB.prepare('ALTER TABLE reservations ADD COLUMN reservation_number TEXT').run();
        migrationResults.push('Added reservations.reservation_number');
    } catch (e: any) {
        migrationResults.push(`Skipped reservations.reservation_number: ${e.message}`);
    }

    // Link reservations to itinerary templates
    try {
        await c.env.DB.prepare('ALTER TABLE reservations ADD COLUMN itinerary_template_id TEXT').run();
        migrationResults.push('Added reservations.itinerary_template_id');
    } catch (e: any) {
        migrationResults.push(`Skipped reservations.itinerary_template_id: ${e.message}`);
    }

    // Contract data (travelers, flights, region, category, etc.) stored as JSON
    try {
        await c.env.DB.prepare('ALTER TABLE reservations ADD COLUMN contract_data TEXT').run();
        migrationResults.push('Added reservations.contract_data');
    } catch (e: any) {
        migrationResults.push(`Skipped reservations.contract_data: ${e.message}`);
    }

    // Admin-managed reservation columns that were previously dropped silently
    const reservationColumns = [
        "assigned_guide TEXT",                          // JSON: guide object
        "contract_url TEXT",                            // legacy external URL (for pre-digital contracts)
        "itinerary_url TEXT",                           // legacy external URL
        "deposit_status TEXT DEFAULT 'unpaid'",
        "balance_status TEXT DEFAULT 'unpaid'",
        "are_assignments_visible_to_user INTEGER DEFAULT 0",
        "price_breakdown TEXT",                         // JSON: { total, deposit, local }
        "document_content TEXT",                         // JSON: 고객별 편집한 문서(일정·문서설정) { days, documentSettings }
        "duration TEXT",
        "source TEXT",                                   // 주문 경로: line | email | phone | website | visit | other (수동 추가 시 입력)
        "product_id TEXT",                               // 예약한 상품 ID — 상품 이미지·정보 정확 연결용 (동명 상품 혼동 방지)
        "deposit_report TEXT",                           // JSON: 고객의 예약금 입금 신고 { status: 'reported', name, reportedAt } — 미신고는 NULL
    ];
    for (const colDef of reservationColumns) {
        try {
            await c.env.DB.prepare(`ALTER TABLE reservations ADD COLUMN ${colDef}`).run();
            migrationResults.push(`Added reservations.${colDef}`);
        } catch (e: any) {
            migrationResults.push(`Skipped reservations.${colDef}: ${e.message}`);
        }
    }

    // In-app notifications table
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY NOT NULL,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                title TEXT NOT NULL,
                body TEXT,
                link TEXT,
                read INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        migrationResults.push('Created notifications table');
    } catch (e: any) {
        migrationResults.push(`Skipped notifications table: ${e.message}`);
    }
    try {
        await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at)').run();
        migrationResults.push('Created idx_notifications_user');
    } catch (e: any) {
        migrationResults.push(`Skipped idx_notifications_user: ${e.message}`);
    }

    // Reviews: comments and normalized per-user helpful reactions.
    // A separate table prevents clients from overwriting another user's reaction
    // and makes the displayed count authoritative on the server.
    try {
        await c.env.DB.prepare("ALTER TABLE reviews ADD COLUMN comments TEXT DEFAULT '[]'").run();
        migrationResults.push('Added reviews.comments');
    } catch (e: unknown) {
        migrationResults.push(`Skipped reviews.comments: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS review_helpful (
                review_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (review_id, user_id)
            )
        `).run();
        migrationResults.push('Created review_helpful table');
    } catch (e: unknown) {
        migrationResults.push(`Skipped review_helpful table: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
        await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_review_helpful_review ON review_helpful(review_id)').run();
        migrationResults.push('Created idx_review_helpful_review');
    } catch (e: unknown) {
        migrationResults.push(`Skipped idx_review_helpful_review: ${e instanceof Error ? e.message : String(e)}`);
    }

    // Create quotes table if it doesn't exist
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS quotes (
                id TEXT PRIMARY KEY NOT NULL,
                user_id TEXT,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                destination TEXT,
                headcount TEXT,
                period TEXT,
                budget TEXT,
                travel_types TEXT,
                accommodations TEXT,
                vehicle TEXT,
                additional_request TEXT,
                attachment_url TEXT,
                status TEXT DEFAULT 'pending',
                admin_note TEXT,
                estimate_url TEXT,
                confirmed_start_date TEXT,
                confirmed_end_date TEXT,
                confirmed_price INTEGER,
                deposit INTEGER,
                deposit_status TEXT DEFAULT 'unpaid',
                balance_status TEXT DEFAULT 'unpaid',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        console.log("quotes table migration ok");
    } catch (e: any) {
        console.log("quotes table migration: ", e.message);
    }

    try {
        await c.env.DB.prepare("ALTER TABLE categories ADD COLUMN type TEXT DEFAULT 'product'").run();
        console.log("categories migration ok");
    } catch (e: any) {
        console.log("categories migration: ", e.message);
    }

    // Category landing page content columns
    const categoryLandingCols = [
        "landing_hero_image TEXT",
        "landing_hero_images TEXT",        // JSON string array of image URLs (slider)
        "landing_hero_tagline TEXT",
        "landing_hero_title TEXT",
        "landing_hero_subtitle TEXT",
        "landing_accent_color TEXT",
        "landing_highlights TEXT",         // JSON string
        "landing_product_grid_title TEXT",
    ];
    for (const colDef of categoryLandingCols) {
        try {
            await c.env.DB.prepare(`ALTER TABLE categories ADD COLUMN ${colDef}`).run();
            migrationResults.push(`Added categories.${colDef}`);
        } catch (e: any) {
            migrationResults.push(`Skipped categories.${colDef}: ${e.message}`);
        }
    }
    
    // Travel Mates Migrations
    const travelMatesColumns = [
        "image TEXT",
        "start_date TEXT",
        "end_date TEXT",
        "duration TEXT",
        "recruit_count INTEGER DEFAULT 1",
        "gender TEXT DEFAULT 'any'",
        "age_groups TEXT DEFAULT '[]'",
        "region TEXT",
        "styles TEXT DEFAULT '[]'",
        "author_info TEXT",
        "view_count INTEGER DEFAULT 0",
        "comment_count INTEGER DEFAULT 0",
        "author_name TEXT",
        "author_image TEXT",
        "description TEXT"
    ];

    for (const colDef of travelMatesColumns) {
        try {
            await c.env.DB.prepare(`ALTER TABLE travel_mates ADD COLUMN ${colDef}`).run();
            migrationResults.push(`Added travel_mates.${colDef}`);
        } catch (e: any) {
            migrationResults.push(`Skipped travel_mates.${colDef}: ${e.message}`);
        }
    }

    // Add ALL potentially missing columns to quotes table (safe to run multiple times)
    const quotesColumns = [
        "user_id TEXT",
        "type TEXT",
        "name TEXT",
        "phone TEXT",
        "email TEXT",
        "destination TEXT",
        "headcount TEXT",
        "period TEXT",
        "budget TEXT",
        "travel_types TEXT",
        "accommodations TEXT",
        "vehicle TEXT",
        "additional_request TEXT",
        "attachment_url TEXT",
        "status TEXT DEFAULT 'pending'",
        "admin_note TEXT",
        "estimate_url TEXT",
        "confirmed_start_date TEXT",
        "confirmed_end_date TEXT",
        "confirmed_price INTEGER",
        "deposit INTEGER",
        "deposit_status TEXT DEFAULT 'unpaid'",
        "balance_status TEXT DEFAULT 'unpaid'",
        "itinerary_template_id TEXT",
        "document_content TEXT",
        "created_at TEXT DEFAULT CURRENT_TIMESTAMP",
        "updated_at TEXT DEFAULT CURRENT_TIMESTAMP",
    ];
    for (const colDef of quotesColumns) {
        try {
            await c.env.DB.prepare(`ALTER TABLE quotes ADD COLUMN ${colDef}`).run();
            migrationResults.push(`Added quotes.${colDef}`);
        } catch (e: any) {
            migrationResults.push(`Skipped quotes.${colDef}: ${e.message}`);
        }
    }

    // Create accommodations table
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS accommodations (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                location TEXT DEFAULT '',
                type TEXT DEFAULT '',
                price_per_night INTEGER DEFAULT 0,
                images TEXT DEFAULT '[]',
                thumbnail TEXT DEFAULT '',
                amenities TEXT DEFAULT '[]',
                facilities TEXT DEFAULT '[]',
                rating REAL DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        migrationResults.push('Created accommodations table');
    } catch (e: any) {
        migrationResults.push(`Skipped accommodations table: ${e.message}`);
    }

    // Add missing columns to accommodations table
    const accommodationsColumns = [
        "type TEXT DEFAULT ''",
        "facilities TEXT DEFAULT '[]'",
        "price_per_night INTEGER DEFAULT 0",
        "rating REAL DEFAULT 0",
    ];
    for (const colDef of accommodationsColumns) {
        try {
            await c.env.DB.prepare(`ALTER TABLE accommodations ADD COLUMN ${colDef}`).run();
            migrationResults.push(`Added accommodations.${colDef}`);
        } catch (e: any) {
            migrationResults.push(`Skipped accommodations.${colDef}: ${e.message}`);
        }
    }

    // Create guides table
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS guides (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                bio TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                languages TEXT DEFAULT '[]',
                specialties TEXT DEFAULT '[]',
                image TEXT DEFAULT '',
                status TEXT DEFAULT 'active',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        migrationResults.push('Created guides table');
    } catch (e: any) {
        migrationResults.push(`Skipped guides table: ${e.message}`);
    }

    // Add status column to guides if missing
    try {
        await c.env.DB.prepare("ALTER TABLE guides ADD COLUMN status TEXT DEFAULT 'active'").run();
        migrationResults.push('Added guides.status');
    } catch (e: any) {
        migrationResults.push(`Skipped guides.status: ${e.message}`);
    }

    // Add experience_years column to guides if missing
    try {
        await c.env.DB.prepare("ALTER TABLE guides ADD COLUMN experience_years INTEGER DEFAULT 0").run();
        migrationResults.push('Added guides.experience_years');
    } catch (e: any) {
        migrationResults.push(`Skipped guides.experience_years: ${e.message}`);
    }

    // Create itinerary_templates table
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS itinerary_templates (
                id TEXT PRIMARY KEY NOT NULL,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                days TEXT DEFAULT '[]',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        migrationResults.push('Created itinerary_templates table');
    } catch (e: any) {
        migrationResults.push(`Skipped itinerary_templates table: ${e.message}`);
    }

    // Products: per-product FAQ list (JSON array of { q, a }).
    // When empty, the frontend falls back to a site-wide common FAQ.
    try {
        await c.env.DB.prepare("ALTER TABLE products ADD COLUMN faqs TEXT DEFAULT '[]'").run();
        migrationResults.push('Added products.faqs');
    } catch (e: any) {
        migrationResults.push(`Skipped products.faqs: ${e.message}`);
    }

    // Products: trip type shown as a filter on the PC tour list.
    // 'full' = 풀패키지 (4성급 호텔 + 디럭스 게르), 'value' = 실속형 (3성급 호텔 + 스탠더드 게르), NULL = 미지정.
    try {
        await c.env.DB.prepare('ALTER TABLE products ADD COLUMN package_type TEXT').run();
        migrationResults.push('Added products.package_type');
    } catch (e: any) {
        migrationResults.push(`Skipped products.package_type: ${e.message}`);
    }

    // Hotels — reusable hotel master library.
    // Picked from dayInfo.accommodation in the product itinerary editor
    // so admin doesn't have to type "마리나베이샌즈호텔" repeatedly.
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS hotels (
                id TEXT PRIMARY KEY NOT NULL,
                code TEXT DEFAULT '',
                name_kr TEXT NOT NULL,
                name_local TEXT DEFAULT '',
                country TEXT DEFAULT '',
                city TEXT DEFAULT '',
                region TEXT DEFAULT '',
                star_rating INTEGER DEFAULT 0,
                address TEXT DEFAULT '',
                latitude REAL,
                longitude REAL,
                description TEXT DEFAULT '',
                website TEXT DEFAULT '',
                images TEXT DEFAULT '[]',
                amenities TEXT DEFAULT '[]',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        migrationResults.push('Created hotels table');
    } catch (e: any) {
        migrationResults.push(`Skipped hotels table: ${e.message}`);
    }

    // Tourist spots — reusable master library for the timeline blocks.
    // Picked from timeline events in the product itinerary editor so
    // admin doesn't have to retype spot title/description/photos.
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS tourist_spots (
                id TEXT PRIMARY KEY NOT NULL,
                name_kr TEXT NOT NULL,
                name_local TEXT DEFAULT '',
                address TEXT DEFAULT '',
                description TEXT DEFAULT '',
                images TEXT DEFAULT '[]',
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        `).run();
        migrationResults.push('Created tourist_spots table');
    } catch (e: any) {
        migrationResults.push(`Skipped tourist_spots table: ${e.message}`);
    }

    // Tourist spots: region tag so admin can filter by Central Mongolia /
    // Gobi / Hovsgol when picking a spot to attach to a timeline block.
    // Stored as a lowercase string ('central' | 'gobi' | 'hovsgol' | '').
    try {
        await c.env.DB.prepare("ALTER TABLE tourist_spots ADD COLUMN region TEXT DEFAULT ''").run();
        migrationResults.push('Added tourist_spots.region');
    } catch (e: any) {
        migrationResults.push(`Skipped tourist_spots.region: ${e.message}`);
    }

    // Banners: PC-specific hero image (wider aspect ratio than mobile).
    // Falls back to `image` when not set.
    try {
        await c.env.DB.prepare("ALTER TABLE banners ADD COLUMN pc_image TEXT").run();
        migrationResults.push('Added banners.pc_image');
    } catch (e: any) {
        migrationResults.push(`Skipped banners.pc_image: ${e.message}`);
    }

    // Banners: PC-specific text fields. Mobile and PC need different lengths
    // because the desktop hero uses 60px font on a 620px max-width column
    // and a long mobile title wraps mid-word. Each falls back to the mobile
    // equivalent (title/subtitle/tag) when blank.
    const bannerPcTextColumns = [
        "pc_title TEXT",
        "pc_subtitle TEXT",
        "pc_tag TEXT",
    ];
    for (const col of bannerPcTextColumns) {
        const colName = col.split(' ')[0];
        try {
            await c.env.DB.prepare(`ALTER TABLE banners ADD COLUMN ${col}`).run();
            migrationResults.push(`Added banners.${colName}`);
        } catch (e: any) {
            migrationResults.push(`Skipped banners.${colName}: ${e.message}`);
        }
    }

    // Magazines: author profile and location/map columns
    const magazineLocationColumns = [
        "author_image TEXT",
        "location_name TEXT",
        "location_address TEXT",
        "location_phone TEXT",
        "location_website TEXT",
        "location_hours TEXT",          // JSON: { mon: '09:00-17:00', ... }
        "map_embed_url TEXT",           // Google Maps embed iframe src
        "map_query TEXT",               // Address or "lat,lng" for directions URL
    ];
    for (const colDef of magazineLocationColumns) {
        try {
            await c.env.DB.prepare(`ALTER TABLE magazines ADD COLUMN ${colDef}`).run();
            migrationResults.push(`Added magazines.${colDef}`);
        } catch (e: any) {
            migrationResults.push(`Skipped magazines.${colDef}: ${e.message}`);
        }
    }

    // Promotions (여행 기획전) — admin-curated campaign cards on /promotions,
    // each listing the tours in product_ids (JSON string array, display order).
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS promotions (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                subtitle TEXT DEFAULT '',
                group_name TEXT DEFAULT '',
                badge TEXT DEFAULT '',
                art_text TEXT DEFAULT '',
                theme TEXT DEFAULT 'mint',
                image TEXT DEFAULT '',
                product_ids TEXT DEFAULT '[]',
                is_active INTEGER DEFAULT 1,
                sort_order INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        `).run();
        migrationResults.push('Created promotions table');
    } catch (e: any) {
        migrationResults.push(`Skipped promotions table: ${e.message}`);
    }

    // Join requests on travel-mate posts (참가 요청). One row per member and post;
    // a request never changes the post's member count — the host decides.
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS travel_mate_requests (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_name TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                UNIQUE(post_id, user_id)
            )
        `).run();
        migrationResults.push('Created travel_mate_requests table');
    } catch (e: any) {
        migrationResults.push(`Skipped travel_mate_requests table: ${e.message}`);
    }

    // FAQ categories for the /faq page (admin: /admin/faq, category tab).
    // FAQ rows reference a category by name (faqs.category).
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS faq_categories (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                created_at TEXT DEFAULT (datetime('now'))
            )
        `).run();
        migrationResults.push('Created faq_categories table');
    } catch (e: any) {
        migrationResults.push(`Skipped faq_categories table: ${e.message}`);
    }
    // First run only: list the categories the FAQ rows already use, so the admin
    // screen starts from what /faq shows today. 'tour-common' is the product-page
    // FAQ block (tour-faqs.ts), not a /faq category.
    try {
        const existing = await c.env.DB.prepare('SELECT COUNT(*) AS count FROM faq_categories').first();
        if (!Number((existing as any)?.count)) {
            const used = await c.env.DB.prepare(`
                SELECT category AS name, MIN(sort_order) AS first_order
                FROM faqs
                WHERE category IS NOT NULL AND TRIM(category) != '' AND category != 'tour-common'
                GROUP BY category
                ORDER BY first_order ASC, category ASC
            `).all();
            const names = ((used.results || []) as any[]).map((row) => String(row.name));
            if (names.length > 0) {
                await c.env.DB.batch(names.map((name, index) =>
                    c.env.DB.prepare('INSERT INTO faq_categories (id, name, sort_order, is_active) VALUES (?, ?, ?, 1)')
                        .bind(`faq-cat-${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`, name, index + 1),
                ));
            }
            migrationResults.push(`faq_categories: seeded ${names.length} from existing FAQ rows`);
        }
    } catch (e: any) {
        migrationResults.push(`Skipped faq_categories seed: ${e.message}`);
    }

    // Inquiries (문의) — /contact form intake, read at /admin/inquiries.
    // status: 'new' | 'answered' | 'closed'. user_id is set only for signed-in senders.
    try {
        await c.env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS inquiries (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                name TEXT,
                email TEXT,
                kind TEXT,
                reservation_number TEXT,
                message TEXT NOT NULL,
                status TEXT DEFAULT 'new',
                admin_note TEXT,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT
            )
        `).run();
        // The intake throttle counts recent rows on every submission.
        await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries (created_at)').run();
        migrationResults.push('Created inquiries table');
    } catch (e: any) {
        migrationResults.push(`Skipped inquiries table: ${e.message}`);
    }

    // ── settings 정리 ────────────────────────────────────────────────
    // api.settings.save(key, value)가 {key, value} 객체를 그대로 보내던 탓에
    // 설정이 제 이름이 아니라 'key' / 'value' 라는 칸에 저장되고 있었다.
    // (그래서 설정을 두 개 이상 쓰면 서로 덮어썼다.)
    // 저장 형식을 고쳤으므로, 남아 있는 값을 제 이름으로 옮기고 잘못된 칸을 지운다.
    try {
        const strayName = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'key'").first();
        const strayValue = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'value'").first();
        const realKey = (strayName as any)?.value;
        const realValue = (strayValue as any)?.value;

        if (realKey && realValue) {
            const existing = await c.env.DB.prepare('SELECT value FROM settings WHERE key = ?').bind(realKey).first();
            if (existing) {
                migrationResults.push(`settings: '${realKey}' already set, kept as is`);
            } else {
                await c.env.DB.prepare(
                    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))"
                ).bind(realKey, realValue).run();
                migrationResults.push(`settings: moved stray value into '${realKey}'`);
            }
        }
        if (realKey || realValue) {
            await c.env.DB.prepare("DELETE FROM settings WHERE key IN ('key', 'value')").run();
            migrationResults.push('settings: removed stray key/value rows');
        }
    } catch (e: any) {
        migrationResults.push(`Skipped settings cleanup: ${e.message}`);
    }

    // 예약금 입금 계좌는 코드 상수(src/constants/company.ts 의 DEPOSIT_ACCOUNT)로 안내한다.
    // settings 의 bank_account 는 쓰지 않는 옛 값이므로 남아 있으면 지운다.
    // (설정은 로그인 없이 읽을 수 있는 /api/settings 로 그대로 내려간다.)
    try {
        const removed = await c.env.DB.prepare("DELETE FROM settings WHERE key = 'bank_account'").run();
        if (removed?.meta?.changes) migrationResults.push('settings: removed unused bank_account');
    } catch (e: any) {
        migrationResults.push(`Skipped bank_account cleanup: ${e.message}`);
    }

    return c.json({
        success: true,
        message: "Migrations executed",
        details: migrationResults
    });
});

export default app;
