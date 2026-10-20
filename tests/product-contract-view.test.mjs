import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import { build, transform } from 'esbuild';
import { productSignatureStatus, publicProductContract } from '../src/utils/productContractSignature.ts';
const drawnSignature = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHgAAAA8CAYAAACtrX6oAAAAqUlEQVR4nO3RAQ3AMAzAsPIn/ROoBqBxpCDwzMy3rENtwKAP9QIGfSjQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JdCTQkUBHAh0JcqQV+AfAihANVHYDfgAAAABJRU5ErkJggg==';
const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const result = await build({ entryPoints: ['src/pages/DocumentContract.tsx'], bundle: true, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', write: false, loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } });
const mod = { exports: {} };
new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports);
const { ContractDocumentView } = mod.exports;
const base = () => ({
    signatureRevision: 'a'.repeat(64),
    reservation: { id: 'local-product-contract', reservationNumber: 'LOCAL-CONTRACT', productName: '저장된 상품', customerName: '합성 계약자', customerPhone: 'LOCAL-PHONE', travelers: 2,
        startDate: '2026-10-25', endDate: '2026-10-27', totalPrice: 0, depositAmount: 0, balanceAmount: 0, createdAt: '2026-10-19T00:00:00Z', status: 'confirmed' },
    contract: { region: '저장된 여행지', category: '저장된 여행 형태', travelers: [{ name: '합성 여행자', passportName: 'LOCAL TRAVELER', birthdate: '1990-01-01', phone: 'LOCAL-PHONE', gender: '여성' }, { name: '두번째 여행자', passportName: 'LOCAL SECOND', phone: 'LOCAL-SECOND' }],
        arrival: { date: '2026-10-25', time: '08:20', flight: 'LOCAL-IN' }, departure: { date: '2026-10-27', time: '15:10', flight: 'LOCAL-OUT' } },
    accommodations: [{ day: 1, accommodation: { name: '실제 배정 게르', type: '고급 게르', location: '저장된 숙소 지역' } }], guide: { name: '등록 가이드', phone: 'LOCAL-GUIDE' },
    productIncluded: ['저장된 포함 사항'], productExcluded: ['저장된 불포함 사항'],
});
const render = (data, props = {}) => renderToStaticMarkup(React.createElement(ContractDocumentView, { data, ...props }));
const text = node => Array.isArray(node) ? node.map(text).join('') : React.isValidElement(node) ? text(node.props.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '';
const elements = tree => {
    const found = []; const visit = node => { if (Array.isArray(node)) { node.forEach(visit); return; } if (!React.isValidElement(node)) return; found.push(node); visit(node.props.children); }; visit(tree); return found;
};

test('상품 계약서는 계약 요약과 여행자·항공·금액 정보를 먼저 보여 주고 입력·동의 업무는 뒤에 배치한다', () => {
    const html = render(base());
    for (const value of ['여행계약서', '계약자(여행자)', '합성 계약자', '저장된 여행지', '저장된 상품', 'CONTRACT DETAILS', '여행자', '항공', '금액', '별도 기록 없음']) assert.ok(html.includes(value), value);
    assert.ok(html.indexOf('계약자(여행자)') < html.indexOf('CONTRACT DETAILS'));
    const form = html.indexOf('고객 정보 확인'); assert.ok(form > html.indexOf('CONTRACT DETAILS'), 'Review the actual contract before the editable customer form');
    assert.ok((html.match(/0원/g) || []).length >= 3, 'Total, deposit and balance preserve actual zero amounts');
});

test('민트 완료 상태는 저장된 전자 동의만 표시하며 견적의 캔버스 서명 완료로 바꾸지 않는다', () => {
    const unsigned = render(base(), { agreed: true, signerName: '입력 중 이름', saved: true });
    assert.ok(!unsigned.includes('전자 동의 완료'), 'A local checkbox or saved flag is not stored agreement evidence');
    const malformed = base(); malformed.contract.agreement = { agreed: 'false', name: '문자열 동의', agreedAt: '2026-10-19T08:20:00Z' };
    assert.ok(!render(malformed).includes('전자 동의 완료'));
    const data = base(); data.contract.agreement = { agreed: true, name: '저장된 동의자', agreedAt: '2026-10-19T08:20:00Z' };
    const signed = render(data);
    for (const value of ['전자 동의 완료', '저장된 동의자']) assert.ok(signed.includes(value), value);
    assert.ok(!signed.includes('>SIGNED<')); assert.ok(!signed.includes('서명 완료'));
});

test('계약서에는 실제 왕복 항공·여행자·배정 정보를 보존하고 고객 입력 HTML을 실행하지 않는다', () => {
    const data = base(); data.contract.travelers[0].name = '<script>PRIVATE</script>';
    const html = render(data);
    for (const value of ['LOCAL-IN', 'LOCAL-OUT', '08:20', '15:10', 'LOCAL TRAVELER', '1990-01-01', 'LOCAL-PHONE', '실제 배정 게르', '등록 가이드', '&lt;script&gt;PRIVATE&lt;/script&gt;']) assert.ok(html.includes(value), value);
    assert.ok(!html.includes('<script>PRIVATE'));
    assert.ok(html.includes('저장된 포함 사항')); assert.ok(html.includes('저장된 불포함 사항'));
});

test('민트 디자인 적용 후에도 고객별 계약 조건·취소 규정·명시적으로 비운 포함 사항이 정본이다', () => {
    const data = base(); data.template = { id: 'custom', name: '고객별 문서', documentSettings: { contract: { intro: '저장된 계약 서문', paymentMethod: '저장된 지급 방식', paymentDeadline: '저장된 지급 기한',
        cancellationRows: [{ period: '저장된 취소 기준', fee: '저장된 취소 요금' }], signatureNote: '저장된 동의 안내' } } };
    const custom = render(data);
    for (const value of ['저장된 계약 서문', '저장된 지급 방식', '저장된 지급 기한', '저장된 취소 기준', '저장된 취소 요금', '저장된 동의 안내']) assert.ok(custom.includes(value), value);
    data.contractIncludedOverride = true; data.productIncluded = []; data.contractExcludedOverride = true; data.productExcluded = [];
    const cleared = render(data);
    assert.ok(!cleared.includes('숙박비, 식사비')); assert.ok(!cleared.includes('국제선 항공권'));
});

test('계약 금액의 명시적 잔금 0원과 미입력 계산을 구분하며 사용자 지정 지급 방식에는 기본 계좌를 끼우지 않는다', () => {
    const data = base(); data.reservation.totalPrice = 1000000; data.reservation.depositAmount = 300000; data.reservation.balanceAmount = 0;
    const explicit = render(data); assert.ok(explicit.includes('0원')); assert.ok(!explicit.includes('700,000원'));
    data.reservation.balanceAmount = null;
    assert.ok(render(data).includes('700,000원'));
    data.template = { id: 'custom', name: '별도 지급', documentSettings: { contract: { paymentMethod: '별도 결제 안내' } } };
    const custom = render(data); assert.ok(custom.includes('별도 결제 안내')); assert.ok(!custom.includes('1002-245-516496'));
});

test('고객 입력·여행자 추가·삭제·인쇄는 기존 콜백을 유지하고 렌더만으로 제출하지 않는다', () => {
    const calls = [];
    const tree = ContractDocumentView({ data: base(), onAddTraveler: () => calls.push('add'), onRemoveTraveler: index => calls.push(['remove', index]), onPrint: () => calls.push('print'), onSubmit: () => calls.push('submit') });
    assert.deepEqual(calls, []);
    const nodes = elements(tree), buttons = nodes.filter(node => node.type === 'button');
    const click = matcher => { const button = buttons.find(matcher); assert.ok(button); button.props.onClick(); };
    click(node => text(node.props.children).includes('여행자 추가'));
    click(node => String(node.props['aria-label'] || '').includes('여행자 삭제'));
    click(node => /인쇄|PDF 저장/.test(text(node.props.children)));
    assert.equal(calls[0], 'add'); assert.deepEqual(calls[1], ['remove', 0]); assert.equal(calls[2], 'print'); assert.ok(!calls.includes('submit'));
    const submit = buttons.find(node => /동의하고 서명 제출/.test(text(node.props.children))); assert.ok(submit?.props.disabled);
});

const source = fs.readFileSync(new URL('../src/pages/DocumentContract.tsx', import.meta.url), 'utf8');
const submitSource = source.slice(source.indexOf('    const handleCustomerSubmit = async'), source.indexOf('    const ready = data?.reservation.id'));
const submitCode = (await transform(submitSource + '\nglobalThis.submit = handleCustomerSubmit;', { loader: 'ts' })).code;
function submitHarness(saveCustomer) {
    const events = [], data = base();
    const context = vm.createContext({ data, reservationId: data.reservation.id, identityRef: { current: data.reservation.id }, lifecycle: { current: 1 }, submitPending: { current: false }, saving: false,
        agreed: true, signerName: '  합성 동의자  ', formTravelers: data.contract.travelers, arrival: data.contract.arrival, departure: data.contract.departure,
        api: { documents: { contract: { saveCustomer } } }, alert: message => events.push(['alert', message]), productSignatureStatus, signatureDraftRef: { current: drawnSignature },
        setSignatureReady: value => events.push(['signature-ready', value]),
        setSaving: value => events.push(['saving', value]), setSaved: value => events.push(['saved', value]),
        setData: update => { context.data = update(context.data); events.push(['data']); }, Date });
    vm.runInContext(submitCode, context);
    return { context, events };
}

test('실제 계약 제출은 현재 예약에 입력 snapshot을 한 번만 보내고 성공한 뒤에만 동의 상태를 갱신한다', async () => {
    let resolve; const pending = new Promise(done => { resolve = done; }), payloads = [];
    const { context, events } = submitHarness(async (...args) => { payloads.push(args); await pending; });
    const first = context.submit(); await context.submit();
    assert.equal(payloads.length, 1); assert.equal(payloads[0][0], 'local-product-contract');
    const payload = payloads[0][1]; assert.equal(payload.agreement.agreed, true); assert.equal(payload.agreement.name, '합성 동의자'); assert.ok(Date.parse(payload.agreement.agreedAt));
    assert.equal(payload.signature.signImg, drawnSignature); assert.equal(payload.signature.expectedRevision, context.data.signatureRevision); assert.equal(payload.signature.agree, true);
    assert.deepEqual(JSON.parse(JSON.stringify(payload.travelers)), context.formTravelers);
    assert.deepEqual(JSON.parse(JSON.stringify(payload.arrival)), context.arrival); assert.deepEqual(JSON.parse(JSON.stringify(payload.departure)), context.departure);
    assert.ok(!events.some(event => event[0] === 'saved' || event[0] === 'data'));
    resolve(); await first;
    assert.equal(context.data.contract.agreement.name, '합성 동의자'); assert.equal(context.submitPending.current, false);
    assert.ok(events.some(event => event[0] === 'saved' && event[1]));
});

test('제출 실패·동의 미선택·공백 성명은 입력과 이전 동의를 지키며 다른 예약으로 이동한 뒤 늦은 응답을 반영하지 않는다', async () => {
    let saves = 0;
    const { context, events } = submitHarness(async () => { saves++; throw new Error('로컬 저장 실패'); });
    const initial = context.data;
    await context.submit(); assert.equal(saves, 1); assert.equal(context.data, initial); assert.equal(context.formTravelers, initial.contract.travelers);
    assert.equal(context.signatureDraftRef.current, drawnSignature);
    assert.ok(!events.some(event => event[0] === 'saved' || event[0] === 'data')); assert.ok(events.some(event => event[0] === 'alert' && event[1].includes('제출에 실패')));
    context.agreed = false; await context.submit(); context.agreed = true; context.signerName = '  '; await context.submit(); assert.equal(saves, 1);
    let resolve; const late = new Promise(done => { resolve = done; });
    const other = submitHarness(async () => late); const request = other.context.submit();
    other.context.identityRef.current = 'another-reservation'; other.context.lifecycle.current++;
    other.events.length = 0; resolve(); await request; assert.deepEqual(other.events, []);
});

test('서명 없는 성명 동의를 손서명으로 표시하지 않으며 관리자 원본과 고객용 보관 안내를 구분한다', () => {
    const typed = base(); typed.contract.agreement = { agreed: true, name: '기존 성명 동의' };
    const historical = render(typed); assert.ok(historical.includes('전자 동의 완료')); assert.ok(historical.includes('고객 손서명 미등록')); assert.ok(!historical.includes('손서명 완료'));
    typed.contract.signature = { signedAt: '2026-10-20T08:20:00Z', signerName: '직접 서명자', signImg: drawnSignature, termsVersion: 'saved-version' };
    const original = render(typed); assert.ok(original.includes('손서명 완료')); assert.ok(original.includes('고객이 직접 작성한 계약서 서명 원본')); assert.ok(original.includes(drawnSignature));
    const publicData = { ...typed, contract: publicProductContract(typed.contract) };
    const customer = render(publicData); assert.ok(customer.includes('손서명 완료')); assert.ok(customer.includes('손서명 원본은 안전하게 보관')); assert.ok(!customer.includes(drawnSignature));
    typed.contract.signature.signedAt = ''; const missingTimestamp = render(typed); assert.ok(missingTimestamp.includes(drawnSignature)); assert.ok(missingTimestamp.includes('서명 시각 확인 필요')); assert.ok(!missingTimestamp.includes('손서명 완료'));
});

test('legacy 손서명에 시각이 없으면 원본과 변경 잠금은 유지하고 문서 완료 배지를 표시하지 않는다', () => {
    for (const signedAt of [undefined, '', 'invalid']) {
        const data = base(); data.contract.agreement = { agreed: true, name: '성명 동의자', agreedAt: '2026-10-20T08:20:00Z' };
        data.contract.signature = { signedAt, signerName: '저장된 실제 서명자', signImg: drawnSignature };
        const before = JSON.stringify(data);
        const html = render(data, { signaturePad: React.createElement('canvas', { 'aria-label': '덮어쓰기용 새 서명' }) });
        assert.ok(html.includes('서명 시각 확인 필요')); assert.ok(html.includes(drawnSignature));
        assert.ok(!html.includes('손서명 완료')); assert.ok(!html.includes('덮어쓰기용 새 서명'));
        assert.equal(JSON.stringify(data), before);
        const customer = render({ ...data, contract: publicProductContract(data.contract) });
        assert.ok(customer.includes('서명 시각 확인 필요')); assert.ok(!customer.includes('손서명 완료')); assert.ok(!customer.includes(drawnSignature));
    }
});

test('서명 원본 인쇄는 서명 당시 snapshot을 사용하고 이후 입력 수정은 별도 고객 폼에만 반영한다', () => {
    const current = base(), original = base(); original.reservation.productName = '서명 당시 여행상품'; original.contract.travelers[0].name = '서명 당시 여행자'; original.contract.arrival.flight = 'SAVED-IN';
    current.reservation.productName = '나중에 변경된 여행상품'; current.contract.travelers[0].name = '현재 여행자'; current.contract.arrival.flight = 'CURRENT-IN';
    current.contract.signature = { signedAt: '2026-10-20T08:20:00Z', signerName: '직접 서명자', signImg: drawnSignature, snapshot: { version: 1, document: original } };
    const html = render(current);
    assert.ok(html.includes('서명 당시 여행상품')); assert.ok(!html.includes('나중에 변경된 여행상품'));
    assert.ok(html.includes('서명 당시 여행자')); assert.ok(html.includes('value="현재 여행자"'));
    assert.ok(html.includes('SAVED-IN')); assert.ok(html.includes('value="CURRENT-IN"'));
});

test('빈 손서명은 제출하지 않고 저장된 실제 서명이 있는 재제출은 원본을 다시 보내지 않는다', async () => {
    const sent = []; const first = submitHarness(async (...args) => sent.push(args)); first.context.signatureDraftRef.current = '';
    await first.context.submit(); assert.equal(sent.length, 0); assert.ok(first.events.some(event => event[0] === 'alert' && event[1].includes('직접 서명')));
    const repeat = submitHarness(async (...args) => { sent.push(args); return { contract: publicProductContract(repeat.context.data.contract) }; });
    repeat.context.data.contract.signature = { signedAt: '2026-10-20T08:20:00Z', signerName: '기존 직접 서명', signImg: drawnSignature };
    await repeat.context.submit(); assert.equal(sent.length, 1); assert.equal(sent[0][1].signature, undefined); assert.equal(repeat.context.data.contract.signature.signerName, '기존 직접 서명'); assert.equal(repeat.context.data.contract.signature.signImg, drawnSignature);
});
