// 관리자 아이콘 부품(src/components/admin/ui/AdminIcons.tsx)을 당근 Seed 아이콘 SVG로 만든다.
// 원본: docs/seed-design/assets/svg (daangn/seed-icon, MIT — 24×24 한 색 path, currentColor)
// 부품 이름은 예전 @montage-ui/icon 이름 그대로 둬서 화면 코드는 가져오는 곳만 바뀐다(2026-11-23 단계 3).
// 아이콘을 더하려면: 아래 MAP에 한 줄 넣고(없는 SVG는 daangn/seed-icon assets/svg에서 가져와 원본 폴더에 넣는다)
//   node scripts/build-seed-icons.mjs        → 파일을 다시 쓴다
//   node scripts/build-seed-icons.mjs --check → 파일이 MAP·SVG와 같은지 확인만(다르면 종료 코드 1)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const SVG_DIR = 'docs/seed-design/assets/svg';
export const OUT = 'src/components/admin/ui/AdminIcons.tsx';

// 부품 이름 → Seed 파일 이름(icon_<이름>.svg에서 가운데)
export const MAP = {
    IconApps: 'chart_regular',              // 대시보드
    IconArrowDown: 'arrow_downward_regular',
    IconArrowUp: 'arrow_upward_regular',
    IconBook: 'story_article_regular',      // 매거진
    IconCalendar: 'calendar_regular',
    IconCheck: 'check_regular',
    IconCheckThick: 'check_regular',
    IconChevronDown: 'expand_more_regular',
    IconChevronDownSmall: 'expand_more_regular',
    IconChevronLeft: 'chevron_left_regular',
    IconChevronRight: 'chevron_right_regular',
    IconChevronUp: 'expand_less_regular',
    IconCircleCloseFill: 'close_fill',
    IconCircleExclamationFill: 'warning_fill',
    IconCircleQuestion: 'help_regular',
    IconClock: 'clock_regular',
    IconClose: 'close_regular',
    IconCoins: 'money_won_regular',
    IconDocument: 'article_regular',        // 문서 템플릿(file은 클립 모양이라 쓰지 않음)
    IconDocumentText: 'search_doc_regular', // 견적 문의
    IconDownload: 'download_regular',
    IconFlag: 'map_regular',                // 코스
    IconFolder: 'product_regular',          // 상품
    IconHome: 'home_regular',
    IconImage: 'photo_regular',
    IconInbox: 'search_doc_regular',        // 빈 목록
    IconListCategory: 'list_regular',
    IconLocation: 'location_regular',
    IconLogout: 'signout_regular',
    IconMail: 'chatting_regular',           // 문의
    IconMegaphone: 'loudspeaker_regular',
    IconMinus: 'subtraction_regular',
    IconMoreHorizontal: 'more_horiz_regular',
    IconMoreVertical: 'more_vert_regular',
    IconPencil: 'edit_regular',
    IconPerson: 'profile_regular',
    IconPersons: 'user_group_regular',
    IconPlus: 'add_regular',
    IconRefresh: 'retry_regular',
    IconSearch: 'search_regular',
    IconStar: 'review_star_regular',
    IconTag: 'hashtag_regular',             // 카테고리
    IconTicket: 'coupon_regular',           // 예약
    IconTrash: 'trash_regular',
    IconUpload: 'ios_share_regular',
};

const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

function paths(file) {
    const svg = readFileSync(join(root, SVG_DIR, `icon_${file}.svg`), 'utf8');
    const out = [...svg.matchAll(/<path\b[^>]*>/g)].map(([tag]) => {
        const d = attr(tag, 'd');
        if (!d) throw new Error(`${file}: d가 없는 path`);
        if (/\stransform=/.test(tag)) throw new Error(`${file}: transform은 다루지 않는다`);
        return attr(tag, 'fill-rule') === 'evenodd' ? { d, even: true } : { d };
    });
    if (!out.length) throw new Error(`${file}: path가 없다`);
    return out;
}

export function render() {
    const glyphs = new Map();
    for (const file of new Set(Object.values(MAP))) glyphs.set(file, paths(file));
    const key = (file) => file.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    const lines = [
        '// 자동 생성 파일 — 손으로 고치지 말 것. scripts/build-seed-icons.mjs가 docs/seed-design/assets/svg(당근 Seed 아이콘, MIT)로 만든다.',
        '// 24×24 한 색, 크기는 글자 크기(1em), 색은 옆 글자색(currentColor)을 따른다. 이름은 예전 @montage-ui/icon 이름 그대로.',
        "import type { SVGProps } from 'react';",
        '',
        'export type AdminIconProps = SVGProps<SVGSVGElement>;',
        'type Glyph = readonly (readonly [d: string, evenOdd?: true])[];',
        '',
        'const G = {',
        ...[...glyphs].map(([file, ps]) => `    ${key(file)}: [${ps.map((p) => `['${p.d}'${p.even ? ', true' : ''}]`).join(', ')}],`),
        '} satisfies Record<string, Glyph>;',
        '',
        'function make(glyph: Glyph, name: string) {',
        '    const Icon = (props: AdminIconProps) => (',
        '        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" focusable="false" aria-hidden={props["aria-label"] ? undefined : true} {...props}>',
        '            {glyph.map(([d, evenOdd], i) => <path key={i} d={d} fillRule={evenOdd ? \'evenodd\' : undefined} clipRule={evenOdd ? \'evenodd\' : undefined} />)}',
        '        </svg>',
        '    );',
        '    Icon.displayName = name;',
        '    return Icon;',
        '}',
        '',
        ...Object.entries(MAP).map(([name, file]) => `export const ${name} = make(G.${key(file)}, '${name}');`),
        '',
    ];
    return lines.join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const next = render();
    const path = join(root, OUT);
    if (process.argv.includes('--check')) {
        const now = readFileSync(path, 'utf8');
        if (now !== next) { console.error(`${OUT}가 MAP·SVG와 다르다 — node scripts/build-seed-icons.mjs`); process.exit(1); }
        console.log(`${OUT} 최신(${Object.keys(MAP).length}개)`);
    } else {
        writeFileSync(path, next);
        console.log(`${OUT} 썼다(${Object.keys(MAP).length}개)`);
    }
}
