import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('맞춤 견적 화면 머리에는 통합 예약 목록·새로고침·새 창으로 열기가 없고, 옛 도구를 새 창으로 여는 코드도 없다', () => {
    const source = read('src/pages/AdminQuoteDesk.tsx');
    for (const pattern of [/\/>통합 예약 목록/, /\/>새 창으로 열기/, /label: '새 창으로 열기'/, /openStandalone/, /contentWindow\?\.location[\s\S]{0,200}window\.open/]) assert.doesNotMatch(source, pattern);
    assert.doesNotMatch(source, /<Icon name="refresh" \/>새로고침/);
});

/** 옛 도구 문서를 단독으로 열었을 때 어디로 가는지: vm으로 스크립트를 그대로 실행한다. */
function redirectFor(pathname, search = '', { embedded = false, width = 1920 } = {}) {
    const replaced = [];
    const win = { location: { pathname: encodeURI(pathname), search, replace: url => replaced.push(url) }, screen: { width }, innerWidth: width };
    win.self = win; win.top = embedded ? {} : win;
    vm.runInNewContext(read('public/admin-legacy-redirect.js'), { window: win, URLSearchParams });
    return replaced[0] ?? null;
}

test('옛 견적 관리 도구를 데스크톱에서 단독으로 열면 같은 메뉴의 새 관리자로 보내고, 새 관리자 안·휴대폰에서는 그대로 둔다', () => {
    for (const [path, search, target] of [
        ['/견적관리', '', '/admin/quote-desk/inbox'],
        ['/견적관리.html', '?id=req-1', '/admin/quote-desk/inbox?id=req-1'],
        ['/견적관리-모바일', '?qe=req-2', '/admin/quote-desk/inbox?qe=req-2'],
        ['/예약목록.html', '', '/admin/quote-desk/bookings'],
        ['/예약관리', '?id=req 3', '/admin/customer-workspace/quote/req%203'],
        ['/예약관리', '', '/admin/quote-desk/bookings'],
        ['/견적만들기.html', '?id=req-4', '/admin/quote-desk/builder?id=req-4'],
        ['/견적만들기', '?course=x&share=1', '/admin/quote-desk/builder'],
        ['/코스관리', '', '/admin/quote-desk/courses'],
        ['/일정관리', '', '/admin/quote-desk/itinerary'],
        ['/명소관리', '', '/admin/quote-desk/spots'],
        ['/리소스관리', '?resourceType=lodges', '/admin/quote-desk/resources?resourceType=lodges'],
        ['/리소스관리', '?resourceType=evil', '/admin/quote-desk/resources'],
    ]) assert.equal(redirectFor(path, search), target, `${path}${search}`);
    assert.equal(redirectFor('/견적관리', '', { embedded: true }), null, '새 관리자 iframe 안');
    assert.equal(redirectFor('/견적관리-모바일', '', { width: 390 }), null, '휴대폰은 모바일 관리자');
    assert.equal(redirectFor('/예약관리', '?id=x', { width: 820 }), null);
    for (const path of ['/내견적', '/견적서', '/확정일정표', '/계약서', '/admin/quote-desk/inbox']) assert.equal(redirectFor(path), null, path);
});

test('옛 관리자 문서는 본문 전에 단독 접속 차단 스크립트를 불러오고, 고객 문서에는 넣지 않는다', () => {
    for (const name of ['견적관리', '견적관리-모바일', '견적만들기', '예약목록', '예약관리', '코스관리', '일정관리', '명소관리', '리소스관리']) {
        const html = read(`public/${name}.html`), at = html.indexOf('<script src="/admin-legacy-redirect.js"></script>');
        assert.ok(at > 0 && at < html.indexOf('<body'), name);
        assert.ok(at < html.search(/<script(?! src="\/admin-legacy-redirect\.js")/), `${name}: 다른 스크립트보다 먼저`);
    }
    for (const name of ['내견적', '견적서', '견적서-모바일', '확정일정표', '확정일정표-모바일', '계약서', '여행자정보', '일정지도', '확정안내', '가이드시트']) {
        assert.ok(!read(`public/${name}.html`).includes('admin-legacy-redirect'), name);
    }
});

test('견적 문의(새 관리자 안)의 견적서 만들기·예약관리는 새 탭이 아니라 같은 화면·새 고객 화면으로 연다', () => {
    const html = read('public/견적관리.html');
    assert.match(html, /get\("workspace"\) === "1" \|\| window\.self !== window\.top\) \{ location\.assign\("\/견적만들기\?id="/);
    assert.match(html, /window\.self !== window\.top && window\.QuoteBookingWorkspace\) \{ window\.QuoteBookingWorkspace\.openCustomer\(String\(r\.id\), "\/admin\/quote-desk\/inbox"\)/);
    assert.ok(!read('public/예약목록.html').includes('openLegacyBooking'), '쓰지 않는 옛 예약관리 새 탭 열기 함수는 지웠다');
});
