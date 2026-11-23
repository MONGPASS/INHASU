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
            [/\/registeredAssignmentResources$/, 'resources'], [/\/ui\/adminFeedback$/, 'feedback'],
            // 배정 보드(LodgeAssignQueue)와 보기 전환(AdminSegmented)은 Montage 화면 부품이라 대역으로 둔다. 이 파일은 카드·표 보기의 편집 흐름을 검사한다.
            // 표로 보기(LodgeAssignBoard)의 찾기·고르기·칩·배지도 우리 관리자 부품이라 같은 대역을 쓴다(값은 props로 확인).
            [/\/accommodation\/LodgeAssignQueue$/, 'queue'], [/\/components\/admin\/ui$|^\.\.\/ui$/, 'ui'],
        ]) builder.onResolve({ filter }, () => ({ path, namespace: 'ops-events' }));
        builder.onLoad({ filter: /.*/, namespace: 'ops-events' }, ({ path }) => ({ loader: 'js', contents: {
            react: `export const useState=(...a)=>globalThis.h.useState(...a),useEffect=(...a)=>globalThis.h.useEffect(...a),useMemo=(...a)=>globalThis.h.useMemo(...a),useRef=(...a)=>globalThis.h.useRef(...a),useCallback=(f,d)=>useMemo(()=>f,d);export default {Fragment:'fragment'};`,
            'react/jsx-runtime': `export const Fragment='fragment';export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;`,
            'react-router-dom': `export const useBlocker=()=>({state:'unblocked',reset(){},proceed(){}});`,
            user: `export const useUser=()=>({user:{id:'admin-fixture',role:'admin'},loading:false});`,
            layout: `export const AdminLayout=()=>null;`, icon: `export const Icon=()=>null;`,
            queue: `export const LodgeAssignQueue=()=>null;`, ui: `export const AdminSegmented=()=>null,AdminBadge=()=>null,AdminChipGroup=()=>null,AdminIconButton=()=>null,AdminSearch=()=>null,AdminSelect=()=>null,AdminTextButton=()=>null,AdminButton=()=>null;`,
            api: `export const api=globalThis.api;`,
            resources: `export const loadRegisteredAssignmentResources=(...a)=>globalThis.loadResources(...a);`,
            // 공통 알림·확인 창은 화면 부품이라, 같은 약속(Promise<boolean>)의 대역으로 바꾼다.
            feedback: `export const adminNotify=()=>{};export const adminConfirm=async m=>(typeof window!=='undefined'&&window.confirm?!!window.confirm(typeof m==='string'?m:m.message):true);`,
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

// 보드는 오늘 이후 투어만 보여 주므로 고정된 '오늘'(픽스처 출발일 전)에서 실행한다.
const FIXTURE_TODAY = '2026-10-15T09:00:00';
class FixtureDate extends Date {
    constructor(...args) { super(...(args.length ? args : [FIXTURE_TODAY])); }
    static now() { return new Date(FIXTURE_TODAY).getTime(); }
}
function mount({ resources = async () => resourceFixture(), failPatch = false, items, view = 'sheet-view', search = '' } = {}) {
    const server = plain(items || [bookingFixture('product'), bookingFixture('quote_booking')]), requests = [], resourceCalls = [];
    const storage = new Map(), windowListeners = new Map(), documentListeners = new Map();
    // 이 파일은 표로 보기의 편집 흐름을 검사한다(카드 보기는 2026-11-23 없앴다). 보기 설정은 초안 저장소(storage)와 따로 둔다.
    let promptAnswer = null;
    const VIEW_KEY = 'inhasu:accommodation-board:view';
    const module = { exports: {} };
    const listeners = map => ({ addEventListener(name, fn) { if (!map.has(name)) map.set(name, new Set()); map.get(name).add(fn); }, removeEventListener(name, fn) { map.get(name)?.delete(fn); } });
    const browser = { ...listeners(windowListeners), location: { search }, confirm: () => true, prompt: () => promptAnswer,
        localStorage: { getItem: key => key === VIEW_KEY ? view : storage.get(key) ?? null, setItem: (key, value) => { if (key === VIEW_KEY) view = value; else storage.set(key, value); }, removeItem: key => storage.delete(key) },
        setTimeout: () => 1, clearTimeout() {},
    };
    const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => plain(body) });
    const context = vm.createContext({ module, exports: module.exports, console, AbortController, URLSearchParams, crypto: { randomUUID }, Date: FixtureDate,
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
            if ('contractPackageType' in body.assignment) item.contractPackageType = body.assignment.contractPackageType;
            else item.assignment = plain(body.assignment);
            item.version = 'b'.repeat(64);
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
        answerPrompt(value) { promptAnswer = value; },
        row(source) { const row = nodes(h.tree).find(node => node.props?.id === `acc-row-${source}:same / #?`); assert.ok(row, `${source} 예약 행`); return row; },
        async open(source = 'quote_booking') { h.row(source).props.onClick(); h.render(); await h.settle(); },
        select(value) { const select = nodes(h.tree).find(node => node.type === 'select' && nodes(node).some(child => child.type === 'option' && child.props.value === value)); assert.ok(select, `선택 항목 ${value}`); assert.ok(!select.props.disabled, `${value} 선택 가능`); select.props.onChange({ target: { value } }); h.render(); },
        button(label) { const button = nodes(h.tree).find(node => node.type === 'button' && text(node).includes(label)); assert.ok(button, label); return button; },
        /** 페이지 새로고침: 화면 상태를 버리고 같은 서버·저장소로 다시 연다(머리의 새로고침 버튼은 운영 요청으로 뺐다). */
        async reload() { h.unmount(); for (const key of Object.keys(values)) delete values[key]; effects.clear(); h.render(); await h.settle(); },
        flushDraft() { for (const listener of windowListeners.get('pagehide') || []) listener(); },
        unmount() { for (const entry of effects.values()) entry.cleanup?.(); },
    };
    h.render(); return h;
}

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

// 숙소 배정 시트(LodgeAssignBoard)는 별도 컴포넌트라 직접 그려서 칸을 찾고, 칸을 누르면 뜨는 고르기 창에서 값을 고른다.
const boardEl = h => { const el = nodes(h.tree).find(node => typeof node.type === 'function' && Array.isArray(node.props?.tours)); assert.ok(el, '시트 보기'); return el; };
// 보드도 hook을 쓰므로 페이지를 먼저 다시 그려 hook 순서를 맞춘 뒤 보드를 그린다.
// 표로 보기는 예약 줄이 접힌 채로 시작한다. 숙박 칸을 찾기 전에 아래 ‘모두 펼치기’를 한 번 누른다(이미 펼쳤으면 그대로).
const boardNodes = h => {
    h.render(); let el = boardEl(h), found = nodes(el.type(el.props));
    const expand = found.find(n => typeof n.type === 'function' && text(n) === '모두 펼치기');
    if (expand) { expand.props.onClick(); h.render(); el = boardEl(h); found = nodes(el.type(el.props)); }
    return found;
};
const fakeClick = { stopPropagation() {}, preventDefault() {}, currentTarget: { getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0 }) } };
const boardField = (h, label) => { const node = boardNodes(h).find(n => n.props?.['aria-label'] === label); assert.ok(node, label); return node; };
const boardPick = (h, label, value) => {
    boardField(h, label).props.onClick(fakeClick); h.render();
    const item = boardNodes(h).find(n => n.type === 'button' && n.props?.className === 'la-pop-item' && text(nodes(n).find(c => c.type === 'b')) === value);
    assert.ok(item, `${label} → ${value}`); item.props.onClick(); h.render();
};
// 생 버튼과 우리 관리자 부품(AdminButton 대역)을 함께 찾는다.
const isButton = n => n.type === 'button' || (typeof n.type === 'function' && typeof n.props?.onClick === 'function');
const boardButton = (h, label) => { const node = boardNodes(h).find(n => isButton(n) && text(n).includes(label)); assert.ok(node, label); return node; };

test('예약 정보는 선택한 상품·견적 계약서 한 건을 미리 보고 같은 문서를 새 창에서 연다', async () => {
    const h = mount({ view: 'sheet-view' });
    await h.settle();
    const frames = () => boardNodes(h).filter(n => n.type === 'iframe');
    assert.equal(frames().length, 0);
    const id = encodeURIComponent('same / #?');
    for (const [name, href] of [['상품 고객', `/documents/contract/${id}?preview=1`], ['견적 고객', `/계약서.html?adminId=${id}&preview=1`]]) {
        boardField(h, name + ' 예약 정보 보기').props.onClick(fakeClick);
        assert.equal(frames().length, 1);
        assert.equal(frames()[0].props.src, href);
        assert.equal(frames()[0].props.title, name + ' 여행계약서 미리보기');
        const link = boardField(h, name + ' 여행계약서 새 창에서 열기');
        assert.equal(link.props.href, href);
        assert.equal(link.props.target, '_blank');
        assert.match(link.props.rel, /noopener/);
    }
    boardField(h, '예약 정보 닫기').props.onClick();
    assert.equal(frames().length, 0);
});

test('시트 보기: 오늘 이후 투어만 보여 주고 분류·배정 구분·예약메모를 모두 저장으로 보낸다', async () => {
    const past = { ...bookingFixture('product'), key: 'product:past-tour', id: 'past-tour', customerName: '지난 고객', startDate: '2026-09-01', endDate: '2026-09-03' };
    const h = mount({ view: 'sheet-view', items: [bookingFixture('product'), bookingFixture('quote_booking'), past] });
    await h.settle();
    assert.deepEqual(plain(boardEl(h).props.tours.map(t => t.customerName)).sort(), ['견적 고객', '상품 고객'], '지난 투어는 목록에 없다');
    assert.ok(!nodes(h.tree).some(node => node.props?.id === 'acc-row-product:same / #?'), '시트 보기에서는 카드 목록을 그리지 않는다');
    // 들어오면 달을 고르지 않고 전체 기간의 예약을 모두 보여 준다.
    assert.equal(boardField(h, '숙박 기간').props.value, 'all', '처음에는 전체 기간');

    boardField(h, '상품 고객 예약 정보 보기').props.onClick(fakeClick); h.render();
    boardPick(h, '상품 고객 분류', '골프투어');
    boardPick(h, '상품 고객 1박 배정 구분', '2인1실');
    const roomCount = boardField(h, '상품 고객 1박 방수');
    assert.equal(roomCount.props.value, 2);
    const input = roomCount.type(roomCount.props);
    assert.deepEqual([input.props.type, input.props.min, input.props.max, input.props.step], ['number', 1, 10, 1]);
    input.props.onChange({ currentTarget: { value: '10', valueAsNumber: 10, reportValidity: () => true } });
    boardField(h, '상품 고객 1박 예약메모').props.onChange({ target: { value: '늦은 체크인' } }); h.render();
    await h.settle();
    assert.equal(h.requests.filter(r => r.options.method === 'PATCH').length, 0, '저장 전에는 서버를 바꾸지 않는다');
    boardButton(h, '모두 저장').props.onClick(); await h.settle(); await h.settle();
    const patches = h.requests.filter(r => r.options.method === 'PATCH');
    assert.equal(patches.length, 1, '바꾼 예약만 저장한다');
    assert.match(patches[0].url, /\/api\/admin\/assignments\/product\//);
    assert.equal(patches[0].body.assignment.category, '골프투어');
    const night = patches[0].body.assignment.accommodations[0];
    assert.deepEqual(plain([night.day, night.date, night.accommodation.name, night.accommodation.roomCount, night.accommodation.assignType, night.accommodation.occupancy, night.accommodation.adminMemo]),
        [1, '2026-11-01', '이전 숙소', 10, '2인1실', '2 хүн/өрөө', '늦은 체크인']);
    await h.reload();
    assert.equal(boardField(h, '상품 고객 1박 방수').props.value, 10);
    h.unmount();
});

test('시트 보기: 숙소지역은 계약 일정의 그날 지역을 불러오고 고객명은 대표 이름·패키지로 보여 준다', async () => {
    const quote = { ...bookingFixture('quote_booking'), leadName: '대표 고객', packagePlan: 'value', startDate: '2026-11-01', endDate: '2026-11-03',
        schedule: { source: 'quote', warnings: [], days: [
            { day: 1, date: '2026-11-01', title: '울란바타르 → 테를지 국립공원', region: '' },
            { day: 2, date: '2026-11-02', title: '엘승타사르해', region: '' },
            { day: 3, date: '2026-11-03', title: '귀국', region: '' }] } };
    quote.assignment.accommodations = [{ day: 1, date: '2026-11-01', accommodation: {} }, { day: 2, date: '2026-11-02', accommodation: { region: 'UB', location: 'UB' } }];
    const h = mount({ view: 'sheet-view', items: [quote] });
    await h.settle();
    const plan = () => text(boardNodes(h).find(n => n.props?.className === 'la-pkg'));
    assert.ok(boardNodes(h).some(n => n.type === 'b' && text(n) === '대표 고객'), '대표 이름');
    assert.equal(plan(), '실속패키지', '등급을 고르기 전에는 고객 선택');
    assert.equal(text(boardField(h, '대표 고객 1박 숙소지역')), 'Terelj', '저장된 지역이 없으면 계약 일정의 지역');
    assert.match(boardField(h, '대표 고객 1박 숙소지역').props.className, /is-planned/);
    assert.equal(text(boardField(h, '대표 고객 2박 숙소지역')), 'UB', '저장된 지역이 우선');
    assert.match(text(boardField(h, '대표 고객 1박 숙소정보')), /숙소 고르기/, '숙소가 없으면 숙소 고르기 칸');
    // 그 숙박일을 고치면 불러온 지역이 함께 저장된다.
    boardPick(h, '대표 고객 1박 등급', '고급 게르');
    assert.equal(plan(), '풀패키지', '배정한 등급으로 다시 판단');
    boardPick(h, '대표 고객 2박 등급', '일반 게르');
    assert.equal(plan(), '혼합');
    boardButton(h, '모두 저장').props.onClick(); await h.settle(); await h.settle();
    const saved = h.requests.filter(r => r.options.method === 'PATCH').at(-1).body.assignment.accommodations;
    assert.deepEqual(plain(saved.map(n => [n.day, n.accommodation.region || '', n.accommodation.type])), [[1, 'Terelj', '고급 게르'], [2, 'UB', '일반 게르']]);
    h.unmount();
});

test('시트의 패키지를 바로 저장하고 숙소 등급·미저장 편집과 별도로 다시 표시한다', async () => {
    const quote = { ...bookingFixture('quote_booking'), contractPackageType: 'value' };
    quote.assignment.accommodations[0].accommodation.type = '고급 게르';
    const h = mount({ view: 'sheet-view', items: [quote] });
    await h.settle();
    const plan = () => text(boardNodes(h).find(n => n.props?.className === 'la-pkg'));
    assert.equal(plan(), '실속패키지', '계약에서 고른 유형이 숙소 등급보다 우선');
    boardField(h, '견적 고객 1박 예약메모').props.onChange({ target: { value: '편집 중' } });
    boardPick(h, '견적 고객 계약 패키지 변경 · 실속', '풀패키지');
    await h.settle();
    const patches = () => h.requests.filter(r => r.options.method === 'PATCH');
    assert.deepEqual(plain(patches()[0].body.assignment), { contractPackageType: 'full' });
    assert.equal(plan(), '풀패키지');
    assert.equal(boardField(h, '견적 고객 1박 예약메모').props.value, '편집 중');
    assert.notEqual(h.server[0].assignment.accommodations[0].accommodation.adminMemo, '편집 중');
    boardButton(h, '모두 저장').props.onClick(); await h.settle();
    assert.equal(h.server[0].assignment.accommodations[0].accommodation.adminMemo, '편집 중');
    await h.reload();
    assert.equal(plan(), '풀패키지');
    boardPick(h, '견적 고객 계약 패키지 변경 · 풀패키지', '자동 표시');
    await h.settle();
    assert.equal(h.server[0].contractPackageType, '');
    assert.equal(plan(), '풀패키지', '해제하면 배정한 등급으로 돌아간다');
    h.unmount();
});

test('시트 보기: 숙박 행을 저장한 적 없는 예약도 계약 일정의 지역을 시트 지명으로 보여 주고 한 칸을 고치면 모든 숙박일 지역을 함께 저장한다', async () => {
    const quote = { ...bookingFixture('quote_booking'), startDate: '2026-11-01', endDate: '2026-11-03', accommodationsInitialized: false,
        schedule: { source: 'quote', warnings: [], days: [
            { day: 1, date: '2026-11-01', title: '울란바타르 → 테를지 국립공원', region: '' },
            { day: 2, date: '2026-11-02', title: '카라코룸', region: '' },
            { day: 3, date: '2026-11-03', title: '귀국', region: '' }] } };
    quote.assignment.accommodations = [];
    const h = mount({ view: 'sheet-view', items: [quote] });
    await h.settle();
    assert.deepEqual(plain([text(boardField(h, '견적 고객 1박 숙소지역')), text(boardField(h, '견적 고객 2박 숙소지역'))]), ['Terelj', 'Kharkhorin']);
    assert.match(boardField(h, '견적 고객 2박 숙소지역').props.className, /is-planned/);
    assert.equal(h.requests.filter(r => r.options.method === 'PATCH').length, 0, '보기만 해서는 저장하지 않는다');
    boardPick(h, '견적 고객 2박 배정 구분', '3인1실');
    boardButton(h, '모두 저장').props.onClick(); await h.settle(); await h.settle();
    const saved = h.requests.filter(r => r.options.method === 'PATCH').at(-1).body.assignment.accommodations;
    assert.deepEqual(plain(saved.map(n => [n.day, n.accommodation.region || '', n.accommodation.assignType || ''])), [[1, 'Terelj', ''], [2, 'Kharkhorin', '3인1실']]);
    h.unmount();
});

test('시트 보기: 숙소를 고르면 지역을 함께 넣고, 숙박 추가는 마지막 숙박 다음 날로 만들며 추가한 숙박만 지울 수 있다', async () => {
    const h = mount({ view: 'sheet-view', items: [bookingFixture('product')] });
    await h.settle();
    assert.equal(boardNodes(h).filter(n => n.props?.className === 'la-remove').length, 0, '계약 일정 숙박은 지울 수 없다');
    boardButton(h, '숙박 추가').props.onClick(); h.render();
    assert.equal(boardNodes(h).filter(n => n.props?.className === 'la-remove').length, 1, '추가한 숙박만 지울 수 있다');
    assert.ok(boardNodes(h).some(n => n.props?.className === 'la-date' && text(n).startsWith('11.02')), '마지막 숙박 다음 날');
    boardPick(h, '상품 고객 2박 숙소지역', '중앙몽골');
    boardPick(h, '상품 고객 2박 숙소정보', '등록 게르 / #?');
    assert.match(text(boardField(h, '상품 고객 2박 메일발송')), /발송전/);
    assert.match(text(boardField(h, '상품 고객 2박 예약상태')), /미정/);
    boardPick(h, '상품 고객 2박 메일발송', '2메일완료');
    boardField(h, '상품 고객 2박 메일발송일자').props.onChange({ target: { value: '2026-10-28' } });
    boardPick(h, '상품 고객 2박 예약상태', '변경요청');
    boardButton(h, '모두 저장').props.onClick(); await h.settle(); await h.settle();
    const saved = h.requests.filter(r => r.options.method === 'PATCH').at(-1).body.assignment.accommodations;
    assert.deepEqual(plain(saved.map(n => [n.day, n.date, n.accommodation.name || '', n.accommodation.region || '', n.accommodation.bookingStatus || ''])),
        [[1, '2026-11-01', '이전 숙소', '', 'Баталгаажсан'], [2, '2026-11-02', '등록 게르 / #?', '중앙몽골', '변경요청']]);
    assert.equal(saved[1].accommodation.mailStatus, '2메일완료');
    assert.equal(saved[1].accommodation.mailSentDate, '2026-10-28');
    h.unmount();
});

// ── 예전 카드 보기에서 검사하던 흐름을 표로 보기에서 검사한다(2026-11-23 카드 보기 삭제) ──
const PATCHES = h => h.requests.filter(call => call.options.method === 'PATCH');
const sheetDates = h => boardNodes(h).filter(n => n.props?.className === 'la-date').map(text);
const alerts = h => boardNodes(h).filter(n => ['alert', 'status'].includes(n.props?.role)).map(text);
const saveAllSheet = async h => { boardButton(h, '모두 저장').props.onClick(); await h.settle(); await h.settle(); };

test('표로 보기: 등록 숙소를 고르면 자동 채움만 하고 저장할 때 정확한 원본·버전으로 보내며 가이드·차량은 바꾸지 않는다', async () => {
    const h = mount(); await h.settle();
    assert.equal(h.resourceCalls.length, 1);
    assert.equal(h.resourceCalls[0][0].accountId, 'admin-fixture');
    const originalProduct = plain(h.server[0]);
    boardPick(h, '견적 고객 1박 숙소정보', '등록 게르 / #?');
    assert.equal(PATCHES(h).length, 0);
    h.flushDraft();
    const savedDraft = [...h.storage.values()].map(JSON.parse).find(value => value.scope?.source === 'quote_booking');
    assert.ok(savedDraft, '선택을 계정·원본별 초안으로 보관');
    assert.equal(savedDraft.scope.id, 'same / #?'); assert.equal(savedDraft.scope.userId, 'admin-fixture');
    assert.equal(savedDraft.baseVersion, 'a'.repeat(64));
    await saveAllSheet(h);
    const patch = PATCHES(h)[0];
    assert.equal(patch.url, '/api/admin/assignments/quote_booking/same%20%2F%20%23%3F');
    assert.equal(patch.options.credentials, 'same-origin'); assert.equal(patch.body.expectedVersion, 'a'.repeat(64));
    assert.equal(patch.body.assignment.guide.id, 'old-guide', '숙소 배정에서는 가이드를 바꾸지 않는다');
    assert.equal(patch.body.assignment.vehicle.type, '이전 차량', '숙소 배정에서는 차량을 바꾸지 않는다');
    const stay = patch.body.assignment.accommodations[0];
    assert.equal(stay.day, 1); assert.equal(stay.date, '2026-11-01');
    assert.equal(stay.accommodation.id, 'resource-lodge:등록 게르 / #?'); assert.equal(stay.accommodation.type, '고급게르');
    assert.deepEqual(stay.accommodation.images, []); assert.equal(stay.accommodation.description, '');
    assert.deepEqual(stay.accommodation.facilities, ['온수']); assert.equal(stay.accommodation.bookingStatus, 'Илгээгээгүй');
    assert.equal(stay.accommodation.roomCount, 2); assert.equal(stay.accommodation.occupancy, '2 хүн/өрөө');
    assert.deepEqual(h.server[0], originalProduct); assert.equal(h.storage.size, 0);
    await h.reload();
    assert.match(text(boardField(h, '견적 고객 1박 숙소정보')), /등록 게르/);
    h.unmount();
});

test('표로 보기: 저장 충돌은 고른 숙소와 계정별 초안을 남기고 기존 원본을 바꾸지 않는다', async () => {
    const h = mount({ failPatch: true }); await h.settle();
    const before = plain(h.server);
    boardPick(h, '견적 고객 1박 숙소정보', '등록 게르 / #?');
    await saveAllSheet(h);
    assert.deepEqual(h.server, before); assert.ok(text(h.tree).includes('다른 곳에서 예약이 변경되었습니다.'));
    assert.match(text(boardField(h, '견적 고객 1박 숙소정보')), /등록 게르/);
    assert.equal(h.storage.size, 1);
    assert.equal(JSON.parse([...h.storage.values()][0]).assignment.accommodations[0].accommodation.id, 'resource-lodge:등록 게르 / #?');
    h.unmount();
});

test('표로 보기: 숙소를 직접 입력하면 이전 숙소 정보만 지우고 객실·인원은 그대로 저장한다', async () => {
    const h = mount(); await h.settle();
    const originalQuote = plain(h.server[1]);
    const openManual = () => {
        boardField(h, '상품 고객 1박 숙소정보').props.onClick(fakeClick); h.render();
        const manual = boardNodes(h).find(n => n.type === 'button' && n.props?.className === 'la-pop-item is-manual');
        assert.ok(manual, '직접 입력'); manual.props.onClick(); h.render();
    };
    h.answerPrompt('이전 숙소'); openManual();
    h.flushDraft(); assert.equal(h.storage.size, 0, '같은 이름을 다시 넣으면 바꾸지 않는다');
    h.answerPrompt('새로 직접 작성한 숙소'); openManual();
    assert.equal(PATCHES(h).length, 0);
    await saveAllSheet(h);
    const patch = PATCHES(h)[0];
    assert.equal(patch.url, '/api/admin/assignments/product/same%20%2F%20%23%3F');
    const stay = patch.body.assignment.accommodations[0], acc = stay.accommodation;
    assert.equal(acc.name, '새로 직접 작성한 숙소'); assert.equal(acc.id, undefined);
    assert.deepEqual(acc.images, []); assert.equal(acc.description, ''); assert.deepEqual(acc.facilities, []);
    assert.equal(acc.address, ''); assert.deepEqual(acc.roomAmenities, []); assert.deepEqual(acc.sharedFacilities, []);
    assert.equal(acc.bookingStatus, 'Илгээгээгүй');
    assert.equal(stay.day, 1); assert.equal(stay.date, '2026-11-01');
    assert.equal(acc.roomCount, 2); assert.equal(acc.occupancy, '2 хүн/өрөө');
    assert.deepEqual(h.server[1], originalQuote);
    await h.reload();
    assert.match(text(boardField(h, '상품 고객 1박 숙소정보')), /새로 직접 작성한 숙소/);
    h.unmount();
});

test('표로 보기: 계약 일정의 2박 중 빠진 숙박일을 알리고 누락 숙박일 추가는 빈 숙박만 덧붙인다', async () => {
    const row = twoNightFixture(), before = plain(row.assignment.accommodations[0]);
    const h = mount({ items: [row] }); await h.settle();
    assert.ok(boardNodes(h).some(n => text(n) === '1 / 2박 배정'), '한 박만 확정되어도 필요한 2박 중 1박으로 센다');
    assert.ok(!boardNodes(h).some(n => text(n) === '모두 확정'), '누락 숙박일이 있으면 완료로 보이지 않는다');
    assert.deepEqual(sheetDates(h), ['11.01 (일)']);
    assert.ok(alerts(h).some(t => /2박 중 1개 일차의 숙박 행이 없습니다/.test(t)), '빠진 숙박일을 알린다');
    boardButton(h, '누락 숙박일 추가').props.onClick(); h.render();
    assert.deepEqual(sheetDates(h), ['11.01 (일)', '11.02 (월)']);
    assert.equal(PATCHES(h).length, 0);
    await saveAllSheet(h);
    const patch = PATCHES(h)[0];
    assert.deepEqual(Object.keys(patch.body).sort(), ['assignment', 'expectedVersion']);
    const stays = patch.body.assignment.accommodations;
    assert.deepEqual(stays[0], before, '기존 숙소·객실·인실·확정 상태를 보존');
    assert.equal(stays.length, 2); assert.equal(stays[1].day, 2); assert.equal(stays[1].date, '2026-11-02');
    assert.ok(!stays[1].accommodation.name, '일정의 숙소를 운영 배정으로 임의 확정하지 않음');
    h.unmount();
});

test('표로 보기: 숙박 날짜가 계약 일정과 다르면 먼저 알리고 여행 날짜에 맞추기에서만 바꾸며 수배 정보를 보존한다', async () => {
    const row = twoNightFixture('product', 'customer');
    row.assignment.accommodations[0].date = '2026-10-01';
    row.assignment.accommodations.push({ day: 2, date: '2026-11-02', accommodation: { ...plain(row.assignment.accommodations[0].accommodation), id: 'second-lodge', name: '둘째 밤 숙소', roomCount: 1 } });
    const h = mount({ items: [row] }); await h.settle();
    assert.deepEqual(sheetDates(h), ['10.01 (목)', '11.02 (월)'], '펼치기만 해서 기존 날짜를 고치지 않음');
    assert.ok(alerts(h).some(t => /날짜|불일치/.test(t)), '날짜 문제를 운영자가 확인할 수 있게 표시');
    assert.ok(!boardNodes(h).some(n => text(n) === '모두 저장'), '알리기만 하고 저장할 변경은 만들지 않는다');
    boardButton(h, '여행 날짜에 맞추기').props.onClick(); h.render();
    assert.deepEqual(sheetDates(h), ['11.01 (일)', '11.02 (월)']);
    assert.equal(PATCHES(h).length, 0);
    await saveAllSheet(h);
    const stays = PATCHES(h)[0].body.assignment.accommodations;
    assert.equal(stays[0].accommodation.id, 'old-lodge'); assert.equal(stays[0].accommodation.name, '이전 숙소');
    assert.deepEqual(stays[0].accommodation.images, ['/old-lodge.webp']);
    assert.equal(stays[0].accommodation.roomCount, 2); assert.equal(stays[0].accommodation.occupancy, '2 хүн/өрөө');
    assert.equal(stays[0].accommodation.bookingStatus, 'Илгээгээгүй', '변경된 숙박 날짜는 다시 수배해야 함');
    assert.equal(stays[1].accommodation.bookingStatus, 'Баталгаажсан', '날짜가 맞는 행의 수배 상태는 보존');
    h.unmount();
});

test('표로 보기: 명시적으로 비운 고객 일정과 저장된 빈 숙소 배열은 펼치거나 새로고침해도 자동 복구하지 않는다', async () => {
    const row = twoNightFixture('product', 'customer');
    row.schedule.days = []; row.assignment.accommodations = []; row.accommodationsInitialized = true;
    const h = mount({ items: [row] }); await h.settle();
    assert.equal(sheetDates(h).length, 0);
    assert.ok(text(boardNodes(h).find(n => n.props?.className === 'la-none')).includes('숙박이 아직 없습니다'));
    h.flushDraft(); assert.equal(h.storage.size, 0);
    await h.reload();
    assert.equal(sheetDates(h).length, 0);
    assert.deepEqual(h.server[0].schedule.days, []); assert.deepEqual(h.server[0].assignment.accommodations, []);
    assert.equal(PATCHES(h).length, 0);
    h.unmount();
});

test('표로 보기: 보관된 초안을 고르기 전에도 계약 일정의 숙박일을 잠긴 채 보여 주고 버리면 수정할 수 있다', async () => {
    const row = twoNightFixture();
    row.assignment.accommodations = []; row.accommodationsInitialized = true;
    const h = mount({ items: [row] }); await h.settle();
    boardPick(h, '견적 고객 1박 숙소지역', '중앙몽골'); h.flushDraft();
    assert.equal(h.storage.size, 1);
    await h.reload();
    assert.equal(boardField(h, '견적 고객 1박 숙소지역').props.disabled, true, '초안을 고르기 전에는 잠긴다');
    assert.deepEqual(sheetDates(h), ['11.01 (일)', '11.02 (월)']);
    assert.ok(alerts(h).some(t => t.includes('보관된 초안이 있어 잠겨 있어요')));
    boardButton(h, '버리기').props.onClick(); h.render();
    assert.equal(boardField(h, '견적 고객 1박 숙소지역').props.disabled, false);
    assert.deepEqual(sheetDates(h), ['11.01 (일)', '11.02 (월)']);
    assert.ok(!alerts(h).some(t => t.includes('보관된 초안이 있어 잠겨 있어요')));
    h.unmount();
});

test('표로 보기: 변경 취소는 편집과 브라우저 초안을 버리고 서버 배정으로 되돌리며 저장 요청을 보내지 않는다', async () => {
    const h = mount({ items: [twoNightFixture()] }); await h.settle();
    assert.ok(!boardNodes(h).some(n => isButton(n) && text(n) === '변경 취소'), '변경 전에는 취소 버튼이 없다');
    const memo = () => boardField(h, '견적 고객 1박 예약메모');
    memo().props.onChange({ target: { value: '임시 메모' } }); h.render();
    boardButton(h, '누락 숙박일 추가').props.onClick(); h.render();
    h.flushDraft(); assert.equal(h.storage.size, 1, '편집 내용은 초안으로 보관');
    boardButton(h, '변경 취소').props.onClick(); await h.settle(); // 공통 확인 창의 답을 기다린 뒤 되돌린다
    assert.equal(memo().props.value, '');
    assert.equal(sheetDates(h).length, 1);
    assert.equal(h.storage.size, 0, '초안도 함께 지운다');
    h.flushDraft(); assert.equal(h.storage.size, 0);
    assert.equal(PATCHES(h).length, 0);
    memo().props.onChange({ target: { value: '저장한 메모' } }); h.render();
    await saveAllSheet(h);
    memo().props.onChange({ target: { value: '또 바꾼 메모' } }); h.render();
    boardButton(h, '변경 취소').props.onClick(); await h.settle();
    assert.equal(memo().props.value, '저장한 메모', '저장 뒤에는 저장한 값으로 되돌린다');
    h.unmount();
});

test('표로 보기: 일정 원본을 불러오지 못하면 저장된 숙소는 보여 주되 날짜 맞추기와 누락일 생성은 하지 않는다', async () => {
    const row = twoNightFixture('product', 'unavailable');
    row.schedule.days = []; row.schedule.warnings = ['고객 일정 원본 확인 필요'];
    row.assignment.accommodations[0].date = '2026-10-31';
    const h = mount({ items: [row] }); await h.settle();
    assert.ok(!boardNodes(h).some(n => text(n) === '모두 확정'), '원본 불명확한 예약을 배정 완료로 표시하지 않음');
    assert.ok(alerts(h).some(t => t.includes('고객 일정 원본 확인 필요')));
    assert.deepEqual(sheetDates(h), ['10.31 (토)']);
    for (const label of ['여행 날짜에 맞추기', '누락 숙박일 추가']) {
        const button = boardNodes(h).find(n => isButton(n) && text(n).includes(label));
        assert.ok(!button || button.props.disabled, label);
    }
    h.flushDraft(); assert.equal(h.storage.size, 0);
    assert.equal(PATCHES(h).length, 0);
    assert.deepEqual(h.server[0], row);
    h.unmount();
});

test('표로 보기: 당일 투어와 여행 기간이 없는 예약은 잘못된 0박 확정으로 표시하지 않는다', async () => {
    const dayTrip = twoNightFixture('product', 'customer');
    dayTrip.endDate = dayTrip.startDate;
    dayTrip.schedule.days = dayTrip.schedule.days.slice(0, 1);
    dayTrip.assignment.accommodations = [];
    const h = mount({ items: [dayTrip] }); await h.settle();
    assert.ok(boardNodes(h).some(n => text(n) === '숙박 없음'));
    assert.ok(!boardNodes(h).some(n => /0 \/ 0/.test(text(n))));
    assert.ok(text(boardNodes(h).find(n => n.props?.className === 'la-none')).includes('당일 여행으로 숙박 배정이 필요하지 않습니다.'));
    assert.equal(sheetDates(h).length, 0);
    h.unmount();

    const unknown = bookingFixture('product');
    unknown.startDate = ''; unknown.endDate = '';
    const pending = mount({ items: [unknown] }); await pending.settle();
    assert.ok(boardNodes(pending).some(n => text(n) === '필요 숙박일 확인'));
    assert.ok(!boardNodes(pending).some(n => text(n) === '모두 확정'));
    assert.ok(alerts(pending).some(t => t.includes('여행 기간을 확인하면 필요한 숙박일을 계산할 수 있습니다.')));
    const align = boardNodes(pending).find(n => isButton(n) && text(n).includes('여행 날짜에 맞추기'));
    assert.ok(align); assert.equal(align.props.disabled, true);
    assert.deepEqual(sheetDates(pending), ['11.01 (일)'], '저장된 수배 날짜는 유지');
    pending.unmount();
});

test('예약 상세의 ?open= 링크는 표로 보기에서 그 예약만 펼쳐 강조하고, 예약 정보 창에서 여행자·항공을 본다', async () => {
    const product = bookingFixture('product');
    product.contractData = { ...product.contractData, arrival: { date: '2026-11-01', time: '09:10', flight: 'OM302' },
        travelers: [{ name: '상품 여행자', passportName: 'TRAVELER ONE', birthdate: '1990-01-01', gender: '여성', phone: '010-1234-5678' }] };
    const h = mount({ items: [product, bookingFixture('quote_booking')], view: 'board-view', search: '?open=same / #?&source=product' });
    await h.settle();
    const el = boardEl(h);
    assert.equal(el.props.focus.id, 'product:same / #?', '표로 보기로 열고 그 예약을 고른다');
    h.render(); const first = nodes(boardEl(h).type(boardEl(h).props));
    h.render(); const opened = nodes(boardEl(h).type(boardEl(h).props));
    assert.ok(first.length || true);
    assert.ok(opened.some(n => n.props?.['aria-label'] === '상품 고객 1박 숙소정보'), '링크로 연 예약은 펼친다');
    assert.ok(!opened.some(n => n.props?.['aria-label'] === '견적 고객 1박 숙소정보'), '다른 예약은 접힌 채로 둔다');
    assert.ok(opened.some(n => n.props?.id === 'acc-row-product:same / #?' && /is-focus/.test(n.props.className)), '링크로 연 예약을 강조한다');
    boardField(h, '상품 고객 예약 정보 보기').props.onClick(fakeClick);
    const info = boardNodes(h).find(n => n.props?.className === 'la-trav');
    assert.ok(info, '예약 정보 창의 여행자 · 항공');
    for (const value of ['2026-11-01 · 09:10 · OM302', '여행자 1명', '상품 여행자', 'TRAVELER ONE', '1990-01-01 · 여', '010-1234-5678']) assert.ok(text(info).includes(value), value);
    assert.ok(!boardNodes(h).some(n => n.type === 'button' && text(n).includes('카드 보기')), '카드 보기는 없앴다');
    h.unmount();
});
