import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { documentRevision, productDocumentRevisions, quoteDocumentRevisions } from '../functions/lib/adminDocumentRevision.ts';
test('문서 버전은 속성 순서와 무관하고 고객에게 보이는 내용이 바뀌면 달라진다', async () => {
    assert.equal(await documentRevision({b:2,a:1}),await documentRevision({a:1,b:2}));
    assert.notEqual(await documentRevision({a:1}),await documentRevision({a:2}));
});
test('견적 서명·확인상태·내부 차량 연락처 변경은 재안내 사유로 보지 않는다', async () => {
    const original={name:'고객',depart:'2026-10-20',return_:'2026-10-22',adult:3,quote:{days:[{dest:'테를지'}]},booking:{days:[{dest:'테를지'}],assign:{vehicle:{model:'차량',phone:'private',plate:'private'}},contractInfo:{totalAmount:1000000}}};
    const before=await quoteDocumentRevisions(original), changed=structuredClone(original);
    changed.booking.contract={signedAt:'2026-10-19',signImg:'PRIVATE-SIGNATURE'};
    changed.booking.checklist={deposit:true};changed.booking.assign.vehicle.phone='PRIVATE-PHONE';changed.booking.assign.vehicle.plate='PRIVATE-PLATE';
    assert.deepEqual(await quoteDocumentRevisions(changed),before);
    changed.booking.days[0].dest='고비'; assert.notEqual((await quoteDocumentRevisions(changed)).itinerary,before.itinerary);
    changed.booking.contractInfo.totalAmount=2000000;assert.notEqual((await quoteDocumentRevisions(changed)).contract,before.contract);
});
test('상품 문서의 공개 차량·일정·계약조건만 비교하며 내부 메모와 기사 전화는 제외한다', async t => {
    const raw=new DatabaseSync(':memory:');t.after(()=>raw.close());
    raw.exec('CREATE TABLE itinerary_templates(id TEXT,name TEXT); CREATE TABLE products(id TEXT,name TEXT);');
    const db={prepare(sql){return {bind(...args){return {first:async()=>raw.prepare(sql).get(...args)||null};}};}};
    const row={id:'r',product_name:'테를지',start_date:'2026-10-20',end_date:'2026-10-22',customer_name:'고객',travelers:3,total_price:1000000,deposit_amount:100000,balance_amount:900000,
        document_content:JSON.stringify({name:'여행',days:[{day:1,title:'테를지',items:['산책']}],documentSettings:{contract:{preamble:'계약 원문'}}}),
        are_assignments_visible_to_user:1,contract_data:JSON.stringify({vehicle:{type:'차량',phone:'PRIVATE-PHONE',plate:'PRIVATE-PLATE'}}),admin_operations:JSON.stringify({vehicle:'차량',driverPhone:'PRIVATE-PHONE'})};
    const before=await productDocumentRevisions(db,row), changed=structuredClone(row);
    changed.history='내부 메모';changed.contract_data=JSON.stringify({vehicle:{type:'차량',phone:'CHANGED',plate:'CHANGED'}});
    assert.deepEqual(await productDocumentRevisions(db,changed),before);
    changed.document_content=JSON.stringify({name:'여행',days:[{day:1,title:'고비',items:['산책']}],documentSettings:{contract:{preamble:'계약 원문'}}});
    assert.notEqual((await productDocumentRevisions(db,changed)).itinerary,before.itinerary);
    for (const [key, value] of Object.entries({travelers:4,total_price:2000000,deposit_amount:200000,balance_amount:1800000})) {
        const revised=await productDocumentRevisions(db,{...row,[key]:value});
        assert.notEqual(revised.contract,before.contract,key);
        assert.notEqual(revised.itinerary,before.itinerary,key);
    }
    const spots=JSON.parse(row.document_content);spots.highlights=[{name:'테를지',img:'/img/spot.webp'}];
    assert.notEqual((await productDocumentRevisions(db,{...row,document_content:JSON.stringify(spots)})).itinerary,before.itinerary);
    const lodging={day:1,accommodation:{name:'게르',bookingStatus:'booked',roomCount:2,occupancy:4}};
    const stayBefore=await productDocumentRevisions(db,{...row,daily_accommodations:JSON.stringify([lodging])});
    lodging.accommodation.roomCount=3;
    assert.deepEqual(await productDocumentRevisions(db,{...row,daily_accommodations:JSON.stringify([lodging])}),stayBefore);
});
