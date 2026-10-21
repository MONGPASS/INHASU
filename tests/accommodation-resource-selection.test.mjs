import test from 'node:test';
import assert from 'node:assert/strict';
import { selectResourceGuide, selectResourceVehicle, selectResourceLodge } from '../src/utils/accommodationResourceSelection.ts';
import { editorAssignment, writeAssignmentDraft, readAssignmentDraft } from '../src/utils/adminAssignmentDraft.ts';

const guide = { id: 'resource-guide:공통 가이드', name: '공통 가이드', phone: '', image: '/guide.webp', introduction: '공개 소개',
    nameEn: 'Guide', role: '현지 가이드', languages: ['한국어'], specialties: ['고비'], qr: 'PRIVATE-QR', memo: 'PRIVATE-MEMO' };
const vehicle = { name: '공통 하이이스', type: '공통 하이이스', phone: 'REGISTERED-DRIVER', snapshot: {
    img: '/car.webp', images: ['/car.webp', '/inside.webp'], description: '공개 차량 안내', seats: '6인', luggage: '4개', plate: 'PRIVATE-PLATE', memo: 'PRIVATE-MEMO' } };
const lodge = { id: 'resource-lodge:공통 숙소', name: '공통 숙소', type: '고급 게르', region: '테를지', location: '테를지', address: '저장 주소',
    images: [], description: '', facilities: ['온수', '식당'], roomAmenities: ['온수'], sharedFacilities: ['식당'], occupancy: '2 хүн/өрөө',
    phone: 'PRIVATE-LODGE-PHONE', operatingNotes: 'PRIVATE-ARCHIVE' };

test('공통 가이드·차량 선택은 등록 전화와 공개 프로필만 복사하고 이전 담당 정보를 상속하지 않는다', () => {
    const selectedGuide = selectResourceGuide({ id: 'old', name: '이전 가이드', phone: 'OLD-PHONE', image: '/old.webp' }, guide);
    assert.deepEqual(selectedGuide, { id: guide.id, name: guide.name, phone: '', image: '/guide.webp', introduction: '공개 소개',
        nameEn: 'Guide', role: '현지 가이드', languages: ['한국어'], specialties: ['고비'] });
    const selectedVehicle = selectResourceVehicle({ type: '이전 차량', phone: 'MANUAL-OLD-DRIVER' }, vehicle);
    assert.deepEqual(selectedVehicle, { type: vehicle.type, phone: 'REGISTERED-DRIVER', resource: { id: `resource-vehicle:${vehicle.name}`,
        img: '/car.webp', images: ['/car.webp', '/inside.webp'], description: '공개 차량 안내', seats: '6인', luggage: '4개' } });
    assert.equal(selectResourceVehicle(selectedVehicle, { ...vehicle, phone: '', snapshot: {} }).phone, '', '다른 차량에 기존 기사 전화가 남지 않는다');
    selectedGuide.languages.push('직접 추가'); selectedVehicle.resource.images.push('/booking.webp');
    assert.deepEqual(guide.languages, ['한국어']); assert.deepEqual(vehicle.snapshot.images, ['/car.webp', '/inside.webp']);
    assert.ok(!JSON.stringify({ selectedGuide, selectedVehicle }).includes('PRIVATE-'));
});

