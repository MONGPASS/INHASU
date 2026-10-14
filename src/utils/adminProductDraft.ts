import type { TourProduct } from '../types/product';
import { normalizeRepresentativeSpots } from '../../functions/lib/productItinerary.ts';

/** Shared with the real product page so draft tests exercise the API-to-form boundary. */
export function adminProductFromApi(item: any): TourProduct {
    const list = (value: unknown): any[] => {
        if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return []; } }
        return Array.isArray(value) ? value : [];
    };
    const text = (value: unknown) => typeof value === 'string' ? value : '';
    const number = (value: unknown, fallback = 0) => value === null || value === undefined ? fallback : Number.isFinite(Number(value)) ? Number(value) : fallback;
    const flag = (value: unknown) => value === true || value === 1 || value === '1';
    const originalPrice = item.original_price ?? item.originalPrice;
    return {
        id: text(item.id), name: text(item.name), description: text(item.description),
        price: number(item.price), originalPrice: originalPrice == null ? undefined : number(originalPrice),
        duration: text(item.duration), category: text(item.category),
        mainImages: list(item.main_images ?? item.mainImages), galleryImages: list(item.gallery_images ?? item.galleryImages),
        detailImages: list(item.detail_images ?? item.detailImages), itineraryImages: list(item.itinerary_images ?? item.itineraryImages),
        detailSlides: list(item.detail_slides ?? item.detailSlides), detailBlocks: list(item.detail_blocks ?? item.detailBlocks),
        itineraryBlocks: list(item.itinerary_blocks ?? item.itineraryBlocks),
        status: ['active', 'inactive', 'soldout'].includes(item.status) ? item.status : 'active',
        isFeatured: flag(item.is_featured ?? item.isFeatured), isPopular: flag(item.is_popular ?? item.isPopular),
        packageType: item.packageType ?? item.package_type ?? null,
        tags: list(item.tags), highlights: list(item.highlights),
        representativeSpots: normalizeRepresentativeSpots(item.representativeSpots ?? item.representative_spots),
        included: list(item.included), excluded: list(item.excluded), faqs: list(item.faqs),
        viewCount: number(item.view_count ?? item.viewCount), bookingCount: number(item.booking_count ?? item.bookingCount),
        pricingOptions: list(item.pricing_options ?? item.pricingOptions), accommodationOptions: list(item.accommodation_options ?? item.accommodationOptions),
        vehicleOptions: list(item.vehicle_options ?? item.vehicleOptions),
        createdAt: text(item.created_at ?? item.createdAt), updatedAt: text(item.updated_at ?? item.updatedAt),
    };
}

export interface AdminProductDraftScope {
    userId: string;
    productId: string | null;
}

export interface AdminProductDraft {
    version: 1;
    userId: string;
    productId: string | null;
    serverUpdatedAt: string | null;
    baseFingerprint: string;
    savedAt: string;
    form: Partial<TourProduct>;
}

export type DraftStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type DraftResult = { ok: true } | { ok: false; error: string };
export type DraftReadResult =
    | { kind: 'empty' }
    | { kind: 'draft'; draft: AdminProductDraft; conflict: boolean }
    | { kind: 'error'; error: string };

const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

export function adminProductDraftKey(scope: AdminProductDraftScope): string {
    if (!scope.userId.trim()) throw new Error('관리자 계정을 확인한 뒤 초안을 보관할 수 있습니다.');
    const product = scope.productId === null ? 'new' : `product:${encodeURIComponent(scope.productId)}`;
    return `inhasu:admin-product-draft:v1:${encodeURIComponent(scope.userId)}:${product}`;
}

/** Uploaded URLs are reusable; File/Blob bytes and temporary browser URLs are not. */
export function productDraftForm(form: Partial<TourProduct>): Partial<TourProduct> {
    const clean = (value: unknown): unknown => {
        if (typeof Blob !== 'undefined' && value instanceof Blob) return undefined;
        if (typeof value === 'string') return /(?:^|\|)(?:data:|blob:)/i.test(value) ? undefined : value;
        if (value === null || typeof value === 'boolean') return value;
        if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
        if (Array.isArray(value)) return value.map(clean).filter(v => v !== undefined);
        if (record(value)) {
            const result: Record<string, unknown> = {};
            for (const key of Object.keys(value).sort()) {
                if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
                const next = clean(value[key]);
                if (next !== undefined) result[key] = next;
            }
            return result;
        }
        return undefined;
    };
    return clean(form) as Partial<TourProduct>;
}

