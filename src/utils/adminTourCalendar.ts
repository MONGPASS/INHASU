import { toTourDateKey } from './formatDate.ts';
import { assignmentRecord, readProductVehicle } from './reservationAssignment.ts';
import { productSignatureStatus } from './productContractSignature.ts';

export type CalendarTourSource = 'product' | 'quote_booking' | 'legacy_quote';
export type CalendarPaymentState = 'paid' | 'unpaid' | 'unknown';
export interface CalendarIssue { id: string; label: string; kind: 'assignment' | 'payment' | 'document' | 'waiting' | 'unknown' }
export interface CalendarResource { id: string; name: string; phone: string }
export interface CalendarTour {
    key: string; id: string; source: CalendarTourSource; label: string;
    reservationNumber: string; productName: string; customerName: string;
    startDate: string; endDate: string; days: number; nights: number;
    status: string; statusLabel: string; people: number | null; phone: string; email: string;
    total: number | null; deposit: number | null; balance: number | null;
    depositStatus: CalendarPaymentState; balanceStatus: CalendarPaymentState; paymentLabel: string;
    guide: CalendarResource | null; vehicle: CalendarResource | null;
    stays: { assigned: number; expected: number; missingDays: number[]; namesByDay: Record<number, string>; state: 'ready' | 'missing' | 'unknown' };
    contract: 'signed' | 'waiting' | 'unknown'; publication: 'published' | 'draft' | 'unknown';
    depositReported: boolean; dateSource: 'confirmed' | 'requested'; issues: CalendarIssue[];
}
export interface CalendarConflict { resource: 'guide' | 'vehicle'; resourceId: string; name: string; tourKeys: string[] }

const DAY = 86_400_000;
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const first = (...values: unknown[]) => values.find(value => value !== null && value !== undefined);
const number = (value: unknown): number | null => {
    if (value === null || value === undefined || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};
const people = (value: unknown): number | null => {
    const direct = number(value);
    if (direct !== null) return Number.isInteger(direct) ? direct : null;
    const raw = text(value);
    if (/^\d+\s*명$/.test(raw)) return Number.parseInt(raw, 10);
    // Some old quotes store "성인 2명 / 아동 1명" rather than a numeric total.
    const parts = [...raw.matchAll(/(?:성인|어린이|아동|소아|유아)\s*(\d+)\s*명/g)];
    return parts.length ? parts.reduce((sum, part) => sum + Number(part[1]), 0) : null;
};
const parse = (value: unknown): unknown => {
    let parsed = value;
    for (let i = 0; i < 3 && typeof parsed === 'string'; i++) { try { parsed = JSON.parse(parsed); } catch { return undefined; } }
    return parsed;
};
const dateParts = (year: number, month: number, day: number): string => {
    if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31) return '';
    const candidate = new Date(Date.UTC(year, month - 1, day));
    return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day
        ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
};

