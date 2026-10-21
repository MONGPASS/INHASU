import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { publicResourceLodgeHotel } from '../functions/lib/resourceLodgeHotel.ts';

async function bundle(path) {
    const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false });
    return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
}
const [route, client] = await Promise.all([bundle('functions/api/hotels.ts'), bundle('src/lib/api.ts')]);
const app = route.default;

async function fixture(t) {
    const raw = new DatabaseSync(':memory:');
    t.after(() => raw.close());
    let failCatalog = false;
    const statement = (sql, args = []) => ({
        bind: (...values) => statement(sql, values),
        async first() { if (failCatalog && sql.includes('FROM kv')) throw Error('PRIVATE-CATALOG-READ-FAILURE'); return raw.prepare(sql).get(...args) ?? null; },
        async all() { return { results: raw.prepare(sql).all(...args) }; },
        async run() { return { meta: raw.prepare(sql).run(...args) }; },
        async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
        exec() { return /^\s*(SELECT|PRAGMA)/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args) }; },
    });
    const DB = { prepare: sql => statement(sql), batch: async rows => rows.map(row => row.exec()) };
    await ensureSiteSchema(DB);
    raw.exec(`CREATE TABLE kv(k TEXT PRIMARY KEY,v TEXT,updated_at TEXT);
        CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
        CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);`);
    raw.prepare('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)').run('admin', 'admin@example.invalid', '로컬 관리자', 'admin');
    raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run('test-admin-session', 'admin', Date.now() + 86400000);
    raw.prepare('INSERT INTO hotels(id,name_kr,name_local,address,description,images,amenities,is_active) VALUES(?,?,?,?,?,?,?,?)')
        .run('old-hotel', '기존 호텔', 'Old hotel', '기존 주소', '기존 공개 소개', '["/old-hotel.webp"]', '["와이파이"]', 1);
    const request = (path, { admin = false, method = 'GET', body } = {}) => app.request(path, {
        method, headers: { ...(admin ? { cookie: 'auth_session=test-admin-session' } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
    }, { DB, ENVIRONMENT: 'production' });
    const saveCatalog = catalog => raw.prepare('INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run('lodges', JSON.stringify(catalog));
    return { raw, request, saveCatalog, failCatalog: () => { failCatalog = true; } };
}

test('공개 resource-lodge 별칭은 허용 필드만 반환하고 보관 소개·연락처·운영 정보는 노출하지 않는다', async t => {
    const f = await fixture(t), name = '테를지 / 캠프?#한글', id = `resource-lodge:${name}`;
    const catalog = { [name]: { region: '테를지', address: '실제 숙소 주소', grade: '고급 게르',
        representativePhotos: ['/api/img/images/lodge.webp', 'https://cdn.example.invalid/selected.webp'], img: '/old.webp',
        facilities: ['와이파이'], roomAmenities: '수건\n온수', sharedFacilities: '온수, 공용 라운지',
        desc: 'PRIVATE-LEGACY-DESCRIPTION', description: 'PRIVATE-DESCRIPTION', phone: 'PRIVATE-PHONE', email: 'PRIVATE-EMAIL',
        operatingNotes: 'PRIVATE-OPERATIONS', officialSources: 'PRIVATE-SOURCES', memo: 'PRIVATE-MEMO',
        bookingStatus: 'PRIVATE-SUPPLIER-STATUS', rooms: { private: 'PRIVATE-ROOMS' }, token: 'PRIVATE-TOKEN' } };
    f.saveCatalog(catalog);
    const before = f.raw.prepare('SELECT v FROM kv WHERE k=?').get('lodges').v;
    const response = await f.request(`/${encodeURIComponent(id)}?token=PRIVATE-QUERY-TOKEN&include=all`);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const data = await response.json();
    assert.deepEqual(data, { id, name_kr: name, name_local: '', region: '테를지', address: '실제 숙소 주소', description: '',
        images: ['/api/img/images/lodge.webp', 'https://cdn.example.invalid/selected.webp'], amenities: ['와이파이', '수건', '온수', '공용 라운지'],
        grade: '고급 게르', type: '고급 게르', occupancy: '', roomAmenities: ['수건', '온수'], sharedFacilities: ['온수', '공용 라운지'], is_active: true });
    assert.ok(!JSON.stringify(data).includes('PRIVATE-'));
    assert.equal(f.raw.prepare('SELECT v FROM kv WHERE k=?').get('lodges').v, before);
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS count FROM hotels').get().count, 1, '별칭 조회가 호텔 마스터를 만들면 안 된다');
});

test('선택 사진 []를 정본으로 유지하고 URL 검증과 옛 사진 fallback을 일관되게 적용한다', () => {
    const id = 'resource-lodge:캠프';
    assert.deepEqual(publicResourceLodgeHotel(id, { 캠프: { representativePhotos: [], img: '/old.webp', imgs: ['/old-2.webp'] } }).images, []);
    const unsafe = ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'blob:https://example.invalid/id', '//evil.example/x.webp',
        'https://user:secret@example.invalid/a.webp', 'https://example.invalid/a b.webp', '/\\evil.example/a.webp', 'file:///C:/private.webp',
        '/api/file/uploads/private.webp?token=PRIVATE', '/uploads/private.webp', 'https://example.invalid/api/file/private.webp'];
    assert.deepEqual(publicResourceLodgeHotel(id, { 캠프: { representativePhotos: unsafe, img: '/old.webp' } }).images, []);
    const raster = 'data:image/png;base64,YQ==';
    const fallback = publicResourceLodgeHotel(id, { 캠프: { img: '/legacy.webp', imgs: ['/legacy.webp', 'img/second.webp', '../img/third.webp', 'https://cdn.example.invalid/a.webp', raster, ...unsafe] } });
    assert.deepEqual(fallback.images, ['/legacy.webp', 'img/second.webp', '../img/third.webp', 'https://cdn.example.invalid/a.webp', raster]);
    assert.equal(fallback.address, '', '지역을 실제 주소로 대체하면 안 된다');
});

test('숙소 이름 변경·삭제 후 이전 별칭은 다른 숙소나 호텔 테이블로 자동 연결하지 않는다', async t => {
    const f = await fixture(t), oldId = 'resource-lodge:원래 숙소', newId = 'resource-lodge:새 숙소';
    f.saveCatalog({ '원래 숙소': { representativePhotos: ['/original.webp'] } });
    assert.equal((await f.request(`/${encodeURIComponent(oldId)}`)).status, 200);
    f.raw.prepare('INSERT INTO hotels(id,name_kr) VALUES(?,?)').run(oldId, '다른 호텔');
    f.saveCatalog({ '새 숙소': { representativePhotos: ['/renamed.webp'] } });
    assert.equal((await f.request(`/${encodeURIComponent(oldId)}`)).status, 404);
    assert.equal((await (await f.request(`/${encodeURIComponent(newId)}`)).json()).name_kr, '새 숙소');
    f.saveCatalog({});
    assert.equal((await f.request(`/${encodeURIComponent(newId)}`)).status, 404);
    assert.equal((await f.request(`/${encodeURIComponent('resource-lodge:toString')}`)).status, 404);
    assert.equal((await f.request(`/${encodeURIComponent('resource-lodge:')}`)).status, 404);
    assert.equal((await f.request('/old-hotel')).status, 200);
});

test('파손된 숙소 자료나 조회 실패는 원본 데이터·서버 오류 내용을 공개하지 않는다', async t => {
    const f = await fixture(t), path = `/${encodeURIComponent('resource-lodge:캠프')}`;
    assert.equal((await f.request(path)).status, 404);
    f.raw.prepare('INSERT INTO kv(k,v) VALUES(?,?)').run('lodges', 'PRIVATE-CORRUPT-CATALOG');
    let response = await f.request(path);
    assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('PRIVATE-'));
    for (const malformed of [[], null, 'PRIVATE-CATALOG', 42]) {
        f.saveCatalog(malformed); response = await f.request(path);
        assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('PRIVATE-'));
    }
    f.saveCatalog({ 캠프: {} }); f.failCatalog(); response = await f.request(path);
    assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('PRIVATE-'));
});

