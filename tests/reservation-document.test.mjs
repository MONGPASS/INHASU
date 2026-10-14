import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoImportReservationDocument, reservationProductDays, reservationProductTerms, selectReservationProduct } from '../src/utils/reservationDocument.ts';

test('예약에 저장된 상품 ID를 동명·유사명보다 먼저 적용한다', () => {
    const products = [
        { id: 'old-tour', name: '고비 4일' },
        { id: 'booked-tour', name: '고비 4일' },
        { id: 'similar-tour', name: '고비 4일 프리미엄' },
    ];
    assert.equal(selectReservationProduct(products, 'booked-tour', '고비 4일'), products[1]);
    assert.equal(selectReservationProduct(products, 'deleted-tour', '고비 4일'), null);
    assert.equal(selectReservationProduct(products, undefined, '고비 4일'), null);
});

test('상품 ID가 없는 옛 예약은 유일한 정확 이름만 자동 선택한다', () => {
    const products = [{ id: 'a', name: '중앙 몽골 3일' }, { id: 'b', name: '고비 4일' }];
    assert.equal(selectReservationProduct(products, undefined, '고비 4일'), products[1]);
    for (const name of ['', '  ', undefined, '고비', '고비4일', '다른 상품']) {
        assert.equal(selectReservationProduct(products, undefined, name), null);
    }
    assert.equal(selectReservationProduct([{ id: 'blank', name: '' }], undefined, ''), null);
});

test('고객 문서가 저장되어 있으면 의도적으로 비운 일정도 상품으로 다시 채우지 않는다', () => {
    assert.equal(canAutoImportReservationDocument(null), true);
    assert.equal(canAutoImportReservationDocument(undefined), true);
    for (const saved of [{ days: [] }, { days: [{ day: 1, title: '고객 수정 일정' }] }, { documentSettings: {} }]) {
        assert.equal(canAutoImportReservationDocument(saved), false);
    }
    assert.equal(canAutoImportReservationDocument(null, true), false);
});

test('계약서를 먼저 편집해도 최초 문서에는 예약 상품 일정과 실제 포함조건을 채운다', () => {
    const product = { included: JSON.stringify([{ label: '한국어 가이드' }, '예약 숙소']), excluded: ['국제선 항공권'],
        itinerary_blocks: JSON.stringify([{ type: 'dayInfo', content: { title: '예약된 초원 여행' } }]) };
    assert.equal(canAutoImportReservationDocument(null), true);
    assert.equal(reservationProductDays(product)[0].title, '예약된 초원 여행');
    assert.deepEqual(reservationProductTerms(product), { included: ['한국어 가이드', '예약 숙소'], excluded: ['국제선 항공권'] });
    assert.deepEqual(reservationProductTerms({ included: [], excluded: [] }), { included: [], excluded: [] });
    assert.equal(canAutoImportReservationDocument({ days: [], documentSettings: { contract: { includedText: '고객 특약' } } }), false);
});

test('상품 문서의 DAY 사진·타임라인 시간·이미지·슬라이드·숙소를 모두 편집기에 전달한다', () => {
    const product = { itinerary_blocks: JSON.stringify([
        { type: 'dayInfo', content: { title: '사막 여행', description: '첫날 안내', heroImage: '/img/day-hero.webp',
            galleryImages: ['/img/day-gallery.webp'], meals: { lunch: '현지식' }, accommodation: '예약 숙소',
            accommodationImages: ['/img/lodge.webp'], accommodationAmenities: ['샤워실'], accommodationAddress: '고비' } },
        { type: 'timeline', content: JSON.stringify({ time: '09:30', title: '공항 출발', description: '가이드 미팅', images: ['/img/airport.webp'] }) },
        { type: 'image', content: '/img/map.webp' },
        { type: 'slide', content: { title: '은하수', images: ['/img/night-1.webp', '/img/night-2.webp'] } },
        { type: 'dayInfo', content: { title: '귀환' } },
    ]) };
    const days = reservationProductDays(product);
    assert.equal(days.length, 2);
    assert.deepEqual(days[0].images, ['/img/day-gallery.webp', '/img/day-hero.webp']);
    assert.equal(days[0].activities[0].time, '09:30');
    assert.deepEqual(days[0].activities.map(item => item.images), [
        ['/img/airport.webp'], ['/img/map.webp'], ['/img/night-1.webp', '/img/night-2.webp'],
    ]);
    assert.equal(days[0].activities[1].title, '');
    assert.equal(days[0].activities[1].description, '');
    assert.equal(days[0].meals.lunch, '현지식');
    assert.equal(days[0].accommodation.tags, '샤워실');
    assert.deepEqual(days[0].accommodation.images, ['/img/lodge.webp']);
    assert.equal(days[1].day, 2);
    assert.deepEqual(days[1].activities, []);
});

test('옛 이미지형 상품 일정도 사진을 잃지 않는 한 개의 DAY로 불러온다', () => {
    const days = reservationProductDays({ itineraryImages: ['/img/legacy-1.webp', '/img/legacy-2.webp'] });
    assert.equal(days.length, 1);
    assert.equal(days[0].day, 1);
    assert.deepEqual(days[0].activities[0].images, ['/img/legacy-1.webp', '/img/legacy-2.webp']);
    assert.equal(days[0].activities[0].description, '');
    assert.deepEqual(reservationProductDays({ itinerary_blocks: '{broken', itinerary_images: '[]' }), []);
});

test('가져온 일정 편집은 상품 캐시의 원본 사진·식사를 변경하지 않는다', () => {
    const product = { itineraryBlocks: [
        { type: 'dayInfo', content: { title: '테를지', meals: { lunch: '원본 식사' }, galleryImages: ['/img/original.webp'],
            accommodation: '기본 숙소', accommodationImages: ['/img/original-lodge.webp'] } },
        { type: 'timeline', content: { title: '산책', images: ['/img/original-activity.webp'] } },
    ] };
    const first = reservationProductDays(product);
    first[0].images.push('/img/customer.webp');
    first[0].meals.lunch = '고객 변경 식사';
    first[0].activities[0].images.push('/img/customer-activity.webp');
    first[0].accommodation.images.push('/img/customer-lodge.webp');
    const reopened = reservationProductDays(product);
    assert.deepEqual(reopened[0].images, ['/img/original.webp']);
    assert.equal(reopened[0].meals.lunch, '원본 식사');
    assert.deepEqual(reopened[0].activities[0].images, ['/img/original-activity.webp']);
    assert.deepEqual(reopened[0].accommodation.images, ['/img/original-lodge.webp']);
});
