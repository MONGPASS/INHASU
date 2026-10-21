export type ReservationListState = {
    searchTerm: string; filterStatus: string; filterPayment: string; filterType: string;
    filterDeparture: string; filterSource: string; sortOrder: string; currentPage: number;
};
export const defaultReservationList: ReservationListState = {
    searchTerm: '', filterStatus: '전체 상태', filterPayment: '전체 결제', filterType: '전체 유형',
    filterDeparture: '', filterSource: '전체 경로', sortOrder: 'recent', currentPage: 1,
};
const typeKeys: Record<string, string> = { product: '일반 상품', quote_booking: '맞춤 견적 예약', legacy_quote: '이전 견적 문의' };
// '확정 대기' and '확정 팀' are the board's status tabs (groups); the rest are single statuses.
const statuses = ['전체 상태', '확정 대기', '확정 팀', '입금 대기', '결제 완료', '예약 확정', '계약 서명 대기', '최종 확정 대기', '취소됨', '보류', '여행 완료', '예약 요청', '견적 발송 완료'];
const sorts = ['recent', 'departure', 'amount'];
const payments = ['전체 결제', '예약금 미입금', '예약금 입금', '잔금 미입금', '잔금 입금'];
export function readReservationList(search: string): ReservationListState {
    const p = new URLSearchParams(search);
    return { searchTerm: (p.get('q') || '').slice(0, 200), filterStatus: statuses.includes(p.get('status') || '') ? p.get('status')! : '전체 상태',
        filterPayment: payments.includes(p.get('payment') || '') ? p.get('payment')! : '전체 결제',
        filterType: typeKeys[p.get('type') || ''] || '전체 유형',
        filterDeparture: /^\d{4}-\d{2}-\d{2}$/.test(p.get('departure') || '') ? p.get('departure')! : '',
        filterSource: (p.get('source') || '전체 경로').slice(0, 60), sortOrder: sorts.includes(p.get('sort') || '') ? p.get('sort')! : 'recent',
        currentPage: Math.max(1, Math.min(100000, Math.floor(Number(p.get('page')) || 1))) };
}
export function reservationListSearch(state: ReservationListState, base = ''): string {
    const p = new URLSearchParams(base);
    ['q', 'status', 'payment', 'type', 'departure', 'source', 'sort', 'page'].forEach(k => p.delete(k));
    if (state.searchTerm) p.set('q', state.searchTerm);
    if (state.filterStatus !== '전체 상태') p.set('status', state.filterStatus);
    if (state.filterPayment !== '전체 결제') p.set('payment', state.filterPayment);
    const type = Object.keys(typeKeys).find(k => typeKeys[k] === state.filterType); if (type) p.set('type', type);
    if (state.filterDeparture) p.set('departure', state.filterDeparture);
    if (state.filterSource !== '전체 경로') p.set('source', state.filterSource);
    if (state.sortOrder !== 'recent') p.set('sort', state.sortOrder);
    if (state.currentPage > 1) p.set('page', String(state.currentPage));
    return p.toString() ? `?${p.toString()}` : '';
}
export function reservationReturnTo(value: string | null | undefined): string {
    try { const u = new URL(value || '', 'https://admin.local');
        return u.origin === 'https://admin.local' && u.pathname === '/admin/reservations' ? u.pathname + u.search : '/admin/reservations?type=quote_booking';
    } catch { return '/admin/reservations?type=quote_booking'; }
}
export const reservationSelectionKey = (row: { id: string; type: string }) => `${row.type}:${row.id}`;
export function reservationExportRows<T extends { id: string; type: string; status: string }>(all: T[], filtered: T[], selected: Set<string>, mode: 'filtered' | 'selected' | 'confirmed') {
    return (mode === 'confirmed' ? all.filter(r => ['confirmed', 'paid'].includes(r.status)) : mode === 'selected' ? all.filter(r => selected.has(reservationSelectionKey(r))) : filtered).filter(r => r.type !== 'quote');
}
