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

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const HEX = /#[0-9a-f]{3,8}(?![0-9a-z_-])/gi;
// 마지막에 선언된 값(민트 brand 블록이 Montage 기본값을 덮는다)
const lastValue = (css, name) => {
    const all = [...stripComments(css).matchAll(new RegExp(`${name}\\s*:\\s*([^;]+);`, 'g'))];
    return all.length ? all[all.length - 1][1].trim() : undefined;
};

test('공통 변수 파일이 색·글자·간격·모서리·높이 변수를 정한다', () => {
    const tokens = read('public/admin-tokens.css');
    for (const name of ['--adm-accent', '--adm-ink', '--adm-line', '--adm-fs-body', '--adm-space-4', '--adm-radius-sm', '--adm-control-h', '--adm-danger']) {
        assert.match(tokens, new RegExp(name + '\\s*:'), name);
    }
});

test('공통 변수는 Montage 변수를 가리키고 색 고정값을 적지 않는다', () => {
    const tokens = read('public/admin-tokens.css');
    assert.match(tokens, /^@import "\.\/admin-montage\.css";/, 'admin-tokens.css 맨 위에서 Montage 토큰을 읽는다');
    assert.deepEqual(stripComments(tokens).match(HEX) || [], [], 'admin-tokens.css에 hex 색을 적지 않는다');
    const montage = read('public/admin-montage.css');
    // admin-tokens.css가 쓰는 Montage 변수는 모두 admin-montage.css에 있어야 한다(이름 오타 방지).
    const used = new Set([...stripComments(tokens).matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]).filter((n) => !n.startsWith('--adm-')));
    assert.ok(used.size > 30);
    for (const name of used) assert.ok(lastValue(montage, name) !== undefined, `${name}: admin-montage.css에 정의`);
    const expect = {
        '--adm-accent': 'var(--semantic-surface-brand-primary)',
        '--adm-primary-bg': 'var(--semantic-surface-brand-primary)',
        '--adm-primary-bg-hover': 'var(--semantic-surface-brand-strong)',
        '--adm-accent-strong': 'var(--semantic-foreground-brand-primary)',
        '--adm-accent-soft': 'var(--semantic-surface-brand-subtle)',
        '--adm-info': 'var(--atomic-blue-50)',
        '--adm-success': 'var(--semantic-foreground-positive-primary)',
        '--adm-danger': 'var(--semantic-foreground-negative-primary)',
    };
    for (const [name, value] of Object.entries(expect)) assert.equal(lastValue(tokens, name), value, name);
});

test('Montage brand 9개만 INHASU 민트로 바꾼다', () => {
    const montage = read('public/admin-montage.css');
    assert.match(montage, /@montage-ui\/core@4\.\d+\.\d+ dist\/theme\.css/, '출처 버전을 적는다');
    assert.doesNotMatch(stripComments(montage), /data-theme/, '라이트 테마만 쓴다');
    const brand = {
        '--semantic-foreground-brand-primary': '#1C8571',
        '--semantic-foreground-brand-inverse': '#5CD6B9',
        '--semantic-surface-brand-primary': '#1C8571',
        '--semantic-surface-brand-strong': '#187A67',
        '--semantic-surface-brand-heavy': '#146B5A',
        '--semantic-surface-brand-subtle': '#27AB8F1A',
        '--semantic-line-brand-primary': '#27AB8F47',
        '--semantic-line-brand-strong': '#27AB8F',
        '--semantic-line-brand-focus': '#27AB8F33',
    };
    for (const [name, value] of Object.entries(brand)) assert.equal(lastValue(montage, name)?.toUpperCase(), value.toUpperCase(), name);
    // 버튼 바탕(surface brand primary/strong/heavy)에 연한 민트 #27AB8F를 쓰지 않는다(흰 글자 대비 부족).
    for (const name of ['--semantic-surface-brand-primary', '--semantic-surface-brand-strong', '--semantic-surface-brand-heavy']) {
        assert.doesNotMatch(lastValue(montage, name), /27AB8F/i, name);
    }
    // 안내·진행은 Montage 기본 파랑 그대로(완료 초록과 구분)
    assert.equal(lastValue(montage, '--atomic-blue-50'), '#0066FF');
});

