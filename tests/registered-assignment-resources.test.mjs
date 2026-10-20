import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: [fileURLToPath(new URL('../src/utils/registeredAssignmentResources.ts', import.meta.url))], bundle: true, format: 'cjs', platform: 'node', write: false,
    plugins: [{ name: 'registered-resources-connection', setup(builder) {
        builder.onResolve({ filter: /\/components\/admin\/quoteDesk$/ }, () => ({ path: 'connection', namespace: 'registered-resources-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'registered-resources-test' }, () => ({ loader: 'js', contents: 'export const connectQuoteDesk = () => { throw new Error("Inject a local admin connection"); };' }));
    } }],
});
function setupExports() {
    const module = { exports: {} };
    vm.runInNewContext(bundled.outputFiles[0].text, { module, exports: module.exports, URL });
    return module.exports;
}
const setup = () => setupExports().loadRegisteredAssignmentResources;
const plain = value => JSON.parse(JSON.stringify(value));
const options = (accountId = 'local-admin') => ({ accountId, isCurrent: () => true });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const pending = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const libs = {
    guides: { '등록 가이드': { img: '/api/img/guide.webp', phone: 'PRIVATE-GUIDE-PHONE', qr: '/api/img/guide-qr.webp', nameEn: 'Saved Name', role: '전문 가이드', desc: '저장된 소개', languages: '["한국어","몽골어"]', specialties: ['고비', '테를지'], passportNo: 'PRIVATE-PASSPORT', memo: 'PRIVATE-MEMO', arbitrary: 'NOT-REQUESTED' } },
    lodges: { '등록 숙소': { grade: '고급게르', region: '테를지', address: '저장된 숙소 주소', occupancy: '2인실', img: '/old-cover.webp', imgs: ['/photo-pool.webp'], representativePhotos: ['/selected-a.webp', '/selected-b.webp'], roomAmenities: '온수\n수건', sharedFacilities: '식당, 휴게실', desc: 'PRIVATE-ARCHIVED-LODGE-DESCRIPTION', operatingNotes: 'PRIVATE-LODGE-NOTE', phone: 'PRIVATE-LODGE-PHONE' } },
    vehicles: { '등록 하이이스': { img: '/car-cover.webp', imgs: ['/car-cover.webp', '/car-interior.webp'], desc: '저장된 차량 설명', seats: '6인', luggage: '캐리어 4개', plate: 'SAVED-PLATE', phone: 'PRIVATE-DRIVER-PHONE', memo: 'PRIVATE-VEHICLE-MEMO', contract: { secret: 'NOT-REQUESTED' } } },
};

test('실제 저장 리소스만 인증 헤더로 읽고 전화·QR·사진·설명·좌석을 선택용 자료로 보존한다', async () => {
    const load = setup(), calls = [], controller = new AbortController();
    const input = { ...options(), signal: controller.signal };
    const resources = await load(input, { connect: async config => { assert.equal(config, input); return 'local-only-token'; }, fetch: async (path, init) => {
        calls.push({ path, init }); return json({ ok: true, data: libs[path.split('/').at(-1)] });
    } });
    assert.equal(calls.length, 3);
    for (const { path, init } of calls) { assert.match(path, /^\/api\/data\/(guides|lodges|vehicles)$/); assert.equal(init.headers['x-admin-token'], 'local-only-token'); assert.equal(init.cache, 'no-store'); assert.equal(init.credentials, 'same-origin'); assert.equal(init.signal, controller.signal); }
    const result = plain(resources), guide = result.guides[0], lodge = result.lodges[0], vehicle = result.vehicles[0];
    assert.equal(guide.id, 'resource-guide:등록 가이드'); assert.equal(guide.phone, 'PRIVATE-GUIDE-PHONE'); assert.equal(guide.qr, '/api/img/guide-qr.webp');
    assert.equal(guide.image, '/api/img/guide.webp'); assert.equal(guide.introduction, '저장된 소개'); assert.deepEqual(guide.languages, ['한국어', '몽골어']); assert.deepEqual(guide.specialties, ['고비', '테를지']);
    assert.equal(guide.nameEn, 'Saved Name'); assert.equal(guide.role, '전문 가이드'); assert.equal(guide._fromResources, true);
    assert.equal(lodge.id, 'resource-lodge:등록 숙소'); assert.equal(lodge.location, '테를지'); assert.equal(lodge.type, '고급게르');
    assert.equal(lodge.address, '저장된 숙소 주소'); assert.equal(lodge.occupancy, '2인실'); assert.equal(lodge.description, '');
    assert.deepEqual(lodge.images, ['/selected-a.webp', '/selected-b.webp']); assert.deepEqual(lodge.facilities, ['온수', '수건', '식당', '휴게실']);
    assert.equal(vehicle.name, '등록 하이이스'); assert.equal(vehicle.type, '등록 하이이스'); assert.equal(vehicle.phone, 'PRIVATE-DRIVER-PHONE');
    assert.deepEqual(vehicle.snapshot, { model: '등록 하이이스', type: '등록 하이이스', img: '/car-cover.webp', images: ['/car-cover.webp', '/car-interior.webp'], imgs: ['/car-cover.webp', '/car-interior.webp'], description: '저장된 차량 설명', desc: '저장된 차량 설명', seats: '6인', luggage: '캐리어 4개', plate: 'SAVED-PLATE' });
    const serialized = JSON.stringify(result);
    for (const privateValue of ['PRIVATE-PASSPORT', 'PRIVATE-MEMO', 'NOT-REQUESTED', 'PRIVATE-ARCHIVED-LODGE-DESCRIPTION', 'PRIVATE-LODGE-NOTE', 'PRIVATE-LODGE-PHONE', 'PRIVATE-VEHICLE-MEMO', 'local-only-token']) assert.ok(!serialized.includes(privateValue));
    assert.deepEqual(result.warnings, []); assert.equal(libs.lodges['등록 숙소'].imgs.length, 1);
});

test('공통 숙소 선택은 숙소 라이브러리만 읽고 안전 필드만 기존 호텔 스냅샷 모양으로 변환한다', async () => {
    const { loadRegisteredAssignmentResources: load, registeredLodgeAsHotel } = setupExports(), calls = [];
    const result = await load({ ...options(), kinds: ['lodges'] }, { connect: async () => 'local', fetch: async path => {
        calls.push(path); return json({ ok: true, data: libs.lodges });
    } });
    assert.deepEqual(calls, ['/api/data/lodges']);
    const lodge = result.lodges[0], hotel = plain(registeredLodgeAsHotel({ ...lodge, description: 'PRIVATE-ARCHIVED-LODGE-DESCRIPTION', phone: 'PRIVATE-PHONE', operatingNotes: 'PRIVATE-NOTE' }));
    assert.deepEqual(hotel, { id: 'resource-lodge:등록 숙소', name_kr: '등록 숙소', address: '저장된 숙소 주소', region: '테를지', grade: '고급게르', type: '고급게르', occupancy: '2인실', images: ['/selected-a.webp', '/selected-b.webp'], description: '', amenities: ['온수', '수건', '식당', '휴게실'], roomAmenities: ['온수', '수건'], sharedFacilities: ['식당', '휴게실'], is_active: true });
    assert.equal(JSON.stringify(hotel).includes('PRIVATE'), false);
    hotel.images.push('/changed.webp'); hotel.amenities.push('변경');
    assert.deepEqual(plain(lodge.images), ['/selected-a.webp', '/selected-b.webp']); assert.equal(lodge.facilities.includes('변경'), false);
    const failure = plain(await load({ ...options(), kinds: ['lodges'] }, { connect: async () => 'local', fetch: async path => { assert.equal(path, '/api/data/lodges'); return json({ ok: false }, 503); } }));
    assert.deepEqual(failure.lodges, []); assert.equal(failure.warnings.length, 1); assert.match(failure.warnings[0], /숙소/);
});

test('미등록 라이브러리는 빈 목록이며 샘플·타 라이브러리·보관 사진·임의 필드를 추정하지 않는다', async () => {
    const load = setup();
    const data = { guides: { '빈 가이드': {}, '잘못된 행': null }, lodges: { '사진 제외 숙소': { representativePhotos: [], imgs: ['/private-pool.webp'] } }, vehicles: null };
    const result = plain(await load(options(), { connect: async () => 'local', fetch: async path => json({ ok: true, data: data[path.split('/').at(-1)] }) }));
    assert.equal(result.guides.length, 1); assert.equal(result.guides[0].phone, ''); assert.equal(result.guides[0].image, ''); assert.deepEqual(result.guides[0].languages, []);
    assert.deepEqual(result.lodges[0].images, []); assert.deepEqual(result.lodges[0].facilities, []); assert.deepEqual(result.vehicles, []); assert.deepEqual(result.warnings, []);
});

test('일부 라이브러리 조회 실패·잘못된 응답은 해당 경고만 표시하고 성공한 등록 자료를 유지한다', async () => {
    const load = setup();
    const result = plain(await load(options(), { connect: async () => 'local', fetch: async path => path.endsWith('guides') ? json({ ok: true, data: libs.guides }) : path.endsWith('lodges') ? json({ ok: true, data: [] }) : json({ ok: false, error: 'LOCAL-FAILURE' }, 503) }));
    assert.equal(result.guides.length, 1); assert.deepEqual(result.lodges, []); assert.deepEqual(result.vehicles, []); assert.equal(result.warnings.length, 2);
    assert.match(result.warnings[0], /숙소/); assert.match(result.warnings[1], /차량/); assert.ok(!JSON.stringify(result.warnings).includes('LOCAL-FAILURE'));
});

test('연결 실패·설정 미완료 때 공개 리소스나 이전 관리자 토큰으로 대체 조회하지 않는다', async () => {
    const load = setup(); let calls = 0;
    const fetch = async () => { calls++; return json({ ok: true, data: libs.guides }); };
    for (const connect of [async () => null, async () => { throw new Error('PRIVATE-CONNECTION-DETAIL'); }]) {
        const result = plain(await load(options(), { connect, fetch }));
        assert.deepEqual(result.guides, []); assert.equal(result.warnings.length, 1); assert.ok(!JSON.stringify(result).includes('PRIVATE-CONNECTION-DETAIL'));
    }
    assert.equal(calls, 0);
});

test('중단되거나 교체된 관리자 연결의 늦은 응답은 선택 자료로 반환하지 않는다', async () => {
    const load = setup(), connection = pending(), controller = new AbortController(); let requests = 0;
    const beforeConnect = load({ ...options(), signal: controller.signal }, { connect: () => connection.promise, fetch: async () => { requests++; return json({ ok: true, data: libs.guides }); } });
    controller.abort(); connection.resolve('late-token'); await assert.rejects(beforeConnect, error => error.name === 'AbortError'); assert.equal(requests, 0);
    const response = pending(); let current = true;
    const beforeResponse = load({ ...options(), isCurrent: () => current }, { connect: async () => 'local', fetch: () => response.promise });
    await new Promise(resolve => setImmediate(resolve)); current = false; response.resolve(json({ ok: true, data: libs.guides }));
    await assert.rejects(beforeResponse, error => error.name === 'AbortError');
    const old = pending();
    const oldAccount = load(options('admin-a'), { connect: async () => 'old-local', fetch: () => old.promise });
    await new Promise(resolve => setImmediate(resolve));
    const fresh = await load(options('admin-b'), { connect: async () => 'fresh-local', fetch: async () => json({ ok: true, data: null }) });
    assert.deepEqual(plain(fresh.warnings), []); old.resolve(json({ ok: true, data: libs.guides }));
    await assert.rejects(oldAccount, error => error.name === 'AbortError');
});

test('등록 사진·QR의 실행 URL은 제외하고 유효한 실제 업로드와 내부 이미지만 유지한다', async () => {
    const load = setup();
    const result = plain(await load(options(), { connect: async () => 'local', fetch: async path => json({ ok: true, data: path.endsWith('guides') ? { '가이드': { img: 'javascript:alert(1)', qr: 'https://user:pass@example.com/qr.png' } } : path.endsWith('lodges') ? { '숙소': { imgs: ['//evil.test/x', 'data:text/html,evil', 'https://example.com/a.webp', '/api/img/safe.webp', 'img/local.png', 'data:image/webp;base64,aGVsbG8='] } } : null }) }));
    assert.equal(result.guides[0].image, ''); assert.equal(result.guides[0].qr, '');
    assert.deepEqual(result.lodges[0].images, ['https://example.com/a.webp', '/api/img/safe.webp', 'img/local.png', 'data:image/webp;base64,aGVsbG8=']);
});
