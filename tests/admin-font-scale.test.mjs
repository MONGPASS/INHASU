// 관리자 화면의 글자 크기는 Seed 글자 크기 단계만 쓴다(12.5px·11.5px 같은 중간 크기 금지).
// 어긋난 곳은 `node scripts/check-admin-font-scale.mjs`로 보고, `--fix`로 가장 가까운 단계로 바꾼다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FONT_SCALE, nearestFontSize, scanText, scanAdminFonts, adminFontFiles } from '../scripts/check-admin-font-scale.mjs';

test('관리자 CSS와 인라인 style에 단계에 없는 글자 크기가 없다', () => {
    const files = adminFontFiles();
    assert.ok(files.css.length >= 30 && files.tsx.length >= 50, '관리자 CSS·화면 파일을 실제로 읽는다');
    const report = scanAdminFonts();
    assert.deepEqual(report.map(row => `${row.file}: ${row.found.map(item => item.size + 'px').join(', ')}`), []);
});

test('가장 가까운 단계로 바꾸고, 한가운데면 작은 쪽으로 한다', () => {
    assert.deepEqual(FONT_SCALE, [11, 12, 13, 14, 15, 16, 18, 20, 24, 26, 32, 34, 42, 48]);
    assert.deepEqual([9, 10, 10.5, 11.5, 12.5, 13.5, 14.5, 17, 19, 21, 22, 23, 28, 30, 36, 40, 44].map(nearestFontSize), [11, 11, 11, 11, 12, 13, 14, 16, 18, 20, 20, 24, 26, 32, 34, 42, 42]);
});

test('글자 크기만 고치고 아이콘 크기와 단계에 있는 값은 그대로 둔다', () => {
    const css = '.a { font-size: 12.5px; } .b .material-symbols-outlined { font-size: 21px; } .c { font: 700 11.5px Pretendard; font-size: 14px; }';
    assert.equal(scanText(css, [/(font-size:\s*)(\d+(?:\.\d+)?)(px)/g, /(\bfont:\s*[^;{}]*?\s)(\d+(?:\.\d+)?)(px)/g], true, 'css').text,
        '.a { font-size: 12px; } .b .material-symbols-outlined { font-size: 21px; } .c { font: 700 11px Pretendard; font-size: 14px; }');
    const tsx = '<b style={{ fontSize: 12.5, top: 10.5 }}>a</b><Icon name="x" style={{ fontSize: 30 }} /><i style={{ fontSize: \'13.5px\' }} />';
    const fixed = scanText(tsx, [/(fontSize:\s*)(\d+(?:\.\d+)?)(?=\s*[,}\s])/g, /(fontSize:\s*['"`])(\d+(?:\.\d+)?)(px)/g], true, 'tsx');
    assert.equal(fixed.text, '<b style={{ fontSize: 12, top: 10.5 }}>a</b><Icon name="x" style={{ fontSize: 30 }} /><i style={{ fontSize: \'13px\' }} />');
    assert.equal(fixed.found.length, 2);
});
