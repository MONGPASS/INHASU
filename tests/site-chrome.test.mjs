// 견적 고객 페이지의 머리·바닥(public/site-chrome.js)이 사이트(React) 원본과 같은 메뉴·회사 정보를 쓰는지,
// 문서 본문과 관리자 미리보기·인쇄를 건드리지 않는지 확인한다.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const chrome = read('public/site-chrome.js'), css = read('public/site-chrome.css');
const PAGES = ['내견적', '계약서', '여행자정보', '확정일정표', '확정일정표-모바일'];

test('견적 고객 페이지는 사이트 머리·바닥 스크립트를 부르고 기존 머리·바닥 자리와 주소를 유지한다', () => {
    for (const page of PAGES) {
        const html = read(`public/${page}.html`);
        assert.match(html, /<link rel="stylesheet" href="\/site-chrome\.css">\s*<script src="\/site-chrome\.js" defer><\/script>/, page);
        assert.match(html, /<header class="mw-header[^"]*">/, `${page}: 스크립트가 실패해도 보일 기존 머리`);
        if (!page.startsWith('확정일정표')) assert.match(html, /<footer class="mw-footer[^"]*">/, page); // 확정일정표 문서는 원래 바닥이 없다
    }
    assert.ok(fs.existsSync(new URL('../public/img/brand/site-logo.webp', import.meta.url)));
    assert.deepEqual(fs.readFileSync(new URL('../public/img/brand/site-logo.webp', import.meta.url)), fs.readFileSync(new URL('../src/assets/logo_horizontal.webp', import.meta.url)), '사이트와 같은 로고 파일');
});

// 회사 정보는 ‘이름 · 값’ 표라 값으로 비교한다.
test('메뉴 주소·하단 메뉴·회사 정보가 사이트 원본과 같다', () => {
    const header = read('src/components/layout-desktop/DesktopHeader.tsx'), footer = read('src/components/layout-desktop/DesktopFooter.tsx'), tabs = read('src/components/mobile/MobileTabBar.tsx');
    for (const [, label, path] of header.matchAll(/\{ id: '\w+', label: '([^']+)', path: '([^']+)'/g)) assert.ok(chrome.includes(`["${label}", "${path}"]`), `상단 메뉴 ${label}`);
    for (const [, label, path] of footer.matchAll(/\{ label: '([^']+)', path: '([^']+)' \}/g)) assert.ok(chrome.includes(`["${label}", "${path}"]`), `바닥 ${label}`);
    const compactLinks = footer.slice(footer.indexOf('const COMPACT_LINKS'), footer.indexOf('];', footer.indexOf('const COMPACT_LINKS')));
    assert.ok(compactLinks.length > 0, '휴대폰 바닥 링크 목록');
    for (const [, label] of compactLinks.matchAll(/label: '([^']+)'/g)) assert.ok(chrome.slice(chrome.indexOf('COMPACT_LINKS')).includes(`["${label}",`), `휴대폰 바닥 ${label}`);
    for (const [, label, path] of tabs.matchAll(/key: '(?:home|search|booking|wish)', label: '([^']+)', path: '([^']+)'/g)) assert.ok(chrome.includes(`["${label}", "${path}"`), `하단 메뉴 ${label}`);
    assert.equal([...tabs.matchAll(/key: '(?:home|search|booking|wish)', label: '/g)].length, 4, '하단 메뉴 4칸 + 마이페이지');
    for (const fact of ['몽골리아 은하수 (SUUN ZAM)', 'Davaasuren Bilguun', '9011640064', '6124313', '+976 9594 5838 · +976 8010 7766', 'DACO센터 3층 306호', '헬로볼라', 'Davaasuren Bolor', '730-54-00614', '제2022-서울중랑-1776호', 'bolor1@hanmail.net']) {
        assert.ok(footer.includes(fact) && chrome.includes(fact), fact);
    }
    assert.ok(chrome.includes(read('src/constants/company.ts').match(/KAKAO_CHANNEL_URL = '([^']+)'/)[1]));
    assert.match(css, /@media \(min-width: 1024px\)/, '사이트와 같은 PC 기준');
});

// 최소 DOM으로 실제 스크립트를 실행한다.
function run({ search = '', embedded = false, withHeader = true } = {}) {
    const element = (cls = '') => ({ classList: { list: new Set(cls.split(' ').filter(Boolean)), add(name) { this.list.add(name); }, contains(name) { return this.list.has(name); }, toggle() {} },
        innerHTML: 'old', hidden: false, inserted: [], setAttribute() {}, addEventListener() {}, querySelector: () => element(), querySelectorAll: () => [],
        insertAdjacentElement(_where, node) { this.inserted.push(node); }, appendChild() {} });
    const header = withHeader ? element('mw-header') : null, footer = element('mw-footer'), appended = [], root = element();
    const document = { readyState: 'complete', documentElement: root, body: { appendChild: node => appended.push(node) }, addEventListener() {},
        querySelector: selector => selector === 'header.mw-header' ? header : selector === 'footer.mw-footer' ? footer : null, querySelectorAll: () => [], createElement: () => element() };
    const self = {}, window = { self, top: embedded ? {} : self };
    vm.runInNewContext(chrome, { document, window, location: { search }, URLSearchParams, fetch: () => Promise.resolve({ ok: false }), encodeURIComponent, Image: function () {} });
    return { header, footer, appended, root };
}

test('고객이 직접 연 문서에서만 머리·바닥을 바꾸고 관리자 미리보기·인쇄·끼운 화면은 그대로 둔다', () => {
    const shown = run({ search: '?t=token' });
    assert.match(shown.header.innerHTML, /site-logo\.webp/); assert.match(shown.header.innerHTML, /몽골리아 <b>은하수<\/b>/); assert.match(shown.header.innerHTML, /action="\/products"/);
    assert.match(shown.footer.innerHTML, /몽골 본사/); assert.match(shown.footer.innerHTML, /한국 대리점/); assert.equal(shown.appended.length, 2, '하단 메뉴와 메뉴 서랍');
    assert.ok(shown.root.classList.contains('sc-on')); assert.ok(shown.header.classList.contains('sc-ready'));
    assert.doesNotMatch(shown.header.innerHTML + shown.footer.innerHTML, /token/, '고객 링크 값을 머리·바닥에 넣지 않는다');
    for (const search of ['?adminId=abc&preview=1', '?t=token&adminPrint=1', '?t=token&print=1']) {
        const kept = run({ search });
        assert.equal(kept.header.innerHTML, 'old', search); assert.equal(kept.appended.length, 0); assert.ok(kept.header.classList.contains('sc-ready'), '기존 머리를 바로 보여 준다');
    }
    const framed = run({ search: '?t=token', embedded: true });
    assert.equal(framed.header.innerHTML, 'old'); assert.equal(framed.appended.length, 0);
    assert.doesNotThrow(() => run({ withHeader: false }));
});

test('인쇄(PDF)와 끼운 계약서에서는 사이트 메뉴·하단 탭을 숨긴다', () => {
    assert.match(css, /@media print \{ \.sc-nav, \.sc-tabbar, \.sc-drawer \{ display: none !important; \}/);
    assert.match(css, /\.embedded-contract \.sc-nav, \.embedded-contract \.sc-tabbar/);
    assert.match(read('public/quote-theme.css'), /\.mw-header, \.mw-footer[^{]*\{ display: none !important; \}/);
});
