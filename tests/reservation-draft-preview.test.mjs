import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';
import { receiveAdminDocumentPreview } from '../public/admin-document-preview.js';
const { outputFiles } = buildSync({ entryPoints: [fileURLToPath(new URL('../src/utils/reservationDraftPreview.ts', import.meta.url))], bundle: true, write: false, platform: 'node', format: 'esm' });
const { buildReservationDraftPreview, contractDraftPreviewHtml } = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));

const content = { name: '미저장 일정', description: '직접 작성한 내용', days: [{ day: 1, dateMode: 'manual', date: '', title: '첫날 변경',
    move: '2시간', dist: '120km', items: ['*강조 안내*', '(선택 일정)'], images: ['/img/regions/terelj.webp'],
    activities: [{ time: '09:30', title: '픽업', description: '설명 유지', images: ['/img/home/1.webp'] }],
    meals: { breakfast: '', lunch: '현지식', dinner: '' } }], highlights: [],
    documentSettings: { contract: { intro: '<img src=x onerror=alert(1)>', paymentMethod: '입력한 지급 방법', cancellationRows: [{ period: '작성한 기간', fee: '작성한 조건' }] } } };
const dates = { startDate: '2026-10-20', endDate: '2026-10-22' };
test('미저장 초안을 기존 상품 PDF 변환기로 변환하며 수동 날짜·문구·사진·명소 빈값을 보존한다', () => {
    const before = JSON.stringify(content);
    const quote = buildReservationDraftPreview(content, dates, { customerName: '로컬 고객', totalAmount: 100, travelers: 2 });
    assert.equal(quote.source, 'product'); assert.equal(quote.customer, '로컬 고객');
    assert.equal(quote.days[0].date, ''); assert.deepEqual(quote.days[0].items, content.days[0].items);
    assert.deepEqual(quote.detailDays[0].activities, content.days[0].activities); assert.deepEqual(quote.highlights, []);
    assert.deepEqual(quote.refundRows, content.documentSettings.contract.cancellationRows);
    assert.ok(Array.isArray(buildReservationDraftPreview({...content,documentSettings:{}},dates).refundRows));
    assert.equal(JSON.stringify(content), before);
});
test('계약 초안은 입력 원문만 HTML escape하여 표시하고 고객 동의·발송 동작을 만들지 않는다', () => {
    const html = contractDraftPreviewHtml(content, dates);
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(html.includes('입력한 지급 방법')); assert.ok(html.includes('작성한 조건'));
    assert.ok(!html.includes('<script')); assert.ok(!html.includes('<form')); assert.ok(!html.includes('/api/'));
});
function surface(admin = true) {
    const listeners = new Map(), calls = [], origin = 'https://local.example.invalid';
    const view = { location: { origin }, setTimeout, clearTimeout,
        addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: name => listeners.delete(name),
        fetch: async path => { calls.push(path); assert.equal(path, '/api/auth/me'); return Response.json({ user: { id: 'admin-fixture', role: admin ? 'admin' : 'user' } }); } };
    const host = { postMessage(message, target) {
        assert.equal(target, origin);
        const send = (extra, quote) => listeners.get('message')?.({ origin, source: host,
            data: { type: 'inhasu-admin-preview-content', nonce: message.nonce, quote }, ...extra });
        const hostile = { source: 'product', days: [], detailDays: [], customer: 'wrong' };
        send({ origin: 'https://foreign.example.invalid' }, hostile);
        send({ source: {} }, hostile);
        send({ data: { type: 'inhasu-admin-preview-content', nonce: 'wrong', quote: hostile } }, hostile);
        send({}, { ...hostile, source: 'quote' });
        send({}, { source: 'product', days: [], detailDays: [], customer: 'accepted' });
    } };
    view.parent = host;
    return { view, calls, listeners };
}
test('관리자 인증 뒤 부모 window·출처·nonce가 일치하는 메모리 snapshot만 받는다', async () => {
    const { view, calls, listeners } = surface();
    const value = await receiveAdminDocumentPreview(new URLSearchParams({ adminDraft: '12345678-1234-1234-1234-123456789012' }), view);
    assert.equal(value.customer, 'accepted'); assert.deepEqual(calls, ['/api/auth/me']); assert.equal(listeners.size, 0);
});
test('일반 사용자·잘못된 nonce는 문서 초안을 수신하지 않는다', async () => {
    const { view } = surface(false);
    await assert.rejects(receiveAdminDocumentPreview(new URLSearchParams({ adminDraft: '12345678-1234-1234-1234-123456789012' }), view), /관리자 로그인/);
    await assert.rejects(receiveAdminDocumentPreview(new URLSearchParams({ adminDraft: '<script>' }), surface().view), /요청을 확인/);
});
