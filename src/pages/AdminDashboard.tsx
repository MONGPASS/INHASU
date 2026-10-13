import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { fetchQuoteDeskRequests, quoteDeskHref, type QuoteDeskRequest } from '../components/admin/quoteDesk';

type Reservation = {
    id: string;
    status?: string;
    createdAt?: string;
    customerName?: string;
    productName?: string;
    confirmedPrice?: number;
};

type Quote = {
    id: string;
    status?: string;
    name?: string;
    destination?: string;
    createdAt?: string;
    created_at?: string;
};

type Guide = {
    id: string;
    name?: string;
    status?: string;
    image?: string;
};

const STATUS_BADGE: Record<string, { label: string; tone: string }> = {
    new: { label: '신규 견적', tone: 'b-purple' },
    processing: { label: '견적 작성중', tone: 'b-amber' },
    answered: { label: '견적 발송됨', tone: 'b-blue' },
    reservation_requested: { label: '예약 요청됨', tone: 'b-purple' },
    pending_payment: { label: '입금 대기', tone: 'b-amber' },
    paid: { label: '결제 완료', tone: 'b-blue' },
    confirmed: { label: '예약 확정', tone: 'b-green' },
    completed: { label: '여행 완료', tone: 'b-gray' },
    cancelled: { label: '취소됨', tone: 'b-gray' },
};

const AV_TONES = ['tint-blue', 'tint-purple', 'tint-green', 'tint-amber', 'tint-ink'];
const avTone = (name: string) => AV_TONES[(name.charCodeAt(0) || 0) % AV_TONES.length];

const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};
const formatNumber = (value: number) => new Intl.NumberFormat('ko-KR').format(value);

