import test from 'node:test';
import assert from 'node:assert/strict';
import { placePopover, commitValue, scopeSuffix, unscopedKey, fieldSelector, isCommitKey, clampSectionAnchor } from '../src/components/admin/designEditor/inlineEdit.ts';

const box = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const viewport = { width: 1200, height: 800 };

test('commitValue: 빈 값·원본과 같은 값은 키를 지우고 다른 값만 저장한다', () => {
    const values = { a: '1', b: '2' };
    assert.deepEqual(commitValue(values, 'a', ''), { b: '2' });
    assert.deepEqual(commitValue(values, 'a', '원본', '원본'), { b: '2' });
    assert.deepEqual(commitValue(values, 'c', '새 문구', '원본'), { a: '1', b: '2', c: '새 문구' });
    assert.deepEqual(values, { a: '1', b: '2' }, '원본 객체는 바꾸지 않는다');
});

test('placePopover: 아래 공간이 모자라면 위로 뒤집고 좌우는 화면 안으로 민다', () => {
    const below = placePopover(box(100, 100, 200, 30), { width: 360, height: 200 }, viewport);
    assert.equal(below.above, false); assert.equal(below.top, 138); assert.equal(below.left, 100);
    const above = placePopover(box(100, 700, 200, 30), { width: 360, height: 200 }, viewport);
    assert.equal(above.above, true); assert.equal(above.bottom, 800 - 700 + 8);
    const clamped = placePopover(box(1100, 100, 80, 30), { width: 360, height: 200 }, viewport);
    assert.equal(clamped.left, 1200 - 360 - 8);
    assert.equal(placePopover(box(-50, 100, 80, 30), { width: 360, height: 200 }, viewport).left, 8);
});

test('scoped key 규칙은 sections.ts의 scopedKey와 같다 (`key@2`만 접미사)', () => {
    assert.equal(scopeSuffix('ger_title1@2'), '@2'); assert.equal(unscopedKey('ger_title1@2'), 'ger_title1');
    assert.equal(scopeSuffix('ger_title1'), ''); assert.equal(unscopedKey('ger_title1'), 'ger_title1');
    assert.equal(scopeSuffix('mail@home'), '', '숫자가 아닌 접미사는 scope가 아니다');
    assert.equal(fieldSelector('ger_title1@2'), '[data-df-scope="@2"] [data-df="ger_title1"]');
    assert.equal(fieldSelector('ger_title1'), '[data-df-scope=""] [data-df="ger_title1"]');
});

test('isCommitKey: 한국어 조합 중 Enter는 무시하고 여러 줄 칸은 Ctrl/⌘+Enter만 확정한다', () => {
    assert.equal(isCommitKey({ key: 'Enter' }, false), true);
    assert.equal(isCommitKey({ key: 'Enter', isComposing: true }, false), false);
    assert.equal(isCommitKey({ key: 'Enter', nativeEvent: { isComposing: true } }, false), false);
    assert.equal(isCommitKey({ key: 'Enter', shiftKey: true }, false), false);
    assert.equal(isCommitKey({ key: 'Enter' }, true), false);
    assert.equal(isCommitKey({ key: 'Enter', ctrlKey: true }, true), true);
    assert.equal(isCommitKey({ key: 'Enter', metaKey: true }, true), true);
    assert.equal(isCommitKey({ key: 'a', ctrlKey: true }, true), false);
});

test('clampSectionAnchor: 섹션이 미리보기 밖으로 스크롤돼도 도구줄은 보이는 영역 안에 둔다', () => {
    const container = box(100, 200, 800, 500);
    assert.deepEqual(clampSectionAnchor(box(100, 100, 800, 300), container), { top: 208, right: 892 });
    assert.deepEqual(clampSectionAnchor(box(100, 300, 1000, 300), container), { top: 308, right: 892 });
});
