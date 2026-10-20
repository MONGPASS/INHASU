import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';
import { trackedDelivery, type DeliveryOutcome } from '../lib/adminDelivery';
import { productDocumentRevisions, quoteDocumentRevisions } from '../lib/adminDocumentRevision';
import { hasProductSchedule, loadProductDocument, parseDocumentJson, productItineraryPublished } from '../lib/productItinerary';
import { isQuoteBooking, summarizeQuoteBooking } from '../lib/quoteBookings';
import { toTourDateKey } from '../../src/utils/formatDate';
// Reuse configured approved templates; never fall back to an unrelated template or SMS.
// @ts-ignore Existing shared JavaScript notification module.
import { sendKakaoAlimtalk, quoteTemplateId, contractTemplateId, itineraryTemplateId, travelNoticeTemplateId, customerPath, GUIDEBOOK_PATH } from './_solapi.js';

type Source = 'product' | 'quote_booking';
type Kind = 'quote' | 'contract' | 'itinerary' | 'travel_notice';
type Env = { DB: any; [key: string]: any };
type Attempt = { id?: string; state: DeliveryOutcome['state']; at: string; channel: string; error?: string };
type Notice = { kind: Kind; label: string; description: string; available: boolean; reason?: string; lastAttempt?: Attempt; cooldownUntil?: string };
const kinds: Kind[] = ['quote', 'contract', 'itinerary', 'travel_notice'];
const COOLDOWN_MS = 60_000;
const text = (value: any) => typeof value === 'string' ? value.trim() : '';
const object = (value: any) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const phone = (value: any) => String(value || '').replace(/\D/g, '');
const cancelled = (row: any) => /^(cancelled|canceled|deleted|취소|예약취소|삭제)$/i.test(text(row.status)) || row.progress === '예약취소' || !!row.deletedAt || !!row.deleted_at;
const knownState = (value: any): Attempt['state'] => ['accepted', 'failed', 'sending'].includes(value) ? value : 'unknown';

const app = new Hono<{ Bindings: Env }>();
app.use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    // Session cookies are the only authorization. Reject cross-site mutations before work.
    if (c.req.method !== 'GET') {
        const origin = c.req.header('Origin');
        if (c.req.header('Sec-Fetch-Site') === 'cross-site' || (origin && origin !== new URL(c.req.url).origin)) return c.json({ error: '같은 관리자 페이지에서 발송해 주세요.' }, 403);
    }
    return requireAdmin(c, next);
});

function routeScope(source: string, id: string): source is Source {
    return ['product', 'quote_booking'].includes(source) && !!id && id.length <= 150 && !/[\u0000-\u001f]/.test(id);
}

async function loadRecord(db: any, source: Source, id: string) {
    if (source === 'product') {
        const row = await db.prepare('SELECT * FROM reservations WHERE id=?').bind(id).first();
        if (!row) return null;
        return { row, name: text(row.customer_name), phone: phone(row.customer_phone), depart: toTourDateKey(row.start_date),
            paid: row.deposit_status === 'paid', booking: true, published: productItineraryPublished(row),
            schedule: hasProductSchedule((await loadProductDocument(db, row)).days), token: '', quote: false };
    }
    const row = await db.prepare('SELECT * FROM requests WHERE id=?').bind(id).first();
    if (!row) return null;
    const data = parseDocumentJson(row.data, null);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid request record');
    const rec = { ...data, id: row.id, status: row.status || data.status, name: row.name ?? data.name, phone: row.phone ?? data.phone, token: row.token ?? data.token };
    const summary = summarizeQuoteBooking(rec);
    return { row: rec, name: text(rec.name), phone: phone(rec.phone), depart: toTourDateKey(rec.depart), token: text(rec.token),
        paid: summary.depositStatus === 'paid', booking: isQuoteBooking(rec), published: summary.quoteBooking.published,
        schedule: Array.isArray(rec.booking?.days) && rec.booking.days.some((day: any) => text(day?.dest) || text(day?.title) || text(day?.summary) || (Array.isArray(day?.items) && day.items.some((item: any) => text(item)))),
        quote: Object.keys(object(rec.quote)).length > 0 };
}

