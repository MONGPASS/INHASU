import { calendarDateKey } from './adminTourCalendar.ts';
import type { AssignmentAccommodation } from './reservationAssignment.ts';

/** A booking's stored lodging rows are separate from its expected overnight dates. */
export interface LodgingBooking {
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
    depositStatus?: string | null;
    type?: string | null;
    source?: string | null;
    dailyAccommodations?: readonly AssignmentAccommodation[] | null;
}
export interface LodgingPeriod {
    valid: boolean;
    startDate: string;
    endDate: string;
    nights: number;
    reason: 'missing' | 'invalid' | 'reversed' | 'too_long' | '';
}
export interface LodgingSlot {
    day: number;
    date: string;
    accommodation: AssignmentAccommodation['accommodation'];
    /** Index into the original array; null is an overnight date not yet stored. */
    rowIndex: number | null;
    rowIndices: number[];
    conflict: boolean;
    invalid: boolean;
    assigned: boolean;
    confirmed: boolean;
}
export interface LodgingSummary {
    valid: boolean;
    expected: number;
    assigned: number;
    confirmed: number;
    missing: number;
    allConfirmed: boolean;
    notRequired: boolean;
    /** Stable issue codes; display labels belong to the consuming UI. Row indices are zero based. */
    issues: string[];
    slots: LodgingSlot[];
}
export interface LodgingSupplierItem extends LodgingBooking {
    id?: string;
    key?: string;
    bookingId?: string;
    customerName?: string;
    productName?: string;
    travelers?: number | null;
    people?: number | null;
}
export interface LodgingSupplierBooking {
    key: string;
    source: string;
    id: string;
    customerName: string;
    productName: string;
    day: number;
    people: number | null;
    roomCount: number | null;
    occupancy: string;
    status: string;
}
export interface LodgingSupplierGroup {
    key: string;
    date: string;
    id: string;
    name: string;
    location: string;
    manual: boolean;
    bookings: LodgingSupplierBooking[];
    roomCountTotal: number;
    unknownRoomCount: number;
    peopleTotal: number;
    unknownPeople: number;
    assigned: number;
    confirmed: number;
}

const DAY = 86_400_000;
const CONFIRMED = 'Баталгаажсан';
export const LODGING_UNSENT = 'Илгээгээгүй';
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const dayNumber = (date: string): number => Date.parse(`${date}T00:00:00Z`) / DAY;
const dateOffset = (date: string, offset: number): string => new Date((dayNumber(date) + offset) * DAY).toISOString().slice(0, 10);
const clone = <T,>(value: T): T => structuredClone(value);

export function lodgingPeriod(row: LodgingBooking): LodgingPeriod {
    const startDate = calendarDateKey(row.startDate), endDate = calendarDateKey(row.endDate);
    const fail = (reason: LodgingPeriod['reason']): LodgingPeriod => ({ valid: false, startDate, endDate, nights: 0, reason });
    if (!text(row.startDate) || !text(row.endDate)) return fail('missing');
    if (!startDate || !endDate) return fail('invalid');
    if (endDate < startDate) return fail('reversed');
    const nights = dayNumber(endDate) - dayNumber(startDate);
    // The assignment API accepts at most 100 overnight rows for a booking.
    if (nights > 100) return fail('too_long');
    return { valid: true, startDate, endDate, nights, reason: '' };
}

export function isCancelledLodgingBooking(row: Pick<LodgingBooking, 'status'>): boolean {
    return ['cancelled', 'canceled', '취소', '예약취소', 'цуцлагдсан'].includes(text(row.status).toLowerCase());
}

export function isConfirmedLodgingBooking(row: LodgingBooking): boolean {
    if (isCancelledLodgingBooking(row) || text(row.status).toLowerCase() === 'on_hold') return false;
    if (row.source && !['product', 'quote_booking'].includes(row.source)) return false;
    return ['confirmed', 'paid', 'completed'].includes(text(row.status).toLowerCase()) || text(row.depositStatus).toLowerCase() === 'paid';
}

