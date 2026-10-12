-- =============================================
-- Milkyway Japan - Complete D1 Schema
-- =============================================

-- Users & Sessions (already created)
-- CREATE TABLE IF NOT EXISTS users (...)
-- CREATE TABLE IF NOT EXISTS sessions (...)

-- Products
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    price REAL DEFAULT 0,
    images TEXT DEFAULT '[]',
    thumbnail TEXT,
    status TEXT DEFAULT 'active',
    featured INTEGER DEFAULT 0,
    popular INTEGER DEFAULT 0,
    tags TEXT DEFAULT '[]',
    faqs TEXT DEFAULT '[]',                    -- per-product Q&A: [{q, a}]
    sort_order INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    reservation_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Reservations
CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'tour',
    product_name TEXT,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    travelers INTEGER DEFAULT 1,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'pending',
    total_price REAL DEFAULT 0,
    deposit_amount REAL DEFAULT 0,
    balance_amount REAL DEFAULT 0,
    payment_method TEXT,
    daily_accommodations TEXT DEFAULT '[]',
    notes TEXT,
    history TEXT DEFAULT '[]',
    user_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    travel_type TEXT,
    destination TEXT,
    travelers INTEGER DEFAULT 1,
    start_date TEXT,
    end_date TEXT,
    budget TEXT,
    message TEXT,
    status TEXT DEFAULT 'pending',
    admin_notes TEXT,
    confirmed_price REAL DEFAULT 0,
    confirmed_deposit REAL DEFAULT 0,
    confirmed_balance REAL DEFAULT 0,
    user_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Banners
CREATE TABLE IF NOT EXISTS banners (
    id TEXT PRIMARY KEY,
    image TEXT,
    pc_image TEXT,
    tag TEXT,
    title TEXT,
    subtitle TEXT,
    link TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Quick Links
CREATE TABLE IF NOT EXISTS quick_links (
    id TEXT PRIMARY KEY,
    icon TEXT,
    image TEXT,
    label TEXT,
    path TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Event Banners
CREATE TABLE IF NOT EXISTS event_banners (
    id TEXT PRIMARY KEY,
    image TEXT,
    background_color TEXT DEFAULT '#0F766E',
    tag TEXT,
    title TEXT,
    icon TEXT,
    link TEXT,
    location TEXT DEFAULT 'all',
    sort_order INTEGER DEFAULT 0
);

-- Category Tabs
CREATE TABLE IF NOT EXISTS category_tabs (
    id TEXT PRIMARY KEY,
    name TEXT,
    title TEXT,
    subtitle TEXT,
    banner_image TEXT,
    sort_order INTEGER DEFAULT 0
);

-- FAQs
CREATE TABLE IF NOT EXISTS faqs (
    id TEXT PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- FAQ categories for the /faq page. FAQ rows reference a category by name (faqs.category).
CREATE TABLE IF NOT EXISTS faq_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    user_avatar TEXT,
    product_id TEXT,
    product_name TEXT,
    rating INTEGER DEFAULT 5,
    title TEXT,
    content TEXT,
    images TEXT DEFAULT '[]',
    comments TEXT DEFAULT '[]',
    is_approved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS review_helpful (
    review_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_review_helpful_review
    ON review_helpful(review_id);

-- Travel Guides
CREATE TABLE IF NOT EXISTS travel_guides (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    content TEXT,
    thumbnail TEXT,
    category TEXT,
    tags TEXT DEFAULT '[]',
    view_count INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Travel Mates
CREATE TABLE IF NOT EXISTS travel_mates (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    user_avatar TEXT,
    title TEXT NOT NULL,
    content TEXT,
    destination TEXT,
    travel_date TEXT,
    max_members INTEGER DEFAULT 4,
    current_members INTEGER DEFAULT 1,
    status TEXT DEFAULT 'open',
    tags TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (datetime('now')),
    image TEXT,
    start_date TEXT,
    end_date TEXT,
    duration TEXT,
    recruit_count INTEGER DEFAULT 1,
    gender TEXT DEFAULT 'any',
    age_groups TEXT DEFAULT '[]',
    region TEXT,
    styles TEXT DEFAULT '[]',
    author_info TEXT,
    view_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    author_name TEXT,
    author_image TEXT,
    description TEXT
);

-- Magazines
CREATE TABLE IF NOT EXISTS magazines (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subtitle TEXT,
    content TEXT,
    thumbnail TEXT,
    category TEXT,
    author TEXT,
    is_published INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    location_name TEXT,
    location_address TEXT,
    location_phone TEXT,
    location_website TEXT,
    location_hours TEXT,
    map_embed_url TEXT,
    map_query TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Accommodations
CREATE TABLE IF NOT EXISTS accommodations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    location TEXT,
    price_per_night REAL DEFAULT 0,
    images TEXT DEFAULT '[]',
    thumbnail TEXT,
    amenities TEXT DEFAULT '[]',
    rating REAL DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Categories (Product Categories)
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    image TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
);

-- Settings (Key-Value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    type TEXT,
    title TEXT,
    message TEXT,
    is_read INTEGER DEFAULT 0,
    link TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Chat Rooms
CREATE TABLE IF NOT EXISTS chat_rooms (
    id TEXT PRIMARY KEY,
    user1_id TEXT,
    user2_id TEXT,
    last_message TEXT,
    last_message_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    room_id TEXT REFERENCES chat_rooms(id),
    sender_id TEXT,
    content TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Hotels — reusable master library for the itinerary editor's
-- accommodation field. dayInfo.accommodation stores either a free-form
-- string (legacy) or a hotel id (new) so the picker can resolve back
-- to the master record.
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
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Tourist spots — reusable master library for timeline blocks in product
-- itineraries. Picking from the picker modal pushes name_kr → title,
-- description → description, images → images onto the timeline block.
CREATE TABLE IF NOT EXISTS tourist_spots (
    id TEXT PRIMARY KEY NOT NULL,
    name_kr TEXT NOT NULL,
    name_local TEXT DEFAULT '',
    address TEXT DEFAULT '',
    description TEXT DEFAULT '',
    images TEXT DEFAULT '[]',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Promotions (旅行企画展) — admin-curated campaign cards on /promotions.
-- product_ids is a JSON string array of product ids in display order.
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
);

-- Join requests on travel-mate posts (参加リクエスト). One row per member and post;
-- a request never changes the post's member count — the host decides.
CREATE TABLE IF NOT EXISTS travel_mate_requests (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(post_id, user_id)
);

-- Inquiries (お問い合わせ) — /contact form intake, read at /admin/inquiries.
-- status: 'new' | 'answered' | 'closed'. user_id is set only for signed-in senders.
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
);
CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON inquiries (created_at);
