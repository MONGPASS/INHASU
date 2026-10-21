import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const result = await build({ entryPoints:['src/components/admin/CustomerWorkspaceOverview.tsx'], bundle:true,format:'cjs',platform:'node',packages:'external',jsx:'automatic',write:false,loader:{'.css':'empty'},define:{'import.meta.env':'{}'} });
const mod = {exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,mod,mod.exports);
const {CustomerWorkspaceOverview} = mod.exports;
const model = {customerName:'합성 고객',sourceLabel:'상품 예약',bookingNumber:'same-id',statusLabel:'확정',period:'2026-10-24 ~ 2026-10-28',partyLabel:'성인 2명',
    facts:[{label:'연락처',value:'LOCAL-ONLY'}],preferences:[],notes:[],days:[{id:'d1',day:1,title:'테를지'}],documents:[{id:'contract',label:'계약서',action:'edit-contract'}],
    payment:{total:0,deposit:0,balance:0,depositPaid:false,balancePaid:false},assignments:[{id:'guide',label:'가이드',value:'미배정',statusLabel:'배정 필요',state:'pending'}],
    steps:[{id:'request',label:'문의 접수',done:true},{id:'quote',label:'견적 준비',done:false,current:true}],tasks:[{id:'g',label:'가이드 배정이 필요합니다',action:'guide'}],canSendItinerary:false,customerLinkAvailable:true};

test('업무 진행과 고객 알림은 유지하고 중복된 지금 할 일 영역은 표시하지 않는다', () => {
    let sent = 0;
    const notificationActions = React.createElement('section', { 'aria-label': '고객 카카오 알림 발송' }, React.createElement('button', { type: 'button', onClick: () => sent++ }, '카카오 발송'));
    const tree = CustomerWorkspaceOverview({ model, notificationActions, onAction() {} });
    const workflow = elements(tree, node => node.props.className === 'cw-workflow')[0];
    assert.equal(elements(workflow, node => node.props.className === 'cw-task-card').length, 0);
    assert.equal(elements(workflow, node => node.props.className === 'cw-progress-card').length, 1);
    const groups = elements(workflow, node => node.props['aria-label'] === '고객 카카오 알림 발송');
    assert.equal(groups.length, 1); renderToStaticMarkup(tree); assert.equal(sent, 0);
    elements(groups[0], node => node.type === 'button')[0].props.onClick(); assert.equal(sent, 1);
});

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
test('고객 현황은 0원과 미확인 금액을 구분하고 실제 입금 확인만 진행률에 반영한다',()=>{
    const render = payment => renderToStaticMarkup(React.createElement(CustomerWorkspaceOverview,{model:{...model,payment},onAction(){}}));
    const zero=render(model.payment);assert.ok(zero.includes('>₩0<'));assert.ok(zero.includes('aria-valuenow="0"'));
    const unknown=render({...model.payment,total:null});assert.ok(unknown.includes('>확인 필요<'));assert.ok(!unknown.includes('aria-valuenow='));assert.ok(unknown.includes('aria-valuetext="확인 필요"'));
    const missingReceipt=render({...model.payment,total:3000000,depositPaid:true,deposit:null});assert.ok(!missingReceipt.includes('aria-valuenow='));
    const paid=render({total:3000000,deposit:900000,balance:2100000,depositPaid:true,balancePaid:false});assert.ok(paid.includes('aria-valuenow="30"'));assert.ok(paid.includes('>미입금<'));
});
test('고객 일정·문서·미배정·메모를 실제값으로 렌더하고 고객 입력 HTML은 실행되지 않는다',()=>{
    const html=renderToStaticMarkup(React.createElement(CustomerWorkspaceOverview,{model:{...model,customerName:'<script>PRIVATE</script>',notes:[{id:'n1',body:'<img onerror=alert(1)>'}]},onAction(){}}));
    for(const value of ['&lt;script&gt;PRIVATE&lt;/script&gt;','&lt;img onerror=alert(1)&gt;','내부 전용','배정 필요','테를지','계약서']) assert.ok(html.includes(value),value);
    assert.ok(!html.includes('<script>PRIVATE'));assert.ok(!html.includes('채팅이 연결'));
});
test('요약의 고객·일정·결제·배정·문서 버튼은 선택한 업무 액션에 연결된다',()=>{
    const calls=[];const tree=CustomerWorkspaceOverview({model,onAction:(...args)=>calls.push(args)});
    const buttons=[];const visit=node=>{if(Array.isArray(node)){node.forEach(visit);return;}if(!React.isValidElement(node))return;if(node.type==='button')buttons.push(node);visit(node.props.children);};visit(tree);
    const click=label=>{const button=buttons.find(b=>b.props['aria-label']===label);assert.ok(button,label);button.props.onClick();};
    click('고객 정보 수정');click('여행 일정 편집');click('가이드 관리');
    for(const action of ['edit-info','edit-itinerary','guide'])assert.ok(calls.some(call=>call[0]===action));
});

