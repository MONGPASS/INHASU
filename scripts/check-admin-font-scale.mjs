// 관리자 화면의 글자 크기가 Montage 글자 크기 단계에 있는지 검사한다(--fix로 가장 가까운 단계로 바꾼다).
// 단계: 11 · 12 · 13 · 14 · 15 · 16 · 17 · 18 · 20 · 22 · 24 · 28 · 36 · 40px (docs/admin-design-system.md 글자 크기)
// 대상: 관리자 React 화면의 CSS와 인라인 style, 견적 도구 공통 CSS. 고객 문서·인쇄·캔버스는 대상이 아니다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FONT_SCALE = [11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 36, 40];
const root = fileURLToPath(new URL('../', import.meta.url));

/** 가장 가까운 단계. 두 단계의 한가운데면 작은 쪽(칸이 넘치지 않게). */
export const nearestFontSize = size => FONT_SCALE.reduce((best, step) => Math.abs(step - size) < Math.abs(best - size) ? step : best, FONT_SCALE[0]);

const walk = (dir, test, out = []) => {
    if (!fs.existsSync(dir)) return out;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, test, out); else if (test(full)) out.push(full);
    }
    return out;
};

export function adminFontFiles() {
    const src = path.join(root, 'src');
    const css = [
        ...walk(path.join(src, 'styles'), file => /[\\/](admin|reservation-|quote-booking-workspace|customer-workspace-editor|product-customer-workspace)[^\\/]*\.css$/.test(file)),
        ...walk(path.join(src, 'components', 'admin'), file => file.endsWith('.css')),
        ...walk(path.join(src, 'pages'), file => /[\\/]Admin[^\\/]*\.css$/.test(file)),
        ...['admin-tools.css', 'admin-tokens.css', 'quote-day-editor.css', 'quote-spot-selector.css'].map(name => path.join(root, 'public', name)),
    ];
    const tsx = [
        ...walk(path.join(src, 'components', 'admin'), file => file.endsWith('.tsx')),
        ...walk(path.join(src, 'pages'), file => /[\\/]Admin[^\\/]*\.tsx$/.test(file)),
    ];
    return { css, tsx };
}

// CSS: font-size: 12.5px / font: 700 12.5px Pretendard.  TSX: fontSize: 12.5 / fontSize: '12.5px' / font: '700 12.5px …'
const CSS_PATTERNS = [/(font-size:\s*)(\d+(?:\.\d+)?)(px)/g, /(\bfont:\s*[^;{}]*?\s)(\d+(?:\.\d+)?)(px)/g];
const TSX_PATTERNS = [/(fontSize:\s*)(\d+(?:\.\d+)?)(?=\s*[,}\s])/g, /(fontSize:\s*['"`])(\d+(?:\.\d+)?)(px)/g, /(\bfont:\s*['"`][^'"`]*?\s)(\d+(?:\.\d+)?)(px)/g];

// 아이콘 글꼴(Material Symbols)의 font-size는 글자가 아니라 아이콘 크기라서 검사하지 않는다.
const ICON = /material-symbols|<(?:Icon|Ico|DashboardIcon)[ \n/>]/;
function isIconSize(text, offset, kind) {
    if (kind === 'css') {
        const open = text.lastIndexOf('{', offset), close = text.lastIndexOf('}', open);
        return open >= 0 && ICON.test(text.slice(close + 1, open));
    }
    return ICON.test(text.slice(text.lastIndexOf('<', offset), offset));
}

export function scanText(text, patterns, fix = false, kind = 'css') {
    const found = [];
    let next = text;
    for (const pattern of patterns) {
        next = next.replace(pattern, (match, before, value, ...rest) => {
            const unit = typeof rest[0] === 'string' ? rest[0] : '', offset = rest.find(item => typeof item === 'number'), source = rest[rest.length - 1];
            const size = Number(value);
            if (FONT_SCALE.includes(size) || isIconSize(typeof source === 'string' ? source : text, offset, kind)) return match;
            found.push({ size, to: nearestFontSize(size) });
            return fix ? `${before}${nearestFontSize(size)}${unit}` : match;
        });
    }
    return { found, text: next };
}

export function scanAdminFonts({ fix = false } = {}) {
    const { css, tsx } = adminFontFiles(), report = [];
    for (const [files, patterns, kind] of [[css, CSS_PATTERNS, 'css'], [tsx, TSX_PATTERNS, 'tsx']]) {
        for (const file of files) {
            const before = fs.readFileSync(file, 'utf8'), result = scanText(before, patterns, fix, kind);
            if (!result.found.length) continue;
            report.push({ file: path.relative(root, file).replaceAll('\\', '/'), found: result.found });
            if (fix && result.text !== before) fs.writeFileSync(file, result.text);
        }
    }
    return report;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    const fix = process.argv.includes('--fix'), report = scanAdminFonts({ fix });
    const total = report.reduce((sum, row) => sum + row.found.length, 0);
    for (const row of report.sort((a, b) => b.found.length - a.found.length)) {
        const sizes = Object.entries(row.found.reduce((map, item) => ({ ...map, [`${item.size}→${item.to}`]: (map[`${item.size}→${item.to}`] || 0) + 1 }), {})).map(([key, count]) => `${key}×${count}`).join(' ');
        console.log(`${String(row.found.length).padStart(3)}  ${row.file}  ${sizes}`);
    }
    console.log(`${fix ? '바꾼 곳' : '단계에 없는 글자 크기'}: ${total}곳 / ${report.length}개 파일`);
    if (!fix && total) process.exitCode = 1;
}
