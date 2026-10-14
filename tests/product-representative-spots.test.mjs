// Actual catalog API, admin session and local SQLite only; no production data or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { adminProductFromApi, writeAdminProductDraft, readAdminProductDraft, productDraftFingerprint, finishAdminProductSave } from '../src/utils/adminProductDraft.ts';

const bundle = await build({ entryPoints: [fileURLToPath(new URL('../functions/api/products.ts', import.meta.url))],
    bundle: true, platform: 'node', format: 'esm', write: false });
const app = (await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`)).default;

async function fixture(t) {
    const raw = new DatabaseSync(':memory:');
    t.after(() => raw.close());
    const statement = (sql, args = []) => ({
        bind: (...values) => statement(sql, values),
        async first() { return raw.prepare(sql).get(...args) ?? null; },
        async all() { return { results: raw.prepare(sql).all(...args) }; },
        async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
        async run() { return { meta: raw.prepare(sql).run(...args) }; },
        exec() { return /^\s*(select|pragma)\b/i.test(sql)
            ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args), results: [] }; },
    });
    const DB = { prepare: sql => statement(sql), batch: async statements => statements.map(s => s.exec()) };
    await ensureSiteSchema(DB);
    raw.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, google_id TEXT, email TEXT, name TEXT, role TEXT, avatar_url TEXT, password_hash TEXT);
        CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT, expires_at INTEGER);`);
    raw.prepare('INSERT INTO users (id,email,name,role) VALUES (?,?,?,?)').run('admin', 'admin@example.invalid', '로컬 관리자', 'admin');
    raw.prepare('INSERT INTO sessions VALUES (?,?,?)').run('spot-test-admin-session', 'admin', Date.now() + 86400000);
    const request = (path, { method = 'GET', body, admin = false } = {}) => app.request(path, {
        method, headers: { ...(admin ? { cookie: 'auth_session=spot-test-admin-session' } : {}),
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }, { DB, ENVIRONMENT: 'production' });
    return { raw, request };
}

const spots = [
    { name: '거북바위', nameMn: 'Мэлхий хад', short: '초원의 상징', region: '중앙', desc: '등록 시점 설명\n두 번째 줄',
        img: '/img/turtle.webp', subImgs: ['/img/turtle-one.webp', '/img/turtle-two.webp', '/img/turtle-three.webp'] },
    { name: '고비 모래언덕', region: '고비', desc: '일몰 감상', img: '/img/gobi.webp', subImgs: [] },
];
const sellingPoints = [{ icon: 'star', title: '한국어 가이드', description: '기존 판매 포인트' }];

test('편집 중 삭제된 상품은 저장 성공을 반환하지 않고 복원할 초안을 보존한다', async t => {
    const { raw, request } = await fixture(t);
    await request('/', { method: 'POST', admin: true, body: { id: 'removed-product', name: '편집 중 상품', price: 1000, duration: '1일', category: '중앙몽골' } });
    const form = adminProductFromApi((await (await request('/')).json()).find(p => p.id === 'removed-product'));
    const storageValues = new Map();
    const storage = { getItem: key => storageValues.get(key) ?? null, setItem: (key, value) => storageValues.set(key, value), removeItem: key => storageValues.delete(key) };
    const scope = { userId: 'admin', productId: form.id };
    writeAdminProductDraft(storage, scope, form, { ...form, name: '삭제 전 작성 내용' });
    raw.exec("DELETE FROM products WHERE id='removed-product'");
    const response = await request('/removed-product', { method: 'PUT', admin: true, body: { name: '삭제 전 작성 내용', price: 1000 } });
    assert.equal(response.status, 404);
    finishAdminProductSave(storage, scope, response.ok);
    assert.equal(readAdminProductDraft(storage, scope, form).draft.form.name, '삭제 전 작성 내용');
    assert.equal((await request('/removed-product', { method: 'PUT', admin: true, body: { packageType: 'budget' } })).status, 404);
});

