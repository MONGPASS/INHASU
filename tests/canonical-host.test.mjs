import test from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';

test('운영 www 별칭은 검색 제외 페이지 대신 대표 주소로 영구 이동하고 고객 링크를 보존한다', async () => {
    let next=0; const response=await onRequest({request:new Request('https://www.mongolia-milkyway.com/견적서?t=private-example-token&x=1'),next:async()=>{next++;return new Response('noindex shell');}});
    assert.equal(response.status,308);const target=new URL(response.headers.get('location'));
    assert.equal(target.hostname,'mongolia-milkyway.com');assert.equal(decodeURIComponent(target.pathname),'/견적서');assert.equal(target.searchParams.get('t'),'private-example-token');assert.equal(next,0);
    assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');assert.equal(response.headers.get('X-Robots-Tag'),null);
});
test('www API 이동은 POST 메서드·본문을 유지하고 이중 슬래시가 외부 주소로 바뀌지 않는다', async () => {
    const request=new Request('https://www.mongolia-milkyway.com/api/requests',{method:'POST',body:'{"example":true}'});
    const response=await onRequest({request,next:async()=>{throw Error('must redirect first');}});assert.equal(response.status,308);assert.equal(request.bodyUsed,false);
    assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(new URL(response.headers.get('location')).pathname,'/api/requests');
    const double=await onRequest({request:new Request('https://www.mongolia-milkyway.com//evil.example/path'),next:async()=>new Response('unused')});assert.equal(new URL(double.headers.get('location')).hostname,'mongolia-milkyway.com');
});
test('대표 도메인·미리보기·로컬 주소에는 www 리다이렉트를 적용하지 않는다', async () => {
    for(const host of ['mongolia-milkyway.com','preview.inhasu.pages.dev','localhost:8800']){
        const response=await onRequest({request:new Request(`https://${host}/`),next:async()=>new Response('original',{status:200})});
        assert.equal(response.status,200);assert.equal(await response.text(),'original');assert.equal(response.headers.get('location'),null);
    }
});
