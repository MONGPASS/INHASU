// 관리자 디자인 규칙 위반이 늘어나지 않게 막는다(줄이기만 하는 기준선, "ratchet").
// 수치·기준선: scripts/check-admin-design.mjs, scripts/admin-design-baseline.json, 현황: docs/admin-design-adoption.md
//  - 기준선에 있는 파일: 생 <button>·<input>·<table>, 인라인 style, 숫자 크기, 직접 색, !important, 기본 확인창 수가 기준선보다 늘면 실패
//  - 기준선에 없는 새 파일: 처음부터 우리 관리자 부품(components/admin/ui)과 --adm-* 변수만 쓴다(생 부품·숫자 크기·직접 색·!important 0)
// 위반을 줄였으면 `node scripts/check-admin-design.mjs --write-baseline --md`로 기준선과 현황 문서를 함께 낮춘다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { measureAll, BUDGET_KEYS, NEW_FILE_LIMIT, BASELINE_PATH } from '../scripts/check-admin-design.mjs';

const baseline = JSON.parse(readFileSync(new URL(`../${BASELINE_PATH}`, import.meta.url), 'utf8'));
const files = measureAll();

const LABEL = {
    rawButton: '생 <button>(AdminButton·AdminIconButton·AdminTextButton을 쓴다)',
    rawField: '생 <input>/<select>/<textarea>(AdminTextInput·AdminSelect·AdminTextArea·AdminCheckbox·AdminSearch를 쓴다)',
    rawTable: '생 <table>(AdminTable·AdminDataTable을 쓴다)',
    inlineStyle: '인라인 style={{}}',
    px: '숫자로 적은 크기(--adm-* 변수를 쓴다)',
    rawPx: 'CSS에 숫자로 적은 글자·모서리·높이·여백(--adm-* 변수를 쓴다)',
    hex: '직접 적은 색(--adm-* 변수를 쓴다)',
    important: '!important',
    nativeDialog: '브라우저 기본 확인창(await adminConfirm() / AdminDialog를 쓴다)',
};

test('기존 관리자 파일은 디자인 규칙 위반이 기준선보다 늘지 않는다', () => {
    const over = [];
    for (const [file, m] of Object.entries(files)) {
        const base = baseline[file];
        if (!base) continue;
        for (const key of BUDGET_KEYS[m.kind]) {
            if (m[key] > (base[key] ?? 0)) over.push(`${file}: ${LABEL[key]} ${base[key] ?? 0} → ${m[key]}`);
        }
    }
    assert.deepEqual(over, [], '규칙을 어긴 코드가 늘었다. 공통 부품·변수로 바꾸거나, 정말 필요하면 docs/admin-design-system.md 7절에 예외를 적고 기준선을 고친다.');
});

test('새 관리자 파일은 처음부터 우리 관리자 부품과 공통 변수만 쓴다', () => {
    const bad = [];
    for (const [file, m] of Object.entries(files)) {
        if (baseline[file]) continue;
        for (const [key, max] of Object.entries(NEW_FILE_LIMIT[m.kind])) {
            if (m[key] > max) bad.push(`${file}: ${LABEL[key]} ${m[key]}개`);
        }
    }
    assert.deepEqual(bad, []);
});

test('기준선은 지금 코드보다 느슨하지 않다(줄인 만큼 기준선도 낮춘다)', () => {
    const loose = [];
    for (const [file, base] of Object.entries(baseline)) {
        const m = files[file];
        if (!m) { loose.push(`${file}: 없는 파일이 기준선에 남아 있다`); continue; }
        for (const key of BUDGET_KEYS[m.kind]) if ((base[key] ?? 0) > m[key]) loose.push(`${file}: ${key} 기준선 ${base[key]} > 현재 ${m[key]}`);
    }
    assert.deepEqual(loose, [], '`node scripts/check-admin-design.mjs --write-baseline --md`를 실행해 기준선을 낮춘다');
});
