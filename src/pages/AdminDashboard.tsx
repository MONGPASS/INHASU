import React from 'react';
import { Link } from 'react-router-dom';
import { AdminLayout } from '../components/admin/AdminLayout';
import { useAdminWorkspace } from '../components/admin/AdminWorkspaceContext';
import { Admin3DIcon } from '../components/admin/Admin3DIcon';
import { Icon } from '../components/admin/console/Icon';
import type { AdminWorkspaceData, AdminWorkTask } from '../types/adminWorkspace';
import { dashboardAvailability, dashboardDate, dashboardNumber, dashboardPeriod, dashboardStatusTone, dashboardTimestamp } from '../utils/adminDashboard';
import styles from './AdminDashboard.module.css';

interface DashboardState {
    data: AdminWorkspaceData | null;
    loading: boolean;
    error: string;
    refresh: () => Promise<void>;
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

/** Shared workspace data is presented as received; counts are never recalculated here. */
export function AdminDashboardBody({ data, loading, error, refresh }: DashboardState) {
    const availability = dashboardAvailability(data);
    const initialLoading = loading && !data;
    const metrics = data?.metrics;
    const bookings = data?.bookings.slice(0, 6) || [];
    const inquiries = data?.inquiries.filter(inquiry => inquiry.pending).slice(0, 5) || [];
    const tasks = data?.tasks.slice(0, 7) || [];
    const metricCards = [
        { icon: 'reservation', fallback: 'today', label: '오늘 신규 예약', value: metrics?.todayReservations, unit: '건', note: '한국시간 접수 · 상품 + 견적 예약' },
        { icon: 'message', fallback: 'request_quote', label: '답변 대기 견적', value: metrics?.newQuotes, unit: '건', note: '신규·작성 중·상담 중 문의' },
        { icon: 'payment', fallback: 'payments', label: '입금 대기', value: metrics?.unpaidReservations, unit: '건', note: '상품 + 견적 예약' },
        { icon: 'achievement', fallback: 'paid', label: '확정 매출', value: metrics?.confirmedSales, unit: '원', note: '확정·결제·완료 예약의 팀 전체 금액' },
    ] as const;
    const quickLinks = [
        { title: '입금 신고 확인', note: '고객이 입금을 알린 예약', value: metrics?.depositReports, icon: 'payment', fallback: 'account_balance',
            href: data?.tasks.find(task => task.kind === 'deposit_report')?.href || '/admin/reservations' },
        { title: '오늘 진행 중 투어', note: '여행 시작일·종료일 기준', value: metrics?.ongoingTours, icon: 'calendar', fallback: 'calendar_today', href: '/admin/calendar' },
        { title: '오늘 확인할 업무', note: availability.tasks ? '입금 · 계약 · 배정 · 견적' : '확인된 자료의 업무',
            value: data && availability.tasks ? data.tasks.length : null, icon: 'reservation', fallback: 'task_alt', href: data?.tasks[0]?.href || '/admin/reservations' },
    ] as const;
    return <div className={`stack route-anim ${styles.dashboard}`}>
        <div className={styles.refreshbar}>
            <div>
                <strong>{data ? `${dashboardDate(data.today)} · 한국시간 기준` : '오늘의 운영 현황'}</strong>
                <span>{data ? `최근 조회 ${dashboardTimestamp(data.generatedAt)}` : initialLoading ? '상품·견적 자료를 확인하고 있습니다.' : '운영 자료를 다시 조회해 주세요.'}</span>
            </div>
            <button type="button" className="btn btn-ghost" disabled={loading} onClick={() => { void refresh(); }}>
                <Icon name="refresh" />{loading ? '조회 중…' : '새로고침'}
            </button>
        </div>

        {error && <div className={styles.warning} role="alert">{error}{data && <span>마지막으로 불러온 자료를 표시하고 있습니다.</span>}</div>}
        {!!data?.warnings.length && <div className={styles.warning} role="status">
            <strong>일부 자료를 확인할 수 없습니다.</strong>
            <ul>{data.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
            <span>확인되지 않은 집계는 —로 표시합니다.</span>
        </div>}

        <section className={`metric-grid ${styles.metrics}`} aria-label="통합 운영 집계" aria-busy={initialLoading}>
            {metricCards.map(card => <div className="metric" key={card.label}>
                <div className="metric-top"><span className={`metric-ico ${styles.artworkSlot}`}><Admin3DIcon name={card.icon} fallback={card.fallback} size={44} /></span></div>
                <div className="metric-label">{card.label}</div>
                <div className="metric-value" aria-label={`${card.label}: ${dashboardNumber(card.value)}${card.value != null ? card.unit : ''}`}>
                    {dashboardNumber(card.value)}{card.value != null && <small>{card.unit}</small>}
                </div>
                <p className={styles.metricNote}>{card.value == null ? initialLoading ? '집계 중…' : '자료 확인 필요' : card.note}</p>
            </div>)}
        </section>

        <section className={`grid-3 ${styles.quicklinks}`} aria-label="업무 바로가기">
            {quickLinks.map(link => <Link key={link.title} className={`qlink ${styles.quicklink}`} to={link.href}>
                <span className={`qi ${styles.artworkSlot}`}><Admin3DIcon name={link.icon} fallback={link.fallback} size={40} /></span>
                <span className="qtext"><span className="qt">{link.title}</span><span className="qs">{link.note}</span></span>
                <span className="qv">{dashboardNumber(link.value)}</span><Icon name="chevron_right" className="arr" />
            </Link>)}
        </section>

        <section className={`grid-2 ${styles.mainGrid}`}>
            <div className="card">
                <div className="card-head"><h2>최근 통합 예약</h2><span className={`badge b-gray ${styles.sourceHint}`}>상품 · 견적</span><div className="spacer" />
                    <Link className="link-action" to="/admin/reservations">전체 보기<Icon name="chevron_right" /></Link></div>
                {!availability.bookings && data && <p className={styles.partial}>불러온 예약만 표시합니다. 일부 예약 자료는 확인이 필요합니다.</p>}
                <div className="tbl-wrap"><table className="tbl">
                    <thead><tr><th>예약</th><th>고객 · 상품</th><th>여행 기간</th><th>상태</th><th className="r">팀 금액</th></tr></thead>
                    <tbody>{bookings.map(booking => <tr key={booking.key}>
                        <td><span className={`badge ${booking.type === 'quote_booking' ? 'b-purple' : 'b-blue'}`}>{booking.type === 'quote_booking' ? '견적 예약' : '상품 예약'}</span>
                            <Link className={styles.bookingNumber} to={booking.href}>{booking.reservationNumber || `#${booking.id.slice(0, 8)}`}</Link></td>
                        <td className={styles.customerCell}><Link to={booking.href} className={styles.customerName}>{booking.customerName || '이름 미정'}</Link>
                            <span className={styles.productName}>{booking.productName || '상품 미정'}</span></td>
                        <td><span className={styles.period}>{dashboardPeriod(booking.startDate, booking.endDate)}</span></td>
                        <td><span className={`badge ${dashboardStatusTone(booking.status)}`}>{booking.statusLabel || booking.status || '상태 미정'}</span></td>
                        <td className="r cell-price">{dashboardNumber(booking.totalAmount)}{booking.totalAmount != null && '원'}</td>
                    </tr>)}</tbody>
                </table>
                    {!bookings.length && <SectionState loading={initialLoading} complete={availability.bookings} error={error} empty="접수된 예약이 없습니다." />}
                </div>
            </div>

            <div className="stack">
                <div className="card" id="dashboard-tasks">
                    <div className="card-head"><h2>오늘 확인할 업무</h2>{data && <span className="badge b-gray">{availability.tasks ? `${data.tasks.length}건` : '일부 자료'}</span>}</div>
                    {!availability.tasks && data && <p className={styles.partial}>확인된 업무만 표시합니다. 불러오지 못한 자료에 추가 업무가 있을 수 있습니다.</p>}
                    <div className={styles.list}>{tasks.map(task => <Link key={task.key} className={styles.listItem} to={task.href}>
                        <span className={`qi ${task.priority === 'urgent' ? 'tint-amber' : 'tint-blue'}`}><Icon name={taskIcons[task.kind]} /></span>
                        <span className={styles.listText}><strong>{task.title}</strong><span>{task.description}</span></span>
                        {task.priority === 'urgent' && <span className="badge b-amber">우선 확인</span>}<Icon name="chevron_right" />
                    </Link>)}
                        {!tasks.length && <SectionState loading={initialLoading} complete={availability.tasks} error={error} empty="확인이 필요한 업무가 없습니다." />}
                    </div>
                    {data && data.tasks.length > tasks.length && <p className={styles.more}>{tasks.length}건 표시 · 총 {data.tasks.length}건</p>}
                </div>

                <div className="card">
                    <div className="card-head"><h2>답변 대기 문의</h2><div className="spacer" />
                        <Link className="link-action" to="/admin/quotes">전체 문의<Icon name="chevron_right" /></Link></div>
                    {!availability.inquiries && data && <p className={styles.partial}>불러온 문의만 표시합니다. 일부 문의 자료는 확인이 필요합니다.</p>}
                    <div className={styles.list}>{inquiries.map(inquiry => <Link key={inquiry.key} className={styles.listItem} to={inquiry.href}>
                        <span className="qi tint-purple"><Icon name="request_quote" /></span>
                        <span className={styles.listText}><strong>{inquiry.name || '이름 미정'}</strong>
                            <span>{inquiry.destination || '희망 여행 미정'}</span><small>{dashboardTimestamp(inquiry.createdAt)} · {inquiry.type === 'quote_request' ? '맞춤 견적' : '기존 견적'} · {inquiry.statusLabel || inquiry.status}</small></span>
                        <Icon name="chevron_right" />
                    </Link>)}
                        {!inquiries.length && <SectionState loading={initialLoading} complete={availability.inquiries} error={error} empty="답변을 기다리는 문의가 없습니다." />}
                    </div>
                </div>
            </div>
        </section>
    </div>;
}

export const AdminDashboard: React.FC = () => {
    const workspace = useAdminWorkspace();
    return <AdminLayout activePage="dashboard" title="대시보드" description="상품과 견적 예약의 오늘 업무를 함께 확인합니다."
        actions={<Link className="btn btn-ink" to="/admin/reservations"><Icon name="event_note" />예약 관리</Link>}>
        <AdminDashboardBody {...workspace} />
    </AdminLayout>;
};
