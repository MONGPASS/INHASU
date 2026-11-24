import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/admin/AdminLayout';
import {
    AdminButton, AdminIconButton, AdminTabs, AdminTextButton, IconChat, IconCheck, IconChevronRight, IconCircleExclamationFill, IconClock, IconCoins, IconCoupon,
    IconDocumentText, IconFlight, IconHome, IconPencil, IconRefresh,
} from '../components/admin/ui';
import { useAdminWorkspace } from '../components/admin/AdminWorkspaceContext';
import { TrafficSources, trafficPeriodLabel, trafficReady, useAdminTraffic, type AdminTraffic } from '../components/admin/dashboard/TrafficSources';
import { trafficKpis } from '../utils/adminTraffic';
import type { AdminWorkBooking, AdminWorkspaceData } from '../types/adminWorkspace';
import {
    dashboardAvailability, dashboardBookingGroup, dashboardBookingSplit, dashboardDate, dashboardDayDiff, dashboardDepartures,
    dashboardMonthRange, dashboardNumber, dashboardPeriod, dashboardSeoulDate, dashboardWon, dashboardWorkQueue, type DashboardDeparture,
    type DashboardQueueKind, type DashboardQueueRow,
} from '../utils/adminDashboard';
import styles from './AdminDashboard.module.css';

interface DashboardState {
    data: AdminWorkspaceData | null;
    loading: boolean;
    error: string;
    refresh: () => Promise<void>;
}

type QueueTab = 'all' | DashboardQueueKind;
const QUEUE_TABS: { value: QueueTab; label: string }[] = [
    { value: 'all', label: '전체' }, { value: 'contract', label: '계약 확인' }, { value: 'quote', label: '견적 답변' },
    { value: 'deposit_report', label: '입금 확인' }, { value: 'assignment', label: '배정' },
];

const metricLabel = (label: string, value: number | null | undefined, unit: string) =>
    `${label}: ${dashboardNumber(value)}${value != null ? unit : ''}`;

const seoulClock = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
const seoulHour = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hourCycle: 'h23' });
/** 인사말은 한국시간 지금 시각으로 고른다. */
function greeting(now = new Date()): string {
    const hour = Number(seoulHour.format(now));
    return hour < 5 ? '늦은 밤이에요' : hour < 12 ? '좋은 아침이에요' : hour < 18 ? '좋은 오후예요' : '좋은 저녁이에요';
}
/** "15:49": the time the workspace data was read, Korean time. */
function readTime(value: string): string {
    const time = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
    const date = new Date(time);
    return Number.isFinite(date.getTime()) ? seoulClock.format(date) : '';
}
const shortDay = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(key) ? key.slice(2).replaceAll('-', '.') : '일정 미정';

function SectionState({ loading, complete, error, empty }: { loading: boolean; complete: boolean; error: string; empty: string }) {
    return <div className={styles.empty} role={loading ? 'status' : undefined}>
        <p>{loading ? '자료를 불러오고 있습니다.' : complete ? empty : error || '일부 자료를 불러오지 못했습니다. 다시 조회해 주세요.'}</p>
    </div>;
}

function CardHead({ id, title, count, countLabel, to, note }: { id: string; title: string; count?: string; countLabel?: string; to?: string; note?: string }) {
    return <div className={styles.cardHead}>
        <div className={styles.cardHeadText}>
            <h2 id={id} className={styles.cardTitle}>{title}{count != null && <span className={styles.titleCount} aria-label={countLabel}> {count}</span>}</h2>
            {note && <span className={styles.cardNote}>{note}</span>}
        </div>
        {to && <AdminTextButton to={to} size="sm">전체 보기</AdminTextButton>}
    </div>;
}

type KpiTone = 'danger' | 'accent' | 'blue' | 'purple';
interface KpiCard { label: string; value: string; aria: string; icon: React.ReactNode; tone: KpiTone; to: string; pill?: string; sub: string }
const TONE_CLASS: Record<KpiTone, string> = { danger: styles.toneDanger, accent: styles.toneAccent, blue: styles.toneBlue, purple: styles.tonePurple };

function Kpi({ card }: { card: KpiCard }) {
    const body = <>
        <span className={styles.kpiTop}>
            <span className={`${styles.kpiIcon} ${TONE_CLASS[card.tone]}`} aria-hidden="true">{card.icon}</span>
            <IconChevronRight className={styles.kpiChevron} aria-hidden="true" />
        </span>
        <span className={styles.kpiText}>
            <span className={styles.kpiLabel}>{card.label}</span>
            <span className={styles.kpiValue} aria-label={card.aria}>{card.value}</span>
        </span>
        <span className={styles.kpiFoot}>
            {card.pill && <span className={`${styles.pill} ${TONE_CLASS[card.tone]}`}>{card.pill}</span>}
            <span className={styles.kpiSub}>{card.sub}</span>
        </span>
    </>;
    return card.to.startsWith('#')
        ? <a href={card.to} className={styles.kpi}>{body}</a>
        : <Link to={card.to} className={styles.kpi}>{body}</Link>;
}

