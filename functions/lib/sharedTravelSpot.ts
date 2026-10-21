/** Public itinerary fields from the shared quote travel destination library. */
export const SHARED_TRAVEL_SPOT_PREFIX = 'quote-spot:';

export interface PublicSharedTravelSpot {
    id: string;
    name_kr: string;
    name_local: string;
    address: string;
    description: string;
    images: string[];
    region: string;
    is_active: boolean;
}

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';

function imageUrl(value: unknown): string {
    const raw = text(value);
    if (!raw || /[\u0000-\u0020\\]/.test(raw) || raw.startsWith('//')) return '';
    // The quote editor also stores embedded raster images in local imports.
    if (/^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw)) return raw;
    try {
        const url = new URL(raw, 'https://travel-spot.invalid/');
        if (!/^https?:$/.test(url.protocol) || url.username || url.password) return '';
        // Customer attachments must never become a public itinerary photograph.
        if (/^\/(?:api\/file(?:\/|$)|uploads(?:\/|$))/i.test(url.pathname)) return '';
        return raw;
    } catch { return ''; }
}

/** Invalid storage is an error, rather than an apparently empty destination list. */
export function parseSharedTravelSpots(value: unknown): Record<string, Record<string, unknown>> {
    if (typeof value !== 'string') throw new Error('Invalid travel destination library');
    const parsed: unknown = JSON.parse(value);
    if (!record(parsed)) throw new Error('Invalid travel destination library');
    for (const [name, spot] of Object.entries(parsed)) {
        if (!name.trim() || /[\u0000-\u001f]/.test(name) || !record(spot)) throw new Error('Invalid travel destination entry');
        for (const field of ['nameMn', 'region', 'short', 'desc', 'address', 'img']) {
            if (spot[field] !== undefined && typeof spot[field] !== 'string') throw new Error('Invalid travel destination field');
        }
        if (spot.subImgs !== undefined && (!Array.isArray(spot.subImgs) || spot.subImgs.some(image => typeof image !== 'string'))) {
            throw new Error('Invalid travel destination photographs');
        }
    }
    return parsed as Record<string, Record<string, unknown>>;
}

/** Never spread the source: notes, contact details and other editor data stay private. */
export function publicSharedTravelSpot(id: string, catalog: Record<string, Record<string, unknown>>): PublicSharedTravelSpot | null {
    if (!id.startsWith(SHARED_TRAVEL_SPOT_PREFIX)) return null;
    const name = id.slice(SHARED_TRAVEL_SPOT_PREFIX.length);
    if (!name.trim() || !Object.hasOwn(catalog, name)) return null;
    const spot = catalog[name];
    const photos = [spot.img, ...(Array.isArray(spot.subImgs) ? spot.subImgs : [])];
    return {
        id, name_kr: name, name_local: text(spot.nameMn), address: text(spot.address),
        description: text(spot.desc), images: [...new Set(photos.map(imageUrl).filter(Boolean))],
        region: text(spot.region), is_active: true,
    };
}

export function publicSharedTravelSpots(catalog: Record<string, Record<string, unknown>>): PublicSharedTravelSpot[] {
    return Object.keys(catalog).sort((a, b) => a.localeCompare(b, 'ko')).map(name => publicSharedTravelSpot(`${SHARED_TRAVEL_SPOT_PREFIX}${name}`, catalog)!);
}