test('이전 호텔 ID 조회·목록·관리자 CRUD와 권한을 그대로 유지한다', async t => {
    const f = await fixture(t);
    f.saveCatalog({ '공통 숙소': { img: '/shared.webp' } });
    const old = await (await f.request('/old-hotel')).json();
    assert.equal(old.id, 'old-hotel'); assert.equal(old.name_local, 'Old hotel'); assert.equal(old.description, '기존 공개 소개');
    assert.deepEqual(old.images, ['/old-hotel.webp']); assert.deepEqual(old.amenities, ['와이파이']); assert.equal(old.is_active, true);
    const list = await (await f.request('/')).json(); assert.deepEqual(list.map(row => row.id), ['old-hotel']);
    assert.equal((await f.request('/', { method: 'POST', body: { name_kr: '무권한 호텔' } })).status, 401);
    const created = await f.request('/', { admin: true, method: 'POST', body: { id: 'legacy-created', name_kr: '관리 호텔', images: ['/create.webp'], amenities: ['난방'] } });
    assert.equal(created.status, 200); assert.deepEqual(await created.json(), { id: 'legacy-created' });
    assert.equal((await f.request('/legacy-created', { admin: true, method: 'PUT', body: { name_kr: '수정 호텔', images: ['/updated.webp'], is_active: false } })).status, 200);
    const updated = await (await f.request('/legacy-created')).json();
    assert.equal(updated.name_kr, '수정 호텔'); assert.equal(updated.is_active, false); assert.deepEqual(updated.images, ['/updated.webp']);
    assert.equal((await (await f.request('/')).json()).length, 1);
    assert.equal((await (await f.request('/?active=0')).json()).length, 2);
    assert.equal((await f.request('/legacy-created', { admin: true, method: 'DELETE' })).status, 200);
    assert.equal((await f.request('/legacy-created')).status, 404);
});

