import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup: renderRaw } = require('react-dom/server');
const { MemoryRouter } = require('react-router-dom');
// 배정 카드의 전용 메뉴 바로가기는 라우터 링크라 화면처럼 라우터 안에서 그린다.
const renderToStaticMarkup = node => renderRaw(React.createElement(MemoryRouter, null, node));
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
// 버튼은 생 <button> 또는 우리 관리자 버튼 부품(AdminButton·AdminTextButton·AdminIconButton — forwardRef 함수 이름, 묶을 때 뒤에 숫자가 붙을 수 있다)으로 찾는다.
const isButton = node => node.type === 'button' || /^Admin(Text|Icon)?Button\d*$/.test(node.type?.render?.name || '');
const buttons = tree => elements(tree, isButton);
const byText = (tree, text) => buttons(tree).find(b => childrenText(b).trim() === text);
// AdminIconButton은 이름을 label로 받아 aria-label로 붙인다.
const byLabel = (tree, label) => buttons(tree).find(b => (b.props['aria-label'] ?? b.props.label) === label);
const html = props => renderToStaticMarkup(React.createElement(CustomerWorkspaceOverview, { onAction() {}, ...props }));
const stop = { stopPropagation() {} };
/** 바로가기 이동 대상 카드 흉내: 이동 호출과 잠깐 강조(class)만 받는다. */
const sectionStub = (selector, onScroll) => ({ id: selector.slice(1), offsetWidth: 1, classList: { add() {}, remove() {}, contains: () => false }, closest: () => null, scrollIntoView: onScroll });
/** 진행 단계 번호 원 버튼(생 button + adm-cw-step) */
const stepButtons = tree => elements(tree, node => node.type === 'button' && node.props.className === 'adm-cw-step');
/** 카드 제목 뒤 건수 알약(말풍선 data-tip) */
const countChip = card => elements(card, node => String(node.props?.className || '').startsWith('cw-count'))[0];
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

test('고객 상세는 고객 통합 작업 화면으로 그리고 렌더만으로 업무·발송을 실행하지 않는다', () => {
    let sent = 0; const calls = [];
    const notices = React.createElement('details', { className: 'cw-kakao' }, React.createElement('button', { type: 'button', onClick: () => sent++ }, '카카오 발송'));
    const markup = html({ model, notificationActions: notices, onAction: (...args) => calls.push(args) });
    assert.match(markup, /class="v7-root cw-overview cw-v8"/);
    for (const label of ['일정표 편집', '고객·항공편', '결제·영수증', '가이드·숙소', '운영 메모', '변경 이력']) assert.ok(markup.includes(label), label);
    for (const id of ['sec-pay', 'sec-cls', 'sec-doc', 'sec-asg', 'sec-plan', 'sec-info', 'sec-memo', 'sec-log', 'sec-notice']) assert.ok(markup.includes(`id="${id}"`), id);
    assert.equal((markup.match(/class="cw-kakao"/g) || []).length, 1);
    assert.equal(sent, 0); assert.deepEqual(calls, []);
    // 맞춤 견적 흐름(m.flow)이 없으면 ‘지금 할 일’ 판을 그리지 않는다
    assert.equal(markup.includes('지금 할 일'), false);
});

