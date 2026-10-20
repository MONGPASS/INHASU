import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { build, transform } from 'esbuild';

const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const result = await build({ entryPoints: ['src/components/admin/ReservationDocuments.tsx'], bundle: true, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', write: false });
const mod = { exports: {} }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports);
const { ReservationDocuments } = mod.exports;
const source = fs.readFileSync(new URL('../src/pages/AdminReservationManage.tsx', import.meta.url), 'utf8');
const start = source.indexOf('    const acceptedDelivery = '), end = source.indexOf('    // ── 문서 편집기', start);
assert.ok(start >= 0 && end > start);
const projection = (await transform(source.slice(start, end) + '\nglobalThis.result={itinerarySent,contractSent,itineraryEmailSent,contractEmailSent,itineraryEmailChanged,contractEmailChanged};', { loader: 'ts' })).code;
function deliveryState(items, timelineEvents = [], documents) {
    const context = vm.createContext({ reservation: { id: 'local-booking' }, recordedDelivery: { bookingId: 'local-booking', items, documents }, timelineEvents,
        itineraryUrl: 'https://local.invalid/documents/itinerary/local-booking', contractUrl: 'https://local.invalid/documents/contract/local-booking' });
    vm.runInContext(projection, context); return context.result;
}
const receipt = (kind, channel, revision = 'current') => ({ id: `${kind}-${channel}`, kind, channel, revision, state: 'accepted', at: '2026-10-20T01:00:00Z' });
const props = () => ({ days: [{ day: 1, title: '로컬 일정', activities: [] }], source: '실제 저장 일정', ready: true, published: true, canPublish: true,
    itinerarySent: true, contractSent: true, itineraryEmailSent: false, contractEmailSent: false, itinerarySentAt: '', contractSentAt: '', signed: false, travelerCount: 0,
    email: 'local@example.invalid', sending: false, templates: [], templateId: '', applyingTemplate: false, copied: null,
    onTemplate() {}, onEdit() {}, onPreview() {}, onPublish() {}, onSend() {}, onCopy() {}, onSendAll() {}, onGuidePdf() {} });
const nodes = root => Array.isArray(root) ? root.flatMap(nodes) : React.isValidElement(root) ? [root, ...nodes(root.props.children)] : [];
const text = root => Array.isArray(root) ? root.map(text).join('') : React.isValidElement(root) ? text(root.props.children) : typeof root === 'string' ? root : '';

test('실제 상품 부모의 카카오·이메일 접수 투영은 채널을 구분하며 과거 이메일 이력을 보존한다', () => {
    const kakao = deliveryState([receipt('itinerary', 'kakao'), receipt('contract', 'kakao')]);
    assert.equal(kakao.itinerarySent, true); assert.equal(kakao.contractSent, true); assert.equal(kakao.itineraryEmailSent, false); assert.equal(kakao.contractEmailSent, false);
    const email = deliveryState([receipt('itinerary', 'email'), { ...receipt('contract', 'kakao'), state: 'failed' }]);
    assert.equal(email.itineraryEmailSent, true); assert.equal(email.contractSent, false);
    const legacy = deliveryState([], [{ type: 'email', description: '契約書の送信', timestamp: '2026-10-19T00:00:00Z' }]);
    assert.equal(legacy.contractEmailSent, true); assert.equal(legacy.contractSent, true);
});

test('최신 카카오 수정본 접수로 이전 이메일 수정본 안내 필요 상태를 지우지 않는다', () => {
    const state = deliveryState([receipt('contract', 'kakao', 'new-contract'), receipt('contract', 'email', 'old-contract')], [], {
        contract: { revision: 'new-contract', needsResend: false }, itinerary: { revision: 'same', needsResend: false },
    });
    assert.equal(state.contractSent, true); assert.equal(state.contractEmailSent, true); assert.equal(state.contractEmailChanged, true);
    const kakaoOnly = deliveryState([receipt('contract', 'kakao', 'old-contract')], [], { contract: { revision: 'new-contract', needsResend: true } });
    assert.equal(kakaoOnly.contractEmailSent, false); assert.equal(kakaoOnly.contractEmailChanged, false, '이메일 발송 이력이 없는 문서는 수정본 메일 재안내 대상으로 바꾸지 않는다');
    const legacy = deliveryState([], [{ type: 'email', description: '계약서를 발송했습니다.' }], { contract: { revision: 'new-contract', needsResend: true } });
    assert.equal(legacy.contractEmailChanged, true, '버전 없는 과거 이메일 접수는 기존 변경 안내 판정을 보존한다');
});

test('카카오 접수만 있는 문서는 메일 완료로 표시하거나 메일 일괄 발송을 잠그지 않는다', () => {
    let sends = 0; const tree = ReservationDocuments({ ...props(), onSendAll: () => sends++ });
    const html = renderToStaticMarkup(tree); assert.equal((html.match(/다른 채널 안내 접수 · 이메일 미발송/g) || []).length, 2);
    assert.doesNotMatch(html, /메일 발송 완료|이메일 서비스 접수/); assert.match(html, /고객 동의 대기/);
    const button = nodes(tree).find(node => node.type === 'button' && text(node) === '미발송·수정본 메일 발송');
    assert.ok(button); assert.equal(Boolean(button.props.disabled), false); assert.equal(sends, 0); button.props.onClick(); assert.equal(sends, 1);
    const accepted = renderToStaticMarkup(ReservationDocuments({ ...props(), itineraryEmailSent: true, contractEmailSent: true }));
    assert.equal((accepted.match(/이메일 서비스 접수/g) || []).length, 2); assert.doesNotMatch(accepted, /메일 발송 완료/);
});
