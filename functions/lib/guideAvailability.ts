import { assignmentRecord } from '../../src/utils/reservationAssignment.ts';
import { guideOverlaps, sameGuide } from '../../src/utils/assignmentAvailability.ts';
import { toTourDateKey } from '../../src/utils/formatDate.ts';
import { isQuoteBooking, summarizeQuoteBooking } from './quoteBookings.ts';

const text = (value: unknown) => typeof value === 'string' ? value : '';
const parse = (value: unknown) => { try { return typeof value === 'string' ? JSON.parse(value) : value; } catch { return null; } };

/**
 * 가이드 중복 확인용으로 모든 예약(상품·견적)의 가이드·기간·상태만 읽는다.
 * 고객 연락처·여권·토큰은 읽거나 돌려주지 않는다.
 */
export async function readGuideBookings(db: any) {
    const rows: Array<{ id: string; source: 'product' | 'quote_booking'; status: string; startDate: string; endDate: string; customerName: string; assignment: { guide: { id: string; name: string } } }> = [];
    const [products, quotes] = await Promise.allSettled([
        Promise.resolve().then(() => db.prepare('SELECT id, status, start_date, end_date, customer_name, assigned_guide FROM reservations').all()),
        Promise.resolve().then(() => db.prepare('SELECT id, status, data FROM requests').all()),
    ]);
    if (products.status === 'fulfilled') for (const row of products.value.results || []) {
        const guide = assignmentRecord(parse(row.assigned_guide));
        if (!text(guide.id) && !text(guide.name).trim()) continue;
        rows.push({ id: String(row.id), source: 'product', status: text(row.status), startDate: toTourDateKey(row.start_date), endDate: toTourDateKey(row.end_date),
            customerName: text(row.customer_name), assignment: { guide: { id: text(guide.id), name: text(guide.name) } } });
    }
    if (quotes.status === 'fulfilled') for (const row of quotes.value.results || []) {
        const data = assignmentRecord(parse(row.data));
        const rec = { ...data, id: row.id, status: row.status };
        if (!Object.keys(data).length || !isQuoteBooking(rec)) continue;
        const guide = assignmentRecord(assignmentRecord(assignmentRecord(rec.booking).assign).guide);
        if (!text(guide.id) && !text(guide.name).trim()) continue;
        const summary = summarizeQuoteBooking(rec);
        rows.push({ id: String(row.id), source: 'quote_booking', status: text(summary.status), startDate: toTourDateKey(summary.startDate), endDate: toTourDateKey(summary.endDate),
            customerName: text(summary.customerName), assignment: { guide: { id: text(guide.id), name: text(guide.name) } } });
    }
    return { rows, complete: products.status === 'fulfilled' && quotes.status === 'fulfilled' };
}

/**
 * 가이드를 새로 배정하거나 바꿀 때만 확인한다(같은 가이드로 숙소만 저장하는 경우는 그대로 둔다).
 * 같은 날을 함께 쓰는 예약이 있으면 그 목록을 돌려준다. 끝나는 날·시작하는 날만 겹치는 교대는 막지 않는다.
 */
export async function guideConflictsOnChange(db: any, current: { id: string; source: 'product' | 'quote_booking'; startDate?: string; endDate?: string },
    previous: { id?: string; name?: string }, next: { id?: string; name?: string }) {
    if (!text(next.id) && !text(next.name).trim()) return [];
    if (sameGuide(previous, next)) return [];
    const { rows } = await readGuideBookings(db);
    return guideOverlaps(rows, next, current).filter(item => item.kind === 'overlap').map(item => item.booking);
}