export function productDraftFingerprint(form: Partial<TourProduct>): string {
    const { id, createdAt, updatedAt, viewCount, bookingCount, ...editable } = productDraftForm(form);
    return JSON.stringify(editable);
}

function storageError(error: unknown): string {
    const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : '';
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED'
        ? '브라우저 저장 공간이 부족해 초안을 보관하지 못했습니다. 상품을 저장하거나 불필요한 초안을 버려 주세요.'
        : '이 브라우저에서 초안을 읽거나 보관할 수 없습니다. 브라우저의 저장소 설정을 확인해 주세요.';
}

function validForm(value: unknown): value is Partial<TourProduct> {
    if (!record(value)) return false;
    const strings = ['name', 'description', 'category', 'duration', 'id', 'createdAt', 'updatedAt'];
    if (strings.some(k => value[k] !== undefined && typeof value[k] !== 'string')) return false;
    if (['price', 'originalPrice', 'viewCount', 'bookingCount'].some(k => value[k] !== undefined && (typeof value[k] !== 'number' || !Number.isFinite(value[k])))) return false;
    if (['isFeatured', 'isPopular'].some(k => value[k] !== undefined && typeof value[k] !== 'boolean')) return false;
    if (value.status !== undefined && !['active', 'inactive', 'soldout'].includes(String(value.status))) return false;
    const lists = ['mainImages', 'galleryImages', 'detailImages', 'itineraryImages', 'detailSlides', 'detailBlocks', 'itineraryBlocks', 'tags', 'highlights', 'representativeSpots', 'included', 'excluded', 'faqs', 'pricingOptions', 'accommodationOptions', 'vehicleOptions'];
    if (lists.some(k => value[k] !== undefined && !Array.isArray(value[k]))) return false;
    if (['mainImages', 'galleryImages', 'detailImages', 'itineraryImages', 'tags', 'included', 'excluded'].some(k => Array.isArray(value[k]) && (value[k] as unknown[]).some(v => typeof v !== 'string'))) return false;
    const blocks = [...(Array.isArray(value.detailBlocks) ? value.detailBlocks : []), ...(Array.isArray(value.itineraryBlocks) ? value.itineraryBlocks : [])];
    // Older, valid catalog schedules have no block IDs; content still receives full validation.
    if (blocks.some(b => !record(b) || (b.id !== undefined && typeof b.id !== 'string') || !['image', 'slide', 'divider', 'timeline', 'dayInfo', 'design'].includes(String(b.type)) ||
        (b.type === 'image' ? typeof b.content !== 'string' : !record(b.content)))) return false;
    for (const block of blocks as Record<string, unknown>[]) {
        if (!record(block.content)) continue;
        const content = block.content;
        if (['title', 'description', 'time', 'dayLabel', 'dayDate', 'accommodation', 'heroImage'].some(k => content[k] !== undefined && typeof content[k] !== 'string')) return false;
        if (['images', 'galleryImages', 'accommodationImages', 'accommodationAmenities'].some(k => content[k] !== undefined && (!Array.isArray(content[k]) || (content[k] as unknown[]).some(v => typeof v !== 'string')))) return false;
        if (block.type === 'dayInfo' && content.meals !== undefined && (!record(content.meals) || Object.values(content.meals).some(v => typeof v !== 'string'))) return false;
        if (block.type === 'design' && (typeof content.templateId !== 'string' || !record(content.values) || Object.values(content.values).some(v => typeof v !== 'string'))) return false;
        if (block.type === 'design' && content.sections !== undefined && (!Array.isArray(content.sections) || content.sections.some(section =>
            !record(section) || typeof section.id !== 'string' || typeof section.def !== 'string' || (section.hidden !== undefined && typeof section.hidden !== 'boolean')))) return false;
    }
    const objects = ['detailSlides', 'highlights', 'representativeSpots', 'faqs', 'pricingOptions', 'accommodationOptions', 'vehicleOptions'];
    return objects.every(k => !Array.isArray(value[k]) || (value[k] as unknown[]).every(record));
}

