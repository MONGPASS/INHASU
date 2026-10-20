import React, { useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Admin3DIcon } from '../components/admin/Admin3DIcon';
import { Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';
import { toTourDateKey } from '../utils/formatDate';
import { productCustomerHref, quoteCustomerHref, legacyQuoteCustomerHref } from '../utils/customerWorkspaceRoutes';

type CalendarItemType = 'reservation' | 'quote' | 'quote_booking';

interface CalendarItem {
    id: string;
    bookingLabel?: string;
    bookingHint?: string;
    itemType: CalendarItemType;
    reservationNumber?: string;
    productName: string;
    customerName: string;
    startDate: string;
    endDate?: string;
    status: string;
    totalAmount: number;
    deposit: number;
    depositStatus: string;
    balance: number;
    balanceStatus: string;
    headcount: string;
    phone: string;
    email: string;
    assignedGuide?: { name?: string; phone?: string; image?: string };
    dailyAccommodations?: unknown[];
    dateSource?: 'confirmed' | 'requested';
    requestedPeriod?: string;
}

const STATUS_LABEL: Record<string, string> = {
    completed: '여행 완료', on_hold: '보류',
    new: '신규 견적',
    processing: '견적 작성 중',
    answered: '견적 발송 완료',
    reservation_requested: '예약 요청',
    converted: '예약 전환 완료',
    pending_payment: '입금 대기',
    paid: '결제 완료',
    confirmed: '예약 확정',
    cancelled: '취소',
};

const normalizeDate = (value: unknown): string => {
    if (!value || typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    // ISO 타임스탬프를 그대로 자르면 출발일이 하루 앞당겨진다 (toTourDateKey 주석 참고).
    if (trimmed.includes('T')) return toTourDateKey(trimmed);
    if (trimmed.includes('.')) return trimmed.replace(/\./g, '-').replace(/\s/g, '');
    return trimmed;
};

const toDateKey = (date: Date): string => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const parseDateRange = (period?: string): { startDate: string; endDate?: string } => {
    if (!period) return { startDate: '' };
    const matches = period.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g) || [];
    const normalized = matches.map(normalizeDate);
    return {
        startDate: normalized[0] || '',
        endDate: normalized[1] || normalized[0] || undefined,
    };
};

const parseMaybeJson = <T,>(value: unknown, fallback: T): T => {
    if (!value) return fallback;
    if (typeof value !== 'string') return value as T;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

const isInMonth = (item: CalendarItem, month: Date) => {
    if (!item.startDate) return false;
    const start = new Date(`${item.startDate}T00:00:00`);
    const end = new Date(`${item.endDate || item.startDate}T00:00:00`);
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    return start <= monthEnd && end >= monthStart;
};

const isOnDate = (item: CalendarItem, dateKey: string) => {
    if (!item.startDate) return false;
    const start = item.startDate;
    const end = item.endDate || item.startDate;
    return start <= dateKey && end >= dateKey;
};

// Calendar pill tone from real assignment/status data:
// quote → amber (needs handling), assigned reservation → blue, unassigned reservation → amber, otherwise green.
const getEventTone = (item: CalendarItem): 'blue' | 'green' | 'amber' => {
    if (item.itemType === 'quote') return 'amber';
    if (item.status === 'pending_payment' || item.depositStatus !== 'paid') return 'amber';
    if (!item.assignedGuide) return 'amber';
    if (item.status === 'confirmed' || item.status === 'paid') return 'blue';
    return 'green';
};

const getNextAction = (item: CalendarItem): { label: string; tone: string; icon: string } => {
    if (item.itemType === 'quote_booking') return { label: item.bookingHint || item.bookingLabel || '견적 예약 관리', tone: item.status === 'confirmed' ? 'b-green' : 'b-amber', icon: 'event_note' };
    if (item.itemType === 'quote') {
        if (item.status === 'new') return { label: '요청 검토', tone: 'b-red', icon: 'fiber_new' };
        if (item.status === 'processing') return { label: '견적 작성', tone: 'b-amber', icon: 'edit_note' };
        if (item.status === 'answered') return { label: '고객 확인 대기', tone: 'b-blue', icon: 'mark_email_read' };
        if (item.status === 'reservation_requested') return { label: '예약 전환', tone: 'b-purple', icon: 'sync_alt' };
        return { label: '견적 관리', tone: 'b-gray', icon: 'request_quote' };
    }

    if (item.status === 'pending_payment' || item.depositStatus !== 'paid') {
        return { label: '입금 확인', tone: 'b-amber', icon: 'payments' };
    }
    if (!item.assignedGuide) {
        return { label: '가이드 배정', tone: 'b-amber', icon: 'person_add' };
    }
    if (!item.dailyAccommodations || item.dailyAccommodations.length === 0) {
        return { label: '숙소 확인', tone: 'b-blue', icon: 'hotel' };
    }
    return { label: '운영 체크', tone: 'b-green', icon: 'task_alt' };
};

const formatRange = (item: CalendarItem) => {
    if (!item.startDate) return '일정 미정';
    return item.endDate && item.endDate !== item.startDate ? `${item.startDate} ~ ${item.endDate}` : item.startDate;
};

const parsePeople = (headcount: string): number => {
    const match = headcount.match(/\d+/);
    return match ? Number(match[0]) : 0;
};

const CalendarDetailModal = ({ item, onClose }: { item: CalendarItem | null; onClose: () => void }) => {
    if (!item) return null;
    const action = getNextAction(item);
    return (
        <div className="picker-scrim" onClick={onClose}>
            <div className="picker" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
                <div className="card-head">
                    <div style={{ minWidth: 0 }}>
                        <div className="row" style={{ gap: 6, marginBottom: 6 }}>
                            <span className={`tag-type ${item.itemType === 'quote' ? 'quote' : 'reservation'}`}>
                                {item.itemType === 'quote_booking' ? '견적 예약' : item.itemType === 'quote' ? '이전 견적 문의' : '상품 예약'}
                            </span>
                            <span className={`badge ${action.tone}`}>{STATUS_LABEL[item.status] || item.status}</span>
                        </div>
                        <h2>{item.productName}</h2>
                        <div className="sub">No. {item.reservationNumber || item.id.slice(0, 8).toUpperCase()}</div>
                    </div>
                    <div className="spacer" />
                    <button className="icon-btn" onClick={onClose} title="닫기" type="button">
                        <Icon name="close" />
                    </button>
                </div>

                <div className="picker-list" style={{ padding: 18 }}>
                    <div className="card card-pad" style={{ marginBottom: 14 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div>
                                <div className="kv" style={{ borderBottom: 'none', padding: 0, display: 'block' }}>
                                    <span style={{ display: 'block', marginBottom: 3 }}>고객</span>
                                    <b>{item.customerName || '미입력'}</b>
                                </div>
                            </div>
                            <div>
                                <div className="kv" style={{ borderBottom: 'none', padding: 0, display: 'block' }}>
                                    <span style={{ display: 'block', marginBottom: 3 }}>연락처</span>
                                    <b>{item.phone || item.email || '미입력'}</b>
                                </div>
                            </div>
                            <div>
                                <div className="kv" style={{ borderBottom: 'none', padding: 0, display: 'block' }}>
                                    <span style={{ display: 'block', marginBottom: 3 }}>일정</span>
                                    <b>{formatRange(item)}</b>
                                </div>
                            </div>
                            <div>
                                <div className="kv" style={{ borderBottom: 'none', padding: 0, display: 'block' }}>
                                    <span style={{ display: 'block', marginBottom: 3 }}>인원</span>
                                    <b>{item.headcount || '미정'}</b>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div className="card card-pad">
                            <div className="cell-muted" style={{ fontSize: 12.5, marginBottom: 6 }}>금액</div>
                            <div className="cell-price" style={{ fontSize: 18 }}>{(item.totalAmount || 0).toLocaleString('ko-KR')}원</div>
                        </div>
                        <div className="card card-pad">
                            <div className="cell-muted" style={{ fontSize: 12.5, marginBottom: 6 }}>다음 처리</div>
                            <div className="row" style={{ gap: 6 }}>
                                <Icon name={action.icon} style={{ fontSize: 18 }} />
                                <span className="cell-strong">{action.label}</span>
                            </div>
                        </div>
                    </div>

                    {item.itemType === 'quote' && (
                        <div className="card card-pad" style={{ marginTop: 14, background: 'var(--mrt-purple-soft)', borderColor: 'transparent' }}>
                            <div className="cell-strong" style={{ color: 'var(--mrt-purple-2)' }}>견적 처리 포인트</div>
                            <p style={{ margin: '6px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--mrt-purple-2)' }}>
                                이 일정은 아직 확정 예약이 아닙니다. 캘린더에서 다른 확정 일정과 겹치는지 확인한 뒤 견적 금액, 안내문, 견적서 링크를 입력하면 됩니다.
                            </p>
                        </div>
                    )}
                </div>

                <div className="drawer-foot">
                    <button className="btn btn-ghost" onClick={onClose} type="button">닫기</button>
                    <div className="spacer" style={{ flex: 1 }} />
                    <a className="btn btn-ink" href={item.itemType === 'quote_booking' ? quoteCustomerHref(item.id, '/admin/calendar') : item.itemType === 'quote' ? legacyQuoteCustomerHref(item.id, '/admin/calendar') : productCustomerHref(item.id, '/admin/calendar')}>
                        <Icon name="open_in_new" />예약 상세로 이동
                    </a>
                </div>
            </div>
        </div>
    );
};

export const AdminCalendar: React.FC = () => {
    const [selectedEvent, setSelectedEvent] = useState<CalendarItem | null>(null);
    const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
    const [items, setItems] = useState<CalendarItem[]>([]);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [isLoading, setIsLoading] = useState(false);
    const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
    const [includeLegacyQuotes, setIncludeLegacyQuotes] = useState(false);

    const fetchCalendarItems = async () => {
        setIsLoading(true);
        try {
            const [reservationSettled, quoteSettled, bookingSettled] = await Promise.allSettled([
                api.reservations.list(),
                api.quotes.list(),
                api.adminBookings.quote(),
            ]);

            const reservationData = reservationSettled.status === 'fulfilled' && Array.isArray(reservationSettled.value)
                ? reservationSettled.value
                : [];
            const quoteData = quoteSettled.status === 'fulfilled' && Array.isArray(quoteSettled.value)
                ? quoteSettled.value
                : [];

            const mappedReservations: CalendarItem[] = reservationData
                .filter((reservation: any) => reservation.status !== 'cancelled')
                .map((reservation: any) => {
                    const totalAmount = reservation.totalAmount || reservation.total_amount || reservation.totalPrice || reservation.price_breakdown?.total || 0;
                    const deposit = reservation.deposit || reservation.depositAmount || reservation.deposit_amount || reservation.price_breakdown?.deposit || 0;
                    const assignedGuide = parseMaybeJson(reservation.assignedGuide || reservation.assigned_guide, undefined);
                    return {
                        id: reservation.id,
                        itemType: 'reservation',
                        reservationNumber: reservation.reservationNumber || reservation.reservation_number,
                        productName: reservation.productName || reservation.product_name || '상품명 없음',
                        customerName: reservation.customerName || reservation.customer_name || reservation.customer_info?.name || '고객명 없음',
                        startDate: normalizeDate(reservation.startDate || reservation.start_date || reservation.date),
                        endDate: normalizeDate(reservation.endDate || reservation.end_date),
                        status: reservation.status || 'pending_payment',
                        totalAmount,
                        deposit,
                        depositStatus: reservation.depositStatus || reservation.deposit_status || (reservation.status === 'pending_payment' ? 'unpaid' : 'paid'),
                        balance: reservation.balance || reservation.balanceAmount || reservation.balance_amount || Math.max(totalAmount - deposit, 0),
                        balanceStatus: reservation.balanceStatus || reservation.balance_status || 'unpaid',
                        headcount: reservation.headcount || (reservation.travelers || reservation.totalPeople || reservation.total_people ? `${reservation.travelers || reservation.totalPeople || reservation.total_people}명` : '인원 미정'),
                        phone: reservation.phone || reservation.customerPhone || reservation.customer_phone || reservation.customer_info?.phone || '',
                        email: reservation.email || reservation.customerEmail || reservation.customer_email || reservation.customer_info?.email || '',
                        assignedGuide,
                        dailyAccommodations: parseMaybeJson(reservation.dailyAccommodations || reservation.daily_accommodations, []),
                        dateSource: 'confirmed',
                    };
                });

            const mappedQuotes: CalendarItem[] = quoteData
                .filter((quote: any) => quote.status !== 'converted' && quote.status !== 'cancelled')
                .map((quote: any) => {
                    const requestedRange = parseDateRange(quote.period);
                    const confirmedStart = normalizeDate(quote.confirmed_start_date || quote.confirmedStartDate);
                    const confirmedEnd = normalizeDate(quote.confirmed_end_date || quote.confirmedEndDate);
                    const startDate = confirmedStart || requestedRange.startDate;
                    const endDate = confirmedEnd || requestedRange.endDate;
                    const confirmedPrice = quote.confirmedPrice || quote.confirmed_price || 0;
                    const deposit = quote.deposit || 0;
                    return {
                        id: quote.id,
                        itemType: 'quote',
                        productName: `${quote.destination || '맞춤 여행'} 맞춤 견적`,
                        customerName: quote.name || '고객명 없음',
                        startDate,
                        endDate,
                        status: quote.status || 'new',
                        totalAmount: confirmedPrice,
                        deposit,
                        depositStatus: quote.deposit_status || quote.depositStatus || 'unpaid',
                        balance: Math.max(confirmedPrice - deposit, 0),
                        balanceStatus: quote.balance_status || quote.balanceStatus || 'unpaid',
                        headcount: quote.headcount || '인원 미정',
                        phone: quote.phone || '',
                        email: quote.email || '',
                        dateSource: confirmedStart ? 'confirmed' : 'requested',
                        requestedPeriod: quote.period,
                    };
                });

            const mappedBookings: CalendarItem[] = bookingSettled.status === 'fulfilled'
                ? bookingSettled.value.items.filter(b => !['cancelled', 'on_hold'].includes(b.status)).map(b => ({
                    ...b, itemType: 'quote_booking', bookingLabel: b.quoteBooking.label, bookingHint: b.quoteBooking.hint,
                    dateSource: 'confirmed',
                })) : [];
            const warnings: string[] = [];
            if (reservationSettled.status === 'rejected') warnings.push('상품 예약을 불러오지 못했습니다. 이전 일정을 표시합니다.');
            if (quoteSettled.status === 'rejected') warnings.push('이전 견적 문의를 불러오지 못했습니다. 이전 일정을 표시합니다.');
            if (bookingSettled.status === 'rejected') warnings.push('견적 예약을 불러오지 못했습니다. 이전 일정을 표시합니다.');
            else if (bookingSettled.value.skipped) warnings.push(`견적 데이터 ${bookingSettled.value.skipped}건을 읽지 못했습니다.`);
            setLoadWarnings(warnings);
            setItems(prev => [...mappedReservations, ...mappedQuotes, ...mappedBookings, ...prev.filter(item =>
                (item.itemType === 'reservation' && reservationSettled.status === 'rejected')
                || (item.itemType === 'quote' && quoteSettled.status === 'rejected')
                || (item.itemType === 'quote_booking' && bookingSettled.status === 'rejected'))].filter(item => item.startDate));
        } catch (error) {
            console.error('Calendar fetch error:', error);
            setLoadWarnings(['일정을 불러오지 못했습니다. 다시 시도해 주세요.']);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCalendarItems();
    }, []);

    const visibleItems = useMemo(() => items.filter(item => includeLegacyQuotes || item.itemType !== 'quote'), [items, includeLegacyQuotes]);
    const monthItems = useMemo(() => visibleItems.filter(item => isInMonth(item, currentMonth)), [visibleItems, currentMonth]);

    const monthStats = useMemo(() => ({
        total: monthItems.length,
        quotes: monthItems.filter(item => item.itemType === 'quote').length,
        confirmed: monthItems.filter(item => item.itemType !== 'quote' && ['confirmed', 'paid'].includes(item.status)).length,
        needsAction: monthItems.filter(item => {
            if (item.itemType === 'quote') return ['new', 'processing', 'reservation_requested'].includes(item.status);
            return !['cancelled', 'completed', 'on_hold'].includes(item.status) && (item.status === 'pending_payment' || !item.assignedGuide || (item.itemType === 'quote_booking' && item.status !== 'confirmed'));
        }).length,
        people: monthItems.reduce((sum, item) => sum + parsePeople(item.headcount), 0),
    }), [monthItems]);

    const selectedDateItems = useMemo(
        () => visibleItems.filter(item => isOnDate(item, selectedDate)).sort((a, b) => a.itemType.localeCompare(b.itemType)),
        [visibleItems, selectedDate],
    );

    const actionItems = useMemo(
        () => monthItems
            .filter(item => {
                if (item.itemType === 'quote') return ['new', 'processing', 'reservation_requested'].includes(item.status);
                return !['cancelled', 'completed', 'on_hold'].includes(item.status) && (item.status === 'pending_payment' || !item.assignedGuide || (item.itemType === 'quote_booking' && item.status !== 'confirmed'));
            })
            .slice(0, 5),
        [monthItems],
    );

    // Build the month grid from the real currentMonth + items state.
    const todayKey = toDateKey(new Date());
    const calendarCells = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const first = new Date(year, month, 1);
        const startOffset = first.getDay(); // Sunday = 0
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
        const cells: Array<{ valid: boolean; dayNum: number; dateKey: string; events: CalendarItem[] }> = [];
        for (let i = 0; i < totalCells; i++) {
            const dayNum = i - startOffset + 1;
            const valid = dayNum >= 1 && dayNum <= daysInMonth;
            const dateKey = valid ? `${year}-${`${month + 1}`.padStart(2, '0')}-${`${dayNum}`.padStart(2, '0')}` : '';
            const events = valid ? visibleItems.filter(item => isOnDate(item, dateKey)) : [];
            cells.push({ valid, dayNum, dateKey, events });
        }
        return cells;
    }, [currentMonth, visibleItems]);

    const dow = ['일', '월', '화', '수', '목', '금', '토'];
    const monthTitle = `${currentMonth.getFullYear()}년 ${currentMonth.getMonth() + 1}월`;

    const goToMonth = (delta: number) => {
        setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    };
    const goToToday = () => {
        const now = new Date();
        setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDate(toDateKey(now));
    };

    return (
        <AdminLayout
            activePage="calendar"
            title="투어 캘린더"
            description="상품 예약과 실제 견적 예약을 날짜 기준으로 함께 확인합니다."
            showSearch={false}
            actions={(
                <button className="btn btn-ghost btn-sm" onClick={fetchCalendarItems} disabled={isLoading} type="button">
                    <Icon name="refresh" className={isLoading ? 'spin' : ''} />새로고침
                </button>
            )}
        >
            <div className="toolbar">
                <div className="row" style={{ gap: 8 }}>
                    <button className="icon-btn" onClick={() => goToMonth(-1)} title="이전 달" type="button">
                        <Icon name="chevron_left" />
                    </button>
                    <div className="page-title" style={{ fontSize: 19 }}>{monthTitle}</div>
                    <button className="icon-btn" onClick={() => goToMonth(1)} title="다음 달" type="button">
                        <Icon name="chevron_right" />
                    </button>
                    <button className="btn btn-ghost btn-sm" style={{ marginLeft: 6 }} onClick={goToToday} type="button">오늘</button>
                </div>
                <div className="spacer" />
                <div className="row" style={{ gap: 14, marginRight: 8 }}>
                    <span className="row" style={{ gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--mrt-blue)' }} />
                        <span className="cell-muted" style={{ fontSize: 12.5 }}>배정 완료</span>
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: '#F5B544' }} />
                        <span className="cell-muted" style={{ fontSize: 12.5 }}>처리 필요</span>
                    </span>
                </div>
                <a className="btn btn-ink" href="/admin/reservations">
                    <Icon name="add" />투어 일정 추가
                </a>
            </div>

            {loadWarnings.length > 0 && <div className="card card-pad" role="alert" style={{ marginBottom: 14, borderColor: '#D99635' }}>
                {loadWarnings.map(message => <div key={message}>{message}</div>)}
                <button className="btn btn-sm btn-ghost" disabled={isLoading} onClick={fetchCalendarItems}>다시 불러오기</button>
            </div>}
            <label className="row" style={{ marginBottom: 14, fontSize: 13 }}><input type="checkbox" checked={includeLegacyQuotes} onChange={e => setIncludeLegacyQuotes(e.target.checked)} />이전 견적 문의도 표시</label>
            <div className="metric-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 18 }}>
                <div className="metric" style={{ padding: '16px 18px' }}>
                    <div className="row" style={{ gap: 12 }}>
                        <span className="metric-ico" style={{ width: 40, height: 40, background: '#fff' }}><Admin3DIcon name="calendar" fallback="event" size={36} /></span>
                        <div>
                            <div className="metric-label">이번 달 투어</div>
                            <div className="metric-value" style={{ fontSize: 22 }}>{monthStats.total}건</div>
                        </div>
                    </div>
                </div>
                <div className="metric" style={{ padding: '16px 18px' }}>
                    <div className="row" style={{ gap: 12 }}>
                        <span className="metric-ico" style={{ width: 40, height: 40, background: '#fff' }}><Admin3DIcon name="reservation" fallback="priority_high" size={36} /></span>
                        <div>
                            <div className="metric-label">처리 필요</div>
                            <div className="metric-value" style={{ fontSize: 22 }}>{monthStats.needsAction}건</div>
                        </div>
                    </div>
                </div>
                <div className="metric" style={{ padding: '16px 18px' }}>
                    <div className="row" style={{ gap: 12 }}>
                        <span className="metric-ico" style={{ width: 40, height: 40, background: '#fff' }}><Admin3DIcon name="travelers" fallback="groups" size={36} /></span>
                        <div>
                            <div className="metric-label">예약 인원</div>
                            <div className="metric-value" style={{ fontSize: 22 }}>{monthStats.people}명</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="cal">
                {dow.map((d, i) => (
                    <div
                        className="cal-dow"
                        key={d}
                        style={i === 0 ? { color: 'var(--mrt-red)' } : i === 6 ? { color: 'var(--mrt-blue)' } : undefined}
                    >
                        {d}
                    </div>
                ))}
                {calendarCells.map((cell, i) => {
                    const isToday = cell.valid && cell.dateKey === todayKey;
                    const isSelected = cell.valid && cell.dateKey === selectedDate;
                    return (
                        <div
                            className={`cal-cell${!cell.valid ? ' out' : ''}${isToday ? ' today' : ''}`}
                            key={i}
                            onClick={() => cell.valid && setSelectedDate(cell.dateKey)}
                            style={isSelected && !isToday ? { boxShadow: 'inset 0 0 0 2px var(--mrt-blue)' } : undefined}
                        >
                            {cell.valid && <div className="cal-date">{cell.dayNum}</div>}
                            {cell.events.map((e) => (
                                <div
                                    key={`${e.itemType}-${e.id}`}
                                    className={`cal-ev ev-${getEventTone(e)}`}
                                    title={`${e.customerName} | ${e.productName} | ${STATUS_LABEL[e.status] || e.status} | ${getNextAction(e).label}`}
                                    onClick={(ev) => {
                                        ev.stopPropagation();
                                        setSelectedEvent(e);
                                    }}
                                >
                                    <b>{e.itemType === 'quote_booking' ? '견적예약' : e.itemType === 'quote' ? '이전견적' : '상품예약'} · {e.customerName}</b>
                                    <div style={{ opacity: 0.85, fontWeight: 600 }}>
                                        {e.headcount} · {e.assignedGuide?.name || '미배정'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

            <div className="grid-2" style={{ marginTop: 22 }}>
                <div className="card">
                    <div className="card-head">
                        <Icon name="calendar_month" style={{ color: 'var(--mrt-blue-strong)' }} />
                        <div>
                            <h2>선택한 날짜</h2>
                            <div className="sub">{selectedDate}</div>
                        </div>
                    </div>
                    <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {selectedDateItems.length > 0 ? (
                            selectedDateItems.map(item => {
                                const action = getNextAction(item);
                                return (
                                    <button
                                        key={`sel-${item.itemType}-${item.id}`}
                                        className="qlink"
                                        onClick={() => setSelectedEvent(item)}
                                        type="button"
                                    >
                                        <span className={`qi tint-${getEventTone(item) === 'blue' ? 'blue' : getEventTone(item) === 'green' ? 'green' : 'amber'}`}>
                                            <Icon name={item.itemType === 'quote' ? 'request_quote' : 'confirmation_number'} />
                                        </span>
                                        <div className="qtext">
                                            <div className="qt">{item.productName}</div>
                                            <div className="qs">{item.customerName} · {item.headcount} · {action.label}</div>
                                        </div>
                                        <Icon name="chevron_right" className="arr" />
                                    </button>
                                );
                            })
                        ) : (
                            <div className="empty">
                                <Icon name="event_busy" />
                                <p>이 날짜에는 일정이 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-head">
                        <Icon name="notification_important" style={{ color: '#B7791F' }} />
                        <div>
                            <h2>이번 달 처리 목록</h2>
                            <div className="sub">우선 확인이 필요한 일정</div>
                        </div>
                    </div>
                    <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {actionItems.length > 0 ? (
                            actionItems.map(item => {
                                const action = getNextAction(item);
                                return (
                                    <button
                                        key={`action-${item.itemType}-${item.id}`}
                                        className="qlink"
                                        onClick={() => setSelectedEvent(item)}
                                        type="button"
                                    >
                                        <span className={`qi badge ${action.tone}`} style={{ borderRadius: 12 }}>
                                            <Icon name={action.icon} />
                                        </span>
                                        <div className="qtext">
                                            <div className="qt">{item.productName}</div>
                                            <div className="qs">{item.customerName} · {item.headcount} · {action.label}</div>
                                        </div>
                                        <Icon name="chevron_right" className="arr" />
                                    </button>
                                );
                            })
                        ) : (
                            <div className="empty">
                                <Icon name="task_alt" />
                                <p>현재 처리할 항목이 없습니다.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <CalendarDetailModal item={selectedEvent} onClose={() => setSelectedEvent(null)} />
        </AdminLayout>
    );
};
