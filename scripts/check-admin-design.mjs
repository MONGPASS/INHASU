// 관리자 화면이 디자인 규칙(docs/admin-design-system.md)을 얼마나 따르는지 화면별로 센다.
//   node scripts/check-admin-design.mjs              화면별 표를 출력
//   node scripts/check-admin-design.mjs --md         docs/admin-design-adoption.md를 새로 쓴다
//   node scripts/check-admin-design.mjs --write-baseline   지금 수치를 기준선(scripts/admin-design-baseline.json)으로 저장
// 기준선은 "줄이기만 하는" 상한이다. tests/admin-design-budget.test.mjs가 파일마다 기준선보다 늘어나면 실패한다.
// 위반을 줄였으면 --write-baseline으로 기준선을 낮춘다. 기준선을 올리는 변경은 리뷰에서 막는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const rel = (p) => path.relative(root, p).split(path.sep).join('/');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (dir, test, out = []) => {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) return out;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, test, out); else if (test(p)) out.push(p.split(path.sep).join('/'));
    }
    return out;
};

export const QUOTE_TOOLS = ['견적관리', '견적관리-모바일', '예약목록', '예약관리', '견적만들기', '코스관리', '일정관리', '명소관리', '리소스관리'];

/** 관리자 디자인 검사 대상 파일 */
export function adminDesignFiles() {
    const tsx = [
        ...walk('src/pages', (p) => /[\\/]Admin[^\\/]*\.tsx$/.test(p)),
        ...walk('src/components/admin', (p) => p.endsWith('.tsx')),
    ];
    const css = [
        ...walk('src/pages', (p) => /[\\/]Admin[^\\/]*\.css$/.test(p)),
        ...walk('src/components/admin', (p) => p.endsWith('.css')),
        ...walk('src/styles', (p) => /[\\/](admin|reservation-|quote-booking-workspace|customer-workspace-editor|product-customer-workspace)[^\\/]*\.css$/.test(p)),
        'public/admin-tools.css', 'public/quote-day-editor.css', 'public/quote-spot-selector.css',
    ];
    const html = QUOTE_TOOLS.map((t) => `public/${t}.html`);
    return { tsx: tsx.sort(), css: css.sort(), html };
}