/** 문의 전환율 카드: 유입 경로 카드에서 고른 GA4 기간. 연결 전·조회 실패는 0이 아니라 그 사실을 적는다. */
function conversionCard(traffic: AdminTraffic): KpiCard {
    const data = trafficReady(traffic.load);
    const range = trafficPeriodLabel(traffic.period);
    const kpis = data ? trafficKpis(data) : [];
    const cvr = kpis.find(kpi => kpi.label === '문의 전환율');
    const leads = kpis.find(kpi => kpi.label === '견적 문의');
    const value = cvr?.value == null ? '—' : `${cvr.format(cvr.value)}%`;
    return {
        label: '문의 전환율', value, aria: `문의 전환율 ${range}: ${value}`, icon: <IconChat />, tone: 'purple', to: '#dashboard-traffic',
        pill: cvr?.delta || undefined,
        sub: data ? `${range} · 문의 ${leads?.value == null ? '—' : dashboardNumber(leads.value)}건`
            : traffic.load.status === 'loading' ? '유입 통계를 불러오는 중' : traffic.load.status === 'error' ? '유입 통계 조회 실패' : 'GA4 연결 필요',
    };
}

const DEPARTURE_ICON: Record<DashboardDeparture['next'], React.ReactNode> = {
    deposit: <IconCoins />, contract: <IconPencil />, confirm: <IconCheck />, depart: <IconFlight />,
};
const DEPARTURE_TONES = [styles.toneAccent, styles.toneBlue, styles.tonePurple];

function bookingLook(b: AdminWorkBooking): { icon: React.ReactNode; tone: string } {
    const group = dashboardBookingGroup(b.status);
    if (group === 'confirmed') return { icon: <IconCheck />, tone: styles.toneAccent };
    if (group === 'waiting' && b.depositPaid && !b.contractSigned) return { icon: <IconPencil />, tone: styles.toneBlue };
    return { icon: <IconClock />, tone: styles.toneGray };
}

