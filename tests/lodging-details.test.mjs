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
test('single-paragraph Novotel legacy snapshot separates explicit labels without modifying source or guessing amenities', () => {
 const prose='전화: +976 7010 1188 Novotel Ulaanbaatar 숙소 소개입니다. 주소: Baga toiruu, 6th khoroo, Sukhbaatar District, Ulaanbaatar 14201 객실 비품(객실 유형에 따라 차이가 있을 수 있음): 생수, TV. 수건 제공 여부 확인 필요. 2026-09-30 공식 안내 기준 수영장은 공사 중입니다. 숙소 정보·사진 출처: Accor 공식 Novotel Ulaanbaatar 페이지 https://all.accor.com/hotel/B1D8/index.en.shtml';
 const snapshot={desc:prose,imgs:['/1','/2','/3','/4','/5']};
 const d=L.displayDetails(snapshot), html=L.render(snapshot);
 assert.equal(d.phone,'+976 7010 1188');assert.equal(d.desc,'Novotel Ulaanbaatar 숙소 소개입니다.');
 assert.equal(d.address,'Baga toiruu, 6th khoroo, Sukhbaatar District, Ulaanbaatar 14201');
 assert.match(d.roomAmenities,/객실 유형에 따라 차이가 있을 수 있음/);assert.match(d.roomAmenities,/수건 제공 여부 확인 필요/);
 assert.match(d.operatingNotes,/2026-09-30 공식 안내 기준 수영장은 공사 중/);
 assert.match(html,/href="tel:\+97670101188"/);assert.match(html,/href="https:\/\/all.accor.com\/hotel\/B1D8\/index.en.shtml"/);
 assert.doesNotMatch(html,/>https:\/\/all.accor/);assert.equal(snapshot.desc,prose);assert.equal(snapshot.imgs.length,5);
 assert.doesNotMatch(html,/헤어드라이어|슬리퍼/);
 const conflict=L.displayDetails({...snapshot,address:'새로 확인한 주소'});
 assert.equal(conflict.address,'새로 확인한 주소');assert.match(conflict.desc,/주소: Baga toiruu/);
});
