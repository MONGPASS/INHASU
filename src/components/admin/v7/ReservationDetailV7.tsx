import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { DashboardIconName } from '../dashboard/DashboardIcon';
import type { CustomerWorkspaceOverviewModel } from '../CustomerWorkspaceOverview';
import { dashboardSeoulDate } from '../../../utils/adminDashboard';
import { guideAssignmentConflicts } from '../../../utils/assignmentAvailability';
import { scheduleTimeline } from '../../../utils/accommodationSchedule';
import { loadRegisteredAssignmentResources, type RegisteredAssignmentResources } from '../../../utils/registeredAssignmentResources';
import { selectResourceGuide, selectResourceLodge, selectResourceVehicle } from '../../../utils/accommodationResourceSelection';
import { AIRFARE_OPTIONS, CATEGORY_OPTIONS, JOINING_LABELS, RECEIPT_LABELS, SERVICE_TYPE_OPTIONS, type ReceiptStatus, type ReservationOperations } from '../../../utils/reservationWorkspace';
import {
    BOOKING_STATUS, BOOKING_STATUS_OPTIONS, OCCUPANCY_OPTIONS, V7_TABS, bookingStatusMeta, fetchV7Assignments, occupancyLabel, saveV7Assignment,
    v7Dday, v7Range, v7Row, v7StepLabel, v7StepSubs, v7Won, withGuide, withNight, withVehicle, type V7AssignmentItem, type V7Row, type V7Source,
} from '../../../utils/reservationV7';
import { PRODUCT_STATUS_OPTIONS, statusLabelOf } from './ReservationListV7';
import {
    Ico, V7Menu, V7Steps, V7StepHead, V7Styles, V7Toast, V7_INK, V7_MUTED, card, chip, ghostBtn, iconTile, inkBtn, menuAt, pill, sel,
    type PillTone, type V7MenuItem, type V7MenuState,
} from './v7Ui';

type Css = React.CSSProperties;
type Model = CustomerWorkspaceOverviewModel;
type HistoryKind = NonNullable<Model['recentHistory']>[number]['kind'];

/** 상세 화면이 직접 저장하는 연결. 없으면 해당 버튼은 기존 업무 화면(onAction)을 연다. */
export interface ReservationDetailV7Links {
    source: V7Source | null;
    userId: string;
    operations?: ReservationOperations | null;
    onOperations?: (patch: Partial<ReservationOperations>) => Promise<boolean>;
    onPayment?: (field: 'deposit' | 'final', paid: boolean) => Promise<boolean>;
    onStatus?: (status: string) => Promise<void>;
    onAssignmentSaved?: () => void;
}

/** 바로가기 6개(디자인 v7): 같은 화면 안의 해당 카드로 이동한다. 업무 화면은 각 카드의 버튼이 연다. */
const NAV: Array<{ label: string; icon: DashboardIconName; sid: string }> = [
    { label: '일정표 편집', icon: 'lc-calendar', sid: 'sec-plan' }, { label: '고객·항공편', icon: 'lc-user', sid: 'sec-info' },
    { label: '결제·영수증', icon: 'lc-banknote', sid: 'sec-pay' }, { label: '가이드·숙소', icon: 'lc-bed', sid: 'sec-asg' },
    { label: '운영·메모', icon: 'lc-clipboard-check', sid: 'sec-memo' }, { label: '메모·이력', icon: 'lc-history', sid: 'sec-log' },
];
const LOG_TAGS: Record<HistoryKind, { tag: string; tone: 'gray' | 'blue' | 'mint' | 'amber' }> = {
    inquiry: { tag: '접수', tone: 'gray' }, quote: { tag: '알림', tone: 'blue' }, booking: { tag: '접수', tone: 'gray' }, payment: { tag: '완료', tone: 'mint' },
    contract: { tag: '완료', tone: 'mint' }, customer: { tag: '고객', tone: 'gray' }, assignment: { tag: '숙소', tone: 'mint' }, document: { tag: '알림', tone: 'blue' },
    memo: { tag: '메모', tone: 'gray' }, change: { tag: '변경', tone: 'amber' },
};
/** 숙소 등급 선택지(디자인 v7). 저장 값은 배정 숙소의 type(등급) 칸이다. */
const LODGE_GRADES = ['고급 게르', '일반 게르', '5성급 호텔', '4성급 호텔', '3성급 호텔', '게스트하우스', '캠핑'];
const PRIVATE_LABEL = /연락처|전화|휴대|이메일|메일|여권|생년월일|생일/;
const mask = (value: string, keep: number) => value.length <= keep ? value : value.slice(0, keep) + '*'.repeat(value.length - keep);
const maskFact = (label: string, value: string, on: boolean) => !on || !value || !PRIVATE_LABEL.test(label) ? value
    : /이메일|메일/.test(label) ? mask(value, 4) : /여권/.test(label) ? mask(value, 3) : /생년월일|생일/.test(label) ? mask(value, 4) : mask(value, 8);
const dateKeys = (text: string) => (text.match(/\d{4}[-.]\d{2}[-.]\d{2}/g) || []).map(key => key.replaceAll('.', '-'));
const shortDate = (key: string) => { const d = new Date(`${key}T00:00:00Z`); return Number.isFinite(d.getTime()) ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')} (${'일월화수목금토'[d.getUTCDay()]})` : key; };
const historyTime = (at: string) => at.length === 10 ? at.replaceAll('-', '.') : Number.isFinite(Date.parse(at)) ? new Date(at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\. /g, '.').replace(/\.$/, '') : at;

function cardHead({ icon, title, right }: { icon: DashboardIconName; title: string; right?: ReactNode }) {
    return <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '16px 18px 12px' }}>
        <span style={iconTile(30)}><Ico name={icon} size={16} /></span><b style={{ fontSize: 15, fontWeight: 800 }}>{title}</b>{right}
    </div>;
}
function left(n: number) { return <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: n ? '#FF4F4F' : '#0E9E7A' }}>{n ? `${n}건 남음` : '완료'}</span>; }
function itemRow({ label, sub, children, key }: { label: string; sub?: ReactNode; children?: ReactNode; key?: string }) {
    return <div key={key || label} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '0 18px', borderTop: '1px solid #f1f3f5' }}>
        <span style={{ width: 96, flex: 'none', fontSize: 13, color: V7_MUTED }}>{label}</span>
        <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: V7_INK, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
        {children}
    </div>;
}
function disclosure({ icon, title, sub, badge, open, onToggle, children }: { icon: DashboardIconName; title: string; sub: string; badge?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
    return <React.Fragment key={title}>
        <div style={{ height: 1, background: '#f1f3f5' }} />
        <button type="button" aria-expanded={!!open} onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '14px 0', border: 0, background: 'transparent', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
            <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 12, background: '#f4f6f8', color: '#495057', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name={icon} size={17} /></span>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}><b style={{ fontSize: 14, fontWeight: 800, color: V7_INK }}>{title}</b><span style={{ fontSize: 12, color: V7_MUTED }}>{sub}</span></span>
            {badge && <span style={chip('mint', true)}>{badge}</span>}
            <span style={{ display: 'flex', color: '#adb5bd', transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'none' }}><Ico name="lc-chevron-down" size={16} /></span>
        </button>
        {open && children}
    </React.Fragment>;
}

