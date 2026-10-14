import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { keysToCamel, keysToSnake } from '../utils/mapKeys';
import { AdminLayout } from '../components/admin/AdminLayout';
import { Icon } from '../components/admin/console/Icon';
import { sendNotificationEmail } from '../lib/email';
import type { QuoteRequest } from '../components/admin/QuoteModals';
import { QuoteDetailModal, ConvertSelectionModal } from '../components/admin/QuoteModals';
import { won } from '../components/desktop-primitives/mwTokens';



// Local Modal definitions removed in favor of centralized QuoteModals.tsx


export const AdminQuoteManage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    // Filter States
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState('전체 상태');
    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 8;
    // Modal State
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

    // Data State
    const [requests, setRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch quotes from API
    const fetchQuotes = async () => {
        setLoading(true);
        try {
            const data = await api.quotes.list();

            if (Array.isArray(data)) {
                const mappedQuotes = data.map((q: any) => ({
                    ...keysToCamel(q),
                    date: new Date(q.created_at).toLocaleDateString()
                }));
                setRequests(mappedQuotes);
            }
        } catch (error) {
            console.error('Error fetching quotes:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchQuotes();
    }, []);

    useEffect(() => {
        const id = searchParams.get('open');
        if (!id || loading) return;
        const found = requests.find(request => String(request.id) === id);
        if (found) setSelectedRequest(found);
        else alert('요청한 견적 문의를 찾을 수 없습니다.');
        setSearchParams(current => { const next = new URLSearchParams(current); next.delete('open'); return next; }, { replace: true });
    }, [loading, requests, searchParams, setSearchParams]);

    // Handle Status Change
    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            await api.quotes.update(id, { status: newStatus, updated_at: new Date().toISOString() });

            // Reflect in local state
            setRequests(prev => prev.map(req =>
                req.id === id ? { ...req, status: newStatus } : req
            ));

        } catch (error) {
            console.error("Failed to update status:", error);
            alert("상태 변경 중 오류가 발생했습니다.");
        }
    };

    // Filter Logic
    const filteredRequests = useMemo(() => {
        return requests.filter(req => {
            const matchesSearch = req.name.includes(searchTerm) || req.destination.includes(searchTerm);
            const matchesStatus = filterStatus === '전체 상태' ||
                (filterStatus === '답변 대기' && req.status === 'new') ||
                (filterStatus === '상담 중' && req.status === 'processing') ||
                (filterStatus === '답변 완료' && req.status === 'answered') ||
                (filterStatus === '예약 전환' && req.status === 'converted') ||
                (filterStatus === '예약 요청' && req.status === 'reservation_requested');

            return matchesSearch && matchesStatus;
        });
    }, [searchTerm, filterStatus, requests]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
    const displayedRequests = filteredRequests.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    // Stats Logic
    const stats = useMemo(() => {
        return {
            total: requests.length,
            new: requests.filter(r => r.status === 'new').length,
            completed: requests.filter(r => r.status === 'answered' || r.status === 'converted').length
        };
    }, [requests]);

    const handleConvertToReservation = async (data: { startDate: string; endDate: string; totalAmount: number; deposit: number }) => {
        if (!selectedRequest) return;

        try {
            // 박수 계산
            const start = new Date(data.startDate);
            const end = new Date(data.endDate);
            const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            const durationText = `${diffDays}박 ${diffDays + 1}일`;

            // 1. 예약 생성 (예약금 입금 계좌는 공통 값 DEPOSIT_ACCOUNT로 안내하므로 예약마다 계좌 정보를 넣지 않는다)
            const newReservation = await api.reservations.create({
                user_id: selectedRequest.userId || null,
                type: 'quote',
                product_name: `${selectedRequest.destination} 맞춤견적`,
                customer_name: selectedRequest.name,
                customer_phone: selectedRequest.phone,
                customer_email: selectedRequest.email,
                total_people: selectedRequest.headcount,
                start_date: data.startDate,
                end_date: data.endDate,
                duration: durationText,
                status: 'pending_payment',
                price_breakdown: {
                    total: data.totalAmount,
                    deposit: data.deposit,
                    local: data.totalAmount - data.deposit
                },
                itinerary_template_id: selectedRequest.itineraryTemplateId || selectedRequest.itinerary_template_id || null,
                document_content: selectedRequest.documentContent
                    ? (typeof selectedRequest.documentContent === 'string' ? selectedRequest.documentContent : JSON.stringify(selectedRequest.documentContent))
                    : (selectedRequest.document_content || null),
            });

            const reservationNumber = newReservation.reservationNumber || newReservation.id?.slice(0, 8);

            // 3. 견적 상태 → converted
            const requestId = selectedRequest.id;
            await api.quotes.update(requestId, {
                status: 'converted',
                confirmed_price: data.totalAmount,
                deposit: data.deposit,
                confirmed_start_date: data.startDate,
                confirmed_end_date: data.endDate,
                updated_at: new Date().toISOString()
            });

            // 4. 고객에게 예약 확인 이메일 자동 발송
            try {
                await sendNotificationEmail(
                    selectedRequest.email,
                    'RESERVATION_REQUESTED',
                    {
                        customerName: selectedRequest.name,
                        productName: `${selectedRequest.destination} 맞춤견적 (${durationText})`,
                        reservationId: reservationNumber,
                        depositAmount: won(data.deposit),
                        customerPhone: selectedRequest.phone,
                        customerEmail: selectedRequest.email,
                    }
                );
            } catch (emailErr) {
                console.error('이메일 발송 실패:', emailErr);
            }

            setRequests(prev => prev.map(req =>
                req.id === requestId ? { ...req, status: 'converted' } : req
            ));
            setIsConvertModalOpen(false);
            setSelectedRequest(null);

            if (confirm(`예약 ${reservationNumber} 생성 완료!\n고객에게 확인 이메일을 발송했습니다.\n[예약 관리] 페이지로 이동하시겠습니까?`)) {
                navigate('/admin/reservations');
            }

        } catch (error: any) {
            console.error('예약 변환 오류:', error);
            alert(`예약 변환 중 오류가 발생했습니다: ${error.message || error}`);
        }
    };

    const handleSendEstimate = async (url: string, note: string, priceDetail: any, confirmedStartDate: string, confirmedEndDate: string, itineraryTemplateId?: string) => {
        if (!selectedRequest) return;
        const requestId = selectedRequest.id;

        try {
            // Update via API with confirmed values
            await api.quotes.update(requestId, {
                status: 'answered',
                admin_note: note,
                estimate_url: url,
                confirmed_price: priceDetail.totalAmount || null,
                deposit: priceDetail.deposit || null,
                confirmed_start_date: confirmedStartDate || null,
                confirmed_end_date: confirmedEndDate || null,
                itinerary_template_id: itineraryTemplateId || null,
                updated_at: new Date().toISOString()
            });

            // 2. Send email notification via Gmail SMTP
            try {
                await sendNotificationEmail(
                    selectedRequest.email,
                    'ESTIMATE_COMPLETED',
                    {
                        customerName: selectedRequest.name,
                        destination: selectedRequest.destination,
                        estimateUrl: url,
                        adminNote: note,
                        quoteId: requestId,
                        totalAmount: priceDetail.totalAmount,
                        userId: selectedRequest.userId,
                    }
                );
                console.log('Notification email sent successfully');
            } catch (emailError) {
                console.error('Failed to send notification email:', emailError);
            }

            alert(`견적 발송 완료!\n확정 금액: ${priceDetail.totalAmount ? won(priceDetail.totalAmount) : '미입력'}${url ? `\n견적서 링크: ${url}` : ''}\n고객에게 시스템 견적 페이지와 알림 메일이 발송되었습니다.`);

            // Reflect in local state
            setRequests(prev => prev.map(req =>
                req.id === requestId ? {
                    ...req,
                    status: 'answered',
                    adminNote: note,
                    estimateUrl: url,
                    confirmed_price: priceDetail.totalAmount || undefined,
                    deposit: priceDetail.deposit || undefined,
                    confirmed_start_date: confirmedStartDate || undefined,
                    confirmed_end_date: confirmedEndDate || undefined
                } : req
            ));

            setSelectedRequest(null);
        } catch (error) {
            console.error("Failed to send estimate:", error);
            alert("견적서 발송 처리 중 오류가 발생했습니다.");
        }
    };

    const handleUpdateQuote = async (id: string, updates: Partial<QuoteRequest>) => {
        try {
            const dbUpdates = {
                ...keysToSnake(updates as Record<string, unknown>),
                updated_at: new Date().toISOString(),
            };

            await api.quotes.update(id, dbUpdates);

            // Update local state
            setRequests(prev => prev.map(req =>
                req.id === id ? { ...req, ...updates } : req
            ));

            // Also update selectedRequest if it's the same
            if (selectedRequest && selectedRequest.id === id) {
                setSelectedRequest(prev => ({ ...prev, ...updates }));
            }

            return true;

        } catch (error: any) {
            console.error("Failed to update quote:", error);
            // 원인(Unauthorized/컬럼 없음 등)이 보여야 대처 가능 — 에러 메시지를 그대로 노출
            alert(`정보 수정 중 오류가 발생했습니다: ${error?.message || error}`);
            return false;
        }
    };

    // Map a quote status to a badge tone + label
    const STATUS_META: Record<string, { tone: string; label: string }> = {
        new: { tone: 'b-purple', label: '신규' },
        reservation_requested: { tone: 'b-purple', label: '예약 요청' },
        processing: { tone: 'b-amber', label: '작성중' },
        answered: { tone: 'b-blue', label: '발송됨' },
        converted: { tone: 'b-gray', label: '전환됨' },
        completed: { tone: 'b-gray', label: '답변완료' },
    };
    const statusMeta = (status: string) => STATUS_META[status] || { tone: 'b-gray', label: status };

    const StatusDropdown = ({ status, onChange }: { status: string, onChange: (s: QuoteRequest['status']) => void }) => {
        const [isOpen, setIsOpen] = useState(false);
        const dropdownRef = React.useRef<HTMLDivElement>(null);

        // Close dropdown when clicking outside
        React.useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                    setIsOpen(false);
                }
            };
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }, []);

        // status options shown in the dropdown menu (preserves original keys)
        const OPTIONS: Array<{ key: string; tone: string; label: string }> = [
            { key: 'pending_payment', tone: 'b-amber', label: '입금 대기' },
            { key: 'paid', tone: 'b-blue', label: '결제 완료' },
            { key: 'confirmed', tone: 'b-green', label: '예약 확정' },
            { key: 'cancelled', tone: 'b-red', label: '취소됨' },
            { key: 'converted', tone: 'b-gray', label: '예약 전환' },
            { key: 'reservation_requested', tone: 'b-purple', label: '예약 요청' },
        ];

        const current = OPTIONS.find(o => o.key === status) || statusMeta(status);

        const handleSelect = (newStatus: string) => {
            onChange(newStatus as any);
            setIsOpen(false);
        };

        return (
            <div className="statusdd" ref={dropdownRef}>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    className={`badge ${current.tone} statusdd-btn`}
                >
                    <span className="pulse" />
                    {current.label}
                    <Icon name="expand_more" />
                </button>

                {isOpen && (
                    <div className="statusdd-menu" onClick={(e) => e.stopPropagation()}>
                        {OPTIONS.map((opt) => (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => handleSelect(opt.key)}
                                className={`statusdd-item${status === opt.key ? ' on' : ''}`}
                            >
                                <span className={`sd-dot ${opt.tone}`} />
                                {opt.label}
                                {status === opt.key && <Icon name="check" style={{ marginLeft: 'auto', fontSize: 16 }} />}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    // Status filter chips (mirrors original select options + counts)
    const filters = useMemo(() => ([
        { id: '전체 상태', label: '전체', count: requests.length },
        { id: '답변 대기', label: '답변 대기', count: requests.filter(r => r.status === 'new').length },
        { id: '상담 중', label: '상담 중', count: requests.filter(r => r.status === 'processing').length },
        { id: '답변 완료', label: '답변 완료', count: requests.filter(r => r.status === 'answered').length },
        { id: '예약 요청', label: '예약 요청', count: requests.filter(r => r.status === 'reservation_requested').length },
        { id: '예약 전환', label: '예약 전환', count: requests.filter(r => r.status === 'converted').length },
    ]), [requests]);

    // Pagination helper to generate page numbers
    const getPageNumbers = () => {
        const pages: number[] = [];
        const maxDisplayed = 5; // Max page buttons to show
        let startPage = Math.max(1, currentPage - Math.floor(maxDisplayed / 2));
        const endPage = Math.min(totalPages, startPage + maxDisplayed - 1);

        if (endPage - startPage + 1 < maxDisplayed) {
            startPage = Math.max(1, endPage - maxDisplayed + 1);
        }

        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        return pages;
    };

    const headerActions = (
        <button type="button" className="btn btn-ghost" onClick={fetchQuotes}>
            <Icon name="refresh" />새로고침
        </button>
    );

    return (
        <AdminLayout activePage="reservations" title="맞춤견적 관리" actions={headerActions}>
            {/* Summary metrics */}
            <section className="metric-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 18 }}>
                <div className="metric">
                    <div className="metric-top">
                        <span className="metric-ico tint-purple"><Icon name="list_alt" fill /></span>
                    </div>
                    <div className="metric-label">전체 요청</div>
                    <div className="metric-value">{stats.total}<small>건</small></div>
                </div>
                <div className="metric">
                    <div className="metric-top">
                        <span className="metric-ico tint-amber"><Icon name="pending_actions" fill /></span>
                    </div>
                    <div className="metric-label">답변 대기</div>
                    <div className="metric-value">{stats.new}<small>건</small></div>
                </div>
                <div className="metric">
                    <div className="metric-top">
                        <span className="metric-ico tint-green"><Icon name="check_circle" fill /></span>
                    </div>
                    <div className="metric-label">완료된 견적</div>
                    <div className="metric-value">{stats.completed}<small>건</small></div>
                </div>
            </section>

            {/* Toolbar: search */}
            <div className="toolbar">
                <label className="tb-search">
                    <Icon name="search" />
                    <input
                        type="text"
                        placeholder="고객 이름 또는 여행지 검색"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </label>
                <div className="spacer" />
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => { setSearchTerm(''); setFilterStatus('전체 상태'); setCurrentPage(1); }}
                >
                    <Icon name="refresh" />초기화
                </button>
            </div>

            {/* Status filter chips */}
            <div className="chip-row" style={{ marginBottom: 18 }}>
                {filters.map(f => (
                    <button
                        key={f.id}
                        type="button"
                        className={`chip${filterStatus === f.id ? ' active' : ''}`}
                        onClick={() => { setFilterStatus(f.id); setCurrentPage(1); }}
                    >
                        {f.label}{f.count ? <span className="ct">{f.count}</span> : null}
                    </button>
                ))}
            </div>

            {/* Quote list card */}
            <div className="card">
                <div className="card-head">
                    <h2>견적 목록</h2>
                    <span className="cell-muted" style={{ fontSize: 13 }}>{filteredRequests.length}건</span>
                    <div className="spacer" />
                </div>
                <div className="tbl-wrap">
                    <table className="tbl">
                        <thead>
                            <tr>
                                <th>번호</th>
                                <th>고객 / 연락처</th>
                                <th>요청 내용</th>
                                <th className="c">인원</th>
                                <th>희망일</th>
                                <th>상태</th>
                                <th className="r">금액</th>
                                <th className="r">관리</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedRequests.map((request) => {
                                const price = request.confirmed_price ?? request.confirmedPrice;
                                return (
                                    <tr key={request.id} onClick={() => setSelectedRequest(request)}>
                                        <td>
                                            <div className="cell-mono">#{String(request.id).slice(0, 6)}</div>
                                            <div style={{ fontSize: 11, marginTop: 3 }}>
                                                <span className="tag-type quote">맞춤견적</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div>
                                                <div className="cell-strong">{request.name}</div>
                                                <div className="cell-muted" style={{ fontSize: 12 }}>{request.phone}</div>
                                            </div>
                                        </td>
                                        <td className="cell-muted" style={{ maxWidth: 240 }}>
                                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{request.destination}</div>
                                        </td>
                                        <td className="c cell-mono">{request.headcount}</td>
                                        <td className="cell-muted">{request.period}</td>
                                        <td onClick={(e) => e.stopPropagation()}>
                                            <StatusDropdown
                                                status={request.status}
                                                onChange={(newStatus) => handleStatusChange(request.id, newStatus)}
                                            />
                                        </td>
                                        <td className="r cell-price">{price ? won(Number(price)) : '–'}</td>
                                        <td className="r" onClick={(e) => e.stopPropagation()}>
                                            <span className="row-actions">
                                                <button
                                                    type="button"
                                                    className="act-btn"
                                                    title="상세"
                                                    onClick={() => setSelectedRequest(request)}
                                                >
                                                    <Icon name="visibility" />
                                                </button>
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {displayedRequests.length === 0 && (
                        <div className="empty">
                            <Icon name="request_quote" />
                            <p>{loading ? '견적을 불러오는 중입니다…' : '해당 조건의 견적이 없습니다.'}</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {filteredRequests.length > 0 && (
                    <div className="card-head" style={{ borderBottom: 'none', borderTop: '1px solid var(--border-subtle)', justifyContent: 'space-between' }}>
                        <span className="cell-muted" style={{ fontSize: 12 }}>
                            {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredRequests.length)} / {filteredRequests.length}건
                        </span>
                        <div className="spacer" />
                        <div className="row" style={{ gap: 6 }}>
                            <button
                                type="button"
                                className="act-btn"
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                            >
                                <Icon name="chevron_left" />
                            </button>
                            {getPageNumbers().map(pageNum => (
                                <button
                                    key={pageNum}
                                    type="button"
                                    className={`btn btn-sm ${currentPage === pageNum ? 'btn-ink' : 'btn-ghost'}`}
                                    style={{ minWidth: 34, padding: '0 10px' }}
                                    onClick={() => setCurrentPage(pageNum)}
                                >
                                    {pageNum}
                                </button>
                            ))}
                            <button
                                type="button"
                                className="act-btn"
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages || totalPages === 0}
                            >
                                <Icon name="chevron_right" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedRequest && (
                <QuoteDetailModal
                    request={selectedRequest}
                    onClose={() => setSelectedRequest(null)}
                    onSendEstimate={handleSendEstimate}
                    onOpenConvert={() => setIsConvertModalOpen(true)}
                    onUpdateQuote={handleUpdateQuote}
                />
            )}

            {/* Convert Logic Modal */}
            {isConvertModalOpen && selectedRequest && (
                <ConvertSelectionModal
                    request={selectedRequest}
                    onClose={() => setIsConvertModalOpen(false)}
                    onConvert={handleConvertToReservation}
                />
            )}
        </AdminLayout>
    );
};
