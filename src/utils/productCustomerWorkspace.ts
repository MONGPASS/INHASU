import { toTourDateKey } from './formatDate.ts';
import { readDepositReport } from './reservationDetail.ts';
import type { CustomerWorkspaceOverviewModel } from '../components/admin/CustomerWorkspaceOverview';

const object = (value: any, fallback: any = undefined) => {
    for (let i = 0; i < 3 && typeof value === 'string'; i++) { try { value = JSON.parse(value); } catch { return fallback; } }
    return value && typeof value === 'object' ? value : fallback;
};
const time = (value: any) => { const date = new Date(value || ''); return Number.isNaN(date.getTime()) ? 0 : date.getTime(); };
const money = (value: any) => Number.isFinite(Number(value)) ? Number(value) : 0;
const knownMoney = (value: any) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
const array = (value: any) => { const parsed = object(value, []); return Array.isArray(parsed) ? parsed : []; };

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
        headcount: people ? `${people}명` : '미정', totalPeople: people,
        phone: r.phone || r.customerPhone || r.customer_phone || r.customer_info?.phone || '',
        email: r.email || r.customerEmail || r.customer_email || r.customer_info?.email || '',
        manager: r.manager || r.assignedAdmin || r.assigned_admin || 'Admin', source: r.source || undefined,
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
}): CustomerWorkspaceOverviewModel {
    const cancelled = r.status === 'cancelled';
    const tasks: CustomerWorkspaceOverviewModel['tasks'] = [];
    if (!cancelled) {
        if (!workflow.depositPaid) tasks.push({ id: 'deposit', label: r.depositReport ? '고객이 알린 예약금 입금을 확인하세요.' : '예약금 입금 내역을 확인하세요.', action: 'payments' });
        if (!workflow.signed) tasks.push({ id: 'contract', label: options.contractSent ? '고객의 계약 동의를 확인하세요.' : '여행 계약서를 준비하고 전달하세요.', action: 'contract' });
        if (!options.itineraryReady) tasks.push({ id: 'itinerary', label: '확정 일정을 작성하세요.', action: 'edit-itinerary' });
        if (!workflow.guideReady) tasks.push({ id: 'guide', label: '담당 가이드를 배정하세요.', action: 'guide' });
        if (!options.vehicle) tasks.push({ id: 'vehicle', label: '차량 정보를 입력하세요.', action: 'vehicle' });
        if (!workflow.accommodationsReady) tasks.push({ id: 'stay', label: `숙소 ${workflow.stayCount}/${workflow.nights}박 배정을 확인하세요.`, action: 'stay' });
        if (!workflow.travelersReady) tasks.push({ id: 'travelers', label: '여행자 정보를 확인하세요.', action: 'edit-info' });
        if (options.itineraryChanged || options.contractChanged) tasks.push({ id: 'changed', label: '고객 문서 변경 내용을 확인하고 다시 안내하세요.', action: 'documents' });
        else if (options.itineraryReady && !workflow.published) tasks.push({ id: 'publish', label: '일정표 내용을 확인하고 고객에게 공개하세요.', action: 'documents' });
    }
    const steps = [{ id: 'accepted', label: '예약 접수', done: true }, { id: 'deposit', label: '예약금 확인', done: workflow.depositPaid },
        { id: 'contract', label: '계약 동의', done: workflow.signed }, { id: 'schedule', label: '일정 준비', done: options.itineraryReady },
        { id: 'published', label: '일정표 공개', done: workflow.published }];
    const current = cancelled ? -1 : steps.findIndex(step => !step.done);
    return {
        customerName: r.customerName, sourceLabel: '상품 예약', bookingNumber: r.reservationNumber || r.id, statusLabel: customerReservationStatus(r.status), period: r.date, partyLabel: r.headcount,
        facts: [{ label: '이메일', value: r.email }, { label: '연락처', value: r.phone }, { label: '예약 상품', value: r.productName }, { label: '예약 접수', value: r.bookedAt }, ...(r.source ? [{ label: '주문 경로', value: ({ website: '홈페이지', kakao: '카카오톡', email: '이메일', phone: '전화', visit: '방문', other: '기타' } as Record<string,string>)[r.source] || r.source }] : [])],
        preferences: [], notes: (r.history || []).filter((h: any) => h.type === 'admin_memo').map((h: any, i: number) => ({ id: `${h.timestamp}:${i}`, body: h.description, at: h.timestamp ? new Date(h.timestamp).toLocaleString('ko-KR') : undefined })),
        days: days.map((d: any, i: number) => ({ id: String(d.id || i + 1), day: Number(d.day) || i + 1, title: d.title || d.region || `${i + 1}일차`, date: d.date,
            summary: Array.isArray(d.items) ? d.items.join(' · ') : d.summary || (d.activities || []).map((a: any) => a.title).filter(Boolean).join(' · '),
            image: d.photos?.[0] || d.images?.[0] || d.activities?.find((a: any) => a.photos?.length || a.images?.length)?.photos?.[0] || d.activities?.find((a: any) => a.images?.length)?.images?.[0] })),
        documents: [{ id: 'itinerary', label: '확정 일정표', action: options.itineraryReady ? 'itinerary' : 'edit-itinerary', status: options.itineraryChanged ? '변경 후 재안내 필요' : workflow.published ? options.itinerarySent ? '공개 · 발송됨' : '공개됨' : options.itineraryReady ? '작성됨 · 공개 전' : '작성 필요' },
            { id: 'contract', label: '여행 계약서', action: 'contract-preview', status: options.contractChanged ? '변경 후 재안내 필요' : workflow.signed ? '고객 동의 완료' : options.contractSent ? '전달됨 · 동의 대기' : '내용 확인' },
            { id: 'guide-pdf', label: '가이드 시트 PDF', action: 'guide-pdf', detail: '기존 가이드용 출력 기능' }],
        payment: { total: r.paymentKnown?.total === null ? null : r.totalAmount, deposit: r.paymentKnown?.deposit === null ? null : r.deposit, balance: r.paymentKnown?.balance === null ? null : r.balance, depositPaid: r.depositStatus === 'paid', balancePaid: r.balanceStatus === 'paid' },
        assignments: [{ id: 'guide', label: '담당 가이드', value: r.assignedGuide?.name || '미배정', statusLabel: workflow.guideReady ? '배정됨' : '확인 필요', state: workflow.guideReady ? 'ready' : 'pending' },
            { id: 'vehicle', label: '차량', value: options.vehicle || '미입력', statusLabel: options.vehicle ? '등록됨' : '확인 필요', state: options.vehicle ? 'ready' : 'pending' },
            { id: 'stay', label: '일자별 숙소', value: workflow.nights ? `${workflow.stayCount}/${workflow.nights}박` : '당일 투어', detail: (r.dailyAccommodations || []).filter((s: any) => s.accommodation?.name).map((s: any) => `${s.day}일차 ${s.accommodation.name}`).join(' · '), statusLabel: workflow.accommodationsReady ? '준비됨' : '배정 필요', state: workflow.accommodationsReady ? 'ready' : 'pending' }],
        steps: steps.map((step, i) => ({ ...step, current: i === current })), tasks,
        customerLinkAvailable: !cancelled, canSendItinerary: !cancelled && !!r.email && options.itineraryReady,
    };
}