export interface ReservationDetailV7Props {
    model: Model; onAction: (action: string, id?: string) => void; busy?: boolean;
    noteComposer?: ReactNode; bookingSelector?: ReactNode; assignmentEditor?: ReactNode; notificationActions?: ReactNode; links?: ReservationDetailV7Links;
}
/** 화면 상태. 테스트는 같은 상태 객체로 그리기 결과와 버튼 연결을 확인한다. */
export interface DetailState {
    item?: V7AssignmentItem; allItems: V7AssignmentItem[]; resources: RegisteredAssignmentResources | null; menu: V7MenuState | null; toast: string; saving: boolean;
    maskOn: boolean; sections: Record<string, boolean>; travelerOpen: number; dayOpen: Record<string, boolean>;
}
export const initialDetailState = (): DetailState => ({ allItems: [], resources: null, menu: null, toast: '', saving: false, maskOn: true,
    sections: {}, travelerOpen: 0, dayOpen: {} });
export type DetailSet = (patch: Partial<DetailState> | ((s: DetailState) => Partial<DetailState>)) => void;
export interface DetailEnv { mounted: { current: boolean }; toastTimer: { current: number | undefined }; root: { current: HTMLElement | null } }

export function ReservationDetailV7(props: ReservationDetailV7Props) {
    const [st, setRaw] = useState(initialDetailState);
    const set = useCallback<DetailSet>(patch => setRaw(s => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), []);
    const rootRef = useRef<HTMLElement>(null);
    const env = useRef<DetailEnv>({ mounted: { current: true }, toastTimer: { current: undefined }, root: rootRef }).current;
    useEffect(() => { env.mounted.current = true; return () => { env.mounted.current = false; window.clearTimeout(env.toastTimer.current); }; }, [env]);
    const view = reservationDetailView(props, st, set, env);
    const { assignmentKey, loadItem } = view;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 예약이 바뀔 때만 배정 원본을 다시 읽는다
    useEffect(() => { void loadItem(); }, [assignmentKey]);
    return view.element;
}

