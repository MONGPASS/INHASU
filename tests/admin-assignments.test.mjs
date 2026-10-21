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
import { selectResourceGuide, selectResourceVehicle, selectResourceLodge } from '../src/utils/accommodationResourceSelection.ts';

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
    raw.prepare('UPDATE reservations SET user_id=? WHERE id=?').run('member','same-id');
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

test('숙소 배정 조회는 고객별 저장 일정을 별도로 제공하고 명시적 빈 일정과 빈 숙소를 보존한다', async t => {
    const f = await fixture(t);
    const doc = { days: [{ day: 1, title: '고객 고비 일정', region: '고비', items: ['09:00 이동'], privateNote: 'PRIVATE-DAY', image: 'PRIVATE-PHOTO' },
        { day: 2, title: '고객 초원 일정', region: '중앙몽골' }, { day: 3, title: '귀환' }], privateToken: 'PRIVATE-TOKEN' };
    f.raw.prepare('UPDATE reservations SET start_date=?,end_date=?,document_content=?,product_id=? WHERE id=?').run(
        '2026-10-19T15:00:00.000Z', '2026-10-21T15:00:00.000Z', JSON.stringify(doc), 'real-product', 'same-id');
    let item = (await f.list()).find(i => i.source === 'product');
    assert.equal(item.startDate, '2026-10-20'); assert.equal(item.endDate, '2026-10-22'); assert.equal(item.schedule.source, 'customer');
    assert.deepEqual(item.schedule.days.map(d => [d.day, d.date, d.region]), [[1, '2026-10-20', '고비'], [2, '2026-10-21', '중앙몽골'], [3, '2026-10-22', '']]);
    assert.equal(item.schedule.days[0].summary, '09:00 이동'); assert.ok(!JSON.stringify(item.schedule).includes('PRIVATE-'));
    f.raw.prepare('UPDATE reservations SET document_content=?,daily_accommodations=? WHERE id=?').run('{"days":[]}', '[]', 'same-id');
    item = (await f.list()).find(i => i.source === 'product');
    assert.equal(item.schedule.source, 'customer'); assert.deepEqual(item.schedule.days, []); assert.deepEqual(item.assignment.accommodations, []);
    item.assignment.vehicle.type = '빈 일정에서도 배정만 편집';
    assert.equal((await f.request('/assignments/product/same-id', { method: 'PATCH', body: { expectedVersion: item.version, assignment: item.assignment } })).status, 200);
    assert.equal(f.raw.prepare('SELECT document_content FROM reservations WHERE id=?').get('same-id').document_content, '{"days":[]}');
});

test('상품 고객 일정이 조회 후 또는 저장 직전에 바뀌면 409로 거절하고 새 일정과 기존 배정을 보존한다', async t => {
    const f = await fixture(t), save = item => f.request('/assignments/product/same-id', { method: 'PATCH', body: { expectedVersion: item.version, assignment: item.assignment } });
    f.raw.prepare('UPDATE reservations SET document_content=? WHERE id=?').run('{"days":[{"day":1,"title":"원래 일정"}]}', 'same-id');
    let item = (await f.list()).find(i => i.source === 'product');
    const before = f.raw.prepare('SELECT assigned_guide,daily_accommodations FROM reservations WHERE id=?').get('same-id');
    const change = title => f.raw.prepare('UPDATE reservations SET document_content=? WHERE id=?').run(JSON.stringify({ days: [{ day: 1, title }] }), 'same-id');
    change('다른 화면에서 수정'); assert.equal((await save(item)).status, 409);
    item = (await f.list()).find(i => i.source === 'product');
    let injected = false; f.setBeforeRun(sql => { if (!injected && /^UPDATE reservations SET assigned_guide=/i.test(sql)) { injected = true; change('저장 직전 수정'); } });
    assert.equal((await save(item)).status, 409);
    const after = f.raw.prepare('SELECT document_content,assigned_guide,daily_accommodations FROM reservations WHERE id=?').get('same-id');
    assert.equal(JSON.parse(after.document_content).days[0].title, '저장 직전 수정');
    assert.equal(after.assigned_guide, before.assigned_guide); assert.equal(after.daily_accommodations, before.daily_accommodations);
});

