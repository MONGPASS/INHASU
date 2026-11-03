import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useAdminWorkspace } from '../components/admin/AdminWorkspaceContext';
import { DashboardIcon, type DashboardIconName } from '../components/admin/dashboard/DashboardIcon';
import { TrafficSources } from '../components/admin/dashboard/TrafficSources';
import { useEntrance, type DashboardTipFor, type DashboardTipLine } from '../components/admin/dashboard/dashboardMotion';
import type { AdminWorkspaceData } from '../types/adminWorkspace';
import {
    REVENUE_PERIODS, dashboardAddDays, dashboardAnswerRate, dashboardAvailability, dashboardBookingGroup, dashboardBookingSplit, dashboardDailyNew,
    dashboardDate, dashboardNumber, dashboardPeriod, dashboardPhone, dashboardRevenue, dashboardSeoulDate, dashboardShortRange,
    dashboardTaskCards, dashboardTimestamp, dashboardWon, type DashboardTaskKind, type RevenuePeriod,
} from '../utils/adminDashboard';
import styles from './AdminDashboard.module.css';

interface DashboardState {
    data: AdminWorkspaceData | null;
    loading: boolean;
    error: string;
    refresh: () => Promise<void>;
}

interface Tip { x: number; y: number; title: string; lines: DashboardTipLine[] }

/**
 * Lucide outlines (ISC, lucide-static@0.460.0) this page needs beyond the shared DashboardIcon set.
 * `lc-` keys keep scripts/check-icon-subset.mjs from reading them as Material Symbols names.
 */
const PAGE_ICONS = {
    'lc-wallet': <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
    'lc-calendar-plus': <><path d="M8 2v4" /><path d="M16 2v4" /><path d="M21 13V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" /><path d="M3 10h18" /><path d="M16 19h6" /><path d="M19 16v6" /></>,
    'lc-file-plus': <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M9 15h6" /><path d="M12 18v-6" /></>,
    'lc-list': <><path d="M3 12h.01" /><path d="M3 18h.01" /><path d="M3 6h.01" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M8 6h13" /></>,
    'lc-user-x': <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" x2="22" y1="8" y2="13" /><line x1="22" x2="17" y1="8" y2="13" /></>,
    'lc-file-pen-line': <><path d="m18 5-2.414-2.414A2 2 0 0 0 14.172 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2" /><path d="M21.378 12.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" /><path d="M8 18h1" /></>,
} as const;
type PageIconName = keyof typeof PAGE_ICONS;
type AnyIcon = DashboardIconName | PageIconName;

function PageIcon({ name, size = 16 }: { name: AnyIcon; size?: number }) {
    if (!(name in PAGE_ICONS)) return <DashboardIcon name={name as DashboardIconName} size={size} />;
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" style={{ flex: 'none', display: 'block' }}>
        {PAGE_ICONS[name as PageIconName]}
    </svg>;
}

const TASK_TABS: { kind: DashboardTaskKind; label: string; icon: AnyIcon; chip: AnyIcon; action: string }[] = [
    { kind: 'assignment', label: '가이드·차량 배정', icon: 'lc-users', chip: 'lc-user-x', action: '배정하기' },
    { kind: 'deposit_report', label: '입금 신고 확인', icon: 'lc-banknote', chip: 'lc-banknote', action: '입금 확인' },
    { kind: 'contract', label: '계약 확인', icon: 'lc-file-check', chip: 'lc-file-pen-line', action: '계약 확인' },
];
const QUICK_ACTIONS: { label: string; icon: AnyIcon; to: string; main?: boolean }[] = [
    { label: '견적서 작성', icon: 'lc-file-plus', to: '/admin/quote-desk/builder', main: true },
    { label: '통합 예약 목록', icon: 'lc-list', to: '/admin/reservations' },
    { label: '투어 캘린더', icon: 'lc-calendar', to: '/admin/calendar' },
    { label: '숙소 배정', icon: 'lc-house', to: '/admin/accommodation-ops' },
];
const BOOKING_FILTERS = ['전체', '확정 대기', '예약 확정'] as const;
type BookingFilter = typeof BOOKING_FILTERS[number];

