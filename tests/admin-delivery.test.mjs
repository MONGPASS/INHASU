import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { Hono } from 'hono';
import { ensureSiteSchema } from '../functions/lib/siteSchema.ts';
import { trackedDelivery } from '../functions/lib/adminDelivery.ts';
const bundled = async file => { const result = await build({ entryPoints: [file], bundle: true, platform: 'node', format: 'esm', write: false });
    return (await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`)).default; };
const [history, email] = await Promise.all([bundled('functions/api/admin-deliveries.ts'), bundled('functions/api/notifications/email.ts')]);
async function fixture(t) {
    const raw = new DatabaseSync(':memory:'); t.after(() => raw.close());
    const statement = (sql, args = []) => ({ bind: (...values) => statement(sql, values),
        async run() { return { meta: raw.prepare(sql).run(...args) }; }, async all() { return { results: raw.prepare(sql).all(...args) }; },
        async first() { return raw.prepare(sql).get(...args) ?? null; },
        async raw() { return raw.prepare(sql).all(...args).map(row => Object.values(row)); },
        exec() { return /^\s*(select|pragma)/i.test(sql) ? { results: raw.prepare(sql).all(...args) } : { meta: raw.prepare(sql).run(...args), results: [] }; } });
    const DB = { prepare: sql => statement(sql), batch: async entries => entries.map(entry => entry.exec()) }; await ensureSiteSchema(DB);
    raw.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,google_id TEXT,email TEXT,name TEXT,role TEXT,avatar_url TEXT,password_hash TEXT);
      CREATE TABLE sessions(id TEXT PRIMARY KEY,user_id TEXT,expires_at INTEGER);
      CREATE TABLE requests(id TEXT PRIMARY KEY,status TEXT,data TEXT);`);
    raw.prepare('INSERT INTO users(id,email,name,role) VALUES (?,?,?,?)').run('admin', 'admin@example.invalid', '테스트 관리자', 'admin');
    raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run('delivery-admin', 'admin', Date.now() + 86400000);
    raw.prepare('INSERT INTO users(id,email,name,role) VALUES (?,?,?,?)').run('member', 'member@example.invalid', '합성 회원', 'user');
    raw.prepare('INSERT INTO sessions VALUES(?,?,?)').run('delivery-member', 'member', Date.now() + 86400000);
    raw.prepare(`INSERT INTO reservations(id,customer_name,customer_email,product_name,status,deposit_status,itinerary_url,document_content,contract_data)
      VALUES(?,?,?,?,?,?,?,?,?)`).run('same-id','테스트 고객','customer@example.invalid','테스트 상품','confirmed','paid','https://example.invalid/itinerary',
        JSON.stringify({ days:[{ day:1,title:'테렐지',activities:[] }]}), JSON.stringify({ agreement:{ agreed:true }, travelers:[{passportNo:'NEVER-EXPOSE'}] }));
    raw.prepare('INSERT INTO requests VALUES(?,?,?)').run('same-id','예약확정',JSON.stringify({ name:'견적 고객',token:'NEVER-TOKEN',decision:{status:'accepted'},
      booking:{days:[{d:1,dest:'고비'}],contractInfo:{depositStatus:'입금완료'},contract:{signedAt:'2026-10-14',signImg:'NEVER-SIGNATURE'},publishStatus:'published'} }));
    const app = new Hono(); app.route('/history',history); app.route('/email',email); app.route('/api/admin/deliveries',history);
    const request = (route, { body, admin = true, member = false } = {}) => app.request(route, { method:body ? 'POST' : 'GET', headers:{ ...(admin ? {cookie:'auth_session=delivery-admin'} : member ? {cookie:'auth_session=delivery-member'} : {}),
      ...(body ? {'Content-Type':'application/json'} : {}) }, ...(body ? {body:JSON.stringify(body)} : {}) }, {DB,ENVIRONMENT:'production',RESEND_API_KEY:'local-only'});
    return { raw, DB, request };
}
const scope = {source:'product',bookingId:'same-id',kind:'contract',channel:'email'};
const mailBody = {to:'customer@example.invalid',type:'CONTRACT_READY',idempotencyKey:'repeat-key-123456',data:{reservationDbId:'same-id',customerName:'테스트 고객'}};

