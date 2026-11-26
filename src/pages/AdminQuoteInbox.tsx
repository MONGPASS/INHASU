import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useUser } from '../contexts/UserContext';
import {
    AdminBadge, AdminButton, AdminChipGroup, AdminDataTable, AdminEmpty, AdminError, AdminLoading, AdminMessage,
    AdminPagination, AdminSearch, AdminSelect, AdminStat, AdminStatRow, IconChevronRight, IconPencil, type AdminColumn, type AdminTone,
} from '../components/admin/ui';
import { AdminFilterBar, ListPage } from '../components/admin/ui/AdminPage';
import { adminNotify } from '../components/admin/ui/adminFeedback';
import { connectQuoteDesk, findQuoteDeskTool, quoteDeskHref, quoteDeskPageId } from '../components/admin/quoteDesk';
import {
    INBOX_SORTS, INQUIRY_STATUSES, arrivalMessage, budgetText, dDay, dateOnly, inboxArrivals, inboxSeen, inboxSummary,
    isUrgent, nextAction, nightText, paxSum, readInquiryList, requestSnippet, statusOf, visibleInquiries,
    type InboxFilter, type InboxSeen, type InboxSort, type InquiryRecord,
} from '../components/admin/quoteInbox';
import { customerWorkspaceReturnTo, quoteCustomerHref } from '../utils/customerWorkspaceRoutes';
import './AdminQuoteInbox.css';

/**
 * 견적 문의(`/admin/quote-desk/inbox`) — 옛 도구 public/견적관리.html의 목록 화면을 React로 옮겼다(iframe 대신).
 * 화면은 2026-11-26 Claude Design ‘견적 문의 · 목록 (기존 화면 개선)’: 현황 카드 5칸(누르면 목록이 걸러짐) → 흰 목록 카드(검색·정렬 → 상태 칩 → 표 → 건수·페이지).
 * 고객·예약 행동은 ‘할 일 있음’ 카드와 상태 칸의 다음 할 일로 보여 준다. 줄이나 ‘상세’를 누르면 고객 통합 작업 화면으로 간다(고치는 일은 거기서).
 * 예전 주소 `?id=`(문의 상세)·`?qe=`(옛 휴대폰 견적 편집)는 그 고객의 고객 통합 작업 화면으로 넘긴다(견적 편집도 거기서 React로).
 * 자료는 같은 `GET /api/requests`(x-admin-token)이고 30초마다 다시 읽어 새 문의·고객 행동을 알린다.
 */
const PAGE_SIZE = 20;
const REFRESH_MS = 30000;
const INBOX_PATH = quoteDeskHref('inbox');
const tool = findQuoteDeskTool('inbox');

// 디자인: 신규는 옅은 민트, 진행중·완료·보류는 회색, 예약확정은 검정 채움
const STATUS_TONE: Record<string, { tone: AdminTone; strong?: boolean }> = { 신규: { tone: 'info' }, 진행중: { tone: 'neutral' }, 예약확정: { tone: 'neutral', strong: true }, 완료: { tone: 'neutral' }, 보류: { tone: 'neutral' } };
/** 연락처 “010-5717-7901” */
const phoneText = (phone: string) => { const d = String(phone || '').replace(/\D/g, ''); return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : String(phone || ''); };
const isFilter = (value: string | null): value is InboxFilter => value === 'all' || value === 'action' || (INQUIRY_STATUSES as readonly string[]).includes(value || '');
const isSort = (value: string | null): value is InboxSort => INBOX_SORTS.some(item => item.value === value);

type Phase = 'connecting' | 'loading' | 'ready' | 'unset' | 'error';

/** `/admin/quote-desk`(도구 이름 없음)는 견적 문의로 — 붙어 온 ?id=·?qe=는 그대로 넘긴다. */
export const QuoteDeskIndexRedirect: React.FC = () => {
    const { search } = useLocation();
    return <Navigate to={INBOX_PATH + search} replace />;
};

export const AdminQuoteInbox: React.FC = () => {
    const [params] = useSearchParams();
    // 고객 한 명을 여는 예전 주소 → 고객 통합 작업 화면. returnTo가 있으면 검증한 값, 없으면 이 목록으로 돌아온다.
    const id = params.get('id') || params.get('qe');
    if (id) return <Navigate replace to={quoteCustomerHref(id, params.has('returnTo') ? customerWorkspaceReturnTo(params.get('returnTo'), '/admin/reservations?type=quote_booking') : INBOX_PATH)} />;
    return <InboxList />;
};