const metricLabel = (label: string, value: number | null | undefined, unit: string) =>
    `${label}: ${dashboardNumber(value)}${value != null ? unit : ''}`;

/**
 * Teams leaving within the next 7 days (today included, Korean calendar date from the server),
 * the same window the server uses for pre-departure assignment checks. Cancelled bookings are left out.
 * Null when part of the booking data could not be loaded, so it is never shown as 0.
 */
export function dashboardDepartingSoon(data: AdminWorkspaceData | null): number | null {
    if (!data || !/^\d{4}-\d{2}-\d{2}$/.test(data.today) || !dashboardAvailability(data).bookings) return null;
    const until = dashboardAddDays(data.today, 7);
    return data.bookings.filter(b => dashboardBookingGroup(b.status) !== 'other'
        && /^\d{4}-\d{2}-\d{2}$/.test(b.startDate) && b.startDate >= data.today && b.startDate <= until).length;
}

/** "2026.12.31 – 01.03": the task table's travel period, with the full start year like the design. */
function taskRange(start: string, end: string): string {
    const short = dashboardShortRange(start, end).range;
    const from = start.slice(2).replaceAll('-', '.');
    return /^\d{4}-\d{2}-\d{2}$/.test(start) && short.startsWith(from) ? `${start.slice(0, 2)}${short}` : short;
}

function SectionState({ loading, complete, error, empty }: { loading: boolean; complete: boolean; error: string; empty: string }) {
    return <div className={styles.empty} role={loading ? 'status' : undefined}>
        <span className={styles.emptyIcon}><DashboardIcon name={loading ? 'lc-refresh-cw' : complete ? 'lc-check' : 'lc-circle-alert'} size={20} /></span>
        <p>{loading ? '자료를 불러오고 있습니다.' : complete ? empty : error || '일부 자료를 불러오지 못했습니다. 다시 조회해 주세요.'}</p>
    </div>;
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
    return <div className={styles.sectionTitle}>
        <h2>{title}</h2>
        {note && <span className={styles.sectionNote}>{note}</span>}
    </div>;
}

