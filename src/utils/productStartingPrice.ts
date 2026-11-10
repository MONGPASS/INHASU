type Row = Record<string, unknown>;

export type ProductPricedOption = Row & { people: number; pricePerPerson: number };

export interface ProductStartingPrice {
    price: number | null;
    people: number | null;
    isTiered: boolean;
}

const positiveInteger = (value: unknown): number | null => {
    if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value.trim()))) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? number : null;
};

const configuredTiers = (product: unknown): unknown[] | null => {
    const source = product && typeof product === 'object' && !Array.isArray(product) ? product as Row : {};
    let tiers = source.pricingOptions !== undefined ? source.pricingOptions : source.pricing_options;
    if (typeof tiers === 'string') {
        try { tiers = JSON.parse(tiers); } catch { tiers = null; }
    }
    return Array.isArray(tiers) ? tiers : null;
};

/** Catalog selection and checkout share the positive registered tiers, including legacy aliases. */
export function getProductPricedOptions(product: unknown): ProductPricedOption[] {
    const options: ProductPricedOption[] = [];
    for (const tier of configuredTiers(product) ?? []) {
        if (!tier || typeof tier !== 'object' || Array.isArray(tier)) continue;
        const row = tier as Row;
        const price = positiveInteger(row.pricePerPerson !== undefined ? row.pricePerPerson : row.price_per_person);
        const people = positiveInteger(row.people);
        if (price === null || people === null) continue;
        options.push({ ...row, people, pricePerPerson: price });
    }
    return options;
}

/** A catalog starting price always identifies the configured group size it requires. */
export function getProductStartingPrice(product: unknown): ProductStartingPrice {
    const result: ProductStartingPrice = { price: null, people: null, isTiered: (configuredTiers(product)?.length ?? 0) > 0 };
    for (const option of getProductPricedOptions(product)) {
        if (result.price === null || option.pricePerPerson < result.price || (option.pricePerPerson === result.price && option.people < result.people!)) {
            result.price = option.pricePerPerson;
            result.people = option.people;
        }
    }
    return result;
}
