export interface MagazineDraftScope { userId: string; magazineId: string | null }
export interface MagazineDraftForm {
    title?: string; description?: string; content?: string; category?: string; image?: string;
    tag?: string; author?: string; authorImage?: string; isFeatured?: boolean; isActive?: boolean; order?: number;
    id?: string; createdAt?: string; updatedAt?: string;
}
interface StoredMagazineDraft { version: 1; userId: string; magazineId: string | null; base: string; savedAt: string; revision: string; form: MagazineDraftForm }
type StorageAccess = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type MagazineDraftResult = { ok: true; savedAt?: string; revision?: string } | { ok: false; error: string };
export type MagazineDraftRead = { kind: 'empty' } | { kind: 'draft'; draft: StoredMagazineDraft; conflict: boolean } | { kind: 'error'; error: string };
const fields = ['title', 'description', 'content', 'category', 'image', 'tag', 'author', 'authorImage'] as const;
const message = (reason: any) => /Quota|QUOTA/.test(reason?.name || '') ? '브라우저 저장 공간이 부족해 매거진 초안을 보관하지 못했습니다.' : '브라우저 저장소를 사용할 수 없어 매거진 초안을 보관하지 못했습니다.';
export function magazineDraftKey(scope: MagazineDraftScope) {
    if (!scope.userId.trim()) throw new Error('관리자 계정 확인 후 초안을 보관할 수 있습니다.');
    return `inhasu:admin-magazine-draft:v1:${encodeURIComponent(scope.userId)}:${scope.magazineId ? encodeURIComponent(scope.magazineId) : 'new'}`;
}
/** Only editable text and uploaded URLs belong in recovery, never File/Blob bytes. */
export function magazineDraftForm(form: MagazineDraftForm): MagazineDraftForm {
    const clean: MagazineDraftForm = {};
    for (const key of fields) {
        const value = typeof form[key] === 'string' ? form[key] : '';
        clean[key] = key === 'content' ? value.replace(/\s(?:src|srcset|data-images)\s*=\s*(["'])([\s\S]*?)\1/gi, (attribute, _quote, resource) => /(?:^|[\s,])(?:data:|blob:)/i.test(resource) ? '' : attribute)
            : /^(?:data:|blob:)/i.test(value) ? '' : value;
    }
    clean.isFeatured = form.isFeatured === true; clean.isActive = form.isActive === true;
    clean.order = Number.isFinite(form.order) ? form.order : 0;
    return clean;
}
export const magazineDraftFingerprint = (form: MagazineDraftForm) => JSON.stringify(magazineDraftForm(form));
export function readMagazineDraft(storage: StorageAccess, scope: MagazineDraftScope, source: MagazineDraftForm): MagazineDraftRead {
    try {
        const raw = storage.getItem(magazineDraftKey(scope)); if (raw === null) return { kind: 'empty' };
        const value = JSON.parse(raw);
        if (!value || value.version !== 1 || value.userId !== scope.userId || value.magazineId !== scope.magazineId || typeof value.base !== 'string' ||
            typeof value.revision !== 'string' || !value.revision || !Number.isFinite(Date.parse(value.savedAt)) || !value.form || typeof value.form !== 'object' || Array.isArray(value.form) ||
            fields.some(key => value.form[key] !== undefined && typeof value.form[key] !== 'string') ||
            ['isFeatured', 'isActive'].some(key => value.form[key] !== undefined && typeof value.form[key] !== 'boolean') ||
            (value.form.order !== undefined && (typeof value.form.order !== 'number' || !Number.isFinite(value.form.order)))) return { kind: 'error', error: '보관된 매거진 초안이 손상되었거나 현재 계정·문서와 맞지 않습니다.' };
        if (magazineDraftFingerprint(value.form) === magazineDraftFingerprint(source)) return { kind: 'empty' };
        return { kind: 'draft', draft: { ...value, form: magazineDraftForm(value.form) }, conflict: value.base !== magazineDraftFingerprint(source) };
    } catch (reason) { return { kind: 'error', error: reason instanceof SyntaxError ? '보관된 매거진 초안을 읽을 수 없습니다. 버리고 현재 문서로 시작하세요.' : message(reason) }; }
}
export function writeMagazineDraft(storage: StorageAccess, scope: MagazineDraftScope, form: MagazineDraftForm, base: string): MagazineDraftResult {
    try {
        if (magazineDraftFingerprint(form) === base) return { ok: true };
        const savedAt = new Date().toISOString(), revision = crypto.randomUUID();
        storage.setItem(magazineDraftKey(scope), JSON.stringify({ version: 1, ...scope, base, form: magazineDraftForm(form), savedAt, revision }));
        return { ok: true, savedAt, revision };
    } catch (reason) { return { ok: false, error: message(reason) }; }
}
export function removeMagazineDraft(storage: StorageAccess, scope: MagazineDraftScope, ownedRevision?: string): MagazineDraftResult {
    try {
        if (ownedRevision) { const raw = storage.getItem(magazineDraftKey(scope)); if (raw && JSON.parse(raw).revision !== ownedRevision) return { ok: true }; }
        storage.removeItem(magazineDraftKey(scope)); return { ok: true };
    } catch (reason) { return { ok: false, error: message(reason) }; }
}
