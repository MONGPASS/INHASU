import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { DashboardIconName } from '../dashboard/DashboardIcon';
import type { CustomerWorkspaceOverviewModel } from '../CustomerWorkspaceOverview';
import { dashboardSeoulDate } from '../../../utils/adminDashboard';
import { confirmGuideConflict, guideMenuItems } from './guideMenuItems';
import { scheduleTimeline } from '../../../utils/accommodationSchedule';
import { loadRegisteredAssignmentResources, type RegisteredAssignmentResources } from '../../../utils/registeredAssignmentResources';
import { selectResourceGuide, selectResourceLodge, selectResourceVehicle } from '../../../utils/accommodationResourceSelection';
import { AIRFARE_OPTIONS, CATEGORY_OPTIONS, JOINING_LABELS, RECEIPT_LABELS, SERVICE_TYPE_OPTIONS, type ReceiptStatus, type ReservationOperations } from '../../../utils/reservationWorkspace';
import {
    BOOKING_STATUS, BOOKING_STATUS_OPTIONS, OCCUPANCY_OPTIONS, V7_TABS, bookingStatusMeta, changeV7StayStatus, fetchV7Assignments, occupancyLabel, saveV7Assignment,
    v7Dday, v7Range, v7Row, v7StepLabel, v7StepSubs, v7Won, withGuide, withNight, withVehicle, type V7AssignmentItem, type V7Row, type V7Source,
} from '../../../utils/reservationV7';
import { PRODUCT_STATUS_OPTIONS, statusLabelOf } from './ReservationListV7';
import {
    Ico, V7Badge, V7Menu, V7Steps, V7StepHead, V7Styles, V7Toast, menuAt,
    type PillTone, type V7MenuItem, type V7MenuState,
} from './v7Ui';
import { adminConfirm } from '../ui/adminFeedback';
import { AdminButton, AdminIconButton, AdminTextButton, IconCheckThick, IconCoins, IconDocument, IconListCategory, IconPersons } from '../ui';
import './reservation-detail-cards.css';

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

/** 이 화면에서 열지 않는 배정 업무. 배정은 ‘숙소 배정’·‘가이드·숙소·차량’ 메뉴에서만 한다(2026-11-24). */
const ASSIGN_ACTIONS = new Set(['assignments', 'assign', 'guide', 'vehicle', 'stay']);
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
const LODGE_GRADES = ['고급 게르', '디럭스 게르', '일반 게르', '5성급 호텔', '4성급 호텔', '3성급 호텔', '게스트하우스', '캠핑'];
const PRIVATE_LABEL = /연락처|전화|휴대|이메일|메일|여권|생년월일|생일/;
const mask = (value: string, keep: number) => value.length <= keep ? value : value.slice(0, keep) + '*'.repeat(value.length - keep);
const maskFact = (label: string, value: string, on: boolean) => !on || !value || !PRIVATE_LABEL.test(label) ? value
    : /이메일|메일/.test(label) ? mask(value, 4) : /여권/.test(label) ? mask(value, 3) : /생년월일|생일/.test(label) ? mask(value, 4) : mask(value, 8);
const dateKeys = (text: string) => (text.match(/\d{4}[-.]\d{2}[-.]\d{2}/g) || []).map(key => key.replaceAll('.', '-'));
const shortDate = (key: string) => { const d = new Date(`${key}T00:00:00Z`); return Number.isFinite(d.getTime()) ? `${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')} (${'일월화수목금토'[d.getUTCDay()]})` : key; };
const historyTime = (at: string) => at.length === 10 ? at.replaceAll('-', '.') : Number.isFinite(Date.parse(at)) ? new Date(at).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(/\. /g, '.').replace(/\.$/, '') : at;

function cardHead({ icon, title, right }: { icon: DashboardIconName; title: string; right?: ReactNode }) {
    return <div className="v7-card-head">
        <span className="v7-tile"><Ico name={icon} size={16} /></span><b className="v7-card-title">{title}</b>{right}
    </div>;
}
/** 접는 줄(고객 정보 카드 안). 머리 전체가 눌리는 모양이라 생 button + adm-v7-* 클래스로 그린다. */
function disclosure({ icon, title, sub, badge, open, onToggle, children }: { icon: DashboardIconName; title: string; sub: string; badge?: string; open: boolean; onToggle: () => void; children: ReactNode }) {
    return <React.Fragment key={title}>
        <div className="v7-rule" />
        <button type="button" aria-expanded={!!open} className="adm-v7-disclosure" onClick={onToggle}>
            <span className="v7-disclosure-icon"><Ico name={icon} size={17} /></span>
            <span className="v7-disclosure-text"><b className="v7-disclosure-title">{title}</b><span className="v7-disclosure-sub">{sub}</span></span>
            {badge && <V7Badge tone="mint">{badge}</V7Badge>}
            <span className={open ? 'v7-chevron is-open' : 'v7-chevron'}><Ico name="lc-chevron-down" size={16} /></span>
        </button>
        {open && children}
    </React.Fragment>;
}