/** Stored tour dates use UTC+9; dotted dates and one-digit months are validated before normalizing. */
export function calendarDateKey(value: unknown): string {
    if (value instanceof Date) return Number.isFinite(value.getTime()) ? toTourDateKey(value) : '';
    const raw = text(value);
    if (!raw) return '';
    const plain = raw.match(/^(\d{4})\s*[-/.]\s*(\d{1,2})\s*[-/.]\s*(\d{1,2})\.?$/);
    if (plain) return dateParts(Number(plain[1]), Number(plain[2]), Number(plain[3]));
    const timestamp = raw.match(/^(\d{4})-(\d{2})-(\d{2})[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?$/);
    if (!timestamp || !dateParts(Number(timestamp[1]), Number(timestamp[2]), Number(timestamp[3])) || !Number.isFinite(Date.parse(raw))) return '';
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(raw)) return dateParts(Number(timestamp[1]), Number(timestamp[2]), Number(timestamp[3]));
    return toTourDateKey(raw);
}
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY;
const range = (start: unknown, end: unknown): { startDate: string; endDate: string; days: number; nights: number } | null => {
    const startDate = calendarDateKey(start);
    if (!startDate) return null;
    const endDate = calendarDateKey(end);
    if (!endDate || endDate < startDate) return null;
    const nights = dayNumber(endDate) - dayNumber(startDate);
    // Broken multi-year dates must not create thousands of lodging rows or calendar pills.
    if (nights > 366) return null;
    return { startDate, endDate, days: nights + 1, nights };
};
const periodRange = (value: unknown): [string, string] => {
    const matches = text(value).match(/\d{4}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,2}/g) || [];
    return [matches[0] || '', matches[1] || matches[0] || ''];
};
const statusLabel: Record<string, string> = {
    pending_payment: '입금 대기', paid: '결제 완료', confirmed: '예약 확정', reservation_requested: '예약 요청',
    completed: '여행 완료', on_hold: '보류', new: '신규 문의', processing: '견적 작성 중', answered: '견적 전달', converted: '예약 전환',
};
const cancelled = (status: string) => ['cancelled', 'canceled', '취소', '예약취소'].includes(status.toLowerCase());
const payment = (value: unknown): CalendarPaymentState => {
    if (['paid', '입금완료', '결제완료'].includes(text(value))) return 'paid';
    if (['unpaid', 'pending', '미입금', '입금대기'].includes(text(value))) return 'unpaid';
    return 'unknown';
};
const resource = (value: unknown, fallbackName = '', fallbackPhone = ''): CalendarResource | null => {
    const data = assignmentRecord(value);
    const id = text(first(data.id, data.guideId, data.vehicleId));
    const name = text(first(data.name, data.model, data.type)) || fallbackName;
    const phone = text(first(data.phone, data.driverPhone)) || fallbackPhone;
    return id || name ? { id, name: name || '이름 확인 필요', phone } : null;
};
function staysFor(raw: unknown, dates: NonNullable<ReturnType<typeof range>>): CalendarTour['stays'] {
    const parsed = parse(raw), rows = Array.isArray(parsed) ? parsed : [];
    const namesByDay: Record<number, string> = {};
    for (const row of rows) {
        const entry = assignmentRecord(row), stay = assignmentRecord(entry.accommodation);
        const assignedDate = text(entry.date);
        const normalizedDate = calendarDateKey(assignedDate);
        const day = assignedDate ? normalizedDate ? dayNumber(normalizedDate) - dayNumber(dates.startDate) + 1 : NaN : Number(entry.day);
        if (!Number.isInteger(day) || day < 1 || day > dates.nights) continue;
        const name = text(first(stay.name, entry.name));
        // Duplicate days never count as multiple nights, and an explicit clear wins.
        if (name && !cancelled(text(first(stay.bookingStatus, entry.bookingStatus)))) namesByDay[day] = name;
        else delete namesByDay[day];
    }
    const missingDays = Array.from({ length: dates.nights }, (_, index) => index + 1).filter(day => !namesByDay[day]);
    return { assigned: Object.keys(namesByDay).length, expected: dates.nights, missingDays, namesByDay,
        state: dates.nights === 0 || missingDays.length === 0 ? 'ready' : Array.isArray(parsed) ? 'missing' : 'unknown' };
}
function issuesFor(tour: CalendarTour): CalendarIssue[] {
    if (tour.status === 'completed') return [];
    if (tour.status === 'on_hold') return [{ id: 'hold', label: '예약 보류', kind: 'waiting' }];
    if (tour.source === 'legacy_quote') {
        return [{ id: 'quote', label: tour.status === 'answered' ? '고객 견적 확인 대기' : tour.status === 'reservation_requested' ? '예약 전환 확인' : '견적 문의 확인', kind: tour.status === 'answered' ? 'waiting' : 'document' }];
    }
    const issues: CalendarIssue[] = [];
    if (tour.depositReported && tour.depositStatus !== 'paid') issues.push({ id: 'deposit_report', label: '고객 입금 신고 확인', kind: 'payment' });
    else if (tour.depositStatus === 'unpaid') issues.push({ id: 'deposit_wait', label: '예약금 입금 대기', kind: 'waiting' });
    else if (tour.depositStatus === 'unknown') issues.push({ id: 'deposit_unknown', label: '예약금 상태 확인', kind: 'unknown' });
    if (!tour.guide) issues.push({ id: 'guide', label: '가이드 미배정', kind: 'assignment' });
    if (!tour.vehicle) issues.push({ id: 'vehicle', label: '차량 미배정', kind: 'assignment' });
    if (tour.stays.state !== 'ready') issues.push({ id: 'stays', label: tour.stays.state === 'unknown' ? '숙소 배정 정보 확인' : `숙소 ${tour.stays.missingDays.length}박 미배정`, kind: tour.stays.state === 'unknown' ? 'unknown' : 'assignment' });
    if (tour.contract === 'waiting') issues.push({ id: 'contract', label: '고객 계약 동의 대기', kind: 'waiting' });
    else if (tour.contract === 'unknown') issues.push({ id: 'contract_unknown', label: '계약 동의 상태 확인', kind: 'unknown' });
    if (tour.publication === 'draft') issues.push({ id: 'publication', label: '일정표 공개 전', kind: 'document' });
    else if (tour.publication === 'unknown') issues.push({ id: 'publication_unknown', label: '일정표 공개 상태 확인', kind: 'unknown' });
    const priority: Record<CalendarIssue['kind'], number> = { payment: 0, assignment: 1, document: 2, unknown: 3, waiting: 4 };
    return issues.sort((a, b) => priority[a.kind] - priority[b.kind]);
}
function adapt(raw: unknown, source: CalendarTourSource): CalendarTour | null {
    const row = assignmentRecord(raw), id = text(row.id), status = text(row.status);
    if (!id || cancelled(status) || (source === 'legacy_quote' && status === 'converted')) return null;
    const requested = periodRange(row.period);
    const confirmedStart = first(row.confirmedStartDate, row.confirmed_start_date);
    const dates = source === 'legacy_quote'
        ? range(confirmedStart || requested[0], first(row.confirmedEndDate, row.confirmed_end_date) || requested[1])
        : range(first(row.startDate, row.start_date, row.date), first(row.endDate, row.end_date));
    if (!dates) return null;
    const contractData = assignmentRecord(first(row.contractData, row.contract_data));
    const operations = assignmentRecord(first(row.adminOperations, row.admin_operations));
    const quoteBooking = assignmentRecord(row.quoteBooking), customer = assignmentRecord(row.customer_info);
    const price = assignmentRecord(first(row.priceBreakdown, row.price_breakdown));
    const total = number(source === 'legacy_quote' ? first(row.confirmedPrice, row.confirmed_price) : first(row.totalPrice, row.total_price, row.totalAmount, row.total_amount, price.total));
    const deposit = number(first(row.depositAmount, row.deposit_amount, row.deposit, price.deposit));
    const savedBalance = number(first(row.balanceAmount, row.balance_amount, row.balance, price.local));
    const balance = savedBalance ?? (total !== null && deposit !== null ? Math.max(0, total - deposit) : null);
    const depositStatus = payment(first(row.depositStatus, row.deposit_status)), balanceStatus = payment(first(row.balanceStatus, row.balance_status));
    const guide = resource(first(row.assignedGuide, row.assigned_guide));
    const vehicleDetails = readProductVehicle(operations, contractData);
    const savedVehicle = assignmentRecord(contractData.vehicle);
    // Operations has precedence, including an explicit empty string that clears the old vehicle.
    const vehicle = own(operations, 'vehicle') && !vehicleDetails.type ? null
        : resource({ id: own(operations, 'vehicle') && vehicleDetails.type !== text(first(savedVehicle.type, savedVehicle.model, savedVehicle.name)) ? '' : text(first(savedVehicle.id, operations.vehicleId)),
            name: vehicleDetails.type, phone: vehicleDetails.phone });
    const agreement = assignmentRecord(contractData.agreement), signature = productSignatureStatus(contractData);
    const signed = source === 'quote_booking' ? quoteBooking.signed === true : agreement.agreed === true
        || (!!signature?.signedAt && signature.hasImage);
    const sent = quoteBooking.contractRequested === true || own(agreement, 'agreed') || !!text(first(row.contractSentAt, row.contract_sent_at, contractData.contractSentAt));
    const contract: CalendarTour['contract'] = signed ? 'signed' : sent || quoteBooking.signed === false ? 'waiting' : 'unknown';
    const publishedValue = first(quoteBooking.published, row.itineraryPublished, row.itinerary_published);
    const itineraryUrl = text(first(row.itineraryUrl, row.itinerary_url));
    // Match productItineraryPublished without pulling document-building code into the calendar.
    const published = source === 'product' ? ['confirmed', 'paid', 'completed'].includes(status) && !!itineraryUrl : publishedValue === true || !!itineraryUrl;
    const publication: CalendarTour['publication'] = published ? 'published'
        : publishedValue === false || ['draft', 'unpublished'].includes(text(first(row.publishStatus, row.publish_status))) || source === 'product' && !!itineraryUrl ? 'draft' : 'unknown';
    const report = assignmentRecord(first(row.depositReport, row.deposit_report));
    const label = source === 'product' ? '상품 예약' : source === 'quote_booking' ? '견적 예약' : '이전 견적 문의';
    const tour: CalendarTour = {
        key: `${source}:${id}`, id, source, label, reservationNumber: text(first(row.reservationNumber, row.reservation_number)),
        customerName: text(first(row.customerName, row.customer_name, row.name, customer.name)) || '고객명 확인 필요',
        productName: text(first(row.productName, row.product_name)) || (source === 'legacy_quote' ? `${text(row.destination) || '맞춤 여행'} 맞춤 견적` : '상품명 확인 필요'),
        ...dates, status, statusLabel: statusLabel[status] || status || '상태 확인 필요',
        people: people(first(row.travelers, row.totalPeople, row.total_people, row.headcount)),
        total, deposit, balance, depositStatus, balanceStatus,
        paymentLabel: depositStatus === 'paid' ? balanceStatus === 'paid' ? '입금 완료' : '예약금 확인' : report.status === 'reported' ? '입금 신고 접수' : depositStatus === 'unpaid' ? '입금 대기' : '입금 상태 확인',
        guide, vehicle, stays: staysFor(first(row.dailyAccommodations, row.daily_accommodations), dates),
        contract, publication, depositReported: report.status === 'reported',
        phone: text(first(row.phone, row.customerPhone, row.customer_phone, customer.phone)),
        email: text(first(row.email, row.customerEmail, row.customer_email, customer.email)),
        dateSource: source === 'legacy_quote' && !confirmedStart ? 'requested' : 'confirmed', issues: [],
    };
    tour.issues = issuesFor(tour);
    return tour;
}

