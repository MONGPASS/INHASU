import test from 'node:test';
import assert from 'node:assert/strict';
import { productWorkspaceReservation, productCustomerOverview, legacyCustomerOverview } from '../src/utils/productCustomerWorkspace.ts';
import { reservationWorkspaceStatus } from '../src/utils/reservationWorkspace.ts';

const source = {
    id: 'local-overview-detail', customer_name: '실제 고객', customer_email: 'fixture@example.invalid', customer_phone: '01011112222',
    product_name: '예약된 여행', total_people: 2, status: 'confirmed', deposit_status: 'paid',
    start_date: '2026-10-25', end_date: '2026-10-27', total_price: 3000000, deposit_amount: 900000, balance_amount: 2100000,
    assigned_guide: { name: '등록 가이드' }, daily_accommodations: [{ day: 1, accommodation: { name: '등록 게르' } }],
};
const options = { vehicle: '등록 차량', itineraryReady: true, itinerarySent: false, contractSent: false, itineraryChanged: false, contractChanged: false };
function overview(raw = {}, days = [{ day: 1, title: '테를지' }, { day: 2, title: '고비' }, { day: 3, title: '귀국' }], flags = {}) {
    const row = productWorkspaceReservation({ ...source, ...raw });
    const workflow = reservationWorkspaceStatus({ ...row, days, agreement: row.contractData?.agreement, travelers: row.contractData?.travelers || [] });
    return productCustomerOverview(row, days, workflow, { ...options, ...flags });
}

test('항공편은 고객이 저장한 날짜·시간·편명만 표시하고 여행 기간을 항공 일시로 추정하지 않는다', () => {
    const contract = { arrival: { date: '2026-10-24', time: '23:15', flight: 'OM302' }, departure: { flight: 'KE198' }, pickup: '칭기즈칸 공항', drop: '공항 출국장' };
    const model = overview({ contract_data: JSON.stringify(contract) });
    assert.deepEqual(model.flights, [
        { id: 'arrival', label: '몽골 도착편', date: '2026-10-24', time: '23:15', flight: 'OM302', extra: [{ label: '픽업 장소', value: '칭기즈칸 공항' }] },
        { id: 'departure', label: '몽골 출발편', date: '', time: '', flight: 'KE198', extra: [{ label: '샌딩 장소', value: '공항 출국장' }] },
    ]);
    assert.equal(model.tasks.find(task => task.id === 'flights').detail, '몽골 출발편 날짜·시간 미입력');
    assert.equal(overview().flights[0].date, '');
    assert.equal(overview().flights[1].date, '');
    const complete = overview({ contract_data: { ...contract, departure: { date: '2026-10-28', time: '00:30', flight: 'KE198' } } });
    assert.equal(complete.tasks.some(task => task.id === 'flights'), false);
});

test('여행자 상세는 주문자와 분리하고 여권명·생년월일·0세·성별·연락처와 실제 동의 기록을 보존한다', () => {
    const contract = { travelers: [
        { name: '동반 여행자', passportName: 'SAVED PASSPORT', birthdate: '2026-10-01', age: 0, gender: '여', phone: '01099998888' },
        { name: '', passportName: 'PARTIAL ONLY' },
    ], agreement: { agreed: true, name: '실제 서명자', agreedAt: '2026-10-19T09:00:00Z' }, customerSubmittedAt: '2026-10-19T08:00:00Z' };
    const frozen = JSON.stringify(contract);
    const model = overview({ contract_data: contract });
    assert.deepEqual(model.travelers, { expected: 2, registered: 1, status: '1/2명 입력', people: [
        { id: 'traveler-0', name: '동반 여행자', details: [{ label: '여권 영문명', value: 'SAVED PASSPORT' }, { label: '생년월일', value: '2026-10-01' }, { label: '나이', value: '0' }, { label: '성별', value: '여' }, { label: '연락처', value: '01099998888' }] },
        { id: 'traveler-1', name: '', details: [{ label: '여권 영문명', value: 'PARTIAL ONLY' }, { label: '생년월일', value: '' }, { label: '성별', value: '' }, { label: '연락처', value: '' }] },
    ] });
    assert.deepEqual(model.agreement, { label: '실제 서명자 · 동의 완료', at: '2026-10-19T09:00:00Z' });
    assert.equal(model.facts.find(fact => fact.label === '연락처').value, '01011112222');
    assert.equal(model.facts.find(fact => fact.label === '고객 정보 제출').value, contract.customerSubmittedAt);
    assert.equal(model.tasks.find(task => task.id === 'travelers').detail, '1/2명 이름 입력 · 1명 이름 미입력 · 생년월일 1명 미입력 · 성별 1명 미입력 · 연락처 1명 미입력');
    assert.equal(JSON.stringify(contract), frozen);
    assert.equal(overview({ total_people: null }).travelers.expected, null);
    assert.equal(overview({ total_people: 0 }).travelers.expected, 0);
    assert.match(overview({ total_people: null }).travelers.status, /미등록/);
    assert.match(overview({ total_people: 0 }).travelers.status, /0명/);
});