for (const source of ['product', 'template']) {
    test(`선택 ${source} 일정 변경도 버전과 원자적 저장 조건에 포함하고 새 원본을 덮어쓰지 않는다`, async t => {
        const f = await fixture(t), table = source === 'product' ? 'products' : 'itinerary_templates', id = source === 'product' ? 'real-product' : 'selected-template';
        const column = source === 'product' ? 'itinerary_blocks' : 'days';
        const encode = title => JSON.stringify(source === 'product' ? [{ type: 'dayInfo', content: { title, region: '고비' } }] : [{ day: 1, title, region: '고비' }]);
        if (source === 'template') f.raw.prepare('INSERT INTO itinerary_templates(id,name,days) VALUES(?,?,?)').run(id, '선택 템플릿', encode('원래 일정'));
        else f.raw.prepare('UPDATE products SET itinerary_blocks=? WHERE id=?').run(encode('원래 일정'), id);
        f.raw.prepare('UPDATE reservations SET product_id=?,itinerary_template_id=? WHERE id=?').run('real-product', source === 'template' ? id : null, 'same-id');
        const save = item => f.request('/assignments/product/same-id', { method: 'PATCH', body: { expectedVersion: item.version, assignment: item.assignment } });
        let item = (await f.list()).find(i => i.source === 'product'); assert.equal(item.schedule.source, source);
        const before = f.raw.prepare('SELECT assigned_guide,daily_accommodations FROM reservations WHERE id=?').get('same-id');
        const change = title => f.raw.prepare(`UPDATE ${table} SET ${column}=? WHERE id=?`).run(encode(title), id);
        change('조회 후 변경'); assert.equal((await save(item)).status, 409);
        item = (await f.list()).find(i => i.source === 'product');
        let injected = false; f.setBeforeRun(sql => { if (!injected && /^UPDATE reservations SET assigned_guide=/i.test(sql)) { injected = true; change('저장 직전 변경'); } });
        assert.equal((await save(item)).status, 409);
        assert.equal(f.raw.prepare(`SELECT ${column} FROM ${table} WHERE id=?`).get(id)[column], encode('저장 직전 변경'));
        assert.deepEqual(f.raw.prepare('SELECT assigned_guide,daily_accommodations FROM reservations WHERE id=?').get('same-id'), before);
    });
}

test('고객 일정 원본을 읽지 못해도 배정 행은 보이며 저장은 409로 막고 원본을 보존한다', async t => {
    const f = await fixture(t);
    f.raw.prepare('UPDATE reservations SET document_content=?,product_id=? WHERE id=?').run('{', 'real-product', 'same-id');
    const item = (await f.list()).find(i => i.source === 'product');
    assert.equal(item.schedule.source, 'unavailable'); assert.ok(item.assignment.accommodations.length);
    const before = f.raw.prepare('SELECT * FROM reservations WHERE id=?').get('same-id');
    item.assignment.guide.name = '저장되어서는 안 됨';
    const response = await f.request('/assignments/product/same-id', { method: 'PATCH', body: { expectedVersion: item.version, assignment: item.assignment } });
    assert.equal(response.status, 409); assert.match((await response.json()).error, /고객 일정 원본/);
    assert.deepEqual(f.raw.prepare('SELECT * FROM reservations WHERE id=?').get('same-id'), before);
});

test('견적 숙소에 저장된 잘못된 일차를 조회 중 정상 일차로 조용히 바꾸지 않는다', async t => {
    const f = await fixture(t), row = f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id'), rec = JSON.parse(row.data);
    rec.booking.assign.lodges[0].day = 0;
    const data = JSON.stringify(rec); f.raw.prepare('UPDATE requests SET data=? WHERE id=?').run(data, 'same-id');
    const item = (await f.list()).find(i => i.source === 'quote_booking');
    assert.equal(item.assignment.accommodations[0].day, 0);
    assert.equal(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data, data);
});

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

