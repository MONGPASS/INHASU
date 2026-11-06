import test from 'node:test';
import assert from 'node:assert/strict';
import { isUpcomingTour, tripLengthLabel, tourMonthLabel, tourSerials, roomPlanLabel, sheetAreaFor, packagePlanFromGrades, ROOM_PLAN_OPTIONS, LODGE_GRADE_OPTIONS, ASSIGN_TYPE_OPTIONS, LODGE_AREA_OPTIONS } from '../src/utils/accommodationSheet.ts';
import { CATEGORY_OPTIONS } from '../src/utils/reservationWorkspace.ts';

test('오늘 이후(오늘 포함) 진행되는 투어만 숙소 배정 대상이다', () => {
    const today = '2026-11-06';
    assert.equal(isUpcomingTour({ startDate: '2026-12-31', endDate: '2027-01-03' }, today), true);
    assert.equal(isUpcomingTour({ startDate: '2026-11-01', endDate: '2026-11-06' }, today), true, '오늘 끝나는 투어');
    assert.equal(isUpcomingTour({ startDate: '2026-11-01', endDate: '2026-11-10' }, today), true, '진행 중인 투어');
    assert.equal(isUpcomingTour({ startDate: '2026-09-14', endDate: '2026-11-05' }, today), false);
    assert.equal(isUpcomingTour({ startDate: '2026-09-14', endDate: '2026-08-17' }, today), false, '종료일이 잘못된 지난 투어');
    assert.equal(isUpcomingTour({ startDate: '2026-12-01' }, today), true);
    assert.equal(isUpcomingTour({ startDate: '2026-10-01T15:00:00.000Z' }, today), false);
    assert.equal(isUpcomingTour({}, today), true, '날짜가 없는 예약은 확인이 필요하므로 남긴다');
});

test('일정·투어 월·일련번호를 시트 표기로 계산한다', () => {
    assert.equal(tripLengthLabel('2026-12-31', '2027-01-03'), '3박4일');
    assert.equal(tripLengthLabel('2026-12-01', '2026-12-01'), '당일');
    assert.equal(tripLengthLabel('2026-12-01', '2026-12-12'), '10박이상');
    assert.equal(tripLengthLabel('2026-12-01'), '미정');
    assert.equal(tripLengthLabel('2026-12-05', '2026-12-01'), '미정');
    assert.equal(tourMonthLabel('2027-02-06'), '2월'); assert.equal(tourMonthLabel(''), '미정');
    const serials = tourSerials([{ id: 'c', createdAt: '2026-10-03' }, { id: 'a', createdAt: '2026-10-01' }, { id: 'b', createdAt: '2026-10-01', startDate: '2026-12-01' }]);
    assert.deepEqual([...serials], [['a', 1], ['b', 2], ['c', 3]]);
});

test('시트 선택지는 기존 저장 표기를 유지하며 시트 목록을 담는다', () => {
    assert.deepEqual(ROOM_PLAN_OPTIONS.slice(0, 4).map(o => [o.value, o.label]), [['1 хүн/өрөө', '1인1실'], ['2 хүн/өрөө', '2인1실'], ['3 хүн/өрөө', '3인1실'], ['4 хүн/өрөө', '4인1실']]);
    assert.equal(roomPlanLabel('골프오전'), '골프오전'); assert.equal(roomPlanLabel('예전 값'), '예전 값');
    for (const grade of ['고급 게르', '4성급호텔', '목조하우스', '디럭스 게르', '3성급 호텔', '게스트하우스', '골프장', 'Tureesiin bair', '이용x/개별']) assert.ok(LODGE_GRADE_OPTIONS.includes(grade), grade);
    assert.deepEqual(ASSIGN_TYPE_OPTIONS, ['1인1실', '2인1실', '3인1실', '4인1실', '골프오전', '골프오후', '이용x/개별']);
    assert.equal(LODGE_AREA_OPTIONS.length, 19);
    for (const category of ['여행사', '학회/협회', '학교행사', '정부행사', '가족여행', '개인', '종교행사', '기타행사', '산악회', '우정여행', '골프투어', '출장/세미나', '승마투어']) assert.ok(CATEGORY_OPTIONS.includes(category), category);
});

test('계약 일정의 지역은 시트 지명으로 바꾸고 목록에 없는 지역은 그대로 둔다', () => {
    for (const [from, to] of [['테를지 국립공원', 'Terelj'], ['테렐지', 'Terelj'], ['울란바토르', 'UB'], ['울란바타르 시내', 'UB'], ['엘승타사르해', 'Elsen tasarkhai'],
        ['카라코룸', 'Kharkhorin'], ['하르허린', 'Kharkhorin'], ['홉스굴', 'Huvsgul'], ['쳉헤르 온천', 'Tsenher'], ['어르헝폭포', 'Orkhon hurhree'], ['어기호수', 'UgiiNuur'],
        ['차강소브라가', 'Tsagaansuvarga'], ['욜링암', 'Yoliin am'], ['바양작', 'Bayanzag'], ['홍고린엘스', 'Khongoriin els'], ['바가가즈링촐로', 'Baga gazriin chuluu'], ['UB', 'UB']]) {
        assert.equal(sheetAreaFor(from), to, from);
    }
    for (const area of ['Terelj', 'UB', 'Huvsgul']) assert.ok(LODGE_AREA_OPTIONS.includes(sheetAreaFor(area)), area);
    assert.equal(sheetAreaFor('중앙몽골'), '중앙몽골'); assert.equal(sheetAreaFor('남고비'), '남고비');
    assert.equal(sheetAreaFor(''), ''); assert.equal(sheetAreaFor(undefined), '');
});

test('배정한 숙박 등급으로 풀패키지·실속·혼합을 판단한다', () => {
    assert.equal(packagePlanFromGrades(['고급 게르', '4성급호텔', '디럭스 게르']), 'full');
    assert.equal(packagePlanFromGrades(['일반 게르', '3성급 호텔', '게스트하우스']), 'value');
    assert.equal(packagePlanFromGrades(['고급 게르', '일반 게르']), 'mixed');
    assert.equal(packagePlanFromGrades(['5성급 호텔', '이용x/개별', '골프장', undefined]), 'full', '개별 이용·골프장은 판단에서 뺀다');
    assert.equal(packagePlanFromGrades(['', undefined, '이용x/개별']), null);
});
