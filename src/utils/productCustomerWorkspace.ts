import { toTourDateKey } from './formatDate.ts';
import { readDepositReport } from './reservationDetail.ts';
import type { CustomerWorkspaceOverviewModel } from '../components/admin/CustomerWorkspaceOverview';
import type { AdminDeliveryItem } from '../types/adminDelivery';
import { customerRecentHistory, customerCurrentStage } from './customerRecentHistory.ts';
import { productSignatureStatus } from './productContractSignature.ts';

const object = (value: any, fallback: any = undefined) => {
    for (let i = 0; i < 3 && typeof value === 'string'; i++) { try { value = JSON.parse(value); } catch { return fallback; } }
    return value && typeof value === 'object' ? value : fallback;
};
const time = (value: any) => { const date = new Date(value || ''); return Number.isNaN(date.getTime()) ? 0 : date.getTime(); };
const money = (value: any) => Number.isFinite(Number(value)) ? Number(value) : 0;
const knownMoney = (value: any) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const array = (value: any) => { const parsed = object(value, []); return Array.isArray(parsed) ? parsed : []; };
const text = (value: unknown): string => typeof value === 'string' ? value : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
const count = (value: unknown): number | null => value !== null && value !== undefined && value !== '' && ['number', 'string'].includes(typeof value) && Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const populated = (value: unknown) => !!text(value).trim();
const travelerCoreFields = ['여권 영문명', '생년월일', '성별', '연락처'];
const missingTravelerDetails = (people: Array<{ details: Array<{ label: string; value: string }> }>, expected: number | null) => {
    const total = expected !== null && expected > 0 ? Math.max(expected, people.length) : people.length;
    return travelerCoreFields.map(label => ({ label, missing: total - people.filter(person => person.details.some(field => field.label === label && populated(field.value))).length }))
        .filter(field => field.missing > 0);
};

/** Customer-submitted fields remain separate from the booked tour dates and booker's contact details. */
function contractCustomerDetails(contract: any, expected: number | null, sent: boolean) {
    const people = array(contract.travelers).filter(person => person && typeof person === 'object').map((person, index) => ({
        id: `traveler-${index}`, name: text(person.name),
        details: [
            { label: '여권 영문명', value: text(person.passportName) },
            { label: '생년월일', value: text(person.birthdate) },
            ...(populated(person.age) ? [{ label: '나이', value: text(person.age) }] : []),
            { label: '성별', value: text(person.gender) },
            { label: '연락처', value: text(person.phone) },
        ],
    })).filter(person => populated(person.name) || person.details.some(field => populated(field.value)));
    const registered = people.filter(person => populated(person.name)).length;
    const agreement = object(contract.agreement, {});
    const signature = productSignatureStatus(contract, false);
    const signatureAt = signature?.signedAt && Number.isFinite(Date.parse(signature.signedAt)) ? signature.signedAt : undefined;
    const signatureLabel = signature?.hasImage ? signatureAt ? '손서명 완료' : '서명 시각 확인 필요' : agreement.agreed === true ? '성명 동의 완료 · 손서명 미등록' : signature ? '서명 원본 확인 필요' : sent ? '계약서 전달됨 · 고객 동의 대기' : '계약서 전달 전';
    return {
        flights: [
            { id: 'arrival', label: '몽골 도착편', date: text(contract.arrival?.date), time: text(contract.arrival?.time), flight: text(contract.arrival?.flight),
                extra: populated(contract.pickup) ? [{ label: '픽업 장소', value: text(contract.pickup) }] : [] },
            { id: 'departure', label: '몽골 출발편', date: text(contract.departure?.date), time: text(contract.departure?.time), flight: text(contract.departure?.flight),
                extra: populated(contract.drop) ? [{ label: '샌딩 장소', value: text(contract.drop) }] : [] },
        ],
        travelers: { expected, registered, people, status: expected === null ? `예약 인원 미등록 · 여행자 ${registered}명 입력` : expected > 0 ? `${registered}/${expected}명 입력` : `예약 인원 0명 · 확인 필요` },
        agreement: { label: signatureLabel, ...((signature?.signerName || agreement.agreed === true && populated(agreement.name)) ? { name: signature?.signerName || text(agreement.name) } : {}),
            ...(signatureAt ? { at: signatureAt } : !signature?.hasImage && agreement.agreed === true && populated(agreement.agreedAt) ? { at: text(agreement.agreedAt) } : {}) },
    };
}

