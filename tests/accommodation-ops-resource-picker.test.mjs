import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Exercise the real page event handlers and draft serializer. Only browser,
// authentication and network boundaries are mocked; selection helpers stay real.
const built = await build({
    entryPoints: [fileURLToPath(new URL('../src/pages/AdminAccommodationOps.tsx', import.meta.url))],
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
    plugins: [{ name: 'accommodation-page-events', setup(builder) {
        builder.onResolve({ filter: /^react$|^react\/jsx-runtime$|^react-router-dom$/ }, args => ({ path: args.path, namespace: 'ops-events' }));
        for (const [filter, path] of [
            [/\/contexts\/UserContext$/, 'user'], [/\/admin\/AdminLayout$/, 'layout'],
            [/\/admin\/console\/Icon$/, 'icon'], [/\/lib\/api$/, 'api'],
            [/\/registeredAssignmentResources$/, 'resources'],
        ]) builder.onResolve({ filter }, () => ({ path, namespace: 'ops-events' }));
        builder.onLoad({ filter: /.*/, namespace: 'ops-events' }, ({ path }) => ({ loader: 'js', contents: {
            react: `export const useState=(...a)=>globalThis.h.useState(...a),useEffect=(...a)=>globalThis.h.useEffect(...a),useMemo=(...a)=>globalThis.h.useMemo(...a),useRef=(...a)=>globalThis.h.useRef(...a),useCallback=(f,d)=>useMemo(()=>f,d);export default {Fragment:'fragment'};`,
            'react/jsx-runtime': `export const Fragment='fragment';export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;`,
            'react-router-dom': `export const useBlocker=()=>({state:'unblocked',reset(){},proceed(){}});`,
            user: `export const useUser=()=>({user:{id:'admin-fixture',role:'admin'},loading:false});`,
            layout: `export const AdminLayout=()=>null;`, icon: `export const Icon=()=>null;`,
            api: `export const api=globalThis.api;`,
            resources: `export const loadRegisteredAssignmentResources=(...a)=>globalThis.loadResources(...a);`,
        }[path] }));
        builder.onLoad({ filter: /\.css$/ }, () => ({ loader: 'js', contents: '' }));
    } }],
});
const bundle = built.outputFiles[0].text;
const plain = value => JSON.parse(JSON.stringify(value));
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const nodes = root => !root || typeof root !== 'object' ? [] : Array.isArray(root) ? root.flatMap(nodes)
    : [root, ...nodes(root.props?.children), ...nodes(root.props?.actions)];
const text = root => typeof root === 'string' || typeof root === 'number' ? String(root)
    : Array.isArray(root) ? root.map(text).join('') : text(root?.props?.children ?? '');
const resourceFixture = () => ({
    guides: [{ id: 'resource-guide:등록 가이드 / #?', name: '등록 가이드 / #?', phone: '010-2222-3333', image: '/new-guide.webp', introduction: '가이드 소개', nameEn: 'Registered Guide', role: '전문 가이드', languages: ['한국어'], specialties: ['테를지'], qr: '/private-qr.webp', _fromResources: true }],
    lodges: [{ id: 'resource-lodge:등록 게르 / #?', name: '등록 게르 / #?', type: '고급게르', location: '중앙몽골', region: '중앙몽골', address: '저장된 주소', occupancy: '3인실', images: [], description: '', facilities: ['온수'], roomAmenities: ['수건'], sharedFacilities: ['식당'], _fromResources: true }],
    vehicles: [{ name: '등록 하이이스 / #?', type: '등록 하이이스 / #?', phone: '010-4444-5555', snapshot: { model: '등록 하이이스 / #?', img: '/new-car.webp', images: ['/new-car.webp'], description: '등록 차량 소개', seats: '6인', luggage: '캐리어 4개' } }],
    warnings: [],
});
const bookingFixture = source => ({
    key: `${source}:same / #?`, source, id: 'same / #?', version: 'a'.repeat(64),
    customerName: source === 'product' ? '상품 고객' : '견적 고객', productName: '운영 연결 투어',
    startDate: '2026-11-01', endDate: '2026-11-02', status: 'confirmed', depositStatus: 'paid', travelers: 2,
    accommodationsInitialized: true, contractData: { region: '중앙몽골', travelers: [] },
    assignment: { guide: { id: 'old-guide', name: '이전 가이드', phone: '010-1111-1111' },
        vehicle: { type: '이전 차량', phone: '010-1111-2222' },
        accommodations: [{ day: 1, date: '2026-11-01', accommodation: { id: 'old-lodge', name: '이전 숙소', type: '호텔', location: '이전 지역', images: ['/old-lodge.webp'], description: '이전 설명', facilities: ['이전 시설'], roomCount: 2, occupancy: '2 хүн/өрөө', bookingStatus: 'Баталгаажсан' } }],
    },
});

