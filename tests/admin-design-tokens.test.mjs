// 관리자 공통 변수(public/admin-tokens.css)가 한곳에서만 정해지는지 검사한다. 규칙: docs/admin-design-system.md
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');

const QUOTE_TOOLS = ['견적관리', '견적관리-모바일', '예약목록', '예약관리', '견적만들기', '코스관리', '일정관리', '명소관리', '리소스관리'];
// 화면마다 따로 쓰던 민트 값. 관리자 CSS에 다시 적지 않는다.
const OLD_MINT = /#(03866e|02795f|05b091|12b28c|0e9e7a|06c4a0|1cc497|2fd3a7|0a7f62|057a61|16987d|109b87)(?![0-9a-f])/i;

const cssUnder = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? cssUnder(join(dir, e.name)) : e.name.endsWith('.css') ? [join(dir, e.name)] : []);

test('공통 변수 파일이 색·글자·간격·모서리·높이 변수를 정한다', () => {
    const tokens = read('public/admin-tokens.css');
    for (const name of ['--adm-accent', '--adm-ink', '--adm-line', '--adm-fs-body', '--adm-space-4', '--adm-radius-sm', '--adm-control-h', '--adm-danger']) {
        assert.match(tokens, new RegExp(name + '\\s*:'), name);
    }
    // 값의 기준은 Seed(은하수 판, 2026-11-23): public/seed/*.css를 그대로 읽고 --adm-*는 그 변수에 잇는다.
    for (const file of ['colors', 'typography', 'dimension', 'motion']) assert.ok(tokens.includes(`@import "./seed/${file}.css";`), `Seed ${file} 토큰을 읽는다`);
    const seed = read('public/seed/colors.css');
    assert.match(seed, /--seed-scale-color-carrot-400:\s*#36D1A7/i, 'Seed primary = 은하수 민트');
    assert.match(seed, /--seed-semantic-color-primary:\s*var\(--seed-scale-color-carrot-400\)/);
    assert.match(tokens, /--adm-accent:\s*var\(--seed-semantic-color-primary\)/, '브랜드 민트 = Seed primary');
    assert.match(tokens, /--adm-accent-strong:\s*var\(--seed-scale-color-carrot-700\)/, '글자로 쓰는 브랜드색(흰 바탕 4.5:1 이상)');
    assert.match(tokens, /--adm-on-primary:\s*var\(--seed-scale-color-carrot-950\)/, '민트 채움 위 글자색(#032B25)');
    assert.match(tokens, /--adm-text:\s*var\(--seed-semantic-color-ink-text\)/, '본문 글자색');
    assert.match(tokens, /--adm-canvas:\s*var\(--seed-semantic-color-paper-background\)/, '작업 바탕');
    assert.doesNotMatch(tokens, /#0CEFD3/i, '옛 배민 민트를 쓰지 않는다');
    assert.match(tokens, /--adm-content-max:\s*1440px/, '본문 최대 폭');
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
    assert.match(read('public/admin-tokens.css'), /@media \(max-width: 760px\)\s*\{\s*:root\s*\{[^}]*--adm-control-h:\s*var\(--seed-control-height-large\)/);
    const layout = read('src/components/admin/AdminLayout.tsx');
    assert.ok(layout.includes('AdminMobileTabBar') && layout.includes("admin-mobile.css"));
    const tabbar = read('src/components/admin/ui/AdminMobileTabBar.tsx');
    for (const label of ['홈', '예약', '견적', '배정', '전체']) assert.ok(tabbar.includes(label), label);
});

test('휴대폰에서 목록 표는 카드로 바뀐다', () => {
    const layout = read('src/components/admin/AdminLayout.tsx');
    assert.ok(layout.includes('useCardTables(contentRef)'));
    const mobile = read('src/styles/admin-mobile.css');
    assert.ok(mobile.includes('[data-card-table="on"]'));
    // 통합 예약 목록은 공통 표 부품(AdminTable)을 쓰고, 휴대폰 칸 배치는 목록 CSS에 둔다.
    const list = read('src/components/admin/v7/ReservationListV7.tsx');
    assert.ok(list.includes('<AdminTable') && !/<(button|input|select|table)/.test(list));
    for (const name of ['check', 'cust', 'date', 'product', 'people', 'assign', 'pay', 'step', 'more']) assert.ok(list.includes('rl-c-' + name), name);
    const listCss = read('src/components/admin/v7/reservation-list.css');
    assert.ok(listCss.includes('@media (max-width: 760px)') && listCss.includes('.rl-c-check'));
});

test('삭제·변경 확인은 공통 확인 창을 쓰고, 브라우저 확인창은 나가기 보호에만 남긴다', () => {
    const walk = (dir) => readdirSync(new URL(dir, root), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []);
    const files = [...walk('src/components/admin'), ...readdirSync(new URL('src/pages', root)).filter((n) => /^Admin.*\.tsx$/.test(n)).map((n) => join('src/pages', n)), 'src/hooks/useAdminContentGuard.ts'];
    let native = 0, shared = 0;
    for (const file of files) {
        const source = read(file.replace(/\\/g, '/'));
        assert.doesNotMatch(source, /(^|[^.\w])confirm\(/m, `${file}: await adminConfirm()을 쓴다`);
        native += (source.match(/window\.confirm\(/g) || []).length;
        shared += (source.match(/await adminConfirm\(/g) || []).length;
    }
    assert.ok(shared >= 70, '공통 확인 창 사용 ' + shared);
    assert.ok(native <= 6, '나가기 보호 밖에 브라우저 확인창을 늘리지 않는다: ' + native);
});

test('견적 도구는 관리자 안에서 공통 규격 CSS를 함께 읽는다', () => {
    const tools = read('public/admin-tools.css');
    assert.ok(tools.includes('html.admin-embedded') && tools.includes('var(--adm-primary-bg)') && tools.includes('var(--adm-control-h)'));
    // 규칙이 시작되는 줄(‘{’가 있는 줄)은 모두 관리자 안(html.admin-embedded)으로 한정한다.
    for (const line of tools.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => l.includes('{'))) {
        assert.match(line.trim(), /^(html\.admin-embedded|@media)/, `관리자 안에서만 적용: ${line.trim().slice(0, 60)}`);
    }
    for (const tool of ['견적관리', '예약목록', '견적만들기', '코스관리', '일정관리', '명소관리', '리소스관리']) {
        const html = read(`public/${tool}.html`);
        const link = html.indexOf('<link rel="stylesheet" href="/admin-tools.css">');
        assert.ok(link > html.lastIndexOf('</style>', html.indexOf('</head>')) && link < html.indexOf('</head>'), `${tool}: 자체 스타일 뒤에 공통 규격을 읽는다`);
    }
});

test('견적 도구 문서는 공통 확인·입력 창을 쓴다', () => {
    const dialog = read('public/admin-dialog.js');
    assert.ok(dialog.includes('window.AdminDialog') && dialog.includes('var(--adm-primary-bg') && dialog.includes('var(--adm-danger'));
    for (const tool of ['코스관리', '일정관리', '명소관리', '리소스관리', '견적관리', '예약목록', '견적만들기']) {
        const html = read(`public/${tool}.html`);
        assert.ok(html.includes('<script src="/admin-dialog.js"></script>'), `${tool}: 공통 창 스크립트 연결`);
        assert.ok(html.indexOf('/admin-legacy-redirect.js') < html.indexOf('/admin-dialog.js'), `${tool}: 단독 접속 차단 스크립트가 먼저`);
        // 비밀번호를 묻는 줄만 기본 입력창을 쓴다.
        const native = html.split('\n').filter((line) => /(^|[^.\w])(confirm|prompt)\(/.test(line) && !line.includes('비밀번호'));
        assert.deepEqual(native, [], `${tool}: await AdminDialog.confirm/prompt 를 쓴다`);
    }
});

// 은하수 민트(#36D1A7)는 밝은 채움색이다. 민트 채움 위에 흰 글자를 올리면 대비가 1.9:1이라 읽히지 않는다.
test('민트 채움 위 글자는 --adm-on-primary를 쓴다(흰 글자 금지)', () => {
    const FILL = /background(?:-color)?\s*:\s*[^;}]*var\(--(?:adm-accent|adm-primary-bg|accent|book|brand|deep|mint|p|primary|cbe-mint|gs-mint|la-mint|lo-mint|lo-mint-seg|lo-tone|mrt-blue|gs-blue|la-blue)(?:-hover)?\)/;
    const WHITE = /(?<![-\w])color\s*:\s*(?:#fff\b|#ffffff\b|white\b|var\(--adm-surface\))/i;
    const blocks = (css) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]*)\{([^{}]*)\}/g)];
    const files = [
        ...cssUnder('src/components/admin'),
        ...readdirSync(new URL('src/pages', root)).filter((n) => /^Admin.*\.css$/.test(n)).map((n) => join('src/pages', n)),
        ...readdirSync(new URL('src/styles', root)).filter((n) => n.endsWith('.css')).map((n) => join('src/styles', n)),
        'public/admin-tools.css', 'public/admin-tokens.css', 'public/quote-day-editor.css', 'public/quote-spot-selector.css',
    ];
    const sources = files.map((f) => [f, read(f.replace(/\\/g, '/'))]).filter(([f, s]) => !f.startsWith('src/styles') || s.includes('--adm-'));
    for (const tool of QUOTE_TOOLS) sources.push([tool, (read(`public/${tool}.html`).match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n')]);
    for (const [file, css] of sources) {
        for (const [, sel, body] of blocks(css)) {
            if (FILL.test(body)) assert.doesNotMatch(body, WHITE, `${file}: ${sel.trim().slice(0, 80)} — 민트 채움 위는 var(--adm-on-primary)`);
        }
    }
    // Montage Button(solid·primary)은 글자를 흰색으로 그린다. 화면은 Montage Button을 직접 쓰지 않고(tests/admin-ui-boundary.test.mjs)
    // 우리 AdminButton만 쓰므로, AdminButton이 주요 버튼에 adm-on-primary를 붙이고 그 규칙이 --adm-on-primary 글자를 주는지 본다.
    const button = read('src/components/admin/ui/AdminButton.tsx');
    assert.match(button, /variant === 'primary' && 'adm-on-primary'/, 'AdminButton 주요 버튼에 adm-on-primary');
    const partsCss = read('src/components/admin/ui/admin-components.css');
    assert.match(partsCss, /\.adm-ui-btn\.is-primary\.adm-on-primary[^{]*\{[^}]*color:\s*var\(--adm-on-primary\)/, 'admin-components.css: 주요 버튼 글자는 var(--adm-on-primary)');
});
