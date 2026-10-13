import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('both admin pages pin identical root-relative content-hashed notice assets', () => {
  let previous;
  for (const page of ['예약관리.html','견적관리-모바일.html']) {
    const html = readFileSync(new URL(`../public/${page}`, import.meta.url),'utf8');
    const paths = [...html.matchAll(/(?:src|href)="(\/itinerary-notice\.([a-f0-9]{12})\.(?:js|css))"/g)];
    assert.equal(paths.length,2);
    for (const [,path,hash] of paths) {
      const content = readFileSync(new URL(`../public${path}`,import.meta.url));
      const legacyPath = path.replace(/\.[a-f0-9]{12}\./, '.');
      assert.deepEqual(readFileSync(new URL(`../public${legacyPath}`,import.meta.url)), content);
      assert.equal(createHash('sha256').update(content).digest('hex').slice(0,12),hash);
      for (const route of ['/예약관리','/예약관리/','/견적관리-모바일','/견적관리-모바일/']) {
        assert.equal(new URL(path,`https://site.test${route}`).pathname,path);
      }
    }
    const actual = paths.map(x=>x[1]);
    if (previous) assert.deepEqual(actual,previous);
    previous=actual;
    assert.doesNotMatch(html, /(?:src|href)="\/?itinerary-notice\.(?:js|css)(?:\?|" )/);
  }
});

test('lodging renderers and editors share the current content-hashed lodging asset', () => {
 for (const page of ['확정일정표.html','확정일정표-모바일.html','예약관리.html','리소스관리.html','견적관리-모바일.html']) {
  const html=readFileSync(new URL(`../public/${page}`,import.meta.url),'utf8');
  const match=html.match(/src="(\/lodging\.([a-f0-9]{12})\.js)"/);
  assert.ok(match,page);
  const content=readFileSync(new URL(`../public${match[1]}`,import.meta.url));
  assert.equal(createHash('sha256').update(content).digest('hex').slice(0,12),match[2]);
  assert.deepEqual(content,readFileSync(new URL('../public/lodging.js',import.meta.url)));
 }
});
