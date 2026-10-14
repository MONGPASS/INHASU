import type { ReservationDocContent } from '../components/admin/ReservationDocumentEditor';
import { mergeDocumentSettings, type TemplateDay } from '../pages/AdminTemplateManage';
import { reservationProductDays, reservationProductTerms } from './reservationDocument';

const text = (value: unknown): string => typeof value === 'string' ? value : '';
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];

/** An existing saved document is authoritative; defaults are only for a new one. */
export function createInlineDocument(initial: ReservationDocContent | null, product: any, productName: string): ReservationDocContent {
    if (initial != null) return structuredClone(initial);
    const settings = mergeDocumentSettings(null);
    const { included, excluded } = reservationProductTerms(product);
    return {
        name: productName || text(product?.name),
        description: text(product?.description),
        days: reservationProductDays(product),
        highlights: [],
        documentSettings: {
            ...settings,
            overview: {
                ...settings.overview,
                heroTagline: text(product?.description),
                included: included.map(label => ({ icon: 'check_circle', label })),
                includedText: included.join('\n'),
                excludedText: excluded.join('\n'),
                pricePerPerson: typeof product?.price === 'number' && Number.isFinite(product.price) ? String(product.price) : '',
            },
            contract: { ...settings.contract, includedText: included.join('\n'), excludedText: excluded.join('\n') },
            detail: { ...settings.detail, footerBadges: [] },
        },
    };
}

const snippetActivity = (line: string) => {
    const value = line.trim();
    const match = value.match(/^((?:[01]?\d|2[0-3]):[0-5]\d)\s+(.+)$/);
    return { title: match ? match[2] : value, ...(match ? { time: match[1] } : {}) };
};

/** Applying a quote snippet changes the visible fields while keeping existing media. */
export function applyQuoteSnippet(day: TemplateDay, snippet: any): TemplateDay {
    const copy = structuredClone(day);
    if (!record(snippet)) return copy;
    const oldActivities = Array.isArray(copy.activities) ? copy.activities : [];
    const used = new Set<number>();
    const parsedItems = Array.isArray(snippet.items) ? strings(snippet.items).filter(line => line.trim()).map(snippetActivity) : null;
    // Reserve every exact-title match first; an earlier index fallback must not
    // take the metadata belonging to a later exact-title activity.
    const matches = parsedItems?.map(parsed => {
        const index = oldActivities.findIndex((activity, oldIndex) => !used.has(oldIndex) && text(activity.title).trim() === parsed.title);
        if (index >= 0) used.add(index);
        return index;
    });
    const activities = parsedItems ? parsedItems.map((parsed, index) => {
        let matchedIndex = matches![index];
        if (matchedIndex < 0 && oldActivities[index] && !used.has(index)) {
            matchedIndex = index;
            used.add(index);
        }
        const previous = matchedIndex >= 0 ? oldActivities[matchedIndex] : undefined;
        return { ...previous, title: parsed.title, description: previous?.description || '',
            time: parsed.time ?? previous?.time ?? '', type: previous?.type || 'sightseeing' as const,
            images: [...(previous?.images || [])] };
    }) : oldActivities;

    // Orphaned activity photos stay in the DAY gallery when a snippet has fewer
    // rows. Photos already retained by an activity are not duplicated there.
    const retainedPhotos = new Set(activities.flatMap(activity => activity.images || []));
    const orphanedPhotos = oldActivities.flatMap(activity => activity.images || []).filter(src => !retainedPhotos.has(src));
    let accommodation = copy.accommodation;
    if (snippet.stay === null) accommodation = null;
    else if (record(snippet.stay)) {
        accommodation = { ...(accommodation || {}), name: text(snippet.stay.name),
            ...(Array.isArray(snippet.stay.tags) ? { tags: strings(snippet.stay.tags).join(', ') }
                : typeof snippet.stay.tags === 'string' ? { tags: snippet.stay.tags } : {}) };
    }
    const removedStayPhotos = !accommodation ? strings(copy.accommodation?.images) : [];
    const meals = Array.isArray(snippet.meals) ? { breakfast: text(snippet.meals[0]), lunch: text(snippet.meals[1]), dinner: text(snippet.meals[2]) } : copy.meals;
    return { ...copy,
        title: text(snippet.dest).replace(/<br\s*\/?>/gi, ' / '),
        move: text(snippet.move), dist: text(snippet.dist),
        activities, accommodation, meals,
        images: [...new Set([...strings(copy.images), ...orphanedPhotos, ...removedStayPhotos])],
    };
}

export interface QuoteLibraryGroup { name: string; items: Array<{ name: string; value: any }>; }

/** The public quote library is an object dictionary, not a sample fallback. */
export function groupQuoteLibrary(map: any, categories: any): QuoteLibraryGroup[] {
    if (!record(map)) return [];
    const groups = new Map<string, QuoteLibraryGroup['items']>();
    for (const [rawName, value] of Object.entries(map)) {
        const name = rawName.trim();
        if (!name || !record(value) || !Object.keys(value).some(key => ['cat', 'region', 'category', 'dest', 'items', 'stay', 'meals', 'move', 'dist', 'name', 'nameMn', 'title', 'desc', 'img', 'subImgs'].includes(key))) continue;
        const category = text(value.cat).trim() || text(value.region).trim() || text(value.category).trim() || '기타';
        const items = groups.get(category) || [];
        items.push({ name, value });
        groups.set(category, items);
    }
    const registered = strings(categories).map(name => name.trim()).filter(Boolean);
    const order = [...new Set([...registered, ...groups.keys()])].filter(name => name !== '기타');
    if (groups.has('기타')) order.push('기타');
    return order.filter(name => groups.has(name)).map(name => ({ name, items: groups.get(name)! }));
}