test('상단 고객 문서는 확인·전달 영역만 열며 클릭 전이나 클릭 시 직접 복사·발송하지 않는다', () => {
    const calls = [];
    const tree = CustomerWorkspaceOverview({ model, onAction: (...args) => calls.push(args) });
    const headerActions = elements(tree, node => node.props.className === 'cw-header-actions');
    assert.equal(headerActions.length, 1);
    const buttons = elements(headerActions[0], node => node.type === 'button');
    assert.equal(buttons.length, 1);
    assert.equal(childrenText(buttons[0]), '고객 문서 확인·전달');
    assert.equal(buttons[0].props.disabled, false);
    assert.equal(elements(headerActions[0], node => node.type === 'p').length, 0);
    assert.deepEqual(calls, []);
    buttons[0].props.onClick();
    assert.deepEqual(calls, [['documents', undefined]]);
    assert.equal(calls.some(([action]) => ['customer-link', 'send-itinerary'].includes(action)), false);
    const html = renderToStaticMarkup(tree);
    assert.equal(html.includes('고객용 링크'), false);
    assert.equal(html.includes('일정표 보내기'), false);
});

test('6개 업무 바로가기는 각각의 실제 편집 화면을 열고 화면별 라벨은 액션을 바꾸지 않는다', () => {
    const calls = [];
    const actions = ['edit-itinerary', 'view-info', 'payments', 'assignments', 'operations', 'history'];
    const workLabels = { 'edit-itinerary': '견적 일정 편집', 'view-info': '고객 정보·항공편' };
    const tree = CustomerWorkspaceOverview({ model: { ...model, workLabels }, onAction: (...args) => calls.push(args) });
    const nav = elements(tree, node => node.type === 'nav' && node.props['aria-label'] === '고객 빠른 업무');
    assert.equal(nav.length, 1);
    const buttons = elements(nav[0], node => node.type === 'button');
    assert.equal(buttons.length, 6);
    assert.deepEqual(buttons.map(childrenText), ['견적 일정 편집', '고객 정보·항공편', '결제·입금', '가이드·숙소', '운영·영수증', '메모·이력']);
    for (const button of buttons) { assert.equal(Boolean(button.props.disabled), false); button.props.onClick(); }
    assert.deepEqual(calls, actions.map(action => [action, undefined]));
    assert.equal(elements(tree, node => node.type === 'button' && node.props['aria-label'] === '여행 일정 편집').length, 1);
});

