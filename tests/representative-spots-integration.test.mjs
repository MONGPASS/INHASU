// The local QA script exercises actual Hono, Lucia and SQLite product/booking
// routes with a blocked outbound fetch. No HTTP server or real customer data.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('상품 대표 명소의 등록·수정·예약 상속과 고객의 빈 선택을 실제 API에서 보존한다', () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const script = fileURLToPath(new URL('../scripts/check-reservation-workspace.mjs', import.meta.url));
    const result = spawnSync(process.execPath, [script, '--port=8798'], {
        cwd: root, encoding: 'utf8', timeout: 30000,
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, (result.stderr || result.stdout).slice(-5000));
    assert.match(result.stdout, /대표 명소 등록\/조회\/수정\/예약 상속/);
    assert.match(result.stdout, /외부 발송 차단/);
});
