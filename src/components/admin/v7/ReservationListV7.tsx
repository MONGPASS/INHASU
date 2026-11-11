import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DashboardIconName } from '../dashboard/DashboardIcon';
import { dashboardSeoulDate } from '../../../utils/adminDashboard';
import { confirmGuideConflict, guideMenuItems } from './guideMenuItems';
import { loadRegisteredAssignmentResources, type RegisteredAssignmentResources } from '../../../utils/registeredAssignmentResources';
import { selectResourceGuide, selectResourceVehicle } from '../../../utils/accommodationResourceSelection';
import { AIRFARE_OPTIONS, CATEGORY_OPTIONS, JOINING_LABELS, RECEIPT_LABELS, SERVICE_TYPE_OPTIONS, type ReceiptStatus, type ReservationOperations } from '../../../utils/reservationWorkspace';
import {
    V7_QUICK, V7_TABS, fetchV7Assignments, saveV7Assignment, v7Dday, v7Matches, v7Range, v7Row, v7Sort, v7StepLabel, v7StepSubs, v7Won, withGuide, withVehicle,
    type V7AssignmentItem, type V7Quick, type V7Row, type V7Sort, type V7Source, type V7Tab,
} from '../../../utils/reservationV7';
import {
    Ico, V7Menu, V7Steps, V7StepHead, V7Styles, V7Toast, V7_INK, V7_MUTED, checkBox, chip, dchip, inkBtn, ghostBtn, menuAt, pill, sel,
    type PillTone, type V7MenuItem, type V7MenuState,
} from './v7Ui';

type Css = React.CSSProperties;
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
const TAB_TONE: Record<V7Tab, PillTone> = { contract: 'gray', ongoing: 'solid', ended: 'mint', cancel: 'gray' };
const NOTICE_KINDS: Array<{ kind: V7NoticeKind; label: string }> = [
    { kind: 'contract', label: '계약서 안내' }, { kind: 'itinerary', label: '확정 일정표' }, { kind: 'travel_notice', label: '여행 주의사항' }, { kind: 'quote', label: '견적서' },
];
const GRID = '20px minmax(150px,1.1fr) 176px 48px minmax(150px,1fr) minmax(330px,1.6fr) 148px 120px 20px';
const dot = (key: string) => key.replaceAll('-', '.');
const monthOf = (value?: string) => /^\d{4}-(\d{2})/.exec(value || '')?.[1];

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
}