test('처리 중에는 내부 업무 버튼을 잠그고 사용할 수 없는 바로가기는 구체적 사유와 함께 비활성화한다', () => {
    const calls = [];
    const busyTree = CustomerWorkspaceOverview({ model, busy: true, onAction: (...args) => calls.push(args) });
    assert.equal(busyTree.props['aria-busy'], true);
    const busyButtons = elements(busyTree, node => node.type === 'button');
    assert.ok(busyButtons.length > 6);
    assert.ok(busyButtons.every(button => button.props.disabled === true));
    assert.deepEqual(calls, []);

    const reason = '견적 예약 확정 후 배정할 수 있습니다.';
    const disabledTree = CustomerWorkspaceOverview({ model: { ...model, disabledActions: ['assignments', 'operations'], disabledActionReason: reason }, onAction() {} });
    const nav = elements(disabledTree, node => node.type === 'nav' && node.props['aria-label'] === '고객 빠른 업무')[0];
    const buttons = elements(nav, node => node.type === 'button');
    const disabled = buttons.filter(button => button.props.disabled);
    assert.deepEqual(disabled.map(childrenText), ['가이드·숙소', '운영·영수증']);
    assert.ok(disabled.every(button => button.props.title === reason));
    assert.ok(buttons.filter(button => !button.props.disabled).every(button => button.props.title === undefined));
});

test('헤더에는 예약된 실제 상품 이름·이미지·공개 링크를 표시하고 연결 정보가 없으면 링크를 만들지 않는다', () => {
    const bookedProduct = { name: '실제 저장 상품 <테를지>', href: '/products/saved-tour%2F3', image: '/api/images/saved-product.webp' };
    const tree = CustomerWorkspaceOverview({ model: { ...model, bookedProduct }, onAction() {} });
    const links = elements(tree, node => node.type === 'a');
    assert.equal(links.length, 1);
    const link = links[0];
    assert.equal(link.props.href, bookedProduct.href);
    assert.equal(link.props.target, '_blank');
    assert.equal(link.props.rel, 'noopener noreferrer');
    assert.equal(link.props['aria-label'], `예약 상품 ${bookedProduct.name} 새 창으로 보기`);
    assert.ok(childrenText(link).includes(bookedProduct.name));
    const html = renderToStaticMarkup(tree);
    assert.ok(html.includes('src="/api/images/saved-product.webp"'));
    assert.ok(html.includes('실제 저장 상품 &lt;테를지&gt;'));
    assert.ok(html.includes('상품 페이지 새 창으로 보기'));

    const storedOnly = CustomerWorkspaceOverview({ model: { ...model, bookedProduct: { name: '연결 없는 이전 상품' } }, onAction() {} });
    assert.equal(elements(storedOnly, node => node.type === 'a').length, 0);
    assert.ok(childrenText(storedOnly).includes('연결 없는 이전 상품'));
    assert.ok(childrenText(storedOnly).includes('연결된 상품을 확인해 주세요.'));
    const empty = renderToStaticMarkup(React.createElement(CustomerWorkspaceOverview, { model, onAction() {} }));
    assert.equal(empty.includes('cw-booked-product'), false);
});

test('현황은 실제 항공편·여행자 상세·시간별 활동·별도 안내·배정 숙소를 생략하거나 HTML로 실행하지 않는다',()=>{
    const html=renderToStaticMarkup(React.createElement(CustomerWorkspaceOverview,{model:{...model,
        flights:[{id:'arrival',label:'몽골 도착편',date:'2026-10-24',time:'15:30',flight:'LOCAL-AIR',extra:[{label:'픽업 장소',value:'공항 출구'}]}],
        travelers:{expected:2,registered:1,people:[{id:'p1',name:'저장된 여행자',details:[{label:'여권 영문명',value:'LOCAL TRAVELER'},{label:'생년월일',value:'<script>PRIVATE</script>'}]}]},
        days:[{id:'d1',day:1,title:'저장된 첫날',date:'10.24',activities:[{time:'15:30',title:'픽업',description:'공항 출구 미팅'}],summary:'도착 후 입국 수속\n15:30 픽업\n수하물 확인\n저장된 별도 안내',stay:'예약 게르',stayAssigned:true,meals:'중식 현지식 · 석식 캠프식'}],
    },onAction(){}}));
    for(const value of ['LOCAL-AIR','15:30','공항 출구','저장된 여행자','LOCAL TRAVELER','&lt;script&gt;PRIVATE&lt;/script&gt;','수하물 확인','저장된 별도 안내','예약 게르','실제 배정','중식 현지식']) assert.ok(html.includes(value),value);
    assert.equal((html.match(/>픽업<\/span>/g)||[]).length,1);
    assert.ok(html.indexOf('도착 후 입국 수속')<html.indexOf('>픽업</span>'));
    assert.ok(!html.includes('<script>PRIVATE'));
});

