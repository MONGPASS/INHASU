"""Read-only old-booking/catalog render regression; local fixtures, all API calls mocked."""
import copy,json,os,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright
base=os.environ.get('INHASU_UI_BASE','http://127.0.0.1:8771/')
out=Path('/tmp/lodging-refresh-evidence');out.mkdir(exist_ok=True)
name='Birga fixture'
photos=['/img/quote/lodge-std.webp','/img/quote/lodge-lux.webp','/img/quote/lodge-tent.webp']
saved={'name':name,'day':1,'grade':'고급게르','desc':'예약 당시 보관용 소개','imgs':photos,'representativePhotos':photos}
library={name:{'grade':'호텔','address':'등록된 Birga 주소','phone':'+97670150550','sharedFacilities':'레스토랑 / 야생화 전망 공간','roomAmenities':'등록된 객실 비품','officialSources':'https://hotel.example/one\nhttps://hotel.example/two\nhttps://hotel.example/three','imgs':['/new.jpg'],'desc':'다른 소개','cost':999}}
mutations=[];errors=[];reads=[];quote={}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':1280,'height':960})
 ctx.add_init_script("sessionStorage.setItem('leaders_admin_token','local-fixture')")
 def route(r):
  u=r.request.url
  if not u.startswith(base):r.abort();return
  if '/api/' in u:
   if r.request.method!='GET':mutations.append(r.request.method);r.abort();return
   reads.append(u)
   if '/api/my/' in u:r.fulfill(json={'ok':True,'name':'TEST fixture','status':'예약확정','quote':quote,'booking':{'publishStatus':'published','assign':{'lodges':[saved]},'days':quote.get('days',[])}});return
   if '/api/data/' in u:
    key=u.split('/api/data/')[1].split('?')[0]
    r.fulfill(json={'ok':True,'data':library if key=='lodges' else [] if key=='lodge_cats' else {}});return
   r.fulfill(json={'ok':True,'items':[]});return
  r.continue_()
 ctx.route('**/*',route)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'확정일정표.html');quote=page.evaluate('window.QUOTE')
 original=copy.deepcopy(saved)
 for filename,mobile in [('확정일정표.html',False),('확정일정표-모바일.html',True)]:
  page.set_viewport_size({'width':390 if mobile else 1280,'height':844 if mobile else 960})
  page.goto(base+filename+'?t=local-test-token-123456789&m=0')
  detail=page.locator('.lodging-details')
  try: detail.wait_for(timeout=5000)
  except:
   print('BROWSER ERRORS',errors,'BODY',page.locator('body').inner_text()[:500]);raise
  text=detail.inner_text()
  for value in ['등록된 Birga 주소','+97670150550','레스토랑 / 야생화 전망 공간','고급게르']:assert value in text
  assert '다른 소개' not in text and '예약 당시' not in text
  assert detail.locator('a[href^="https://hotel.example/"]').count()==3
  assert detail.locator('..').locator('img').evaluate_all('(els)=>els.map(e=>e.getAttribute("src"))')==photos
  detail.scroll_into_view_if_needed();page.screenshot(path=str(out/('mobile.png' if mobile else 'desktop.png')))
  pdf=out/('mobile.pdf' if mobile else 'desktop.pdf');page.pdf(path=str(pdf),format='A4')
  text=''.join(subprocess.check_output(['pdftotext',str(pdf),'-']).decode().split())
  assert '70150550' in text and '야생화전망공간' in text and '고급게르' in text
  assert saved==original
 # New catalog metadata appears on reload while assigned choices remain unchanged.
 library[name]['phone']='+97670000000'
 page.reload();page.locator('.lodging-details').wait_for();assert '+97670000000' in page.locator('.lodging-details').inner_text()
 # Explicit booking overrides, including deliberate blanks, remain authoritative.
 saved['phone']='+97671111111';saved['address']='';saved['roomAmenities']='예약 전용 비품'
 page.reload();page.locator('.lodging-details').wait_for();text=page.locator('.lodging-details').inner_text()
 assert '+97671111111' in text and '예약 전용 비품' in text and '등록된 Birga 주소' not in text
 # No fuzzy matching / assignment substitution.
 saved['name']='Different lodging'
 page.reload();page.locator('.lodging-details').wait_for();assert '야생화 전망 공간' not in page.locator('.lodging-details').inner_text()
 # Both catalog UIs summarize structured fields even with an empty archived introduction.
 library[name]['desc']=''
 page.set_viewport_size({'width':1280,'height':960});page.goto(base+'리소스관리.html')
 page.locator('[data-t=lodges]').click();page.locator('.res-card').wait_for()
 assert '등록된 Birga 주소' in page.locator('.res-card').inner_text()
 assert '설명을 추가하세요' not in page.locator('.res-card').inner_text()
 page.screenshot(path=str(out/'catalog-desktop.png'))
 page.goto(base+'admin-mobile.html');page.wait_for_function('typeof App !== "undefined"')
 page.evaluate("PGS.resTab='lodges';App.openPage('res')")
 page.locator('.res-card').wait_for();assert '등록된 Birga 주소' in page.locator('.res-card').inner_text()
 assert '설명을 추가하세요' not in page.locator('.res-card').inner_text()
 page.screenshot(path=str(out/'catalog-mobile.png'))
 assert not mutations,mutations
 assert not errors,errors
 browser.close()
print('PASS: old snapshot enrichment, exact matching, overrides/blanks, live catalog refresh, photos/grade preservation, desktop/mobile PDFs and catalog summaries; zero API mutations')
