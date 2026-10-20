import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { touristSpotRegionGroups, touristSpotRegionLabel } from '../src/types/touristSpot.ts';

test('여행지 분류는 저장된 한국어·사용자 지정 값을 그대로 쓰고 예전 키만 한국어 별칭으로 묶는다', () => {
    const spots = [
        { region: 'central' }, { region: '중앙몽골' }, { region: '남고비 / 사막' },
        { region: 'all' }, { region: 'uncat' }, { region: '' }, { region: '  ' },
    ];
    const groups = touristSpotRegionGroups(spots);
    assert.deepEqual(groups[0], { value: null, label: '전체', count: 7 });
    assert.equal(groups.find(group => group.value === '중앙몽골').count, 2);
    assert.equal(groups.find(group => group.value === '남고비 / 사막').count, 1);
    assert.equal(groups.find(group => group.value === 'all').count, 1);
    assert.equal(groups.find(group => group.value === 'uncat').count, 1);
    assert.deepEqual(groups.at(-1), { value: '', label: '미분류', count: 2 });
    assert.equal(touristSpotRegionLabel('gobi'), '고비사막');
    assert.equal(touristSpotRegionLabel('새로운 분류'), '새로운 분류');
    assert.deepEqual(touristSpotRegionGroups([]), [{ value: null, label: '전체', count: 0 }]);
    assert.equal(spots[0].region, 'central');
});

const source = fs.readFileSync(new URL('../src/components/admin/TouristSpotPickerModal.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('TouristSpotPickerModal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loadEffect = '';
function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'useEffect' && node.arguments[0]?.getText(parsed).includes('api.touristSpots.list')) loadEffect = node.arguments[0].getText(parsed);
    ts.forEachChild(node, visit);
}
visit(parsed);
function pickerEffect(values) {
    const context = vm.createContext({ AbortController, Boolean, Array, Error, ...values });
    vm.runInContext(ts.transpileModule('globalThis.run = ' + loadEffect, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    return context.run();
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };

test('실제 여행지 선택창은 계정 전환·닫기·재오픈 전 조회를 취소하고 늦은 자료로 덮어쓰지 않는다', async () => {
    const old = deferred(), calls = [], state = {};
    const api = { touristSpots: { list: (params, options) => { calls.push({ params, options }); return old.promise; } } };
    const setLibrary = library => { state.library = library; };
    const close = pickerEffect({ open: true, accountId: 'admin-old', api, setLibrary });
    assert.deepEqual(calls[0].params.active, true);
    assert.equal(calls[0].options.cache, 'no-store');
    close(); assert.equal(calls[0].options.signal.aborted, true);
    const fresh = [{ id: 'quote-spot:새 명소', name_kr: '새 명소', name_local: '보조 제목', description: '', images: [] }];
    pickerEffect({ open: true, accountId: 'admin-new', setLibrary, api: { touristSpots: { list: async () => fresh } } });
    await flush();
    old.resolve([{ id: 'old-account-only', name_kr: '이전 계정 조회' }]);
    await flush();
    assert.equal(state.library.accountId, 'admin-new');
    assert.equal(state.library.items, fresh);
    assert.equal(state.library.loading, false); assert.equal(state.library.error, '');
    assert.equal(fresh[0].description, ''); assert.deepEqual(fresh[0].images, []);
});

test('선택창은 조회 실패·잘못된 응답·관리자 로그아웃과 정상 미등록을 구분한다', async () => {
    let library;
    const setLibrary = value => { library = value; };
    pickerEffect({ open: true, accountId: 'admin', setLibrary, api: { touristSpots: { list: async () => { throw new Error('offline'); } } } });
    await flush(); assert.match(library.error, /불러오지 못했습니다/); assert.equal(library.loading, false);
    pickerEffect({ open: true, accountId: 'admin', setLibrary, api: { touristSpots: { list: async () => ({ items: [] }) } } });
    await flush(); assert.match(library.error, /불러오지 못했습니다/);
    pickerEffect({ open: true, accountId: 'admin', setLibrary, api: { touristSpots: { list: async () => [] } } });
    await flush(); assert.equal(library.error, ''); assert.equal(library.items.length, 0);
    pickerEffect({ open: true, accountId: '', setLibrary, api: { touristSpots: { list: () => assert.fail('관리자 없이 조회하지 않는다') } } });
    assert.match(library.error, /관리자/); assert.equal(library.loading, false); assert.equal(library.items.length, 0);
    pickerEffect({ open: false, accountId: 'admin', setLibrary: () => assert.fail('닫힌 선택창 상태를 변경하지 않는다') });
});
