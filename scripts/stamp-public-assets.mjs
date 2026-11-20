// 빌드 뒤 dist의 정적 문서(견적 도구·견적 고객 페이지)가 부르는 공용 CSS·JS 주소에 내용 버전(?v=)을 붙인다.
// Cloudflare가 .css/.js에 브라우저 캐시 4시간(max-age=14400)을 붙여, 배포 뒤에도 이전 스타일이 몇 시간 남던 문제를 막는다.
// 문서(.html)는 매번 새로 확인하므로, 문서 안 주소가 바뀌면 브라우저가 새 파일을 받는다.
// public/의 원본 문서는 바꾸지 않는다(dist 사본만). 이미 이름에 해시가 있는 파일(lodging.<hash>.js 등)과 외부 주소는 그대로 둔다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const versions = new Map();
const version = name => {
    if (!versions.has(name)) {
        const file = path.join(dist, name);
        versions.set(name, fs.existsSync(file) && fs.statSync(file).isFile()
            ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 10) : null);
    }
    return versions.get(name);
};

export function stampHtml(html, versionOf = version) {
    return html.replace(/\b(href|src)="(\/?)([A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*\.(?:css|js))"/g, (match, attr, slash, name) => {
        if (/\.[0-9a-f]{8,}\.(?:css|js)$/.test(name)) return match;
        const v = versionOf(name);
        return v ? `${attr}="${slash}${name}?v=${v}"` : match;
    });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
    let changed = 0;
    for (const entry of fs.readdirSync(dist)) {
        if (!entry.endsWith('.html') || entry === 'index.html') continue;
        const file = path.join(dist, entry), before = fs.readFileSync(file, 'utf8'), after = stampHtml(before);
        if (after !== before) { fs.writeFileSync(file, after); changed++; }
    }
    console.log(`stamp-public-assets: ${changed}개 문서의 공용 CSS·JS 주소에 버전을 붙였습니다.`);
}
