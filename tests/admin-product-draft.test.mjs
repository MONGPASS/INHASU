import test from 'node:test';
import assert from 'node:assert/strict';
import {
    adminProductDraftKey, readAdminProductDraft, writeAdminProductDraft,
    removeAdminProductDraft, finishAdminProductSave, productDraftFingerprint,
    runAdminProductSaveOnce,
    adminProductNavigationDecision, updateAdminProductEditorForm,
} from '../src/utils/adminProductDraft.ts';

function memoryStorage() {
    const values = new Map();
    return {
        values, getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value); },
        removeItem: key => { values.delete(key); },
    };
}
const scope = { userId: 'admin-a', productId: 'product-1' };
const server = { id: 'product-1', name: '서버 상품', duration: '3박 4일', category: '중앙몽골', price: 1000000,
    updatedAt: '2026-10-14T00:00:00Z', mainImages: ['/images/main.webp'], itineraryBlocks: [], tags: [] };
const edited = { ...server, name: '작성 중 상품', itineraryBlocks: [
    { id: 'day-1', type: 'dayInfo', content: { dayLabel: 'DAY 1', title: '테렐지', meals: { lunch: '현지식' } } },
    { id: 'event-1', type: 'timeline', content: { title: '거북바위', description: '작성한 설명', images: ['/images/spot.webp'] } },
] };
const savedAt = '2026-10-14T01:23:45Z';

test('서버 저장본으로 진입하면 초안을 새로 만들지 않는다', () => {
    const storage = memoryStorage();
    assert.equal(writeAdminProductDraft(storage, scope, server, { ...server }).ok, true);
    assert.equal(storage.values.size, 0);
    assert.deepEqual(readAdminProductDraft(storage, scope, server), { kind: 'empty' });
});

test('상품 텍스트·일정·사진 URL과 보관 시각을 새 세션에서 복원할 수 있다', () => {
    const storage = memoryStorage();
    assert.deepEqual(writeAdminProductDraft(storage, scope, server, edited, savedAt), { ok: true, savedAt });
    const loaded = readAdminProductDraft(storage, scope, server);
    assert.equal(loaded.kind, 'draft');
    assert.equal(loaded.conflict, false);
    assert.equal(loaded.draft.savedAt, savedAt);
    assert.deepEqual(loaded.draft.form, edited);
    loaded.draft.form.itineraryBlocks[1].content.description = '복원 후 변경';
    assert.equal(readAdminProductDraft(storage, scope, server).draft.form.itineraryBlocks[1].content.description, '작성한 설명');
});

test('관리자 계정·상품 ID·신규 상품 초안은 서로 분리된다', () => {
    const storage = memoryStorage();
    const scopes = [scope, { userId: 'admin-b', productId: 'product-1' }, { userId: 'admin-a', productId: 'product-2' },
        { userId: 'admin-a', productId: null }, { userId: 'admin-a', productId: 'new' }];
    assert.equal(new Set(scopes.map(adminProductDraftKey)).size, scopes.length);
    writeAdminProductDraft(storage, scope, server, edited, savedAt);
    for (const other of scopes.slice(1)) assert.deepEqual(readAdminProductDraft(storage, other, server), { kind: 'empty' });
    assert.throws(() => adminProductDraftKey({ userId: '', productId: null }));
});

test('서버 updatedAt 변경과 타임스탬프가 없는 서버 내용 변경을 충돌로 표시하고 초안을 보존한다', () => {
    const storage = memoryStorage();
    writeAdminProductDraft(storage, scope, server, edited, savedAt);
    const previous = storage.getItem(adminProductDraftKey(scope));
    assert.equal(readAdminProductDraft(storage, scope, { ...server, updatedAt: '2026-10-14T02:00:00Z' }).conflict, true);
    assert.equal(readAdminProductDraft(storage, scope, { ...server, price: 1200000 }).conflict, true);
    assert.equal(storage.getItem(adminProductDraftKey(scope)), previous);
});

test('저장 실패에서는 초안을 유지하고 저장 성공일 때 해당 계정·상품의 초안만 지운다', () => {
    const storage = memoryStorage();
    const other = { userId: 'admin-b', productId: 'product-1' };
    writeAdminProductDraft(storage, scope, server, edited, savedAt);
    writeAdminProductDraft(storage, other, server, edited, savedAt);
    assert.equal(finishAdminProductSave(storage, scope, false).ok, true);
    assert.equal(readAdminProductDraft(storage, scope, server).kind, 'draft');
    assert.equal(finishAdminProductSave(storage, scope, true).ok, true);
    assert.equal(readAdminProductDraft(storage, scope, server).kind, 'empty');
    assert.equal(readAdminProductDraft(storage, other, server).kind, 'draft');
});

