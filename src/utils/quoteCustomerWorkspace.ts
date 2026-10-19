import type { CustomerWorkspaceOverviewModel } from '../components/admin/CustomerWorkspaceOverview';
import { isQuoteBooking, summarizeQuoteBooking } from '../../functions/lib/quoteBookings';

const text = (value: unknown): string => typeof value === 'string' ? value : '';
const list = (value: unknown): any[] => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : [];
const amount = (value: unknown): number | null => value == null || value === '' || !['number', 'string'].includes(typeof value) || !Number.isFinite(Number(value)) ? null : Number(value);
const dateStamp = (value: unknown): number | null => {
    const key = text(value).slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
    const stamp = Date.parse(key + 'T00:00:00Z'); return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === key ? stamp : null;
};
export const quoteCustomerIsBooking = (record: any): boolean => isQuoteBooking(record);

export async function loadQuoteCustomerRequest(id: string, token: string, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<any> {
    const response = await fetcher(`/api/requests/${encodeURIComponent(id)}`, { headers: { 'x-admin-token': token }, cache: 'no-store', signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true || !payload.item || typeof payload.item !== 'object' || Array.isArray(payload.item) || String(payload.item.id) !== id) {
        throw new Error(response.status === 404 ? '선택한 견적 문의를 찾을 수 없습니다.' : response.status === 401 ? '관리자 인증을 다시 확인해 주세요.' : '고객 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
    }
    return payload.item;
}

/** Only the selected server request is projected. Names never identify or merge customers. */
export function quoteCustomerWorkspaceModel(record: any): CustomerWorkspaceOverviewModel {
    const booked = isQuoteBooking(record), booking = booked ? record.booking || {} : {};
    const summary = summarizeQuoteBooking(record), ci = booking.contractInfo || {}, quote = record.quote;
    const days = Array.isArray(booking.days) ? list(booking.days) : list(quote?.days);
    const accepted = record.decision?.status === 'accepted' || record.status === '예약확정';
    const published = booked && summary.quoteBooking.published;
    const pax = amount(quote?.pax) || summary.totalPeople, price = quote?.price || {};
    const balances = list(price.balances), balanceRow = balances.find(row => Number(row.pax) === pax) || balances.reduce((best: any, row: any) => !best || Math.abs(Number(row.pax) - pax) < Math.abs(Number(best.pax) - pax) ? row : best, null);
    const full = /풀패키지|최고급|고급/.test(`${record.pkgTier || ''} ${record.gerStay || ''}`);
    const perDeposit = amount(price.deposit), perBalance = amount(balanceRow?.[full ? 'full' : 'economy'] ?? balanceRow?.amount);
    const deposit = amount(ci.depositAmount) ?? (perDeposit !== null && pax > 0 ? perDeposit * pax : null);
    const contractTotal = amount(ci.totalAmount);
    const balance = amount(ci.balanceAmount) ?? (contractTotal !== null && deposit !== null ? Math.max(0, contractTotal - deposit) : perBalance !== null && pax > 0 ? perBalance * pax : null);
    const total = contractTotal ?? (deposit !== null && balance !== null ? deposit + balance : null);
    const quoted = !!(quote && typeof quote === 'object' && !Array.isArray(quote));
    const sent = list(record.activities).some(row => ['quote_notification_queued', 'quote_sent'].includes(text(row.type)));
    const cancelled = /취소|cancelled/i.test(text(record.status));
    const scheduleReady = days.some(day => text(day.dest).trim() || text(day.title).trim() || (Array.isArray(day.items) ? strings(day.items).length : list(day.activities).some(activity => text(activity.title).trim() || text(activity.description).trim())));
    const start = dateStamp(record.depart), end = dateStamp(record.return_);
    const lodgeNeeded = start !== null && end !== null && end >= start ? Math.round((end - start) / 86400000) : Math.max(0, days.length - 1);
    const lodges = list(booking.assign?.lodges).filter(row => text(row.name).trim() && Number.isInteger(Number(row.day)) && Number(row.day) >= 1 && Number(row.day) <= lodgeNeeded);
    const lodgeCount = new Set(lodges.map(row => Number(row.day))).size;
    const lodgingKnown = lodgeNeeded > 0 || start !== null && end === start;
    const assignments: CustomerWorkspaceOverviewModel['assignments'] = [
        { id: 'guide', label: '가이드', value: text(booking.assign?.guide?.name) || '미배정', state: booking.assign?.guide?.name ? 'ready' : 'pending', statusLabel: booked ? (booking.assign?.guide?.name ? '배정됨' : '배정 필요') : '예약 진행 후 배정' },
        { id: 'vehicle', label: '차량', value: text(booking.assign?.vehicle?.model) || text(booking.assign?.vehicle?.type) || '미배정', state: booking.assign?.vehicle?.model || booking.assign?.vehicle?.type ? 'ready' : 'pending', statusLabel: booked ? (booking.assign?.vehicle?.model || booking.assign?.vehicle?.type ? '배정됨' : '배정 필요') : '예약 진행 후 배정' },
        { id: 'stay', label: '숙소', value: lodges.map(row => `${Number(row.day)}일차 ${row.name}`).join(' · ') || (booked && lodgingKnown && lodgeNeeded === 0 ? '당일 투어' : '미배정'), state: booked && lodgingKnown && lodgeCount >= lodgeNeeded ? 'ready' : 'pending', statusLabel: booked ? lodgingKnown ? lodgeNeeded ? `${lodgeCount}/${lodgeNeeded}박 배정` : '숙박 불필요' : '여행 기간 확인 필요' : '예약 진행 후 배정' },
    ];
    const steps = booked ? [
        { id: 'accepted', label: '예약 접수', done: accepted },
        { id: 'deposit', label: '예약금 확인', done: summary.depositStatus === 'paid' },
        { id: 'contract', label: '계약 동의', done: summary.quoteBooking.signed },
        { id: 'schedule', label: '일정 준비', done: scheduleReady },
        { id: 'published', label: '일정표 공개', done: published },
    ] : [
        { id: 'inquiry', label: '문의 접수', done: true },
        { id: 'quote', label: '견적 작성', done: quoted },
        { id: 'sent', label: '견적 안내 요청', done: sent },
        { id: 'accepted', label: '예약 진행 의사', done: accepted },
    ];
    const current = steps.findIndex(step => !step.done);
    const notes = [
        { id: 'inquiry-memo', body: text(record.memo), author: '상담 메모' },
        { id: 'booking-notes', body: text(booking.notes), author: '예약 참고 메모' },
        { id: 'booking-admin-memo', body: text(booking.adminMemo), author: '예약 내부 메모' },
    ].filter(row => row.body.trim());
    const taskActions: Record<string, string> = { accepted: 'edit-info', deposit: 'payments', contract: 'contract', schedule: 'edit-itinerary', published: 'send-itinerary', quote: 'edit-itinerary', sent: 'quote-share' };
    return {
        customerName: text(record.name) || text(quote?.customer) || '이름 미입력', sourceLabel: booked ? '맞춤 견적 예약' : '맞춤 견적 문의',
        bookingNumber: text(record.reservationNumber) || text(record.id), statusLabel: booked ? summary.quoteBooking.label : text(record.status) || '신규 문의',
        period: [text(record.depart), text(record.return_)].filter(Boolean).join(' ~ ') || text(quote?.period) || '여행 기간 미정',
        partyLabel: summary.totalPeople ? `${summary.totalPeople}명` : '인원 미정',
        facts: [
            { label: '연락처', value: text(record.phone) || '미입력' }, { label: '이메일', value: text(record.email) || '미입력' },
            ...(record.kakaoId ? [{ label: '카카오 ID', value: text(record.kakaoId) }] : []),
            { label: '희망 여행', value: text(record.destination) || '미정' }, { label: '여행 유형', value: text(record.tripType) || '미정' },
            ...(record.request ? [{ label: '고객 요청', value: text(record.request) }] : []),
        ],
        preferences: [...strings(record.travelStyles), ...strings(record.destSpots), ...[text(record.cityStay || record.stay), text(record.gerStay), text(record.vehicle)].filter(Boolean)],
        notes,
        days: days.map((day, index) => ({ id: `${record.id}:day:${index}`, day: index + 1, title: text(day.dest) || text(day.title) || `${index + 1}일차`, date: text(day.date),
            summary: Array.isArray(day.items) ? strings(day.items).join('\n') : text(day.summary) || list(day.activities).map(activity => [text(activity.time), text(activity.title)].filter(Boolean).join(' ')).join('\n'),
            image: text(day.img) || text(day.images?.[0]) || undefined })),
        documents: [
            { id: 'quote', label: '견적서', detail: quoted ? '기존 견적서 디자인으로 확인·수정합니다' : '아직 작성된 견적서가 없습니다', status: quoted ? (sent ? '발송 요청 기록 있음' : '저장됨') : '작성 필요', action: quoted ? 'quote-preview' : 'edit-itinerary' },
            { id: 'itinerary', label: '확정 일정표', detail: booked ? (published ? '고객에게 공개된 일정표' : '저장·배정 확인 후 공개합니다') : '예약 진행 후 준비합니다', status: published ? '공개됨' : booked && days.length ? '준비 중' : '대기', action: published ? 'itinerary-preview' : 'edit-itinerary' },
            { id: 'contract', label: '계약서', detail: summary.quoteBooking.signed ? '고객 실제 서명 확인됨' : booked ? '예약금 확인 후 계약 요청' : '예약 진행 후 작성합니다', status: summary.quoteBooking.signed ? '동의 완료' : booking.contractRequest?.status === 'requested' ? '요청됨' : '대기', action: 'contract' },
        ],
        payment: { total, deposit, balance,
            depositPaid: booked ? summary.depositStatus === 'paid' : null, balancePaid: booked ? summary.balanceStatus === 'paid' : null },
        assignments, steps: steps.map((step, index) => ({ ...step, current: index === current })),
        tasks: cancelled ? [] : steps.filter(step => !step.done).map(step => ({ id: step.id, label: step.label, action: taskActions[step.id] || 'edit-info' })),
        customerLinkAvailable: !!text(record.token), canSendItinerary: booked && !cancelled,
    };
}
