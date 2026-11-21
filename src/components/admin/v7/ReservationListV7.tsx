import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IconArrowUpRight, IconCheckThick, IconChevronDown, IconChevronDownSmall, IconChevronUp, IconCircleExclamation, IconClose, IconInbox } from '@montage-ui/icon';
import {
    AdminBadge, AdminButton, AdminCard, AdminCheckbox, AdminEmpty, AdminIconButton, AdminPagination, AdminSearch, AdminSegmented, AdminSelect,
    AdminStat, AdminStatRow, AdminTable, AdminTabs, AdminTbody, AdminTd, AdminTextButton, AdminTh, AdminThead, AdminTr, cx, type AdminTone,
} from '../ui';
import { dashboardSeoulDate } from '../../../utils/adminDashboard';
import { confirmGuideConflict, guideMenuItems } from './guideMenuItems';
import { loadRegisteredAssignmentResources, type RegisteredAssignmentResources } from '../../../utils/registeredAssignmentResources';
import { selectResourceGuide, selectResourceVehicle } from '../../../utils/accommodationResourceSelection';
import { AIRFARE_OPTIONS, CATEGORY_OPTIONS, JOINING_LABELS, RECEIPT_LABELS, SERVICE_TYPE_OPTIONS, type ReceiptStatus, type ReservationOperations } from '../../../utils/reservationWorkspace';
import {
    V7_QUICK, V7_TABS, fetchV7Assignments, saveV7Assignment, v7Dday, v7Matches, v7Range, v7Row, v7Sort, v7StepLabel, v7StepSubs, v7Won, withGuide, withVehicle,
    type V7AssignmentItem, type V7Quick, type V7Row, type V7Source, type V7Tab,
} from '../../../utils/reservationV7';
import {
    RESERVATION_PAGE_SIZES, readReservationListView, reservationListViewSearch, reservationPage, reservationPageSummary, type ReservationListView,
} from '../../../utils/reservationListView';
import { V7Menu, V7Steps, V7StepHead, V7Styles, V7Toast, menuAt, type V7MenuItem, type V7MenuState } from './v7Ui';
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
const dot = (key: string) => key.replaceAll('-', '.');
const monthOf = (value?: string) => /^\d{4}-(\d{2})/.exec(value || '')?.[1];

/** Excel 범위 메뉴가 쓰는 지금 목록의 키(`product:<id>` / `quote_booking:<id>`) */
export interface ReservationListScope { visible: string[]; selected: string[]; label: string }

export interface ReservationListV7Props {
    reservations: V7Source[];
    loading: boolean;
    loadedOnce: boolean;
    userId: string;
    onOpen: (r: V7Source, action?: V7OpenAction) => void;
    onStatus: (r: V7Source, status: string) => Promise<void>;
    onPayment: (r: V7Source, field: 'deposit' | 'final', paid: boolean) => Promise<boolean>;
    onOperations: (r: V7Source, patch: Partial<ReservationOperations>) => Promise<boolean>;
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

