type ReservationProductSource = { productId?: unknown; productName?: unknown };
type ProductReferenceSource = { id?: unknown; name?: unknown; thumbnail?: unknown; mainImages?: unknown; main_images?: unknown };

export type CustomerProductReference = {
    name: string;
    href?: string;
    image?: string;
    match: 'id' | 'name' | 'stored';
};

function savedName(value: unknown): string {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

function savedId(value: unknown): string | undefined {
    if (typeof value !== 'string' && typeof value !== 'number') return undefined;
    if (typeof value === 'number' && !Number.isFinite(value)) return undefined;
    const id = String(value).trim();
    if (!id || id === '.' || id === '..' || /[\u0000-\u001f\u007f]/.test(id)) return undefined;
    try { encodeURIComponent(id); return id; } catch { return undefined; }
}

function savedImage(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const image = value.trim();
    if (!image || /[\u0000-\u0020\u007f\\]/.test(image) || image.startsWith('//') || /^[?#]/.test(image)) return undefined;
    if (/^[a-z][a-z\d+.-]*:/i.test(image)) {
        try {
            const url = new URL(image);
            return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? image : undefined;
        } catch { return undefined; }
    }
    return image;
}

function imageArray(value: unknown): unknown[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string') return [];
    try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function productImage(product: ProductReferenceSource): string | undefined {
    return [product.thumbnail, ...imageArray(product.mainImages), ...imageArray(product.main_images)]
        .map(savedImage).find((image): image is string => Boolean(image));
}

/** Resolve the booked product only; never borrow a similarly named product's image or link. */
export function customerProductReference(
    reservation: ReservationProductSource | null | undefined,
    products: readonly ProductReferenceSource[] | null | undefined,
): CustomerProductReference | undefined {
    if (!reservation) return undefined;
    const name = savedName(reservation.productName);
    const id = savedId(reservation.productId);
    const rows = Array.isArray(products) ? products.filter(row => row && typeof row === 'object') : [];
    if (id !== undefined) {
        const product = rows.find(row => savedId(row.id) === id);
        const image = product ? productImage(product) : undefined;
        return {
            name: name || savedName(product?.name) || '예약 상품',
            href: `/products/${encodeURIComponent(id)}`,
            ...(image ? { image } : {}),
            match: product ? 'id' : 'stored',
        };
    }
    if (!name) return undefined;
    // A supplied but malformed ID is still authoritative: do not silently fall back to a name.
    const rawId = reservation.productId;
    const idAbsent = rawId == null || (typeof rawId === 'string' && !rawId.trim());
    const matches = idAbsent ? rows.filter(row => savedName(row.name) === name) : [];
    if (matches.length !== 1) return { name, match: 'stored' };
    const product = matches[0];
    const matchedId = savedId(product.id);
    if (matchedId === undefined) return { name, match: 'stored' };
    const image = productImage(product);
    return { name, href: `/products/${encodeURIComponent(matchedId)}`, ...(image ? { image } : {}), match: 'name' };
}
