import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const load = async entry => {
    const result = await build({ entryPoints: [entry], bundle: true, format: 'cjs', platform: 'node', packages: 'external', jsx: 'automatic', write: false, loader: { '.css': 'empty' }, define: { 'import.meta.env': '{}' } });
    const mod = { exports: {} }; new Function('require', 'module', 'exports', result.outputFiles[0].text)(require, mod, mod.exports);
    return mod.exports;
};
const { CustomerWorkspaceOverview } = await load('src/components/admin/CustomerWorkspaceOverview.tsx');
const { reservationDetailView, initialDetailState } = await load('src/components/admin/v7/ReservationDetailV7.tsx');

const model = {customerName:'합성 고객',sourceLabel:'상품 예약',bookingNumber:'same-id',statusLabel:'확정',period:'2026-10-24 ~ 2026-10-28',partyLabel:'성인 2명',
    facts:[{label:'연락처',value:'010-1234-5678'}],preferences:[],notes:[],days:[{id:'d1',day:1,title:'테를지'}],documents:[{id:'contract',label:'계약서',action:'edit-contract'}],
    payment:{total:0,deposit:0,balance:0,depositPaid:false,balancePaid:false},assignments:[{id:'guide',label:'가이드',value:'미배정',statusLabel:'배정 필요',state:'pending'}],
    steps:[{id:'request',label:'문의 접수',done:true},{id:'quote',label:'견적 준비',done:false,current:true}],tasks:[{id:'g',label:'가이드 배정이 필요합니다',action:'guide'}],canSendItinerary:false,customerLinkAvailable:true};

/** 실제 화면과 같은 그리기 함수를 상태 객체로 호출한다. set은 같은 객체를 갱신한다. */
function view(props, st = initialDetailState()) {
    const env = { mounted: { current: true }, toastTimer: { current: undefined }, root: { current: null } };
    const set = patch => Object.assign(st, typeof patch === 'function' ? patch(st) : patch);
    return { tree: reservationDetailView({ onAction() {}, ...props }, st, set, env).element, st };
}
function elements(tree, predicate) {
    const found = [];
    const visit = node => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!React.isValidElement(node)) return;
        if (predicate(node)) found.push(node);
        visit(node.props.children);
    };
    visit(tree);
    return found;
}
const childrenText = node => Array.isArray(node) ? node.map(childrenText).join('') : typeof node === 'string' || typeof node === 'number' ? String(node) : React.isValidElement(node) ? childrenText(node.props.children) : '';
const buttons = tree => elements(tree, node => node.type === 'button');
const byText = (tree, text) => buttons(tree).find(b => childrenText(b).trim() === text);
const byLabel = (tree, label) => buttons(tree).find(b => b.props['aria-label'] === label);
const html = props => renderToStaticMarkup(React.createElement(CustomerWorkspaceOverview, { onAction() {}, ...props }));
const stop = { stopPropagation() {} };

test('고객 상세는 예약 관리 v7 화면으로 그리고 렌더만으로 업무·발송을 실행하지 않는다', () => {
    let sent = 0; const calls = [];
    const notices = React.createElement('details', { className: 'cw-kakao' }, React.createElement('button', { type: 'button', onClick: () => sent++ }, '카카오 발송'));
    const markup = html({ model, notificationActions: notices, onAction: (...args) => calls.push(args) });
    assert.match(markup, /class="v7-root cw-overview"/);
    for (const label of ['일정표 편집', '고객·항공편', '결제·영수증', '가이드·숙소', '운영·메모', '메모·이력']) assert.ok(markup.includes(label), label);
    for (const id of ['sec-pay', 'sec-asg-s', 'sec-cls', 'sec-doc', 'sec-asg', 'sec-plan', 'sec-info', 'sec-memo', 'sec-log']) assert.ok(markup.includes(`id="${id}"`), id);
    assert.equal((markup.match(/class="cw-kakao"/g) || []).length, 1);
    assert.equal(sent, 0); assert.deepEqual(calls, []);
    assert.equal(markup.includes('지금 할 일'), false);
});