test('손상 JSON·외부 계정·잘못된 배열·null 일정 내용은 복원하지 않고 원본을 유지한다', () => {
    const storage = memoryStorage();
    writeAdminProductDraft(storage, scope, server, edited, savedAt);
    const valid = JSON.parse(storage.getItem(adminProductDraftKey(scope)));
    const malformed = ['{broken', JSON.stringify({ ...valid, userId: 'admin-b' }),
        JSON.stringify({ ...valid, form: { ...edited, itineraryBlocks: [{ id: 123, type: 'image', content: '/img/photo.webp' }] } }),
        JSON.stringify({ ...valid, form: { ...edited, mainImages: 'not-an-array' } }),
        JSON.stringify({ ...valid, form: { ...edited, itineraryBlocks: [{ id: 'bad', type: 'dayInfo', content: null }] } }),
        JSON.stringify({ ...valid, form: { ...edited, itineraryBlocks: [{ id: 'bad', type: 'timeline', content: { images: {} } }] } }),
        JSON.stringify({ ...valid, form: { ...edited, detailBlocks: [{ id: 'bad', type: 'design', content: { templateId: 'tour', values: {}, sections: [null] } }] } })];
    for (const raw of malformed) {
        storage.setItem(adminProductDraftKey(scope), raw);
        assert.equal(readAdminProductDraft(storage, scope, server).kind, 'error');
        assert.equal(storage.getItem(adminProductDraftKey(scope)), raw);
    }
});

test('이미지 파일·base64·blob 임시 주소를 저장하지 않고 업로드된 URL만 보관한다', () => {
    const storage = memoryStorage();
    const withBinary = { ...edited, mainImages: ['data:image/png;base64,ABC', 'blob:temporary', '/images/real.webp'],
        rawFile: new Blob(['private bytes']), detailBlocks: [{ id: 'image-1', type: 'image', content: '/images/detail.webp' }] };
    writeAdminProductDraft(storage, scope, server, withBinary, savedAt);
    const raw = storage.getItem(adminProductDraftKey(scope));
    assert.ok(!raw.includes('base64') && !raw.includes('blob:') && !raw.includes('private bytes') && !raw.includes('rawFile'));
    assert.deepEqual(readAdminProductDraft(storage, scope, server).draft.form.mainImages, ['/images/real.webp']);
});

test('quota 및 저장소 접근 오류를 결과로 반환해 폼이 계속 오류를 표시할 수 있다', () => {
    const storage = memoryStorage();
    storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    const failed = writeAdminProductDraft(storage, scope, server, edited, savedAt);
    assert.equal(failed.ok, false);
    assert.match(failed.error, /저장 공간/);
    assert.equal(readAdminProductDraft({ ...storage, getItem: () => { throw new Error('blocked'); } }, scope, server).kind, 'error');
    assert.equal(removeAdminProductDraft({ ...storage, removeItem: () => { throw new Error('blocked'); } }, scope).ok, false);
});

test('조회수·예약수 변화 및 키 순서는 편집 변경으로 판단하지 않는다', () => {
    assert.equal(productDraftFingerprint(server), productDraftFingerprint({ price: server.price, ...server, viewCount: 999, bookingCount: 100 }));
});

test('서버에 이미 같은 내용이 저장됐다면 오래된 복원 배너를 다시 띄우지 않는다', () => {
    const storage = memoryStorage();
    writeAdminProductDraft(storage, scope, server, edited, savedAt);
    assert.deepEqual(readAdminProductDraft(storage, scope, { ...edited, updatedAt: '2026-10-14T02:00:00Z' }), { kind: 'empty' });
});

test('첫 저장이 진행 중일 때 중복 실행을 막고 완료 뒤 재시도할 수 있다', async () => {
    const lock = { current: false };
    let finish;
    let calls = 0;
    const request = () => { calls++; return new Promise(resolve => { finish = resolve; }); };
    const first = runAdminProductSaveOnce(lock, request);
    assert.equal(lock.current, true);
    assert.equal(await runAdminProductSaveOnce(lock, request), 'ignored');
    assert.equal(calls, 1);
    finish();
    assert.equal(await first, 'finished');
    assert.equal(lock.current, false);
    assert.equal(await runAdminProductSaveOnce(lock, async () => { calls++; }), 'finished');
    assert.equal(calls, 2);
});