export const AdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [guides, setGuides] = useState<Guide[]>([]);
    // 맞춤 견적(견적 데스크) 문의 — 설정되지 않았거나 불러오지 못하면 null 로 두고 카드를 숨긴다.
    const [deskRequests, setDeskRequests] = useState<QuoteDeskRequest[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchQuoteDeskRequests().then((items) => {
            if (!cancelled) setDeskRequests(items);
        });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setErrorMessage('');
            try {
                const [reservationData, quoteData, guideData] = await Promise.all([
                    api.reservations.list(),
                    api.quotes.list(),
                    api.guides.list(),
                ]);
                setReservations((reservationData || []).map((item: any) => ({
                    ...item,
                    createdAt: item.createdAt || item.created_at,
                    customerName: item.customerName || item.customer_name || '이름 없음',
                    productName: item.productName || item.product_name || '상품 미정',
                    confirmedPrice: item.confirmedPrice || item.confirmed_price || 0,
                })));
                setQuotes(quoteData || []);
                setGuides(guideData || []);
            } catch (error) {
                console.error('Failed to fetch dashboard data', error);
                setErrorMessage('대시보드 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const metrics = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const todayReservations = reservations.filter((item) => item.createdAt?.startsWith(today)).length;
        const unpaidReservations = reservations.filter((item) => item.status === 'pending_payment').length;
        const newQuotes = quotes.filter((item) => item.status === 'pending' || item.status === 'new').length;
        const ongoingTours = reservations.filter((item) => item.status === 'confirmed').length;
        const confirmedSales = reservations
            .filter((item) => item.status === 'confirmed' || item.status === 'completed' || item.status === 'paid')
            .reduce((sum, item) => sum + Number(item.confirmedPrice || 0), 0);
        return { todayReservations, unpaidReservations, newQuotes, ongoingTours, confirmedSales };
    }, [reservations, quotes]);

    const recentReservations = reservations.slice(0, 6);
    const recentQuotes = quotes.slice(0, 3);
    // 견적 문의는 서버가 접수 최신순으로 내려 준다. 상태가 비어 있으면 신규로 본다(견적 관리 화면과 같은 기준).
    const isNewDeskRequest = (item: QuoteDeskRequest) => (item.status || '신규') === '신규';
    const deskNewCount = (deskRequests || []).filter(isNewDeskRequest).length;
    const deskRecent = (deskRequests || []).slice(0, 3);
    const deskInboxHref = quoteDeskHref('inbox');

    const metricCards = [
        { ico: 'today', tint: 'tint-blue', label: '오늘 신규 예약', value: `${metrics.todayReservations}`, unit: '건' },
        { ico: 'request_quote', tint: 'tint-purple', label: '새 견적 요청', value: `${metrics.newQuotes}`, unit: '건' },
        { ico: 'payments', tint: 'tint-amber', label: '입금 대기', value: `${metrics.unpaidReservations}`, unit: '건' },
        { ico: 'paid', tint: 'tint-green', label: '확정 매출', value: formatNumber(metrics.confirmedSales), unit: '원' },
    ];
    const quickLinks = [
        { t: '견적 응답 대기', s: '신규·작성중 견적', v: metrics.newQuotes, ico: 'mark_email_unread', tint: 'tint-purple', go: '/admin/quotes' },
        { t: '입금 확인 필요', s: '예약금 미입금', v: metrics.unpaidReservations, ico: 'account_balance', tint: 'tint-amber', go: '/admin/reservations' },
        { t: '투어 캘린더', s: '확정 투어 일정', v: metrics.ongoingTours, ico: 'calendar_today', tint: 'tint-blue', go: '/admin/calendar' },
    ];

    return (
        <AdminLayout
            activePage="dashboard"
            title="대시보드"
            actions={
                <button type="button" className="btn btn-ink" onClick={() => navigate('/admin/quotes')}>
                    <Icon name="request_quote" />견적 확인
                </button>
            }
        >
            <div className="stack route-anim">
                {errorMessage && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 'var(--r-md)', background: 'var(--mrt-red-soft)',
                        color: 'var(--mrt-red)', fontSize: 13, fontWeight: 600,
                    }}>{errorMessage}</div>
                )}

                <section className="metric-grid">
                    {metricCards.map((m, i) => (
                        <div className="metric" key={i}>
                            <div className="metric-top">
                                <span className={`metric-ico ${m.tint}`}><Icon name={m.ico} fill /></span>
                            </div>
                            <div className="metric-label">{m.label}</div>
                            <div className="metric-value">{isLoading ? '-' : m.value}{m.unit && <small>{m.unit}</small>}</div>
                        </div>
                    ))}
                </section>

                <section className="grid-3">
                    {quickLinks.map((q, i) => (
                        <button className="qlink" key={i} onClick={() => navigate(q.go)}>
                            <span className={`qi ${q.tint}`}><Icon name={q.ico} fill /></span>
                            <span className="qtext"><span className="qt">{q.t}</span><span className="qs">{q.s}</span></span>
                            <span className="qv">{q.v}</span>
                            <Icon name="chevron_right" className="arr" />
                        </button>
                    ))}
                </section>

                <section className="grid-2">
                    <div className="card">
                        <div className="card-head">
                            <h2>최근 예약</h2><div className="spacer" />
                            <button className="link-action" onClick={() => navigate('/admin/reservations')}>전체 보기<Icon name="chevron_right" /></button>
                        </div>
                        <div className="tbl-wrap">
                            <table className="tbl">
                                <thead><tr><th>예약번호</th><th>고객</th><th>상품</th><th>상태</th><th className="r">금액</th></tr></thead>
                                <tbody>
                                    {recentReservations.map((r) => {
                                        const s = STATUS_BADGE[r.status || ''] || { label: r.status || '-', tone: 'b-gray' };
                                        return (
                                            <tr key={r.id} onClick={() => navigate('/admin/reservations')}>
                                                <td className="cell-mono">#{r.id.slice(0, 6)}</td>
                                                <td>
                                                    <div className="av-cell">
                                                        <span className={`avatar round ${avTone(r.customerName || '?')}`}>{(r.customerName || '?').slice(0, 2)}</span>
                                                        <span className="cell-strong">{r.customerName}</span>
                                                    </div>
                                                </td>
                                                <td className="cell-muted" style={{ maxWidth: 240 }}>
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.productName}</div>
                                                </td>
                                                <td><span className={`badge ${s.tone}`}>{s.label}</span></td>
                                                <td className="r cell-price">{r.confirmedPrice ? `${formatNumber(r.confirmedPrice)}원` : '–'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {!isLoading && recentReservations.length === 0 && (
                                <div className="empty"><Icon name="inbox" /><p>최근 예약이 없습니다.</p></div>
                            )}
                        </div>
                    </div>

                    <div className="stack">
                        {deskRequests && (
                            <div className="card">
                                <div className="card-head">
                                    <h2>맞춤 견적</h2>
                                    <span className={`badge ${deskNewCount > 0 ? 'b-purple' : 'b-gray'}`}>신규 {deskNewCount}건</span>
                                    <div className="spacer" />
                                    <button className="link-action" onClick={() => navigate(deskInboxHref)}>견적 문의<Icon name="chevron_right" /></button>
                                </div>
                                <div style={{ padding: 12 }}>
                                    {deskRecent.map((q) => (
                                        <button key={q.id} className="qlink" style={{ marginBottom: 8, padding: '13px 14px', width: '100%' }} onClick={() => navigate(deskInboxHref)}>
                                            <span className="qi tint-green" style={{ width: 40, height: 40 }}><Icon name="request_quote" fill /></span>
                                            <span className="qtext"><span className="qt">{q.name || '이름 없음'}</span>
                                                <span className="qs">{q.destination || '희망 투어 미정'} · {formatDate(q.receivedAt)} 접수</span></span>
                                            {isNewDeskRequest(q) && <span className="badge b-purple">신규</span>}
                                            <Icon name="chevron_right" className="arr" />
                                        </button>
                                    ))}
                                    {deskRecent.length === 0 && (
                                        <div className="empty" style={{ padding: '28px 20px' }}><Icon name="inbox" /><p>접수된 견적 문의가 없습니다.</p></div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="card">
                            <div className="card-head"><h2>새 견적 요청</h2><div className="spacer" />
                                <button className="link-action" onClick={() => navigate('/admin/quotes')}>견적 관리<Icon name="chevron_right" /></button></div>
                            <div style={{ padding: 12 }}>
                                {recentQuotes.map((q) => (
                                    <button key={q.id} className="qlink" style={{ marginBottom: 8, padding: '13px 14px' }} onClick={() => navigate('/admin/quotes')}>
                                        <span className="qi tint-purple" style={{ width: 40, height: 40 }}><Icon name="request_quote" fill /></span>
                                        <span className="qtext"><span className="qt">{q.name || '이름 없음'}</span>
                                            <span className="qs">{q.destination || '목적지 미정'} · {formatDate(q.createdAt || q.created_at)}</span></span>
                                        <Icon name="chevron_right" className="arr" />
                                    </button>
                                ))}
                                {!isLoading && recentQuotes.length === 0 && (
                                    <div className="empty" style={{ padding: '28px 20px' }}><Icon name="inbox" /><p>대기 중인 견적 요청이 없습니다.</p></div>
                                )}
                            </div>
                        </div>

                        <div className="card">
                            <div className="card-head"><h2>가이드 현황</h2><div className="spacer" />
                                <button className="link-action" onClick={() => navigate('/admin/guides')}>가이드 관리<Icon name="chevron_right" /></button></div>
                            <div style={{ padding: '8px 18px 14px' }}>
                                {guides.slice(0, 5).map((g, i) => (
                                    <div key={g.id} className="row" style={{ padding: '9px 0', borderBottom: i < Math.min(guides.length, 5) - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                                        {g.image
                                            ? <img className="avatar round" src={g.image} alt={g.name || '가이드'} />
                                            : <span className={`avatar round ${avTone(g.name || '?')}`}>{(g.name || '?').slice(0, 2)}</span>}
                                        <div style={{ minWidth: 0 }}>
                                            <div className="cell-strong">{g.name || '이름 없음'}</div>
                                        </div>
                                        <div className="spacer" style={{ flex: 1 }} />
                                        <span className={`badge ${g.status === '활동중' ? 'b-green' : 'b-gray'}`}>{g.status || '대기'}</span>
                                    </div>
                                ))}
                                {!isLoading && guides.length === 0 && (
                                    <div className="empty" style={{ padding: '28px 20px' }}><Icon name="person_off" /><p>등록된 가이드가 없습니다.</p></div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </AdminLayout>
    );
};