test('바로가기는 6개이고 일정이 없으면 일정표 편집을 연다', () => {
    const calls = [];
    const { tree } = view({ model: { ...model, days: [] }, onAction: (...args) => calls.push(args) });
    const nav = elements(tree, node => node.type === 'nav' && node.props['aria-label'] === '예약 상세 바로가기')[0];
    const items = elements(nav, node => node.type === 'button');
    assert.deepEqual(items.map(childrenText), ['일정표 편집', '고객·항공편', '결제·영수증', '가이드·숙소', '운영·메모', '메모·이력']);
    items[0].props.onClick();
    assert.deepEqual(calls, [['edit-itinerary']]);
    items[2].props.onClick(); // 화면 안 위치로만 이동한다
    assert.deepEqual(calls, [['edit-itinerary']]);
});

test('알림 보내기는 같은 화면의 고객 알림 패널을 펼치고 문의 단계에서는 문서 화면을 연다', () => {
    const calls = [];
    let opened = false, scrolled = 0, focused = 0;
    const panel = { set open(value) { opened = value; }, get open() { return opened; }, scrollIntoView: () => scrolled++, querySelector: () => ({ focus: () => focused++ }) };
    const event = { currentTarget: { closest: () => ({ querySelector: selector => selector === 'details.cw-kakao' ? panel : null }) } };
    const notices = React.createElement('details', { className: 'cw-kakao' });
    byText(view({ model, notificationActions: notices, onAction: (...args) => calls.push(args) }).tree, '알림 보내기').props.onClick(event);
    assert.deepEqual(calls, []); assert.equal(opened, true); assert.equal(scrolled, 1); assert.equal(focused, 1);
    const inquiry = view({ model: { ...model, documentAction: 'documents', documentLabel: '견적서 확인·전달' }, notificationActions: notices, onAction: (...args) => calls.push(args) }).tree;
    byText(inquiry, '견적서 확인·전달').props.onClick(event);
    assert.deepEqual(calls, [['documents']]);
});

test('풀패키지·실속형·미지정은 머리 영역의 표시만 하고 정보가 없으면 숨긴다', () => {
    const render = packageInfo => html({ model: { ...model, packageInfo } });
    assert.match(render({ tier: 'full' }), />풀패키지</);
    assert.match(render({ tier: 'value', detail: '고객 선택 · 일반 여행자 게르' }), /title="고객 선택 · 일반 여행자 게르"[^>]*>실속형</);
    assert.match(render({ tier: null }), />패키지 미지정</);
    assert.doesNotMatch(render(undefined), /풀패키지|실속형|패키지 미지정/);
    assert.equal(buttons(view({ model: { ...model, packageInfo: { tier: 'full' } } }).tree).some(b => childrenText(b).includes('풀패키지')), false);
});

test('진행 단계는 현재 단계를 표시하고 단계 클릭은 저장 없이 해당 업무만 연다', () => {
    const calls = [];
    const { tree } = view({ model, onAction: (...args) => calls.push(args) });
    const head = renderToStaticMarkup(tree);
    assert.ok(head.includes('견적 준비')); assert.ok(head.includes('1 / 2 단계 완료'));
    const steps = elements(tree, node => typeof node.type === 'function' && node.props.steps)[0];
    assert.deepEqual(steps.props.steps.map(s => s.label), ['문의 접수', '견적 준비']);
    assert.deepEqual(calls, []);
    steps.props.onStep(1);
    assert.deepEqual(calls, [['quote']]);
    const cancelled = renderToStaticMarkup(view({ model: { ...model, currentStage: { label: '취소됨', tone: 'cancelled' } } }).tree);
    assert.ok(cancelled.includes('취소된 예약')); assert.ok(!cancelled.includes('단계 완료'));
});

