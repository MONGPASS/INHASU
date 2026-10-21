import { toTourDateKey } from '../../src/utils/formatDate.ts';
import type { AssignmentSource } from '../../src/utils/reservationAssignment.ts';
import { productScheduleDays } from './productItinerary.ts';

export interface AssignmentScheduleDay { day: number; date: string; title: string; region: string; summary: string }
export interface AssignmentSchedule {
    source: 'customer' | 'template' | 'product' | 'booking' | 'quote' | 'none' | 'unavailable';
    days: AssignmentScheduleDay[];
    warnings: string[];
}
export interface AssignmentScheduleGuard {
    table: 'products' | 'itinerary_templates';
    id: string;
    values: Record<string, unknown> | null;
}
export interface AssignmentScheduleRead { schedule: AssignmentSchedule; revision: unknown; guards: AssignmentScheduleGuard[] }

const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown) => typeof value === 'string' ? value : '';
function decoded(value: unknown): unknown {
    let current = value;
    for (let i = 0; i < 3 && typeof current === 'string'; i++) current = JSON.parse(current);
    return current;
}
function object(value: unknown): Record<string, any> {
    if (value == null || value === '') return {};
    const parsed = decoded(value);
    if (!record(parsed)) throw new Error('Invalid schedule object');
    return parsed;
}
function days(value: unknown, optional = false): Record<string, any>[] {
    if (optional && (value == null || value === '')) return [];
    const parsed = decoded(value);
    if (!Array.isArray(parsed) || parsed.length > 1000 || parsed.some(day => !record(day))) throw new Error('Invalid schedule days');
    return parsed;
}
function dateAfter(start: unknown, offset: number): string {
    const key = toTourDateKey(start as string);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
    const stamp = Date.parse(`${key}T00:00:00Z`);
    if (!Number.isFinite(stamp) || new Date(stamp).toISOString().slice(0, 10) !== key) return '';
    if (!Number.isInteger(offset) || Math.abs(offset) > 1000) return '';
    return new Date(stamp + offset * 86400000).toISOString().slice(0, 10);
}
function scheduleDate(value: unknown, start: unknown, offset: number): string {
    const raw = text(value).trim();
    if (!raw) return '';
    if (/^\d{4}-\d{2}-\d{2}(?:$|[ T])/.test(raw)) return dateAfter(raw, 0) || raw;
    // Legacy quote dates are labels such as 12.31(목). The nearest expected
    // tour date supplies the year, including trips crossing New Year's Day.
    const short = raw.match(/^(\d{1,2})[./-](\d{1,2})\s*(?:\([^)]*\))?$/);
    const expected = dateAfter(start, offset);
    if (!short || !expected) return raw;
    const year = Number(expected.slice(0, 4));
    const candidates = [year - 1, year, year + 1].map(y => `${y}-${short[1].padStart(2, '0')}-${short[2].padStart(2, '0')}`)
        .filter(key => dateAfter(key, 0) === key);
    return candidates.sort((a, b) => Math.abs(Date.parse(a) - Date.parse(expected)) - Math.abs(Date.parse(b) - Date.parse(expected)))[0] || raw;
}
const summary = (day: Record<string, any>) => {
    if (Array.isArray(day.items)) return day.items.filter((item: unknown) => typeof item === 'string').join('\n').slice(0, 2000);
    const activities = Array.isArray(day.activities) ? day.activities.filter(record).map(activity => [text(activity.time), text(activity.title)].filter(Boolean).join(' ')) : [];
    return [text(day.summary ?? day.description), ...activities].filter(Boolean).join('\n').slice(0, 2000);
};
function project(value: Record<string, any>[], start: unknown, quote: boolean, warnings: string[]): AssignmentScheduleDay[] {
    const seen = new Set<number>();
    return value.map((day, index) => {
        const rawNumber = quote ? day.d ?? day.day : day.day;
        const parsedNumber = rawNumber === undefined ? index + 1 : Number(rawNumber);
        const number = Number.isFinite(parsedNumber) ? parsedNumber : 0;
        if (!Number.isInteger(number) || number < 1 || number > 100) warnings.push(`${index + 1}번째 일정의 일차 번호를 확인해 주세요.`);
        if (seen.has(number)) warnings.push(`${number}일차 일정이 중복되어 있습니다.`);
        seen.add(number);
        const date = quote ? own(day, 'date') ? scheduleDate(day.date, start, number - 1) : dateAfter(start, number - 1)
            : day.dateMode === 'manual' ? scheduleDate(day.date, start, number - 1) : dateAfter(start, number - 1);
        if (!date || dateAfter(date, 0) !== date) warnings.push(`${number}일차 일정 날짜를 확인해 주세요.`);
        return { day: number, date, title: text(quote ? day.dest ?? day.title : day.title).slice(0, 500),
            region: text(day.region).slice(0, 300), summary: summary(day) };
    });
}