test('메일 요청은 성공·실패를 서버에 남기고 같은 요청 키는 다시 발송하지 않는다', async t => {
    const {raw,request}=await fixture(t); const original=globalThis.fetch; let sent=0;
    globalThis.fetch=async()=>{sent++;return Response.json({id:'provider-1'});}; t.after(()=>globalThis.fetch=original);
    assert.equal((await request('/email',{body:mailBody})).status,200);
    assert.equal((await request('/email',{body:mailBody})).status,200); assert.equal(sent,1);
    assert.equal(raw.prepare('SELECT state FROM admin_delivery_attempts').get().state,'accepted');
    const result=await request('/history?source=product&id=same-id'); assert.equal(result.headers.get('Cache-Control'),'private, no-store');
    const text=await result.text();assert.ok(!/NEVER-|example.invalid\/itinerary/.test(text));assert.equal(JSON.parse(text).items[0].providerId,'provider-1');
});
test('명시적 거절 후 새 키로 재시도하고 불확실한 응답에는 중복 발송을 막는다', async t => {
    const {DB,raw}=await fixture(t); let sends=0;
    const failed=await trackedDelivery(DB,{...scope,key:'failed-key-123456'},async()=>{sends++;return {ok:false,httpStatus:422};});assert.equal(failed.state,'failed');
    const retried=await trackedDelivery(DB,{...scope,key:'retry-key-1234567'},async()=>{sends++;return {ok:true,id:'accepted-2'};});assert.equal(retried.state,'accepted');
    const uncertain=await trackedDelivery(DB,{...scope,kind:'itinerary',key:'uncertain-1234567'},async()=>{sends++;throw Error('no response');});assert.equal(uncertain.state,'unknown');
    const blocked=await trackedDelivery(DB,{...scope,kind:'itinerary',key:'new-key-12345678'},async()=>{sends++;return {ok:true};});assert.equal(blocked.duplicate,true);assert.equal(sends,3);
    assert.equal(raw.prepare("SELECT count(*) n FROM admin_delivery_attempts WHERE state='unknown'").get().n,1);
});
test('다른 탭이 동시에 다른 키로 발송해도 미완료 요청은 하나만 서비스에 보낸다', async t => {
    const {DB}=await fixture(t); let release;const hold=new Promise(resolve=>release=resolve);let started;const begins=new Promise(resolve=>started=resolve);let calls=0;
    const first=trackedDelivery(DB,{...scope,key:'tab-one-12345678'},async()=>{calls++;started();await hold;return {ok:true};});await begins;
    const second=await trackedDelivery(DB,{...scope,key:'tab-two-12345678'},async()=>{calls++;return {ok:true};});assert.equal(second.duplicate,true);release();await first;assert.equal(calls,1);
});
test('상품·견적 같은 ID의 이력과 진행 상태는 섞이지 않고 관리자만 조회한다', async t => {
    const {DB,request}=await fixture(t);await trackedDelivery(DB,scope,async()=>({ok:true,id:'product-receipt'}));
    await trackedDelivery(DB,{...scope,source:'quote_booking',kind:'itinerary',channel:'kakao'},async()=>({ok:true,groupId:'quote-receipt'}));
    const product=await(await request('/history?source=product&id=same-id')).json();const quote=await(await request('/history?source=quote_booking&id=same-id')).json();
    assert.equal(product.items[0].providerId,'product-receipt');assert.equal(quote.items[0].providerId,'quote-receipt');assert.deepEqual(quote.workflow,{accepted:true,deposit:true,contract:true,schedule:true,published:true});
    assert.equal((await request('/history?source=product&id=same-id',{admin:false})).status,401);
    assert.equal((await request('/history?source=bad&id=same-id')).status,400);assert.equal((await request('/history?source=product&id=missing')).status,404);
});
test('삭제·취소·다른 수신자·미공개 일정표는 실제 발송 전에 거부한다', async t => {
    const {raw,request}=await fixture(t);const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('must not contact provider');};t.after(()=>globalThis.fetch=original);
    assert.equal((await request('/email',{body:{...mailBody,to:'wrong@example.invalid'}})).status,400);
    raw.exec("UPDATE reservations SET itinerary_url=NULL");assert.equal((await request('/email',{body:{...mailBody,type:'ITINERARY_READY'}})).status,409);
    raw.exec("UPDATE reservations SET status='cancelled'");assert.equal((await request('/email',{body:mailBody})).status,409);
    raw.exec('DELETE FROM reservations');assert.equal((await request('/email',{body:mailBody})).status,404);
});

