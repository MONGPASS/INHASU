import React, { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import {
    AdminBadge, AdminButton, AdminCheckbox, AdminChip, AdminChipGroup, AdminDataTable, AdminDialog, AdminEmpty, AdminError, AdminIconButton,
    AdminLoading, AdminPagination, AdminSearch, AdminSelect, AdminStat, AdminStatRow, AdminTextButton,
    IconCalendar, IconChevronLeft, IconChevronRight, type AdminColumn, type AdminTone,
} from '../components/admin/ui';
import { AdminFilterBar, ListPage } from '../components/admin/ui/AdminPage';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { connectQuoteDesk, findQuoteDeskTool, quoteDeskHref, quoteDeskPageId } from '../components/admin/quoteDesk';
import {
    BOOKING_FILTERS, BOOKING_SORTS, PAY_OPTIONS, assignState, bookDate, bookingRows, bookingSummary, cloneRecord, contractHref, contractState,
    customerTimeline, dDay, dateOnly, departingSoon, guideSheetHref, guideSheetPayload, isReservation, itineraryHref, money, monthBar, newCustomerToken,
    nightsText, paxSum, payAmount, payStatus, rowNumbers, signed, timelineClock, timelineDate, timelineGroups, todayKey, withPaymentStatus,
    type BookingFilter, type BookingRecord, type BookingSort, type PayField,
} from '../components/admin/quoteBookingList';
import { readInquiryList } from '../components/admin/quoteInbox';
import { loadQuoteCustomerRequest } from '../utils/quoteCustomerWorkspace';
import { quoteCustomerHref } from '../utils/customerWorkspaceRoutes';
import './AdminQuoteBookings.css';

/**
 * 견적 예약 목록(`/admin/quote-desk/bookings`) — 옛 도구 public/예약목록.html을 React로 옮겼다(iframe 대신).
 * 요약 4칸 → 검색·거르기·정렬 → 출발월 → 선택 작업 → 표. ‘배정 관리’는 고객 통합 작업 화면을 연다.
 * 표에서 바로 하는 일(결제 상태 바꾸기·선택 복제·선택 영구 삭제)은 옛 도구와 같은 API를 쓴다.
 * `?id=`(고객 화면으로 넘김)는 예전처럼 AdminQuoteDesk가 맡는다.
 */
const PAGE_SIZE = 50;
const LIST_PATH = quoteDeskHref('bookings');
const tool = findQuoteDeskTool('bookings');
const AdminQuoteDesk = lazy(() => import('./AdminQuoteDesk').then(module => ({ default: module.AdminQuoteDesk })));

const CONTRACT_TONE: Record<ReturnType<typeof contractState>, AdminTone> = { 수락대기: 'neutral', 서명대기: 'warn', 서명완료: 'success' };
const isFilter = (value: string | null): value is BookingFilter => (BOOKING_FILTERS as readonly string[]).includes(value || '');
const isSort = (value: string | null): value is BookingSort => BOOKING_SORTS.some(item => item.value === value);
const isMonth = (value: string | null) => !!value && (value === '전체' || value === '미정' || /^\d{4}(-\d{2})?$/.test(value));

type Phase = 'connecting' | 'loading' | 'ready' | 'unset' | 'error';

export const AdminQuoteBookings: React.FC = () => {
    const [params] = useSearchParams();
    if (params.get('id')) return <AdminQuoteDesk tool="bookings" />;
    return <BookingList />;
};

const BookingList: React.FC = () => {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [phase, setPhase] = useState<Phase>('connecting');
    const [loadError, setLoadError] = useState('');
    const [records, setRecords] = useState<BookingRecord[]>([]);
    const [selected, setSelected] = useState<Set<string>>(() => new Set());
    const [busy, setBusy] = useState('');
    const [timelineId, setTimelineId] = useState('');
    const [viewYear, setViewYear] = useState('');
    const token = useRef('');
    const request = useRef(0);
    const loaded = useRef(false);

    const filter: BookingFilter = isFilter(params.get('need')) ? params.get('need') as BookingFilter : '전체';
    const sort: BookingSort = isSort(params.get('sort')) ? params.get('sort') as BookingSort : 'byBook';
    const dir: 1 | -1 = params.get('dir') === 'desc' ? -1 : 1;
    const query = params.get('q') || '';
    const month = isMonth(params.get('month')) ? params.get('month')! : '전체';
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
    // 목록 상태는 주소에 둔다 — 고객 화면의 ‘목록으로’가 같은 목록으로 돌아온다.
    const setListState = (next: { filter?: BookingFilter; sort?: BookingSort; dir?: 1 | -1; q?: string; month?: string; page?: number }) => {
        const q = new URLSearchParams(params);
        const put = (key: string, value: string, empty: string) => { if (value && value !== empty) q.set(key, value); else q.delete(key); };
        if (next.filter !== undefined) put('need', next.filter, '전체');
        if (next.sort !== undefined) put('sort', next.sort, 'byBook');
        if (next.dir !== undefined) put('dir', next.dir === -1 ? 'desc' : '', '');
        if (next.q !== undefined) put('q', next.q, '');
        if (next.month !== undefined) put('month', next.month, '전체');
        const reset = next.filter !== undefined || next.sort !== undefined || next.dir !== undefined || next.q !== undefined || next.month !== undefined;
        put('page', String(next.page ?? (reset ? 1 : page)), '1');
        setParams(q, { replace: true });
    };

    const load = useCallback(async () => {
        const current = ++request.current;
        if (!accountId) return;
        setLoadError('');
        try {
            if (!token.current) {
                setPhase('connecting');
                const value = await connectQuoteDesk({ accountId });
                if (current !== request.current) return;
                if (!value) { setPhase('unset'); return; }
                token.current = value;
            }
            setPhase(old => old === 'ready' ? old : 'loading');
            const res = await fetch('/api/requests', { headers: { 'x-admin-token': token.current }, cache: 'no-store' });
            const body = await res.json().catch(() => null);
            if (current !== request.current) return;
            if (res.status === 401 || res.status === 403) { token.current = ''; throw new Error('관리자 인증이 만료됐어요. 화면을 새로 고쳐 주세요.'); }
            if (!res.ok) throw new Error(body?.error ? `예약 목록을 불러오지 못했습니다: ${body.error}` : `예약 목록을 불러오지 못했습니다(${res.status}).`);
            const items = readInquiryList(body);
            setRecords(items);
            // 없어진 예약은 선택에서 뺀다
            setSelected(old => { const ids = new Set(items.filter(isReservation).map(r => String(r.id))); return new Set([...old].filter(id => ids.has(id))); });
            setPhase('ready'); loaded.current = true;
        } catch (error) {
            if (current !== request.current) return;
            const message = error instanceof Error ? error.message : String(error);
            // 이미 목록이 있으면 그대로 두고 알리기만 한다
            if (loaded.current) adminNotify(message, 'error');
            else { setLoadError(message); setPhase('error'); }
        }
    }, [accountId]);

    useEffect(() => { token.current = ''; loaded.current = false; void load(); return () => { request.current++; }; }, [load]);

    const today = todayKey();
    const summary = useMemo(() => bookingSummary(records, today), [records, today]);
    const bar = useMemo(() => monthBar(records, month, viewYear), [records, month, viewYear]);
    const rows = useMemo(() => bookingRows(records, { filter, query, month: bar.month, sort, dir, today }), [records, filter, query, bar.month, sort, dir, today]);
    const numbers = useMemo(() => rowNumbers(records), [records]);
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const shown = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const returnTo = LIST_PATH + (params.toString() ? `?${params}` : '');
    const openCustomer = (r: BookingRecord) => navigate(quoteCustomerHref(String(r.id), returnTo));
    const picked = records.filter(r => selected.has(String(r.id)));
    const visibleIds = rows.map(r => String(r.id));
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
    const toggle = (id: string, on: boolean) => setSelected(old => { const next = new Set(old); if (on) next.add(id); else next.delete(id); return next; });

    // 새 탭에 여는 관리자 문서(가이드 시트·서명 원본)는 관리자 값(sessionStorage)이 이어지도록 noopener 없이 연다.
    const openTab = (href: string) => { if (!window.open(href, '_blank')) adminNotify('팝업을 허용한 뒤 다시 열어 주세요.', 'error'); };
    const openGuideSheet = (r: BookingRecord) => {
        if (!r.booking) { adminNotify('아직 예약 확정 정보가 없어요 — 배정 관리에서 먼저 저장해 주세요.', 'error'); return; }
        const win = window.open('about:blank', '_blank');
        if (!win) { adminNotify('팝업을 허용한 뒤 다시 열어 주세요.', 'error'); return; }
        try { win.sessionStorage.setItem('leaders_guide_sheet_print', JSON.stringify(guideSheetPayload(r))); } catch { /* 큰 예약은 인쇄 창이 서버 원본을 읽는다 */ }
        win.location.replace(guideSheetHref(r.id));
    };

    /** 결제 상태 바꾸기 — 옛 도구와 같은 PATCH { booking }. 저장 직전에 그 예약을 서버에서 다시 읽어 다른 화면의 변경을 덮지 않는다. */
    const savePayment = async (r: BookingRecord, field: PayField, value: string) => {
        if (busy || payStatus(r, field) === value) return;
        const id = String(r.id);
        if (field === 'depositStatus' && value === '입금완료' && payStatus(r, field) !== '입금완료') {
            const ok = await adminConfirm({ title: '예약금 입금 확인', confirmLabel: '입금완료로 저장',
                message: `${r.name || '고객'}님의 예약금을 입금완료로 저장할까요?\n처음 입금완료가 되면 계약서 서명 요청이 기록되고, 알림톡 설정이 되어 있으면 고객에게 서명 안내가 자동으로 발송됩니다.` });
            if (!ok) return;
        }
        setBusy(`pay:${id}`);
        try {
            const fresh = await loadQuoteCustomerRequest(id, token.current);
            const booking = withPaymentStatus(fresh.booking, field, value);
            const res = await fetch(`/api/requests/${encodeURIComponent(id)}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-token': token.current }, body: JSON.stringify({ booking }),
            });
            const body = await res.json().catch(() => ({}));
            if (res.status === 401) throw new Error('관리자 인증이 만료됐어요. 화면을 새로 고쳐 주세요.');
            if (!res.ok || !body?.ok) throw new Error(body?.error || `저장하지 못했습니다(${res.status}).`);
            adminNotify('입금 상태가 저장됐어요.', 'success');
        } catch (error) {
            adminNotify(error instanceof Error ? error.message : String(error), 'error');
        } finally {
            setBusy('');
            void load();
        }
    };

    const cloneSelected = async () => {
        if (!picked.length || busy) return;
        // 서버는 견적서가 든 새 기록을 ‘견적 발행’으로 보고 같은 연락처로 견적 안내 알림톡을 보낼 수 있다(functions/api/requests.js, 옛 도구도 같음).
        const withQuote = picked.filter(r => r.quote).length;
        if (!await adminConfirm({ title: '선택 예약 복제', confirmLabel: '복제',
            message: `선택한 ${picked.length}건을 복제할까요?\n고객명과 일정은 그대로 복사되고, 고객 링크는 새로 만들어집니다. 계약서 서명은 비워집니다.`
                + (withQuote ? `\n\n견적서가 있는 ${withQuote}건은 새 견적 발행으로 기록되어, 알림톡 설정이 되어 있으면 같은 고객 연락처로 견적 안내가 발송될 수 있습니다.` : '') })) return;
        setBusy('clone');
        const stamp = Date.now();
        let ok = 0, fail = 0;
        for (let i = 0; i < picked.length; i++) {
            try {
                const res = await fetch('/api/requests', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-token': token.current },
                    body: JSON.stringify(cloneRecord(picked[i], i, stamp, newCustomerToken())),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok || !body?.ok) throw new Error(body?.error || '복제 실패');
                ok++;
            } catch { fail++; }
        }
        setSelected(new Set()); setBusy('');
        await load();
        adminNotify(`${ok}건 복제 완료${fail ? ` · 실패 ${fail}건` : ''}`, fail ? 'error' : 'success');
    };

    const deleteSelected = async () => {
        if (!picked.length || busy) return;
        const names = picked.slice(0, 5).map(r => r.name || r.id).join(', ') + (picked.length > 5 ? ` 외 ${picked.length - 5}건` : '');
        if (!await adminConfirm({ title: '선택 예약 영구 삭제', confirmLabel: '영구 삭제', danger: true,
            message: `선택한 ${picked.length}건을 영구 삭제할까요?\n${names}\n\n발행한 견적서·고객 링크도 함께 사라지며, 삭제 후에는 복구할 수 없습니다.` })) return;
        setBusy('delete');
        let ok = 0, fail = 0;
        for (const r of picked) {
            try {
                const res = await fetch(`/api/requests/${encodeURIComponent(String(r.id))}`, { method: 'DELETE', headers: { 'x-admin-token': token.current } });
                const body = await res.json().catch(() => ({}));
                if (!res.ok || !body?.ok) throw new Error(body?.error || '삭제 실패');
                ok++;
            } catch { fail++; }
        }
        setSelected(new Set()); setBusy('');
        await load();
        adminNotify(`${ok}건 삭제 완료${fail ? ` · 실패 ${fail}건` : ''}`, fail ? 'error' : 'success');
    };

    const payLine = (r: BookingRecord, field: PayField, label: string) => (
        <span className="qb-pay-line">
            <span className="qb-pay-label">{label}</span>
            <span className="qb-pay-amount">{money(payAmount(r, field))}</span>
            <AdminSelect aria-label={`${r.name || '고객'} ${label} 상태`} value={payStatus(r, field)} disabled={!!busy}
                options={PAY_OPTIONS[field].map(value => ({ value, label: value }))} onChange={value => void savePayment(r, field, value)} />
        </span>
    );

    const columns: AdminColumn<BookingRecord>[] = [
        { key: 'pick', header: '선택', render: r => <AdminCheckbox aria-label={`${r.name || '예약'} 선택`} checked={selected.has(String(r.id))} onChange={on => toggle(String(r.id), on)} /> },
        { key: 'no', header: '번호·예약일', nowrap: true, render: r => <span className="qb-two"><b>{numbers[String(r.id)] || '-'}</b><small>{bookDate(r) || '-'}</small></span> },
        { key: 'customer', header: '고객명', className: 'qb-c-name', render: r => <span className="qb-two"><b>{r.name || '-'}</b><small>{paxSum(r) ? `${paxSum(r)}명` : '인원 미정'}</small></span> },
        { key: 'period', header: '여행 기간·지역', render: r => {
            const dd = dDay(r, today);
            return (
                <span className="qb-two">
                    <span className="qb-range">{dateOnly(r.depart) || '?'}<span aria-hidden="true"> → </span>{dateOnly(r.return_) || '?'}
                        {departingSoon(r, today) && <AdminBadge tone="warn">{dd === 0 ? 'D-DAY' : `D-${dd}`}</AdminBadge>}</span>
                    <small>{[nightsText(r) !== '-' ? nightsText(r) : '', r.destination || ''].filter(Boolean).join(' · ') || '-'}</small>
                </span>
            );
        } },
        { key: 'contract', header: '계약', nowrap: true, render: r => { const s = contractState(r); return <AdminBadge tone={CONTRACT_TONE[s]}>{s}</AdminBadge>; } },
        { key: 'assign', header: '배정 상태', render: r => {
            const a = assignState(r);
            return (
                <span className="qb-two">
                    <span className="qb-assign">
                        <span className={`qb-steps is-${a.done}`} aria-hidden="true"><i /><i /><i /></span>
                        <b className={a.allOk ? 'is-ok' : undefined}>{a.allOk ? '배정 완료' : `${a.done}/${a.total} 완료`}</b>
                    </span>
                    <small>{a.detail}</small>
                </span>
            );
        } },
        { key: 'pay', header: '결제', render: r => <span className="qb-pay">{payLine(r, 'depositStatus', '예약금')}{payLine(r, 'balanceStatus', '잔금')}</span> },
        { key: 'log', header: '진행 상황', className: 'qb-c-log', render: r => {
            const ev = customerTimeline(r), last = ev[ev.length - 1];
            if (!last) return <span className="qb-muted">기록 없음</span>;
            return (
                <span className="qb-two">
                    <AdminTextButton size="sm" className={last.bad ? 'qb-log is-bad' : 'qb-log'} onClick={() => setTimelineId(String(r.id))}>{last.label}</AdminTextButton>
                    <small>{timelineDate(last.at)}{timelineClock(last.at) && ` ${timelineClock(last.at)}`} · {last.who} · 총 {ev.length}단계</small>
                </span>
            );
        } },
        { key: 'manage', header: '관리', render: r => (
            <span className="qb-actions">
                <AdminButton variant="secondary" size="sm" onClick={() => openCustomer(r)}>배정 관리</AdminButton>
                <span className="qb-links">
                    {r.token && <AdminTextButton size="sm" onClick={() => openTab(itineraryHref(r.token))}>일정표</AdminTextButton>}
                    {r.token && <AdminTextButton size="sm" onClick={() => openTab(contractHref(r.token, r.id))}>{signed(r) ? '서명 원본' : '계약서'}</AdminTextButton>}
                    <AdminTextButton size="sm" onClick={() => openGuideSheet(r)}>가이드 시트</AdminTextButton>
                </span>
            </span>
        ) },
    ];

    const timelineRecord = timelineId ? records.find(r => String(r.id) === timelineId) : undefined;
    const groups = timelineRecord ? timelineGroups(customerTimeline(timelineRecord)) : [];
    const ready = phase === 'ready';
    const stat = (f: BookingFilter, label: string, value: number, hint: string, attention = false) => (
        <AdminStat label={label} value={value} unit="건" hint={hint} attention={attention && value > 0} active={filter === f} onClick={() => setListState({ filter: f })} />
    );

    const body = phase === 'connecting' || phase === 'loading' ? <AdminLoading label="예약 목록을 불러오는 중…" />
        : phase === 'unset' ? <AdminError title="견적 데스크가 연결되지 않았어요" reason="서버에 견적 관리자 값(ADMIN_TOKEN)이 설정되어 있어야 예약 목록을 불러올 수 있습니다." />
        : phase === 'error' ? <AdminError reason={loadError} onRetry={() => void load()} />
        : <>
            <div className="qb-months" role="group" aria-label="출발월">
                <span className="qb-months-label"><IconCalendar aria-hidden="true" />출발월</span>
                <AdminChip active={bar.month === '전체'} count={summary.total} onClick={() => setListState({ month: '전체' })}>전체</AdminChip>
                {bar.undated > 0 && <AdminChip active={bar.month === '미정'} count={bar.undated} onClick={() => setListState({ month: '미정' })}>날짜 미정</AdminChip>}
                <span className="qb-year">
                    <AdminIconButton size="sm" label={bar.prevYear ? `${bar.prevYear}년으로` : '이전 예약 없음'} disabled={!bar.prevYear}
                        onClick={() => { setViewYear(bar.prevYear); if (bar.month.length >= 4) setListState({ month: '전체' }); }}><IconChevronLeft /></AdminIconButton>
                    <AdminChip active={bar.month === bar.year} count={bar.yearTotal} disabled={!bar.yearTotal} onClick={() => setListState({ month: bar.year })}>{bar.year}년</AdminChip>
                    <AdminIconButton size="sm" label={bar.nextYear ? `${bar.nextYear}년으로` : '다음 예약 없음'} disabled={!bar.nextYear}
                        onClick={() => { setViewYear(bar.nextYear); if (bar.month.length >= 4) setListState({ month: '전체' }); }}><IconChevronRight /></AdminIconButton>
                </span>
                <span className="qb-month-cells">
                    {bar.cells.map(cell => (
                        <AdminChip key={cell.ym} active={bar.month === cell.ym} count={cell.count || null} disabled={!cell.count}
                            aria-label={`${bar.year}년 ${cell.label} 출발 ${cell.count}건`} onClick={() => setListState({ month: cell.ym })}>{cell.label}</AdminChip>
                    ))}
                </span>
            </div>
            <div className="qb-bulk" role="group" aria-label="선택 작업">
                <span className="qb-bulk-count">선택 <b>{picked.length}</b>건</span>
                <AdminButton variant="secondary" size="sm" disabled={!visibleIds.length || !!busy}
                    onClick={() => setSelected(old => { const next = new Set(old); visibleIds.forEach(id => allVisibleSelected ? next.delete(id) : next.add(id)); return next; })}>
                    {allVisibleSelected ? '검색 결과 선택 해제' : `검색 결과 전체 선택(${visibleIds.length})`}
                </AdminButton>
                <AdminButton variant="secondary" size="sm" disabled={!picked.length || !!busy} onClick={() => setSelected(new Set())}>선택 해제</AdminButton>
                <span className="qb-bulk-end">
                    <AdminButton variant="secondary" size="sm" disabled={!picked.length || !!busy} loading={busy === 'clone'} onClick={() => void cloneSelected()}>선택 예약 복제</AdminButton>
                    <AdminButton variant="danger" size="sm" disabled={!picked.length || !!busy} loading={busy === 'delete'} onClick={() => void deleteSelected()}>선택 영구 삭제</AdminButton>
                </span>
            </div>
            <AdminDataTable label="견적 예약" columns={columns} rows={shown} rowKey={r => String(r.id)} isSelected={r => selected.has(String(r.id))}
                empty={<AdminEmpty title={summary.total ? '조건에 맞는 예약이 없습니다' : '아직 예약이 없습니다'}
                    description={summary.total ? '검색어나 거르기·출발월을 바꿔 보세요.' : '견적 문의에서 고객 수락을 기록하면 여기에 보입니다.'} />} />
        </>;

    return (
        <ListPage
            activePage={quoteDeskPageId('bookings')}
            title={tool.label}
            description={tool.description}
            summary={ready ? <AdminStatRow label="견적 예약 요약">
                {stat('전체', '예약 확정', summary.total, '전체 확정 고객')}
                {stat('계약미서명', '계약 미서명', summary.unsigned, '서명 요청 필요', true)}
                {stat('배정미완료', '배정 미완료', summary.incomplete, '가이드·차량·숙소 확인', true)}
                {stat('출발임박', '14일 내 출발', summary.soon, '출발 전 최종 점검', true)}
            </AdminStatRow> : undefined}
            filters={ready ? <AdminFilterBar
                search={<AdminSearch value={query} onChange={q => setListState({ q })} placeholder="고객명·여행지·날짜·차량·숙소·가이드·입금상태" aria-label="견적 예약 검색" />}
                filters={<AdminChipGroup label="거르기" value={filter} onChange={f => setListState({ filter: f })}
                    items={[{ value: '전체', label: '전체', count: summary.total }, { value: '계약미서명', label: '계약 미서명', count: summary.unsigned },
                        { value: '배정미완료', label: '배정 미완료', count: summary.incomplete }, { value: '출발임박', label: '출발 임박', count: summary.soon }]} />}
                end={<span className="qb-sort">
                    <AdminSelect aria-label="정렬 기준" value={sort} options={BOOKING_SORTS.map(s => ({ value: s.value, label: s.label }))}
                        onChange={value => setListState({ sort: isSort(value) ? value : 'byBook', dir: 1 })} />
                    <AdminButton variant="secondary" aria-label={`정렬 방향: ${dir > 0 ? '오름차순' : '내림차순'}`} onClick={() => setListState({ dir: dir > 0 ? -1 : 1 })}>{dir > 0 ? '오름차순' : '내림차순'}</AdminButton>
                </span>}
            /> : undefined}
            pagination={ready && totalPages > 1 ? <AdminPagination page={currentPage} totalPages={totalPages} onChange={next => setListState({ page: next })}
                summary={`${rows.length}건 중 ${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(rows.length, currentPage * PAGE_SIZE)}`} /> : undefined}
        >
            {body}
            <AdminDialog open={!!timelineRecord} onClose={() => setTimelineId('')} title="고객 진행 기록" size="sm"
                description={timelineRecord ? `${timelineRecord.name || '고객'} · ${timelineRecord.destination || '여행지 미정'}` : undefined}>
                {groups.length ? <ol className="qb-tl">
                    {groups.map((g, gi) => (
                        <li key={g.day + gi} className={gi < groups.length - 1 ? 'qb-tl-day is-past' : 'qb-tl-day'}>
                            <b className="qb-tl-date">{g.day}</b>
                            <ul>
                                {g.items.map((e, i) => (
                                    <li key={i} className={e.bad ? 'is-bad' : e.who !== '자동' ? 'is-person' : undefined}>
                                        <span className="qb-tl-label">{e.label}</span>
                                        <small>{timelineClock(e.at) || g.day} · {e.who}</small>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ol> : <p className="qb-muted">아직 남은 진행 기록이 없습니다.</p>}
            </AdminDialog>
        </ListPage>
    );
};

export default AdminQuoteBookings;