async function attempts(db: any, source: Source, id: string): Promise<Array<Attempt & { kind: string; key?: string }>> {
    const table = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='admin_delivery_attempts'").first();
    const found: Array<Attempt & { kind: string; key?: string }> = [];
    if (table) {
        const result = await db.prepare('SELECT id,kind,channel,state,error,created_at,dispatch_key FROM admin_delivery_attempts WHERE source=? AND booking_id=? ORDER BY created_at DESC,rowid DESC LIMIT 200').bind(source, id).all();
        for (const row of result.results || []) found.push({ id: row.id, kind: row.kind, channel: row.channel, state: knownState(row.state), at: row.created_at, key: row.dispatch_key, error: row.error || undefined });
        // Older unresolved attempts still block sending after many later notices of other kinds.
        const unresolved = await db.prepare("SELECT id,kind,channel,state,error,created_at,dispatch_key FROM admin_delivery_attempts WHERE source=? AND booking_id=? AND state IN ('sending','unknown')").bind(source, id).all();
        for (const row of unresolved.results || []) if (!found.some(item => item.id === row.id)) found.push({ id: row.id, kind: row.kind, channel: row.channel, state: knownState(row.state), at: row.created_at, key: row.dispatch_key, error: row.error || undefined });
    }
    if (source === 'quote_booking' && await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='itinerary_notice_dispatches'").first()) {
        // This optional ledger belongs to the legacy quote API, outside siteSchema.
        const legacyName = 'itinerary_notice_dispatches';
        const result = await db.prepare(`SELECT dispatch_key,state,created_at FROM ${legacyName} WHERE request_id=? ORDER BY created_at DESC LIMIT 100`).bind(id).all();
        const unresolved = await db.prepare(`SELECT dispatch_key,state,created_at FROM ${legacyName} WHERE request_id=? AND state IN ('sending','unknown')`).bind(id).all();
        for (const row of [...(result.results || []), ...(unresolved.results || [])]) if (!found.some(item => item.kind === 'itinerary' && item.key === row.dispatch_key)) found.push({ kind: 'itinerary', channel: 'kakao', state: knownState(row.state), at: row.created_at, key: row.dispatch_key,
            error: ['sending', 'unknown'].includes(row.state) ? '이전 일정표 발송 결과를 먼저 확인해 주세요.' : undefined });
    }
    return found.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
}

function templateFor(env: Env, kind: Kind) {
    const templates: Record<Kind, string> = { quote: quoteTemplateId(env), contract: contractTemplateId(env), itinerary: itineraryTemplateId(env), travel_notice: travelNoticeTemplateId(env) };
    const selected = templates[kind];
    // Configured IDs identify distinct approved messages. A copy/paste collision is unsafe.
    return selected && !kinds.some(other => other !== kind && templates[other] === selected) ? selected : '';
}

function describe(kind: Kind): Pick<Notice, 'label' | 'description'> {
    if (kind === 'quote') return { label: '견적서 도착 안내', description: '저장된 견적서를 확인할 수 있는 고객 전용 링크를 보냅니다.' };
    if (kind === 'contract') return { label: '계약서·여행자 정보 요청', description: '입금 확인 후 여행 계약서 확인·서명과 여행자 정보 입력을 안내합니다.' };
    if (kind === 'itinerary') return { label: '확정 일정표 안내', description: '고객에게 공개된 확정 일정표 확인 링크를 보냅니다.' };
    return { label: '여행 준비 안내', description: '몽골 여행 주의사항과 준비물 안내 PDF를 보냅니다.' };
}

/** Enable the action in the existing customer hub only after actual provider acceptance.
 * JSON_SET reads the current row atomically; never replace a concurrently submitted
 * traveler list, signature, payment acknowledgement, or rotated customer token. */
