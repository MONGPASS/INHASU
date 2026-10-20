import { trackedDelivery, type DeliveryOutcome } from './adminDelivery.ts';
import { documentRevision, productDocumentRevisions, quoteDocumentRevisions } from './adminDocumentRevision.ts';
import { hasProductSchedule, loadProductDocument, parseDocumentJson, productItineraryPublished } from './productItinerary.ts';
import { isQuoteBooking, summarizeQuoteBooking } from './quoteBookings.ts';
import { productSignatureRecord } from '../../src/utils/productContractSignature.ts';
import { toTourDateKey } from '../../src/utils/formatDate.ts';
import { DEPOSIT_ACCOUNT } from '../../src/constants/company.ts';
// @ts-ignore Shared Solapi helper remains a JavaScript module.
import { sendKakaoAlimtalk, kakaoDeliveryResult, sendFailReason, customerPath, GUIDEBOOK_PATH } from '../api/_solapi.js';

export type CustomerNotificationKind = 'request_received' | 'quote' | 'change_requested' | 'reservation_requested' | 'deposit_requested' | 'travelers_requested' | 'contract' | 'contract_signed' | 'booking_confirmed' | 'itinerary' | 'travel_notice';
export type CustomerNotificationSource = 'product' | 'quote_booking';
export type CustomerNotificationEnv = { DB: any; [key: string]: any };
export interface CustomerNotificationInput { source: CustomerNotificationSource; bookingId: string; kind: CustomerNotificationKind; eventKey: string; forceManual?: boolean; }
export interface NotificationTemplate { id: string; name: string; variables: readonly string[]; linkPurpose: 'customer' | 'contract' | 'travelers' | 'itinerary' | 'guidebook'; }
type TemplateDefinition = Omit<NotificationTemplate, 'id'> & { id?: string; envKeys?: readonly string[]; sources?: readonly CustomerNotificationSource[] };
export const APPROVED_NOTIFICATION_PROFILE_ID = 'KA01PF260709023307591VCu6JTR2UNU';

// Entries without an approved template ID fail closed. Environment settings take
// precedence; no provider template discovery or mutation is performed at runtime.
export const NOTIFICATION_TEMPLATE_REGISTRY: Partial<Record<CustomerNotificationKind, TemplateDefinition>> = {
    request_received: { id: 'KA01TP2607130715542944mHt7DCfdl6', name: '맞춤 여행 견적 요청 접수', variables: ['#{고객명}', '#{회사명}', '#{링크}'], linkPurpose: 'customer', sources: ['quote_booking'] },
    reservation_requested: { id: 'KA01TP260713071911685KZAkkwcrS9q', name: '선택 견적 예약 진행 요청 접수', variables: ['#{고객명}', '#{회사명}', '#{링크}'], linkPurpose: 'customer', sources: ['quote_booking'] },
    deposit_requested: { id: 'KA01TP2607130720577712Kt4V9ywVK3', name: '예약금 입금 안내', variables: ['#{고객명}', '#{회사명}', '#{링크}'], linkPurpose: 'customer' },
    change_requested: { id: 'KA01TP260713071753441oFcWkUwDsqw', name: '일정 변경 요청 접수', variables: ['#{고객명}', '#{회사명}', '#{링크}'], linkPurpose: 'customer', sources: ['quote_booking'] },
    travelers_requested: { id: 'KA01TP260713072146949PhEo09o6Hx6', name: '여행자 정보 입력 요청', variables: ['#{고객명}', '#{회사명}', '#{링크}'], linkPurpose: 'travelers' },
    contract_signed: { id: 'KA01TP260713072305355gT1HCnc32cr', name: '계약서 서명 접수', variables: ['#{고객명}', '#{회사명}', '#{링크}'], linkPurpose: 'customer' },
    booking_confirmed: { id: 'KA01TP260713072344844VSbYqd8dAAu', name: '여행 예약 확정', variables: ['#{고객명}', '#{회사명}', '#{링크}'], linkPurpose: 'customer' },
    quote: { id: 'KA01TP260713071649273oEGvOPMTakg', name: '견적서 도착 안내', variables: ['#{고객명}', '#{회사명}', '#{링크}'], linkPurpose: 'customer', envKeys: ['SOLAPI_TEMPLATE_QUOTE_ID', 'SOLAPI_KAKAO_QUOTE_TEMPLATE_ID'] },
    contract: { id: 'KA01TP260818040134973vh8mMoMR2gq', name: '계약서·여행자 정보 요청', variables: ['#{고객명}', '#{회사명}', '#{링크}'], linkPurpose: 'contract', envKeys: ['SOLAPI_TEMPLATE_CONTRACT_ID', 'SOLAPI_KAKAO_CONTRACT_TEMPLATE_ID'] },
    itinerary: { id: 'KA01TP260713072507314ax4oJkW3a5K', name: '확정 일정표 안내', variables: ['#{고객명}', '#{회사명}', '#{링크}'], linkPurpose: 'itinerary', envKeys: ['SOLAPI_TEMPLATE_ITINERARY_ID', 'SOLAPI_KAKAO_ITINERARY_TEMPLATE_ID'] },
    // The old D7 guidebook message is deliberately excluded. This approved body
    // confirms completed signing and must never be sent before a saved signature.
    travel_notice: { id: 'KA01TP260820081146181ADPL9Ew1eIN', name: '여행 준비 안내', variables: ['#{고객명}', '#{출발일}', '#{회사명}', '#{링크}'], linkPurpose: 'guidebook', envKeys: ['SOLAPI_TEMPLATE_TRAVEL_NOTICE_ID'] },
};
const KINDS: CustomerNotificationKind[] = ['request_received', 'quote', 'change_requested', 'reservation_requested', 'deposit_requested', 'travelers_requested', 'contract', 'contract_signed', 'booking_confirmed', 'itinerary', 'travel_notice'];
const DOCUMENT_KINDS = new Set<CustomerNotificationKind>(['quote', 'contract', 'itinerary']);
const text = (value: any) => typeof value === 'string' ? value.trim() : '';
const object = (value: any) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const number = (value: any) => Number.isFinite(Number(value)) ? Number(value) : 0;
const failed = (error: string): DeliveryOutcome => ({ ok: false, state: 'failed', error });
const safeReason = (value: unknown) => String(value || '').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);

