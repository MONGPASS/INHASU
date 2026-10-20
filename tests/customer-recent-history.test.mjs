import test from 'node:test';
import assert from 'node:assert/strict';
import { customerRecentHistory as history, customerCurrentStage as stage } from '../src/utils/customerRecentHistory.ts';
import { productWorkspaceReservation, productCustomerOverview, legacyCustomerOverview } from '../src/utils/productCustomerWorkspace.ts';
import { build } from 'esbuild';
import vm from 'node:vm';
const bundled = await build({ entryPoints: ['src/utils/quoteCustomerWorkspace.ts'], bundle: true, format: 'cjs', platform: 'node', write: false });
const module = { exports: {} };
vm.runInNewContext(bundled.outputFiles[0].text, { module, exports: module.exports, Date, URL, atob });
const { quoteCustomerWorkspaceModel } = module.exports;

const at = hour => `2026-10-20T${String(hour).padStart(2, '0')}:00:00Z`;
const fixture = () => ({ id: 'local-customer', customerName: '합성 고객', status: 'confirmed', createdAt: at(1), productName: '실제 예약 상품', travelers: 1,
    totalPrice: 0, depositAmount: 0, balanceAmount: 0, depositStatus: 'paid', contractData: {}, history: [] });
const workflow = { depositPaid: true, signed: true, published: true, guideReady: true, accommodationsReady: true, nights: 0, stayCount: 0 };
const settings = { vehicle: '실제 차량', itineraryReady: true, itinerarySent: true, contractSent: true, itineraryChanged: false, contractChanged: false };
const overview = row => productCustomerOverview(productWorkspaceReservation(row), [], workflow, settings);
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aAZsAAAAASUVORK5CYII=';

test('최근 이력은 저장된 시각이 있는 기록만 최신순으로 읽고 현재 상태에서 완료 이벤트를 만들지 않는다', () => {
    const input = { ...fixture(), history: [{ timestamp: at(4), type: 'modification', description: '차량 배정 저장' }, { timestamp: 'invalid', type: 'email', description: '발송 완료라고 적힌 깨진 기록' }, { type: 'payment_confirmed' }] };
    const result = history({ source: 'product', record: input });
    assert.deepEqual(result.map(item => item.title), ['차량 배정 저장', '상품 예약 접수']);
    assert.equal(result[0].kind, 'assignment');
    assert.deepEqual(history({ source: 'product', record: { status: 'confirmed', depositStatus: 'paid', itineraryUrl: '/already-published', assignedGuide: { name: '가이드' }, contractData: { agreement: { agreed: true } } } }), []);
});

test('고객 제출·성명 동의·입금 신고는 각각의 저장시각에서 읽고 같은 native 이벤트는 중복 제거한다', () => {
    const input = { ...fixture(), depositReport: { status: 'reported', reportedAt: at(3) },
        contractData: { customerSubmittedAt: at(5), agreement: { agreed: true, agreedAt: at(6), name: '실제 성명 동의' } },
        history: JSON.stringify([{ timestamp: at(3), type: 'deposit_reported', description: '고객의 입금 신고 기록' }, { timestamp: at(3), type: 'deposit_reported', description: '고객의 입금 신고 기록' }]) };
    const before = JSON.stringify(input), result = history({ source: 'product', record: input });
    assert.equal(result.filter(item => item.title === '고객 입금 완료 신고').length, 1);
    assert.deepEqual(result.slice(0, 3).map(item => item.kind), ['contract', 'customer', 'payment']);
    assert.ok(result.some(item => item.title === '계약서 성명 동의 저장'));
    assert.equal(JSON.stringify(input), before); assert.deepEqual(history({ source: 'product', record: input }), result, 'stable IDs do not depend on render time');
});

