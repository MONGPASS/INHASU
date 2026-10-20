import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { build } from 'esbuild';

const result = await build({
    entryPoints: ['src/components/admin/ReservationOperations.tsx'],
    bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', write: false,
    plugins: [{ name: 'operations-event-hooks', setup(builder) {
        builder.onResolve({ filter: /^react$|^react\/jsx-runtime$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        builder.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path }) => ({ loader: 'js', contents: path === 'react'
            ? `export const useState=(...a)=>globalThis.h.useState(...a),useRef=(...a)=>globalThis.h.useRef(...a),useEffect=(...a)=>globalThis.h.useEffect(...a),useCallback=(...a)=>globalThis.h.useCallback(...a);`
            : `export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;` }));
    } }],
});
const nodes = root => !root || typeof root !== 'object' ? [] : Array.isArray(root) ? root.flatMap(nodes) : [root, ...nodes(root.props?.children)];
const find = (h, predicate) => { const node = nodes(h.tree).find(predicate); assert.ok(node, 'requested control exists'); return node; };
const change = (h, label, value) => {
    find(h, n => n.type === 'label' && nodes(n).some(child => child.type === 'span' && child.props.children === label))
        .props.children.find(n => ['input', 'select', 'textarea'].includes(n?.type)).props.onChange({ target: { value } });
    h.render();
};
const submit = h => find(h, n => n.type === 'form').props.onSubmit({ preventDefault() {} });
const tick = () => new Promise(setImmediate);
const initial = () => ({ joining: 'private', region: '테를지', category: '가족', vehicle: '등록 차량', driverPhone: 'LOCAL-PHONE',
    receipt: { status: 'pending', number: 'LOCAL-RECEIPT', issuedDate: '' }, opsNote: '기존 운영 메모' });
function mount(props) {
    const module = { exports: {} }, context = vm.createContext({ module, exports: module.exports });
    vm.runInContext(result.outputFiles[0].text, context);
    const values = [], memo = []; let cursor = 0, effects = [];
    const h = {
        tree: null,
        useState(initialValue) { const key = cursor++; if (!(key in values)) values[key] = typeof initialValue === 'function' ? initialValue() : initialValue;
            return [values[key], next => { values[key] = typeof next === 'function' ? next(values[key]) : next; }]; },
        useRef(initialValue) { const key = cursor++; if (!(key in values)) values[key] = { current: initialValue }; return values[key]; },
        useCallback(fn, deps) { const key = cursor++; if (!memo[key] || deps.some((value, i) => value !== memo[key].deps[i])) memo[key] = { deps, fn }; return memo[key].fn; },
        useEffect(fn, deps) { const key = cursor++, old = memo[key];
            if (!old || deps.some((value, i) => value !== old.deps[i])) { memo[key] = { deps, cleanup: old?.cleanup }; effects.push(() => { old?.cleanup?.(); memo[key].cleanup = fn(); }); } },
        render() { cursor = 0; effects = []; context.h = h; h.tree = module.exports.ReservationOperations(props); effects.forEach(run => run()); return h.tree; },
        unmount() { memo.forEach(entry => entry?.cleanup?.()); },
    };
    h.render(); h.render(); return h;
}

test('고정 업무바의 운영 form 저장은 중복 요청을 막고 실패 입력을 보존한 뒤 성공 상태를 전달한다', async () => {
    let finish, calls = 0, control; const statuses = [], source = initial(), sent = [];
    const props = { reservationId: 'local-ops', value: source, externalActions: true, formId: 'local-fixed-footer',
        onControlChange: value => { control = value; }, onStatusChange: value => statuses.push(value),
        onSave: value => { calls++; sent.push(value); return new Promise(resolve => { finish = resolve; }); } };
    const h = mount(props);
    assert.equal(find(h, n => n.type === 'form').props.id, props.formId);
    assert.equal(nodes(h.tree).some(n => n.type === 'button'), false);
    change(h, '내부 운영 메모', '수정 중 운영 메모');
    submit(h); submit(h); assert.equal(calls, 1);
    h.render(); assert.equal(statuses.at(-1).busy, true);
    control.cancel(); h.render();
    assert.ok(nodes(h.tree).some(n => n.props?.value === '수정 중 운영 메모'));
    finish(false); await tick(); h.render();
    assert.equal(statuses.at(-1).failed, true); assert.equal(statuses.at(-1).dirty, true); assert.equal(statuses.at(-1).busy, false);
    assert.ok(nodes(h.tree).some(n => n.props?.role === 'alert'));
    assert.equal(sent[0].driverPhone, source.driverPhone); assert.equal(sent[0].receipt, source.receipt); assert.equal(source.opsNote, '기존 운영 메모');
    props.onSave = async value => { calls++; sent.push(value); return true; }; h.render();
    submit(h); await tick(); h.render();
    assert.equal(calls, 2); assert.equal(statuses.at(-1).dirty, false); assert.equal(statuses.at(-1).failed, false);
    assert.match(statuses.at(-1).message, /저장했습니다/); assert.equal(sent[1].opsNote, '수정 중 운영 메모');
});

test('운영 form의 영수증 발행일 검증과 외부 취소는 최신 원본을 사용하며 콜백 교체로 재렌더를 반복하지 않는다', () => {
    let calls = 0, control; const statuses = [];
    const props = { reservationId: 'local-ops', value: initial(), externalActions: true,
        onControlChange: value => { control = value; }, onStatusChange: value => statuses.push(value), onSave: async () => { calls++; return true; } };
    const h = mount(props);
    change(h, '현금영수증 상태', 'issued'); submit(h); h.render();
    assert.equal(calls, 0); assert.equal(statuses.at(-1).failed, true); assert.match(statuses.at(-1).message, /발행일/);
    props.value = { ...initial(), opsNote: '새로 받은 서버 원본' };
    props.onStatusChange = value => statuses.push(value); h.render();
    const count = statuses.length; props.onStatusChange = value => statuses.push(value); h.render();
    assert.equal(statuses.length, count, 'callback identity changes alone do not publish another status');
    control.cancel(); h.render();
    assert.equal(statuses.at(-1).dirty, false); assert.equal(statuses.at(-1).failed, false);
    assert.ok(nodes(h.tree).some(n => n.props?.value === '새로 받은 서버 원본'));
    h.unmount(); assert.equal(control, null);
});

test('기존 모달도 운영 저장 form을 사용하고 비활성 상태에서는 외부 취소와 저장이 실행되지 않는다', () => {
    let calls = 0, control;
    const props = { reservationId: 'legacy-ops', value: initial(), onControlChange: value => { control = value; }, onSave: async () => { calls++; return true; } };
    const h = mount(props), save = find(h, n => n.type === 'button' && n.props.type === 'submit');
    assert.equal(save.props.form, 'reservation-operations-legacy-ops');
    change(h, '내부 운영 메모', '보존할 입력'); props.disabled = true; h.render();
    submit(h); control.cancel(); h.render();
    assert.equal(calls, 0); assert.ok(nodes(h.tree).some(n => n.props?.value === '보존할 입력'));
});
