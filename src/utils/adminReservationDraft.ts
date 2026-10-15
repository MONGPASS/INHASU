import type { ReservationDocContent } from '../components/admin/ReservationDocumentEditor';

export type ReservationDocumentMode = 'itinerary' | 'contract';
export interface ReservationDraftSnapshot {
    content: ReservationDocContent;
    dates: { startDate: string; endDate: string };
}
export interface ReservationDraftScope { userId: string; reservationId: string }
export interface ReservationLocalDraft extends ReservationDraftSnapshot {
    version: 1;
    userId: string;
    reservationId: string;
    baseFingerprint: string;
    savedAt: string;
    revision: string;
    mode: ReservationDocumentMode;
}
export type ReservationDraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type ReservationDraftResult = { ok: true; savedAt?: string; revision?: string } | { ok: false; error: string };
export type ReservationDraftRead = { kind: 'empty' } | { kind: 'draft'; draft: ReservationLocalDraft; conflict: boolean } | { kind: 'invalid'; error: string } | { kind: 'unavailable'; error: string };
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string');

export function reservationDraftKey(scope: ReservationDraftScope): string {
    if (!scope.userId.trim() || !scope.reservationId.trim()) throw new Error('관리자 계정과 예약을 확인한 뒤 초안을 보관할 수 있습니다.');
    // Schedule and contract share one document, so changing modes cannot erase either half.
    return `inhasu:admin-reservation-doc-draft:v1:${encodeURIComponent(scope.userId)}:${encodeURIComponent(scope.reservationId)}`;
}

function cleanJson(value: any): any {
    if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined;
    if (typeof value === 'string') return /^(?:data:|blob:)/i.test(value) ? undefined : value;
    if (value == null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (Array.isArray(value)) return value.map(cleanJson).filter(item => item !== undefined);
    if (record(value)) {
        const result: Record<string, any> = {};
        for (const key of Object.keys(value).sort()) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
            const item = cleanJson(value[key]);
            if (item !== undefined) result[key] = item;
        }
        return result;
    }
    return undefined;
}

export function reservationDraftFingerprint(snapshot: ReservationDraftSnapshot): string {
    return JSON.stringify(cleanJson({ content: snapshot.content, dates: snapshot.dates }));
}

function validSnapshot(value: unknown): value is ReservationDraftSnapshot {
    if (!record(value) || !record(value.dates) || typeof value.dates.startDate !== 'string' || typeof value.dates.endDate !== 'string') return false;
    const content = value.content;
    if (!record(content) || typeof content.name !== 'string' || typeof content.description !== 'string' || !Array.isArray(content.days) || !record(content.documentSettings)) return false;
    const optionalText = (row: Record<string, any>, keys: string[]) => keys.every(key => row[key] == null || typeof row[key] === 'string');
    const validActivity = (row: unknown) => record(row) && optionalText(row, ['title', 'description', 'time', 'type']) && (row.images == null || strings(row.images));
    for (const day of content.days) {
        if (!record(day) || !optionalText(day, ['title', 'description', 'date', 'dateMode', 'region', 'summary', 'move', 'dist', 'retainedSummary']) ||
            (day.day != null && (typeof day.day !== 'number' || !Number.isFinite(day.day))) ||
            (day.images != null && !strings(day.images)) || (day.items != null && !strings(day.items)) ||
            (day.activities != null && (!Array.isArray(day.activities) || !day.activities.every(validActivity))) ||
            (day.retainedActivities != null && (!Array.isArray(day.retainedActivities) || !day.retainedActivities.every(validActivity)))) return false;
        if (day.meals != null && (!record(day.meals) || !optionalText(day.meals, ['breakfast', 'lunch', 'dinner']))) return false;
        if (day.accommodation != null && (!record(day.accommodation) || !optionalText(day.accommodation, ['name', 'type', 'location', 'description', 'tags']) ||
            (day.accommodation.images != null && !strings(day.accommodation.images)))) return false;
    }
    if (content.highlights != null && (!Array.isArray(content.highlights) || content.highlights.some((spot: unknown) => !record(spot) || typeof spot.name !== 'string' ||
        !optionalText(spot, ['nameMn', 'short', 'region', 'desc', 'img']) || (spot.subImgs != null && !strings(spot.subImgs))))) return false;
    for (const key of ['overview', 'contract', 'detail', 'guide']) if (content.documentSettings[key] != null && !record(content.documentSettings[key])) return false;
    const contract = content.documentSettings.contract;
    if (contract && (!optionalText(contract, ['intro', 'paymentMethod', 'paymentDeadline', 'includedText', 'excludedText', 'signatureNote']) ||
        (contract.cancellationRows != null && (!Array.isArray(contract.cancellationRows) || contract.cancellationRows.some((row: unknown) =>
            !record(row) || typeof row.period !== 'string' || typeof row.fee !== 'string'))))) return false;
    return true;
}

