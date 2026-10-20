import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { parseSharedTravelSpots, publicSharedTravelSpot } from '../functions/lib/sharedTravelSpot.ts';

const bundled = await build({ entryPoints: ['functions/api/tourist-spots.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { default: app } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString('base64')}`);

function fixture(t) {
    const raw = new DatabaseSync(':memory:');
    t.after(() => raw.close());
    raw.exec(`CREATE TABLE kv(k TEXT PRIMARY KEY,v TEXT,updated_at TEXT);
        CREATE TABLE tourist_spots(id TEXT PRIMARY KEY,name_kr TEXT,name_local TEXT,address TEXT,description TEXT,images TEXT,region TEXT,is_active INTEGER);`);
    raw.prepare('INSERT INTO tourist_spots VALUES(?,?,?,?,?,?,?,?)')
        .run('legacy-spot', '옛 관광지', 'Old spot', '기존 주소', '이전 일정 소개', '["/legacy.webp"]', 'central', 1);
    const statements = [];
    let failed = false;
    const statement = (sql, values = []) => ({
        bind: (...args) => statement(sql, args),
        async first() {
            statements.push(sql);
            if (failed && sql.includes('FROM kv')) throw new Error('PRIVATE-DATABASE-FAILURE');
            return raw.prepare(sql).get(...values) ?? null;
        },
        async all() { statements.push(sql); return { results: raw.prepare(sql).all(...values) }; },
        async run() { statements.push(sql); return { meta: raw.prepare(sql).run(...values) }; },
    });
    const DB = { prepare: sql => statement(sql) };
    const request = path => app.request(path, {}, { DB, ENVIRONMENT: 'production' });
    const store = value => raw.prepare('INSERT INTO kv(k,v,updated_at) VALUES(?,?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v')
        .run('spots', JSON.stringify(value), '2026-10-20T00:00:00Z');
    return { raw, request, store, statements, fail: () => { failed = true; } };
}

test('여행지 목록은 견적 공통 명소만 읽고 기존 관광지 마스터를 섞거나 저장하지 않는다', async t => {
    const f = fixture(t);
    f.store({ '테를지 초원': { nameMn: 'Тэрэлж', region: '중앙몽골', short: '초원 여행', desc: '실제 여행지 소개', img: '/api/img/images/terelj.webp', subImgs: [] } });
    const before = f.raw.prepare('SELECT * FROM kv').all();
    const response = await f.request('/');
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), [{ id: 'quote-spot:테를지 초원', name_kr: '테를지 초원', name_local: 'Тэрэлж',
        address: '', description: '실제 여행지 소개', images: ['/api/img/images/terelj.webp'], region: '중앙몽골', is_active: true }]);
    assert.deepEqual(f.raw.prepare('SELECT * FROM kv').all(), before);
    assert.equal(f.raw.prepare('SELECT COUNT(*) AS n FROM tourist_spots').get().n, 1);
    assert.ok(f.statements.every(sql => /^SELECT v FROM kv WHERE k = \?$/.test(sql)), '목록 조회는 공통 명소 SELECT만 실행해야 한다');
});

test('사진·실제 주소·임의 지역은 허용 필드만 공개하고 연락처·메모·토큰은 제외한다', async t => {
    const f = fixture(t), name = '허르헉 / 체험?#한글', id = `quote-spot:${name}`;
    f.store({ [name]: { nameMn: 'Хорхог', region: '식도락 · 사용자 지정', address: '저장된 실제 주소', desc: '공개 여행지 소개',
        img: '/api/img/images/main.webp', subImgs: ['/api/img/images/main.webp', 'https://cdn.example.invalid/second.webp'],
        phone: 'PRIVATE-PHONE', email: 'PRIVATE-EMAIL', notes: 'PRIVATE-NOTES', memo: 'PRIVATE-MEMO', adminToken: 'PRIVATE-TOKEN',
        description: 'PRIVATE-UNUSED-DESCRIPTION', customer: { passport: 'PRIVATE-PASSPORT' } } });
    const response = await f.request(`/${encodeURIComponent(id)}?include=all&token=PRIVATE-QUERY`);
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const spot = await response.json();
    assert.deepEqual(spot, { id, name_kr: name, name_local: 'Хорхог', address: '저장된 실제 주소', description: '공개 여행지 소개',
        images: ['/api/img/images/main.webp', 'https://cdn.example.invalid/second.webp'], region: '식도락 · 사용자 지정', is_active: true });
    assert.ok(!JSON.stringify(spot).includes('PRIVATE-'));
    assert.equal(f.statements.length, 1, '슬래시가 포함된 별칭도 경로 한 개로 읽는다');
});

test('검색·공통 임의 지역·미분류 필터와 active=0 호환을 유지한다', async t => {
    const f = fixture(t);
    f.store({ '고비 화산': { nameMn: 'Gobi Volcano', region: '사용자 지역', desc: '별 관측', img: '', subImgs: [] },
        '테를지': { region: '중앙몽골', desc: '초원', img: '' }, '미분류 체험': { region: '', desc: '전통 체험' } });
    const names = async path => (await (await f.request(path)).json()).map(spot => spot.name_kr);
    assert.deepEqual(await names('/?q=gObI'), ['고비 화산']);
    assert.deepEqual(await names('/?q=' + encodeURIComponent('별 관측')), ['고비 화산']);
    assert.deepEqual(await names('/?region=' + encodeURIComponent('사용자 지역')), ['고비 화산']);
    assert.deepEqual(await names('/?region=uncat'), ['미분류 체험']);
    assert.deepEqual(await names('/?region=not-a-real-category'), []);
    assert.deepEqual(await names('/?region=' + encodeURIComponent('중앙몽골') + '&q=' + encodeURIComponent('화산')), []);
    assert.deepEqual(await names('/?active=0'), await names('/'));
});

test('비어 있는 실제 공통 목록과 명시적으로 비운 사진을 옛 마스터·사진·기본값으로 채우지 않는다', async t => {
    const f = fixture(t);
    assert.deepEqual(await (await f.request('/')).json(), [], 'KV 행이 없으면 등록된 명소가 없다');
    f.store({});
    assert.deepEqual(await (await f.request('/')).json(), []);
    f.store({ '사진 비운 여행지': { img: '', subImgs: [], images: ['/old.webp'], photo: '/sample.webp', region: '' } });
    const data = await (await f.request('/')).json();
    assert.deepEqual(data[0].images, []); assert.equal(data[0].address, ''); assert.equal(data[0].region, '');
});

test('등록된 여행지 사진에 실행 URL·인증정보 URL·고객 첨부가 섞여도 공개하지 않는다', () => {
    const unsafe = ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'blob:https://example.invalid/id', '//evil.example/a.webp',
        'https://user:secret@example.invalid/a.webp', 'file:///C:/private.webp', 'https://example.invalid/a b.webp', '/\\evil.example/a.webp',
        '/api/file/uploads/private.webp?token=PRIVATE', '/uploads/customer.webp'];
    const raster = 'data:image/png;base64,YQ==';
    const catalog = parseSharedTravelSpots(JSON.stringify({ 여행지: { img: '/main.webp', subImgs: ['/main.webp', 'img/extra.webp', raster, ...unsafe] } }));
    assert.deepEqual(publicSharedTravelSpot('quote-spot:여행지', catalog).images, ['/main.webp', 'img/extra.webp', raster]);
});

