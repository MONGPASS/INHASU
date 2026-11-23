import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../public/guide-picket.js');
const { GuidePicket } = globalThis;

test('가이드 피켓은 고객 이름(님)·여행 날짜·박/일·담당 가이드를 디자인 형식으로 만든다', () => {
    assert.deepEqual(GuidePicket.fields({ customerName: ' 전해영 ', startDate: '2026-09-20', endDate: '2026-09-23', guideName: 'Oyuka', guidePhone: '+976 8000-0000' }),
        { name: '전해영님', dateText: '2026.09.20 – 09.23', nightsText: '3박 4일', guideName: 'Oyuka', guidePhone: '+976 8000-0000' });
    assert.equal(GuidePicket.fields({ customerName: '이창도 님', startDate: '2026-12-31', endDate: '2027-01-03' }).dateText, '2026.12.31 – 2027.01.03', '해를 넘기면 끝 날짜에 연도를 붙인다');
    const empty = GuidePicket.fields({ customerName: '이창도 님', startDate: '2026-12-31', endDate: '2027-01-03', guidePhone: '+976 1' });
    assert.equal(empty.name, '이창도님'); assert.equal(empty.guideName, '가이드 배정 전'); assert.equal(empty.guidePhone, '', '가이드가 없으면 연락처도 넣지 않는다');
    assert.equal(GuidePicket.fileName({ customerName: '전 해영', startDate: '2026-09-20' }), '가이드피켓_전해영_20260920.png');
    assert.deepEqual([GuidePicket.PNG_W, GuidePicket.PNG_H], [3508, 2480], 'A4 가로 300dpi');
});

test('가이드 피켓 그리기는 3단 밴드(민트·흰 바탕·진녹)에 이름·날짜·가이드를 쓴다', () => {
    const texts = [], fills = [];
    const ctx = new Proxy({ letterSpacing: '0px', measureText: s => ({ width: String(s).length * 20 }), fillText: (s) => texts.push(s),
        fillRect: (x, y, w, h) => fills.push([ctx.fillStyle, y, h]) }, {
        get: (t, k) => k in t ? t[k] : () => {}, set: (t, k, v) => { t[k] = v; return true; },
    });
    GuidePicket.draw(ctx, GuidePicket.fields({ customerName: '전해영', startDate: '2026-09-20', endDate: '2026-09-23', guideName: 'Oyuka', guidePhone: '+976 1' }), null);
    for (const value of ['WELCOME', '드디어 만났어요!', '전해영님', '2026.09.20 – 09.23', '3박 4일', '함께할 가이드', 'Oyuka', '+976 1', 'MONGOLIASKY.CO.KR']) assert.ok(texts.includes(value), value);
    assert.ok(fills.some(([c, y, h]) => c === '#06C4A0' && y === 0 && h === 176), '위 민트 밴드');
    assert.ok(fills.some(([c, y, h]) => c === '#123B3A' && y === 698 && h === 96), '아래 진녹 밴드');
});

test('가이드 피켓은 가이드 상세·상품 가이드용 일정표·견적 가이드 시트가 같은 렌더러를 쓴다', () => {
    const read = p => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
    assert.match(read('src/components/admin/guides/GuideSchedule.tsx'), /useGuidePicketImage\(picketInput\)/);
    assert.match(read('src/components/document/GuideItineraryPrint.tsx'), /<GuidePicketPage /);
    const sheet = read('public/가이드시트.html');
    assert.match(sheet, /<script src="guide-picket\.js"><\/script>/);
    assert.match(sheet, /root\.innerHTML = page1 \+ page2 \+ cashPage \+ picketPage;/, '피켓은 마지막 페이지');
    assert.match(sheet, /@page picket\{ size:A4 landscape; margin:0; \}/);
    assert.ok(fs.existsSync(new URL('../public/img/brand/guide-picket-logo.png', import.meta.url)));
});