function mount({ resources = async () => resourceFixture(), failPatch = false, items } = {}) {
    const server = plain(items || [bookingFixture('product'), bookingFixture('quote_booking')]), requests = [], resourceCalls = [];
    const storage = new Map(), windowListeners = new Map(), documentListeners = new Map();
    const module = { exports: {} };
    const listeners = map => ({ addEventListener(name, fn) { if (!map.has(name)) map.set(name, new Set()); map.get(name).add(fn); }, removeEventListener(name, fn) { map.get(name)?.delete(fn); } });
    const browser = { ...listeners(windowListeners), location: { search: '' }, confirm: () => true,
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
        setTimeout: () => 1, clearTimeout() {},
    };
    const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => plain(body) });
    const context = vm.createContext({ module, exports: module.exports, console, AbortController, URLSearchParams, crypto: { randomUUID },
        window: browser, document: { ...listeners(documentListeners), getElementById: () => null },
        Element: class Element {}, setTimeout: () => 1, clearTimeout() {},
        api: { hotels: { list: async () => { throw new Error('공통 자원 대신 이전 호텔 목록을 조회했습니다.'); } } },
        loadResources: (...args) => { resourceCalls.push(args); return resources(...args); },
        fetch: async (url, options = {}) => {
            requests.push({ url: String(url), options, body: options.body ? JSON.parse(options.body) : null });
            if (!options.method || options.method === 'GET') return response({ items: server, warnings: [], availability: { product: true, quote_booking: true } });
            assert.equal(options.method, 'PATCH');
            const match = /^\/api\/admin\/assignments\/(product|quote_booking)\/(.+)$/.exec(String(url));
            assert.ok(match, String(url));
            const item = server.find(row => row.source === match[1] && row.id === decodeURIComponent(match[2]));
            assert.ok(item, String(url));
            const body = JSON.parse(options.body);
            if (failPatch || item.version !== body.expectedVersion) return response({ error: '다른 곳에서 예약이 변경되었습니다.' }, 409);
            item.assignment = plain(body.assignment); item.version = 'b'.repeat(64);
            return response({ item });
        },
    });
    vm.runInContext(bundle, context);
    const values = [], effects = new Map(); let cursor = 0, pendingEffects = [];
    const sameDeps = (a, b) => a && b && a.length === b.length && a.every((item, index) => Object.is(item, b[index]));
    const h = { tree: null, server, requests, resourceCalls, storage,
        useState(initial) { const key = cursor++; if (!(key in values)) values[key] = typeof initial === 'function' ? initial() : initial; return [values[key], change => { values[key] = typeof change === 'function' ? change(values[key]) : change; }]; },
        useRef(initial) { const key = cursor++; if (!(key in values)) values[key] = { current: initial }; return values[key]; },
        useMemo(fn, deps) { const key = cursor++; const before = values[key]; if (!before || !sameDeps(before.deps, deps)) values[key] = { value: fn(), deps }; return values[key].value; },
        useEffect(fn, deps) { const key = cursor++, before = effects.get(key); if (!before || !sameDeps(before.deps, deps)) pendingEffects.push(() => { before?.cleanup?.(); effects.set(key, { deps, cleanup: fn() }); }); },
        render() { cursor = 0; pendingEffects = []; context.h = h; const root = module.exports.AdminAccommodationOps({}); h.tree = typeof root.type === 'function' ? root.type(root.props) : root; pendingEffects.forEach(run => run()); return h.tree; },
        async settle() { await tick(); h.render(); await tick(); h.render(); },
        row(source) { const row = nodes(h.tree).find(node => node.props?.id === `acc-row-${source}:same / #?`); assert.ok(row, `${source} 예약 행`); return row; },
        async open(source = 'quote_booking') { h.row(source).props.onClick(); h.render(); await h.settle(); },
        select(value) { const select = nodes(h.tree).find(node => node.type === 'select' && nodes(node).some(child => child.type === 'option' && child.props.value === value)); assert.ok(select, `선택 항목 ${value}`); assert.ok(!select.props.disabled, `${value} 선택 가능`); select.props.onChange({ target: { value } }); h.render(); },
        button(label) { const button = nodes(h.tree).find(node => node.type === 'button' && text(node).includes(label)); assert.ok(button, label); return button; },
        flushDraft() { for (const listener of windowListeners.get('pagehide') || []) listener(); },
        unmount() { for (const entry of effects.values()) entry.cleanup?.(); },
    };
    h.render(); return h;
}