async function requestQuoteContract(db: any, id: string, token: string): Promise<{ warning?: string }> {
    const now = new Date().toISOString();
    const event = JSON.stringify({ at: now, type: 'contract_requested', detail: '계약서 확인·서명 및 여행자 정보 입력 안내 알림톡 접수' });
    const updated = await db.prepare(`UPDATE requests SET data=json_set(data,
        '$.booking.contractRequest.status','requested',
        '$.booking.contractRequest.requestedAt',COALESCE(NULLIF(json_extract(data,'$.booking.contractRequest.requestedAt'),''),?),
        '$.booking.travelerSubmission',json(CASE
          WHEN json_extract(data,'$.booking.travelerSubmission.status')='submitted'
            OR COALESCE(json_extract(data,'$.booking.travelerSubmission.submittedAt'),'')<>''
          THEN json_extract(data,'$.booking.travelerSubmission')
          ELSE json_set(CASE WHEN json_type(data,'$.booking.travelerSubmission')='object' THEN json_extract(data,'$.booking.travelerSubmission') ELSE '{}' END,
            '$.status','requested',
            '$.requestedAt',COALESCE(NULLIF(json_extract(data,'$.booking.travelerSubmission.requestedAt'),''),?),
            '$.expectedCount',COALESCE(CAST(json_extract(data,'$.adult') AS INTEGER),0)+COALESCE(CAST(json_extract(data,'$.child') AS INTEGER),0)+COALESCE(CAST(json_extract(data,'$.infant') AS INTEGER),0),
            '$.submittedCount',CASE WHEN json_type(data,'$.booking.travelers')='array' THEN json_array_length(data,'$.booking.travelers') ELSE 0 END)
          END),
        '$.activities',json_insert(CASE WHEN json_type(data,'$.activities')='array' THEN json_extract(data,'$.activities') ELSE '[]' END,'$[#]',json(?)))
        WHERE id=? AND COALESCE(token,json_extract(data,'$.token'))=?
          AND json_type(data,'$.booking')='object'
          AND COALESCE(json_extract(data,'$.booking.contract.signedAt'),'')=''
          AND (json_extract(data,'$.booking.contractInfo.depositStatus')='입금완료'
            OR (COALESCE(json_extract(data,'$.booking.contractInfo.depositStatus'),'')='' AND json_extract(data,'$.booking.checklist.deposit')=1))
          AND COALESCE(status,json_extract(data,'$.status'),'') NOT IN ('cancelled','canceled','deleted','취소','예약취소','삭제')
          AND COALESCE(json_extract(data,'$.progress'),'')<>'예약취소'`)
        .bind(now, now, event, id, token).run();
    if (updated.meta?.changes === 1) return {};
    const current = await db.prepare('SELECT token,status,data FROM requests WHERE id=?').bind(id).first();
    const data = current ? parseDocumentJson(current.data, {}) : {};
    // A signature received during sending already enables the signed-document action.
    if (current && (current.token ?? data.token) === token && data.booking?.contract?.signedAt) return {};
    return { warning: '카카오 알림은 접수됐지만 예약 또는 고객 링크가 변경되어 계약서 요청 상태를 반영하지 않았습니다. 고객 링크와 요청 상태를 확인해 주세요.' };
}