test('고객 정보는 기본 접힘으로 모든 저장 항목을 보존하고 전체 상세보기는 편집 대신 조회 액션을 연다', () => {
    const calls = [];
    const detailed = { ...model,
        facts: [...model.facts, { label: '이메일', value: 'local@example.invalid' }, { label: '상품', value: '실제 상품' }, { label: '접수일', value: '2026-10-19' }, { label: '주문 메모', value: '보존할 메모' }],
        flights: [{ id: 'arrival', label: '도착편', flight: 'LOCAL-1', date: '2026-10-25', time: '12:30' }, { id: 'departure', label: '출발편' }],
        travelers: { expected: 10, registered: 1, people: [{ id: 't1', name: '저장 여행자', details: [{ label: '여권 영문명', value: 'LOCAL PERSON' }] }] },
        preferences: ['보존할 요청'], agreement: { label: '계약서 전달 전' },
    };
    const tree = CustomerWorkspaceOverview({ model: detailed, onAction: (...args) => calls.push(args) });
    const customer = elements(tree, node => node.props.className === 'cw-card cw-customer-info')[0];
    const disclosures = elements(customer, node => node.props.className === 'cw-customer-disclosure');
    assert.equal(disclosures.length, 4);
    for (const disclosure of disclosures) {
        assert.equal(disclosure.type, 'details'); assert.notEqual(disclosure.props.open, true);
        const summary = elements(disclosure, node => node.type === 'summary')[0];
        assert.equal(elements(summary, node => node.type === 'button').length, 0);
    }
    const html = renderToStaticMarkup(tree);
    for (const value of ['보존할 메모', 'LOCAL-1', 'LOCAL PERSON', '보존할 요청', '1/2편 정보 등록', '1/10명 등록']) assert.ok(html.includes(value), value);
    assert.deepEqual(calls, []);
    elements(customer, node => node.props['aria-label'] === '고객 정보 전체 상세보기')[0].props.onClick();
    assert.deepEqual(calls, [['customer-detail', undefined]]);
});

test('최근 이력은 실제 전달된 기록 다섯 건과 현재 단계를 분리하고 전체보기로 연결한다', () => {
    const calls = [];
    const history = Array.from({ length: 7 }, (_, i) => ({ id: `history-${i}`, at: `2026-10-${20 - i}T03:00:00Z`, title: `저장된 업무 ${i}`, kind: i === 0 ? 'memo' : 'change', internal: i === 0, detail: i === 0 ? '<script>메모</script>' : undefined }));
    const tree = CustomerWorkspaceOverview({ model: { ...model, recentHistory: history, currentStage: { label: '고객 서명 대기', detail: '계약서 전달 기록 있음', tone: 'waiting' } }, onAction: (...args) => calls.push(args) });
    const card = elements(tree, node => node.props.className === 'cw-card cw-recent-history')[0];
    const rows = elements(card, node => node.type === 'li');
    assert.equal(rows.length, 5);
    assert.equal(elements(rows[0], node => node.type === 'time')[0].props.dateTime, history[0].at);
    const html = renderToStaticMarkup(card);
    assert.ok(html.includes('현재 단계')); assert.ok(html.includes('고객 서명 대기')); assert.ok(html.includes('내부'));
    assert.ok(html.includes('&lt;script&gt;메모&lt;/script&gt;')); assert.ok(!html.includes('저장된 업무 5'));
    elements(card, node => node.type === 'button')[0].props.onClick();
    assert.deepEqual(calls, [['history', undefined]]);
    const empty = renderToStaticMarkup(React.createElement(CustomerWorkspaceOverview, { model, onAction() {} }));
    assert.ok(empty.includes('저장된 처리 이력이 없습니다.'));
});