/** The overview keeps full operational lines; it never substitutes stock images or truncates activities. */
function overviewDays(days: any[], assignments: any[] = [], nights?: number): CustomerWorkspaceOverviewModel['days'] {
    return days.map((d: any, index: number) => {
        const day = Number(d.day) || index + 1;
        const assigned = assignments.find(stay => Number(stay.day) === day && populated(stay.accommodation?.name))?.accommodation;
        const stay = assigned || object(d.accommodation, null);
        const activities = array(d.activities).filter(activity => activity && typeof activity === 'object')
            .map(activity => ({ title: text(activity.title), time: text(activity.time), description: text(activity.description) }))
            .filter(activity => populated(activity.title) || populated(activity.description) || populated(activity.time));
        const descriptions = [...array(d.items).map(text).filter(populated), text(d.summary)].filter(populated);
        const summary = [...new Set(descriptions)].join('\n');
        const meals = typeof d.meals === 'string' ? d.meals : Array.isArray(d.meals) ? d.meals.map(text).filter(populated).join(' · ')
            : [['breakfast', '조식'], ['lunch', '중식'], ['dinner', '석식']].filter(([key]) => populated(d.meals?.[key])).map(([key, label]) => `${label} ${text(d.meals[key])}`).join(' · ');
        return { id: String(d.id || day), day, date: text(d.date), title: text(d.title) || text(d.dest) || text(d.region) || `${day}일차`, region: text(d.region),
            summary, activities, stay: text(assigned?.name) || text(typeof d.accommodation === 'string' ? d.accommodation : stay?.name), stayAssigned: !!assigned,
            ...(Number.isFinite(nights) && nights! >= 0 ? { stayRequired: day <= nights! } : {}),
            meals, travel: [text(d.move), populated(d.dist) ? `${text(d.dist)}${/km|㎞|킬로/i.test(text(d.dist)) ? '' : 'km'}` : ''].filter(populated).join(' · '),
            image: text(d.photos?.[0]) || text(d.images?.[0]) || text(array(d.activities).find((a: any) => a.photos?.length)?.photos?.[0]) || text(array(d.activities).find((a: any) => a.images?.length)?.images?.[0]) || undefined };
    });
}

