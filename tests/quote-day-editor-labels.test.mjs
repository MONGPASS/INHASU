import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const widgetSource = fs.readFileSync(new URL('../public/quote-day-editor.js', import.meta.url), 'utf8');
const load = () => {
    const context = vm.createContext({ AbortController });
    vm.runInContext(widgetSource, context);
    return context.QuoteDayEditor;
};
const classList = () => {
    const values = new Set();
    return { add: (...names) => names.forEach(name => values.add(name)), remove: (...names) => names.forEach(name => values.delete(name)), contains: name => values.has(name) };
};
function element(document) {
    const listeners = new Map();
    return { value: '', dataset: {}, classList: classList(), disabled: false, innerHTML: '', textContent: '', attributes: {},
        addEventListener(name, fn, { signal }) { (listeners.get(name) || (listeners.set(name, []), listeners.get(name))).push({ fn, signal }); },
        setAttribute(name, value) { this.attributes[name] = value; },
        focus() { document.activeElement = this; },
        dispatch(name, extra = {}) { const event = { target: this, preventDefault() {}, ...extra }; listeners.get(name)?.forEach(({ fn, signal }) => { if (!signal.aborted) fn(event); }); },
    };
}
// This fixture exercises the shipped widget against its existing selector/event
// contract. Capture the actual generated HTML to validate label associations;
// retain individual nodes so updates, focus, locking and portal slots are tested.
function host() {
    const document = { activeElement: null }, root = { ownerDocument: document, classList: classList(), writes: 0, markup: '', cards: [], add: null,
        querySelectorAll(selector) { assert.equal(selector, '.day-edit'); return this.cards; },
        querySelector(selector) { assert.equal(selector, '.day-add'); return this.add; },
        replaceChildren() { this.cards = []; this.markup = ''; this.add = null; },
    };
    Object.defineProperty(root, 'innerHTML', { get() { return root.markup; }, set(markup) {
        root.markup = markup; root.writes++;
        root.cards = [...markup.matchAll(/class="day-edit"/g)].map(() => {
            const card = element(document), controls = Object.fromEntries(['ddate', 'dest', 'move', 'items', 'stay', 'meals', 'snip-sel', 'day-del', 'drag-handle', 'badge', 'quote-day-extra'].map(name => [name, element(document)]));
            card.controls = controls;
            card.querySelector = selector => controls[selector.slice(1)];
            card.querySelectorAll = selector => {
                assert.equal(selector, '.dh > input, .dh > button, .snip-sel, textarea.items, .row.c2 > input');
                return ['ddate', 'dest', 'move', 'items', 'stay', 'meals', 'snip-sel', 'day-del'].map(name => controls[name]);
            };
            return card;
        });
        root.add = element(document);
    } });
    return root;
}
const days = () => [{ d: 1, date: '', dest: '울란바토르', move: '이동 2시간', dist: '(100 km)', items: ['*공항 픽업', '(선택 일정)'], stay: { name: '기본 캠프', tags: ['개별 욕실'] }, meals: ['조식', '중식', '석식'] },
    { d: 2, date: '직접 쓴 날짜', dest: '테를지', move: '', dist: '', items: [], stay: { name: '', tags: [] }, meals: [] }];
const plain = value => JSON.parse(JSON.stringify(value));

test('실제 공유 일정 위젯의 보이는 라벨은 모든 필드와 연결되고 여러 편집기의 id도 겹치지 않는다', () => {
    const editor = load(), first = host(), second = host();
    editor.mount(first, { days: days(), extras: true });
    editor.mount(second, { days: days().slice(0, 1), extras: true });
    const allIds = [];
    for (const root of [first, second]) {
        const fields = [...root.markup.matchAll(/<(?:input|select|textarea) id="([^"]+)" class="([^"]+)" aria-label="([^"]+)"/g)];
        const labels = [...root.markup.matchAll(/<label class="qde-field-label qde-label-([^"]+)" for="([^"]+)">([^<]+)<\/label>/g)];
        assert.equal(fields.length, root.cards.length * 7); assert.equal(labels.length, fields.length);
        assert.equal(new Set(fields.map(field => field[1])).size, fields.length);
        for (const label of labels) assert.equal(fields.filter(field => field[1] === label[2]).length, 1, label[3]);
        assert.deepEqual(labels.slice(0, 7).map(label => label[3]), ['날짜', '방문 지역', '이동 시간·거리', '저장된 일정 불러오기', '상세 일정', '일정표 숙소', '식사']);
        assert.ok(fields.every(field => /일차/.test(field[3])), '기존 일차별 접근성 이름을 유지한다');
        assert.equal([...root.markup.matchAll(/class="quote-day-extra"/g)].length, root.cards.length);
        allIds.push(...fields.map(field => field[1]));
    }
    assert.equal(new Set(allIds).size, allIds.length);
});

