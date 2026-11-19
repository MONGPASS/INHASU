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
    'src/components/admin/accommodation/LodgeAssignBoard.css': 51,
    'src/components/admin/Admin3DIcon.css': 1,
    'src/components/admin/AdminDeliveryHistory.css': 23,
    'src/components/admin/AdminToolbar.css': 39,
    'src/components/admin/CourseImportModal.css': 4,
    'src/components/admin/CustomerKakaoActions.css': 38,
    'src/components/admin/CustomerResourcePicker.css': 35,
    'src/components/admin/CustomerWorkspaceOverview.css': 46,
    'src/components/admin/dashboard/TrafficSources.module.css': 5,
    'src/components/admin/guides/GuideSchedule.css': 43,
    'src/components/admin/ui/admin-ui.css': 3,
    'src/pages/AdminAccommodationOps.css': 61,
    'src/pages/AdminBannerManage.css': 23,
    'src/pages/AdminCalendar.css': 21,
    'src/pages/AdminCategoryManage.css': 4,
    'src/pages/AdminContentManage.css': 36,
    'src/pages/AdminDashboard.module.css': 44,
    'src/pages/AdminProductEditor.css': 14,
    'src/pages/AdminProductList.css': 4,
    'src/pages/AdminReservationBoard.module.css': 55,
    'src/styles/admin-console.css': 111,
    'src/styles/admin-shell-v3.css': 9,
    'src/styles/customer-workspace-editor.css': 103,
    'src/styles/product-customer-workspace.css': 31,
    'src/styles/quote-booking-workspace.css': 122,
    'src/styles/reservation-inline.css': 125,
    'src/styles/reservation-itinerary-designer.css': 23,
    'src/styles/reservation-workspace.css': 71,
    'public/admin-tools.css': 2,
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
