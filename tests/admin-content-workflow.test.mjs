import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

// Exercise the shipped component event handlers with deterministic hooks. The
// HTTP/upload adapters are deferred; no DOM, browser or external service is used.
const result = await build({ stdin: { contents: `
    export { AdminBannerManage } from './src/pages/AdminBannerManage';
    export { AdminCategoryManage, CategoryModal } from './src/pages/AdminCategoryManage';
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
    plugins: [{ name: 'content-event-fixture', setup(builder) {
        builder.onResolve({ filter: /^react$|^react\/jsx-runtime$|^react-router-dom$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        builder.onResolve({ filter: /\/(AdminLayout|Icon|api|upload)$/ }, args => ({ path: args.path.split('/').at(-1), namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents:
            path === 'react' ? `export const useState=(...a)=>globalThis.h.useState(...a),useRef=(...a)=>globalThis.h.useRef(...a),useEffect=(...a)=>globalThis.h.useEffect(...a),useCallback=(...a)=>globalThis.h.useCallback(...a);export default {useState,useRef,useEffect,useCallback};`
            : path === 'react/jsx-runtime' ? `export const Fragment='fragment';export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;`
            : path === 'react-router-dom' ? `export const useBlocker=predicate=>{globalThis.h.predicate=predicate;return globalThis.h.blocker};`
            : path === 'AdminLayout' ? `export const AdminLayout='layout';`
            : path === 'Icon' ? `export const Icon='icon';`
            : path === 'api' ? `export const api=new Proxy({}, {get:(_,key)=>globalThis.adapters.api[key]});`
            : `export const uploadImage=(...args)=>globalThis.adapters.upload(...args);` }));
    } }],
});
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const tick = () => new Promise(setImmediate);
const nodes = root => !root || typeof root !== 'object' ? [] : Array.isArray(root) ? root.flatMap(nodes) : [root, ...nodes(root.props?.children)];
const find = (root, predicate) => { const node = nodes(root).find(predicate); assert.ok(node, 'requested control is rendered'); return node; };
const event = () => ({ preventDefault() {} });
const initialBanner = () => ({ banners: [
    { id: 'a', image: '/img/a.webp', title: '첫 배너', subtitle: '', tag: '' },
    { id: 'b', image: '/img/b.webp', title: '둘째 배너', subtitle: '', tag: '' },
], quickLinks: [], eventBanners: [], categoryTabs: [] });
function setup(adapters) {
    const listeners = new Map(), module = { exports: {} };
    const context = vm.createContext({ module, exports: module.exports, adapters, structuredClone,
        setTimeout: () => 1, window: { confirm: () => false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) },
        confirm: (...args) => context.window.confirm(...args), alert: () => {} });
    vm.runInContext(result.outputFiles[0].text, context);
    function mount(Component, props = {}) {
        const values = [], memo = []; let cursor = 0, effects = [];
        const harness = { predicate: null, blocker: { state: 'unblocked' }, tree: null,
            useState(initial) { const key = cursor++; if (!(key in values)) values[key] = typeof initial === 'function' ? initial() : initial;
                return [values[key], change => { values[key] = typeof change === 'function' ? change(values[key]) : change; }]; },
            useRef(initial) { const key = cursor++; if (!(key in values)) values[key] = { current: initial }; return values[key]; },
            useCallback(fn, deps) { const key = cursor++; if (!memo[key] || deps.some((value, i) => value !== memo[key].deps[i])) memo[key] = { deps, fn }; return memo[key].fn; },
            useEffect(fn, deps) { const key = cursor++, old = memo[key];
                if (!old || !deps || deps.some((value, i) => value !== old.deps?.[i])) { memo[key] = { deps, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); memo[key].cleanup = fn(); }); } },
            render() { cursor = 0; effects = []; context.h = harness; harness.tree = Component(props); effects.forEach(run => run()); return harness.tree; },
            unmount() { memo.forEach(entry => entry?.cleanup?.()); },
        };
        harness.render(); return harness;
    }
    return { ...module.exports, context, listeners, mount };
}
const readBusy = h => h.predicate({ currentLocation: { pathname: '/admin/current', search: '' }, nextLocation: { pathname: '/admin/elsewhere', search: '' } });

test('실제 배너 업로드·저장 handler는 동기 잠금과 최신 상태 병합으로 입력·사진을 보존한다', async () => {
    const upload = deferred(), save = deferred(); let uploads = 0, saves = 0, sent;
    const app = setup({ api: { banners: { get: async () => initialBanner(), save: data => { saves++; sent = structuredClone(data); return save.promise; } } },
        upload: () => { uploads++; return upload.promise; } });
    const h = app.mount(app.AdminBannerManage); await tick(); h.render();
    find(h.tree, n => n.props?.title === '모바일 이미지 변경').props.onClick(); h.render();
    const fileInput = find(h.tree, n => n.type === 'input' && n.props.type === 'file');
    const request = fileInput.props.onChange({ target: { files: [{ name: 'new.jpg' }], value: 'new.jpg' } });
    assert.equal(uploads, 1); assert.equal(readBusy(h), true);
    await fileInput.props.onChange({ target: { files: [{ name: 'duplicate.jpg' }], value: '' } });
    assert.equal(uploads, 1); h.render();
    assert.equal(find(h.tree, n => n.type === 'fieldset').props.disabled, true);
    await h.tree.props.actions.props.onClick(); assert.equal(saves, 0);
    // Defensive late merge: an intervening state update must survive as well.
    find(h.tree, n => n.type === 'textarea' && n.props.value === '첫 배너').props.onChange({ target: { value: '업로드 중 최신 문구' } });
    upload.resolve('/img/new.webp'); await request; h.render();
    assert.ok(nodes(h.tree).some(n => n.props?.value === '업로드 중 최신 문구'));
    const firstSave = h.tree.props.actions.props.onClick();
    await h.tree.props.actions.props.onClick(); assert.equal(saves, 1);
    assert.equal(sent.banners[0].image, '/img/new.webp'); assert.equal(sent.banners[0].title, '업로드 중 최신 문구');
    save.reject(new Error('로컬 저장 실패')); await firstSave; h.render();
    assert.ok(nodes(h.tree).some(n => n.props?.role === 'alert'));
    assert.equal(readBusy(h), true, 'failed save leaves dirty navigation protection');
    app.context.adapters.api.banners.save = async () => { saves++; };
    await h.tree.props.actions.props.onClick(); h.render(); assert.equal(readBusy(h), false);
});

test('메인 배너 순서가 저장 payload에 반영되고 업로드 실패 시 기존 사진을 유지한다', async () => {
    let sent;
    const app = setup({ api: { banners: { get: async () => initialBanner(), save: async data => { sent = structuredClone(data); } } }, upload: async () => { throw new Error('로컬 업로드 실패'); } });
    const h = app.mount(app.AdminBannerManage); await tick(); h.render();
    find(h.tree, n => n.props?.['aria-label'] === '메인 배너 아래로').props.onClick(); h.render();
    find(h.tree, n => n.props?.title === '모바일 이미지 변경').props.onClick(); h.render();
    await find(h.tree, n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [{ name: 'fail.jpg' }], value: '' } });
    h.render(); await h.tree.props.actions.props.onClick();
    assert.deepEqual(Array.from(sent.banners, row => row.id), ['b', 'a']); assert.equal(sent.banners[0].image, '/img/b.webp');
});

test('배너 읽기 실패에는 빈 자료를 저장하지 못하며 다시 읽은 뒤 편집한다', async () => {
    let saves = 0;
    const app = setup({ api: { banners: { get: async () => { throw new Error('read failed'); }, save: async () => { saves++; } } } });
    const h = app.mount(app.AdminBannerManage); await tick(); h.render();
    assert.equal(find(h.tree, n => n.type === 'fieldset').props.disabled, true);
    await h.tree.props.actions.props.onClick(); assert.equal(saves, 0);
    app.context.adapters.api.banners.get = async () => initialBanner();
    find(h.tree, n => n.type === 'button' && n.props.children === '다시 불러오기').props.onClick(); h.render(); await tick(); h.render();
    assert.equal(find(h.tree, n => n.type === 'fieldset').props.disabled, false);
});

test('카테고리 모달은 실제 저장 성공 후에만 닫고 실패하면 최신 입력과 업로드 사진을 유지한다', async () => {
    let closes = 0, calls = 0, sent; const first = deferred();
    const app = setup({ upload: async () => '/img/new-icon.webp' });
    const props = { category: { id: 'central', name: '중앙몽골', icon: 'landscape', description: '', isActive: true, order: 0 }, type: 'product',
        onClose: () => { closes++; }, onSave: value => { calls++; sent = structuredClone(value); return first.promise; } };
    const h = app.mount(app.CategoryModal, props);
    find(h.tree, n => n.type === 'input' && n.props.value === '중앙몽골').props.onChange({ target: { value: '수정한 카테고리' } }); h.render();
    await find(h.tree, n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [{ name: 'icon.jpg' }], value: '' } });
    await tick(); h.render();
    const form = find(h.tree, n => n.type === 'form'), request = form.props.onSubmit(event());
    await form.props.onSubmit(event()); assert.equal(calls, 1); assert.equal(closes, 0);
    h.tree.props.onClick(); assert.equal(closes, 0, 'busy scrim cannot close');
    assert.equal(sent.name, '수정한 카테고리'); assert.equal(sent.icon, '/img/new-icon.webp');
    first.reject(new Error('로컬 저장 실패')); await request; h.render();
    assert.equal(closes, 0); assert.ok(nodes(h.tree).some(n => n.props?.value === '수정한 카테고리'));
    assert.ok(nodes(h.tree).some(n => n.props?.src === '/img/new-icon.webp'));
    props.onSave = async () => true; h.render(); await find(h.tree, n => n.type === 'form').props.onSubmit(event()); assert.equal(closes, 1);
});

test('카테고리 업로드 중 저장·닫기·중복 업로드가 차단되고 실패 입력은 남는다', async () => {
    const upload = deferred(); let uploads = 0, saves = 0, closes = 0, editorState;
    const app = setup({ upload: () => { uploads++; return upload.promise; } });
    const h = app.mount(app.CategoryModal, { category: null, type: 'product', onClose: () => { closes++; },
        onSave: async () => { saves++; return true; }, onEditorState: state => { editorState = state; } });
    find(h.tree, n => n.type === 'input' && n.props.placeholder === '예: 서부몽골').props.onChange({ target: { value: '서부몽골' } }); h.render();
    const input = find(h.tree, n => n.type === 'input' && n.props.type === 'file');
    input.props.onChange({ target: { files: [{ name: 'first.jpg' }], value: '' } });
    input.props.onChange({ target: { files: [{ name: 'second.jpg' }], value: '' } });
    assert.equal(uploads, 1); assert.equal(editorState.busy, true);
    await find(h.tree, n => n.type === 'form').props.onSubmit(event()); h.tree.props.onClick();
    assert.equal(saves, 0); assert.equal(closes, 0);
    upload.reject(new Error('로컬 업로드 실패')); await tick(); h.render();
    assert.equal(editorState.busy, false); assert.equal(editorState.dirty, true);
    assert.ok(nodes(h.tree).some(n => n.props?.value === '서부몽골'));
});

test('카테고리 순서 버튼의 연속 클릭은 실제 reorder 요청 하나만 만들고 실패 순서를 유지한다', async () => {
    const update = deferred(); let calls = 0;
    const categories = [{ id: 'central', name: '중앙', icon: 'category', sort_order: 0, is_active: 1, type: 'product' }, { id: 'gobi', name: '고비', icon: 'category', sort_order: 1, is_active: 1, type: 'product' }];
    const app = setup({ api: { categories: { list: async () => categories, reorder: () => { calls++; return update.promise; } } } });
    const h = app.mount(app.AdminCategoryManage); await tick(); h.render();
    const down = nodes(h.tree).filter(n => n.type === 'button' && nodes(n).some(child => child.props?.name === 'arrow_downward'))[0];
    const first = down.props.onClick(); await down.props.onClick(); assert.equal(calls, 1); assert.equal(readBusy(h), true);
    update.reject(new Error('로컬 순서 저장 실패')); await first; h.render();
    assert.equal(readBusy(h), false); assert.ok(nodes(h.tree).some(n => n.props?.role === 'alert'));
    const names = nodes(h.tree).filter(n => n.type === 'td' && n.props.className === 'cell-strong').map(n => n.props.children);
    assert.deepEqual(names, ['중앙', '고비']);
});

test('카테고리 히어로 다중 업로드는 중간 실패 후 멈추며 성공한 사진과 저장 가능 상태를 유지한다', async () => {
    const first = deferred(), second = deferred(); let calls = 0, saved, editorState;
    const app = setup({ upload: () => { calls++; return calls === 1 ? first.promise : second.promise; } });
    const modal = app.mount(app.CategoryModal, { category: { id: 'central', name: '중앙', icon: 'landscape', landing_hero_images: [] }, type: 'product',
        onClose() {}, onSave: async value => { saved = structuredClone(value); return true; }, onEditorState: value => { editorState = value; } });
    const landingNode = find(modal.tree, n => n.props?.formData && n.props.uploadImageTo);
    const landing = app.mount(landingNode.type, landingNode.props);
    find(landing.tree, n => n.type === 'button' && n.props.className === 'edit-sec-head').props.onClick(); landing.render();
    const heroNode = find(landing.tree, n => Array.isArray(n.props?.images) && n.props.uploadImageTo);
    const hero = app.mount(heroNode.type, heroNode.props);
    find(hero.tree, n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [{ name: 'one.jpg' }, { name: 'two.jpg' }, { name: 'three.jpg' }], value: '' } });
    assert.equal(editorState.busy, true); first.resolve('/img/success.webp'); await tick(); assert.equal(calls, 2);
    second.reject(new Error('로컬 두 번째 업로드 실패')); await tick();
    assert.equal(calls, 2); assert.equal(editorState.busy, false);
    modal.render(); await find(modal.tree, n => n.type === 'form').props.onSubmit(event());
    assert.deepEqual(Array.from(saved.landing_hero_images), ['/img/success.webp']);
    assert.equal(saved.landing_hero_image, '/img/success.webp');
});

test('닫힌 배너 편집기의 늦은 업로드는 다시 열린 새 화면을 변경하지 않는다', async () => {
    const upload = deferred();
    const app = setup({ api: { banners: { get: async () => initialBanner() } }, upload: () => upload.promise });
    const previous = app.mount(app.AdminBannerManage); await tick(); previous.render();
    find(previous.tree, n => n.props?.title === '모바일 이미지 변경').props.onClick(); previous.render();
    const request = find(previous.tree, n => n.type === 'input' && n.props.type === 'file').props.onChange({ target: { files: [{ name: 'late.jpg' }], value: '' } });
    previous.unmount();
    const current = app.mount(app.AdminBannerManage); await tick(); current.render();
    upload.resolve('/img/late.webp'); await request; current.render();
    assert.equal(readBusy(current), false);
    assert.ok(!nodes(current.tree).some(n => String(n.props?.style?.backgroundImage || '').includes('/img/late.webp')));
});

test('실제 이동 guard는 미저장 배너의 Back·메뉴 이동과 새로고침을 확인한다', async () => {
    const app = setup({ api: { banners: { get: async () => initialBanner() } } });
    const h = app.mount(app.AdminBannerManage); await tick(); h.render();
    find(h.tree, n => n.type === 'textarea' && n.props.value === '첫 배너').props.onChange({ target: { value: '미저장' } });
    assert.equal(readBusy(h), true);
    let prevented = 0; app.listeners.get('beforeunload')({ preventDefault() { prevented++; } }); assert.equal(prevented, 1);
    let resets = 0, proceeds = 0;
    h.blocker = { state: 'blocked', location: { key: 'back-1' }, reset() { resets++; }, proceed() { proceeds++; } };
    h.render(); assert.equal(resets, 1); assert.equal(proceeds, 0);
    app.context.window.confirm = () => true;
    h.blocker = { ...h.blocker, location: { key: 'menu-2' } }; h.render(); assert.equal(proceeds, 1);
});
