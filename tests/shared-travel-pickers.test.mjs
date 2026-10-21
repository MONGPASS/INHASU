import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const names = ['HotelPickerModal', 'TouristSpotPickerModal'];
const bundles = await Promise.all(names.map(async name => {
    const result = await build({ entryPoints: [fileURLToPath(new URL(`../src/components/admin/${name}.tsx`, import.meta.url))], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
        plugins: [{ name: 'shared-picker-events', setup(builder) {
            builder.onResolve({ filter: /^react$|^react\/jsx-runtime$/ }, args => ({ path: args.path, namespace: 'shared-picker-test' }));
            builder.onResolve({ filter: /\/lib\/api$/ }, () => ({ path: 'api', namespace: 'shared-picker-test' }));
            builder.onLoad({ filter: /.*/, namespace: 'shared-picker-test' }, ({ path }) => ({ loader: 'js', contents: path === 'api' ? 'export const api=globalThis.api;'
                : path === 'react' ? 'export const useState=(...args)=>globalThis.h.useState(...args),useEffect=(...args)=>globalThis.h.useEffect(...args),useMemo=(...args)=>globalThis.h.useMemo(...args);'
                : 'export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;' }));
        } }],
    });
    return result.outputFiles[0].text;
}));
const nodes = root => !root || typeof root !== 'object' ? [] : Array.isArray(root) ? root.flatMap(nodes) : [root, ...nodes(root.props?.children)];
const text = root => typeof root === 'string' || typeof root === 'number' ? String(root) : Array.isArray(root) ? root.map(text).join('') : text(root?.props?.children ?? '');
const rows = h => nodes(h.tree).filter(node => node.type === 'tr' && node.props.onClick);
const tick = () => new Promise(setImmediate);
const pending = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function mount(name, list, props = {}) {
    const module = { exports: {} }, calls = [];
    const fetchList = (...args) => { calls.push(args); return list(...args); };
    const context = vm.createContext({ module, exports: module.exports, AbortController, console, api: { hotels: { list: fetchList }, touristSpots: { list: fetchList } } });
    vm.runInContext(bundles[names.indexOf(name)], context);
    const values = [], effects = new Map(); let cursor = 0, pendingEffects = [];
    const h = { props: { open: true, onClose() {}, onPick() {}, ...props }, tree: null, calls,
        useState(initial) { const key = cursor++; if (!(key in values)) values[key] = typeof initial === 'function' ? initial() : initial; return [values[key], change => { values[key] = typeof change === 'function' ? change(values[key]) : change; }]; },
        useMemo(fn) { cursor++; return fn(); },
        useEffect(fn, deps) { const key = cursor++, before = effects.get(key); if (!before || deps.some((item, index) => item !== before.deps[index])) pendingEffects.push(() => { before?.cleanup?.(); effects.set(key, { deps, cleanup: fn() }); }); },
        render() { cursor = 0; pendingEffects = []; context.h = h; h.tree = module.exports[name](h.props); pendingEffects.forEach(run => run()); return h.tree; },
    };
    h.render(); return h;
}

test('상품·문서 숙소 선택은 공통 숙소 목록을 읽고 저장 전에는 선택 결과만 반환한다', async () => {
    const selected = { id: 'resource-lodge:같은 이름 / #?', name_kr: '등록 게르', images: [], description: '', amenities: ['온수'] }, picks = [];
    const h = mount('HotelPickerModal', async () => [selected], { onPick: value => picks.push(value) });
    await tick(); h.render();
    assert.equal(h.calls.length, 1); assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0][0])), { source: 'resources', active: true });
    assert.equal(h.calls[0][1].cache, 'no-store'); assert.equal(h.calls[0][1].signal.aborted, false);
    assert.equal(picks.length, 0); assert.equal(rows(h).length, 1);
    rows(h)[0].props.onClick(); assert.equal(picks[0], selected); assert.equal(picks[0].id, selected.id);
    assert.deepEqual(selected.images, []); assert.equal(selected.description, '');
    h.props.open = false; h.render(); assert.equal(h.calls[0][1].signal.aborted, true);
});

test('여행지 관리의 새 지역·기존 영문 분류·미분류를 같은 선택기에서 찾고 정확한 명소를 반환한다', async () => {
    const spots = [
        { id: 'quote-spot:산악 / #?', name_kr: '산악', region: '새 북부지역', images: ['/mountain.webp'], description: '저장 설명' },
        { id: 'quote-spot:구 분류', name_kr: '구 분류', region: 'central', images: [] },
        { id: 'quote-spot:한글 분류', name_kr: '한글 분류', region: '중앙몽골', images: [] },
        { id: 'quote-spot:미분류', name_kr: '미분류', region: '', images: [] },
        { id: 'quote-spot:전체라는 지역', name_kr: '전체라는 지역', region: 'all', images: [] },
    ], picks = [];
    const h = mount('TouristSpotPickerModal', async () => spots, { onPick: value => picks.push(value) });
    await tick(); h.render(); assert.equal(rows(h).length, 5);
    const group = label => { const result = nodes(h.tree).find(node => node.type === 'button' && text(node).startsWith(label)); assert.ok(result, label); return result; };
    assert.equal(text(group('중앙몽골')), '중앙몽골2');
    group('새 북부지역').props.onClick(); h.render(); assert.equal(rows(h).length, 1);
    rows(h)[0].props.onClick(); assert.equal(picks[0], spots[0]);
    group('미분류').props.onClick(); h.render(); assert.equal(rows(h).length, 1); assert.match(text(rows(h)[0]), /미분류/);
    group('all').props.onClick(); h.render(); assert.equal(rows(h).length, 1); assert.match(text(rows(h)[0]), /전체라는 지역/);
    assert.equal(h.calls[0][1].cache, 'no-store');
});

test('닫힌 선택기의 늦은 자료는 재진입 후 새 공통 목록을 덮어쓰지 않고 빈 목록에 옛 호텔을 섞지 않는다', async () => {
    for (const name of names) {
        const old = pending(), fresh = pending(); let count = 0;
        const h = mount(name, () => ++count === 1 ? old.promise : fresh.promise);
        h.props.open = false; h.render(); h.props.open = true; h.render();
        fresh.resolve([]); await tick(); h.render(); assert.equal(rows(h).length, 0);
        old.resolve([{ id: 'old-library', name_kr: '이전 목록' }]); await tick(); h.render();
        assert.equal(rows(h).length, 0); assert.ok(!text(h.tree).includes('이전 목록'));
        assert.equal(h.calls.length, 2); assert.equal(h.calls[0][1].signal.aborted, true);
    }
});
