import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconCheckThick, IconChevronDownSmall, IconChevronRight, IconClose, IconInbox } from '@montage-ui/icon';
import {
    AdminBadge, AdminButton, AdminCheckbox, AdminEmpty, AdminIconButton, AdminPagination, AdminSearch, AdminSegmented, AdminSelect,
    AdminStat, AdminStatRow, AdminTable, AdminTabs, AdminTbody, AdminTd, AdminTextButton, AdminTh, AdminThead, AdminTr, cx, type AdminTone,
} from '../ui';
import { dashboardSeoulDate } from '../../../utils/adminDashboard';
import {
    V7_QUICK, V7_TABS, fetchV7Assignments, v7Dday, v7Matches, v7Range, v7Row, v7Sort, v7StepLabel, v7Won,
    type V7AssignmentItem, type V7Quick, type V7Row, type V7Source, type V7Tab,
} from '../../../utils/reservationV7';
import {
    RESERVATION_PAGE_SIZES, readReservationListView, reservationListViewSearch, reservationPage, reservationPageSummary, type ReservationListView,
} from '../../../utils/reservationListView';
import { V7Menu, V7Styles, V7Toast, menuAt, type V7MenuItem, type V7MenuState } from './v7Ui';
import { adminConfirm } from '../ui/adminFeedback';
import './reservation-list.css';

export type V7OpenAction = 'edit-itinerary' | 'contract' | 'documents' | 'payments' | 'guide' | 'vehicle' | 'stay' | 'notes' | 'history';
export type V7NoticeKind = 'quote' | 'contract' | 'itinerary' | 'travel_notice';

export const PRODUCT_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
    { value: 'pending_payment', label: '입금 대기' }, { value: 'confirmed', label: '예약 확정' }, { value: 'paid', label: '결제 완료' },
    { value: 'completed', label: '여행 완료' }, { value: 'on_hold', label: '보류' }, { value: 'cancelled', label: '예약 취소' },
];
const QUOTE_STATUS_LABELS: Record<string, string> = { reservation_requested: '예약 요청', pending_payment: '입금 대기', confirmed: '예약 확정', completed: '여행 완료', on_hold: '보류', cancelled: '예약 취소' };
export const statusLabelOf = (r: V7Source) => r.type === 'quote_booking'
    ? QUOTE_STATUS_LABELS[r.status] || r.quoteBooking?.label || '견적 예약'
    : PRODUCT_STATUS_OPTIONS.find(o => o.value === r.status)?.label || r.status;
const NOTICE_KINDS: Array<{ kind: V7NoticeKind; label: string }> = [
    { kind: 'contract', label: '계약서 안내' }, { kind: 'itinerary', label: '확정 일정표' }, { kind: 'travel_notice', label: '여행 주의사항' }, { kind: 'quote', label: '견적서' },
];
const QUICK_HINT: Record<V7Quick, string> = { all: '이 탭의 모든 예약', week: '7일 안에 출발', bal: '잔금 미입금', asg: '가이드 · 차량 · 숙소', ct: '서명 요청 필요', dep: '입금 확인 필요' };
/** 처리할 일이 있으면 주의 표시를 하는 빠른 필터 */
const QUICK_ATTENTION = new Set<V7Quick>(['bal', 'asg', 'ct', 'dep']);
const SORT_TEXT = { pri: '처리할 일이 많은 순', dep: '출발일순', bk: '최근 예약순' } as const;
const STEP_TONE: Record<'red' | 'mint' | 'gray', AdminTone> = { red: 'danger', mint: 'info', gray: 'neutral' };
/** 이 날수 안에 출발하는 계약 완료 예약을 강조한다 */
const URGENT_DAYS = 14;

/** Excel 범위 메뉴가 쓰는 지금 목록의 키(`product:<id>` / `quote_booking:<id>`) */
export interface ReservationListScope { visible: string[]; selected: string[]; label: string }

