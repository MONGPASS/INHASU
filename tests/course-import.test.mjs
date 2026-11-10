import test from 'node:test';
import assert from 'node:assert/strict';
import { planCourse, planToBlocks, dayGaps, matchName, matchInSentence, nameKey, dayAliasKey, itemAliasKey, shortText } from '../src/components/admin/courseImport.ts';

const spot = (name, images = [`/${name}-1.webp`, `/${name}-2.webp`, `/${name}-3.webp`]) => ({ id: `quote-spot:${name}`, name_kr: name, summary: `${name} 한 줄 소개`, description: `${name}의 긴 설명입니다. 둘째 문장은 일정 항목에 넣지 않습니다.`, images, is_active: true });
const spots = [spot('차강소브라가'), spot('욜린암'), spot('홍고린엘스'), spot('칭기스칸 기마상'), spot('엘승타사르해'), spot('테를지 국립공원'), spot('공항 미팅', ['/meet.webp'])];
const hotels = [{ id: 'resource-lodge:고비 게르 캠프', name_kr: '고비 게르 캠프', images: ['/lodge-1.webp', '/lodge-2.webp'], amenities: ['샤워'], grade: '게르', is_active: true }];
const index = spots.map(s => ({ key: nameKey(s.name_kr), item: s }));

test('표기가 조금 다른 이름도 같은 여행지로 찾고, 관계없는 이름은 붙이지 않는다', () => {
    assert.equal(matchName('칭기즈칸기마상', index)?.name_kr, '칭기스칸 기마상');
    assert.equal(matchName('엘승타사르하이', index)?.name_kr, '엘승타사르해');
    assert.equal(matchName('테를지', index)?.name_kr, '테를지 국립공원');
    assert.equal(matchName('울란바토르', index), null);
    assert.equal(matchInSentence('차강소브라가 도착 / 침식지형 트래킹', index)?.name_kr, '차강소브라가');
    assert.equal(matchInSentence('칭기즈칸 기마상 전망대', index)?.name_kr, '칭기스칸 기마상');
    assert.equal(matchInSentence('점심식사 후 출발', index), null);
});

const course = {
    days: [
        { d: 1, dest: '차강소브라가<br>욜린암', move: '이동 10시간', dist: '(600 km)',
          items: ['09:30 공항 미팅 후 여행시작', '차강소브라가 도착 / 침식지형 트래킹', '(전망대, 트래킹)', '*숙소 도착'],
          stay: { name: '고비 게르 캠프', tags: ['전기 O'] }, meals: ['현지식당', '현지식당', '캠프식'] },
        { d: 2, dest: '홍고린엘스', move: '이동 5시간', dist: '', items: ['홍고린엘스 사막투어'], stay: { name: '여행자 캠프<br>(일반게르)', tags: ['샤워 O'] }, meals: ['캠프식', '허르헉', 'X'] },
        { d: 3, dest: '홍고린엘스', items: ['자유시간'], stay: { name: '숙소미포함', tags: [] }, meals: ['캠프식', '', 'X'] },
        { d: 4, dest: '울란바토르', items: ['시내 관광'], stay: { name: '', tags: [] }, meals: [] },
    ],
};