/** Per-request caches avoid querying the same product/template for every booking. No assignment is a schedule source. */
export function createAssignmentScheduleReader(db?: any) {
    const rows = new Map<string, Promise<any>>();
    const lookup = (table: AssignmentScheduleGuard['table'], id: string) => {
        const key = `${table}:${id}`;
        if (!rows.has(key)) {
            rows.set(key, Promise.resolve().then(async () => {
                if (!db) throw new Error('Schedule database unavailable');
                const columns = table === 'products' ? 'id,itinerary_blocks,itinerary_images' : 'id,days';
                return await db.prepare(`SELECT ${columns} FROM ${table} WHERE id = ?`).bind(id).first();
            }));
        }
        return rows.get(key)!;
    };
    return async (source: AssignmentSource, row: any): Promise<AssignmentScheduleRead> => {
        const guards: AssignmentScheduleGuard[] = [], warnings: string[] = [];
        let selected: AssignmentSchedule['source'] = 'none', rawDays: Record<string, any>[] = [], revision: unknown = null;
        try {
            if (source === 'quote_booking') {
                const request = object(row.data), booking = object(request.booking);
                if (own(booking, 'days')) { selected = 'booking'; rawDays = days(booking.days); revision = booking.days; }
                else { const quote = object(request.quote); if (own(quote, 'days')) { selected = 'quote'; rawDays = days(quote.days); revision = quote.days; } }
                const start = request.depart || booking.flight?.inDate;
                return { schedule: { source: selected, days: project(rawDays, start, true, warnings), warnings }, revision: [selected, revision], guards };
            }
            const customer = object(row.document_content);
            if (own(customer, 'days')) {
                selected = 'customer'; rawDays = days(customer.days); revision = customer.days;
            } else if (text(row.itinerary_template_id)) {
                selected = 'template';
                const id = row.itinerary_template_id, template = await lookup('itinerary_templates', id);
                guards.push({ table: 'itinerary_templates', id, values: template ? { days: template.days ?? null } : null });
                if (!template) throw new Error('Selected template missing');
                rawDays = days(template.days); revision = template.days;
            } else if (text(row.product_id)) {
                selected = 'product';
                const id = row.product_id, product = await lookup('products', id);
                guards.push({ table: 'products', id, values: product ? { itinerary_blocks: product.itinerary_blocks ?? null, itinerary_images: product.itinerary_images ?? null } : null });
                if (!product) throw new Error('Selected product missing');
                const blocks = days(product.itinerary_blocks, true);
                for (const block of blocks) {
                    if (['dayInfo','timeline','slide'].includes(block.type)) object(block.content);
                }
                if (product.itinerary_images != null && product.itinerary_images !== '') {
                    const images = decoded(product.itinerary_images);
                    if (!Array.isArray(images) || images.some(image => typeof image !== 'string')) throw new Error('Invalid schedule photographs');
                }
                rawDays = productScheduleDays(product);
                revision = [product.itinerary_blocks ?? null, product.itinerary_images ?? null];
            }
            return { schedule: { source: selected, days: project(rawDays, row.start_date, false, warnings), warnings }, revision: [selected, revision], guards };
        } catch {
            return { schedule: { source: 'unavailable', days: [], warnings: ['고객 일정 원본을 읽지 못했습니다. 기존 배정은 유지되며 고객 일정에서 확인해 주세요.'] },
                revision: ['unavailable', selected, revision, guards], guards };
        }
    };
}

/** External schedule rows participate in the very same conditional assignment UPDATE. */
export function assignmentScheduleCas(guards: AssignmentScheduleGuard[]) {
    const clauses: string[] = [], values: unknown[] = [];
    for (const guard of guards) {
        if (guard.values === null) { clauses.push(`NOT EXISTS (SELECT 1 FROM ${guard.table} WHERE id=?)`); values.push(guard.id); continue; }
        const columns = Object.keys(guard.values);
        clauses.push(`EXISTS (SELECT 1 FROM ${guard.table} WHERE id=? AND ${columns.map(column => `${column} IS ?`).join(' AND ')})`);
        values.push(guard.id, ...columns.map(column => guard.values![column]));
    }
    return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', values };
}