const validDayIdentifier = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 100;
interface MappedRow { day: number | null; invalid: boolean; issues: string[] }
function mappedDay(raw: unknown, period: LodgingPeriod, index: number): MappedRow {
    const row = record(raw), rawDate = text(row.date), date = calendarDateKey(rawDate);
    const explicitDate = row.date !== undefined && row.date !== null && (typeof row.date !== 'string' || !!rawDate);
    const issues: string[] = [];
    const validIdentifier = validDayIdentifier(row.day);
    if (!validIdentifier) issues.push(`invalid_day:${index}`);
    // Preserve a malformed explicit date for repair; the numeric fallback must not certify it.
    if (explicitDate && !date) issues.push(`invalid_date:${index}`);
    // Dates locate old rows without silently repairing their stored day identifiers.
    const day = date ? dayNumber(date) - dayNumber(period.startDate) + 1 : validIdentifier ? row.day as number : null;
    if (day === null) return { day: null, invalid: true, issues };
    if (day < 1 || day > period.nights) return { day: null, invalid: true, issues: [...issues, `out_of_range:${index}`] };
    if (date && validIdentifier && row.day !== day) issues.push(`day_date_mismatch:${index}`);
    return { day, invalid: issues.length > 0, issues };
}

function analyzeLodging(row: LodgingBooking): { period: LodgingPeriod; slots: LodgingSlot[]; issues: string[] } {
    const period = lodgingPeriod(row);
    const issues: string[] = [];
    if (!period.valid) return { period, slots: [], issues: [`period_${period.reason}`] };
    const slots: LodgingSlot[] = Array.from({ length: period.nights }, (_, index) => ({
        day: index + 1, date: dateOffset(period.startDate, index), accommodation: {}, rowIndex: null,
        rowIndices: [], conflict: false, invalid: false, assigned: false, confirmed: false,
    }));
    const rows = Array.isArray(row.dailyAccommodations) ? row.dailyAccommodations : [];
    if (row.dailyAccommodations != null && !Array.isArray(row.dailyAccommodations)) issues.push('invalid_rows');
    const identifiers = new Map<number, number[]>();
    rows.forEach((raw, index) => {
        const identifier = record(raw).day;
        if (validDayIdentifier(identifier)) identifiers.set(identifier, [...(identifiers.get(identifier) || []), index]);
        const mapping = mappedDay(raw, period, index);
        issues.push(...mapping.issues);
        if (mapping.day === null) return;
        const slot = slots[mapping.day - 1];
        slot.rowIndices.push(index);
        slot.rowIndex = index;
        slot.invalid ||= mapping.invalid;
        slot.accommodation = clone(record(record(raw).accommodation)) as AssignmentAccommodation['accommodation'];
    });
    const duplicateIdentifierRows = new Set<number>();
    for (const [identifier, indices] of identifiers) {
        if (indices.length < 2) continue;
        issues.push(`duplicate_identifier:${identifier}`);
        indices.forEach(index => duplicateIdentifierRows.add(index));
    }
    for (const slot of slots) {
        slot.invalid ||= slot.rowIndices.some(index => duplicateIdentifierRows.has(index));
        slot.conflict = slot.rowIndices.length > 1;
        if (slot.conflict) issues.push(`duplicate_day:${slot.day}`);
        slot.assigned = !!text(slot.accommodation.name) && !isCancelledLodgingBooking({ status: slot.accommodation.bookingStatus });
        slot.confirmed = slot.assigned && !slot.invalid && !slot.conflict && [CONFIRMED, 'confirmed'].includes(text(slot.accommodation.bookingStatus));
    }
    return { period, slots, issues };
}

export function lodgingSlots(row: LodgingBooking): LodgingSlot[] {
    return analyzeLodging(row).slots;
}

export function lodgingSummary(row: LodgingBooking): LodgingSummary {
    const { period, slots, issues } = analyzeLodging(row);
    const assigned = slots.filter(slot => slot.assigned).length;
    const confirmed = slots.filter(slot => slot.confirmed).length;
    const notRequired = period.valid && period.nights === 0;
    return {
        valid: period.valid, expected: period.nights, assigned, confirmed, missing: period.nights - assigned,
        allConfirmed: period.valid && period.nights > 0 && issues.length === 0 && confirmed === period.nights,
        notRequired, issues, slots,
    };
}

/** Fill omitted nights without changing, renumbering, or removing any stored rows or metadata. */
export function materializeLodgingDays(row: LodgingBooking): AssignmentAccommodation[] {
    const rows = clone(Array.isArray(row.dailyAccommodations) ? [...row.dailyAccommodations] : []);
    for (const slot of lodgingSlots(row)) {
        if (slot.rowIndex === null) rows.push({ day: slot.day, date: slot.date, accommodation: {} });
    }
    return rows;
}

