import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';

const bundle = await build({ entryPoints: ['functions/api/categories.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const app = (await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`)).default;
app.onError((error, c) => c.json({ error: error.cause?.message || error.message }, 500));
async function fixture(t) {
    const raw = new DatabaseSync(':memory:'); t.after(() => raw.close());
    const statement = (sql, args = []) => ({ bind: (...values) => statement(sql, values),
        async run() { return { meta: raw.prepare(sql).run(...args) }; },
        async all() { return { results: raw.prepare(sql).all(...args) }; },
        async first() { return raw.prepare(sql).get(...args) ?? null; },
        async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
        exec() { return /^\s*(select|pragma)/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args) }; } });
    const DB = { prepare: sql => statement(sql), async batch(entries) {
        raw.exec('BEGIN'); try { const result = entries.map(entry => entry.exec()); raw.exec('COMMIT'); return result; }
        catch (reason) { raw.exec('ROLLBACK'); throw reason; }
    } }; await ensureSiteSchema(DB);
    raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
        CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);`);
    for (const [id, role] of [['admin', 'admin'], ['member', 'user']]) {
        raw.prepare('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)').run(id, `${id}@example.invalid`, '로컬 테스트', role);
        raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run(`category-${id}`, id, Date.now() + 86400000);
    }
    raw.prepare(`INSERT INTO categories(id,name,description,icon,image,sort_order,is_active,type,landing_hero_image,landing_hero_images,landing_hero_title,landing_highlights)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run('central', '중앙몽골', '기존 설명', 'landscape', '/img/icon.webp', 2, 1, 'product', '/img/hero.webp',
            JSON.stringify(['/img/hero.webp', '/img/second.webp']), '기존 히어로 제목', JSON.stringify([{ label: '첫 지역', title: '초원', cards: [{ image: '/img/card.webp', title: '거북바위', tags: ['자연'] }] }]));
    raw.prepare('INSERT INTO categories(id,name,sort_order,is_active,type) VALUES(?,?,?,?,?)').run('gobi', '고비사막', 5, 1, 'product');
    raw.prepare('INSERT INTO categories(id,name,sort_order,is_active,type) VALUES(?,?,?,?,?)').run('magazine', '여행 정보', 9, 1, 'magazine');
    const read = id => ({ ...raw.prepare('SELECT * FROM categories WHERE id=?').get(id) });
    const request = (path, { body, method = 'PUT', role = 'admin', rawBody } = {}) => app.request(path, { method, headers: {
        ...(role ? { cookie: `auth_session=category-${role}` } : {}), 'Content-Type': 'application/json',
    }, body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)) }, { DB });
    return { raw, read, request };
}

test('노출만 변경하면 기존 이름·순서·아이콘·히어로 사진과 하이라이트가 모두 보존된다', async t => {
    const { request, read } = await fixture(t), original = read('central');
    assert.equal((await request('/central', { body: { is_active: false } })).status, 200);
    assert.deepEqual(read('central'), { ...original, is_active: 0 });
    assert.equal((await request('/central', { body: { is_active: 1 } })).status, 200);
    assert.deepEqual(read('central'), original);
});

test('sort_order와 기존 order 별칭은 한 필드만 바꾸며 0도 그대로 저장한다', async t => {
    const { request, read } = await fixture(t), original = read('central');
    for (const body of [{ sort_order: 0 }, { order: 7 }, { sort_order: 3, order: 3 }]) {
        assert.equal((await request('/central', { body })).status, 200);
        assert.deepEqual(read('central'), { ...original, sort_order: body.sort_order ?? body.order });
    }
});

test('명시적으로 빈 사진·하이라이트를 저장하고 나머지 값은 보존한다', async t => {
    const { request, read } = await fixture(t), original = read('central');
    const response = await request('/central', { body: { landing_hero_images: [], landing_hero_image: null, landing_highlights: '[]' } });
    assert.equal(response.status, 200);
    assert.deepEqual(read('central'), { ...original, landing_hero_images: '[]', landing_hero_image: null, landing_highlights: '[]' });
});