test('저장 요청이 예외로 실패해도 잠금을 해제하고 복원 사본을 보존한다', async () => {
    const lock = { current: false };
    const storage = memoryStorage();
    writeAdminProductDraft(storage, scope, server, edited, savedAt);
    await assert.rejects(runAdminProductSaveOnce(lock, async () => { throw new Error('network failed'); }), /network failed/);
    assert.equal(lock.current, false);
    assert.equal(readAdminProductDraft(storage, scope, server).kind, 'draft');
});

test('PUSH·POP·상품 query 변경은 이동하기 전에 가장 최근 입력을 보관한다', () => {
    const current = { pathname: '/admin/products', search: '?open=product-1' };
    for (const next of [{ pathname: '/admin/reservations', search: '' }, { pathname: '/admin', search: '' },
        { pathname: '/admin/products', search: '?open=product-2' }]) {
        const storage = memoryStorage();
        let flushes = 0;
        const decision = adminProductNavigationDecision(current, next, false, () => {
            flushes++;
            return writeAdminProductDraft(storage, scope, server, edited);
        });
        assert.deepEqual(decision, { blocked: false });
        assert.equal(flushes, 1);
        assert.equal(readAdminProductDraft(storage, scope, server).draft.form.name, edited.name);
    }
});

test('Toolbar navigate·Back·query 이동도 quota 오류에서 차단하여 이전 사본과 작성 중 입력을 유지한다', () => {
    const storage = memoryStorage();
    writeAdminProductDraft(storage, scope, server, edited, savedAt);
    const original = storage.getItem(adminProductDraftKey(scope));
    storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    const unsaved = { ...edited, name: '아직 보관하지 못한 최신 입력' };
    const decision = adminProductNavigationDecision({ pathname: '/admin/products', search: '?open=product-1' },
        { pathname: '/admin/products', search: '?open=product-2' }, false,
        () => writeAdminProductDraft(storage, scope, server, unsaved));
    assert.equal(decision.blocked, true);
    assert.equal(decision.reason, 'draft_storage_failure');
    assert.match(decision.error, /저장 공간/);
    assert.equal(storage.getItem(adminProductDraftKey(scope)), original);
    assert.equal(unsaved.name, '아직 보관하지 못한 최신 입력');
});

test('저장·업로드 중 이동은 보관 가능 여부와 관계없이 차단하고 같은 위치 이동은 유지한다', () => {
    const current = { pathname: '/admin/products', search: '?open=product-1' };
    const next = { pathname: '/admin', search: '' };
    assert.deepEqual(adminProductNavigationDecision(current, next, true, () => ({ ok: true })), { blocked: true, reason: 'busy' });
    assert.deepEqual(adminProductNavigationDecision(current, next, true, () => ({ ok: false, error: 'full' })), { blocked: true, reason: 'busy' });
    assert.deepEqual(adminProductNavigationDecision(current, { ...current }, true, () => { throw new Error('must not flush'); }), { blocked: false });
});

test('닫힌 폼의 늦은 업로드 완료는 같은 상품을 다시 연 새 초안을 덮지 않는다', async () => {
    const storage = memoryStorage();
    const oldForm = { current: { ...edited } };
    const status = { mounted: true, saving: false, saved: false };
    let resolveImage;
    const upload = new Promise(resolve => { resolveImage = resolve; });
    const completion = upload.then(url => {
        const next = updateAdminProductEditorForm(oldForm, status, previous => ({ ...previous, mainImages: [...previous.mainImages, url] }));
        if (next) writeAdminProductDraft(storage, scope, server, next);
        return next;
    });
    status.mounted = false;
    const reopened = { ...edited, name: '다시 열어 작성한 최신 초안' };
    writeAdminProductDraft(storage, scope, server, reopened);
    const currentBackup = storage.getItem(adminProductDraftKey(scope));
    resolveImage('/img/late-upload.webp');
    assert.equal(await completion, null);
    assert.equal(storage.getItem(adminProductDraftKey(scope)), currentBackup);
    assert.deepEqual(oldForm.current.mainImages, edited.mainImages);
});
