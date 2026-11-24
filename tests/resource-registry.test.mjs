import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { build } from 'esbuild';

// 등록 정보(React) 계산과 숙소 표시 규칙(TS 이식본)을 묶어서 불러온다. 저장 형식은 옛 도구 public/리소스관리.html과 같아야 한다.
const load = async (entry) => {
    const out = await build({ entryPoints: [entry], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
    return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
};
const m = await load('src/components/admin/resourceRegistry.ts');
const ld = await load('src/utils/lodgingDisplay.ts');
const ctx = vm.createContext({ URL, console });
vm.runInContext(readFileSync('public/lodging.js', 'utf8'), ctx);
const Lodging = ctx.Lodging;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('숙소 표시 규칙의 TS 이식본은 public/lodging.js와 같은 결과를 낸다', () => {
    const records = [
        {},
        { grade: '고급게르' },
        { address: '테를지 국립공원', phone: '+976 9911-2233', roomAmenities: '수건', sharedFacilities: '식당' },
        { desc: '초원 한가운데 캠프입니다.\n전화: +976 9911 2233 늦은 시간 문자\n주소: 테를지\n객실 비치용품(일부 객실): 드라이어\n공식 출처: https://camp.example.mn 2025-01-01 공식 안내 기준 겨울 휴업' },
        { desc: '전화: 문의 바람\n출처: 블로그' },
        { phone: '+976 1111-1111', desc: '전화: +976 2222-2222' },
        { img: '/a.webp', imgs: ['/b.webp', 'javascript:alert(1)', 'https://user:pw@x.com/c.png', 'https://cdn.example.com/d.jpg', '/a.webp'] },
        { representativePhotos: ['/r1.webp', 'data:image/png;base64,AAAA', 'bad url', '/r2.webp', '/r3.webp'] },
    ];
    for (const record of records) {
        assert.deepEqual(plain(ld.displayDetails(record)), plain(Lodging.displayDetails(record)), JSON.stringify(record));
        assert.equal(ld.lodgingSummary(record), Lodging.summary(record));
        assert.deepEqual(ld.lodgingPhotos(record), plain(Lodging.photos(record)));
    }
    for (const value of ['/x.webp', '//evil.com/x', 'img/a.png', 'https://ok.example/x', 'http://u:p@x.com', 'ftp://x', 42, 'data:image/svg+xml;base64,AA']) {
        assert.equal(ld.imageUrl(value), Lodging.imageUrl(value), String(value));
        assert.equal(ld.webUrl(value), Lodging.webUrl(value), String(value));
    }
    assert.deepEqual([...ld.LODGING_FIELDS], [...Lodging.fields]);
});

test('편집 칸 → 저장: 고치지 않으면 원래와 같고(모르는 칸 보존), 사진은 옛 도구 규칙으로 정리된다', () => {
    const guide = { nameEn: 'Bilguun', phone: '+976 1', role: '전문 가이드', qr: '/qr.webp', desc: '소개', img: '/g.webp', languages: ['한국어'], _fromResources: true };
    const g = m.formFromResource('guides', '빌궁', guide);
    assert.deepEqual(plain(m.resourceFromForm('guides', g, guide)), guide);

    const lodge = { region: '테를지', grade: '고급게르', tags: '샤워', desc: '', address: '주소', phone: '', roomAmenities: '', sharedFacilities: '', operatingNotes: '', officialSources: '',
        img: '/l1.webp', imgs: ['/l1.webp', '/l2.webp', '/old.webp'], representativePhotos: ['/l1.webp', '/l2.webp'], checkIn: '14:00' };
    const l = m.formFromResource('lodges', '스타캠프', lodge);
    const pool = m.photoState('lodges', lodge).pool;
    assert.deepEqual(l.photos, ['/l1.webp', '/l2.webp']);
    assert.deepEqual(pool, ['/l1.webp', '/l2.webp', '/old.webp'], '보관 사진(대표가 아닌 것)도 풀에 남는다');
    const saved = m.resourceFromForm('lodges', { ...l, photos: ['/l2.webp', '/new.webp'] }, lodge, { pool: [...pool, '/new.webp'] });
    assert.deepEqual(saved.representativePhotos, ['/l2.webp', '/new.webp']);
    assert.equal(saved.img, '/l2.webp');
    assert.deepEqual(saved.imgs, ['/l1.webp', '/l2.webp', '/old.webp', '/new.webp'], '대표에서 뺀 사진도 보관 사진으로 남는다');
    assert.equal(saved.checkIn, '14:00');

    const vehicle = { seats: '6인', luggage: '4개', plate: '12가', driver: 'Bat', phone: '+976', desc: '', img: '/v1', imgs: ['/v1', '/v2', '/v3', '/v4', '/v5'] };
    const v = m.formFromResource('vehicles', '스타렉스', vehicle);
    const state = m.photoState('vehicles', vehicle);
    assert.deepEqual(state.extra, ['/v4', '/v5']);
    const savedV = m.resourceFromForm('vehicles', { ...v, photos: ['/v3', '/v1'] }, vehicle, { extraPhotos: state.extra });
    assert.deepEqual([savedV.img, savedV.imgs], ['/v3', ['/v3', '/v1', '/v4', '/v5']], '4번째 이후 사진은 그대로 보관');

    const fresh = m.resourceFromForm('guides', m.formFromResource('guides', '새 가이드', undefined), undefined);
    assert.deepEqual(fresh, { img: '', nameEn: '', phone: '', role: '', qr: '', desc: '' });
    assert.equal(m.formFromResource('lodges', '', undefined, '홉스골').fields.region, '홉스골', '지역을 고른 채 추가하면 그 지역');
    assert.ok(m.officialSourcesValid('https://a.mn\n\nhttp://b.mn'));
    assert.ok(!m.officialSourcesValid('https://a.mn\nwww.b.mn'));
});

test('숙소 지역: 저장된 목록 + 숙소에만 있는 지역, 이름 바꾸기·삭제(숙소는 미분류로)', () => {
    const lodges = { A: { region: '테를지' }, B: { region: '서부' }, C: { region: '' }, D: { region: '테를지' } };
    assert.deepEqual(m.mergeLodgeCats(lodges, ['중앙몽골', '테를지', '중앙몽골']), ['중앙몽골', '테를지', '서부']);
    assert.equal(m.lodgeCatCount(lodges, '테를지'), 2);
    assert.equal(m.lodgeNoneCount(lodges), 1);
    const renamed = m.renameLodgeCat(lodges, ['테를지', '서부'], '테를지', '테를지 국립공원');
    assert.deepEqual(renamed.cats, ['테를지 국립공원', '서부']);
    assert.equal(renamed.lodges.D.region, '테를지 국립공원');
    const removed = m.deleteLodgeCat(lodges, ['테를지', '서부'], '서부');
    assert.deepEqual(removed.cats, ['테를지']);
    assert.equal(removed.lodges.B.region, '');
    assert.equal(m.catNameProblem(' 미분류 ', []), 'reserved');
    assert.equal(m.catNameProblem('서부', ['서부']), 'duplicate');
    assert.equal(m.catNameProblem('서부', ['서부'], '서부'), null);
    assert.deepEqual(m.entriesInRegion('lodges', lodges, m.NONE).map(([n]) => n), ['C']);
    assert.deepEqual(m.entriesInRegion('lodges', lodges, '테를지').map(([n]) => n), ['A', 'D']);
    assert.equal(m.entriesInRegion('guides', lodges, '테를지').length, 4, '지역은 숙소에만 적용');
});

test('종류 칩 순서·이번 달 이용 현황·이름 바꾸기 자리', () => {
    const guides = { a: { role: '드라이빙 가이드' }, b: { role: '가이드' }, c: { role: '통역' }, d: { role: '가이드' }, e: { role: '' } };
    assert.deepEqual(m.typeChoices('guides', Object.entries(guides)), ['가이드', '드라이빙 가이드', '통역']);
    assert.equal(m.typeTone('전문 가이드 + 기사'), 'tag-blue', '공백 무시');
    assert.equal(m.typeTone('모르는 값'), 'neutral');
    const items = [
        { key: 'product:1', status: 'confirmed', startDate: '2026-11-20', endDate: '2026-11-25', assignment: { guide: { name: '빌 궁' }, vehicle: { type: '스타렉스' }, accommodations: [{ accommodation: { name: '스타캠프' } }, { accommodation: { name: '스타캠프' } }] } },
        { key: 'quote_booking:2', status: '예약확정', startDate: '2026-10-29', endDate: '2026-11-02', assignment: { guide: { name: '빌궁' } } },
        { key: 'product:3', status: 'cancelled', startDate: '2026-11-10', endDate: '2026-11-12', assignment: { guide: { name: '빌궁' } } },
        { key: 'product:4', status: 'confirmed', startDate: '2026-12-01', endDate: '2026-12-03', assignment: { guide: { name: '빌궁' } } },
    ];
    const usage = m.countUsage(items, new Date(2026, 10, 24));
    assert.equal(usage.guides['빌궁'], 2, '이번 달에 걸친 활성 예약만, 띄어쓰기 무시');
    assert.equal(usage.lodges['스타캠프'], 1, '같은 예약의 여러 밤은 한 번');
    assert.deepEqual(m.usageText('guides', usage, '빌 궁'), { on: true, text: '이번 달 2팀' });
    assert.deepEqual(m.usageText('vehicles', usage, '하이에이스'), { on: false, text: '이번 달 이용 없음' });
    assert.throws(() => m.countUsage(undefined, new Date()));
    assert.deepEqual(Object.keys(m.putResource({ a: {}, b: {}, c: {} }, 'b', 'z', {})), ['a', 'z', 'c']);
    assert.deepEqual(m.chipValues('vehicles', { x: { seats: '9인' } }, '6인'), ['9인', '6인']);
});

test('가이드·숙소·차량 메뉴는 React 화면(등록 정보 + 가이드 배정 현황)으로 열리고 같은 자료를 쓴다', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const own = app.indexOf('path="/admin/quote-desk/resources"');
    assert.ok(own > 0 && own < app.indexOf('path="/admin/quote-desk/:tool?"'), '견적 도구 iframe보다 앞에서 잡는다');
    const page = readFileSync('src/pages/AdminResourceManage.tsx', 'utf8');
    for (const key of ["mapKey: 'guides'", "mapKey: 'lodges'", "catsKey: 'lodge_cats'", "mapKey: 'vehicles'"]) assert.ok(page.includes(key), key);
    assert.match(page, /<GuideSchedule accountId=/, '가이드 배정 현황은 기존 화면 그대로');
    assert.match(page, /resourceScheduleView\(params\)/, '?view·?resourceType 규칙은 예전과 같다');
    assert.match(page, /'leaders_resource_view'/, '카드·목록 보기 값도 옛 도구와 같은 키');
    assert.match(page, /uploadQuoteImage\(file, libs\[editor\.kind\]\.token\(\), 1200, 0\.82\)/, '사진은 옛 도구와 같은 크기·화질로 /api/upload?folder=images');
});