/** The list and dedicated page must read the same authoritative reservation fields, including zero amounts. */
export function productWorkspaceReservation(r: any): any {
    const startDate = toTourDateKey(r.startDate || r.start_date), endDate = toTourDateKey(r.endDate || r.end_date);
    const createdAt = r.createdAt || r.created_at, people = Number(r.travelers ?? r.totalPeople ?? r.total_people ?? 0);
    const total = money(r.totalPrice ?? r.total_price ?? r.total_amount ?? r.price_breakdown?.total ?? r.totalAmount ?? 0);
    const deposit = money(r.depositAmount ?? r.deposit_amount ?? r.price_breakdown?.deposit ?? r.deposit ?? 0);
    return {
        id: String(r.id), reservationNumber: r.reservationNumber || r.reservation_number || undefined, type: 'product',
        productName: r.productName || r.product_name || '상품명 확인 필요', productId: r.productId || r.product_id,
        customerName: r.customerName || r.customer_name || r.customer_info?.name || '고객명 확인 필요',
        country: r.country || r.customerCountry || r.customer_country || r.customer_info?.country || '한국',
        startDate, endDate, departureMs: time(startDate), date: startDate ? `${startDate} ~ ${endDate || ''}` : r.duration || '날짜 미정',
        bookedAt: createdAt ? new Date(createdAt).toLocaleDateString('ko-KR') : '', bookedAtMs: time(createdAt), status: r.status,
        totalAmount: total, deposit, depositStatus: r.depositStatus || r.deposit_status || (r.status === 'pending_payment' ? 'unpaid' : 'paid'),
        balance: money(r.balanceAmount ?? r.balance_amount ?? r.price_breakdown?.local ?? r.balance ?? Math.max(0, total - deposit)),
        balanceStatus: r.balanceStatus || r.balance_status || 'unpaid', depositReport: readDepositReport(r),
        contractUrl: r.contractUrl || r.contract_url, itineraryUrl: r.itineraryUrl || r.itinerary_url,
        itineraryTemplateId: r.itineraryTemplateId || r.itinerary_template_id,
        contractData: object(r.contractData ?? r.contract_data), documentContent: object(r.documentContent ?? r.document_content, null),
        assignedGuide: object(r.assignedGuide ?? r.assigned_guide), dailyAccommodations: array(r.dailyAccommodations ?? r.daily_accommodations),
        history: array(r.history), areAssignmentsVisibleToUser: !!(r.areAssignmentsVisibleToUser ?? r.are_assignments_visible_to_user),
        headcount: people ? `${people}명` : '미정', totalPeople: people, peopleKnown: count(r.travelers ?? r.totalPeople ?? r.total_people),
        phone: r.phone || r.customerPhone || r.customer_phone || r.customer_info?.phone || '',
        email: r.email || r.customerEmail || r.customer_email || r.customer_info?.email || '',
        manager: r.manager || r.assignedAdmin || r.assigned_admin || 'Admin', source: r.source || undefined, notes: text(r.notes),
        adminOperations: object(r.adminOperations ?? r.admin_operations), userId: r.userId || r.user_id,
        paymentKnown: { total: knownMoney(r.totalPrice ?? r.total_price ?? r.total_amount ?? r.price_breakdown?.total ?? r.totalAmount), deposit: knownMoney(r.depositAmount ?? r.deposit_amount ?? r.price_breakdown?.deposit ?? r.deposit), balance: knownMoney(r.balanceAmount ?? r.balance_amount ?? r.price_breakdown?.local ?? r.balance) },
    };
}

export function legacyWorkspaceReservation(q: any): any {
    const createdAt = q.createdAt || q.created_at;
    const total = money(q.confirmedPrice ?? q.confirmed_price ?? 0), deposit = money(q.deposit ?? 0);
    const detail = { ...q, userId: q.userId || q.user_id, travelTypes: array(q.travelTypes ?? q.travel_types), accommodations: array(q.accommodations),
        additionalRequest: q.additionalRequest ?? q.additional_request, adminNote: q.adminNote ?? q.admin_note, estimateUrl: q.estimateUrl ?? q.estimate_url,
        confirmedPrice: q.confirmedPrice ?? q.confirmed_price, confirmed_price: q.confirmed_price ?? q.confirmedPrice, confirmed_start_date: q.confirmed_start_date ?? q.confirmedStartDate,
        confirmed_end_date: q.confirmed_end_date ?? q.confirmedEndDate, deposit: q.deposit,
        deposit_status: q.deposit_status || q.depositStatus, balance_status: q.balance_status || q.balanceStatus,
        itineraryTemplateId: q.itineraryTemplateId || q.itinerary_template_id || '', documentContent: object(q.documentContent ?? q.document_content, null),
        date: createdAt ? new Date(createdAt).toLocaleDateString('ko-KR') : '' };
    return { id: String(q.id), type: 'quote', productName: `${q.destination || '몽골'} 맞춤 견적`, customerName: q.name || '고객명 확인 필요',
        date: q.period || '일정 미정', bookedAt: detail.date, bookedAtMs: time(createdAt), status: q.status,
        totalAmount: total, deposit, balance: Math.max(0, total - deposit), depositStatus: detail.deposit_status, balanceStatus: detail.balance_status,
        headcount: q.headcount || '인원 미정', totalPeople: 0, phone: q.phone || '', email: q.email || '', manager: q.manager || 'Admin',
        userId: q.userId || q.user_id, quoteDetail: detail };
}