test('숙소 운영 보드의 실제 등록 선택은 자동 채움만 하고 저장할 때 정확한 원본·버전으로 전송한다', async () => {
    const h = mount(); await h.settle(); await h.open();
    assert.equal(h.resourceCalls.length, 1);
    assert.equal(h.resourceCalls[0][0].accountId, 'admin-fixture');
    const originalProduct = plain(h.server[0]);
    h.select('resource-guide:등록 가이드 / #?');
    h.select('등록 하이이스 / #?');
    // A saved legacy supplier remains visible as manual input until the operator
    // explicitly switches this cell to the common resource library.
    const switchLodge = nodes(h.tree).find(node => node.type === 'button' && node.props.title === '등록 숙소 목록에서 선택');
    assert.ok(switchLodge); switchLodge.props.onClick(); h.render();
    h.select('resource-lodge:등록 게르 / #?');
    assert.equal(h.requests.filter(call => call.options.method === 'PATCH').length, 0);
    assert.ok(nodes(h.tree).some(node => node.type === 'input' && node.props.value === '010-2222-3333'));
    assert.ok(nodes(h.tree).some(node => node.type === 'input' && node.props.value === '010-4444-5555'));
    h.flushDraft();
    const savedDraft = [...h.storage.values()].map(JSON.parse).find(value => value.scope?.source === 'quote_booking');
    assert.ok(savedDraft, '선택을 계정·원본별 초안으로 보관');
    assert.equal(savedDraft.scope.id, 'same / #?'); assert.equal(savedDraft.scope.userId, 'admin-fixture');
    assert.equal(savedDraft.baseVersion, 'a'.repeat(64));
    const save = h.button('Хадгалах'); assert.equal(save.props.disabled, false); await save.props.onClick(); await h.settle();
    const patch = h.requests.find(call => call.options.method === 'PATCH');
    assert.equal(patch.url, '/api/admin/assignments/quote_booking/same%20%2F%20%23%3F');
    assert.equal(patch.options.credentials, 'same-origin'); assert.equal(patch.body.expectedVersion, 'a'.repeat(64));
    const guide = patch.body.assignment.guide, vehicle = patch.body.assignment.vehicle;
    assert.equal(guide.id, 'resource-guide:등록 가이드 / #?'); assert.equal(guide.name, '등록 가이드 / #?'); assert.equal(guide.phone, '010-2222-3333');
    assert.equal(vehicle.type, '등록 하이이스 / #?'); assert.equal(vehicle.phone, '010-4444-5555');
    assert.equal(guide.image, '/new-guide.webp'); assert.equal(guide.introduction, '가이드 소개');
    assert.deepEqual(guide.languages, ['한국어']); assert.equal(guide.qr, undefined);
    assert.equal(vehicle.resource.img, '/new-car.webp'); assert.equal(vehicle.resource.description, '등록 차량 소개');
    const stay = patch.body.assignment.accommodations[0];
    assert.equal(stay.day, 1); assert.equal(stay.date, '2026-11-01');
    assert.equal(stay.accommodation.id, 'resource-lodge:등록 게르 / #?');
    assert.equal(stay.accommodation.location, '중앙몽골'); assert.equal(stay.accommodation.type, '고급게르');
    assert.deepEqual(stay.accommodation.images, []); assert.equal(stay.accommodation.description, '');
    assert.deepEqual(stay.accommodation.facilities, ['온수']); assert.equal(stay.accommodation.bookingStatus, 'Илгээгээгүй');
    assert.equal(stay.accommodation.roomCount, 2); assert.equal(stay.accommodation.occupancy, '2 хүн/өрөө');
    assert.deepEqual(h.server[0], originalProduct); assert.equal(h.storage.size, 0);
    await h.button('Шинэчлэх').props.onClick(); await h.settle(); await h.open();
    assert.ok(nodes(h.tree).some(node => node.type === 'select' && node.props.value === 'resource-guide:등록 가이드 / #?'));
    assert.ok(nodes(h.tree).some(node => node.type === 'select' && node.props.value === 'resource-lodge:등록 게르 / #?'));
    h.unmount();
});

