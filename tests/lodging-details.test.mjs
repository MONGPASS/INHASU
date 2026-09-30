import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {publicLodge} from '../functions/api/_lodging.mjs';
import {onRequestGet, onRequestPut} from '../functions/api/data/[key].js';
const context = vm.createContext({ URL });
vm.runInContext(readFileSync(new URL('../lodging.js', import.meta.url), 'utf8'), context);
const L = context.Lodging;
test('three selected photos retain order; legacy five-image snapshots are not mutated', () => {
 const legacy={img:'/1.jpg',imgs:['/1.jpg','/2.jpg','/3.jpg','/4.jpg','/5.jpg']};
 assert.equal(JSON.stringify(L.photos(legacy)), JSON.stringify(['/1.jpg','/2.jpg','/3.jpg']));
 assert.equal(legacy.imgs.length,5);
 assert.equal(JSON.stringify(L.photos({...legacy,representativePhotos:['/5.jpg','/2.jpg','/1.jpg']})),JSON.stringify(['/5.jpg','/2.jpg','/1.jpg']));
 assert.equal(L.photos({...legacy,representativePhotos:[]}).length,0);
 assert.equal(L.photos({imgs:['img/quote/lodge-std.webp']}).length,1);
});
test('lodging presentation escapes markup and only uses safe URL protocols', () => {
 const html=L.render({desc:'<img src=x onerror=alert(1)>',address:'"><script>alert(1)</script>',phone:'javascript:alert(1)',officialSources:'javascript:alert(1)\nhttps://hotel.example/info',roomAmenities:'미확인'});
 assert.doesNotMatch(html, /<script|<img|href="javascript:|href="tel:/);
 assert.match(html,/&lt;img/); assert.match(html,/hotel.example/);
 assert.match(L.render({phone:'+976 7010-1188'}), /href="tel:\+97670101188"/);
 assert.equal(L.photos({imgs:['javascript:alert(1)','//evil.test/x','data:image/svg+xml;base64,AAAA']}).length,0);
 assert.equal(L.webUrl('https://user:pass@host.test/'),'');
});
test('no assumed room amenities, internal notes or costs; labelled source links are compact', () => {
 const lodge={desc:'기존 소개\n공식 출처: https://hotel.example/long/path',memo:'INTERNAL',cost:900,notes:'PRIVATE'};
 const html=L.render(lodge);
 assert.doesNotMatch(html,/수건|드라이어|슬리퍼|INTERNAL|PRIVATE|>https:/);
 assert.match(html,/기존 소개/);
 assert.match(lodge.desc,/공식 출처:/);
 assert.equal(publicLodge(lodge).memo,undefined);
});
test('admin API round trip preserves new fields, archival photos and unknown internal fields; public read uses allowlist', async () => {
 let row=null;
 const env={ADMIN_TOKEN:'test',DB:{prepare(sql){return {run:async()=>({}),bind(...args){return {first:async()=>row,run:async()=>{row={v:args[1],updated_at:args[2]};return {};}};}};}}};
 const lodge={address:'UB',phone:'+97670101188',roomAmenities:'확인된 생수',sharedFacilities:'로비',operatingNotes:'공사 중',officialSources:'https://hotel.example/',imgs:['/1','/2','/3','/4','/5'],representativePhotos:['/3','/1','/2'],desc:'원문',internalNotes:'private',cost:800};
 const put=await onRequestPut({request:new Request('https://test/api/data/lodges',{method:'PUT',headers:{'x-admin-token':'test'},body:JSON.stringify({Hotel:lodge})}),params:{key:'lodges'},env});
 assert.equal(put.status,200);
 const read=async(admin)=> (await (await onRequestGet({request:new Request('https://test/api/data/lodges',{headers:admin?{'x-admin-token':'test'}:{}}),params:{key:'lodges'},env})).json()).data.Hotel;
 assert.deepEqual(await read(true),lodge);
 const publicRec=await read(false);assert.equal(publicRec.internalNotes,undefined);assert.equal(publicRec.cost,undefined);assert.equal(publicRec.roomAmenities,lodge.roomAmenities);assert.deepEqual(publicRec.representativePhotos,lodge.representativePhotos);
});
test('refreshing an assignment preserves older archived photos and absent fields', () => {
 const old={address:'기존 주소',img:'/1',imgs:['/1','/2','/3','/4','/5'],memo:'private'};
 const next=L.snapshot({img:'/new',imgs:['/new'],phone:'12345678'},old);
 assert.equal(next.imgs.length,6); assert.equal(next.address,old.address);assert.equal(next.memo,undefined);
 assert.equal(JSON.stringify(L.photos(next)),JSON.stringify(['/new']));
 assert.equal(L.snapshot(undefined,old).imgs.length,5);
});
test('customer booking API returns new lodging fields and selected photos, excluding private data', async () => {
 const {onRequestGet:getCustomer}=await import('../functions/api/my/[token].js');
 const lodge={day:1,name:'Hotel',address:'UB',phone:'+97670101188',roomAmenities:'water',sharedFacilities:'lobby',operatingNotes:'pool closed',officialSources:'https://hotel.example',representativePhotos:['/3','/1','/2'],imgs:['/1','/2','/3','/4','/5'],internalNotes:'private',cost:500};
 const env={DB:{prepare(){return {bind(){return {first:async()=>({status:'예약확정',data:JSON.stringify({booking:{assign:{lodges:[lodge]}}})})};}};}}};
 const res=await getCustomer({env,params:{token:'1234567890123456'}});
 assert.equal(res.status,200);
 const out=(await res.json()).booking.assign.lodges[0];
 assert.deepEqual(out,publicLodge(lodge));assert.equal(out.imgs.length,5);
});
