/**
 * 여행상품 사이트(상품·예약·배너·후기·매거진 등)가 쓰는 표와 칸의 정의 — 이 파일이 유일한 원본이다.
 *
 * 왜 있는가: 이 사이트의 표는 원래 수동 SQL(migration_sql/create_all_tables.sql)로 만들어졌고
 * `/api/migrate-db` 는 "이미 있는 표에 칸을 더하는" 일만 했다. 그래서 견적 플랫폼의 데이터베이스
 * (requests · kv 뿐)에 올리자 `no such table: banners` 같은 오류가 났다.
 * 이제는 여기 적힌 대로 없는 표는 만들고, 없는 칸은 더한다. 추가만 하며 지우거나 바꾸지 않는다.
 *
 * - 견적 쪽 표(requests, kv, itinerary_notice_dispatches)는 여기서 다루지 않는다. 건드리지 말 것.
 * - users / sessions 는 로그인 코드(functions/api/auth.ts 의 ensureAuthTables)가 만든다.
 * - 표·칸을 새로 쓰게 되면 여기에 적고 SITE_SCHEMA_VERSION 을 올린다. 다음 요청 때 자동으로 반영된다.
 */

type D1 = any;

interface TableDef {
    name: string;
    /** "칸이름 타입 …" — 첫 낱말이 칸 이름이다. */
    columns: string[];
    /** 표 수준 제약 (PRIMARY KEY (a, b) 등). 새로 만들 때만 적용된다. */
    constraints?: string[];
    indexes?: string[];
}

/** 표·칸 정의를 바꾸면 올린다. 올리면 각 서버 인스턴스가 한 번씩 다시 맞춘다. */
export const SITE_SCHEMA_VERSION = 4;

/** Shared definition also used by legacy quote write routes outside the Hono middleware. */
export const ADMIN_DELIVERY_TABLE: TableDef = {
    name: 'admin_delivery_attempts',
    columns: ['id TEXT PRIMARY KEY', 'source TEXT NOT NULL', 'booking_id TEXT NOT NULL', 'kind TEXT NOT NULL',
        'channel TEXT NOT NULL', 'state TEXT NOT NULL', 'dispatch_key TEXT NOT NULL', 'error TEXT', 'provider_id TEXT',
        'created_at TEXT NOT NULL', 'updated_at TEXT NOT NULL'],
    constraints: ['UNIQUE(source, booking_id, kind, dispatch_key)'],
    indexes: ['CREATE INDEX IF NOT EXISTS idx_admin_delivery_booking ON admin_delivery_attempts(source, booking_id, created_at)'],
};

const NOW = "DEFAULT (datetime('now'))";

