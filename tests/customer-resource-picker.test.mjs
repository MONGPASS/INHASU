import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const result = await build({ entryPoints: [fileURLToPath(new URL('../src/components/admin/CustomerVehicleAssignment.tsx', import.meta.url))], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false, loader: { '.css': 'empty' },
    plugins: [{ name: 'vehicle-selector-events', setup(builder) {
        builder.onResolve({ filter: /^react$|^react\/jsx-runtime$/ }, args => ({ path: args.path, namespace: 'vehicle-selector-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'vehicle-selector-test' }, ({ path }) => ({ loader: 'js', contents: path === 'react'
            ? 'export const useState=(...args)=>globalThis.h.useState(...args),useRef=(...args)=>globalThis.h.useRef(...args),useEffect=(...args)=>globalThis.h.useEffect(...args);'
            : 'export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;' }));
    } }],
});
const nodes = root => !root || typeof root !== 'object' ? [] : Array.isArray(root) ? root.flatMap(nodes) : [root, ...nodes(root.props?.children)];
const find = (root, predicate) => { const node = nodes(root).find(predicate); assert.ok(node, 'requested resource control is rendered'); return node; };
const text = root => typeof root === 'string' || typeof root === 'number' ? String(root) : Array.isArray(root) ? root.map(text).join('') : text(root?.props?.children ?? '');
const vehicleButton = (h, name) => find(h.tree, node => node.type === 'button' && String(node.props.className).includes('crp-vehicle-choice') && text(node).includes(name));
const saveButton = h => find(h.tree, node => node.type === 'button' && String(node.props.className).includes('cw-wide'));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const tick = () => new Promise(setImmediate);
function mount(props) {
    const module = { exports: {} }, context = vm.createContext({ module, exports: module.exports });
    vm.runInContext(result.outputFiles[0].text, context);
    const values = [], effects = new Map(); let cursor = 0, pendingEffects = [];
    const h = { props, tree: null,
        useState(initial) { const key = cursor++; if (!(key in values)) values[key] = typeof initial === 'function' ? initial() : initial; return [values[key], change => { values[key] = typeof change === 'function' ? change(values[key]) : change; }]; },
        useRef(initial) { const key = cursor++; if (!(key in values)) values[key] = { current: initial }; return values[key]; },
        useEffect(fn, deps) { const key = cursor++, before = effects.get(key); if (!before || deps.some((item, index) => item !== before.deps[index])) pendingEffects.push(() => { before?.cleanup?.(); effects.set(key, { deps, cleanup: fn() }); }); },
        render() { cursor = 0; pendingEffects = []; context.h = h; h.tree = module.exports.CustomerVehicleAssignment(h.props); pendingEffects.forEach(run => run()); return h.tree; },
    };
    h.render(); return h;
}
const fixtures = [{ type: '등록 하이이스', name: '등록 하이이스', phone: 'SAVED-DRIVER', snapshot: { img: '/saved-car.webp', seats: '6인', plate: '1234', desc: '등록 설명' } }, { type: '등록 SUV', name: '등록 SUV', phone: '', snapshot: { seats: '4인', plate: '5678' } }];
const baseProps = () => ({ value: { type: '', phone: '' }, vehicles: fixtures, loading: false, disabled: false, onRetry() {}, onClose() {}, onSaved() {}, onDirtyChange() {}, onSave: async () => true });

