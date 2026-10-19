import type { AdminDeliveryData, AdminDeliveryItem, AdminDeliveryKind } from '../../src/types/adminDelivery';
import { isQuoteBooking, summarizeQuoteBooking } from './quoteBookings';
import { hasProductSchedule, loadProductDocument, productItineraryPublished } from './productItinerary';
import { productDocumentRevisions, quoteDocumentRevisions } from './adminDocumentRevision';

const parse = (value: any, fallback: any = {}) => { try { return typeof value === 'string' ? JSON.parse(value) : value || fallback; } catch { return fallback; } };
const list = (value: any): any[] => Array.isArray(value) ? value : [];
const kindFor = (value: string): AdminDeliveryKind | null => /contract|계약|契約/i.test(value) ? 'contract' : /itinerary|일정|日程/i.test(value) ? 'itinerary' : /travel_notice|주의사항/.test(value) ? 'travel_notice' : /quote|견적/.test(value) ? 'quote' : null;

/** Read both native sources without copying reservations or exposing customer document URLs. */
export async function readAdminDeliveries(db: any, source: 'product' | 'quote_booking', bookingId: string): Promise<AdminDeliveryData | null> {
    const items: AdminDeliveryItem[] = [], warnings: string[] = [];
    const noticeKeys = new Map<string, string>();
    const changedAt: Record<string, number> = {};
    let workflow: AdminDeliveryData['workflow'];
    let revisions: Record<string, string>;
    if (source === 'product') {
        const row = await db.prepare('SELECT * FROM reservations WHERE id=?').bind(bookingId).first();
        if (!row) return null;
        const content = await loadProductDocument(db, row), contract = parse(row.contract_data);
        revisions = await productDocumentRevisions(db, row);
        const schedule = hasProductSchedule(content.days || []);
        workflow = { accepted: true, deposit: row.deposit_status === 'paid', contract: contract.agreement?.agreed === true,
            schedule, published: schedule && productItineraryPublished(row) };
        list(parse(row.history, [])).forEach((event, index) => {
            const kind = kindFor(String(event.description || ''));
            if (kind && event.type === 'modification' && /저장|변경|확정|결정/.test(String(event.description || ''))) changedAt[kind] = Math.max(changedAt[kind] || 0, Date.parse(event.timestamp) || 0);
            if (event.type === 'email' && kind) items.push({ id: `product-history:${index}`, kind, channel: 'email', state: 'legacy', at: String(event.timestamp || ''), legacy: true });
        });
    } else {
        const row = await db.prepare('SELECT id,status,data FROM requests WHERE id=?').bind(bookingId).first();
        if (!row) return null;
        const rec = { ...parse(row.data), id: row.id, status: row.status };
        if (!isQuoteBooking(rec)) return null;
        revisions = await quoteDocumentRevisions(rec);
        const q = summarizeQuoteBooking(rec);
        workflow = { accepted: true, deposit: q.depositStatus === 'paid', contract: q.quoteBooking.signed,
            schedule: list(rec.booking?.days).length > 0,
            published: q.status !== 'cancelled' && q.quoteBooking.published };
        list(rec.activities).forEach((event, index) => {
            const type = String(event.type || ''), kind = kindFor(type);
            if (kind && type.endsWith('_document_changed')) changedAt[kind] = Math.max(changedAt[kind] || 0, Date.parse(event.at) || 0);
            if (!kind || !/notification_(queued|skipped)|travel_notice_(sent|failed)/.test(type)) return;
                items.push({ id: `quote-history:${index}`, kind, channel: kind === 'contract' ? 'message' : 'kakao', at: String(event.at || ''), legacy: true,
                state: /skipped|failed/.test(type) ? 'failed' : /travel_notice_sent/.test(type) ? 'legacy' : 'queued',
                error: /skipped|failed/.test(type) ? '발송 설정 또는 수신 정보를 확인해 주세요.' : undefined });
        });
        const table = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='itinerary_notice_dispatches'").first();
        if (table) {
            // Legacy quote routes create this optional table after their first notice, outside siteSchema.
            const quoteLedgerName = 'itinerary_notice_dispatches';
            const result = await db.prepare(`SELECT dispatch_key,state,created_at,result FROM ${quoteLedgerName} WHERE request_id=? ORDER BY created_at DESC LIMIT 100`).bind(bookingId).all();
            list(result.results).forEach((row, index) => { const receipt = parse(row.result);
                const publicId = `quote-notice:${index}`;
                noticeKeys.set(publicId, row.dispatch_key);
                items.push({ id: publicId, kind: 'itinerary', channel: 'kakao', state: row.state, at: row.created_at,
                    providerId: typeof receipt.result?.groupId === 'string' ? receipt.result.groupId : typeof receipt.groupId === 'string' ? receipt.groupId : undefined,
                    error: row.state === 'unknown' ? '서비스의 발송 결과를 확인해야 합니다. 중복 재발송하지 마세요.' : undefined });
            });
        }
    }
    try {
        const rows = await db.prepare('SELECT id,kind,channel,state,error,provider_id,created_at,dispatch_key,document_revision FROM admin_delivery_attempts WHERE source=? AND booking_id=? ORDER BY created_at DESC, rowid DESC LIMIT 100').bind(source, bookingId).all();
        const tracked: AdminDeliveryItem[] = list(rows.results).map(r => ({ id: r.id, kind: kindFor(r.kind) || 'itinerary', channel: r.channel, state: r.state, at: r.created_at,
            error: r.error || undefined, providerId: r.provider_id || undefined, revision: r.document_revision || undefined }));
        // A legacy request and its newer provider receipt represent the same attempt.
        const legacy = items.filter(item => {
            const noticeKey = noticeKeys.get(item.id);
            if (noticeKey) return !list(rows.results).some(row => kindFor(row.kind) === item.kind && row.channel === item.channel &&
                (row.dispatch_key === noticeKey || (item.providerId && row.provider_id === item.providerId)));
            return !item.legacy || !tracked.some(t => t.kind === item.kind && Math.abs(Date.parse(t.at) - Date.parse(item.at)) < 120000);
        });
        items.splice(0, items.length, ...tracked, ...legacy);
    } catch { warnings.push('새 발송 이력을 불러오지 못했습니다. 기존 기록만 표시합니다.'); }
    items.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0));
    const documents = Object.fromEntries(Object.entries(revisions).map(([kind, revision]) => {
        const last = items.find(item => item.kind === kind && ['accepted', 'legacy'].includes(item.state));
        return [kind, { revision, lastSentRevision: last?.revision, needsResend: last?.revision ? last.revision !== revision : !!last && (changedAt[kind] || 0) > (Date.parse(last.at) || Infinity), verified: !!last?.revision, hasPriorDelivery: !!last }];
    }));
    return { source, bookingId, workflow, items: items.slice(0, 100), warnings, documents };
}
