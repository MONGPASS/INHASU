import test from 'node:test';
import assert from 'node:assert/strict';
import { customerProductReference } from '../src/utils/customerProductReference.ts';

test('예약 상품 ID가 동명 상품과 변경된 이름보다 우선하며 저장된 상품 사진만 선택한다', () => {
    const reservation = Object.freeze({ productId: 'tour-a', productName: '예약 당시 이름' });
    const products = Object.freeze([
        Object.freeze({ id: 'tour-b', name: '예약 당시 이름', thumbnail: '/wrong.webp' }),
        Object.freeze({ id: 'tour-a', name: '변경된 상품명', thumbnail: '/api/images/saved.webp', mainImages: ['/second.webp'] }),
    ]);
    assert.deepEqual(customerProductReference(reservation, products), {
        name: '예약 당시 이름', href: '/products/tour-a', image: '/api/images/saved.webp', match: 'id',
    });
});

test('삭제되거나 조회되지 않은 ID는 명시적인 링크만 유지하고 동명 상품의 이미지를 빌리지 않는다', () => {
    const reservation = { productId: 'deleted-tour', productName: '고비 여행' };
    const expected = { name: '고비 여행', href: '/products/deleted-tour', match: 'stored' };
    assert.deepEqual(customerProductReference(reservation, [{ id: 'other', name: '고비 여행', thumbnail: '/wrong.webp' }]), expected);
    assert.deepEqual(customerProductReference(reservation, null), expected);
    assert.deepEqual(customerProductReference(reservation, undefined), expected);
});

test('ID가 없는 옛 예약은 공백을 정규화한 정확한 상품명이 한 건일 때만 연결한다', () => {
    const products = [{ id: 'legacy', name: '  고비\n 여행 ', main_images: '["/saved.webp"]' }];
    assert.deepEqual(customerProductReference({ productName: '고비  여행' }, products), {
        name: '고비 여행', href: '/products/legacy', image: '/saved.webp', match: 'name',
    });
    assert.deepEqual(customerProductReference({ productName: '고비' }, products), { name: '고비', match: 'stored' });
    assert.deepEqual(customerProductReference({ productName: '고비 여행' }, [...products, { id: 'duplicate', name: '고비 여행', thumbnail: '/duplicate.webp' }]), {
        name: '고비 여행', match: 'stored',
    });
});

test('상품 ID의 0과 특수문자는 보존하면서 공개 경로의 한 세그먼트로 인코딩한다', () => {
    assert.deepEqual(customerProductReference({ productId: 0 }, [{ id: '0', name: '0번 상품' }]), {
        name: '0번 상품', href: '/products/0', match: 'id',
    });
    const id = '한글 /상품?x=1#section';
    assert.equal(customerProductReference({ productId: id }, [])?.href, `/products/${encodeURIComponent(id)}`);
});

test('비정상 ID는 동명 상품으로 대체하지 않고 상품 정보가 전혀 없으면 숨긴다', () => {
    const rows = [{ id: 'same', name: '같은 이름', thumbnail: '/wrong.webp' }];
    for (const productId of [{}, [], NaN, Infinity, '.', '..', '\u0000bad', '\ud800']) {
        assert.deepEqual(customerProductReference({ productId, productName: '같은 이름' }, rows), { name: '같은 이름', match: 'stored' });
    }
    assert.deepEqual(customerProductReference({ productId: ' ', productName: '같은 이름' }, rows), {
        name: '같은 이름', href: '/products/same', image: '/wrong.webp', match: 'name',
    });
    assert.equal(customerProductReference({}, rows), undefined);
    assert.equal(customerProductReference(null, rows), undefined);
    assert.equal(customerProductReference({ productName: ' ' }, rows), undefined);
    assert.deepEqual(customerProductReference({ productName: '같은 이름' }, [{ name: '같은 이름', thumbnail: '/unlinked.webp' }]), { name: '같은 이름', match: 'stored' });
});

test('저장 사진은 대표 이미지 다음 본문 배열 순으로 고르고 잘못된 JSON과 URL은 건너뛴다', () => {
    const reservation = { productId: 'a', productName: '등록 상품' };
    const resolve = product => customerProductReference(reservation, [{ id: 'a', ...product }]);
    assert.equal(resolve({ thumbnail: 'https://saved.example/tour.webp', mainImages: ['/fallback.webp'] }).image, 'https://saved.example/tour.webp');
    assert.equal(resolve({ thumbnail: 'javascript:alert(1)', mainImages: '[null, 4, {"url":"/object.webp"}, "data:image/png;base64,test", "/valid.webp"]' }).image, '/valid.webp');
    assert.equal(resolve({ mainImages: '{not JSON', main_images: '["/snake.webp"]' }).image, '/snake.webp');
    assert.equal(resolve({ mainImages: { 0: '/invalid.webp' }, main_images: '"/not-an-array.webp"' }).image, undefined);
    assert.equal(resolve({ mainImages: ['images/relative.webp'] }).image, 'images/relative.webp');
    for (const thumbnail of ['//unverified.example/a.webp', '\\unverified\\a.webp', 'https://user:secret@example.com/a.webp', 'https://', 'blob:fake', '/path\nimage.webp', '#only', '?only']) {
        assert.equal(resolve({ thumbnail }).image, undefined, thumbnail);
    }
});
