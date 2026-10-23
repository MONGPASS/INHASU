import { getProductStartingPrice } from './productStartingPrice.ts';

export interface PublicProductPriceFields {
    startingPrice?: number | null;
    priceBasisPeople?: number | null;
    priceReady?: boolean;
    pricingOptions?: unknown;
    pricing_options?: unknown;
}

/** Full/summary API rows retain the tiers; compact projected cards carry their verified metadata. */
export function publicProductPrice(product: unknown): { price: number | null; people: number | null } {
    const row = product && typeof product === 'object' ? product as Record<string, unknown> : {};
    if (row.pricingOptions !== undefined || row.pricing_options !== undefined) return getProductStartingPrice(row);
    const price = row.startingPrice, people = row.priceBasisPeople;
    return row.priceReady === true && typeof price === 'number' && Number.isSafeInteger(price) && price > 0
        && typeof people === 'number' && Number.isSafeInteger(people) && people > 0
        ? { price, people } : { price: null, people: null };
}

export function productPriceLabel(product: unknown): string {
    const { price } = publicProductPrice(product);
    return price === null ? '요금 등록 필요' : `1인 ${price.toLocaleString('ko-KR')}원부터`;
}

export function productPriceBasis(product: unknown): string | null {
    const { people } = publicProductPrice(product);
    return people === null ? null : `${people}명 기준 · 기본요금`;
}

export function withPublicProductPrice<T extends object>(product: T): T & { price: number; startingPrice: number | null; priceBasisPeople: number | null; priceReady: boolean } {
    const { price, people } = publicProductPrice(product);
    return { ...product, price: price ?? 0, startingPrice: price, priceBasisPeople: people, priceReady: price !== null };
}

/** Missing prices follow registered rates in either direction; they are never treated as a free tour. */
export function compareProductStartingPrice(a: unknown, b: unknown, direction: 'low' | 'high'): number {
    const left = publicProductPrice(a).price, right = publicProductPrice(b).price;
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    return direction === 'low' ? left - right : right - left;
}