test('실제 상품 API→관리자 화면 mapper→초안 저장·복원은 ID 없는 레거시 일정과 0/false/null 값을 지원한다', async t => {
    const { raw, request } = await fixture(t);
    const legacyBlocks = [
        { type: 'dayInfo', content: { title: '초원 도착', meals: { lunch: '현지식' }, heroImage: '/img/hero.webp' } },
        { type: 'timeline', content: { time: '09:30', title: '공항 픽업', images: ['/img/pickup.webp'] } },
        { type: 'image', content: '/img/camp.webp' },
        { type: 'slide', content: { title: '캠프', description: '사진과 설명 보존', images: ['/img/night.webp'] } },
        { type: 'divider', content: { style: 'space', height: 20 } },
        { type: 'design', content: { templateId: 'legacy-template', values: { photo: '/img/template.webp' }, sections: [{ id: 'overview', def: 'overview', hidden: false }] } },
    ];
    assert.equal((await request('/', { method: 'POST', admin: true, body: { id: 'draft-legacy', name: '초안 회귀 상품',
        duration: '2박 3일', price: 1100000, status: 'active', category: '중앙몽골', mainImages: ['/img/main.webp'],
        itineraryBlocks: legacyBlocks, representativeSpots: spots, highlights: sellingPoints, isFeatured: false, isPopular: false } })).status, 200);
    // Existing SQL rows can have nullable optional metadata even though new writes have defaults.
    raw.exec("UPDATE products SET description=NULL,original_price=NULL,created_at=NULL,updated_at=NULL,is_featured=0,is_popular=0 WHERE id='draft-legacy'");
    const listed = await (await request('/')).json();
    const response = listed.find(product => product.id === 'draft-legacy');
    assert.ok(response);
    const form = adminProductFromApi(response);
    assert.equal(form.isFeatured, false);
    assert.equal(form.isPopular, false);
    assert.equal(form.price, 1100000);
    assert.equal(form.description, '');
    assert.equal(form.originalPrice, undefined);
    assert.equal(form.viewCount, 0);
    assert.equal(form.updatedAt, '');
    assert.deepEqual(form.itineraryBlocks, legacyBlocks);
    const values = new Map();
    const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const scope = { userId: 'admin', productId: form.id };
    const edited = { ...form, name: '다시 진입해 복원할 이름' };
    assert.equal(writeAdminProductDraft(storage, scope, form, edited).ok, true);
    const restored = readAdminProductDraft(storage, scope, form);
    assert.equal(restored.kind, 'draft', restored.kind === 'error' ? restored.error : undefined);
    assert.equal(restored.conflict, false);
    assert.equal(productDraftFingerprint(restored.draft.form), productDraftFingerprint(edited));
    assert.deepEqual(restored.draft.form.itineraryBlocks, legacyBlocks);
    assert.deepEqual(restored.draft.form.representativeSpots, spots);
    assert.deepEqual(restored.draft.form.highlights, sellingPoints);
});

test('상품 등록·목록·상세는 대표 명소와 기존 판매 포인트를 각각 저장한다', async t => {
    const { raw, request } = await fixture(t);
    const created = await request('/', { method: 'POST', admin: true,
        body: { id: 'new-tour', name: '실제 상품', representativeSpots: spots, highlights: sellingPoints } });
    assert.equal(created.status, 200);
    const persisted = raw.prepare('SELECT highlights,representative_spots FROM products WHERE id=?').get('new-tour');
    assert.deepEqual(JSON.parse(persisted.highlights), sellingPoints);
    assert.deepEqual(JSON.parse(persisted.representative_spots), spots);
    for (const path of ['/', '/new-tour']) {
        const response = await request(path);
        assert.equal(response.status, 200);
        const result = await response.json();
        const product = Array.isArray(result) ? result.find(row => row.id === 'new-tour') : result;
        assert.deepEqual(product.representativeSpots, spots);
        assert.deepEqual(JSON.parse(product.representative_spots), spots);
        assert.deepEqual(product.highlights, sellingPoints);
    }
});