test('바로가기 6개는 디자인대로 화면 안 카드로 이동만 하고 업무·발송을 실행하지 않는다', () => {
    const calls = [], scrolled = [];
    const st = initialDetailState();
    const env = { mounted: { current: true }, toastTimer: { current: undefined }, root: { current: { querySelector: selector => sectionStub(selector, options => scrolled.push([selector, options.block])) } } };
    const tree = reservationDetailView({ model, onAction: (...args) => calls.push(args) }, st, patch => Object.assign(st, patch), env).element;
    const nav = elements(tree, node => node.type === 'nav' && node.props['aria-label'] === '예약 상세 바로가기')[0];
    const items = elements(nav, node => node.type === 'button');
    assert.deepEqual(items.map(childrenText), ['일정표 편집', '고객·항공편', '결제·영수증', '가이드·숙소', '운영 메모', '변경 이력']);
    for (const item of items) { assert.notEqual(item.props.disabled, true); item.props.onClick(); }
    assert.deepEqual(scrolled.map(([selector]) => selector), ['#sec-plan', '#sec-info', '#sec-pay', '#sec-asg', '#sec-memo', '#sec-log']);
    assert.deepEqual(calls, []);
    // 이동 대상 카드가 모두 화면에 있다.
    const markup = renderToStaticMarkup(tree);
    for (const id of ['sec-plan', 'sec-info', 'sec-pay', 'sec-asg', 'sec-memo', 'sec-log']) assert.ok(markup.includes(`id="${id}"`), id);
    // 처리 중에도 화면 안 이동은 막지 않는다.
    const busyNav = elements(view({ model, busy: true }).tree, node => node.type === 'nav')[0];
    assert.ok(elements(busyNav, node => node.type === 'button').every(b => b.props.disabled !== true));
});

test('알림 보내기는 같은 화면의 고객 알림 카드로 이동하고 문의 단계에서는 문서 화면을 연다', () => {
    const calls = [], scrolled = [];
    const env = { mounted: { current: true }, toastTimer: { current: undefined }, root: { current: { querySelector: selector => sectionStub(selector, () => scrolled.push(selector)) } } };
    const notices = React.createElement('section', { className: 'cw-kakao' });
    const render = extra => { const st = initialDetailState(); return reservationDetailView({ model: { ...model, ...extra }, notificationActions: notices, onAction: (...args) => calls.push(args) }, st, patch => Object.assign(st, patch), env).element; };
    byText(render({}), '알림 보내기').props.onClick();
    assert.deepEqual(calls, []); assert.deepEqual(scrolled, ['#sec-notice']);
    byText(render({ documentAction: 'documents', documentLabel: '견적서 확인·전달' }), '견적서 확인·전달').props.onClick();
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
    assert.ok(head.includes('견적 준비')); assert.match(head, /<b>1<\/b> \/ 2 완료/);
    // 번호 원: 끝난 단계는 체크, 지금 단계는 aria-current와 위 화살표
    const steps = stepButtons(tree);
    assert.deepEqual(steps.map(b => b.props['aria-label']), ['1단계 문의 접수 · 완료', '2단계 견적 준비 · 지금']);
    assert.equal(steps[1].props['aria-current'], 'true');
    assert.deepEqual(calls, []);
    steps[1].props.onClick();
    assert.deepEqual(calls, [['quote']]);
    const cancelled = renderToStaticMarkup(view({ model: { ...model, currentStage: { label: '취소됨', tone: 'cancelled' } } }).tree);
    assert.ok(cancelled.includes('취소된 예약')); assert.ok(!cancelled.includes(' 완료</span>')); assert.ok(cancelled.includes('cw-steps is-cancelled'));
});

