import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchV7Assignments, saveV7Assignment, withGuide, withVehicle } from '../../../utils/reservationV7';
import { loadRegisteredAssignmentResources, type RegisteredGuide, type RegisteredVehicle } from '../../../utils/registeredAssignmentResources';
import { selectResourceGuide, selectResourceVehicle } from '../../../utils/accommodationResourceSelection';
import { guideOverlaps, overlapLabel } from '../../../utils/assignmentAvailability';
import { isUpcomingTour } from '../../../utils/accommodationSheet';
import { productCustomerHref, quoteCustomerHref } from '../../../utils/customerWorkspaceRoutes';
import type { AssignmentGuide } from '../../../utils/reservationAssignment';
import { printGuidePicket, saveGuidePicket, useGuidePicketImage, type GuidePicketInput } from '../../../utils/guidePicket';
import { confirmGuideConflict } from '../v7/guideMenuItems';
import {
    activeBooking, coversDay, dayDiff, guideRows, hasGuide, inMonth, laneBookings, matchesGuide, monthDays, monthWeeks,
    guideItineraryExtra, guideItineraryHref, shiftMonth, timelineWindow, vehicleClash, weekLanes, type TimelineRange,
} from './guideScheduleModel';
import { endOf, initial, md, nameOf, nights, norm, people, period, startOf, todayKey, type CarInfo, type GuideItem as Item, type GuideRow as Row } from './guideScheduleFormat';
import { GuideAssignList } from './GuideAssignList';
import { GuideDrawer } from './GuideDrawer';
import {
    AdminButton, AdminChip, AdminDialog, AdminIconButton, AdminSegmented, cx, IconCheck, IconChevronDown, IconChevronLeft, IconChevronRight, IconClose,
    IconDocument, IconDownload, IconPlus,
} from '../ui';
import './GuideSchedule.css';
import { adminConfirm, adminNotify } from '../ui/adminFeedback';

type Tone = 'cur' | 'mint' | 'red' | 'orange' | 'gray';
interface PopItem { key: string; name: string; sub: string; tag?: { label: string; tone: Tone }; muted?: boolean; onPick: (target: HTMLElement) => void }
interface Pop { x: number; y: number; title: string; items: PopItem[]; emptyText?: string; activeKey?: string }
type ViewKey = 'cal' | 'tbl';
type StateKey = 'ok' | 'none' | 'dup';
interface Stat { n: number; days: number; dupN: number; run: boolean; nx?: Item }

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const RETURN_TO = '/admin/quote-desk/resources?view=schedule';
// 가이드별 구분색 — 줄 순서대로 고정. 색 값(배경 · 글자 · 선)은 GuideSchedule.css의 .adm-gs-tone-c0~c6(민트 + --adm-tag-*, Seed 색 단계)이 정한다.
// 주황은 '미배정' 상태색(.adm-gs-tone-none)과 헷갈리지 않게 쓰지 않는다. row.color[0]이 색 이름이다.
const PALETTE = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'].map(tone => [tone]);
const NONE_COLOR = ['none'];
const toneCls = (color: string[]) => `adm-gs-tone-${color[0] || 'none'}`;
// 막대 색: 중복 빨강 · 미배정 주황 · 배정 민트 (값은 CSS .adm-gs-st-*)
const stateCls = (dup: boolean, none: boolean) => dup ? 'adm-gs-st-dup' : none ? 'adm-gs-st-none' : 'adm-gs-st-ok';
// 월간 달력 칸·더보기의 열(1~7)
const colCls = (n: number) => `is-col${n}`;
const rowKeyOf = (guide: { id?: string; name?: string }) => guide.id ? `id:${guide.id}` : `name:${norm(guide.name)}`;
const customerHref = (b: Item, action?: string) => {
    const href = b.source === 'quote_booking' ? quoteCustomerHref(b.id, RETURN_TO) : productCustomerHref(b.id, RETURN_TO);
    return action ? `${href}&action=${encodeURIComponent(action)}` : href;
};
/** 버튼 아래(공간이 없으면 위)에 여는 고정 위치 팝오버 좌표 — 디자인 v4와 같은 계산 */
const popAt = (target: HTMLElement, width = 320, height = 260) => {
    const r = target.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    return { x: Math.max(12, Math.min(r.left, vw - width - 12)), y: r.bottom + 6 > vh - height ? Math.max(12, r.top - height) : r.bottom + 6 };
};
/** 가이드 전달용 일정표를 새 창으로 연다. sessionStorage(견적 관리자 토큰)가 이어지도록 opener를 끊지 않는다. */
const openGuideItinerary = (b: Item) => {
    if (b.source !== 'quote_booking') { try { localStorage.setItem(`guideDoc:${b.id}`, JSON.stringify(guideItineraryExtra(b))); } catch { /* 저장소가 막혀도 기본 일정표는 열린다 */ } }
    if (!window.open(guideItineraryHref(b), '_blank')) adminNotify('팝업이 차단되었습니다. 브라우저에서 팝업을 허용한 뒤 다시 눌러 주세요.');
};

/** 가이드 얼굴(사진이 없으면 첫 글자). 크기 20·28·34, 테두리 paper(흰 바탕 위 구분) · tone(가이드 색) · dup(겹침 빨강) */
function Avatar({ name, img, size, color, ring }: { name: string; img?: string; size: 20 | 28 | 34; color: string[]; ring?: 'paper' | 'tone' | 'dup' }) {
    const [broken, setBroken] = useState(false);
    return (
        <span className={cx('adm-gs-av', `is-s${size}`, toneCls(color), ring && `is-ring-${ring}`)}>
            {img && !broken ? <img src={img} alt="" onError={() => setBroken(true)} /> : initial(name)}
        </span>
    );
}

/**
 * 가이드 배정 현황(디자인: Admin Dashboard redesign · 05-2 배정 자원 - 가이드 배정 현황 v4).
 * 달력 보기(월간 · 가이드별 타임라인 + 왼쪽 가이드 패널)와 가이드 배정하기(목록) 보기가 있다.
 * 가이드·차량 저장은 기존 배정 API(버전 확인 + 서버 가이드 중복 확인)를 그대로 쓰고, 등록 가이드·차량은 등록 정보 목록을 읽는다.
 */
