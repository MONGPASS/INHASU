"""Local browser regression. All APIs/provider traffic are mocked; no real sends."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

base = os.environ.get('INHASU_UI_BASE', 'http://127.0.0.1:8765/')
evidence = Path('/tmp/task3-ui-evidence')
evidence.mkdir(exist_ok=True)
fixture = {'id':'local-test', 'name':'TEST', 'phone':'01000007901', 'status':'완료', 'depart':'2026-09-12', 'return_':'2026-09-15', 'adult':4, 'token':'local-token', 'booking':{'publishStatus':'published','days':[{'d':1}], 'assign':{'guide':{'name':'Guide'}, 'vehicle':{'model':'Van'}, 'lodges':[]}}}
posts, mutations, errors, previews = [], [], [], []
state = {'dispatch':None, 'collision':False, 'unknown':False, 'unauthorized':False}

def preview():
    return {'ok':True, 'eligible':True, 'ready':not state['collision'], 'booking':fixture,
        'payload':{'phone':fixture['phone'],'templateId':'itinerary', 'variables':{'#{고객명}':'TEST','#{회사명}':'은하수','#{링크}':'%ED%99%95%EC%A0%95%EC%9D%BC%EC%A0%95%ED%91%9C.html?t=local-token'}},
        'template':{'name':'확정일정표 안내','status':'APPROVED','content':'#{고객명}님, 확정일정표가 준비되었습니다.\n#{회사명}\n<img src=x onerror=alert(1)>'},
        'configuration':{'itineraryTemplateId':'quote' if state['collision'] else 'itinerary', 'quoteTemplateId':'quote','sameTemplate':state['collision']},
        'discovery':{'ok':True,'profileId':'exact-profile','fetchedCount':2,'excludedCount':1,'limit':100,'complete':False,'templates':[{'templateId':'approved-itinerary','pfId':'exact-profile','name':'확정일정표','status':'APPROVED','content':'#{고객명}님, 여행 일정표 안내 <script>bad()</script>','variables':['#{고객명}','#{링크}'],'buttons':[{'buttonType':'WL','linkMo':'https://example.test/#{링크}'}]}]},
        'quoteTemplate':{'name':'견적서 안내','content':'견적서가 도착했습니다.'}, 'dispatch':state['dispatch']}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = browser.new_context(viewport={'width':1280,'height':960})
    def route(r):
        u = r.request.url
        if not u.startswith(base): r.abort(); return
        if u.endswith('/itinerary-notice.js'): raise AssertionError('unversioned stale script requested')
        if '/api/' in u:
            if r.request.method not in ('GET','HEAD'): mutations.append(r.request.method)
            if '/itinerary-notice' in u:
                assert r.request.headers.get('x-admin-token') == 'local-fixture'
                assert 'local-fixture' not in u
                if r.request.method == 'GET':
                    previews.append(u)
                    r.fulfill(status=401 if state['unauthorized'] else 200, json={'ok':False} if state['unauthorized'] else preview()); return
                posts.append(r.request.post_data_json)
                state['dispatch'] = {'state':'unknown' if state['unknown'] else 'accepted', 'result':{'groupId':'mock-only'}}
                r.fulfill(status=502 if state['unknown'] else 200,json={'ok':not state['unknown'], **state['dispatch']}); return
            if '/api/data/' in u: r.fulfill(json={'ok':True,'data':{}}); return
            r.fulfill(json={'ok':True,'items':[fixture]}); return
        r.continue_()
    ctx.route('**/*',route)
    ctx.add_init_script("sessionStorage.setItem('leaders_admin_token','local-fixture');localStorage.setItem('leaders_booking_prefill'," + json.dumps(json.dumps(fixture)) + ")")
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(base+os.environ.get('INHASU_BOOKING_PATH','예약관리.html'))
    page.get_by_role('button',name='확정일정표 알림',exact=True).click()
    dialog=page.get_by_role('dialog')
    dialog.get_by_text('발송 준비 완료',exact=False).wait_for()
    assert posts==[] and mutations==[]
    assert dialog.locator('[data-notice=discovery]').get_attribute('open') is not None
    dialog.get_by_text('확정일정표 · APPROVED · approved-itinerary',exact=True).click()
    assert 'exact-profile' in dialog.locator('[data-notice="discovery-status"]').inner_text()
    assert '전체 목록임을 보장하지 않습니다' in dialog.locator('[data-notice="discovery-status"]').inner_text()
    metadata=dialog.locator('[data-notice="discovery-list"]').inner_text()
    assert '#{고객명}' in metadata and 'https://example.test/#{링크}' in metadata
    assert dialog.locator('script').count()==0
    assert posts==[] and mutations==[]
    assert dialog.get_by_role('button',name='확정일정표 알림 1회 발송').is_disabled()
    page.screenshot(path=str(evidence/'template-discovery.png'))
    dialog.get_by_text('현재 채널 템플릿 조회 (읽기 전용)',exact=True).click()
    assert '01000007901' in dialog.locator('[data-notice="recipient"]').inner_text()
    assert '4명' in dialog.locator('[data-notice="trip"]').inner_text()
    assert 'TEST님, 확정일정표가 준비되었습니다.' in dialog.locator('pre').first.inner_text()
    assert dialog.locator('img').count()==0 # Template text is never HTML.
    send=dialog.get_by_role('button',name='확정일정표 알림 1회 발송')
    assert send.is_disabled()
    dialog.get_by_role('checkbox').check()
    page.screenshot(path=str(evidence/'desktop-preview.png'))
    send.evaluate('(button)=>{button.click();button.click()}')
    dialog.get_by_text('발송 요청이 접수됐어요.',exact=False).wait_for()
    assert len(posts)==1 and mutations==['POST']
    assert posts[0]['idempotencyKey']=='itinerary-admin-v1-local-test'
    assert send.is_disabled()
    dialog.get_by_role('button',name='닫기',exact=True).click()
    page.reload()
    page.get_by_role('button',name='확정일정표 알림',exact=True).click()
    dialog.get_by_text('발송 요청이 접수됐어요.',exact=False).wait_for()
    assert dialog.get_by_role('checkbox').is_disabled()
    dialog.get_by_role('button',name='닫기',exact=True).click()
    # Mobile entry via normal booking UI; same ledger prevents another send.
    page.set_viewport_size({'width':390,'height':844})
    page.goto(base+'admin-mobile.html')
    page.get_by_role('button',name='예약관리',exact=True).click()
    page.locator('.bk-head').first.click()
    page.get_by_role('button',name='확정일정표 알림',exact=True).click()
    dialog.get_by_text('발송 요청이 접수됐어요.',exact=False).wait_for()
    assert dialog.get_by_role('checkbox').is_disabled()
    assert dialog.evaluate('(d)=>d.scrollWidth<=d.clientWidth')
    page.screenshot(path=str(evidence/'mobile-sent.png'))
    dialog.get_by_role('button',name='닫기',exact=True).click()
    # Configuration collision: show evidence and prohibit the send.
    state.update(dispatch=None,collision=True)
    page.get_by_role('button',name='확정일정표 알림',exact=True).click()
    dialog.get_by_text('견적서와 같은 템플릿',exact=False).wait_for()
    assert dialog.get_by_role('checkbox').is_disabled()
    dialog.get_by_text('템플릿·링크 설정 확인',exact=True).click()
    assert '견적서가 도착했습니다.' in dialog.locator('[data-notice="config"]').inner_text()
    page.screenshot(path=str(evidence/'mobile-template-collision.png'))
    dialog.get_by_role('button',name='닫기',exact=True).click()
    # Unknown provider outcome stays locked, including reopening.
    state.update(collision=False,unknown=True)
    page.get_by_role('button',name='확정일정표 알림',exact=True).click()
    dialog.get_by_text('발송 준비 완료',exact=False).wait_for()
    dialog.get_by_role('checkbox').check()
    dialog.get_by_role('button',name='확정일정표 알림 1회 발송').click()
    dialog.get_by_text('중복 발송을 막았습니다.',exact=False).wait_for()
    assert dialog.get_by_role('checkbox').is_disabled()
    dialog.get_by_role('button',name='닫기',exact=True).click()
    page.get_by_role('button',name='확정일정표 알림',exact=True).click()
    dialog.get_by_text('중복 발송을 막았습니다.',exact=False).wait_for()
    assert dialog.get_by_role('checkbox').is_disabled()
    dialog.get_by_role('button',name='닫기',exact=True).click()
    state['unauthorized']=True
    page.get_by_role('button',name='확정일정표 알림',exact=True).click()
    dialog.get_by_text('로그인이 만료됐어요.',exact=False).wait_for()
    assert dialog.locator('[data-notice="preview"]').is_hidden()
    assert len(posts)==2 and posts[0]['idempotencyKey']==posts[1]['idempotencyKey']
    assert errors==[], errors
    browser.close()
print('PASS: desktop/mobile preview, deliberate send, double click, reload, shared key, collision, unknown outcome, auth, text safety; all API calls mocked')