for (const source of ['product', 'quote_booking']) {
    test(`${source} 공통 선택 snapshot은 실제 저장·재조회 후 유지되고 같은 담당의 전화 수정과 수동 전환을 구분한다`, async t => {
        const f = await fixture(t), otherSource = source === 'product' ? 'quote_booking' : 'product';
        const other = (await f.list()).find(item => item.source === otherSource);
        const beforeProduct = f.raw.prepare('SELECT * FROM reservations WHERE id=?').get('same-id');
        const beforeQuote = JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data);
        let item = (await f.list()).find(item => item.source === source);
        const guide = { id: 'resource-guide:선택 가이드', name: '선택 가이드', phone: 'GUIDE-PHONE', image: '/selected-guide.webp',
            introduction: '선택 당시 소개', nameEn: 'Selected Guide', role: '현지 가이드', languages: ['한국어'], specialties: ['중앙몽골'] };
        const vehicle = { name: '선택 차량', type: '선택 차량', phone: 'PRIVATE-SELECTED-DRIVER', snapshot: { img: '/selected-car.webp',
            images: ['/selected-car.webp', '/inside.webp'], description: '선택 당시 차량 소개', seats: '6인', luggage: '4개', privateNote: 'PRIVATE-EXCLUDED' } };
        const lodge = { id: 'resource-lodge:선택 숙소', name: '선택 숙소', type: '고급 게르', location: '테를지', region: '테를지', address: '선택 당시 주소',
            images: [], description: '', facilities: ['온수'], roomAmenities: ['수건'], sharedFacilities: ['식당'], occupancy: '2 хүн/өрөө', operatingNotes: 'PRIVATE-EXCLUDED' };
        const day = { ...item.assignment.accommodations[0], date: '2026-10-20', accommodation: { ...item.assignment.accommodations[0].accommodation,
            roomCount: 2, occupancy: '4 хүн/өрөө', bookingStatus: 'Баталгаажсан' } };
        item.assignment = { guide: selectResourceGuide(item.assignment.guide, guide), vehicle: selectResourceVehicle(item.assignment.vehicle, vehicle),
            accommodations: [selectResourceLodge(day, lodge)] };
        const payload = editorAssignment({ assignedGuide: item.assignment.guide, contractData: { vehicle: item.assignment.vehicle }, dailyAccommodations: item.assignment.accommodations });
        let response = await f.request(`/assignments/${source}/same-id`, { method: 'PATCH', body: { expectedVersion: item.version, assignment: payload } });
        assert.equal(response.status, 200); item = (await response.json()).item;
        assert.deepEqual(item.assignment.guide, payload.guide); assert.deepEqual(item.assignment.vehicle, payload.vehicle);
        const stay = item.assignment.accommodations[0];
        assert.equal(stay.date, '2026-10-20'); assert.equal(stay.accommodation.id, lodge.id); assert.equal(stay.accommodation.address, '선택 당시 주소');
        assert.equal(stay.accommodation.region, '테를지'); assert.deepEqual(stay.accommodation.images, []); assert.equal(stay.accommodation.description, '');
        assert.equal(stay.accommodation.roomCount, 2); assert.equal(stay.accommodation.occupancy, '4 хүн/өрөө');
        assert.equal(stay.accommodation.bookingStatus, 'Илгээгээгүй'); assert.deepEqual(stay.accommodation.roomAmenities, ['수건']);
        assert.ok(!JSON.stringify(item).includes('PRIVATE-EXCLUDED'));
        item.assignment.guide = { id: guide.id, name: guide.name, phone: 'MANUALLY-EDITED-GUIDE' };
        item.assignment.vehicle = { type: vehicle.type, phone: 'PRIVATE-MANUALLY-EDITED-DRIVER' };
        response = await f.request(`/assignments/${source}/same-id`, { method: 'PATCH', body: { expectedVersion: item.version, assignment: item.assignment } });
        assert.equal(response.status, 200); item = (await response.json()).item;
        assert.equal(item.assignment.guide.phone, 'MANUALLY-EDITED-GUIDE'); assert.equal(item.assignment.guide.image, '/selected-guide.webp');
        assert.equal(item.assignment.guide.introduction, '선택 당시 소개'); assert.deepEqual(item.assignment.guide.languages, ['한국어']);
        assert.equal(item.assignment.vehicle.phone, 'PRIVATE-MANUALLY-EDITED-DRIVER'); assert.equal(item.assignment.vehicle.resource.img, '/selected-car.webp');
        if (source === 'product') {
            const row = f.raw.prepare('SELECT * FROM reservations WHERE id=?').get('same-id');
            const withoutVehicle = value => { const { vehicle, ...rest } = JSON.parse(value); return rest; };
            assert.deepEqual(withoutVehicle(row.contract_data), withoutVehicle(beforeProduct.contract_data));
            assert.equal(row.status, beforeProduct.status); assert.equal(row.history, beforeProduct.history);
            assert.ok(!JSON.stringify(buildProductQuote({ reservation: row, days: [], assignmentsVisible: true, brand: {} })).includes('PRIVATE-MANUALLY-EDITED-DRIVER'));
        } else {
            const rec = JSON.parse(f.raw.prepare('SELECT data FROM requests WHERE id=?').get('same-id').data);
            const withoutAssignment = value => ({ ...value, booking: { ...value.booking, assign: undefined } });
            assert.deepEqual(withoutAssignment(rec), withoutAssignment(beforeQuote));
            const publicResponse = await getPublicQuote({ request: new Request('https://fixture.invalid/api/my/PRIVATE-TOKEN-FIXTURE', { headers: { cookie: 'auth_session=session-admin' } }), env: { DB: f.DB }, params: { token: 'PRIVATE-TOKEN-FIXTURE' } });
            const customer = await publicResponse.json();
            assert.ok(!JSON.stringify(customer).includes('PRIVATE-MANUALLY-EDITED-DRIVER'));
            assert.equal(customer.booking.assign.lodges[0].roomAmenities, '수건'); assert.equal(customer.booking.assign.lodges[0].sharedFacilities, '식당');
        }
        item.assignment.guide = { id: '', name: '직접 입력 담당', phone: '' }; item.assignment.vehicle = { type: '직접 입력 차량', phone: '' };
        response = await f.request(`/assignments/${source}/same-id`, { method: 'PATCH', body: { expectedVersion: item.version, assignment: item.assignment } });
        assert.equal(response.status, 200); item = (await response.json()).item;
        assert.equal(item.assignment.guide.image, ''); assert.equal(item.assignment.guide.introduction, '');
        assert.equal(item.assignment.vehicle.resource?.id || '', ''); assert.equal(item.assignment.vehicle.resource?.img || '', '');
        assert.deepEqual((await f.list()).find(item => item.source === otherSource), other, '같은 ID의 다른 원본은 변경하지 않는다');
    });
}