test('공통 숙소 선택 목록은 실제 리소스만 읽고 빈 사진·임의 지역·시설과 정확한 출처 ID를 보존한다', async t => {
    const f = await fixture(t);
    const names = async path => (await (await f.request(path)).json()).map(hotel => hotel.name_kr);
    assert.deepEqual(await names('/?source=resources'), []);
    f.saveCatalog({ '고비 / 캠프?#': { region: '사용자 지정 지역', address: '실제 주소', grade: '고급 게르', occupancy: '2인실',
        representativePhotos: [], img: '/old.webp', roomAmenities: '수건, 온수', sharedFacilities: ['식당'], phone: 'PRIVATE-PHONE', desc: 'PRIVATE-ARCHIVE' },
        '테를지 숙소': { region: '중앙몽골', img: '/terelj.webp' }, '분류 없는 숙소': { region: '' } });
    const before = f.raw.prepare('SELECT v FROM kv WHERE k=?').get('lodges').v;
    const response = await f.request('/?source=resources&q=' + encodeURIComponent('수건'));
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json();
    assert.equal(result.length, 1); assert.equal(result[0].id, 'resource-lodge:고비 / 캠프?#');
    assert.equal(result[0].grade, '고급 게르'); assert.equal(result[0].occupancy, '2인실');
    assert.deepEqual(result[0].images, []); assert.deepEqual(result[0].roomAmenities, ['수건', '온수']);
    assert.deepEqual(result[0].sharedFacilities, ['식당']); assert.ok(!JSON.stringify(result).includes('PRIVATE-'));
    assert.deepEqual(await names('/?source=resources&region=' + encodeURIComponent('사용자 지정 지역')), ['고비 / 캠프?#']);
    assert.deepEqual(await names('/?source=resources&region=uncat'), ['분류 없는 숙소']);
    assert.deepEqual(await names('/?source=resources&region=absent'), []);
    assert.deepEqual(await names('/?source=resources&active=0'), await names('/?source=resources'));
    assert.deepEqual(await names('/'), ['기존 호텔']);
    assert.equal(f.raw.prepare('SELECT v FROM kv WHERE k=?').get('lodges').v, before);
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS count FROM hotels').get().count, 1);
});

test('손상된 공통 숙소 선택 목록은 빈 성공이나 legacy 목록으로 대체하지 않는다', async t => {
    const f = await fixture(t), alias = '/' + encodeURIComponent('resource-lodge:숙소');
    for (const invalid of [null, [], 1, { 숙소: null }, { 숙소: [] }, { 숙소: { img: {} } }, { 숙소: { representativePhotos: ['ok', null] } }]) {
        f.saveCatalog(invalid);
        for (const path of ['/?source=resources', alias]) {
            const response = await f.request(path);
            assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
            assert.match((await response.json()).error, /숙소 자료/);
        }
    }
    f.saveCatalog({}); assert.deepEqual(await (await f.request('/?source=resources')).json(), []);
    f.failCatalog();
    const response = await f.request('/?source=resources');
    assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('PRIVATE-'));
    assert.equal((await f.request('/old-hotel')).status, 200);
});

test('클라이언트 호텔 조회는 슬래시·쿼리·해시·한글이 있는 전체 리소스 ID를 경로 하나로 인코딩한다', async t => {
    const original = globalThis.fetch, calls = [];
    globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ ok: true }); };
    t.after(() => { globalThis.fetch = original; });
    const id = 'resource-lodge:고비 / 캠프?token=PRIVATE#사진';
    await client.api.hotels.get(id);
    assert.equal(calls.length, 1); assert.equal(calls[0].url, `/api/hotels/${encodeURIComponent(id)}`);
    const url = new URL(calls[0].url, 'https://example.invalid');
    assert.equal(url.search, ''); assert.equal(url.hash, ''); assert.equal(url.pathname.split('/').length, 4);
    assert.equal(calls[0].options.credentials, 'include');
    await client.api.hotels.get('old-hotel');
    assert.equal(calls[1].url, '/api/hotels/old-hotel');
});
