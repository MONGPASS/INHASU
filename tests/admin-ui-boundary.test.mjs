// 관리자 화면은 우리 관리자 부품(src/components/admin/ui, 당근 Seed 모양)만 쓴다.
// Montage(@montage-ui/core 부품 2026-11-23 단계 2, @montage-ui/icon 아이콘 같은 날 단계 3)는 걷어냈다 — 어디서도 다시 가져오지 않는다.
// 아이콘은 우리 AdminIcons(당근 Seed 아이콘, scripts/build-seed-icons.mjs가 docs/seed-design/assets/svg로 만든다).
// 규칙: docs/admin-design-system.md 3절, 부품 미리보기: /admin/__ui (src/pages/AdminUiPreview.tsx)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAP as SEED_ICON_MAP, OUT as SEED_ICON_OUT, render as renderSeedIcons } from '../scripts/build-seed-icons.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const UI_DIR = 'src/components/admin/ui/';

const walk = (dir, out = []) => {
    for (const e of readdirSync(join(root, dir), { withFileTypes: true })) {
        const p = `${dir}/${e.name}`;
        if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); } else if (/\.(tsx?|jsx?|mjs)$/.test(e.name)) out.push(p);
    }
    return out;
};
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
// import … from '@montage-ui/core', import '@montage-ui/icon/…', import('@montage-ui/core'), require('@montage-ui/icon'), export … from
const MONTAGE_CORE = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]@montage-ui\/(?:core|icon)(?:\/[^'"]*)?['"]/;

test('어떤 코드도 @montage-ui(core·icon)를 가져오지 않고, 패키지 의존성에도 없다', () => {
    const files = walk('src');
    assert.ok(files.length > 100, '검사 대상 파일을 찾지 못했다');
    const offenders = files.filter((f) => MONTAGE_CORE.test(stripComments(readFileSync(join(root, f), 'utf8'))));
    assert.deepEqual(offenders, [], `부품·아이콘은 ${UI_DIR}의 우리 것(AdminButton·AdminTable·IconPlus …)을 쓴다:\n${offenders.join('\n')}`);
    const css = readdirSync(join(root, 'src/styles')).filter((n) => n.endsWith('.css'))
        .filter((n) => /@montage-ui\/core/.test(readFileSync(join(root, 'src/styles', n), 'utf8')));
    assert.deepEqual(css, [], 'Montage 테마 CSS를 읽지 않는다');
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const name of ['@montage-ui/core', '@montage-ui/icon']) assert.equal(deps[name], undefined, `package.json에 ${name}가 없다`);
});

test('검사 정규식은 여러 import 꼴을 잡는다', () => {
    for (const src of [
        "import { Button } from '@montage-ui/core';",
        'import {\n  Table,\n} from "@montage-ui/core"',
        "export { Chip } from '@montage-ui/core';",
        "const m = await import('@montage-ui/core');",
        "import '@montage-ui/core/dist/foo.js';",
    ]) assert.match(src, MONTAGE_CORE, src);
    assert.match("import { IconClose } from '@montage-ui/icon';", MONTAGE_CORE);
    for (const src of ["import { AdminButton, IconClose } from '../components/admin/ui';", "// 예전 @montage-ui/icon 이름 그대로"]) assert.doesNotMatch(src, MONTAGE_CORE, src);
});

test('우리 부품은 index.ts, 화면 틀은 AdminPage.tsx에서 내보내고 개발용 미리보기 화면이 관리자 보호 안에 있다', () => {
    const index = readFileSync(join(root, UI_DIR, 'index.ts'), 'utf8');
    for (const name of ['AdminButton', 'AdminIconButton', 'AdminTextButton', 'AdminField', 'AdminTextInput', 'AdminSelect', 'AdminCheckbox', 'AdminSearch',
        'AdminTable', 'AdminDataTable', 'AdminPagination', 'AdminBadge', 'AdminChip', 'AdminSegmented', 'AdminTabs', 'AdminCard', 'AdminStat',
        'AdminMessage', 'AdminLoading', 'AdminEmpty', 'AdminError', 'AdminDialog', 'AdminMenu', 'AdminSwitch', 'AdminFileButton',
        'adminNotify', 'adminConfirm', 'adminValidateRequired']) {
        assert.match(index, new RegExp(`\\b${name}\\b`), `index.ts가 ${name}을 내보내야 한다`);
    }
    // 부품 묶음(index.ts)은 AdminLayout을 끌어오지 않는다(AdminLayout → 모든 관리자 화면 미리 읽기 → 다시 부품: 순환)
    assert.doesNotMatch(stripComments(index), /AdminPage|AdminLayout/, 'index.ts는 화면 틀(AdminPage)을 내보내지 않는다');
    const frames = readFileSync(join(root, UI_DIR, 'AdminPage.tsx'), 'utf8');
    for (const name of ['ListPage', 'AdminFilterBar', 'FormPage', 'AdminFormSection', 'DetailPage', 'AdminDetailHeader', 'AdminSteps', 'DashboardPage', 'AdminGrid']) {
        assert.match(frames, new RegExp(`export (const|function) ${name}\\b`), `AdminPage.tsx가 ${name}을 내보내야 한다`);
    }
    const app = readFileSync(join(root, 'src/App.tsx'), 'utf8');
    assert.match(app, /path="\/admin\/__ui"\s+element=\{<AdminGuard><AdminUiPreview \/><\/AdminGuard>\}/, '/admin/__ui는 AdminGuard 안');
    // 미리보기는 합성 자료만 쓴다(운영 API를 부르지 않는다)
    const preview = stripComments(readFileSync(join(root, 'src/pages/AdminUiPreview.tsx'), 'utf8'));
    assert.doesNotMatch(preview, /\bfetch\(|\/api\/|adminApi|apiClient/, '미리보기 화면은 API를 부르지 않는다');
});

test('AdminIcons.tsx는 Seed SVG로 만든 그대로이고, 화면이 쓰는 아이콘이 모두 있다', () => {
    assert.equal(readFileSync(join(root, SEED_ICON_OUT), 'utf8'), renderSeedIcons(), 'node scripts/build-seed-icons.mjs로 다시 만든다(손으로 고치지 않는다)');
    const used = new Set();
    for (const f of walk('src')) {
        for (const m of readFileSync(join(root, f), 'utf8').matchAll(/import\s*\{([^}]*)\}\s*from\s*'[^']*components\/admin\/ui'|import\s*\{([^}]*)\}\s*from\s*'\.\/(?:ui|AdminIcons)'/g)) {
            for (const name of (m[1] ?? m[2]).split(',').map((n) => n.trim())) if (/^Icon[A-Z]/.test(name)) used.add(name);
        }
    }
    assert.ok(used.size > 20, '아이콘을 쓰는 화면을 찾지 못했다');
    const missing = [...used].filter((n) => !(n in SEED_ICON_MAP));
    assert.deepEqual(missing, [], 'scripts/build-seed-icons.mjs MAP에 없는 아이콘');
});