test('관리자 문서 발송에 예약 ID가 없으면 400이며 provider와 발송 이력을 만들지 않는다', async t => {
    const {raw,request}=await fixture(t); const original=globalThis.fetch; let senderCalls=0;
    globalThis.fetch=async()=>{senderCalls++;return Response.json({id:'must-not-be-created'});};
    t.after(()=>globalThis.fetch=original);
    for (const type of ['CONTRACT_READY','ITINERARY_READY']) {
        for (const data of [undefined, {}, {reservationId:'same-id',contractUrl:'https://example.invalid/contract',itineraryUrl:'https://example.invalid/itinerary'}, {reservationDbId:null}, {reservationDbId:''}, {reservationDbId:'   '}]) {
            const response=await request('/email',{body:{...mailBody,type,data}});
            assert.equal(response.status,400);
            assert.match((await response.json()).error,/예약 ID/);
        }
    }
    assert.equal(senderCalls,0);
    assert.equal(raw.prepare('SELECT count(*) n FROM admin_delivery_attempts').get().n,0);
    assert.equal(raw.prepare('SELECT status FROM reservations WHERE id=?').get('same-id').status,'confirmed');
});

test('실제 일반 회원 세션은 관리자 발송 이력 GET에서 403으로 거부한다', async t => {
    const {request}=await fixture(t);
    const response=await request('/api/admin/deliveries?source=product&id=same-id',{admin:false,member:true});
    assert.equal(response.status,403);
    assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    assert.deepEqual(await response.json(),{error:'Forbidden'});
});

const createLegacyNoticeTable = raw => raw.exec(`CREATE TABLE itinerary_notice_dispatches (
    request_id TEXT NOT NULL,dispatch_key TEXT NOT NULL,state TEXT NOT NULL,
    created_at TEXT NOT NULL,result TEXT,PRIMARY KEY(request_id,dispatch_key)
)`);
const insertLegacyNotice = (raw, {key,at,result}) => raw.prepare(
    'INSERT INTO itinerary_notice_dispatches(request_id,dispatch_key,state,created_at,result) VALUES(?,?,?,?,?)'
).run('same-id',key,'accepted',at,JSON.stringify(result));
const assertNoDispatchKeys = (text, keys) => {
    assert.ok(!text.includes('dispatch_key'),'내부 dispatch_key 필드를 응답에 포함하지 않아야 한다');
    for (const key of keys) assert.ok(!text.includes(key),'공개 항목 ID에도 내부 발송 키를 포함하지 않아야 한다');
};

