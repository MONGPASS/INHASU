// requests는 견적 시스템의 정본이다. 목록을 위해 예약을 복제하거나 고객 토큰·서명을 내려보내지 않는다.
import { toTourDateKey } from '../../src/utils/formatDate.ts';

const numberValue = (value: unknown, fallback = 0): number => {
    if (value == null || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
const text = (value: unknown): string => typeof value === 'string' ? value : '';
export type QuoteBookingStatus = 'cancelled' | 'completed' | 'on_hold' | 'confirmed' | 'reservation_requested' | 'pending_payment';

/** public/booking.js의 quoteMoney와 같은 팀 금액 계산. 저장된 계약 금액이 있으면 그 값이 우선한다. */
function quoteAmounts(rec: any) {
    const q = rec.quote || {};
    const price = q.price || {};
    const pax = numberValue(q.pax) || numberValue(rec.adult) + numberValue(rec.child) + numberValue(rec.infant);
    const balances = Array.isArray(price.balances) ? price.balances : [];
    const row = balances.find((b: any) => numberValue(b.pax) === pax)
        || balances.reduce((a: any, b: any) => !a || Math.abs(numberValue(b.pax) - pax) < Math.abs(numberValue(a.pax) - pax) ? b : a, null);
    const full = /풀패키지|최고급|고급/.test(`${rec.pkgTier || ''} ${rec.gerStay || ''}`);
    const deposit = numberValue(price.deposit) * pax;
    const balance = numberValue(row?.[full ? 'full' : 'economy'] ?? row?.amount) * pax;
    return { total: deposit + balance, deposit, balance };
}

/** 기존 견적 예약 목록과 같은 기준: 예약 초안이 생겼거나 최종 예약확정된 요청만 포함. */
export function isQuoteBooking(rec: any): boolean {
    return !!rec && (rec.status === '예약확정' || !!(rec.booking && typeof rec.booking === 'object' && !Array.isArray(rec.booking)));
}

export function summarizeQuoteBooking(rec: any) {
    const booking = rec.booking || {};
    const ci = booking.contractInfo || {};
    const amounts = quoteAmounts(rec);
    const totalAmount = numberValue(ci.totalAmount, amounts.total);
    const deposit = numberValue(ci.depositAmount, amounts.deposit);
    const balance = numberValue(ci.balanceAmount, Math.max(0, totalAmount - deposit));
    const depositPaid = ci.depositStatus === '입금완료' || (!ci.depositStatus && booking.checklist?.deposit === true);
    const balancePaid = ci.balanceStatus === '입금완료' || (!ci.balanceStatus && booking.checklist?.balance === true);
    const cancelled = ['취소', '예약취소', 'cancelled'].includes(rec.status) || rec.progress === '예약취소';
    const completed = rec.status === '완료' || rec.progress === '투어종료';
    const status: QuoteBookingStatus = cancelled ? 'cancelled' : completed ? 'completed' : rec.status === '보류' ? 'on_hold'
        : rec.status === '예약확정' ? 'confirmed' : depositPaid ? 'reservation_requested' : 'pending_payment';
    const signed = !!booking.contract?.signedAt;
    const published = booking.publishStatus === 'published'
        || (booking.publishStatus == null && rec.status === '예약확정'); // 공개 상태 도입 전 데이터 호환
    const label = status === 'cancelled' ? '취소됨' : status === 'completed' ? '여행 완료' : status === 'on_hold' ? '보류'
        : status === 'confirmed' ? '예약 확정' : !depositPaid ? '입금 대기' : !signed ? '계약 서명 대기' : '최종 확정 대기';
    const hint = status === 'confirmed' ? (published ? '일정표 공개됨' : '일정·배정 확인 필요')
        : ['cancelled', 'completed', 'on_hold'].includes(status) ? ''
        : !depositPaid ? (booking.depositReport?.status === 'reported' ? '고객 입금 신고 확인 필요' : '예약금 확인 필요')
        : !signed ? '입금 확인됨 · 고객 서명 확인' : '입금·서명 확인됨';
    const totalPeople = numberValue(rec.adult) + numberValue(rec.child) + numberValue(rec.infant)
        || (Array.isArray(booking.travelers) ? booking.travelers.length : 0) || numberValue(rec.quote?.pax);
    const assign = booking.assign || {};
    const guide = assign.guide;
    const lodges = Array.isArray(assign.lodges) ? assign.lodges : [];
    const flight = booking.flight || {};
    return {
        id: text(rec.id),
        type: 'quote_booking' as const,
        reservationNumber: text(rec.reservationNumber),
        customerName: text(rec.name),
        productName: text(ci.productName) || text(rec.destination) || '맞춤 여행',
        startDate: toTourDateKey(rec.depart || flight.inDate),
        endDate: toTourDateKey(rec.return_ || flight.outDate),
        createdAt: text(booking.confirmedAt) || text(booking.preparedAt) || text(rec.receivedAt),
        status,
        totalAmount, deposit, balance,
        depositStatus: depositPaid ? 'paid' as const : 'unpaid' as const,
        balanceStatus: balancePaid ? 'paid' as const : 'unpaid' as const,
        depositReport: booking.depositReport?.status === 'reported' ? {
            status: 'reported' as const, name: text(booking.depositReport.name), reportedAt: text(booking.depositReport.reportedAt),
        } : null,
        headcount: totalPeople ? `${totalPeople}명` : '미정',
        totalPeople,
        phone: text(rec.phone), email: text(rec.email),
        source: rec.source === 'walkin' ? 'visit' : rec.source === 'course-share' ? 'website' : text(rec.source) || 'website',
        quoteBooking: { label, hint, signed, published, contractRequested: booking.contractRequest?.status === 'requested' },
        assignedGuide: guide?.name ? { id: text(guide.id), name: text(guide.name), phone: text(guide.phone), image: text(guide.photo),
            introduction: '', kakaoId: '', languages: [], specialties: [] } : undefined,
        dailyAccommodations: lodges.filter((l: any) => l?.name).map((l: any, i: number) => ({
            day: numberValue(l.day, i + 1), accommodation: { id: text(l.id), name: text(l.name), type: text(l.grade),
                location: text(l.region), images: [], description: '', facilities: [],
                bookingStatus: text(l.bookingStatus), roomCount: text(l.roomCount), roomType: text(l.roomType) },
        })),
        contractData: { region: text(ci.region),
            vehicle: { type: text(assign.vehicle?.model ?? assign.vehicle?.type), phone: text(assign.vehicle?.phone ?? assign.vehicle?.driverPhone) },
            arrival: { date: text(flight.inDate), time: text(flight.inTime), flight: text(flight.inNo) },
            departure: { date: text(flight.outDate), time: text(flight.outTime), flight: text(flight.outNo) } },
    };
}

export type QuoteBookingSummary = ReturnType<typeof summarizeQuoteBooking>;

/** 1건의 깨진 JSON이 나머지 예약을 숨기지 않도록 분리하고, 누락 건수는 화면에 알린다. */
export async function readQuoteBookings(DB: any) {
    const { results } = await DB.prepare('SELECT id, received_at, name, phone, destination, status, data FROM requests ORDER BY received_at DESC').all();
    const items: QuoteBookingSummary[] = [];
    let skipped = 0;
    for (const row of results) {
        try {
            const data = JSON.parse(row.data || '{}');
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid record');
            const rec = { ...data, id: row.id, status: row.status || data.status,
                name: row.name ?? data.name, phone: row.phone ?? data.phone, destination: row.destination ?? data.destination,
                receivedAt: row.received_at || data.receivedAt };
            if (isQuoteBooking(rec)) items.push(summarizeQuoteBooking(rec));
        } catch { skipped += 1; }
    }
    return { items, skipped };
}