test('숙소 운영의 저장 충돌은 선택한 배정과 계정별 초안을 남기고 기존 원본을 바꾸지 않는다', async () => {
    const h = mount({ failPatch: true }); await h.settle(); await h.open();
    const before = plain(h.server);
    h.select('resource-guide:등록 가이드 / #?');
    await h.button('Хадгалах').props.onClick(); await h.settle();
    assert.deepEqual(h.server, before); assert.ok(text(h.tree).includes('다른 곳에서 예약이 변경되었습니다.'));
    assert.ok(nodes(h.tree).some(node => node.type === 'select' && node.props.value === 'resource-guide:등록 가이드 / #?'));
    assert.equal(h.storage.size, 1);
    assert.equal(JSON.parse([...h.storage.values()][0]).assignment.guide.id, 'resource-guide:등록 가이드 / #?');
    h.unmount();
});

test('숙소 입력 모드 전환은 현재 배정을 보존하고 실제 수동 변경만 이전 숙소 정보를 해제한다', async () => {
    const h = mount(); await h.settle(); await h.open('product');
    const originalQuote = plain(h.server[1]);
    const manualInput = () => {
        const input = nodes(h.tree).find(node => node.type === 'input' && node.props['aria-label'] === '숙소명 직접 입력');
        assert.ok(input, '현재 숙소 직접 입력'); return input;
    };
    assert.equal(manualInput().props.value, '이전 숙소');
    const switchMode = nodes(h.tree).find(node => node.type === 'button' && node.props.title === '등록 숙소 목록에서 선택');
    assert.ok(switchMode); switchMode.props.onClick(); h.render();
    const current = nodes(h.tree).find(node => node.type === 'select' && node.props['aria-label'] === '등록 숙소 선택');
    assert.equal(current.props.value, '__current__'); assert.ok(text(current).includes('현재 배정: 이전 숙소'));
    h.select('__manual__');
    assert.equal(manualInput().props.value, '이전 숙소');
    assert.equal(h.button('Хадгалах').props.disabled, true);
    manualInput().props.onChange({ target: { value: '이전 숙소' } }); h.render();
    h.flushDraft(); assert.equal(h.storage.size, 0);
    assert.equal(h.requests.filter(call => call.options.method === 'PATCH').length, 0);

    manualInput().props.onChange({ target: { value: '새로 직접 작성한 숙소' } }); h.render();
    const region = nodes(h.tree).find(node => node.type === 'input' && node.props.placeholder === '지역 입력');
    assert.ok(region); region.props.onChange({ target: { value: '새 운영 지역' } }); h.render();
    await h.button('Хадгалах').props.onClick(); await h.settle();
    const patch = h.requests.find(call => call.options.method === 'PATCH');
    assert.equal(patch.url, '/api/admin/assignments/product/same%20%2F%20%23%3F');
    const stay = patch.body.assignment.accommodations[0], acc = stay.accommodation;
    assert.equal(acc.name, '새로 직접 작성한 숙소'); assert.equal(acc.id, undefined);
    assert.deepEqual(acc.images, []); assert.equal(acc.description, ''); assert.deepEqual(acc.facilities, []);
    assert.equal(acc.address, ''); assert.deepEqual(acc.roomAmenities, []); assert.deepEqual(acc.sharedFacilities, []);
    assert.equal(acc.bookingStatus, 'Илгээгээгүй');
    assert.equal(stay.day, 1); assert.equal(stay.date, '2026-11-01');
    assert.equal(acc.roomCount, 2); assert.equal(acc.occupancy, '2 хүн/өрөө');
    assert.equal(acc.location, '새 운영 지역'); assert.equal(acc.region, '새 운영 지역');
    assert.deepEqual(h.server[1], originalQuote);
    await h.button('Шинэчлэх').props.onClick(); await h.settle(); await h.open('product');
    assert.equal(manualInput().props.value, '새로 직접 작성한 숙소');
    assert.ok(nodes(h.tree).some(node => node.type === 'input' && node.props.placeholder === '지역 입력' && node.props.value === '새 운영 지역'));
    h.unmount();
});

