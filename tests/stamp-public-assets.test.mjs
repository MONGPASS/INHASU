import test from 'node:test';
import assert from 'node:assert/strict';
import { stampHtml } from '../scripts/stamp-public-assets.mjs';

test('빌드한 정적 문서의 공용 CSS·JS 주소에만 내용 버전을 붙인다', () => {
    const versionOf = name => ({ 'admin-tools.css': 'aaaa', 'presets.js': 'bbbb', 'quote-day-editor.js': 'cccc' })[name] || null;
    const html = ['<link rel="stylesheet" href="/admin-tools.css">', '<script src="presets.js"></script>', '<script src="/quote-day-editor.js" defer></script>',
        '<script src="/lodging.f3c00aad8ec7.js"></script>', '<link href="https://cdn.jsdelivr.net/x/pretendard.css">', '<script src="/missing.js"></script>',
        '<a href="/내견적?t=abc">링크</a>', '<script src="/admin-tools.css?v=old"></script>'].join('\n');
    const out = stampHtml(html, versionOf).split('\n');
    assert.equal(out[0], '<link rel="stylesheet" href="/admin-tools.css?v=aaaa">');
    assert.equal(out[1], '<script src="presets.js?v=bbbb"></script>');
    assert.equal(out[2], '<script src="/quote-day-editor.js?v=cccc" defer></script>');
    assert.deepEqual(out.slice(3), html.split('\n').slice(3), '해시 이름·외부 주소·없는 파일·고객 링크·이미 버전이 있는 주소는 그대로');
});
