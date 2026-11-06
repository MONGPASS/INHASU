import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('견적 관리 화면의 ‘새 창으로 열기’는 옛 견적 도구 문서가 아니라 지금 보는 새 관리자 주소를 새 탭으로 연다', () => {
    const source = fs.readFileSync(new URL('../src/pages/AdminQuoteDesk.tsx', import.meta.url), 'utf8');
    const start = source.indexOf('const openStandalone = () => {');
    assert.ok(start > 0, 'openStandalone');
    const body = source.slice(start, source.indexOf('};', start));
    assert.match(body, /window\.open\(`\$\{window\.location\.pathname\}\$\{window\.location\.search\}\$\{window\.location\.hash\}`, '_blank', 'noopener'\)/);
    assert.doesNotMatch(body, /contentWindow|workspaceFrameSrc|frameRef/, '안쪽 iframe 문서(옛 관리자 메뉴가 보이는 단독 화면)를 열지 않는다');
});
