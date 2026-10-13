// Material Symbols 서브셋 동기화 검사
// index.html의 icon_names= 서브셋에 코드에서 쓰는 아이콘이 모두 포함됐는지 확인한다.
// 누락된 아이콘은 폰트에 글리프가 없어 원시 텍스트("chevron_right" 등)로 노출된다.
//
// 사용법:  node scripts/check-icon-subset.mjs
// 종료 코드: 0 = 정상, 1 = 누락 있음
//
// 추출 방식: src/**/*.{ts,tsx} + index.html에서
//   1) 따옴표 문자열 리터럴  ('star', "menu" 등 — 객체 필드/props)
//   2) JSX 자식 텍스트       (<span ...>menu</span>)
//   3) 한 줄짜리 토큰        (여러 줄 JSX 자식)
// 을 모은 뒤, 공식 아이콘 목록(material-symbols-names.txt)과 교집합인 이름만
// 아이콘 후보로 보고 서브셋과 비교한다. 일반 식별자('created_at' 등)는
// 공식 목록에 없으므로 자동으로 걸러진다.
//
// material-symbols-names.txt 갱신(새 아이콘이 목록에 없다고 잘못 뜰 때):
//   curl -s "https://raw.githubusercontent.com/google/material-design-icons/master/variablefont/MaterialSymbolsOutlined%5BFILL%2CGRAD%2Copsz%2Cwght%5D.codepoints" | awk '{print $1}' | sort -u > scripts/material-symbols-names.txt

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function* walk(dir) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) yield* walk(p);
        else if (/\.(tsx?|html)$/.test(name)) yield p;
    }
}

const official = new Set(
    readFileSync(join(root, 'scripts', 'material-symbols-names.txt'), 'utf8')
        .split('\n').map(s => s.trim()).filter(Boolean),
);

const html = readFileSync(join(root, 'index.html'), 'utf8');
const m = html.match(/icon_names=([a-z0-9_,]+)/);
if (!m) {
    console.error('index.html에서 icon_names= 파라미터를 찾지 못했습니다.');
    process.exit(1);
}
const names = m[1].split(',');
const subset = new Set(names);

// ⚠ 중복 이름이 있으면 Google Fonts가 요청 전체를 400으로 거부해
// 사이트의 모든 아이콘이 빈 칸으로 나온다 (2026-09-02 photo_library 중복 사고).
if (names.length !== subset.size) {
    const seen = new Set();
    const dups = names.filter(n => (seen.has(n) ? true : (seen.add(n), false)));
    console.error('✗ index.html icon_names에 중복 이름이 있습니다 (Google Fonts가 400을 반환함):');
    for (const d of new Set(dups)) console.error('   -', d);
    process.exit(1);
}

// 두 <link>(preload + stylesheet)의 목록이 서로 다르면 한쪽만 고친 것
const all = [...html.matchAll(/icon_names=([a-z0-9_,]+)/g)].map(x => x[1]);
if (new Set(all).size > 1) {
    console.error('✗ index.html의 icon_names 두 곳(preload/stylesheet)이 서로 다릅니다. 둘 다 같게 고치세요.');
    process.exit(1);
}

const tokens = new Set();
const files = [...walk(join(root, 'src')), join(root, 'index.html')];
for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const re of [
        /['"`]([a-z][a-z0-9_]{2,40})['"`]/g,   // 문자열 리터럴
        />([a-z][a-z0-9_]{2,40})</g,            // JSX 자식 텍스트
        /^\s*([a-z][a-z0-9_]{2,40})\s*$/gm,     // 한 줄짜리 토큰
    ]) {
        for (const hit of text.matchAll(re)) tokens.add(hit[1]);
    }
}

const usedIcons = [...tokens].filter(t => official.has(t));
const missing = usedIcons.filter(t => !subset.has(t)).sort();

if (missing.length) {
    console.log('✗ 코드에서 쓰는데 index.html icon_names 서브셋에 없는 아이콘:');
    for (const t of missing) console.log('  - ' + t);
    console.log('\nindex.html의 두 Material Symbols <link> URL 모두에 위 이름을 추가하세요 (알파벳순 정렬 유지).');
    process.exit(1);
}
console.log(`✓ 서브셋 동기화 OK — icon_names ${subset.size}개, 코드에서 감지된 아이콘 ${usedIcons.length}개`);