test('예약 원본이 연결되면 계약서·예약금·배정·잔금·출발 5단계로 계산한다', () => {
    const source = { id: 'r1', type: 'product', status: 'confirmed', customerName: '합성 고객', productName: '테를지', startDate: '2099-10-24', endDate: '2099-10-26',
        totalAmount: 3000000, deposit: 600000, balance: 2400000, depositStatus: 'paid', balanceStatus: 'unpaid', contractData: { agreement: { agreed: false } } };
    const markup = renderToStaticMarkup(view({ model, links: { source, userId: 'admin' } }).tree);
    for (const label of ['계약서', '예약금', '배정', '잔금', '출발', '계약서 서명', '₩600,000 입금', '₩2,400,000 미수']) assert.ok(markup.includes(label), label);
    assert.ok(markup.includes('1 / 5 단계 완료'));
});

test('서류 카드는 저장된 문서의 기존 액션만 열고 없는 문서는 만들지 않는다', () => {
    const calls = [];
    const documents = [{ id: 'quote', label: '견적서', action: 'quote-preview', status: '저장됨' }, { id: 'contract', label: '계약서', status: '미작성' }, { id: 'guide', label: '가이드 시트', disabled: true }];
    const { tree } = view({ model: { ...model, documents }, onAction: (...args) => calls.push(args) });
    const card = elements(tree, node => node.props.id === 'sec-doc')[0];
    const opens = elements(card, node => node.type === 'button' && /열기$/.test(node.props['aria-label'] || ''));
    assert.deepEqual(opens.map(b => b.props['aria-label']), ['견적서 열기', '계약서 열기', '가이드 시트 열기']);
    assert.equal(opens[2].props.disabled, true);
    opens[0].props.onClick(); opens[1].props.onClick();
    assert.deepEqual(calls, [['quote-preview', 'quote'], ['contract', 'contract']]);
    byText(card, '관리').props.onClick();
    assert.deepEqual(calls.at(-1), ['documents', undefined]);
    assert.ok(childrenText(card).includes('1건 남음') || childrenText(card).includes('2건 남음'));
});

test('결제는 0원과 미확인 금액을 구분하고 입금 확인 상태만 버튼에 표시한다', () => {
    const render = payment => renderToStaticMarkup(view({ model: { ...model, payment } }).tree);
    const zero = render(model.payment);
    assert.ok(zero.includes('>₩0<')); assert.ok(zero.includes('미입금'));
    const unknown = render({ ...model.payment, total: null, deposit: null, balance: null });
    assert.ok(!unknown.includes('₩0')); assert.ok(unknown.includes('>–<'));
    const paid = render({ total: 3000000, deposit: 900000, balance: 2100000, depositPaid: true, balancePaid: false });
    assert.ok(paid.includes('₩900,000')); assert.ok(paid.includes('입금 완료')); assert.ok(paid.includes('>미수<'));
});

test('예약 원본 연결이 없으면 결제·배정·분류 버튼은 기존 업무 화면을 연다', () => {
    const calls = [];
    const { tree } = view({ model, onAction: (...args) => calls.push(args) });
    byText(tree, '미입금').props.onClick(stop);
    byText(tree, '결제 화면').props.onClick();
    elements(elements(tree, node => node.props.id === 'sec-asg-s')[0], node => node.type === 'button')[0].props.onClick(stop);
    elements(elements(tree, node => node.props.id === 'sec-cls')[0], node => node.type === 'button')[0].props.onClick(stop);
    assert.deepEqual(calls, [['payments'], ['payments', undefined], ['guide'], ['operations']]);
});

test('고객 입력 값은 HTML로 실행되지 않는다', () => {
    const markup = html({ model: { ...model, customerName: '<script>PRIVATE</script>', notes: [{ id: 'n1', body: '<img onerror=alert(1)>' }] } });
    for (const value of ['&lt;script&gt;PRIVATE&lt;/script&gt;', '&lt;img onerror=alert(1)&gt;', '테를지', '계약서', '배정 전']) assert.ok(markup.includes(value), value);
    assert.ok(!markup.includes('<script>PRIVATE'));
});

