import { assignmentKey, assignmentRecord, type AssignmentSource, type BookingAssignment } from './reservationAssignment.ts';
export interface AssignmentDraftScope { userId: string; source: AssignmentSource; id: string }
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type AssignmentDraftResult = { ok: true; revision?: string } | { ok: false; error: string };
export interface AssignmentDraft { scope: AssignmentDraftScope; baseVersion: string; assignment: BookingAssignment; revision: string; savedAt: string }
export const assignmentDraftKey = (scope: AssignmentDraftScope) => `inhasu:admin-assignment:v1:${encodeURIComponent(scope.userId)}:${encodeURIComponent(assignmentKey(scope.source, scope.id))}`;
export const assignmentFingerprint = (value: BookingAssignment) => JSON.stringify(value);
const error = (): AssignmentDraftResult => ({ ok: false, error: '브라우저에 배정 초안을 보관하지 못했습니다. 화면을 닫기 전에 저장하거나 다시 시도해 주세요.' });
export function editorAssignment(row: any): BookingAssignment {
    const guide = assignmentRecord(row.assignedGuide), vehicle = assignmentRecord(row.contractData?.vehicle);
    const safeImage = (value: unknown) => typeof value === 'string' && !/^(data:|blob:)/i.test(value) ? value : '';
    const safeImages = (value: unknown): string[] => Array.isArray(value) ? value.map(safeImage).filter(Boolean) : [];
    const resource = assignmentRecord(vehicle.resource);
    return { guide: { id: guide.id || '', name: guide.name || '', phone: guide.phone || '',
            ...Object.fromEntries(['image','introduction','nameEn','role','languages','specialties'].filter(key => guide[key] !== undefined).map(key => [key,
                key === 'image' ? safeImage(guide[key]) : ['languages','specialties'].includes(key) && Array.isArray(guide[key]) ? [...guide[key]] : guide[key]])) },
        vehicle: { type: vehicle.type || '', phone: vehicle.phone || '',
            ...(vehicle.resource && typeof vehicle.resource === 'object' && !Array.isArray(vehicle.resource) ? { resource:
                Object.fromEntries(['id','img','images','description','seats','luggage'].filter(key => resource[key] !== undefined).map(key => [key,
                    key === 'img' ? safeImage(resource[key]) : key === 'images' ? safeImages(resource[key]) : resource[key]])) } : {}) },
        accommodations: (row.dailyAccommodations || []).map((d: any) => {
            const acc = assignmentRecord(d.accommodation), next: Record<string, any> = {};
            for (const k of ['id','name','type','location','region','address','images','description','facilities','roomAmenities','sharedFacilities','roomCount','occupancy','bookingStatus']) if (acc[k] !== undefined) next[k] = Array.isArray(acc[k]) ? [...acc[k]] : acc[k];
            // Recovery copies never retain file bytes or temporary image URLs.
            if (Array.isArray(next.images)) next.images = safeImages(next.images);
            return { day: d.day, date: d.date || '', accommodation: next };
        }) };
}
export function writeAssignmentDraft(storage: Store, scope: AssignmentDraftScope, baseVersion: string, assignment: BookingAssignment): AssignmentDraftResult {
    try {
        const revision = crypto.randomUUID();
        const safe = editorAssignment({ assignedGuide: assignment.guide, contractData: { vehicle: assignment.vehicle }, dailyAccommodations: assignment.accommodations });
        storage.setItem(assignmentDraftKey(scope), JSON.stringify({ scope, baseVersion, assignment: safe, revision, savedAt: new Date().toISOString() }));
        return { ok: true, revision };
    } catch { return error(); }
}
export function readAssignmentDraft(storage: Store, scope: AssignmentDraftScope, baseVersion: string): { draft?: AssignmentDraft; conflict?: boolean; error?: string } {
    try {
        const raw = storage.getItem(assignmentDraftKey(scope)); if (!raw) return {};
        const d = JSON.parse(raw), a = d?.assignment;
        if (d?.scope?.userId !== scope.userId || d.scope.source !== scope.source || d.scope.id !== scope.id || typeof d.baseVersion !== 'string' || typeof d.revision !== 'string' ||
            !a || typeof a !== 'object' || !a.guide || !a.vehicle || !Array.isArray(a.accommodations)) return { error: '배정 초안 형식이 잘못되어 자동 복원하지 않았습니다.' };
        return { draft: { ...d, assignment: editorAssignment({ assignedGuide: a.guide, contractData: { vehicle: a.vehicle }, dailyAccommodations: a.accommodations }) }, conflict: d.baseVersion !== baseVersion };
    } catch { return { error: '배정 초안을 읽지 못했습니다. 저장소 설정을 확인해 주세요.' }; }
}
export function discardAssignmentDraft(storage: Store, scope: AssignmentDraftScope, ownedRevision?: string): AssignmentDraftResult {
    try {
        const current = storage.getItem(assignmentDraftKey(scope));
        if (ownedRevision && current && JSON.parse(current)?.revision !== ownedRevision) return { ok: true };
        storage.removeItem(assignmentDraftKey(scope)); return { ok: true };
    } catch { return error(); }
}