test('선택 snapshot의 임의 필드·대용량·실행 URL·인증정보 URL·고객 첨부 URL은 저장하지 않는다', async t => {
    const f = await fixture(t), item = (await f.list()).find(item => item.source === 'product');
    const before = f.raw.prepare('SELECT assigned_guide,contract_data,daily_accommodations FROM reservations WHERE id=?').get('same-id');
    const snapshots = [
        { guide: { ...item.assignment.guide, memo: 'PRIVATE-INJECTION' } },
        { guide: { ...item.assignment.guide, introduction: 'x'.repeat(10001) } },
        { guide: { ...item.assignment.guide, languages: Array(51).fill('한국어') } },
        { vehicle: { type: '차량', phone: '', resource: { plate: 'PRIVATE-INJECTION' } } },
        { vehicle: { type: '차량', phone: '', resource: { images: Array(51).fill('/car.webp') } } },
        ...['javascript:alert(1)', 'data:image/png;base64,YQ==', 'blob:temporary', 'https://user:secret@example.invalid/a.webp',
            '/api/file/uploads/private.webp?token=PRIVATE', '/uploads/private.webp', '/api/img/uploads/private.webp', '/%61pi/file/private.webp']
            .flatMap(url => [{ guide: { ...item.assignment.guide, image: url } }, { vehicle: { type: '차량', phone: '', resource: { img: url } } },
                { accommodations: [{ day: 1, accommodation: { images: [url] } }] }]),
    ];
    for (const patch of snapshots) {
        const response = await f.request('/assignments/product/same-id', { method: 'PATCH', body: { expectedVersion: item.version, assignment: { ...item.assignment, ...patch } } });
        assert.equal(response.status, 400);
    }
    assert.deepEqual(f.raw.prepare('SELECT assigned_guide,contract_data,daily_accommodations FROM reservations WHERE id=?').get('same-id'), before);
});