export const SITE_TABLES: TableDef[] = [
    ADMIN_DELIVERY_TABLE,
    {
        name: 'products',
        columns: [
            'id TEXT PRIMARY KEY',
            'name TEXT NOT NULL',
            'description TEXT',
            'category TEXT',
            'duration TEXT',
            'price REAL DEFAULT 0',
            'original_price REAL DEFAULT 0',
            "main_images TEXT DEFAULT '[]'",
            "gallery_images TEXT DEFAULT '[]'",
            "detail_images TEXT DEFAULT '[]'",
            "itinerary_images TEXT DEFAULT '[]'",
            "images TEXT DEFAULT '[]'",
            'thumbnail TEXT',
            "status TEXT DEFAULT 'active'",
            'is_featured INTEGER DEFAULT 0',
            'is_popular INTEGER DEFAULT 0',
            'featured INTEGER DEFAULT 0',
            'popular INTEGER DEFAULT 0',
            "tags TEXT DEFAULT '[]'",
            "included TEXT DEFAULT '[]'",
            "excluded TEXT DEFAULT '[]'",
            "faqs TEXT DEFAULT '[]'",                    // 상품별 Q&A: [{q, a}]
            "detail_slides TEXT DEFAULT '[]'",
            "detail_blocks TEXT DEFAULT '[]'",
            "itinerary_blocks TEXT DEFAULT '[]'",
            "highlights TEXT DEFAULT '[]'",
            "representative_spots TEXT DEFAULT '[]'",      // 대표 명소 snapshot (판매 포인트와 분리)
            "pricing_options TEXT DEFAULT '[]'",
            "accommodation_options TEXT DEFAULT '[]'",
            "vehicle_options TEXT DEFAULT '[]'",
            'package_type TEXT',                          // 'full' | 'value' | NULL
            'sort_order INTEGER DEFAULT 0',
            'view_count INTEGER DEFAULT 0',
            'booking_count INTEGER DEFAULT 0',
            'reservation_count INTEGER DEFAULT 0',
            `created_at TEXT ${NOW}`,
            `updated_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'reservations',
        columns: [
            'id TEXT PRIMARY KEY',
            "type TEXT DEFAULT 'tour'",
            'reservation_number TEXT',
            'product_id TEXT',                            // 예약한 상품 ID (동명 상품 혼동 방지)
            'product_name TEXT',
            'customer_name TEXT',
            'customer_email TEXT',
            'customer_phone TEXT',
            'travelers INTEGER DEFAULT 1',
            'start_date TEXT',
            'end_date TEXT',
            'duration TEXT',
            "status TEXT DEFAULT 'pending'",
            'total_price REAL DEFAULT 0',
            'deposit_amount REAL DEFAULT 0',
            'balance_amount REAL DEFAULT 0',
            'payment_method TEXT',
            "deposit_status TEXT DEFAULT 'unpaid'",
            "balance_status TEXT DEFAULT 'unpaid'",
            'deposit_report TEXT',                        // JSON: 고객의 예약금 입금 신고
            'price_breakdown TEXT',                       // JSON: { total, deposit, local }
            "daily_accommodations TEXT DEFAULT '[]'",
            'assigned_guide TEXT',                        // JSON
            'are_assignments_visible_to_user INTEGER DEFAULT 0',
            'itinerary_template_id TEXT',
            'contract_data TEXT',                         // JSON: 여행자·항공편 등 계약 정보
            'document_content TEXT',                      // JSON: 고객별로 편집한 문서
            'contract_url TEXT',
            'itinerary_url TEXT',
            'source TEXT',                                // 주문 경로
            'notes TEXT',
            'admin_operations TEXT',                      // JSON: 관리자에게만 노출하는 예약 운영 정보
            "history TEXT DEFAULT '[]'",
            'user_id TEXT',
            `created_at TEXT ${NOW}`,
            `updated_at TEXT ${NOW}`,
        ],
        indexes: [
            'CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations (user_id)',
            'CREATE INDEX IF NOT EXISTS idx_reservations_created_at ON reservations (created_at)',
        ],
    },
    {
        // 옛 "사이트 안 견적 문의" 표. 지금 견적은 견적 플랫폼(requests)으로 접수되지만 /api/quotes 가 아직 읽는다.
        name: 'quotes',
        columns: [
            'id TEXT PRIMARY KEY',
            'user_id TEXT',
            'type TEXT',
            'name TEXT',
            'phone TEXT',
            'email TEXT',
            'destination TEXT',
            'headcount TEXT',
            'period TEXT',
            'budget TEXT',
            'travel_types TEXT',
            'accommodations TEXT',
            'vehicle TEXT',
            'additional_request TEXT',
            'attachment_url TEXT',
            "status TEXT DEFAULT 'pending'",
            'admin_note TEXT',
            'estimate_url TEXT',
            'confirmed_start_date TEXT',
            'confirmed_end_date TEXT',
            'confirmed_price INTEGER',
            'deposit INTEGER',
            "deposit_status TEXT DEFAULT 'unpaid'",
            "balance_status TEXT DEFAULT 'unpaid'",
            'itinerary_template_id TEXT',
            'document_content TEXT',
            `created_at TEXT ${NOW}`,
            `updated_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'banners',
        columns: [
            'id TEXT PRIMARY KEY',
            'image TEXT',
            'pc_image TEXT',                              // PC 전용 이미지(없으면 image)
            'tag TEXT',
            'title TEXT',
            'subtitle TEXT',
            'link TEXT',
            'pc_title TEXT',
            'pc_subtitle TEXT',
            'pc_tag TEXT',
            'sort_order INTEGER DEFAULT 0',
            `created_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'quick_links',
        columns: ['id TEXT PRIMARY KEY', 'icon TEXT', 'image TEXT', 'label TEXT', 'path TEXT', 'sort_order INTEGER DEFAULT 0'],
    },
    {
        name: 'event_banners',
        columns: [
            'id TEXT PRIMARY KEY',
            'image TEXT',
            "background_color TEXT DEFAULT '#0F766E'",
            'tag TEXT',
            'title TEXT',
            'icon TEXT',
            'link TEXT',
            "location TEXT DEFAULT 'all'",
            'sort_order INTEGER DEFAULT 0',
        ],
    },
    {
        name: 'category_tabs',
        columns: ['id TEXT PRIMARY KEY', 'name TEXT', 'title TEXT', 'subtitle TEXT', 'banner_image TEXT', 'sort_order INTEGER DEFAULT 0'],
    },
    {
        name: 'categories',
        columns: [
            'id TEXT PRIMARY KEY',
            'name TEXT NOT NULL',
            'description TEXT',
            'icon TEXT',
            'image TEXT',
            'sort_order INTEGER DEFAULT 0',
            'is_active INTEGER DEFAULT 1',
            "type TEXT DEFAULT 'product'",
            'landing_hero_image TEXT',
            'landing_hero_images TEXT',                   // JSON: 이미지 URL 배열
            'landing_hero_tagline TEXT',
            'landing_hero_title TEXT',
            'landing_hero_subtitle TEXT',
            'landing_accent_color TEXT',
            'landing_highlights TEXT',                    // JSON
            'landing_product_grid_title TEXT',
        ],
    },
    {
        name: 'settings',
        columns: ['key TEXT PRIMARY KEY', 'value TEXT', `updated_at TEXT ${NOW}`],
    },
    {
        name: 'faqs',
        columns: [
            'id TEXT PRIMARY KEY',
            'question TEXT NOT NULL',
            'answer TEXT NOT NULL',
            "category TEXT DEFAULT 'general'",
            'sort_order INTEGER DEFAULT 0',
            'is_active INTEGER DEFAULT 1',
            `created_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'faq_categories',
        columns: ['id TEXT PRIMARY KEY', 'name TEXT NOT NULL', 'sort_order INTEGER DEFAULT 0', 'is_active INTEGER DEFAULT 1', `created_at TEXT ${NOW}`],
    },
    {
        name: 'reviews',
        columns: [
            'id TEXT PRIMARY KEY',
            'user_id TEXT',
            'user_name TEXT',
            'user_avatar TEXT',
            'product_id TEXT',
            'product_name TEXT',
            'rating INTEGER DEFAULT 5',
            'title TEXT',
            'content TEXT',
            "images TEXT DEFAULT '[]'",
            "comments TEXT DEFAULT '[]'",
            'is_approved INTEGER DEFAULT 0',
            `created_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'review_helpful',
        columns: ['review_id TEXT NOT NULL', 'user_id TEXT NOT NULL', `created_at TEXT ${NOW}`],
        constraints: ['PRIMARY KEY (review_id, user_id)'],
        indexes: ['CREATE INDEX IF NOT EXISTS idx_review_helpful_review ON review_helpful (review_id)'],
    },
    {
        name: 'magazines',
        columns: [
            'id TEXT PRIMARY KEY',
            'title TEXT NOT NULL',
            'subtitle TEXT',
            'content TEXT',
            'thumbnail TEXT',
            'category TEXT',
            'author TEXT',
            'author_image TEXT',
            'is_published INTEGER DEFAULT 1',
            'view_count INTEGER DEFAULT 0',
            'location_name TEXT',
            'location_address TEXT',
            'location_phone TEXT',
            'location_website TEXT',
            'location_hours TEXT',                        // JSON
            'map_embed_url TEXT',
            'map_query TEXT',
            `created_at TEXT ${NOW}`,
            `updated_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'travel_guides',
        columns: [
            'id TEXT PRIMARY KEY',
            'title TEXT NOT NULL',
            'subtitle TEXT',
            'content TEXT',
            'thumbnail TEXT',
            'category TEXT',
            "tags TEXT DEFAULT '[]'",
            'view_count INTEGER DEFAULT 0',
            'is_published INTEGER DEFAULT 1',
            `created_at TEXT ${NOW}`,
            `updated_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'travel_mates',
        columns: [
            'id TEXT PRIMARY KEY',
            'user_id TEXT',
            'user_name TEXT',
            'user_avatar TEXT',
            'title TEXT NOT NULL',
            'content TEXT',
            'description TEXT',
            'destination TEXT',
            'region TEXT',
            'travel_date TEXT',
            'start_date TEXT',
            'end_date TEXT',
            'duration TEXT',
            'max_members INTEGER DEFAULT 4',
            'current_members INTEGER DEFAULT 1',
            'recruit_count INTEGER DEFAULT 1',
            "gender TEXT DEFAULT 'any'",
            "age_groups TEXT DEFAULT '[]'",
            "styles TEXT DEFAULT '[]'",
            "tags TEXT DEFAULT '[]'",
            "status TEXT DEFAULT 'open'",
            'image TEXT',
            'author_info TEXT',
            'author_name TEXT',
            'author_image TEXT',
            'view_count INTEGER DEFAULT 0',
            'comment_count INTEGER DEFAULT 0',
            `created_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'travel_mate_comments',
        columns: [
            'id TEXT PRIMARY KEY',
            'post_id TEXT NOT NULL',
            'user_id TEXT NOT NULL',
            "user_name TEXT DEFAULT ''",
            "user_image TEXT DEFAULT ''",
            'content TEXT NOT NULL',
            `created_at TEXT ${NOW}`,
        ],
        constraints: ['FOREIGN KEY (post_id) REFERENCES travel_mates(id) ON DELETE CASCADE'],
    },
    {
        name: 'travel_mate_requests',
        columns: ['id TEXT PRIMARY KEY', 'post_id TEXT NOT NULL', 'user_id TEXT NOT NULL', 'user_name TEXT', `created_at TEXT ${NOW}`],
        constraints: ['UNIQUE (post_id, user_id)'],
    },
    {
        name: 'chat_rooms',
        columns: [
            'id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))',
            'user1_id TEXT NOT NULL',
            'user2_id TEXT NOT NULL',
            "last_message TEXT DEFAULT ''",
            `last_message_at TEXT ${NOW}`,
            `created_at TEXT ${NOW}`,
            `updated_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'chat_messages',
        columns: [
            'id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16))))',
            'room_id TEXT NOT NULL',
            'sender_id TEXT NOT NULL',
            'content TEXT NOT NULL',
            'is_read INTEGER DEFAULT 0',
            `created_at TEXT ${NOW}`,
        ],
        constraints: ['FOREIGN KEY (room_id) REFERENCES chat_rooms(id)'],
    },
    {
        name: 'notifications',
        columns: [
            'id TEXT PRIMARY KEY',
            'user_id TEXT NOT NULL',
            'type TEXT NOT NULL',
            'title TEXT NOT NULL',
            'body TEXT',
            'link TEXT',
            'read INTEGER DEFAULT 0',
            `created_at TEXT ${NOW}`,
        ],
        indexes: ['CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, created_at)'],
    },
    {
        name: 'wishlist',
        columns: ['id TEXT PRIMARY KEY', 'user_id TEXT NOT NULL', 'product_id TEXT NOT NULL', `created_at TEXT ${NOW}`],
    },
    {
        name: 'recently_viewed',
        columns: ['id TEXT PRIMARY KEY', 'user_id TEXT NOT NULL', 'product_id TEXT NOT NULL', `viewed_at TEXT ${NOW}`],
    },
    {
        name: 'accommodations',
        columns: [
            'id TEXT PRIMARY KEY',
            'name TEXT NOT NULL',
            "description TEXT DEFAULT ''",
            "location TEXT DEFAULT ''",
            "type TEXT DEFAULT ''",
            'price_per_night INTEGER DEFAULT 0',
            "images TEXT DEFAULT '[]'",
            "thumbnail TEXT DEFAULT ''",
            "amenities TEXT DEFAULT '[]'",
            "facilities TEXT DEFAULT '[]'",
            'rating REAL DEFAULT 0',
            'is_active INTEGER DEFAULT 1',
            `created_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'hotels',
        columns: [
            'id TEXT PRIMARY KEY',
            "code TEXT DEFAULT ''",
            'name_kr TEXT NOT NULL',
            "name_local TEXT DEFAULT ''",
            "country TEXT DEFAULT ''",
            "city TEXT DEFAULT ''",
            "region TEXT DEFAULT ''",
            'star_rating INTEGER DEFAULT 0',
            "address TEXT DEFAULT ''",
            'latitude REAL',
            'longitude REAL',
            "description TEXT DEFAULT ''",
            "website TEXT DEFAULT ''",
            "images TEXT DEFAULT '[]'",
            "amenities TEXT DEFAULT '[]'",
            'is_active INTEGER DEFAULT 1',
            `created_at TEXT ${NOW}`,
            `updated_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'tourist_spots',
        columns: [
            'id TEXT PRIMARY KEY',
            'name_kr TEXT NOT NULL',
            "name_local TEXT DEFAULT ''",
            "address TEXT DEFAULT ''",
            "region TEXT DEFAULT ''",                     // 'central' | 'gobi' | 'hovsgol' | ''
            "description TEXT DEFAULT ''",
            "images TEXT DEFAULT '[]'",
            'is_active INTEGER DEFAULT 1',
            `created_at TEXT ${NOW}`,
            `updated_at TEXT ${NOW}`,
        ],
    },
    {
        // 가이드 정보 · 가이드 지원서(POST /api/tour-guides/apply)
        name: 'guides',
        columns: [
            'id TEXT PRIMARY KEY',
            'name TEXT NOT NULL',
            "bio TEXT DEFAULT ''",
            "phone TEXT DEFAULT ''",
            "languages TEXT DEFAULT '[]'",
            "specialties TEXT DEFAULT '[]'",
            "image TEXT DEFAULT ''",
            "status TEXT DEFAULT 'active'",
            'experience_years INTEGER DEFAULT 0',
            'is_active INTEGER DEFAULT 1',
            `created_at TEXT ${NOW}`,
        ],
    },
    {
        name: 'itinerary_templates',
        columns: ['id TEXT PRIMARY KEY', 'name TEXT NOT NULL', "description TEXT DEFAULT ''", "days TEXT DEFAULT '[]'", `created_at TEXT ${NOW}`],
    },
    {
        // 여행 기획전 — product_ids 는 보여 줄 순서대로 적은 상품 ID 의 JSON 배열
        name: 'promotions',
        columns: [
            'id TEXT PRIMARY KEY',
            'title TEXT NOT NULL',
            "subtitle TEXT DEFAULT ''",
            "group_name TEXT DEFAULT ''",
            "badge TEXT DEFAULT ''",
            "art_text TEXT DEFAULT ''",
            "theme TEXT DEFAULT 'mint'",
            "image TEXT DEFAULT ''",
            "product_ids TEXT DEFAULT '[]'",
            'is_active INTEGER DEFAULT 1',
            'sort_order INTEGER DEFAULT 0',
            `created_at TEXT ${NOW}`,
            `updated_at TEXT ${NOW}`,
        ],
    },
    {
        // 문의 — status: 'new' | 'answered' | 'closed'
        name: 'inquiries',
        columns: [
            'id TEXT PRIMARY KEY',
            'user_id TEXT',
            'name TEXT',
            'email TEXT',
            'kind TEXT',
            'reservation_number TEXT',
            'message TEXT NOT NULL',
            "status TEXT DEFAULT 'new'",
            'admin_note TEXT',
            `created_at TEXT ${NOW}`,
            'updated_at TEXT',
        ],
        indexes: ['CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries (created_at)'],
    },
];

const columnName = (def: string) => def.trim().split(/\s+/)[0];

/**
 * 이미 있는 표에 칸을 더할 때 쓰는 정의. SQLite 는 ALTER TABLE ADD COLUMN 에서
 * PRIMARY KEY · UNIQUE · 기본값 없는 NOT NULL · 계산식 기본값(datetime('now') 등)을 받지 않으므로 뺀다.
 */
const addableColumn = (def: string) => def
    .replace(/\s+PRIMARY KEY/i, '')
    .replace(/\s+UNIQUE/i, '')
    .replace(/\s+NOT NULL/i, '')
    .replace(/\s+DEFAULT\s+\((?:[^()]|\([^()]*\))*\)/i, '')
    .replace(/\s+DEFAULT\s+CURRENT_TIMESTAMP/i, '')
    .trim();

const createSql = (t: TableDef) =>
    `CREATE TABLE IF NOT EXISTS ${t.name} (\n    ${[...t.columns, ...(t.constraints || [])].join(',\n    ')}\n)`;

/**
 * 사이트 표를 정의에 맞춘다 — 없는 표는 만들고, 있는 표에는 없는 칸만 더한다.
 * 여러 번 실행해도 안전하고, 기존 행·칸은 건드리지 않는다. 한 일을 사람이 읽을 수 있는 줄로 돌려준다.
 */
export async function ensureSiteSchema(db: D1): Promise<string[]> {
    const log: string[] = [];

    const listed = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
    const existing = new Set<string>(((listed.results || []) as any[]).map((row) => String(row.name)));

    const missing = SITE_TABLES.filter((t) => !existing.has(t.name));
    if (missing.length > 0) {
        await db.batch(missing.map((t) => db.prepare(createSql(t))));
        log.push(`Created tables: ${missing.map((t) => t.name).join(', ')}`);
    }

    for (const t of SITE_TABLES) {
        if (!existing.has(t.name)) continue;

        let present: Set<string> | null = null;
        try {
            const info = await db.prepare(`PRAGMA table_info(${t.name})`).all();
            present = new Set(((info.results || []) as any[]).map((row) => String(row.name)));
        } catch {
            present = null; // 칸 목록을 못 읽으면 전부 시도하고, 이미 있다는 오류는 넘긴다
        }

        for (const def of t.columns) {
            const col = columnName(def);
            if (present && present.has(col)) continue;
            try {
                await db.prepare(`ALTER TABLE ${t.name} ADD COLUMN ${addableColumn(def)}`).run();
                log.push(`Added ${t.name}.${col}`);
            } catch (e: any) {
                const message = String(e?.message || e);
                if (!/duplicate column/i.test(message)) log.push(`Skipped ${t.name}.${col}: ${message}`);
            }
        }
    }

    const indexes = SITE_TABLES.flatMap((t) => t.indexes || []);
    try {
        await db.batch(indexes.map((sql) => db.prepare(sql)));
    } catch (e: any) {
        log.push(`Skipped indexes: ${String(e?.message || e)}`);
    }

    return log;
}

let ready: Promise<void> | null = null;

/**
 * 요청을 처리하기 전에 사이트 표가 준비됐는지 확인한다. 서버 인스턴스마다 처음 한 번만 조회 한 번을 쓰고,
 * 버전이 맞으면 아무것도 하지 않는다. 처음 배포한 데이터베이스이거나 정의가 바뀌었으면 그때 맞춘다.
 * 실패해도 요청을 막지 않는다(다음 요청 때 다시 시도).
 */
export function siteSchemaReady(db: D1): Promise<void> {
    if (!ready) {
        ready = (async () => {
            try {
                const row = await db.prepare("SELECT v FROM schema_meta WHERE k = 'site'").first();
                if (row && Number((row as any).v) >= SITE_SCHEMA_VERSION) return;
            } catch {
                // schema_meta 가 아직 없다 = 처음
            }
            await ensureSiteSchema(db);
            await db.prepare('CREATE TABLE IF NOT EXISTS schema_meta (k TEXT PRIMARY KEY, v TEXT)').run();
            await db.prepare("INSERT OR REPLACE INTO schema_meta (k, v) VALUES ('site', ?)").bind(String(SITE_SCHEMA_VERSION)).run();
        })().catch((e) => {
            ready = null;
            console.error('site schema setup failed:', e);
        });
    }
    return ready;
}