function templateId(env: CustomerNotificationEnv, kind: CustomerNotificationKind) {
    const definition = NOTIFICATION_TEMPLATE_REGISTRY[kind];
    if (!definition) return '';
    const keys = definition.envKeys || [`SOLAPI_TEMPLATE_${kind.toUpperCase()}_ID`];
    const configured = keys.map(key => text(env[key])).find(Boolean);
    if (configured) return configured;
    const profile = text(env.SOLAPI_PF_ID || env.SOLAPI_KAKAO_PF_ID);
    return !profile || profile === APPROVED_NOTIFICATION_PROFILE_ID ? text(definition.id) : '';
}
export function resolveNotificationTemplate(env: CustomerNotificationEnv, kind: CustomerNotificationKind): NotificationTemplate | null {
    const definition = NOTIFICATION_TEMPLATE_REGISTRY[kind], id = templateId(env, kind);
    if (!definition || !id) return null;
    // A configuration copy/paste must not send one event's body for another event.
    if (KINDS.some(other => other !== kind && templateId(env, other) === id)) return null;
    return { id, name: definition.name, variables: definition.variables, linkPurpose: definition.linkPurpose };
}

async function loadCustomer(db: any, input: CustomerNotificationInput) {
    if (input.source === 'product') {
        const row = await db.prepare('SELECT * FROM reservations WHERE id=?').bind(input.bookingId).first();
        if (!row) return null;
        const contract = object(parseDocumentJson(row.contract_data, {}));
        const days = input.kind === 'itinerary' ? (await loadProductDocument(db, row)).days : [];
        return { row, name: text(row.customer_name), phone: String(row.customer_phone || '').replace(/\D/g, ''), token: '',
            depart: toTourDateKey(row.start_date), returning: toTourDateKey(row.end_date), productName: text(row.product_name),
            pax: number(row.travelers), total: number(row.total_price), deposit: number(row.deposit_amount), balance: number(row.balance_amount),
            bank: DEPOSIT_ACCOUNT.bank, account: DEPOSIT_ACCOUNT.number, accountHolder: DEPOSIT_ACCOUNT.holder,
            booking: true, paid: row.deposit_status === 'paid', signed: !!productSignatureRecord(contract),
            confirmed: ['confirmed', 'paid', 'completed'].includes(row.status), published: productItineraryPublished(row),
            schedule: hasProductSchedule(days), quote: false, changeRequested: false };
    }
    const native = await db.prepare('SELECT * FROM requests WHERE id=?').bind(input.bookingId).first();
    if (!native) return null;
    const data = parseDocumentJson(native.data, null);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Invalid request record');
    const row = { ...data, id: native.id, status: native.status || data.status, name: native.name ?? data.name, phone: native.phone ?? data.phone, token: native.token ?? data.token };
    const summary = summarizeQuoteBooking(row), ci = object(row.booking?.contractInfo), days = Array.isArray(row.booking?.days) ? row.booking.days : [];
    return { row, name: text(row.name), phone: String(row.phone || '').replace(/\D/g, ''), token: text(row.token),
        depart: toTourDateKey(row.depart), returning: toTourDateKey(row.return_), productName: text(ci.productName) || text(row.destination) || text(row.quote?.name),
        pax: summary.totalPeople, total: summary.totalAmount, deposit: summary.deposit, balance: summary.balance,
        bank: text(ci.bankName) || DEPOSIT_ACCOUNT.bank, account: text(ci.accountNumber) || DEPOSIT_ACCOUNT.number, accountHolder: text(ci.accountHolder) || DEPOSIT_ACCOUNT.holder,
        booking: isQuoteBooking(row), paid: summary.depositStatus === 'paid', signed: summary.quoteBooking.signed,
        confirmed: ['confirmed', 'completed'].includes(summary.status), published: summary.quoteBooking.published,
        schedule: days.some((day: any) => text(day?.dest) || text(day?.title) || text(day?.summary) || (Array.isArray(day?.items) && day.items.some((item: any) => text(item)))),
        quote: Object.keys(object(row.quote)).length > 0, changeRequested: Array.isArray(row.changeRequests) && row.changeRequests.length > 0 };
}
type Customer = NonNullable<Awaited<ReturnType<typeof loadCustomer>>>;