test('고객 차례면 기다린 날수·안내 날짜·출발일 타임라인과 다시 보내기(빨강)를 보여 준다', () => {
    const calls = [];
    // 화면은 한국 날짜로 센다(UTC 날짜와 다를 수 있다)
    const day = n => new Date(Date.now() + 9 * 3600e3 + n * 864e5).toISOString().slice(0, 10);
    const flow = { steps: [{ id: 'quote', label: '견적서', done: true }, { id: 'answer', label: '고객 답변', done: true }, { id: 'deposit', label: '예약금', done: true },
        { id: 'sign', label: '계약서 서명', done: false }, { id: 'confirm', label: '예약 확정', done: false }, { id: 'assign', label: '배정', done: false }, { id: 'publish', label: '일정표 공개', done: false }],
        current: 3, next: { title: '고객 서명을 기다리고 있어요', detail: '서명 안내를 보냈어요.', waiting: true, since: { at: day(-3), label: '서명 안내 발송' }, departure: day(3),
            primary: { label: '서명 안내 다시 보내기', action: 'notify-contract' }, secondary: { label: '기다리는 동안 배정하기', action: 'assignments' } } };
    const { tree } = view({ model: { ...model, flow }, onAction: (...args) => calls.push(args) });
    const markup = renderToStaticMarkup(tree);
    for (const value of ['4단계 · 계약서 서명', '<b>3</b> / 7 완료', '고객 차례 · 3일째 응답 없음', '고객 서명을 기다리고 있어요', '출발 3일 전이에요. 오늘 다시 안내해 주세요.', '서명 안내 발송', '3일째', '출발'])
        assert.ok(markup.includes(value), value);
    const resend = byText(tree, '서명 안내 다시 보내기');
    assert.equal(resend.props.variant, 'danger'); assert.equal(byText(tree, '기다리는 동안 배정하기').props.variant, 'secondary');
    resend.props.onClick(); assert.deepEqual(calls, [['notify-contract', undefined]]);
    // 내 차례(기다리지 않음)는 민트 꼬리말과 주요 버튼, 타임라인 없음
    const mine = renderToStaticMarkup(view({ model: { ...model, flow: { ...flow, current: 4, next: { title: '예약을 확정해 주세요', primary: { label: '예약 확정', action: 'confirm-booking' } } } } }).tree);
    assert.ok(mine.includes('내 차례 · 5단계 예약 확정')); assert.ok(!mine.includes('cw-wait'));
});

test('예약 원본이 연결되면 계약서·예약금·배정·잔금·출발 5단계로 계산한다', () => {
    const source = { id: 'r1', type: 'product', status: 'confirmed', customerName: '합성 고객', productName: '테를지', startDate: '2099-10-24', endDate: '2099-10-26',
        totalAmount: 3000000, deposit: 600000, balance: 2400000, depositStatus: 'paid', balanceStatus: 'unpaid', contractData: { agreement: { agreed: false } } };
    const markup = renderToStaticMarkup(view({ model, links: { source, userId: 'admin' } }).tree);
    for (const label of ['계약서', '예약금', '배정', '잔금', '출발', '>입금 완료<', '>미수<']) assert.ok(markup.includes(label), label);
    assert.ok(markup.includes('<b>1</b> / 5 완료'));
    const calls = [], scrolled = [];
    const st = initialDetailState();
    const env = { mounted: { current: true }, toastTimer: { current: undefined }, root: { current: { querySelector: selector => sectionStub(selector, () => scrolled.push(selector)) } } };
    const steps = stepButtons(reservationDetailView({ model, links: { source, userId: 'admin' }, onAction: (...args) => calls.push(args) }, st, patch => Object.assign(st, patch), env).element);
    steps.forEach(b => b.props.onClick());
    assert.deepEqual(scrolled, ['#sec-doc', '#sec-pay', '#sec-asg', '#sec-pay', '#sec-plan']);
    assert.deepEqual(calls, []);
});

