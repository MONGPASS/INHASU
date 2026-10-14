import type { ReservationDocContent } from '../components/admin/ReservationDocumentEditor';
import { mergeDocumentSettings, type TemplateDay } from '../pages/AdminTemplateManage';
import { reservationProductDays, reservationProductTerms } from './reservationDocument';
import { normalizeRepresentativeSpots } from '../../functions/lib/productItinerary';

const text = (value: unknown): string => typeof value === 'string' ? value : '';
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];

/** Saved fields are authoritative; old documents without a spot selection inherit it once. */
export function createInlineDocument(initial: ReservationDocContent | null, product: any, productName: string): ReservationDocContent {
    if (initial != null) {
        const saved = structuredClone(initial);
        if (!Object.hasOwn(saved, 'highlights')) {
            saved.highlights = normalizeRepresentativeSpots(product?.representative_spots ?? product?.representativeSpots);
        }
        return saved;
    }
    const settings = mergeDocumentSettings(null);
    const { included, excluded } = reservationProductTerms(product);
    return {
        name: productName || text(product?.name),
        description: text(product?.description),
        days: reservationProductDays(product).map(day => ({ ...day, date: '', dateMode: 'manual' as const })),
        highlights: normalizeRepresentativeSpots(product?.representative_spots ?? product?.representativeSpots),
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
    // "*" is quote display markup, not part of a rich activity's actual title.
    const value = line.trim().replace(/^\*+/, '').trim();
    const match = value.match(/^((?:[01]?\d|2[0-3]):[0-5]\d)\s+(.+)$/);
    return { title: match ? match[2] : value, ...(match ? { time: match[1] } : {}) };
};

export interface QuoteDayFields {
    date: string;
    dest: string;
    move: string;
    dist: string;
    items: string[];
    stay: { name: string; tags: string[] };
    meals: string[];
}
export type QuoteDayPatch = Partial<Omit<QuoteDayFields, 'stay'>> & { stay?: Partial<QuoteDayFields['stay']> | null };

/** Fields consumed by the original compact quote DAY editor. */
export function quoteDayFields(day: TemplateDay): QuoteDayFields {
    const tags = day.accommodation?.tags;
    return {
        date: day.dateMode === 'manual' ? text(day.date) : '',
        dest: text(day.title).replace(/<br\s*\/?>/gi, ' / '),
        move: text(day.move), dist: text(day.dist),
        items: Array.isArray(day.items) ? [...strings(day.items)]
            : [...text(day.summary).split(/\r?\n/).filter(line => line.trim()),
                ...(day.activities || []).map(activity => [text(activity.time), text(activity.title)].filter(Boolean).join(' ')).filter(Boolean)],
        stay: { name: text(day.accommodation?.name), tags: Array.isArray(tags) ? strings(tags) : text(tags).split(',').map(tag => tag.trim()).filter(Boolean) },
        meals: [text(day.meals?.breakfast), text(day.meals?.lunch), text(day.meals?.dinner)],
    };
}

/** Same combined movement-field parser as public/견적만들기.html. */
export function parseQuoteMove(value: string): { move: string; dist: string } {
    const match = text(value).match(/^(.*?)(\(.*\))?\s*$/);
    return { move: (match?.[1] || '').trim(), dist: (match?.[2] || '').trim() };
}

/** Read-only placeholder until the user explicitly fills or edits the dates. */
export function quoteDateForStart(start: string, index: number): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isInteger(index) || index < 0) return '';
    const date = new Date(`${start}T00:00:00Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== start) return '';
    date.setUTCDate(date.getUTCDate() + index);
    return `${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(date.getUTCDate()).padStart(2, '0')}(${['일', '월', '화', '수', '목', '금', '토'][date.getUTCDay()]})`;
}

/** Called only by the original "출발일 자동 채우기" button. */
export function fillQuoteDayDates(days: TemplateDay[], start: string): TemplateDay[] {
    if (!quoteDateForStart(start, 0)) return structuredClone(days);
    return days.map((day, index) => updateQuoteDay(day, { date: quoteDateForStart(start, index) }));
}

/** Compact text fields and rich itinerary metadata share one saved document. */
export function updateQuoteDay(day: TemplateDay, patch: QuoteDayPatch, options: { preserveExistingTimes?: boolean } = {}): TemplateDay {
    const copy = structuredClone(day);
    if (!record(patch)) return copy;
    if (typeof patch.date === 'string') { copy.date = patch.date; copy.dateMode = 'manual'; }
    if (typeof patch.dest === 'string') copy.title = patch.dest.replace(/<br\s*\/?>/gi, ' / ');
    if (typeof patch.move === 'string') copy.move = patch.move;
    if (typeof patch.dist === 'string') copy.dist = patch.dist;
    const oldActivities = Array.isArray(copy.activities) ? copy.activities : [];
    const oldArchive = Array.isArray(copy.retainedActivities) ? copy.retainedActivities : [];
    const pool = [...oldActivities, ...oldArchive];
    const used = new Set<number>();
    const parsedItems = Array.isArray(patch.items) ? strings(patch.items).filter(line => line.trim()).map(snippetActivity) : null;
    // Reserve every exact-title match first; an earlier index fallback must not
    // take the metadata belonging to a later exact-title activity.
    const matches = parsedItems?.map(parsed => {
        const index = pool.findIndex((activity, oldIndex) => !used.has(oldIndex) && snippetActivity(text(activity.title)).title === parsed.title);
        if (index >= 0) used.add(index);
        return index;
    });
    const activities = parsedItems ? parsedItems.map((parsed, index) => {
        let matchedIndex = matches![index];
        if (matchedIndex < 0 && oldActivities[index] && !used.has(index)) {
            matchedIndex = index;
            used.add(index);
        }
        const previous = matchedIndex >= 0 ? pool[matchedIndex] : undefined;
        return { ...previous, title: parsed.title, description: previous?.description || '',
            time: parsed.time ?? (options.preserveExistingTimes ? previous?.time : '') ?? '', type: previous?.type || 'sightseeing' as const,
            images: [...(previous?.images || [])] };
    }) : oldActivities;

    if (parsedItems) {
        copy.items = [...strings(patch.items)];
        if (copy.summary) copy.retainedSummary = copy.summary;
        copy.summary = '';
        copy.retainedActivities = pool.filter((_, index) => !used.has(index));
    }

    // Orphaned activity photos stay in the DAY gallery when a snippet has fewer
    // rows. Photos already retained by an activity are not duplicated there.
    const retainedPhotos = new Set(activities.flatMap(activity => activity.images || []));
    const orphanedPhotos = oldActivities.flatMap(activity => activity.images || []).filter(src => !retainedPhotos.has(src));
    let accommodation = copy.accommodation;
    if (patch.stay === null) accommodation = null;
    else if (record(patch.stay)) {
        accommodation = { ...(accommodation || { name: '' }),
            ...(typeof patch.stay.name === 'string' ? { name: patch.stay.name } : {}),
            ...(Array.isArray(patch.stay.tags) ? { tags: strings(patch.stay.tags).join(', ') } : {}) };
    }
    const removedStayPhotos = !accommodation ? strings(copy.accommodation?.images) : [];
    const meals = Array.isArray(patch.meals) ? { breakfast: text(patch.meals[0]), lunch: text(patch.meals[1]), dinner: text(patch.meals[2]) } : copy.meals;
    return { ...copy,
        activities, accommodation, meals,
        images: [...new Set([...strings(copy.images), ...orphanedPhotos, ...removedStayPhotos])],
    };
}

/** Applying a library snippet keeps its destination/movement text and the saved date. */
export function applyQuoteSnippet(day: TemplateDay, snippet: any): TemplateDay {
    if (!record(snippet)) return structuredClone(day);
    return updateQuoteDay(day, { dest: text(snippet.dest), move: text(snippet.move), dist: text(snippet.dist),
        ...(Array.isArray(snippet.items) ? { items: strings(snippet.items) } : {}),
        ...(snippet.stay === null ? { stay: null } : record(snippet.stay) ? { stay: { name: text(snippet.stay.name),
            ...(Array.isArray(snippet.stay.tags) ? { tags: strings(snippet.stay.tags) }
                : typeof snippet.stay.tags === 'string' ? { tags: snippet.stay.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean) } : {}) } } : {}),
        ...(Array.isArray(snippet.meals) ? { meals: snippet.meals.slice(0, 3).map(text) } : {}),
    }, { preserveExistingTimes: true });
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