test('라벨이 추가된 위젯도 입력·프리셋·잠금과 키보드 순서 변경을 원래 콜백에 전달한다', () => {
    const editor = load(), root = host(), calls = [];
    const widget = editor.mount(root, { days: days(), snippets: { '저장 일정': { cat: '중앙', dest: '테를지' } }, extras: true,
        onField: (...args) => calls.push(['field', ...plain(args)]), onSnippet: (...args) => calls.push(['snippet', ...args]),
        onReorder: (...args) => calls.push(['reorder', ...args]), onDelete: index => calls.push(['delete', index]), onAdd: () => calls.push(['add']) });
    const controls = root.cards[0].controls;
    controls.items.value = '*중요 일정\n\n(선택 일정)\n다음 일정'; controls.items.dispatch('input');
    controls.move.value = '이동 4시간 (200 km)'; controls.move.dispatch('input');
    controls.stay.value = '새 캠프'; controls.stay.dispatch('input');
    controls.meals.value = '조식, 현지식, 캠프식'; controls.meals.dispatch('input');
    controls['snip-sel'].value = '저장 일정'; controls['snip-sel'].dispatch('change');
    controls['day-del'].dispatch('click'); root.add.dispatch('click');
    controls['drag-handle'].dispatch('keydown', { key: 'ArrowDown' });
    assert.deepEqual(calls, [['field', 0, 'items', ['*중요 일정', '(선택 일정)', '다음 일정']],
        ['field', 0, 'move', { move: '이동 4시간', dist: '(200 km)' }], ['field', 0, 'stay', { name: '새 캠프', tags: ['개별 욕실'] }],
        ['field', 0, 'meals', ['조식', '현지식', '캠프식']], ['snippet', 0, '저장 일정'], ['delete', 0], ['add'], ['reorder', 0, 1]]);
    assert.equal(controls['snip-sel'].value, '');
    widget.update({ disabled: true });
    for (const name of ['ddate', 'dest', 'move', 'items', 'stay', 'meals', 'snip-sel', 'day-del']) assert.equal(controls[name].disabled, true, name);
    assert.equal(root.add.disabled, true); assert.equal(controls['drag-handle'].tabIndex, -1);
    const count = calls.length; controls.items.dispatch('input'); controls['day-del'].dispatch('click'); root.add.dispatch('click');
    controls['drag-handle'].dispatch('keydown', { key: 'ArrowDown' }); assert.equal(calls.length, count);
    widget.update({ disabled: false }); assert.equal(controls.items.disabled, false); assert.equal(root.add.disabled, false);
});

test('입력 중 갱신은 카드·포털 자리·활성 textarea의 빈 줄과 선택 위치를 유지한다', () => {
    const editor = load(), root = host(), widget = editor.mount(root, { days: days(), extras: true });
    const card = root.cards[0], slot = card.controls['quote-day-extra'], input = card.controls.items, originalMarkup = root.markup;
    input.value = '직접 입력\n\n'; input.selectionStart = input.selectionEnd = 7; input.focus();
    widget.update({ days: [{ ...days()[0], items: ['서버 재표시 값'] }, days()[1]] });
    assert.equal(root.writes, 1); assert.equal(root.markup, originalMarkup); assert.equal(root.cards[0], card);
    assert.equal(card.controls['quote-day-extra'], slot); assert.equal(input.value, '직접 입력\n\n'); assert.equal(input.selectionStart, 7);
    widget.update({ forceValues: true }); assert.equal(input.value, '서버 재표시 값');
    widget.destroy(); assert.equal(root.cards.length, 0); assert.equal(root.classList.contains('quote-day-editor'), false);
});
