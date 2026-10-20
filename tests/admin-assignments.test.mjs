import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { Hono } from 'hono';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { buildProductQuote } from '../functions/lib/productItinerary.ts';
import { readProductVehicle, syncProductVehicle } from '../src/utils/reservationAssignment.ts';
import { onRequestGet as getPublicQuote } from '../functions/api/my/[token].js';
import { assignmentDraftKey, editorAssignment, writeAssignmentDraft, readAssignmentDraft, discardAssignmentDraft } from '../src/utils/adminAssignmentDraft.ts';

const bundle = async path => { const r = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false }); return (await import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].contents).toString('base64')}`)).default; };
const [assignments, reservations, documents] = await Promise.all([bundle('functions/api/admin-assignments.ts'),bundle('functions/api/reservations.ts'),bundle('functions/api/documents.ts')]);
async function fixture(t) {
    const originalFetch=globalThis.fetch;let providerCalls=0;
    globalThis.fetch=async()=>{providerCalls++;throw Error('외부 서비스 호출 금지');};
    t.after(()=>{globalThis.fetch=originalFetch;assert.equal(providerCalls,0,'배정 조회·저장은 외부 알림을 보내지 않아야 한다');});
    const raw = new DatabaseSync(':memory:'); t.after(()=>raw.close());
    let beforeRun;
    const statement = (sql,args=[]) => ({ bind:(...v)=>statement(sql,v),
        async first(){return raw.prepare(sql).get(...args)??null;}, async all(){return {results:raw.prepare(sql).all(...args)};},
        async run(){if(beforeRun) beforeRun(sql,args);return {meta:raw.prepare(sql).run(...args)};},
        async raw(){return raw.prepare(sql).all(...args).map(row=>Object.values(row));},
        exec(){return /^\s*(SELECT|PRAGMA)/i.test(sql)?{results:raw.prepare(sql).all(...args)}:{meta:raw.prepare(sql).run(...args)};}
    });
    const DB={prepare:sql=>statement(sql),batch:async rows=>rows.map(r=>r.exec())};
    await ensureSiteSchema(DB); raw.exec(fs.readFileSync(new URL('../schema.sql',import.meta.url),'utf8'));
    raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
        CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);`);
    for(const [id,role] of [['admin','admin'],['member','user']]) {
        raw.prepare('INSERT INTO users(id,email,name,role,google_id) VALUES(?,?,?,?,?)').run(id,`${id}@example.invalid`,id,role,role==='user'?`google-${id}`:null);
        raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run(`session-${id}`,id,Date.now()+86400000);
    }
    raw.prepare('INSERT INTO products(id,name) VALUES(?,?)').run('real-product','로컬 상품');
    const contract={agreement:{agreed:true,name:'서명자'},travelers:[{passportNo:'PRIVATE-PASSPORT'}],vehicle:{type:'기존 차',phone:'PRIVATE-DRIVER',img:'/car.jpg'},extra:'보존'};
    raw.prepare(`INSERT INTO reservations(id,customer_name,customer_email,product_name,start_date,end_date,status,deposit_status,contract_data,assigned_guide,daily_accommodations,admin_operations,history)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('same-id','상품 고객','member@example.invalid','상품','2026-10-20','2026-10-22','confirmed','paid',JSON.stringify(contract),
        JSON.stringify({id:'guide-old',name:'기존 가이드',image:'/guide.jpg'}),JSON.stringify([{day:1,accommodation:{name:'기존 호텔',images:['/hotel.jpg'],privateNote:'PRIVATE-DAY'}}]),JSON.stringify({opsNote:'PRIVATE-NOTE',receipt:{number:'PRIVATE-RECEIPT'}}),'[{"type":"created"}]');
    raw.prepare('UPDATE reservations SET user_id=?,created_at=? WHERE id=?').run('member','2026-09-30T03:00:00Z','same-id');
    const rec={id:'same-id',token:'PRIVATE-TOKEN',name:'견적 고객',status:'예약확정',depart:'2026-10-21',return_:'2026-10-24',adult:2,quote:{days:[{dest:'원래 견적'}]},memo:'PRIVATE-MEMO',
        booking:{days:[{d:1,dest:'원래 확정 일정'}],contract:{signedAt:'2026-10-01',signImg:'PRIVATE-SIGNATURE',snapshot:{travelers:[{passportNo:'PRIVATE-SNAPSHOT'}]}},
            contractInfo:{totalAmount:1234567,depositStatus:'입금완료'},publishStatus:'published',checklist:{deposit:true},
            assign:{guide:{id:'q-guide',name:'견적 가이드',img:'/q-guide.jpg',desc:'보존 가이드 소개'},vehicle:{model:'기존 차량',plate:'PRIVATE-PLATE',img:'/q-car.jpg'},
                lodges:[{day:1,name:'견적 숙소',img:'/q-hotel.jpg',imgs:['/q-hotel.jpg'],tags:'샤워 가능',desc:'원래 설명',bookingStatus:'Баталгаажсан'}]}}};
    raw.prepare('INSERT INTO requests(id,received_at,name,status,data,token) VALUES(?,?,?,?,?,?)').run('same-id','2026-10-01','견적 고객','예약확정',JSON.stringify(rec),'PRIVATE-TOKEN-FIXTURE');
    raw.prepare('INSERT INTO requests(id,status,data) VALUES(?,?,?)').run('just-inquiry','신규','{"name":"문의 고객"}');
    const app=new Hono();app.route('/assignments',assignments);app.route('/reservations',reservations);app.route('/documents',documents);
    const request=(path,{role='admin',method='GET',body,headers={}}={})=>app.request(path,{method,headers:{...(role?{cookie:`auth_session=session-${role}`} :{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})},{DB,ENVIRONMENT:'production',ADMIN_TOKEN:'legacy-only'});
    const list=async()=> (await (await request('/assignments')).json()).items;
    return {raw,DB,request,list,setBeforeRun(fn){beforeRun=fn;}};
}

test('관리자 세션 전용 배정 목록은 같은 ID의 두 원본을 분리하고 고객 토큰·서명·내부 메모를 노출하지 않는다',async t=>{
    const f=await fixture(t);const response=await f.request('/assignments');assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
    const text=await response.text(),data=JSON.parse(text);assert.equal(data.items.length,2);assert.deepEqual(new Set(data.items.map(i=>i.key)),new Set(['product:same-id','quote_booking:same-id']));
    assert.ok(!/PRIVATE-(TOKEN|SIGNATURE|PASSPORT|SNAPSHOT|NOTE|RECEIPT|MEMO|DAY|PLATE)/.test(text));assert.deepEqual(data.warnings,[]);
    for(const [role,status] of [[null,401],['member',403]]) {
        assert.equal((await f.request('/assignments',{role})).status,status);
        assert.equal((await f.request('/assignments/quote_booking/same-id',{role,method:'PATCH',body:{}})).status,status);
    }
    assert.equal((await f.request('/assignments',{role:null,headers:{'x-admin-token':'legacy-only'}})).status,401);
});

test('숙소 보드 예약일은 상품 접수 시각과 견적 확정·준비·접수 정본을 읽으며 조회가 원본을 수정하지 않는다',async t=>{
    const f=await fixture(t);
    let rows=await f.list();assert.equal(rows.find(row=>row.source==='product').createdAt,'2026-09-30T03:00:00Z');
    assert.equal(rows.find(row=>row.source==='quote_booking').createdAt,'2026-10-01','JSON에 접수일이 없는 옛 견적은 requests.received_at을 읽는다');
    const rec=JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data);
    rec.receivedAt='2026-09-29T01:00:00Z';
    for(const [confirmedAt,preparedAt,receivedAt,expected] of [
        ['2026-10-06T02:00:00Z','2026-10-05T02:00:00Z','2026-10-01','2026-10-06T02:00:00Z'],
        ['','2026-10-05T02:00:00Z','2026-10-01','2026-10-05T02:00:00Z'],
        ['','','2026-10-01','2026-10-01'],
        ['','',null,'2026-09-29T01:00:00Z'],
    ]) {
        rec.booking.confirmedAt=confirmedAt;rec.booking.preparedAt=preparedAt;
        f.raw.prepare('UPDATE requests SET data=?,received_at=? WHERE id=?').run(JSON.stringify(rec),receivedAt,'same-id');
        const before=f.raw.prepare('SELECT * FROM requests WHERE id=?').get('same-id');
        rows=await f.list();assert.equal(rows.find(row=>row.source==='quote_booking').createdAt,expected);
        assert.deepEqual(f.raw.prepare('SELECT * FROM requests WHERE id=?').get('same-id'),before);
    }
    delete rec.receivedAt;f.raw.prepare('UPDATE requests SET data=?,received_at=NULL WHERE id=?').run(JSON.stringify(rec),'same-id');
    assert.equal((await f.list()).find(row=>row.source==='quote_booking').createdAt,'','저장 시각이 없으면 현재 시각을 만들어 넣지 않는다');
});

test('숙소 보드의 상품·견적 항공과 여행자 별칭은 관리자 조회용 정규 필드로 읽고 여권·추가 메타데이터는 제외한다',async t=>{
    const f=await fixture(t);
    const product=JSON.parse(f.raw.prepare('SELECT contract_data FROM reservations WHERE id=?').get('same-id').contract_data);
    Object.assign(product,{arrival:{date:'2026-10-20',time:'09:30',flight:'LOCAL101',privateNote:'PRIVATE-FLIGHT'},departure:{date:'2026-10-22',time:'18:10',flight:'LOCAL102'},
        travelers:[{name:'상품 여행자',passportName:'PRODUCT NAME',birthdate:'1991-02-03',gender:'여성',phone:'LOCAL-PRODUCT-PHONE',passportNo:'PRIVATE-PASSPORT'},
            {nameKo:'상품 옛 여행자',passportName:'LEGACY NAME',birth:'1988.03.04',gender:'男性',phone:'LOCAL-LEGACY-PHONE',email:'PRIVATE-EMAIL'}]});
    f.raw.prepare('UPDATE reservations SET contract_data=? WHERE id=?').run(JSON.stringify(product),'same-id');
    const quote=JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data);
    quote.booking.travelers=[{nameKo:'견적 여행자',passportName:'QUOTE NAME',birth:'1987.04.05',gender:'남',phone:'LOCAL-QUOTE-PHONE',passportNo:'PRIVATE-QUOTE-PASSPORT',type:'성인'}];
    quote.booking.flight={inDate:'2026-10-21',inDepTime:'07:00',inTime:'10:20',inNo:'LOCAL201',outDate:'2026-10-24',outTime:'17:40',outArrTime:'21:30',outNo:'LOCAL202',privateNote:'PRIVATE-QUOTE-FLIGHT'};
    f.raw.prepare('UPDATE requests SET data=? WHERE id=?').run(JSON.stringify(quote),'same-id');
    const originalProduct=f.raw.prepare('SELECT contract_data FROM reservations WHERE id=?').get('same-id').contract_data;
    const originalQuote=f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data;
    const rows=await f.list(),p=rows.find(row=>row.source==='product').contractData,q=rows.find(row=>row.source==='quote_booking').contractData;
    assert.deepEqual(p.travelers,[{name:'상품 여행자',passportName:'PRODUCT NAME',birthdate:'1991-02-03',gender:'여성',phone:'LOCAL-PRODUCT-PHONE'},
        {name:'상품 옛 여행자',passportName:'LEGACY NAME',birthdate:'1988.03.04',gender:'男性',phone:'LOCAL-LEGACY-PHONE'}]);
    assert.deepEqual(q.travelers,[{name:'견적 여행자',passportName:'QUOTE NAME',birthdate:'1987.04.05',gender:'남',phone:'LOCAL-QUOTE-PHONE'}]);
    assert.deepEqual(p.arrival,{date:'2026-10-20',time:'09:30',flight:'LOCAL101'});assert.deepEqual(p.departure,{date:'2026-10-22',time:'18:10',flight:'LOCAL102'});
    assert.deepEqual(q.arrival,{date:'2026-10-21',time:'10:20',flight:'LOCAL201'});assert.deepEqual(q.departure,{date:'2026-10-24',time:'17:40',flight:'LOCAL202'});
    assert.ok(!JSON.stringify([p.travelers,q.travelers,p.arrival,q.arrival]).includes('PRIVATE-'));
    assert.equal(f.raw.prepare('SELECT contract_data FROM reservations WHERE id=?').get('same-id').contract_data,originalProduct);
    assert.equal(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data,originalQuote);
});

test('견적 배정 PATCH는 requests의 배정만 바꾸고 계약·서명·일정·금액·상태·기존 메타데이터를 보존한다',async t=>{
    const f=await fixture(t),item=(await f.list()).find(i=>i.source==='quote_booking');
    const before=f.raw.prepare('SELECT * FROM requests WHERE id=?').get('same-id'),original=JSON.parse(before.data);
    item.assignment.guide.name='새 가이드';item.assignment.vehicle.type='새 차량';item.assignment.vehicle.phone='PRIVATE-QUOTE-DRIVER';item.assignment.accommodations[0].accommodation.roomCount=2;
    const response=await f.request('/assignments/quote_booking/same-id',{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});assert.equal(response.status,200);
    const after=f.raw.prepare('SELECT * FROM requests WHERE id=?').get('same-id'),updated=JSON.parse(after.data);
    const immutable=rec=>({...rec,booking:{...rec.booking,assign:undefined}});assert.deepEqual(immutable(updated),immutable(original));
    assert.deepEqual({...after,data:undefined},{...before,data:undefined});
    assert.equal(updated.booking.assign.guide.name,'새 가이드');assert.equal(updated.booking.assign.guide.img,'/q-guide.jpg');
    assert.equal(updated.booking.assign.vehicle.model,'새 차량');assert.equal(updated.booking.assign.vehicle.plate,'PRIVATE-PLATE');
    assert.equal(updated.booking.assign.lodges[0].roomCount,2);assert.equal(updated.booking.assign.lodges[0].tags,'샤워 가능');assert.deepEqual(updated.booking.assign.lodges[0].imgs,['/q-hotel.jpg']);
    assert.equal(f.raw.prepare('SELECT product_name FROM reservations WHERE id=?').get('same-id').product_name,'상품');
    const publicQuote=await getPublicQuote({request:new Request('https://fixture.invalid/api/my/PRIVATE-TOKEN-FIXTURE',{headers:{cookie:'auth_session=session-admin'}}),env:{DB:f.DB},params:{token:'PRIVATE-TOKEN-FIXTURE'}});assert.equal(publicQuote.status,200);
    assert.ok(!(await publicQuote.text()).includes('PRIVATE-QUOTE-DRIVER'));
});

test('견적 버전 충돌과 저장 직전 동시 서명 갱신은 409이며 새 계약 데이터를 덮어쓰지 않는다',async t=>{
    const f=await fixture(t);let item=(await f.list()).find(i=>i.source==='quote_booking');
    const change=()=>{const rec=JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data);rec.booking.contract.signedAt='2026-10-19T12:00:00Z';f.raw.prepare('UPDATE requests SET data=? WHERE id=?').run(JSON.stringify(rec),'same-id');};
    change();let response=await f.request('/assignments/quote_booking/same-id',{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});assert.equal(response.status,409);
    item=(await f.list()).find(i=>i.source==='quote_booking');let injected=false;
    f.setBeforeRun(sql=>{if(!injected && /^UPDATE requests SET data=\?/i.test(sql)){injected=true;change();const rec=JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data);rec.booking.contract.signedAt='concurrent-signature';f.raw.prepare('UPDATE requests SET data=? WHERE id=?').run(JSON.stringify(rec),'same-id');}});
    response=await f.request('/assignments/quote_booking/same-id',{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});assert.equal(response.status,409);
    assert.equal(JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data).booking.contract.signedAt,'concurrent-signature');
});

test('배정 API는 임의 계약·상태 주입 및 잘못된 일자·객실을 거절하며 원본을 변경하지 않는다',async t=>{
    const f=await fixture(t),item=(await f.list()).find(i=>i.source==='quote_booking');const before=f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data;
    const bodies=[{expectedVersion:item.version,assignment:item.assignment,status:'예약취소'},
        {expectedVersion:item.version,assignment:{...item.assignment,contract:{signedAt:'forged'}}},
        {expectedVersion:item.version,assignment:{...item.assignment,accommodations:[{day:1,date:'2026-99-99',accommodation:{}}]}},
        {expectedVersion:item.version,assignment:{...item.assignment,accommodations:[{day:1,accommodation:{roomCount:-1}}]}},
        {expectedVersion:item.version,assignment:{...item.assignment,accommodations:[{day:1,accommodation:{}},{day:1,accommodation:{}}]}}];
    for(const body of bodies)assert.equal((await f.request('/assignments/quote_booking/same-id',{method:'PATCH',body})).status,400);
    assert.equal(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data,before);
});

test('상품 날짜 변경과 UPDATE 직전 변경도 배정 버전 충돌로 보호한다',async t=>{
    const f=await fixture(t);let item=(await f.list()).find(i=>i.source==='product');
    f.raw.prepare('UPDATE reservations SET end_date=? WHERE id=?').run('2026-10-25','same-id');
    let response=await f.request('/assignments/product/same-id',{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});assert.equal(response.status,409);
    item=(await f.list()).find(i=>i.source==='product');let injected=false;
    f.setBeforeRun(sql=>{if(!injected && /^UPDATE reservations SET assigned_guide=/i.test(sql)){injected=true;f.raw.prepare('UPDATE reservations SET end_date=? WHERE id=?').run('2026-10-26','same-id');}});
    response=await f.request('/assignments/product/same-id',{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});assert.equal(response.status,409);
    assert.equal(f.raw.prepare('SELECT end_date FROM reservations WHERE id=?').get('same-id').end_date,'2026-10-26');
});

test('숙소를 명시적으로 빈 배열로 해제해도 일정·계약은 보존하고 다음 조회에서 빈 선택을 유지한다',async t=>{
    const f=await fixture(t);for(const source of ['product','quote_booking']) {
        const item=(await f.list()).find(i=>i.source===source);item.assignment.accommodations=[];
        assert.equal((await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}})).status,200);
        const fresh=(await f.list()).find(i=>i.source===source);assert.deepEqual(fresh.assignment.accommodations,[]);assert.equal(fresh.accommodationsInitialized,true);
    }
    const rec=JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data);assert.deepEqual(rec.booking.days,[{d:1,dest:'원래 확정 일정'}]);assert.equal(rec.booking.contract.signImg,'PRIVATE-SIGNATURE');
});

function seedLodgingRequests(f,source,rows) {
    if(source==='product') f.raw.prepare('UPDATE reservations SET daily_accommodations=? WHERE id=?').run(JSON.stringify(rows),'same-id');
    else {
        const rec=JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data);
        rec.booking.assign.lodges=rows.map(({day,date,accommodation:acc})=>({ ...acc, day, ...(date===undefined?{}:{date}),
            grade:acc.type,region:acc.location,imgs:acc.images,desc:acc.description,roomType:acc.occupancy }));
        f.raw.prepare('UPDATE requests SET data=? WHERE id=?').run(JSON.stringify(rec),'same-id');
    }
}
function storedLodgingRows(f,source) {
    return source==='product'?JSON.parse(f.raw.prepare('SELECT daily_accommodations FROM reservations WHERE id=?').get('same-id').daily_accommodations)
        :JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data).booking.assign.lodges;
}
function replaceStoredLodgingRows(f,source,rows) {
    if(source==='product') f.raw.prepare('UPDATE reservations SET daily_accommodations=? WHERE id=?').run(JSON.stringify(rows),'same-id');
    else {
        const rec=JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data);
        rec.booking.assign.lodges=rows;f.raw.prepare('UPDATE requests SET data=? WHERE id=?').run(JSON.stringify(rec),'same-id');
    }
}
const lodgingAcc=(source,row)=>source==='product'?row.accommodation:row;
const withoutLodgingReferences=assignment=>{for(const row of assignment.accommodations){delete row.sourceIndex;delete row.sourceKey;}return assignment;};
const memoryDraftStore=()=>{const map=new Map();return{getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};};

test('숙박 행 원본 참조는 박 번호 교정·정렬·초안 복원 후에도 상품·견적 업체 증빙을 같은 행에 보존한다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) for(const scenario of ['single','swap']) for(const legacy of [false,true]) {
        const start=source==='product'?'2026-10-20':'2026-10-21',second=source==='product'?'2026-10-21':'2026-10-22';
        const a={day:1,date:second,accommodation:{id:'hotel-a',name:'호텔 A',roomCount:2,bookingStatus:'Баталгаажсан',privateEvidence:'PRIVATE-A'}};
        const b={day:2,date:start,accommodation:{id:'hotel-b',name:'호텔 B',roomCount:3,bookingStatus:'Баталгаажсан',privateEvidence:'PRIVATE-B'}};
        seedLodgingRequests(f,source,scenario==='single'?[a]:[a,b]);
        const item=(await f.list()).find(row=>row.source===source);
        for(const [index,row] of item.assignment.accommodations.entries()){assert.equal(row.sourceIndex,index);assert.match(row.sourceKey,/^[a-f0-9]{64}$/);}
        item.assignment.accommodations[0].day=2;
        if(scenario==='swap') {item.assignment.accommodations[1].day=1;item.assignment.accommodations.reverse();}
        if(legacy) withoutLodgingReferences(item.assignment);
        const scope={userId:'admin',source,id:'same-id'},storage=memoryDraftStore();
        const local=writeAssignmentDraft(storage,scope,item.version,item.assignment);assert.equal(local.ok,true);
        const restored=readAssignmentDraft(storage,scope,item.version).draft.assignment;
        assert.deepEqual(restored.accommodations.map(row=>[row.sourceIndex,row.sourceKey]),item.assignment.accommodations.map(row=>[row.sourceIndex,row.sourceKey]));
        const response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:restored}});
        assert.equal(response.status,200,`${source}: ${scenario}, legacy=${legacy}`);
        const saved=storedLodgingRows(f,source).map(row=>({day:row.day,...lodgingAcc(source,row)}));
        assert.equal(saved.find(row=>row.id==='hotel-a').privateEvidence,'PRIVATE-A');
        if(scenario==='swap') assert.equal(saved.find(row=>row.id==='hotel-b').privateEvidence,'PRIVATE-B');
        assert.ok(saved.every(row=>row.bookingStatus==='Баталгаажсан'),'실제 숙박일이 같으면 번호 교정만으로 업체 확정을 바꾸지 않는다');
        assert.ok(!/sourceIndex|sourceKey/.test(JSON.stringify(storedLodgingRows(f,source))),'일시적 원본 참조는 DB에 기록하지 않는다');
    }
});

test('중복 공개 숙박행도 원본 참조로 삭제 후 남긴 증빙을 식별하고 실제 요청 변경의 확정만 초기화한다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) {
        const start=source==='product'?'2026-10-20':'2026-10-21';
        const first={day:1,date:start,accommodation:{id:'same-hotel',name:'같은 호텔',roomCount:2,occupancy:'2인실',bookingStatus:'Баталгаажсан',privateEvidence:'PRIVATE-FIRST'}};
        seedLodgingRequests(f,source,[first,{...first,accommodation:{...first.accommodation,privateEvidence:'PRIVATE-SECOND'}}]);
        const item=(await f.list()).find(row=>row.source===source);item.assignment.accommodations.shift();
        assert.equal(item.assignment.accommodations[0].sourceIndex,1);
        Object.assign(item.assignment.accommodations[0].accommodation,{id:'new-hotel',name:'바뀐 호텔',roomCount:3});
        const response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
        assert.equal(response.status,200);const fresh=(await response.json()).item;
        assert.equal(fresh.assignment.accommodations[0].sourceIndex,0,'저장 응답은 새 배열 기준의 참조를 다시 발급한다');
        const saved=lodgingAcc(source,storedLodgingRows(f,source)[0]);assert.equal(saved.privateEvidence,'PRIVATE-SECOND');assert.equal(saved.bookingStatus,'Илгээгээгүй');
        assert.ok(!/sourceIndex|sourceKey/.test(JSON.stringify(storedLodgingRows(f,source))));
    }
});

test('원본 참조가 있는 행의 박 번호를 교정하고 새 밤을 추가해도 새 행에 기존 증빙·숙소를 복제하지 않는다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) {
        const start=source==='product'?'2026-10-20':'2026-10-21',second=source==='product'?'2026-10-21':'2026-10-22';
        seedLodgingRequests(f,source,[{day:1,date:second,accommodation:{id:'hotel-a',name:'호텔 A',bookingStatus:'Баталгаажсан',privateEvidence:'PRIVATE-A'}}]);
        const item=(await f.list()).find(row=>row.source===source);item.assignment.accommodations[0].day=2;
        item.assignment.accommodations.unshift({day:1,date:start,accommodation:{}});
        const response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
        assert.equal(response.status,200);const saved=storedLodgingRows(f,source);
        assert.ok(!lodgingAcc(source,saved[0]).name);assert.equal(lodgingAcc(source,saved[0]).privateEvidence,undefined);
        assert.equal(lodgingAcc(source,saved[1]).privateEvidence,'PRIVATE-A');assert.equal(lodgingAcc(source,saved[1]).bookingStatus,'Баталгаажсан');
    }
});

test('충돌 초안의 원본 참조는 서버 순서 변경만 재연결하고 업체 증빙 변경이나 범위 밖 참조는 원본과 초안을 유지한다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) for(const change of ['order','evidence','removed']) {
        const start=source==='product'?'2026-10-20':'2026-10-21',second=source==='product'?'2026-10-21':'2026-10-22';
        seedLodgingRequests(f,source,[{day:1,date:start,accommodation:{id:'hotel-a',name:'호텔 A',roomCount:2,bookingStatus:'Баталгаажсан',privateEvidence:'PRIVATE-A'}},
            {day:2,date:second,accommodation:{id:'hotel-b',name:'호텔 B',roomCount:3,bookingStatus:'Баталгаажсан',privateEvidence:'PRIVATE-B'}}]);
        const item=(await f.list()).find(row=>row.source===source);item.assignment.accommodations[0].accommodation.roomCount=4;
        const scope={userId:'admin',source,id:'same-id'},storage=memoryDraftStore();writeAssignmentDraft(storage,scope,item.version,item.assignment);
        const changed=storedLodgingRows(f,source);
        if(change==='order') changed.reverse();
        else if(change==='evidence') lodgingAcc(source,changed[0]).privateEvidence='PRIVATE-NEW-SERVER-EVIDENCE';
        else changed.pop();
        replaceStoredLodgingRows(f,source,changed);
        const fresh=(await f.list()).find(row=>row.source===source),recovery=readAssignmentDraft(storage,scope,fresh.version),table=source==='product'?'reservations':'requests';
        assert.equal(recovery.conflict,true);const before=f.raw.prepare(`SELECT * FROM ${table} WHERE id=?`).get('same-id');
        const response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:fresh.version,assignment:recovery.draft.assignment}});
        if(change==='order') {
            assert.equal(response.status,200);const saved=storedLodgingRows(f,source).map(row=>lodgingAcc(source,row));
            assert.equal(saved.find(row=>row.id==='hotel-a').privateEvidence,'PRIVATE-A');assert.equal(saved.find(row=>row.id==='hotel-a').roomCount,4);
            assert.equal(saved.find(row=>row.id==='hotel-a').bookingStatus,'Илгээгээгүй');assert.equal(saved.find(row=>row.id==='hotel-b').privateEvidence,'PRIVATE-B');
        } else {
            assert.equal(response.status,change==='removed'?400:409);assert.match((await response.json()).error,/새로고침.*초안.*원본.*비교/);
            assert.deepEqual(f.raw.prepare(`SELECT * FROM ${table} WHERE id=?`).get('same-id'),before);
        }
        assert.deepEqual(readAssignmentDraft(storage,scope,item.version).draft.assignment,recovery.draft.assignment,'서버 저장·거절은 브라우저 초안 원본을 삭제하지 않는다');
    }
});

test('원본 참조의 누락·위조·중복은 상품·견적 저장 전에 거절하며 같은 업체 원본을 두 번 소비하지 않는다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) {
        const start=source==='product'?'2026-10-20':'2026-10-21',second=source==='product'?'2026-10-21':'2026-10-22';
        seedLodgingRequests(f,source,[{day:1,date:start,accommodation:{id:'a',name:'A',privateEvidence:'PRIVATE-A'}},{day:2,date:second,accommodation:{id:'b',name:'B',privateEvidence:'PRIVATE-B'}}]);
        const item=(await f.list()).find(row=>row.source===source),table=source==='product'?'reservations':'requests',before=f.raw.prepare(`SELECT * FROM ${table} WHERE id=?`).get('same-id');
        const variants=[
            [400,a=>{delete a.accommodations[0].sourceKey;}],
            [400,a=>{delete a.accommodations[0].sourceIndex;}],
            ...[-1,1.5,'0',null].map(value=>[400,a=>{a.accommodations[0].sourceIndex=value;}]),
            [400,a=>{a.accommodations[0].sourceIndex=10000;}],
            [400,a=>{a.accommodations[0].sourceKey='not-a-fingerprint';}],
            [400,a=>{a.accommodations[1].sourceIndex=a.accommodations[0].sourceIndex;}],
            [409,a=>{a.accommodations[0].sourceKey='0'.repeat(64);}],
            [409,a=>{a.accommodations[1].sourceKey=a.accommodations[0].sourceKey;}],
        ];
        for(const [status,mutate] of variants) {
            const assignment=structuredClone(item.assignment);mutate(assignment);
            const response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment}});
            assert.equal(response.status,status);assert.deepEqual(f.raw.prepare(`SELECT * FROM ${table} WHERE id=?`).get('same-id'),before);
        }
    }
});

test('중복 박 번호 정리 시 상품·견적의 실제 id·이름·숙박일로 원본 행을 식별해 해당 업체 증빙만 보존한다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) for(const identity of ['id','name','date']) {
        const start=source==='product'?'2026-10-20':'2026-10-21',nextDate=source==='product'?'2026-10-21':'2026-10-22';
        const first={day:1,date:start,accommodation:{id:identity==='id'?'hotel-first':'hotel-same',name:identity==='name'?'첫 숙소':'동일 이름 숙소',
            roomCount:2,occupancy:'2인실',bookingStatus:'Баталгаажсан',privateEvidence:{reference:'PRIVATE-FIRST-SUPPLIER'}}};
        const second={day:1,date:identity==='date'?nextDate:start,accommodation:{...first.accommodation,
            id:identity==='id'?'hotel-second':first.accommodation.id,name:identity==='name'?'둘째 숙소':first.accommodation.name,
            privateEvidence:{reference:'PRIVATE-SECOND-SUPPLIER'}}};
        const other={day:2,date:nextDate,accommodation:{id:'hotel-other',name:'다른 밤 숙소',bookingStatus:'Илгээгээгүй',privateEvidence:{reference:'PRIVATE-OTHER-NIGHT'}}};
        seedLodgingRequests(f,source,[first,second,other]);
        const item=(await f.list()).find(row=>row.source===source);withoutLodgingReferences(item.assignment);item.assignment.accommodations.shift();
        const response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
        assert.equal(response.status,200,`${source}: ${identity}`);
        const saved=source==='product'?JSON.parse(f.raw.prepare('SELECT daily_accommodations FROM reservations WHERE id=?').get('same-id').daily_accommodations)
            :JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data).booking.assign.lodges;
        const acc=row=>source==='product'?row.accommodation:row;
        assert.equal(saved.length,2);assert.equal(acc(saved[0]).privateEvidence.reference,'PRIVATE-SECOND-SUPPLIER',`${source}: ${identity}`);
        assert.equal(acc(saved[1]).privateEvidence.reference,'PRIVATE-OTHER-NIGHT');assert.ok(!JSON.stringify(saved).includes('PRIVATE-FIRST-SUPPLIER'));
    }
});

test('구분할 수 없는 중복 숙박일의 서로 다른 업체 증빙은 상품·견적 저장을 거절하고 모든 원본을 유지한다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) {
        const first={day:1,date:source==='product'?'2026-10-20':'2026-10-21',accommodation:{id:'hotel-same',name:'동일 숙소',roomCount:2,occupancy:'2인실',
            bookingStatus:'Баталгаажсан',privateEvidence:{reference:'PRIVATE-FIRST-SUPPLIER'}}};
        const second={...first,accommodation:{...first.accommodation,privateEvidence:{reference:'PRIVATE-SECOND-SUPPLIER'}}};
        seedLodgingRequests(f,source,[first,second]);
        const item=(await f.list()).find(row=>row.source===source),table=source==='product'?'reservations':'requests';
        withoutLodgingReferences(item.assignment);
        const before=f.raw.prepare(`SELECT * FROM ${table} WHERE id=?`).get('same-id');
        item.assignment.accommodations.shift();item.assignment.guide.name='저장되면 안 되는 가이드';item.assignment.vehicle.type='저장되면 안 되는 차량';
        const response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
        assert.equal(response.status,409);assert.match((await response.json()).error,/예약 상세.*중복 숙박일.*수배 증빙/);
        assert.deepEqual(f.raw.prepare(`SELECT * FROM ${table} WHERE id=?`).get('same-id'),before,'애매한 행의 증빙뿐 아니라 가이드·차량·서명도 수정하지 않는다');
    }
});

test('중복 숙박일의 객실·인실 수정으로 다른 원본 증빙을 선택하거나 숙소 identity를 함께 바꾸지 않는다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) for(const change of ['rooms','identity']) {
        const start=source==='product'?'2026-10-20':'2026-10-21';
        const first={day:1,date:start,accommodation:{id:'hotel-same',name:'동일 숙소',roomCount:2,occupancy:'2인실',bookingStatus:'Баталгаажсан',
            privateEvidence:{reference:'PRIVATE-FIRST-SUPPLIER'}}};
        const second={...first,accommodation:{...first.accommodation,roomCount:3,occupancy:'3인실',privateEvidence:{reference:'PRIVATE-SECOND-SUPPLIER'}}};
        seedLodgingRequests(f,source,[first,second]);
        const item=(await f.list()).find(row=>row.source===source),table=source==='product'?'reservations':'requests';
        withoutLodgingReferences(item.assignment);
        const before=f.raw.prepare(`SELECT * FROM ${table} WHERE id=?`).get('same-id');
        item.assignment.accommodations.splice(1,1);
        if(change==='rooms') Object.assign(item.assignment.accommodations[0].accommodation,{roomCount:3,occupancy:'3인실'});
        else {
            Object.assign(item.assignment.accommodations[0].accommodation,{id:'hotel-new',name:'전혀 다른 숙소'});
            item.assignment.accommodations[0].date='2026-10-23';
        }
        const response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
        assert.equal(response.status,409,`${source}: ${change}`);assert.match((await response.json()).error,/예약 상세.*중복 숙박일/);
        assert.deepEqual(f.raw.prepare(`SELECT * FROM ${table} WHERE id=?`).get('same-id'),before,'불명확한 증빙의 원본과 모든 다른 예약 필드는 그대로 둔다');
    }
});

test('업체 증빙을 포함한 내용이 완전히 같은 중복 숙박일은 하나를 남겨 안전하게 정리한다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) {
        const row={day:1,date:source==='product'?'2026-10-20':'2026-10-21',accommodation:{id:'hotel-same',name:'같은 숙소',bookingStatus:'Баталгаажсан',privateEvidence:{reference:'PRIVATE-SAME-SUPPLIER'}}};
        seedLodgingRequests(f,source,[row,structuredClone(row)]);
        const item=(await f.list()).find(record=>record.source===source);withoutLodgingReferences(item.assignment);item.assignment.accommodations.shift();
        assert.equal((await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}})).status,200);
        const stored=source==='product'?JSON.parse(f.raw.prepare('SELECT daily_accommodations FROM reservations WHERE id=?').get('same-id').daily_accommodations)
            :JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data).booking.assign.lodges;
        assert.equal(stored.length,1);assert.equal((source==='product'?stored[0].accommodation:stored[0]).privateEvidence.reference,'PRIVATE-SAME-SUPPLIER');
    }
});

test('상품·견적 숙소의 호텔·객실 수·인실·실제 숙박일 변경은 이전 업체 전달·응답·확정을 재사용하지 않는다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) for(const status of ['Имэйл илгээсэн','Хариу ирсэн','Баталгаажсан']) for(const field of ['id','name','roomCount','occupancy','date']) {
        const start=source==='product'?'2026-10-20':'2026-10-21';
        seedLodgingRequests(f,source,[
            {day:1,date:start,accommodation:{id:'lodge-a',name:'확정된 숙소',roomCount:2,occupancy:'2인실',bookingStatus:status,description:'업체 원본 설명',privateEvidence:'PRIVATE-LODGE-EVIDENCE'}},
            {day:2,date:source==='product'?'2026-10-21':'2026-10-22',accommodation:{id:'lodge-b',name:'둘째 날 숙소',roomCount:1,occupancy:'3인실',bookingStatus:'Баталгаажсан',privateEvidence:'PRIVATE-OTHER-NIGHT'}},
        ]);
        const item=(await f.list()).find(row=>row.source===source),first=item.assignment.accommodations[0];
        if(field==='date') first.date='2026-10-25';
        else first.accommodation[field]={id:'lodge-c',name:'변경 숙소',roomCount:3,occupancy:'4인실'}[field];
        const response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
        assert.equal(response.status,200,`${source}: ${status}, ${field}`);
        const saved=(await response.json()).item;
        assert.equal(saved.assignment.accommodations[0].accommodation.bookingStatus,'Илгээгээгүй',`${source}: ${status}, ${field}`);
        assert.equal(saved.assignment.accommodations[1].accommodation.bookingStatus,'Баталгаажсан');
        assert.equal(saved.assignment.accommodations.length,2,'예약 기간보다 적은 저장 행을 임의로 추가하지 않는다');
        if(source==='product') {
            const row=f.raw.prepare('SELECT daily_accommodations,contract_data,assigned_guide,history FROM reservations WHERE id=?').get('same-id');
            const days=JSON.parse(row.daily_accommodations);assert.equal(days[0].accommodation.privateEvidence,'PRIVATE-LODGE-EVIDENCE');assert.equal(days[1].accommodation.privateEvidence,'PRIVATE-OTHER-NIGHT');
            assert.equal(JSON.parse(row.contract_data).agreement.name,'서명자');assert.equal(JSON.parse(row.assigned_guide).image,'/guide.jpg');assert.equal(row.history,'[{"type":"created"}]');
        } else {
            const rec=JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data);
            assert.equal(rec.booking.assign.lodges[0].privateEvidence,'PRIVATE-LODGE-EVIDENCE');assert.equal(rec.booking.assign.lodges[1].privateEvidence,'PRIVATE-OTHER-NIGHT');
            assert.equal(rec.booking.contract.signImg,'PRIVATE-SIGNATURE');assert.deepEqual(rec.booking.days,[{d:1,dest:'원래 확정 일정'}]);assert.equal(rec.booking.contractInfo.totalAmount,1234567);
        }
    }
});

test('동일 숙소 요청의 수동 확정·소개 수정과 같은 실제 날짜 입력은 상태를 보존하고 객실 수 미입력과 0은 구분한다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) {
        const start=source==='product'?'2026-10-20':'2026-10-21';
        for(const storedCount of [undefined,null,'']) {
            seedLodgingRequests(f,source,[{day:1,accommodation:{id:'lodge-a',name:'같은 숙소',roomCount:storedCount,occupancy:'2인실',bookingStatus:'Баталгаажсан'}}]);
            let item=(await f.list()).find(row=>row.source===source);
            delete item.assignment.accommodations[0].accommodation.roomCount;
            Object.assign(item.assignment.accommodations[0],{date:start});
            Object.assign(item.assignment.accommodations[0].accommodation,{description:'호텔 소개만 수정',images:['/new-photo.jpg']});
            let response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
            assert.equal(response.status,200);assert.equal((await response.json()).item.assignment.accommodations[0].accommodation.bookingStatus,'Баталгаажсан');
            item=(await f.list()).find(row=>row.source===source);item.assignment.accommodations[0].accommodation.roomCount=0;
            response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
            assert.equal(response.status,200);assert.equal((await response.json()).item.assignment.accommodations[0].accommodation.bookingStatus,'Илгээгээгүй','누락된 방 수를 명시적 0으로 바꾸면 재확인이 필요하다');
            item=(await f.list()).find(row=>row.source===source);item.assignment.accommodations[0].accommodation.bookingStatus='Баталгаажсан';
            response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
            assert.equal(response.status,200);assert.equal((await response.json()).item.assignment.accommodations[0].accommodation.bookingStatus,'Баталгаажсан','요청이 동일하면 별도의 수동 업체 확정을 허용한다');
        }
    }
});

test('상품·견적의 명시적 객실 수·인실 지우기는 업체 확정을 초기화하고 생략된 필드는 이전 요청을 보존한다',async t=>{
    const f=await fixture(t);
    for(const source of ['product','quote_booking']) for(const field of ['roomCount','occupancy']) {
        seedLodgingRequests(f,source,[{day:1,accommodation:{id:'lodge-a',name:'같은 숙소',roomCount:2,occupancy:'2인실',bookingStatus:'Баталгаажсан'}}]);
        let item=(await f.list()).find(row=>row.source===source);delete item.assignment.accommodations[0].accommodation[field];
        let response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
        assert.equal(response.status,200);let saved=(await response.json()).item.assignment.accommodations[0].accommodation;
        assert.equal(saved.bookingStatus,'Баталгаажсан');assert.equal(saved[field],field==='roomCount'?2:'2인실','이전 클라이언트가 필드를 생략해도 기존 요청은 유지한다');
        item=(await f.list()).find(row=>row.source===source);item.assignment.accommodations[0].accommodation[field]=field==='roomCount'?null:'';
        response=await f.request(`/assignments/${source}/same-id`,{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});
        assert.equal(response.status,200);saved=(await response.json()).item.assignment.accommodations[0].accommodation;
        assert.equal(saved.bookingStatus,'Илгээгээгүй');assert.equal(saved[field],field==='roomCount'?(source==='product'?null:undefined):'');
    }
});

test('손상된 견적 한 건과 일부 소스 조회 실패는 나머지 배정을 숨기거나 원본을 수정하지 않는다',async t=>{
    const f=await fixture(t);f.raw.prepare('INSERT INTO requests(id,status,data) VALUES(?,?,?)').run('broken','예약확정','{');
    let response=await f.request('/assignments');let data=await response.json();assert.equal(data.items.length,2);assert.equal(data.warnings.length,1);assert.equal(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('broken').data,'{');
    f.raw.exec('DROP TABLE requests');response=await f.request('/assignments');data=await response.json();assert.equal(response.status,200);assert.equal(data.items.length,1);
    assert.deepEqual(data.availability,{product:true,quote_booking:false});assert.match(data.warnings[0],/견적/);
});

test('상품 차량은 운영 정보와 계약 vehicle을 한 번에 저장하고 명시적 빈 해제와 공개 PDF의 비공개 경계를 지킨다',async t=>{
    const f=await fixture(t),item=(await f.list()).find(i=>i.source==='product');item.assignment.vehicle={type:'신규 차량',phone:'PRIVATE-NEW-DRIVER'};
    let response=await f.request('/assignments/product/same-id',{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}});assert.equal(response.status,200);
    let raw=f.raw.prepare('SELECT * FROM reservations WHERE id=?').get('same-id'),ops=JSON.parse(raw.admin_operations),contract=JSON.parse(raw.contract_data);
    assert.equal(ops.vehicle,'신규 차량');assert.equal(ops.driverPhone,contract.vehicle.phone);assert.equal(contract.vehicle.type,'신규 차량');assert.equal(contract.extra,'보존');assert.equal(ops.opsNote,'PRIVATE-NOTE');
    for(const visible of [false,true]){
        const quote=buildProductQuote({reservation:raw,days:[],assignmentsVisible:visible,brand:{}});
        assert.equal(quote.vehicle,visible?'신규 차량':'차량 배정 확인 중');assert.ok(!JSON.stringify(quote).includes('PRIVATE-NEW-DRIVER'));assert.ok(!JSON.stringify(quote).includes('PRIVATE-NOTE'));
    }
    const member=await f.request('/reservations/same-id',{role:'member'});assert.equal(member.status,200);assert.ok(!(await member.text()).includes('PRIVATE-NEW-DRIVER'));
    response=await f.request('/reservations/same-id',{method:'PUT',body:{admin_operations:{vehicle:'',driverPhone:''}}});assert.equal(response.status,200);
    raw=f.raw.prepare('SELECT * FROM reservations WHERE id=?').get('same-id');assert.equal(JSON.parse(raw.contract_data).vehicle.type,'');assert.equal(JSON.parse(raw.admin_operations).vehicle,'');
    assert.equal(buildProductQuote({reservation:raw,days:[],assignmentsVisible:true,brand:{}}).vehicle,'차량 배정 확인 중');
});

test('legacy 차량 읽기와 부분 운영 저장은 값을 보존하고 상품 PUT CAS는 동시에 바뀐 계약을 보호한다',async t=>{
    const f=await fixture(t);assert.deepEqual(readProductVehicle({}, {vehicle:{model:'legacy',phone:'old'}}),{type:'legacy',phone:'old'});
    assert.deepEqual(readProductVehicle({vehicle:'',driverPhone:''},{vehicle:{type:'legacy',phone:'old'}}),{type:'',phone:''});
    let response=await f.request('/reservations/same-id',{method:'PUT',body:{admin_operations:{region:'고비'}}});assert.equal(response.status,200);
    let row=f.raw.prepare('SELECT * FROM reservations WHERE id=?').get('same-id');assert.equal(JSON.parse(row.admin_operations).vehicle,'기존 차');
    let injected=false;f.setBeforeRun(sql=>{if(!injected && /^update "reservations"/i.test(sql)){injected=true;f.raw.prepare('UPDATE reservations SET contract_data=? WHERE id=?').run('{"agreement":{"name":"concurrent"}}','same-id');}});
    response=await f.request('/reservations/same-id',{method:'PUT',body:{admin_operations:{vehicle:'충돌 차량'}}});assert.equal(response.status,409);
    assert.equal(JSON.parse(f.raw.prepare('SELECT contract_data FROM reservations WHERE id=?').get('same-id').contract_data).agreement.name,'concurrent');
});

test('실제 숙소 보드 저장 뒤 고객 계약서 GET은 차량 내부 연락처·임의 메모를 숨기고 관리자와 DB 원본은 보존한다',async t=>{
    const f=await fixture(t),item=(await f.list()).find(i=>i.source==='product');
    item.assignment.vehicle={type:'고객 공개 차량',phone:'PRIVATE-CONTRACT-DRIVER'};
    assert.equal((await f.request('/assignments/product/same-id',{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}})).status,200);
    const row=f.raw.prepare('SELECT contract_data FROM reservations WHERE id=?').get('same-id'),contract=JSON.parse(row.contract_data);
    Object.assign(contract.vehicle,{driverPhone:'PRIVATE-CONTRACT-ALIAS',plate:'PRIVATE-CONTRACT-PLATE',opsNote:'PRIVATE-CONTRACT-NOTE',internalDispatchSecret:'PRIVATE-CONTRACT-UNKNOWN',img:'/public-car.jpg',seats:'6인'});
    f.raw.prepare('UPDATE reservations SET contract_data=? WHERE id=?').run(JSON.stringify(contract),'same-id');
    const before=f.raw.prepare('SELECT contract_data,admin_operations FROM reservations WHERE id=?').get('same-id');
    for(const role of [null,'member','invalid']) {
        const response=await f.request('/documents/contract/same-id',{role,headers:{'x-admin-token':'legacy-only'}});
        assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
        const serialized=await response.text();assert.ok(!serialized.includes('PRIVATE-CONTRACT-'));
        const body=JSON.parse(serialized);assert.equal(body.contract.vehicle.type,'고객 공개 차량');assert.equal(body.contract.vehicle.img,'/public-car.jpg');assert.equal(body.contract.vehicle.seats,'6인');
        assert.deepEqual(body.contract.agreement,contract.agreement);assert.deepEqual(body.contract.travelers,contract.travelers);
    }
    const admin=await f.request('/documents/contract/same-id');assert.equal(admin.status,200);assert.deepEqual((await admin.json()).contract,contract);
    assert.deepEqual(f.raw.prepare('SELECT contract_data,admin_operations FROM reservations WHERE id=?').get('same-id'),before);
});

test('고객 계약 제출의 echo도 차량 연락처를 숨기며 고객 입력과 비공개 배정 원본은 각각 보존한다',async t=>{
    const f=await fixture(t),item=(await f.list()).find(i=>i.source==='product');item.assignment.vehicle.phone='PRIVATE-CONTRACT-POST-DRIVER';
    assert.equal((await f.request('/assignments/product/same-id',{method:'PATCH',body:{expectedVersion:item.version,assignment:item.assignment}})).status,200);
    const response=await f.request('/documents/contract/same-id/customer',{role:'member',method:'POST',body:{agreement:{agreed:true,name:'고객 동의',agreedAt:'2026-10-19T12:00:00Z'},
        arrival:{date:'2026-10-20',time:'09:30',flight:'FIXTURE101'},vehicle:{phone:'forged-by-customer'}}});
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
    const serialized=await response.text();assert.ok(!serialized.includes('PRIVATE-CONTRACT-POST-DRIVER'));assert.ok(!serialized.includes('forged-by-customer'));
    const body=JSON.parse(serialized);assert.equal(body.contract.agreement.name,'고객 동의');assert.equal(body.contract.arrival.flight,'FIXTURE101');
    const saved=JSON.parse(f.raw.prepare('SELECT contract_data FROM reservations WHERE id=?').get('same-id').contract_data);
    assert.equal(saved.vehicle.phone,'PRIVATE-CONTRACT-POST-DRIVER');assert.equal(saved.agreement.name,'고객 동의');assert.equal(saved.extra,'보존');
});

test('관리자 수동 상품 예약은 존재하는 상품만 연결하고 자유 입력 접수는 그대로 지원한다',async t=>{
    const f=await fixture(t);const body={productName:'테스트 수동 상품',customerName:'테스트 접수자',email:'fixture@example.invalid'};
    assert.equal((await f.request('/reservations',{method:'POST',body:{...body,id:'invalid-product-booking',productId:'not-found'}})).status,400);
    assert.equal((await f.request('/reservations',{method:'POST',body:{...body,id:'connected-booking',product_id:'real-product'}})).status,201);
    assert.equal(f.raw.prepare('SELECT product_id FROM reservations WHERE id=?').get('connected-booking').product_id,'real-product');
    assert.equal((await f.request('/reservations',{method:'POST',body:{...body,id:'free-booking'}})).status,201);
    assert.equal(f.raw.prepare('SELECT product_id FROM reservations WHERE id=?').get('free-booking').product_id,null);
});

test('배정 초안은 계정·종류·예약별로 복원하고 충돌·저장 실패·새 탭의 초안을 보존한다',()=>{
    const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
    const scope={userId:'admin-a',source:'product',id:'same-id'},assignment={guide:{name:'가이드'},vehicle:{type:'차량',phone:'내부 전화'},accommodations:[{day:1,accommodation:{name:'호텔',images:['data:image/png;base64,bytes','blob:temp','/safe.jpg']}}]};
    const first=writeAssignmentDraft(storage,scope,'base-1',assignment);assert.equal(first.ok,true);assert.deepEqual(readAssignmentDraft(storage,scope,'base-1').draft.assignment.accommodations[0].accommodation.images,['/safe.jpg']);
    assert.equal(readAssignmentDraft(storage,scope,'base-2').conflict,true);
    for(const s of [{...scope,userId:'admin-b'},{...scope,source:'quote_booking'},{...scope,id:'other'}]) assert.deepEqual(readAssignmentDraft(storage,s,'base-1'),{});
    const second=writeAssignmentDraft(storage,scope,'base-1',assignment);discardAssignmentDraft(storage,scope,first.revision);assert.equal(readAssignmentDraft(storage,scope,'base-1').draft.revision,second.revision);
    assert.equal(writeAssignmentDraft({...storage,setItem(){throw Error('quota');}},scope,'base',assignment).ok,false);assert.ok(map.has(assignmentDraftKey(scope)));
    discardAssignmentDraft(storage,scope,second.revision);assert.deepEqual(readAssignmentDraft(storage,scope,'base-1'),{});
});