// 관리자 CSS의 hex 색 고정값 수(2026-11-19 Montage 1단계 기준). 줄이는 것은 괜찮고 늘리면 실패한다.
// 줄였으면 아래 숫자도 함께 줄인다. 새 관리자 CSS 파일은 0개여야 한다(Montage·--adm-* 변수를 쓴다).
const ADMIN_CSS_HEX_BASELINE = {
    'src/components/admin/accommodation/LodgeAssignBoard.css': 47,
    'src/components/admin/Admin3DIcon.css': 1,
    'src/components/admin/AdminDeliveryHistory.css': 23,
    'src/components/admin/CourseImportModal.css': 4,
    'src/components/admin/CustomerKakaoActions.css': 38,
    'src/components/admin/CustomerResourcePicker.css': 34,
    'src/components/admin/CustomerWorkspaceOverview.css': 35,
    'src/components/admin/dashboard/TrafficSources.module.css': 5,
    'src/components/admin/guides/GuideSchedule.css': 41,
    'src/components/admin/ui/admin-ui.css': 0,
    'src/pages/AdminAccommodationOps.css': 55,
    'src/pages/AdminBannerManage.css': 22,
    'src/pages/AdminCalendar.css': 17,
    'src/pages/AdminCategoryManage.css': 4,
    'src/pages/AdminContentManage.css': 31,
    'src/pages/AdminDashboard.module.css': 43,
    'src/pages/AdminProductEditor.css': 14,
    'src/pages/AdminProductList.css': 4,
    'src/pages/AdminReservationBoard.module.css': 52,
    'src/styles/admin-console.css': 91,
    'src/styles/customer-workspace-editor.css': 92,
    'src/styles/product-customer-workspace.css': 21,
    'src/styles/quote-booking-workspace.css': 121,
    'src/styles/reservation-inline.css': 118,
    'src/styles/reservation-itinerary-designer.css': 23,
    'src/styles/reservation-workspace.css': 60,
    'public/admin-tools.css': 0,
};
// 관리자 화면에서만 읽는 src/styles 파일(이름이 admin-로 시작하지 않는 것)
const ADMIN_ONLY_STYLES = ['customer-workspace-editor', 'product-customer-workspace', 'quote-booking-workspace', 'reservation-inline', 'reservation-itinerary-designer', 'reservation-workspace'];