export function legacyCustomerOverview(q: any, content: any): CustomerWorkspaceOverviewModel {
    const days = Array.isArray(content?.days) ? content.days : [];
    const total = knownMoney(q.confirmed_price ?? q.confirmedPrice), deposit = knownMoney(q.deposit);
    const transitioned = ['converted', 'completed'].includes(q.status);
    return { customerName: q.name, sourceLabel: '이전 견적 문의', bookingNumber: q.id, statusLabel: customerReservationStatus(q.status), period: q.period || '일정 미정', partyLabel: q.headcount || '인원 미정',
        facts: [{ label: '이메일', value: q.email }, { label: '연락처', value: q.phone }, { label: '희망 여행지', value: q.destination }, { label: '예산', value: q.budget }],
        preferences: [...(q.travelTypes || []), ...(q.accommodations || []), q.additionalRequest].filter((v: unknown) => typeof v === 'string' && v.trim()), notes: [],
        days: days.map((d: any, i: number) => ({ id: String(d.id || i + 1), day: Number(d.day) || i + 1, date: d.date, title: d.title || d.region || `${i + 1}일차`, summary: d.summary || (d.items || []).join(' · '), image: d.images?.[0] || d.photos?.[0] || d.activities?.find((a: any) => a.images?.length)?.images?.[0] })),
        documents: [{ id: 'estimate', label: '견적 제안서', action: 'edit-itinerary', status: days.length ? '저장된 일정 있음' : '일정 작성 필요' }, { id: 'customer-page', label: '고객 견적 페이지', action: 'documents', detail: '기존 견적 작성·미리보기·전달 기능' }],
        payment: { total, deposit, balance: total !== null && deposit !== null ? Math.max(0, total - deposit) : null, depositPaid: q.deposit_status ? q.deposit_status === 'paid' : null, balancePaid: q.balance_status ? q.balance_status === 'paid' : null },
        assignments: [{ id: 'guide', label: '가이드', value: '예약 전환 후 관리', state: 'unknown', statusLabel: '예약 배정에서 확인' }, { id: 'vehicle', label: '희망 차량', value: q.vehicle || '미등록', state: 'unknown', statusLabel: '확정 배정과 구분' }, { id: 'stay', label: '희망 숙소', value: (q.accommodations || []).join(' · ') || '미등록', state: 'unknown', statusLabel: '확정 배정과 구분' }],
        steps: [{ id: 'accepted', label: '문의 접수', done: true }, { id: 'quote', label: '견적 작성', done: days.length > 0 }, { id: 'answered', label: '견적 안내 처리', done: ['answered', 'reservation_requested', 'converted', 'completed'].includes(q.status) }, { id: 'requested', label: '예약 요청', done: ['reservation_requested', 'converted', 'completed'].includes(q.status) }, { id: 'converted', label: '예약 전환', done: transitioned }],
        tasks: transitioned ? [] : q.status === 'reservation_requested' ? [{ id: 'convert', label: '고객 예약 요청을 확인하고 예약으로 전환하세요.', action: 'convert' }] : [{ id: 'prepare', label: days.length ? '견적 금액·일정을 확인하고 고객에게 전달하세요.' : '희망 조건을 확인하고 견적 일정을 작성하세요.', action: 'documents' }], customerLinkAvailable: true, canSendItinerary: false };
}