const statusLabels: Record<string, string> = { pending_payment: '입금 대기', paid: '결제 완료', confirmed: '예약 확정', cancelled: '취소됨', completed: '여행 완료', on_hold: '보류', new: '신규 문의', processing: '견적 진행 중', answered: '견적 전달', reservation_requested: '예약 요청', converted: '예약 전환' };
export const customerReservationStatus = (status: string) => statusLabels[status] || status || '상태 확인 필요';

/** The authenticated account ID is the only supported customer grouping key. */
export function sameAccountProductBookings(rows: any[], userId: string | null | undefined): Array<{ id: string; label: string }> {
    if (!userId) return [];
    return rows.filter(row => row && (row.userId ?? row.user_id) === userId && row.id)
        .map(row => ({ id: String(row.id), label: [row.reservationNumber || row.reservation_number || row.id, row.productName || row.product_name || '상품 예약', toTourDateKey(row.startDate || row.start_date), `${Number(row.travelers ?? row.totalPeople ?? row.total_people ?? 0)}명`, customerReservationStatus(row.status)].filter(Boolean).join(' · ') }));
}

/** Presentation only: no merging by name/phone, and no synthetic payment or assignment completion. */
export function productCustomerOverview(r: any, days: any[], workflow: any, options: {
    vehicle: string; itineraryReady: boolean; itinerarySent: boolean; contractSent: boolean; itineraryChanged: boolean; contractChanged: boolean;
    deliveryHistory?: readonly AdminDeliveryItem[];
}): CustomerWorkspaceOverviewModel {
    const cancelled = r.status === 'cancelled';
    const contract = object(r.contractData ?? r.contract_data, {});
    const expected = r.peopleKnown === null ? null : count(r.peopleKnown ?? r.totalPeople);
    const customerDetails = contractCustomerDetails(contract, expected, options.contractSent);
    const signature = productSignatureStatus(contract, false);
    const signatureComplete = !!signature?.hasImage && !!signature.signedAt && Number.isFinite(Date.parse(signature.signedAt));
    const canPublish = !cancelled && ['confirmed', 'paid', 'completed'].includes(r.status);
    const tasks: CustomerWorkspaceOverviewModel['tasks'] = [];
    if (!cancelled) {
        if (!workflow.depositPaid) tasks.push({ id: 'deposit', label: '예약금 입금 확인', detail: r.depositReport ? `${text(r.depositReport.name) || '고객'} 입금 완료 신고 · 실제 입금 확인 전` : '입금 확인 기록이 없습니다.', action: 'payments', actionLabel: '입금 내역 확인' });
        if (!populated(r.email)) tasks.push({ id: 'email', label: '고객 이메일 등록', detail: '계약서·일정표 안내를 보낼 이메일이 없습니다.', action: 'edit-info', actionLabel: '주문자 정보 수정' });
        if (options.contractChanged) tasks.push({ id: 'contract-changed', label: '변경된 계약서 확인·재안내', detail: '마지막 안내 이후 계약서 내용이 변경되었습니다.', action: 'documents', actionLabel: '계약서 전달 관리' });
        if (!workflow.signed) tasks.push(options.contractSent
            ? { id: 'view-contract', label: '고객 계약 동의 대기', detail: '계약서 전달 기록은 있으나 고객의 동의가 완료되지 않았습니다.', action: 'view-info', actionLabel: '동의 상태 확인', waiting: true }
            : { id: 'deliver-contract', label: '여행 계약서 확인·전달', detail: '계약서 전달 기록과 고객 동의가 없습니다.', action: 'documents', actionLabel: '계약서 전달 관리' });
        if (!options.itineraryReady) tasks.push({ id: 'itinerary', label: '확정 일정 작성', detail: '고객에게 제공할 일정 내용이 아직 없습니다.', action: 'edit-itinerary', actionLabel: '일정표 편집' });
        if (!workflow.guideReady) tasks.push({ id: 'guide', label: '담당 가이드 배정', detail: '이 예약에 저장된 담당 가이드가 없습니다.', action: 'guide', actionLabel: '가이드 선택' });
        if (!options.vehicle) tasks.push({ id: 'vehicle', label: '투어 차량 배정', detail: '이 예약에 저장된 차량 정보가 없습니다.', action: 'vehicle', actionLabel: '차량 선택' });
        if (!workflow.accommodationsReady) tasks.push({ id: 'stay', label: '일자별 숙소 배정', detail: `${workflow.stayCount}/${workflow.nights}박 배정 · ${Math.max(0, workflow.nights - workflow.stayCount)}박 미배정`, action: 'stay', actionLabel: '숙소 선택' });
        const missingNames = expected !== null && expected > 0 ? Math.max(0, expected - customerDetails.travelers.registered) : null;
        const missingDetails = missingTravelerDetails(customerDetails.travelers.people, expected);
        if (expected === null || expected <= 0 || missingNames || missingDetails.length) tasks.push({ id: 'travelers',
            label: expected === null || expected <= 0 ? '예약 인원·여행자 확인' : missingNames ? '여행자 명단·세부 정보 확인' : '여행자 세부 정보 확인',
            detail: [expected !== null && expected > 0 ? `${customerDetails.travelers.registered}/${expected}명 이름 입력` : customerDetails.travelers.status,
                ...(missingNames ? [`${missingNames}명 이름 미입력`] : []), ...missingDetails.map(field => `${field.label} ${field.missing}명 미입력`)].join(' · '),
            action: 'travelers', actionLabel: '여행자 정보 확인' });
        const missingFlights = customerDetails.flights.map(flight => ({ label: flight.label, fields: [[flight.date, '날짜'], [flight.time, '시간'], [flight.flight, '편명']].filter(([value]) => !populated(value)).map(([, label]) => label) })).filter(flight => flight.fields.length);
        if (missingFlights.length) tasks.push({ id: 'flights', label: '항공편 정보 확인', detail: missingFlights.map(flight => `${flight.label} ${flight.fields.join('·')} 미입력`).join(' / '), action: 'flights', actionLabel: '항공편 정보 확인' });
        if (options.itineraryChanged) tasks.push({ id: 'itinerary-changed', label: '변경된 일정표 확인·재안내', detail: '마지막 안내 이후 일정표 내용이 변경되었습니다.', action: 'documents', actionLabel: '일정표 전달 관리' });
        else if (options.itineraryReady && !workflow.published) tasks.push(canPublish
            ? { id: 'publish', label: '확정 일정표 확인·공개', detail: '일정은 작성되었으나 고객에게 공개되지 않았습니다.', action: 'documents', actionLabel: '공개·전달 관리' }
            : { id: 'publish-blocked', label: '일정표 공개 전 예약 상태 확인', detail: `현재 ${customerReservationStatus(r.status)} 상태입니다. 결제 완료·예약 확정·여행 완료 상태에서 공개할 수 있습니다.`, action: 'payments', actionLabel: '예약·입금 상태 확인' });
        else if (workflow.published && !options.itinerarySent) tasks.push({ id: 'deliver-itinerary', label: '공개된 일정표 안내 전달', detail: '고객 공개는 완료되었으나 이메일 발송 기록이 없습니다.', action: 'documents', actionLabel: '일정표 전달 관리' });
    }
    const steps = [{ id: 'accepted', label: '예약 접수', done: true }, { id: 'deposit', label: '예약금 확인', done: workflow.depositPaid },
        { id: 'contract', label: '계약 동의', done: workflow.signed }, { id: 'schedule', label: '일정 준비', done: options.itineraryReady },
        { id: 'published', label: '일정표 공개', done: workflow.published }];
    const current = cancelled ? -1 : steps.findIndex(step => !step.done);
    return {
        customerName: r.customerName, sourceLabel: '상품 예약', bookingNumber: r.reservationNumber || r.id, statusLabel: customerReservationStatus(r.status), period: r.date, partyLabel: r.headcount,
        facts: [{ label: '이메일', value: r.email }, { label: '연락처', value: r.phone }, { label: '예약 상품', value: r.productName }, { label: '예약 접수', value: r.bookedAt }, ...(r.source ? [{ label: '주문 경로', value: ({ website: '홈페이지', kakao: '카카오톡', email: '이메일', phone: '전화', visit: '방문', other: '기타' } as Record<string,string>)[r.source] || r.source }] : []), ...(populated(r.notes) ? [{ label: '주문 메모', value: text(r.notes) }] : []), ...(populated(contract.customerSubmittedAt) ? [{ label: '고객 정보 제출', value: text(contract.customerSubmittedAt) }] : [])],
        ...customerDetails,
        recentHistory: customerRecentHistory({ source: 'product', record: r, deliveryHistory: options.deliveryHistory }, { includeInternal: true }),
        currentStage: customerCurrentStage({ status: r.status, steps, tasks, booking: true }),
        preferences: [], notes: (r.history || []).filter((h: any) => h.type === 'admin_memo').map((h: any, i: number) => ({ id: `${h.timestamp}:${i}`, body: h.description, at: h.timestamp ? new Date(h.timestamp).toLocaleString('ko-KR') : undefined })),
        days: overviewDays(days, r.dailyAccommodations || [], workflow.nights),
        documents: [{ id: 'itinerary', label: '확정 일정표', action: options.itineraryReady ? 'itinerary' : 'edit-itinerary', status: options.itineraryChanged ? '변경 후 재안내 필요' : workflow.published ? options.itinerarySent ? '공개 · 발송됨' : '공개됨' : options.itineraryReady ? '작성됨 · 공개 전' : '작성 필요' },
            { id: 'contract', label: '여행 계약서', action: 'contract-preview', status: signatureComplete ? '손서명 완료' : signature?.hasImage ? '서명 시각 확인 필요' : contract.agreement?.agreed === true ? '성명 동의 완료 · 손서명 미등록' : signature ? '서명 원본 확인 필요' : options.contractChanged ? '변경 후 재안내 필요' : options.contractSent ? '전달됨 · 동의 대기' : '내용 확인', ...(options.contractChanged ? { detail: '마지막 안내 후 계약서가 변경되어 재안내가 필요합니다.' } : {}) },
            { id: 'guide-pdf', label: '가이드 시트 PDF', action: 'guide-pdf', detail: '기존 가이드용 출력 기능' }],
        payment: { total: r.paymentKnown?.total === null ? null : r.totalAmount, deposit: r.paymentKnown?.deposit === null ? null : r.deposit, balance: r.paymentKnown?.balance === null ? null : r.balance, depositPaid: r.depositStatus === 'paid', balancePaid: r.balanceStatus === 'paid' },
        assignments: [{ id: 'guide', label: '담당 가이드', value: r.assignedGuide?.name || '미배정', statusLabel: workflow.guideReady ? '배정됨' : '확인 필요', state: workflow.guideReady ? 'ready' : 'pending' },
            { id: 'vehicle', label: '차량', value: options.vehicle || '미입력', statusLabel: options.vehicle ? '등록됨' : '확인 필요', state: options.vehicle ? 'ready' : 'pending' },
            { id: 'stay', label: '일자별 숙소', value: workflow.nights ? `${workflow.stayCount}/${workflow.nights}박` : '당일 투어', detail: (r.dailyAccommodations || []).filter((s: any) => s.accommodation?.name).map((s: any) => `${s.day}일차 ${s.accommodation.name}`).join(' · '), statusLabel: workflow.accommodationsReady ? '준비됨' : '배정 필요', state: workflow.accommodationsReady ? 'ready' : 'pending' }],
        steps: steps.map((step, i) => ({ ...step, current: i === current })), tasks,
        customerLinkAvailable: !cancelled, canSendItinerary: canPublish && !!r.email && options.itineraryReady,
    };
}