export function ReservationListV7(p: ReservationListV7Props) {
    const today = dashboardSeoulDate(new Date().toISOString());
    const [tab, setTab] = useState<V7Tab>('contract');
    const [quick, setQuick] = useState<V7Quick>('all');
    const [sort, setSort] = useState<V7Sort>('pri');
    const [q, setQ] = useState('');
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
    const inTab = rows.filter(r => r.tab === tab);
    const quickDef = V7_QUICK.find(x => x.key === quick) || V7_QUICK[0];
    const list = v7Sort(inTab.filter(quickDef.test).filter(r => v7Matches(r, q)), sort);
    const selected = rows.filter(r => sel.has(r.key));
    const allOn = list.length > 0 && list.every(r => sel.has(r.key));
    useEffect(() => { setSel(prev => { const valid = new Set(rows.map(r => r.key)); const next = new Set([...prev].filter(k => valid.has(k))); return next.size === prev.size ? prev : next; }); }, [rows]);

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
            if (mounted.current && !allowGuideConflict && confirmGuideConflict(e)) retry = true;
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
        openMenu(e, '진행상황 변경', PRODUCT_STATUS_OPTIONS.map(o => ({ key: o.value, label: o.label, on: row.source.status === o.value, onPick: () => {
            if (o.value === row.source.status) return;
            if (o.value === 'cancelled' && !window.confirm(`${row.source.customerName} 예약을 취소 상태로 바꿀까요? 고객에게 취소 알림이 갑니다.`)) return;
            void p.onStatus(row.source, o.value).then(() => flash(`${row.source.customerName} · ${o.label}(으)로 변경했어요`));
        } })));
    };
    const paymentMenu = (e: React.MouseEvent, row: V7Row, field: 'deposit' | 'final') => {
        if (row.source.type === 'quote_booking') { e.stopPropagation(); quoteOnly(row, 'payments', '입금 확인'); return; }
        const paid = field === 'deposit' ? row.depositPaid : row.balancePaid, labels = field === 'deposit' ? ['입금 완료', '미입금'] : ['완납', '미수'];
        openMenu(e, field === 'deposit' ? '예약금' : '잔금', labels.map((label, i) => ({ key: label, label, on: paid === (i === 0), onPick: async () => {
            if (paid === (i === 0)) return;
            if (field === 'deposit' && i === 0 && !window.confirm(`${row.source.customerName} 예약금 ${v7Won(row.source.deposit)} 입금을 확인할까요?${row.source.status === 'pending_payment' ? '\n예약이 확정되고 고객에게 입금 확인 메일이 발송됩니다.' : ''}`)) return;
            if (await p.onPayment(row.source, field, i === 0)) flash(`${row.source.customerName} · ${field === 'deposit' ? '예약금' : '잔금'} ${label}(으)로 변경했어요`);
        } })));
    };
    const opsMenu = (e: React.MouseEvent, row: V7Row, key: 'joining' | 'category' | 'serviceType' | 'airfare' | 'receipt') => {
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
        if (!window.confirm(`선택한 상품 예약 ${targets.length}건을 '${o.label}'(으)로 바꿀까요?${skipped ? `\n견적 예약 ${skipped}건은 제외됩니다.` : ''}`)) return;
        for (const row of targets) await p.onStatus(row.source, o.value);
        setSel(new Set()); flash(`${targets.length}건을 ${o.label}(으)로 옮겼어요`);
    } })));
    const bulkPayment = (e: React.MouseEvent) => openMenu(e, '선택한 예약 입금 확인', (['deposit', 'final'] as const).map(field => ({ key: field, label: field === 'deposit' ? '예약금 입금 확인' : '잔금 완납 확인', onPick: async () => {
        const targets = selected.filter(r => r.source.type === 'product' && !(field === 'deposit' ? r.depositPaid : r.balancePaid)), skipped = selected.filter(r => r.source.type === 'quote_booking').length;
        if (!targets.length) { flash(skipped ? '견적 예약은 예약관리 편집기에서 입금을 확인합니다' : '확인할 미입금 예약이 없어요'); return; }
        if (!window.confirm(`선택한 상품 예약 ${targets.length}건의 ${field === 'deposit' ? '예약금 입금' : '잔금 완납'}을 확인할까요?${field === 'deposit' ? '\n입금 대기 예약은 확정되고 고객에게 입금 확인 메일이 발송됩니다.' : ''}${skipped ? `\n견적 예약 ${skipped}건은 제외됩니다.` : ''}`)) return;
        let ok = 0; for (const row of targets) if (await p.onPayment(row.source, field, true)) ok += 1;
        flash(`${ok}건을 ${field === 'deposit' ? '예약금 입금 완료' : '완납'}로 처리했어요`);
    } })));
    const bulkNotice = (e: React.MouseEvent) => openMenu(e, '선택한 고객에게 안내 알림', NOTICE_KINDS.map(n => ({ key: n.kind, label: n.label, onPick: async () => {
        if (!window.confirm(`선택한 ${selected.length}명에게 '${n.label}' 카카오 알림을 보낼까요?\n준비되지 않은 예약은 보내지 않고 건너뜁니다.`)) return;
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

    // 관리자 화면은 디자인 원본보다 좁아 표가 가로로 스크롤된다. 펼친 패널은 보이는 폭에 고정한다.
    const scroller = useRef<HTMLDivElement>(null);
    const [visibleWidth, setVisibleWidth] = useState(0);
    useEffect(() => {
        const el = scroller.current; if (!el) return;
        const measure = () => setVisibleWidth(el.clientWidth);
        measure(); const observer = new ResizeObserver(measure); observer.observe(el);
        return () => observer.disconnect();
    }, []);
    const tabCount = (key: V7Tab) => rows.filter(r => r.tab === key).length;
    return <div className="v7-root" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <V7Styles />
        <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e9ecef', overflowX: 'auto' }} role="tablist" aria-label="예약 진행 상태">
            {V7_TABS.map(t => { const on = t.key === tab; return <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => { setTab(t.key); setQuick('all'); setSel(new Set()); setOpen(null); }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 44, padding: '0 14px', whiteSpace: 'nowrap', border: 0, background: 'transparent', font: 'inherit', fontSize: 14, fontWeight: on ? 800 : 600, cursor: 'pointer', color: on ? V7_INK : V7_MUTED, boxShadow: on ? 'inset 0 -3px 0 #12b28c' : 'none' }}>
                {t.label}<span style={{ fontSize: 12, fontWeight: 800, minWidth: 20, height: 20, padding: '0 6px', boxSizing: 'border-box', borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? 'linear-gradient(135deg,#1cc497,#0a7f62)' : '#f1f3f5', color: on ? '#fff' : V7_MUTED }}>{p.loadedOnce ? tabCount(t.key) : '–'}</span>
            </button>; })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(max(calc((100% - 50px) / 6), min(calc((100% - 20px) / 3), calc((1100px - 100%) * 999))),1fr))', gap: 10 }}>
            {V7_QUICK.map(x => {
                const on = quick === x.key, matched = inTab.filter(x.test), n = matched.length, warn = x.key !== 'all' && n > 0;
                const sub = x.key === 'bal' ? v7Won(matched.reduce((a, r) => a + (Number.isFinite(r.source.balance) ? r.source.balance : 0), 0)) : x.sub;
                return <button key={x.key} type="button" aria-pressed={on} onClick={() => setQuick(on && x.key !== 'all' ? 'all' : x.key)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, minWidth: 0, padding: '14px 16px', border: 0, borderRadius: 16, font: 'inherit', cursor: 'pointer', textAlign: 'left', background: on ? '#f7fcfa' : '#fff', boxShadow: on ? 'inset 0 0 0 1.5px #12b28c' : '0 0 0 1px #eef0f2', transition: 'box-shadow .15s, background .15s' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
                        <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center', background: warn ? '#ffecec' : '#e9fbf4', color: warn ? '#FF4F4F' : '#0E9E7A' }}><Ico name={x.icon as DashboardIconName} size={14} /></span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#495057', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.label}</span>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 2, whiteSpace: 'nowrap', marginTop: 6 }}>
                        <span style={{ fontSize: 26, lineHeight: '30px', fontWeight: 800, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: warn ? '#FF4F4F' : V7_INK }}>{p.loadedOnce ? n : '–'}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: V7_MUTED }}>건</span>
                    </span>
                    <span style={{ fontSize: 12, lineHeight: '16px', color: V7_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{sub}</span>
                </button>;
            })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ flex: 1, minWidth: 240, maxWidth: 420, display: 'flex', alignItems: 'center', gap: 8, height: 42, padding: '0 14px', background: '#fff', borderRadius: 12, boxShadow: 'inset 0 0 0 1px #e9ecef' }}>
                <Ico name="lc-search" size={16} color={V7_MUTED} />
                <input value={q} onChange={e => setQ(e.target.value)} aria-label="예약 검색" placeholder="고객명, 전화번호, 가이드 이름 검색"
                    style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', font: 'inherit', fontSize: 14, color: V7_INK }} />
                {q && <button type="button" aria-label="검색어 지우기" onClick={() => setQ('')} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'flex', color: V7_MUTED }}><Ico name="lc-x" size={14} /></button>}
            </label>
            {(assignmentNote || p.loading) && <span role="status" style={{ fontSize: 12, fontWeight: 700, color: p.loading ? V7_MUTED : '#e8590c' }}>{p.loading ? '예약을 불러오는 중…' : assignmentNote}</span>}
            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: V7_MUTED }}><Ico name="lc-arrow-up-down" size={14} />정렬</span>
            <span style={{ display: 'flex', padding: 3, borderRadius: 999, background: '#f1f3f5' }}>
                {([['pri', '우선순위'], ['dep', '출발일순'], ['bk', '최근 예약순']] as const).map(([k, label]) => { const on = sort === k; return <button key={k} type="button" aria-pressed={on} onClick={() => setSort(k)}
                    style={{ height: 32, padding: '0 12px', whiteSpace: 'nowrap', border: 0, borderRadius: 999, font: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: on ? '#fff' : 'transparent', color: on ? V7_INK : V7_MUTED, boxShadow: on ? '0 1px 3px rgba(16,24,40,.12)' : 'none' }}>{label}</button>; })}
            </span>
        </div>

        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 0 0 1px #eef0f2', overflow: 'hidden' }}>
            <div ref={scroller} className="v7-list-scroll" style={{ overflowX: 'auto' }}><div className="v7-list-inner" style={{ minWidth: 1380 }} aria-label="통합 예약 목록">
                <div role="row" className="v7-list-head" style={{ display: 'grid', gridTemplateColumns: GRID, columnGap: 20, alignItems: 'center', height: 40, padding: '0 24px', position: 'sticky', top: 0, zIndex: 2, background: '#f8f9fa', borderBottom: '1px solid #e9ecef', fontSize: 12, fontWeight: 700, color: V7_MUTED }}>
                    <button type="button" aria-label="이 목록 전체 선택" aria-pressed={allOn} onClick={() => setSel(prev => { const next = new Set(prev); list.forEach(r => allOn ? next.delete(r.key) : next.add(r.key)); return next; })} style={checkBox(allOn)}>{allOn && <Ico name="lc-check" size={12} color="#fff" />}</button>
                    <span>고객</span><span>투어 기간</span><span style={{ textAlign: 'center' }}>인원</span><span>지역 · 분류</span><span>배정</span><span style={{ textAlign: 'right' }}>결제</span><span>진행상황</span><span />
                </div>
                {list.map(row => <ListRow key={row.key} row={row} panelWidth={visibleWidth} open={open === row.key} dimmed={open !== null && open !== row.key} selected={sel.has(row.key)} busy={busy === row.key}
                    onToggle={() => setOpen(open === row.key ? null : row.key)}
                    onCheck={() => setSel(prev => { const next = new Set(prev); if (next.has(row.key)) next.delete(row.key); else next.add(row.key); return next; })}
                    onOpen={action => p.onOpen(row.source, action)}
                    guideMenu={e => void guideMenu(e, row)} vehicleMenu={e => void vehicleMenu(e, row)} statusMenu={e => statusMenu(e, row)}
                    paymentMenu={(e, field) => paymentMenu(e, row, field)} opsMenu={(e, key) => opsMenu(e, row, key)} />)}
                {!list.length && <div style={{ padding: '56px 20px', textAlign: 'center', fontSize: 14, color: V7_MUTED }}>{p.loading && !p.loadedOnce ? '예약을 불러오는 중…' : '이 조건에 해당하는 예약이 없어요.'}</div>}
            </div></div>
        </div>

        {selected.length > 0 && <div role="toolbar" aria-label="선택한 예약 작업" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 50, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 8px 8px 18px', background: V7_INK, borderRadius: 999, boxShadow: '0 12px 32px rgba(16,24,40,.28)', animation: 'rvUp 180ms ease-out', whiteSpace: 'nowrap' }}>
            <b style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginRight: 8 }}>{selected.length}건 선택</b>
            {([['진행상황 변경', 'lc-arrow-left-right', bulkStatus], ['입금 확인', 'lc-wallet', bulkPayment], ['안내 알림 발송', 'lc-send', bulkNotice], ['엑셀 내보내기', 'lc-download', exportSelected]] as const).map(([label, icon, go]) =>
                <button key={label} type="button" className="v7-bulk-btn" onClick={go as any} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, padding: '0 14px', border: 0, borderRadius: 999, background: 'rgba(255,255,255,.1)', font: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}><Ico name={icon} size={15} />{label}</button>)}
            <button type="button" title="선택 해제" aria-label="선택 해제" onClick={() => setSel(new Set())} style={{ width: 38, height: 38, border: 0, borderRadius: 999, background: 'transparent', color: '#adb5bd', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name="lc-x" size={16} /></button>
        </div>}
        <V7Menu menu={menu} onClose={closeMenu} />
        <V7Toast text={toast} />
    </div>;
}

