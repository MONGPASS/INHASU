// 일차 카드(견적서 만들기 · 견적 예약 일정표 편집 · 상품 예약 일정표 편집)는 public/quote-day-editor.css의
// ‘공통 모양(정본)’ 하나로 그린다. 화면별 CSS가 카드 모양을 다시 정해 화면마다 달라지지 않게 한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const shared = read('public/quote-day-editor.css');
const canon = shared.slice(shared.indexOf('일차 카드 공통 모양(정본)'));

test('일차 카드의 모양은 공통 파일의 정본 블록이 정하고 화면별 덮어쓰기를 이긴다', () => {
    assert.ok(canon.length > 1000, '정본 블록이 있다');
    for (const part of ['.day-edit {', '.dh .badge {', '.dh input {', 'input.ddate {', '.dh .day-toggle {', '.dh .day-del {', '.dh .day-del::before {', '.day-body {', '.snip-sel {', 'textarea.items {', '.row.c2 input {', '.row.c2 .qde-field-label {', '.day-add {']) {
        const rule = canon.split('\n').find(line => line.includes(part));
        assert.ok(rule, part); assert.match(rule, /!important/, `${part}: 화면별 규칙보다 우선`);
    }
    assert.doesNotMatch(canon.replace(/url\("data:[^"]*"\)/g, ''), /#[0-9a-fA-F]{3,8}\b/, '색은 공통 변수만 쓴다');
    assert.match(canon, /\.dh \{[^}]*min-height:0 !important[^}]*border:0 !important/, '견적 도구 서랍 머리(.dh) 규칙이 일차 머리에 묻지 않는다');
});

test('견적서 만들기 전용 일차 카드 덮어쓰기를 관리자 공통 CSS에 다시 두지 않는다', () => {
    assert.doesNotMatch(read('public/admin-tools.css'), /#dayList\.quote-day-editor/);
    for (const page of ['견적만들기', '예약관리']) assert.match(read(`public/${page}.html`), /<link rel="stylesheet" href="\/quote-day-editor\.css">/, page);
    assert.match(read('src/components/admin/QuoteDayEditor.tsx') + read('src/components/admin/ReservationInlineEditor.tsx'), /quote-day-editor\.css/, '상품 예약 편집기도 같은 파일을 쓴다');
});
