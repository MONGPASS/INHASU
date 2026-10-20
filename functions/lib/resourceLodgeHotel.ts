/** Public compatibility projection for product itineraries that reference a shared lodging resource. */
export const RESOURCE_LODGE_PREFIX = 'resource-lodge:';

export interface PublicResourceLodgeHotel {
    id: string;
    name_kr: string;
    name_local: string;
    region: string;
    address: string;
    description: string;
    images: string[];
    amenities: string[];
    type: string;
    is_active: boolean;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

function imageUrl(value: unknown): string {
    const raw = text(value);
    if (!raw || /[\u0000-\u0020\\]/.test(raw) || raw.startsWith('//')) return '';
    // Existing resource uploads can be embedded raster images. SVG and temporary browser URLs are excluded.
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw)) return raw;
    if (/^[a-z][a-z\d+.-]*:/i.test(raw)) {
        try {
            const url = new URL(raw);
            return /^https?:$/.test(url.protocol) && !url.username && !url.password ? raw : '';
        } catch { return ''; }
    }
    try {
        const url = new URL(raw, 'https://resource-lodge.invalid/');
        return url.origin === 'https://resource-lodge.invalid' ? raw : '';
    } catch { return ''; }
}

function words(value: unknown): string[] {
    if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === 'string').map(entry => entry.trim()).filter(Boolean);
    if (typeof value !== 'string' || !value.trim()) return [];
    try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return words(parsed); } catch { /* Older resource fields contain prose lists. */ }
    return value.split(/[\r\n,·|]+/).map(entry => entry.trim()).filter(Boolean);
}

/** Never spread the resource object: contact, notes and stored legacy description are not itinerary fields. */
export function publicResourceLodgeHotel(id: string, catalog: unknown): PublicResourceLodgeHotel | null {
    if (!id.startsWith(RESOURCE_LODGE_PREFIX) || !record(catalog)) return null;
    const name = id.slice(RESOURCE_LODGE_PREFIX.length);
    if (!name.trim() || /[\u0000-\u001f]/.test(name) || !Object.hasOwn(catalog, name)) return null;
    const lodge = catalog[name];
    if (!record(lodge)) return null;
    // An explicit empty representative selection is intentional; do not resurrect older photos.
    const photos = Array.isArray(lodge.representativePhotos) ? lodge.representativePhotos
        : [lodge.img, ...(Array.isArray(lodge.imgs) ? lodge.imgs : [])];
    return {
        id, name_kr: name, name_local: '', region: text(lodge.region), address: text(lodge.address),
        description: '', images: [...new Set(photos.map(imageUrl).filter(Boolean))],
        amenities: [...new Set([...words(lodge.facilities), ...words(lodge.roomAmenities), ...words(lodge.sharedFacilities)])],
        type: text(lodge.grade), is_active: true,
    };
}