test('머리·고객 정보·일정 버튼은 선택한 업무 액션에 연결된다', () => {
    const calls = [];
    const { tree } = view({ model, onAction: (...args) => calls.push(args) });
    byLabel(tree, '고객 정보 수정').props.onClick();
    byText(tree, '일정표 편집').props.onClick();
    buttons(tree).find(b => childrenText(b).trim() === '통합 예약 목록').props.onClick();
    assert.deepEqual(calls, [['edit-info', undefined], ['edit-itinerary', undefined], ['back', undefined]]);
});

test('처리 중에는 업무·문서 버튼을 잠근다', () => {
    const { tree } = view({ model: { ...model, documents: [{ id: 'contract', label: '계약서' }] }, busy: true });
    for (const text of ['알림 보내기', '일정표 편집', '관리', '결제 화면']) assert.equal(byText(tree, text).props.disabled, true, text);
    assert.equal(byLabel(tree, '고객 정보 수정').props.disabled, true);
    assert.equal(byLabel(tree, '계약서 열기').props.disabled, true);
});

test('예약 상품은 공개 링크만 새 창으로 연결하고 연결 정보가 없으면 링크를 만들지 않는다', () => {
    const bookedProduct = { name: '실제 저장 상품 <테를지>', href: '/products/saved-tour%2F3' };
    const links = elements(view({ model: { ...model, bookedProduct } }).tree, node => node.type === 'a' && node.props.href === bookedProduct.href);
    assert.equal(links.length, 1); assert.equal(links[0].props.target, '_blank'); assert.equal(links[0].props.rel, 'noopener noreferrer');
    assert.ok(childrenText(links[0]).includes(bookedProduct.name));
    const stored = view({ model: { ...model, bookedProduct: { name: '연결 없는 이전 상품' } } }).tree;
    assert.equal(elements(stored, node => node.type === 'a' && String(node.props.href).startsWith('/products/')).length, 0);
});

const disclosureDays = () => [
    { id: 'saved-day-5', day: 5, title: '저장된 고비 일정', date: '10.28(수)', region: '고비 남부',
        activities: [{ time: '09:00', title: '공항 픽업', description: '입국장 출구에서 만납니다.' }, { time: '21:00', title: '별 관측', description: '마지막 활동 설명도 보존합니다.' }],
        stay: '실제 배정 캠프', stayAssigned: true, meals: '조식 호텔식 · 석식 캠프식', travel: '4시간 · 250km' },
    { id: 'saved-return-day', day: 6, title: '귀국일', date: '', activities: [], stayRequired: false, stay: '숙박하지 않는 날의 이전 값' },
];

test('일차별 일정은 기본 접힘이며 펼치면 활동·시간·설명과 숙소·식사·이동을 모두 보여 준다', () => {
    const days = disclosureDays(), calls = [];
    const first = view({ model: { ...model, days }, onAction: (...args) => calls.push(args) });
    const toggles = elements(first.tree, node => node.type === 'button' && node.props['aria-expanded'] !== undefined && /일차/.test(childrenText(node)));
    assert.equal(toggles.length, 2); assert.ok(toggles.every(t => t.props['aria-expanded'] === false));
    const closed = renderToStaticMarkup(first.tree);
    assert.ok(closed.includes('실제 배정 캠프')); assert.ok(!closed.includes('입국장 출구에서 만납니다.'));
    assert.ok(closed.includes('숙박 없음')); assert.ok(!closed.includes('숙박하지 않는 날의 이전 값'));
    toggles[0].props.onClick();
    assert.deepEqual(first.st.dayOpen, { 'saved-day-5': true });
    const opened = view({ model: { ...model, days }, onAction: (...args) => calls.push(args) }, first.st);
    const markup = renderToStaticMarkup(opened.tree);
    for (const value of ['09:00', '공항 픽업', '입국장 출구에서 만납니다.', '21:00', '별 관측', '마지막 활동 설명도 보존합니다.', '조식 호텔식 · 석식 캠프식', '4시간 · 250km']) assert.ok(markup.includes(value), value);
    assert.deepEqual(calls, []);
    byText(opened.tree, '5일차 편집').props.onClick();
    assert.deepEqual(calls, [['edit-itinerary', 'saved-day-5']]);
});

