import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { productLodgingSnapshot, documentLodgingSnapshot, lodgingTimelineSnapshot } from '../src/utils/lodgingItinerarySnapshot.ts';

const selected = { id: 'resource-lodge:같은 숙소 / #?', name_kr: '같은 숙소', address: '실제 주소', region: '테를지', grade: '고급 게르', occupancy: '2인실', description: '', images: ['/selected.webp'], amenities: ['온수', '수건', '식당'], roomAmenities: ['온수', '수건'], sharedFacilities: ['식당'] };
test('상품·예약 문서는 공통 숙소의 정확한 ID와 공개 정보만 복사하고 사진·시설 배열을 공유하지 않는다', () => {
    const product = productLodgingSnapshot(selected), document = documentLodgingSnapshot(selected);
    assert.equal(product.accommodationHotelId, selected.id); assert.equal(document.id, selected.id);
    assert.equal(product.accommodation, selected.name_kr); assert.equal(document.name, selected.name_kr);
    assert.equal(product.accommodationAddress, selected.address); assert.equal(document.location, selected.address);
    assert.equal(product.accommodationType, selected.grade); assert.equal(document.type, selected.grade);
    assert.equal(product.accommodationOccupancy, '2인실'); assert.equal(document.occupancy, '2인실');
    assert.deepEqual(product.accommodationAmenities, ['온수', '수건', '식당']); assert.deepEqual(document.facilities, ['온수', '수건', '식당']);
    assert.deepEqual(document.roomAmenities, ['온수', '수건']); assert.deepEqual(product.accommodationSharedFacilities, ['식당']);
    assert.equal(product.accommodationDescription, ''); assert.equal(document.description, '');
    product.accommodationImages.push('/product.webp'); document.facilities.push('문서 수정');
    assert.deepEqual(selected.images, ['/selected.webp']); assert.deepEqual(selected.amenities, ['온수', '수건', '식당']);
    assert.deepEqual(document.images, ['/selected.webp']); assert.deepEqual(product.accommodationAmenities, ['온수', '수건', '식당']);
});

test('일정 항목은 공개 등급·주소·시설을 안내하고 명시적으로 없는 사진과 설명은 기존 항목을 보존한다', () => {
    const current = { description: '직접 쓴 일정', images: ['/current.webp'] }, snapshot = lodgingTimelineSnapshot(selected, current);
    assert.equal(snapshot.title, '같은 숙소'); assert.equal(snapshot.description, '고급 게르\n\n실제 주소\n\n온수 · 수건 · 식당'); assert.deepEqual(snapshot.images, ['/selected.webp']);
    assert.deepEqual(lodgingTimelineSnapshot({ id: 'empty', name_kr: '비어 있는 숙소', images: [], amenities: [] }, current), { title: '비어 있는 숙소', ...current });
    const legacy = { id: 'legacy-hotel-id', name_kr: '기존 호텔', name_local: 'Saved Name', star_rating: 4, description: '이미 저장된 공개 소개', images: ['/old.webp'], amenities: ['기존 시설'] };
    assert.equal(productLodgingSnapshot(legacy).accommodationDescription, '이미 저장된 공개 소개'); assert.equal(productLodgingSnapshot(legacy).accommodationSubtitle, 'Saved Name');
    assert.equal(documentLodgingSnapshot(legacy).type, '4성급 호텔');
});

test('새 공통 숙소의 명시적 빈 대표사진·상세는 이전 호텔 사진과 설명을 상속하지 않는다', () => {
    const current = { description: '이전 호텔의 오래된 소개', images: ['/previous-hotel.webp'] };
    const emptyCommon = { id: 'resource-lodge:사진 제외 숙소', name_kr: '사진 제외 숙소', images: [], amenities: [], description: '' };
    const empty = lodgingTimelineSnapshot(emptyCommon, current);
    assert.deepEqual(empty, { title: '사진 제외 숙소', description: '', images: [] });
    const addressOnly = lodgingTimelineSnapshot({ ...emptyCommon, address: '새 숙소 주소' }, current);
    assert.deepEqual(addressOnly, { title: '사진 제외 숙소', description: '새 숙소 주소', images: [] });
    assert.deepEqual(current, { description: '이전 호텔의 오래된 소개', images: ['/previous-hotel.webp'] });
    assert.deepEqual(emptyCommon.images, []);
});

const source = fs.readFileSync(new URL('../src/components/admin/HotelPickerModal.tsx', import.meta.url), 'utf8');
const parsed = ts.createSourceFile('HotelPickerModal.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let loadEffect = '';
function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'useEffect' && node.arguments[0]?.getText(parsed).includes('loadRegisteredAssignmentResources')) loadEffect = node.arguments[0].getText(parsed);
    ts.forEachChild(node, visit);
}
visit(parsed);
function pickerEffect(values) {
    const context = vm.createContext({ AbortController, Boolean, ...values });
    vm.runInContext(ts.transpileModule('globalThis.run = ' + loadEffect, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
    return context.run();
}
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
test('실제 숙소 선택창은 닫기·계정 전환 뒤의 늦은 자료를 무시하고 오류와 미등록을 구분한다', async () => {
    const first = deferred(), calls = [], state = {};
    const setters = { setLibrary: value => { state.library = value; }, setError: value => { state.error = value; }, setLoading: value => { state.loading = value; } };
    const cleanup = pickerEffect({ open: true, accountId: 'admin-a', ...setters,
        loadRegisteredAssignmentResources: config => { calls.push(config); return first.promise; }, registeredLodgeAsHotel: lodge => lodge });
    assert.equal(calls[0].accountId, 'admin-a'); assert.deepEqual(Array.from(calls[0].kinds), ['lodges']);
    cleanup(); assert.equal(calls[0].signal.aborted, true);
    pickerEffect({ open: true, accountId: 'admin-b', ...setters, loadRegisteredAssignmentResources: async () => ({ lodges: [selected], warnings: [] }), registeredLodgeAsHotel: lodge => lodge });
    await new Promise(resolve => setImmediate(resolve));
    first.resolve({ lodges: [{ id: 'PRIVATE-PREVIOUS-ACCOUNT' }], warnings: ['늦은 오류'] }); await new Promise(resolve => setImmediate(resolve));
    assert.equal(state.library.accountId, 'admin-b'); assert.equal(state.library.items[0].id, selected.id); assert.equal(state.error, ''); assert.equal(state.loading, false);
    pickerEffect({ open: true, accountId: 'admin-b', ...setters, loadRegisteredAssignmentResources: async () => ({ lodges: [], warnings: ['등록 숙소 조회 실패'] }), registeredLodgeAsHotel: lodge => lodge });
    await new Promise(resolve => setImmediate(resolve)); assert.equal(state.error, '등록 숙소 조회 실패'); assert.equal(state.library.items.length, 0);
    pickerEffect({ open: true, accountId: '', ...setters, loadRegisteredAssignmentResources: () => assert.fail('관리자 없이 카탈로그를 조회하면 안 된다') });
    assert.match(state.error, /관리자/); assert.equal(state.loading, false);
});