const nonNegativeInteger = (value: unknown): number | null => {
    if (value === null || value === undefined || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 ? number : null;
};

/** Supplier demand by actual overnight date, never inferred hotel inventory or capacity. */
export function lodgingSupplierGroups(items: readonly LodgingSupplierItem[]): LodgingSupplierGroup[] {
    const groups = new Map<string, LodgingSupplierGroup>();
    const seen = new Set<string>();
    for (const item of items) {
        if (isCancelledLodgingBooking(item) || text(item.status).toLowerCase() === 'on_hold') continue;
        const source = text(item.source) || 'product';
        if (!['product', 'quote_booking'].includes(source)) continue;
        const id = text(item.bookingId) || text(item.id);
        if (!id) continue;
        const key = text(item.key) || (text(item.id).startsWith(`${source}:`) ? text(item.id) : `${source}:${id}`);
        for (const slot of lodgingSlots(item)) {
            // Duplicated or malformed night memberships require repair before supplier totals are reliable.
            const membership = JSON.stringify([source, id, slot.date]);
            if (!slot.assigned || slot.invalid || slot.conflict || seen.has(membership)) continue;
            seen.add(membership);
            const acc = slot.accommodation, hotelId = text(acc.id), name = text(acc.name), location = text(acc.location);
            const groupKey = JSON.stringify([slot.date, hotelId ? 'catalog' : 'manual', hotelId || name.toLocaleLowerCase('en-US'), hotelId ? '' : location.toLocaleLowerCase('en-US')]);
            let group = groups.get(groupKey);
            if (!group) {
                group = { key: groupKey, date: slot.date, id: hotelId, name, location, manual: !hotelId, bookings: [],
                    roomCountTotal: 0, unknownRoomCount: 0, peopleTotal: 0, unknownPeople: 0, assigned: 0, confirmed: 0 };
                groups.set(groupKey, group);
            }
            const people = nonNegativeInteger(item.travelers ?? item.people);
            const rooms = nonNegativeInteger(acc.roomCount);
            group.bookings.push({ key, source, id, customerName: text(item.customerName), productName: text(item.productName),
                day: slot.day, people, roomCount: rooms, occupancy: text(acc.occupancy), status: text(acc.bookingStatus) || LODGING_UNSENT });
            if (people === null) group.unknownPeople++; else group.peopleTotal += people;
            if (rooms === null) group.unknownRoomCount++; else group.roomCountTotal += rooms;
            group.assigned++;
            if (slot.confirmed) group.confirmed++;
        }
    }
    return [...groups.values()].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

/** Count each booking once in every calendar month touched by its inclusive tour period. */
export function lodgingMonthCounts(items: readonly LodgingSupplierItem[], year: number): number[] {
    const counts = Array.from({ length: 12 }, () => 0);
    if (!Number.isInteger(year) || year < 1000 || year > 9999) return counts;
    const seen = new Set<string>();
    for (const item of items) {
        if (isCancelledLodgingBooking(item)) continue;
        const period = lodgingPeriod(item);
        if (!period.valid) continue;
        const source = text(item.source) || 'product';
        if (!['product', 'quote_booking'].includes(source)) continue;
        const rawIdentity = text(item.key) || text(item.bookingId) || text(item.id);
        const identity = rawIdentity.startsWith(`${source}:`) ? rawIdentity.slice(source.length + 1) : rawIdentity;
        if (identity) {
            const key = JSON.stringify([source, identity]);
            if (seen.has(key)) continue;
            seen.add(key);
        }
        for (let month = 1; month <= 12; month++) {
            const start = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
            const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            if (period.startDate <= end && period.endDate >= start) counts[month - 1]++;
        }
    }
    return counts;
}

const identity = (raw: unknown): unknown[] => {
    const acc = record(raw);
    return [text(acc.id), text(acc.name), text(acc.type), text(acc.location)];
};
const roomCount = (value: unknown): unknown => value === undefined || value === null || value === '' ? '' : Number.isFinite(Number(value)) ? Number(value) : value;
const dateIdentity = (value: unknown, startDate: unknown, day: number): string => {
    if (text(value)) return calendarDateKey(value) || text(value);
    const start = calendarDateKey(startDate);
    return start && Number.isInteger(day) ? dateOffset(start, day - 1) : '';
};

/** A confirmed supplier booking cannot survive a change to its lodging, rooms, or overnight date. */
export function resetLodgingConfirmation<T extends AssignmentAccommodation>(previous: AssignmentAccommodation, next: T, startDate?: string | null): T {
    const before = record(previous.accommodation), after = record(next.accommodation);
    const changed = JSON.stringify(identity(before)) !== JSON.stringify(identity(after))
        || roomCount(before.roomCount) !== roomCount(after.roomCount)
        || text(before.occupancy) !== text(after.occupancy)
        || dateIdentity(previous.date, startDate, Number(previous.day)) !== dateIdentity(next.date, startDate, Number(next.day));
    return changed ? { ...next, accommodation: { ...next.accommodation, bookingStatus: LODGING_UNSENT } } : next;
}
