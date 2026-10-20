// 사이트 표 정의(functions/lib/siteSchema.ts)가 코드가 쓰는 SQL 과 맞는지 확인한다.
// 운영 DB 는 견적 표(requests · kv)만 있는 상태에서 출발했다 — 그 상태에서 표를 준비한 뒤
// functions 의 모든 SQL 을 컴파일해 "없는 표 · 없는 칸"이 하나도 없어야 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Node 가 타입 표기를 걷어 내고 .ts 를 바로 읽는다(22.18+). 그래서 siteSchema.ts 는 npm 패키지를 import 하지 않는다.
let loads = 0;
const loadSiteSchema = () => import(pathToFileURL(path.join(root, 'functions/lib/siteSchema.ts')).href + '?' + (loads += 1));

// node:sqlite 위의 최소 D1 흉내 (prepare/bind/first/all/run/batch)
function makeD1() {
    const raw = new DatabaseSync(':memory:', { enableDoubleQuotedStringLiterals: true });
    const stmt = (sql, args = []) => ({
        bind: (...a) => stmt(sql, a),
        exec() {
            const st = raw.prepare(sql);
            return /^\s*(select|pragma)\b/i.test(sql) ? { results: st.all(...args) } : (st.run(...args), { results: [] });
        },
        async all() { return this.exec(); },
        async run() { return this.exec(); },
        async first() { return this.exec().results[0] ?? null; },
    });
    return { raw, prepare: (sql) => stmt(sql), batch: async (list) => list.map((s) => s.exec()) };
}

const columnsOf = (raw, table) => raw.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);

function quoteOnlyDatabase() {
    const db = makeD1();
    db.raw.exec(fs.readFileSync(path.join(root, 'schema.sql'), 'utf8'));
    // 로그인 코드가 만드는 표 (functions/api/auth.ts 의 ensureAuthTables)
    db.raw.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, google_id TEXT UNIQUE, email TEXT UNIQUE, name TEXT, role TEXT DEFAULT 'user', avatar_url TEXT, password_hash TEXT);
        CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    `);
    return db;
}

function siteSqlStatements() {
    const found = [];
    const literal = /\.prepare\(\s*(`(?:[^`\\]|\\[\s\S])*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*")/g;
    (function walk(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) { walk(file); continue; }
            if (!entry.name.endsWith('.ts')) continue; // 견적 쪽(.js · .mjs)은 자기 표를 스스로 관리한다
            const source = fs.readFileSync(file, 'utf8');
            for (const m of source.matchAll(literal)) {
                if (m[1].startsWith('`') && m[1].includes('${')) continue; // 조립하는 SQL 은 여기서 볼 수 없다
                const sql = new Function('return ' + m[1])();
                if (/^\s*(ALTER|CREATE|DROP|PRAGMA)\b/i.test(sql)) continue;
                const line = source.slice(0, m.index).split('\n').length;
                found.push({ where: `${path.relative(root, file).replace(/\\/g, '/')}:${line}`, sql });
            }
        }
    })(path.join(root, 'functions'));
    return found;
}

test('견적 표만 있는 DB 에서 사이트 표를 모두 만든다', async () => {
    const { ensureSiteSchema, SITE_TABLES } = await loadSiteSchema();
    const db = quoteOnlyDatabase();
    await ensureSiteSchema(db);

    const tables = new Set(db.raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((r) => r.name));
    for (const t of SITE_TABLES) assert.ok(tables.has(t.name), `${t.name} 표가 없다`);
    for (const name of ['banners', 'products', 'reservations', 'categories', 'settings']) assert.ok(tables.has(name));

    // 견적 표는 그대로다
    assert.deepEqual(columnsOf(db.raw, 'kv'), ['k', 'v', 'updated_at']);
    assert.equal(columnsOf(db.raw, 'requests').length, 10);
});

