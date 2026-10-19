import { buildProductQuote, loadProductDocument, parseDocumentJson } from './productItinerary.ts';
import { toTourDateKey } from '../../src/utils/formatDate.ts';

const object = (v: any) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const select = (value: any, keys: string[]) => Object.fromEntries(keys.filter(key => value?.[key] !== undefined).map(key => [key, value[key]]));
const visibleVehicle = (value: any) => typeof value === 'string' ? value : select(value, ['type', 'model', 'name', 'image', 'img', 'images', 'imgs', 'description', 'desc', 'seats', 'luggage']);
const visibleAssignment = (value: any) => ({ guide: select(value?.guide, ['name', 'phone', 'role', 'photo', 'image', 'img', 'desc', 'description']),
    vehicle: visibleVehicle(value?.vehicle), lodges: (Array.isArray(value?.lodges) ? value.lodges : []).map((stay: any) => select(stay, ['day', 'date', 'name', 'region', 'grade', 'img', 'imgs', 'desc', 'tags', 'amenities', 'facilities'])) });
function stable(value: any): any {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(k => value[k] !== undefined).map(k => [k, stable(value[k])]));
    return value ?? null;
}
export async function documentRevision(snapshot: unknown): Promise<string> {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stable(snapshot))));
    return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function productDocumentRevisions(db: any, row: any) {
    const loaded = await loadProductDocument(db, row);
    const custom = object(parseDocumentJson(row.document_content, {})), settings = custom.documentSettings || loaded.template?.documentSettings || {};
    const contract = object(parseDocumentJson(row.contract_data, {}));
    const trip = { name: custom.name || row.product_name, customer: row.customer_name || parseDocumentJson(row.customer_info, {})?.name, start: toTourDateKey(row.start_date), end: toTourDateKey(row.end_date), people: row.travelers };
    // Staff document changes matter; internal memos, checklist state and customer signatures do not.
    const assignment = row.are_assignments_visible_to_user ? visibleAssignment({ guide: parseDocumentJson(row.assigned_guide, {}), vehicle: contract.vehicle }) : {};
    const quote = buildProductQuote({ reservation: row, ...loaded, assignmentsVisible: !!row.are_assignments_visible_to_user });
    // Fingerprint the same projection used by the customer renderer. Its issue date and
    // payment acknowledgements change independently of a revised document.
    const { issueDate: _issueDate, detailDays, price, ...visibleQuote } = quote;
    const itinerary = { ...visibleQuote, price: select(price, ['total', 'deposit', 'balanceFinal']),
        detailDays: detailDays.map((day: any) => ({ ...day, accommodation: select(day.accommodation, ['name', 'location', 'type', 'image', 'img', 'images', 'description', 'tags', 'amenities', 'facilities']) })) };
    const terms = { trip, settings: settings.contract, total: row.total_price, deposit: row.deposit_amount, balance: row.balance_amount, assignment,
        travel: select(contract, ['region', 'category', 'arrival', 'departure', 'pickup', 'drop', 'manager']),
        accommodations: itinerary.detailDays.map((day: any) => ({ day: day.day, accommodation: day.accommodation })),
        included: typeof settings.contract?.includedText === 'string' ? settings.contract.includedText : loaded.product?.included,
        excluded: typeof settings.contract?.excludedText === 'string' ? settings.contract.excludedText : loaded.product?.excluded };
    return { itinerary: await documentRevision(itinerary), contract: await documentRevision(terms) };
}
export async function quoteDocumentRevisions(rec: any) {
    const booking = object(rec.booking), trip = { name: rec.name, depart: rec.depart, return_: rec.return_, adult: rec.adult, child: rec.child, infant: rec.infant };
    return { quote: await documentRevision({ trip, quote: rec.quote }),
        itinerary: await documentRevision({ trip, quote: rec.quote, days: booking.days, assign: visibleAssignment(booking.assign), flight: booking.flight, contractInfo: booking.contractInfo }),
        contract: await documentRevision({ trip, contractInfo: booking.contractInfo, contractTerms: booking.contractTerms, terms: booking.terms, days: booking.days, assign: visibleAssignment(booking.assign), flight: booking.flight }) };
}