function noticeState(env: Env, source: Source, record: NonNullable<Awaited<ReturnType<typeof loadRecord>>>, history: Awaited<ReturnType<typeof attempts>>, kind: Kind): Notice {
    const last = history.find(item => item.kind === kind && ['kakao', 'message'].includes(item.channel));
    const pending = history.find(item => item.kind === kind && ['sending', 'unknown'].includes(item.state));
    const accepted = history.find(item => item.kind === kind && item.state === 'accepted' && ['kakao', 'message'].includes(item.channel));
    const cooldown = accepted && Date.parse(accepted.at) + COOLDOWN_MS > Date.now() ? new Date(Date.parse(accepted.at) + COOLDOWN_MS).toISOString() : undefined;
    let reason: string | undefined;
    if (cancelled(record.row)) reason = '취소되거나 삭제된 예약에는 발송할 수 없습니다.';
    else if (!/^0\d{8,10}$/.test(record.phone)) reason = '고객 연락처를 먼저 확인해 주세요.';
    else if (source === 'product' && kind === 'quote') reason = '상품 예약에는 맞춤 견적서 알림을 보내지 않습니다.';
    else if (source === 'quote_booking' && !record.token) reason = '고객 전용 링크가 없습니다. 예약 정보를 확인해 주세요.';
    else if (kind === 'quote' && !record.quote) reason = '견적서를 먼저 작성하고 저장해 주세요.';
    else if (kind === 'contract' && (!record.booking || !record.paid)) reason = '예약금 입금을 확인한 뒤 계약서 안내를 보낼 수 있습니다.';
    else if (kind === 'itinerary' && (!record.published || !record.schedule)) reason = '여행 일정을 저장하고 고객에게 공개한 뒤 보내 주세요.';
    else if (kind === 'travel_notice' && (!record.booking || !record.depart)) reason = '예약 관리와 여행 출발일을 먼저 확인해 주세요.';
    else if (!env.SOLAPI_API_KEY || !env.SOLAPI_API_SECRET || !(env.SOLAPI_PF_ID || env.SOLAPI_KAKAO_PF_ID)) reason = '카카오 알림톡 발송 설정이 필요합니다.';
    else if (!templateFor(env, kind)) reason = '해당 알림의 전용 카카오 템플릿 설정을 확인해 주세요.';
    else if (pending) reason = pending.state === 'sending' ? '이전 발송 요청을 처리 중입니다. 이력을 확인해 주세요.' : '이전 발송 결과를 확인해야 합니다. 중복 발송을 중지했습니다.';
    else if (cooldown) reason = '방금 접수된 알림입니다. 1분 후 다시 보낼 수 있습니다.';
    return { kind, ...describe(kind), available: !reason, ...(reason ? { reason } : {}), ...(last ? { lastAttempt: { id: last.id, state: last.state, at: last.at, channel: last.channel, error: last.error } } : {}), ...(cooldown ? { cooldownUntil: cooldown } : {}) };
}

app.get('/:source/:id', async c => {
    const source = c.req.param('source'), id = c.req.param('id');
    if (!routeScope(source, id)) return c.json({ error: '예약 종류와 ID를 확인해 주세요.' }, 400);
    try {
        const record = await loadRecord(c.env.DB, source, id);
        if (!record) return c.json({ error: '예약이 삭제되었거나 없습니다.' }, 404);
        const history = await attempts(c.env.DB, source, id);
        return c.json({ source, bookingId: id, recipient: { name: record.name || '고객', phone: record.phone ? `***-****-${record.phone.slice(-4)}` : '' },
            notices: kinds.filter(kind => source !== 'product' || kind !== 'quote').map(kind => noticeState(c.env, source, record, history, kind)) });
    } catch { return c.json({ error: '고객 알림 발송 상태를 불러오지 못했습니다. 잠시 후 다시 확인해 주세요.' }, 503); }
});