test('코드에 적힌 SQL 이 전부 준비된 표 · 칸과 맞는다', async () => {
    const { ensureSiteSchema } = await loadSiteSchema();
    const db = quoteOnlyDatabase();
    await ensureSiteSchema(db);
    db.raw.exec('CREATE TABLE schema_meta (k TEXT PRIMARY KEY, v TEXT)'); // siteSchemaReady 가 만드는 버전 표

    const statements = siteSqlStatements();
    assert.ok(statements.length > 150, `SQL 을 충분히 찾지 못했다 (${statements.length})`);
    const broken = [];
    for (const { where, sql } of statements) {
        try { db.raw.prepare(sql); } catch (e) { broken.push(`${where}  ${e.message}`); }
    }
    assert.deepEqual(broken, []);
});

test('옛 구조의 표가 있으면 빠진 칸만 더하고 기존 행은 그대로 둔다', async () => {
    const { ensureSiteSchema } = await loadSiteSchema();
    const db = quoteOnlyDatabase();
    db.raw.exec(`
        CREATE TABLE banners (id TEXT PRIMARY KEY, image TEXT, title TEXT);
        INSERT INTO banners (id, image, title) VALUES ('b1', '/a.webp', '기존 배너');
        CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, title TEXT, message TEXT, is_read INTEGER DEFAULT 0, link TEXT);
    `);

    const log = await ensureSiteSchema(db);
    assert.ok(log.some((line) => line === 'Added banners.pc_image'));
    assert.ok(columnsOf(db.raw, 'banners').includes('pc_title'));
    assert.ok(columnsOf(db.raw, 'notifications').includes('body'));
    assert.deepEqual({ ...db.raw.prepare('SELECT id, title FROM banners').get() }, { id: 'b1', title: '기존 배너' });

    // 다시 실행해도 할 일이 없다
    assert.deepEqual(await ensureSiteSchema(db), []);
});

test('siteSchemaReady 는 버전이 맞으면 다시 만들지 않는다', async () => {
    const { siteSchemaReady, SITE_SCHEMA_VERSION } = await loadSiteSchema();
    const db = quoteOnlyDatabase();
    await siteSchemaReady(db);
    assert.equal(db.raw.prepare("SELECT v FROM schema_meta WHERE k = 'site'").get().v, String(SITE_SCHEMA_VERSION));
    assert.ok(columnsOf(db.raw, 'products').includes('package_type'));
    assert.ok(columnsOf(db.raw, 'products').includes('representative_spots'));
});

test('v2 상품 표는 대표 명소 칸을 자동 추가하고 기존 판매 포인트와 고객 문서를 보존한다', async () => {
    const { siteSchemaReady, ensureSiteSchema, SITE_SCHEMA_VERSION } = await loadSiteSchema();
    const db = quoteOnlyDatabase();
    db.raw.exec(`CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, highlights TEXT);
        INSERT INTO products VALUES ('old-product', '기존 상품', '[{"icon":"star","title":"기존 판매 포인트","description":"보존"}]');
        CREATE TABLE reservations (id TEXT PRIMARY KEY, document_content TEXT);
        INSERT INTO reservations VALUES ('old-booking', '{"highlights":[],"days":[]}');
        CREATE TABLE schema_meta (k TEXT PRIMARY KEY, v TEXT);
        INSERT INTO schema_meta VALUES ('site', '2');`);
    const productBefore = db.raw.prepare('SELECT id,name,highlights FROM products').get();
    const documentBefore = db.raw.prepare('SELECT document_content FROM reservations').get().document_content;
    await siteSchemaReady(db);
    assert.equal(SITE_SCHEMA_VERSION, 5);
    assert.equal(db.raw.prepare("SELECT v FROM schema_meta WHERE k = 'site'").get().v, String(SITE_SCHEMA_VERSION));
    assert.ok(columnsOf(db.raw, 'admin_delivery_attempts').includes('provider_id'));
    assert.deepEqual(db.raw.prepare('SELECT id,name,highlights FROM products').get(), productBefore);
    assert.equal(db.raw.prepare('SELECT representative_spots FROM products').get().representative_spots, '[]');
    assert.equal(db.raw.prepare('SELECT document_content FROM reservations').get().document_content, documentBefore);
    assert.deepEqual(await ensureSiteSchema(db), []);
});
