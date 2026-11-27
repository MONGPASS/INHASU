import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

// 모든 상품 공통 섹션(유의사항): 사이트 공통값이 상품에 따로 복사된 값보다 먼저다(2026-11-27 오너 요청 — 상품마다 다시 올리지 않게).
const load = async (entry) => {
    const out = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
};
const s = await load('src/components/product/designTemplates/sections.ts');

const def = {
    fields: [{ key: 'tour_banner', section: '19 예약 전 확인사항' }, { key: 'inc_items', section: '17 포함/불포함' }],
    sectionDefs: [{ id: '17 포함/불포함', fieldSections: ['17 포함/불포함'] }, { id: '19 예약 전 확인사항', fieldSections: ['19 예약 전 확인사항'] }],
    sharedSections: ['19 예약 전 확인사항'],
};

test('공통 섹션의 칸만 공통값을 먼저 쓴다(복제 섹션 접미사 포함)', () => {
    assert.equal(s.isSharedField(def, 'tour_banner'), true);
    assert.equal(s.isSharedField(def, 'tour_banner@2'), true);
    assert.equal(s.isSharedField(def, 'inc_items'), false);
    assert.equal(s.isSharedField({ ...def, sharedSections: undefined }, 'tour_banner'), false);
    assert.equal(s.isSharedField(undefined, 'tour_banner'), false);
});

test('승마 트레킹 틀은 예약 전 확인사항을 공통 섹션으로, 상세·미리보기·편집기가 같은 규칙을 쓴다', () => {
    assert.match(readFileSync('src/components/product/designTemplates/registry.ts', 'utf8'), /sharedSections: \['19 예약 전 확인사항'\]/);
    assert.match(readFileSync('src/components/product/designTemplates/DesignBlockView.tsx', 'utf8'), /if \(isSharedField\(def, key\)\) \{/, '미리보기·상세 그림: 공통값 먼저');
    assert.match(readFileSync('src/components/product/detail/productDetailData.ts', 'utf8'), /if \(isSharedField\(def, key\) && shared\[key\]\) return shared\[key\];/, '상세 접기: 공통값 먼저');
    assert.match(readFileSync('src/components/admin/DesignTemplateBlockEditor.tsx', 'utf8'), /if \(isSharedField\(def, entry\.key\)\) \{ adminNotify\(/, '디자인 블록에서 상품마다 고치지 않는다');
    const tab = readFileSync('src/components/admin/ProductNoticeEditor.tsx', 'utf8');
    assert.match(tab, /saveDesignDefaults\(\{ \.\.\.all, \[def\.id\]: next \}\)/, '유의사항 탭은 사이트 공통값에 저장한다');
});