/** Shared workspace data is presented as received; server counts are never recalculated here. */
const NO_TRAFFIC: AdminTraffic = { load: { status: 'loading' }, retry: () => {}, period: '30d', setPeriod: () => {} };
export function AdminDashboardBody({ data, loading, error, refresh, traffic = NO_TRAFFIC }: DashboardState & { traffic?: AdminTraffic }) {
    const availability = dashboardAvailability(data);
    const initialLoading = loading && !data;
    const metrics = data?.metrics;
    const [tab, setTab] = useState<QueueTab>('all');

    const queue = dashboardWorkQueue(data);
    const count = (value: QueueTab) => value === 'all' ? queue.length : queue.filter(row => row.kind === value).length;
    const rows = tab === 'all' ? queue : queue.filter(row => row.kind === tab);
    const overdue = queue.filter(row => row.overdue).length;

    const split = dashboardBookingSplit(data);
    const pct = (n: number) => split.total ? n / split.total * 100 : 0;
    const other = split.total - split.confirmed.count - split.waiting.count;
    const waitingNext = (data?.bookings || [])
        .filter(b => dashboardBookingGroup(b.status) === 'waiting' && !!data && /^\d{4}-\d{2}-\d{2}$/.test(b.startDate) && b.startDate >= data.today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    const waitingDays = waitingNext && data ? dashboardDayDiff(data.today, waitingNext.startDate) : null;

    const departures = dashboardDepartures(data);
    const recent = (data?.bookings || []).slice(0, 5);
    const pendingInquiries = data?.inquiries.filter(inquiry => inquiry.pending) || [];

    const kpis: KpiCard[] = [
        { label: '처리할 일', value: data ? `${queue.length}건` : '—', aria: data ? `처리할 일: ${queue.length}건${availability.tasks ? '' : ' (일부 자료)'}` : '처리할 일: —',
            icon: <IconCircleExclamationFill />, tone: 'danger', to: '#dashboard-tasks', pill: overdue ? `출발일 지남 ${overdue}` : undefined,
            sub: !data ? '업무를 확인하고 있습니다' : overdue ? '먼저 정리해 주세요' : queue.length ? '급한 순서로 정리했어요' : '처리할 일이 없어요' },
        { label: '확정 매출', value: dashboardWon(metrics?.confirmedSales), aria: metricLabel('확정 매출', metrics?.confirmedSales, '원'),
            icon: <IconCoupon />, tone: 'accent', to: '/admin/reservations', pill: data ? `확정 ${dashboardNumber(split.confirmed.count)}건` : undefined, sub: '전체 기간' },
        { label: '서명·확정 대기', value: data ? `${dashboardNumber(split.waiting.count)}건` : '—', aria: data ? `서명·확정 대기: ${split.waiting.count}건` : '서명·확정 대기: —',
            icon: <IconClock />, tone: 'blue', to: '/admin/reservations',
            pill: waitingNext && waitingDays != null ? `${waitingDays === 0 ? 'D-DAY' : `D-${waitingDays}`} ${waitingNext.customerName || '이름 미정'}` : undefined,
            sub: waitingNext ? `${dashboardMonthRange(waitingNext.startDate, waitingNext.startDate, data?.today || '')} 출발` : data ? '다가오는 대기 예약 없음' : '예약을 확인하고 있습니다' },
        conversionCard(traffic),
    ];

    const readAt = data ? readTime(data.generatedAt) : '';
    return <div className={`route-anim ${styles.dashboard}`}>
        <header className={styles.head}>
            <div className={styles.hello}>
                <span className={styles.helloIcon} aria-hidden="true"><IconHome /></span>
                <div className={styles.helloText}>
                    <h1>{greeting()}, 관리자님</h1>
                    <p>오늘 처리할 일과 예약 흐름을 한눈에 확인하세요.</p>
                </div>
            </div>
            <div className={styles.headTools}>
                <span className={styles.clock} title={data ? '최근 조회 시각(한국시간)' : undefined}>
                    <IconClock aria-hidden="true" />
                    {data ? `${dashboardDate(data.today)}${readAt ? ` · ${readAt}` : ''}` : initialLoading ? '자료를 확인하고 있습니다' : '운영 자료를 다시 조회해 주세요'}
                </span>
                <AdminIconButton variant="outlined" label={loading ? '조회 중…' : '새로고침'} disabled={loading} onClick={() => { void refresh(); }}><IconRefresh /></AdminIconButton>
                <AdminButton to="/admin/quote-desk/builder" variant="primary" leading={<IconDocumentText />}>견적서 작성</AdminButton>
            </div>
        </header>

        {error && <div className={styles.warning} role="alert">{error}{data && <span>마지막으로 불러온 자료를 표시하고 있습니다.</span>}</div>}
        {!!data?.warnings.length && <div className={styles.warning} role="status">
            <strong>일부 자료를 확인할 수 없습니다.</strong>
            <ul>{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            <span>확인되지 않은 집계는 —로 표시합니다.</span>
        </div>}

        <section className={styles.kpis} aria-label="핵심 지표" aria-busy={initialLoading}>
            {kpis.map(card => <Kpi key={card.label} card={card} />)}
        </section>

        <div className={styles.body}>
            <div className={styles.mainCol}>
                <section className={`${styles.card} ${styles.queue}`} id="dashboard-tasks" aria-labelledby="dashboard-tasks-title">
                    <div className={styles.queueHead}>
                        <CardHead id="dashboard-tasks-title" title="오늘 처리할 일" note="급한 순서로 정렬했어요"
                            to={tab === 'quote' ? '/admin/quote-desk/inbox' : '/admin/reservations'} />
                    </div>
                    <div className={styles.queueTabs}>
                        <AdminTabs size="sm" label="업무 종류" value={tab} onChange={value => setTab(value)}
                            items={QUEUE_TABS.map(item => ({ value: item.value, label: item.label, count: data ? count(item.value) : '—', id: `dashboard-tab-${item.value}`,
                                controls: 'dashboard-queue', tone: queue.some(row => row.overdue && (item.value === 'all' ? false : row.kind === item.value)) ? 'danger' as const : undefined }))} />
                    </div>
                    {!availability.tasks && data && <p className={styles.partial}>확인된 업무만 표시합니다. 불러오지 못한 자료에 추가 업무가 있을 수 있습니다.</p>}
                    <div className={styles.queueTable} role="tabpanel" id="dashboard-queue" aria-labelledby={`dashboard-tab-${tab}`}>
                        {!!rows.length && <div className={`${styles.queueGrid} ${styles.queueGridHead}`} aria-hidden="true">
                            <span>출발</span><span>고객 · 상품</span><span>여행 기간</span><span>구분</span><span>상태</span><span />
                        </div>}
                        <ul className={styles.queueList}>
                            {rows.map(row => <QueueRow key={row.key} row={row} />)}
                        </ul>
                        {!rows.length && <SectionState loading={initialLoading} complete={availability.tasks} error={error}
                            empty={tab === 'all' ? '확인이 필요한 업무가 없습니다.' : '이 탭에는 확인할 업무가 없어요.'} />}
                    </div>
                </section>

                <div className={styles.pair}>
                    <section className={styles.card} aria-labelledby="dashboard-departures-title">
                        <CardHead id="dashboard-departures-title" title="출발 준비 현황" to="/admin/calendar" />
                        {!availability.bookings && data && <p className={styles.partialFlat}>불러온 예약만 표시합니다.</p>}
                        <ul className={styles.plainList}>
                            {departures.map((d, index) => <li key={d.key}>
                                <Link to={d.href} className={styles.departure}>
                                    <span className={`${styles.squareIcon} ${DEPARTURE_TONES[index % DEPARTURE_TONES.length]}`} aria-hidden="true">{DEPARTURE_ICON[d.next]}</span>
                                    <span className={styles.departureBody}>
                                        <span className={styles.departureTop}><b>{d.name}</b><span>{d.date}</span></span>
                                        <span className={styles.departureStep}>{d.step}</span>
                                        <span className={styles.progressRow}>
                                            {/* 진행 막대 길이만 실행 중 계산값이라 인라인 */}
                                            <span className={styles.progress} role="img" aria-label={`준비 ${d.percent}%`}>
                                                <span className={DEPARTURE_TONES[index % DEPARTURE_TONES.length]} style={{ width: `${d.percent}%` }} />
                                            </span>
                                            <span className={styles.progressPct} aria-hidden="true">{d.percent}%</span>
                                        </span>
                                    </span>
                                </Link>
                            </li>)}
                        </ul>
                        {!departures.length && <SectionState loading={initialLoading} complete={availability.bookings} error={error} empty="다가오는 출발이 없습니다." />}
                    </section>
                    <TrafficSources {...traffic} />
                </div>
            </div>

            <div className={styles.sideCol}>
                <section className={styles.card} aria-labelledby="dashboard-mix-title">
                    <CardHead id="dashboard-mix-title" title="예약 구성" />
                    {/* 도넛 비율만 실행 중 계산값이라 인라인(CSS 변수) */}
                    <div className={styles.donut} role="img"
                        aria-label={`${availability.bookings ? '전체' : '불러온'} 예약 ${split.total}건 중 확정 ${split.confirmed.count}건, 확정 대기 ${split.waiting.count}건`}
                        style={{ '--dash-confirmed': `${pct(split.confirmed.count)}%`, '--dash-waiting': `${pct(split.confirmed.count + split.waiting.count)}%` } as React.CSSProperties}>
                        <span className={styles.donutHole}>
                            <b>{data ? `${dashboardNumber(split.total)}건` : '—'}</b>
                            <span>{availability.bookings || !data ? '전체 예약' : '불러온 예약'}</span>
                        </span>
                    </div>
                    <ul className={styles.legend}>
                        <li><span className={`${styles.legendDot} ${styles.fillAccent}`} aria-hidden="true" /><span>예약 확정</span><span className={styles.legendPct}>{Math.round(pct(split.confirmed.count))}%</span><b>{split.confirmed.count}건</b></li>
                        <li><span className={`${styles.legendDot} ${styles.fillBlue}`} aria-hidden="true" /><span>확정 대기</span><span className={styles.legendPct}>{Math.round(pct(split.waiting.count))}%</span><b>{split.waiting.count}건</b></li>
                        {other > 0 && <li><span className={`${styles.legendDot} ${styles.fillGray}`} aria-hidden="true" /><span>그 밖</span><span className={styles.legendPct}>{Math.round(pct(other))}%</span><b>{other}건</b></li>}
                    </ul>
                </section>

                <section className={styles.card} aria-labelledby="dashboard-recent-title">
                    <CardHead id="dashboard-recent-title" title="최근 예약" to="/admin/reservations" />
                    {!availability.bookings && data && <p className={styles.partialFlat}>불러온 예약만 표시합니다. 일부 예약 자료는 확인이 필요합니다.</p>}
                    <ul className={styles.plainList}>
                        {recent.map(b => {
                            const look = bookingLook(b);
                            return <li key={b.key}>
                                <Link to={b.href} className={styles.personRow}>
                                    <span className={`${styles.roundIcon} ${look.tone}`} aria-hidden="true">{look.icon}</span>
                                    <span className={styles.personBody}>
                                        <b>{b.customerName || '이름 미정'}</b>
                                        <span>{b.type === 'quote_booking' ? '견적 예약' : '상품 예약'} · {b.productName || '상품 미정'} · <span aria-hidden="true">{shortDay(b.startDate)}</span>
                                            <span className={styles.srOnly}>여행 기간 {dashboardPeriod(b.startDate, b.endDate)}</span></span>
                                    </span>
                                    <span className={styles.personEnd}>
                                        <b aria-label={`팀 금액 ${dashboardNumber(b.totalAmount)}${b.totalAmount != null ? '원' : ''}`}>{dashboardWon(b.totalAmount)}</b>
                                        <span className={look.tone}>{b.statusLabel || b.status || '상태 미정'}</span>
                                    </span>
                                </Link>
                            </li>;
                        })}
                    </ul>
                    {!recent.length && <SectionState loading={initialLoading} complete={availability.bookings} error={error} empty="접수된 예약이 없습니다." />}
                </section>

                <section className={styles.card} aria-labelledby="dashboard-inquiries-title">
                    <CardHead id="dashboard-inquiries-title" title="견적 문의" to="/admin/quote-desk/inbox"
                        count={data ? dashboardNumber(metrics?.newQuotes) : undefined} countLabel={metricLabel('답변 대기 견적', metrics?.newQuotes, '건')} />
                    {!availability.inquiries && data && <p className={styles.partialFlat}>불러온 문의만 표시합니다. 일부 문의 자료는 확인이 필요합니다.</p>}
                    <ul className={styles.plainList}>
                        {pendingInquiries.slice(0, 4).map(inquiry => {
                            const received = dashboardSeoulDate(inquiry.createdAt);
                            const name = inquiry.name || '이름 미정';
                            return <li key={inquiry.key}>
                                <Link to={inquiry.href} className={styles.personRow}>
                                    <span className={`${styles.roundIcon} ${styles.avatar}`} aria-hidden="true">{name.slice(0, 1)}</span>
                                    <span className={styles.personBody}>
                                        <b>{name}</b>
                                        <span>{inquiry.destination || '희망 여행 미정'} · {inquiry.type === 'quote_request' ? '맞춤 견적' : '기존 견적'} · {received ? received.slice(5).replace('-', '.') : '접수일 미정'}</span>
                                    </span>
                                    <span className={`${styles.pill} ${inquiry.statusLabel === '신규' || inquiry.status === 'new' ? styles.toneBlue : styles.toneAccent}`}>{inquiry.statusLabel || inquiry.status || '답변 대기'}</span>
                                </Link>
                            </li>;
                        })}
                    </ul>
                    {!pendingInquiries.length && <SectionState loading={initialLoading} complete={availability.inquiries} error={error} empty="답변을 기다리는 문의가 없습니다." />}
                </section>
            </div>
        </div>
    </div>;
}

const DUE_CLASS = { danger: styles.toneDanger, accent: styles.toneAccent, neutral: styles.toneGray } as const;
const STATUS_CLASS = { danger: styles.statusDanger, info: styles.statusInfo, neutral: styles.statusNeutral } as const;

function QueueRow({ row }: { row: DashboardQueueRow }) {
    return <li className={`${styles.queueGrid} ${styles.queueRow}`}>
        <span className={styles.dueCell}><span className={`${styles.due} ${DUE_CLASS[row.dueTone]}`}>{row.due}</span></span>
        <span className={styles.who}>
            <b>{row.name}</b>
            {row.product && <span>{row.product}</span>}
        </span>
        <span className={styles.period} aria-label={`여행 기간 ${row.periodLabel}`}>{row.period}</span>
        <span className={styles.category}>{row.category}</span>
        <span className={`${styles.status} ${STATUS_CLASS[row.statusTone]}`}><span className={styles.statusDot} aria-hidden="true" />{row.status}</span>
        <span className={styles.actionCell}>
            <AdminButton to={row.href} size="sm" variant={row.overdue ? 'weak' : 'secondary'} fullWidth>{row.action}</AdminButton>
        </span>
    </li>;
}

export const AdminDashboard: React.FC = () => {
    const workspace = useAdminWorkspace();
    const traffic = useAdminTraffic();
    // 시안 A: 화면 제목 대신 본문 머리(인사말·조회 시각·견적서 작성)를 그린다. 위치 표시와 휴대폰 아래 메뉴는 그대로.
    return <AdminLayout activePage="dashboard" title="대시보드" description="상품과 견적 예약의 오늘 업무를 함께 확인합니다." headingInBody>
        <AdminDashboardBody {...workspace} traffic={traffic} />
    </AdminLayout>;
};
