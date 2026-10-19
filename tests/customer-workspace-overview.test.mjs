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
    const zero=render(model.payment);assert.ok(zero.includes('>0원<'));assert.ok(zero.includes('aria-valuenow="0"'));
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
    assert.match(childrenText(headerActions[0]), /일정표·계약서의 미리보기·안내문 복사·발송을 선택합니다\./);
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

test('수동 새로고침 슬롯은 한 번만 렌더하며 사용자 클릭으로만 전달된 콜백을 실행한다', () => {
    const calls = [];
    let refreshes = 0;
    const refreshControl = React.createElement('button', { type: 'button', 'aria-label': '고객 제출·처리 내역 다시 불러오기', onClick: () => refreshes++ }, '처리 내역 새로고침');
    const tree = CustomerWorkspaceOverview({ model, refreshControl, onAction: (...args) => calls.push(args) });
    const slots = elements(tree, node => node.props.className === 'cw-overview-refresh');
    assert.equal(slots.length, 1);
    const buttons = elements(slots[0], node => node.type === 'button');
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0], refreshControl);
    renderToStaticMarkup(tree);
    assert.equal(refreshes, 0);
    assert.deepEqual(calls, []);
    buttons[0].props.onClick();
    assert.equal(refreshes, 1);
    assert.deepEqual(calls, []);
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

test('남은 업무는 구체적 이유와 처리 버튼을 노출하고 고객 대기보다 관리자 처리 항목을 먼저 안내한다',()=>{
    const calls=[]; const tasks=[{id:'signature',label:'고객 동의 대기',detail:'고객 실제 동의 기록 없음',action:'view-info',actionLabel:'동의 상태 확인',waiting:true},
        {id:'flights',label:'항공 정보 확인',detail:'도착편명 미입력',action:'flights',actionLabel:'항공편 확인'},
        {id:'travelers',label:'여행자 명단 확인',detail:'1/2명 입력',action:'travelers',actionLabel:'명단 확인'}];
    const tree=CustomerWorkspaceOverview({model:{...model,tasks},onAction:(...args)=>calls.push(args)});
    const buttons=[];const visit=node=>{if(Array.isArray(node)){node.forEach(visit);return;}if(!React.isValidElement(node))return;if(node.type==='button')buttons.push(node);visit(node.props.children);};visit(tree);
    const label=node=>Array.isArray(node)?node.map(label).join(''):typeof node==='string'?node:React.isValidElement(node)?label(node.props.children):'';
    for(const task of tasks){const button=buttons.find(button=>label(button.props.children).includes(task.actionLabel));assert.ok(button,task.actionLabel);button.props.onClick();assert.ok(calls.some(call=>call[0]===task.action&&call[1]===task.id));}
    const html=renderToStaticMarkup(tree);
    assert.ok(html.indexOf('항공 정보 확인')<html.indexOf('고객 동의 대기'));assert.ok(!html.includes('<details class="cw-task'));
    for(const task of tasks)assert.ok(html.includes(task.detail));
});