// ── 화면 묶음(docs/admin-screen-inventory.md 기준). 어디에도 안 맞는 파일은 '기타'로 센다 ──
const SCREENS = [
    ['공통 틀·부품', /^(src\/components\/admin\/(AdminLayout|AdminSidebar|AdminToolbar|adminNav|AdminWorkspaceContext|Admin3DIcon)|src\/components\/admin\/(ui|console)\/|src\/pages\/AdminUiPreview|src\/styles\/admin-)/],
    ['대시보드', /(AdminDashboard|components\/admin\/dashboard\/)/],
    ['통합 예약 목록', /(AdminReservationManage|AdminReservationBoard|v7\/ReservationListV7)/],
    ['고객 예약 상세(상품·이전 견적)', /(v7\/(ReservationDetailV7|v7Ui|guideMenuItems)|CustomerWorkspaceOverview|Reservation(Workflow|Documents|DocumentEditor|InlineEditor|Operations|DraftPreview)|CustomerKakaoActions|CustomerVehicleAssignment|CustomerResourcePicker|AdminDeliveryHistory|QuoteAccountLinkDialog|customer-workspace-editor|reservation-|product-customer-workspace)/],
    ['고객 통합 작업(견적)·견적 도구 틀', /(AdminQuoteDesk|quote-booking-workspace)/],
    ['투어 캘린더', /AdminCalendar/],
    ['맞춤견적 관리(이전)', /(AdminQuoteManage|QuoteModals)/],
    ['숙소 배정 · 배정 보드(새 디자인)', /(LodgeAssignQueue|LodgePicker|lodgeBoardModel)/],
    ['숙소 배정·현지 운영', /(AdminAccommodationOps|accommodation\/)/],
    ['가이드 배정 현황', /components\/admin\/guides\//],
    ['상품 목록·추가·수정', /(AdminProduct|DesignTemplateBlockEditor|designEditor\/|HotelPickerModal|TouristSpotPickerModal|CourseImportModal|ItineraryImportModal|ProductTermsChecklist|QuoteDayEditor|QuoteSpotSelector|SelectionModals|quote-day-editor|quote-spot-selector)/],
    ['상품 카테고리', /AdminCategoryManage/],
    ['문서 템플릿', /AdminTemplateManage/],
    ['일반 문의', /AdminInquiryManage/],
    ['후기 관리', /AdminReviewManage/],
    ['FAQ·상품별 FAQ', /(AdminFAQManage|AdminTourFAQManage|TourFAQEditor)/],
    ['매거진 관리', /AdminMagazineManage/],
    ['홈 화면(배너)', /AdminBannerManage/],
    ['여행기획전', /AdminPromotionManage/],
    ['상품용 가이드·숙소', /(AdminGuideManage|AdminAccommodationManage)/],
    ['콘텐츠 공통 CSS', /AdminContentManage\.css/],
    ['관리자 로그인', /AdminLogin/],
    ['코스 관리(React 전환)', /AdminCourseManage/],
    ['일정 관리(React 전환)', /AdminItineraryManage/],
    ['여행지 관리(React 전환)', /AdminSpotManage/],
    ['견적 도구 공통 CSS', /public\/admin-tools\.css/],
    ['(쓰이지 않는 파일)', /AdminAssignment/],
    ...QUOTE_TOOLS.map((t) => [`견적 도구: ${t}`, new RegExp(`public/${t}\\.html$`)]),
];
export const screenOf = (file) => (SCREENS.find(([, re]) => re.test(file)) || ['기타'])[0];

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
/** 우리 관리자 부품 폴더 — 생 <button>·<input>·<table>로 부품을 만드는 유일한 곳 */
export const UI_DIR = /^src\/components\/admin\/ui\//;
/** 우리 관리자 부품을 가져오는 경로: …/components/admin/ui, ../ui, ./ui, (부품 폴더 안) ./AdminButton */
const UI_IMPORT = /(^|\/)components\/admin\/ui(\/[\w-]+)?$|^(\.\.\/)+ui(\/[\w-]+)?$|^\.\/ui(\/[\w-]+)?$|^\.\/(Admin\w+|index)$/;
const count = (s, re) => (s.match(re) || []).length;
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/g, '$1');
const SIZE_PROPS = 'fontSize|padding(?:Top|Bottom|Left|Right|Inline|Block)?|margin(?:Top|Bottom|Left|Right|Inline|Block)?|height|minHeight|maxHeight|width|minWidth|maxWidth|borderRadius|gap|rowGap|columnGap|top|left|right|bottom|lineHeight|letterSpacing';

