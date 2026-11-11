// 관리자 공통 변수(public/admin-tokens.css)가 한곳에서만 정해지는지 검사한다. 규칙: docs/admin-design-system.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const QUOTE_TOOLS = ['견적관리', '견적관리-모바일', '예약목록', '예약관리', '견적만들기', '코스관리', '일정관리', '명소관리', '리소스관리'];
// 화면마다 따로 쓰던 민트 값. 관리자 CSS에 다시 적지 않는다.
const OLD_MINT = /#(12b28c|0e9e7a|06c4a0|1cc497|2fd3a7|0a7f62|057a61|16987d|109b87)(?![0-9a-f])/i;

const cssUnder = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssUnder(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : []);

test('공통 변수 파일이 색·글자·간격·모서리·높이 변수를 정한다', () => {
    const tokens = read('public/admin-tokens.css');
    for (const name of ['--adm-accent', '--adm-ink', '--adm-line', '--adm-fs-body', '--adm-space-4', '--adm-radius-sm', '--adm-control-h', '--adm-danger']) {
        assert.match(tokens, new RegExp(name + '\\s*:'), name);
    }
    assert.match(tokens, /--adm-accent:\s*#27AB8F/i, '브랜드 민트를 유지한다');
});

test('React 관리자와 견적 도구가 같은 공통 변수 파일을 읽는다', () => {
    assert.match(read('src/styles/admin-console.css'), /^@import "\.\.\/\.\.\/public\/admin-tokens\.css";/);
    for (const tool of QUOTE_TOOLS) {
        const html = read(`public/${tool}.html`);
        assert.ok(html.includes('<link rel="stylesheet" href="/admin-tokens.css">'), `${tool}: 공통 변수 파일 연결`);
        const roots = html.match(/:root\s*\{[^}]*\}/g) || [];
        assert.ok(roots.some((block) => block.includes('var(--adm-')), `${tool}: :root 값이 공통 변수를 가리킨다`);
    }
});

test('관리자 CSS에 옛 민트 값을 다시 적지 않는다', () => {
    const files = [
        ...cssUnder('src/components/admin'),
        ...readdirSync(new URL('src/pages', root)).filter((n) => /^Admin.*\.css$/.test(n)).map((n) => join('src/pages', n)),
        'src/styles/admin-console.css', 'src/styles/admin-shell-v3.css',
    ];
    assert.ok(files.length > 15);
    for (const file of files) {
        const css = read(file.replace(/\\/g, '/'));
        assert.doesNotMatch(css, OLD_MINT, `${file}: var(--adm-accent…)를 쓴다`);
        assert.doesNotMatch(css, /--mrt-blue\s*:\s*#/, `${file}: 강조색을 화면별로 다시 정하지 않는다`);
    }
});

test('관리자 화면은 브라우저 기본 알림창 대신 공통 알림을 쓴다', () => {
    const walk = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []);
    const files = [...walk('src/components/admin'), ...readdirSync(new URL('src/pages', root)).filter((n) => /^Admin.*\.tsx$/.test(n)).map((n) => join('src/pages', n))];
    for (const file of files) {
        assert.doesNotMatch(read(file.replace(/\\/g, '/')), /(^|[^.\w])alert\(|window\.alert\(/m, `${file}: adminNotify()를 쓴다`);
    }
});

test('휴대폰 앱 틀은 한 파일에서 정하고 크기는 공통 변수를 쓴다', () => {
    const mobile = read('src/styles/admin-mobile.css');
    for (const name of ['--adm-tabbar-h', '--adm-topbar-h', '--adm-control-h', '--adm-fs-input', '--adm-pad-page']) assert.ok(mobile.includes(`var(${name})`), name);
    assert.match(read('public/admin-tokens.css'), /@media \(max-width: 760px\)\s*\{\s*:root\s*\{[^}]*--adm-control-h:\s*44px/);
    const layout = read('src/components/admin/AdminLayout.tsx');
    assert.ok(layout.includes('AdminMobileTabBar') && layout.includes("admin-mobile.css"));
    const tabbar = read('src/components/admin/ui/AdminMobileTabBar.tsx');
    for (const label of ['홈', '예약', '견적', '배정', '전체']) assert.ok(tabbar.includes(label), label);
});
