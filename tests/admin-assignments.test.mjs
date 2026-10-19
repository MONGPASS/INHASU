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
        raw.prepare('INSERT INTO users(id,email,name,role) VALUES(?,?,?,?)').run(id,`${id}@example.invalid`,id,role);
        raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run(`session-${id}`,id,Date.now()+86400000);
    }
    raw.prepare('INSERT INTO products(id,name) VALUES(?,?)').run('real-product','로컬 상품');
    const contract={agreement:{agreed:true,name:'서명자'},travelers:[{passportNo:'PRIVATE-PASSPORT'}],vehicle:{type:'기존 차',phone:'PRIVATE-DRIVER',img:'/car.jpg'},extra:'보존'};
    raw.prepare(`INSERT INTO reservations(id,customer_name,customer_email,product_name,start_date,end_date,status,deposit_status,contract_data,assigned_guide,daily_accommodations,admin_operations,history)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('same-id','상품 고객','member@example.invalid','상품','2026-10-20','2026-10-22','confirmed','paid',JSON.stringify(contract),
        JSON.stringify({id:'guide-old',name:'기존 가이드',image:'/guide.jpg'}),JSON.stringify([{day:1,accommodation:{name:'기존 호텔',images:['/hotel.jpg'],privateNote:'PRIVATE-DAY'}}]),JSON.stringify({opsNote:'PRIVATE-NOTE',receipt:{number:'PRIVATE-RECEIPT'}}),'[{"type":"created"}]');
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
    const publicQuote=await getPublicQuote({env:{DB:f.DB},params:{token:'PRIVATE-TOKEN-FIXTURE'}});assert.equal(publicQuote.status,200);
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
