import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as upload } from '../functions/api/upload.js';
import { onRequestGet as download } from '../functions/api/file/[[key]].js';
import { requestSQLite } from './helpers/request-sqlite.mjs';
import { customerIdentity } from './helpers/customer-session.mjs';

function fixture(t) {
  const DB=requestSQLite(t,null,{skipInsert:true});
  const customer=customerIdentity(DB),passwordOnly=customerIdentity(DB,{user:'password-only',google:false}),admin=customerIdentity(DB,{user:'admin',role:'admin',google:false});
  const writes=[];let reads=0;
  const env={DB,ADMIN_TOKEN:'fixture-admin',FILES:{async put(...args){writes.push(args);},async get(){reads++;throw Error('Private downloads must not be reached by customers');}}};
  const request=({headers={},suffix='',filename='flight.pdf',bytes='synthetic attachment'}={})=>{
    const form=new FormData();form.set('file',new File([bytes],filename,{type:'application/pdf'}));
    return new Request('https://customer.invalid/api/upload'+suffix,{method:'POST',headers:{Origin:'https://customer.invalid',...headers},body:form});
  };
  return {env,customer,passwordOnly,admin,writes,request,get reads(){return reads;}};
}

test('비공개 첨부는 Google 고객·실제 관리자·기존 관리자 토큰만 저장할 수 있다',async t=>{
  const f=fixture(t);
  for(const headers of [{},f.passwordOnly,{'x-admin-token':'wrong'}]) {
    const response=await upload({request:f.request({headers}),env:f.env});
    assert.equal(response.status,401);assert.equal((await response.json()).code,'login_required');
  }
  assert.equal(f.writes.length,0);
  for(const options of [{headers:f.customer},{headers:f.admin},{headers:{'x-admin-token':'fixture-admin'}},{suffix:'?token=fixture-admin'}]) {
    const response=await upload({request:f.request(options),env:f.env});assert.equal(response.status,200);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
    const body=await response.json();assert.match(body.key,/^uploads\//);assert.equal(body.url,undefined);
  }
  assert.equal(f.writes.length,4);assert.ok(f.writes.every(([key])=>key.startsWith('uploads/')));
});

test('공개 이미지 업로드는 일반 고객 세션에 열리지 않고 기존 관리자 헤더·쿼리를 유지한다',async t=>{
  const f=fixture(t);
  for(const headers of [{},f.customer,f.passwordOnly]) assert.equal((await upload({request:f.request({headers,suffix:'?folder=images',filename:'image.jpg'}),env:f.env})).status,401);
  assert.equal(f.writes.length,0);
  for(const options of [{headers:{'x-admin-token':'fixture-admin'},suffix:'?folder=images'},{suffix:'?folder=images&token=fixture-admin'}]){
    const response=await upload({request:f.request({...options,filename:'image.jpg'}),env:f.env});assert.equal(response.status,200);
    const body=await response.json();assert.match(body.key,/^images\//);assert.match(body.url,/^\/api\/img\//);
  }
});

test('타 사이트 업로드는 유효한 로그인·관리자 토큰이 있어도 R2에 기록하지 않는다',async t=>{
  const f=fixture(t);
  for(const options of [{headers:{...f.customer,Origin:'https://evil.invalid'}},{headers:{...f.customer,'Sec-Fetch-Site':'cross-site'}},
    {headers:{'x-admin-token':'fixture-admin',Origin:'https://evil.invalid'},suffix:'?folder=images'}]){
    const response=await upload({request:f.request(options),env:f.env});assert.equal(response.status,403);assert.equal((await response.json()).code,'invalid_origin');
  }
  assert.equal(f.writes.length,0);
});

test('로그인 뒤에도 확장자·10MB 제한과 비공개 다운로드의 관리자 전용 경계는 유지한다',async t=>{
  const f=fixture(t);
  assert.equal((await upload({request:f.request({headers:f.customer,filename:'run.html'}),env:f.env})).status,415);
  assert.equal((await upload({request:f.request({headers:f.customer,bytes:new Uint8Array(10*1024*1024+1)}),env:f.env})).status,413);
  const response=await download({request:new Request('https://customer.invalid/api/file/uploads/flight.pdf',{headers:f.customer}),env:f.env,params:{key:['uploads','flight.pdf']}});
  assert.equal(response.status,401);assert.equal(f.reads,0);assert.equal(f.writes.length,0);
});