test('관리자 CSS에 hex 색 고정값을 새로 적지 않는다', () => {
    const files = [
        ...cssUnder('src/components/admin'),
        ...readdirSync(new URL('src/pages', root)).filter((n) => /^Admin.*\.css$/.test(n)).map((n) => join('src/pages', n)),
        ...readdirSync(new URL('src/styles', root)).filter((n) => /^admin-.*\.css$/.test(n)).map((n) => join('src/styles', n)),
        ...ADMIN_ONLY_STYLES.map((n) => `src/styles/${n}.css`),
        'public/admin-tools.css', 'public/admin-tokens.css',
    ].map((f) => f.replace(/\\/g, '/'));
    assert.ok(files.length > 25);
    for (const file of files) {
        const count = (stripComments(read(file)).match(HEX) || []).length;
        const limit = ADMIN_CSS_HEX_BASELINE[file] ?? 0;
        assert.ok(count <= limit, `${file}: hex 색 ${count}개(기준 ${limit}). var(--adm-*)나 Montage 변수(--semantic-*)를 쓴다`);
    }
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
    // 버튼·입력창 높이는 Montage 크기(small 32 / medium 40 / large 48)이고 휴대폰에서도 같다.
    const tokens = read('public/admin-tokens.css');
    assert.equal(lastValue(tokens, '--adm-control-h-sm'), 'var(--dimension-32)');
    assert.equal(lastValue(tokens, '--adm-control-h'), 'var(--dimension-40)');
    assert.equal(lastValue(tokens, '--adm-control-h-lg'), 'var(--dimension-48)');
    const montage = read('public/admin-montage.css');
    for (const px of [32, 40, 48]) assert.equal(lastValue(montage, `--dimension-${px}`), `${px}px`);
    const phone = tokens.match(/@media \(max-width: 760px\)\s*\{\s*:root\s*\{([^}]*)\}/);
    assert.ok(phone, '휴대폰 변수 블록');
    assert.doesNotMatch(stripComments(phone[1]), /--adm-control-h/, '휴대폰에서 버튼 높이를 따로 키우지 않는다');
    assert.match(phone[1], /--adm-fs-input:\s*var\(--typography-body1-fontSize\)/, '휴대폰 입력 글자 16px');
    const layout = read('src/components/admin/AdminLayout.tsx');
    assert.ok(layout.includes('AdminMobileTabBar') && layout.includes("admin-mobile.css"));
    const tabbar = read('src/components/admin/ui/AdminMobileTabBar.tsx');
    for (const label of ['홈', '예약', '견적', '배정', '전체']) assert.ok(tabbar.includes(label), label);
});

test('휴대폰에서 목록 표는 카드로 바뀐다', () => {
    const layout = read('src/components/admin/AdminLayout.tsx');
    assert.ok(layout.includes('useCardTables(contentRef)'));
    const mobile = read('src/styles/admin-mobile.css');
    assert.ok(mobile.includes('[data-card-table="on"]') && mobile.includes('.v7-list-row'));
    const list = read('src/components/admin/v7/ReservationListV7.tsx');
    for (const name of ['check', 'cust', 'period', 'people', 'region', 'assign', 'pay', 'status']) assert.ok(list.includes('v7-c-' + name), name);
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

// M2 공통 틀: Montage 시안(AdminSidebar·AdminTopbar)의 치수와 선택 표시. 규칙: docs/admin-design-system.md 1·3절
test('공통 틀은 시안의 사이드바 248px·상단 바 64px·민트 선택 표시를 Montage 변수로 그린다', () => {
    const montage = read('public/admin-montage.css');
    const shell = stripComments(read('src/styles/admin-shell-v3.css'));
    const toolbar = stripComments(read('src/components/admin/AdminToolbar.css'));
    assert.match(shell, /--side-w:\s*248px/);
    assert.match(shell, /\.header \.admin-toolbar \{[^}]*height:\s*var\(--dimension-64\)/);
    assert.match(shell, /\.nav-item\.active[^{]*\{[^}]*background:\s*var\(--semantic-surface-brand-subtle\);[^}]*color:\s*var\(--semantic-foreground-brand-primary\)/);
    assert.match(shell, /\.side-brand-mark \{[^}]*background:\s*var\(--semantic-surface-brand-primary\)/);
    assert.match(toolbar, /\.at-search-field \{[^}]*height:\s*var\(--dimension-40\);[^}]*border-radius:\s*var\(--radius-12\);[^}]*background:\s*var\(--semantic-surface-neutral-secondary\)/);
    // 틀 CSS가 쓰는 Montage 변수는 모두 admin-montage.css에 있다(오타로 값이 빠지지 않게).
    for (const [file, css] of [['admin-shell-v3.css', shell], ['AdminToolbar.css', toolbar]]) {
        const names = [...new Set([...css.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))]
            .filter((n) => !n.startsWith('--adm-') && !['--side-w', '--side-rail-w', '--font-sans'].includes(n));
        for (const name of names) assert.ok(montage.includes(`${name}:`), `${file}: ${name} 이 Montage에 없다`);
    }
    const sidebar = read('src/components/admin/AdminSidebar.tsx');
    assert.ok(sidebar.includes('className="side-brand"') && sidebar.includes('to="/admin"') && sidebar.includes('은하수 관리자'));
});

