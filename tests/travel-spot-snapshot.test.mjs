import test from 'node:test';
import assert from 'node:assert/strict';
import { travelSpotSnapshot } from '../src/utils/travelSpotSnapshot.ts';

test('공통 여행지는 일정용 제목·설명·사진만 복사하고 원본과 사진 배열을 공유하지 않는다', () => {
    const source = { id: 'quote-spot:테를지', name_kr: '테를지', name_local: 'Тэрэлж', description: '초원 산책', address: '국립공원', images: ['/travel.webp'], privateNote: 'INTERNAL' };
    const snapshot = travelSpotSnapshot(source);
    assert.deepEqual(snapshot, { title: '테를지', description: '초원 산책\n\n국립공원', images: ['/travel.webp'] });
    source.name_kr = '수정된 이름'; source.images.push('/later.webp');
    assert.equal(snapshot.title, '테를지'); assert.deepEqual(snapshot.images, ['/travel.webp']);
    snapshot.images.push('/document.webp'); assert.ok(!source.images.includes('/document.webp'));
});

test('사진과 설명을 비운 여행지를 선택하면 이전 여행지의 내용이 남지 않고 다른 일정 필드는 보존된다', () => {
    const current = { id: 'activity-1', time: '09:30', title: '이전 여행지', description: '이전 설명', images: ['/old.webp'], badge: '자유 시간' };
    const selected = { ...current, ...travelSpotSnapshot({ id: 'quote-spot:빈 여행지', name_kr: '빈 여행지', description: '', images: [] }) };
    assert.deepEqual(selected, { ...current, title: '빈 여행지', description: '', images: [] });
    assert.deepEqual(current.images, ['/old.webp']); assert.equal(current.description, '이전 설명');
});