test('여행자 이름 2/2명 입력 후에도 세부 정보 미입력 항목과 인원수를 정확히 확인한다', () => {
    const model = overview({ contract_data: { travelers: [
        { name: '여행자 1', passportName: 'TRAVELER ONE', birthdate: '1990-02-03', gender: '남' },
        { name: '여행자 2', phone: '01022223333' },
    ] } });
    assert.equal(model.travelers.registered, 2);
    assert.deepEqual(model.travelers.people[1].details, [{ label: '여권 영문명', value: '' }, { label: '생년월일', value: '' }, { label: '성별', value: '' }, { label: '연락처', value: '01022223333' }]);
    assert.equal(model.travelers.people.some(person => person.details.some(field => field.label === '나이')), false);
    const task = model.tasks.find(item => item.id === 'travelers');
    assert.equal(task.label, '여행자 세부 정보 확인'); assert.equal(task.action, 'travelers');
    assert.equal(task.detail, '2/2명 이름 입력 · 여권 영문명 1명 미입력 · 생년월일 1명 미입력 · 성별 1명 미입력 · 연락처 1명 미입력');
    assert.doesNotMatch(task.detail, /이름 미입력|필수|의무|법적/);
    assert.equal(model.tasks.filter(item => item.action === 'travelers').length, 1);
    const complete = overview({ contract_data: { travelers: [1, 2].map(index => ({ name: `여행자 ${index}`, passportName: `SAVED ${index}`, birthdate: '1990-02-03', gender: '여', phone: `0100000000${index}` })) } });
    assert.equal(complete.tasks.some(item => item.id === 'travelers'), false);
});

test('운영 일정은 여러 줄·시간별 활동·식사·이동·배정 숙소를 축약하지 않고 일차에 연결한다', () => {
    const days = [{ id: 'day-one', day: 1, date: '', dateMode: 'manual', title: '테를지 도착', region: '중앙몽골',
        items: ['공항 픽업\n수하물 확인', '*승마 체험', '(선택 활동)'], summary: '상품의 별도 상세 안내\n둘째 줄',
        move: '2시간', dist: '80', meals: { breakfast: '호텔식', lunch: '현지식', dinner: '캠프식' }, accommodation: { name: '상품상 기본 숙소' },
        activities: [{ time: '14:00', title: '거북바위', description: '자유 산책\n사진 촬영', images: ['/saved-rock.webp'] }, { time: '16:30', title: '', description: '강변 자유 시간' }],
    }, { day: 3, title: '귀국', meals: '조식 포함' }];
    const before = JSON.stringify(days);
    const model = overview({}, days);
    assert.equal(model.days[0].summary, '공항 픽업\n수하물 확인\n*승마 체험\n(선택 활동)\n상품의 별도 상세 안내\n둘째 줄');
    assert.deepEqual(model.days[0].activities, [{ time: '14:00', title: '거북바위', description: '자유 산책\n사진 촬영' }, { time: '16:30', title: '', description: '강변 자유 시간' }]);
    assert.equal(model.days[0].stay, '등록 게르'); assert.equal(model.days[0].stayAssigned, true); assert.equal(model.days[0].stayRequired, true);
    assert.equal(model.days[0].meals, '조식 호텔식 · 중식 현지식 · 석식 캠프식'); assert.equal(model.days[0].travel, '2시간 · 80km');
    assert.equal(model.days[0].region, '중앙몽골'); assert.equal(model.days[0].date, ''); assert.equal(model.days[0].image, '/saved-rock.webp');
    assert.equal(model.days[1].stayRequired, false); assert.equal(model.days[1].meals, '조식 포함'); assert.equal(JSON.stringify(days), before);
    const legacy = legacyCustomerOverview({ id: 'old-inquiry', name: '이전 고객', status: 'answered', confirmed_start_date: source.start_date, confirmed_end_date: source.end_date }, { days });
    assert.equal(legacy.days[0].stay, '상품상 기본 숙소'); assert.equal(legacy.days[0].stayAssigned, false); assert.equal(legacy.days[1].stayRequired, false);
    assert.deepEqual(legacy.days[0].activities, model.days[0].activities);
});