test('내부 메모는 명시적 관리자 opt-in에만 포함하고 서명 이미지·토큰·snapshot을 이력에 복제하지 않는다', () => {
    const input = { ...fixture(), history: [{ timestamp: at(2), type: 'admin_memo', description: '직원 전용 상담' }, { timestamp: at(3), type: 'admin_memo_added', description: '이름이 다른 내부 메모' },
        { timestamp: at(4), type: 'modification', description: '링크 공유', detail: '/내견적?t=PRIVATE-TOKEN' }, { timestamp: at(5), type: 'modification', description: '서명 저장', detail: image }],
        contractData: { signature: { signedAt: at(6), signImg: image, snapshot: { travelers: ['PRIVATE-SNAPSHOT'] }, signerName: '실제 서명자' } } };
    const safe = history({ source: 'product', record: input }); assert.ok(safe.every(item => !item.internal));
    const admin = history({ source: 'product', record: input }, { includeInternal: true }); assert.equal(admin.filter(item => item.internal).length, 2);
    const serialized = JSON.stringify(admin); for (const privateValue of [image, 'PRIVATE-TOKEN', 'PRIVATE-SNAPSHOT', 'signImg']) assert.equal(serialized.includes(privateValue), false);
    assert.ok(admin.some(item => item.title === '계약서 손서명 저장'));
});

test('견적 활동과 같은 요청·서명·고객제출의 현재 저장 필드를 합치되 한 사건을 두 번 표시하지 않는다', () => {
    const input = { id: 'quote-history', receivedAt: at(1), quote: {}, quoteIssuedAt: at(2), decision: { status: 'accepted', acceptedAt: at(3), source: 'customer' },
        activities: [{ at: at(4), type: 'deposit_requested', detail: '예약금 입금 안내' }, { at: at(6), type: 'contract_signed', detail: '고객 서명' }, { at: at(7), type: 'travelers_submitted', detail: '1명 제출' }],
        booking: { preparedAt: at(3), depositRequest: { requestedAt: at(4) }, contractRequest: { requestedAt: at(5) }, contract: { signedAt: at(6), signImg: 'PRIVATE-QUOTE-SIGNATURE' }, travelerSubmission: { submittedAt: at(7) }, confirmedAt: '2026-10-20', publishedAt: at(8) } };
    const result = history({ source: 'quote', record: input });
    assert.equal(result.filter(item => item.title === '계약서 서명 기록').length, 1);
    assert.equal(result.filter(item => item.title === '예약금 입금 안내 요청').length, 1);
    assert.equal(result.filter(item => item.title === '고객 여행자 정보 제출').length, 1);
    assert.ok(result.some(item => item.title === '고객 예약 진행 의사 접수'));
    assert.equal(result.find(item => item.title === '예약 확정 기록').at, '2026-10-20', 'a date-only saved confirmation has no invented time');
    assert.equal(result[0].title, '확정 일정표 공개 기록');
    assert.equal(JSON.stringify(result).includes('PRIVATE-QUOTE-SIGNATURE'), false);
});

test('알림 요청·건너뜀·서비스 접수·실패를 고객 수신 완료로 바꾸지 않고 반복된 ledger 항목만 제거한다', () => {
    const result = history({ source: 'quote', record: { activities: [{ at: at(1), type: 'quote_notification_queued' }, { at: at(2), type: 'itinerary_notification_skipped' }] },
        deliveryHistory: [{ id: 'accepted', kind: 'contract', channel: 'email', state: 'accepted', at: at(3) }, { id: 'accepted', kind: 'contract', channel: 'email', state: 'accepted', at: at(3) }, { id: 'retry', kind: 'contract', channel: 'email', state: 'failed', at: at(4), error: 'PRIVATE-PROVIDER-ERROR' }] });
    assert.deepEqual(result.map(item => item.title), ['계약서 발송 실패', '계약서 발송 서비스 접수', '확정 일정표 안내 발송 건너뜀', '견적서 안내 발송 요청']);
    assert.equal(JSON.stringify(result).includes('PRIVATE-PROVIDER-ERROR'), false);
    assert.ok(result.every(item => !/수신 완료|전달 완료/.test(item.title)));
});

test('비정상 시각·무한대에 가까운 숫자는 안전하게 제외하고 시차가 있는 저장시각을 같은 기준으로 정렬한다', () => {
    const input = { history: [
        { timestamp: 1e40, type: 'modification', description: '범위 밖 숫자' }, { timestamp: '2026-02-30', type: 'modification', description: '존재하지 않는 날짜' },
        { timestamp: '2026-10-20T11:00:00+09:00', type: 'modification', description: '한국 시각 11시' }, { timestamp: at(3), type: 'modification', description: 'UTC 3시' },
        { timestamp: 'broken', at: at(4), type: 'modification', description: '유효한 저장시각 alias' },
    ] };
    const result = history({ source: 'product', record: input });
    assert.deepEqual(result.map(item => item.title), ['유효한 저장시각 alias', 'UTC 3시', '한국 시각 11시']);
    assert.equal(result[2].at, '2026-10-20T02:00:00.000Z');
});