export interface ReservationDetailV7Props {
    model: Model; onAction: (action: string, id?: string) => void; busy?: boolean;
    noteComposer?: ReactNode; bookingSelector?: ReactNode; notificationActions?: ReactNode; links?: ReservationDetailV7Links;
}
/** 화면 상태. 테스트는 같은 상태 객체로 그리기 결과와 버튼 연결을 확인한다. */
export interface DetailState {
    item?: V7AssignmentItem; allItems: V7AssignmentItem[]; resources: RegisteredAssignmentResources | null; menu: V7MenuState | null; toast: string; saving: boolean;
    maskOn: boolean; sections: Record<string, boolean>; travelerOpen: number; dayOpen: Record<string, boolean>;
    /** 구역 탭에서 마지막으로 고른 구역(밑줄 표시용). */
    navSid: string;
    /** 고객 정보 카드의 예약 상세·항공편·여행자·요청 묶음을 펼쳤는지(기본 접힘). */
    infoMore: boolean;
    /** 배정 카드의 박별 숙소 목록을 펼쳤는지(기본 접힘). */
    staysOpen: boolean;
}
export const initialDetailState = (): DetailState => ({ allItems: [], resources: null, menu: null, toast: '', saving: false, maskOn: true,
    sections: {}, travelerOpen: 0, dayOpen: {}, navSid: 'sec-plan', staysOpen: false, infoMore: false });
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
export function reservationDetailView({ model: m, onAction, busy = false, noteComposer, bookingSelector, notificationActions, links }: ReservationDetailV7Props,
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

    const row: V7Row | null = source && source.type !== 'quote' ? v7Row(source, item, today) : null;
    const [startKey, endKey] = dateKeys(m.period || '');
    const cancelled = row ? row.tab === 'cancel' : m.currentStage?.tone === 'cancelled';
    const name = m.customerName || '고객 정보 확인 필요';
    const runAction = (a: string, id?: string) => ASSIGN_ACTIONS.has(a) ? goSec('sec-asg') : onAction(a, id);
    const action = (a: string, id?: string) => () => runAction(a, id);
    // 화면 안 이동. 관리자 레이아웃마다 스크롤 영역이 달라 요소 기준으로 이동한다(카드의 scrollMarginTop이 고정 바로가기 높이를 비운다).
    function goSec(sid: string) {
        const el = rootRef.current?.querySelector<HTMLElement>(`#${sid}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // 고정 열의 카드처럼 이미 보이는 대상은 움직이지 않으므로 잠깐 강조해 어디로 왔는지 보여 준다.
        el.classList.remove('v7-sec-flash'); void el.offsetWidth; el.classList.add('v7-sec-flash');
        window.setTimeout(() => el.classList.remove('v7-sec-flash'), 1400);
    }
    const openMenu = (e: React.MouseEvent, title: string, items: V7MenuItem[], wide = false) => { e.stopPropagation(); setMenu(menuAt(e.currentTarget as HTMLElement, title, items, wide)); };
    const closeMenu = () => setMenu(null);
    const phoneFact = m.facts.find(f => /연락처|전화/.test(f.label))?.value || '';
    const emailFact = m.facts.find(f => /이메일/.test(f.label))?.value || '';

    const paymentMenu = (e: React.MouseEvent, field: 'deposit' | 'final') => {
        if (!links?.onPayment || !row) { e.stopPropagation(); onAction('payments'); return; }
        const paid = field === 'deposit' ? row.depositPaid : row.balancePaid, labels = field === 'deposit' ? ['입금 완료', '미입금'] : ['완납', '미수'];
        openMenu(e, field === 'deposit' ? '예약금' : '잔금', labels.map((label, i) => ({ key: label, label, on: paid === (i === 0), onPick: async () => {
            if (paid === (i === 0)) return;
            if (field === 'deposit' && i === 0 && !await adminConfirm(`예약금 ${v7Won(row.source.deposit)} 입금을 확인할까요?${row.source.status === 'pending_payment' ? '\n예약이 확정되고 고객에게 입금 확인 메일이 발송됩니다.' : ''}`)) return;
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
        openMenu(e, '진행상황 변경', PRODUCT_STATUS_OPTIONS.map(o => ({ key: o.value, label: o.label, on: source.status === o.value, onPick: async () => {
            if (o.value === source.status) return;
            if (o.value === 'cancelled' && !await adminConfirm('이 예약을 취소 상태로 바꿀까요? 고객에게 취소 알림이 갑니다.')) return;
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

    // 진행 단계: 맞춤 견적은 견적서~일정표 공개 7단계(m.flow), 상품 예약은 v7 계산(예약 원본이 있을 때) 또는 고객 화면 모델의 단계
    const flow = m.flow;
    const flowStepSec: Record<string, string> = { quote: 'sec-doc', answer: 'sec-doc', deposit: 'sec-pay', sign: 'sec-doc', confirm: 'sec-pay', assign: 'sec-asg', publish: 'sec-plan' };
    const steps = flow ? flow.steps.map((s, i) => ({ label: s.label, done: s.done, sub: s.done ? '완료' : i === flow.current ? flow.next.waiting ? '기다리는 중' : '지금' : '대기' })) : row ? row.steps.map((s, i) => ({ ...s, sub: v7StepSubs(row)[i] })) : m.steps.map(s => ({ label: s.label, done: s.done, sub: s.done ? '완료' : s.current ? '진행 중' : '대기' }));
    const stepHead = flow ? flow.current >= flow.steps.length ? { label: '모든 단계 완료', tone: 'mint' as const } : { label: `${flow.current + 1}단계 · ${flow.steps[flow.current].label}`, tone: flow.next.waiting ? 'gray' as const : 'red' as const } : row ? v7StepLabel(row) : cancelled ? { label: '취소된 예약', tone: 'gray' as const } : steps.every(s => s.done) ? { label: '모든 단계 완료', tone: 'mint' as const } : { label: m.steps.find(s => s.current)?.label || steps.find(s => !s.done)?.label || '', tone: 'red' as const };
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

    const cls = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');
    /** 고르기 버튼(누르면 고르기 메뉴가 열린다). look: 'rdc-sel …'(네 칸 카드) 또는 'v7-sel …'(배정·숙소 줄) — 앞에 adm-를 붙여 클래스가 된다. */
    const btnSel = (value: string, empty: boolean, go: (e: React.MouseEvent) => void, icon: DashboardIconName = 'lc-chevron-down', look = cls('v7-sel', empty && 'is-warn')) =>
        <button type="button" disabled={busy || saving} className={`adm-${look}`} onClick={go}><span className="rdc-sel-text">{value}</span><Ico name={icon} size={look.startsWith('rdc-sel') ? 16 : 12} /></button>;
    /** 눌러서 상태 메뉴를 여는 알약(Seed 배지 모양 + 아래 화살표). */
    const btnPill = (value: string, tone: PillTone, go: (e: React.MouseEvent) => void) => <button type="button" disabled={busy || saving} className={`adm-v7-pill is-${tone}`} onClick={go}>{value}<Ico name="lc-chevron-down" size={12} /></button>;
    const openLink = (label: string, go: () => void, disabled = false) => <button type="button" aria-label={`${label} 열기`} disabled={busy || disabled} className="adm-rdc-open" onClick={go}>열기<Ico name="lc-external-link" size={14} /></button>;
    const editLink = (label: string, go: () => void) => <AdminTextButton size="sm" className="v7-edit-link" aria-label={label} disabled={busy} onClick={go} trailing={<Ico name="lc-pencil" size={12} />}>수정</AdminTextButton>;
    const guideValue = row?.guide?.name || (m.assignments.find(a => a.id === 'guide')?.state === 'ready' ? m.assignments.find(a => a.id === 'guide')!.value : '');
    const vehicleValue = row?.vehicle?.type || (m.assignments.find(a => a.id === 'vehicle')?.state === 'ready' ? m.assignments.find(a => a.id === 'vehicle')!.value : '');
    const stayReady = row ? row.accDone : m.assignments.find(a => a.id === 'stay')?.state === 'ready';
    // 예약 전 견적 문의: 배정은 예약으로 전환한 뒤에 한다. '선택' 버튼 대신 회색 안내 글자를 둔다(눌러서 다른 화면으로 넘어가지 않게).
    const asgLocked = !!m.disabledActions?.includes('assignments'), payLocked = !!m.disabledActions?.includes('payments');
    const mutedNote = (text: string) => <span className="v7-muted-note">{text}</span>;
    const lockedNote = mutedNote('예약 후 배정할 수 있어요'), payNote = mutedNote('예약 후 관리할 수 있어요');
    // Claude Design ‘예약 관리 · 강력 개선안’ 예약상세 카드(2026-11-23): 결제·배정·분류·서류 네 칸.
    // 모양은 reservation-detail-cards.css(rdc-*)가 정하고, 버튼 동작은 예전 카드와 같다(입금·배정·분류 고르기, 서류 열기, 업무 화면 열기).
    const cardBadge = (left: number | null, badge?: string, muted = false) => {
        const done = left === 0 || (left === null && badge === '완료' && !muted);
        return <span className={cls('rdc-badge', muted ? 'is-muted' : done ? 'is-done' : left ? 'is-left' : 'is-muted')}>
            {done ? <><IconCheckThick aria-hidden="true" />완료</> : left ? `${left}건 남음` : badge}
        </span>;
    };
    const rdcHead = (Icon: React.ComponentType<{ 'aria-hidden'?: boolean | 'true' }>, title: string, badge: ReactNode, edit?: ReactNode) =>
        <header className="rdc-head"><span className="rdc-tile"><Icon aria-hidden="true" /></span><h2 className="rdc-title">{title}</h2>{badge}{edit}</header>;
    /** 카드 제목 줄 끝의 연필 버튼(2026-11-24, 고객 정보 카드의 수정 버튼과 같은 모양): 그 업무의 편집 화면을 연다(배정은 숙소 배정 화면으로 이동). */
    const cardEdit = (label: string, go: { onClick?: () => void; to?: string }) => <AdminIconButton label={`${label} 편집`} variant="outlined" className="rdc-edit"
        disabled={busy} onClick={go.onClick} to={go.to}><Ico name="lc-pencil" size={16} /></AdminIconButton>;
    const lodgeHref = source && source.type !== 'quote' ? `/admin/accommodation-ops?open=${encodeURIComponent(source.id)}&source=${source.type === 'quote_booking' ? 'quote_booking' : 'product'}` : '/admin/accommodation-ops';
    const dot = (done: boolean) => <span className={cls('rdc-dot', done ? 'is-done' : 'is-open')} aria-hidden="true" />;
    const selClass = (warn: boolean, full = false) => cls('rdc-sel', full && 'is-full', warn && 'is-warn');

    // 결제: 총 매출 + 예약금·잔금 막대, 예약금·잔금·현금영수증
    const payLeft = [!depositPaid, !balancePaid, receiptLate].filter(Boolean).length;
    const depositAmount = pay.deposit ?? 0, balanceAmount = pay.balance ?? 0;
    const payRow = (label: string, amount: string, control: ReactNode) => <div className="rdc-row">
        <span className="rdc-row-main"><span className="rdc-label">{label}</span><span className="rdc-amount">{amount}</span></span>{control}
    </div>;
    const payCard = <section key="sec-pay" id="sec-pay" className="rdc-card" aria-label="결제">
        {rdcHead(IconCoins, '결제', payLocked ? cardBadge(null, '예약 전', true) : cardBadge(payLeft), !payLocked && cardEdit('결제', { onClick: action('payments') }))}
        <div className="rdc-total">
            <span className="rdc-label">총 매출</span>
            <span className="rdc-total-value">{v7Won(pay.total)}</span>
            {!payLocked && depositAmount + balanceAmount > 0 && <span className="rdc-bar" role="img"
                aria-label={`예약금 ${v7Won(pay.deposit)} ${depositPaid ? '입금 완료' : '미입금'}, 잔금 ${v7Won(pay.balance)} ${balancePaid ? '완납' : '미수'}`}>
                <span className={cls('rdc-bar-part', depositPaid && 'is-paid')} style={{ flexGrow: depositAmount }} />
                <span className={cls('rdc-bar-part', 'is-balance', balancePaid && 'is-paid')} style={{ flexGrow: balanceAmount }} />
            </span>}
        </div>
        <div className="rdc-rows">
            {payRow('예약금', v7Won(pay.deposit), payLocked ? payNote : btnSel(depositPaid ? '입금 완료' : '미입금', !depositPaid, e => paymentMenu(e, 'deposit'), undefined, selClass(!depositPaid)))}
            {payRow('잔금', v7Won(pay.balance), payLocked ? payNote : btnSel(balancePaid ? '완납' : '미수', !balancePaid, e => paymentMenu(e, 'final'), undefined, selClass(!balancePaid)))}
            <div className="rdc-row is-split"><span className="rdc-row-title">현금영수증</span>
                {payLocked ? payNote : ops ? btnSel(RECEIPT_LABELS[receipt], false, e => opsMenu(e, 'receipt'), undefined, selClass(receiptLate))
                    : btnSel('결제 화면', false, action('payments'), 'lc-chevron-right', selClass(false))}
            </div>
        </div>
    </section>;

    // 배정: 결과만 보여 준다(2026-11-24). 가이드·차량은 ‘가이드·숙소·차량’ 배정 현황, 숙소는 ‘숙소 배정’ 메뉴에서만 배정한다.
    const asgLeft = [!guideValue, !vehicleValue, !stayReady].filter(Boolean).length;
    const nights = row?.stays || [];
    const stayText = row ? row.accN ? `${row.accC} / ${row.accN}박 확정` : '숙박 없음' : m.assignments.find(a => a.id === 'stay')?.value || '';
    const stayAlert = !asgLocked && !stayReady;
    const asgField = (label: string, done: boolean, control: ReactNode) => <div className="rdc-field"><span className="rdc-label">{dot(done)}{label}</span>{control}</div>;
    const asgValue = (value: string, label: string, sub?: string) => <span className="rdc-result">
        <b className={value ? 'rdc-result-name' : 'rdc-result-name is-warn'}>{value || `${label} 미배정`}</b>{value && sub && <span className="rdc-result-sub">{sub}</span>}
    </span>;
    const guidePhone = row?.guide?.phone ? maskFact('연락처', row.guide.phone, maskOn) : m.assignments.find(a => a.id === 'guide')?.detail || '';
    const vehicleSub = [item?.assignment.vehicle?.driver && `기사 ${item.assignment.vehicle.driver}`, row?.vehicle?.phone && maskFact('연락처', row.vehicle.phone, maskOn)].filter(Boolean).join(' · ')
        || m.assignments.find(a => a.id === 'vehicle')?.detail || '';
    const asgCard = <section key="sec-asg" id="sec-asg" className="rdc-card" aria-label="배정">
        {rdcHead(IconPersons, '배정', asgLocked ? cardBadge(null, '예약 전', true) : cardBadge(asgLeft), !asgLocked && cardEdit('배정', { to: lodgeHref }))}
        <div className="rdc-body">
            {asgField('가이드', !!guideValue, asgLocked ? lockedNote : asgValue(guideValue, '가이드', guidePhone))}
            {asgField('차량', !!vehicleValue, asgLocked ? lockedNote : asgValue(vehicleValue, '차량', vehicleSub))}
            <div className={cls('rdc-box', stayAlert ? 'is-alert' : 'is-soft')}>
                <div className="rdc-box-head"><span className={cls('rdc-label', stayAlert && 'is-alert')}>{dot(!stayAlert)}숙소{stayAlert ? ' · 확정 필요' : ''}</span><span className="rdc-box-value">{stayText}</span></div>
                {/* 박별 숙소: 기본 접힘, 펼치면 한 줄에 한 박(박 · 날짜 · 숙소 · 수배 상태). key는 박 번호 — 미배정 박은 rowIndex가 모두 -1이라 겹친다 */}
                {nights.length > 0 && <AdminTextButton size="sm" tone="assistive" className="rdc-stay-toggle" aria-expanded={st.staysOpen} aria-controls="rdc-stay-list"
                    onClick={() => set(s => ({ staysOpen: !s.staysOpen }))} trailing={<Ico name="lc-chevron-down" size={14} />}>
                    {st.staysOpen ? '박별 숙소 접기' : `박별 숙소 보기 · ${nights.length}박`}
                </AdminTextButton>}
                {nights.length > 0 && st.staysOpen && <ul id="rdc-stay-list" className="rdc-stay-list">
                    {nights.map(n => <li key={n.day} className="rdc-stay">
                        <b className="rdc-stay-day">{n.day}박</b>
                        <span className="rdc-stay-date">{n.date ? shortDate(n.date) : '날짜 확인'}</span>
                        <span className={n.hotel ? 'rdc-stay-name' : 'rdc-stay-name is-warn'}>{n.hotel || '숙소 미배정'}</span>
                        {n.hotel && <span className="rdc-stay-status">{bookingStatusMeta(n.bookingStatus).label}</span>}
                    </li>)}
                </ul>}
                {asgLocked && lockedNote}
            </div>
        </div>
    </section>;

    // 분류: 2×2 고르기
    const clsCard = <section key="sec-cls" id="sec-cls" className="rdc-card" aria-label="분류">
        {rdcHead(IconListCategory, '분류', cardBadge(null, ops ? '완료' : '견적 편집기에서 관리', !ops), cardEdit('분류', { onClick: action('operations') }))}
        <div className="rdc-grid2">
            {([['조인여부', 'joining'], ['분류', 'category'], ['구분', 'serviceType'], ['항공', 'airfare']] as const).map(([label, key]) => {
                const value = ops ? key === 'joining' ? JOINING_LABELS[ops.joining] : (ops[key] || '') as string : key === 'category' ? row?.category || '' : '';
                return <div key={key} className="rdc-field"><span className="rdc-label">{label}</span>{btnSel(value || '미정', false, e => opsMenu(e, key), undefined, selClass(false, true))}</div>;
            })}
        </div>
    </section>;

    // 서류: 문서별 상태 꼬리표 + 열기, 아래 계약 동의·공개·전달 상자
    const docAlert = (status?: string) => /실패|필요|미작성|미발송|전/.test(status || '');
    const agreeAlert = !!m.agreement && /전|필요|미/.test(m.agreement.label);
    const docCard = <section key="sec-doc" id="sec-doc" className="rdc-card" aria-label="서류">
        {rdcHead(IconDocument, '서류', cardBadge(docAlerts), cardEdit('서류', { onClick: action('documents') }))}
        <div className="rdc-body">
            {m.documents.map(doc => <div key={doc.id} className="rdc-row">
                <span className="rdc-row-main"><span className="rdc-row-title">{doc.label}</span>
                    <span className={cls('rdc-tag', docAlert(doc.status) ? 'is-alert' : doc.status ? 'is-info' : 'is-neutral')}>{doc.status || doc.detail || '내용 확인'}</span></span>
                {doc.editAction && editLink(doc.editLabel || `${doc.label} 수정`, action(doc.editAction, doc.id))}{openLink(doc.label, action(doc.action || doc.id, doc.id), doc.disabled)}
            </div>)}
            <div className={cls('rdc-box', 'is-row', agreeAlert ? 'is-alert' : 'is-soft')}>
                <span className="rdc-row-main"><span className="rdc-row-title">{m.agreement && dot(!agreeAlert)}{m.agreement ? '계약 동의' : '공개·전달'}</span>
                    <span className={cls('rdc-box-note', agreeAlert && 'is-alert')}>{m.agreement ? [m.agreement.label, m.agreement.name && `서명자 ${m.agreement.name}`].filter(Boolean).join(' · ') : '고객 문서 공개와 알림 발송'}</span></span>
                {btnSel('공개·전달 관리', false, action('documents'), 'lc-arrow-right', 'rdc-sel is-brand')}
            </div>
        </div>
    </section>;
    const quadCards = [payCard, asgCard, clsCard, docCard];

    const element = <section ref={rootRef as React.RefObject<HTMLElement>} className="v7-root cw-overview" aria-label="예약 상세" aria-busy={busy || saving}>
        <V7Styles />
        <div className="v7-crumb">
            <button type="button" className="adm-v7-back v7-back" disabled={busy} onClick={action('back')}><Ico name="lc-chevron-left" size={16} />{m.backLabel || '통합 예약 목록'}</button>
            <span className="v7-crumb-text">예약 관리 · {m.backLabel || '통합 예약 목록'}{tabName ? ` · ${tabName}` : ''}{m.bookingNumber ? ` · 예약번호 ${m.bookingNumber}` : ''} · {m.sourceLabel}</span>
        </div>

        <div className="v7-panel v7-hero">
            <div className="v7-hero-main">
                <div className="v7-hero-title">
                    <h1 className="v7-hero-name">{name}</h1>
                    <button type="button" disabled={busy} className={`adm-v7-pill is-${statusTone}`} onClick={statusMenu}>{source ? statusLabelOf(source) : m.statusLabel}<Ico name="lc-chevron-down" size={12} /></button>
                    {dd && <V7Badge tone={dd.tone}>{dd.label}</V7Badge>}
                    {m.packageInfo && <V7Badge tone={m.packageInfo.tier === 'full' ? 'mint' : m.packageInfo.tier === 'value' ? 'blue' : 'gray'} title={m.packageInfo.detail}>{m.packageInfo.tier === 'full' ? '풀패키지' : m.packageInfo.tier === 'value' ? '실속형' : '패키지 미지정'}</V7Badge>}
                </div>
                <div className="v7-hero-facts">
                    {phoneFact && <span className="v7-fact is-num"><Ico name="lc-phone" size={14} color="var(--adm-text-3)" />{maskFact('연락처', phoneFact, maskOn)}</span>}
                    <span className="v7-fact is-num"><Ico name="lc-calendar" size={14} color="var(--adm-text-3)" />{period ? `${period.range}${period.sch ? ` · ${period.sch}` : ''}` : m.period || '일정 미정'}</span>
                    {m.partyLabel && <span className="v7-fact"><Ico name="lc-users" size={14} color="var(--adm-text-3)" />{m.partyLabel}</span>}
                    <span className="v7-fact"><Ico name="lc-map-pin" size={14} color="var(--adm-text-3)" />{m.placeLabel || row?.region || m.bookedProduct?.name || '지역 미정'}</span>
                    {m.bookedProduct?.href && <a className="v7-link v7-fact is-link" href={m.bookedProduct.href} target="_blank" rel="noopener noreferrer">{m.bookedProduct.name}<Ico name="lc-external-link" size={12} /></a>}
                </div>
            </div>
            <div className="v7-hero-actions">
                <AdminButton variant="secondary" disabled={busy} onClick={openNotices} leading={<Ico name="lc-send" size={15} color="var(--adm-accent-strong)" />}>{m.documentAction === 'documents' ? m.documentLabel || '견적서 확인·전달' : '알림 보내기'}</AdminButton>
                <AdminButton variant="primary" disabled={busy} onClick={action('edit-itinerary')} leading={<Ico name="lc-calendar-check" size={15} />}>일정표 편집</AdminButton>
            </div>
        </div>
        {bookingSelector && <div className="cw-booking-switcher">{bookingSelector}</div>}

        <div className="v7-panel v7-progress">
            <V7StepHead big label={stepHead.label} tone={stepHead.tone} count={cancelled ? '' : `${steps.filter(s => s.done).length} / ${steps.length} 단계 완료`} />
            <V7Steps large steps={steps} cancelled={!!cancelled} onStep={i => flow ? goSec(flowStepSec[flow.steps[i]?.id] || 'sec-plan') : stepTargets[i] ? goSec(stepTargets[i]) : ASSIGN_ACTIONS.has(m.steps[i]?.id || '') ? goSec('sec-asg') : onAction(m.steps[i]?.id || 'payments')} />
            {flow && <div className={flow.next.waiting ? 'v7-next is-waiting' : 'v7-next'} role="group" aria-label="지금 할 일">
                <div className="v7-next-text">
                    <div className="v7-next-kicker">{flow.current >= flow.steps.length ? '완료' : flow.next.waiting ? '고객 응답을 기다리는 중' : '지금 할 일'}</div>
                    <div className="v7-next-title">{flow.next.title}</div>
                    {flow.next.detail && <div className="v7-next-detail">{flow.next.detail}</div>}
                </div>
                {(flow.next.primary || flow.next.secondary) && <div className="v7-next-actions">
                    {flow.next.secondary && <AdminButton variant="secondary" disabled={busy} onClick={action(flow.next.secondary.action)}>{flow.next.secondary.label}</AdminButton>}
                    {flow.next.primary && <AdminButton variant="primary" disabled={busy} onClick={action(flow.next.primary.action)}>{flow.next.primary.label}</AdminButton>}
                </div>}
            </div>}
        </div>

        {/* Montage 시안: 구역 탭(밑줄). 누르면 해당 카드로 이동만 하고 업무를 실행하지 않는다. */}
        <nav aria-label="예약 상세 바로가기" className="v7-nav v7-tabs">
            {NAV.map(n => <button key={n.sid} type="button" className="adm-v7-tab v7-tab" aria-label={`${n.label} 위치로 이동`} aria-current={st.navSid === n.sid ? 'true' : undefined}
                onClick={() => { set({ navSid: n.sid }); goSec(n.sid); }}>{n.label}</button>)}
        </nav>
        {/* 고객 정보 · 일정: 바로가기 바로 아래 한 줄(2026-11-24 — 고객 알림 자동발송·운영 메모와 자리 바꿈) */}
        <div className="v7-top">
                <div id="sec-info" className="v7-card v7-info">
                    <div className="v7-info-head">
                        <b className="v7-info-title">고객 정보</b>
                        <AdminIconButton label="고객 정보 복사" variant="outlined" onClick={() => void copyInfo()}><Ico name="lc-copy" size={16} /></AdminIconButton>
                        <AdminIconButton label={maskOn ? '개인정보 보기' : '개인정보 가리기'} variant="outlined" aria-pressed={!maskOn} onClick={() => setMaskOn(!maskOn)}><Ico name={maskOn ? 'lc-eye' : 'lc-eye-off'} size={16} /></AdminIconButton>
                        <AdminIconButton label="고객 정보 수정" variant="outlined" disabled={busy} onClick={action('edit-info')}><Ico name="lc-pencil" size={16} /></AdminIconButton>
                    </div>
                    {m.facts.slice(0, 3).map((f, i) => <div key={`${f.label}-${i}`} className="v7-info-row">
                        <span className="v7-info-label">{f.label}</span>
                        <span className={f.value ? 'v7-info-value' : 'v7-info-value is-empty'}>{f.value ? maskFact(f.label, f.value, maskOn) : '미입력'}</span>
                    </div>)}
                    {/* 예약 상세·항공편·여행자·요청은 펼침 버튼 뒤로(2026-11-24): 카드가 길어지지 않고 옆 일정 카드와 높이가 맞는다 */}
                    <AdminTextButton size="sm" tone="assistive" className="v7-info-more" aria-expanded={st.infoMore} aria-controls="v7-info-more"
                        onClick={() => set(s => ({ infoMore: !s.infoMore }))} trailing={<Ico name="lc-chevron-down" size={14} />}>{st.infoMore ? '상세 정보 접기' : '예약·항공편·여행자 정보 보기'}</AdminTextButton>
                    {st.infoMore && <div id="v7-info-more" className="v7-info-more-body">
                    <div className="v7-rule is-spaced" />
                    {m.facts.length > 3 && disclosure({ icon: 'lc-file-text', title: '예약 상세 정보', sub: `접수 · 주문 경로 등 ${m.facts.length - 3}개 항목`, open: sections.bk, onToggle: () => setSections(s => s.bk ? {} as Record<string, boolean> : { bk: true }), children:
                        <div className="v7-soft-box v7-kv-list">
                            {m.facts.slice(3).map((f, i) => <div key={`${f.label}-${i}`} className="v7-kv is-wide"><span className="v7-kv-key">{f.label}</span><span className={f.value ? 'v7-kv-value' : 'v7-kv-value is-empty'}>{f.value ? maskFact(f.label, f.value, maskOn) : '미입력'}</span></div>)}
                        </div>
                    })}
                    {!!m.flights?.length && disclosure({ icon: 'lc-plane', title: '항공편', sub: `${confirmedFlights}/${m.flights.length}편 정보 등록`, badge: confirmedFlights === m.flights.length ? '등록됨' : undefined, open: sections.fl, onToggle: () => setSections(s => s.fl ? {} as Record<string, boolean> : { fl: true }), children:
                        <div className="v7-stack">
                            {m.flights.map(f => { const ok = !!(f.date && f.time && f.flight); return <div key={f.id} className="v7-soft-box v7-flight">
                                <div className="v7-flight-head"><Ico name={f.id === 'departure' ? 'lc-plane-takeoff' : 'lc-plane-landing'} size={15} /><b className="v7-grow">{f.label}</b><V7Badge tone={ok ? 'mint' : 'red'} size="sm">{ok ? '등록됨' : '미등록'}</V7Badge></div>
                                <b className={f.flight ? 'v7-flight-no' : 'v7-flight-no is-empty'}>{f.flight || '미등록'}</b>
                                {[{ k: '날짜', v: f.date }, { k: f.id === 'departure' ? '몽골 출발' : '몽골 도착', v: f.time }, ...(f.extra || []).map(x => ({ k: x.label, v: x.value }))].map((kv, i) => <div key={i} className="v7-kv is-split"><span className="v7-kv-key">{kv.k}</span><b className="v7-kv-num">{kv.v || '미입력'}</b></div>)}
                            </div>; })}
                            <AdminTextButton size="sm" className="v7-end" disabled={busy} onClick={action('flights')} trailing={<Ico name="lc-chevron-right" size={12} />}>항공편 수정</AdminTextButton>
                        </div>
                    })}
                    {travelers && disclosure({ icon: 'lc-users', title: '여행자 정보', sub: `${travelers.registered}${travelers.expected !== null ? `/${travelers.expected}` : ''}명 등록`, open: sections.tr, onToggle: () => setSections(s => s.tr ? {} as Record<string, boolean> : { tr: true }), children: <>
                        <div className="v7-travelers">
                            {travelers.people.map((person, i) => { const open = travelerOpen === i; return <div key={person.id} className="v7-traveler">
                                <button type="button" aria-expanded={open} className="adm-v7-traveler" onClick={() => setTravelerOpen(open ? -1 : i)}>
                                    <span className="v7-traveler-no">{i + 1}</span>
                                    <b className="v7-traveler-name">{person.name || '이름 미입력'}</b>
                                    <span className="v7-traveler-kind">{person.details.find(d => /구분|성인|아동/.test(d.label))?.value || ''}</span>
                                    <span className={open ? 'v7-chevron is-open' : 'v7-chevron'}><Ico name="lc-chevron-down" size={15} /></span>
                                </button>
                                {open && <div className="v7-soft-box v7-traveler-body">
                                    {person.details.map((kv, k) => <div key={k} className="v7-kv is-split"><span className="v7-kv-key">{kv.label}</span><b className="v7-kv-num is-end">{kv.value ? maskFact(kv.label, kv.value, maskOn) : '미입력'}</b></div>)}
                                </div>}
                            </div>; })}
                            {!travelers.people.length && <div className="v7-travelers-empty">등록된 여행자가 없습니다.</div>}
                            {missingTravelers > 0 && <div className="v7-travelers-alert"><Ico name="lc-circle-alert" size={14} />{missingTravelers}명 여권 정보 미제출</div>}
                        </div>
                        <AdminTextButton size="sm" className="v7-after" disabled={busy} onClick={action('travelers')} trailing={<Ico name="lc-chevron-right" size={12} />}>여행자 전체 상세보기</AdminTextButton>
                    </> })}
                    {disclosure({ icon: 'lc-message-circle', title: '고객 요청 사항', sub: m.preferences?.length ? `요청 ${m.preferences.length}건` : '등록된 요청 없음', open: sections.rq, onToggle: () => setSections(s => s.rq ? {} as Record<string, boolean> : { rq: true }), children:
                        <div className={m.preferences?.length ? 'v7-soft-box v7-requests' : 'v7-requests is-empty'}>{m.preferences?.length ? m.preferences.join('\n') : '등록된 요청 사항이 없어요.'}</div>
                    })}
                    </div>}
                </div>

                <div id="sec-plan" className="v7-card">
                    <div className="v7-card-head is-nowrap">
                        <span className="v7-tile"><Ico name="lc-route" size={16} /></span><b className="v7-card-title">일정</b>
                        <span className="v7-card-meta">{period?.sch || (m.days.length ? `${m.days.length}일` : '')}</span>
                        <AdminTextButton tone="assistive" size="sm" className="v7-push" disabled={busy} onClick={action('edit-itinerary')} trailing={<Ico name="lc-chevron-right" size={14} />}>일정표 편집</AdminTextButton>
                    </div>
                    {m.days.map((day, i) => {
                        const open = !!dayOpen[day.id], last = i === m.days.length - 1;
                        const night = row?.stays.find(s => s.day === day.day);
                        const stayText = day.stayRequired === false || (last && !night) ? '숙박 없음' : night?.hotel ? `${night.hotel} · ${bookingStatusMeta(night.bookingStatus).label}` : day.stayAssigned && day.stay ? day.stay : '숙소 미정';
                        const has = stayText !== '숙소 미정', none = stayText === '숙박 없음', c = none ? 'var(--adm-line-strong)' : night?.hotel ? bookingStatusMeta(night.bookingStatus).color : has ? 'var(--adm-accent-strong)' : 'var(--adm-danger)';
                        const activities = day.activities?.length ? day.activities : scheduleTimeline(day.summary || '').map(s => ({ time: s.time, title: s.text }));
                        // 숙소 점 색은 수배 상태 원본(bookingStatusMeta.color)에서 실행 중에 정해진다.
                        const dotColor = { '--v7-stay-dot': c } as React.CSSProperties;
                        return <div key={day.id} className="v7-day">
                            <button type="button" aria-expanded={open} className={open ? 'adm-v7-day v7-day-btn is-open' : 'adm-v7-day v7-day-btn'} onClick={() => setDayOpen(prev => ({ ...prev, [day.id]: !open }))}>
                                <b className="v7-day-no">{day.day}일차</b>
                                <span className="v7-day-date">{day.date ? (/^\d{4}-\d{2}-\d{2}$/.test(day.date) ? shortDate(day.date) : day.date) : startKey ? shortDate(new Date(Date.parse(`${startKey}T00:00:00Z`) + (day.day - 1) * 864e5).toISOString().slice(0, 10)) : ''}</span>
                                <span className="v7-day-title">{day.title || `${day.day}일차 일정 작성`}</span>
                                <span className={none ? 'v7-day-stay is-none' : has ? 'v7-day-stay' : 'v7-day-stay is-missing'} style={dotColor}><Ico name="lc-bed-double" size={13} />{stayText}</span>
                                <span className={open ? 'v7-chevron is-open' : 'v7-chevron'}><Ico name="lc-chevron-down" size={16} color="var(--adm-text-3)" /></span>
                            </button>
                            {open && <div className="v7-day-body">
                                <div className="v7-timeline">
                                    {activities.length ? activities.map((it, k) => <div key={k} className="v7-tl-row">
                                        <span className="v7-tl-time">{it.time || ''}</span>
                                        <span className="v7-tl-rail"><span className="v7-tl-dot" /><span className={k === activities.length - 1 ? 'v7-tl-line is-last' : 'v7-tl-line'} /></span>
                                        <span className="v7-tl-text"><b className="v7-tl-title">{it.title}</b>{(it as any).description && <span className="v7-tl-desc">{(it as any).description}</span>}</span>
                                    </div>) : <span className="v7-empty-text">상세 일정이 입력되지 않았습니다.</span>}
                                </div>
                                <div className="v7-day-foot">
                                    <span className="v7-fact"><Ico name="lc-utensils" size={13} color="var(--adm-accent-strong)" /><b>식사</b>{day.meals || '미입력'}</span>
                                    <span className="v7-fact"><Ico name="lc-car" size={13} color="var(--adm-accent-strong)" /><b>이동</b>{day.travel || '미입력'}</span>
                                    <AdminTextButton size="sm" className="v7-push" disabled={busy} onClick={action('edit-itinerary', day.id)} leading={<Ico name="lc-pencil" size={12} />}>{`${day.day}일차 편집`}</AdminTextButton>
                                </div>
                            </div>}
                        </div>;
                    })}
                    {!m.days.length && <div className="v7-card-note is-row"><span className="v7-grow">아직 작성된 일정이 없어요. 기존 견적·상품 일정을 불러와 편집할 수 있습니다.</span><AdminButton variant="secondary" size="sm" disabled={busy} onClick={action('edit-itinerary')}>일정 작성하기</AdminButton></div>}
                </div>

        </div>
        <div className="v7-quad rdc-grid">
            {quadCards}
        </div>

        <div className="v7-cols">
            <div className="v7-main">
                <div id="sec-memo" className="v7-memo v7-card v7-card-pad">
                    <b className="v7-card-title">운영 메모</b>
                    {m.notes.length > 0 && <ol className="v7-notes">{m.notes.slice(-4).map(note => <li key={note.id} className="v7-note">
                        <div className="v7-note-meta"><b>{note.author || '관리자 메모'}</b>{note.at && <span>{note.at}</span>}</div>
                        <p className="v7-note-body">{note.body}</p>
                    </li>)}</ol>}
                    {noteComposer || <AdminButton variant="secondary" disabled={busy} onClick={action('notes')}>메모 작성</AdminButton>}
                </div>
            </div>

            <div className="v7-side">
                {/* 고객 알림 자동발송·이력/다시 보내기는 오른쪽 칸(2026-11-24, 고객 정보·운영 메모와 자리 바꿈) */}
                {notificationActions}

                <div id="sec-log" className="v7-card v7-card-pad v7-log">
                    <div className="v7-log-head"><b className="v7-card-title">알림 · 변경 이력</b><span className="v7-log-count">{logs.length}건</span></div>
                    {logs.map((lg, i) => { const tag = LOG_TAGS[lg.kind] || LOG_TAGS.change; return <div key={lg.id} className="v7-log-row">
                        <span className="v7-log-rail"><span className={i === 0 ? 'v7-log-dot is-latest' : 'v7-log-dot'} /><span className="v7-log-line" /></span>
                        <span className="v7-log-text">
                            <span className="v7-log-title-row"><V7Badge tone={tag.tone} size="sm">{tag.tag}</V7Badge><span className="v7-log-title">{lg.title}</span>{lg.internal && <span className="v7-log-internal">내부</span>}</span>
                            {lg.detail && <span className="v7-log-detail">{lg.detail}</span>}
                            <span className="v7-log-time">{historyTime(lg.at)}</span>
                        </span>
                    </div>; })}
                    {!logs.length && <span className="v7-empty-text">저장된 처리 이력이 없습니다.</span>}
                    <AdminTextButton className="v7-end" disabled={busy} onClick={action('history')} trailing={<Ico name="lc-chevron-right" size={14} />}>전체 이력</AdminTextButton>
                </div>
            </div>
        </div>
        <V7Menu menu={menu} onClose={closeMenu} />
        <V7Toast text={toast} />
    </section>;
    return { element, assignmentKey, loadItem, flash };
}
