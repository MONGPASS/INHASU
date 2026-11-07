import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AssignmentAccommodation, AssignmentSource } from '../../../utils/reservationAssignment';
import type { RegisteredLodge } from '../../../utils/registeredAssignmentResources';
import { selectResourceLodge } from '../../../utils/accommodationResourceSelection';
import { LODGE_BOOKING_STATUSES, LODGE_BOOKING_UNSENT, isLodgeBookingConfirmed, lodgeBookingLabel } from '../../../utils/lodgeBookingStatus';
import { ASSIGN_TYPE_OPTIONS, LODGE_AREA_OPTIONS, LODGE_GRADE_OPTIONS, PACKAGE_LABELS, ROOM_PLAN_OPTIONS, packagePlanFromGrades, roomPlanLabel, sheetAreaFor, type PackagePlan } from '../../../utils/accommodationSheet';
import { scheduleStayRegion, type AccommodationSchedule } from '../../../utils/accommodationSchedule';
import { CATEGORY_OPTIONS } from '../../../utils/reservationWorkspace';
import { productCustomerHref, quoteCustomerHref } from '../../../utils/customerWorkspaceRoutes';
import { toTourDateKey } from '../../../utils/formatDate';
import { DashboardIcon } from '../dashboard/DashboardIcon';
import './LodgeAssignBoard.css';

/**
 * 숙소 배정 시트 — Claude Design ‘05-3 배정 자원 - 숙소 배정 시트’.
 * 위: 숙박 일정(월 선택·14일 띠·일/주/월), 가운데: 검색·상태 탭(숙박 수), 아래: 예약별 접히는 줄과 숙박일 표.
 * 값·저장은 기존 시트와 같다(예약 단위 배정 API, 브라우저 초안, 계약 일정 지역 불러오기).
 */
type Patch = Partial<AssignmentAccommodation['accommodation']>;
type NightState = 'none' | 'sel' | 'req' | 'ok';
/** 시트에 필요한 예약 정보만 받는다(페이지의 Reservation과 호환). */
export interface LodgeBoardTour {
    id: string; bookingId: string; source: AssignmentSource; customerName?: string; startDate?: string; endDate?: string;
    travelers?: number; assignmentCategory?: string; reservationNumber?: string | null;
    /** 대표 1인 이름(서버 계산). 없으면 예약 이름을 쓴다. */
    leadName?: string;
    /** 고객이 고른 패키지(서버 계산). 숙박 등급을 고르면 그 등급으로 다시 판단한다. */
    packagePlan?: PackagePlan | null;
    /** 계약 일정 — 숙박일마다 지역을 불러온다 */
    schedule?: AccommodationSchedule;
}