test('등록 차량은 사진·이름·번호로 검색하여 선택하고 저장 전까지 예약을 변경하지 않는다', async () => {
    const payloads = [], dirty = [];
    const h = mount({ ...baseProps(), onDirtyChange: value => dirty.push(value), onSave: async value => { payloads.push(value); return true; } });
    assert.equal(nodes(h.tree).filter(node => node.type === 'button' && String(node.props.className).includes('crp-vehicle-choice')).length, 2);
    find(h.tree, node => node.type === 'input' && node.props.type === 'search').props.onChange({ target: { value: '5678' } }); h.render();
    assert.equal(nodes(h.tree).filter(node => node.type === 'button' && String(node.props.className).includes('crp-vehicle-choice')).length, 1);
    vehicleButton(h, '등록 SUV').props.onClick(); h.render(); assert.equal(payloads.length, 0); assert.equal(dirty.at(-1), true);
    assert.equal(vehicleButton(h, '등록 SUV').props['aria-pressed'], true); assert.match(text(h.tree), /선택됨 · 저장 전/);
    saveButton(h).props.onClick(); await tick(); h.render();
    assert.equal(payloads.length, 1); assert.equal(payloads[0].type, '등록 SUV'); assert.equal(payloads[0].resource, fixtures[1].snapshot);
});

test('차량 저장 중 중복 선택을 잠그고 실패한 선택·연락처를 유지하여 재시도 뒤에만 완료한다', async () => {
    const gate = deferred(), payloads = []; let saved = 0;
    const h = mount({ ...baseProps(), onSaved: () => saved++, onSave: async value => { payloads.push(value); return gate.promise; } });
    vehicleButton(h, '등록 하이이스').props.onClick(); h.render();
    find(h.tree, node => node.type === 'input' && node.props.type === 'tel').props.onChange({ target: { value: 'UPDATED-DRIVER' } }); h.render();
    vehicleButton(h, '등록 하이이스').props.onClick(); h.render();
    assert.equal(find(h.tree, node => node.type === 'input' && node.props.type === 'tel').props.value, 'UPDATED-DRIVER');
    saveButton(h).props.onClick(); h.render(); assert.equal(saveButton(h).props.disabled, true);
    vehicleButton(h, '등록 SUV').props.onClick(); saveButton(h).props.onClick(); assert.equal(payloads.length, 1);
    gate.resolve(false); await tick(); h.render(); assert.equal(saved, 0); assert.equal(saveButton(h).props.disabled, false);
    assert.equal(vehicleButton(h, '등록 하이이스').props['aria-pressed'], true); assert.equal(find(h.tree, node => node.props?.role === 'alert').type, 'p');
    assert.equal(find(h.tree, node => node.type === 'input' && node.props.type === 'tel').props.value, 'UPDATED-DRIVER');
    h.props.onSave = async value => { payloads.push(value); return true; }; h.render(); saveButton(h).props.onClick(); await tick();
    assert.equal(saved, 1); assert.equal(payloads[1].phone, 'UPDATED-DRIVER');
});

test('현재 배정 표시·명시적 해제·조회와 작업 중 차단을 유지하고 등록되지 않은 차량을 만들어 넣지 않는다', async () => {
    const payloads = [];
    const h = mount({ ...baseProps(), value: { type: '과거 저장 차량', phone: 'LEGACY-DRIVER' }, onSave: async value => { payloads.push(value); return true; } });
    assert.match(text(h.tree), /현재 배정 · 과거 저장 차량/); assert.equal(saveButton(h).props.disabled, true);
    assert.equal(nodes(h.tree).filter(node => node.type === 'button' && String(node.props.className).includes('crp-vehicle-choice')).length, 2);
    h.props.loading = true; h.render(); vehicleButton(h, '등록 SUV').props.onClick(); assert.equal(saveButton(h).props.disabled, true); assert.equal(payloads.length, 0);
    h.props.loading = false; h.props.disabled = true; h.render(); vehicleButton(h, '등록 SUV').props.onClick(); assert.equal(saveButton(h).props.disabled, true);
    h.props.disabled = false; h.render(); find(h.tree, node => node.type === 'button' && node.props.className === 'crp-clear').props.onClick(); h.render();
    assert.equal(find(h.tree, node => node.type === 'input' && node.props.type === 'tel').props.value, ''); assert.match(text(h.tree), /기존 차량 배정이 해제됩니다/);
    saveButton(h).props.onClick(); await tick(); assert.equal(payloads.length, 1); assert.equal(payloads[0].type, ''); assert.equal(payloads[0].phone, ''); assert.equal(payloads[0].resource, undefined);
});