function eligibility(input: CustomerNotificationInput, customer: Customer): string | null {
    const row = customer.row;
    const allowedSources = NOTIFICATION_TEMPLATE_REGISTRY[input.kind]?.sources;
    if (allowedSources && !allowedSources.includes(input.source)) return '해당 알림 문구는 이 예약 종류에 사용할 수 없습니다.';
    if (/^(cancelled|canceled|deleted|취소|예약취소|삭제)$/i.test(text(row.status)) || row.progress === '예약취소' || row.deletedAt || row.deleted_at) return '취소되거나 삭제된 예약에는 자동 알림을 보내지 않습니다.';
    if (!/^0\d{8,10}$/.test(customer.phone)) return '고객 연락처를 확인해 주세요.';
    if (input.source === 'quote_booking' && !customer.token) return '고객 전용 링크가 없습니다.';
    if (input.kind === 'quote' && (input.source !== 'quote_booking' || !customer.quote)) return '저장된 맞춤 견적서가 없습니다.';
    if (input.kind === 'change_requested' && !customer.changeRequested) return '저장된 견적 수정 요청이 없습니다.';
    if (['deposit_requested', 'travelers_requested', 'contract', 'contract_signed', 'booking_confirmed', 'travel_notice'].includes(input.kind) && !customer.booking) return '예약 관리가 시작되지 않았습니다.';
    if (input.kind === 'contract' && !customer.paid) return '예약금 확인 후 계약서 안내를 보낼 수 있습니다.';
    if (input.kind === 'contract_signed' && !customer.signed) return '저장된 고객 서명이 없습니다.';
    if (input.kind === 'booking_confirmed' && !customer.confirmed) return '예약이 아직 확정되지 않았습니다.';
    if (input.kind === 'itinerary' && (!customer.published || !customer.schedule)) return '저장하고 공개한 확정 일정표가 없습니다.';
    if (input.kind === 'travel_notice' && (!customer.signed || !customer.depart)) return '고객 서명과 여행 출발일을 먼저 확인해 주세요.';
    if (input.kind === 'deposit_requested' && !(customer.deposit > 0)) return '저장된 예약금이 없습니다.';
    return null;
}

function customerLink(input: CustomerNotificationInput, customer: Customer, purpose: NotificationTemplate['linkPurpose']) {
    if (purpose === 'guidebook') return GUIDEBOOK_PATH;
    if (input.source === 'quote_booking') return purpose === 'itinerary' ? `${encodeURI('확정일정표.html')}?t=${encodeURIComponent(customer.token)}` : purpose === 'travelers' ? `${encodeURI('여행자정보.html')}?t=${encodeURIComponent(customer.token)}` : customerPath(customer.token);
    const id = encodeURIComponent(input.bookingId);
    return purpose === 'contract' || purpose === 'travelers' ? `documents/contract/${id}` : purpose === 'itinerary' ? `documents/itinerary/${id}` : `mypage/reservations/${id}`;
}

