import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useAdminWorkspace } from '../components/admin/AdminWorkspaceContext';
import { AdminTrafficPanel, type AdminTrafficReport } from '../components/admin/AdminTrafficPanel';
import { Icon } from '../components/admin/console/Icon';
import type { AdminWorkspaceData, AdminWorkTask } from '../types/adminWorkspace';
import { dashboardAvailability, dashboardDate, dashboardNumber, dashboardPeriod, dashboardStatusTone, dashboardTimestamp } from '../utils/adminDashboard';
import { dashboardOverview, type DashboardRevenueRange } from '../utils/adminDashboardOverview';
import styles from './AdminDashboard.module.css';

interface DashboardState {
    data: AdminWorkspaceData | null;
    loading: boolean;
    error: string;
    refresh: () => Promise<void>;
    trafficReports?: AdminTrafficReport[];
}

const taskIcons: Record<AdminWorkTask['kind'], string> = {
    deposit_report: 'account_balance', contract: 'description', assignment: 'groups', quote: 'request_quote',
};

function SectionState({ loading, complete, error, empty }: { loading: boolean; complete: boolean; error: string; empty: string }) {
    return <div className={`empty ${styles.empty}`} role={loading ? 'status' : undefined}>
        <Icon name={loading ? 'hourglass_empty' : complete ? 'inbox' : 'warning'} />
        <p>{loading ? '자료를 불러오고 있습니다.' : complete ? empty : error || '일부 자료를 불러오지 못했습니다. 다시 조회해 주세요.'}</p>
    </div>;
}

