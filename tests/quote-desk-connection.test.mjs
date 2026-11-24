import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// Bundle the real connection and URL helpers. Only the HTTP adapter is replaced:
// delayed responses deliberately ignore abort to exercise the post-await guard.
const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/components/admin/quoteDesk.ts', import.meta.url))],
    bundle: true, format: 'cjs', platform: 'node', write: false,
    plugins: [{ name: 'local-quote-desk-api', setup(builder) {
        builder.onResolve({ filter: /\/lib\/api$/ }, () => ({ path: 'api', namespace: 'quote-desk-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'quote-desk-test' }, () => ({ loader: 'js',
            contents: 'export const api = {auth: {quoteDesk: signal => globalThis.__quoteDeskApi(signal)}};' }));
    } }],
});

function setup() {
    const pending = [], session = new Map(), local = new Map(), writes = [];
    const storage = (values, track = false) => ({
        getItem: key => values.get(key) ?? null,
        setItem(key, value) { values.set(key, value); if (track) writes.push({ key, value }); },
        removeItem: key => values.delete(key),
    });
    const window = { innerWidth: 1280, screen: { width: 1920 },
        sessionStorage: storage(session, true), localStorage: storage(local) };
    const module = { exports: {} };
    const context = vm.createContext({ window, module, exports: module.exports,
        __quoteDeskApi: signal => new Promise((resolve, reject) => pending.push({ signal, resolve, reject })) });
    vm.runInContext(bundle.outputFiles[0].text, context);
    return { ...module.exports, pending, session, local, writes, window };
}
const response = (userId, token = 'local-fixture-connection') => ({ userId, token });

test('확인된 현재 관리자 연결만 sessionStorage에 저장하고 AbortSignal을 API에 전달한다', async () => {
    const app = setup(), controller = new AbortController();
    const request = app.connectQuoteDesk({ accountId: 'admin-a', signal: controller.signal, isCurrent: () => true });
    assert.equal(app.pending[0].signal, controller.signal);
    assert.equal(app.writes.length, 0);
    app.pending[0].resolve(response('admin-a'));
    assert.equal(await request, 'local-fixture-connection');
    assert.equal(app.session.get('leaders_admin_token'), 'local-fixture-connection');
    assert.equal(app.writes.length, 1);
});

test('로그아웃 뒤 늦은 연결 응답은 관리자 값과 고객 전달값을 다시 저장하지 않는다', async () => {
    const app = setup();
    app.session.set('leaders_admin_token', 'old-local-connection');
    app.local.set('leaders_prefill', '{"id":"request-a"}');
    app.local.set('leaders_booking_prefill', '{"id":"request-b"}');
    app.local.set('inhasu:quote-editor:v1:admin-a:quote:request-a', 'recoverable draft');
    const request = app.connectQuoteDesk({ accountId: 'admin-a' });
    app.disconnectQuoteDesk();
    app.pending[0].resolve(response('admin-a', 'late-local-connection'));
    assert.equal(await request, null);
    assert.equal(app.session.has('leaders_admin_token'), false);
    assert.equal(app.local.has('leaders_prefill'), false);
    assert.equal(app.local.has('leaders_booking_prefill'), false);
    assert.equal(app.local.get('inhasu:quote-editor:v1:admin-a:quote:request-a'), 'recoverable draft');
    assert.equal(app.writes.length, 0);
});

test('취소된 API가 응답을 반환해도 연결값을 저장하지 않는다', async () => {
    const app = setup(), controller = new AbortController();
    const request = app.connectQuoteDesk({ accountId: 'admin-a', signal: controller.signal });
    controller.abort();
    app.pending[0].resolve(response('admin-a'));
    assert.equal(await request, null);
    assert.equal(app.writes.length, 0); assert.equal(app.session.size, 0);
});

test('동일 계정의 이전 화면이 종료됐으면 늦은 연결 응답을 보관하지 않는다', async () => {
    const app = setup(); let current = true;
    const request = app.connectQuoteDesk({ accountId: 'admin-a', isCurrent: () => current });
    current = false;
    app.pending[0].resolve(response('admin-a'));
    assert.equal(await request, null);
    assert.equal(app.writes.length, 0);
});

test('다른 관리자 연결 후 이전 계정 응답이 도착해도 현재 계정 연결값을 유지한다', async () => {
    const app = setup();
    const oldRequest = app.connectQuoteDesk({ accountId: 'admin-a' });
    const currentRequest = app.connectQuoteDesk({ accountId: 'admin-b' });
    app.pending[1].resolve(response('admin-b', 'current-local-connection'));
    assert.equal(await currentRequest, 'current-local-connection');
    app.pending[0].resolve(response('admin-a', 'old-local-connection'));
    assert.equal(await oldRequest, null);
    assert.equal(app.session.get('leaders_admin_token'), 'current-local-connection');
    assert.equal(app.writes.length, 1);
});

test('서버에서 확인한 계정이 요청한 관리자와 다르면 연결을 거절한다', async () => {
    const app = setup();
    const request = app.connectQuoteDesk({ accountId: 'admin-a' });
    app.pending[0].resolve(response('admin-b'));
    await assert.rejects(request, /현재 관리자 계정/);
    assert.equal(app.writes.length, 0); assert.equal(app.session.size, 0);
});

test('견적 도구는 모두 React 화면이라 옛 문서를 iframe으로 여는 주소 도우미가 없다', () => {
    const app = setup();
    for (const name of ['quoteDeskFrameSrc', 'quoteDeskToolForPath', 'normalizeDocPath']) assert.equal(app[name], undefined, name);
    const desk = fs.readFileSync(new URL('../src/pages/AdminQuoteDesk.tsx', import.meta.url), 'utf8');
    assert.doesNotMatch(desk, /<iframe|contentWindow|postMessage/, '고객 통합 작업 화면은 iframe을 쓰지 않는다');
});

test('가이드·숙소·차량 메뉴의 첫 화면은 가이드 배정 현황이고, 등록 정보는 view=registry나 종류 지정 링크로 연다', () => {
    const app = setup(), view = search => app.resourceScheduleView(new URLSearchParams(search));
    assert.equal(view(''), true);
    assert.equal(view('?view=schedule'), true);
    assert.equal(view('?view=registry'), false);
    assert.equal(view('?resourceType=lodges'), false);
    assert.equal(view('?resourceType=lodges&view=schedule'), true);
    assert.equal(view('?resourceType=unknown'), true);
});
