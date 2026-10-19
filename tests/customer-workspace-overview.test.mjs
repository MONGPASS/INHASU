import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require = createRequire(import.meta.url), React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const result = await build({ entryPoints:['src/components/admin/CustomerWorkspaceOverview.tsx'], bundle:true,format:'cjs',platform:'node',packages:'external',jsx:'automatic',write:false,loader:{'.css':'empty'} });
const mod = {exports:{}};new Function('require','module','exports',result.outputFiles[0].text)(require,mod,mod.exports);
const {CustomerWorkspaceOverview} = mod.exports;
const model = {customerName:'합성 고객',sourceLabel:'상품 예약',bookingNumber:'same-id',statusLabel:'확정',period:'2026-10-24 ~ 2026-10-28',partyLabel:'성인 2명',
    facts:[{label:'연락처',value:'LOCAL-ONLY'}],preferences:[],notes:[],days:[{id:'d1',day:1,title:'테를지'}],documents:[{id:'contract',label:'계약서',action:'edit-contract'}],
    payment:{total:0,deposit:0,balance:0,depositPaid:false,balancePaid:false},assignments:[{id:'guide',label:'가이드',value:'미배정',statusLabel:'배정 필요',state:'pending'}],
    steps:[{id:'request',label:'문의 접수',done:true},{id:'quote',label:'견적 준비',done:false,current:true}],tasks:[{id:'g',label:'가이드 배정이 필요합니다',action:'guide'}],canSendItinerary:false,customerLinkAvailable:true};
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
    const send=buttons.find(b=>String(b.props.children).includes('일정표 보내기'));assert.ok(send?.props.disabled);
});