// M3-① 버튼: Montage Button 크기(32/40/48·모서리 10/12/14)와 색(주요 민트·테두리·회색·위험)을 모든 버튼 계열이 같은 변수로 쓴다.
test('버튼은 Montage Button 규격 변수를 쓴다', () => {
    const montage = read('public/admin-montage.css');
    const tokens = read('public/admin-tokens.css');
    const expect = {
        '--adm-btn-radius': 'var(--radius-12)', '--adm-btn-radius-sm': 'var(--radius-10)', '--adm-btn-radius-lg': 'var(--radius-14)',
        '--adm-btn-fs': 'var(--typography-label1-fontSize)', '--adm-btn-fs-sm': 'var(--typography-caption1-fontSize)', '--adm-btn-fs-lg': 'var(--typography-body2-fontSize)',
        '--adm-btn-pad-x': 'var(--spacing-16)', '--adm-btn-pad-x-sm': 'var(--spacing-12)', '--adm-btn-pad-x-lg': 'var(--spacing-20)',
    };
    for (const [name, value] of Object.entries(expect)) assert.equal(lastValue(tokens, name), value, name);
    for (const name of [...new Set([...stripComments(tokens).matchAll(/var\((--(?:radius|spacing|typography|semantic|dimension)[\w-]*)/g)].map((m) => m[1]))]) {
        assert.ok(montage.includes(`${name}:`), `${name} 이 Montage에 없다`);
    }
    const consoleCss = stripComments(read('src/styles/admin-console.css'));
    assert.match(consoleCss, /\.admin-app-wrapper \.btn \{[^}]*height:\s*var\(--adm-control-h\);[^}]*border-radius:\s*var\(--adm-btn-radius\)/);
    assert.match(consoleCss, /\.btn-sm \{[^}]*height:\s*var\(--adm-control-h-sm\)[^}]*border-radius:\s*var\(--adm-btn-radius-sm\)/);
    assert.match(consoleCss, /\.btn-lg \{[^}]*height:\s*var\(--adm-control-h-lg\)[^}]*border-radius:\s*var\(--adm-btn-radius-lg\)/);
    assert.match(consoleCss, /:is\(\.btn-ink, \.btn-blue\) \{[^}]*background:\s*var\(--semantic-surface-brand-primary\)/);
    assert.doesNotMatch(consoleCss, /\.btn:active \{[^}]*scale/, 'Montage 버튼은 눌렀을 때 작아지지 않는다');
    // 주요 버튼 바탕은 #27AB8F를 직접 쓰지 않는다(민트 기준).
    for (const file of ['src/components/admin/ui/admin-ui.css', 'src/pages/AdminContentManage.css', 'src/pages/AdminAccommodationOps.css', 'src/components/admin/CustomerWorkspaceOverview.css', 'public/admin-tools.css']) {
        const css = stripComments(read(file));
        assert.doesNotMatch(css, /27AB8F/i, file);
        assert.match(css, /--adm-btn-(radius|fs)/, `${file}: 버튼 규격 변수를 쓴다`);
    }
    // 화면별로 버튼을 알약 모양(999px)으로 덮어쓰지 않는다.
    const pages = ['src/pages/AdminCategoryManage.css', 'src/pages/AdminProductEditor.css', 'src/styles/customer-workspace-editor.css', 'src/components/admin/CustomerWorkspaceOverview.css', 'src/pages/AdminAccommodationOps.css'];
    for (const file of pages) assert.doesNotMatch(stripComments(read(file)), /\.(btn|cw-button|lo-btn)\b[^{]*\{[^}]*border-radius:\s*999px/, file);
});