/** 상세 화면의 그리기와 버튼 동작. React 상태는 st/set으로만 다룬다. */
export function reservationDetailView({ model: m, onAction, busy = false, noteComposer, bookingSelector, assignmentEditor, notificationActions, links }: ReservationDetailV7Props,
    st: DetailState, set: DetailSet, env: DetailEnv) {
    const today = dashboardSeoulDate(new Date().toISOString());
    const rootRef = env.root, mounted = env.mounted, toastTimer = env.toastTimer;
    const { item, resources, allItems, menu, toast, saving, maskOn, sections, travelerOpen, dayOpen } = st;
    const setItem = (value: V7AssignmentItem | undefined) => set({ item: value });
    const setAllItems = (value: V7AssignmentItem[] | ((prev: V7AssignmentItem[]) => V7AssignmentItem[])) => set(s => ({ allItems: typeof value === 'function' ? value(s.allItems) : value }));
    const setResources = (value: RegisteredAssignmentResources) => set({ resources: value });
    const setMenu = (value: V7MenuState | null) => set({ menu: value });
    const setToast = (value: string) => set({ toast: value });
    const setSaving = (value: boolean) => set({ saving: value });
    const setMaskOn = (value: boolean) => set({ maskOn: value });
    const setSections = (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => set(s => ({ sections: fn(s.sections) }));
    const setTravelerOpen = (value: number) => set({ travelerOpen: value });
    const setDayOpen = (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => set(s => ({ dayOpen: fn(s.dayOpen) }));
    const flash = (text: string) => { window.clearTimeout(toastTimer.current); setToast(text); toastTimer.current = window.setTimeout(() => mounted.current && setToast(''), 2600); };
    const source = links?.source || null;
    const assignmentKey = source && source.type !== 'quote' ? `${source.type === 'quote_booking' ? 'quote_booking' : 'product'}:${source.id}` : '';
    const loadItem = async () => {
        if (!assignmentKey) return;
        try {
            const data = await fetchV7Assignments();
            if (!mounted.current) return;
            set({ allItems: data.items, item: data.items.find(x => x.key === assignmentKey) });
        } catch { /* 배정 원본을 못 읽으면 저장된 예약 값으로 표시하고 버튼은 기존 화면을 연다. */ }
    };
    const ensureResources = async () => {
        if (resources) return resources;
        if (!links?.userId) return null;
        try { const loaded = await loadRegisteredAssignmentResources({ accountId: links.userId }); if (mounted.current) setResources(loaded); if (loaded.warnings[0]) flash(loaded.warnings[0]); return loaded; }
        catch { flash('등록된 가이드·숙소·차량 자료를 불러오지 못했습니다.'); return null; }
    };

    const row: V7Row | null = source && source.type !== 'quote' ? v7Row(source, item, today) : null;
    const [startKey, endKey] = dateKeys(m.period || '');
    const cancelled = row ? row.tab === 'cancel' : m.currentStage?.tone === 'cancelled';
    const name = m.customerName || '고객 정보 확인 필요';
    const action = (a: string, id?: string) => () => onAction(a, id);
    // 화면 안 이동. 관리자 레이아웃마다 스크롤 영역이 달라 요소 기준으로 이동한다(카드의 scrollMarginTop이 고정 바로가기 높이를 비운다).
    const goSec = (sid: string) => {
        const el = rootRef.current?.querySelector<HTMLElement>(`#${sid}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // 고정 열의 카드처럼 이미 보이는 대상은 움직이지 않으므로 잠깐 강조해 어디로 왔는지 보여 준다.
        el.classList.remove('v7-sec-flash'); void el.offsetWidth; el.classList.add('v7-sec-flash');
        window.setTimeout(() => el.classList.remove('v7-sec-flash'), 1400);
    };
    const openMenu = (e: React.MouseEvent, title: string, items: V7MenuItem[], wide = false) => { e.stopPropagation(); setMenu(menuAt(e.currentTarget as HTMLElement, title, items, wide)); };
    const closeMenu = () => setMenu(null);
    const phoneFact = m.facts.find(f => /연락처|전화/.test(f.label))?.value || '';
    const emailFact = m.facts.find(f => /이메일/.test(f.label))?.value || '';

    const save = async (build: (it: V7AssignmentItem) => Parameters<typeof saveV7Assignment>[1], done: string) => {
        if (!item) { flash('배정 정보를 아직 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'); void loadItem(); return false; }
        if (saving) return false;
        setSaving(true);
        try {
            const saved = await saveV7Assignment(item, build(item));
            if (!mounted.current) return false;
            setItem(saved); setAllItems(prev => prev.map(x => x.key === saved.key ? saved : x));
            flash(done); links?.onAssignmentSaved?.();
            return true;
        } catch (e: any) { if (mounted.current) { flash(e?.message || '배정을 저장하지 못했습니다.'); void loadItem(); } return false; }
        finally { if (mounted.current) setSaving(false); }
    };
    const peopleMenu = async (e: React.MouseEvent, kind: 'guide' | 'vehicle') => {
        e.stopPropagation();
        if (!row || !item) { onAction(kind); return; }
        const target = e.currentTarget as HTMLElement, loaded = await ensureResources();
        const items: V7MenuItem[] = kind === 'guide' ? [
            { key: 'none', label: '배정 해제', muted: true, on: !row.guide, onPick: () => { if (row.guide) void save(it => withGuide(it, { id: '', name: '', phone: '' }), '가이드 배정을 해제했어요'); } },
            ...(loaded?.guides || []).map(g => {
                const busyWith = guideAssignmentConflicts(allItems, g, { id: item.id, source: item.source, startDate: item.startDate, endDate: item.endDate })[0];
                return { key: g.id, label: g.name, on: row.guide?.name === g.name, sub: busyWith ? `일정 겹침 · ${(busyWith as any).customerName || '다른 예약'} ${String(busyWith.startDate || '').slice(5).replace('-', '.')}~` : '이 일정에 배정 가능', subTone: busyWith ? 'warn' as const : 'ok' as const,
                    onPick: () => { if (busyWith && !window.confirm(`${g.name} 가이드는 같은 기간에 다른 예약이 있습니다. 그래도 배정할까요?`)) return; void save(it => withGuide(it, selectResourceGuide(it.assignment.guide, g)), `${g.name} 가이드를 배정했어요`); } };
            }),
        ] : [
            { key: 'none', label: '배정 해제', muted: true, on: !row.vehicle, onPick: () => { if (row.vehicle) void save(it => withVehicle(it, { type: '', phone: '' }), '차량 배정을 해제했어요'); } },
            ...(loaded?.vehicles || []).map(v => ({ key: v.name, label: v.name, on: row.vehicle?.type === v.type, sub: [v.snapshot.seats && `${v.snapshot.seats}인승`, v.snapshot.plate].filter(Boolean).join(' · ') || undefined, subTone: 'muted' as const,
                onPick: () => void save(it => withVehicle(it, selectResourceVehicle(it.assignment.vehicle, v)), `${v.name} 차량을 배정했어요`) })),
        ];
        setMenu(menuAt(target, kind === 'guide' ? '가이드 선택' : '차량 선택', items, true));
    };
    const nightMenu = async (e: React.MouseEvent, day: number, field: 'hotel' | 'occ' | 'status' | 'grade') => {
        e.stopPropagation();
        if (!row || !item) { onAction('stay'); return; }
        const night = row.stays.find(s => s.day === day);
        if (!night) return;
        if (field === 'status' && !night.hotel) { flash('숙소를 먼저 골라 주세요'); return; }
        const target = e.currentTarget as HTMLElement;
        if (field === 'occ') { setMenu(menuAt(target, `${day}박 객실 인원`, OCCUPANCY_OPTIONS.map(o => ({ key: o, label: occupancyLabel(o), on: night.occupancy === o,
            onPick: () => void save(it => withNight(it, day, r => ({ ...r, accommodation: { ...r.accommodation, occupancy: o } })), `${day}박 객실을 ${occupancyLabel(o)}(으)로 바꿨어요`) })))); return; }
        if (field === 'grade') { setMenu(menuAt(target, `${day}박 숙소 등급`, [...(night.grade && !LODGE_GRADES.includes(night.grade) ? [night.grade] : []), ...LODGE_GRADES].map(g => ({ key: g, label: g, on: night.grade === g,
            onPick: () => void save(it => withNight(it, day, r => ({ ...r, accommodation: { ...r.accommodation, type: g } })), `${day}박 숙소 등급을 ${g}(으)로 바꿨어요`) })))); return; }
        if (field === 'status') { setMenu(menuAt(target, `${day}박 수배 상태`, BOOKING_STATUS_OPTIONS.map(o => ({ key: o.value, label: o.label, on: night.bookingStatus === o.value,
            onPick: () => void save(it => withNight(it, day, r => ({ ...r, accommodation: { ...r.accommodation, bookingStatus: o.value } })), `${day}박 ${o.label}(으)로 변경했어요`) })))); return; }
        const loaded = await ensureResources(), place = night.region.replace(/\s+/g, '');
        const lodges = [...(loaded?.lodges || [])].sort((a, b) => Number(!!place && (b.region || b.location).replace(/\s+/g, '').includes(place)) - Number(!!place && (a.region || a.location).replace(/\s+/g, '').includes(place)));
        setMenu(menuAt(target, `${day}박 숙소 선택`, [
            { key: 'none', label: '숙소 비우기', muted: true, on: !night.hotel, onPick: () => { if (night.hotel) void save(it => withNight(it, day, r => ({ day: r.day, ...(r.date ? { date: r.date } : {}), accommodation: night.region ? { location: night.region, region: night.region } : {} })), `${day}박 숙소를 비웠어요`); } },
            ...lodges.map(l => ({ key: l.id, label: l.name, on: night.hotel === l.name, sub: [l.type, l.region || l.location].filter(Boolean).join(' · ') + ' · 고르면 미발송부터 시작', subTone: 'muted' as const,
                onPick: () => void save(it => withNight(it, day, r => selectResourceLodge(r, l)), `${day}박 ${l.name} 선택`) })),
        ], true));
    };
    const pendingNights = row ? row.stays.filter(s => s.hotel && s.bookingStatus === BOOKING_STATUS.unsent) : [];
    const requestLodging = () => {
        if (!row || !item) { onAction('stay'); return; }
        if (!pendingNights.length) { flash('새로 보낼 수배 요청이 없어요'); return; }
        if (!window.confirm(`숙소 ${pendingNights.length}박을 '메일 발송'(현지 운영 수배 요청) 상태로 바꿀까요?\n이 버튼은 상태만 기록하며 숙소에 직접 메일을 보내지 않습니다.`)) return;
        const days = new Set(pendingNights.map(s => s.day));
        void save(it => {
            const base = withNight(it, -1, r => r);
            return { ...base, accommodations: base.accommodations.map(r => days.has(Number(r.day)) ? { ...r, accommodation: { ...r.accommodation, bookingStatus: BOOKING_STATUS.mailed } } : r) };
        }, `${pendingNights.length}박 수배 요청을 현지 운영에 보냈어요`);
    };
    const paymentMenu = (e: React.MouseEvent, field: 'deposit' | 'final') => {
        if (!links?.onPayment || !row) { e.stopPropagation(); onAction('payments'); return; }
        const paid = field === 'deposit' ? row.depositPaid : row.balancePaid, labels = field === 'deposit' ? ['입금 완료', '미입금'] : ['완납', '미수'];
        openMenu(e, field === 'deposit' ? '예약금' : '잔금', labels.map((label, i) => ({ key: label, label, on: paid === (i === 0), onPick: async () => {
            if (paid === (i === 0)) return;
            if (field === 'deposit' && i === 0 && !window.confirm(`예약금 ${v7Won(row.source.deposit)} 입금을 확인할까요?${row.source.status === 'pending_payment' ? '\n예약이 확정되고 고객에게 입금 확인 메일이 발송됩니다.' : ''}`)) return;
            if (await links.onPayment!(field, i === 0)) flash(`${field === 'deposit' ? '예약금' : '잔금'} ${label}(으)로 변경했어요`);
        } })));
    };
    const ops = links?.operations || null;
    const opsMenu = (e: React.MouseEvent, key: 'joining' | 'category' | 'serviceType' | 'airfare' | 'receipt') => {
        if (!links?.onOperations || !ops) { e.stopPropagation(); onAction(key === 'receipt' ? 'payments' : 'operations'); return; }
        const saveOps = (patch: Partial<ReservationOperations>, label: string) => void links.onOperations!(patch).then(ok => ok && flash(`${label}(으)로 변경했어요`));
        let items: V7MenuItem[];
        if (key === 'joining') items = (['join', 'private', 'undecided'] as const).map(v => ({ key: v, label: JOINING_LABELS[v], on: ops.joining === v, onPick: () => saveOps({ joining: v }, JOINING_LABELS[v]) }));
        else if (key === 'receipt') items = (Object.keys(RECEIPT_LABELS) as ReceiptStatus[]).map(v => ({ key: v, label: RECEIPT_LABELS[v], on: ops.receipt.status === v, onPick: () => saveOps({ receipt: { status: v } as any }, RECEIPT_LABELS[v]) }));
        else {
            const base = key === 'category' ? CATEGORY_OPTIONS : key === 'serviceType' ? SERVICE_TYPE_OPTIONS : AIRFARE_OPTIONS, current = (ops[key] || '') as string;
            items = [...(current && !base.includes(current) ? [current] : []), ...base].map(v => ({ key: v, label: v, on: current === v, onPick: () => saveOps({ [key]: v }, v) }));
            items.push({ key: '__none', label: '미정으로 비우기', muted: true, on: !current, onPick: () => saveOps({ [key]: '' }, '미정') });
        }
        openMenu(e, { joining: '조인여부', category: '분류', serviceType: '구분', airfare: '항공', receipt: '현금영수증' }[key], items);
    };
    const statusMenu = (e: React.MouseEvent) => {
        if (!links?.onStatus || !source || source.type !== 'product') { e.stopPropagation(); onAction('payments'); return; }
        openMenu(e, '진행상황 변경', PRODUCT_STATUS_OPTIONS.map(o => ({ key: o.value, label: o.label, on: source.status === o.value, onPick: () => {
            if (o.value === source.status) return;
            if (o.value === 'cancelled' && !window.confirm('이 예약을 취소 상태로 바꿀까요? 고객에게 취소 알림이 갑니다.')) return;
            void links.onStatus!(o.value).then(() => flash(`${o.label}(으)로 변경했어요`));
        } })));
    };
    const openNotices = (event: React.MouseEvent) => {
        const panel = notificationActions && m.documentAction !== 'documents' ? (event.currentTarget as HTMLElement).closest('.v7-root')?.querySelector<HTMLDetailsElement>('details.cw-kakao') : null;
        if (!panel) { onAction('documents'); return; }
        panel.open = true; panel.scrollIntoView({ behavior: 'smooth', block: 'start' }); panel.querySelector('summary')?.focus({ preventScroll: true });
    };
    const copyInfo = async () => {
        const text = [name, phoneFact, emailFact, m.placeLabel || row?.region || '', m.period, m.partyLabel].filter(Boolean).join('\n');
        try { await navigator.clipboard.writeText(text); flash('고객 정보를 복사했어요'); } catch { flash('복사하지 못했어요. 브라우저 권한을 확인해 주세요.'); }
    };

    // 진행 단계: v7 계산(예약 원본이 있을 때) 또는 고객 화면 모델의 단계
    const steps = row ? row.steps.map((s, i) => ({ ...s, sub: v7StepSubs(row)[i] })) : m.steps.map(s => ({ label: s.label, done: s.done, sub: s.done ? '완료' : s.current ? '진행 중' : '대기' }));
    const stepHead = row ? v7StepLabel(row) : cancelled ? { label: '취소된 예약', tone: 'gray' as const } : steps.every(s => s.done) ? { label: '모든 단계 완료', tone: 'mint' as const } : { label: m.steps.find(s => s.current)?.label || steps.find(s => !s.done)?.label || '', tone: 'red' as const };
    // 진행 단계 클릭은 디자인대로 해당 카드로 이동한다(서류·결제·배정·결제·일정). 원본이 없는 모델 단계는 해당 업무를 연다.
    const stepTargets = row ? ['sec-doc', 'sec-pay', 'sec-asg', 'sec-pay', 'sec-plan'] : [];
    const dd = row ? v7Dday(row) : null;
    const period = row ? v7Range(row) : null;
    const tabName = row ? V7_TABS.find(t => t.key === row.tab)?.label : m.statusLabel;
    const statusTone: PillTone = row ? ({ contract: 'gray', ongoing: 'solid', ended: 'mint', cancel: 'gray' } as const)[row.tab] : 'gray';
    const pay = m.payment, depositPaid = row ? row.depositPaid : pay.depositPaid === true, balancePaid = row ? row.balancePaid : pay.balancePaid === true;
    const receipt = (ops?.receipt.status || 'not_requested') as ReceiptStatus;
    const receiptLate = !!row?.ended && ['pending', 'info_missing'].includes(receipt);
    const travelers = m.travelers;
    const missingTravelers = travelers && travelers.expected !== null && travelers.expected > travelers.registered ? travelers.expected - travelers.registered : 0;
    const confirmedFlights = m.flights?.filter(f => f.date && f.time && f.flight).length || 0;
    const docAlerts = m.documents.filter(d => /실패|필요|미작성|미발송|전/.test(d.status || '')).length;
    const logs = [...(m.recentHistory || [])];

    const btnSel = (value: string, empty: boolean, go: (e: React.MouseEvent) => void, icon: DashboardIconName = 'lc-chevron-down', x?: Css) =>
        <button type="button" disabled={busy || saving} onClick={go} style={sel(empty, x)}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span><Ico name={icon} size={12} /></button>;
    const btnPill = (value: string, tone: PillTone, go: (e: React.MouseEvent) => void) => <button type="button" disabled={busy || saving} onClick={go} style={pill(tone)}>{value}<Ico name="lc-chevron-down" size={12} /></button>;
    const openLink = (label: string, go: () => void, disabled = false) => <button type="button" aria-label={`${label} 열기`} disabled={busy || disabled} onClick={go}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 700, color: '#495057', cursor: 'pointer' }}>열기<Ico name="lc-external-link" size={12} /></button>;
    const guideValue = row?.guide?.name || (m.assignments.find(a => a.id === 'guide')?.state === 'ready' ? m.assignments.find(a => a.id === 'guide')!.value : '');
    const vehicleValue = row?.vehicle?.type || (m.assignments.find(a => a.id === 'vehicle')?.state === 'ready' ? m.assignments.find(a => a.id === 'vehicle')!.value : '');
    const stayReady = row ? row.accDone : m.assignments.find(a => a.id === 'stay')?.state === 'ready';
    // 디자인 v7: 바로가기 아래 결제·배정·분류·서류 네 칸 요약
    type QuadItem = { label: string; sub?: ReactNode; control?: ReactNode };
    const quad: Array<{ sid: string; icon: DashboardIconName; title: string; left: number | null; badge?: string; items: QuadItem[] }> = [
        { sid: 'sec-pay', icon: 'lc-wallet', title: '결제', left: [!depositPaid, !balancePaid, receiptLate].filter(Boolean).length, items: [
            { label: '총 매출', sub: v7Won(pay.total) },
            { label: '예약금', sub: v7Won(pay.deposit), control: btnPill(depositPaid ? '입금 완료' : '미입금', depositPaid ? 'mint' : 'red', e => paymentMenu(e, 'deposit')) },
            { label: '잔금', sub: v7Won(pay.balance), control: btnPill(balancePaid ? '완납' : '미수', balancePaid ? 'mint' : 'red', e => paymentMenu(e, 'final')) },
            { label: '현금영수증', control: ops ? (receiptLate ? btnPill(RECEIPT_LABELS[receipt], 'red', e => opsMenu(e, 'receipt')) : btnSel(RECEIPT_LABELS[receipt], false, e => opsMenu(e, 'receipt'))) : btnSel('결제 화면', false, action('payments'), 'lc-chevron-right') }] },
        { sid: 'sec-asg-s', icon: 'lc-users', title: '배정', left: [!guideValue, !vehicleValue, !stayReady].filter(Boolean).length, items: [
            { label: '가이드', control: btnSel(guideValue || '선택', !guideValue, e => void peopleMenu(e, 'guide')) },
            { label: '차량', control: btnSel(vehicleValue || '선택', !vehicleValue, e => void peopleMenu(e, 'vehicle')) },
            { label: '숙소', sub: row ? row.accN ? `${row.accC}/${row.accN}박 확정` : '숙박 없음' : m.assignments.find(a => a.id === 'stay')?.value, control: btnSel('박별 관리', false, () => goSec('sec-asg'), 'lc-chevron-right') }] },
        { sid: 'sec-cls', icon: 'lc-tags', title: '분류', left: null, badge: ops ? '완료' : '견적 편집기에서 관리', items: ([['조인여부', 'joining'], ['분류', 'category'], ['구분', 'serviceType'], ['항공', 'airfare']] as const).map(([label, key]) => {
            const value = ops ? key === 'joining' ? JOINING_LABELS[ops.joining] : (ops[key] || '') as string : key === 'category' ? row?.category || '' : '';
            return { label, control: btnSel(value || '미정', false, e => opsMenu(e, key)) };
        }) },
        { sid: 'sec-doc', icon: 'lc-file-text', title: '서류', left: docAlerts, items: [
            ...m.documents.map(doc => ({ label: doc.label, sub: <span style={{ color: /실패|필요|미작성|미발송|전/.test(doc.status || '') ? '#FF4F4F' : doc.status ? '#0E9E7A' : V7_INK }}>{doc.status || doc.detail || '내용 확인'}</span>,
                control: openLink(doc.label, action(doc.action || doc.id, doc.id), doc.disabled) })),
            ...(m.agreement ? [{ label: '계약 동의', sub: [m.agreement.label, m.agreement.name && `서명자 ${m.agreement.name}`].filter(Boolean).join(' · ') }] : []),
            { label: '공개·전달', control: btnSel('관리', false, action('documents'), 'lc-chevron-right') }] },
    ];
    const compactCard = (c: typeof quad[number]) => <div key={c.sid} id={c.sid} style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 16, boxShadow: '0 0 0 1px #eef0f2', scrollMarginTop: 88 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 10px' }}>
            <span style={iconTile(28)}><Ico name={c.icon} size={15} /></span><b style={{ fontSize: 14, fontWeight: 800 }}>{c.title}</b>
            <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: c.left ? '#FF4F4F' : '#0E9E7A' }}>{c.left === null ? c.badge : c.left ? `${c.left}건 남음` : '완료'}</span>
        </div>
        {c.items.map((it, i) => <div key={`${it.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, padding: '0 16px', borderTop: '1px solid #f1f3f5' }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}><span style={{ fontSize: 13, color: '#495057' }}>{it.label}</span>{it.sub && <span style={{ fontSize: 12, fontWeight: 700, color: V7_INK, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.sub}</span>}</span>
            {it.control}
        </div>)}
    </div>;

    const element = <section ref={rootRef as React.RefObject<HTMLElement>} className="v7-root cw-overview" aria-label="예약 상세" aria-busy={busy || saving} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <V7Styles />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" disabled={busy} onClick={action('back')} style={{ ...ghostBtn(), padding: '0 14px 0 10px', gap: 4 }}><Ico name="lc-chevron-left" size={16} />{m.backLabel || '통합 예약 목록'}</button>
            <span style={{ fontSize: 13, color: V7_MUTED }}>예약 관리 · {m.backLabel || '통합 예약 목록'}{tabName ? ` · ${tabName}` : ''}{m.bookingNumber ? ` · 예약번호 ${m.bookingNumber}` : ''} · {m.sourceLabel}</span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px 24px', padding: '24px 28px', background: '#fff', borderRadius: 20, boxShadow: '0 0 0 1px #eef0f2' }}>
            <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>{name}</h1>
                    <button type="button" disabled={busy} onClick={statusMenu} style={pill(statusTone)}>{source ? statusLabelOf(source) : m.statusLabel}<Ico name="lc-chevron-down" size={12} /></button>
                    {dd && <span style={chip(dd.tone, dd.dot, { height: 24, fontSize: 12 })}>{dd.label}</span>}
                    {m.packageInfo && <span style={chip(m.packageInfo.tier === 'full' ? 'mint' : m.packageInfo.tier === 'value' ? 'blue' : 'gray', !!m.packageInfo.tier, { height: 24, fontSize: 12 })} title={m.packageInfo.detail}>{m.packageInfo.tier === 'full' ? '풀패키지' : m.packageInfo.tier === 'value' ? '실속형' : '패키지 미지정'}</span>}
                </div>
                <div style={{ display: 'flex', gap: '6px 18px', flexWrap: 'wrap', fontSize: 13, fontWeight: 600, color: '#495057' }}>
                    {phoneFact && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}><Ico name="lc-phone" size={14} color={V7_MUTED} />{maskFact('연락처', phoneFact, maskOn)}</span>}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontVariantNumeric: 'tabular-nums' }}><Ico name="lc-calendar" size={14} color={V7_MUTED} />{period ? `${period.range}${period.sch ? ` · ${period.sch}` : ''}` : m.period || '일정 미정'}</span>
                    {m.partyLabel && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ico name="lc-users" size={14} color={V7_MUTED} />{m.partyLabel}</span>}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ico name="lc-map-pin" size={14} color={V7_MUTED} />{m.placeLabel || row?.region || m.bookedProduct?.name || '지역 미정'}</span>
                    {m.bookedProduct?.href && <a className="v7-link" href={m.bookedProduct.href} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700 }}>{m.bookedProduct.name}<Ico name="lc-external-link" size={12} /></a>}
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy} onClick={openNotices} style={ghostBtn(40)}><Ico name="lc-send" size={15} color="#0E9E7A" />{m.documentAction === 'documents' ? m.documentLabel || '견적서 확인·전달' : '알림 보내기'}</button>
                <button type="button" disabled={busy} onClick={action('edit-itinerary')} style={{ ...inkBtn(40), padding: '0 18px' }}><Ico name="lc-calendar-check" size={15} />일정표 편집</button>
            </div>
        </div>
        {bookingSelector && <div className="cw-booking-switcher">{bookingSelector}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '20px 24px', background: '#fff', borderRadius: 20, boxShadow: '0 0 0 1px #eef0f2' }}>
            <V7StepHead big label={stepHead.label} tone={stepHead.tone} count={cancelled ? '' : `${steps.filter(s => s.done).length} / ${steps.length} 단계 완료`} />
            <V7Steps large steps={steps} cancelled={!!cancelled} onStep={i => stepTargets[i] ? goSec(stepTargets[i]) : onAction(m.steps[i]?.id || 'payments')} />
        </div>

        <nav aria-label="예약 상세 바로가기" style={{ position: 'sticky', top: 0, zIndex: 5, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(max(calc((100% - 50px) / 6), min(calc((100% - 20px) / 3), calc((1100px - 100%) * 999))),1fr))', gap: 10, padding: '8px 0', background: 'var(--surface-canvas, #f6f7f9)' }}>
            {NAV.map(n => <button key={n.sid} type="button" className="v7-nav-btn" aria-label={`${n.label} 위치로 이동`} onClick={() => goSec(n.sid)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, height: 58, padding: '0 16px 0 14px', border: 0, borderRadius: 16, background: '#fff', boxShadow: '0 0 0 1px #eef0f2,0 1px 3px rgba(16,24,40,.04)', font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                <span style={iconTile(34)}><Ico name={n.icon} size={17} /></span>
                <b style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 800, color: V7_INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</b>
                <Ico name="lc-chevron-right" size={16} color="#adb5bd" />
            </button>)}
        </nav>
        {notificationActions}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(max(calc((100% - 36px) / 4), min(calc((100% - 12px) / 2), calc((1100px - 100%) * 999))),1fr))', gap: 12 }}>
            {quad.map(compactCard)}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div id="sec-asg" style={{ ...card, overflow: 'hidden' }}>
                    {cardHead({ icon: 'lc-users', title: '숙소 · 가이드 · 차량', right: <>
                        {row && <span style={{ ...pill(row.board === '배정 완료' ? 'solid' : row.board === '진행 중' ? 'amber' : 'red'), cursor: 'default' }}>{row.board}</span>}
                        <a className="v7-link" href="/admin/accommodation-ops" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: '#495057', whiteSpace: 'nowrap' }}>숙소 배정 · 현지 운영<Ico name="lc-chevron-right" size={14} /></a>
                    </> })}
                    {(['guide', 'vehicle'] as const).map(kind => {
                        const v = kind === 'guide' ? row?.guide : row?.vehicle, fallback = m.assignments.find(a => a.id === kind), label = kind === 'guide' ? '가이드' : '차량';
                        const value = kind === 'guide' ? guideValue : vehicleValue;
                        const tel = v?.phone ? maskFact('연락처', v.phone, maskOn) : value ? fallback?.detail || '연락처 미등록' : '배정 전';
                        const photo = kind === 'guide' ? item?.assignment.guide?.image : item?.assignment.vehicle?.resource?.img || item?.assignment.vehicle?.resource?.images?.[0];
                        const icon = kind === 'guide' ? 'lc-user-round' : 'lc-car';
                        return <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 76, padding: '10px 18px', boxSizing: 'border-box', borderTop: '1px solid #f1f3f5' }}>
                            <span style={{ width: 72, flex: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: V7_MUTED }}><Ico name={icon} size={14} />{label}</span>
                            {value && photo ? <img src={photo} alt={`${label} ${value} 사진`} loading="lazy" style={{ width: 56, height: 56, flex: 'none', borderRadius: 999, objectFit: 'cover', background: '#f8f9fa' }} />
                                : <span aria-hidden="true" style={{ width: 56, height: 56, flex: 'none', borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fa', boxShadow: 'inset 0 0 0 1.5px #e9ecef', color: '#ced4da' }}>{value ? <span style={{ fontSize: 11, fontWeight: 700, color: '#adb5bd' }}>사진</span> : <Ico name={icon} size={20} color="#ced4da" />}</span>}
                            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <b style={{ fontSize: 14, fontWeight: 800, color: V7_INK, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || `${label} 미배정`}</b>
                                <span style={{ fontSize: 12, fontWeight: 600, color: value ? '#495057' : '#adb5bd', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tel}</span>
                            </span>
                            {btnSel(value || `${label} 선택`, !value, e => void peopleMenu(e, kind))}
                        </div>;
                    })}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '16px 18px 10px', borderTop: '1px solid #f1f3f5' }}>
                        <b style={{ fontSize: 14, fontWeight: 800 }}>일자별 숙소</b>
                        <button type="button" disabled={busy || saving} onClick={requestLodging} style={{ ...inkBtn(34), marginLeft: 'auto', padding: '0 14px' }}>
                            <Ico name="lc-send" size={14} />현지 운영에 수배 요청
                            {pendingNights.length > 0 && <span style={{ display: 'inline-flex', minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 999, alignItems: 'center', justifyContent: 'center', background: '#0E9E7A', color: '#fff', fontSize: 11, fontWeight: 800 }}>{pendingNights.length}</span>}
                        </button>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '44px 108px minmax(0,1fr) 128px 104px 112px', columnGap: 10, alignItems: 'center', height: 34, padding: '0 18px', background: '#f8f9fa', fontSize: 11.5, fontWeight: 700, color: V7_MUTED }}><span>박</span><span>날짜 · 지역</span><span>숙소</span><span>등급</span><span>객실</span><span>수배 상태</span></div>
                    {(row?.stays || []).map(nt => {
                        const st = bookingStatusMeta(nt.bookingStatus);
                        return <div key={nt.day} style={{ display: 'grid', gridTemplateColumns: '44px 108px minmax(0,1fr) 128px 104px 112px', columnGap: 10, alignItems: 'center', minHeight: 62, padding: '8px 18px', boxSizing: 'border-box', borderTop: '1px solid #f1f3f5' }}>
                            <b style={{ fontSize: 13, fontWeight: 800, color: V7_INK }}>{nt.day}박</b>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}><b style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{nt.date ? shortDate(nt.date) : '날짜 확인'}</b><span style={{ fontSize: 12, color: V7_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nt.region || '지역 미정'}</span></span>
                            <span style={{ display: 'flex', minWidth: 0 }}>{btnSel(nt.hotel || '숙소 선택', !nt.hotel, e => void nightMenu(e, nt.day, 'hotel'), 'lc-chevron-down', { maxWidth: '100%', minWidth: 0, overflow: 'hidden' })}</span>
                            <span>{btnSel(nt.grade || '등급 선택', !nt.grade && !nt.hotel, e => void nightMenu(e, nt.day, 'grade'), 'lc-chevron-down', { maxWidth: '100%' })}</span>
                            <span>{btnSel(occupancyLabel(nt.occupancy), false, e => void nightMenu(e, nt.day, 'occ'))}</span>
                            <span>{nt.hotel ? btnPill(st.label, st.tone, e => void nightMenu(e, nt.day, 'status')) : <button type="button" onClick={e => void nightMenu(e, nt.day, 'status')} style={{ ...pill('gray'), opacity: .5, cursor: 'not-allowed' }}>숙소 먼저 선택<Ico name="lc-chevron-down" size={12} /></button>}</span>
                        </div>;
                    })}
                    {row && !row.stays.length && <div style={{ padding: 18, borderTop: '1px solid #f1f3f5', fontSize: 13, color: V7_MUTED }}>{row.accN === 0 && startKey ? '숙박이 없는 당일 일정이에요.' : '여행 시작일·종료일을 먼저 확인해 주세요.'}</div>}
                    {!row && <div style={{ padding: 18, borderTop: '1px solid #f1f3f5', fontSize: 13, color: V7_MUTED }}>{m.assignments.find(a => a.id === 'stay')?.detail || '숙소 배정은 배정 업무 화면에서 관리합니다.'}</div>}
                    {assignmentEditor}
                </div>

                <div id="sec-plan" style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '16px 18px 12px' }}>
                        <span style={iconTile(30)}><Ico name="lc-route" size={16} /></span><b style={{ fontSize: 15, fontWeight: 800 }}>일정</b>
                        <span style={{ fontSize: 13, fontWeight: 600, color: V7_MUTED }}>{period?.sch || (m.days.length ? `${m.days.length}일` : '')}</span>
                        <button type="button" disabled={busy} onClick={action('edit-itinerary')} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 13, fontWeight: 700, color: '#495057', cursor: 'pointer' }}>일정표 편집<Ico name="lc-chevron-right" size={14} /></button>
                    </div>
                    {m.days.map((day, i) => {
                        const open = !!dayOpen[day.id], last = i === m.days.length - 1;
                        const night = row?.stays.find(s => s.day === day.day);
                        const stayText = day.stayRequired === false || (last && !night) ? '숙박 없음' : night?.hotel ? `${night.hotel} · ${bookingStatusMeta(night.bookingStatus).label}` : day.stayAssigned && day.stay ? day.stay : '숙소 미정';
                        const has = stayText !== '숙소 미정', none = stayText === '숙박 없음', c = none ? '#ced4da' : night?.hotel ? bookingStatusMeta(night.bookingStatus).color : has ? '#12b28c' : '#FF4F4F';
                        const activities = day.activities?.length ? day.activities : scheduleTimeline(day.summary || '').map(s => ({ time: s.time, title: s.text }));
                        return <div key={day.id} style={{ borderTop: '1px solid #f1f3f5' }}>
                            <button type="button" aria-expanded={open} onClick={() => setDayOpen(prev => ({ ...prev, [day.id]: !open }))}
                                style={{ display: 'grid', gridTemplateColumns: '64px 96px minmax(0,1fr) auto 20px', alignItems: 'center', gap: 12, width: '100%', minHeight: 52, padding: '0 18px', border: 0, background: open ? '#fbfefd' : 'transparent', font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
                                <b style={{ fontSize: 13, fontWeight: 800, color: V7_INK, textAlign: 'left' }}>{day.day}일차</b>
                                <span style={{ fontSize: 13, fontWeight: 600, color: V7_MUTED, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', textAlign: 'left' }}>{day.date ? (/^\d{4}-\d{2}-\d{2}$/.test(day.date) ? shortDate(day.date) : day.date) : startKey ? shortDate(new Date(Date.parse(`${startKey}T00:00:00Z`) + (day.day - 1) * 864e5).toISOString().slice(0, 10)) : ''}</span>
                                <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{day.title || `${day.day}일차 일정 작성`}</span>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px 0 20px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', background: `radial-gradient(circle at 10px 50%, ${c} 3px, transparent 3.6px), ${has ? '#f4f6f8' : '#ffecec'}`, boxShadow: `inset 0 0 0 1px ${has ? '#e9ecef' : '#ffc9c9'}`, color: none ? V7_MUTED : has ? V7_INK : '#FF4F4F' }}><Ico name="lc-bed-double" size={13} />{stayText}</span>
                                <span style={{ display: 'flex', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}><Ico name="lc-chevron-down" size={16} color={V7_MUTED} /></span>
                            </button>
                            {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 12, margin: '0 18px 16px 94px', padding: '4px 0 0', animation: 'rvPop 180ms ease-out' }}>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {activities.length ? activities.map((it, k) => <div key={k} style={{ display: 'grid', gridTemplateColumns: '52px 14px minmax(0,1fr)', gap: 10, alignItems: 'start' }}>
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#495057', fontVariantNumeric: 'tabular-nums', lineHeight: '20px' }}>{it.time || ''}</span>
                                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}><span style={{ width: 8, height: 8, marginTop: 6, borderRadius: 999, background: '#12b28c', boxShadow: '0 0 0 3px #d2f5e8' }} /><span style={{ flex: 1, width: 2, marginTop: 4, background: k === activities.length - 1 ? 'transparent' : '#d2f5e8' }} /></span>
                                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 12, minWidth: 0 }}><b style={{ fontSize: 14, fontWeight: 700, lineHeight: '20px' }}>{it.title}</b>{(it as any).description && <span style={{ fontSize: 12, lineHeight: '18px', color: V7_MUTED }}>{(it as any).description}</span>}</span>
                                    </div>) : <span style={{ fontSize: 13, color: V7_MUTED, paddingBottom: 8 }}>상세 일정이 입력되지 않았습니다.</span>}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', paddingTop: 10, borderTop: '1px dashed #d2f5e8', fontSize: 12, color: '#495057' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ico name="lc-utensils" size={13} color="#0E9E7A" /><b style={{ fontWeight: 700 }}>식사</b>{day.meals || '미입력'}</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Ico name="lc-car" size={13} color="#0E9E7A" /><b style={{ fontWeight: 700 }}>이동</b>{day.travel || '미입력'}</span>
                                    <button type="button" disabled={busy} onClick={action('edit-itinerary', day.id)} style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 700, color: '#0E9E7A', cursor: 'pointer' }}><Ico name="lc-pencil" size={12} />{day.day}일차 편집</button>
                                </div>
                            </div>}
                        </div>;
                    })}
                    {!m.days.length && <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 18, borderTop: '1px solid #f1f3f5' }}><span style={{ flex: 1, fontSize: 13, color: V7_MUTED }}>아직 작성된 일정이 없어요. 기존 견적·상품 일정을 불러와 편집할 수 있습니다.</span><button type="button" disabled={busy} onClick={action('edit-itinerary')} style={inkBtn(34)}>일정 작성하기</button></div>}
                </div>

            </div>

            <div style={{ flex: '1 1 320px', maxWidth: 440, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 84 }}>
                <div id="sec-info" style={{ ...card, padding: '18px 20px 6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 10 }}>
                        <b style={{ flex: 1, fontSize: 17, fontWeight: 800 }}>고객 정보</b>
                        <button type="button" title="고객 정보 복사" aria-label="고객 정보 복사" onClick={() => void copyInfo()} style={{ width: 38, height: 38, border: 0, borderRadius: 999, background: '#fff', boxShadow: 'inset 0 0 0 1px #dee2e6', color: '#495057', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name="lc-copy" size={16} /></button>
                        <button type="button" title={maskOn ? '개인정보 보기' : '개인정보 가리기'} aria-label={maskOn ? '개인정보 보기' : '개인정보 가리기'} aria-pressed={!maskOn} onClick={() => setMaskOn(!maskOn)} style={{ width: 38, height: 38, border: 0, borderRadius: 999, background: '#fff', boxShadow: 'inset 0 0 0 1px #dee2e6', color: '#495057', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name={maskOn ? 'lc-eye' : 'lc-eye-off'} size={16} /></button>
                        <button type="button" title="고객 정보 수정" aria-label="고객 정보 수정" disabled={busy} onClick={action('edit-info')} style={{ width: 38, height: 38, border: 0, borderRadius: 999, background: '#fff', boxShadow: 'inset 0 0 0 1px #dee2e6', color: '#495057', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Ico name="lc-pencil" size={16} /></button>
                    </div>
                    {m.facts.slice(0, 3).map((f, i) => <div key={`${f.label}-${i}`} style={{ display: 'grid', gridTemplateColumns: '84px minmax(0,1fr)', gap: 10, padding: '6px 0', alignItems: 'center' }}>
                        <span style={{ fontSize: 13, color: V7_MUTED }}>{f.label}</span>
                        <span style={{ fontSize: 14, fontWeight: f.value ? 800 : 600, color: f.value ? V7_INK : '#adb5bd', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{f.value ? maskFact(f.label, f.value, maskOn) : '미입력'}</span>
                    </div>)}
                    <div style={{ height: 1, background: '#f1f3f5', marginTop: 10 }} />
                    {m.facts.length > 3 && disclosure({ icon: 'lc-file-text', title: '예약 상세 정보', sub: `접수 · 주문 경로 등 ${m.facts.length - 3}개 항목`, open: sections.bk, onToggle: () => setSections(s => s.bk ? {} as Record<string, boolean> : { bk: true }), children:
                        <div style={{ display: 'flex', flexDirection: 'column', padding: '10px 16px', marginBottom: 12, background: '#f8f9fa', borderRadius: 14 }}>
                            {m.facts.slice(3).map((f, i) => <div key={`${f.label}-${i}`} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr)', gap: 10, padding: '7px 0', fontSize: 13 }}><span style={{ color: V7_MUTED }}>{f.label}</span><span style={{ fontWeight: 700, color: f.value ? V7_INK : '#adb5bd', lineHeight: 1.55, overflowWrap: 'anywhere' }}>{f.value ? maskFact(f.label, f.value, maskOn) : '미입력'}</span></div>)}
                        </div>
                    })}
                    {!!m.flights?.length && disclosure({ icon: 'lc-plane', title: '항공편', sub: `${confirmedFlights}/${m.flights.length}편 정보 등록`, badge: confirmedFlights === m.flights.length ? '등록됨' : undefined, open: sections.fl, onToggle: () => setSections(s => s.fl ? {} as Record<string, boolean> : { fl: true }), children:
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                            {m.flights.map(f => { const ok = !!(f.date && f.time && f.flight); return <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px', background: '#f8f9fa', borderRadius: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Ico name={f.id === 'departure' ? 'lc-plane-takeoff' : 'lc-plane-landing'} size={15} /><b style={{ flex: 1, fontSize: 13, fontWeight: 800 }}>{f.label}</b><span style={chip(ok ? 'mint' : 'red', true)}>{ok ? '등록됨' : '미등록'}</span></div>
                                <b style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: f.flight ? V7_INK : '#adb5bd' }}>{f.flight || '미등록'}</b>
                                {[{ k: '날짜', v: f.date }, { k: f.id === 'departure' ? '몽골 출발' : '몽골 도착', v: f.time }, ...(f.extra || []).map(x => ({ k: x.label, v: x.value }))].map((kv, i) => <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13 }}><span style={{ color: V7_MUTED }}>{kv.k}</span><b style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{kv.v || '미입력'}</b></div>)}
                            </div>; })}
                            <button type="button" disabled={busy} onClick={action('flights')} style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 700, color: '#0E9E7A', cursor: 'pointer' }}>항공편 수정<Ico name="lc-chevron-right" size={12} /></button>
                        </div>
                    })}
                    {travelers && disclosure({ icon: 'lc-users', title: '여행자 정보', sub: `${travelers.registered}${travelers.expected !== null ? `/${travelers.expected}` : ''}명 등록`, open: sections.tr, onToggle: () => setSections(s => s.tr ? {} as Record<string, boolean> : { tr: true }), children: <>
                        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 12, borderRadius: 14, boxShadow: 'inset 0 0 0 1px #e9ecef', overflow: 'hidden' }}>
                            {travelers.people.map((person, i) => { const open = travelerOpen === i; return <div key={person.id} style={{ borderTop: i ? '1px solid #f1f3f5' : 0 }}>
                                <button type="button" aria-expanded={open} onClick={() => setTravelerOpen(open ? -1 : i)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', height: 48, padding: '0 14px', border: 0, background: '#fff', font: 'inherit', cursor: 'pointer', textAlign: 'left' }}>
                                    <span style={{ width: 24, height: 24, flex: 'none', borderRadius: 999, boxShadow: 'inset 0 0 0 1px #dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#495057' }}>{i + 1}</span>
                                    <b style={{ flex: 1, fontSize: 14, fontWeight: 800 }}>{person.name || '이름 미입력'}</b>
                                    <span style={{ fontSize: 12, color: V7_MUTED }}>{person.details.find(d => /구분|성인|아동/.test(d.label))?.value || ''}</span>
                                    <span style={{ display: 'flex', color: '#adb5bd', transition: 'transform 200ms', transform: open ? 'rotate(180deg)' : 'none' }}><Ico name="lc-chevron-down" size={15} /></span>
                                </button>
                                {open && <div style={{ display: 'flex', flexDirection: 'column', gap: 2, margin: '0 12px 12px', padding: '10px 14px', background: '#f8f9fa', borderRadius: 12 }}>
                                    {person.details.map((kv, k) => <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', fontSize: 13 }}><span style={{ color: V7_MUTED }}>{kv.label}</span><b style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', textAlign: 'right', overflowWrap: 'anywhere' }}>{kv.value ? maskFact(kv.label, kv.value, maskOn) : '미입력'}</b></div>)}
                                </div>}
                            </div>; })}
                            {!travelers.people.length && <div style={{ padding: '12px 14px', fontSize: 13, color: V7_MUTED }}>등록된 여행자가 없습니다.</div>}
                            {missingTravelers > 0 && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderTop: '1px solid #f1f3f5', background: '#fff5f5', fontSize: 13, fontWeight: 700, color: '#FF4F4F' }}><Ico name="lc-circle-alert" size={14} />{missingTravelers}명 여권 정보 미제출</div>}
                        </div>
                        <button type="button" disabled={busy} onClick={action('travelers')} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12, border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 700, color: '#0E9E7A', cursor: 'pointer' }}>여행자 전체 상세보기<Ico name="lc-chevron-right" size={12} /></button>
                    </> })}
                    {disclosure({ icon: 'lc-message-circle', title: '고객 요청 사항', sub: m.preferences?.length ? `요청 ${m.preferences.length}건` : '등록된 요청 없음', open: sections.rq, onToggle: () => setSections(s => s.rq ? {} as Record<string, boolean> : { rq: true }), children:
                        <div style={m.preferences?.length ? { margin: '0 0 14px', padding: '12px 14px', background: '#f8f9fa', borderRadius: 12, fontSize: 13, fontWeight: 600, lineHeight: 1.6, color: V7_INK, whiteSpace: 'pre-wrap' } : { margin: '0 0 14px', fontSize: 13, color: V7_MUTED }}>{m.preferences?.length ? m.preferences.join('\n') : '등록된 요청 사항이 없어요.'}</div>
                    })}
                </div>

                <div id="sec-memo" className="v7-memo" style={{ ...card, gap: 10, padding: '16px 18px' }}>
                    <b style={{ fontSize: 15, fontWeight: 800 }}>운영 메모</b>
                    {m.notes.length > 0 && <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>{m.notes.slice(-4).map(note => <li key={note.id} style={{ padding: '10px 12px', background: '#f8f9fa', borderRadius: 12 }}>
                        <div style={{ display: 'flex', gap: 8, fontSize: 12, color: V7_MUTED }}><b style={{ color: '#495057' }}>{note.author || '관리자 메모'}</b>{note.at && <span>{note.at}</span>}</div>
                        <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{note.body}</p>
                    </li>)}</ol>}
                    {noteComposer || <button type="button" disabled={busy} onClick={action('notes')} style={ghostBtn()}>메모 작성</button>}
                </div>

                <div id="sec-log" style={{ ...card, gap: 4, padding: '16px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}><b style={{ fontSize: 15, fontWeight: 800 }}>알림 · 변경 이력</b><span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: V7_MUTED }}>{logs.length}건</span></div>
                    {logs.map((lg, i) => { const tag = LOG_TAGS[lg.kind] || LOG_TAGS.change; return <div key={lg.id} style={{ display: 'grid', gridTemplateColumns: '20px minmax(0,1fr)', gap: 10 }}>
                        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}><span style={{ width: 10, height: 10, marginTop: 5, borderRadius: 999, boxSizing: 'border-box', background: i === 0 ? '#12b28c' : '#fff', border: i === 0 ? '0' : '2px solid #ced4da', boxShadow: i === 0 ? '0 0 0 4px #e6f8f1' : 'none' }} /><span style={{ flex: 1, width: 2, background: '#f1f3f5', marginTop: 4 }} /></span>
                        <span style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 14, minWidth: 0 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><span style={chip(tag.tone, false, { height: 20 })}>{tag.tag}</span><span style={{ fontSize: 14, fontWeight: 700 }}>{lg.title}</span>{lg.internal && <span style={{ fontSize: 11, color: V7_MUTED }}>내부</span>}</span>
                            {lg.detail && <span style={{ fontSize: 12, color: '#495057' }}>{lg.detail}</span>}
                            <span style={{ fontSize: 12, color: V7_MUTED, fontVariantNumeric: 'tabular-nums' }}>{historyTime(lg.at)}</span>
                        </span>
                    </div>; })}
                    {!logs.length && <span style={{ fontSize: 13, color: V7_MUTED, paddingBottom: 8 }}>저장된 처리 이력이 없습니다.</span>}
                    <button type="button" disabled={busy} onClick={action('history')} style={{ alignSelf: 'flex-end', display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', padding: 0, font: 'inherit', fontSize: 13, fontWeight: 700, color: '#0E9E7A', cursor: 'pointer' }}>전체 이력<Ico name="lc-chevron-right" size={14} /></button>
                </div>
            </div>
        </div>
        <V7Menu menu={menu} onClose={closeMenu} />
        <V7Toast text={toast} />
    </section>;
    return { element, assignmentKey, loadItem, flash };
}