function templateVariables(env: CustomerNotificationEnv, input: CustomerNotificationInput, customer: Customer, template: NotificationTemplate) {
    const won = (value: number) => Math.round(value).toLocaleString('ko-KR');
    const values: Record<string, string> = {
        '#{고객명}': customer.name || '고객', '#{회사명}': text(env.NOTIFY_COMPANY) || '몽골리아 은하수 여행사',
        '#{링크}': customerLink(input, customer, template.linkPurpose), '#{출발일}': customer.depart, '#{도착일}': customer.returning,
        '#{여행명}': customer.productName, '#{상품명}': customer.productName, '#{여행상품명}': customer.productName,
        '#{예약번호}': text(customer.row.reservation_number || customer.row.reservationNumber) || input.bookingId,
        '#{인원}': String(customer.pax), '#{예약금}': won(customer.deposit), '#{예약금액}': won(customer.deposit), '#{총금액}': won(customer.total), '#{잔금}': won(customer.balance),
        '#{은행명}': customer.bank, '#{은행}': customer.bank, '#{계좌번호}': customer.account, '#{예금주}': customer.accountHolder,
    };
    if (template.variables.some(variable => values[variable] === undefined || values[variable] === '')) return null;
    return Object.fromEntries(template.variables.map(variable => [variable, values[variable]]));
}

async function fulfilledNotice(db: any, input: CustomerNotificationInput, revision: string) {
    if (DOCUMENT_KINDS.has(input.kind) && !input.forceManual) return db.prepare("SELECT id,provider_id FROM admin_delivery_attempts WHERE source=? AND booking_id=? AND kind=? AND channel='kakao' AND state='accepted' AND document_revision=? ORDER BY created_at DESC LIMIT 1")
        .bind(input.source, input.bookingId, input.kind, revision).first();
    // Automatic signing and an administrator's explicit travel notice share one
    // short cooldown so finishing concurrently cannot notify the customer twice.
    if (input.forceManual || input.kind === 'travel_notice') {
        const accepted = await db.prepare("SELECT id,provider_id FROM admin_delivery_attempts WHERE source=? AND booking_id=? AND kind=? AND channel='kakao' AND state='accepted' AND created_at>? ORDER BY created_at DESC LIMIT 1")
            .bind(input.source, input.bookingId, input.kind, new Date(Date.now() - 60_000).toISOString()).first();
        return accepted ? { ...accepted, cooldown: true } : null;
    }
    return null;
}
const fulfilledOutcome = (accepted: { id: string; provider_id?: string; cooldown?: boolean }): DeliveryOutcome => ({ ok: true, state: 'accepted', duplicate: true, id: accepted.id, providerId: accepted.provider_id || undefined,
    ...(accepted.cooldown ? { error: '방금 접수된 알림입니다. 중복 발송하지 않았으며 1분 후 다시 보낼 수 있습니다.' } : {}) });

/** Server-only event dispatcher. Calling sites persist their business action first;
 * this function never changes payment, publication, signatures, or customer data. */