export function productCalendarTours(rows: readonly unknown[]): CalendarTour[] { return rows.map(row => adapt(row, 'product')).filter((row): row is CalendarTour => row !== null); }
export function quoteBookingCalendarTours(rows: readonly unknown[]): CalendarTour[] { return rows.map(row => adapt(row, 'quote_booking')).filter((row): row is CalendarTour => row !== null); }
export function legacyQuoteCalendarTours(rows: readonly unknown[]): CalendarTour[] { return rows.map(row => adapt(row, 'legacy_quote')).filter((row): row is CalendarTour => row !== null); }
export function adaptCalendarTours(input: { reservations?: readonly unknown[]; bookings?: readonly unknown[]; quotes?: readonly unknown[] }): CalendarTour[] {
    const rows = [...productCalendarTours(input.reservations || []), ...quoteBookingCalendarTours(input.bookings || []), ...legacyQuoteCalendarTours(input.quotes || [])];
    return [...new Map(rows.map(row => [row.key, row])).values()].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.customerName.localeCompare(b.customerName, 'ko-KR') || a.key.localeCompare(b.key));
}

export function toursOnDate(items: readonly CalendarTour[], date: string): CalendarTour[] {
    const key = calendarDateKey(date);
    return key ? items.filter(item => item.startDate <= key && item.endDate >= key) : [];
}
export function toursInMonth(items: readonly CalendarTour[], month: Date): CalendarTour[] {
    if (!Number.isFinite(month.getTime())) return [];
    const firstDate = dateParts(month.getFullYear(), month.getMonth() + 1, 1);
    const lastDate = dateParts(month.getFullYear(), month.getMonth() + 1, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate());
    return items.filter(item => item.startDate <= lastDate && item.endDate >= firstDate);
}
/** Always six Sunday-first weeks so crowded dates never change the calendar's row heights. */
export function calendarMonthDays(month: Date): Array<{ dateKey: string; day: number; inMonth: boolean }> {
    if (!Number.isFinite(month.getTime())) return [];
    const firstDate = new Date(Date.UTC(month.getFullYear(), month.getMonth(), 1));
    firstDate.setUTCDate(1 - firstDate.getUTCDay());
    return Array.from({ length: 42 }, (_, index) => {
        const date = new Date(firstDate.getTime() + index * DAY);
        return { dateKey: dateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()), day: date.getUTCDate(), inMonth: date.getUTCMonth() === month.getMonth() && date.getUTCFullYear() === month.getFullYear() };
    });
}