export function legacyCustomerOverview(q: any, content: any): CustomerWorkspaceOverviewModel {
    const days = Array.isArray(content?.days) ? content.days : [];
    const total = knownMoney(q.confirmed_price ?? q.confirmedPrice), deposit = knownMoney(q.deposit);
    const transitioned = ['converted', 'completed'].includes(q.status);
    const cancelled = q.status === 'cancelled';
    const contract = object(q.contractData ?? q.contract_data, null);
    const start = toTourDateKey(q.confirmed_start_date ?? q.confirmedStartDate), end = toTourDateKey(q.confirmed_end_date ?? q.confirmedEndDate);
    const nights = start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 86400000) : undefined;
    const model: CustomerWorkspaceOverviewModel = { customerName: q.name, sourceLabel: '이전 견적 문의', bookingNumber: q.id, statusLabel: customerReservationStatus(q.status), period: q.period || '일정 미정', partyLabel: q.headcount || '인원 미정',
        facts: [{ label: '이메일', value: q.email }, { label: '연락처', value: q.phone }, { label: '희망 여행지', value: q.destination }, { label: '예산', value: q.budget }],
        ...(contract ? contractCustomerDetails(contract, count(q.travelers ?? q.totalPeople ?? q.total_people), !!q.contractSent) : {}),
        preferences: [...(q.travelTypes || []), ...(q.accommodations || []), q.additionalRequest].filter((v: unknown) => typeof v === 'string' && v.trim()), notes: [],
        days: overviewDays(days, array(q.dailyAccommodations ?? q.daily_accommodations), nights),
        documents: [{ id: 'estimate', label: '견적 제안서', action: 'edit-itinerary', status: days.length ? '저장된 일정 있음' : '일정 작성 필요' }, { id: 'customer-page', label: '고객 견적 페이지', action: 'documents', detail: '기존 견적 작성·미리보기·전달 기능' }],
        payment: { total, deposit, balance: total !== null && deposit !== null ? Math.max(0, total - deposit) : null, depositPaid: q.deposit_status ? q.deposit_status === 'paid' : null, balancePaid: q.balance_status ? q.balance_status === 'paid' : null },
        assignments: [{ id: 'guide', label: '가이드', value: '예약 전환 후 관리', state: 'unknown', statusLabel: '예약 배정에서 확인' }, { id: 'vehicle', label: '희망 차량', value: q.vehicle || '미등록', state: 'unknown', statusLabel: '확정 배정과 구분' }, { id: 'stay', label: '희망 숙소', value: (q.accommodations || []).join(' · ') || '미등록', state: 'unknown', statusLabel: '확정 배정과 구분' }],
        steps: [{ id: 'accepted', label: '문의 접수', done: true }, { id: 'quote', label: '견적 작성', done: days.length > 0 }, { id: 'answered', label: '견적 안내 처리', done: ['answered', 'reservation_requested', 'converted', 'completed'].includes(q.status) }, { id: 'requested', label: '예약 요청', done: ['reservation_requested', 'converted', 'completed'].includes(q.status) }, { id: 'converted', label: '예약 전환', done: transitioned }],
        tasks: transitioned || cancelled ? [] : q.status === 'reservation_requested'
            ? [{ id: 'convert', label: '고객 예약 요청 검토·전환', detail: '고객이 예약을 요청했습니다. 희망 조건과 금액을 확인한 후 예약으로 전환하세요.', action: 'convert', actionLabel: '예약 전환 확인' }]
            : [{ id: 'prepare', label: days.length ? '견적 금액·일정 확인·전달' : '맞춤 견적 일정 작성', detail: days.length ? '저장된 견적 내용을 확인하고 고객 전달 방법을 선택하세요.' : '저장된 견적 일정이 없습니다. 고객의 희망 조건을 반영해 작성하세요.', action: days.length ? 'documents' : 'edit-itinerary', actionLabel: days.length ? '견적 전달 관리' : '견적 일정 작성' }], customerLinkAvailable: !cancelled, canSendItinerary: false };
    model.recentHistory = customerRecentHistory({ source: 'legacy', record: q }, { includeInternal: true });
    model.currentStage = transitioned ? { label: '예약 전환 완료', tone: 'complete' } : customerCurrentStage({ status: q.status, steps: model.steps, tasks: model.tasks, booking: false });
    return model;
}