test('서류 카드는 저장된 문서의 기존 액션만 열고 없는 문서는 만들지 않는다', () => {
    const calls = [];
    const documents = [{ id: 'quote', label: '견적서', action: 'quote-preview', status: '저장됨' }, { id: 'contract', label: '계약서', status: '미작성' }, { id: 'guide', label: '가이드 시트', disabled: true }];
    const { tree } = view({ model: { ...model, documents }, onAction: (...args) => calls.push(args) });
    const card = elements(tree, node => node.props.id === 'sec-doc')[0];
    const opens = buttons(card).filter(node => /열기$/.test(node.props['aria-label'] || ''));
    assert.deepEqual(opens.map(b => b.props['aria-label']), ['견적서 열기', '계약서 열기', '가이드 시트 열기']);
    assert.equal(opens[2].props.disabled, true);
    opens[0].props.onClick(); opens[1].props.onClick();
    assert.deepEqual(calls, [['quote-preview', 'quote'], ['contract', 'contract']]);
    byText(card, '공개 · 전달 관리').props.onClick();
    assert.deepEqual(calls.at(-1), ['documents', undefined]);
    // 문서 상태는 이름 아래 글자(확인이 필요하면 빨강), 남은 건수는 제목 뒤 알약 + 말풍선
    const markup = renderToStaticMarkup(card);
    assert.ok(markup.includes('cw-doc-state">저장됨<')); assert.ok(markup.includes('cw-doc-state is-warn">미작성<'));
    const chip = countChip(card);
    assert.equal(chip.props.children, 1); assert.equal(chip.props['data-tip'], '1건 남음 · 계약서 미작성');
    assert.equal(chip.props['aria-label'], '서류 · 1건 남음 · 계약서 미작성');
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
    // 배정 카드는 결과만 보여 주고 고르기 버튼이 없다(배정은 전용 메뉴에서)
    assert.equal(elements(elements(tree, node => node.props.id === 'sec-asg')[0], node => node.type === 'button').length, 0);
    elements(elements(tree, node => node.props.id === 'sec-cls')[0], node => node.type === 'button')[0].props.onClick(stop);
    assert.deepEqual(calls, [['payments'], ['payments', undefined], ['operations']]);
});

test('고객 입력 값은 HTML로 실행되지 않는다', () => {
    const markup = html({ model: { ...model, customerName: '<script>PRIVATE</script>', notes: [{ id: 'n1', body: '<img onerror=alert(1)>' }] } });
    for (const value of ['&lt;script&gt;PRIVATE&lt;/script&gt;', '&lt;img onerror=alert(1)&gt;', '테를지', '계약서', '가이드 미배정']) assert.ok(markup.includes(value), value);
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
    for (const text of ['알림 보내기', '일정표 편집', '공개 · 전달 관리', '결제 화면', '예약금 입금 확인']) assert.equal(byText(tree, text).props.disabled, true, text);
    assert.equal(byLabel(tree, '고객 정보 수정').props.disabled, true);
    assert.equal(byLabel(tree, '계약서 열기').props.disabled, true);
});

