import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// 디자인 틀의 늘리고 줄이는 항목(이용자 특전 카드, 2026-11-27 오너 요청): 개수 값·항목 칸 판별·틀과 편집기의 약속.
const load = async (entry) => {
    const out = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
};
const s = await load('src/components/product/designTemplates/sections.ts');
const f = await load('src/components/product/designTemplates/horseTrekFields.ts');

test('특전 개수: 정한 적 없으면 원본 6장, 1~12 안으로만', () => {
    const g = f.PERKS_GROUP;
    assert.equal(s.itemCountOf(undefined, g), 6);
    assert.equal(s.itemCountOf('', g), 6);
    assert.equal(s.itemCountOf('abc', g), 6);
    assert.equal(s.itemCountOf('8', g), 8);
    assert.equal(s.itemCountOf('3', g), 3);
    assert.equal(s.itemCountOf('40', g), 12);
    assert.equal(s.itemCountOf('0', g), 6);
});

test('항목 칸 판별: perk3_title → 3, 복제 접미사 포함, 공항 배너·제목 칸은 항목이 아니다', () => {
    const g = f.PERKS_GROUP;
    assert.equal(s.itemIndexOf(g, 'perk3_title'), 3);
    assert.equal(s.itemIndexOf(g, 'perk12_img@2'), 12);
    assert.equal(s.itemIndexOf(g, 'perk_air_img'), 0);
    assert.equal(s.itemIndexOf(g, 'perks_title'), 0);
    assert.equal(s.itemIndexOf(g, 'perks_count'), 0);
    assert.equal(s.itemIndexOf(g, 'hero_title'), 0);
});

test('틀 정의: 특전 1~12의 사진·제목·설명 칸과 숨김 개수 칸이 있다', () => {
    const keys = new Map(f.horseTrekFields.map((field) => [field.key, field]));
    for (let n = 1; n <= f.PERKS_GROUP.max; n++) for (const tail of ['_img', '_title', '_sub']) assert.ok(keys.has(`perk${n}${tail}`), `perk${n}${tail}`);
    assert.equal(keys.get('perks_count').hidden, true);
    assert.equal(keys.get('perks_count').default, '6');
    assert.equal(keys.get('perk7_title').default, undefined, '추가한 특전은 기본 문구 없이 빈 카드로 시작한다');
    assert.equal(new Set(f.horseTrekFields.map((field) => field.key)).size, f.horseTrekFields.length, '칸 key가 겹치지 않는다');
});

test('PC·휴대폰 틀은 개수만큼 특전 카드를 그리고, 편집기는 추가·삭제를 제공한다', () => {
    for (const file of ['HorseTrekTemplate.tsx', 'HorseTrekMobileTemplate.tsx']) {
        const src = readFileSync(`src/components/product/designTemplates/${file}`, 'utf8');
        assert.match(src, /Array\.from\(\{ length: itemCountOf\(v\('perks_count'\), PERKS_GROUP\) \}, \(_, i\) => i \+ 1\)\.map\(n => \(\n\s*<div key=\{n\}[^\n]*\n\s*<Slot k=\{`perk\$\{n\}_img`\}/, file);
    }
    assert.match(readFileSync('src/components/product/designTemplates/registry.ts', 'utf8'), /itemGroups: \{ '04 이용자 특전': PERKS_GROUP \}/);
    const editor = readFileSync('src/components/admin/DesignTemplateBlockEditor.tsx', 'utf8');
    assert.match(editor, /\.filter\(f => !group \|\| itemIndexOf\(group, f\.key\) <= count\)/, '아직 추가하지 않은 특전의 입력칸은 보이지 않는다');
    assert.match(editor, /const addItem = \(instId: string, defId: string\) => \{/);
    assert.match(editor, /const removeItem = async \(instId: string, defId: string, n: number\) => \{/);
    assert.match(editor, /if \(!await adminConfirm\(/, '삭제는 확인 창을 거친다');
});
