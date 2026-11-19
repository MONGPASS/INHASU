import type { AccommodationOption } from '../types/product';

/** Keep each choice addressable, including older rows with missing or repeated IDs. */
export function normalizeAccommodationOptions(options: readonly AccommodationOption[]): AccommodationOption[] {
    const rows = options.filter(option => option && typeof option === 'object');
    const defaultIndex = Math.max(0, rows.findIndex(option => option.isDefault === true));
    const reservedIds = new Set(rows.map(option => option.id));
    const usedIds = new Set<string>();
    let nextId = 1;
    return rows.map((option, index) => {
        let id = option.id;
        if (typeof id !== 'string' || !id.trim() || usedIds.has(id)) {
            do { id = `acc-legacy-${nextId++}`; } while (reservedIds.has(id));
        }
        usedIds.add(id);
        const price = Number(option.priceModifier);
        return {
            ...option, id, isDefault: index === defaultIndex,
            name: typeof option.name === 'string' ? option.name : '',
            description: typeof option.description === 'string' ? option.description : '',
            priceModifier: Number.isFinite(price) ? price : 0,
        };
    });
}

/** The editor can have unused input rows. Only named options are offered to customers. */
export function bookableAccommodationOptions(options: readonly AccommodationOption[]): AccommodationOption[] {
    const named = normalizeAccommodationOptions(options).filter(option => option.name.trim());
    if (named.length && !named.some(option => option.isDefault)) named[0].isDefault = true;
    return named;
}
