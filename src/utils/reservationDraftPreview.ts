import { buildProductQuote, mergeProductDays } from '../../functions/lib/productItinerary.ts';
import type { ReservationDocContent } from '../components/admin/ReservationDocumentEditor';

export interface ReservationPreviewContext {
    customerName?: string; reservationNumber?: string; travelers?: number;
    totalAmount?: number; depositAmount?: number; balanceAmount?: number;
    included?: string[]; excluded?: string[];
}
export function buildReservationDraftPreview(content: ReservationDocContent, dates: { startDate: string; endDate: string }, context: ReservationPreviewContext = {}) {
    const reservation = { id: 'administrator-local-preview', product_name: content.name, customer_name: context.customerName || '',
        reservation_number: context.reservationNumber || '', travelers: context.travelers || 0,
        start_date: dates.startDate, end_date: dates.endDate, document_content: content,
        total_price: context.totalAmount || 0, deposit_amount: context.depositAmount || 0, balance_amount: context.balanceAmount || 0 };
    return buildProductQuote({ reservation, product: { included: context.included || [], excluded: context.excluded || [] },
        days: mergeProductDays(reservation, null, null), assignmentsVisible: false,
        brand: { company: '몽골리아 은하수', companyEn: 'MONGOLIA MILKY WAY', companyFull: '몽골리아 은하수 현지 여행사' } });
}
const escape = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
/** User-entered clauses are text, never executable HTML or new legal boilerplate. */
export function contractDraftPreviewHtml(content: ReservationDocContent, dates: { startDate: string; endDate: string }, context: ReservationPreviewContext = {}) {
    const contract = content.documentSettings?.contract || {};
    const text = (title: string, value: unknown) => `<section><h2>${escape(title)}</h2><p>${escape(value) || '입력된 내용이 없습니다.'}</p></section>`;
    return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="robots" content="noindex"><link rel="stylesheet" href="/quote-theme.css"><style>body{margin:0;background:#eef4f1;color:#0a1f2e;font:14px/1.8 Pretendard,sans-serif}.page{box-sizing:border-box;max-width:794px;margin:24px auto;background:white;padding:52px;border-radius:20px}header{border-bottom:3px solid #27ab8f;padding-bottom:24px}small{color:#1c8571;font-weight:700}h1{margin:8px 0}h2{font-size:18px;color:#1c8571}section{margin:28px 0;break-inside:avoid}p{white-space:pre-wrap;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse}td,th{border:1px solid #dfe8e3;padding:10px;text-align:left}footer{border-top:1px solid #dfe8e3;padding-top:16px;color:#63756c}@media print{body{background:white}.page{margin:0;max-width:none;padding:24px;border-radius:0}@page{size:A4;margin:14mm}}</style></head><body><article class="page"><header><small>MONGOLIA MILKY WAY · 관리자 초안</small><h1>여행 계약 조건</h1><p>${escape(content.name)}<br>${escape(context.customerName)} · ${escape(dates.startDate)} ~ ${escape(dates.endDate)}</p></header>${text('기본 안내', contract.intro)}${text('지급 방법', contract.paymentMethod)}${text('지급 기한', contract.paymentDeadline)}${text('포함 사항', contract.includedText)}${text('불포함 사항', contract.excludedText)}<section><h2>취소·환불 규정</h2><table><thead><tr><th>기간</th><th>조건</th></tr></thead><tbody>${(contract.cancellationRows || []).map(row => `<tr><td>${escape(row.period)}</td><td>${escape(row.fee)}</td></tr>`).join('')}</tbody></table></section>${text('서명 안내', contract.signatureNote)}<footer>저장 전 관리자 미리보기입니다. 고객 공개·발송·계약 동의가 이루어지지 않습니다.</footer></article></body></html>`;
}