test('기존 견적 ledger와 공통 ledger가 같은 키 또는 provider 영수증이면 한 번의 발송으로 표시한다', async t => {
    const cases = [
        {name:'같은 키와 영수증',legacyKey:'PRIVATE-same-key-123456',trackedKey:'PRIVATE-same-key-123456',legacyResult:{ok:true,groupId:'receipt-same'},providerId:'receipt-same'},
        {name:'다른 키지만 같은 중첩 영수증',legacyKey:'PRIVATE-old-key-1234567',trackedKey:'PRIVATE-new-key-1234567',legacyResult:{ok:true,result:{groupId:'receipt-nested'}},providerId:'receipt-nested'},
        {name:'같은 키에 provider 영수증이 없어도 동일 요청',legacyKey:'PRIVATE-no-receipt-1234',trackedKey:'PRIVATE-no-receipt-1234',legacyResult:{ok:true},providerId:undefined},
    ];
    for (const scenario of cases) await t.test(scenario.name,async sub => {
        const {raw,DB,request}=await fixture(sub); let senderCalls=0;
        createLegacyNoticeTable(raw);
        const tracked=await trackedDelivery(DB,{...scope,source:'quote_booking',kind:'itinerary',channel:'kakao',key:scenario.trackedKey},
            async()=>{senderCalls++;return {ok:true,groupId:scenario.providerId};});
        assert.equal(tracked.state,'accepted');
        const native=raw.prepare('SELECT * FROM admin_delivery_attempts WHERE id=?').get(tracked.id);
        insertLegacyNotice(raw,{key:scenario.legacyKey,at:native.created_at,result:scenario.legacyResult});
        const beforeLegacy=raw.prepare('SELECT * FROM itinerary_notice_dispatches').get();
        const beforeNative=raw.prepare('SELECT * FROM admin_delivery_attempts').get();

        const response=await request('/api/admin/deliveries?source=quote_booking&id=same-id');
        assert.equal(response.status,200);
        assert.equal(response.headers.get('Cache-Control'),'private, no-store');
        const text=await response.text(); const data=JSON.parse(text);
        assert.equal(data.items.length,1);
        assert.equal(data.items[0].id,tracked.id);
        assert.equal(data.items[0].state,'accepted');
        assert.equal(data.items[0].providerId,scenario.providerId);
        assert.deepEqual(data.warnings,[]);
        assertNoDispatchKeys(text,[scenario.legacyKey,scenario.trackedKey]);
        assert.equal(senderCalls,1,'읽기 조회는 추가 발송을 하지 않아야 한다');
        assert.deepEqual(raw.prepare('SELECT * FROM itinerary_notice_dispatches').get(),beforeLegacy);
        assert.deepEqual(raw.prepare('SELECT * FROM admin_delivery_attempts').get(),beforeNative);
    });
});

test('가까운 시간이어도 다른 키와 영수증인 기존·공통 발송 이력은 두 건을 보존하고 키를 숨긴다', async t => {
    const {raw,DB,request}=await fixture(t); let senderCalls=0;
    const legacyKey='PRIVATE-separate-old-key',trackedKey='PRIVATE-separate-new-key';
    createLegacyNoticeTable(raw);
    const tracked=await trackedDelivery(DB,{...scope,source:'quote_booking',kind:'itinerary',channel:'kakao',key:trackedKey},
        async()=>{senderCalls++;return {ok:true,groupId:'new-provider-receipt'};});
    const native=raw.prepare('SELECT * FROM admin_delivery_attempts WHERE id=?').get(tracked.id);
    insertLegacyNotice(raw,{key:legacyKey,at:new Date(Date.parse(native.created_at)-1000).toISOString(),result:{ok:true,groupId:'old-provider-receipt'}});
    const beforeLegacy=raw.prepare('SELECT * FROM itinerary_notice_dispatches').get();
    const beforeNative=raw.prepare('SELECT * FROM admin_delivery_attempts').get();

    const response=await request('/api/admin/deliveries?source=quote_booking&id=same-id');
    assert.equal(response.status,200);
    const text=await response.text(); const data=JSON.parse(text);
    assert.equal(data.items.length,2,'시간 근접만으로 서로 다른 발송을 중복 처리하면 안 된다');
    assert.deepEqual(new Set(data.items.map(item=>item.providerId)),new Set(['old-provider-receipt','new-provider-receipt']));
    assert.equal(new Set(data.items.map(item=>item.id)).size,2);
    assert.ok(data.items.every(item=>item.state==='accepted' && item.kind==='itinerary' && item.channel==='kakao'));
    assert.deepEqual(data.warnings,[]);
    assertNoDispatchKeys(text,[legacyKey,trackedKey]);
    assert.equal(senderCalls,1);
    assert.deepEqual(raw.prepare('SELECT * FROM itinerary_notice_dispatches').get(),beforeLegacy);
    assert.deepEqual(raw.prepare('SELECT * FROM admin_delivery_attempts').get(),beforeNative);
});