test('상품 고객 요약은 typed 동의와 실제 이미지가 있는 손서명을 구분하고 기존 계약 단계 판정은 유지한다', () => {
    const typed = { ...fixture(), contractData: { agreement: { agreed: true, name: '동의 고객', agreedAt: at(2) } } };
    const result = overview(typed);
    assert.equal(result.agreement.label, '성명 동의 완료 · 손서명 미등록');
    assert.equal(result.documents.find(item => item.id === 'contract').status, result.agreement.label);
    assert.equal(result.steps.find(item => item.id === 'contract').done, true);
    assert.equal(result.tasks.some(item => /손서명/.test(item.label)), false);
    const signed = overview({ ...typed, contractData: { ...typed.contractData, signature: { signedAt: at(3), signImg: image, signerName: '손서명 고객' } } });
    assert.equal(signed.agreement.label, '손서명 완료'); assert.equal(signed.agreement.at, at(3));
    assert.equal(signed.documents.find(item => item.id === 'contract').action, 'contract-preview');
    assert.equal(JSON.stringify(signed).includes(image), false);
    const timestampOnly = overview({ ...fixture(), contractData: { signature: { signedAt: at(3) } } });
    assert.equal(timestampOnly.documents.find(item => item.id === 'contract').status, '서명 원본 확인 필요');
    assert.notEqual(overview({ ...fixture(), contractData: { signature: { signedAt: at(3), hasImage: true } } }).agreement.label, '손서명 완료', 'admin reservation records require actual pixels, not a copied public metadata flag');
});

test('현재 단계는 별도의 상태 요약이며 취소·완료·고객대기와 미완료 업무를 구분한다', () => {
    assert.deepEqual(stage({ status: 'cancelled', steps: [], tasks: [], booking: true }), { label: '예약 취소', tone: 'cancelled' });
    assert.deepEqual(stage({ status: 'completed', steps: [], tasks: [], booking: true }), { label: '여행 완료', tone: 'complete' });
    assert.deepEqual(stage({ status: '완료', steps: [], tasks: [], booking: false }), { label: '문의 처리 완료', tone: 'complete' });
    assert.deepEqual(stage({ steps: [{ label: '계약 동의', done: false }], tasks: [{ label: '고객 동의 응답', waiting: true }] }), { label: '계약 동의', detail: '고객 동의 응답', tone: 'waiting' });
    assert.deepEqual(stage({ steps: [{ label: '일정표 공개', done: true }], tasks: [{ label: '잔금 확인' }], booking: true }), { label: '여행 준비 확인', detail: '잔금 확인', tone: 'active' });
});

test('상품·견적·이전 문의 adapter는 실제 기록과 현재 단계를 함께 제공하고 시각 없는 메모로 가짜 이력을 만들지 않는다', () => {
    const product = overview({ ...fixture(), history: [{ timestamp: at(2), type: 'admin_memo', description: '관리자 실제 메모' }] });
    assert.ok(product.recentHistory.some(item => item.internal)); assert.ok(product.currentStage.label);
    const quote = { id: 'same-name', name: '합성 고객', receivedAt: at(1), adult: 1, status: '신규', memo: '시각 없는 상담', quote: { days: [] }, activities: [{ type: 'quote_notification_skipped', at: at(2) }] };
    const before = JSON.stringify(quote), model = quoteCustomerWorkspaceModel(quote);
    assert.deepEqual(Array.from(model.recentHistory, item => item.title), ['견적서 안내 발송 건너뜀', '견적 문의 접수']);
    assert.equal(model.currentStage.label, '견적 안내 요청'); assert.equal(JSON.stringify(quote), before);
    const legacy = legacyCustomerOverview({ id: 'legacy', status: 'converted', created_at: at(1) }, null);
    assert.equal(legacy.currentStage.label, '예약 전환 완료'); assert.equal(legacy.recentHistory[0].title, '견적 문의 접수');
});