test('잘못된 변경은 400으로 거절하고 기존 전체 행을 보존한다', async t => {
    const { request, read } = await fixture(t), original = read('central');
    for (const body of [null, [], {}, { name: '' }, { name: 4 }, { order: -1 }, { order: 1.5 }, { sort_order: 1, order: 2 },
        { is_active: 'false' }, { is_active: 2 }, { landing_hero_images: [null] }, { landing_hero_images: '{}' },
        { landing_highlights: [{ cards: [null] }] }, { landing_highlights: 'broken' }, { unexpected: true }, { constructor: 'unsafe' }]) {
        assert.equal((await request('/central', { body })).status, 400, JSON.stringify(body));
        assert.deepEqual(read('central'), original);
    }
    assert.equal((await request('/central', { rawBody: '{' })).status, 400);
});

test('없는 카테고리는 404이며 비관리자 변경은 거절한다', async t => {
    const { request, read } = await fixture(t), original = read('central');
    assert.equal((await request('/missing', { body: { is_active: false } })).status, 404);
    assert.equal((await request('/central', { body: { is_active: false }, role: null })).status, 401);
    assert.equal((await request('/central', { body: { is_active: false }, role: 'member' })).status, 403);
    assert.deepEqual(read('central'), original);
});

test('순서는 같은 종류 전체 항목을 한 번에 저장하고 다른 종류·랜딩 정보를 유지한다', async t => {
    const { request, read } = await fixture(t), original = read('central'), other = read('magazine');
    const result = await request('/reorder', { body: { type: 'product', items: [{ id: 'gobi', sort_order: 0 }, { id: 'central', sort_order: 1 }] } });
    assert.equal(result.status, 200);
    assert.deepEqual(read('central'), { ...original, sort_order: 1 });
    assert.equal(read('gobi').sort_order, 0); assert.deepEqual(read('magazine'), other);
});

test('중복·누락·다른 종류 순서를 거절하여 일부만 갱신되지 않는다', async t => {
    const { request, read } = await fixture(t), before = [read('central'), read('gobi')];
    for (const [items, status] of [
        [[{ id: 'central', sort_order: 0 }, { id: 'central', sort_order: 1 }], 400],
        [[{ id: 'central', sort_order: 0 }], 409],
        [[{ id: 'central', sort_order: 0 }, { id: 'magazine', sort_order: 1 }], 409],
        [[{ id: 'central', sort_order: 0 }, { id: 'gobi', sort_order: 0 }], 400],
        [[{ id: 'central', sort_order: -1 }, { id: 'gobi', sort_order: 0 }], 400],
    ]) {
        assert.equal((await request('/reorder', { body: { type: 'product', items } })).status, status);
        assert.deepEqual([read('central'), read('gobi')], before);
    }
});

test('두 번째 순서 저장이 실패하면 D1 batch 전체가 롤백된다', async t => {
    const { request, raw, read } = await fixture(t), before = [read('central'), read('gobi')];
    raw.exec("CREATE TRIGGER reject_gobi BEFORE UPDATE OF sort_order ON categories WHEN NEW.id='gobi' BEGIN SELECT RAISE(ABORT,'local failure'); END");
    const response = await request('/reorder', { body: { type: 'product', items: [{ id: 'central', sort_order: 1 }, { id: 'gobi', sort_order: 0 }] } });
    assert.equal(response.status, 500); assert.deepEqual([read('central'), read('gobi')], before);
});

test('신규 생성의 order 별칭·활성값과 저장된 사진이 재조회에도 유지된다', async t => {
    const { request, read } = await fixture(t);
    const body = { id: 'western', name: '서부몽골', order: 8, is_active: false, icon: 'landscape',
        landing_hero_images: ['/img/west.webp'], landing_highlights: [] };
    assert.equal((await request('/', { body, method: 'POST' })).status, 200);
    assert.equal(read('western').sort_order, 8); assert.equal(read('western').is_active, 0);
    assert.equal(read('western').landing_hero_images, JSON.stringify(body.landing_hero_images));
    assert.equal((await request('/', { body, method: 'POST' })).status, 409);
});