export async function dispatchCustomerNotification(env: CustomerNotificationEnv, input: CustomerNotificationInput): Promise<DeliveryOutcome> {
    if (!input || !['product', 'quote_booking'].includes(input.source) || !text(input.bookingId) || input.bookingId.length > 150 || !KINDS.includes(input.kind) || !text(input.eventKey) || input.eventKey.length > 300 || (input.forceManual !== undefined && typeof input.forceManual !== 'boolean')) return failed('자동 알림 이벤트 정보를 확인해 주세요.');
    let providerStarted = false;
    try {
        const customer = await loadCustomer(env.DB, input);
        if (!customer) return failed('예약이 삭제되었거나 없습니다.');
        const template = resolveNotificationTemplate(env, input.kind);
        const revisions: Record<string, string> = DOCUMENT_KINDS.has(input.kind)
            ? input.source === 'product' ? await productDocumentRevisions(env.DB, customer.row) : await quoteDocumentRevisions(customer.row) : {};
        const revision = revisions[input.kind] || await documentRevision({ kind: input.kind, event: input.eventKey });
        const key = await documentRevision({ source: input.source, bookingId: input.bookingId, kind: input.kind, event: input.eventKey });
        // A manual send of this exact document already fulfils its automatic notice.
        if ((DOCUMENT_KINDS.has(input.kind) || input.forceManual || input.kind === 'travel_notice') && await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_delivery_attempts'").first()) {
            const pending = await env.DB.prepare("SELECT id,state FROM admin_delivery_attempts WHERE source=? AND booking_id=? AND kind=? AND state IN ('sending','unknown') LIMIT 1").bind(input.source, input.bookingId, input.kind).first();
            if (pending) return { ok: false, state: pending.state, duplicate: true, id: pending.id, error: '이전 발송 결과를 확인해야 합니다. 중복 발송을 막기 위해 다시 보내지 않았습니다.' };
            if (input.source === 'quote_booking' && input.kind === 'itinerary' && await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='itinerary_notice_dispatches'").first()) {
                const legacyName = 'itinerary_notice_dispatches';
                const unresolved = await env.DB.prepare(`SELECT state FROM ${legacyName} WHERE request_id=? AND state IN ('sending','unknown') LIMIT 1`).bind(input.bookingId).first();
                if (unresolved) return { ok: false, state: unresolved.state, duplicate: true, error: '이전 일정표 발송 결과를 확인해야 합니다. 중복 발송하지 않았습니다.' };
            }
            const accepted = await fulfilledNotice(env.DB, input, revision);
            if (accepted) return fulfilledOutcome(accepted);
        }
        let fulfilled: { id: string; provider_id?: string; cooldown?: boolean } | undefined, attemptError = '';
        const delivery = await trackedDelivery(env.DB, { source: input.source, bookingId: input.bookingId, kind: input.kind, channel: 'kakao', key, revision }, async () => {
            // The earlier receipt check may race with a send finishing in another tab.
            if (DOCUMENT_KINDS.has(input.kind) || input.forceManual || input.kind === 'travel_notice') {
                fulfilled = await fulfilledNotice(env.DB, input, revision) || undefined;
                if (fulfilled) return { ok: false, skipped: true };
            }
            // Read again after claiming: a cancellation, token rotation or customer edit
            // occurring during an asynchronous request must not use stale recipients.
            const current = await loadCustomer(env.DB, input);
            if (!current) { attemptError = '예약이 삭제되었거나 없습니다.'; return { ok: false, skipped: true }; }
            const blocked = eligibility(input, current);
            attemptError = blocked || (!template ? '해당 알림의 전용 카카오 템플릿 설정을 확인해 주세요.' : !env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET ? '카카오 알림톡 발송 설정이 필요합니다.' : '');
            if (attemptError || !template) return { ok: false, skipped: true };
            const variables = templateVariables(env, input, current, template);
            if (!variables) { attemptError = '카카오 알림 템플릿에 필요한 고객 정보를 확인해 주세요.'; return { ok: false, skipped: true }; }
            if (DOCUMENT_KINDS.has(input.kind)) {
                const currentVersions: Record<string, string> = input.source === 'product' ? await productDocumentRevisions(env.DB, current.row) : await quoteDocumentRevisions(current.row);
                if (currentVersions[input.kind] !== revision) { attemptError = '문서가 변경되어 이전 버전의 자동 발송을 중지했습니다.'; return { ok: false, skipped: true }; }
            }
            providerStarted = true;
            const response = await sendKakaoAlimtalk({ ...env, SOLAPI_PF_ID: env.SOLAPI_PF_ID || env.SOLAPI_KAKAO_PF_ID || APPROVED_NOTIFICATION_PROFILE_ID }, { phone: current.phone, templateId: template.id, variables, disableSms: true });
            const result = kakaoDeliveryResult(response);
            if (!result.ok) attemptError = safeReason(sendFailReason(response));
            return result;
        });
        if (fulfilled) {
            if (delivery.id) await env.DB.prepare('UPDATE admin_delivery_attempts SET error=? WHERE id=?').bind('동일한 고객 안내가 이미 접수되어 중복 발송하지 않았습니다.', delivery.id).run();
            return fulfilledOutcome(fulfilled);
        }
        if (!delivery.ok && attemptError) {
            const error = delivery.state === 'unknown' ? `${delivery.error || '발송 결과를 확인해야 합니다.'} (${attemptError})` : attemptError;
            if (delivery.id) await env.DB.prepare('UPDATE admin_delivery_attempts SET error=? WHERE id=?').bind(error, delivery.id).run();
            return { ...delivery, error };
        }
        return delivery;
    } catch {
        return { ok: false, state: providerStarted ? 'unknown' : 'failed', error: providerStarted
            ? '자동 알림 발송 결과 기록을 확인하지 못했습니다. 이력 확인 전에는 다시 발송하지 마세요.'
            : '자동 알림 발송 이력을 준비하지 못해 발송하지 않았습니다.' };
    }
}