export interface ReservationListV7Props {
    reservations: V7Source[];
    loading: boolean;
    loadedOnce: boolean;
    /** 예약 상세(고객 통합 작업 화면)로 간다. 예약 하나를 고치는 일은 모두 상세에서 한다. */
    onOpen: (r: V7Source, action?: V7OpenAction) => void;
    onStatus: (r: V7Source, status: string) => Promise<void>;
    onPayment: (r: V7Source, field: 'deposit' | 'final', paid: boolean) => Promise<boolean>;
    onExport: (keys: string[]) => void;
    /** 지금 보이는 목록(모든 페이지)과 선택이 바뀔 때 — 머리의 Excel 범위 메뉴가 같은 기준을 쓴다 */
    onScopeChange?: (scope: ReservationListScope) => void;
}

export function ReservationListV7(p: ReservationListV7Props) {
    const today = dashboardSeoulDate(new Date().toISOString());
    // 탭·빠른 필터·검색·정렬·페이지·쪽당 건수는 주소에 보관한다(상세에 갔다 돌아와도 같은 목록).
    const [view, setView] = useState<ReservationListView>(() => readReservationListView(window.location.search));
    const { tab, quick, q, sort } = view;
    const change = useCallback((patch: Partial<ReservationListView>) => setView(prev => ({ ...prev, page: 1, ...patch })), []);
    useEffect(() => {
        const search = reservationListViewSearch(view, window.location.search);
        if (search !== window.location.search) window.history.replaceState(window.history.state, '', window.location.pathname + search + window.location.hash);
    }, [view]);
    useEffect(() => {
        const restore = () => setView(readReservationListView(window.location.search));
        window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);
    }, []);

    const [sel, setSel] = useState<Set<string>>(() => new Set());
    const [menu, setMenu] = useState<V7MenuState | null>(null);
    const [toast, setToast] = useState('');
    const [items, setItems] = useState<Map<string, V7AssignmentItem>>(() => new Map());
    const [assignmentNote, setAssignmentNote] = useState('');
    const toastTimer = useRef<number | undefined>(undefined);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; window.clearTimeout(toastTimer.current); }; }, []);
    const flash = useCallback((text: string) => { window.clearTimeout(toastTimer.current); setToast(text); toastTimer.current = window.setTimeout(() => mounted.current && setToast(''), 2600); }, []);

    // 배정(가이드·차량·숙소) 현황은 목록 칩에 쓴다. 배정을 바꾸는 일은 예약 상세에서 한다.
    const loadAssignments = useCallback(async () => {
        try {
            const data = await fetchV7Assignments();
            if (!mounted.current) return;
            setItems(new Map(data.items.map(item => [item.key, item])));
            setAssignmentNote(data.warnings[0] || '');
        } catch (e: any) { if (mounted.current) setAssignmentNote(e?.message || '배정 정보를 불러오지 못했습니다. 저장된 예약 정보로 표시합니다.'); }
    }, []);
    const wasLoading = useRef(true);
    useEffect(() => { if (wasLoading.current && !p.loading) void loadAssignments(); wasLoading.current = p.loading; }, [p.loading, loadAssignments]);

    const rows = useMemo(() => p.reservations.filter(r => r.type !== 'quote')
        .map(r => v7Row(r, items.get(`${r.type === 'quote_booking' ? 'quote_booking' : 'product'}:${r.id}`), today)), [p.reservations, items, today]);
    const inTab = useMemo(() => rows.filter(r => r.tab === tab), [rows, tab]);
    const quickDef = V7_QUICK.find(x => x.key === quick) || V7_QUICK[0];
    const list = useMemo(() => v7Sort(inTab.filter(quickDef.test).filter(r => v7Matches(r, q)), sort), [inTab, quickDef, q, sort]);
    const page = reservationPage(list, view.page, view.size);
    // 필터를 바꿔 건수가 줄면 마지막 쪽으로 맞춘다(불러오는 동안은 주소의 쪽 번호를 지킨다).
    useEffect(() => { if (p.loadedOnce && !p.loading && page.page !== view.page) setView(prev => ({ ...prev, page: page.page })); }, [p.loadedOnce, p.loading, page.page, view.page]);
    const selected = rows.filter(r => sel.has(r.key));
    const pageKeys = page.rows.map(r => r.key);
    const pageOn = pageKeys.filter(k => sel.has(k)).length;
    useEffect(() => { setSel(prev => { const valid = new Set(rows.map(r => r.key)); const next = new Set([...prev].filter(k => valid.has(k))); return next.size === prev.size ? prev : next; }); }, [rows]);

    const tabLabel = V7_TABS.find(t => t.key === tab)?.label || '';
    const scopeLabel = [tabLabel, quick !== 'all' ? quickDef.label : '', q.trim() ? `검색 ‘${q.trim()}’` : ''].filter(Boolean).join(' · ');
    const visibleKey = list.map(r => r.key).join('|'), selectedKey = selected.map(r => r.key).join('|');
    const onScopeChange = p.onScopeChange;
    useEffect(() => {
        onScopeChange?.({ visible: visibleKey ? visibleKey.split('|') : [], selected: selectedKey ? selectedKey.split('|') : [], label: scopeLabel });
    }, [onScopeChange, visibleKey, selectedKey, scopeLabel]);

    const openMenu = (e: React.MouseEvent, title: string, menuItems: V7MenuItem[], wide = false) => { e.stopPropagation(); setMenu(menuAt(e.currentTarget as HTMLElement, title, menuItems, wide)); };
    const closeMenu = useCallback(() => setMenu(null), []);

    // 여러 예약을 한 번에 처리하는 일은 목록에만 있다(선택 시 아래 일괄 작업 줄).
    const exportSelected = () => { p.onExport(selected.map(r => r.key)); flash(`${selected.length}건을 엑셀로 내보냈어요`); };
    const bulkStatus = (e: React.MouseEvent) => openMenu(e, '선택한 예약 진행상황 변경', PRODUCT_STATUS_OPTIONS.map(o => ({ key: o.value, label: o.label, onPick: async () => {
        const targets = selected.filter(r => r.source.type === 'product' && r.source.status !== o.value), skipped = selected.filter(r => r.source.type === 'quote_booking').length;
        if (!targets.length) { flash(skipped ? '견적 예약은 예약관리 편집기에서 상태를 바꿉니다' : '바꿀 예약이 없어요'); return; }
        if (!await adminConfirm(`선택한 상품 예약 ${targets.length}건을 '${o.label}'(으)로 바꿀까요?${skipped ? `\n견적 예약 ${skipped}건은 제외됩니다.` : ''}`)) return;
        for (const row of targets) await p.onStatus(row.source, o.value);
        setSel(new Set()); flash(`${targets.length}건을 ${o.label}(으)로 옮겼어요`);
    } })));
    const bulkPayment = (e: React.MouseEvent) => openMenu(e, '선택한 예약 입금 확인', (['deposit', 'final'] as const).map(field => ({ key: field, label: field === 'deposit' ? '예약금 입금 확인' : '잔금 완납 확인', onPick: async () => {
        const targets = selected.filter(r => r.source.type === 'product' && !(field === 'deposit' ? r.depositPaid : r.balancePaid)), skipped = selected.filter(r => r.source.type === 'quote_booking').length;
        if (!targets.length) { flash(skipped ? '견적 예약은 예약관리 편집기에서 입금을 확인합니다' : '확인할 미입금 예약이 없어요'); return; }
        if (!await adminConfirm(`선택한 상품 예약 ${targets.length}건의 ${field === 'deposit' ? '예약금 입금' : '잔금 완납'}을 확인할까요?${field === 'deposit' ? '\n입금 대기 예약은 확정되고 고객에게 입금 확인 메일이 발송됩니다.' : ''}${skipped ? `\n견적 예약 ${skipped}건은 제외됩니다.` : ''}`)) return;
        let ok = 0; for (const row of targets) if (await p.onPayment(row.source, field, true)) ok += 1;
        flash(`${ok}건을 ${field === 'deposit' ? '예약금 입금 완료' : '완납'}로 처리했어요`);
    } })));
    const bulkNotice = (e: React.MouseEvent) => openMenu(e, '선택한 고객에게 안내 알림', NOTICE_KINDS.map(n => ({ key: n.kind, label: n.label, onPick: async () => {
        if (!await adminConfirm(`선택한 ${selected.length}명에게 '${n.label}' 카카오 알림을 보낼까요?\n준비되지 않은 예약은 보내지 않고 건너뜁니다.`)) return;
        let accepted = 0, skipped = 0, failed = 0;
        for (const row of selected) {
            const source = row.source.type === 'quote_booking' ? 'quote_booking' : 'product', path = `/api/admin/customer-notices/${source}/${encodeURIComponent(row.source.id)}`;
            try {
                const snapshot = await (await fetch(path, { credentials: 'include', cache: 'no-store' })).json();
                const notice = Array.isArray(snapshot?.notices) ? snapshot.notices.find((x: any) => x?.kind === n.kind) : null;
                if (!notice?.available) { skipped += 1; continue; }
                const response = await fetch(path, { method: 'POST', credentials: 'include', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: n.kind, idempotencyKey: crypto.randomUUID() }) });
                const body = await response.json().catch(() => ({}));
                if (response.ok && body.ok && body.state === 'accepted') accepted += 1; else failed += 1;
            } catch { failed += 1; }
        }
        flash(`${n.label} 접수 ${accepted}건${skipped ? ` · 준비 안 됨 ${skipped}건` : ''}${failed ? ` · 확인 필요 ${failed}건` : ''}`);
    } })), true);

    const toggleKey = (key: string) => setSel(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
    const togglePage = (on: boolean) => setSel(prev => { const next = new Set(prev); pageKeys.forEach(k => on ? next.add(k) : next.delete(k)); return next; });
    const tabCount = (key: V7Tab) => rows.filter(r => r.tab === key).length;
    const counted = (n: number) => p.loadedOnce ? n : '–';

    // Claude Design ‘예약 관리 · 강력 개선안’(2026-11-23): 큰 탭 → 빠른 필터 6칸 → 검색·정렬 → 표 카드(표 · 페이지) → 선택 시 일괄 작업 줄.
    // 탭·검색은 회색 작업 바탕 위에 두고, 흰 카드에는 표만 담는다. 줄을 누르면 예약 상세로 간다(예전 펼침 패널은 상세와 같은 내용이라 뺐다).
    return <div className="rl-root">
        <V7Styles />
        <div className="rl-tabs">
            <AdminTabs label="예약 진행 상태" size="lg" value={tab} onChange={value => { change({ tab: value as V7Tab, quick: 'all' }); setSel(new Set()); }}
                items={V7_TABS.map(t => ({ value: t.key, label: t.label, count: counted(tabCount(t.key)) }))} />
        </div>

        <AdminStatRow label="빠른 필터" className="rl-stats">
            {V7_QUICK.map(x => {
                const n = inTab.filter(x.test).length, on = quick === x.key;
                return <AdminStat key={x.key} label={x.label} value={counted(n)} unit="건" hint={on ? '보는 중' : x.key === 'all' ? `${tabLabel} 탭` : QUICK_HINT[x.key]}
                    attention={QUICK_ATTENTION.has(x.key) && p.loadedOnce && n > 0} active={on}
                    onClick={() => change({ quick: on && x.key !== 'all' ? 'all' : x.key })} />;
            })}
        </AdminStatRow>

        <div className="rl-filters">
            <div className="rl-filters-start">
                <AdminSearch value={q} onChange={value => change({ q: value })} aria-label="예약 검색" placeholder="고객 이름 · 연락처 · 가이드 · 예약번호" className="rl-search" />
                <span className="rl-count" role="status"><b>{p.loadedOnce ? `${list.length}건` : '불러오는 중…'}</b>{p.loadedOnce && ` · ${SORT_TEXT[sort]}`}</span>
                {assignmentNote && !p.loading && <span className="rl-note">{assignmentNote}</span>}
            </div>
            <AdminSegmented label="정렬" value={sort} onChange={value => change({ sort: value })} className="rl-sort"
                items={[{ value: 'pri', label: '처리 우선' }, { value: 'dep', label: '출발일순' }, { value: 'bk', label: '예약일순' }]} />
        </div>

        <section aria-label="예약 목록" className="rl-card">
            {page.rows.length ? <AdminTable label={`${scopeLabel} 예약 목록`} className="rl-table">
                <colgroup>
                    <col className="rl-col-check" /><col className="rl-col-cust" /><col className="rl-col-date" /><col className="rl-col-product" /><col className="rl-col-people" />
                    <col className="rl-col-assign" /><col className="rl-col-pay" /><col className="rl-col-step" /><col className="rl-col-more" />
                </colgroup>
                <AdminThead>
                    <AdminTr>
                        <AdminTh><span className="adm-ui-sr">선택</span>
                            <AdminCheckbox size="sm" aria-label="이 쪽 모두 선택" checked={pageOn > 0 && pageOn === pageKeys.length} indeterminate={pageOn > 0 && pageOn < pageKeys.length} onChange={togglePage} />
                        </AdminTh>
                        <AdminTh>고객</AdminTh><AdminTh>출발</AdminTh><AdminTh>상품 · 지역</AdminTh><AdminTh align="right">인원</AdminTh>
                        <AdminTh>배정</AdminTh><AdminTh align="right">결제</AdminTh><AdminTh>진행</AdminTh><AdminTh><span className="adm-ui-sr">상세</span></AdminTh>
                    </AdminTr>
                </AdminThead>
                <AdminTbody>
                    {page.rows.map(row => <ListRow key={row.key} row={row} selected={sel.has(row.key)}
                        onCheck={() => toggleKey(row.key)} onOpen={() => p.onOpen(row.source)} />)}
                </AdminTbody>
            </AdminTable>
                : <AdminEmpty icon={<IconInbox aria-hidden="true" />} title={p.loading && !p.loadedOnce ? '예약을 불러오는 중…' : '이 조건에 해당하는 예약이 없어요.'}
                    description={!p.loading && (quick !== 'all' || q.trim()) ? '빠른 필터나 검색어를 바꿔 보세요.' : undefined}
                    action={!p.loading && (quick !== 'all' || q.trim()) ? <AdminButton size="sm" variant="weak" onClick={() => change({ quick: 'all', q: '' })}>필터 지우기</AdminButton> : undefined} />}

            {list.length > 0 && <AdminPagination className="rl-pagination" page={page.page} totalPages={page.totalPages} onChange={next => setView(prev => ({ ...prev, page: next }))}
                summary={<span className="rl-page-summary">{reservationPageSummary(list.length, page.start, page.end)}
                    <AdminSelect aria-label="쪽당 건수" className="rl-page-size" value={String(view.size)} onChange={value => change({ size: Number(value) })}
                        options={RESERVATION_PAGE_SIZES.map(n => ({ value: String(n), label: `${n}건씩` }))} />
                </span>} />}
        </section>

        {selected.length > 0 && <div role="toolbar" aria-label="선택한 예약 일괄 작업" className="rl-bulk">
            <div className="rl-bulk-start">
                <b>{selected.length}건 선택</b>
                <AdminTextButton tone="assistive" size="sm" onClick={() => setSel(new Set())}>선택 해제</AdminTextButton>
            </div>
            <div className="rl-bulk-actions">
                <AdminButton variant="weak" size="sm" trailing={<IconChevronDownSmall aria-hidden="true" />} onClick={bulkStatus}>진행상황 바꾸기</AdminButton>
                <AdminButton variant="weak" size="sm" trailing={<IconChevronDownSmall aria-hidden="true" />} onClick={bulkPayment}>입금 확인</AdminButton>
                <AdminButton variant="secondary" size="sm" trailing={<IconChevronDownSmall aria-hidden="true" />} onClick={bulkNotice}>안내 알림 보내기</AdminButton>
                <AdminButton variant="weak" size="sm" onClick={exportSelected}>선택 {selected.length}건 Excel</AdminButton>
                <AdminIconButton label="선택 해제" size="sm" onClick={() => setSel(new Set())}><IconClose /></AdminIconButton>
            </div>
        </div>}
        <V7Menu menu={menu} onClose={closeMenu} />
        <V7Toast text={toast} />
    </div>;
}