test('snake_case JSON과 camelCase 별칭이 겹치면 명시적인 snake_case 선택을 사용한다', async t => {
    const { request } = await fixture(t);
    assert.equal((await request('/', { method: 'POST', admin: true, body: { id: 'snake-tour', name: '별칭 상품',
        representativeSpots: [{ name: '잘못된 별칭' }], representative_spots: JSON.stringify(spots) } })).status, 200);
    assert.deepEqual((await (await request('/snake-tour')).json()).representativeSpots, spots);
    assert.equal((await request('/snake-tour', { method: 'PUT', admin: true, body: {
        representativeSpots: spots, representative_spots: '[]' } })).status, 200);
    assert.deepEqual((await (await request('/snake-tour')).json()).representativeSpots, []);
});

test('대표 명소 순서·설명·사진 수정과 빈 선택은 저장되고 다른 상품 수정은 기존 선택을 유지한다', async t => {
    const { request } = await fixture(t);
    await request('/', { method: 'POST', admin: true, body: { id: 'edit-tour', name: '편집 상품', representativeSpots: spots, highlights: sellingPoints } });
    assert.equal((await request('/edit-tour', { method: 'PUT', admin: true, body: { name: '이름만 수정' } })).status, 200);
    assert.deepEqual((await (await request('/edit-tour')).json()).representativeSpots, spots);
    const revised = [spots[1], { ...spots[0], desc: '새 상품 설명', img: '/img/new-turtle.webp' }];
    assert.equal((await request('/edit-tour', { method: 'PUT', admin: true, body: { representative_spots: JSON.stringify(revised) } })).status, 200);
    const reread = await (await request('/edit-tour')).json();
    assert.deepEqual(reread.representativeSpots, revised);
    assert.deepEqual(reread.highlights, sellingPoints);
    assert.equal((await request('/edit-tour', { method: 'PUT', admin: true, body: { representativeSpots: [] } })).status, 200);
    assert.deepEqual((await (await request('/edit-tour')).json()).representativeSpots, []);
});

test('대표 명소 입력은 올바른 snapshot만 보존하고 위험한 사진 URL과 손상된 JSON을 읽지 않는다', async t => {
    const { raw, request } = await fixture(t);
    const input = [{ ...spots[0], img: 'javascript:alert(1)', subImgs: [...spots[0].subImgs, '//unsafe.example/image'] },
        null, { title: '판매 포인트' }, { name: '  ' }, 'invalid'];
    assert.equal((await request('/', { method: 'POST', admin: true, body: { id: 'safe-tour', name: '검증 상품', representativeSpots: input } })).status, 200);
    assert.deepEqual((await (await request('/safe-tour')).json()).representativeSpots, [{ ...spots[0], img: '' }]);
    raw.prepare('UPDATE products SET representative_spots = ? WHERE id = ?').run('{corrupt', 'safe-tour');
    assert.deepEqual((await (await request('/safe-tour')).json()).representativeSpots, []);
});

test('인증하지 않은 상품 대표 명소 변경은 저장되지 않는다', async t => {
    const { raw, request } = await fixture(t);
    await request('/', { method: 'POST', admin: true, body: { id: 'protected-tour', name: '보호 상품', representativeSpots: spots } });
    assert.equal((await request('/protected-tour', { method: 'PUT', body: { representativeSpots: [] } })).status, 401);
    assert.equal((await request('/', { method: 'POST', body: { id: 'unauthorized', name: '미승인', representativeSpots: spots } })).status, 401);
    assert.deepEqual(JSON.parse(raw.prepare('SELECT representative_spots FROM products WHERE id=?').get('protected-tour').representative_spots), spots);
    assert.equal(raw.prepare('SELECT id FROM products WHERE id=?').get('unauthorized'), undefined);
});