/** 숙박일 상태: 숙소 없음 → 미배정, 미발송·배정X·취소완료 → 요청 전, 확정 계열 → 배정 완료, 나머지 → 진행 중 */
const nightStateOf = (acc: Patch | undefined): NightState => {
    if (!acc?.name?.trim()) return 'none';
    const status = acc.bookingStatus || LODGE_BOOKING_UNSENT;
    if (isLodgeBookingConfirmed(status)) return 'ok';
    return status === LODGE_BOOKING_UNSENT || status === '배정X' || status === '취소완료' ? 'sel' : 'req';
};
const STATE_TABS: Array<[NightState | '', string]> = [['', '전체'], ['none', '미배정'], ['sel', '배정 · 요청 전'], ['req', '진행 중'], ['ok', '배정 완료']];
const STATUS_TONE: Record<string, string> = { solid: 'mint', amber: 'orange', blue: 'blue', gray: 'gray' };
const toneOfStatus = (value: string) => value === '배정X' ? 'gray' : value === '취소요청' ? 'red' : STATUS_TONE[LODGE_BOOKING_STATUSES.find(s => s.value === value)?.tone || 'gray'];
const WD = '일월화수목금토';
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOnly = (value?: string) => { const k = value ? toTourDateKey(value) : ''; return /^\d{4}-\d{2}-\d{2}$/.test(k) ? k : ''; };
const dotted = (k: string) => k ? `${k.slice(0, 4)}.${Number(k.slice(5, 7))}.${k.slice(8, 10)}` : '-';
const nameOf = (t: { leadName?: string; customerName?: string }) => t.leadName?.trim() || t.customerName || '-';
const withCurrent = (options: string[], current?: string) => current && !options.includes(current) ? [current, ...options] : options;
const same = (a?: string, b?: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
const CLEAR_LODGE: Patch = { id: undefined, name: '', images: [], description: '', facilities: [], address: '', roomAmenities: [], sharedFacilities: [], bookingStatus: LODGE_BOOKING_UNSENT };

type Pop = { kind: 'hotel' | 'area' | 'grade' | 'roomPlan' | 'assign' | 'status' | 'category' | 'month' | 'info'; tourId: string; idx?: number; x: number; y: number; top: number; tab?: string; year?: number };

export function LodgeAssignBoard({ tours, rowsOf, plannedNights, regionOf, contactOf, serials, lodges, lodgeRegions, resourcesLoading, dirty, pending, savingId, savingAll, clearedAreas, scope,
    onScope, onAreaCleared, onPatch, onCategory, onSave, onSaveAll, onResolveDraft, onAddNight, onRemoveNight, onCardView, loading }: {
    tours: LodgeBoardTour[];
    rowsOf: (tour: LodgeBoardTour) => AssignmentAccommodation[];
    /** 계약 일정상 숙박 수 — 이보다 뒤에 추가한 숙박만 지울 수 있다 */
    plannedNights: (tour: LodgeBoardTour) => number;
    regionOf: (tour: LodgeBoardTour) => string;
    contactOf: (tour: LodgeBoardTour) => string;
    serials: Map<string, number>;
    lodges: RegisteredLodge[]; lodgeRegions: string[]; resourcesLoading: boolean;
    dirty: Set<string>; pending: Record<string, unknown>; savingId: string | null; savingAll: boolean;
    clearedAreas: Set<string>; scope: 'confirmed' | 'all'; loading: boolean;
    onScope: (scope: 'confirmed' | 'all') => void;
    onAreaCleared: (key: string, cleared: boolean) => void;
    onPatch: (tourId: string, index: number, patch: Patch, fill?: Record<number, string>) => void;
    onCategory: (tourId: string, category: string) => void;
    onSave: (tourId: string) => void; onSaveAll: () => void;
    onResolveDraft: (tourId: string, restore: boolean) => void;
    onAddNight: (tourId: string, fill?: Record<number, string>) => void; onRemoveNight: (tourId: string, index: number) => void;
    onCardView: () => void;
}) {
    const now = new Date(), todayK = keyOf(now);
    const [calState, setCal] = useState<{ y: number; m: number } | null>(null);
    const [allPeriod, setAllPeriod] = useState(false);
    const [day, setDay] = useState<string | null>(null);
    const [range, setRange] = useState<'d' | 'w' | 'm'>('m');
    const [winStart, setWinStart] = useState(0);
    const [q, setQ] = useState('');
    const [kf, setKf] = useState<NightState | ''>('');
    const [closed, setClosed] = useState<Set<string>>(new Set());
    const [pop, setPop] = useState<Pop | null>(null);
    const [hotelQ, setHotelQ] = useState('');
    const [toast, setToast] = useState('');
    const toastTimer = useRef(0);
    const flash = (text: string) => { window.clearTimeout(toastTimer.current); setToast(text); toastTimer.current = window.setTimeout(() => setToast(''), 2000); };
    useEffect(() => () => window.clearTimeout(toastTimer.current), []);
    useEffect(() => {
        if (!pop) return;
        const close = (e: Event) => { if (!(e.target instanceof Element) || !e.target.closest('.la-pop, [data-la-pop]')) setPop(null); };
        const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(null); };
        document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
        return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
    }, [pop]);
    const openPop = (e: React.MouseEvent, next: Omit<Pop, 'x' | 'y' | 'top'>, w = 220, h = 360) => {
        e.stopPropagation();
        const r = e.currentTarget.getBoundingClientRect();
        if (pop && pop.kind === next.kind && pop.tourId === next.tourId && pop.idx === next.idx) { setPop(null); return; }
        setHotelQ('');
        setPop({ ...next, x: Math.max(12, Math.min(r.left, window.innerWidth - w - 12)), y: r.bottom + h > window.innerHeight ? Math.max(12, r.top - h) : r.bottom + 4, top: r.top });
    };

    // ── 숙박일 계산 ──
    const areaOptions = useMemo(() => [...new Set([...LODGE_AREA_OPTIONS, ...lodgeRegions])], [lodgeRegions]);
    const model = useMemo(() => tours.map(tour => {
        const rows = rowsOf(tour);
        const storedAreaOf = (acc: Patch) => (typeof acc.region === 'string' && acc.region) || acc.location || '';
        // 저장된 지역 → (관리자가 비우지 않았으면) 계약 일정의 그날 지역을 시트 지명으로. 한 칸이라도 고치면 함께 저장한다.
        const planned = rows.map((night, index) => {
            const d = tour.schedule?.days?.find(item => item.day === night.day);
            return !storedAreaOf(night.accommodation || {}) && !clearedAreas.has(`${tour.id}:${index}`) && d ? sheetAreaFor(scheduleStayRegion(d, lodgeRegions, tour.schedule?.source)) : '';
        });
        const fill = Object.fromEntries(planned.map((area, index) => [index, area]).filter(([, area]) => area)) as Record<number, string>;
        const nights = rows.map((night, index) => {
            const acc = night.accommodation || {}, stored = storedAreaOf(acc);
            return { night, index, acc, date: dateOnly(night.date), area: stored || planned[index], fromPlan: !stored && !!planned[index], state: nightStateOf(acc) };
        });
        const states = nights.map(n => n.state);
        const bs: NightState = states.some(s => s === 'none') ? 'none' : states.some(s => s !== 'ok') ? 'req' : 'ok';
        const start = dateOnly(tour.startDate), end = dateOnly(tour.endDate);
        const plan = packagePlanFromGrades(rows.map(n => n.accommodation?.type)) ?? tour.packagePlan ?? null;
        return { tour, rows, nights, fill, bs, start, end, plan, planned: plannedNights(tour) };
    }), [tours, rowsOf, plannedNights, clearedAreas, lodgeRegions]);

    // 처음에는 이번 달 — 이번 달에 숙박이 없으면 가장 가까운 다음 숙박이 있는 달을 연다.
    const firstMonthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const autoMonth = model.flatMap(m => m.nights.map(n => n.date.slice(0, 7))).filter(k => k >= firstMonthKey).sort()[0] || firstMonthKey;
    const cal = calState ?? { y: Number(autoMonth.slice(0, 4)), m: Number(autoMonth.slice(5, 7)) };
    const ym = `${cal.y}-${pad(cal.m)}`, daysInMonth = new Date(cal.y, cal.m, 0).getDate();
    const weekStart = day ? (() => { const d = new Date(`${day}T00:00:00`); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return keyOf(d); })() : '';
    const weekEnd = weekStart ? keyOf(new Date(new Date(`${weekStart}T00:00:00`).getTime() + 6 * 864e5)) : '';
    const inDay = (k: string) => range === 'w' && weekStart ? k >= weekStart && k <= weekEnd : k === day;
    const tourMonthKeys = (m: typeof model[number]) => m.nights.length ? m.nights.map(n => n.date.slice(0, 7)) : [m.start.slice(0, 7)];
    const inPeriod = (m: typeof model[number]) => allPeriod || tourMonthKeys(m).includes(ym);
    const periodNights = model.filter(inPeriod).flatMap(m => m.nights.filter(n => allPeriod || n.date.slice(0, 7) === ym));
    const count = (k: NightState | '') => k ? periodNights.filter(n => n.state === k).length : periodNights.length;
    const needle = q.trim().toLowerCase();
    const visible = model.filter(m => (!needle || `${m.tour.leadName || ''} ${m.tour.customerName || ''} ${m.tour.reservationNumber || ''} ${m.nights.map(n => n.acc.name || '').join(' ')}`.toLowerCase().includes(needle))
        && inPeriod(m) && (!day || m.nights.some(n => inDay(n.date))) && (!kf || m.nights.some(n => n.state === kf)))
        .sort((a, b) => (a.start || '9').localeCompare(b.start || '9'));
    const allNights = model.flatMap(m => m.nights);

    // 14일 띠 — 이번 달이면 오늘 사흘 전부터
    const winLen = Math.min(14, daysInMonth);
    const todayInMonth = todayK.slice(0, 7) === ym ? Number(todayK.slice(8)) : 1;
    const ws = Math.max(1, Math.min(daysInMonth - winLen + 1, winStart || Math.max(1, todayInMonth - 3)));
    const strip = Array.from({ length: winLen }, (_, i) => {
        const d = ws + i, k = `${ym}-${pad(d)}`, w = new Date(cal.y, cal.m - 1, d).getDay(), ns = allNights.filter(n => n.date === k);
        const bad = ns.some(n => n.state === 'none'), ok = ns.length > 0 && ns.every(n => n.state === 'ok');
        return { d, k, w, n: ns.length, bad, ok, on: !!day && inDay(k), today: k === todayK, unassigned: ns.filter(n => n.state === 'none').length };
    });
    const shiftMonth = (delta: number, startAt: number) => { let { y, m } = cal; m += delta; if (m > 12) { m = 1; y++; } if (m < 1) { m = 12; y--; } setCal({ y, m }); setWinStart(startAt < 0 ? Math.max(1, new Date(y, m, 0).getDate() - 13) : startAt); setDay(null); setRange('m'); setAllPeriod(false); };
    const winNext = () => ws + winLen - 1 >= daysInMonth ? shiftMonth(1, 1) : setWinStart(Math.min(daysInMonth - winLen + 1, ws + 7));
    const winPrev = () => ws <= 1 ? shiftMonth(-1, -1) : setWinStart(Math.max(1, ws - 7));
    const pickDay = (k: string, has: boolean) => { if (!has) return; const on = !!day && inDay(k); setDay(on ? null : k); setAllPeriod(false); setRange(on ? 'm' : range === 'm' ? 'd' : range); };
    const setRangeMode = (k: 'd' | 'w' | 'm') => { setRange(k); if (k === 'm') setDay(null); else if (!day) setDay(`${ym}-${pad(ws)}`); };
    const goToday = () => { setCal({ y: now.getFullYear(), m: now.getMonth() + 1 }); setDay(null); setAllPeriod(false); setWinStart(0); setRange('m'); };
    const allOpen = visible.every(m => !closed.has(m.tour.id));
    const toggleAll = () => setClosed(allOpen ? new Set(visible.map(m => m.tour.id)) : new Set());

    // ── 고르기 창 ──
    const popTour = pop ? model.find(m => m.tour.id === pop.tourId) : undefined;
    const popNight = popTour && pop?.idx != null ? popTour.nights[pop.idx] : undefined;
    const patchNight = (m: typeof model[number], index: number, patch: Patch) => onPatch(m.tour.id, index, patch, m.fill);
    const choose = (items: Array<{ value: string; label: string; sub?: string }>, current: string, pick: (v: string) => void) => items.map(o => (
        <button key={o.value || '__none'} type="button" className="la-pop-item" onClick={() => { pick(o.value); setPop(null); }}>
            <span><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>{current === o.value && <DashboardIcon name="lc-check" size={16} color="#057a61" />}
        </button>
    ));
    const renderPop = () => {
        if (!pop) return null;
        const style: React.CSSProperties = { left: pop.x, top: pop.y };
        if (pop.kind === 'month') {
            const y = pop.year ?? cal.y;
            return <div className="la-pop la-month-pop" style={style}>
                <div className="la-month-head">
                    <button type="button" aria-label="이전 해" onClick={() => setPop({ ...pop, year: y - 1 })}><DashboardIcon name="lc-chevron-left" size={16} /></button>
                    <b>{y}년</b>
                    <button type="button" aria-label="다음 해" onClick={() => setPop({ ...pop, year: y + 1 })}><DashboardIcon name="lc-chevron-right" size={16} /></button>
                </div>
                <div className="la-month-grid">
                    {Array.from({ length: 12 }, (_, i) => {
                        const key = `${y}-${pad(i + 1)}`, ns = allNights.filter(n => n.date.slice(0, 7) === key), on = !allPeriod && cal.y === y && cal.m === i + 1;
                        return <button key={key} type="button" className={on ? 'is-on' : ns.length ? 'has' : ''} onClick={() => { setCal({ y, m: i + 1 }); setPop(null); setDay(null); setAllPeriod(false); setWinStart(0); setRange('m'); }}>
                            {i + 1}월{ns.length > 0 && <i data-bad={ns.some(n => n.state === 'none') || undefined} />}
                        </button>;
                    })}
                </div>
                <button type="button" className={`la-month-all${allPeriod ? ' is-on' : ''}`} onClick={() => { setAllPeriod(true); setDay(null); setRange('m'); setPop(null); }}>전체 기간 보기</button>
            </div>;
        }
        if (!popTour) return null;
        const m = popTour, label = `${nameOf(m.tour)}${pop.idx != null ? ` ${pop.idx + 1}박` : ''}`;
        if (pop.kind === 'info') {
            const href = m.tour.source === 'quote_booking' ? quoteCustomerHref(m.tour.bookingId, '/admin/accommodation-ops') : productCustomerHref(m.tour.bookingId, '/admin/accommodation-ops');
            const done = m.nights.filter(n => n.state !== 'none').length, ok = m.nights.filter(n => n.state === 'ok').length;
            const below = pop.y + 330 < window.innerHeight;
            return <div className="la-pop la-info" style={{ left: Math.max(12, Math.min(pop.x - 8, window.innerWidth - 332)), top: below ? pop.y + 2 : Math.max(12, pop.top - 326) }}>
                <div className="la-info-head"><b>{nameOf(m.tour)}</b><em>{m.tour.source === 'quote_booking' ? '견적 예약' : '상품 예약'}</em><small>{m.tour.reservationNumber ? `#${m.tour.reservationNumber}` : ''}</small></div>
                <dl>
                    <div><dt>연락처</dt><dd>{contactOf(m.tour) || '등록 안 됨'}</dd></div>
                    <div><dt>여행 기간</dt><dd>{dotted(m.start)} → {dotted(m.end)}</dd></div>
                    <div><dt>인원</dt><dd>{m.tour.travelers ? `${m.tour.travelers}명` : '-'} · {m.plan ? PACKAGE_LABELS[m.plan] : '패키지 미정'}</dd></div>
                    <div><dt>지역</dt><dd>{regionOf(m.tour)}</dd></div>
                    <div><dt>분류</dt><dd><button type="button" data-la-pop aria-label={`${nameOf(m.tour)} 분류`} disabled={!!pending[m.tour.id] || savingId === m.tour.id} onClick={e => openPop(e, { kind: 'category', tourId: m.tour.id }, 220, 420)}>{m.tour.assignmentCategory || '미정'}<DashboardIcon name="lc-chevron-down" size={12} /></button></dd></div>
                    <div><dt>숙소</dt><dd>{done}/{m.nights.length}박 배정 · {ok}박 확정</dd></div>
                </dl>
                <div className="la-info-links">
                    <a href={href} className="is-primary"><DashboardIcon name="lc-file-text" size={14} />예약 상세</a>
                    <button type="button" onClick={() => { setPop(null); onCardView(); }}><DashboardIcon name="lc-layers" size={14} />카드 보기</button>
                </div>
            </div>;
        }
        if (pop.kind === 'category') return <div className="la-pop" style={{ ...style, width: 220 }}>
            <div className="la-pop-head"><b>분류</b><small>{m.tour.leadName || m.tour.customerName}</small></div>
            <div className="la-pop-list">{choose([{ value: '', label: '미정' }, ...withCurrent(CATEGORY_OPTIONS, m.tour.assignmentCategory).map(v => ({ value: v, label: v }))], m.tour.assignmentCategory || '', v => onCategory(m.tour.id, v))}</div>
        </div>;
        if (!popNight) return null;
        const n = popNight, acc = n.acc, idx = n.index;
        if (pop.kind === 'hotel') {
            const tab = pop.tab ?? (n.area && lodges.some(l => same(l.region || l.location, n.area)) ? n.area : '전체');
            const tabs = ['전체', ...lodgeRegions];
            const hq = hotelQ.trim().toLowerCase();
            const list = lodges.filter(l => (tab === '전체' || same(l.region || l.location, tab)) && (!hq || `${l.name} ${l.region} ${l.location}`.toLowerCase().includes(hq)));
            return <div className="la-pop la-hotel-pop" style={{ ...style, width: 340 }}>
                <div className="la-pop-head"><b>{label} 숙소정보</b><small>{resourcesLoading ? '숙소 불러오는 중…' : `등록 숙소 ${lodges.length}곳`}</small></div>
                <div className="la-pop-tabs">{tabs.map(t => <button key={t} type="button" className={t === tab ? 'is-on' : ''} onClick={() => setPop({ ...pop, tab: t })}>{t}</button>)}</div>
                <label className="la-pop-search"><DashboardIcon name="lc-search" size={14} /><input autoFocus value={hotelQ} onChange={e => setHotelQ(e.target.value)} placeholder="숙소 이름으로 찾기" /></label>
                <div className="la-pop-list">
                    <button type="button" className="la-pop-item" onClick={() => { patchNight(m, idx, CLEAR_LODGE); setPop(null); }}><span><b>미배정</b><small>숙소 선택 해제</small></span>{!acc.name?.trim() && <DashboardIcon name="lc-check" size={16} color="#057a61" />}</button>
                    {list.map(l => <button key={l.id} type="button" className="la-pop-item" onClick={() => {
                        onPatch(m.tour.id, idx, { ...selectResourceLodge(n.night, l).accommodation, ...(n.area ? { location: n.area, region: n.area } : {}) }, m.fill);
                        setPop(null); flash(`${label} · ${l.name} 선택했어요`);
                    }}><span><b>{l.name}</b><small>{[l.region || l.location, l.type].filter(Boolean).join(' · ')}</small></span>{(acc.id ? acc.id === l.id : same(acc.name, l.name)) && <DashboardIcon name="lc-check" size={16} color="#057a61" />}</button>)}
                    {!list.length && <p className="la-pop-empty">{resourcesLoading ? '숙소를 불러오고 있어요…' : '조건에 맞는 등록 숙소가 없어요.'}</p>}
                    <button type="button" className="la-pop-item is-manual" onClick={() => {
                        setPop(null);
                        const name = window.prompt('목록에 없는 숙소명을 입력해 주세요.', acc.name || '')?.trim();
                        if (name && name !== acc.name) patchNight(m, idx, { ...CLEAR_LODGE, name });
                    }}><span><b>직접 입력…</b><small>등록되지 않은 숙소</small></span></button>
                </div>
            </div>;
        }
        const simple = (title: string, items: Array<{ value: string; label: string }>, current: string, pick: (v: string) => void, sub = label) => <div className="la-pop" style={{ ...style, width: 220 }}>
            <div className="la-pop-head"><b>{title}</b><small>{sub}</small></div>
            <div className="la-pop-list">{choose(items, current, pick)}</div>
        </div>;
        const none = { value: '', label: '미정' };
        if (pop.kind === 'area') return simple('숙소지역', [none, ...withCurrent(areaOptions, n.area).map(v => ({ value: v, label: v }))], n.area, v => { onAreaCleared(`${m.tour.id}:${idx}`, !v); patchNight(m, idx, { location: v, region: v }); });
        if (pop.kind === 'grade') return simple('등급', [none, ...withCurrent(LODGE_GRADE_OPTIONS, acc.type).map(v => ({ value: v, label: v }))], acc.type || '', v => patchNight(m, idx, { type: v || undefined }));
        if (pop.kind === 'roomPlan') return simple('방수', [none, ...(acc.occupancy && !ROOM_PLAN_OPTIONS.some(o => o.value === acc.occupancy) ? [{ value: acc.occupancy, label: roomPlanLabel(acc.occupancy) }] : []), ...ROOM_PLAN_OPTIONS], acc.occupancy || '', v => patchNight(m, idx, { occupancy: v || undefined }));
        if (pop.kind === 'assign') return simple('배정 구분', [none, ...withCurrent(ASSIGN_TYPE_OPTIONS, acc.assignType).map(v => ({ value: v, label: v }))], acc.assignType || '', v => patchNight(m, idx, { assignType: v }));
        const status = acc.bookingStatus || LODGE_BOOKING_UNSENT;
        return simple('예약상태', [...(!LODGE_BOOKING_STATUSES.some(s => s.value === status) ? [{ value: status, label: lodgeBookingLabel(status) }] : []), ...LODGE_BOOKING_STATUSES], status, v => patchNight(m, idx, { bookingStatus: v }), acc.name || label);
    };

    const tabColor: Record<string, string> = { '': '#212124', none: '#FF4F4F', sel: '#8B95A1', req: '#F08C00', ok: '#12B28C' };
    const monthLabel = allPeriod ? '전체 기간' : `${cal.y}년 ${cal.m}월`;
    const dayLabel = day ? `${range === 'w' && weekStart ? `${Number(weekStart.slice(5, 7))}.${Number(weekStart.slice(8))} 주` : `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일`} 숙박` : '';
    const kfLabel = STATE_TABS.find(t => t[0] === kf)?.[1] || '';

    return (
        <div className="la">
            <section className="la-cal" aria-label="숙박 일정">
                <b className="la-cal-title">숙박 일정</b>
                <div className="la-cal-bar">
                    <button type="button" data-la-pop className={`la-month-btn${pop?.kind === 'month' ? ' is-open' : ''}`} onClick={e => openPop(e, { kind: 'month', tourId: '', year: cal.y }, 280, 300)}>
                        <i /><b>{monthLabel}</b><DashboardIcon name="lc-chevron-down" size={14} />
                    </button>
                    {day && <button type="button" className="la-day-chip" onClick={() => { setDay(null); setRange('m'); }}>{dayLabel}<DashboardIcon name="lc-x" size={12} /></button>}
                    <button type="button" className="la-today" onClick={goToday}>오늘</button>
                    <div className="la-range" role="group" aria-label="기간 단위">
                        {([['d', '일'], ['w', '주'], ['m', '월']] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={range === k} className={range === k ? 'is-on' : ''} disabled={allPeriod && k !== 'm'} onClick={() => setRangeMode(k)}>{l}</button>)}
                    </div>
                </div>
                <div className="la-strip-row">
                    <div className="la-strip" style={{ gridTemplateColumns: `repeat(${winLen}, minmax(40px, 1fr))` }}>
                        {strip.map(s => <button key={s.k} type="button" className={`la-day${s.on ? ' is-on' : ''}${s.n ? ' has' : ''}`} disabled={allPeriod}
                            title={s.n ? `${s.k} · 숙박 ${s.n}박${s.unassigned ? ` · 미배정 ${s.unassigned}` : ''}` : `${s.k} · 숙박 없음`} onClick={() => pickDay(s.k, s.n > 0)}>
                            <span className="la-day-w" data-w={s.w}>{WD[s.w]}</span>
                            <span className={`la-day-n${s.today ? ' is-today' : ''}`}>{s.d}</span>
                            {s.n > 0 && <i data-tone={s.bad ? 'red' : s.ok ? 'mint' : 'orange'} />}
                        </button>)}
                    </div>
                    <div className="la-strip-nav">
                        <button type="button" aria-label="다음 날짜" className="is-dark" disabled={allPeriod} onClick={winNext}><DashboardIcon name="lc-chevron-right" size={14} /></button>
                        <button type="button" aria-label="이전 날짜" disabled={allPeriod} onClick={winPrev}><DashboardIcon name="lc-chevron-left" size={14} /></button>
                    </div>
                </div>
            </section>

            <div className="la-tools">
                <label className="la-search"><DashboardIcon name="lc-search" size={16} /><input aria-label="고객명·숙소명 검색" value={q} onChange={e => setQ(e.target.value)} placeholder="고객명·숙소명으로 찾기" /></label>
                <select className="la-scope" aria-label="예약 범위" value={scope} onChange={e => onScope(e.target.value as 'confirmed' | 'all')}>
                    <option value="confirmed">확정 예약만</option><option value="all">전체 예약</option>
                </select>
                {kf && <button type="button" className="la-kf" onClick={() => setKf('')}>{kfLabel}만 보기<DashboardIcon name="lc-x" size={14} /></button>}
                <span className="la-tools-gap" />
                <button type="button" className="la-ghost" onClick={onCardView}>카드 보기</button>
                <button type="button" className="la-ghost" onClick={toggleAll} disabled={!visible.length}>{allOpen ? '모두 접기' : '모두 펼치기'}</button>
            </div>

            {dirty.size > 0 && <div className="la-savebar" role="status">
                <span>저장하지 않은 예약 <b>{dirty.size}</b>팀 · 변경 내용은 브라우저 초안으로도 보관돼요.</span>
                <button type="button" disabled={!!savingId || savingAll} onClick={onSaveAll}><DashboardIcon name="lc-check" size={15} />{savingAll ? '저장하는 중…' : '모두 저장'}</button>
            </div>}

            <div className="la-sheet">
                <div className="la-tabs" role="tablist" aria-label="숙박 상태">
                    {STATE_TABS.map(([k, l]) => <button key={k || 'all'} type="button" role="tab" aria-selected={kf === k} className={kf === k ? 'is-on' : ''} style={{ ['--tab' as string]: tabColor[k] }} onClick={() => setKf(k)}>
                        <b>{pad(count(k))}</b><span>{l}</span>
                    </button>)}
                </div>
                <div className="la-body">
                    {loading ? <p className="la-empty">예약을 불러오고 있어요…</p>
                        : !visible.length ? <p className="la-empty">{monthLabel}{day ? ` · ${dayLabel}` : ''}에 조건에 맞는 예약이 없어요.</p>
                        : <div className="la-scroll"><div className="la-inner">{visible.map(m => {
                            const t = m.tour, open = !closed.has(t.id), N = m.nights.length, done = m.nights.filter(n => n.state !== 'none').length, ok = m.nights.filter(n => n.state === 'ok').length;
                            const locked = !!pending[t.id] || savingId === t.id, isDirty = dirty.has(t.id), serial = serials.get(t.id) || 0;
                            const prog = !N ? '숙박 없음' : m.bs === 'ok' ? '모두 확정' : done < N ? `${N - done}박 미배정` : `${ok}/${N}박 확정`;
                            const toggle = () => setClosed(prev => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; });
                            const nextDate = (() => { const last = m.nights[N - 1]?.date || m.end; if (!last) return ''; const d = new Date(`${last}T00:00:00`); d.setDate(d.getDate() + 1); return dotted(keyOf(d)); })();
                            return <div key={t.id} id={`acc-row-${t.id}`} className={`la-tour${m.bs === 'none' && N ? ' is-missing' : ''}${isDirty ? ' is-dirty' : ''}`}>
                                <div className={`la-tour-head${open ? ' is-open' : ''}`} role="button" tabIndex={0} aria-expanded={open} onClick={toggle} onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); toggle(); } }}>
                                    <span className="la-caret"><DashboardIcon name="lc-chevron-right" size={16} /></span>
                                    <span className="la-no">{serial || '-'}</span>
                                    <span className="la-name"><b>{nameOf(t)}</b>
                                        <button type="button" data-la-pop aria-label={`${nameOf(t)} 예약 정보 보기`} title="예약 정보 보기" className={`la-info-btn${pop?.kind === 'info' && pop.tourId === t.id ? ' is-on' : ''}`} onClick={e => openPop(e, { kind: 'info', tourId: t.id }, 320, 330)}><DashboardIcon name="lc-info" size={14} /></button>
                                    </span>
                                    <span className="la-meta is-first"><small>여행 기간</small><b>{dotted(m.start)} → {dotted(m.end)}</b></span>
                                    <span className="la-meta"><small>일정</small><b>{N ? `${N}박${N + 1}일` : '당일'}</b></span>
                                    <span className="la-meta"><small>인원</small><b>{t.travelers ? `${t.travelers}명` : '-'}</b></span>
                                    <span className="la-meta"><small>패키지</small><em className="la-pkg" data-plan={m.plan || 'none'}>{m.plan ? (m.plan === 'value' ? '실속패키지' : PACKAGE_LABELS[m.plan]) : '미정'}</em></span>
                                    <span className="la-prog">
                                        {pending[t.id] ? <span className="la-actions" onClick={e => e.stopPropagation()}><em>초안</em><button type="button" onClick={() => onResolveDraft(t.id, true)}>복원</button><button type="button" onClick={() => onResolveDraft(t.id, false)}>버리기</button></span>
                                            : isDirty ? <span className="la-actions" onClick={e => e.stopPropagation()}><em data-kind="dirty">변경됨</em><button type="button" className="is-save" disabled={!!savingId} onClick={() => onSave(t.id)}>{savingId === t.id ? '저장 중…' : '저장'}</button></span>
                                            : <em className="la-prog-pill" data-state={N ? m.bs : 'sel'}>{prog}</em>}
                                        <span className="la-segs">{m.nights.map(n => <i key={n.index} data-state={n.state} />)}</span>
                                    </span>
                                </div>
                                {open && <div className="la-nights">
                                    <div className="la-grid la-grid-head"><span /><span>예약일자</span><span className="is-c">인원</span><span>숙소지역</span><span>숙소정보</span><span>등급</span><span>방수</span><span>배정 구분</span><span>예약상태</span><span>예약메모</span></div>
                                    {!N && <p className="la-empty is-row">숙박일 확인 필요 · 카드 보기에서 일정을 확인해 주세요</p>}
                                    {m.nights.map(n => {
                                        const acc = n.acc, hasLodge = !!acc.name?.trim(), status = hasLodge ? acc.bookingStatus || LODGE_BOOKING_UNSENT : LODGE_BOOKING_UNSENT, d = n.date ? new Date(`${n.date}T00:00:00`) : null;
                                        const added = n.index >= m.planned;
                                        const dd = (kind: Pop['kind'], value: string, empty: boolean, title: string) => <button type="button" data-la-pop className={`la-dd${empty ? ' is-empty' : ''}`} disabled={locked} aria-label={`${nameOf(t)} ${n.index + 1}박 ${title}`} onClick={e => openPop(e, { kind, tourId: t.id, idx: n.index }, 220, 380)}><span>{value}</span><DashboardIcon name="lc-chevron-down" size={14} /></button>;
                                        return <div key={n.index} className="la-grid la-night">
                                            <span className="is-c">{added && <button type="button" className="la-remove" aria-label="숙박 삭제" title="추가한 숙박 삭제" disabled={locked} onClick={() => { onRemoveNight(t.id, n.index); flash(`${dotted(n.date)} 숙박을 삭제했어요`); }}><DashboardIcon name="lc-x" size={12} /></button>}</span>
                                            <span className="la-date">{n.date ? `${n.date} (${WD[d!.getDay()]})` : '날짜 미정'}{added && <em>추가</em>}</span>
                                            <span className="is-c la-pax">{t.travelers || '-'}</span>
                                            <button type="button" data-la-pop aria-label={`${nameOf(t)} ${n.index + 1}박 숙소지역`} className={`la-area${n.fromPlan ? ' is-planned' : ''}${!n.area ? ' is-empty' : ''}`} disabled={locked} title={n.fromPlan ? '계약 일정에서 불러온 지역입니다. 이 숙박일을 고치면 함께 저장됩니다.' : undefined}
                                                onClick={e => openPop(e, { kind: 'area', tourId: t.id, idx: n.index }, 220, 380)}><span>{n.area || '미정'}</span><DashboardIcon name="lc-chevron-down" size={14} /></button>
                                            <button type="button" data-la-pop aria-label={`${nameOf(t)} ${n.index + 1}박 숙소정보`} className={`la-hotel${hasLodge ? '' : ' is-empty'}`} disabled={locked || resourcesLoading} onClick={e => openPop(e, { kind: 'hotel', tourId: t.id, idx: n.index }, 340, 460)}>
                                                <DashboardIcon name={hasLodge ? 'lc-bed-double' : 'lc-circle-plus'} size={16} /><b>{hasLodge ? acc.name : '미배정'}</b><DashboardIcon name="lc-chevron-down" size={14} />
                                            </button>
                                            {dd('grade', acc.type || '미정', !acc.type, '등급')}
                                            {dd('roomPlan', acc.occupancy ? roomPlanLabel(acc.occupancy) : '미정', !acc.occupancy, '방수')}
                                            {dd('assign', acc.assignType || '미정', !acc.assignType, '배정 구분')}
                                            <button type="button" data-la-pop aria-label={`${nameOf(t)} ${n.index + 1}박 예약상태`} className="la-status" data-tone={hasLodge ? toneOfStatus(status) : 'off'} disabled={locked}
                                                onClick={e => { if (!hasLodge) { e.stopPropagation(); flash('숙소를 먼저 골라 주세요'); return; } openPop(e, { kind: 'status', tourId: t.id, idx: n.index }, 220, 460); }}>
                                                <i /><span>{lodgeBookingLabel(status)}</span><DashboardIcon name="lc-chevron-down" size={12} />
                                            </button>
                                            <input className="la-memo" aria-label={`${nameOf(t)} ${n.index + 1}박 예약메모`} disabled={locked} maxLength={2000} value={acc.adminMemo || ''} placeholder="메모" onChange={e => patchNight(m, n.index, { adminMemo: e.target.value })} />
                                        </div>;
                                    })}
                                    <div className="la-add-row">
                                        <button type="button" className="la-add" disabled={locked} onClick={() => { onAddNight(t.id, m.fill); flash(`${t.leadName || t.customerName || ''} · ${nextDate} 숙박을 추가했어요`); }}>
                                            <DashboardIcon name="lc-plus" size={14} />숙박 추가{nextDate && <span>{nextDate}</span>}
                                        </button>
                                    </div>
                                </div>}
                            </div>;
                        })}</div></div>}
                </div>
            </div>
            {renderPop()}
            {toast && <div className="la-toast" role="status">{toast}</div>}
        </div>
    );
}