    const [open, setOpen] = useState<string | null>(null);
    const [sel, setSel] = useState<Set<string>>(() => new Set());
    const [menu, setMenu] = useState<V7MenuState | null>(null);
    const [toast, setToast] = useState('');
    const [items, setItems] = useState<Map<string, V7AssignmentItem>>(() => new Map());
    const [assignmentNote, setAssignmentNote] = useState('');
    const [resources, setResources] = useState<RegisteredAssignmentResources | null>(null);
    const [busy, setBusy] = useState('');
    const toastTimer = useRef<number | undefined>(undefined);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; window.clearTimeout(toastTimer.current); }; }, []);
    const flash = useCallback((text: string) => { window.clearTimeout(toastTimer.current); setToast(text); toastTimer.current = window.setTimeout(() => mounted.current && setToast(''), 2600); }, []);

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
    const ensureResources = useCallback(async () => {
        if (resources) return resources;
        try {
            const loaded = await loadRegisteredAssignmentResources({ accountId: p.userId });
            if (mounted.current) setResources(loaded);
            if (loaded.warnings[0]) flash(loaded.warnings[0]);
            return loaded;
        } catch { flash('등록된 가이드·차량 자료를 불러오지 못했습니다.'); return null; }
    }, [resources, p.userId, flash]);

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
    const quoteOnly = (row: V7Row, action: V7OpenAction, what: string) => { flash(`견적 예약의 ${what}은 예약관리 편집기에서 바꿉니다`); p.onOpen(row.source, action); };

    const saveAssignment = async (row: V7Row, build: (item: V7AssignmentItem) => Parameters<typeof saveV7Assignment>[1], done: string, allowGuideConflict = false): Promise<void> => {
        const item = row.assignment;
        if (!item) { flash('배정 정보를 아직 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); void loadAssignments(); return; }
        if (busy) return;
        setBusy(row.key);
        let retry = false;
        try {
            const saved = await saveV7Assignment(item, build(item), { allowGuideConflict });
            if (!mounted.current) return;
            setItems(prev => new Map(prev).set(saved.key, saved));
            flash(done);
        } catch (e: any) {
            if (mounted.current && !allowGuideConflict && await confirmGuideConflict(e)) retry = true;
            else if (mounted.current) { flash(e?.message || '배정을 저장하지 못했습니다.'); void loadAssignments(); }
        } finally {
            if (mounted.current) setBusy('');
            if (retry) window.setTimeout(() => { void saveAssignment(row, build, done, true); }, 0);
        }
    };
    const guideMenu = async (e: React.MouseEvent, row: V7Row) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement, loaded = await ensureResources();
        const bookings = [...items.values()];
        const options: V7MenuItem[] = [
            { key: 'none', label: '배정 해제', muted: true, on: !row.guide, onPick: () => row.guide && void saveAssignment(row, item => withGuide(item, { id: '', name: '', phone: '' }), `${row.source.customerName} · 가이드 배정을 해제했어요`) },
            ...guideMenuItems(loaded?.guides || [], bookings, { id: row.source.id, source: row.source.type === 'quote_booking' ? 'quote_booking' : 'product', startDate: row.source.startDate, endDate: row.source.endDate }, row.guide?.name,
                (guide, confirmed) => { void saveAssignment(row, item => withGuide(item, selectResourceGuide(item.assignment.guide, guide)), `${row.source.customerName} · ${guide.name} 가이드를 배정했어요`, confirmed); }),
        ];
        setMenu(menuAt(target, '가이드 선택', options, true));
    };
    const vehicleMenu = async (e: React.MouseEvent, row: V7Row) => {
        e.stopPropagation();
        const target = e.currentTarget as HTMLElement, loaded = await ensureResources();
        const options: V7MenuItem[] = [
            { key: 'none', label: '배정 해제', muted: true, on: !row.vehicle, onPick: () => row.vehicle && void saveAssignment(row, item => withVehicle(item, { type: '', phone: '' }), `${row.source.customerName} · 차량 배정을 해제했어요`) },
            ...(loaded?.vehicles || []).map(vehicle => ({ key: vehicle.name, label: vehicle.name, on: row.vehicle?.type === vehicle.type,
                sub: [vehicle.snapshot.seats && `${vehicle.snapshot.seats}인승`, vehicle.snapshot.plate].filter(Boolean).join(' · ') || undefined, subTone: 'muted' as const,
                onPick: () => void saveAssignment(row, item => withVehicle(item, selectResourceVehicle(item.assignment.vehicle, vehicle)), `${row.source.customerName} · ${vehicle.name} 차량을 배정했어요`) })),
        ];
        setMenu(menuAt(target, '차량 선택', options, true));
    };
    const statusMenu = (e: React.MouseEvent, row: V7Row) => {
        if (row.source.type === 'quote_booking') { openMenu(e, '진행상황 변경', [{ key: 'open', label: '예약관리 편집기에서 변경', sub: '견적 예약의 상태는 원래 편집기에서 바꿉니다', subTone: 'muted', onPick: () => p.onOpen(row.source, 'payments') }], true); return; }
        openMenu(e, '진행상황 변경', PRODUCT_STATUS_OPTIONS.map(o => ({ key: o.value, label: o.label, on: row.source.status === o.value, onPick: async () => {
            if (o.value === row.source.status) return;
            if (o.value === 'cancelled' && !await adminConfirm(`${row.source.customerName} 예약을 취소 상태로 바꿀까요? 고객에게 취소 알림이 갑니다.`)) return;
            void p.onStatus(row.source, o.value).then(() => flash(`${row.source.customerName} · ${o.label}(으)로 변경했어요`));
        } })));
    };
    const paymentMenu = (e: React.MouseEvent, row: V7Row, field: 'deposit' | 'final') => {
        if (row.source.type === 'quote_booking') { e.stopPropagation(); quoteOnly(row, 'payments', '입금 확인'); return; }
        const paid = field === 'deposit' ? row.depositPaid : row.balancePaid, labels = field === 'deposit' ? ['입금 완료', '미입금'] : ['완납', '미수'];
        openMenu(e, field === 'deposit' ? '예약금' : '잔금', labels.map((label, i) => ({ key: label, label, on: paid === (i === 0), onPick: async () => {
            if (paid === (i === 0)) return;
            if (field === 'deposit' && i === 0 && !await adminConfirm(`${row.source.customerName} 예약금 ${v7Won(row.source.deposit)} 입금을 확인할까요?${row.source.status === 'pending_payment' ? '\n예약이 확정되고 고객에게 입금 확인 메일이 발송됩니다.' : ''}`)) return;
            if (await p.onPayment(row.source, field, i === 0)) flash(`${row.source.customerName} · ${field === 'deposit' ? '예약금' : '잔금'} ${label}(으)로 변경했어요`);
        } })));
    };
    const opsMenu = (e: React.MouseEvent, row: V7Row, key: OpsKey) => {
        if (row.source.type === 'quote_booking') { e.stopPropagation(); quoteOnly(row, 'payments', key === 'receipt' ? '현금영수증' : '분류 정보'); return; }
        const save = (patch: Partial<ReservationOperations>, label: string) => void p.onOperations(row.source, patch).then(ok => ok && flash(`${row.source.customerName} · ${label}(으)로 변경했어요`));
        const titles = { joining: '조인여부', category: '분류', serviceType: '구분', airfare: '항공', receipt: '현금영수증' };
        let options: V7MenuItem[];
        if (key === 'joining') options = (['join', 'private', 'undecided'] as const).map(v => ({ key: v, label: JOINING_LABELS[v], on: row.joining === v, onPick: () => save({ joining: v }, JOINING_LABELS[v]) }));
        else if (key === 'receipt') options = (Object.keys(RECEIPT_LABELS) as ReceiptStatus[]).map(v => ({ key: v, label: RECEIPT_LABELS[v], on: row.receipt === v, onPick: () => save({ receipt: { status: v } as any }, RECEIPT_LABELS[v]) }));
        else {
            const base = key === 'category' ? CATEGORY_OPTIONS : key === 'serviceType' ? SERVICE_TYPE_OPTIONS : AIRFARE_OPTIONS, current = row[key];
            options = [...(current && !base.includes(current) ? [current] : []), ...base].map(v => ({ key: v, label: v, on: current === v, onPick: () => save({ [key]: v }, v) }));
            options.push({ key: '__none', label: '미정으로 비우기', muted: true, on: !current, onPick: () => save({ [key]: '' }, '미정') });
        }
        openMenu(e, titles[key], options);
    };

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

    // Claude Design ‘통합 예약 목록 리뉴얼 시안’(2026-11-21 오너 확인): 빠른 필터 6칸 → 카드(탭 · 검색·정렬 · 표 · 페이지) → 선택 시 일괄 작업 줄.
    return <div className="rl-root">
        <V7Styles />
        <AdminStatRow label="빠른 필터" className="rl-stats">
            {V7_QUICK.map(x => {
                const n = inTab.filter(x.test).length, on = quick === x.key;
                return <AdminStat key={x.key} label={x.label} value={counted(n)} unit="건" hint={on ? '보는 중' : x.key === 'all' ? `${tabLabel} 탭` : QUICK_HINT[x.key]}
                    attention={QUICK_ATTENTION.has(x.key) && p.loadedOnce && n > 0} active={on}
                    onClick={() => { change({ quick: on && x.key !== 'all' ? 'all' : x.key }); setOpen(null); }} />;
            })}
        </AdminStatRow>

        <section aria-label="예약 목록" className="rl-card">
            <div className="rl-tabs">
                <AdminTabs label="예약 진행 상태" value={tab} onChange={value => { change({ tab: value as V7Tab, quick: 'all' }); setSel(new Set()); setOpen(null); }}
                    items={V7_TABS.map(t => ({ value: t.key, label: t.label, count: counted(tabCount(t.key)) }))} />
            </div>

            <div className="rl-filters">
                <div className="rl-filters-start">
                    <AdminSearch value={q} onChange={value => change({ q: value })} aria-label="예약 검색" placeholder="고객 이름 · 연락처 · 가이드 · 예약번호" className="rl-search" />
                    <span className="rl-count" role="status"><b>{p.loadedOnce ? `${list.length}건` : '불러오는 중…'}</b>{p.loadedOnce && ` · ${SORT_TEXT[sort]}`}</span>
                    {assignmentNote && !p.loading && <span className="rl-note">{assignmentNote}</span>}
                </div>
                <AdminSegmented label="정렬" value={sort} onChange={value => change({ sort: value })}
                    items={[{ value: 'pri', label: '처리 우선' }, { value: 'dep', label: '출발일순' }, { value: 'bk', label: '예약일순' }]} />
            </div>

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
                        <AdminTh>배정</AdminTh><AdminTh align="right">결제</AdminTh><AdminTh>진행</AdminTh><AdminTh><span className="adm-ui-sr">관리</span></AdminTh>
                    </AdminTr>
                </AdminThead>
                <AdminTbody>
                    {page.rows.map(row => <ListRow key={row.key} row={row} open={open === row.key} selected={sel.has(row.key)} busy={busy === row.key}
                        onToggle={() => setOpen(open === row.key ? null : row.key)} onCheck={() => toggleKey(row.key)}
                        onOpen={action => p.onOpen(row.source, action)}
                        guideMenu={e => void guideMenu(e, row)} vehicleMenu={e => void vehicleMenu(e, row)} statusMenu={e => statusMenu(e, row)}
                        paymentMenu={(e, field) => paymentMenu(e, row, field)} opsMenu={(e, key) => opsMenu(e, row, key)} />)}
                </AdminTbody>
            </AdminTable>
                : <AdminEmpty icon={<IconInbox aria-hidden="true" />} title={p.loading && !p.loadedOnce ? '예약을 불러오는 중…' : '이 조건에 해당하는 예약이 없어요.'}
                    description={!p.loading && (quick !== 'all' || q.trim()) ? '빠른 필터나 검색어를 바꿔 보세요.' : undefined}
                    action={!p.loading && (quick !== 'all' || q.trim()) ? <AdminButton size="sm" variant="weak" onClick={() => change({ quick: 'all', q: '' })}>필터 지우기</AdminButton> : undefined} />}

            {list.length > 0 && <AdminPagination className="rl-pagination" page={page.page} totalPages={page.totalPages} onChange={next => { setView(prev => ({ ...prev, page: next })); setOpen(null); }}
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

type OpsKey = 'joining' | 'category' | 'serviceType' | 'airfare' | 'receipt';
type Tone = 'ok' | 'warn' | 'plain';
interface PanelItem { label: string; sub?: string; value?: string; tone?: Tone; go?: (e: React.MouseEvent) => void; link?: () => void }

function ListRow({ row, open, selected, busy, onToggle, onCheck, onOpen, guideMenu, vehicleMenu, statusMenu, paymentMenu, opsMenu }: {
    row: V7Row; open: boolean; selected: boolean; busy: boolean;
    onToggle: () => void; onCheck: () => void; onOpen: (action?: V7OpenAction) => void;
    guideMenu: (e: React.MouseEvent) => void; vehicleMenu: (e: React.MouseEvent) => void; statusMenu: (e: React.MouseEvent) => void;
    paymentMenu: (e: React.MouseEvent, field: 'deposit' | 'final') => void; opsMenu: (e: React.MouseEvent, key: OpsKey) => void;
}) {
    const r = row.source, cancel = row.tab === 'cancel', contractTab = row.tab === 'contract';
    const dd = v7Dday(row), period = v7Range(row), step = v7StepLabel(row), subs = v7StepSubs(row);
    const payText = cancel ? '취소' : !row.depositPaid ? '예약금 미입금' : row.balancePaid ? '완납' : `잔금 ${v7Won(r.balance)} 미수`;
    const payWarn = !cancel && (!row.depositPaid || (!row.balancePaid && (!contractTab || (row.dday !== null && row.dday <= 7))));
    const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
    const kind = r.type === 'quote_booking' ? '견적' : '상품';
    const bookedKey = r.bookedAtMs ? dashboardSeoulDate(new Date(r.bookedAtMs).toISOString()) : '';
    const signedMonth = monthOf((r.contractData?.agreement as any)?.agreedAt);
    const left = (arr: boolean[]) => arr.filter(Boolean).length;
    const receiptLate = row.ended && ['pending', 'info_missing'].includes(row.receipt);
    const asg = cancel ? [] : [
        { key: 'guide', label: '가이드', done: !!row.guide, title: row.guide ? `가이드 · ${row.guide.name}` : '가이드 미배정' },
        { key: 'car', label: '차량', done: !!row.vehicle, title: row.vehicle ? `차량 · ${row.vehicle.type}` : '차량 미배정' },
        { key: 'stay', label: row.accN && !row.accDone ? `숙소 ${row.accC}/${row.accN}` : '숙소', done: row.accDone, title: row.accN ? `숙소 ${row.accC}/${row.accN}박 확정` : '숙박 없음' },
    ];
    const cards: Array<{ title: string; todo: number; items: PanelItem[] }> = [
        { title: '결제', todo: left([!row.depositPaid, !row.balancePaid, receiptLate]), items: [
            { label: '팀 총액', sub: v7Won(r.totalAmount) },
            { label: '예약금', sub: v7Won(r.deposit), value: row.depositPaid ? '입금 완료' : '미입금', tone: row.depositPaid ? 'ok' : 'warn', go: e => paymentMenu(e, 'deposit') },
            { label: '잔금', sub: v7Won(r.balance), value: row.balancePaid ? '완납' : '미수', tone: row.balancePaid ? 'ok' : 'warn', go: e => paymentMenu(e, 'final') },
            { label: '현금영수증', value: RECEIPT_LABELS[row.receipt as ReceiptStatus] || row.receipt, tone: receiptLate ? 'warn' : 'plain', go: e => opsMenu(e, 'receipt') }] },
        { title: '배정', todo: left([!row.guide, !row.vehicle, !row.accDone]), items: [
            { label: '가이드', value: row.guide?.name || '고르기', tone: row.guide ? 'plain' : 'warn', go: guideMenu },
            { label: '차량', value: row.vehicle?.type || '고르기', tone: row.vehicle ? 'plain' : 'warn', go: vehicleMenu },
            { label: '숙소', sub: row.accN ? `${row.accC}/${row.accN}박 확정` : '숙박 없음', value: '박별 관리', tone: row.accDone ? 'plain' : 'warn', go: stop(() => onOpen('stay')) }] },
        { title: '분류', todo: 0, items: [
            { label: '조인여부', value: JOINING_LABELS[row.joining as keyof typeof JOINING_LABELS] || '미정', go: e => opsMenu(e, 'joining') },
            { label: '분류', value: row.category || '미정', go: e => opsMenu(e, 'category') },
            { label: '구분', value: row.serviceType || '미정', go: e => opsMenu(e, 'serviceType') },
            { label: '항공', value: row.airfare || '미정', go: e => opsMenu(e, 'airfare') }] },
        { title: '서류', todo: left([!row.signed]), items: [
            { label: r.type === 'quote_booking' ? '견적서' : '일정표', link: () => r.type === 'quote_booking' ? onOpen('documents') : window.open(`/documents/itinerary/${encodeURIComponent(r.id)}?preview=1`, '_blank', 'noopener') },
            { label: '계약서', value: row.signed ? '서명 완료' : '미작성', tone: row.signed ? 'ok' : 'warn', go: stop(() => onOpen('contract')),
                link: () => r.type === 'quote_booking' ? onOpen('contract') : window.open(`/documents/contract/${encodeURIComponent(r.id)}`, '_blank', 'noopener') }] },
    ];
    const rowClass = cx('rl-row', open && 'is-open', cancel && 'is-cancel');
    return <>
        <AdminTr selected={selected} className={cx(rowClass, 'is-clickable')} aria-busy={busy || undefined}
            onClick={e => { if (!(e.target as Element).closest('button, a, input, label, [role="menuitem"]')) onToggle(); }}>
            <AdminTd className="rl-c-check"><AdminCheckbox size="sm" aria-label={`${r.customerName || '이름 미정'} 선택`} checked={selected} onChange={onCheck} /></AdminTd>
            <AdminTd className="rl-c-cust">
                <span className="rl-line"><b className="rl-name">{r.customerName || '이름 미정'}</b><AdminBadge outlined>{kind}</AdminBadge></span>
                <span className="rl-sub">{r.reservationNumber || r.phone || r.email || '연락처 미입력'}</span>
            </AdminTd>
            <AdminTd className="rl-c-date">
                <span className="rl-nowrap">{period.range}</span>
                <span className="rl-line"><AdminBadge tone={dd.tone === 'red' ? 'neutral' : dd.tone === 'mint' ? 'info' : 'neutral'} strong={dd.tone === 'red'}>{dd.label}</AdminBadge>{period.sch && <span className="rl-sub">{period.sch}</span>}</span>
            </AdminTd>
            <AdminTd className="rl-c-product">
                <span className="rl-ellipsis" title={r.productName}>{r.productName || '상품 미정'}</span>
                <span className="rl-sub rl-ellipsis">{[row.region !== r.productName ? row.region : '', row.category || '분류 미정'].filter(Boolean).join(' · ')}</span>
            </AdminTd>
            <AdminTd align="right" className="rl-c-people">{r.totalPeople ? `${r.totalPeople}명` : r.headcount || '–'}</AdminTd>
            <AdminTd className="rl-c-assign">
                <span className="rl-asg">{asg.map(a => a.done
                    ? <AdminBadge key={a.key} title={a.title} icon={<IconCheckThick aria-hidden="true" className="rl-ok" />}>{a.label}</AdminBadge>
                    : <AdminBadge key={a.key} title={a.title} tone={contractTab ? 'danger' : 'neutral'} icon={contractTab ? <IconCircleExclamation aria-hidden="true" /> : undefined}>{a.label}</AdminBadge>)}
                    {cancel && <span className="rl-sub">–</span>}
                </span>
            </AdminTd>
            <AdminTd align="right" className="rl-c-pay">
                <b className="rl-nowrap">{v7Won(r.totalAmount)}</b>
                <span className={cx('rl-sub', 'rl-nowrap', payWarn && 'is-warn', !payWarn && row.balancePaid && !cancel && 'is-ok')}>{payText}</span>
            </AdminTd>
            <AdminTd className="rl-c-step">
                <AdminBadge tone={STEP_TONE[step.tone]} size="md">{step.label}</AdminBadge>
                <span className="rl-sub">{statusLabelOf(r)}</span>
            </AdminTd>
            <AdminTd className="rl-c-more">
                <AdminIconButton label={`${r.customerName || '예약'} ${open ? '접기' : '펼치기'}`} aria-expanded={open} onClick={onToggle}>
                    {open ? <IconChevronUp /> : <IconChevronDown />}
                </AdminIconButton>
            </AdminTd>
        </AdminTr>
        {open && <AdminTr className="rl-panel-row">
            <AdminTd colSpan={9} className="rl-panel-cell">
                <div className="rl-panel">
                    <div className="rl-panel-head">
                        <span className="rl-sub">{[r.reservationNumber && `예약번호 ${r.reservationNumber}`, `예약일 ${bookedKey ? dot(bookedKey) : '–'}`, `계약 ${signedMonth ? `${+signedMonth}월` : '서명 전'}`,
                            `투어 ${monthOf(r.startDate) ? `${+monthOf(r.startDate)!}월` : '미정'}`, r.type === 'quote_booking' ? '맞춤 견적' : '상품 예약'].filter(Boolean).join(' · ')}</span>
                        <span className="rl-panel-actions">
                            <AdminButton size="sm" variant="weak" trailing={<IconChevronDownSmall aria-hidden="true" />} onClick={statusMenu} disabled={busy}>진행상황 · {statusLabelOf(r)}</AdminButton>
                            <AdminButton size="sm" variant="weak" onClick={stop(() => onOpen('edit-itinerary'))}>일정표 편집</AdminButton>
                            <AdminTextButton size="sm" trailing={<IconArrowUpRight aria-hidden="true" />} onClick={stop(() => onOpen())}>예약 상세 열기</AdminTextButton>
                        </span>
                    </div>
                    <div className="rl-panel-steps">
                        <V7StepHead label={step.label} tone={step.tone} count={cancel ? '' : `${row.steps.filter(s => s.done).length} / 5 단계 완료`} />
                        <V7Steps steps={row.steps.map((s, i) => ({ ...s, sub: subs[i] }))} cancelled={cancel} />
                    </div>
                    <div className="rl-panel-cards">
                        {cards.map(c => <AdminCard key={c.title} as="div" title={c.title} attention={c.todo > 0} className="rl-panel-card"
                            actions={<AdminBadge tone={c.todo ? 'danger' : 'info'}>{c.todo ? `${c.todo}건 남음` : '완료'}</AdminBadge>}>
                            <dl className="rl-items">
                                {c.items.map(it => <div key={it.label} className="rl-item">
                                    <dt>{it.label}{it.sub && <span className="rl-item-sub">{it.sub}</span>}</dt>
                                    <dd>
                                        {it.go && it.value && <AdminButton size="sm" variant="weak" disabled={busy} trailing={<IconChevronDownSmall aria-hidden="true" />} onClick={it.go}
                                            className={cx('rl-item-btn', it.tone === 'warn' && 'is-warn', it.tone === 'ok' && 'is-ok')}>{it.value}</AdminButton>}
                                        {it.link && <AdminTextButton size="sm" tone="assistive" trailing={<IconArrowUpRight aria-hidden="true" />} onClick={stop(it.link)}>열기</AdminTextButton>}
                                    </dd>
                                </div>)}
                            </dl>
                        </AdminCard>)}
                    </div>
                </div>
            </AdminTd>
        </AdminTr>}
    </>;
}
