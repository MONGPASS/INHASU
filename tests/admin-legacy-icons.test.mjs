// 관리자 아이콘은 당근 Seed(2026-11-24). 예전 이름으로 부르는 두 부품(DashboardIcon·console/Icon)은
// ui/legacyIconNames.ts 표로 Seed 모양을 그린다. 이 테스트는 표가 빠진 이름 없이 맞고, 예전 부품을 새로 쓰지 않는지 본다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const walk = dir => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const rel = `${dir}/${entry.name}`;
    return entry.isDirectory() ? walk(rel) : /\.(tsx?|mjs)$/.test(entry.name) ? [rel] : [];
});
const legacy = read('src/components/admin/ui/legacyIconNames.ts');
const material = legacy.slice(legacy.indexOf('SEED_FOR_MATERIAL'));
const materialKeys = new Set([...material.matchAll(/\b([a-z][a-z0-9_]*):\s*Icon[A-Z]/g)].map(m => m[1]));
const iconExports = new Set([...read('src/components/admin/ui/AdminIcons.tsx').matchAll(/export const (Icon[A-Za-z]+)/g)].map(m => m[1]));

// 지금 예전 부품을 가져오는 파일(화면을 Seed로 다시 짤 때 Icon*으로 바꾸고 이 목록에서 뺀다). 새 파일은 Icon*을 바로 쓴다.
const LEGACY_IMPORTERS = new Set([
    'src/components/admin/Admin3DIcon.tsx',
    'src/components/admin/CustomerKakaoActions.tsx',
    'src/components/admin/DesignTemplateBlockEditor.tsx',
    'src/components/admin/ReservationInlineEditor.tsx',
    'src/components/admin/accommodation/LodgeAssignBoard.tsx',
    'src/components/admin/adminNav.ts',
    'src/components/admin/dashboard/TrafficSources.tsx',
    'src/components/admin/v7/ReservationDetailV7.tsx',
    'src/components/admin/v7/v7Ui.tsx',
    'src/pages/AdminAccommodationOps.tsx',
    'src/pages/AdminAssignment.tsx',
    'src/pages/AdminBannerManage.tsx',
    'src/pages/AdminCategoryManage.tsx',
    'src/pages/AdminDashboard.tsx',
    'src/pages/AdminMagazineManage.tsx',
    'src/pages/AdminProductManage.tsx',
    'src/pages/AdminQuoteDesk.tsx',
    'src/pages/AdminQuoteManage.tsx',
    'src/pages/AdminReservationManage.tsx',
    'src/pages/AdminTemplateManage.tsx',
]);
const importsLegacy = source => /from ['"][^'"]*(\/DashboardIcon|console\/Icon)['"]/.test(source);

test('예전 아이콘 부품(DashboardIcon·console/Icon)을 새 파일에서 가져오지 않는다 — 새 코드는 Icon*(Seed)', () => {
    const files = [...walk('src/pages'), ...walk('src/components')].filter(file => !/dashboard\/DashboardIcon\.tsx$|console\/Icon\.tsx$/.test(file));
    const now = files.filter(file => importsLegacy(read(file)));
    const added = now.filter(file => !LEGACY_IMPORTERS.has(file));
    assert.deepEqual(added, [], `새로 예전 아이콘 부품을 쓰는 파일: ${added.join(', ')}`);
    const stale = [...LEGACY_IMPORTERS].filter(file => !now.includes(file));
    assert.deepEqual(stale, [], `더는 예전 부품을 쓰지 않으니 목록에서 빼 주세요: ${stale.join(', ')}`);
});

test('console/Icon으로 부르는 Material 이름은 모두 Seed 표에 있다(자료·고객 문서 아이콘은 MaterialIcon)', () => {
    const missing = [];
    for (const file of LEGACY_IMPORTERS) {
        const source = read(file);
        // `MaterialIcon as Icon`으로 가져온 파일(문서 템플릿)은 일부러 Material 그대로다
        if (!/import \{[^}]*\bIcon\b[^}]*\} from ['"][^'"]*console\/Icon['"]/.test(source) || /MaterialIcon as Icon/.test(source)) continue;
        for (const match of source.matchAll(/<Icon\s+name=(?:"([^"]+)"|\{([^}]+)\})/g)) {
            const names = match[1] ? [match[1]] : [...match[2].matchAll(/\?\s*'([a-z0-9_]+)'|:\s*'([a-z0-9_]+)'|\|\|\s*'([a-z0-9_]+)'/g)].map(m => m[1] || m[2] || m[3]);
            for (const name of names) if (!materialKeys.has(name)) missing.push(`${file}: ${name}`);
        }
    }
    assert.deepEqual(missing, []);
});

test('Seed 표는 실제 Seed 아이콘만 가리키고, 고객 화면과 같아야 하는 아이콘은 Material로 남긴다', () => {
    const used = new Set([...legacy.matchAll(/\b(Icon[A-Z][A-Za-z]+)\b/g)].map(m => m[1]));
    for (const name of used) assert.ok(iconExports.has(name), `${name}이 AdminIcons(Seed)에 없다`);
    assert.match(read('src/pages/AdminCategoryManage.tsx'), /<MaterialIcon name=\{category\.icon\}/, '카테고리 아이콘은 고객 화면과 같은 Material');
    assert.match(read('src/pages/AdminBannerManage.tsx'), /<MaterialIcon name=\{banner\.icon\}/, '배너 아이콘은 고객 화면과 같은 Material');
    assert.match(read('src/pages/AdminTemplateManage.tsx'), /MaterialIcon as Icon/, '문서 템플릿 미리보기는 고객 문서와 같은 Material');
    assert.ok(!/<svg[\s\S]*strokeLinecap/.test(read('src/components/admin/dashboard/DashboardIcon.tsx')), 'DashboardIcon은 Lucide 선을 그리지 않는다');
});