/** Primary metrics remain server-authoritative; details use the account-scoped snapshot. */
export function AdminDashboardBody({ data, loading, error, refresh, trafficReports }: DashboardState) {
    const [revenueRange, setRevenueRange] = useState<DashboardRevenueRange>('all');
    const [taskKind, setTaskKind] = useState<'all' | AdminWorkTask['kind']>('all');
    const [recentStatus, setRecentStatus] = useState<'all' | 'waiting' | 'confirmed'>('all');
    const overview = dashboardOverview(data, revenueRange);
    const availability = dashboardAvailability(data);
    const initialLoading = loading && !data;
    const metrics = data?.metrics;
    const bookings = data?.bookings.slice(0, 6) || [];
    const inquiries = data?.inquiries.filter(inquiry => inquiry.pending).slice(0, 5) || [];
    const filteredTasks = data?.tasks.filter(task => taskKind === 'all' || task.kind === taskKind) || [];
    const tasks = filteredTasks.slice(0, 7);
    const recentConfirmed = bookings.filter(booking => ['confirmed', 'paid', 'completed'].includes(booking.status)).length;
    const recentWaiting = bookings.filter(booking => !['confirmed', 'paid', 'completed', 'cancelled', 'on_hold'].includes(booking.status)).length;
    const recentRows = bookings.filter(booking => recentStatus === 'all' || (recentStatus === 'confirmed'
        ? ['confirmed', 'paid', 'completed'].includes(booking.status) : !['confirmed', 'paid', 'completed', 'cancelled', 'on_hold'].includes(booking.status)));
    const processed = data?.inquiries.filter(inquiry => !inquiry.pending).length || 0;
    const replyRate = availability.inquiries && data?.inquiries.length ? Math.round(processed / data.inquiries.length * 100) : null;
    const metricCards = [
        { label: '오늘 신규 예약', value: metrics?.todayReservations, unit: '건', note: '한국시간 접수 · 상품 + 견적 예약' },
        { label: '답변 대기 견적', value: metrics?.newQuotes, unit: '건', note: '신규·작성 중·상담 중 문의' },
    ] as const;
    const quickLinks = [
        { title: '입금 신고 확인', note: '고객이 입금을 알린 예약', value: metrics?.depositReports, icon: 'payment', fallback: 'account_balance',
            href: data?.tasks.find(task => task.kind === 'deposit_report')?.href || '/admin/reservations' },
        { title: '오늘 진행 중 투어', note: '여행 시작일·종료일 기준', value: metrics?.ongoingTours, icon: 'calendar', fallback: 'calendar_today', href: '/admin/calendar' },
        { title: '오늘 확인할 업무', note: availability.tasks ? '입금 · 계약 · 배정 · 견적' : '확인된 자료의 업무',
            value: data && availability.tasks ? data.tasks.length : null, icon: 'reservation', fallback: 'task_alt', href: data?.tasks[0]?.href || '/admin/reservations' },
    ] as const;
    return <div className={`stack route-anim ${styles.dashboard}`}>
        {(!data || error) && <div className={styles.refreshbar}>
            <div>
                <strong>{data ? `${dashboardDate(data.today)} · 한국시간 기준` : '오늘의 운영 현황'}</strong>
                <span>{data ? `최근 조회 ${dashboardTimestamp(data.generatedAt)}` : initialLoading ? '상품·견적 자료를 확인하고 있습니다.' : '운영 자료를 다시 조회해 주세요.'}</span>
            </div>
            <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => { void refresh(); }}>
                <Icon name="refresh" />{loading ? '조회 중…' : '새로고침'}
            </button>
        </div>}

        {error && <div className={styles.warning} role="alert">{error}{data && <span>마지막으로 불러온 자료를 표시하고 있습니다.</span>}</div>}
        {!!data?.warnings.length && <div className={styles.warning} role="status">
            <strong>일부 자료를 확인할 수 없습니다.</strong>
            <ul>{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            <span>확인되지 않은 집계는 —로 표시합니다.</span>
        </div>}

        <section className={styles.heroGrid} aria-label="통합 운영 집계" aria-busy={initialLoading}>
            <div className={styles.revenueCard}>
                <div className={styles.revenueHeader}><span>확정 매출</span>
                    <label className={styles.rangeControl}>매출 기간<select aria-label="매출 조회 기간" value={revenueRange} onChange={event => setRevenueRange(event.target.value as DashboardRevenueRange)}>
                        <option value="all">전체 기간</option><option value="month">이번 달</option><option value="30days">지난 30일</option><option value="year">올해</option>
                    </select></label></div>
                <div className={styles.revenueValue} aria-label={`확정 매출: ${dashboardNumber(overview.revenue)}${overview.revenue != null ? '원' : ''}`}>
                    {dashboardNumber(overview.revenue)}{overview.revenue != null && <small>원</small>}
                </div>
                <p>확정·결제·여행 완료 예약의 팀 전체 금액 · 예약 접수일 기준</p>
                <div className={styles.bookingSplitHead}><strong>예약 구분</strong><span>최근 예약 {availability.bookings ? `${bookings.length}건` : '조회 중'}</span></div>
                <div className={styles.bookingSplit} aria-label="최근 예약 구분">
                    <span style={{ flex: Math.max(1, recentConfirmed) }}>예약 확정 {availability.bookings ? recentConfirmed : '—'}</span>
                    <span style={{ flex: Math.max(1, recentWaiting) }}>확정 대기 {availability.bookings ? recentWaiting : '—'}</span>
                </div>
                {bookings.length - recentConfirmed - recentWaiting > 0 && <small className={styles.excludedBookings}>취소·보류 {bookings.length - recentConfirmed - recentWaiting}건 별도</small>}
            </div>
            <div className={styles.summaryCard}>
                {metricCards.map((card, index) => <div className={styles.summaryMetric} key={card.label}>
                    <div className={styles.summaryTop}><span className="metric-label">{card.label}</span></div>
                    <div className={styles.summaryBody}>
                        <div>
                            <div className="metric-value" aria-label={`${card.label}: ${dashboardNumber(card.value)}${card.value != null ? card.unit : ''}`}>
                                {dashboardNumber(card.value)}{card.value != null && <small>{card.unit}</small>}
                            </div>
                            {index === 1 && <p className={styles.pendingDeposit} aria-label={`입금 대기: ${dashboardNumber(metrics?.unpaidReservations)}${metrics?.unpaidReservations != null ? '건' : ''}`}>입금 대기 <strong>{dashboardNumber(metrics?.unpaidReservations)}</strong>건</p>}
                        </div>
                        {index === 0 ? <div className={styles.miniBars} aria-label="최근 7일 예약 접수">
                        {overview.days.map((day, dayIndex) => <span key={`${day.key}-${dayIndex}`} title={`${day.label}: ${dashboardNumber(day.count)}건`} aria-label={`${day.label}: ${dashboardNumber(day.count)}건`}><i style={{ height: `${day.count == null ? 0 : Math.max(day.count > 0 ? 8 : 0, day.count / Math.max(1, ...overview.days.map(row => row.count || 0)) * 100)}%` }} /><small>{day.label}</small></span>)}
                        </div> : <div className={styles.replyRing} title="조회된 견적 문의 중 답변 대기가 아닌 문의의 비율" aria-label={`조회된 문의 처리율 ${replyRate == null ? '확인 필요' : `${replyRate}%`}`}><svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="26" fill="none" stroke="var(--mrt-blue-50)" strokeWidth="7" /><circle cx="32" cy="32" r="26" fill="none" stroke="var(--mrt-blue)" strokeWidth="7" strokeLinecap="round" pathLength="100" transform="rotate(-90 32 32)" strokeDasharray={`${replyRate || 0} 100`} /></svg><span>{replyRate == null ? '—' : `${replyRate}%`}</span></div>}
                    </div>
                    <p className={styles.metricNote}>{card.value == null ? initialLoading ? '집계 중…' : '자료 확인 필요' : card.note}</p>
                    <Link className={styles.summaryLink} to={index === 0 ? '/admin/reservations' : '/admin/quote-desk/inbox'}>자세히 보기<Icon name="arrow_forward" /></Link>
                </div>)}
            </div>
        </section>

        <section className={styles.overviewGrid} aria-label="유입 경로와 최근 견적 요청">
            <AdminTrafficPanel reports={trafficReports} />
            <div className="card">
                <div className="card-head"><h2>최근 견적 요청</h2><div className="spacer" /><span className={styles.sourceHint}>접수일 최신순</span></div>
                {!availability.inquiries && data && <p className={styles.partial}>불러온 문의만 표시합니다. 일부 문의 자료는 확인이 필요합니다.</p>}
                <div className={styles.list}>{inquiries.map(inquiry => <Link key={inquiry.key} className={styles.listItem} to={inquiry.href}>
                    <span className={styles.listText}><strong>{inquiry.name || '이름 미정'}<small>{inquiry.phone}</small><span className="badge b-blue">{inquiry.statusLabel || inquiry.status}</span></strong>
                        <span>{inquiry.destination || '희망 여행 미정'}</span><small>{dashboardTimestamp(inquiry.createdAt)} · {inquiry.type === 'quote_request' ? '맞춤 견적' : '기존 견적'}</small></span><Icon name="chevron_right" />
                </Link>)}{!inquiries.length && <SectionState loading={initialLoading} complete={availability.inquiries} error={error} empty="답변을 기다리는 문의가 없습니다." />}</div>
                <Link className={styles.cardFooterLink} to="/admin/quote-desk/inbox">견적 문의 전체 보기<Icon name="arrow_forward" /></Link>
            </div>
        </section>

        <section className={`grid-2 ${styles.mainGrid}`}>
            <div className="stack">
                <div className="card" id="dashboard-tasks">
                    <div className="card-head"><h2>오늘 확인할 업무</h2>{data && <span className="badge b-gray">{availability.tasks ? `${data.tasks.length}건` : '일부 자료'}</span>}</div>
                    <div className={styles.workShortcuts} aria-label="업무 바로가기">{quickLinks.map(link => <Link key={link.title} to={link.href}>{link.title}<strong>{dashboardNumber(link.value)}</strong></Link>)}</div>
                    <div className={styles.taskTabs} aria-label="업무 종류">{([
                        ['all', '전체'], ['deposit_report', '입금'], ['contract', '계약'], ['assignment', '배정'], ['quote', '견적'],
                    ] as const).map(([kind, label]) => <button key={kind} type="button" aria-pressed={taskKind === kind} onClick={() => setTaskKind(kind)}>{label}</button>)}</div>
                    {!availability.tasks && data && <p className={styles.partial}>확인된 업무만 표시합니다. 불러오지 못한 자료에 추가 업무가 있을 수 있습니다.</p>}
                    <div className={styles.list}>{tasks.map(task => <Link key={task.key} className={styles.listItem} to={task.href}>
                        <span className={`qi ${task.priority === 'urgent' ? 'tint-amber' : 'tint-blue'}`}><Icon name={taskIcons[task.kind]} /></span>
                        <span className={styles.listText}><strong>{task.title}</strong><span>{task.description}</span></span>
                        {task.priority === 'urgent' && <span className="badge b-amber">우선 확인</span>}<Icon name="chevron_right" />
                    </Link>)}
                        {!tasks.length && <SectionState loading={initialLoading} complete={availability.tasks} error={error} empty="확인이 필요한 업무가 없습니다." />}
                    </div>
                    {filteredTasks.length > tasks.length && <p className={styles.more}>{tasks.length}건 표시 · 총 {filteredTasks.length}건</p>}
                </div>

            </div>

            <div className="card">
                <div className="card-head"><h2>최근 통합 예약</h2><span className={`badge b-gray ${styles.sourceHint}`}>상품 · 견적</span><div className="spacer" />
                    <Link className="link-action" to="/admin/reservations">전체 보기<Icon name="chevron_right" /></Link></div>
                <div className={styles.recentFilters} aria-label="최근 예약 상태">{([
                    ['all', '전체', bookings.length], ['waiting', '확정 대기', recentWaiting], ['confirmed', '예약 확정', recentConfirmed],
                ] as const).map(([key, label, count]) => <button type="button" key={key} aria-pressed={recentStatus === key} onClick={() => setRecentStatus(key)}>{label}<span>{availability.bookings ? count : '—'}</span></button>)}</div>
                {!availability.bookings && data && <p className={styles.partial}>불러온 예약만 표시합니다. 일부 예약 자료는 확인이 필요합니다.</p>}
                <div className="tbl-wrap"><table className={`tbl ${styles.recentTable}`}>
                    <thead><tr><th>고객 · 상품</th><th>여행 기간</th><th className="r">팀 금액</th><th>상태</th></tr></thead>
                    <tbody>{recentRows.map(booking => <tr key={booking.key}>
                        <td><div className={styles.recentCustomer}><span className={styles.customerAvatar} aria-hidden="true">{(booking.customerName || '?').slice(0, 1)}</span><span className={styles.customerCell}><Link to={booking.href} className={styles.customerName}>{booking.customerName || '이름 미정'}</Link>
                            <span className={styles.productName}>{booking.productName || '상품 미정'}</span><small>{booking.type === 'quote_booking' ? '견적 예약' : '상품 예약'} · {booking.reservationNumber || `#${booking.id.slice(0, 8)}`}</small></span></div></td>
                        <td><span className={styles.period}>{dashboardPeriod(booking.startDate, booking.endDate)}</span></td>
                        <td className="r cell-price">{dashboardNumber(booking.totalAmount)}{booking.totalAmount != null && '원'}</td>
                        <td><span className={`badge ${dashboardStatusTone(booking.status)}`}>{booking.statusLabel || booking.status || '상태 미정'}</span></td>
                    </tr>)}</tbody>
                </table>
                    {!recentRows.length && <SectionState loading={initialLoading} complete={availability.bookings} error={error} empty={recentStatus === 'all' ? '접수된 예약이 없습니다.' : '선택한 상태의 최근 예약이 없습니다.'} />}
                </div>
            </div>

        </section>
    </div>;
}

export const AdminDashboard: React.FC = () => {
    const workspace = useAdminWorkspace();
    return <AdminLayout activePage="dashboard" title="대시보드" description={`상품과 견적 예약의 오늘 업무를 함께 확인합니다.${workspace.data ? ` ${dashboardDate(workspace.data.today)} · 한국시간 기준` : ''}`}
        actions={<button className="btn btn-ghost" type="button" disabled={workspace.loading} onClick={() => { void workspace.refresh(); }}><Icon name="refresh" />새로고침</button>}>
        <AdminDashboardBody {...workspace} />
    </AdminLayout>;
};