test('숙소 운영 화면을 벗어난 뒤 도착한 공통 자료는 선택·초안·외부 저장을 만들지 않는다', async () => {
    const pending = deferred(), h = mount({ resources: () => pending.promise }); await h.settle();
    assert.equal(h.resourceCalls.length, 1); const options = h.resourceCalls[0][0];
    h.unmount(); pending.resolve(resourceFixture()); await tick();
    assert.equal(options.signal.aborted, true);
    assert.equal(h.requests.filter(call => call.options.method === 'PATCH').length, 0); assert.equal(h.storage.size, 0);
});

const twoNightFixture = (source = 'quote_booking', scheduleSource = 'booking') => {
    const row = bookingFixture(source);
    row.endDate = '2026-11-03';
    row.schedule = { source: scheduleSource, warnings: [], days: [
        { day: 1, date: '2026-11-01', title: '초원 도착과 첫날 투어', region: '중앙몽골', summary: '공항 픽업 · 초원 산책' },
        { day: 2, date: '2026-11-02', title: '고비 사막 이동', region: '고비사막', summary: '사막 체험 · 모래 언덕' },
        { day: 3, date: '2026-11-03', title: '울란바토르 귀국', region: '울란바토르', summary: '공항 이동' },
    ] };
    return row;
};

test('고객의 2박3일 일정과 출처를 보여 주고 빠진 숙박일만 추가하며 필요한 전체 박수로 완료를 판단한다', async () => {
    const row = twoNightFixture(), before = plain(row.assignment.accommodations[0]);
    const libraries = resourceFixture();
    libraries.lodges.push({ ...plain(libraries.lodges[0]), id: 'resource-lodge:고비 등록 숙소', name: '고비 등록 숙소', location: '고비사막', region: '고비사막' });
    const h = mount({ items: [row], resources: async () => libraries }); await h.settle();
    assert.match(text(h.row('quote_booking')), /1\/2/, '한 행만 확정되어도 필요한 2박 중 1박으로 표시');
    assert.ok(!text(h.row('quote_booking')).includes('Баталгаажсан'), '누락 숙박일이 있는 투어를 완료로 표시하지 않음');
    await h.open();
    assert.ok(text(h.tree).includes('예약 확정 일정'));
    assert.ok(nodes(h.tree).some(node => node.type === 'summary' && text(node).includes('전체 고객 일정 보기')));
    for (const day of row.schedule.days) assert.ok(text(h.tree).includes(day.title), day.title);
    assert.equal(nodes(h.tree).filter(node => node.type === 'input' && node.props['aria-label'] === '숙박 날짜').length, 1);
    h.button('누락 숙박일 추가').props.onClick(); h.render();
    const dates = nodes(h.tree).filter(node => node.type === 'input' && node.props['aria-label'] === '숙박 날짜').map(node => node.props.value);
    assert.deepEqual(dates, ['2026-11-01', '2026-11-02']);
    const select = nodes(h.tree).find(node => node.type === 'select' && node.props['aria-label'] === '등록 숙소 선택');
    assert.ok(select, '추가한 두 번째 밤의 공통 숙소 선택');
    const groups = nodes(select).filter(node => node.type === 'optgroup');
    assert.equal(groups[0]?.props.label, '일정 지역: 고비사막');
    assert.equal(groups[1]?.props.label, '전체 다른 지역');
    assert.ok(nodes(groups[0]).some(node => node.type === 'option' && node.props.value === 'resource-lodge:고비 등록 숙소'));
    assert.ok(nodes(groups[1]).some(node => node.type === 'option' && node.props.value === 'resource-lodge:등록 게르 / #?'));
    assert.equal(h.requests.filter(call => call.options.method === 'PATCH').length, 0);
    await h.button('Хадгалах').props.onClick(); await h.settle();
    const patch = h.requests.find(call => call.options.method === 'PATCH');
    assert.deepEqual(Object.keys(patch.body).sort(), ['assignment', 'expectedVersion']);
    const stays = patch.body.assignment.accommodations;
    assert.deepEqual(stays[0], before, '기존 숙소·객실·인실·확정 상태를 보존');
    assert.equal(stays.length, 2); assert.equal(stays[1].day, 2); assert.equal(stays[1].date, '2026-11-02');
    assert.ok(!stays[1].accommodation.name, '일정의 숙소를 운영 배정으로 임의 확정하지 않음');
    h.unmount();
});

