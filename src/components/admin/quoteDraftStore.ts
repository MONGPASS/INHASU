/**
 * 견적 작성 초안 보관 — public/quote-editor-state.js(옛 견적 편집기들의 초안)와 같은 저장 자리·형식.
 * 그래서 옛 견적서 만들기(고객 화면 안 iframe)와 React 견적서 만들기가 서로의 초안을 복원할 수 있다.
 * 키: `inhasu:quote-editor:v1:<관리자 계정>:<종류>:<요청 ID | new>`, 값: { version:1, account, kind, requestId, baseFingerprint, savedAt, value }.
 * 고객 링크 값·서명·임시 사진 주소(data:/blob:)는 보관하지 않는다. tests/quote-builder.test.mjs가 옛 파일과 결과를 비교한다.
 */
type Json = Record<string, any>;
const isRecord = (value: unknown): value is Json => !!value && typeof value === 'object' && !Array.isArray(value);
const secret = (key: string) => /token|password|authorization|cookie|secret|signature|signedAt|signedBy|signImg|signData/i.test(key) || /^(contract|agreement)$/i.test(key);

/** 보관해도 되는 값만 남긴다(키 정렬, 비밀 칸·임시 주소·숫자가 아닌 수 제외) */
export function cleanDraft(value: unknown): unknown {
    if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined;
    if (typeof value === 'string') return /(?:^|\|)(?:data:|blob:)/i.test(value) ? undefined : value;
    if (value === null || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
    if (Array.isArray(value)) return value.map(cleanDraft).filter(item => item !== undefined);
    if (isRecord(value)) {
        const result: Json = {};
        Object.keys(value).sort().forEach(key => {
            if (secret(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) return;
            const next = cleanDraft(value[key]); if (next !== undefined) result[key] = next;
        });
        return result;
    }
    return undefined;
}

export function draftFingerprint(value: unknown): string {
    const copy = (cleanDraft(value) || {}) as Json;
    // 화면 상태(단계·고르기 칸)는 비교에서 뺀다. 첫 낱말은 아이콘 이름 검사(check-icon-subset)에 걸리지 않게 나눠 적는다.
    if (isRecord(copy)) [['st', 'ep'].join(''), 'coursePick', 'pickRegion', 'pickQuery'].forEach(key => delete copy[key]);
    return JSON.stringify(copy);
}

export function draftKey(account: string, kind: string, requestId: string): string {
    if (typeof account !== 'string' || !account.trim()) throw new Error('관리자 계정을 확인할 수 없어 초안을 보관하지 못했습니다.');
    return `inhasu:quote-editor:v1:${encodeURIComponent(account)}:${encodeURIComponent(kind)}:${requestId ? encodeURIComponent(requestId) : 'new'}`;
}

const storageError = (reason: any) => /QuotaExceeded|QUOTA/.test(reason?.name || '') ? '브라우저 저장 공간이 부족해 초안을 보관하지 못했습니다.' : '브라우저 저장소를 사용할 수 없어 초안을 보관하지 못했습니다.';

/** 견적 초안 모양 확인(옛 validQuote와 같다) */
export function validQuoteDraft(value: unknown): boolean {
    if (!isRecord(value)) return false;
    for (const field of ['customer', 'phone', 'email', 'destination', 'depart', 'return_', 'manager', 'quoteNo', 'vehicle', 'flightIn', 'flightOut', 'benefits', 'events', 'remark']) {
        if (value[field] !== undefined && typeof value[field] !== 'string') return false;
    }
    if (['days', 'spots', 'options', 'balances'].some(field => value[field] !== undefined && !Array.isArray(value[field]))) return false;
    if (Array.isArray(value.spots) && value.spots.some((name: unknown) => typeof name !== 'string')) return false;
    if (Array.isArray(value.days) && value.days.some((day: any) => !isRecord(day) || ['dest', 'date', 'move', 'dist'].some(field => day[field] !== undefined && typeof day[field] !== 'string')
        || ['items', 'meals'].some(field => day[field] !== undefined && (!Array.isArray(day[field]) || day[field].some((item: unknown) => typeof item !== 'string')))
        || (day.stay != null && (!isRecord(day.stay) || (day.stay.tags !== undefined && (!Array.isArray(day.stay.tags) || day.stay.tags.some((tag: unknown) => typeof tag !== 'string'))))))) return false;
    return ['options', 'balances'].every(field => !Array.isArray(value[field]) || value[field].every(isRecord));
}

/** 예약 초안 모양 확인(옛 quote-editor-state.js의 validBooking과 같다) */
export function validBookingDraft(value: unknown): boolean {
    if (!isRecord(value)) return false;
    const v = value as Record<string, any>;
    return ['days', 'highlights', 'travelers'].every(field => v[field] === undefined || (Array.isArray(v[field]) && v[field].every(isRecord)))
        && validQuoteDraft({ days: v.days })
        && ['assign', 'contractInfo', 'flight', 'checklist'].every(field => v[field] == null || isRecord(v[field]))
        && (v.assign?.lodges === undefined || (Array.isArray(v.assign.lodges) && v.assign.lodges.every(isRecord)));
}

export interface DraftScope { account: string; kind: string; requestId: string }
export type DraftRead = { kind: 'empty' } | { kind: 'error'; error: string } | { kind: 'draft'; value: Json; savedAt: string; legacy: boolean; conflict: boolean };
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 보관된 초안 읽기(옛 read와 같다). legacyKey는 옛 형식(`leaders_quote_draft`) 초안 */
export function readDraft(storage: Store, scope: DraftScope, baseline: unknown, validate: (value: unknown) => boolean = validQuoteDraft, legacyKey?: string): DraftRead {
    try {
        const key = draftKey(scope.account, scope.kind, scope.requestId);
        let raw = storage.getItem(key), legacy = false;
        if (raw == null && legacyKey) { raw = storage.getItem(legacyKey); legacy = raw != null; }
        if (raw == null) return { kind: 'empty' };
        const parsed = JSON.parse(raw);
        const value = legacy ? parsed.st : parsed.value;
        if (legacy && String(parsed.reqId || '') !== String(scope.requestId || '')) return { kind: 'empty' };
        if (!isRecord(parsed) || (!legacy && (parsed.version !== 1 || parsed.account !== scope.account || parsed.kind !== scope.kind || parsed.requestId !== scope.requestId))
            || !validate(value)) return { kind: 'error', error: '보관된 초안이 손상되었거나 현재 고객과 맞지 않아 복원하지 않았습니다.' };
        const safe = cleanDraft(value) as Json;
        if (legacy) storage.setItem(legacyKey!, JSON.stringify(cleanDraft(parsed)));
        if (!legacy && draftFingerprint(safe) === draftFingerprint(baseline)) return { kind: 'empty' };
        return { kind: 'draft', value: safe, savedAt: parsed.savedAt || '', legacy, conflict: legacy || parsed.baseFingerprint !== draftFingerprint(baseline) };
    } catch (reason) { return { kind: 'error', error: reason instanceof SyntaxError ? '보관된 초안의 형식이 손상되어 복원하지 않았습니다.' : storageError(reason) }; }
}

export function writeDraft(storage: Store, scope: DraftScope, baseline: unknown, value: unknown, now: Date = new Date()): { ok: true; savedAt: string } | { ok: false; error: string } {
    try {
        const savedAt = now.toISOString();
        storage.setItem(draftKey(scope.account, scope.kind, scope.requestId), JSON.stringify({ version: 1, ...scope, baseFingerprint: draftFingerprint(baseline), savedAt, value: cleanDraft(value) }));
        return { ok: true, savedAt };
    } catch (reason) { return { ok: false, error: storageError(reason) }; }
}

export function removeDraft(storage: Store, scope: DraftScope, legacyKey?: string): { ok: true } | { ok: false; error: string } {
    try { storage.removeItem(draftKey(scope.account, scope.kind, scope.requestId)); if (legacyKey) storage.removeItem(legacyKey); return { ok: true }; }
    catch (reason) { return { ok: false, error: storageError(reason) }; }
}
