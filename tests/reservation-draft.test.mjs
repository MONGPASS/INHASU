import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync, transformSync } from 'esbuild';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import {
    reservationDraftKey, reservationDraftFingerprint, readReservationDraft, writeReservationDraft,
    discardReservationDraft, finishReservationDraftSave, reservationDraftNavigationDecision,
} from '../src/utils/adminReservationDraft.ts';

const scope = { userId: 'local-admin-a', reservationId: 'local-reservation-a' };
const source = { content: { name: '예약 여행', description: '', days: [{ day: 1, date: '', dateMode: 'manual', title: '첫날', activities: [] }],
    documentSettings: { overview: { includedText: '' }, contract: { intro: '', cancellationRows: [] } }, highlights: [] },
    dates: { startDate: '2026-10-20', endDate: '2026-10-22' } };
const edited = { content: { name: '예약별 수정 여행', description: '작성 중 안내', days: [
    { day: 1, date: '10.21 오전', dateMode: 'manual', title: '초원', region: '테렐지', move: '전용차량', dist: '70km',
        items: ['*09:30 공항 픽업', '(개별 점심)', '초원 산책'], retainedSummary: '상품에 있던 요약',
        images: ['/img/day.webp'], activities: [{ time: '09:30', title: '공항 픽업', description: '직접 작성한 설명', images: ['/img/activity.webp'] }],
        retainedActivities: [{ title: '기존 사진 안내', description: '삭제된 항목에서 보관한 내용', images: ['/img/retained.webp'] }],
        meals: { breakfast: '', lunch: '현지식', dinner: '' }, accommodation: { name: '기본 숙소', tags: '개별 욕실', images: ['/img/lodge.webp'], description: '숙소 설명' } },
    { day: 2, date: '', dateMode: 'manual', title: '', items: [], activities: [], accommodation: null },
    ], highlights: [{ name: '거북바위', nameMn: 'Мэлхий хад', desc: '보관할 명소 설명', img: '/img/spot.webp', subImgs: ['/img/sub-1.webp', '/img/sub-2.webp'] }],
    documentSettings: { overview: { includedText: '', extraSetting: '기존 값' }, contract: { intro: '원래 있던 계약 서문을 수정', paymentMethod: '기존 지급 방법',
        paymentDeadline: '', includedText: '현지 가이드', excludedText: '항공권', cancellationRows: [{ period: '기존 취소 시점', fee: '기존 취소 조건' }], signatureNote: '기존 동의 문구' },
        guide: { existingNotice: '가이드용 기존 정보' }, customSection: { preserved: true } } },
    dates: { startDate: '2026-10-21', endDate: '2026-10-23' } };