export function GuideSchedule({ accountId }: { accountId: string }) {
    const [items, setItems] = useState<Item[]>([]);
    const [guides, setGuides] = useState<RegisteredGuide[]>([]);
    const [vehicles, setVehicles] = useState<RegisteredVehicle[]>([]);
    const [loading, setLoading] = useState(true);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [toast, setToast] = useState('');
    const [savingKey, setSavingKey] = useState('');
    const [month, setMonth] = useState(() => todayKey().slice(0, 7));
    const [view, setView] = useState<ViewKey>('cal');
    const [sub, setSub] = useState<'month' | 'line'>('month');
    const [range, setRange] = useState<TimelineRange>('w2');
    const [rangeStart, setRangeStart] = useState<number | null>(null);
    const [stateFilter, setStateFilter] = useState<StateKey | null>(null);
    const [focusG, setFocusG] = useState<string | null>(null);
    const [pickSel, setPickSel] = useState<string | null>(null);
    const [pickOpen, setPickOpen] = useState(false);
    const [selDay, setSelDay] = useState<string | null>(null);
    const [pop, setPop] = useState<Pop | null>(null);
    const [drawer, setDrawer] = useState<string | null>(null);
    const [picket, setPicket] = useState<string | null>(null);
    const [tip, setTip] = useState<{ key: string; x: number; y: number; top: number } | null>(null);
    const mounted = useRef(true), generation = useRef(0), toastTimer = useRef<number | undefined>(undefined);
    // 개발 모드에서는 화면이 두 번 붙었다 떨어지므로 붙을 때마다 다시 켠다.
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; window.clearTimeout(toastTimer.current); }; }, []);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (pop) setPop(null); else if (picket) setPicket(null); else if (drawer) setDrawer(null); else if (pickOpen) setPickOpen(false); };
        window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
    }, [pop, picket, drawer, pickOpen]);
    const flash = (text: string) => { window.clearTimeout(toastTimer.current); setToast(text); toastTimer.current = window.setTimeout(() => { if (mounted.current) setToast(''); }, 2200); };

    // 예약은 받는 대로 먼저 그리고, 등록 가이드·차량 목록은 따로 채운다(느리거나 실패해도 예약에 적힌 가이드로 보여 준다).
    const load = useCallback(async () => {
        const current = ++generation.current, controller = new AbortController();
        const live = () => mounted.current && current === generation.current;
        setLoading(true); setWarnings([]);
        const bookings = fetchV7Assignments(controller.signal).then(result => {
            if (!live()) return;
            setItems(result.items as Item[]);
            if (result.warnings.length) setWarnings(prev => [...prev, ...result.warnings]);
        }).catch(() => { if (live()) setWarnings(prev => [...prev, '예약 배정을 불러오지 못했습니다. 잠시 후 새로고침해 주세요.']); })
            .finally(() => { if (live()) setLoading(false); });
        const resources = loadRegisteredAssignmentResources({ accountId, signal: controller.signal, isCurrent: live }).then(result => {
            if (!live()) return;
            setGuides(result.guides); setVehicles(result.vehicles);
            if (result.warnings.length) setWarnings(prev => [...prev, ...result.warnings]);
        }).catch(() => { if (live()) setWarnings(prev => [...prev, '등록 가이드·차량을 불러오지 못했습니다. 예약에 적힌 가이드만 보여 줍니다.']); });
        await Promise.allSettled([bookings, resources]);
    }, [accountId]);
    useEffect(() => { void load(); }, [load]);

    const today = todayKey();
    const days = useMemo(() => monthDays(month), [month]);
    const active = useMemo(() => items.filter(activeBooking), [items]);
    // 가이드 줄: 등록 가이드 전원 + 예약에만 있는 이름. 색은 줄 순서대로 고정한다.
    const rows = useMemo<Row[]>(() => guideRows(guides.map(g => ({ id: g.id, name: g.name })), items).map((row, i) => ({
        key: rowKeyOf(row.guide), guide: row.guide, registered: row.registered, bookings: row.bookings as Item[],
        resource: row.registered ? guides.find(g => g.id === row.guide.id) : undefined, color: PALETTE[i % PALETTE.length],
    })), [guides, items]);
    const rowOf = useCallback((b: Item) => hasGuide(b) ? rows.find(r => matchesGuide(b.assignment?.guide, r.guide)) : undefined, [rows]);
    const dup = useMemo(() => new Set(active.filter(b => hasGuide(b) && guideOverlaps(active, b.assignment!.guide!, b).some(x => x.kind === 'overlap')).map(b => b.key)), [active]);
    const carDup = useMemo(() => new Set(active.filter(b => vehicleClash(active, b.assignment?.vehicle?.type || '', b)).map(b => b.key)), [active]);
    const stateOf = (b: Item): StateKey => dup.has(b.key) ? 'dup' : hasGuide(b) ? 'ok' : 'none';
    const inM = useMemo(() => active.filter(b => inMonth(b, days)), [active, days]);
    // 가이드별 이번 달 팀 수·근무일·겹침·진행 중·다음 출발
    const stats = useMemo(() => {
        const first = days[0], last = days[days.length - 1];
        const daysInMonth = (b: Item) => { const a = startOf(b) < first ? first : startOf(b), z = endOf(b) > last ? last : endOf(b); return a > z ? 0 : dayDiff(a, z) + 1; };
        return Object.fromEntries(rows.map(r => {
            const mine = r.bookings.filter(b => inMonth(b, days));
            const nx = r.bookings.filter(b => startOf(b) > today).sort((a, b) => startOf(a).localeCompare(startOf(b)))[0];
            return [r.key, { n: mine.length, days: mine.reduce((n, b) => n + daysInMonth(b), 0), dupN: r.bookings.filter(b => dup.has(b.key)).length, run: r.bookings.some(b => coversDay(b, today)), nx } as Stat];
        }));
    }, [rows, days, dup, today]);
    const visible = (b: Item) => (!focusG || rowOf(b)?.key === focusG) && (!stateFilter || stateOf(b) === stateFilter);
    const vehicleOf = (b: Item) => { const name = norm(b.assignment?.vehicle?.type); return name ? vehicles.find(v => norm(v.name) === name) : undefined; };
    /** 차종·차량 번호·기사 이름·연락처 — 예약에 저장된 값이 우선이고, 비어 있으면 등록 정보 차량의 기사로 보충한다. */
    const carInfo = (b: Item): CarInfo => {
        const v = b.assignment?.vehicle, reg = vehicleOf(b);
        return { type: String(v?.type || '').trim(), plate: String(reg?.snapshot.plate || '').trim(),
            driver: String(v?.driver || reg?.driver || '').trim(), phone: String(v?.phone || reg?.phone || '').trim() };
    };
    const openItinerary = (b: Item) => {
        const car = carInfo(b);
        openGuideItinerary(car.type ? { ...b, assignment: { ...b.assignment!, vehicle: { ...b.assignment!.vehicle, type: car.type, phone: car.phone, driver: car.driver } } } : b);
    };
    const guideImg = (b: Item) => rowOf(b)?.resource?.image || String(b.assignment?.guide?.image || '');
    const colorOf = (b: Item) => rowOf(b)?.color || NONE_COLOR;

    // ── 저장 ───────────────────────────────────────────
    // 가이드 배정. 팝오버에서 겹침을 이미 확인했으면 서버 중복 확인을 다시 묻지 않는다.
    const assign = async (booking: Item, guide: AssignmentGuide | null, label: string, confirmed = false): Promise<void> => {
        if (savingKey) return;
        setPop(null); setTip(null); setSavingKey(booking.key);
        let retry = false;
        try {
            const saved = await saveV7Assignment(booking, withGuide(booking, guide || { id: '', name: '', phone: '' }), { allowGuideConflict: confirmed }) as Item;
            if (!mounted.current) return;
            setItems(prev => prev.map(x => x.key === saved.key ? { ...x, ...saved } : x));
            flash(guide ? `${nameOf(booking)} · ${label} 배정했어요` : `${nameOf(booking)} · 가이드 배정을 해제했어요`);
        } catch (error) {
            const e = error as { message?: string };
            if (mounted.current && !confirmed && await confirmGuideConflict(e)) retry = true;
            else if (mounted.current) { flash(e?.message || '배정을 저장하지 못했습니다.'); void load(); }
        } finally { if (mounted.current) setSavingKey(''); }
        if (retry) return assign(booking, guide, label, true);
    };
    // 가이드 값: 등록 가이드면 등록 정보를 복사하고, 예약에만 있는 이름이면 그 예약의 가이드 정보를 그대로 쓴다.
    const guideValue = (row: Row, booking: Item): AssignmentGuide => row.resource ? selectResourceGuide(booking.assignment?.guide, row.resource)
        : { ...(row.bookings.find(b => hasGuide(b))?.assignment?.guide || { name: row.guide.name }) };
    const assignRow = async (booking: Item, row: Row) => {
        const overlap = guideOverlaps(active, row.guide, booking).find(x => x.kind === 'overlap');
        if (overlap && !await adminConfirm(`${row.guide.name} 가이드는 같은 기간에 ${overlapLabel(overlap.booking)} 일정이 있습니다. 그래도 배정할까요?`)) return;
        void assign(booking, guideValue(row, booking), row.guide.name, !!overlap);
    };
    const saveVehicle = async (booking: Item, vehicle: RegisteredVehicle | null) => {
        if (savingKey) return;
        if (vehicle) {
            const clash = vehicleClash(active, vehicle.name, booking);
            if (clash && !await adminConfirm(`${vehicle.name} 차량은 같은 기간에 ${overlapLabel(clash)} 일정에 배정돼 있습니다. 그래도 배정할까요?`)) return;
        }
        setPop(null); setSavingKey(booking.key);
        try {
            const saved = await saveV7Assignment(booking, withVehicle(booking, vehicle ? selectResourceVehicle(booking.assignment?.vehicle, vehicle) : { type: '', phone: '' })) as Item;
            if (!mounted.current) return;
            setItems(prev => prev.map(x => x.key === saved.key ? { ...x, ...saved } : x));
            flash(vehicle ? `${nameOf(booking)} · ${vehicle.name} 차량을 배정했어요` : `${nameOf(booking)} · 차량 배정을 해제했어요`);
        } catch (error) {
            const e = error as { message?: string };
            if (mounted.current) { flash(e?.message || '차량 배정을 저장하지 못했습니다.'); void load(); }
        } finally { if (mounted.current) setSavingKey(''); }
    };

    // ── 팝오버 ─────────────────────────────────────────
    // 막대·가이드 버튼: 현재 → 가능 → 교대 → 겹침 순서의 가이드 목록
    const openGuidePop = (target: HTMLElement, booking: Item) => {
        setTip(null);
        const current = rowOf(booking);
        const choices = rows.filter(r => r.registered || r.key === current?.key);
        const ranked = choices.map(row => {
            const found = guideOverlaps(active, row.guide, booking);
            const overlap = found.find(x => x.kind === 'overlap'), handover = found.find(x => x.kind === 'handover');
            const cur = row.key === current?.key;
            return { row, overlap, handover, cur, rank: cur ? -1 : overlap ? 2 : handover ? 1 : 0 };
        }).sort((a, b) => a.rank - b.rank || a.row.guide.name.localeCompare(b.row.guide.name, 'ko-KR'));
        const list: PopItem[] = ranked.map(({ row, overlap, handover, cur }) => ({
            key: row.key, name: row.guide.name,
            sub: overlap ? `겹침 · ${overlapLabel(overlap.booking).replace('~', '→')}` : handover ? `같은 날 교대 · ${overlapLabel(handover.booking).replace('~', '→')}` : row.registered ? '등록된 가이드' : '등록 안 된 가이드',
            tag: cur ? { label: '현재', tone: 'cur' } : overlap ? { label: '겹침', tone: 'red' } : handover ? { label: '교대', tone: 'gray' } : { label: '가능', tone: 'mint' },
            onPick: () => { if (cur) setPop(null); else assignRow(booking, row); },
        }));
        if (hasGuide(booking)) list.push({ key: 'none', name: '배정 해제', sub: '미배정 투어로 옮겨요', muted: true, onPick: () => void assign(booking, null, '') });
        list.push({ key: 'open', name: '고객 화면 열기', sub: `${nameOf(booking)} · ${nights(booking)}`, muted: true, onPick: () => { window.location.assign(customerHref(booking)); } });
        setPop({ ...popAt(target), title: `${nameOf(booking)} · ${period(booking)} 가이드`, items: list, activeKey: booking.key,
            emptyText: guides.length ? undefined : '등록된 가이드가 없어요. 등록 정보에서 가이드를 먼저 추가해 주세요.' });
    };
    const openCarPop = (target: HTMLElement, booking: Item) => {
        const cur = vehicleOf(booking);
        const list: PopItem[] = vehicles.map(v => {
            const clash = vehicleClash(active, v.name, booking), on = cur === v;
            const plate = String(v.snapshot.plate || '');
            return { key: v.name, name: plate ? `${v.name} · ${plate}` : v.name,
                sub: clash ? `겹침 · ${overlapLabel(clash).replace('~', '→')}` : v.driver || v.phone ? `기사 ${[v.driver, v.phone].filter(Boolean).join(' · ')}` : '기사 정보 없음',
                tag: on ? { label: '현재', tone: 'cur' as Tone } : clash ? { label: '겹침', tone: 'red' as Tone } : { label: '가능', tone: 'mint' as Tone },
                onPick: () => { if (on) setPop(null); else void saveVehicle(booking, v); } };
        });
        if (booking.assignment?.vehicle?.type) list.push({ key: 'none', name: '배정 해제', sub: '차량 없이 둬요', muted: true, onPick: () => void saveVehicle(booking, null) });
        setPop({ ...popAt(target), title: `${nameOf(booking)} · ${period(booking)} 차량`, items: list, activeKey: booking.key,
            emptyText: vehicles.length ? undefined : '등록된 차량이 없어요. 등록 정보에서 차량을 먼저 추가해 주세요.' });
    };
    const openMorePop = (target: HTMLElement, booking: Item) => {
        setPop({ ...popAt(target, 260), title: nameOf(booking), activeKey: booking.key, items: [
            { key: 'open', name: '고객 화면 열기', sub: '예약 상세 · 문서 · 결제', onPick: () => { window.location.assign(customerHref(booking)); } },
            { key: 'itin', name: '일정표 편집', sub: '고객 화면의 일정표 편집을 열어요', onPick: () => { window.location.assign(customerHref(booking, 'edit-itinerary')); } },
            { key: 'picket', name: '가이드 피켓', sub: '공항 미팅용 피켓 인쇄', onPick: () => { setPop(null); setPicket(booking.key); } },
            { key: 'g-off', name: '가이드 배정 해제', sub: booking.assignment?.guide?.name || '배정된 가이드 없음', muted: true, onPick: () => { if (hasGuide(booking)) void assign(booking, null, ''); else setPop(null); } },
            { key: 'c-off', name: '차량 배정 해제', sub: booking.assignment?.vehicle?.type || '배정된 차량 없음', muted: true, onPick: () => { if (booking.assignment?.vehicle?.type) void saveVehicle(booking, null); else setPop(null); } },
        ] });
    };
    // 월간 날짜 칸: 그날 진행하는 투어(보이는 것만). 누르면 그 투어의 가이드 목록
    const openDayList = (target: HTMLElement, day: string) => {
        setSelDay(day); setTip(null);
        const on = active.filter(b => coversDay(b, day) && visible(b)).sort((a, b) => startOf(a).localeCompare(startOf(b)));
        setPop({ ...popAt(target), title: `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일 투어 ${on.length}팀`, emptyText: '이날 진행하는 투어가 없어요',
            items: on.map(b => { const d = dup.has(b.key); return { key: b.key, name: nameOf(b), sub: `${b.assignment?.guide?.name || '가이드 미배정'} · ${period(b)} · ${people(b)}`,
                tag: d ? { label: '중복', tone: 'red' } : hasGuide(b) ? { label: '배정', tone: 'mint' } : { label: '미배정', tone: 'orange' }, onPick: el => openGuidePop(el, b) }; }) });
    };
    // 타임라인 빈 칸: 그날 진행하는 미배정 투어를 이 가이드에게
    const openDayPop = (target: HTMLElement, row: Row, day: string) => {
        const list: PopItem[] = active.filter(b => !hasGuide(b) && coversDay(b, day)).map(b => {
            const found = guideOverlaps(active, row.guide, b), overlap = found.find(x => x.kind === 'overlap'), handover = found.find(x => x.kind === 'handover');
            return { key: b.key, name: nameOf(b), sub: `${period(b)} · ${nights(b)} · ${people(b)}`,
                tag: overlap ? { label: '겹침', tone: 'red' } : handover ? { label: '교대', tone: 'gray' } : { label: '배정', tone: 'mint' }, onPick: () => assignRow(b, row) };
        });
        setPop({ ...popAt(target), title: `${row.guide.name} · ${md(day)} 배정할 투어`, items: list, emptyText: '이날 진행하는 미배정 투어가 없어요' });
    };
    // 가이드 패널 ‘이 가이드에게 배정’: 오늘 이후 미배정 투어(겹치는 투어는 뒤로)
    const candidates = (row: Row) => active.filter(b => !hasGuide(b) && endOf(b) >= today)
        .map(b => ({ b, clash: guideOverlaps(active, row.guide, b).find(x => x.kind === 'overlap') }))
        .sort((p, q) => (p.clash ? 1 : 0) - (q.clash ? 1 : 0) || startOf(p.b).localeCompare(startOf(q.b)));
    const openAssignPop = (target: HTMLElement, row: Row) => {
        setPop({ ...popAt(target), title: `${row.guide.name} · 배정할 미배정 투어`, emptyText: '배정을 기다리는 투어가 없어요',
            items: candidates(row).map(({ b, clash }) => ({ key: b.key, name: nameOf(b), sub: `${period(b)} · ${nights(b)} · ${people(b)}${clash ? ` · ${nameOf(clash.booking as Item)}와 겹침` : ''}`,
                tag: clash ? { label: '겹침', tone: 'red' } : { label: '배정', tone: 'mint' }, onPick: () => assignRow(b, row) })) });
    };
    const barTip = (e: React.MouseEvent<HTMLElement>, b: Item) => { const r = e.currentTarget.getBoundingClientRect(); setTip({ key: b.key, x: r.left, y: r.bottom, top: r.top }); };

    // ── 공통 계산 ──────────────────────────────────────
    const unM = inM.filter(b => !hasGuide(b));
    const upcoming = useMemo(() => active.filter(b => isUpcomingTour(b, today)).sort((a, b) => startOf(a).localeCompare(startOf(b))), [active, today]);
    const chips = ([['배정', inM.length - unM.length, '팀', 'ok'], ['미배정', unM.length, '팀', 'none'], ['중복', inM.filter(b => dup.has(b.key)).length, '건', 'dup']] as const).map(([label, n, unit, key]) => ({
        label, n, unit, key, on: stateFilter === key, go: () => { if (!n && stateFilter !== key) return; setStateFilter(stateFilter === key ? null : key); setPop(null); } }));
    const weeks = useMemo(() => monthWeeks(month), [month]);
    const vis = active.filter(visible);
    const monthLabel = `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
    const goMonth = (delta: number) => { setMonth(m => shiftMonth(m, delta)); setRangeStart(null); setPop(null); };
    const resetAll = () => { setFocusG(null); setStateFilter(null); setPickSel(null); setPickOpen(false); };
    const filtered = !!(focusG || stateFilter || pickSel);
    const selRow = rows.find(r => r.key === pickSel);
    const drawerRow = rows.find(r => r.key === drawer);
    const picketBooking = items.find(b => b.key === picket);

    // ── 왼쪽 패널 ──────────────────────────────────────
    const miniCal = (
        <div className="adm-gs-mini">
            <div className="adm-gs-mini-head"><b>{monthLabel}</b>
                <AdminIconButton label="이전 달" size="sm" onClick={() => goMonth(-1)}><IconChevronLeft aria-hidden="true" /></AdminIconButton>
                <AdminIconButton label="다음 달" size="sm" onClick={() => goMonth(1)}><IconChevronRight aria-hidden="true" /></AdminIconButton>
            </div>
            <div className="adm-gs-mini-grid">
                {WD.map((w, i) => <span key={w} className={`adm-gs-mini-wd${i === 0 ? ' is-sun' : ''}`}>{w}</span>)}
                {weeks.flat().map(day => {
                    const other = day.slice(0, 7) !== month, has = !other && vis.some(b => coversDay(b, day));
                    // 날짜 칸(작은 달력의 셀) — 생 버튼 + adm- 클래스, 모양은 GuideSchedule.css
                    return <button key={day} type="button" className={`adm-gs-mini-day${other ? ' is-other' : ''}${has ? ' has-tour' : ''}${day === today ? ' is-today' : ''}${selDay === day ? ' is-sel' : ''}`}
                        aria-label={day} aria-pressed={selDay === day} onClick={() => setSelDay(selDay === day ? null : day)}>{Number(day.slice(8))}</button>;
                })}
            </div>
        </div>
    );
    const selStat = selRow ? stats[selRow.key] : undefined;
    const selDupLines = selRow ? selRow.bookings.flatMap((p, i) => selRow.bookings.slice(i + 1).filter(q => startOf(p) < endOf(q) && startOf(q) < endOf(p)).map(q => {
        const a = startOf(p) > startOf(q) ? startOf(p) : startOf(q), z = endOf(p) < endOf(q) ? endOf(p) : endOf(q);
        return `${md(a)}~${md(z)} · ${nameOf(p)} / ${nameOf(q)}`;
    })) : [];
    const selUps = selRow ? selRow.bookings.filter(b => endOf(b) >= today).sort((a, b) => startOf(a).localeCompare(startOf(b))) : [];
    const selCand = selRow ? candidates(selRow).filter(x => !x.clash).length : 0;
    const picker = (
        <div className="adm-gs-side-sec">
            <div className="adm-gs-side-title"><b>가이드</b><span>{rows.length}명</span>
                {filtered && <AdminButton variant="weak" size="sm" className="adm-gs-reset" onClick={resetAll}>전체 보기</AdminButton>}</div>
            <div className="adm-gs-picker">
                {/* 가이드 고르기 머리(얼굴 · 이름 · 해제 · 펼침) — 안에 해제 단추가 있어 부품 대신 생 버튼 + adm- 클래스 */}
                <button type="button" className="adm-gs-picker-btn" aria-expanded={pickOpen} onClick={() => setPickOpen(v => !v)}>
                    {selRow && <Avatar name={selRow.guide.name} img={selRow.resource?.image} size={28} color={selRow.color} />}
                    <span className={`adm-gs-picker-label${selRow ? '' : ' is-empty'}`}>{selRow ? selRow.guide.name : `가이드 선택 (${rows.length}명)`}</span>
                    {selRow && <span role="button" tabIndex={0} aria-label="선택 해제" title="선택 해제" className="adm-gs-picker-x"
                        onClick={e => { e.stopPropagation(); resetAll(); }} onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); resetAll(); } }}><IconClose aria-hidden="true" /></span>}
                    <IconChevronDown className={`adm-gs-caret${pickOpen ? ' is-open' : ''}`} aria-hidden="true" />
                </button>
                {pickOpen && <div className="adm-gs-picker-list">
                    {rows.length === 0 && <span className="adm-gs-picker-empty">등록된 가이드가 없어요.</span>}
                    {rows.map(r => {
                        const st = stats[r.key], on = pickSel === r.key;
                        return <button key={r.key} type="button" className={`adm-gs-picker-opt${on ? ' is-on' : ''}`} onClick={() => { setPickSel(r.key); setFocusG(r.key); setPickOpen(false); setPop(null); }}>
                            <Avatar name={r.guide.name} img={r.resource?.image} size={28} color={r.color} />
                            <span className="adm-gs-picker-text"><b>{r.guide.name}</b><span>{st.run ? '투어 진행 중' : st.n ? `이번 달 ${st.n}팀 · ${st.days}일` : '이번 달 여유'}{r.registered ? '' : ' · 미등록'}</span></span>
                            {st.dupN > 0 && <span className="adm-gs-badge-red">중복 {st.dupN}</span>}
                            {on && <span className="adm-gs-on-text">선택됨</span>}
                        </button>;
                    })}
                </div>}
                {selRow && selStat && !pickOpen && <div className="adm-gs-picker-card">
                    <div className="adm-gs-kpis">
                        {([['이번 달', `${selStat.n}팀`, false], ['다음 출발', selStat.nx ? md(startOf(selStat.nx)) : '—', false], ['겹침', `${selStat.dupN}건`, selStat.dupN > 0]] as const).map(([l, v, warn]) =>
                            <span key={l} className={`adm-gs-kpi${warn ? ' is-warn' : ''}`}><span>{l}</span><b>{v}</b></span>)}
                    </div>
                    {/* 막대 길이(이번 달 근무일 비율)만 실행 중 계산값이라 인라인으로 둔다 */}
                    <span className={cx('adm-gs-util', toneCls(selRow.color))}><span style={{ width: `${Math.min(100, Math.round(selStat.days / days.length * 100))}%` }} /></span>
                    {selDupLines.length > 0 && <span className="adm-gs-dup-box"><b>일정 겹침</b>{selDupLines.map(t => <span key={t}>{t}</span>)}</span>}
                    <div className="adm-gs-ups">
                        <span className="adm-gs-ups-title">다가오는 배정 {selUps.length ? `${selUps.length}건` : ''}</span>
                        {selUps.slice(0, 3).map(b => {
                            const d = dup.has(b.key), run = coversDay(b, today);
                            return <button key={b.key} type="button" className="adm-gs-up" title={`${nameOf(b)} · ${period(b)} · ${nights(b)}`} onClick={() => { setView('cal'); setSub('month'); setMonth(startOf(b).slice(0, 7)); setSelDay(startOf(b)); setFocusG(selRow.key); setPop(null); }}>
                                <b>{md(startOf(b))}</b><span>{nameOf(b)} · {people(b)}</span>
                                <span className="adm-gs-tag" data-tone={d ? 'red' : run ? 'cur' : 'mint'}>{d ? '중복' : run ? '진행 중' : '예정'}</span>
                            </button>;
                        })}
                        {!selUps.length && <span className="adm-gs-ups-empty">예정된 배정이 없어요.</span>}
                    </div>
                    <AdminButton variant="primary" fullWidth onClick={e => openAssignPop(e.currentTarget, selRow)}
                        trailing={selCand > 0 && <span className="adm-gs-count">{selCand}</span>}>이 가이드에게 배정</AdminButton>
                    <AdminButton variant="secondary" fullWidth onClick={() => { setDrawer(selRow.key); setPop(null); }}>전체 일정 · 배정 내역 보기</AdminButton>
                </div>}
            </div>
        </div>
    );

    // ── 월간 달력 ──────────────────────────────────────
    const monthGrid = (
        <div className="adm-gs-card">
            <div className="adm-gs-mhead">{WD.map((w, i) => <span key={w} className={i === 0 ? 'is-sun' : i === 6 ? 'is-sat' : ''}>{w}</span>)}</div>
            {weeks.map(week => {
                const { bars, more } = weekLanes(vis, week, 3);
                return (
                    <div key={week[0]} className="adm-gs-week">
                        {/* 날짜 칸·막대·더보기는 격자 셀이라 생 버튼 + adm- 클래스. 막대의 격자 자리(열·줄)만 실행 중 계산값이라 인라인 */}
                        {week.map((day, i) => {
                            const other = day.slice(0, 7) !== month, first = day.slice(8) === '01';
                            return <button key={day} type="button" className={`adm-gs-mcell ${colCls(i + 1)}${other ? ' is-other' : ''}${selDay === day ? ' is-sel' : ''}`}
                                aria-label={day} onClick={e => openDayList(e.currentTarget, day)}>
                                <span className={`adm-gs-mnum${day === today ? ' is-today' : ''}${i === 0 ? ' is-sun' : i === 6 ? ' is-sat' : ''}${first ? ' is-first' : ''}`}>{first ? `${Number(day.slice(5, 7))}월 1일` : Number(day.slice(8))}</span>
                            </button>;
                        })}
                        {bars.map(({ booking: b, lane, from, to, clipStart, clipEnd }) => {
                            const d = dup.has(b.key), none = !hasGuide(b), head = !clipStart, name = b.assignment?.guide?.name || '';
                            return <button key={b.key} type="button" disabled={savingKey === b.key}
                                className={cx('adm-gs-mbar', stateCls(d, none), none && !d && 'is-open', d && 'is-dup', clipStart && 'is-clip-start', clipEnd && 'is-clip-end', pop?.activeKey === b.key && 'is-active')}
                                style={{ gridColumn: `${from + 1} / ${to + 2}`, gridRow: lane + 2 }}
                                onMouseEnter={e => barTip(e, b)} onMouseLeave={() => setTip(null)}
                                onClick={e => { e.stopPropagation(); openGuidePop(e.currentTarget, b); }}>
                                {head && (none ? <span className="adm-gs-mav">?</span> : <Avatar name={name} img={guideImg(b)} size={20} color={colorOf(b)} ring="paper" />)}
                                {d && <b className="adm-gs-dup-text">중복</b>}
                                <span className="adm-gs-mbar-name">{head ? nameOf(b) : `↳ ${nameOf(b)}`}</span>
                                {head && <span className="adm-gs-mbar-meta">{people(b)}</span>}
                            </button>;
                        })}
                        {more.map((n, c) => n > 0 && <button key={c} type="button" className={`adm-gs-more ${colCls(c + 1)}`} onClick={e => openDayList(e.currentTarget, week[c])}>+{n}개 더보기</button>)}
                    </div>
                );
            })}
        </div>
    );

    // ── 가이드별 타임라인 ──────────────────────────────
    const todayIndex = days.indexOf(today);
    const win = timelineWindow(days.length, range, rangeStart, todayIndex, todayIndex >= 0 ? new Date(`${today}T00:00:00`).getDay() : 1);
    const winDays = days.slice(win.from, win.to + 1), full = winDays.length >= days.length;
    // 날짜 수·오늘 위치만 CSS 변수로 넘기고, 칸 폭·최소 폭·오늘 선 자리는 CSS(.adm-gs-tl)가 계산한다.
    const tlVars = { '--gs-days': winDays.length, '--gs-today': todayIndex - win.from } as React.CSSProperties;
    const dayCls = (day: string) => { const wd = new Date(`${day}T00:00:00`).getDay(); return `${wd === 0 || wd === 6 ? ' is-weekend' : ''}${day === today ? ' is-today' : ''}${wd === 1 && day !== winDays[0] ? ' is-week' : ''}`; };
    const lineRows: Array<{ row?: Row; key: string }> = [...rows.filter(r => (r.registered || r.bookings.some(b => inMonth(b, days))) && (!focusG || r.key === focusG)).map(r => ({ row: r, key: r.key })), ...(focusG ? [] : [{ key: 'none' }])];
    const timeline = (
        <div className="adm-gs-card adm-gs-scroll">
            <div className={cx('adm-gs-tl', full && 'is-full')} style={tlVars}>
                <div className="adm-gs-tl-head">
                    <div className="adm-gs-tl-name">가이드</div>
                    <div className="adm-gs-tl-days">
                        {winDays.map(day => <div key={day} className={`adm-gs-tl-day${dayCls(day)}`}><span className="adm-gs-num">{Number(day.slice(8))}</span><span>{WD[new Date(`${day}T00:00:00`).getDay()]}</span></div>)}
                    </div>
                </div>
                {lineRows.map(({ row, key }) => {
                    // 상태 필터는 숨기지 않고 흐리게 보여 준다(디자인 v4).
                    const none = !row, list = none ? active.filter(b => !hasGuide(b)) : row.bookings;
                    const monthCount = list.filter(b => inMonth(b, days)).length;
                    const placed = laneBookings(list, winDays, active, row?.guide), lanes = Math.max(1, ...placed.map(p => p.lane + 1));
                    const hasDupRow = placed.some(p => p.overlap), color = row?.color || NONE_COLOR, st = row ? stats[row.key] : undefined;
                    const utilTone = none ? toneCls(NONE_COLOR) : hasDupRow ? stateCls(true, false) : toneCls(color);
                    const label = row ? row.guide.name : '미배정 투어';
                    const sub = none ? (monthCount ? `${monthCount}팀 · 눌러서 배정` : '이 달 없음') : !row.registered ? `등록 안 된 가이드${monthCount ? ` · ${monthCount}팀` : ''}` : monthCount ? `${monthCount}팀` : '이 달 비어 있음';
                    const util = none ? Math.min(100, monthCount * 25) : Math.round((st?.days || 0) / days.length * 100);
                    return (
                        <div key={key} className={`adm-gs-tl-row${none ? ' is-none' : ''}`}>
                            {/* 가이드 줄 머리(얼굴 · 이름 · 이번 달 막대) — 표의 셀이라 생 버튼 + adm- 클래스 */}
                            <button type="button" className={`adm-gs-tl-name is-row${drawer === key ? ' is-on' : ''}`} disabled={none} onClick={() => row && (setDrawer(row.key), setPop(null))}>
                                <span className="adm-gs-tl-who">
                                    {none ? <span className="adm-gs-av is-s34 is-none">?</span> : <Avatar name={label} img={row.resource?.image} size={34} color={color} ring={hasDupRow ? 'dup' : 'tone'} />}
                                    <span className="adm-gs-tl-text"><b className={hasDupRow ? 'is-dup' : ''}>{label}</b><span className={row && !row.registered ? 'is-warn' : ''}>{sub}</span></span>
                                    {!none && <IconChevronRight className="adm-gs-tl-chev" aria-hidden="true" />}
                                </span>
                                <span className="adm-gs-tl-util"><span className={cx('adm-gs-util', utilTone)}><span style={{ width: `${util}%` }} /></span><span>이번 달 {monthCount}팀</span></span>
                            </button>
                            <div className="adm-gs-tl-track">
                                <div className="adm-gs-tl-cells">
                                    {winDays.map(day => row ? <button key={day} type="button" className={`adm-gs-tl-cell is-free${dayCls(day)}`} aria-label={`${label} ${md(day)} 배정하기`} title={`${md(day)} — 눌러서 이날 미배정 투어 배정`} onClick={e => openDayPop(e.currentTarget, row, day)} />
                                        : <span key={day} className={`adm-gs-tl-cell${dayCls(day)}`} />)}
                                </div>
                                {todayIndex >= win.from && todayIndex <= win.to && <div className="adm-gs-today-line" />}
                                <div className="adm-gs-tl-bars" style={{ '--gs-lanes': lanes } as React.CSSProperties}>
                                    {placed.map(({ booking, lane, from, to, overlap }) => {
                                        const b = booking as Item, d = overlap || dup.has(b.key);
                                        const total = dayDiff(startOf(b), endOf(b)) + 1, elapsed = dayDiff(startOf(b), today) + 1, live = coversDay(b, today);
                                        const pct = Math.max(0, Math.min(100, elapsed / total * 100));
                                        const dim = !!stateFilter && stateOf(b) !== stateFilter;
                                        // 막대의 격자 자리와 진행 막대 길이만 실행 중 계산값이라 인라인. 색은 상태 클래스(.adm-gs-st-*)
                                        return (
                                            <button key={b.key} type="button" disabled={savingKey === b.key}
                                                className={cx('adm-gs-tl-bar', stateCls(d, none), d ? 'is-dup' : none && 'is-none', dim && 'is-dim', pop?.activeKey === b.key && 'is-active')}
                                                style={{ gridColumn: `${from + 1} / ${to + 2}`, gridRow: lane + 1 }}
                                                onMouseEnter={e => barTip(e, b)} onMouseLeave={() => setTip(null)}
                                                onClick={e => openGuidePop(e.currentTarget, b)}>
                                                <span className="adm-gs-prog" style={{ width: `${pct}%` }} />
                                                {d && <span className="adm-gs-dup">중복</span>}
                                                <span className="adm-gs-tl-bar-text"><span><i /><b>{nameOf(b)}</b></span><span>{period(b)} · {people(b)} · {nights(b)}</span></span>
                                                {live && <span className="adm-gs-live"><i />진행 중</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    // ── 가이드 상세 패널 ────────────────────────────────
    const drawerView = drawerRow && <GuideDrawer key={drawerRow.key} row={drawerRow} today={today} month={month} dup={dup} carInfo={carInfo}
        onClose={() => setDrawer(null)} onItinerary={openItinerary} onPicket={b => setPicket(b.key)} onAssignCar={openCarPop} />;

    // ── 가이드 피켓 ────────────────────────────────────
    const picketInput: GuidePicketInput | null = picketBooking ? {
        customerName: nameOf(picketBooking), startDate: startOf(picketBooking), endDate: endOf(picketBooking),
        guideName: String(picketBooking.assignment?.guide?.name || ''), guidePhone: String(picketBooking.assignment?.guide?.phone || ''),
    } : null;
    const picketImage = useGuidePicketImage(picketInput);
    const picketAction = (run: (input: GuidePicketInput) => Promise<void>) => { if (picketInput) run(picketInput).catch(error => flash(error?.message || '피켓을 만들지 못했어요')); };
    // 우리 팝업 부품(AdminDialog: 검정 막 · Esc · 닫기 버튼). 발에 PNG 저장 · 인쇄하기
    const picketView = picketBooking && <AdminDialog open size="lg" title="가이드 피켓 미리보기" description="A4 가로" className="adm-gs-picket-dialog" onClose={() => setPicket(null)}
        footer={<div className="adm-ui-dialog-foot">
            <div className="adm-ui-dialog-foot-start" />
            <div className="adm-ui-dialog-foot-end">
                <AdminButton variant="secondary" disabled={!picketImage.url} leading={<IconDownload aria-hidden="true" />} onClick={() => picketAction(saveGuidePicket)}>PNG 저장</AdminButton>
                <AdminButton variant="primary" disabled={!picketImage.url} leading={<IconDocument aria-hidden="true" />} onClick={() => picketAction(printGuidePicket)}>인쇄하기</AdminButton>
            </div>
        </div>}>
        <div className="adm-gs-picket">
            {picketImage.url ? <img src={picketImage.url} alt={`${nameOf(picketBooking)} 님 가이드 피켓`} />
                : <span className="adm-gs-picket-wait">{picketImage.error || '피켓을 만드는 중…'}</span>}
        </div>
    </AdminDialog>;

    // ── 막대 말풍선 ────────────────────────────────────
    const tipBooking = tip && !pop ? items.find(b => b.key === tip.key) : undefined;
    const tipView = tipBooking && tip && (() => {
        const b = tipBooking, d = dup.has(b.key), none = !hasGuide(b), live = coversDay(b, today), past = endOf(b) < today, dd = dayDiff(today, startOf(b));
        const st = d ? '중복' : none ? '미배정' : live ? '진행 중' : past ? '종료' : '예정', tone = d ? 'is-dup' : none ? 'is-none' : live ? 'is-live' : 'is-idle';
        const below = tip.y + 210 < window.innerHeight;
        const rowsT: Array<[string, string, boolean]> = [['일정', `${md(startOf(b))} → ${md(endOf(b))} · ${nights(b)}`, false], ['인원', people(b), false],
            ['가이드', b.assignment?.guide?.name || '배정 필요', none || d], ['차량', b.assignment?.vehicle?.type || '배정 필요', !b.assignment?.vehicle?.type], ['출발', live ? '투어 진행 중' : past ? '종료됨' : `D-${dd}`, false]];
        // 말풍선 자리(마우스를 올린 막대 기준)만 실행 중 계산값이라 인라인
        return <div aria-hidden="true" className="adm-gs-tip" style={{ left: Math.max(12, Math.min(tip.x, window.innerWidth - 292)), top: below ? tip.y + 6 : Math.max(12, tip.top - 216) }}>
            <div className="adm-gs-tip-head"><b>{nameOf(b)}</b><span className={tone}>{st}</span></div>
            {b.productName && <span className="adm-gs-tip-low">{b.productName}</span>}
            <div className="adm-gs-tip-rows">{rowsT.map(([l, v, warn]) => <div key={l}><span>{l}</span><b className={warn ? (d ? 'is-dup' : 'is-warn') : undefined}>{v}</b></div>)}</div>
            <span className="adm-gs-tip-low">{none ? '눌러서 가이드 배정하기' : '눌러서 가이드 바꾸기'}</span>
        </div>;
    })();

    // ── 상단 조작부(Claude Design ‘가이드 배정 현황 · 상단 조작부’, 2026-11-23): 보기 3칸 · 달 이동 · 상태 칩 한 줄 + 지금 보는 범위 ──
    const viewKey = view === 'tbl' ? 'tbl' : sub;
    const setViewKey = (v: string) => { if (v === 'tbl') setView('tbl'); else { setView('cal'); setSub(v as 'month' | 'line'); } setPop(null); };
    const thisMonth = month === today.slice(0, 7);
    const focusName = focusG ? rows.find(r => r.key === focusG)?.guide.name || '' : '';
    const scope = [stateFilter && ({ ok: '배정된 투어만', none: '미배정 투어만', dup: '일정이 겹친 투어만' })[stateFilter], focusName && `${focusName} 가이드만`].filter(Boolean).join(' · ');
    const caption = view === 'tbl' ? `가이드 배정하기 · 오늘 이후 투어 ${upcoming.length}팀`
        : `${sub === 'month' ? '월간 달력' : '가이드별 타임라인'} · ${monthLabel} · ${scope ? `${scope} 보는 중` : '전체 보는 중'}`;
    const toolbar = <div className="adm-gs-toolbar-wrap">
        <div className="adm-gs-toolbar">
            <div className="adm-gs-tb-group">
                <span className="adm-gs-tb-label">보기</span>
                <AdminSegmented label="보기" size="md" value={viewKey} onChange={setViewKey} className="adm-gs-tb-views"
                    items={[{ value: 'tbl', label: '가이드 배정하기' }, { value: 'line', label: '가이드별 타임라인' }, { value: 'month', label: '월간 달력' }]} />
            </div>
            {view === 'cal' ? <>
                <div className="adm-gs-tb-group">
                    <div className="adm-gs-tb-month">
                        <AdminIconButton label="이전 달" size="lg" onClick={() => goMonth(-1)}><IconChevronLeft aria-hidden="true" /></AdminIconButton>
                        <b aria-live="polite">{monthLabel}</b>
                        <AdminIconButton label="다음 달" size="lg" onClick={() => goMonth(1)}><IconChevronRight aria-hidden="true" /></AdminIconButton>
                    </div>
                    <AdminButton variant="weak" size="sm" disabled={thisMonth} onClick={() => { setMonth(today.slice(0, 7)); setRangeStart(null); setPop(null); }}>{thisMonth ? '이번 달' : '이번 달로'}</AdminButton>
                </div>
                <div className="adm-gs-tb-group" role="group" aria-label="배정 상태로 거르기">
                    {chips.map(c => {
                        const none = c.key === 'dup' && c.n === 0;
                        return <AdminChip key={c.key} active={c.on} onClick={c.go} title={c.on ? '전체 보기' : `${c.label} 투어만 보기`}
                            className={`adm-gs-tb-chip is-${c.key}${c.n ? '' : ' is-zero'}`}
                            leading={none ? <IconCheck className="adm-gs-tb-check" aria-hidden="true" /> : <span className="adm-gs-tb-dot" aria-hidden="true" />}>
                            {c.label} <b>{none ? '없음' : `${c.n}${c.unit}`}</b></AdminChip>;
                    })}
                </div>
            </> : <AdminButton variant="primary" to="/admin/reservations" leading={<IconPlus aria-hidden="true" />}>새 투어 등록</AdminButton>}
        </div>
        <span className="adm-gs-tb-caption" role="status">{caption}</span>
    </div>;
    const assignList = <GuideAssignList bookings={upcoming} active={active} today={today} rows={rows} vehicles={vehicles} dup={dup} carDup={carDup} savingKey={savingKey}
        rowOf={rowOf} vehicleOf={vehicleOf} carInfo={carInfo} guideImg={guideImg}
        onAssignGuide={(b, row) => void assignRow(b, row)} onClearGuide={b => void assign(b, null, '')} onAssignCar={(b, v) => void saveVehicle(b, v)}
        onDetail={(b, target) => { const r = rowOf(b); if (r) { setMonth(startOf(b).slice(0, 7)); setDrawer(r.key); setPop(null); } else openGuidePop(target, b); }}
        onMore={openMorePop} />;

    return (
        <div className="gs">
            {toolbar}
            {warnings.map((w, i) => <div key={i} className="adm-gs-notice adm-msg is-cautionary" role="alert">{w}</div>)}

            {loading && !items.length ? <p className="adm-gs-empty">배정 현황을 불러오고 있어요…</p> : view === 'cal' ? (
                <div className="adm-gs-cal-wrap">
                    <aside className="adm-gs-side">
                        <AdminButton variant="primary" to="/admin/reservations" fullWidth leading={<IconPlus aria-hidden="true" />}>투어 등록</AdminButton>
                        {miniCal}
                        <div className="adm-gs-divider" />
                        {picker}
                    </aside>
                    <div className="adm-gs-main">
                        {sub === 'line' && <div className="adm-gs-main-top">
                            <div className="adm-gs-range">
                                <AdminIconButton label="이전" variant="outlined" size="sm" disabled={win.from <= 0} onClick={() => setRangeStart(Math.max(0, win.from - winDays.length))}><IconChevronLeft aria-hidden="true" /></AdminIconButton>
                                <b>{Number(month.slice(5))}.{win.from + 1} – {Number(month.slice(5))}.{win.to + 1}</b>
                                <AdminIconButton label="다음" variant="outlined" size="sm" disabled={win.to >= days.length - 1} onClick={() => setRangeStart(Math.min(days.length - winDays.length, win.from + winDays.length))}><IconChevronRight aria-hidden="true" /></AdminIconButton>
                                <AdminSegmented label="타임라인 기간" value={range} onChange={k => { setRange(k); setRangeStart(k === 'm' ? 0 : win.from); }}
                                    items={[{ value: 'w1', label: '1주' }, { value: 'w2', label: '2주' }, { value: 'm', label: '한 달' }]} />
                            </div>
                        </div>}
                        {sub === 'month' ? monthGrid : timeline}
                    </div>
                </div>
            ) : assignList}

            {/* 팝오버·상세 패널·피켓·안내는 문서 맨 위에 그린다. .gs(z-index:2) 안에 두면 관리자 상단바·탭 아래로 깔린다. */}
            {createPortal(<div className="gs-layer">
            {pop && <>
                <div className="adm-gs-pop-back" onClick={() => setPop(null)} />
                {/* gs-pop: 휴대폰에서 아래 시트로 바꾸는 공통 규칙(admin-mobile.css)이 이 이름을 쓴다. 자리만 실행 중 계산값이라 인라인 */}
                <div className="gs-pop" role="dialog" aria-label={pop.title} style={{ left: pop.x, top: pop.y }}>
                    <div className="adm-gs-pop-head"><b>{pop.title}</b><AdminIconButton label="닫기" size="sm" onClick={() => setPop(null)}><IconClose aria-hidden="true" /></AdminIconButton></div>
                    {pop.items.map(item => (
                        <button key={item.key} type="button" className={`adm-gs-pop-row${item.muted ? ' is-muted' : ''}`} onClick={e => item.onPick(e.currentTarget)}>
                            <span className="adm-gs-pop-text"><b>{item.name}</b><span>{item.sub}</span></span>
                            {item.tag && <span className="adm-gs-tag" data-tone={item.tag.tone}>{item.tag.label}</span>}
                        </button>
                    ))}
                    {pop.emptyText && (!pop.items.length || (pop.items.every(i => i.muted))) && <div className="adm-gs-pop-empty">{pop.emptyText}</div>}
                </div>
            </>}
            {drawerView}
            {picketView}
            {tipView}
            {toast && <div className="adm-gs-toast" role="status">{toast}</div>}
            </div>, document.body)}
        </div>
    );
}