function ListRow({ row, selected, onCheck, onOpen }: { row: V7Row; selected: boolean; onCheck: () => void; onOpen: () => void }) {
    const r = row.source, cancel = row.tab === 'cancel', contractTab = row.tab === 'contract';
    const dd = v7Dday(row), period = v7Range(row), step = v7StepLabel(row);
    const payText = cancel ? '취소' : !row.depositPaid ? '예약금 미입금' : row.balancePaid ? '완납' : `잔금 ${v7Won(r.balance)} 미수`;
    const payWarn = !cancel && (!row.depositPaid || (!row.balancePaid && (!contractTab || (row.dday !== null && row.dday <= 7))));
    const kind = r.type === 'quote_booking' ? '견적' : '상품';
    // 2주 안에 출발하는 계약 완료 예약은 D-day를 진하게, 남은 배정·진행을 빨강으로 강조한다(강력 개선안).
    const urgent = contractTab && row.dday !== null && row.dday >= 0 && row.dday <= URGENT_DAYS;
    // 예전 수동 예약은 빈 연락처가 글자 'undefined'로 저장된 경우가 있다(서버 String(undefined)).
    const contact = [r.phone, r.email].map(v => (v || '').trim()).find(v => v && v !== 'undefined' && v !== 'null') || '';
    const name = r.customerName || '이름 미정';
    const asg = cancel ? [] : [
        { key: 'guide', label: '가이드', done: !!row.guide, title: row.guide ? `가이드 · ${row.guide.name}` : '가이드 미배정' },
        { key: 'car', label: '차량', done: !!row.vehicle, title: row.vehicle ? `차량 · ${row.vehicle.type}` : '차량 미배정' },
        { key: 'stay', label: row.accN && !row.accDone ? `숙소 ${row.accC}/${row.accN}` : '숙소', done: row.accDone, title: row.accN ? `숙소 ${row.accC}/${row.accN}박 확정` : '숙박 없음' },
    ];
    return <AdminTr selected={selected} className={cx('rl-row', 'is-clickable', cancel && 'is-cancel')}
        onClick={e => { if (!(e.target as Element).closest('button, a, input, label, [role="menuitem"]')) onOpen(); }}>
        <AdminTd className="rl-c-check"><AdminCheckbox size="sm" aria-label={`${name} 선택`} checked={selected} onChange={onCheck} /></AdminTd>
        <AdminTd className="rl-c-cust">
            <span className="rl-line"><b className="rl-name">{name}</b><AdminBadge outlined>{kind}</AdminBadge></span>
            <span className={cx('rl-sub', 'rl-ellipsis', !contact && 'is-muted')}>{contact || '연락처 미입력'}</span>
        </AdminTd>
        <AdminTd className="rl-c-date">
            <span className="rl-nowrap rl-strong">{period.range}</span>
            <span className="rl-line"><AdminBadge tone={dd.tone === 'mint' ? 'info' : 'neutral'} strong={urgent}>{dd.label}</AdminBadge>{period.sch && <span className="rl-sub">{period.sch}</span>}</span>
        </AdminTd>
        <AdminTd className="rl-c-product">
            <span className="rl-ellipsis rl-strong" title={r.productName}>{r.productName || row.region || '상품 미정'}</span>
            <span className={cx('rl-sub', 'rl-ellipsis', !row.category && 'is-muted')}>{[r.productName && row.region !== r.productName ? row.region : '', row.category || '분류 미정'].filter(Boolean).join(' · ')}</span>
        </AdminTd>
        <AdminTd align="right" className="rl-c-people"><span className="rl-strong">{r.totalPeople ? `${r.totalPeople}명` : r.headcount || '–'}</span></AdminTd>
        <AdminTd className="rl-c-assign">
            <span className="rl-asg">{asg.map(a => <AdminBadge key={a.key} title={a.title} className={cx('rl-chip', a.done ? 'is-done' : urgent ? 'is-urgent' : 'is-todo')}
                icon={a.done ? <IconCheckThick aria-hidden="true" className="rl-chip-mark" /> : <span aria-hidden="true" className="rl-chip-dot" />}>{a.label}</AdminBadge>)}
                {cancel && <span className="rl-sub">–</span>}
            </span>
        </AdminTd>
        <AdminTd align="right" className="rl-c-pay">
            <b className="rl-nowrap rl-total">{v7Won(r.totalAmount)}</b>
            <span className={cx('rl-sub', 'rl-nowrap', payWarn && 'is-warn', !payWarn && row.balancePaid && !cancel && 'is-ok')}>{payText}</span>
        </AdminTd>
        <AdminTd className="rl-c-step">
            <AdminBadge tone={step.tone === 'red' ? (urgent ? 'danger' : 'neutral') : STEP_TONE[step.tone]} size="md" title={step.label}>
                {step.next}{step.more > 0 && <span className="rl-more">+{step.more}</span>}
            </AdminBadge>
            <span className="rl-sub">{statusLabelOf(r)}</span>
        </AdminTd>
        <AdminTd className="rl-c-more">
            <AdminIconButton label={`${name} 예약 상세 보기`} onClick={onOpen}><IconChevronRight /></AdminIconButton>
        </AdminTd>
    </AdminTr>;
}
