import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

test('both admin pages pin identical root-relative content-hashed notice assets', () => {
  let previous;
  for (const page of ['예약관리.html','admin-mobile.html']) {
    const html = readFileSync(new URL(`../${page}`, import.meta.url),'utf8');
    const paths = [...html.matchAll(/(?:src|href)="(\/itinerary-notice\.([a-f0-9]{12})\.(?:js|css))"/g)];
    assert.equal(paths.length,2);
    for (const [,path,hash] of paths) {
      const content = readFileSync(new URL(`..${path}`,import.meta.url));
      const legacyPath = path.replace(/\.[a-f0-9]{12}\./, '.');
      assert.deepEqual(readFileSync(new URL(`..${legacyPath}`,import.meta.url)), content);
      assert.equal(createHash('sha256').update(content).digest('hex').slice(0,12),hash);
      for (const route of ['/예약관리','/예약관리/','/admin-mobile','/admin-mobile/']) {
        assert.equal(new URL(path,`https://site.test${route}`).pathname,path);
      }
    }
    const actual = paths.map(x=>x[1]);
    if (previous) assert.deepEqual(actual,previous);
    previous=actual;
    assert.doesNotMatch(html, /(?:src|href)="\/?itinerary-notice\.(?:js|css)(?:\?|" )/);
  }
});
