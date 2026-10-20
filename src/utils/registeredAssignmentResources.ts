import { connectQuoteDesk } from '../components/admin/quoteDesk';
import type { AssignmentVehicle } from './reservationAssignment';
import type { Hotel } from '../types/hotel';

export interface RegisteredVehicle extends AssignmentVehicle {
    name: string;
    snapshot: Record<string, any>;
}
export interface RegisteredAssignmentResources {
    guides: any[];
    lodges: RegisteredLodge[];
    vehicles: RegisteredVehicle[];
    warnings: string[];
}
export interface RegisteredLodge {
    id: string;
    name: string;
    type: string;
    grade: string;
    location: string;
    address: string;
    occupancy: string;
    images: string[];
    description: string;
    facilities: string[];
    roomAmenities: string[];
    sharedFacilities: string[];
    _fromResources: true;
}
type ResourceKind = 'guides' | 'lodges' | 'vehicles';
type ResourceOptions = { accountId: string; signal?: AbortSignal; isCurrent?: () => boolean; kinds?: readonly ResourceKind[] };
type ResourceDependencies = { fetch?: typeof fetch; connect?: typeof connectQuoteDesk };
let resourceAccount = '';
let resourceGeneration = 0;

const text = (value: unknown): string => typeof value === 'string' ? value : '';
const object = (value: unknown): Record<string, any> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : null;
const words = (value: unknown): string[] => {
    if (Array.isArray(value)) return [...new Set(value.filter((item): item is string => typeof item === 'string').map(item => item.trim()).filter(Boolean))];
    if (typeof value !== 'string') return [];
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return words(parsed); } catch { /* Saved prose is also supported. */ }
    return [...new Set(value.split(/[\r\n,·|]+/).map(item => item.trim()).filter(Boolean))];
};
function image(value: unknown): string {
    if (typeof value !== 'string' || !value || /[\u0000-\u0020\\]/.test(value)) return '';
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
    if (/^\/(?!\/)/.test(value) || /^(?:\.\.?\/)?[A-Za-z0-9_-][^:]*$/.test(value)) return value;
    try { const url = new URL(value); return /^https?:$/.test(url.protocol) && !url.username && !url.password ? value : ''; } catch { return ''; }
}
const images = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.map(image).filter(Boolean))] : [];
const entries = (data: unknown): [string, Record<string, any>][] => Object.entries(object(data) || {}).filter(([name, row]) => !!name.trim() && !/[\u0000-\u001f]/.test(name) && !!object(row)) as [string, Record<string, any>][];

function guides(data: unknown): any[] {
    return entries(data).map(([name, row]) => ({
        id: `resource-guide:${name}`, name, image: image(row.img) || images(row.imgs)[0] || '',
        introduction: text(row.desc), phone: text(row.phone), qr: image(row.qr), nameEn: text(row.nameEn), role: text(row.role),
        languages: words(row.languages), specialties: words(row.specialties), _fromResources: true,
    }));
}
function lodges(data: unknown): RegisteredLodge[] {
    return entries(data).map(([name, row]) => ({
        id: `resource-lodge:${name}`, name, type: text(row.grade), grade: text(row.grade), location: text(row.region), address: text(row.address), occupancy: text(row.occupancy),
        images: Array.isArray(row.representativePhotos) ? images(row.representativePhotos) : [...new Set([image(row.img), ...images(row.imgs)].filter(Boolean))],
        // The resource editor marks desc as an internal archive, excluded from customer documents.
        description: '', facilities: [...new Set([...words(row.facilities), ...words(row.roomAmenities), ...words(row.sharedFacilities)])],
        roomAmenities: words(row.roomAmenities), sharedFacilities: words(row.sharedFacilities), _fromResources: true as const,
    }));
}
/** Keep legacy Hotel consumers compatible while selecting only the common lodging library. */
export function registeredLodgeAsHotel(lodge: RegisteredLodge): Hotel {
    return { id: lodge.id, name_kr: lodge.name, address: lodge.address, region: lodge.location,
        grade: lodge.grade, type: lodge.type, occupancy: lodge.occupancy, images: [...lodge.images], description: '',
        amenities: [...lodge.facilities], roomAmenities: [...lodge.roomAmenities], sharedFacilities: [...lodge.sharedFacilities], is_active: true };
}
function vehicles(data: unknown): RegisteredVehicle[] {
    return entries(data).map(([name, row]) => {
        const photos = [...new Set([image(row.img), ...images(row.imgs), ...images(row.images)].filter(Boolean))];
        return { type: name, name, phone: text(row.phone), snapshot: {
            model: name, type: name, img: photos[0] || '', images: photos, imgs: photos,
            description: text(row.desc), desc: text(row.desc), seats: text(row.seats), luggage: text(row.luggage), plate: text(row.plate),
        } };
    });
}

/** Read the saved resource libraries with the current admin connection; never substitute samples or browser caches. */
export async function loadRegisteredAssignmentResources(options: ResourceOptions, dependencies: ResourceDependencies = {}): Promise<RegisteredAssignmentResources> {
    if (resourceAccount !== options.accountId) { resourceAccount = options.accountId; resourceGeneration++; }
    const generation = resourceGeneration;
    const current = () => !!options.accountId && !options.signal?.aborted && options.isCurrent?.() !== false && generation === resourceGeneration && resourceAccount === options.accountId;
    const check = () => { if (!current()) { const error = new Error('관리자 연결이 변경되어 리소스 조회를 중단했습니다.'); error.name = 'AbortError'; throw error; } };
    const result: RegisteredAssignmentResources = { guides: [], lodges: [], vehicles: [], warnings: [] };
    check();
    let token: string | null;
    try { token = await (dependencies.connect || connectQuoteDesk)(options); }
    catch { check(); result.warnings.push('배정·자원 연결을 확인하지 못했습니다. 다시 시도해 주세요.'); return result; }
    check();
    if (!token) { result.warnings.push('배정·자원 연결이 필요합니다. 관리자 연결 설정을 확인해 주세요.'); return result; }
    const request = dependencies.fetch || fetch;
    const allKeys = ['guides', 'lodges', 'vehicles'] as const;
    const keys = options.kinds ? allKeys.filter(key => options.kinds!.includes(key)) : allKeys;
    const labels = { guides: '가이드', lodges: '숙소', vehicles: '차량' };
    const saved = await Promise.allSettled(keys.map(async key => {
        const response = await request(`/api/data/${key}`, { headers: { 'x-admin-token': token }, credentials: 'same-origin', cache: 'no-store', signal: options.signal });
        check();
        const body = await response.json();
        check();
        if (!response.ok || body?.ok !== true || (body.data !== null && !object(body.data))) throw new Error('등록 자료를 읽을 수 없습니다.');
        return body.data;
    }));
    check();
    for (const [index, value] of saved.entries()) {
        const key = keys[index];
        if (value.status === 'rejected') { result.warnings.push(`등록된 ${labels[key]} 자료를 불러오지 못했습니다. 다시 시도해 주세요.`); continue; }
        if (key === 'guides') result.guides = guides(value.value);
        else if (key === 'lodges') result.lodges = lodges(value.value);
        else result.vehicles = vehicles(value.value);
    }
    return result;
}