/** Shared workspace data is presented as received; server counts are never recalculated here. */
export function AdminDashboardBody({ data, loading, error, refresh }: DashboardState) {
    const availability = dashboardAvailability(data);
    const initialLoading = loading && !data;
    const metrics = data?.metrics;
    const [period, setPeriod] = useState<RevenuePeriod>('전체 기간');
    const [periodOpen, setPeriodOpen] = useState(false);
    const [taskTab, setTaskTab] = useState<DashboardTaskKind | null>(null);
    const [bookingFilter, setBookingFilter] = useState<BookingFilter>('전체');
    const [tip, setTip] = useState<Tip | null>(null);
    const t = useEntrance(`${data ? 'ready' : 'waiting'}:${period}`);
    const tipFor: DashboardTipFor = (title, lines) => ({
        onMouseMove: (event: React.MouseEvent) => setTip({ x: event.clientX, y: event.clientY, title, lines }),
        onMouseLeave: () => setTip(null),
    });

    useEffect(() => {
        if (!periodOpen) return;
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPeriodOpen(false); };
        document.addEventListener('keydown', escape);
        return () => document.removeEventListener('keydown', escape);
    }, [periodOpen]);

    const revenue = dashboardRevenue(data, period);
    const split = dashboardBookingSplit(data);
    const splitBars = [
        { name: '예약 확정', label: `예약 확정 ${split.confirmed.count}`, ...split.confirmed, className: styles.splitConfirmed },
        { name: '확정 대기', label: `확정 대기 ${split.waiting.count}`, ...split.waiting, className: styles.splitWaiting },
    ].filter(bar => bar.count > 0);
    const days = availability.bookings ? dashboardDailyNew(data) : [];
    const dayMax = Math.max(1, ...days.map(day => day.count));
    const answer = dashboardAnswerRate(data);
    const answerPct = answer && answer.received ? answer.answered / answer.received * 100 : null;

    const pendingInquiries = data?.inquiries.filter(inquiry => inquiry.pending) || [];
    const taskCards = dashboardTaskCards(data);
    const activeTab = taskTab ?? TASK_TABS.find(tab => taskCards[tab.kind].length)?.kind ?? 'assignment';
    const taskTeams = new Set(TASK_TABS.flatMap(tab => taskCards[tab.kind].map(card => card.task.key.slice(tab.kind.length + 1)))).size;
    const anyTask = taskTeams > 0;
    const departing = dashboardDepartingSoon(data);

    const bookings = data?.bookings || [];
    const bookingCounts: Record<BookingFilter, number> = {
        '전체': bookings.length,
        '확정 대기': bookings.filter(b => dashboardBookingGroup(b.status) === 'waiting').length,
        '예약 확정': bookings.filter(b => dashboardBookingGroup(b.status) === 'confirmed').length,
    };
    const bookingRows = bookings.filter(b => bookingFilter === '전체'
        || dashboardBookingGroup(b.status) === (bookingFilter === '확정 대기' ? 'waiting' : 'confirmed')).slice(0, 6);

    const unit = (value: number | null | undefined, suffix: string) => value == null ? '—' : `${dashboardNumber(value)}${suffix}`;
    const tiles: { label: string; value: string; aria: string; icon: AnyIcon; to: string; hot?: boolean }[] = [
        { label: '처리 필요 팀', value: data ? `${taskTeams}팀` : '—', aria: data ? `처리 필요 팀: ${taskTeams}팀${availability.tasks ? '' : ' (일부 자료)'}` : '처리 필요 팀: —',
            icon: 'lc-clipboard-check', to: '#dashboard-tasks', hot: true },
        { label: '확정 매출', value: dashboardWon(metrics?.confirmedSales), aria: metricLabel('확정 매출 전체 기간', metrics?.confirmedSales, '원'), icon: 'lc-wallet', to: '/admin/reservations' },
        { label: '오늘 신규 예약', value: unit(metrics?.todayReservations, '건'), aria: metricLabel('오늘 신규 예약', metrics?.todayReservations, '건'), icon: 'lc-calendar-plus', to: '/admin/reservations' },
        { label: '답변 대기 견적', value: unit(metrics?.newQuotes, '건'), aria: metricLabel('답변 대기 견적', metrics?.newQuotes, '건'), icon: 'lc-message-circle', to: '/admin/quotes' },
        { label: '7일 내 출발', value: unit(departing, '팀'), aria: metricLabel('7일 내 출발', departing, '팀'), icon: 'lc-plane-takeoff', to: '/admin/calendar' },
    ];

    return <div className={`route-anim ${styles.dashboard}`}>
        <div className={styles.head}>
            <p className={styles.today}>
                {data ? `${dashboardDate(data.today)} · 한국시간 기준` : '오늘의 운영 현황'}
                <span>{data ? `최근 조회 ${dashboardTimestamp(data.generatedAt)}` : initialLoading ? '상품·견적 자료를 확인하고 있습니다.' : '운영 자료를 다시 조회해 주세요.'}</span>
            </p>
            <div className={styles.actions}>
                {QUICK_ACTIONS.map(action => <Link key={action.label} to={action.to} className={`${styles.action} ${action.main ? styles.actionMain : ''}`}>
                    <PageIcon name={action.icon} />{action.label}
                </Link>)}
                <button type="button" className={styles.action} disabled={loading} onClick={() => { void refresh(); }}>
                    <DashboardIcon name="lc-refresh-cw" size={16} />{loading ? '조회 중…' : '새로고침'}
                </button>
            </div>
        </div>

        {error && <div className={styles.warning} role="alert">{error}{data && <span>마지막으로 불러온 자료를 표시하고 있습니다.</span>}</div>}
        {!!data?.warnings.length && <div className={styles.warning} role="status">
            <strong>일부 자료를 확인할 수 없습니다.</strong>
            <ul>{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            <span>확인되지 않은 집계는 —로 표시합니다.</span>
        </div>}

        <div className={styles.tiles} role="group" aria-label="오늘의 핵심 지표" aria-busy={initialLoading}>
            {tiles.map(tile => {
                const body = <>
                    <span className={styles.tileIcon}><PageIcon name={tile.icon} size={22} /></span>
                    <span className={styles.tileLabel}>{tile.label}</span>
                    <span className={styles.tileValue} aria-label={tile.aria}>{tile.value}</span>
                </>;
                const className = `${styles.tile} ${tile.hot ? styles.tileHot : ''}`;
                return tile.to.startsWith('#')
                    ? <a key={tile.label} href={tile.to} className={className}>{body}</a>
                    : <Link key={tile.label} to={tile.to} className={className}>{body}</Link>;
            })}
        </div>

        <SectionTitle title="지금 처리할 일" />
        <div className={styles.row420}>
            <section className={`${styles.card} ${styles.tasks}`} id="dashboard-tasks">
                <div className={styles.taskHead}>
                    <span className={styles.cardTitle}>오늘 확인할 업무</span>
                    <span className={styles.taskSub}>{data
                        ? <>처리가 필요한 팀 <b>{taskTeams}</b>팀 · 출발일 가까운 순{!availability.tasks && ' · 일부 자료'}</>
                        : initialLoading ? '업무를 확인하고 있습니다.' : '업무 자료를 다시 조회해 주세요.'}</span>
                </div>
                <div className={styles.tabs} role="tablist" aria-label="업무 종류">
                    {TASK_TABS.map(tab => {
                        const count = taskCards[tab.kind].length;
                        return <button key={tab.kind} type="button" role="tab" id={`dashboard-tab-${tab.kind}`} aria-controls={`dashboard-panel-${tab.kind}`}
                            aria-selected={activeTab === tab.kind} className={styles.tab} onClick={() => setTaskTab(tab.kind)}>
                            <PageIcon name={tab.icon} />{tab.label}
                            <span className={`${styles.glow} ${styles.tabCount} ${count ? styles.toneAlert : styles.toneNeutral}`}>{count}</span>
                        </button>;
                    })}
                </div>
                {!availability.tasks && data && <p className={`${styles.partial} ${styles.partialInset}`}>확인된 업무만 표시합니다. 불러오지 못한 자료에 추가 업무가 있을 수 있습니다.</p>}
                {!data || !anyTask ? <div className={styles.taskPanel}>
                    <SectionState loading={initialLoading} complete={availability.tasks} error={error}
                        empty={data?.tasks.length ? '배정·입금·계약 확인이 필요한 팀이 없습니다.' : '확인이 필요한 업무가 없습니다.'} />
                </div> : TASK_TABS.map(tab => <div key={tab.kind} className={styles.taskPanel} role="tabpanel" id={`dashboard-panel-${tab.kind}`}
                    aria-labelledby={`dashboard-tab-${tab.kind}`} hidden={activeTab !== tab.kind}>
                    {!!taskCards[tab.kind].length && <div className={`${styles.taskGrid} ${styles.taskGridHead}`} aria-hidden="true">
                        <span>출발</span><span>고객 · 상품</span><span>여행 기간</span><span>미처리 항목</span><span />
                    </div>}
                    {taskCards[tab.kind].map(card => {
                        const soon = card.dday !== null && card.dday <= 90;
                        return <div key={card.task.key} className={`${styles.taskGrid} ${styles.taskRow}`}>
                            <span className={styles.ddayCell}>
                                <span className={`${styles.glow} ${styles.dday} ${soon ? styles.toneInk : styles.toneNeutral}`}>
                                    {card.dday === null ? '미정' : card.dday === 0 ? 'D-DAY' : card.dday < 0 ? `D+${-card.dday}` : `D-${card.dday}`}
                                </span>
                            </span>
                            <span className={styles.stack2}>
                                <span className={styles.rowName}>{card.name}</span>
                                {card.product && <span className={styles.rowSub}>{card.product}</span>}
                            </span>
                            <span className={styles.taskRange}>{taskRange(card.start, card.end)}</span>
                            <span className={styles.chips}>
                                <span className={`${styles.glow} ${styles.toneAlert}`}><PageIcon name={tab.chip} size={13} />{card.task.title}</span>
                            </span>
                            <span className={styles.taskActionCell}>
                                <Link className={styles.taskAction} to={card.task.href}>{tab.action}</Link>
                            </span>
                        </div>;
                    })}
                    {!taskCards[tab.kind].length && <div className={styles.empty}>
                        <span className={styles.emptyIcon}><DashboardIcon name="lc-check" size={20} /></span><p>이 탭에는 확인할 업무가 없어요.</p>
                    </div>}
                </div>)}
                <div className={styles.taskFoot}>
                    <DashboardIcon name="lc-message-circle" size={16} color="var(--mrt-blue-strong)" />
                    {!availability.inquiries
                        ? data ? '문의 자료를 확인할 수 없어 답변 대기 건수를 표시하지 않습니다.' : '문의 자료를 확인하고 있습니다.'
                        : pendingInquiries.length
                            ? <Link to="/admin/quotes">답변을 기다리는 견적 문의 <b>{pendingInquiries.length}</b>건<DashboardIcon name="lc-arrow-right" size={14} /></Link>
                            : '답변을 기다리는 문의가 없습니다.'}
                </div>
            </section>

            <section className={`${styles.card} ${styles.recent}`}>
                <div className={styles.recentHead}>
                    <span className={styles.cardTitle}>최근 통합 예약</span>
                    <span className={`${styles.glow} ${styles.dot} ${styles.toneNeutral}`}>상품 · 견적</span>
                    <Link className={styles.headLink} to="/admin/reservations">전체 보기<DashboardIcon name="lc-arrow-right" size={16} /></Link>
                </div>
                <div className={styles.pills}>
                    {BOOKING_FILTERS.map(filter => <button key={filter} type="button" className={styles.pill} aria-pressed={bookingFilter === filter}
                        onClick={() => setBookingFilter(filter)}>
                        {filter}<span className={styles.pillN}>{data ? bookingCounts[filter] : '—'}</span>
                    </button>)}
                </div>
                {!availability.bookings && data && <p className={styles.partial}>불러온 예약만 표시합니다. 일부 예약 자료는 확인이 필요합니다.</p>}
                <div className={styles.table}>
                    <div className={styles.tableHead} aria-hidden="true">
                        <span>고객 · 상품</span><span>여행 기간</span><span className={styles.right}>팀 금액</span><span className={styles.right}>상태</span>
                    </div>
                    {bookingRows.map(booking => {
                        const group = dashboardBookingGroup(booking.status);
                        const range = dashboardShortRange(booking.startDate, booking.endDate);
                        const name = booking.customerName || '이름 미정';
                        return <Link key={booking.key} to={booking.href} className={styles.tableRow}>
                            <span className={styles.who}>
                                <span className={`${styles.avatar} ${group === 'waiting' ? styles.avatarWait : ''}`} aria-hidden="true">{name.replace(/\s*\(.*\)/, '').slice(0, 1)}</span>
                                <span className={styles.stack2}>
                                    <span className={styles.rowName}>{name}</span>
                                    <span className={styles.rowSub}>{booking.type === 'quote_booking' ? '견적 예약' : '상품 예약'} · {booking.productName || '상품 미정'} · <span className={styles.mono}>#{booking.reservationNumber || booking.id.slice(0, 8)}</span></span>
                                </span>
                            </span>
                            <span className={`${styles.stack2} ${styles.rangeCell}`} aria-label={`여행 기간 ${dashboardPeriod(booking.startDate, booking.endDate)}`}>
                                <span className={styles.rowRange}>{range.range}</span>
                                {range.nights && <span className={styles.rowSub}>{range.nights}</span>}
                            </span>
                            <span className={styles.rowAmount} aria-label={`팀 금액 ${dashboardNumber(booking.totalAmount)}${booking.totalAmount != null ? '원' : ''}`}>{dashboardWon(booking.totalAmount)}</span>
                            <span className={styles.statusCell}>
                                <span className={`${styles.glow} ${styles.dot} ${styles.status} ${group === 'waiting' ? styles.toneWait : group === 'confirmed' ? styles.toneOk : styles.toneNeutral}`}>
                                    {booking.statusLabel || booking.status || '상태 미정'}
                                </span>
                            </span>
                        </Link>;
                    })}
                    {!bookingRows.length && <SectionState loading={initialLoading} complete={availability.bookings} error={error}
                        empty={bookingFilter === '전체' ? '접수된 예약이 없습니다.' : '이 상태의 예약이 없습니다.'} />}
                </div>
            </section>
        </div>

        <SectionTitle title="매출 · 예약 현황" note="확정 매출과 오늘 들어온 예약" />
        <div className={styles.row420} role="group" aria-label="통합 운영 집계" aria-busy={initialLoading}>
            <section className={styles.revenue}>
                <div className={styles.revHead}>
                    <span className={styles.revTitle}>확정 매출</span>
                    <span className={styles.info} role="img" aria-label="확정·결제·완료 예약의 팀 전체 금액. 기간은 예약 접수일(한국시간) 기준"
                        title="확정·결제·완료 예약의 팀 전체 금액 · 기간은 예약 접수일(한국시간) 기준">
                        <DashboardIcon name="lc-info" size={14} color="#5f8f82" />
                    </span>
                    <div className={styles.revPicker}>
                        <button type="button" className={styles.revButton} aria-haspopup="menu" aria-expanded={periodOpen} onClick={() => setPeriodOpen(open => !open)}>
                            {period}
                            <span className={`${styles.chevron} ${periodOpen ? styles.chevronOpen : ''}`}><DashboardIcon name="lc-chevron-down" size={14} /></span>
                        </button>
                        {periodOpen && <>
                            <div className={styles.scrim} onClick={() => setPeriodOpen(false)} />
                            <div className={styles.revMenu} role="menu" aria-label="매출 기간">
                                {REVENUE_PERIODS.map(option => <button key={option} type="button" role="menuitemradio" aria-checked={period === option}
                                    className={styles.revOption} onClick={() => { setPeriod(option); setPeriodOpen(false); }}>
                                    <span>{option}</span><span className={styles.revRange}>{dashboardRevenue(data, option).range}</span>
                                </button>)}
                            </div>
                        </>}
                    </div>
                </div>
                <div className={styles.revValueRow}>
                    <span className={styles.revValue} aria-label={metricLabel('확정 매출', revenue.value, '원')}>
                        {revenue.value == null ? '—' : dashboardWon(revenue.value * t)}
                    </span>
                    <span className={styles.revCaption}>{revenue.value == null && data ? '자료 확인 필요' : '확정·결제·완료 팀 금액'}</span>
                </div>
                <div className={styles.revSplitHead}>
                    <span>예약 구분</span>
                    <span>{availability.bookings ? '전체 예약' : '불러온 예약'} <b>{dashboardNumber(data ? split.total : null)}</b>건</span>
                </div>
                <div className={styles.split}>
                    {splitBars.length ? splitBars.map(bar => <span key={bar.name} className={`${styles.splitSeg} ${bar.className}`}
                        {...tipFor(bar.name, [{ k: '예약', v: `${bar.count}건` }, { k: '비중', v: `${(bar.count / split.total * 100).toFixed(1)}%` },
                            { k: '팀 금액', v: dashboardWon(bar.amount) }])}
                        style={{ flex: `0 1 ${bar.count / split.total * 100 * t}%`, padding: t > 0.3 ? '0 14px' : 0, opacity: Math.min(1, t * 2) }}>
                        {bar.label}
                    </span>) : <span className={styles.splitEmpty}>{initialLoading ? '집계 중…' : data ? '예약 없음' : '자료 확인 필요'}</span>}
                </div>
            </section>

            <section className={styles.pair}>
                <div className={styles.pairCell}>
                    <div className={styles.pairBody}>
                        <span className={styles.pairLabel}>오늘 신규 예약</span>
                        <div className={styles.pairRow}>
                            <div>
                                <span className={styles.bigNum} aria-label={metricLabel('오늘 신규 예약', metrics?.todayReservations, '건')}>{dashboardNumber(metrics?.todayReservations)}</span>
                                {metrics?.todayReservations != null && <span className={styles.bigUnit}>건</span>}
                                <div className={styles.pairNote}>{metrics?.todayReservations == null ? initialLoading ? '집계 중…' : '자료 확인 필요' : '상품 + 견적 예약'}</div>
                            </div>
                            {!!days.length && <div className={styles.miniBars} aria-label="최근 7일 신규 예약">
                                {days.map(day => <span key={day.key} className={styles.miniBar}
                                    {...tipFor(`${day.label}${day.today ? ' · 오늘' : ''}`, [{ k: '신규 예약', v: `${day.count}건` }])}>
                                    <span className={styles.miniFill} style={{
                                        height: `${Math.max(day.count ? 0 : 6, day.count / dayMax * 100 * t)}%`,
                                        background: day.today ? 'linear-gradient(180deg,#3fe0b4,#12b28c)'
                                            : day.count && day.count === dayMax ? 'linear-gradient(180deg,#1cc497,#0E9E7A)' : 'linear-gradient(180deg,#bff0e0,#8fe3c9)',
                                    }} />
                                </span>)}
                            </div>}
                        </div>
                    </div>
                    <Link className={styles.moreLink} to="/admin/reservations">자세히 보기<DashboardIcon name="lc-arrow-right" size={16} /></Link>
                </div>
                <div className={styles.pairCell}>
                    <div className={styles.pairBody}>
                        <span className={styles.pairLabel}>답변 대기 견적</span>
                        <div className={styles.pairRow}>
                            <div>
                                <span className={styles.bigNum} aria-label={metricLabel('답변 대기 견적', metrics?.newQuotes, '건')}>{dashboardNumber(metrics?.newQuotes)}</span>
                                {metrics?.newQuotes != null && <span className={styles.bigUnit}>건</span>}
                                <div className={styles.pairNote}>입금 대기 <b aria-label={metricLabel('입금 대기', metrics?.unpaidReservations, '건')}>{dashboardNumber(metrics?.unpaidReservations)}</b>{metrics?.unpaidReservations != null && '건'}</div>
                            </div>
                            {answer && <div className={styles.ring}
                                {...tipFor(`${answer.month}월 견적 답변 처리율`, [{ k: '접수', v: `${answer.received}건` }, { k: '답변 완료', v: `${answer.answered}건` },
                                    { k: '처리율', v: answerPct == null ? '—' : `${answerPct.toFixed(1)}%` }])}>
                                <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                                    <defs><linearGradient id="dashboard-mint-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3fe0b4" /><stop offset="1" stopColor="#0E9E7A" /></linearGradient></defs>
                                    <circle cx="32" cy="32" r="26" fill="none" stroke="#dcf6ee" strokeWidth="7" />
                                    <circle cx="32" cy="32" r="26" fill="none" stroke="url(#dashboard-mint-ring)" strokeWidth="7" strokeLinecap="round" pathLength={100}
                                        transform="rotate(-90 32 32)" style={{ strokeDasharray: `${(answerPct ?? 0) * t} 100` }} />
                                </svg>
                                <span className={styles.ringPct}>{answerPct == null ? '—' : `${Math.round(answerPct * t)}%`}</span>
                            </div>}
                        </div>
                    </div>
                    <Link className={styles.moreLink} to="/admin/quotes">자세히 보기<DashboardIcon name="lc-arrow-right" size={16} /></Link>
                </div>
            </section>
        </div>

        <SectionTitle title="유입 · 문의" />
        <div className={styles.row520}>
            <TrafficSources tipFor={tipFor} />

            <section className={styles.card}>
                <div className={styles.quotesHead}>
                    <span className={styles.cardTitle}>최근 견적 요청</span>
                    {data && <span className={styles.countBadge}>{availability.inquiries ? pendingInquiries.length : '일부'}</span>}
                    <span className={styles.headNote}>답변 대기 · 접수일 최신순</span>
                </div>
                {!availability.inquiries && data && <p className={`${styles.partial} ${styles.partialInset}`}>불러온 문의만 표시합니다. 일부 문의 자료는 확인이 필요합니다.</p>}
                <div className={styles.quotesList}>
                    {pendingInquiries.slice(0, 20).map(inquiry => {
                        const received = dashboardSeoulDate(inquiry.createdAt);
                        return <Link key={inquiry.key} to={inquiry.href} className={styles.quoteRow}>
                            <div className={styles.quoteTop}>
                                <span className={styles.quoteName}>{inquiry.name || '이름 미정'}</span>
                                {inquiry.phone && <span className={styles.quotePhone}>{dashboardPhone(inquiry.phone)}</span>}
                                <span className={`${styles.glow} ${styles.dot} ${styles.quoteStatus} ${styles.toneInfo}`}>{inquiry.statusLabel || inquiry.status}</span>
                            </div>
                            <div className={styles.quoteDest}><b>{inquiry.destination || '희망 여행 미정'}</b></div>
                            <div className={styles.quoteMeta}>
                                <span><DashboardIcon name="lc-file-text" size={13} />{inquiry.type === 'quote_request' ? '맞춤 견적' : '기존 견적'}</span>
                                {inquiry.status === 'reservation_requested' && <span className={styles.quoteAlert}>예약 확정 필요</span>}
                                <span className={styles.quoteDate}>{received ? received.replaceAll('-', '.') : '접수일 미정'}</span>
                            </div>
                        </Link>;
                    })}
                    {!pendingInquiries.length && <SectionState loading={initialLoading} complete={availability.inquiries} error={error} empty="답변을 기다리는 문의가 없습니다." />}
                </div>
                <Link className={styles.moreLink} to="/admin/quotes">견적 문의 전체 보기<DashboardIcon name="lc-arrow-right" size={16} /></Link>
            </section>
        </div>

        {tip && <div className={styles.tip} aria-hidden="true" style={{
            left: tip.x > (typeof window !== 'undefined' ? window.innerWidth : 1600) - 220 ? tip.x - 190 : tip.x + 14, top: tip.y + 16,
        }}>
            <div className={styles.tipTitle}>{tip.title}</div>
            {tip.lines.map(line => <div key={line.k} className={styles.tipLine}><span>{line.k}</span><span>{line.v}</span></div>)}
        </div>}
    </div>;
}

export const AdminDashboard: React.FC = () => {
    const workspace = useAdminWorkspace();
    // 디자인 v3: 통합 예약 목록은 본문 바로가기에 있으므로 상단 작업 버튼을 두지 않는다.
    return <AdminLayout activePage="dashboard" title="대시보드" description="상품과 견적 예약의 오늘 업무를 함께 확인합니다.">
        <AdminDashboardBody {...workspace} />
    </AdminLayout>;
};
