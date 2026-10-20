import type { AdminDeliveryItem } from '../types/adminDelivery';
import { productSignatureStatus } from './productContractSignature.ts';

export type CustomerHistoryKind = 'inquiry' | 'quote' | 'booking' | 'payment' | 'contract' | 'customer' | 'assignment' | 'document' | 'memo' | 'change';
export interface CustomerRecentHistoryItem { id: string; at: string; title: string; detail?: string; kind: CustomerHistoryKind; internal?: boolean; }
export interface CustomerCurrentStage { label: string; detail?: string; tone: 'active' | 'waiting' | 'complete' | 'cancelled'; }
type Seed = Omit<CustomerRecentHistoryItem, 'id' | 'at'> & { at: unknown; key: string };
const record = (value: any): Record<string, any> => {
    for (let i = 0; i < 3 && typeof value === 'string'; i++) { try { value = JSON.parse(value); } catch { return {}; } }
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};
const list = (value: any): any[] => {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return []; } }
    return Array.isArray(value) ? value.filter(row => row && typeof row === 'object' && !Array.isArray(row)) : [];
};
// Never project signature pixels, document tokens, or serialized customer snapshots into a history row.
const text = (value: unknown, length = 300): string => typeof value === 'string' && !/data:image\/|"signImg"\s*:|[?&](?:t|token)=/i.test(value) ? value.trim().slice(0, length) : '';
const stamp = (value: unknown): string | undefined => {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 && Number.isFinite(new Date(value).getTime()) ? new Date(value).toISOString() : undefined;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(value.trim())) return undefined;
    const saved = value.trim(), parsed = Date.parse(saved);
    if (!Number.isFinite(parsed)) return undefined;
    const day = saved.slice(0, 10);
    if (new Date(day + 'T00:00:00Z').toISOString().slice(0, 10) !== day) return undefined;
    // Older confirmations only store a date. Do not invent a midnight processing time.
    return saved.length === 10 ? day : new Date(parsed).toISOString();
};
const hash = (value: string): string => { let result = 2166136261; for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619); return (result >>> 0).toString(36); };

const eventLabels: Record<string, [CustomerHistoryKind, string, string?]> = {
    quote_notification_queued: ['quote', '견적서 안내 발송 요청'], quote_notification_skipped: ['quote', '견적서 안내 발송 건너뜀'],
    quote_sent: ['quote', '견적서 발송 기록'], quote_document_changed: ['quote', '견적서 내용 변경'],
    itinerary_notification_queued: ['document', '확정 일정표 안내 발송 요청'], itinerary_notification_skipped: ['document', '확정 일정표 안내 발송 건너뜀'],
    itinerary_document_changed: ['document', '확정 일정표 내용 변경'], contract_document_changed: ['contract', '계약서 내용 변경'],
    contract_notification_queued: ['contract', '계약서 안내 발송 요청'], contract_notification_skipped: ['contract', '계약서 안내 발송 건너뜀'],
    contract_requested: ['contract', '계약서 서명 요청'], contract_signed: ['contract', '계약서 서명 기록'],
    travelers_requested: ['customer', '여행자 정보 입력 요청'], travelers_submitted: ['customer', '고객 여행자 정보 제출'],
    customer_submitted: ['customer', '고객 여행자·항공 정보 제출'], deposit_requested: ['payment', '예약금 입금 안내 요청'],
    deposit_reported: ['payment', '고객 입금 완료 신고'], deposit_confirmed: ['payment', '예약금 입금 확인'],
    payment_changed: ['payment', '결제 상태 변경'], payment_confirmed: ['payment', '결제 확인 기록'],
    status_change: ['booking', '예약 상태 변경'], document_added: ['document', '고객 문서 등록'],
    customer_link_rotated: ['document', '고객 문서 링크 재발급'], travel_notice_sent: ['document', '여행 주의사항 발송 기록'],
    travel_notice_failed: ['document', '여행 주의사항 발송 실패'], review_submitted: ['customer', '고객 여행 후기 제출'],
    review_request_sent: ['document', '여행 후기 안내 발송 기록'], reminder_sent: ['document', '결제 안내 발송 기록'],
};