test('고객 이름은 머리 카드의 연필로 그 자리에서 고치고, 저장은 연결된 onRename 하나로만 한다', async () => {
    // 저장 연결이 없으면(이전 견적 등) 연필이 없다
    assert.equal(byLabel(view({ model }).tree, '고객 이름 수정'), undefined);
    const renamed = [];
    const links = { source: null, userId: 'admin', onRename: async name => { renamed.push(name); return true; } };
    const first = view({ model, links });
    byLabel(first.tree, '고객 이름 수정').props.onClick();
    assert.equal(first.st.nameDraft, '합성 고객');
    const editing = view({ model, links }, first.st).tree;
    const input = elements(editing, node => node.props?.['aria-label'] === '고객 이름')[0];
    assert.ok(input); assert.equal(input.props.value, '합성 고객');
    // 빈 이름은 저장 버튼이 잠기고 저장하지 않는다
    input.props.onChange({ target: { value: '   ' } });
    assert.equal(byText(view({ model, links }, first.st).tree, '저장').props.disabled, true);
    input.props.onChange({ target: { value: '  바뀐 고객  ' } });
    const form = elements(view({ model, links }, first.st).tree, node => node.type === 'form')[0];
    form.props.onSubmit({ preventDefault() {} });
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.deepEqual(renamed, ['바뀐 고객']); assert.equal(first.st.nameDraft, null);
    // Esc는 저장 없이 닫는다
    byLabel(view({ model, links }, first.st).tree, '고객 이름 수정').props.onClick();
    elements(view({ model, links }, first.st).tree, node => node.props?.['aria-label'] === '고객 이름')[0].props.onKeyDown({ key: 'Escape', preventDefault() {} });
    assert.equal(first.st.nameDraft, null); assert.deepEqual(renamed, ['바뀐 고객']);
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

test('일정 카드는 접혀 있을 때 일차 줄만, 펼치면 일차별 활동·시간·설명과 식사·이동·편집을 보여 준다', () => {
    const days = disclosureDays(), calls = [];
    const first = view({ model: { ...model, days }, onAction: (...args) => calls.push(args) });
    const closed = renderToStaticMarkup(first.tree);
    assert.ok(closed.includes('저장된 고비 일정') && closed.includes('실제 배정 캠프')); assert.ok(!closed.includes('입국장 출구에서 만납니다.'));
    assert.ok(closed.includes('숙박 없음')); assert.ok(!closed.includes('숙박하지 않는 날의 이전 값'));
    byLabel(first.tree, '일정 펼쳐 보기').props.onClick();
    assert.equal(first.st.daysAll, true);
    const opened = view({ model: { ...model, days }, onAction: (...args) => calls.push(args) }, first.st);
    const markup = renderToStaticMarkup(opened.tree);
    for (const value of ['09:00', '공항 픽업', '입국장 출구에서 만납니다.', '21:00', '별 관측', '마지막 활동 설명도 보존합니다.', '조식 호텔식 · 석식 캠프식', '4시간 · 250km']) assert.ok(markup.includes(value), value);
    assert.deepEqual(calls, []);
    byText(opened.tree, '5일차 편집').props.onClick();
    assert.deepEqual(calls, [['edit-itinerary', 'saved-day-5']]);
});

test('일정이 예약 기간보다 길거나 짧으면 빨간 글자로 알린다', () => {
    const days = n => Array.from({ length: n }, (_, i) => ({ id: `d${i + 1}`, day: i + 1, title: `${i + 1}일차 장소` }));
    const short = { ...model, period: '2026-11-27 ~ 2026-11-28' };
    assert.ok(renderToStaticMarkup(view({ model: { ...short, days: days(3) } }).tree).includes('예약 기간은 1박 2일(11.27–11.28)인데 3일차(11.29) 일정이 있어요. 확인해 주세요.'));
    assert.ok(renderToStaticMarkup(view({ model: { ...short, period: '2026-11-27 ~ 2026-11-30', days: days(2) } }).tree).includes('예약 기간은 3박 4일인데 일정은 2일차까지만 있어요.'));
    assert.ok(!renderToStaticMarkup(view({ model: { ...short, days: days(2) } }).tree).includes('cw-warn'));
});

test('고객 정보는 세 줄만 보이고, 펼치면 예약 상세·요청·예약번호와 항공편·여행자 펼침 줄을 보여 주며 개인정보는 기본으로 가린다', () => {
    const calls = [];
    const detailed = { ...model,
        facts: [...model.facts, { label: '이메일', value: 'local@example.invalid' }, { label: '상품', value: '실제 상품' }, { label: '접수일', value: '2026-10-19' }, { label: '주문 메모', value: '보존할 메모' }],
        flights: [{ id: 'arrival', label: '도착편', flight: 'LOCAL-1', date: '2026-10-25', time: '12:30', extra: [{ label: '픽업', value: '공항 미팅' }] }, { id: 'departure', label: '출발편' }],
        travelers: { expected: 10, registered: 1, people: [{ id: 't1', name: '저장 여행자', details: [{ label: '구분', value: '성인' }, { label: '여권번호', value: 'M12345678' }] }] },
        preferences: ['보존할 요청'] };
    const first = view({ model: detailed, onAction: (...args) => calls.push(args) });
    const collapsed = renderToStaticMarkup(first.tree);
    assert.ok(!collapsed.includes('LOCAL-1')); assert.ok(!collapsed.includes('보존할 메모'));
    byLabel(first.tree, '고객 정보 펼쳐 보기').props.onClick();
    assert.equal(first.st.infoMore, true);
    const disc = (st, label) => buttons(view({ model: detailed, onAction: (...args) => calls.push(args) }, st).tree).find(b => b.props.className === 'adm-cw-disc' && childrenText(b).startsWith(label));
    // 펼침 줄은 요약만: 편명·여행자 이름·여권은 아직 없다
    const rows = renderToStaticMarkup(view({ model: detailed }, first.st).tree);
    for (const value of ['보존할 메모', '보존할 요청', '#same-id', '1/2편 정보 등록', '미등록 1편', '1/10명 등록', '9명 여권 정보 미제출']) assert.ok(rows.includes(value), value);
    for (const value of ['LOCAL-1', '저장 여행자']) assert.ok(!rows.includes(value), value);
    assert.equal(disc(first.st, '항공편').props['aria-expanded'], false);
    // 항공편: 도착·출발편 상세(편명·날짜·몽골 도착 시간·추가 칸)
    disc(first.st, '항공편').props.onClick();
    assert.deepEqual(first.st.infoOpen, { flights: true });
    const flights = renderToStaticMarkup(view({ model: detailed }, first.st).tree);
    for (const value of ['LOCAL-1', '2026-10-25', '몽골 도착', '12:30', '공항 미팅', '편명 미등록', '>등록됨<', '>미등록<']) assert.ok(flights.includes(value), value);
    // 여행자: 줄을 펼치면 사람 목록, 사람을 누르면 여권 정보(기본으로 가림) — 항공편과 따로 펼친다
    disc(first.st, '여행자').props.onClick();
    assert.deepEqual(first.st.infoOpen, { flights: true, travelers: true });
    const person = buttons(view({ model: detailed }, first.st).tree).find(b => b.props.className === 'adm-cw-person');
    assert.ok(childrenText(person).includes('저장 여행자') && childrenText(person).includes('성인'));
    person.props.onClick();
    const people = renderToStaticMarkup(view({ model: detailed }, first.st).tree);
    assert.ok(people.includes('여권번호') && people.includes('M12******<')); assert.ok(!people.includes('M12345678'));
    assert.ok(people.includes('010-1234***')); assert.ok(!people.includes('010-1234-5678'));
    const opened = view({ model: detailed, onAction: (...args) => calls.push(args) }, first.st).tree;
    byLabel(opened, '항공편 수정').props.onClick(); byLabel(opened, '여행자 상세보기').props.onClick();
    assert.deepEqual(calls, [['flights', undefined], ['travelers', undefined]]);
    byLabel(opened, '개인정보 보기').props.onClick();
    const shown = renderToStaticMarkup(view({ model: detailed }, first.st).tree);
    assert.ok(shown.includes('010-1234-5678') && shown.includes('M12345678'));
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

test('서류 카드의 견적서 수정 버튼은 견적 작성기 액션을 보내고 처리 중에는 잠긴다', () => {
    const calls = [];
    const documents = [{ id: 'quote', label: '견적서', action: 'quote-preview', editAction: 'quote-edit', editLabel: '견적서 수정', status: '저장됨' }];
    const { tree } = view({ model: { ...model, documents }, onAction: (...args) => calls.push(args) });
    const edit = byLabel(tree, '견적서 수정');
    assert.ok(edit); assert.equal(edit.props.disabled, false);
    edit.props.onClick(); assert.deepEqual(calls, [['quote-edit', 'quote']]);
    byLabel(tree, '견적서 열기').props.onClick(); assert.deepEqual(calls.at(-1), ['quote-preview', 'quote']);
    assert.equal(byLabel(view({ model: { ...model, documents }, busy: true }).tree, '견적서 수정').props.disabled, true);
    assert.equal(byLabel(view({ model }).tree, '계약서 수정'), undefined);
});

test('고객 통합 작업에서는 가이드·차량·숙소를 배정하지 않고 결과(없으면 미배정)만 보여 준다', () => {
    const calls = [], scrolled = [];
    const source = { id: 'res-1', type: 'product', status: 'confirmed', startDate: '2026-10-24', endDate: '2026-10-26', totalAmount: 0, depositStatus: 'paid' };
    const { tree } = view({ model, links: { source, userId: 'admin' }, onAction: (...args) => calls.push(args) });
    const markup = renderToStaticMarkup(tree);
    for (const gone of ['박별 관리', '일자별 숙소', '현지 운영에 수배 요청', '가이드 선택', '차량 선택', '숙소 선택']) assert.ok(!markup.includes(gone), gone);
    for (const shown of ['가이드 미배정', '차량 미배정']) assert.ok(markup.includes(shown), shown);
    // 건수 알약: 미배정 셋을 한 문장으로 말해도 건수는 셋
    const chip = countChip(elements(tree, node => node.props.id === 'sec-asg')[0]);
    assert.equal(chip.props.children, 3); assert.equal(chip.props['data-tip'], '3건 남음 · 가이드·차량·숙소가 아직 배정되지 않았어요');
    assert.equal(markup.match(/id="sec-asg"/g).length, 1, 'one assignment card');
    // ‘배정하기’ 같은 배정 업무 버튼은 업무 창을 열지 않고 배정 카드로 이동한다
    const root = { querySelector: sel => sel === '#sec-asg' ? sectionStub(sel, () => scrolled.push(sel)) : null };
    const env = { mounted: { current: true }, toastTimer: { current: undefined }, root: { current: root } };
    const st = initialDetailState();
    const flowModel = { ...model, flow: { steps: [{ id: 'assign', label: '배정', done: false }], current: 0, next: { title: '배정해 주세요', primary: { label: '배정하기', action: 'assignments' } } } };
    const flowTree = reservationDetailView({ model: flowModel, onAction: (...args) => calls.push(args) }, st, patch => Object.assign(st, typeof patch === 'function' ? patch(st) : patch), env).element;
    byText(flowTree, '배정하기').props.onClick();
    assert.deepEqual(scrolled, ['#sec-asg']);
    assert.deepEqual(calls, []);
});

test('배정 카드의 박별 숙소는 기본 접힘이고 펼치면 한 줄에 한 박씩, 미배정 박도 겹치지 않게 보여 준다', () => {
    const source = { id: 'res-2', type: 'product', status: 'confirmed', startDate: '2026-11-27', endDate: '2026-11-30', totalAmount: 0, depositStatus: 'paid',
        dailyAccommodations: [{ day: 2, date: '2026-11-28', accommodation: { name: 'Birga Resort', type: '고급게르', bookingStatus: '예약완료' } }] };
    const first = view({ model, links: { source, userId: 'admin' } });
    const closed = renderToStaticMarkup(first.tree);
    assert.ok(closed.includes('박별 숙소 보기 · 3박'));
    assert.ok(!closed.includes('class="cw-stay-list"'));
    byText(first.tree, '박별 숙소 보기 · 3박').props.onClick();
    assert.equal(first.st.staysOpen, true);
    const opened = renderToStaticMarkup(view({ model, links: { source, userId: 'admin' } }, first.st).tree);
    const rows = opened.match(/<li class="cw-stay">.*?<\/li>/g) || [];
    assert.equal(rows.length, 3, 'one line per night');
    assert.deepEqual(rows.map(row => row.match(/cw-stay-day">(\d+)박/)[1]), ['1', '2', '3']);
    assert.ok(rows[1].includes('Birga Resort') && rows[0].includes('숙소 미배정') && rows[2].includes('숙소 미배정'));
    assert.ok(opened.includes('박별 숙소 접기'));
});

test('네 칸 카드 제목 줄의 편집은 그 업무의 편집 화면을 열고 배정은 숙소 배정 화면으로 간다', () => {
    const calls = [];
    const source = { id: 'res-3', type: 'quote_booking', status: 'confirmed', startDate: '2026-11-27', endDate: '2026-11-28', totalAmount: 0, depositStatus: 'paid' };
    const { tree } = view({ model, links: { source, userId: 'admin' }, onAction: (...args) => calls.push(args) });
    byLabel(tree, '결제 편집').props.onClick();
    byLabel(tree, '분류 편집').props.onClick();
    byLabel(tree, '서류 편집').props.onClick();
    assert.deepEqual(calls.map(call => call[0]), ['payments', 'operations', 'documents']);
    assert.equal(byLabel(tree, '배정 편집').props.to, '/admin/accommodation-ops?open=res-3&source=quote_booking');
    // 예약 전(배정·결제 잠김)에는 그 카드의 편집이 없다
    const locked = view({ model: { ...model, disabledActions: ['payments', 'assignments'] } }).tree;
    assert.equal(byLabel(locked, '결제 편집'), undefined);
    assert.equal(byLabel(locked, '배정 편집'), undefined);
});

test('알림 · 변경 이력은 고객 알림 카드 맨 아래(기본 접힘)에 들어가고, 바로가기 ‘변경 이력’은 펼친 뒤 이동한다', () => {
    function KakaoStub({ extra }) { return React.createElement('section', { id: 'sec-notice', className: 'cw-kakao' }, React.createElement('h2', null, '고객 알림'), extra); }
    const history = [{ id: 'h1', at: '2026-10-14T00:00:00Z', title: '상품 예약 접수', kind: 'booking' }];
    const markup = renderToStaticMarkup(view({ model: { ...model, recentHistory: history }, notificationActions: React.createElement(KakaoStub) }).tree);
    const inside = markup.match(/<section id="sec-notice" class="cw-kakao">.*?<\/section>/s)?.[0] || '';
    assert.ok(inside.includes('<details id="sec-log"') && inside.includes('알림 · 변경 이력') && inside.includes('상품 예약 접수'));
    assert.equal(markup.match(/id="sec-log"/g).length, 1, 'no separate history card');
    // 알림 부품이 없는 화면(이전 견적)에서는 같은 모양의 카드를 따로 그린다
    const plain = renderToStaticMarkup(view({ model }).tree);
    assert.ok(plain.includes('id="sec-notice"') && plain.includes('id="sec-log"'));
    // 바로가기 ‘변경 이력’: 접힌 이력(details)을 펼친 뒤 이동
    const folded = { open: false };
    const env = { mounted: { current: true }, toastTimer: { current: undefined }, root: { current: { querySelector: () => ({ classList: { add() {}, remove() {} }, offsetWidth: 1, closest: () => folded, scrollIntoView() {} }) } } };
    const st = initialDetailState();
    const tree = reservationDetailView({ model, notificationActions: React.createElement(KakaoStub), onAction() {} }, st, patch => Object.assign(st, patch), env).element;
    byLabel(tree, '변경 이력 위치로 이동').props.onClick();
    assert.equal(folded.open, true);
});

test('일정 카드는 3일까지만 보이고 카드 아래 가운데 펼침 아이콘으로 나머지 일차를 펼친다', () => {
    const days = Array.from({ length: 8 }, (_, i) => ({ id: `d${i + 1}`, day: i + 1, title: `${i + 1}일차 장소` }));
    const first = view({ model: { ...model, days } });
    const closed = renderToStaticMarkup(first.tree);
    assert.ok(closed.includes('3일차 장소') && !closed.includes('4일차 장소'));
    byLabel(first.tree, '일정 8일 모두 보기').props.onClick();
    assert.equal(first.st.daysAll, true);
    const opened = view({ model: { ...model, days } }, first.st);
    assert.ok(renderToStaticMarkup(opened.tree).includes('8일차 장소'));
    assert.ok(byLabel(opened.tree, '일정 접기'));
    // 3일 이하면 같은 아이콘이 일차별 상세만 펼친다
    assert.equal(byLabel(view({ model: { ...model, days: days.slice(0, 3) } }).tree, '일정 3일 모두 보기'), undefined);
    assert.ok(byLabel(view({ model: { ...model, days: days.slice(0, 3) } }).tree, '일정 펼쳐 보기'));
});