test('기존 숙박 날짜 불일치는 먼저 경고하고 명시적 날짜 맞추기에서만 변경하며 수배 정보를 보존한다', async () => {
    const row = twoNightFixture('product', 'customer');
    row.assignment.accommodations[0].date = '2026-10-01';
    row.assignment.accommodations.push({ day: 2, date: '2026-11-02', accommodation: { ...plain(row.assignment.accommodations[0].accommodation), id: 'second-lodge', name: '둘째 밤 숙소', roomCount: 1 } });
    const h = mount({ items: [row] }); await h.settle(); await h.open('product');
    const dates = () => nodes(h.tree).filter(node => node.type === 'input' && node.props['aria-label'] === '숙박 날짜').map(node => node.props.value);
    assert.deepEqual(dates(), ['2026-10-01', '2026-11-02'], '펼치기만 해서 기존 날짜를 고치지 않음');
    assert.ok(text(h.tree).includes('고객별 저장 일정'));
    assert.ok(nodes(h.tree).some(node => ['alert', 'status'].includes(node.props?.role) && /날짜|불일치/.test(text(node))), '날짜 문제를 운영자가 확인할 수 있게 표시');
    assert.equal(h.button('Хадгалах').props.disabled, true);
    h.button('여행 날짜에 맞추기').props.onClick(); h.render();
    assert.deepEqual(dates(), ['2026-11-01', '2026-11-02']);
    assert.equal(h.requests.filter(call => call.options.method === 'PATCH').length, 0);
    await h.button('Хадгалах').props.onClick(); await h.settle();
    const stays = h.requests.find(call => call.options.method === 'PATCH').body.assignment.accommodations;
    assert.equal(stays[0].accommodation.id, 'old-lodge'); assert.equal(stays[0].accommodation.name, '이전 숙소');
    assert.deepEqual(stays[0].accommodation.images, ['/old-lodge.webp']);
    assert.equal(stays[0].accommodation.roomCount, 2); assert.equal(stays[0].accommodation.occupancy, '2 хүн/өрөө');
    assert.equal(stays[0].accommodation.bookingStatus, 'Илгээгээгүй', '변경된 숙박 날짜는 다시 수배해야 함');
    assert.equal(stays[1].accommodation.bookingStatus, 'Баталгаажсан', '날짜가 맞는 행의 수배 상태는 보존');
    h.unmount();
});

test('명시적으로 비운 고객 일정과 저장된 빈 숙소 배열은 보드를 펼치거나 새로고침해도 자동 복구하지 않는다', async () => {
    const row = twoNightFixture('product', 'customer');
    row.schedule.days = []; row.assignment.accommodations = []; row.accommodationsInitialized = true;
    const h = mount({ items: [row] }); await h.settle(); await h.open('product');
    assert.ok(text(h.tree).includes('고객별 저장 일정'));
    assert.equal(nodes(h.tree).filter(node => node.type === 'input' && node.props['aria-label'] === '숙박 날짜').length, 0);
    h.flushDraft(); assert.equal(h.storage.size, 0); assert.equal(h.button('Хадгалах').props.disabled, true);
    await h.button('Шинэчлэх').props.onClick(); await h.settle(); await h.open('product');
    assert.equal(nodes(h.tree).filter(node => node.type === 'input' && node.props['aria-label'] === '숙박 날짜').length, 0);
    assert.deepEqual(h.server[0].schedule.days, []); assert.deepEqual(h.server[0].assignment.accommodations, []);
    assert.equal(h.requests.filter(call => call.options.method === 'PATCH').length, 0);
    h.unmount();
});