test('입력창·선택 상자는 Montage TextField·Select 규격 변수를 쓴다', () => {
    const montage = read('public/admin-montage.css');
    const tokens = read('public/admin-tokens.css');
    const expect = {
        '--adm-input-h': 'var(--dimension-40)', '--adm-input-h-sm': 'var(--dimension-32)', '--adm-input-h-lg': 'var(--dimension-48)',
        '--adm-input-radius': 'var(--radius-12)', '--adm-input-radius-sm': 'var(--radius-10)', '--adm-input-radius-lg': 'var(--radius-14)',
        '--adm-input-line': 'var(--semantic-line-neutral-secondary)', '--adm-input-line-focus': 'var(--semantic-line-brand-strong)',
        '--adm-input-disabled-bg': 'var(--semantic-surface-neutral-tertiary)', '--adm-input-invalid-line': 'var(--semantic-line-negative-primary)',
        '--adm-fs-input': 'var(--typography-label1-fontSize)',
    };
    // 휴대폰 블록(16px)보다 앞의 PC 값을 본다.
    const desktop = tokens.split('@media')[0];
    for (const [name, value] of Object.entries(expect)) assert.equal(lastValue(desktop, name), value, name);
    for (const name of [...new Set([...stripComments(tokens).matchAll(/var\((--(?:radius|spacing|typography|semantic|dimension)[\w-]*)/g)].map((m) => m[1]))]) {
        assert.ok(montage.includes(`${name}:`), `${name} 이 Montage에 없다`);
    }
    const consoleCss = stripComments(read('src/styles/admin-console.css'));
    assert.match(consoleCss, /\.admin-app-wrapper \.inp \{[^}]*height:\s*var\(--adm-input-h\);[^}]*border:\s*1px solid var\(--adm-input-line\);[^}]*border-radius:\s*var\(--adm-input-radius\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.inp:focus \{[^}]*border-color:\s*var\(--adm-input-line-focus\);[^}]*box-shadow:\s*var\(--adm-input-ring\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.select \{[^}]*height:\s*var\(--adm-input-h\);[^}]*border-radius:\s*var\(--adm-input-radius\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.tb-search \{[^}]*background:\s*var\(--adm-input-search-bg\)/);
    // 화면별 입력창·검색창이 예전 높이(42·44px)·알약 모양·1.5px 선으로 덮어쓰지 않는다.
    const files = ['src/pages/AdminContentManage.css', 'src/pages/AdminAccommodationOps.css', 'src/pages/AdminBannerManage.css', 'src/pages/AdminProductEditor.css',
        'src/pages/AdminCategoryManage.css', 'src/pages/AdminProductList.css', 'src/pages/AdminCalendar.css', 'src/components/admin/guides/GuideSchedule.css',
        'src/components/admin/accommodation/LodgeAssignBoard.css', 'src/styles/product-customer-workspace.css', 'src/styles/reservation-workspace.css'];
    const field = /(?:\.(?:inp|select|[\w-]*(?:input|search|textarea))(?![\w-])|(?<![\w-])(?:input|select|textarea)(?![\w-]))[^{},]*\{[^}]*/g;
    for (const file of files) {
        for (const [rule] of stripComments(read(file)).matchAll(field)) {
            assert.doesNotMatch(rule, /(?:^|[;{\s])(?:min-)?height:\s*4[24]px/, `${file}: ${rule.slice(0, 80)}`);
            assert.doesNotMatch(rule, /border-radius:\s*999px|border:\s*1\.5px/, `${file}: ${rule.slice(0, 80)}`);
        }
    }
    // 견적 도구·잘못된 입력 표시도 같은 변수를 쓴다.
    assert.match(stripComments(read('public/admin-tools.css')), /:is\(input, select, textarea\):focus \{[^}]*var\(--adm-input-line-focus\)/);
    assert.match(stripComments(read('src/components/admin/ui/admin-ui.css')), /\[aria-invalid="true"\] \{[^}]*var\(--adm-input-invalid-line\)/);
});

test('표·배지·칩·탭·아이콘 버튼은 Montage 규격 변수를 쓴다', () => {
    const tokens = read('public/admin-tokens.css');
    const desktop = tokens.split('@media')[0];
    const expect = {
        '--adm-table-head-h': 'calc(var(--dimension-40) + var(--spacing-4))', '--adm-table-pad-x': 'var(--spacing-20)', '--adm-table-cell-pad-y': 'var(--spacing-16)',
        '--adm-badge-radius': 'var(--radius-8)', '--adm-chip-h': 'var(--dimension-36)', '--adm-chip-radius': 'var(--radius-10)',
        '--adm-seg-h': 'var(--dimension-32)', '--adm-seg-radius': 'var(--radius-10)', '--adm-seg-item-radius': 'var(--radius-8)',
        '--adm-icon-btn': 'var(--dimension-40)', '--adm-icon-btn-radius': 'var(--radius-10)',
    };
    for (const [name, value] of Object.entries(expect)) assert.equal(lastValue(desktop, name), value, name);
    const consoleCss = stripComments(read('src/styles/admin-console.css'));
    assert.match(consoleCss, /\.admin-app-wrapper \.badge \{[^}]*border-radius:\s*var\(--adm-badge-radius\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.chip \{[^}]*height:\s*var\(--adm-chip-h\);[^}]*border-radius:\s*var\(--adm-chip-radius\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.chip\.active \{[^}]*var\(--adm-chip-active-bg\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.seg \{[^}]*border-radius:\s*var\(--adm-seg-radius\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.tbl thead th \{[^}]*var\(--adm-table-head-fs\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.tbl tbody td \{[^}]*padding:\s*var\(--adm-table-cell-pad-y\) var\(--adm-table-pad-x\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.tab \{[^}]*var\(--adm-tab-fs\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.icon-btn \{[^}]*width:\s*var\(--adm-icon-btn\)/);
    // 화면별 배지·칩·탭이 알약 모양(999px)으로 덮어쓰지 않는다(점·숫자 원·사진 원은 제외).
    const files = ['src/components/admin/CourseImportModal.css', 'src/components/admin/CustomerResourcePicker.css', 'src/components/admin/CustomerWorkspaceOverview.css',
        'src/components/admin/accommodation/LodgeAssignBoard.css', 'src/components/admin/guides/GuideSchedule.css', 'src/pages/AdminAccommodationOps.css',
        'src/pages/AdminBannerManage.css', 'src/pages/AdminCalendar.css', 'src/pages/AdminCategoryManage.css', 'src/pages/AdminContentManage.css',
        'src/pages/AdminDashboard.module.css', 'src/pages/AdminProductEditor.css', 'src/pages/AdminProductList.css', 'src/pages/AdminReservationBoard.module.css'];
    const pillLike = /([^{}]*(?:chip|pill|badge|status|tag|count|seg|tabs?\b|tab |toggle|act-btn|Badge|Chip)[^{}]*)\{([^}]*)\}/g;
    for (const file of files) {
        for (const [, sel, body] of stripComments(read(file)).matchAll(pillLike)) {
            if (/::before|::after|(?:^|\s)i\s*$|\bi\s*,|\bdot\b|\bav\b/.test(sel.trim())) continue;
            if (!/height|padding/.test(body)) continue;
            assert.doesNotMatch(body, /border-radius:\s*999px/, `${file}: ${sel.trim().slice(0, 80)}`);
        }
    }
    // v7 고객 상세·예약 목록의 배지·버튼 도우미도 변수를 쓴다.
    const v7 = read('src/components/admin/v7/v7Ui.tsx');
    assert.match(v7, /borderRadius: 'var\(--adm-badge-radius\)'/);
    assert.doesNotMatch(v7.split('export const card')[0], /#[0-9a-f]{6}/i);
});

test('팝업·서랍·메뉴·알림은 Montage Modal·Drawer·Menu·Toast 규격 변수를 쓴다', () => {
    const desktop = read('public/admin-tokens.css').split('@media')[0];
    const expect = {
        '--adm-modal-w': '440px', '--adm-modal-radius': 'var(--radius-24)', '--adm-modal-pad': 'var(--spacing-24)',
        '--adm-modal-bg': 'var(--semantic-surface-elevated-primary)', '--adm-modal-shadow': 'var(--semantic-elevation-shadow-normal-xlarge)',
        '--adm-drawer-w': '520px', '--adm-menu-radius': 'var(--radius-12)', '--adm-menu-shadow': 'var(--semantic-elevation-shadow-normal-large)',
        '--adm-toast-radius': 'var(--radius-12)', '--adm-toast-bg': 'var(--semantic-surface-neutral-inverse)', '--adm-toast-fg': 'var(--semantic-foreground-neutral-inverse)',
    };
    for (const [name, value] of Object.entries(expect)) assert.equal(lastValue(desktop, name), value, name);
    const ui = stripComments(read('src/components/admin/ui/admin-ui.css'));
    assert.match(ui, /\.adm-dialog \{[^}]*width:\s*min\(var\(--adm-modal-w\), 100%\);[^}]*border-radius:\s*var\(--adm-modal-radius\);[^}]*box-shadow:\s*var\(--adm-modal-shadow\)/);
    assert.match(ui, /\.adm-toast \{[^}]*border-radius:\s*var\(--adm-toast-radius\);[^}]*background:\s*var\(--adm-toast-bg\)/);
    // 화면별 팝업·서랍·메뉴·알림이 고정 그림자·알약 모양·hex 바탕으로 덮어쓰지 않는다.
    const checks = [
        ['src/styles/admin-console.css', ['.admin-app-wrapper .picker', '.admin-app-wrapper .drawer', '.admin-app-wrapper .statusdd-menu', '.admin-app-wrapper .page-toast', '.admin-app-wrapper .drawer-toast', '.admin-app-wrapper .drawer-scrim', '.admin-app-wrapper .picker-scrim']],
        ['src/pages/AdminContentManage.css', ['.admin-app-wrapper .cm-modal', '.admin-app-wrapper .cm-scrim']],
        ['src/pages/AdminCategoryManage.css', ['.admin-app-wrapper .cg-drawer-scrim', '.admin-app-wrapper .picker.cg-drawer']],
        ['src/pages/AdminDashboard.module.css', ['.revMenu']], ['src/pages/AdminReservationBoard.module.css', ['.ddMenu']],
        ['src/components/admin/guides/GuideSchedule.css', ['.gs-pop', '.gs-drawer', '.gs-modal', '.gs-toast']],
        ['src/components/admin/accommodation/LodgeAssignBoard.css', ['.la-pop', '.la-toast']],
        ['src/components/admin/CourseImportModal.css', ['.ci-modal']], ['public/admin-tools.css', ['html.admin-embedded :is(.toast, #toast)', 'html.admin-embedded .drawer']],
    ];
    for (const [file, sels] of checks) {
        const css = stripComments(read(file));
        for (const sel of sels) {
            const body = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].find(([, s]) => s.replace(/\s+/g, ' ').trim() === sel)?.[2];
            assert.ok(body, `${file}: ${sel} 규칙이 없다`);
            assert.doesNotMatch(body, /(?:background|box-shadow):[^;]*(?:#[0-9a-f]{3,8}|rgba\(\d)|border-radius:\s*999px/i, `${file}: ${sel}`);
            assert.match(body, /var\(--adm-(?:modal|drawer|menu|toast|scrim)/, `${file}: ${sel}`);
        }
    }
    const v7 = read('src/components/admin/v7/v7Ui.tsx');
    assert.match(v7, /background: 'var\(--adm-toast-bg\)'/);
    assert.match(v7, /borderRadius: 'var\(--adm-menu-radius\)'/);
});

test('화면 유형별 틀: 모든 화면이 같은 구역 간격·카드 모서리·제목 자리를 쓴다(M4)', () => {
    const desktop = read('public/admin-tokens.css').split('@media')[0];
    const expect = {
        '--adm-gap-head': 'var(--spacing-24)', '--adm-gap-section': 'var(--spacing-16)', '--adm-card-radius': 'var(--radius-16)',
        '--adm-inner-radius': 'var(--radius-12)', '--adm-kpi-pad': 'var(--spacing-16) var(--adm-pad-card)',
    };
    for (const [name, value] of Object.entries(expect)) assert.equal(lastValue(desktop, name), value, name);
    const consoleCss = stripComments(read('src/styles/admin-console.css'));
    assert.match(consoleCss, /--r-lg:\s*var\(--adm-card-radius\)/);
    assert.match(consoleCss, /\.admin-app-wrapper \.content-in \{[^}]*flex-direction:\s*column;[^}]*gap:\s*var\(--adm-gap-section\)/);
    assert.match(stripComments(read('src/styles/admin-shell-v3.css')), /\.admin-layout-heading \{[^}]*min-height:\s*calc\(var\(--primitive-28\) \+ var\(--adm-control-h\)\)/);
    // 화면마다 본문 구역을 쌓는 바깥 틀은 같은 간격 변수를 쓴다.
    const roots = [
        ['src/pages/AdminDashboard.module.css', /\.dashboard \{[^}]*gap:\s*var\(--adm-gap-section\)/],
        ['src/pages/AdminContentManage.css', /\.cm-page \{[^}]*gap:\s*var\(--adm-gap-section\)/],
        ['src/pages/AdminProductList.css', /\.pd-list \{[^}]*gap:\s*var\(--adm-gap-section\)/],
        ['src/pages/AdminCalendar.css', /\.tour-calendar \{[^}]*gap:\s*var\(--adm-gap-section\)/],
        ['src/pages/AdminAccommodationOps.css', /\.lo-board \{[^}]*gap:\s*var\(--adm-gap-section\)/],
        ['src/components/admin/accommodation/LodgeAssignBoard.css', /\.la \{[^}]*gap:\s*var\(--adm-gap-section\)/],
        ['src/pages/AdminBannerManage.css', /\.hm-body \{[^}]*gap:\s*var\(--adm-gap-section\)/],
    ];
    for (const [file, re] of roots) assert.match(stripComments(read(file)), re, file);
    // 카드 모서리는 16(카드)·12(카드 안 상자) 두 가지. 예전 18·20·22·24px 카드 모서리가 남지 않는다.
    const files = ['src/components/admin/AdminDeliveryHistory.css', 'src/components/admin/CustomerKakaoActions.css', 'src/components/admin/CustomerWorkspaceOverview.css',
        'src/components/admin/accommodation/LodgeAssignBoard.css', 'src/components/admin/dashboard/TrafficSources.module.css', 'src/components/admin/guides/GuideSchedule.css',
        'src/pages/AdminAccommodationOps.css', 'src/pages/AdminBannerManage.css', 'src/pages/AdminCalendar.css', 'src/pages/AdminCategoryManage.css', 'src/pages/AdminContentManage.css',
        'src/pages/AdminDashboard.module.css', 'src/pages/AdminProductEditor.css', 'src/pages/AdminProductList.css', 'src/pages/AdminReservationBoard.module.css',
        'src/styles/admin-console.css', 'src/styles/customer-workspace-editor.css', 'src/styles/product-customer-workspace.css', 'src/styles/quote-booking-workspace.css',
        'src/styles/reservation-itinerary-designer.css', 'src/styles/reservation-workspace.css'];
    for (const file of files) assert.doesNotMatch(stripComments(read(file)), /border-radius:\s*(?:18|20|22|24)px/, file);
    const v7 = read('src/components/admin/v7/v7Ui.tsx');
    assert.match(v7, /export const card: Css = \{[^}]*borderRadius: 'var\(--adm-card-radius\)'/);
});