/** TSX 한 파일의 수치 */
export function measureTsx(src) {
    const s = stripComments(src);
    // 공통 부품 = 우리 관리자 부품(components/admin/ui의 Admin*·*Page)
    const imported = new Set();
    for (const m of s.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
        const from = m[2];
        if (!UI_IMPORT.test(from)) continue;
        for (const name of m[1].split(',')) {
            const n = name.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop();
            if (!/^[A-Z]/.test(n || '')) continue;
            if (!/^(Admin[A-Z]\w*|ListPage|FormPage|DetailPage|DashboardPage)$/.test(n)) continue;
            imported.add(n);
        }
    }
    const parts = [...imported].reduce((n, name) => n + count(s, new RegExp(`<${name}\\b`, 'g')), 0);
    const buttons = [...s.matchAll(/<button\b[^>]*>/g)].map((m) => m[0]);
    const fields = [...s.matchAll(/<(input|select|textarea)\b[^>]*>/g)].map((m) => m[0]).filter((t) => !/type=["'](hidden|file)["']/.test(t));
    return {
        parts,
        rawButton: buttons.filter((t) => !/className=[^>]*\badm-/.test(t)).length,
        rawField: fields.length,
        rawTable: count(s, /<table\b/g),
        inlineStyle: count(s, /style=\{\{/g),
        px: count(s, new RegExp(`\\b(?:${SIZE_PROPS})\\s*:\\s*['"\`]?-?\\d`, 'g')),
        hex: count(s, HEX),
        nativeDialog: count(s, /(^|[^.\w])(?:window\.)?(?:confirm|prompt)\(/gm),
    };
}

/** CSS 한 파일(또는 <style> 묶음)의 수치 */
export function measureCss(src) {
    const s = src.replace(/\/\*[\s\S]*?\*\//g, '');
    const decls = [...s.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)];
    const rawPx = decls.filter(([, prop, val]) => /^(font-size|font|border-radius|height|min-height|line-height|padding(-[a-z]+)?|margin(-[a-z]+)?|gap|row-gap|column-gap)$/.test(prop)
        && /(^|[\s(,])(?:[2-9]|\d{2,})(?:\.\d+)?px/.test(val.replace(/var\([^)]*\)/g, ''))).length;
    return { lines: count(s, /\n/g), hex: count(s, HEX), important: count(s, /!important/g), rawPx };
}

/** 견적 도구 문서(정적 HTML)의 수치 */
export function measureHtml(src) {
    const styles = (src.match(/<style[^>]*>[\s\S]*?<\/style>/g) || []).join('\n');
    const css = measureCss(styles);
    const body = src.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '').replace(/<link rel="icon"[^>]*>/g, '');
    return {
        styleLines: css.lines, hex: css.hex + count(body, HEX), important: css.important, rawPx: css.rawPx,
        inlineStyle: count(body, /style\s*=\s*["'`]/g) + count(body, /\.style\.[a-zA-Z]+\s*=/g) + count(body, /\.style\.cssText/g),
        nativeDialog: count(body, /(^|[^.\w])(?:window\.)?(?:alert|confirm|prompt)\(/gm),
    };
}

export function measureAll() {
    const { tsx, css, html } = adminDesignFiles();
    const files = {};
    for (const f of tsx) {
        const m = measureTsx(read(f));
        // 우리 관리자 부품 폴더는 생 HTML 요소로 부품을 만드는 곳이라 생 부품 수를 세지 않는다(인라인 style·숫자 크기·색은 센다)
        if (UI_DIR.test(f)) Object.assign(m, { rawButton: 0, rawField: 0, rawTable: 0 });
        files[f] = { kind: 'tsx', ...m };
    }
    for (const f of css) if (fs.existsSync(path.join(root, f))) files[f] = { kind: 'css', ...measureCss(read(f)) };
    for (const f of html) files[f] = { kind: 'html', ...measureHtml(read(f)) };
    return files;
}

/** 파일 수치를 화면별로 묶는다 */
export function summarize(files) {
    const by = new Map();
    for (const [f, m] of Object.entries(files)) {
        const name = screenOf(f);
        const r = by.get(name) || { screen: name, files: 0, parts: 0, raw: 0, inlineStyle: 0, px: 0, hex: 0, important: 0, cssRawPx: 0, nativeDialog: 0 };
        r.files++;
        if (m.kind === 'tsx') { r.parts += m.parts; r.raw += m.rawButton + m.rawField + m.rawTable; r.inlineStyle += m.inlineStyle; r.px += m.px; r.hex += m.hex; r.nativeDialog += m.nativeDialog; }
        if (m.kind === 'css') { r.hex += m.hex; r.important += m.important; r.cssRawPx += m.rawPx; }
        if (m.kind === 'html') { r.hex += m.hex; r.important += m.important; r.cssRawPx += m.rawPx; r.inlineStyle += m.inlineStyle; r.nativeDialog += m.nativeDialog; }
        by.set(name, r);
    }
    const order = SCREENS.map(([n]) => n).concat('기타');
    return [...by.values()].map((r) => ({ ...r, adoption: r.parts + r.raw ? Math.round((r.parts / (r.parts + r.raw)) * 100) : null }))
        .sort((a, b) => order.indexOf(a.screen) - order.indexOf(b.screen));
}

// 기준선에 오르는 수치(줄이기만 한다). parts·lines는 늘어나도 되므로 빼고, 새로 생긴 파일은 아래 NEW_FILE_LIMIT을 따른다.
export const BUDGET_KEYS = { tsx: ['rawButton', 'rawField', 'rawTable', 'inlineStyle', 'px', 'hex', 'nativeDialog'], css: ['hex', 'important', 'rawPx'], html: ['hex', 'important', 'rawPx', 'inlineStyle', 'nativeDialog'] };
/** 기준선에 없는 새 파일의 상한 — 새 화면은 처음부터 우리 관리자 부품(components/admin/ui)과 --adm-* 변수만 쓴다 */
export const NEW_FILE_LIMIT = { tsx: { rawButton: 0, rawField: 0, rawTable: 0, px: 0, hex: 0, nativeDialog: 0 }, css: { hex: 0, important: 0, rawPx: 0 }, html: { hex: 0, important: 0, rawPx: 0, nativeDialog: 0 } };
export const BASELINE_PATH = 'scripts/admin-design-baseline.json';

function toMarkdown(files, rows) {
    const total = rows.reduce((a, r) => ({ parts: a.parts + r.parts, raw: a.raw + r.raw, inlineStyle: a.inlineStyle + r.inlineStyle, px: a.px + r.px, hex: a.hex + r.hex, important: a.important + r.important, cssRawPx: a.cssRawPx + r.cssRawPx }), { parts: 0, raw: 0, inlineStyle: 0, px: 0, hex: 0, important: 0, cssRawPx: 0 });
    const pct = (r) => r.adoption == null ? '—' : `${r.adoption}%`;
    const lines = [
        '# 관리자 디자인 전환 현황',
        '',
        '`node scripts/check-admin-design.mjs --md`가 만든 문서다. 손으로 고치지 않는다. 규칙은 [admin-design-system.md](admin-design-system.md), 화면 목록은 [admin-screen-inventory.md](admin-screen-inventory.md).',
        '',
        '- **부품 전환율** = 공통 부품 수 ÷ (공통 부품 + 생 `<button>`·`<input>`·`<select>`·`<textarea>`·`<table>`). 공통 부품은 우리 관리자 부품(`components/admin/ui`의 `Admin*`·`ListPage` 등, 당근 Seed 모양)이다. 그 폴더는 생 HTML 요소로 부품을 만드는 곳이라 생 부품 수를 세지 않는다. `adm-` 클래스를 단 버튼은 공통 부품으로 센다.',
        '- **직접 지정**: 인라인 `style={{}}` 수, 숫자로 적은 크기(px), 직접 적은 색(hex), `!important`, CSS에 숫자로 적은 크기(글자·모서리·높이·여백).',
        '- 이 수치는 `scripts/admin-design-baseline.json`의 상한보다 늘어나면 `tests/admin-design-budget.test.mjs`가 실패한다(PR마다 CI에서 검사). 줄였으면 `--write-baseline`으로 상한을 낮춘다.',
        '',
        `전체: 공통 부품 ${total.parts}개 / 생 HTML 부품 ${total.raw}개 → **전환율 ${Math.round(total.parts / Math.max(1, total.parts + total.raw) * 100)}%** · 인라인 style ${total.inlineStyle} · 숫자 크기 ${total.px + total.cssRawPx} · 직접 색 ${total.hex} · !important ${total.important}`,
        '',
        '| 화면 | 파일 | 부품 전환율 | 공통 부품 | 생 HTML 부품 | 인라인 style | 숫자 크기(TSX/CSS) | 직접 색 | !important | 기본 확인창 |',
        '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
        ...rows.map((r) => `| ${r.screen} | ${r.files} | ${pct(r)} | ${r.parts} | ${r.raw} | ${r.inlineStyle} | ${r.px} / ${r.cssRawPx} | ${r.hex} | ${r.important} | ${r.nativeDialog} |`),
        '',
        '## 파일별 상위 20 (생 부품 + 인라인 style + 숫자 크기)',
        '',
        '| 파일 | 화면 | 생 부품 | 인라인 style | 숫자 크기 | 직접 색 |',
        '|---|---|---:|---:|---:|---:|',
        ...Object.entries(files).filter(([, m]) => m.kind === 'tsx')
            .map(([f, m]) => [f, m, m.rawButton + m.rawField + m.rawTable + m.inlineStyle + m.px])
            .sort((a, b) => b[2] - a[2]).slice(0, 20)
            .map(([f, m]) => `| \`${f}\` | ${screenOf(f)} | ${m.rawButton + m.rawField + m.rawTable} | ${m.inlineStyle} | ${m.px} | ${m.hex} |`),
        '',
    ];
    return lines.join('\n');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
    const files = measureAll();
    const rows = summarize(files);
    if (process.argv.includes('--write-baseline')) {
        const base = {};
        for (const [f, m] of Object.entries(files)) base[f] = Object.fromEntries(BUDGET_KEYS[m.kind].map((k) => [k, m[k]]));
        fs.writeFileSync(path.join(root, BASELINE_PATH), JSON.stringify(base, null, 1) + '\n');
        console.log(`기준선 저장: ${BASELINE_PATH} (${Object.keys(base).length}개 파일)`);
    }
    if (process.argv.includes('--md')) {
        fs.writeFileSync(path.join(root, 'docs/admin-design-adoption.md'), toMarkdown(files, rows));
        console.log('문서 저장: docs/admin-design-adoption.md');
    }
    console.table(rows.map((r) => ({ 화면: r.screen, 파일: r.files, 전환율: r.adoption == null ? '—' : r.adoption + '%', 공통부품: r.parts, 생부품: r.raw, 인라인: r.inlineStyle, 숫자크기: r.px + r.cssRawPx, 직접색: r.hex, important: r.important })));
    void rel;
}