type OpsKey = 'joining' | 'category' | 'serviceType' | 'airfare' | 'receipt';
function ListRow({ row, panelWidth, open, dimmed, selected, busy, onToggle, onCheck, onOpen, guideMenu, vehicleMenu, statusMenu, paymentMenu, opsMenu }: {
    row: V7Row; panelWidth: number; open: boolean; dimmed: boolean; selected: boolean; busy: boolean;
    onToggle: () => void; onCheck: () => void; onOpen: (action?: V7OpenAction) => void;
    guideMenu: (e: React.MouseEvent) => void; vehicleMenu: (e: React.MouseEvent) => void; statusMenu: (e: React.MouseEvent) => void;
    paymentMenu: (e: React.MouseEvent, field: 'deposit' | 'final') => void; opsMenu: (e: React.MouseEvent, key: OpsKey) => void;
}) {
    const r = row.source, cancel = row.tab === 'cancel', contractTab = row.tab === 'contract';
    const dd = v7Dday(row), period = v7Range(row), step = v7StepLabel(row), subs = v7StepSubs(row);
    const payT = cancel ? '취소' : !row.depositPaid ? '예약금 미입금' : row.balancePaid ? '완납' : `잔금 ${v7Won(r.balance)} 미수`;
    const payC = cancel ? '#adb5bd' : !row.depositPaid || (!row.balancePaid && !contractTab) ? '#FF4F4F' : row.balancePaid ? '#0E9E7A' : V7_MUTED;
    const stop = (fn: () => void) => (e: React.MouseEvent) => { e.stopPropagation(); fn(); };
    const kind = r.type === 'quote_booking' ? '맞춤 견적' : '상품 예약';
    const bookedKey = r.bookedAtMs ? dashboardSeoulDate(new Date(r.bookedAtMs).toISOString()) : '';
    const signedMonth = monthOf((r.contractData?.agreement as any)?.agreedAt);
    const left = (arr: boolean[]) => arr.filter(Boolean).length;
    const btn = (v: string, tone: PillTone | 'sel' | 'empty', go: (e: React.MouseEvent) => void, icon: DashboardIconName = 'lc-chevron-down') => ({ v, go, icon, s: tone === 'sel' ? sel(false) : tone === 'empty' ? sel(true) : pill(tone) });
    const receiptLate = row.ended && ['pending', 'info_missing'].includes(row.receipt);
    const cards: Array<{ icon: DashboardIconName; title: string; left: number; items: Array<{ label: string; sub?: string; btn?: ReturnType<typeof btn>; link?: () => void }> }> = [
        { icon: 'lc-wallet', title: '결제', left: left([!row.depositPaid, !row.balancePaid, receiptLate]), items: [
            { label: '총 매출', sub: v7Won(r.totalAmount) },
            { label: '예약금', sub: v7Won(r.deposit), btn: btn(row.depositPaid ? '입금 완료' : '미입금', row.depositPaid ? 'mint' : 'red', e => paymentMenu(e, 'deposit')) },
            { label: '잔금', sub: v7Won(r.balance), btn: btn(row.balancePaid ? '완납' : '미수', row.balancePaid ? 'mint' : 'red', e => paymentMenu(e, 'final')) },
            { label: '현금영수증', btn: btn(RECEIPT_LABELS[row.receipt as ReceiptStatus] || row.receipt, receiptLate ? 'red' : 'sel', e => opsMenu(e, 'receipt')) }] },
        { icon: 'lc-users', title: '배정', left: left([!row.guide, !row.vehicle, !row.accDone]), items: [
            { label: '가이드', btn: btn(row.guide?.name || '선택', row.guide ? 'sel' : 'empty', guideMenu) },
            { label: '차량', btn: btn(row.vehicle?.type || '선택', row.vehicle ? 'sel' : 'empty', vehicleMenu) },
            { label: '숙소', sub: row.accN ? `${row.accC}/${row.accN}박 확정` : '숙박 없음', btn: btn('박별 관리', 'sel', stop(() => onOpen('stay')), 'lc-chevron-right') }] },
        { icon: 'lc-tags', title: '분류', left: 0, items: [
            { label: '조인여부', btn: btn(JOINING_LABELS[row.joining as keyof typeof JOINING_LABELS] || '미정', 'sel', e => opsMenu(e, 'joining')) },
            { label: '분류', btn: btn(row.category || '미정', 'sel', e => opsMenu(e, 'category')) },
            { label: '구분', btn: btn(row.serviceType || '미정', 'sel', e => opsMenu(e, 'serviceType')) },
            { label: '항공', btn: btn(row.airfare || '미정', 'sel', e => opsMenu(e, 'airfare')) }] },
        { icon: 'lc-file-text', title: '서류', left: left([!row.signed]), items: [
            { label: r.type === 'quote_booking' ? '견적서' : '일정표', link: () => r.type === 'quote_booking' ? onOpen('documents') : window.open(`/documents/itinerary/${encodeURIComponent(r.id)}?preview=1`, '_blank', 'noopener') },
            { label: '계약서', btn: btn(row.signed ? '서명 완료' : '미작성', row.signed ? 'mint' : 'red', stop(() => onOpen('contract'))),
                link: () => r.type === 'quote_booking' ? onOpen('contract') : window.open(`/documents/contract/${encodeURIComponent(r.id)}`, '_blank', 'noopener') }] },
    ];
    const asg = cancel ? [] : [
        { key: 'guide', label: '가이드', icon: 'lc-user-round' as const, v: `가이드 ${row.guide ? '배정' : '미배정'}`, title: row.guide ? `가이드 · ${row.guide.name}` : '가이드 선택', go: guideMenu,
            s: dchip(row.guide ? '#12b28c' : contractTab ? '#FF4F4F' : '#adb5bd', !row.guide && contractTab) },
        { key: 'car', label: '차량', icon: 'lc-car' as const, v: `차량 ${row.vehicle ? '배정' : '미배정'}`, title: row.vehicle ? `차량 · ${row.vehicle.type}` : '차량 선택', go: vehicleMenu,
            s: dchip(row.vehicle ? '#12b28c' : contractTab ? '#FF4F4F' : '#adb5bd', !row.vehicle && contractTab) },
        { key: 'stay', label: '숙소', icon: 'lc-bed-double' as const, v: `숙소 ${row.accN ? `${row.accC}/${row.accN}박` : '없음'}`, title: '박별 숙소 · 현지 운영 수배 상태', go: stop(() => onOpen('stay')),
            s: dchip(row.accDone ? '#12b28c' : row.accN - row.accA ? '#FF4F4F' : '#f08c00', row.accN - row.accA > 0 && contractTab) },
    ];
    const wrap: Css = { borderBottom: '1px solid #f1f3f5', transition: 'filter 220ms ease, opacity 220ms ease', filter: dimmed ? 'grayscale(1)' : 'none', opacity: dimmed ? 0.45 : 1,
        boxShadow: open ? '0 8px 28px rgba(16,24,40,.10), 0 0 0 1px #d2f5e8' : 'none', position: 'relative', zIndex: open ? 1 : 0 };
    return <div role="rowgroup" className={dimmed ? 'v7-dim' : undefined} style={wrap} aria-busy={busy}>
        <div role="row" tabIndex={0} aria-expanded={open} className={`v7-list-row${open || selected ? '' : ' v7-hover-row'}`} onClick={onToggle} onKeyDown={e => { if (e.key === 'Enter' && e.target === e.currentTarget) onToggle(); }}
            style={{ display: 'grid', gridTemplateColumns: GRID, columnGap: 20, alignItems: 'center', minHeight: 64, padding: '10px 24px', boxSizing: 'border-box', cursor: 'pointer',
                background: open ? '#f7fcfa' : selected ? '#f0fcf7' : '#fff', boxShadow: open || selected ? 'inset 3px 0 0 #12b28c' : 'none', opacity: cancel ? .6 : 1 }}>
            <button type="button" aria-label={`${r.customerName} 선택`} aria-pressed={selected} onClick={stop(onCheck)} className="v7-c-check" style={checkBox(selected)}>{selected && <Ico name="lc-check" size={12} color="#fff" />}</button>
            <span className="v7-c-cust" style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><b style={{ fontSize: 14, fontWeight: 800, lineHeight: '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.customerName || '이름 미정'}</b><span style={{ fontSize: 12, lineHeight: '18px', color: V7_MUTED, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{r.phone || r.email || '연락처 미입력'}</span></span>
            <span className="v7-c-period" style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><b style={{ fontSize: 13, fontWeight: 700, lineHeight: '20px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{period.range}</b><span style={{ display: 'flex', alignItems: 'center', gap: 6, height: 18, fontSize: 12, color: V7_MUTED, whiteSpace: 'nowrap' }}>{period.sch}<span style={chip(dd.tone, dd.dot, { height: 20 })}>{dd.label}</span></span></span>
            <span className="v7-c-people" style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{r.totalPeople ? `${r.totalPeople}명` : r.headcount || '–'}</span>
            <span className="v7-c-region" style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><span style={{ fontSize: 13, fontWeight: 700, lineHeight: '20px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.region}>{row.region}</span><span style={{ fontSize: 12, lineHeight: '18px', color: V7_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.category || '분류 미정'} · {row.serviceType || kind}</span></span>
            <span className="v7-c-assign" style={{ display: 'flex', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
                {asg.map(a => <button key={a.key} type="button" onClick={a.go} title={a.title} style={a.s}><Ico name={a.icon} size={12} /><span style={{ whiteSpace: 'nowrap' }}>{a.v}</span></button>)}
            </span>
            <span className="v7-c-pay" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}><b style={{ fontSize: 14, fontWeight: 800, lineHeight: '20px', fontVariantNumeric: 'tabular-nums' }}>{v7Won(r.totalAmount)}</b><span style={{ fontSize: 12, lineHeight: '18px', fontWeight: 700, whiteSpace: 'nowrap', color: payC }}>{payT}</span></span>
            <span className="v7-c-status"><button type="button" onClick={statusMenu} style={pill(TAB_TONE[row.tab])}>{statusLabelOf(r)}<Ico name="lc-chevron-down" size={12} /></button></span>
            <span className="v7-c-chev" style={{ display: 'flex', color: open ? '#0E9E7A' : '#adb5bd', transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'none' }}><Ico name="lc-chevron-down" size={18} /></span>
        </div>
        {open && <div className="v7-list-panel" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 24px 22px 64px', background: '#f7fcfa', boxShadow: 'inset 3px 0 0 #12b28c',
            position: 'sticky', left: 0, boxSizing: 'border-box', ...(panelWidth ? { width: panelWidth } : {}) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: V7_MUTED, whiteSpace: 'nowrap' }}>예약일 {bookedKey ? dot(bookedKey) : '–'} · 계약 {signedMonth ? `${+signedMonth}월` : '서명 전'} · 투어 {monthOf(r.startDate) ? `${+monthOf(r.startDate)!}월` : '미정'}{r.reservationNumber ? ` · 예약번호 ${r.reservationNumber}` : ''}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <button type="button" onClick={stop(() => onOpen('edit-itinerary'))} style={ghostBtn()}><Ico name="lc-calendar-check" size={15} color="#0E9E7A" />일정표 편집</button>
                    <button type="button" onClick={stop(() => onOpen())} style={inkBtn()}>예약 상세 열기<Ico name="lc-chevron-right" size={15} /></button>
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 22px', background: '#fff', borderRadius: 16, boxShadow: '0 0 0 1px #eef0f2' }}>
                <V7StepHead label={step.label} tone={step.tone} count={cancel ? '' : `${row.steps.filter(s => s.done).length} / 5 단계 완료`} />
                <V7Steps steps={row.steps.map((s, i) => ({ ...s, sub: subs[i] }))} cancelled={cancel} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
                {cards.map(c => <div key={c.title} style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, boxShadow: '0 0 0 1px #eef0f2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 10px' }}>
                        <span style={{ width: 28, height: 28, borderRadius: 9, background: '#f1f3f5', color: '#495057', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name={c.icon} size={15} /></span>
                        <b style={{ fontSize: 14, fontWeight: 800 }}>{c.title}</b>
                        <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: c.left ? '#FF4F4F' : '#0E9E7A' }}>{c.left ? `${c.left}건 남음` : '완료'}</span>
                    </div>
                    {c.items.map(it => <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 16px', borderTop: '1px solid #f1f3f5' }}>
                        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}><span style={{ fontSize: 13, color: '#495057' }}>{it.label}</span>{it.sub && <span style={{ fontSize: 12, fontWeight: 700, color: V7_INK, fontVariantNumeric: 'tabular-nums' }}>{it.sub}</span>}</span>
                        {it.btn && <button type="button" onClick={it.btn.go} style={it.btn.s} disabled={busy}>{it.btn.v}<Ico name={it.btn.icon} size={12} /></button>}
                        {it.link && <button type="button" onClick={stop(it.link)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 700, color: '#495057', cursor: 'pointer' }}>열기<Ico name="lc-external-link" size={12} /></button>}
                    </div>)}
                </div>)}
            </div>
        </div>}
    </div>;
}