test('숙박 날짜를 직접 고칠 때도 변경한 예약만 다시 수배하고 기존 객실과 배정 자료는 보존한다', async () => {
    const row = twoNightFixture('product', 'customer');
    row.assignment.accommodations[0].accommodation.roomCount = 0;
    row.assignment.accommodations.push({ day: 2, date: '2026-11-02', accommodation: {
        ...plain(row.assignment.accommodations[0].accommodation), id: 'second-lodge', name: '둘째 밤 숙소', roomCount: 1,
    } });
    const before = plain(row.assignment.accommodations);
    const h = mount({ items: [row] }); await h.settle(); await h.open('product');
    const dates = () => nodes(h.tree).filter(node => node.type === 'input' && node.props['aria-label'] === '숙박 날짜');
    dates()[1].props.onChange({ target: { value: '2026-11-02' } }); h.render();
    dates()[0].props.onChange({ target: { value: '2026-10-31' } }); h.render();
    assert.equal(h.requests.filter(call => call.options.method === 'PATCH').length, 0);
    await h.button('Хадгалах').props.onClick(); await h.settle();
    const stays = h.requests.find(call => call.options.method === 'PATCH').body.assignment.accommodations;
    assert.deepEqual(stays[0], { ...before[0], date: '2026-10-31', accommodation: {
        ...before[0].accommodation, bookingStatus: 'Илгээгээгүй',
    } }, '직접 바꾼 날짜만 수배 재확인이 필요하며 객실 0을 비롯한 자료를 보존');
    assert.deepEqual(stays[1], before[1], '같은 날짜를 다시 입력해도 확정 상태를 유지');
    await h.button('Шинэчлэх').props.onClick(); await h.settle(); await h.open('product');
    assert.deepEqual(dates().map(node => node.props.value), ['2026-10-31', '2026-11-02']);
    h.unmount();
});

test('일정 원본을 불러오지 못하면 저장된 숙소는 보여 주되 자동 날짜 맞추기와 누락일 생성은 하지 않는다', async () => {
    const row = twoNightFixture('product', 'unavailable');
    row.schedule.days = []; row.schedule.warnings = ['고객 일정 원본 확인 필요'];
    row.assignment.accommodations[0].date = '2026-10-31';
    const h = mount({ items: [row] }); await h.settle();
    assert.ok(!text(h.row('product')).includes('Баталгаажсан'), '원본 불명확한 예약을 배정 완료로 표시하지 않음');
    await h.open('product');
    assert.ok(text(h.tree).includes('고객 일정 원본 확인 필요'));
    assert.ok(nodes(h.tree).some(node => node.type === 'input' && node.props['aria-label'] === '숙박 날짜' && node.props.value === '2026-10-31'));
    assert.equal(h.button('여행 날짜에 맞추기').props.disabled, true);
    assert.equal(h.button('누락 숙박일 추가').props.disabled, true);
    assert.equal(h.button('Хадгалах').props.disabled, true);
    h.flushDraft(); assert.equal(h.storage.size, 0);
    assert.equal(h.requests.filter(call => call.options.method === 'PATCH').length, 0);
    assert.deepEqual(h.server[0], row);
    h.unmount();
});

test('당일 투어와 여행 기간이 없는 예약은 잘못된 0박 확정 건수로 표시하지 않는다', async () => {
    const dayTrip = twoNightFixture('product', 'customer');
    dayTrip.endDate = dayTrip.startDate;
    dayTrip.schedule.days = dayTrip.schedule.days.slice(0, 1);
    dayTrip.assignment.accommodations = [];
    const h = mount({ items: [dayTrip] }); await h.settle();
    assert.ok(text(h.row('product')).includes('숙박 없음'));
    assert.ok(!text(h.row('product')).includes('0/0'));
    await h.open('product');
    assert.ok(text(h.tree).includes('당일 여행으로 숙박 배정이 필요하지 않습니다.'));
    assert.equal(nodes(h.tree).filter(node => node.type === 'input' && node.props['aria-label'] === '숙박 날짜').length, 0);
    h.unmount();

    const unknown = bookingFixture('product');
    unknown.startDate = ''; unknown.endDate = '';
    const pending = mount({ items: [unknown] }); await pending.settle();
    assert.ok(text(pending.row('product')).includes('필요 숙박일 확인'));
    assert.ok(!text(pending.row('product')).includes('0/0'));
    await pending.open('product');
    assert.ok(text(pending.tree).includes('여행 기간을 확인하면 필요한 숙박일을 계산할 수 있습니다.'));
    assert.equal(pending.button('여행 날짜에 맞추기').props.disabled, true);
    assert.ok(nodes(pending.tree).some(node => node.type === 'input' && node.props['aria-label'] === '숙박 날짜' && node.props.value === '2026-11-01'), '저장된 수배 날짜는 유지');
    pending.unmount();
});