test('계약 미전달·전달 후 동의 대기·서명 완료·변경 후 재안내의 실제 처리 업무를 구분한다', () => {
    const unsent = overview();
    assert.deepEqual(unsent.tasks.find(task => task.id === 'deliver-contract'), { id: 'deliver-contract', label: '여행 계약서 확인·전달', detail: '계약서 전달 기록과 고객 동의가 없습니다.', action: 'documents', actionLabel: '계약서 전달 관리' });
    const sent = overview({}, undefined, { contractSent: true });
    assert.equal(sent.tasks.some(task => task.id === 'deliver-contract'), false);
    assert.deepEqual(sent.tasks.find(task => task.id === 'view-contract'), { id: 'view-contract', label: '고객 계약 동의 대기', detail: '계약서 전달 기록은 있으나 고객의 동의가 완료되지 않았습니다.', action: 'view-info', actionLabel: '동의 상태 확인', waiting: true });
    const changed = overview({ contract_data: { agreement: { agreed: true } } }, undefined, { contractSent: true, itineraryChanged: true, contractChanged: true });
    assert.equal(changed.tasks.some(task => ['view-contract', 'deliver-contract'].includes(task.id)), false);
    for (const id of ['contract-changed', 'itinerary-changed']) { assert.equal(changed.tasks.find(task => task.id === id).action, 'documents'); assert.match(changed.tasks.find(task => task.id === id).detail, /마지막 안내 이후/); }
    assert.equal(changed.tasks.some(task => task.action === 'send-itinerary'), false);
});

test('미입력 명단·항공편·숙소 업무는 정확한 누락 수량과 실제 정보 화면을 가리킨다', () => {
    const model = overview({ contract_data: { travelers: [{ name: '한 명' }], arrival: { date: '2026-10-25' } } });
    assert.equal(model.tasks.find(task => task.id === 'travelers').action, 'travelers');
    assert.equal(model.tasks.find(task => task.id === 'travelers').detail, '1/2명 이름 입력 · 1명 이름 미입력 · 여권 영문명 2명 미입력 · 생년월일 2명 미입력 · 성별 2명 미입력 · 연락처 2명 미입력');
    assert.equal(model.tasks.find(task => task.id === 'stay').detail, '1/2박 배정 · 1박 미배정');
    assert.equal(model.tasks.find(task => task.id === 'flights').action, 'flights');
    assert.equal(model.tasks.find(task => task.id === 'flights').detail, '몽골 도착편 시간·편명 미입력 / 몽골 출발편 날짜·시간·편명 미입력');
    const missingEmail = overview({ customer_email: '' });
    assert.equal(missingEmail.tasks.find(task => task.id === 'email').action, 'edit-info');
    assert.equal(missingEmail.canSendItinerary, false);
});

test('공개 제한 상태에는 공개·발송을 완료로 보이거나 직접 발송 작업을 만들지 않는다', () => {
    const pending = overview({ status: 'pending_payment', itinerary_url: '/saved-itinerary' });
    assert.equal(pending.canSendItinerary, false); assert.equal(pending.tasks.find(task => task.id === 'publish-blocked').action, 'payments');
    assert.match(pending.tasks.find(task => task.id === 'publish-blocked').detail, /입금 대기/);
    assert.equal(pending.steps.find(step => step.id === 'published').done, false);
    const unpublished = overview(); assert.equal(unpublished.tasks.find(task => task.id === 'publish').action, 'documents');
    const published = overview({ itinerary_url: '/saved-itinerary' });
    assert.equal(published.tasks.some(task => task.id === 'publish'), false); assert.equal(published.tasks.find(task => task.id === 'deliver-itinerary').action, 'documents');
    assert.equal(overview({ itinerary_url: '/saved-itinerary' }, undefined, { itinerarySent: true }).tasks.some(task => task.id === 'deliver-itinerary'), false);
    const cancelled = overview({ status: 'cancelled' });
    assert.deepEqual(cancelled.tasks, []); assert.equal(cancelled.customerLinkAvailable, false); assert.equal(cancelled.canSendItinerary, false);
    const legacyCancelled = legacyCustomerOverview({ id: 'cancelled-legacy', status: 'cancelled' }, null);
    assert.deepEqual(legacyCancelled.tasks, []); assert.equal(legacyCancelled.customerLinkAvailable, false);
});

test('수동 주문 메모는 보존하되 고객 요청이나 여행자 신원으로 바꾸지 않는다', () => {
    const row = productWorkspaceReservation({ ...source, notes: '카카오 ID: saved-customer\n담당자 확인 메모' });
    const model = overview({ notes: row.notes });
    assert.equal(row.notes, '카카오 ID: saved-customer\n담당자 확인 메모');
    assert.equal(model.facts.find(fact => fact.label === '주문 메모').value, row.notes);
    assert.deepEqual(model.preferences, []); assert.equal(model.travelers.registered, 0); assert.equal(model.travelers.people.length, 0);
});
