import type { CustomerWorkspaceOverviewModel } from '../components/admin/CustomerWorkspaceOverview';
import { isQuoteBooking, summarizeQuoteBooking } from '../../functions/lib/quoteBookings';

const text = (value: unknown): string => typeof value === 'string' ? value : '';
const list = (value: unknown): any[] => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : [];
const amount = (value: unknown): number | null => value == null || value === '' || !['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value)) ? null : Number(value);
const dateStamp = (value: unknown): number | null => {
    const key = text(value).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const stamp = Date.parse(key + 'T00:00:00Z'); return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === key ? stamp : null;
};
const nonempty = (value: unknown): string => text(value).trim();
const paymentState = (value: unknown, checked: unknown, balance = false): boolean | null => {
    const status = nonempty(value);
    if (status) return status === '입금완료' || balance && ['현지현금전달', '현장현금전달'].includes(status) ? true
        : ['미입금', '미수령', '계좌입금', '카드결제'].includes(status) ? false : null;
    return typeof checked === 'boolean' ? checked : null;
};
const overviewActivities = (day: any): Array<{ time?: string; title: string; description?: string }> => {
    // An explicitly cleared quote item array is authoritative over older activity copies.
    if (Array.isArray(day.items)) return strings(day.items).map(value => {
        const match = value.match(/^\s*\*?\s*(\d{1,2}:\d{2})\s+(.+)$/);
        return match ? { time: match[1], title: match[2] } : { title: value };
    });
    return list(day.activities).map(activity => ({ time: nonempty(activity.time) || undefined,
        title: nonempty(activity.title) || nonempty(activity.description), description: nonempty(activity.description) || undefined }))
        .filter(activity => activity.title);
};
export const quoteCustomerIsBooking = (record: any): boolean => isQuoteBooking(record);

export async function loadQuoteCustomerRequest(id: string, token: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<any> {
    const response = await fetcher(`/api/requests/${encodeURIComponent(id)}`, { headers: { 'x-admin-token': token }, cache: 'no-store', signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true || !payload.item || typeof payload.item !== 'object' || Array.isArray(payload.item) || String(payload.item.id) !== id) {
        throw new Error(response.status === 404 ? '선택한 견적 문의를 찾을 수 없습니다.' : response.status === 401 ? '관리자 인증을 다시 확인해 주세요.' : '고객 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
    }
    return payload.item;
}

/** Only the selected server request is projected. Names never identify or merge customers. */
export function quoteCustomerWorkspaceModel(record: any): CustomerWorkspaceOverviewModel {
    const booked = isQuoteBooking(record), booking = booked ? record.booking || {} : {};
    const summary = summarizeQuoteBooking(record), ci = booking.contractInfo || {}, quote = record.quote;
    const days = Array.isArray(booking.days) ? list(booking.days) : list(quote?.days);
    const accepted = record.decision?.status === 'accepted' || record.status === '예약확정';
    // Final reservation status is not evidence that the administrator published a document.
    const published = booked && booking.publishStatus === 'published';
    const pax = amount(quote?.pax) || summary.totalPeople, price = quote?.price || {};
    const balances = list(price.balances), balanceRow = balances.find(row => Number(row.pax) === pax) || balances.reduce((best: any, row: any) => !best || Math.abs(Number(row.pax) - pax) < Math.abs(Number(best.pax) - pax) ? row : best, null);
    const full = /풀패키지|최고급|고급/.test(`${record.pkgTier || ''} ${record.gerStay || ''}`);
    const perDeposit = amount(price.deposit), perBalance = amount(balanceRow?.[full ? 'full' : 'economy'] ?? balanceRow?.amount);
    const deposit = amount(ci.depositAmount) ?? (perDeposit !== null && pax > 0 ? perDeposit * pax : null);
    const contractTotal = amount(ci.totalAmount);
    const balance = amount(ci.balanceAmount) ?? (contractTotal !== null && deposit !== null ? Math.max(0, contractTotal - deposit) : perBalance !== null && pax > 0 ? perBalance * pax : null);
    const total = contractTotal ?? (deposit !== null && balance !== null ? deposit + balance : null);
    const quoted = !!(quote && typeof quote === 'object' && !Array.isArray(quote));
    const sent = list(record.activities).some(row => ['quote_notification_queued', 'quote_sent'].includes(text(row.type)));
    const cancelled = summary.status === 'cancelled';
    const depositPaid = booked ? paymentState(ci.depositStatus, booking.checklist?.deposit) : null;
    const balancePaid = booked ? paymentState(ci.balanceStatus, booking.checklist?.balance, true) : null;
    const start = dateStamp(record.depart) ?? dateStamp(booking.flight?.inDate), end = dateStamp(record.return_) ?? dateStamp(booking.flight?.outDate);
    const expectedDays = start !== null && end !== null && end >= start ? Math.round((end - start) / 86400000) + 1 : null;
    const emptyDays = days.flatMap((day, index) => nonempty(day.dest) || nonempty(day.title) || overviewActivities(day).length ? [] : [index + 1]);
    const scheduleReady = days.length > 0 && !emptyDays.length && (expectedDays === null || days.length === expectedDays);
    const lodgeNeeded = start !== null && end !== null && end >= start ? Math.round((end - start) / 86400000) : Math.max(0, days.length - 1);
    const lodges = list(booking.assign?.lodges).filter(row => text(row.name).trim() && Number.isInteger(Number(row.day)) && Number(row.day) >= 1 && Number(row.day) <= lodgeNeeded);
    const lodgeCount = new Set(lodges.map(row => Number(row.day))).size;
    const lodgingKnown = lodgeNeeded > 0 || start !== null && end === start;
    const flight = booking.flight || {};
    const travelerRows = list(booking.travelers), namedTravelers = travelerRows.filter(person => nonempty(person.nameKo) || nonempty(person.passportName));
    const requestedPeople = (amount(record.adult) || 0) + (amount(record.child) || 0) + (amount(record.infant) || 0);
    const expectedTravelers = [requestedPeople, amount(quote?.pax), amount(booking.travelerSubmission?.expectedCount)].find(count => count !== null && count > 0) ?? null;
    const missingTravelerRows = namedTravelers.filter(person => !nonempty(person.nameKo) || !nonempty(person.passportName) || !nonempty(person.birth)
        || !nonempty(person.gender) || !nonempty(person.passportNo) || (!person.type || person.type === '성인') && !nonempty(person.phone));
    const missingFlights = [
        !nonempty(flight.inDate) && '몽골 도착일', !nonempty(flight.inTime) && '도착시간', !nonempty(flight.inNo) && '도착편명',
        !nonempty(flight.outDate) && '몽골 출발일', !nonempty(flight.outTime) && '출발시간', !nonempty(flight.outNo) && '출발편명',
    ].filter(Boolean);
    const assignments: CustomerWorkspaceOverviewModel['assignments'] = [
        { id: 'guide', label: '가이드', value: text(booking.assign?.guide?.name) || '미배정', state: booking.assign?.guide?.name ? 'ready' : 'pending', statusLabel: booked ? (booking.assign?.guide?.name ? '배정됨' : '배정 필요') : '예약 진행 후 배정' },
        { id: 'vehicle', label: '차량', value: text(booking.assign?.vehicle?.model) || text(booking.assign?.vehicle?.type) || '미배정', state: booking.assign?.vehicle?.model || booking.assign?.vehicle?.type ? 'ready' : 'pending', statusLabel: booked ? (booking.assign?.vehicle?.model || booking.assign?.vehicle?.type ? '배정됨' : '배정 필요') : '예약 진행 후 배정' },
        { id: 'stay', label: '숙소', value: lodges.map(row => `${Number(row.day)}일차 ${row.name}`).join(' · ') || (booked && lodgingKnown && lodgeNeeded === 0 ? '당일 투어' : '미배정'), state: booked && lodgingKnown && lodgeCount >= lodgeNeeded ? 'ready' : 'pending', statusLabel: booked ? lodgingKnown ? lodgeNeeded ? `${lodgeCount}/${lodgeNeeded}박 배정` : '숙박 불필요' : '여행 기간 확인 필요' : '예약 진행 후 배정' },
    ];
    const steps = booked ? [
        { id: 'accepted', label: '예약 접수', done: accepted },
        { id: 'deposit', label: '예약금 확인', done: depositPaid === true },
        { id: 'contract', label: '계약 동의', done: summary.quoteBooking.signed },
        { id: 'schedule', label: '일정 준비', done: scheduleReady },
        { id: 'published', label: '일정표 공개', done: published },
    ] : [
        { id: 'inquiry', label: '문의 접수', done: true },
        { id: 'quote', label: '견적 작성', done: quoted },
        { id: 'sent', label: '견적 안내 요청', done: sent },
        { id: 'accepted', label: '예약 진행 의사', done: accepted },
    ];
    const current = steps.findIndex(step => !step.done);
    const notes = [
        { id: 'inquiry-memo', body: text(record.memo), author: '상담 메모' },
        { id: 'booking-notes', body: text(booking.notes), author: '예약 참고 메모' },
        { id: 'booking-admin-memo', body: text(booking.adminMemo), author: '예약 내부 메모' },
    ].filter(row => row.body.trim());
    const tasks: CustomerWorkspaceOverviewModel['tasks'] = [];
    if (!cancelled && booked) {
        if (!accepted) tasks.push({ id: 'accepted', label: '고객 예약 진행 의사 확인', detail: '고객 수락 또는 예약 확정 기록이 없습니다. 상담 결과를 확인하고 예약 상태를 기록하세요.', actionLabel: '예약 정보 확인', action: 'view-info' });
        if (depositPaid !== true) tasks.push({ id: 'deposit', label: booking.depositReport?.status === 'reported' ? '고객 예약금 입금 신고 확인' : depositPaid === null ? '예약금 금액·입금 상태 확인' : booking.depositRequest?.status === 'requested' ? '예약금 입금 내역 확인' : '예약금 안내 내용 확인',
            detail: [deposit === null ? '예약금 금액 미입력' : `예약금 ${deposit.toLocaleString('ko-KR')}원`,
                booking.depositReport?.status === 'reported' ? `입금 신고${nonempty(booking.depositReport.name) ? ` · 입금자 ${nonempty(booking.depositReport.name)}` : ''} · 계좌 확인 필요`
                    : depositPaid === null ? '입금 상태 기록 없음' : booking.depositRequest?.status === 'requested' ? '안내 요청 기록 있음 · 입금 확인 전' : '입금 안내 요청 기록 없음'].join(' · '),
            actionLabel: '입금 내역 확인', action: 'payments' });
        if (!summary.quoteBooking.signed) tasks.push({ id: 'contract', label: booking.contractRequest?.status === 'requested' ? '고객 계약서 서명 확인' : '계약서 서명 요청 준비',
            detail: booking.contractRequest?.status === 'requested' ? `${nonempty(booking.contractRequest.requestedAt) ? `${nonempty(booking.contractRequest.requestedAt)} 요청 기록 · ` : ''}고객 서명 기록이 없습니다.`
                : depositPaid === true ? '예약금 입금 확인됨 · 계약서 내용 검토 후 서명을 요청하세요.' : '계약서 요청 기록 없음 · 예약금 입금 상태와 계약 내용을 먼저 확인하세요.',
            actionLabel: '계약서 확인', waiting: booking.contractRequest?.status === 'requested', action: 'contract' });
        if (expectedTravelers === null || expectedTravelers <= 0 || namedTravelers.length < expectedTravelers || missingTravelerRows.length) tasks.push({ id: 'travelers', label: '여행자 정보 확인·보완',
            detail: [`${namedTravelers.length}/${expectedTravelers && expectedTravelers > 0 ? expectedTravelers : '미정'}명 등록`,
                expectedTravelers && expectedTravelers > namedTravelers.length ? `${expectedTravelers - namedTravelers.length}명 미등록` : '',
                missingTravelerRows.length ? `${missingTravelerRows.length}명 필수 정보 누락` : '',
                booking.travelerSubmission?.status === 'requested' ? '고객 입력 요청 기록 있음' : ''].filter(Boolean).join(' · '),
            actionLabel: '여행자 정보 확인', action: 'travelers' });
        if (missingFlights.length) tasks.push({ id: 'flights', label: '항공·픽업 정보 확인', detail: `${missingFlights.join(' · ')} 미입력. 발권 여부와 픽업·샌딩 계획을 확인하세요.`, actionLabel: '항공 정보 확인', action: 'flights' });
        if (expectedDays === null) tasks.push({ id: 'period', label: '여행 시작·종료일 확인', detail: '유효한 여행 기간이 없어 일정 일수와 필요한 숙박 수를 확정할 수 없습니다.', actionLabel: '여행 기간 확인', action: 'view-info' });
        if (!scheduleReady) tasks.push({ id: 'schedule', label: '일자별 일정 보완', detail: [expectedDays === null ? `저장된 일정 ${days.length}일` : `여행 ${expectedDays}일 · 저장된 일정 ${days.length}일`,
            emptyDays.length ? `${emptyDays.join('·')}일차 내용 미입력` : '', !days.length ? '등록된 일정 없음' : ''].filter(Boolean).join(' · '), actionLabel: '일정표 편집', action: 'edit-itinerary' });
        for (const resource of assignments.filter(item => item.state !== 'ready')) tasks.push({ id: resource.id, label: resource.id === 'stay' ? '일자별 숙소 배정' : `${resource.label} 배정`,
            detail: resource.id === 'stay' ? lodgingKnown ? `${lodgeCount}/${lodgeNeeded}박 배정 · ${Math.max(0, lodgeNeeded - lodgeCount)}박 미배정` : '여행 기간을 확인한 뒤 숙박 일자별로 배정하세요.' : `${resource.label}가 아직 배정되지 않았습니다. 등록된 자원에서 선택하세요.`,
            actionLabel: `${resource.label} 선택`, action: resource.id });
        if (accepted && depositPaid === true && summary.quoteBooking.signed && record.status !== '예약확정' && summary.status !== 'completed') tasks.push({ id: 'confirm', label: '예약 최종 확정 확인', detail: '고객 수락·입금·서명이 확인되었습니다. 예약 상태를 검토하세요.', actionLabel: '예약 상태 확인', action: 'view-info' });
        if (!published) tasks.push({ id: 'published', label: '확정 일정표 공개·전달 검토', detail: '고객 공개 기록이 없습니다. 일정·배정·계약 상태를 확인한 뒤 문서 영역에서 공개와 전달을 진행하세요.', actionLabel: '문서 확인·전달', action: 'documents' });
        if (balancePaid !== true) tasks.push({ id: 'balance-review', label: '잔금 수령 내역 확인', detail: `${balance === null ? '잔금 금액 미입력' : `잔금 ${balance.toLocaleString('ko-KR')}원`} · ${balancePaid === null ? '수령 상태 기록 없음' : nonempty(ci.balanceStatus) || '미수령'}. 수령 사실을 확인한 뒤 기록하세요.`, actionLabel: '잔금 내역 확인', action: 'payments' });
    } else if (!cancelled) {
        if (!quoted) tasks.push({ id: 'quote', label: '고객 요청에 맞는 견적서 작성', detail: '저장된 견적서가 없습니다. 여행 기간·인원·요청 사항을 확인하고 견적을 작성하세요.', actionLabel: '견적서 작성', action: 'edit-itinerary' });
        else if (!sent) tasks.push({ id: 'sent', label: '견적서 안내 요청 확인', detail: '견적서는 저장되어 있으나 발송 요청 기록이 없습니다. 고객 화면과 안내 내용을 검토하세요.', actionLabel: '견적 안내 확인', action: 'quote-share' });
        else if (!accepted) tasks.push({ id: 'accepted', label: '고객 예약 진행 의사 확인', detail: '견적 발송 요청 기록이 있습니다. 고객 수락 기록이 없어 상담 결과 확인이 필요합니다.', actionLabel: '상담 정보 확인', waiting: true, action: 'view-info' });
        else tasks.push({ id: 'prepare', label: '예약 기본 정보 준비', detail: '고객 예약 진행 의사가 기록되었으나 예약 정보가 없습니다. 기존 견적 관리에서 예약 진행 상태를 확인하세요.', actionLabel: '예약 정보 확인', action: 'view-info' });
    }
    return {
        customerName: text(record.name) || text(quote?.customer) || '이름 미입력', sourceLabel: booked ? '맞춤 견적 예약' : '맞춤 견적 문의',
        bookingNumber: text(record.reservationNumber) || text(record.id), statusLabel: booked ? summary.quoteBooking.label : text(record.status) || '신규 문의',
        period: [text(record.depart), text(record.return_)].filter(Boolean).join(' ~ ') || text(quote?.period) || '여행 기간 미정',
        partyLabel: summary.totalPeople ? `${summary.totalPeople}명` : '인원 미정',
        facts: [
            { label: '연락처', value: text(record.phone) || '미입력' }, { label: '이메일', value: text(record.email) || '미입력' },
            ...(record.kakaoId ? [{ label: '카카오 ID', value: text(record.kakaoId) }] : []),
            { label: '희망 여행', value: text(record.destination) || '미정' }, { label: '여행 유형', value: text(record.tripType) || '미정' },
            ...(summary.totalPeople > 0 ? [{ label: '인원 구성', value: [['성인', amount(record.adult)], ['아동', amount(record.child)], ['유아', amount(record.infant)]].filter(([, count]) => Number(count) > 0).map(([label, count]) => `${label} ${count}명`).join(' · ') || `${summary.totalPeople}명` }] : []),
            ...(record.receivedAt ? [{ label: '문의 접수', value: text(record.receivedAt) }] : []),
            ...(booking.pickupLodge ? [{ label: '픽업·샌딩 숙소', value: text(booking.pickupLodge) }] : []),
            ...(booking.travelerNote ? [{ label: '여행자 특이사항', value: text(booking.travelerNote) }] : []),
            ...(record.request ? [{ label: '고객 요청', value: text(record.request) }] : []),
        ],
        ...(booked ? {
            flights: [
                { id: 'arrival', label: '몽골 도착', date: nonempty(flight.inDate), time: nonempty(flight.inTime), flight: nonempty(flight.inNo), extra: [{ label: '출발지 출발시간', value: nonempty(flight.inDepTime) || '미입력' }] },
                { id: 'departure', label: '몽골 출발', date: nonempty(flight.outDate), time: nonempty(flight.outTime), flight: nonempty(flight.outNo), extra: [{ label: '귀국 도착시간', value: nonempty(flight.outArrTime) || '미입력' }] },
            ],
            travelers: { expected: expectedTravelers, registered: namedTravelers.length,
                status: booking.travelerSubmission?.status === 'submitted' ? `고객 제출 기록${booking.travelerSubmission.submittedAt ? ` · ${text(booking.travelerSubmission.submittedAt)}` : ''}`
                    : booking.travelerSubmission?.status === 'requested' ? '고객 입력 요청 기록 있음' : '고객 입력 요청 전',
                people: travelerRows.map((person, index) => ({ id: `${record.id}:traveler:${index}`, name: nonempty(person.nameKo) || nonempty(person.passportName) || `여행자 ${index + 1} · 이름 미입력`,
                    details: [{ label: '구분', value: nonempty(person.type) || '미입력' }, { label: '여권 영문명', value: nonempty(person.passportName) || '미입력' },
                        { label: '생년월일', value: nonempty(person.birth) || '미입력' }, { label: '성별', value: nonempty(person.gender) || '미입력' },
                        { label: '연락처', value: nonempty(person.phone) || '미입력' }, { label: '여권번호', value: nonempty(person.passportNo) || '미입력' }] })) },
            agreement: { label: summary.quoteBooking.signed ? '고객 서명 기록 있음' : booking.contractRequest?.status === 'requested' ? '서명 요청됨 · 고객 서명 대기' : '고객 서명 미요청',
                ...(summary.quoteBooking.signed ? { at: text(booking.contract.signedAt) } : booking.contractRequest?.requestedAt ? { at: text(booking.contractRequest.requestedAt) } : {}) },
        } : {}),
        preferences: [...strings(record.travelStyles), ...strings(record.destSpots), ...[text(record.cityStay || record.stay), text(record.gerStay), text(record.vehicle)].filter(Boolean)],
        notes,
        days: days.map((day, index) => {
            const assigned = lodges.find(row => Number(row.day) === index + 1), activities = overviewActivities(day);
            const distance = typeof day.dist === 'number' && Number.isFinite(day.dist) ? String(day.dist) : nonempty(day.dist);
            return { id: `${record.id}:day:${index}`, day: index + 1, title: text(day.dest) || text(day.title) || `${index + 1}일차`, date: text(day.date),
                region: strings(day.regions).join(' · ') || text(day.region), activities,
                summary: Array.isArray(day.items) ? strings(day.items).join('\n') : text(day.summary) || activities.map(activity => [activity.time, activity.title].filter(Boolean).join(' ')).join('\n'),
                stay: text(assigned?.name) || text(day.stay?.name) || (typeof day.stay === 'string' ? day.stay : ''), stayAssigned: !!assigned,
                stayRequired: expectedDays !== null ? index < expectedDays - 1 : text(day.stay?.name) === '숙소미포함' ? false : undefined,
                meals: strings(day.meals).join(' · ') || text(day.meals), travel: [text(day.move), distance && `${distance}${/km|㎞|킬로/i.test(distance) ? '' : 'km'}`].filter(Boolean).join(' · '),
                image: text(day.img) || text(day.images?.[0]) || undefined };
        }),
        documents: [
            { id: 'quote', label: '견적서', detail: quoted ? '기존 견적서 디자인으로 확인·수정합니다' : '아직 작성된 견적서가 없습니다', status: quoted ? (sent ? '발송 요청 기록 있음' : '저장됨') : '작성 필요', action: quoted ? 'quote-preview' : 'edit-itinerary' },
            { id: 'itinerary', label: '확정 일정표', detail: booked ? (published ? '고객에게 공개된 일정표' : '저장·배정 확인 후 공개합니다') : '예약 진행 후 준비합니다', status: published ? '공개됨' : booked && days.length ? '준비 중' : '대기', action: published ? 'itinerary-preview' : 'edit-itinerary' },
            { id: 'contract', label: '계약서', detail: summary.quoteBooking.signed ? '고객 실제 서명 확인됨' : booked ? '예약금 확인 후 계약 요청' : '예약 진행 후 작성합니다', status: summary.quoteBooking.signed ? '동의 완료' : booking.contractRequest?.status === 'requested' ? '요청됨' : '대기', action: 'contract' },
        ],
        payment: { total, deposit, balance,
            depositPaid, balancePaid },
        assignments, steps: steps.map((step, index) => ({ ...step, current: index === current })),
        tasks,
        customerLinkAvailable: !!text(record.token), canSendItinerary: booked && !cancelled,
    };
}
