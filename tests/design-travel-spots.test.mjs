import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const librarySource = fs.readFileSync(new URL('../src/components/product/designTemplates/designSpots.ts', import.meta.url), 'utf8');
const editorSource = fs.readFileSync(new URL('../src/components/admin/DesignTemplateBlockEditor.tsx', import.meta.url), 'utf8');
const parse = (name, source, kind) => ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, kind);
const library = parse('designSpots.ts', librarySource, ts.ScriptKind.TS);
const editor = parse('DesignTemplateBlockEditor.tsx', editorSource, ts.ScriptKind.TSX);
const mapper = library.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'designSpotOptionsFromLibrary').getText(library).replace(/^export /, '');
const field = editor.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'SpotCardsField').getText(editor);
let loadEffect;
function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(library) === 'useEffect' && node.arguments[0]?.getText(library).includes('api.touristSpots.list')) loadEffect = node.arguments[0].getText(library);
    ts.forEachChild(node, visit);
}
visit(library);
function runtime(source, values = {}) {
    const context = vm.createContext({ AbortController, Array, Error, ...values });
    vm.runInContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText, context);
    return context;
}
const options = runtime(mapper + '\nglobalThis.options = designSpotOptionsFromLibrary;').options;
const flush = () => new Promise(resolve => setImmediate(resolve));
const plain = value => JSON.parse(JSON.stringify(value));

test('디자인 카드 후보는 공통 여행지 이름과 첫 사진만 복사하며 비운 사진·목록을 그대로 유지한다', () => {
    const selected = { id: 'quote-spot:테를지', name_kr: '테를지', name_local: 'Тэрэлж', images: ['/main.webp', '/extra.webp'], description: '일정용 소개', privateNote: 'PRIVATE' };
    const mapped = options([selected]);
    assert.deepEqual(plain(mapped), [{ id: selected.id, name: selected.name_kr, image: '/main.webp' }]);
    selected.images[0] = '/changed.webp'; selected.name_kr = '나중에 바꾼 이름';
    assert.equal(mapped[0].name, '테를지'); assert.equal(mapped[0].image, '/main.webp');
    assert.deepEqual(plain(options([{ id: 'quote-spot:사진 없음', name_kr: '사진 없음', images: [] }])), [{ id: 'quote-spot:사진 없음', name: '사진 없음', image: '' }]);
    assert.deepEqual(plain(options([])), []);
    for (const invalid of [null, { items: [] }, [{ id: 'missing-name' }], [{ id: 'bad-images', name_kr: '형식 오류', images: 'old.webp' }]]) assert.throws(() => options(invalid));
});

test('실제 디자인 여행지 조회는 늦은 응답·계정 변경을 차단하고 오류와 정상 빈 목록을 구분한다', async () => {
    let complete;
    const pending = new Promise(resolve => { complete = resolve; }), state = {}, calls = [];
    const setLibrary = value => { state.library = value; };
    const run = values => runtime(mapper + '\nglobalThis.run = ' + loadEffect, { setLibrary, ...values }).run();
    const close = run({ accountId: 'admin-a', api: { touristSpots: { list: (params, init) => { calls.push({ params, init }); return pending; } } } });
    assert.equal(calls[0].params.active, true); assert.equal(calls[0].init.cache, 'no-store');
    close(); assert.equal(calls[0].init.signal.aborted, true);
    run({ accountId: 'admin-b', api: { touristSpots: { list: async () => [{ id: 'quote-spot:현재 여행지', name_kr: '현재 여행지', images: [] }] } } });
    await flush(); complete([{ id: 'old-account', name_kr: '이전 계정', images: ['/old.webp'] }]); await flush();
    assert.equal(state.library.accountId, 'admin-b'); assert.equal(state.library.spots[0].name, '현재 여행지');
    run({ accountId: 'admin-b', api: { touristSpots: { list: async () => { throw new Error('offline'); } } } });
    await flush(); assert.match(state.library.error, /불러오지 못했습니다/); assert.equal(state.library.loading, false);
    run({ accountId: 'admin-b', api: { touristSpots: { list: async () => [] } } });
    await flush(); assert.equal(state.library.error, ''); assert.equal(state.library.spots.length, 0);
    run({ accountId: '', api: { touristSpots: { list: () => assert.fail('관리자 없이 조회하지 않는다') } } });
    assert.match(state.library.error, /관리자/); assert.equal(state.library.spots.length, 0);
});

test('조회 실패나 빈 공통 목록을 표시해도 기존 상품 카드의 이름·사진과 저장값을 바꾸지 않는다', () => {
    const saved = '기존 카드|/saved.webp\n직접 입력 카드|', changes = [];
    const make = props => {
        const context = runtime(field + '\nglobalThis.render = SpotCardsField;', {
            useDesignSpots: () => props, useState: () => [null, () => {}],
            React: { createElement: (type, attributes, ...children) => ({ type, attributes, children }) }, Icon: 'icon',
        });
        return context.render({ value: saved, onChange: value => changes.push(value) });
    };
    const nodes = root => {
        const result = [];
        const visit = node => { if (Array.isArray(node)) node.forEach(visit); else if (node && typeof node === 'object') { result.push(node); visit(node.children); } };
        visit(root); return result;
    };
    for (const props of [{ spots: [], loading: false, error: '여행지 조회 실패', retry: () => {} }, { spots: [], loading: false, error: '', retry: () => {} }]) {
        const tree = nodes(make(props));
        assert.ok(tree.some(node => node.type === 'img' && node.attributes.src === '/saved.webp'));
        assert.ok(tree.some(node => node.type === 'input' && node.attributes.value === '기존 카드'));
        assert.ok(tree.some(node => node.type === 'input' && node.attributes.value === '직접 입력 카드'));
        assert.ok(tree.some(node => node.type === 'a' && node.attributes.href === '/admin/quote-desk/spots'));
        assert.equal(tree.some(node => node.attributes?.role === 'alert'), Boolean(props.error));
    }
    assert.deepEqual(changes, []);
});