/** Admin-only adapters opt in to private memo rows; all rows require a real stored date. */
export function customerRecentHistory(input: { source: 'product' | 'quote' | 'legacy'; record: any; deliveryHistory?: readonly AdminDeliveryItem[] }, options: { includeInternal?: boolean; limit?: number } = {}): CustomerRecentHistoryItem[] {
    const seeds: Seed[] = [], r = record(input.record), product = input.source === 'product', booking = record(r.booking), contract = record(r.contractData ?? r.contract_data);
    const add = (key: string, at: unknown, kind: CustomerHistoryKind, title: string, detail?: unknown, internal = false) => {
        if (internal && !options.includeInternal) return;
        seeds.push({ key, at, kind, title, ...(text(detail) ? { detail: text(detail) } : {}), ...(internal ? { internal: true } : {}) });
    };
    const addNativeEvents = (events: any[]) => events.forEach(event => {
        const type = text(event.type), at = [event.timestamp, event.at, event.date, event.createdAt].find(value => stamp(value));
        const internal = /(?:^|_)(?:memo|internal|admin_note)(?:_|$)/.test(type) || event.internal === true;
        const description = text(event.description || event.label || event.title), detail = text(event.detail);
        if (internal) { add('memo:' + hash(description + detail), at, 'memo', '내부 상담 메모 저장', [description, detail].filter(Boolean).join(' · '), true); return; }
        const known = eventLabels[type];
        if (known) { add(type, at, known[0], known[1], [description, detail].filter(Boolean).join(' · ')); return; }
        if (!description && !detail) return;
        const kind = /가이드|차량|숙소|배정/.test(description) ? 'assignment' : /계약/.test(description) ? 'contract' : /일정|문서/.test(description) ? 'document' : 'change';
        add(`${type || 'saved'}:${hash(description + detail)}`, at, kind, description || '저장된 처리 기록', detail);
    });
    if (product) {
        add('booking-created', r.createdAt ?? r.created_at ?? r.bookedAtMs, 'booking', '상품 예약 접수');
        addNativeEvents(list(r.history));
        const report = record(r.depositReport ?? r.deposit_report);
        if (report.status === 'reported') add('deposit_reported', report.reportedAt, 'payment', '고객 입금 완료 신고');
        add('customer_submitted', contract.customerSubmittedAt, 'customer', '고객 여행자·항공 정보 제출');
        const agreement = record(contract.agreement);
        if (agreement.agreed === true) add('contract-agreement', agreement.agreedAt, 'contract', '계약서 성명 동의 저장');
        const signature = productSignatureStatus(contract, false);
        const signatureAt = stamp(signature?.signedAt);
        if (signature && signatureAt) add('contract_signed', signatureAt, 'contract', signature.hasImage ? '계약서 손서명 저장' : '계약서 서명 시각 기록 · 원본 확인 필요');
    } else {
        add('inquiry-created', r.receivedAt ?? r.createdAt ?? r.created_at, 'inquiry', '견적 문의 접수');
        addNativeEvents([...list(r.activities), ...list(r.history), ...list(booking.history)]);
        if (r.quote) add('quote-issued', r.quoteIssuedAt ?? record(r.notify).quoteSentAt, 'quote', '견적서 발행 기록');
        const decision = record(r.decision);
        if (decision.status === 'accepted') add('booking-accepted', decision.acceptedAt, 'booking', decision.source === 'customer' ? '고객 예약 진행 의사 접수' : '예약 진행 의사 기록');
        add('booking-prepared', booking.preparedAt, 'booking', '견적 예약 정보 생성');
        add('booking-confirmed', booking.confirmedAt, 'booking', '예약 확정 기록');
        add('itinerary-published', booking.publishedAt, 'document', '확정 일정표 공개 기록');
        for (const [field, key, kind, title] of [
            ['depositRequest', 'deposit_requested', 'payment', '예약금 입금 안내 요청'], ['contractRequest', 'contract_requested', 'contract', '계약서 서명 요청'],
            ['travelerSubmission', 'travelers_requested', 'customer', '여행자 정보 입력 요청'],
        ] as const) { const value = record(booking[field]); add(key, value.requestedAt, kind, title); }
        const report = record(booking.depositReport); if (report.status === 'reported') add('deposit_reported', report.reportedAt, 'payment', '고객 입금 완료 신고');
        add('travelers_submitted', record(booking.travelerSubmission).submittedAt, 'customer', '고객 여행자 정보 제출');
        add('contract_signed', record(booking.contract).signedAt, 'contract', '계약서 서명 기록');
        add('travel_notice_sent', record(r.notify).travelNoticeSentAt, 'document', '여행 주의사항 발송 기록');
        list(r.changeRequests).forEach(change => add('customer-change:' + text(change.id) + ':' + hash(text(change.detail || change.description)), change.at ?? change.requestedAt, 'customer', '고객 일정 변경 요청', Array.isArray(change.categories) ? change.categories.map(item => text(item)).filter(Boolean).join(' · ') : undefined));
    }
    const documentNames: Record<string, string> = { quote: '견적서', contract: '계약서', itinerary: '확정 일정표', travel_notice: '여행 주의사항' };
    const stateNames: Record<string, string> = { accepted: '발송 서비스 접수', queued: '발송 요청', failed: '발송 실패', unknown: '발송 결과 확인 필요', sending: '발송 처리 중', legacy: '이전 발송 기록' };
    for (const delivery of input.deliveryHistory || []) {
        if (!documentNames[delivery.kind] || !stateNames[delivery.state]) continue;
        add(`delivery:${delivery.id}`, delivery.at, delivery.kind === 'contract' ? 'contract' : delivery.kind === 'quote' ? 'quote' : 'document', `${documentNames[delivery.kind]} ${stateNames[delivery.state]}`, delivery.channel === 'email' ? '이메일' : delivery.channel === 'kakao' ? '카카오 알림톡' : undefined);
    }
    const seen = new Map<string, CustomerRecentHistoryItem>();
    for (const seed of seeds) {
        const at = stamp(seed.at); if (!at || !seed.title) continue;
        const identity = `${seed.key}:${at}`, existing = seen.get(identity);
        if (existing) { if (!existing.detail && seed.detail) existing.detail = seed.detail; continue; }
        seen.set(identity, { id: `${input.source}:${hash(identity)}`, at, title: seed.title, kind: seed.kind, ...(seed.detail ? { detail: seed.detail } : {}), ...(seed.internal ? { internal: true } : {}) });
    }
    return [...seen.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, Math.max(0, Math.min(100, options.limit ?? 20)));
}

/** Current state is a separate summary, never a fabricated timestamped event. */
export function customerCurrentStage(input: { status?: string; steps: Array<{ label: string; done: boolean }>; tasks: Array<{ label: string; detail?: string; waiting?: boolean }>; booking?: boolean }): CustomerCurrentStage {
    if (['cancelled', '취소', '예약취소'].includes(input.status || '')) return { label: input.booking === false ? '문의 취소' : '예약 취소', tone: 'cancelled' };
    if (['completed', '완료', '투어종료'].includes(input.status || '')) return { label: input.booking === false ? '문의 처리 완료' : '여행 완료', tone: 'complete' };
    if (['on_hold', '보류'].includes(input.status || '')) return { label: '진행 보류', tone: 'waiting' };
    const next = input.tasks.find(task => !task.waiting) || input.tasks[0], step = input.steps.find(item => !item.done);
    return { label: step?.label || (input.tasks.length ? input.booking === false ? '예약 진행 준비' : '여행 준비 확인' : '등록된 준비 단계 완료'),
        ...(next ? { detail: next.label } : {}), tone: next?.waiting ? 'waiting' : step || next ? 'active' : 'complete' };
}