test('고객 정보는 기본 접힘·한 번에 하나만 펼치고 개인정보는 기본으로 가린다', () => {
    const detailed = { ...model,
        facts: [...model.facts, { label: '이메일', value: 'local@example.invalid' }, { label: '상품', value: '실제 상품' }, { label: '접수일', value: '2026-10-19' }, { label: '주문 메모', value: '보존할 메모' }],
        flights: [{ id: 'arrival', label: '도착편', flight: 'LOCAL-1', date: '2026-10-25', time: '12:30' }, { id: 'departure', label: '출발편' }],
        travelers: { expected: 10, registered: 1, people: [{ id: 't1', name: '저장 여행자', details: [{ label: '여권번호', value: 'M12345678' }] }] },
        preferences: ['보존할 요청'] };
    const first = view({ model: detailed });
    const closed = renderToStaticMarkup(first.tree);
    for (const value of ['1/2편 정보 등록', '1/10명 등록', '요청 1건', '접수 · 주문 경로 등 2개 항목']) assert.ok(closed.includes(value), value);
    for (const value of ['보존할 메모', 'LOCAL-1', '보존할 요청']) assert.ok(!closed.includes(value), value);
    assert.ok(closed.includes('010-1234***')); assert.ok(!closed.includes('010-1234-5678'));
    const toggle = title => buttons(view({ model: detailed }, first.st).tree).find(b => b.props['aria-expanded'] !== undefined && childrenText(b).includes(title));
    toggle('항공편').props.onClick(); toggle('여행자 정보').props.onClick();
    assert.deepEqual(first.st.sections, { tr: true });
    const travelers = renderToStaticMarkup(view({ model: detailed }, first.st).tree);
    assert.ok(travelers.includes('저장 여행자')); assert.ok(travelers.includes('9명 여권 정보 미제출')); assert.ok(!travelers.includes('M12345678')); assert.ok(!travelers.includes('LOCAL-1'));
    byLabel(view({ model: detailed }, first.st).tree, '개인정보 보기').props.onClick();
    const shown = renderToStaticMarkup(view({ model: detailed }, first.st).tree);
    assert.ok(shown.includes('010-1234-5678')); assert.ok(shown.includes('M12345678'));
});

test('알림·변경 이력은 저장된 기록을 모두 보여 주고 전체 이력으로 연결한다', () => {
    const calls = [];
    const history = Array.from({ length: 7 }, (_, i) => ({ id: `history-${i}`, at: `2026-10-${20 - i}T03:00:00Z`, title: `저장된 업무 ${i}`, kind: i === 0 ? 'memo' : 'payment', internal: i === 0, detail: i === 0 ? '<script>메모</script>' : undefined }));
    const { tree } = view({ model: { ...model, recentHistory: history }, onAction: (...args) => calls.push(args) });
    const card = elements(tree, node => node.props.id === 'sec-log')[0];
    const markup = renderToStaticMarkup(card);
    assert.ok(markup.includes('7건')); assert.ok(markup.includes('저장된 업무 6')); assert.ok(markup.includes('내부')); assert.ok(markup.includes('완료'));
    assert.ok(markup.includes('&lt;script&gt;메모&lt;/script&gt;'));
    byText(card, '전체 이력').props.onClick();
    assert.deepEqual(calls, [['history', undefined]]);
    assert.ok(renderToStaticMarkup(view({ model }).tree).includes('저장된 처리 이력이 없습니다.'));
});

test('운영 메모는 전달된 작성기를 쓰고 없으면 메모 화면을 연다', () => {
    const calls = [];
    const composer = React.createElement('textarea', { 'aria-label': '고객 내부 메모' });
    assert.ok(html({ model, noteComposer: composer }).includes('aria-label="고객 내부 메모"'));
    byText(view({ model, onAction: (...args) => calls.push(args) }).tree, '메모 작성').props.onClick();
    assert.deepEqual(calls, [['notes', undefined]]);
});
