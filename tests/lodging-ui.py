import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
# Start the repository HTTP server separately. Every API request is intercepted.
base=os.environ.get('INHASU_UI_BASE', 'http://127.0.0.1:8765/')
evidence=Path(os.environ.get('INHASU_UI_EVIDENCE', '/tmp/inh-lodging-evidence'))
evidence.mkdir(parents=True, exist_ok=True)
photos=['/img/quote/lodge-std.webp','/img/quote/lodge-lux.webp','/img/quote/lodge-tent.webp','/img/quote/lodge-nomad.webp','/img/quote/lodge-note.webp']
legacy={'img':photos[0],'imgs':photos,'desc':'전화: +976 7010 1188 Novotel Ulaanbaatar 숙소 소개입니다. 주소: Baga toiruu, 6th khoroo, Sukhbaatar District, Ulaanbaatar 14201 객실 비품(객실 유형에 따라 차이가 있을 수 있음): 생수, TV. 수건 제공 여부 확인 필요. 2026-09-30 공식 안내 기준 수영장은 공사 중입니다. 숙소 정보·사진 출처: Accor 공식 Novotel Ulaanbaatar 페이지 https://all.accor.com/hotel/B1D8/index.en.shtml','region':'울란바타르','grade':'호텔','internalNotes':'SECRET','cost':123}
store={'lodges':{'검증 호텔':legacy},'lodge_cats':['울란바타르']}
errors=[]
patches=[]
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path=os.environ.get('INHASU_CHROMIUM', '/usr/bin/chromium'),args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1280,'height':960})
 def route(r):
  u=r.request.url
  if not u.startswith(base): r.abort(); return
  if '/api/data/' in u:
   key=u.split('/api/data/')[1].split('?')[0]
   if r.request.method=='PUT': store[key]=r.request.post_data_json
   r.fulfill(json={'ok':True,'data':store.get(key),'updatedAt':'fixture'});return
  if r.request.method=='PATCH': patches.append(r.request.post_data_json)
  if '/api/' in u: r.fulfill(json={'ok':True,'items':[]}); return
  r.continue_()
 ctx.route('**/*',route)
 ctx.add_init_script("sessionStorage.setItem('leaders_admin_token','local-fixture')")
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'리소스관리.html');page.locator('[data-t="lodges"]').click();page.locator('.res-card').click()
 assert page.locator('#lodgePhotos img').count()==3
 assert page.locator('#lodgeArchive img').count()==2
 fields={'address':'울란바타르 시내 1번지','phone':'+976 7010 1188','roomAmenities':'생수 (제공 확인)\n수건·슬리퍼: 확인 필요','sharedFacilities':'호텔 로비','operatingNotes':'수영장 공사 중','officialSources':'https://hotel.example/official/long/path'}
 for k,v in fields.items():page.locator('#f_'+k).fill(v)
 page.locator('#f_desc').fill('고객용 숙소 소개')
 page.locator('[data-photo-up="2"]').click()
 selected=page.locator('#lodgePhotos img').evaluate_all('(els)=>els.map(e=>e.getAttribute("src"))')
 page.locator('#dSave').click();page.wait_for_function("!document.getElementById('drawer').classList.contains('on')")
 saved=store['lodges']['검증 호텔'];assert saved['imgs']==photos;assert saved['cost']==123;assert saved['representativePhotos']==selected
 for k,v in fields.items():assert saved[k]==v
 page.reload();page.locator('[data-t="lodges"]').click();page.locator('.res-card').click()
 for k,v in fields.items():assert page.locator('#f_'+k).input_value()==v
 page.locator('#f_phone').fill('CANCELLED');page.locator('#dX').click();page.locator('.res-card').click();assert page.locator('#f_phone').input_value()==fields['phone']
 page.locator('#f_phone').fill('+97670101199');page.locator('#dSave').click();page.wait_for_function("!document.getElementById('drawer').classList.contains('on')")
 assert store['lodges']['검증 호텔']['phone']=='+97670101199'
 page.locator('.res-card').click();page.locator('#f_phone').fill('UNSAVED');page.goto(base);page.go_back();page.locator('[data-t="lodges"]').click();page.locator('.res-card').click();assert page.locator('#f_phone').input_value()=='+97670101199'
 page.locator('#drawer .db').evaluate('(e)=>e.scrollTop=e.scrollHeight');page.wait_for_timeout(350);page.screenshot(path=str(evidence / 'admin-fields.png'))
 page.locator('#dX').click()
 # Build customer fixture using actual default quote, no production calls.
 page.goto(base+'확정일정표.html')
 q=page.evaluate('window.QUOTE');q['booking']={'assign':{'lodges':[dict(store['lodges']['검증 호텔'],name='검증 호텔',day=1)]}}
 page.evaluate('(q)=>localStorage.setItem("leaders_quote",JSON.stringify(q))',q)
 for filename,mobile in [('확정일정표.html',False),('확정일정표-모바일.html',True)]:
  page.set_viewport_size({'width':390 if mobile else 1280,'height':844 if mobile else 960})
  page.goto(base+filename);page.locator('.lodging-details').wait_for();detail=page.locator('.lodging-details')
  for text in ['고객용 숙소 소개','울란바타르 시내','생수','호텔 로비','수영장 공사 중']:assert text in detail.inner_text()
  assert 'SECRET' not in page.locator('body').inner_text()
  assert detail.locator('a[href^="tel:"]').count()==1
  card=detail.locator('..');assert card.locator('img').count()==3
  assert card.locator('img').evaluate_all('(els)=>els.map(e=>e.getAttribute("src"))')==selected
  detail.scroll_into_view_if_needed();page.screenshot(path=str(evidence / ('customer-mobile.png' if mobile else 'customer-desktop.png')))
  if not mobile:
   page.emulate_media(media='print');page.pdf(path=str(evidence / 'confirmed-itinerary.pdf'),format='A4',print_background=True);page.emulate_media(media='screen')
 # Legacy five-photo snapshot with no new fields must show three, preserving stored data.
 q['booking']['assign']['lodges']=[dict(legacy,name='구형 호텔',day=1)]
 page.evaluate('(q)=>localStorage.setItem("leaders_quote",JSON.stringify(q))',q);page.reload();page.locator('.lodging-details').wait_for()
 assert page.locator('.lodging-details').locator('..').locator('img').count()==3
 assert len(page.evaluate('JSON.parse(localStorage.leaders_quote).booking.assign.lodges[0].imgs'))==5
 assert page.locator('.lodging-details a[href^="tel:"]').count()==1
 assert page.locator('.lodging-details strong').all_text_contents()==['숙소 소개','주소','전화번호','객실 비치용품','운영 참고']
 page.locator('.lodging-details').scroll_into_view_if_needed();page.screenshot(path=str(evidence / 'legacy-customer-mobile.png'))
 page.set_viewport_size({'width':1280,'height':960});page.goto(base+'확정일정표.html');page.locator('.lodging-details').wait_for()
 assert page.locator('.lodging-details strong').all_text_contents()==['숙소 소개','주소','전화번호','객실 비치용품','운영 참고']
 page.locator('.lodging-details').scroll_into_view_if_needed();page.screenshot(path=str(evidence / 'legacy-customer-desktop.png'))
 page.pdf(path=str(evidence / 'legacy-confirmed-itinerary.pdf'),format='A4',print_background=True)
 # Actual booking editor -> PATCH capture, including preservation of old 5-image snapshot.
 fixture={'id':'local-test','name':'검증 고객','adult':2,'quote':q,'booking':{'assign':{'lodges':[dict(legacy,name='검증 호텔',day=1)]},'days':q['days']}}
 page.evaluate('(f)=>localStorage.setItem("leaders_booking_prefill",JSON.stringify(f))',fixture)
 page.goto(base+'예약관리.html');page.locator('.lodge-row').wait_for();page.wait_for_function('Object.keys(LIBS.lodges).length > 0')
 page.evaluate('save({quiet:true})')
 assert patches[-1]['booking']['assign']['lodges'][0]['address']==fields['address']
 assert patches[-1]['booking']['assign']['lodges'][0]['representativePhotos']==selected
 assert len(patches[-1]['booking']['assign']['lodges'][0]['imgs'])==5
 # Mobile administrator edits use the same fields without discarding archived photos.
 page.goto(base+'admin-mobile.html');page.wait_for_function('typeof App !== "undefined"')
 page.evaluate("PGS.resTab='lodges'; App.openPage('res'); App.resEdit('검증 호텔')")
 page.locator('[data-rf="address"]').fill('모바일에서 수정한 주소')
 page.locator('button[onclick="App.lodgePhoto(\'up\',1)"]').click()
 page.evaluate('App.resSave()');page.wait_for_function('PGS.resForm === null')
 assert store['lodges']['검증 호텔']['address']=='모바일에서 수정한 주소'
 assert len(store['lodges']['검증 호텔']['imgs'])==5
 page.evaluate("App.resEdit('검증 호텔')")
 assert page.locator('[data-rf="address"]').input_value()=='모바일에서 수정한 주소'
 page.locator('[data-rf="address"]').scroll_into_view_if_needed();page.screenshot(path=str(evidence / 'admin-mobile-fields.png'))
 assert not errors, errors
 browser.close()
print('PASS: save/reload/re-edit/repeat/cancel/back, 3-photo order/archive, desktop/mobile, PDF and legacy snapshot; no page errors; localhost-only fixtures.')