app.post('/:source/:id', async c => {
    const source = c.req.param('source'), id = c.req.param('id');
    if (!routeScope(source, id)) return c.json({ error: '예약 종류와 ID를 확인해 주세요.' }, 400);
    let body: any;
    try { body = await c.req.json(); } catch { return c.json({ error: '발송할 알림 정보를 확인해 주세요.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['kind', 'idempotencyKey'].includes(key)) || !kinds.includes(body.kind) || typeof body.idempotencyKey !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(body.idempotencyKey)) return c.json({ error: '알림 종류와 발송 요청 키를 확인해 주세요.' }, 400);
    const kind = body.kind as Kind;
    let providerStarted = false;
    try {
        const record = await loadRecord(c.env.DB, source, id);
        if (!record) return c.json({ error: '예약이 삭제되었거나 없습니다.' }, 404);
        const history = await attempts(c.env.DB, source, id);
        // A retried HTTP request must return its original receipt, even during cooldown.
        const prior = history.find(item => item.kind === kind && item.key === body.idempotencyKey);
        if (prior) return c.json({ ok: prior.state === 'accepted', state: prior.state, duplicate: true, id: prior.id, error: prior.error }, prior.state === 'accepted' ? 200 : 409);
        const notice = noticeState(c.env, source, record, history, kind);
        if (!notice.available) return c.json({ ok: false, state: history.find(item => item.kind === kind && ['sending', 'unknown'].includes(item.state))?.state || 'failed', error: notice.reason, cooldownUntil: notice.cooldownUntil }, 409);
        const revisions: Record<string, string> = source === 'product' ? await productDocumentRevisions(c.env.DB, record.row) : await quoteDocumentRevisions(record.row);
        const path = kind === 'travel_notice' ? GUIDEBOOK_PATH : source === 'product' ? `documents/${kind === 'contract' ? 'contract' : 'itinerary'}/${encodeURIComponent(id)}` : kind === 'itinerary' ? `${encodeURI('확정일정표.html')}?t=${encodeURIComponent(record.token)}` : customerPath(record.token);
        let cooldownBlocked = false;
        const result = await trackedDelivery(c.env.DB, { source, bookingId: id, kind, channel: 'kakao', key: body.idempotencyKey, revision: revisions[kind] }, async () => {
            // Recheck after the atomic delivery claim: another tab may have completed since GET.
            const latest = await attempts(c.env.DB, source, id);
            if (latest.some(item => item.kind === kind && item.state === 'accepted' && ['kakao', 'message'].includes(item.channel) && Date.parse(item.at) + COOLDOWN_MS > Date.now())) {
                cooldownBlocked = true;
                return { ok: false, skipped: true };
            }
            providerStarted = true;
            const response = await sendKakaoAlimtalk(c.env, { phone: record.phone, templateId: templateFor(c.env, kind), disableSms: true,
                variables: { '#{고객명}': record.name || '고객', '#{회사명}': c.env.NOTIFY_COMPANY || '몽골리아 은하수 여행사', '#{링크}': path, ...(kind === 'travel_notice' ? { '#{출발일}': record.depart } : {}) } });
            // A provider's explicit failed-message result is not successful delivery acceptance.
            const rejected = (Array.isArray(response.failedMessageList) && response.failedMessageList.length > 0) || !!response.errorCode || (!!response.statusCode && String(response.statusCode) !== '2000');
            const messageId = typeof response.messageId === 'string' ? response.messageId : undefined;
            const groupId = typeof response.groupId === 'string' ? response.groupId : undefined;
            const accepted = response.ok && response.httpStatus >= 200 && response.httpStatus < 300 && !rejected && !!(messageId || groupId);
            return { ok: accepted, httpStatus: rejected ? 422 : response.ok && !accepted ? 502 : response.httpStatus, skipped: response.skipped,
                id: messageId, groupId };
        });
        if (cooldownBlocked) {
            const error = '방금 접수된 알림입니다. 1분 후 다시 보낼 수 있습니다.';
            if (result.id) await c.env.DB.prepare('UPDATE admin_delivery_attempts SET error=? WHERE id=?').bind(error, result.id).run();
            return c.json({ ...result, error }, 409);
        }
        if (result.ok && !result.duplicate && source === 'quote_booking' && kind === 'contract') {
            try { return c.json({ ...result, ...await requestQuoteContract(c.env.DB, id, record.token) }); }
            catch { return c.json({ ...result, warning: '카카오 알림은 접수됐지만 계약서 요청 상태를 저장하지 못했습니다. 다시 발송하지 말고 고객의 계약서 요청 상태를 확인해 주세요.' }); }
        }
        return c.json(result, result.ok ? 200 : result.state === 'unknown' ? 502 : 409);
    } catch {
        return c.json({ ok: false, state: providerStarted ? 'unknown' : 'failed', error: providerStarted
            ? '발송 결과 기록을 확인하지 못했습니다. 발송 이력을 확인하기 전에는 다시 보내지 마세요.'
            : '발송 이력을 확인하거나 저장하지 못해 알림을 보내지 않았습니다. 잠시 후 다시 확인해 주세요.' }, 503);
    }
});

export default app;