function memoryStorage() {
    const values = new Map();
    return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const save = (storage, value = edited, mode = 'itinerary') => writeReservationDraft(storage, scope, value, reservationDraftFingerprint(source), mode);

test('서버와 같은 문서를 열거나 모드만 바꾸면 초안을 만들지 않는다', () => {
    const storage = memoryStorage();
    assert.equal(save(storage, source, 'contract').ok, true);
    assert.equal(storage.values.size, 0);
    assert.deepEqual(readReservationDraft(storage, scope, source), { kind: 'empty' });
});

test('일정·수동 날짜·사진·대표 명소·계약 조건과 빈 값이 새 세션에서 그대로 복원된다', () => {
    const storage = memoryStorage();
    const result = save(storage);
    assert.equal(result.ok, true);
    const read = readReservationDraft(storage, scope, source);
    assert.equal(read.kind, 'draft');
    assert.equal(read.conflict, false);
    assert.equal(read.draft.mode, 'itinerary');
    assert.deepEqual(read.draft.content, edited.content);
    assert.deepEqual(read.draft.dates, edited.dates);
    read.draft.content.days[0].activities[0].description = '복원 후 변경';
    assert.equal(readReservationDraft(storage, scope, source).draft.content.days[0].activities[0].description, '직접 작성한 설명');
});

test('계정·예약별로 분리하면서 같은 예약의 일정과 계약은 함께 보관한다', () => {
    const storage = memoryStorage();
    save(storage);
    assert.equal(readReservationDraft(storage, { ...scope, userId: 'other-admin' }, source).kind, 'empty');
    assert.equal(readReservationDraft(storage, { ...scope, reservationId: 'other-booking' }, source).kind, 'empty');
    const contractEdit = structuredClone(edited);
    contractEdit.content.documentSettings.contract.paymentDeadline = '직접 입력한 기한';
    save(storage, contractEdit, 'contract');
    const read = readReservationDraft(storage, scope, source);
    assert.equal(read.draft.mode, 'contract');
    assert.deepEqual(read.draft.content.days, edited.content.days);
    assert.equal(read.draft.content.documentSettings.contract.paymentDeadline, '직접 입력한 기한');
    assert.throws(() => reservationDraftKey({ ...scope, userId: '' }));
});

test('서버 문서·여행 날짜 변경을 충돌로 알리며 배정 자료만 바뀌면 충돌이 아니다', () => {
    const storage = memoryStorage();
    save(storage);
    assert.equal(readReservationDraft(storage, scope, { ...source, content: { ...source.content, name: '다른 관리자가 수정한 제목' } }).conflict, true);
    assert.equal(readReservationDraft(storage, scope, { ...source, dates: { ...source.dates, startDate: '2026-10-22' } }).conflict, true);
    assert.equal(readReservationDraft(storage, scope, { ...source, assignments: { guide: '새 배정 자료' } }).conflict, false);
    assert.deepEqual(readReservationDraft(storage, scope, source).draft.content, edited.content);
});

test('부분 documentSettings·ID 없는 일정·nullable legacy 선택 필드를 그대로 보관하고 새 계약 문구를 채우지 않는다', () => {
    const storage = memoryStorage();
    const legacy = { content: { name: '기존 여행', description: '', days: [{ title: '기존 일차', date: '', images: null, activities: null, meals: null, accommodation: null }],
        documentSettings: { contract: { intro: null, cancellationRows: null } }, highlights: null }, dates: { startDate: '', endDate: '' } };
    save(storage, legacy);
    const read = readReservationDraft(storage, scope, source);
    assert.equal(read.kind, 'draft');
    assert.deepEqual(read.draft.content, legacy.content);
    assert.equal(read.draft.content.documentSettings.contract.intro, null);
});

test('손상 JSON·계정/예약 불일치·잘못된 일정·취소 규정은 거부하고 저장된 사본을 덮지 않는다', () => {
    const storage = memoryStorage();
    save(storage);
    const original = JSON.parse(storage.getItem(reservationDraftKey(scope)));
    const malformed = ['{broken', JSON.stringify({ ...original, userId: 'other-admin' }), JSON.stringify({ ...original, reservationId: 'other-booking' }),
        JSON.stringify({ ...original, content: { ...original.content, days: [null] } }),
        JSON.stringify({ ...original, content: { ...original.content, days: [{ title: 'broken', activities: [null] }] } }),
        JSON.stringify({ ...original, content: { ...original.content, documentSettings: { contract: { cancellationRows: [null] } } } })];
    for (const raw of malformed) {
        storage.setItem(reservationDraftKey(scope), raw);
        assert.equal(readReservationDraft(storage, scope, source).kind, 'invalid');
        assert.equal(storage.getItem(reservationDraftKey(scope)), raw);
    }
});

test('이미지 파일 bytes·base64·blob 임시 주소를 보관하지 않고 업로드 URL만 남긴다', () => {
    const storage = memoryStorage();
    const value = structuredClone(edited);
    value.content.days[0].images = ['data:image/png;base64,LOCAL', 'blob:temporary', '/img/real.webp'];
    value.file = new Blob(['private-image-bytes']);
    save(storage, value);
    const raw = storage.getItem(reservationDraftKey(scope));
    assert.ok(!raw.includes('base64') && !raw.includes('blob:') && !raw.includes('private-image-bytes'));
    assert.deepEqual(readReservationDraft(storage, scope, source).draft.content.days[0].images, ['/img/real.webp']);
});

test('quota 오류는 이전 사본을 유지하고 재시도하면 새 revision으로 보관한다', () => {
    const storage = memoryStorage();
    const first = save(storage);
    const prior = storage.getItem(reservationDraftKey(scope));
    const setItem = storage.setItem;
    storage.setItem = () => { throw new DOMException('full', 'QuotaExceededError'); };
    const newer = structuredClone(edited); newer.content.name = '최신 입력';
    const failed = save(storage, newer);
    assert.equal(failed.ok, false); assert.match(failed.error, /저장 공간/);
    assert.equal(storage.getItem(reservationDraftKey(scope)), prior);
    storage.setItem = setItem;
    const retry = save(storage, newer);
    assert.equal(retry.ok, true); assert.notEqual(retry.revision, first.revision);
    assert.equal(readReservationDraft(storage, scope, source).draft.content.name, '최신 입력');
});

test('서버 저장 실패는 초안을 남기고 저장 성공만 해당 revision을 삭제한다', () => {
    const storage = memoryStorage();
    const result = save(storage);
    assert.equal(finishReservationDraftSave(storage, scope, false, result.revision).ok, true);
    assert.equal(readReservationDraft(storage, scope, source).kind, 'draft');
    assert.equal(finishReservationDraftSave(storage, scope, true, result.revision).ok, true);
    assert.equal(readReservationDraft(storage, scope, source).kind, 'empty');
});

test('닫힌 편집기의 늦은 저장 완료는 다시 연 편집기의 새 초안을 삭제하지 않는다', () => {
    const storage = memoryStorage();
    const old = save(storage);
    const newer = structuredClone(edited); newer.content.name = '다시 열어 작성한 초안';
    const recent = save(storage, newer);
    finishReservationDraftSave(storage, scope, true, old.revision);
    assert.equal(readReservationDraft(storage, scope, source).draft.revision, recent.revision);
    assert.equal(readReservationDraft(storage, scope, source).draft.content.name, newer.content.name);
});

test('저장된 서버 문서와 동일한 초안은 복원 선택을 다시 표시하지 않는다', () => {
    const storage = memoryStorage();
    save(storage);
    assert.deepEqual(readReservationDraft(storage, scope, edited), { kind: 'empty' });
});

test('메뉴·Back·예약 query 이동은 마지막 입력을 보관하고 quota에서 차단한다', () => {
    const current = { pathname: '/admin/reservations', search: '?open=local-reservation-a' };
    const next = { pathname: '/admin/reservations', search: '?open=local-reservation-b' };
    const storage = memoryStorage();
    assert.deepEqual(reservationDraftNavigationDecision(current, next, false, () => save(storage)), { blocked: false });
    assert.equal(readReservationDraft(storage, scope, source).kind, 'draft');
    assert.equal(reservationDraftNavigationDecision(current, { pathname: '/admin', search: '' }, false, () => ({ ok: false, error: '공간 부족' })).reason, 'draft_storage_failure');
    assert.deepEqual(reservationDraftNavigationDecision(current, next, true, () => ({ ok: true })), { blocked: true, reason: 'busy' });
    assert.deepEqual(reservationDraftNavigationDecision(current, current, true, () => { throw new Error('not called'); }), { blocked: false });
});

test('편집기를 닫은 상태의 발송 busy와 주문·운영 변경도 부모 단일 보호로 차단한다', () => {
    const current = { pathname: '/admin/reservations', search: '?open=local-reservation-a' };
    const next = { pathname: '/admin/products', search: '' };
    // No mounted editor/flush callback is required while mail/publication is in flight.
    assert.deepEqual(reservationDraftNavigationDecision(current, next, true, () => ({ ok: true })), { blocked: true, reason: 'busy' });
    assert.deepEqual(reservationDraftNavigationDecision(current, next, false, () => ({ ok: true }), true), { blocked: true, reason: 'other_unsaved_changes' });
    assert.equal(reservationDraftNavigationDecision(current, next, false, () => ({ ok: false, error: '공간 부족' }), true).reason, 'draft_storage_failure');
});

test('저장소 읽기·삭제 불가를 복원 실패와 구분해 보고한다', () => {
    const storage = memoryStorage();
    assert.equal(readReservationDraft({ ...storage, getItem: () => { throw new Error('disabled'); } }, scope, source).kind, 'unavailable');
    assert.equal(discardReservationDraft({ ...storage, removeItem: () => { throw new Error('disabled'); } }, scope).ok, false);
});

test('실제 편집기는 data router에서 nullable legacy 일정·빈 계약 설정을 안전하게 표시한다', () => {
    const bundle = buildSync({ entryPoints: [fileURLToPath(new URL('../src/components/admin/ReservationInlineEditor.tsx', import.meta.url))],
        bundle: true, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', write: false,
        loader: { '.webp': 'dataurl', '.jpg': 'dataurl', '.png': 'dataurl', '.svg': 'dataurl', '.css': 'empty' }, define: { 'import.meta.env': '{}' } }).outputFiles[0].text;
    const module = { exports: {} };
    new Function('require', 'module', 'exports', bundle)(createRequire(import.meta.url), module, module.exports);
    const { ReservationInlineEditor } = module.exports;
    const content = { name: '레거시 문서', description: '', days: [{ title: '기존 일차', date: '', activities: null, meals: null, accommodation: null }],
        documentSettings: { contract: { intro: null, cancellationRows: null } }, highlights: null };
    for (const mode of ['itinerary', 'contract']) for (const externalActions of [false, true]) {
        const router = createMemoryRouter([{ path: '*', element: React.createElement(ReservationInlineEditor, { reservationId: scope.reservationId,
            adminUserId: scope.userId, initialContent: content, mode, externalActions, startDate: '', endDate: '', onSave: async () => true, onDirtyChange() {}, onClose() {} }) }],
            { initialEntries: ['/admin/reservations?open=' + scope.reservationId] });
        const html = renderToString(React.createElement(RouterProvider, { router }));
        assert.ok(html.includes('reservation-inline-' + scope.reservationId));
        assert.ok(!html.includes('본 여행 조건서'));
        assert.ok(html.includes('inert=""'));
        assert.ok(html.includes('ri-draft-status'));
        assert.equal(html.includes('type="submit"'), !externalActions, '외부 작업 도구를 쓰면 내부 저장 버튼을 중복 표시하지 않는다');
        assert.equal(html.includes('편집 닫기'), !externalActions);
        assert.equal(html.includes('저장 전 초안 미리보기'), !externalActions);
        if (externalActions && mode === 'itinerary') {
            assert.ok(html.includes('일정 편집 바로가기'));
            assert.ok(html.includes('ri-spots-collapsible'));
            assert.match(html, /0(?:<!-- -->)?개 선택/);
        }
        router.dispose();
    }
});

test('같은 일차를 다시 요청하면 실제 편집기 effect가 revision마다 이동하고 잠금 해제·위젯 로드를 기다린다', () => {
    const source = readFileSync(new URL('../src/components/admin/ReservationInlineEditor.tsx', import.meta.url), 'utf8');
    const start = source.search(/useEffect\(\(\) => \{\r?\n\s*const requestedDay = p.requestedDay;/);
    assert.notEqual(start, -1);
    const actualEffect = new Function('context', `const {p,locked,activeMode,draft,jumpToDay,editorRef,requestedDayApplied,useEffect,MutationObserver,requestAnimationFrame,cancelAnimationFrame}=context;\n${source.slice(start, source.indexOf('    const contract =', start))}`);
    const jumps = [], requestedDayApplied = { current: null };
    const frames = new Map();
    let previousDeps, cleanup, observer, ready = true, nextFrame = 0;
    const paint = () => { const pending = [...frames.entries()]; frames.clear(); pending.forEach(([, run]) => run()); };
    const jumpToDay = (index, behavior) => { if (!ready) return false; jumps.push({ index, behavior }); return true; };
    const render = (revision, locked = false, count = 3) => actualEffect({
        p: { reservationId: scope.reservationId, externalActions: true, requestedDay: 2, requestedDayRevision: revision },
        locked, activeMode: 'itinerary', draft: { days: Array.from({ length: count }, () => ({})) },
        editorRef: { current: { querySelectorAll: () => ready ? [{}, {}, {}] : [] } }, requestedDayApplied,
        jumpToDay,
        requestAnimationFrame: run => { const id = ++nextFrame; frames.set(id, run); return id; },
        cancelAnimationFrame: id => frames.delete(id),
        useEffect: (run, deps) => {
            if (previousDeps?.every((value, index) => Object.is(value, deps[index]))) return;
            cleanup?.(); previousDeps = deps; cleanup = run();
        },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; observer = this; }
            observe() { this.observing = true; }
            disconnect() { this.observing = false; }
        },
    });
    render(0); render(0);
    assert.equal(jumps.length, 0);
    paint(); assert.equal(jumps.length, 0, '첫 프레임에는 DOM과 포털 레이아웃을 기다린다');
    paint(); assert.deepEqual(jumps, [{ index: 1, behavior: 'auto' }]);
    render(0, false, 4); paint(); paint();
    assert.equal(jumps.length, 1, '내부 일정 편집으로 재렌더되어도 사용자 위치를 되돌리지 않는다');
    render(1); paint(); paint();
    assert.deepEqual(jumps, [{ index: 1, behavior: 'auto' }, { index: 1, behavior: 'auto' }], '같은 일차의 새 요청에는 다시 이동한다');
    render(2, true); assert.equal(jumps.length, 2);
    ready = false; render(2);
    assert.equal(observer.observing, true);
    ready = true; observer.callback();
    paint(); assert.equal(jumps.length, 2);
    paint(); assert.equal(jumps.length, 3);
    assert.equal(observer.observing, false);
    render(3); paint(); cleanup?.(); paint();
    assert.equal(jumps.length, 3, '이탈하면 대기 중인 두 번째 프레임을 취소한다');
    cleanup?.();
});

test('일차 바로가기는 접힌 편집 본문을 먼저 펼친 뒤 스크롤하고 해당 목적지에 포커스를 준다', () => {
    const source = readFileSync(new URL('../src/components/admin/ReservationInlineEditor.tsx', import.meta.url), 'utf8');
    const start = source.indexOf('    const jumpToDay = '), end = source.indexOf('    const requestedDayApplied', start);
    assert.ok(start >= 0 && end > start);
    const { code } = transformSync(source.slice(start, end), { loader: 'ts' });
    const calls = []; let collapsed = true;
    const day = {
        querySelector(selector) {
            if (selector === '.day-toggle[aria-expanded="false"]') return collapsed ? { click: () => { collapsed = false; calls.push('expand'); } } : null;
            assert.equal(selector, 'input.dest');
            return { focus: options => { assert.equal(collapsed, false); assert.deepEqual(options, { preventScroll: true }); calls.push('focus'); } };
        },
        scrollIntoView(options) { assert.equal(collapsed, false); calls.push(['scroll', options]); },
    };
    const ref = { current: { querySelectorAll: selector => { assert.equal(selector, '.day-edit'); return [{}, day]; } } };
    const jump = new Function('useCallback', 'editorRef', code + '\nreturn jumpToDay;')(callback => callback, ref);
    assert.equal(jump(1, 'auto'), true);
    assert.deepEqual(calls, ['expand', ['scroll', { behavior: 'auto', block: 'start' }], 'focus']);
    calls.length = 0; assert.equal(jump(1), true);
    assert.deepEqual(calls, [['scroll', { behavior: 'smooth', block: 'start' }], 'focus']);
    calls.length = 0; assert.equal(jump(8), false); assert.deepEqual(calls, []);
});