function storageError(error: unknown): string {
    const name = record(error) ? String(error.name || '') : '';
    return ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'].includes(name)
        ? '브라우저 저장 공간이 부족해 문서 초안을 보관하지 못했습니다. 문서를 저장하거나 불필요한 초안을 정리해 주세요.'
        : '브라우저 저장소를 사용할 수 없어 문서 초안을 보관하지 못했습니다.';
}

export function readReservationDraft(storage: ReservationDraftStorage, scope: ReservationDraftScope, source: ReservationDraftSnapshot): ReservationDraftRead {
    let raw: string | null;
    try { raw = storage.getItem(reservationDraftKey(scope)); }
    catch (error) { return { kind: 'unavailable', error: storageError(error) }; }
    if (raw === null) return { kind: 'empty' };
    let value: unknown;
    try { value = JSON.parse(raw); } catch { return { kind: 'invalid', error: '보관된 문서 초안이 손상되어 복원하지 않았습니다. 초안을 버리고 현재 문서로 시작할 수 있습니다.' }; }
    if (!record(value) || value.version !== 1 || value.userId !== scope.userId || value.reservationId !== scope.reservationId ||
        typeof value.baseFingerprint !== 'string' || typeof value.revision !== 'string' || !value.revision || typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) ||
        !['itinerary', 'contract'].includes(value.mode) || !validSnapshot(value)) return { kind: 'invalid', error: '보관된 문서 초안의 형식 또는 계정·예약 정보가 맞지 않습니다. 자동으로 복원하지 않았습니다.' };
    const draft = cleanJson(value) as ReservationLocalDraft;
    if (reservationDraftFingerprint(draft) === reservationDraftFingerprint(source)) return { kind: 'empty' };
    // Only document fields/dates determine conflict; operational assignments can refresh independently.
    return { kind: 'draft', draft, conflict: draft.baseFingerprint !== reservationDraftFingerprint(source) };
}

export function writeReservationDraft(storage: ReservationDraftStorage, scope: ReservationDraftScope, snapshot: ReservationDraftSnapshot, baseFingerprint: string, mode: ReservationDocumentMode, savedAt = new Date().toISOString()): ReservationDraftResult {
    try {
        if (reservationDraftFingerprint(snapshot) === baseFingerprint) return { ok: true };
        const revision = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const draft: ReservationLocalDraft = { ...cleanJson(snapshot), version: 1, ...scope, baseFingerprint, mode, savedAt, revision };
        storage.setItem(reservationDraftKey(scope), JSON.stringify(draft));
        return { ok: true, savedAt, revision };
    } catch (error) { return { ok: false, error: storageError(error) }; }
}

export function discardReservationDraft(storage: ReservationDraftStorage, scope: ReservationDraftScope): ReservationDraftResult {
    try { storage.removeItem(reservationDraftKey(scope)); return { ok: true }; }
    catch (error) { return { ok: false, error: storageError(error) }; }
}

export function finishReservationDraftSave(storage: ReservationDraftStorage, scope: ReservationDraftScope, success: boolean, ownedRevision: string | null): ReservationDraftResult {
    if (!success || !ownedRevision) return { ok: true };
    try {
        const raw = storage.getItem(reservationDraftKey(scope));
        if (raw === null) return { ok: true };
        const value = JSON.parse(raw);
        // A late response from an older editor cannot delete another tab's newer recovery copy.
        if (value?.userId !== scope.userId || value?.reservationId !== scope.reservationId || value?.revision !== ownedRevision) return { ok: true };
        return discardReservationDraft(storage, scope);
    } catch (error) { return { ok: false, error: storageError(error) }; }
}

export type ReservationDraftNavigationDecision = { blocked: false } | { blocked: true; reason: 'busy' | 'other_unsaved_changes' } | { blocked: true; reason: 'draft_storage_failure'; error: string };
export function reservationDraftNavigationDecision(current: { pathname: string; search: string }, next: { pathname: string; search: string }, busy: boolean, flush: () => ReservationDraftResult, otherUnsavedChanges = false): ReservationDraftNavigationDecision {
    if (current.pathname === next.pathname && current.search === next.search) return { blocked: false };
    const result = flush();
    if (busy) return { blocked: true, reason: 'busy' };
    if (!result.ok) return { blocked: true, reason: 'draft_storage_failure', error: result.error };
    return otherUnsavedChanges ? { blocked: true, reason: 'other_unsaved_changes' } : { blocked: false };
}