test('코스를 불러오면 일정 항목마다 여행지의 한 줄 소개와 사진 두 장이 들어간다', () => {
    const plan = planCourse(course, spots, hotels);
    const blocks = planToBlocks(plan, {}, 1);
    const days = blocks.filter(b => b.type === 'dayInfo').map(b => b.content);
    const d1 = days[0];
    assert.equal(d1.dayLabel, '1일차');
    assert.equal(d1.title, '차강소브라가 · 욜린암');
    assert.equal(d1.heroImage, '/차강소브라가-1.webp');
    // 대표 여행지의 앞 두 장은 일정 항목에 넣었으므로 나머지 한 장 + 일정 문구에 안 나온 둘째 목적지(욜린암) 사진 2장
    assert.deepEqual(d1.galleryImages, ['/차강소브라가-3.webp', '/욜린암-1.webp', '/욜린암-2.webp']);
    // 일차 소개에는 대표 여행지의 상세 설명이, 일정 항목에는 한 줄 소개가 들어간다 (서로 다른 글)
    assert.equal(d1.description, '차강소브라가의 긴 설명입니다. 둘째 문장은 일정 항목에 넣지 않습니다.\n\n이동 10시간 (600 km)');
    assert.deepEqual(d1.meals, { breakfast: '현지식당', lunch: '현지식당', dinner: '캠프식' });
    assert.equal(d1.accommodation, '고비 게르 캠프');
    assert.equal(d1.accommodationHotelId, 'resource-lodge:고비 게르 캠프');
    assert.deepEqual(d1.accommodationImages, ['/lodge-1.webp', '/lodge-2.webp']);

    const t = blocks.filter(b => b.type === 'timeline').map(b => b.content);
    assert.deepEqual([t[0].time, t[0].title, t[0].description, t[0].images], ['09:30', '공항 미팅 후 여행시작', '공항 미팅 한 줄 소개', ['/meet.webp']]);
    // 긴 설명이 아니라 한 줄 소개가 들어가고, 괄호 줄은 그 아래에 붙는다
    assert.deepEqual([t[1].title, t[1].description, t[1].images], ['차강소브라가 도착 / 침식지형 트래킹', '차강소브라가 한 줄 소개\n(전망대, 트래킹)', ['/차강소브라가-1.webp', '/차강소브라가-2.webp']]);
    assert.deepEqual([t[2].title, t[2].description, t[2].images], ['숙소 도착', '', []]);
    assert.deepEqual([t[3].title, t[3].description, t[3].images.length], ['홍고린엘스 사막투어', '홍고린엘스 한 줄 소개', 2]);

    // 등록 숙소에 없는 이름은 적힌 이름·태그만 남기고 「빈 자리」로 알린다
    assert.equal(days[1].accommodation, '여행자 캠프 (일반게르)');
    assert.deepEqual(days[1].accommodationAmenities, ['샤워 O']);
    assert.equal(days[1].meals.dinner, '');
    assert.deepEqual(dayGaps(plan[1], plan), { photo: false, lodging: true });

    // 같은 여행지가 이어지는 날은 배경만 다른 사진으로 넣고 사진·소개는 되풀이하지 않는다
    assert.equal(days[2].heroImage, '/홍고린엘스-2.webp');
    assert.deepEqual(days[2].galleryImages, []);
    assert.equal(days[2].description, '');
    assert.equal(days[2].accommodation, '');
    assert.deepEqual(t[4].images, []);

    assert.deepEqual(dayGaps(plan[3], plan), { photo: true, lodging: false });
    assert.equal(blocks.filter(b => b.type === 'divider').length, 3);
    assert.equal(new Set(blocks.map(b => b.id)).size, blocks.length);
});

test('직접 골라 둔 짝은 다음에 자동으로 쓰이고, 비워 둔 짝은 자동으로 채우지 않는다', () => {
    const first = planCourse(course, spots, hotels);
    const aliases = { spots: { [dayAliasKey(first[3])]: 'quote-spot:테를지 국립공원', [itemAliasKey(first[0].items[0])]: '' }, lodges: { [nameKey('고비 게르 캠프')]: '' } };
    const plan = planCourse(course, spots, hotels, aliases);
    assert.equal(plan[3].spot?.name_kr, '테를지 국립공원');
    assert.equal(plan[0].items[0].spot, null);
    assert.equal(plan[0].lodge, null);
    const days = planToBlocks(plan, { includeMove: false }, 1).filter(b => b.type === 'dayInfo').map(b => b.content);
    assert.equal(days[0].description, '차강소브라가의 긴 설명입니다. 둘째 문장은 일정 항목에 넣지 않습니다.');
    // 직접 고른 대표 여행지도 일차 소개와 일차 사진으로 들어간다
    assert.equal(days[3].description, '테를지 국립공원의 긴 설명입니다. 둘째 문장은 일정 항목에 넣지 않습니다.');
    assert.equal(days[3].galleryImages.length, 3);
});

test('불러오기 화면에서 고친 한 줄 설명이 그대로 들어간다', () => {
    const plan = planCourse(course, spots, hotels);
    plan[0].items[1].description = '하얀 탑 모양의 침식지형';
    plan[1].items[0].description = '';
    const t = planToBlocks(plan, {}, 1).filter(b => b.type === 'timeline').map(b => b.content);
    assert.equal(t[1].description, '하얀 탑 모양의 침식지형\n(전망대, 트래킹)');
    assert.deepEqual([t[3].description, t[3].images.length], ['', 2]);
});

test('한 줄 소개가 없으면 긴 설명의 첫 문장만 쓰고, 길면 줄인다', () => {
    assert.equal(shortText({ id: 'a', name_kr: 'a', summary: '  한 줄  ', description: '긴 설명' }), '한 줄');
    assert.equal(shortText({ id: 'a', name_kr: 'a', description: '첫 문장입니다. 둘째 문장입니다.\n다음 문단' }), '첫 문장입니다.');
    assert.equal(shortText({ id: 'a', name_kr: 'a', description: '가'.repeat(100) }), `${'가'.repeat(70)}…`);
    assert.equal(shortText(null), '');
});