test('여행지 이름 변경·삭제 후 별칭을 다른 자료나 옛 관광지로 대신 연결하지 않는다', async t => {
    const f = fixture(t), oldId = 'quote-spot:원래 이름';
    f.store({ '원래 이름': { img: '/original.webp' } });
    assert.equal((await f.request(`/${encodeURIComponent(oldId)}`)).status, 200);
    f.raw.prepare('INSERT INTO tourist_spots(id,name_kr) VALUES(?,?)').run(oldId, '다른 옛 관광지');
    f.store({ '바꾼 이름': { img: '/changed.webp' } });
    assert.equal((await f.request(`/${encodeURIComponent(oldId)}`)).status, 404);
    assert.equal((await f.request(`/${encodeURIComponent('quote-spot:바꾼 이름')}`)).status, 200);
    f.store({});
    for (const id of ['quote-spot:바꾼 이름', 'quote-spot:toString', 'quote-spot:']) {
        const response = await f.request(`/${encodeURIComponent(id)}`);
        assert.equal(response.status, 404); assert.equal(response.headers.get('cache-control'), 'no-store');
    }
});

test('손상된 공통 명소나 DB 실패는 빈 성공으로 숨기지 않고 원본 내용 없는 503을 반환한다', async t => {
    const f = fixture(t), alias = `/${encodeURIComponent('quote-spot:여행지')}`;
    const assertUnavailable = async () => {
        for (const path of ['/', alias]) {
            const response = await f.request(path);
            assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
            const data = await response.json();
            assert.match(data.error, /여행지 자료/); assert.ok(!JSON.stringify(data).includes('PRIVATE-'));
        }
    };
    f.raw.prepare('INSERT INTO kv(k,v) VALUES(?,?)').run('spots', 'PRIVATE-CORRUPT-CATALOG');
    await assertUnavailable();
    for (const corrupt of [null, [], 42, 'PRIVATE-VALUE', { 여행지: null }, { 여행지: [] }, { 여행지: { img: {} } }, { 여행지: { subImgs: ['ok', null] } }]) {
        f.store(corrupt); await assertUnavailable();
    }
    f.store({ 여행지: {} });
    f.raw.prepare('UPDATE kv SET v=NULL WHERE k=?').run('spots'); await assertUnavailable();
    f.store({ 여행지: {} }); f.fail(); await assertUnavailable();
});

test('기존 상품 일정표의 관광지 ID 조회는 공통 명소 상태와 무관하게 원본을 읽는다', async t => {
    const f = fixture(t);
    f.store({ '새 공통 여행지': { img: '/new.webp' } }); f.fail();
    const response = await f.request('/legacy-spot');
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    const spot = await response.json();
    assert.equal(spot.id, 'legacy-spot'); assert.equal(spot.name_kr, '옛 관광지'); assert.equal(spot.name_local, 'Old spot');
    assert.equal(spot.description, '이전 일정 소개'); assert.deepEqual(spot.images, ['/legacy.webp']); assert.equal(spot.is_active, true);
    assert.equal((await f.request('/unknown-old-id')).status, 404);
    assert.ok(f.statements.every(sql => /^SELECT \* FROM tourist_spots WHERE id = \?$/.test(sql)));
});
