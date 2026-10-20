import type { AdminWorkspaceData, AdminWorkBooking, AdminWorkInquiry, AdminWorkTask } from '../../src/types/adminWorkspace';
import { isQuoteBooking, summarizeQuoteBooking } from './quoteBookings';
import { toTourDateKey } from '../../src/utils/formatDate';
import { productCustomerHref, quoteCustomerHref, legacyQuoteCustomerHref } from '../../src/utils/customerWorkspaceRoutes.ts';

const str = (v: any) => typeof v === 'string' ? v : '';
const obj = (v: any): any => { try { const p = typeof v === 'string' ? JSON.parse(v) : v; return p && typeof p === 'object' ? p : {}; } catch { return {}; } };
const money = (v: any): number | null => v == null || v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v);
const labels: Record<string, string> = { pending: '입금 대기', pending_payment: '입금 대기', confirmed: '예약 확정', paid: '결제 완료',
    completed: '여행 완료', cancelled: '취소됨', on_hold: '보류', reservation_requested: '예약 요청',
    new: '신규', processing: '작성 중', answered: '답변 완료', converted: '예약 전환' };
const active = (b: AdminWorkBooking) => !['cancelled', 'completed', 'on_hold'].includes(b.status);
const confirmed = (b: AdminWorkBooking) => ['confirmed', 'paid', 'completed'].includes(b.status);
const encode = encodeURIComponent;
/** SQLite CURRENT_TIMESTAMP is UTC; date-only historical records retain their calendar day. */
export function seoulDate(value: any): string {
    const raw = str(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(raw) ? raw.replace(' ', 'T') + 'Z' : raw;
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const part = (type: string) => parts.find(p => p.type === type)?.value || '';
    return `${part('year')}-${part('month')}-${part('day')}`;
}
function productBooking(r: any): AdminWorkBooking {
    const contract = obj(r.contract_data), report = obj(r.deposit_report), breakdown = obj(r.price_breakdown);
    return { id: str(r.id), key: 'product:' + r.id, type: 'product', reservationNumber: str(r.reservation_number),
        customerName: str(r.customer_name), productName: str(r.product_name), email: str(r.customer_email), phone: str(r.customer_phone),
        status: str(r.status), statusLabel: labels[r.status] || str(r.status), totalAmount: money(r.total_price ?? breakdown.total),
        startDate: toTourDateKey(r.start_date), endDate: toTourDateKey(r.end_date), createdAt: str(r.created_at),
        href: productCustomerHref(r.id), depositPaid: r.deposit_status === 'paid',
        depositReported: report.status === 'reported', contractSigned: contract.agreement?.agreed === true };
}

/** Four independent sources: a failed source must never be presented as zero. */
export async function readAdminWorkspace(DB: any, now = new Date()): Promise<AdminWorkspaceData> {
    const queries = [
        'SELECT id, reservation_number, customer_name, customer_email, customer_phone, product_name, status, total_price, price_breakdown, start_date, end_date, created_at, deposit_status, deposit_report, contract_data, assigned_guide, daily_accommodations, admin_operations FROM reservations ORDER BY created_at DESC',
        'SELECT id, received_at, name, phone, destination, status, data FROM requests ORDER BY received_at DESC',
        'SELECT id, name, phone, email, destination, status, created_at FROM quotes ORDER BY created_at DESC',
        'SELECT id, name, category, status FROM products ORDER BY sort_order, created_at DESC',
    ];
    const keys = ['reservations', 'requests', 'quotes', 'products'] as const;
    const names = ['상품 예약', '맞춤 견적', '이전 견적 문의', '상품'];
    const results = await Promise.allSettled(queries.map(async sql => DB.prepare(sql).all()));
    const availability = { reservations: false, requests: false, quotes: false, products: false };
    const warnings: string[] = [];
    const rows = results.map((result, i) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value.results)) { availability[keys[i]] = true; return result.value.results; }
        warnings.push(`${names[i]} 자료를 불러오지 못했습니다. 해당 집계와 검색 결과가 일부 누락될 수 있습니다.`); return [];
    });
    const bookings: AdminWorkBooking[] = rows[0].map(productBooking);
    const inquiries: AdminWorkInquiry[] = [];
    const assignmentReady = new Map<string, boolean>();
    const nightsFor = (b: AdminWorkBooking) => b.startDate && b.endDate ? Math.max(0, Math.round((Date.parse(b.endDate) - Date.parse(b.startDate)) / 86400000)) : 0;
    const lodgesReady = (value: any, nights: number, quote = false) => {
        if (!Array.isArray(value)) return nights === 0;
        const unique = new Set(value.filter(l => l && Number(l.day) >= 1 && Number(l.day) <= nights && str(quote ? l.name : l.accommodation?.name)).map(l => Number(l.day)));
        return unique.size >= nights;
    };
    rows[0].forEach((r: any, index: number) => {
        const guide = obj(r.assigned_guide), ops = obj(r.admin_operations), b = bookings[index];
        assignmentReady.set(b.key, !!str(guide.name) && !!str(ops.vehicle) && lodgesReady(obj(r.daily_accommodations), nightsFor(b)));
    });
    let skipped = 0;
    for (const row of rows[1]) {
        let data: any;
        try { data = JSON.parse(row.data || '{}'); if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error(); }
        catch { skipped++; continue; }
        const rec = { ...data, id: row.id, name: row.name ?? data.name, phone: row.phone ?? data.phone,
            destination: row.destination ?? data.destination, status: row.status || data.status, receivedAt: row.received_at || data.receivedAt };
        if (isQuoteBooking(rec)) {
            const q = summarizeQuoteBooking(rec);
            const b: AdminWorkBooking = { id: q.id, key: 'quote_booking:' + q.id, type: 'quote_booking', reservationNumber: q.reservationNumber,
                customerName: q.customerName, productName: q.productName, email: q.email, phone: q.phone,
                status: q.status, statusLabel: q.quoteBooking.label, totalAmount: money(q.totalAmount), startDate: q.startDate, endDate: q.endDate,
                createdAt: q.createdAt, href: quoteCustomerHref(q.id),
                depositPaid: q.depositStatus === 'paid', depositReported: q.depositReport?.status === 'reported', contractSigned: q.quoteBooking.signed };
            bookings.push(b);
            const assign = rec.booking?.assign || {};
            assignmentReady.set(b.key, !!str(assign.guide?.name) && !!str(assign.vehicle?.name || assign.vehicle?.model || (typeof assign.vehicle === 'string' ? assign.vehicle : ''))
                && lodgesReady(assign.lodges, nightsFor(b), true));
        } else {
            const status = str(rec.status) || '신규';
            inquiries.push({ id: str(row.id), key: 'quote_request:' + row.id, type: 'quote_request', name: str(rec.name), destination: str(rec.destination),
                email: str(rec.email), phone: str(rec.phone), status, statusLabel: status, createdAt: str(rec.receivedAt),
                href: quoteCustomerHref(row.id), pending: ['신규', '작성중', '상담중', '상담 중'].includes(status) });
        }
    }
    if (skipped) { availability.requests = false; warnings.push(`맞춤 견적 ${skipped}건의 자료가 손상되어 읽지 못했습니다. 집계를 확인하세요.`); }
    rows[2].forEach((q: any) => {
        if (q.status === 'converted') return;
        inquiries.push({ id: str(q.id), key: 'legacy_quote:' + q.id, type: 'legacy_quote', name: str(q.name), destination: str(q.destination),
            email: str(q.email), phone: str(q.phone), status: str(q.status), statusLabel: labels[q.status] || str(q.status), createdAt: str(q.created_at),
            href: legacyQuoteCustomerHref(q.id), pending: ['pending', 'new', 'processing', 'reservation_requested'].includes(q.status) });
    });
    const time = (v: string) => { const n = Date.parse(v.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/, '$1T$2Z')); return Number.isFinite(n) ? n : 0; };
    bookings.sort((a, b) => time(b.createdAt) - time(a.createdAt));
    inquiries.sort((a, b) => time(b.createdAt) - time(a.createdAt));
    const products = rows[3].map((p: any) => ({ id: str(p.id), name: str(p.name), category: str(p.category), status: str(p.status), href: '/admin/products?open=' + encode(p.id) }));
    const today = seoulDate(now.toISOString());
    const week = seoulDate(new Date(now.getTime() + 7 * 86400000).toISOString());
    const tasks: AdminWorkTask[] = [];
    const add = (b: AdminWorkBooking, kind: AdminWorkTask['kind'], title: string, description: string, priority: AdminWorkTask['priority'] = 'normal') =>
        tasks.push({ key: kind + ':' + b.key, kind, title, description, href: b.href, createdAt: b.createdAt, priority });
    bookings.filter(active).forEach(b => {
        if (b.depositReported && !b.depositPaid) add(b, 'deposit_report', '예약금 입금 신고 확인', `${b.customerName} · ${b.productName}`, 'urgent');
        if (b.depositPaid && !b.contractSigned) add(b, 'contract', '계약 동의 확인', `${b.customerName} · ${b.productName}`);
        if (confirmed(b) && b.startDate >= today && b.startDate <= week && !assignmentReady.get(b.key))
            add(b, 'assignment', '출발 전 배정 확인', `${b.customerName} · ${b.startDate} · 가이드·차량·숙소`, 'urgent');
    });
    inquiries.filter(i => i.pending).forEach(i => tasks.push({ key: 'quote:' + i.key, kind: 'quote', title: '견적 문의 답변', description: `${i.name} · ${i.destination}`,
        href: i.href, createdAt: i.createdAt, priority: 'normal' }));
    tasks.sort((a, b) => (a.priority === 'urgent' ? 0 : 1) - (b.priority === 'urgent' ? 0 : 1) || time(b.createdAt) - time(a.createdAt));
    const bookingComplete = availability.reservations && availability.requests;
    const sold = bookings.filter(confirmed);
    const metrics = { todayReservations: bookingComplete ? bookings.filter(b => seoulDate(b.createdAt) === today).length : null,
        unpaidReservations: bookingComplete ? bookings.filter(b => active(b) && !b.depositPaid).length : null,
        newQuotes: availability.requests && availability.quotes ? inquiries.filter(i => i.pending).length : null,
        ongoingTours: bookingComplete ? bookings.filter(b => ['confirmed', 'paid'].includes(b.status) && b.startDate && b.endDate && b.startDate <= today && b.endDate >= today).length : null,
        confirmedSales: bookingComplete && sold.every(b => b.totalAmount !== null) ? sold.reduce((total, b) => total + (b.totalAmount ?? 0), 0) : null,
        depositReports: bookingComplete ? bookings.filter(b => active(b) && b.depositReported && !b.depositPaid).length : null };
    if (bookingComplete && sold.some(b => b.totalAmount === null)) warnings.push('금액이 올바르지 않은 확정 예약이 있어 매출 합계를 표시할 수 없습니다.');
    const searchItems = [
        ...bookings.map(b => ({ key: b.key, category: 'reservation' as const, title: b.customerName || '이름 미입력', subtitle: `${b.reservationNumber || b.id} · ${b.productName}`,
            keywords: [b.id, b.reservationNumber, b.customerName, b.productName, b.email, b.phone], href: b.href, statusLabel: b.statusLabel })),
        ...inquiries.map(i => ({ key: i.key, category: 'quote' as const, title: i.name || '이름 미입력', subtitle: i.destination,
            keywords: [i.id, i.name, i.destination, i.email, i.phone], href: i.href, statusLabel: i.statusLabel })),
        ...products.map(p => ({ key: 'product_catalog:' + p.id, category: 'product' as const, title: p.name, subtitle: p.category,
            keywords: [p.id, p.name, p.category], href: p.href, statusLabel: p.status === 'active' ? '판매 중' : p.status === 'soldout' ? '품절' : '비공개' })),
    ];
    return { generatedAt: now.toISOString(), today, bookings, inquiries, products, searchItems, tasks, availability, warnings, metrics };
}