const InboxList: React.FC = () => {
    const { user } = useUser();
    const accountId = user?.role === 'admin' ? user.id : '';
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [phase, setPhase] = useState<Phase>('connecting');
    const [loadError, setLoadError] = useState('');
    const [refreshError, setRefreshError] = useState('');
    const [records, setRecords] = useState<InquiryRecord[]>([]);
    const [now, setNow] = useState(() => new Date());
    const token = useRef('');
    const seen = useRef<InboxSeen | null>(null);
    const loaded = useRef(false);
    const request = useRef(0);
    const baseTitle = useRef('');

    const filter: InboxFilter = isFilter(params.get('status')) ? params.get('status') as InboxFilter : 'all';
    const sort: InboxSort = isSort(params.get('sort')) ? params.get('sort') as InboxSort : 'receivedDesc';
    const search = params.get('q') || '';
    const page = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
    // 목록 상태는 주소에 둔다 — 고객 화면에서 ‘목록으로’를 누르면 같은 검색·필터·페이지로 돌아온다.
    const setListState = (next: { status?: InboxFilter; sort?: InboxSort; q?: string; page?: number }) => {
        const query = new URLSearchParams(params);
        const put = (key: string, value: string, empty: string) => { if (value && value !== empty) query.set(key, value); else query.delete(key); };
        if (next.status !== undefined) put('status', next.status, 'all');
        if (next.sort !== undefined) put('sort', next.sort, 'receivedDesc');
        if (next.q !== undefined) put('q', next.q, '');
        put('page', String(next.page ?? (next.status !== undefined || next.sort !== undefined || next.q !== undefined ? 1 : page)), '1');
        setParams(query, { replace: true });
    };

    const load = useCallback(async (quiet = false) => {
        const current = ++request.current;
        if (!accountId) return;
        if (!quiet) setLoadError('');
        try {
            if (!token.current) {
                setPhase('connecting');
                const value = await connectQuoteDesk({ accountId });
                if (current !== request.current) return;
                if (!value) { setPhase('unset'); return; }
                token.current = value;
            }
            if (!quiet) setPhase(old => old === 'ready' ? old : 'loading');
            const res = await fetch('/api/requests', { headers: { 'x-admin-token': token.current }, cache: 'no-store' });
            const body = await res.json().catch(() => null);
            if (current !== request.current) return;
            if (res.status === 401 || res.status === 403) { token.current = ''; throw new Error('관리자 인증이 만료됐어요. 화면을 새로 고쳐 주세요.'); }
            if (!res.ok) throw new Error(body?.error ? `견적 문의를 불러오지 못했습니다: ${body.error}` : `견적 문의를 불러오지 못했습니다(${res.status}).`);
            const items = readInquiryList(body);
            const message = arrivalMessage(inboxArrivals(seen.current, items));
            seen.current = inboxSeen(items);
            setRecords(items); setNow(new Date()); setRefreshError(''); setPhase('ready'); loaded.current = true;
            if (message) {
                adminNotify(message, 'info');
                if (document.hidden) { baseTitle.current ||= document.title; document.title = `(새 알림) ${baseTitle.current}`; }
            }
        } catch (error) {
            if (current !== request.current) return;
            const message = error instanceof Error ? error.message : String(error);
            // 이미 목록이 있으면 그대로 두고 위에 알린다(옛 도구처럼 빈 목록으로 바꾸지 않는다).
            if (loaded.current) setRefreshError(message);
            else { setLoadError(message); setPhase('error'); }
        }
    }, [accountId]);

    useEffect(() => {
        token.current = ''; seen.current = null; loaded.current = false;
        void load();
        const timer = window.setInterval(() => { if (token.current) void load(true); }, REFRESH_MS);
        const restoreTitle = () => { if (baseTitle.current) { document.title = baseTitle.current; baseTitle.current = ''; } };
        window.addEventListener('focus', restoreTitle);
        return () => { request.current++; window.clearInterval(timer); window.removeEventListener('focus', restoreTitle); restoreTitle(); };
    }, [load]);

    const summary = useMemo(() => inboxSummary(records, now), [records, now]);
    const rows = useMemo(() => visibleInquiries(records, { filter, search, sort }), [records, filter, search, sort]);
    const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const shown = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const returnTo = INBOX_PATH + (params.toString() ? `?${params}` : '');
    const openCustomer = (record: InquiryRecord) => navigate(quoteCustomerHref(String(record.id), returnTo));

    const columns: AdminColumn<InquiryRecord>[] = [
        { key: 'who', header: '신청자', className: 'qi-c-who', render: r => <span className="qi-name"><b>{r.name || '-'}</b>{r.phone && <small>{phoneText(r.phone)}</small>}</span> },
        { key: 'want', header: '요청 내용', className: 'qi-c-want', render: r => {
            const extra = [r.tripType, requestSnippet(r)].filter(Boolean).map(x => ` · ${x}`).join('');
            return <span className="qi-want" title={[r.destination, r.tripType, requestSnippet(r)].filter(Boolean).join(' · ')}><b>{r.destination || '-'}</b>{extra && <span>{extra}</span>}</span>;
        } },
        { key: 'state', header: '상태', className: 'qi-c-state', nowrap: true, render: r => {
            const action = nextAction(r), tone = STATUS_TONE[statusOf(r)] || { tone: 'neutral' as AdminTone };
            return <span className="qi-state"><AdminBadge tone={tone.tone} strong={tone.strong}>{statusOf(r)}</AdminBadge>{action && <small className="qi-next">{action.label}</small>}</span>;
        } },
        { key: 'pax', header: '인원', className: 'qi-c-pax', align: 'right', nowrap: true, render: r => `${paxSum(r)}명` },
        { key: 'period', header: '일정', className: 'qi-c-period', align: 'right', nowrap: true, render: r => (
            <span className="qi-trip">{nightText(r)}{isUrgent(r, now) && <span className="qi-dday" title={`출발까지 D-${dDay(r, now)} · 출발이 임박한 미처리 문의`}>D-{dDay(r, now)}</span>}</span>
        ) },
        { key: 'budget', header: '예산', className: 'qi-c-budget', align: 'right', nowrap: true, render: r => <span className="qi-muted">{budgetText(r)}</span> },
        { key: 'received', header: '접수일', className: 'qi-c-date', align: 'right', nowrap: true, render: r => <span className="qi-muted">{dateOnly(r.receivedAt)}</span> },
        { key: 'open', header: '관리', className: 'qi-c-open', align: 'right', nowrap: true, render: r => (
            <AdminButton variant="secondary" size="sm" trailing={<IconChevronRight />} aria-label={`${r.name || '고객'} 문의 상세 보기`}
                onClick={e => { e.stopPropagation(); openCustomer(r); }}>상세</AdminButton>
        ) },
    ];

    const ready = phase === 'ready';
    const actions = summary.actions;
    const chipItems = [
        { value: 'all' as InboxFilter, label: '전체', count: summary.total },
        { value: 'action' as InboxFilter, label: '할 일 있음', count: actions.length },
        ...INQUIRY_STATUSES.map(s => ({ value: s as InboxFilter, label: s, count: summary.byStatus[s] })),
    ];

    const body = phase === 'connecting' || phase === 'loading' ? <AdminLoading label="견적 문의를 불러오는 중…" />
        : phase === 'unset' ? <AdminError title="견적 데스크가 연결되지 않았어요" reason="서버에 견적 관리자 값(ADMIN_TOKEN)이 설정되어 있어야 견적 문의를 불러올 수 있습니다." />
        : phase === 'error' ? <AdminError reason={loadError} onRetry={() => void load()} />
        : <AdminDataTable label="견적 문의" columns={columns} rows={shown} rowKey={r => String(r.id)} onRowClick={openCustomer}
            empty={<AdminEmpty title={summary.total ? '조건에 맞는 문의가 없습니다' : '아직 접수된 문의가 없습니다'}
                description={summary.total ? '검색어나 상태 칩을 바꿔 보세요.' : '고객이 맞춤 견적 요청을 보내면 여기에 보입니다.'} />} />;

    return (
        <ListPage
            activePage={quoteDeskPageId('inbox')}
            title={tool.label}
            description={tool.description}
            actions={<AdminButton variant="primary" leading={<IconPencil />} onClick={() => navigate(quoteDeskHref('builder'))}>견적 작성</AdminButton>}
            notice={refreshError ? <AdminMessage tone="cautionary" role="alert">{refreshError} 마지막으로 불러온 목록을 보여 주고 있어요.</AdminMessage> : undefined}
            summary={ready ? (
                <AdminStatRow label="견적 문의 현황" className="qi-stats">
                    <AdminStat label="전체 문의" value={summary.total} unit="건" hint={`오늘 +${summary.today}`} active={filter === 'all'} onClick={() => setListState({ status: 'all' })} />
                    <AdminStat label="신규 견적 요청" value={summary.byStatus['신규']} unit="건" hint="아직 답하지 않은 요청" attention={summary.byStatus['신규'] > 0}
                        active={filter === '신규'} onClick={() => setListState({ status: '신규' })} />
                    <AdminStat label="할 일 있음" value={actions.length} unit="건" hint={actions.length ? '확인 필요' : '없음'} attention={actions.length > 0}
                        active={filter === 'action'} onClick={() => setListState({ status: 'action' })} />
                    <AdminStat label="진행중 (상담 중)" value={summary.byStatus['진행중']} unit="건" hint="상담 중" active={filter === '진행중'} onClick={() => setListState({ status: '진행중' })} />
                    <AdminStat label="완료" value={summary.byStatus['완료']} unit="건" hint={`이번 달 ${summary.doneThisMonth}`} active={filter === '완료'} onClick={() => setListState({ status: '완료' })} />
                </AdminStatRow>
            ) : undefined}
            filters={ready ? <AdminFilterBar className="qi-filterbar"
                search={<AdminSearch value={search} onChange={q => setListState({ q })} placeholder="이름 · 연락처 · 요청 내용 · 메모 검색" aria-label="견적 문의 검색" />}
                filters={<AdminChipGroup label="상태" items={chipItems} value={filter} onChange={status => setListState({ status })} />}
                end={<AdminSelect aria-label="정렬" value={sort} options={INBOX_SORTS} onChange={value => setListState({ sort: isSort(value) ? value : 'receivedDesc' })} />}
            /> : undefined}
            pagination={ready && rows.length > 0 ? <AdminPagination page={currentPage} totalPages={totalPages} onChange={next => setListState({ page: next })}
                summary={`${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(rows.length, currentPage * PAGE_SIZE)} / ${rows.length}건`} /> : undefined}
        >
            {body}
        </ListPage>
    );
};

export default AdminQuoteInbox;