test('다른 숙소 선택은 확정 상태를 초기화하며 일차·직접 날짜·객실수·수동 정원은 보존한다', () => {
    const current = { day: 3, date: '2026-12-01', accommodation: { id: 'old', name: '이전 숙소', images: ['/old.webp'], description: '이전 소개',
        bookingStatus: 'Баталгаажсан', roomCount: 2, occupancy: '4 хүн/өрөө', privateNote: 'PRIVATE-PREVIOUS' } };
    const selected = selectResourceLodge(current, lodge);
    assert.equal(selected.day, 3); assert.equal(selected.date, '2026-12-01'); assert.equal(selected.accommodation.roomCount, 2);
    assert.equal(selected.accommodation.occupancy, '4 хүн/өрөө'); assert.equal(selected.accommodation.bookingStatus, 'Илгээгээгүй');
    assert.equal(selected.accommodation.id, lodge.id); assert.equal(selected.accommodation.region, '테를지'); assert.equal(selected.accommodation.address, '저장 주소');
    assert.deepEqual(selected.accommodation.images, []); assert.equal(selected.accommodation.description, '');
    assert.deepEqual(selected.accommodation.roomAmenities, ['온수']); assert.deepEqual(selected.accommodation.sharedFacilities, ['식당']);
    assert.ok(!JSON.stringify(selected).includes('PRIVATE-')); assert.deepEqual(current.accommodation.images, ['/old.webp']);
    selected.accommodation.facilities.push('문서 수정'); assert.deepEqual(lodge.facilities, ['온수', '식당']);
});

test('동일 숙소 재선택·ID 없는 옛 같은 이름은 처리 상태를 유지하고 빈 정원에만 등록 정원을 채운다', () => {
    for (const previous of [{ id: lodge.id, name: lodge.name }, { name: lodge.name }]) {
        const selected = selectResourceLodge({ day: 1, date: '', accommodation: { ...previous, bookingStatus: 'Хариу ирсэн', occupancy: '' } }, lodge);
        assert.equal(selected.accommodation.bookingStatus, 'Хариу ирсэн'); assert.equal(selected.accommodation.occupancy, '2 хүн/өрөө');
        assert.equal(selected.date, '');
    }
    const sameNameDifferentId = selectResourceLodge({ day: 1, accommodation: { id: 'legacy-other-id', name: lodge.name, bookingStatus: 'Баталгаажсан' } }, lodge);
    assert.equal(sameNameDifferentId.accommodation.bookingStatus, 'Илгээгээгүй');
});

test('선택 프로필은 실제 저장 payload·계정별 초안에 보존하되 파일 바이트·임시 URL·임의 내부 키는 제외한다', () => {
    const selected = { assignedGuide: { ...selectResourceGuide(undefined, guide), image: 'data:image/png;base64,YQ==', qr: 'PRIVATE-QR' },
        contractData: { vehicle: { ...selectResourceVehicle(undefined, vehicle), resource: { ...selectResourceVehicle(undefined, vehicle).resource,
            img: 'blob:temporary', images: ['/saved.webp', 'data:image/png;base64,YQ==', 'blob:temporary'], token: 'PRIVATE-TOKEN' } } },
        dailyAccommodations: [selectResourceLodge({ day: 1, accommodation: { roomCount: 2 } }, lodge)] };
    const assignment = editorAssignment(selected);
    assert.equal(assignment.guide.image, ''); assert.equal(assignment.guide.introduction, '공개 소개'); assert.deepEqual(assignment.guide.languages, ['한국어']);
    assert.equal(assignment.vehicle.resource.img, ''); assert.deepEqual(assignment.vehicle.resource.images, ['/saved.webp']);
    assert.equal(assignment.accommodations[0].accommodation.address, '저장 주소'); assert.deepEqual(assignment.accommodations[0].accommodation.roomAmenities, ['온수']);
    assert.ok(!JSON.stringify(assignment).includes('PRIVATE-'));
    const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const scope = { userId: 'admin-a', source: 'product', id: 'same-id' };
    assert.equal(writeAssignmentDraft(storage, scope, 'version-a', assignment).ok, true);
    assert.deepEqual(readAssignmentDraft(storage, scope, 'version-a').draft.assignment, assignment);
    assert.equal(readAssignmentDraft(storage, { ...scope, source: 'quote_booking' }, 'version-a').draft, undefined);
    assert.ok(![...values.values()].join('').includes('data:image')); assert.ok(![...values.values()].join('').includes('blob:'));
});