test('다른 이름으로 적힌 문구도 찾고, 한 줄의 두 여행지는 나누며, 이동 문구보다 방문 문구에 사진을 붙인다', () => {
    const named = (name, aliases = []) => ({ ...spot(name), aliases });
    const library = [named('거북바위'), named('아리야발 사원', ['아리아발사원']), named('칭기즈칸기마상', ['칭키스칸 기마동상']), named('욜린암'), named('엘승타사르하이', ['미니사막']), named('유심·환전·장보기', ['유심 / 환전 / 장보기'])];
    const plan = planCourse({ days: [
        { d: 1, dest: '테를지', items: ['조식 후 욜린암 이동', '유심 / 환전 / 장보기', '거북바위 관람, 아리아발사원 관람', '거북바위 관람', '칭키스칸 기마동상', '테를지강 따라 숲 및 강을 건너 승마 체험'] },
        { d: 2, dest: '욜린암', items: ['욜린암 계곡 트래킹', '조식 후 미니사막 이동'] },
    ] }, library, []);
    const d1 = plan[0].items.map(item => [item.title, item.spot?.name_kr || '']);
    assert.deepEqual(d1, [
        ['조식 후 욜린암 이동', ''],
        ['유심 / 환전 / 장보기', '유심·환전·장보기'],
        ['거북바위 관람', '거북바위'],
        ['아리아발사원 관람', '아리야발 사원'],
        ['칭키스칸 기마동상', '칭기즈칸기마상'],
        ['테를지강 따라 숲 및 강을 건너 승마 체험', ''],
    ]);
    // 욜린암 사진은 이동 문구가 아니라 다음 날의 방문 문구에, 방문 문구가 없는 미니사막은 이동 문구에 붙는다
    assert.deepEqual(plan[1].items.map(item => item.spot?.name_kr || ''), ['욜린암', '엘승타사르하이']);
    assert.equal(plan[0].items[2].description, '거북바위 한 줄 소개');
});

test('여행 타입에 맞는 요금 열과 숙소 등급만 가져온다', async () => {
    const { coursePricing, suspiciousPricing, stayForPackage } = await import('../src/components/admin/courseImport.ts');
    const priced = { price: { deposit: 50000, balances: [{ pax: 3, economy: 1410000, full: 1520000 }, { pax: 2, economy: 1500000, full: 1570000 }, { pax: 5, economy: 120000, full: 1250000 }, { pax: 4, economy: 1370000, full: 1450000 }, { pax: 6, economy: 0, full: 0 }] },
        days: [{ d: 1, dest: '테를지', items: [], stay: { name: '일반/고급게르', tags: [] } }, { d: 2, dest: '울란바타르', items: [], stay: { name: '3성급/4성급호텔', tags: [] } }] };
    const full = coursePricing(priced, 'full'), value = coursePricing(priced, 'value');
    // 인원순으로 정렬하고, 금액이 없는 인원은 뺀다. 1인 가격 = 예약금 + 잔금
    assert.deepEqual(full, [
        { people: 2, pricePerPerson: 1620000, depositPerPerson: 50000, localPaymentPerPerson: 1570000 },
        { people: 3, pricePerPerson: 1570000, depositPerPerson: 50000, localPaymentPerPerson: 1520000 },
        { people: 4, pricePerPerson: 1500000, depositPerPerson: 50000, localPaymentPerPerson: 1450000 },
        { people: 5, pricePerPerson: 1300000, depositPerPerson: 50000, localPaymentPerPerson: 1250000 },
    ]);
    assert.deepEqual(value.map(o => o.localPaymentPerPerson), [1500000, 1410000, 1370000, 120000]);
    // 0을 하나 빠뜨린 금액은 확인을 권한다
    assert.deepEqual(suspiciousPricing(value), [5]);
    assert.deepEqual(suspiciousPricing(full), []);
    assert.deepEqual(coursePricing({ days: [] }, 'full'), []);

    assert.equal(stayForPackage('일반/고급게르', 'full'), '고급 게르');
    assert.equal(stayForPackage('일반/고급게르', 'value'), '일반 게르');
    assert.equal(stayForPackage('3성급/4성급 호텔', 'full'), '4성급 호텔');
    assert.equal(stayForPackage('여행자 캠프 (일반/고급게르)', 'value'), '여행자 캠프 (일반 게르)');
    assert.equal(stayForPackage('일반/고급게르', null), '일반/고급게르');
    assert.equal(stayForPackage('일반게르', 'full'), '일반게르');
    const plan = planCourse(priced, [], []);
    const stays = type => planToBlocks(plan, { packageType: type }, 1).filter(b => b.type === 'dayInfo').map(b => b.content.accommodation);
    assert.deepEqual(stays('full'), ['고급 게르', '4성급 호텔']);
    assert.deepEqual(stays('value'), ['일반 게르', '3성급 호텔']);
});

test('일차 소개는 상세 설명의 첫 문단을 문장 단위로 끊어 쓴다', async () => {
    const { introText } = await import('../src/components/admin/courseImport.ts');
    const long = `${'가'.repeat(80)}입니다. ${'나'.repeat(80)}입니다. 셋째 문장.`;
    assert.equal(introText({ id: 'a', name_kr: 'a', description: `${long}\n둘째 문단` }), `${'가'.repeat(80)}입니다. ${'나'.repeat(80)}입니다.`);
    assert.equal(introText({ id: 'a', name_kr: 'a', description: '짧은 설명.\n다음 문단' }), '짧은 설명.');
    assert.equal(introText({ id: 'a', name_kr: 'a', summary: '한 줄', description: '' }), '한 줄');
    assert.equal(introText(null), '');
});