test('배정 자원 행 전체는 명확한 선택 버튼이고 클릭은 해당 선택기만 열며 저장을 실행하지 않는다', () => {
    const calls = [];
    const resources = ['guide', 'vehicle', 'stay'].map(id => ({ id, label: `${id} 자원`, value: '기존 선택', statusLabel: '배정됨', state: 'ready' }));
    const tree = CustomerWorkspaceOverview({ model: { ...model, assignments: resources }, directAssignments: true, onAction: (...args) => calls.push(args) });
    const buttons = elements(tree, node => node.props.className === 'cw-resource-select');
    assert.equal(buttons.length, 3);
    assert.deepEqual(calls, []);
    for (const [i, button] of buttons.entries()) {
        assert.equal(button.type, 'button'); assert.ok(button.props['aria-label'].includes(resources[i].label));
        assert.equal(elements(button, node => node !== button && node.type === 'button').length, 0);
        button.props.onClick();
    }
    assert.deepEqual(calls, [['guide', undefined], ['vehicle', undefined], ['stay', undefined]]);
    const disabled = CustomerWorkspaceOverview({ model: { ...model, assignments: resources, disabledActions: ['assignments'] }, onAction() {} });
    assert.ok(elements(disabled, node => node.props.className === 'cw-resource-select').every(node => node.props.disabled));
});

const disclosureDays = () => [
    { id: 'saved-day-5', day: 5, title: '저장된 고비 일정', date: '10.28(수)', region: '고비 남부', image: '/api/images/saved-day.webp',
        summary: '09:00 공항 픽업\n저장된 개별 안내\n저장된 개별 안내',
        activities: [
            { time: '09:00', title: '공항 픽업', description: '입국장 출구에서 만납니다.' },
            { time: '10:30', title: '초원 산책', description: '강변을 따라 걷습니다.' },
            { time: '12:00', title: '게르 방문', description: '유목민의 생활을 살펴봅니다.' },
            { time: '15:00', title: '승마 체험', description: '안전 교육 후 진행합니다.' },
            { time: '21:00', title: '별 관측', description: '마지막 활동 설명도 보존합니다.' },
        ], stay: '실제 배정 캠프', stayAssigned: true, meals: '조식 호텔식 · 석식 캠프식', travel: '4시간 · 250km' },
    { id: 'saved-return-day', day: 6, title: '귀국일', date: '', activities: [], stayRequired: false, stay: '숙박하지 않는 날의 이전 값' },
];

test('일차별 일정은 기본 접힘 요약과 독립된 편집 버튼으로 표시하고 요약 안에 중첩 버튼을 만들지 않는다', () => {
    const days = disclosureDays();
    const tree = CustomerWorkspaceOverview({ model: { ...model, days }, onAction() {} });
    const disclosures = elements(tree, node => node.type === 'details' && node.props.className === 'cw-day-disclosure');
    assert.equal(disclosures.length, days.length);
    disclosures.forEach((disclosure, index) => {
        assert.equal(Object.hasOwn(disclosure.props, 'open'), false, 'Browser details must start collapsed');
        const children = React.Children.toArray(disclosure.props.children);
        const summary = children.find(node => React.isValidElement(node) && node.type === 'summary' && node.props.className === 'cw-day-summary');
        const body = children.find(node => React.isValidElement(node) && node.type === 'div' && node.props.className === 'cw-day-details');
        assert.ok(summary); assert.ok(body);
        const summaryText = childrenText(summary);
        assert.ok(summaryText.includes(String(days[index].day) + '일차'));
        assert.ok(summaryText.includes(days[index].title));
        assert.ok(summaryText.includes(days[index].date || '날짜 확인 필요'));
        assert.equal(elements(summary, node => ['button', 'a', 'input', 'select', 'textarea'].includes(node.type)).length, 0);
        assert.equal(elements(summary, node => node.type === 'span' && node.props.className === 'cw-day-detail-label').length, 1);
        assert.equal(childrenText(summary).includes('실제 배정 캠프'), false, 'Full logistics belong inside the expandable body');
        const row = elements(tree, node => node.type === 'li' && elements(node, child => child === disclosure).length === 1)[0];
        assert.ok(row, 'The disclosure and edit button share their day list item');
        const directButtons = React.Children.toArray(row.props.children).filter(node => React.isValidElement(node) && node.type === 'button');
        assert.equal(directButtons.length, 1);
        assert.equal(directButtons[0].props['aria-label'], String(days[index].day) + '일차 일정 편집');
    });
    const html = renderToStaticMarkup(tree);
    assert.equal((html.match(/class="cw-day-disclosure"/g) || []).length, days.length);
    assert.equal(/<details[^>]*class="cw-day-disclosure"[^>]*\sopen(?:[\s=>])/.test(html), false);
});

