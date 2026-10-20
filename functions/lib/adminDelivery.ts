import { ADMIN_DELIVERY_TABLE } from './siteSchema.ts';

export interface DeliveryScope { source: 'product' | 'quote_booking'; bookingId: string; kind: string; channel: 'email' | 'kakao' | 'message'; key?: string; legacyNoticeKey?: string; revision?: string; }
export type DeliveryOutcome = { ok: boolean; state: 'accepted' | 'failed' | 'unknown' | 'sending'; duplicate?: boolean; id?: string; error?: string; providerId?: string };

const knownState = (state: string): DeliveryOutcome['state'] => ['accepted', 'failed', 'sending'].includes(state) ? state as DeliveryOutcome['state'] : 'unknown';
async function ensureTable(db: any) {
    const d = ADMIN_DELIVERY_TABLE;
    await db.prepare(`CREATE TABLE IF NOT EXISTS ${d.name} (${[...d.columns, ...(d.constraints || [])].join(', ')})`).run();
    const columns = await db.prepare('PRAGMA table_info(admin_delivery_attempts)').all();
    if (!columns.results?.some((column: any) => column.name === 'document_revision')) {
        try { await db.prepare('ALTER TABLE admin_delivery_attempts ADD COLUMN document_revision TEXT').run(); }
        catch (error) { const updated = await db.prepare('PRAGMA table_info(admin_delivery_attempts)').all(); if (!updated.results?.some((column: any) => column.name === 'document_revision')) throw error; }
    }
    for (const index of d.indexes || []) await db.prepare(index).run();
}

/** Claim and persist an attempt before contacting a provider. An uncertain attempt blocks resend. */
export async function trackedDelivery(db: any, scope: DeliveryScope, work: () => Promise<{ ok: boolean; httpStatus?: number; id?: string; groupId?: string; skipped?: boolean }>): Promise<DeliveryOutcome> {
    await ensureTable(db);
    const key = scope.key || crypto.randomUUID();
    const previous = await db.prepare('SELECT id,state,error,provider_id FROM admin_delivery_attempts WHERE source=? AND booking_id=? AND kind=? AND dispatch_key=?')
        .bind(scope.source, scope.bookingId, scope.kind, key).first();
    if (previous) return { ok: previous.state === 'accepted', state: knownState(previous.state), duplicate: true, id: previous.id, error: previous.error || undefined, providerId: previous.provider_id || undefined };
    const pending = await db.prepare("SELECT id,state FROM admin_delivery_attempts WHERE source=? AND booking_id=? AND kind=? AND state IN ('sending','unknown') LIMIT 1")
        .bind(scope.source, scope.bookingId, scope.kind).first();
    if (pending) return { ok: false, state: knownState(pending.state), duplicate: true, id: pending.id, error: '이전 발송 결과를 확인해야 합니다. 중복 발송을 막기 위해 다시 보내지 않았습니다.' };
    const legacyName = 'itinerary_notice_dispatches';
    const legacyExists = scope.source === 'quote_booking' && scope.kind === 'itinerary' &&
        !!await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='itinerary_notice_dispatches'").first();
    if (legacyExists) {
        const old = await db.prepare(`SELECT state FROM ${legacyName} WHERE request_id=? AND dispatch_key<>? AND state IN ('sending','unknown') LIMIT 1`)
            .bind(scope.bookingId, scope.legacyNoticeKey || '').first();
        if (old) return { ok: false, state: knownState(old.state), duplicate: true, error: '이전 일정표 발송 결과를 확인해야 합니다. 다른 발송 경로로 다시 보내지 않았습니다.' };
    }
    const id = crypto.randomUUID(), now = new Date().toISOString();
    // The INSERT performs the pending check again, covering concurrent tabs with different keys.
    const claim = await db.prepare(`INSERT INTO admin_delivery_attempts (id,source,booking_id,kind,channel,state,dispatch_key,created_at,updated_at,document_revision)
        SELECT ?,?,?,?,?,'sending',?,?,?,? WHERE NOT EXISTS (
          SELECT 1 FROM admin_delivery_attempts WHERE source=? AND booking_id=? AND kind=? AND state IN ('sending','unknown'))
        ${legacyExists ? `AND NOT EXISTS (SELECT 1 FROM ${legacyName} WHERE request_id=? AND dispatch_key<>? AND state IN ('sending','unknown'))` : ''}
        ON CONFLICT(source,booking_id,kind,dispatch_key) DO NOTHING`)
        .bind(id, scope.source, scope.bookingId, scope.kind, scope.channel, key, now, now, scope.revision || null, scope.source, scope.bookingId, scope.kind,
            ...(legacyExists ? [scope.bookingId, scope.legacyNoticeKey || ''] : [])).run();
    if (claim.meta?.changes !== 1) return { ok: false, state: 'sending', duplicate: true, error: '다른 요청에서 발송 중입니다. 이력을 새로고침해 주세요.' };
    let outcome: DeliveryOutcome;
    try {
        const result = await work();
        const state = result.ok ? 'accepted' : result.skipped || (result.httpStatus && result.httpStatus < 500) ? 'failed' : 'unknown';
        outcome = { ok: !!result.ok, state, id, providerId: result.id || result.groupId || undefined,
            error: result.ok ? undefined : state === 'failed' ? '발송 설정 또는 수신 정보를 확인한 뒤 다시 시도해 주세요.' : '서비스의 발송 결과를 확인해야 합니다. 자동 재발송을 중지했습니다.' };
    } catch {
        outcome = { ok: false, state: 'unknown', id, error: '응답을 확인하지 못했습니다. 서비스의 발송 결과를 확인한 뒤 처리해 주세요.' };
    }
    await db.prepare('UPDATE admin_delivery_attempts SET state=?,error=?,provider_id=?,updated_at=? WHERE id=?')
        .bind(outcome.state, outcome.error || null, outcome.providerId || null, new Date().toISOString(), id).run();
    return outcome;
}
