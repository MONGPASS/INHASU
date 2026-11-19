// 관리자 코드에서 Montage 규칙을 벗어난 자리를 센다 (docs/admin-design-system.md, CLAUDE.md 5.0).
//  - hex: hex 색 고정값 (#fff, #0066FF, #0066FF1F …)
//  - controls: 직접 만든 버튼·입력창 — CSS 클래스(.btn-*, .*-button, .*-input, .*-field …)와
//    TSX의 버튼·입력창 부품/스타일 함수(SaveButton, ghostBtn, …)
// 고객 화면 파일은 보지 않는다. 기존 자리는 tests/admin-design-baseline.json에 파일별 개수로 둔다.
//
//   node scripts/admin-design-scan.mjs          현재 개수를 출력
//   node scripts/admin-design-scan.mjs --write  기준 목록을 현재 개수로 다시 쓴다(줄였을 때만 쓸 것)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
export const BASELINE_PATH = join(root, 'tests', 'admin-design-baseline.json');

// 견적 도구 8개 (관리자 안에 끼워 넣는 문서)
export const QUOTE_TOOL_FILES = ['견적관리', '예약목록', '예약관리', '견적만들기', '코스관리', '일정관리', '명소관리', '리소스관리'].map((name) => `public/${name}.html`);
// 변수 정의 파일: Montage 값과 같은 hex를 var()의 두 번째 값으로 둔다(견적 도구용). 검사하지 않는다.
const DEFINITION_FILES = new Set(['public/admin-tokens.css']);

const walk = (dir) => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);
const rel = (file) => relative(root, join(root, file)).split('\\').join('/');

export function adminDesignFiles() {
    const code = /\.(tsx?|css)$/;
    const files = [
        ...walk('src/components/admin').filter((file) => code.test(file)),
        ...readdirSync(join(root, 'src/pages')).filter((name) => /^Admin.*\.(tsx?|css)$/.test(name)).map((name) => join('src/pages', name)),
        ...readdirSync(join(root, 'src/styles')).filter((name) => /^admin-.*\.css$/.test(name)).map((name) => join('src/styles', name)),
        ...readdirSync(join(root, 'public')).filter((name) => /^admin-.*\.css$/.test(name)).map((name) => join('public', name)),
        ...QUOTE_TOOL_FILES,
    ].map(rel).filter((file) => !DEFINITION_FILES.has(file));
    return [...new Set(files)].sort();
}

const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![0-9a-zA-Z_-])/g;
// HTML 문서의 &#123; 같은 문자 참조와 주소 조각(href="#abc")은 색이 아니다.
const NOT_COLOR = /&#[0-9a-fA-F]+;?|href=["']#[^"']*["']|url\(#[^)]*\)/g;
// CSS에서 새로 정의하는 버튼·입력창 클래스 (.btn, .btn-ink, .at-icon-button, .form-input, .search-field …)
const CONTROL_CLASS = /\.((?:[a-zA-Z0-9_-]*[-_])?(?:btn|button|input|field)(?:[-_][a-zA-Z0-9_-]*)?)(?=[\s,.:{>+~[)]|$)/g;
// TSX의 직접 만든 버튼·입력창 부품과 스타일 함수 (function SaveButton(, const ghostBtn = …)
const CONTROL_FACTORY = /(?:function|const|let)\s+([A-Za-z_]\w*(?:Btn|Button|Input|Field))\s*[=(:<]/g;

const stripComments = (text, css) => css
    ? text.replace(/\/\*[\s\S]*?\*\//g, '')
    : text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:"'`\\])\/\/[^\n]*/g, '$1').replace(/<!--[\s\S]*?-->/g, '');

/** CSS 선택자(규칙의 `{` 앞)에서만 클래스 이름을 모은다. */
function cssControlClasses(css) {
    const names = new Set();
    for (const match of css.matchAll(/([^{}]+)\{/g)) {
        const selector = match[1];
        if (/^\s*@/.test(selector)) continue;
        for (const found of selector.matchAll(CONTROL_CLASS)) names.add(found[1]);
    }
    return names;
}

export function scanFile(file) {
    const text = readFileSync(join(root, file), 'utf8');
    const isCss = file.endsWith('.css');
    const body = stripComments(text, isCss).replace(NOT_COLOR, '');
    const hex = (body.match(HEX) || []).length;
    const controls = new Set();
    if (isCss) for (const name of cssControlClasses(body)) controls.add(name);
    else if (file.endsWith('.html')) {
        for (const style of body.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) for (const name of cssControlClasses(style[1])) controls.add(name);
    } else {
        for (const found of body.matchAll(CONTROL_FACTORY)) controls.add(found[1]);
    }
    return { hex, controls: controls.size };
}

export function scanAdminDesign() {
    const result = {};
    for (const file of adminDesignFiles()) {
        const { hex, controls } = scanFile(file);
        if (hex || controls) result[file] = { hex, controls };
    }
    return result;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const scan = scanAdminDesign();
    const total = Object.values(scan).reduce((sum, { hex, controls }) => ({ hex: sum.hex + hex, controls: sum.controls + controls }), { hex: 0, controls: 0 });
    if (process.argv.includes('--write')) {
        writeFileSync(BASELINE_PATH, JSON.stringify({ _note: '관리자 코드에 남은 hex 색 고정값·직접 만든 버튼/입력창 개수(파일별). 줄일 때만 고친다. scripts/admin-design-scan.mjs --write', total, files: scan }, null, 2) + '\n');
        console.log(`기준 목록을 다시 썼습니다: hex ${total.hex} · 버튼/입력창 ${total.controls} (${Object.keys(scan).length}개 파일)`);
    } else {
        for (const [file, counts] of Object.entries(scan)) console.log(`${String(counts.hex).padStart(4)} hex  ${String(counts.controls).padStart(3)} controls  ${file}`);
        console.log(`합계: hex ${total.hex} · 버튼/입력창 ${total.controls}`);
    }
}