export function readAdminProductDraft(storage: DraftStorage, scope: AdminProductDraftScope, serverForm: Partial<TourProduct>): DraftReadResult {
    try {
        const raw = storage.getItem(adminProductDraftKey(scope));
        if (raw === null) return { kind: 'empty' };
        let draft: unknown;
        try { draft = JSON.parse(raw); } catch { return { kind: 'error', error: '보관된 초안의 형식이 손상되어 자동으로 복원하지 않았습니다.' }; }
        if (!record(draft) || draft.version !== 1 || draft.userId !== scope.userId || draft.productId !== scope.productId ||
            typeof draft.savedAt !== 'string' || !Number.isFinite(Date.parse(draft.savedAt)) || typeof draft.baseFingerprint !== 'string' ||
            !(draft.serverUpdatedAt === null || typeof draft.serverUpdatedAt === 'string') || !validForm(draft.form)) {
            return { kind: 'error', error: '보관된 초안의 형식 또는 계정 정보가 맞지 않아 복원하지 않았습니다.' };
        }
        const saved = { ...draft, form: productDraftForm(draft.form) } as unknown as AdminProductDraft;
        if (productDraftFingerprint(saved.form) === productDraftFingerprint(serverForm)) return { kind: 'empty' };
        return { kind: 'draft', draft: saved, conflict: saved.serverUpdatedAt !== (serverForm.updatedAt || null) || saved.baseFingerprint !== productDraftFingerprint(serverForm) };
    } catch (error) { return { kind: 'error', error: storageError(error) }; }
}

export function writeAdminProductDraft(storage: DraftStorage, scope: AdminProductDraftScope, serverForm: Partial<TourProduct>, form: Partial<TourProduct>, now = new Date().toISOString()): DraftResult & { savedAt?: string } {
    try {
        // Opening a saved product does not create a draft or rewrite an older backup.
        if (productDraftFingerprint(form) === productDraftFingerprint(serverForm)) return { ok: true };
        const draft: AdminProductDraft = {
            version: 1, ...scope, serverUpdatedAt: serverForm.updatedAt || null,
            baseFingerprint: productDraftFingerprint(serverForm), savedAt: now, form: productDraftForm(form),
        };
        storage.setItem(adminProductDraftKey(scope), JSON.stringify(draft));
        return { ok: true, savedAt: now };
    } catch (error) { return { ok: false, error: storageError(error) }; }
}

export function removeAdminProductDraft(storage: DraftStorage, scope: AdminProductDraftScope): DraftResult {
    try { storage.removeItem(adminProductDraftKey(scope)); return { ok: true }; }
    catch (error) { return { ok: false, error: storageError(error) }; }
}

/** A failed server save must never erase the recovery copy. */
export function finishAdminProductSave(storage: DraftStorage, scope: AdminProductDraftScope, success: boolean): DraftResult {
    return success ? removeAdminProductDraft(storage, scope) : { ok: true };
}

/** Acquires before the first await; duplicate submissions cannot start a second request. */
export async function runAdminProductSaveOnce(lock: { current: boolean }, work: () => Promise<void>): Promise<'ignored' | 'finished'> {
    if (lock.current) return 'ignored';
    lock.current = true;
    try { await work(); return 'finished'; }
    finally { lock.current = false; }
}

export type AdminProductNavigationDecision =
    | { blocked: false }
    | { blocked: true; reason: 'busy' }
    | { blocked: true; reason: 'draft_storage_failure'; error: string };

/** The same decision covers router PUSH/REPLACE and browser POP, including query changes. */
export function adminProductNavigationDecision(
    current: { pathname: string; search: string },
    next: { pathname: string; search: string },
    busy: boolean,
    flush: () => DraftResult,
): AdminProductNavigationDecision {
    if (current.pathname === next.pathname && current.search === next.search) return { blocked: false };
    let result: DraftResult;
    try { result = flush(); }
    catch { result = { ok: false, error: '초안을 보관하지 못했습니다. 상품 편집을 계속하거나 상품을 저장해 주세요.' }; }
    if (busy) return { blocked: true, reason: 'busy' };
    return result.ok ? { blocked: false } : { blocked: true, reason: 'draft_storage_failure', error: result.error };
}

/** Late image promises from a closed editor must not replace the reopened editor's draft. */
export function updateAdminProductEditorForm(
    form: { current: Partial<TourProduct> },
    status: { mounted: boolean; saving: boolean; saved: boolean },
    update: Partial<TourProduct> | ((previous: Partial<TourProduct>) => Partial<TourProduct>),
): Partial<TourProduct> | null {
    if (!status.mounted || status.saving || status.saved) return null;
    const next = typeof update === 'function' ? update(form.current) : update;
    form.current = next;
    return next;
}