test('일차를 한 번 펼치면 전체 활동·시간·설명과 숙소·식사·이동이 보존되며 별도 더보기는 없다', () => {
    const days = disclosureDays();
    const tree = CustomerWorkspaceOverview({ model: { ...model, days }, onAction() {} });
    const disclosures = elements(tree, node => node.type === 'details' && node.props.className === 'cw-day-disclosure');
    const body = elements(disclosures[0], node => node.type === 'div' && node.props.className === 'cw-day-details')[0];
    const bodyText = childrenText(body);
    for (const activity of days[0].activities) {
        for (const value of [activity.time, activity.title, activity.description]) assert.ok(bodyText.includes(value), value);
        assert.equal(elements(body, node => node.type === 'span' && childrenText(node) === activity.title).length, 1, 'Original activity is not duplicated from its summary line');
    }
    assert.equal(elements(body, node => node.type === 'span' && childrenText(node) === '저장된 개별 안내').length, 1);
    for (const value of ['실제 배정 캠프', '실제 배정', '조식 호텔식 · 석식 캠프식', '4시간 · 250km']) assert.ok(bodyText.includes(value), value);
    assert.equal(elements(body, node => node.type === 'details').length, 0, 'All activities use the same day disclosure');
    assert.equal(elements(body, node => node.props.className === 'cw-more-activities').length, 0);
    const returnBody = elements(disclosures[1], node => node.type === 'div' && node.props.className === 'cw-day-details')[0];
    assert.ok(childrenText(returnBody).includes('상세 일정이 입력되지 않았습니다.'));
    assert.ok(childrenText(returnBody).includes('숙박 없음'));
    assert.equal(childrenText(returnBody).includes('숙박하지 않는 날의 이전 값'), false);
});

test('상세 보기에는 업무·전달 핸들러가 없고 편집만 정확한 저장 일차 ID로 연결되며 처리 중에는 잠긴다', () => {
    const days = disclosureDays(), calls = [];
    const tree = CustomerWorkspaceOverview({ model: { ...model, days }, onAction: (...args) => calls.push(args) });
    const disclosures = elements(tree, node => node.type === 'details' && node.props.className === 'cw-day-disclosure');
    for (const disclosure of disclosures) {
        assert.equal(disclosure.props.onToggle, undefined);
        assert.equal(disclosure.props.onClick, undefined);
        const summary = elements(disclosure, node => node.type === 'summary')[0];
        assert.equal(summary.props.onClick, undefined);
        assert.equal(summary.props.onKeyDown, undefined);
    }
    renderToStaticMarkup(tree);
    assert.deepEqual(calls, [], 'Rendering or native disclosure must not send or copy customer documents');
    for (const day of days) {
        const button = elements(tree, node => node.type === 'button' && node.props['aria-label'] === String(day.day) + '일차 일정 편집')[0];
        assert.ok(button); assert.equal(button.props.disabled, false); button.props.onClick();
    }
    assert.deepEqual(calls, days.map(day => ['edit-itinerary', day.id]));
    const busy = CustomerWorkspaceOverview({ model: { ...model, days }, busy: true, onAction() {} });
    for (const day of days) {
        const button = elements(busy, node => node.type === 'button' && node.props['aria-label'] === String(day.day) + '일차 일정 편집')[0];
        assert.equal(button.props.disabled, true);
    }
    assert.equal(elements(busy, node => node.type === 'details' && node.props.className === 'cw-day-disclosure').length, days.length);
});
