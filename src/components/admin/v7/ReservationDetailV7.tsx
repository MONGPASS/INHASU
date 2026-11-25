import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
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
import { V7Badge, V7Menu, V7Styles, V7Toast, menuAt, type V7MenuItem, type V7MenuState } from './v7Ui';
import { adminConfirm } from '../ui/adminFeedback';
import {
    AdminButton, AdminIconButton, AdminTextButton, IconBell, IconCar, IconChat, IconCheckThick, IconChevronDown, IconChevronLeft, IconChevronRight, IconClock, IconCoupon,
    IconExternal, IconHotel, IconListCategory, IconLocation, IconMap, IconPencil, IconPerson, IconPersons, IconWrite,
} from '../ui';
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

/** 가이드·차량 배정 화면(‘가이드·숙소·차량’의 가이드 배정 현황). 숙소는 숙소 배정 화면(lodgeHref). */
const GUIDE_SCHEDULE_HREF = '/admin/quote-desk/resources?view=schedule';
/** 받침이 있으면 true — 이/가, 을/를 고르기. */
const hasFinal = (word: string) => { const c = word.charCodeAt(word.length - 1); return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 > 0; };
/** 일정 카드가 처음에 보여 주는 일차 수(고객 정보 카드와 같은 높이). */
const PLAN_PREVIEW_DAYS = 3;
/** 이 화면에서 열지 않는 배정 업무 — 누르면 배정 카드로 이동한다. 배정은 ‘숙소 배정’·‘가이드·숙소·차량’ 메뉴에서만 한다(2026-11-24). */
const ASSIGN_ACTIONS = new Set(['assignments', 'assign', 'guide', 'vehicle', 'stay']);
/** 바로가기 6개(디자인 v7): 같은 화면 안의 해당 카드로 이동한다. 업무 화면은 각 카드의 버튼이 연다. */
const NAV: Array<{ label: string; sid: string }> = [
    { label: '일정표 편집', sid: 'sec-plan' }, { label: '고객·항공편', sid: 'sec-info' },
    { label: '결제·영수증', sid: 'sec-pay' }, { label: '가이드·숙소', sid: 'sec-asg' },
    { label: '운영 메모', sid: 'sec-memo' }, { label: '변경 이력', sid: 'sec-log' },
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

export interface ReservationDetailV7Props {
    model: Model; onAction: (action: string, id?: string) => void; busy?: boolean;
    noteComposer?: ReactNode; bookingSelector?: ReactNode; notificationActions?: ReactNode; links?: ReservationDetailV7Links;
}
/** 화면 상태. 테스트는 같은 상태 객체로 그리기 결과와 버튼 연결을 확인한다. */
export interface DetailState {
    item?: V7AssignmentItem; allItems: V7AssignmentItem[]; resources: RegisteredAssignmentResources | null; menu: V7MenuState | null; toast: string; saving: boolean;
    maskOn: boolean;
    /** 구역 탭에서 마지막으로 고른 구역(밑줄 표시용). */
    navSid: string;
    /** 일정 카드를 펼쳤는지(모든 일차 + 일차별 상세, 기본: 3일까지만). */
    daysAll: boolean;
    /** 고객 정보 카드의 예약 상세·항공편·여행자·요청·예약번호를 펼쳤는지(기본 접힘). */
    infoMore: boolean;
    /** 고객 정보의 펼침 줄(항공편·여행자)과 여행자별 상세를 펼쳤는지 — 각각 따로 펼친다 */
    infoOpen: Record<string, boolean>; travelerOpen: Record<string, boolean>;
    /** 배정 카드의 박별 숙소 목록을 펼쳤는지(기본 접힘). */
    staysOpen: boolean;
}
export const initialDetailState = (): DetailState => ({ allItems: [], resources: null, menu: null, toast: '', saving: false, maskOn: true,
    navSid: 'sec-plan', staysOpen: false, infoMore: false, daysAll: false, infoOpen: {}, travelerOpen: {} });
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
    const { item, menu, toast, saving, maskOn } = st;
    const setItem = (value: V7AssignmentItem | undefined) => set({ item: value });
    const setAllItems = (value: V7AssignmentItem[] | ((prev: V7AssignmentItem[]) => V7AssignmentItem[])) => set(s => ({ allItems: typeof value === 'function' ? value(s.allItems) : value }));
    const setResources = (value: RegisteredAssignmentResources) => set({ resources: value });
    const setMenu = (value: V7MenuState | null) => set({ menu: value });
    const setToast = (value: string) => set({ toast: value });
    const setSaving = (value: boolean) => set({ saving: value });
    const setMaskOn = (value: boolean) => set({ maskOn: value });
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
        const folded = el.closest('details');
        if (folded && !folded.open) folded.open = true;
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
    /** 알림 보내기: 같은 화면의 고객 알림 카드로 이동한다. 예약 전(견적 문의)에는 견적서 확인·전달 화면을 연다. */
    const openNotices = () => { if (notificationActions && m.documentAction !== 'documents') goSec('sec-notice'); else onAction('documents'); };
    const copyInfo = async () => {
        const text = [name, phoneFact, emailFact, m.placeLabel || row?.region || '', m.period, m.partyLabel].filter(Boolean).join('\n');
        try { await navigator.clipboard.writeText(text); flash('고객 정보를 복사했어요'); } catch { flash('복사하지 못했어요. 브라우저 권한을 확인해 주세요.'); }
    };

    const dd = row ? v7Dday(row) : null;
    const period = row ? v7Range(row) : null;
    // ── 디자인 ‘고객 통합 작업 · 개선안’(2026-11-24): 흰 카드(모서리 16) 머리 → 진행 단계 + 고객 차례 판 → 탭 → 고객 정보·일정 → 결제·배정·분류·서류 → 운영 메모·고객 알림.
    const cls = (...names: Array<string | false | null | undefined>) => names.filter(Boolean).join(' ');
    type PillTone = 'neutral' | 'danger' | 'accent';
    /** 알약(높이 24): 누를 수 있으면 메뉴를 여는 버튼, 아니면 표시만. */
    const pill = (text: ReactNode, tone: PillTone, opt: { onClick?: (e: React.MouseEvent) => void; title?: string; label?: string } = {}) => opt.onClick
        ? <button type="button" disabled={busy || saving} className={`adm-cw-pill is-${tone}`} title={opt.title} aria-label={opt.label} onClick={opt.onClick}>{text}<IconChevronDown aria-hidden="true" /></button>
        : <span className={`cw-pill is-${tone}`} title={opt.title}>{text}</span>;
    const toneOf = (t: string): PillTone => t === 'red' ? 'danger' : t === 'mint' ? 'accent' : 'neutral';
    type CardIcon = React.ComponentType<{ 'aria-hidden'?: boolean | 'true' }>;
    /** 카드 상태(제목 바로 뒤 작은 숫자 알약): 남은 건수 + 올리거나 키보드로 고르면 뜨는 말풍선(무엇이 남았는지). */
    type CardState = { n: ReactNode; msg: string; tone: 'urgent' | 'muted' | 'done' };
    /** count: 문구 수와 남은 건수가 다를 때(배정 셋을 한 문장으로 말할 때) */
    const leftState = (parts: string[], doneMsg: string, count = parts.length): CardState => parts.length
        ? { n: count, msg: `${count}건 남음 · ${parts.join(' · ')}`, tone: 'urgent' } : { n: <IconCheckThick aria-hidden="true" />, msg: doneMsg, tone: 'done' };
    const countChip = (title: string, s: CardState) => <span className={`cw-count is-${s.tone}`} data-tip={s.msg} tabIndex={0} role="img" aria-label={`${title} · ${s.msg}`}>{s.n}</span>;
    /** 카드 머리: 34px 회색 아이콘 칸 · 제목 · (설명·건수) · 오른쪽 버튼 */
    const head = (Icon: CardIcon, title: string, opt: { meta?: ReactNode; state?: CardState; right?: ReactNode } = {}) => <header className="cw-head">
        <span className="cw-tile"><Icon aria-hidden="true" /></span><h2 className="cw-title">{title}</h2>
        {opt.meta && <span className="cw-head-meta">{opt.meta}</span>}{opt.state && countChip(title, opt.state)}<span className="cw-grow" />{opt.right}
    </header>;
    /** 카드 제목 줄 끝의 연필 버튼: 그 업무의 편집 화면을 연다(배정은 숙소 배정 화면으로 이동). */
    const cardEdit = (label: string, go: { onClick?: () => void; to?: string }) => <AdminIconButton label={`${label} 편집`} variant="outlined" className="cw-edit"
        disabled={busy} onClick={go.onClick} to={go.to}><IconPencil aria-hidden="true" /></AdminIconButton>;
    /** 카드 아래 가운데 펼침 아이콘. */
    const foldButton = (open: boolean, label: string, controls: string | undefined, toggle: () => void) => <div className="cw-fold">
        <AdminIconButton label={label} aria-expanded={open} aria-controls={controls} className={open ? 'cw-fold-btn is-open' : 'cw-fold-btn'} onClick={toggle}><IconChevronDown aria-hidden="true" /></AdminIconButton>
    </div>;
    const textBtn = (label: string, go: () => void, aria?: string, disabled = false) => <AdminTextButton size="sm" tone="assistive" aria-label={aria} disabled={busy || disabled} onClick={go}>{label}</AdminTextButton>;
    const row2 = (label: ReactNode, value: ReactNode, key?: string) => <div key={key} className="cw-row"><span className="cw-row-label">{label}</span><span className="cw-row-value">{value}</span></div>;
    const lodgeHref = source && source.type !== 'quote' ? `/admin/accommodation-ops?open=${encodeURIComponent(source.id)}&source=${source.type === 'quote_booking' ? 'quote_booking' : 'product'}` : '/admin/accommodation-ops';
    const dayKey = (at: string) => at ? dashboardSeoulDate(at) : '';
    const dayDiff = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
    const mmdd = (key: string) => key.length >= 10 ? `${key.slice(5, 7)}.${key.slice(8, 10)}` : key;
    const toDeparture = startKey ? dayDiff(today, startKey) : null;
    // 예약 전 견적 문의: 결제·배정은 예약으로 전환한 뒤에 한다(회색 안내 글자).
    const asgLocked = !!m.disabledActions?.includes('assignments'), payLocked = !!m.disabledActions?.includes('payments');
    const mutedNote = (text: string) => <p className="cw-note">{text}</p>;

    // ── 머리
    const statusText = source ? statusLabelOf(source) : m.statusLabel;
    const dday = dd || (toDeparture !== null && toDeparture >= 0 ? { label: toDeparture === 0 ? 'D-DAY' : `D-${toDeparture}`, tone: toDeparture <= 7 ? 'red' : 'gray' } : null);
    const shortNo = m.bookingNumber && /^[0-9a-f-]{20,}$/i.test(m.bookingNumber) ? m.bookingNumber.slice(0, 8) : m.bookingNumber;
    const hero = <section className="cw-card cw-hero" aria-label="고객 요약">
        <div className="cw-hero-main">
            <div className="cw-hero-title">
                <h1 className="cw-hero-name">{name}</h1>
                {dday && pill(dday.label, dday.tone === 'red' ? 'danger' : 'neutral')}
                {pill(statusText, 'neutral', links?.onStatus && source?.type === 'product' ? { onClick: statusMenu, label: `진행상황 ${statusText} · 바꾸기` } : {})}
                {m.packageInfo && pill(m.packageInfo.tier === 'full' ? '풀패키지' : m.packageInfo.tier === 'value' ? '실속형' : '패키지 미지정', 'neutral', { title: m.packageInfo.detail })}
                <span className="cw-hero-meta">{m.sourceLabel}{shortNo ? ` · #${shortNo}` : ''}</span>
            </div>
            <div className="cw-hero-facts">
                <span className="cw-fact is-num"><IconClock aria-hidden="true" />{period ? `${period.range}${period.sch ? ` · ${period.sch}` : ''}` : m.period || '일정 미정'}</span>
                {m.partyLabel && <span className="cw-fact"><IconPerson aria-hidden="true" />{m.partyLabel}</span>}
                <span className="cw-fact"><IconLocation aria-hidden="true" />{m.placeLabel || row?.region || m.bookedProduct?.name || '지역 미정'}</span>
                {phoneFact && <span className="cw-fact is-num"><IconChat aria-hidden="true" />{maskFact('연락처', phoneFact, maskOn)}</span>}
                {m.bookedProduct?.href && <a className="cw-fact is-link" href={m.bookedProduct.href} target="_blank" rel="noopener noreferrer">{m.bookedProduct.name}<IconExternal aria-hidden="true" /></a>}
            </div>
        </div>
        <div className="cw-hero-actions">
            <AdminButton variant="weak" disabled={busy} onClick={openNotices}>{m.documentAction === 'documents' ? m.documentLabel || '견적서 확인·전달' : '알림 보내기'}</AdminButton>
            <AdminButton variant="primary" disabled={busy} onClick={action('edit-itinerary')}>일정표 편집</AdminButton>
        </div>
    </section>;

    // ── 진행 단계: 번호 원 + 잇는 선(완료 구간은 민트), 지금 단계 위 작은 화살표. 맞춤 견적은 견적서~일정표 공개 7단계(m.flow)
    const flow = m.flow;
    const flowStepSec: Record<string, string> = { quote: 'sec-doc', answer: 'sec-doc', deposit: 'sec-pay', sign: 'sec-doc', confirm: 'sec-pay', assign: 'sec-asg', publish: 'sec-plan' };
    const steps: Array<{ label: string; done: boolean }> = flow ? flow.steps : row ? row.steps : m.steps;
    const stepNow = steps.findIndex(s => !s.done);
    const stepHead = flow ? flow.current >= flow.steps.length ? { label: '모든 단계 완료', tone: 'mint' } : { label: `${flow.current + 1}단계 · ${flow.steps[flow.current].label}`, tone: flow.next.waiting ? 'gray' : 'red' }
        : row ? v7StepLabel(row) : cancelled ? { label: '취소된 예약', tone: 'gray' } : steps.every(s => s.done) ? { label: '모든 단계 완료', tone: 'mint' } : { label: m.steps.find(s => s.current)?.label || steps.find(s => !s.done)?.label || '', tone: 'red' };
    // 단계를 누르면 그 단계의 카드로 이동한다. 원본이 없는 모델 단계는 해당 업무를 연다.
    const stepTargets = row ? ['sec-doc', 'sec-pay', 'sec-asg', 'sec-pay', 'sec-plan'] : [];
    const onStep = (i: number) => flow ? goSec(flowStepSec[flow.steps[i]?.id] || 'sec-plan') : stepTargets[i] ? goSec(stepTargets[i]) : ASSIGN_ACTIONS.has(m.steps[i]?.id || '') ? goSec('sec-asg') : onAction(m.steps[i]?.id || 'payments');
    const RESEND = new Set(['notify-contract', 'quote-share']);
    const nextPanel = flow && (() => {
        const doneAll = flow.current >= flow.steps.length, now = flow.steps[flow.current], next = flow.next;
        const waiting = !doneAll && !!next.waiting;
        const sinceKey = waiting && next.since ? dayKey(next.since.at) : '';
        const waited = sinceKey ? Math.max(0, dayDiff(sinceKey, today)) : null;
        const depKey = next.departure || startKey || '';
        const depLeft = depKey ? dayDiff(today, depKey) : null;
        const urgent = waiting && waited !== null && waited >= 2;
        const resend = !!next.primary && RESEND.has(next.primary.action);
        const kicker = doneAll ? '모든 단계 완료' : waiting ? `고객 차례 · ${waited === null ? '응답을 기다리는 중' : waited === 0 ? '오늘 안내했어요' : `${waited}일째 응답 없음`}` : `내 차례 · ${flow.current + 1}단계 ${now?.label || ''}`;
        const detail = urgent && depLeft !== null && depLeft >= 0 ? `출발 ${depLeft === 0 ? '당일' : `${depLeft}일 전`}이에요. ${resend ? '오늘 다시 안내해 주세요.' : '고객에게 다시 연락해 보세요.'}` : next.detail;
        const showDep = depLeft !== null && depLeft >= 0;
        return <div className={cls('cw-next', doneAll ? 'is-done' : waiting ? 'is-waiting' : 'is-action', sinceKey && 'has-line')} role="group" aria-label="지금 할 일">
            <div className="cw-next-text">
                <span className="cw-next-kicker"><span className="cw-next-dot" aria-hidden="true" />{kicker}</span>
                <b className="cw-next-title">{next.title}</b>
                {detail && <span className="cw-next-detail">{detail}</span>}
            </div>
            {sinceKey && next.since && <div className="cw-wait" role="img" aria-label={`${mmdd(sinceKey)} ${next.since.label} · 오늘 ${waited}일째${showDep ? ` · ${mmdd(depKey)} 출발` : ''}`}>
                <ol className={cls('cw-wait-points', !showDep && 'is-two')} aria-hidden="true">
                    <li className="is-start"><span className="cw-wait-dot" /><span className="cw-wait-text"><b>{mmdd(sinceKey)}</b> {next.since.label}</span></li>
                    <li className="is-today"><span className="cw-wait-dot" /><span className="cw-wait-text"><b>오늘</b> {waited ? `${waited}일째` : '안내'}</span></li>
                    {showDep && <li className="is-end"><span className="cw-wait-dot" /><span className="cw-wait-text"><b>{mmdd(depKey)}</b> 출발</span></li>}
                </ol>
            </div>}
            {(next.primary || next.secondary) && <div className="cw-next-actions">
                {next.primary && <AdminButton fullWidth variant={waiting && resend ? 'danger' : 'primary'} disabled={busy} onClick={action(next.primary.action)}>{next.primary.label}</AdminButton>}
                {next.secondary && <AdminButton fullWidth variant="secondary" disabled={busy} onClick={action(next.secondary.action)}>{next.secondary.label}</AdminButton>}
            </div>}
        </div>;
    })();
    const progress = <section className="cw-card cw-progress" aria-label="진행 단계">
        <header className="cw-progress-head">
            <h2 className="cw-title">진행 단계</h2>{stepHead.label && pill(stepHead.label, toneOf(stepHead.tone))}<span className="cw-grow" />
            {!cancelled && <span className="cw-progress-count"><b>{steps.filter(s => s.done).length}</b> / {steps.length} 완료</span>}
        </header>
        <ol className={cls('cw-steps', cancelled && 'is-cancelled')}>
            {steps.map((s, i) => { const now = !cancelled && i === stepNow; return <li key={`${i}-${s.label}`} className={cls('cw-step', s.done ? 'is-done' : now ? 'is-now' : 'is-todo')}>
                <button type="button" className="adm-cw-step" aria-current={now ? 'true' : undefined} aria-label={`${i + 1}단계 ${s.label} · ${s.done ? '완료' : now ? flow?.next.waiting ? '기다리는 중' : '지금' : '대기'}`} onClick={() => onStep(i)}>
                    {now && <span className="cw-step-chev" aria-hidden="true"><IconChevronDown /></span>}
                    <span className="cw-step-dot" aria-hidden="true">{s.done ? <IconCheckThick /> : i + 1}</span>
                    <span className="cw-step-label">{s.label}</span>
                </button>
            </li>; })}
        </ol>
        {nextPanel}
    </section>;

    // ── 고객 정보: 연락처·이메일 등 세 줄, 펼치면 예약 상세·항공편·여행자·요청·예약번호
    const travelers = m.travelers;
    const missingTravelers = travelers && travelers.expected !== null && travelers.expected > travelers.registered ? travelers.expected - travelers.registered : 0;
    const confirmedFlights = m.flights?.filter(f => f.date && f.time && f.flight).length || 0;
    const travelerNames = travelers?.people.map(p => p.name).filter(Boolean) || [];
    /** 펼침 줄: 줄 전체가 눌리고 아래에 상세 상자가 열린다(각각 따로). 안의 버튼은 상자 안에 둔다(버튼 안에 버튼 금지). */
    const discRow = (key: string, label: string, summary: ReactNode, body: ReactNode) => { const open = !!st.infoOpen[key]; return <React.Fragment key={key}>
        <button type="button" className="adm-cw-disc" aria-expanded={open} aria-controls={`cw-info-${key}`} onClick={() => set(s => ({ infoOpen: { ...s.infoOpen, [key]: !open } }))}>
            <span className="cw-row-label">{label}</span><span className="cw-disc-sum">{summary}</span><span className="cw-chev" aria-hidden="true"><IconChevronDown /></span>
        </button>
        {open && <div id={`cw-info-${key}`} className="cw-disc-body">{body}</div>}
    </React.Fragment>; };
    const infoCard = <section id="sec-info" className="cw-card cw-info" aria-label="고객 정보">
        {head(IconPerson, '고객 정보', { right: <span className="cw-head-actions">
            {textBtn('복사', () => void copyInfo(), '고객 정보 복사')}
            <AdminTextButton size="sm" tone="assistive" aria-pressed={!maskOn} aria-label={maskOn ? '개인정보 보기' : '개인정보 가리기'} onClick={() => setMaskOn(!maskOn)}>{maskOn ? '보기' : '가리기'}</AdminTextButton>
            {textBtn('수정', action('edit-info'), '고객 정보 수정')}
        </span> })}
        {m.facts.slice(0, 3).map((f, i) => row2(f.label, f.value ? maskFact(f.label, f.value, maskOn) : <span className="is-empty">미입력</span>, `${f.label}-${i}`))}
        {st.infoMore && <div id="cw-info-more" className="cw-more">
            {m.facts.slice(3).map((f, i) => row2(f.label, f.value ? maskFact(f.label, f.value, maskOn) : <span className="is-empty">미입력</span>, `more-${f.label}-${i}`))}
            {/* 항공편(도착·출발편 상세)과 여행자(사람별 여권 정보)는 줄을 눌러 펼친다 */}
            {!!m.flights?.length && discRow('flights', '항공편', <>{confirmedFlights}/{m.flights.length}편 정보 등록{confirmedFlights < m.flights.length && <span className="cw-row-sub is-warn">미등록 {m.flights.length - confirmedFlights}편</span>}</>, <>
                {m.flights.map(fl => { const ok = !!(fl.date && fl.time && fl.flight); return <div key={fl.id} className="cw-flight">
                    <div className="cw-flight-head"><b>{fl.label}</b>{pill(ok ? '등록됨' : '미등록', ok ? 'accent' : 'danger')}</div>
                    <b className={fl.flight ? 'cw-flight-no' : 'cw-flight-no is-empty'}>{fl.flight || '편명 미등록'}</b>
                    {[{ k: '날짜', v: fl.date }, { k: fl.id === 'departure' ? '몽골 출발' : '몽골 도착', v: fl.time }, ...(fl.extra || []).map(x => ({ k: x.label, v: x.value }))]
                        .map((kv, i) => <div key={i} className="cw-kv"><span>{kv.k}</span><b>{kv.v || '미입력'}</b></div>)}
                </div>; })}
                {textBtn('항공편 수정', action('flights'), '항공편 수정')}
            </>)}
            {travelers && discRow('travelers', '여행자', <>{`${travelers.registered}${travelers.expected !== null ? `/${travelers.expected}` : ''}명 등록`}{missingTravelers > 0 && <span className="cw-row-sub is-warn">{missingTravelers}명 여권 정보 미제출</span>}</>, <>
                {travelers.people.map((person, i) => { const open = !!st.travelerOpen[person.id]; return <div key={person.id} className="cw-person">
                    <button type="button" className="adm-cw-person" aria-expanded={open} onClick={() => set(s => ({ travelerOpen: { ...s.travelerOpen, [person.id]: !open } }))}>
                        <span className="cw-person-no">{i + 1}</span><b className="cw-person-name">{person.name || '이름 미입력'}</b>
                        <span className="cw-person-kind">{person.details.find(d => /구분|성인|아동/.test(d.label))?.value || ''}</span>
                        <span className="cw-chev" aria-hidden="true"><IconChevronDown /></span>
                    </button>
                    {open && <div className="cw-person-body">{person.details.map((kv, k) => <div key={k} className="cw-kv"><span>{kv.label}</span><b>{kv.value ? maskFact(kv.label, kv.value, maskOn) : '미입력'}</b></div>)}</div>}
                </div>; })}
                {!travelers.people.length && <span className="is-empty">등록된 여행자가 없습니다.</span>}
                {textBtn('여행자 전체 상세보기', action('travelers'), '여행자 상세보기')}
            </>)}
            {row2('요청 사항', m.preferences?.length ? m.preferences.join(' · ') : <span className="is-empty">없음</span>, 'requests')}
            {m.bookingNumber && row2('예약번호', `#${m.bookingNumber}`, 'number')}
        </div>}
        {foldButton(st.infoMore, st.infoMore ? '고객 정보 접기' : '고객 정보 펼쳐 보기', 'cw-info-more', () => set(s => ({ infoMore: !s.infoMore })))}
    </section>;

    // ── 일정: 번호 원 · 날짜 · 제목 · 숙소 알약. 처음에는 3일까지, 펼치면 모든 일차와 일차별 상세(활동·식사·이동·편집)
    const dayKeyOf = (day: Model['days'][number]) => day.date && /^\d{4}-\d{2}-\d{2}$/.test(day.date) ? day.date
        : !day.date && startKey ? new Date(Date.parse(`${startKey}T00:00:00Z`) + (day.day - 1) * 864e5).toISOString().slice(0, 10) : '';
    const dayDate = (day: Model['days'][number]) => dayKeyOf(day) ? shortDate(dayKeyOf(day)) : day.date || '';
    const tripDays = startKey && endKey && endKey >= startKey ? dayDiff(startKey, endKey) + 1 : null;
    const tripLabel = period?.sch || (tripDays ? `${tripDays - 1}박 ${tripDays}일` : '');
    const extraDay = tripDays !== null && m.days.length > tripDays ? m.days[tripDays] : null;
    const planWarn = extraDay ? `예약 기간은 ${tripLabel}(${mmdd(startKey)}–${mmdd(endKey)})인데 ${extraDay.day}일차${dayKeyOf(extraDay) ? `(${mmdd(dayKeyOf(extraDay))})` : ''} 일정이 있어요. 확인해 주세요.`
        : tripDays !== null && m.days.length && m.days.length < tripDays ? `예약 기간은 ${tripLabel}인데 일정은 ${m.days.length}일차까지만 있어요. 확인해 주세요.` : '';
    const planCard = <section id="sec-plan" className="cw-card cw-plan" aria-label="일정">
        {head(IconMap, '일정', { meta: tripLabel || (m.days.length ? `${m.days.length}일` : ''), right: textBtn('일정표 편집', action('edit-itinerary'), '일정표 편집 열기') })}
        {(st.daysAll ? m.days : m.days.slice(0, PLAN_PREVIEW_DAYS)).map((day, i) => {
            const last = i === m.days.length - 1, night = row?.stays.find(s => s.day === day.day);
            const stayText = day.stayRequired === false || (last && !night) ? '숙박 없음' : night?.hotel ? `${night.hotel} · ${bookingStatusMeta(night.bookingStatus).label}` : day.stayAssigned && day.stay ? day.stay : '숙소 미정';
            const activities = day.activities?.length ? day.activities : scheduleTimeline(day.summary || '').map(s => ({ time: s.time, title: s.text }));
            return <React.Fragment key={day.id}>
                <div className="cw-day">
                    <span className="cw-day-no">{day.day}</span>
                    <span className="cw-day-date">{dayDate(day)}</span>
                    <b className="cw-day-title">{day.title || `${day.day}일차 일정 작성`}</b>
                    {pill(stayText, stayText === '숙소 미정' ? 'danger' : 'neutral')}
                </div>
                {st.daysAll && <div className="cw-day-detail">
                    {activities.length ? activities.map((it, k) => <span key={k} className="cw-day-act">{it.time && <b>{it.time}</b>} {it.title}{(it as { description?: string }).description ? ` — ${(it as { description?: string }).description}` : ''}</span>)
                        : <span className="is-empty">상세 일정이 입력되지 않았습니다.</span>}
                    <span className="cw-day-meta">식사 {day.meals || '미입력'} · 이동 {day.travel || '미입력'}</span>
                    <span className="cw-day-edit">{textBtn(`${day.day}일차 편집`, action('edit-itinerary', day.id))}</span>
                </div>}
            </React.Fragment>;
        })}
        {!m.days.length && <div className="cw-empty-row"><span>아직 작성된 일정이 없어요. 기존 견적·상품 일정을 불러와 편집할 수 있습니다.</span><AdminButton variant="secondary" size="sm" disabled={busy} onClick={action('edit-itinerary')}>일정 작성하기</AdminButton></div>}
        {planWarn && <p className="cw-warn">{planWarn}</p>}
        {m.days.length > 0 && foldButton(st.daysAll, st.daysAll ? '일정 접기' : m.days.length > PLAN_PREVIEW_DAYS ? `일정 ${m.days.length}일 모두 보기` : '일정 펼쳐 보기', undefined, () => set(s => ({ daysAll: !s.daysAll })))}
    </section>;

    // ── 결제: 총 매출 · 입금 % 막대 · 예약금/잔금 알약(누르면 입금 상태 메뉴) · 현금영수증 · 아래 다음 수납 버튼
    const pay = m.payment, depositPaid = row ? row.depositPaid : pay.depositPaid === true, balancePaid = row ? row.balancePaid : pay.balancePaid === true;
    const receipt = (ops?.receipt.status || 'not_requested') as ReceiptStatus;
    const receiptLate = !!row?.ended && ['pending', 'info_missing'].includes(receipt);
    const depositAmount = pay.deposit ?? 0, balanceAmount = pay.balance ?? 0;
    const paidPct = pay.total ? Math.min(100, Math.round(((depositPaid ? depositAmount : 0) + (balancePaid ? balanceAmount : 0)) / pay.total * 100)) : null;
    const payParts = payLocked ? [] : [!depositPaid && `예약금 ${v7Won(pay.deposit)} 입금 전이에요`, !balancePaid && `잔금 ${v7Won(pay.balance)}이 아직 들어오지 않았어요`, receiptLate && '현금영수증을 아직 발급하지 않았어요'].filter(Boolean) as string[];
    /** 아래 버튼: 다음 수납 기록. 맞춤 견적의 예약금은 ‘입금 확인’ 단계 버튼(서명 안내 알림)과 같은 동작, 그 밖에 연결이 없으면 결제 화면을 연다. */
    const markPaid = async (field: 'deposit' | 'final') => {
        if (field === 'deposit' && flow?.next.primary?.action === 'confirm-deposit') { onAction('confirm-deposit'); return; }
        if (!links?.onPayment || !row) { onAction('payments'); return; }
        const ok = await adminConfirm(field === 'deposit' ? `예약금 ${v7Won(row.source.deposit)} 입금을 확인할까요?${row.source.status === 'pending_payment' ? '\n예약이 확정되고 고객에게 입금 확인 메일이 발송됩니다.' : ''}` : `잔금 ${v7Won(pay.balance)} 수납을 기록할까요?`);
        if (ok && await links.onPayment(field, true)) flash(field === 'deposit' ? '예약금 입금 완료로 기록했어요' : '잔금 완납으로 기록했어요');
    };
    const payRow = (label: string, amount: string, control: ReactNode) => <div className="cw-row"><span className="cw-row-stack"><span className="cw-row-label is-small">{label}</span><b className="cw-num">{amount}</b></span>{control}</div>;
    const payCard = <section id="sec-pay" className="cw-card cw-quad" aria-label="결제">
        {head(IconCoupon, '결제', { state: payLocked ? { n: '–', msg: '예약 후 관리할 수 있어요', tone: 'muted' } : leftState(payParts, '결제를 모두 받았어요'), right: !payLocked && cardEdit('결제', { onClick: action('payments') }) })}
        <span className="cw-label">총 매출</span>
        <div className="cw-total"><span className="cw-total-value">{v7Won(pay.total)}</span>{!payLocked && paidPct !== null && <span className="cw-total-pct">입금 {paidPct}%</span>}</div>
        {!payLocked && paidPct !== null && <span className="cw-bar" role="img" aria-label={`입금 ${paidPct}% · 예약금 ${depositPaid ? '입금 완료' : '미입금'} · 잔금 ${balancePaid ? '완납' : '미수'}`}>
            {/* 막대 길이는 받은 금액 비율이라 실행 중에 정해진다 */}
            <span className="cw-bar-fill" style={{ width: `${paidPct}%` }} />
        </span>}
        {payRow('예약금', v7Won(pay.deposit), payLocked ? mutedNote('예약 후 관리할 수 있어요') : pill(depositPaid ? '입금 완료' : '미입금', depositPaid ? 'neutral' : 'danger', { onClick: e => paymentMenu(e, 'deposit') }))}
        {payRow('잔금', v7Won(pay.balance), payLocked ? mutedNote('예약 후 관리할 수 있어요') : pill(balancePaid ? '완납' : '미수', balancePaid ? 'neutral' : 'danger', { onClick: e => paymentMenu(e, 'final') }))}
        {row2('현금영수증', payLocked ? '–' : ops ? pill(RECEIPT_LABELS[receipt], receiptLate ? 'danger' : 'neutral', { onClick: e => opsMenu(e, 'receipt') }) : textBtn('결제 화면', action('payments')))}
        {!payLocked && <div className="cw-foot">
            {!depositPaid ? <AdminButton variant="weak" size="sm" fullWidth disabled={busy || saving} onClick={() => void markPaid('deposit')}>예약금 입금 확인</AdminButton>
                : !balancePaid ? <AdminButton variant="weak" size="sm" fullWidth disabled={busy || saving} onClick={() => void markPaid('final')}>잔금 수납 등록</AdminButton>
                    : <AdminButton variant="weak" size="sm" fullWidth disabled={busy} onClick={action('payments')}>결제 내역 보기</AdminButton>}
        </div>}
    </section>;

    // ── 배정: 결과만(배정은 ‘가이드·숙소·차량’·‘숙소 배정’ 메뉴에서). 아래 버튼은 첫 미배정 항목의 배정 화면으로 간다.
    const guideValue = row?.guide?.name || (m.assignments.find(a => a.id === 'guide')?.state === 'ready' ? m.assignments.find(a => a.id === 'guide')!.value : '');
    const vehicleValue = row?.vehicle?.type || (m.assignments.find(a => a.id === 'vehicle')?.state === 'ready' ? m.assignments.find(a => a.id === 'vehicle')!.value : '');
    const stayReady = row ? row.accDone : m.assignments.find(a => a.id === 'stay')?.state === 'ready';
    const nights = row?.stays || [];
    const stayText = row ? row.accN ? `${row.accC} / ${row.accN}박 확정` : '숙박 없음' : m.assignments.find(a => a.id === 'stay')?.value || '';
    const stayNames = [...new Set(nights.map(n => n.hotel).filter(Boolean))].join(' · ');
    const guidePhone = row?.guide?.phone ? maskFact('연락처', row.guide.phone, maskOn) : m.assignments.find(a => a.id === 'guide')?.detail || '';
    const vehicleSub = [item?.assignment.vehicle?.driver && `기사 ${item.assignment.vehicle.driver}`, row?.vehicle?.phone && maskFact('연락처', row.vehicle.phone, maskOn)].filter(Boolean).join(' · ')
        || m.assignments.find(a => a.id === 'vehicle')?.detail || '';
    const depSub = toDeparture !== null && toDeparture >= 0 ? `출발 ${toDeparture === 0 ? '당일' : `${toDeparture}일 전`}` : '';
    const missing = [!guideValue && '가이드', !vehicleValue && '차량', !stayReady && '숙소'].filter(Boolean) as string[];
    const asgRow = (Icon: CardIcon, label: string, done: boolean, value: string, sub: string) => <div className="cw-asg">
        <span className="cw-asg-icon"><Icon aria-hidden="true" /></span>
        <span className="cw-asg-text"><span className="cw-row-label is-small">{label}</span><b className={done ? 'cw-asg-value' : 'cw-asg-value is-warn'}>{value}</b>{sub && <span className="cw-row-sub">{sub}</span>}</span>
        {pill(done ? '완료' : '필요', done ? 'neutral' : 'danger')}
    </div>;
    const firstMissing = missing[0];
    const asgCard = <section id="sec-asg" className="cw-card cw-quad" aria-label="배정">
        {head(IconPersons, '배정', { state: asgLocked ? { n: '–', msg: '예약 후 배정할 수 있어요', tone: 'muted' } : leftState(missing.length ? [`${missing.join('·')}${hasFinal(missing.at(-1)!) ? '이' : '가'} 아직 배정되지 않았어요`] : [], '배정을 모두 마쳤어요', missing.length), right: !asgLocked && cardEdit('배정', { to: lodgeHref }) })}
        {asgLocked ? mutedNote('예약 후 배정할 수 있어요') : <>
            {asgRow(IconPerson, '가이드', !!guideValue, guideValue || '가이드 미배정', guideValue ? guidePhone : depSub)}
            {asgRow(IconCar, '차량', !!vehicleValue, vehicleValue || '차량 미배정', vehicleValue ? vehicleSub : depSub)}
            {asgRow(IconHotel, '숙소', !!stayReady, stayText || '숙소 미배정', stayNames || (stayReady ? '' : depSub))}
            {/* 박별 숙소: 기본 접힘, 펼치면 한 줄에 한 박(박 · 날짜 · 숙소 · 수배 상태). key는 박 번호 — 미배정 박은 rowIndex가 모두 -1이라 겹친다 */}
            {nights.length > 0 && <AdminTextButton size="sm" tone="assistive" className="cw-stay-toggle" aria-expanded={st.staysOpen} aria-controls="cw-stay-list"
                onClick={() => set(s => ({ staysOpen: !s.staysOpen }))} trailing={<IconChevronDown aria-hidden="true" />}>{st.staysOpen ? '박별 숙소 접기' : `박별 숙소 보기 · ${nights.length}박`}</AdminTextButton>}
            {nights.length > 0 && st.staysOpen && <ul id="cw-stay-list" className="cw-stay-list">
                {nights.map(n => <li key={n.day} className="cw-stay">
                    <b className="cw-stay-day">{n.day}박</b>
                    <span className="cw-stay-date">{n.date ? shortDate(n.date) : '날짜 확인'}</span>
                    <span className={n.hotel ? 'cw-stay-name' : 'cw-stay-name is-warn'}>{n.hotel || '숙소 미배정'}</span>
                    {n.hotel && <span className="cw-stay-status">{bookingStatusMeta(n.bookingStatus).label}</span>}
                </li>)}
            </ul>}
            <div className="cw-foot">
                <AdminButton variant="weak" size="sm" fullWidth disabled={busy} to={firstMissing && firstMissing !== '숙소' ? GUIDE_SCHEDULE_HREF : lodgeHref}>{firstMissing ? `${firstMissing} 배정` : '배정 화면 열기'}</AdminButton>
            </div>
        </>}
    </section>;

    // ── 분류: 2×2 칸(누르면 고르기 메뉴, 운영 정보가 없으면 편집 화면)
    const clsValues = ([['조인 여부', 'joining'], ['분류', 'category'], ['구분', 'serviceType'], ['항공', 'airfare']] as const).map(([label, key]) => {
        const value = ops ? key === 'joining' ? ops.joining === 'undecided' ? '' : JOINING_LABELS[ops.joining] : (ops[key] || '') as string : key === 'category' ? row?.category || '' : '';
        return { label, key, value };
    });
    const undecided = clsValues.filter(v => !v.value).map(v => v.label);
    const clsCard = <section id="sec-cls" className="cw-card cw-quad" aria-label="분류">
        {head(IconListCategory, '분류', { state: undecided.length ? { n: undecided.length, msg: `${undecided.length}개 미정 · ${undecided.join(', ')}${hasFinal(undecided.at(-1)!) ? '을' : '를'} 정해 주세요`, tone: 'muted' } : { n: <IconCheckThick aria-hidden="true" />, msg: '분류를 모두 정했어요', tone: 'done' },
            right: cardEdit('분류', { onClick: action('operations') }) })}
        <div className="cw-grid2">
            {clsValues.map(v => <button key={v.key} type="button" disabled={busy || saving} className="adm-cw-cell" aria-label={`${v.label} ${v.value || '미정'} · 바꾸기`} onClick={e => opsMenu(e, v.key)}>
                <span className="cw-row-label is-small">{v.label}</span><b className={v.value ? 'cw-cell-value' : 'cw-cell-value is-empty'}>{v.value || '미정'}</b>
            </button>)}
        </div>
        {!ops && <p className="cw-note">분류는 예약 편집기에서 관리해요.</p>}
        <div className="cw-foot"><AdminButton variant="weak" size="sm" fullWidth disabled={busy} onClick={action('operations')}>{ops ? '운영 정보 열기' : '예약 편집기 열기'}</AdminButton></div>
    </section>;

    // ── 서류: 문서 이름 + 상태 글자 + 수정·열기, 계약 동의 상자, 아래 공개·전달 관리
    const docAlert = (status?: string) => /실패|필요|미작성|미발송|전/.test(status || '');
    const agreeAlert = !!m.agreement && /전|필요|미|대기|요청/.test(m.agreement.label);
    const docParts = [...m.documents.filter(d => docAlert(d.status)).map(d => `${d.label} ${d.status}`), ...(agreeAlert ? [/요청됨|대기|기다/.test(m.agreement!.label) ? '계약서에 고객 서명을 기다리고 있어요' : `계약 동의 ${m.agreement!.label}`] : [])];
    const docCard = <section id="sec-doc" className="cw-card cw-quad" aria-label="서류">
        {head(IconWrite, '서류', { state: leftState(docParts, '서류 준비가 끝났어요'), right: cardEdit('서류', { onClick: action('documents') }) })}
        {m.documents.map(doc => <div key={doc.id} className="cw-doc">
            <span className="cw-row-stack"><b className="cw-doc-name">{doc.label}</b><span className={docAlert(doc.status) ? 'cw-doc-state is-warn' : 'cw-doc-state'}>{doc.status || doc.detail || '내용 확인'}</span></span>
            {doc.editAction && textBtn('수정', action(doc.editAction, doc.id), doc.editLabel || `${doc.label} 수정`)}
            {textBtn('열기', action(doc.action || doc.id, doc.id), `${doc.label} 열기`, doc.disabled)}
        </div>)}
        {m.agreement && <div className="cw-box">
            <b className={agreeAlert ? 'cw-box-title is-warn' : 'cw-box-title'}>계약 동의 · {m.agreement.label}</b>
            <span className="cw-box-sub">{m.agreement.name ? `서명자 ${m.agreement.name}` : m.agreement.at ? `${historyTime(m.agreement.at)} 서명 요청을 보냈어요` : '고객 서명 기록이 없어요'}</span>
        </div>}
        <div className="cw-foot"><AdminButton variant="weak" size="sm" fullWidth disabled={busy} onClick={action('documents')}>공개 · 전달 관리</AdminButton></div>
    </section>;

    // ── 알림 · 변경 이력: 고객 알림 카드 맨 아래 접힘(바로가기 ‘변경 이력’은 펼친 뒤 이동)
    const logs = [...(m.recentHistory || [])];
    const logSection = <details id="sec-log" className="cw-log">
        <summary className="cw-log-summary"><span className="cw-log-head">알림 · 변경 이력</span><span className="cw-log-count">{logs.length}건</span><IconChevronDown aria-hidden="true" /></summary>
        <div className="cw-log-body">
            {logs.map((lg, i) => { const tag = LOG_TAGS[lg.kind] || LOG_TAGS.change; return <div key={lg.id} className="v7-log-row">
                <span className="v7-log-rail"><span className={i === 0 ? 'v7-log-dot is-latest' : 'v7-log-dot'} /><span className="v7-log-line" /></span>
                <span className="v7-log-text">
                    <span className="v7-log-title-row"><V7Badge tone={tag.tone} size="sm">{tag.tag}</V7Badge><span className="v7-log-title">{lg.title}</span>{lg.internal && <span className="v7-log-internal">내부</span>}</span>
                    {lg.detail && <span className="v7-log-detail">{lg.detail}</span>}
                    <span className="v7-log-time">{historyTime(lg.at)}</span>
                </span>
            </div>; })}
            {!logs.length && <span className="cw-note">저장된 처리 이력이 없습니다.</span>}
            <AdminTextButton size="sm" className="cw-log-all" disabled={busy} onClick={action('history')} trailing={<IconChevronRight aria-hidden="true" />}>전체 이력</AdminTextButton>
        </div>
    </details>;
    const noticeCard = React.isValidElement(notificationActions) && typeof notificationActions.type !== 'string'
        ? React.cloneElement(notificationActions as React.ReactElement<{ extra?: ReactNode }>, { extra: logSection })
        : <section id="sec-notice" className="cw-card" aria-label="고객 알림">{head(IconBell, '고객 알림', { right: textBtn('전체 이력', action('history'), '발송 이력 보기') })}{notificationActions}{logSection}</section>;

    const element = <section ref={rootRef as React.RefObject<HTMLElement>} className="v7-root cw-overview cw-v8" aria-label="예약 상세" aria-busy={busy || saving}>
        <V7Styles />
        <AdminTextButton size="sm" tone="assistive" className="cw-back" disabled={busy} onClick={action('back')} leading={<IconChevronLeft aria-hidden="true" />}>{m.backLabel || '통합 예약 목록'}</AdminTextButton>
        {hero}
        {bookingSelector && <div className="cw-booking-switcher">{bookingSelector}</div>}
        {progress}
        {/* 구역 탭(밑줄): 누르면 해당 카드로 이동만 하고 업무를 실행하지 않는다. */}
        <nav aria-label="예약 상세 바로가기" className="v7-nav v7-tabs">
            {NAV.map(n => <button key={n.sid} type="button" className="adm-v7-tab v7-tab" aria-label={`${n.label} 위치로 이동`} aria-current={st.navSid === n.sid ? 'true' : undefined}
                onClick={() => { set({ navSid: n.sid }); goSec(n.sid); }}>{n.label}</button>)}
        </nav>
        {/* 두 카드는 각자 펼친다 — 둘 다 접혀 있을 때만 높이를 맞춘다 */}
        <div className={!st.infoMore && !st.daysAll ? 'cw-row2 is-even' : 'cw-row2'}>{infoCard}{planCard}</div>
        <div className="cw-row4">{payCard}{asgCard}{clsCard}{docCard}</div>
        <div className="cw-row2 is-even">
            <section id="sec-memo" className="cw-card cw-memo" aria-label="운영 메모">
                {head(IconWrite, '운영 메모')}
                {m.notes.length > 0 && <ol className="v7-notes">{m.notes.slice(-4).map(note => <li key={note.id} className="v7-note">
                    <div className="v7-note-meta"><b>{note.author || '관리자 메모'}</b>{note.at && <span>{note.at}</span>}</div>
                    <p className="v7-note-body">{note.body}</p>
                </li>)}</ol>}
                {noteComposer || <div className="cw-foot is-end"><AdminButton variant="weak" size="sm" disabled={busy} onClick={action('notes')}>메모 작성</AdminButton></div>}
            </section>
            {noticeCard}
        </div>
        <V7Menu menu={menu} onClose={closeMenu} />
        <V7Toast text={toast} />
    </section>;
    return { element, assignmentKey, loadItem, flash };
}
