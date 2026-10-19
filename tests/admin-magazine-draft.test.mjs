import test from 'node:test';
import assert from 'node:assert/strict';
import { magazineDraftKey, magazineDraftFingerprint, magazineDraftForm, readMagazineDraft, writeMagazineDraft, removeMagazineDraft } from '../src/utils/adminMagazineDraft.ts';
const scope = { userId: 'local-admin', magazineId: 'local-magazine' };
const source = { title: '여행 안내', content: '<p>원본</p>', category: '여행 팁', isActive: false, isFeatured: false, order: 0 };
const edited = { ...source, title: '작성 중 제목', content: '<p>이미지와 문구</p><img src="/img/home/1.webp">' };
function storage() { const rows = new Map(); return { rows, getItem: key => rows.get(key) ?? null, setItem: (key, value) => rows.set(key, value), removeItem: key => rows.delete(key) }; }
test('계정·매거진·새글별 초안을 분리하고 입력 HTML·공개 설정을 복원한다', () => {
    const store = storage();
    assert.equal(writeMagazineDraft(store, scope, edited, magazineDraftFingerprint(source)).ok, true);
    const read = readMagazineDraft(store, scope, source); assert.equal(read.kind, 'draft'); assert.equal(read.conflict, false);
    assert.deepEqual(read.draft.form, magazineDraftForm(edited));
    assert.equal(readMagazineDraft(store, { ...scope, userId: 'other-admin' }, source).kind, 'empty');
    assert.equal(readMagazineDraft(store, { ...scope, magazineId: null }, source).kind, 'empty');
});
test('서버 원본 변경을 충돌로 알리고 원본과 같은 초안을 복원 대기로 표시하지 않는다', () => {
    const store = storage(); writeMagazineDraft(store, scope, edited, magazineDraftFingerprint(source));
    assert.equal(readMagazineDraft(store, scope, { ...source, content: '<p>다른 관리자 수정</p>' }).conflict, true);
    assert.equal(readMagazineDraft(store, scope, edited).kind, 'empty');
});
test('원본 그대로면 초안을 새로 쓰지 않고 저장 실패는 기존 복구본을 보존한다', () => {
    const store = storage(); assert.equal(writeMagazineDraft(store, scope, source, magazineDraftFingerprint(source)).ok, true); assert.equal(store.rows.size, 0);
    writeMagazineDraft(store, scope, edited, magazineDraftFingerprint(source));
    const before = store.getItem(magazineDraftKey(scope));
    const blocked = { ...store, setItem() { throw new DOMException('full', 'QuotaExceededError'); } };
    const failure = writeMagazineDraft(blocked, scope, { ...edited, title: '가장 최근 입력' }, magazineDraftFingerprint(source));
    assert.equal(failure.ok, false); assert.match(failure.error, /저장 공간/); assert.equal(store.getItem(magazineDraftKey(scope)), before);
});
test('오래된 저장 완료 응답은 다른 탭이 쓴 최신 초안을 삭제하지 않는다', () => {
    const store = storage(); const first = writeMagazineDraft(store, scope, edited, magazineDraftFingerprint(source));
    writeMagazineDraft(store, scope, { ...edited, title: '다른 탭의 최신 입력' }, magazineDraftFingerprint(source));
    assert.equal(removeMagazineDraft(store, scope, first.revision).ok, true);
    assert.equal(readMagazineDraft(store, scope, source).draft.form.title, '다른 탭의 최신 입력');
});
test('손상·다른 계정 payload는 자동 복원하지 않는다', () => {
    const store = storage(); writeMagazineDraft(store, scope, edited, magazineDraftFingerprint(source));
    const value = JSON.parse(store.getItem(magazineDraftKey(scope)));
    for (const malformed of ['{broken', JSON.stringify({ ...value, userId: 'other-admin' }), JSON.stringify({ ...value, form: { ...value.form, content: {} } })]) {
        store.setItem(magazineDraftKey(scope), malformed); assert.equal(readMagazineDraft(store, scope, source).kind, 'error');
    }
});
test('이미지 업로드 URL만 보관하고 HTML 안의 파일 바이트·임시 URL을 제외한다', () => {
    const store = storage(); writeMagazineDraft(store, scope, { ...edited, image: 'data:image/png;base64,PRIVATE', authorImage: 'blob:temporary',
        content: '<p>보존할 문구</p><img src="data:image/png;base64,PRIVATE"><div data-images="blob:temporary"></div><img src="/img/home/1.webp">' }, magazineDraftFingerprint(source));
    const value = store.getItem(magazineDraftKey(scope)); assert.ok(!value.includes('PRIVATE')); assert.ok(!value.includes('blob:temporary')); assert.ok(value.includes('/img/home/1.webp'));
});
