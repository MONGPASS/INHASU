import { parseDocumentJson, productScheduleDays } from '../../functions/lib/productItinerary.ts';
import type { TemplateDay } from '../pages/AdminTemplateManage';

/** An explicit booking product ID must never fall back to a different product. */
export function selectReservationProduct<T extends { id?: string; name?: string }>(products: T[], productId?: string, productName?: string): T | null {
    const id = typeof productId === 'string' ? productId.trim() : '';
    if (id) return products.find(product => product.id === id) || null;
    const name = typeof productName === 'string' ? productName.trim() : '';
    if (!name) return null;
    const matches = products.filter(product => typeof product.name === 'string' && product.name.trim() === name);
    return matches.length === 1 ? matches[0] : null;
}

/** Saved content is authoritative, including an intentionally empty days array. */
export function canAutoImportReservationDocument(initialContent: unknown, templateMode = false): boolean {
    return initialContent == null && !templateMode;
}

/** Contract-first editing needs the same booked inclusions as the itinerary. */
export function reservationProductTerms(product: any): { included: string[]; excluded: string[] } {
    const labels = (value: unknown): string[] => {
        const parsed = parseDocumentJson(value, []);
        return Array.isArray(parsed) ? parsed.map(item => typeof item === 'string' ? item
            : item?.label || item?.title || item?.name || item?.description || '').filter(Boolean) : [];
    };
    return { included: labels(product?.included), excluded: labels(product?.excluded) };
}

/** Keep the editor and the customer PDF on the same product conversion path. */
export function reservationProductDays(product: unknown): TemplateDay[] {
    return productScheduleDays(product).map(day => ({
        ...day,
        title: day.title || '',
        region: day.region || '',
        summary: day.summary || '',
        images: [...(day.images || [])],
        meals: { ...(day.meals || {}) },
        activities: day.activities.map((activity: any) => ({
            ...activity,
            type: activity.type || 'sightseeing',
            title: activity.title || '',
            description: activity.description || '',
            images: [...(activity.images || [])],
        })),
        accommodation: day.accommodation ? { ...day.accommodation, images: [...(day.accommodation.images || [])] } : null,
    }));
}