/** Only stable stored resource IDs establish conflicts; matching names or vehicle models do not. */
export function calendarConflicts(items: readonly CalendarTour[]): CalendarConflict[] {
    const conflicts = new Map<string, CalendarConflict>();
    const active = items.filter(item => item.source !== 'legacy_quote' && !['on_hold', 'completed'].includes(item.status));
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
        const a = active[i], b = active[j];
        if (a.key === b.key || a.startDate > b.endDate || b.startDate > a.endDate) continue;
        for (const kind of ['guide', 'vehicle'] as const) {
            const left = a[kind], right = b[kind];
            if (!left?.id || !right?.id || left.id !== right.id) continue;
            const group = `${kind}:${left.id}`, existing = conflicts.get(group);
            if (existing) existing.tourKeys = [...new Set([...existing.tourKeys, a.key, b.key])];
            else conflicts.set(group, { resource: kind, resourceId: left.id, name: left.name, tourKeys: [a.key, b.key] });
        }
    }
    return [...conflicts.values()];
}
/** Detect overlaps inside the displayed window, not merely on tours that touch it. */
export function calendarConflictsInRange(items: readonly CalendarTour[], start: string, end: string): CalendarConflict[] {
    const startDate = calendarDateKey(start), endDate = calendarDateKey(end);
    if (!startDate || !endDate || endDate < startDate) return [];
    const clipped = items.filter(item => item.startDate <= endDate && item.endDate >= startDate)
        .map(item => ({ ...item, startDate: item.startDate < startDate ? startDate : item.startDate, endDate: item.endDate > endDate ? endDate : item.endDate }));
    return calendarConflicts(clipped);
}
export function calendarStats(items: readonly CalendarTour[]) {
    const tours = items.filter(item => item.source !== 'legacy_quote' && item.status !== 'on_hold');
    return { tours: tours.length, people: tours.reduce((sum, item) => sum + (item.people ?? 0), 0), unknownPeople: tours.filter(item => item.people === null).length,
        attention: tours.filter(item => item.issues.some(issue => issue.kind !== 'waiting')).length,
        inquiries: items.filter(item => item.source === 'legacy_quote').length, conflicts: calendarConflicts(items).length };
}
export function calendarTourDay(tour: CalendarTour, date: string): { day: number; totalDays: number; night: number | null; stay: string | null } | null {
    const key = calendarDateKey(date);
    if (!key || key < tour.startDate || key > tour.endDate) return null;
    const day = dayNumber(key) - dayNumber(tour.startDate) + 1;
    return { day, totalDays: tour.days, night: day <= tour.nights ? day : null, stay: tour.stays.namesByDay[day] || null };
}
export function filterCalendarTours(items: readonly CalendarTour[], filter: { query?: string; source?: CalendarTourSource | 'all'; attentionOnly?: boolean }): CalendarTour[] {
    const query = (filter.query || '').trim().toLocaleLowerCase();
    return items.filter(item => (!filter.source || filter.source === 'all' || item.source === filter.source)
        && (!filter.attentionOnly || item.issues.some(issue => issue.kind !== 'waiting'))
        && (!query || [item.customerName, item.productName, item.reservationNumber, item.phone, item.email, item.guide?.name, item.vehicle?.name].some(value => value?.toLocaleLowerCase().includes(query))));
}
