import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import postcss from 'postcss';

const source = fs.readFileSync(new URL('../public/admin-embed.js', import.meta.url), 'utf8');
const theme = fs.readFileSync(new URL('../public/admin-redesign.css', import.meta.url), 'utf8');

function fixture({ parent = 'https://admin.example.invalid/admin/quote-desk/spots', page = 'https://admin.example.invalid/명소관리', standalone = false, crossOrigin = false } = {}) {
    const classes = new Set(), appended = [];
    const element = tagName => ({ tagName, attributes: {}, children: [],
        setAttribute(key, value) { this.attributes[key] = value; },
        appendChild(child) { this.children.push(child); } });
    const root = element('html'); root.classList = { add: value => classes.add(value) };
    const document = { documentElement: root, readyState: 'loading', addEventListener() {},
        head: { appendChild(node) { appended.push(node); } },
        querySelector(selector) {
            return appended.find(node => selector === 'style[data-admin-embed]'
                ? node.tagName === 'style' && Object.hasOwn(node.attributes, 'data-admin-embed')
                : node.tagName === 'link' && Object.hasOwn(node.attributes, 'data-admin-redesign')) || null;
        },
        createElement: element, createTextNode: value => value };
    const window = { location: new URL(page) };
    window.self = window;
    window.top = standalone ? window : crossOrigin ? Object.defineProperty({}, 'location', { get() { throw new Error('cross-origin access denied'); } }) : { location: new URL(parent) };
    const forbidden = () => { throw new Error('Styling must not access credentials, send requests or execute design code'); };
    for (const key of ['localStorage', 'sessionStorage', 'cookie']) Object.defineProperty(window, key, { get: forbidden });
    const context = vm.createContext({ window, document, fetch: forbidden, XMLHttpRequest: forbidden, Function: forbidden });
    return { run: () => vm.runInContext(source, context), classes, appended };
}

test('같은 출처 통합 관리자 iframe의 기존 견적 도구만 공통 디자인을 받는다', () => {
    for (const name of ['견적관리', '견적관리-모바일', '견적만들기', '예약목록', '예약관리', '코스관리', '일정관리', '명소관리', '리소스관리']) {
        for (const extension of ['', '.html']) {
            const f = fixture({ page: `https://admin.example.invalid/${encodeURIComponent(name)}${extension}` });
            f.run();
            assert.ok(f.classes.has('admin-embedded'));
            assert.ok(f.classes.has('admin-redesigned'), name + extension);
            const links = f.appended.filter(node => node.tagName === 'link');
            assert.equal(links.length, 1); assert.equal(links[0].href, '/admin-redesign.css'); assert.equal(links[0].rel, 'stylesheet');
        }
    }
    for (const name of ['견적관리', '예약관리']) {
        const customerEditor = fixture({ parent: 'https://admin.example.invalid/admin/customer-workspace/quote/customer-a?returnTo=%2Fadmin%2Freservations', page: `https://admin.example.invalid/${name}?workspace=1&id=customer-a` });
        customerEditor.run(); assert.ok(customerEditor.classes.has('admin-redesigned'));
    }
});

test('고객 문서·단독 페이지·다른 출처·임의 부모 페이지에는 관리자 디자인을 주입하지 않는다', () => {
    const cases = [
        { standalone: true }, { crossOrigin: true },
        { parent: 'https://external.example.invalid/admin/quote-desk/spots' },
        { parent: 'https://admin.example.invalid/products/example' },
        { parent: 'https://admin.example.invalid/admin/quote-desk-other/spots' },
        ...['견적서', '내견적', '확정일정표', '계약서', '여행계약서', '여행자정보', '일정지도', '관리자와비슷한경로'].map(name => ({ page: `https://admin.example.invalid/${name}.html?t=customer-link` })),
    ];
    for (const options of cases) {
        const f = fixture(options); f.run();
        assert.equal(f.classes.has('admin-redesigned'), false, JSON.stringify(options));
        assert.equal(f.appended.filter(node => node.tagName === 'link').length, 0);
        if (options.standalone) assert.equal(f.appended.length, 0);
    }
});

test('iframe 임베드와 공통 디자인 링크는 중복 실행해도 한 번만 삽입하며 인증·업무 상태를 읽거나 쓰지 않는다', () => {
    const f = fixture(); f.run(); f.run();
    assert.equal(f.appended.filter(node => node.tagName === 'style').length, 1);
    assert.equal(f.appended.filter(node => node.tagName === 'link').length, 1);
    assert.deepEqual([...f.classes], ['admin-embedded', 'admin-redesigned']);
});

test('공통 스타일은 관리자 프레임 클래스에만 한정하고 외부 리소스·샘플 개인정보·디자인 런타임을 포함하지 않는다', () => {
    const css = postcss.parse(theme);
    css.walkRules(rule => {
        assert.ok(rule.selectors.every(selector => selector.trim().startsWith('html.admin-redesigned')), rule.selector);
    });
    css.walkAtRules(rule => assert.ok(['media'].includes(rule.name), rule.name));
    assert.ok(!/url\(|@import|signature-b0322b94|mongoliasky|unpkg|__dc|data:image/i.test(theme));
    assert.ok(!/support\.js|admin-icons\.js|signature-b0322b94|mongoliasky|unpkg|__dc/.test(source));
});
