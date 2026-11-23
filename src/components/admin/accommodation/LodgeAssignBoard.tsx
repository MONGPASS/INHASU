import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AssignmentAccommodation, ContractPackageType } from '../../../utils/reservationAssignment';
import type { RegisteredLodge } from '../../../utils/registeredAssignmentResources';
import { selectResourceLodge } from '../../../utils/accommodationResourceSelection';
import { LODGE_BOOKING_STATUSES, LODGE_MAIL_STAGES, LODGE_RESERVATION_STATES, changeLodgeReservation, lodgeMailStatus, lodgeReservationStatus } from '../../../utils/lodgeBookingStatus';
import { ASSIGN_TYPE_OPTIONS, LODGE_AREA_OPTIONS, LODGE_GRADE_OPTIONS, PACKAGE_LABELS } from '../../../utils/accommodationSheet';
import { RoomCountInput } from './RoomCountInput';
import { CLEAR_LODGE, buildLodgeModel, tourStateOf, dateKeyOf as keyOf, dotted, sameText as same, tourNameOf as nameOf, withCurrent, type LodgeBoardTour, type LodgePatch as Patch, type NightState } from './lodgeBoardModel';
import { CATEGORY_OPTIONS } from '../../../utils/reservationWorkspace';
import { productCustomerHref, quoteCustomerHref } from '../../../utils/customerWorkspaceRoutes';
import { DashboardIcon } from '../dashboard/DashboardIcon';
import { AdminBadge, AdminChipGroup, AdminIconButton, AdminSearch, AdminSelect, AdminTextButton } from '../ui';
import './LodgeAssignBoard.css';

/**
 * 숙소 배정 · 표로 보기 — Claude Design ‘예약 관리 · 강력 개선안’ LodgingTable(2026-11-23).
 * 위: 조작부 한 줄(고객명·숙소명 찾기, 숙박 기간, 예약 범위, 배정 상태 칩), 아래: 머리글 한 줄 + 예약별 접히는 줄과 숙박일 표.
 * 값·저장은 예전 시트와 같다(예약 단위 배정 API, 브라우저 초안, 계약 일정 지역 불러오기).
 */
export type { LodgeBoardTour } from './lodgeBoardModel';
/** 배정 상태 칩: 예약 하나를 한 상태로 센다 — 배정 보드의 상태 카드와 같은 계산(tourStateOf, 가장 덜 된 숙박을 따른다). */
const STATE_CHIPS: Array<[NightState | '', string]> = [['', '전체'], ['none', '미배정'], ['sel', '배정 · 요청 전'], ['req', '진행 중'], ['ok', '배정 완료']];
/** 출발이 이만큼 가까우면 D-day·미배정 칸을 강조한다(가이드 배정 목록과 같은 기준). */
const URGENT_DAYS = 14;
const PERIODS = [{ value: 'all', label: '전체 기간' }, { value: 'week', label: '이번 주 체크인' }, { value: 'month', label: '이번 달 체크인' }] as const;
type Period = typeof PERIODS[number]['value'];
const GRID = 'la-grid';
const STATUS_TONE: Record<string, string> = { solid: 'mint', amber: 'orange', blue: 'blue', gray: 'gray' };
const toneOfStatus = (value: string) => value === '배정X' ? 'gray' : value === '취소요청' ? 'red' : STATUS_TONE[LODGE_BOOKING_STATUSES.find(s => s.value === value)?.tone || 'gray'];
const WD = '일월화수목금토';

type Pop = { kind: 'hotel' | 'area' | 'grade' | 'assign' | 'mail' | 'status' | 'category' | 'contractPackage' | 'info'; tourId: string; idx?: number; x: number; y: number; top: number; tab?: string };

export function LodgeAssignBoard({ tours, rowsOf, plannedNights, regionOf, contactOf, serials, lodges, lodgeRegions, resourcesLoading, dirty, pending, savingId, savingAll, clearedAreas, scope,
    onScope, onAreaCleared, onPatch, onCategory, onPackage, onSave, onSaveAll, onResolveDraft, onAddNight, onRemoveNight, onCardView, loading }: {
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
    onPackage: (tourId: string, type: ContractPackageType) => void;
    onSave: (tourId: string) => void; onSaveAll: () => void;
    onResolveDraft: (tourId: string, restore: boolean) => void;
    onAddNight: (tourId: string, fill?: Record<number, string>) => void; onRemoveNight: (tourId: string, index: number) => void;
    onCardView: () => void;
}) {
    const now = new Date(), todayK = keyOf(now);
    // 들어오면 전체 기간의 예약을 모두 보여 준다. 이번 주·이번 달을 고르면 그 기간에 숙박(체크인)이 있는 예약만 본다.
    const [period, setPeriod] = useState<Period>('all');
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
    const model = useMemo(() => tours.map(tour => buildLodgeModel(tour, { rows: rowsOf(tour), planned: plannedNights(tour), clearedAreas, lodgeRegions })), [tours, rowsOf, plannedNights, clearedAreas, lodgeRegions]);

    const weekStartK = (() => { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return keyOf(d); })();
    const weekEndK = keyOf(new Date(new Date(`${weekStartK}T00:00:00`).getTime() + 6 * 864e5)), monthK = todayK.slice(0, 7);
    const inPeriodKey = (k: string) => period === 'all' || (period === 'week' ? k >= weekStartK && k <= weekEndK : k.slice(0, 7) === monthK);
    const inPeriod = (m: typeof model[number]) => period === 'all' || (m.nights.length ? m.nights.some(n => inPeriodKey(n.date)) : !!m.start && inPeriodKey(m.start));
    const stateOf = (m: typeof model[number]) => tourStateOf(m.nights);
    const needle = q.trim().toLowerCase();
    const matches = model.filter(m => (!needle || `${m.tour.leadName || ''} ${m.tour.customerName || ''} ${m.tour.reservationNumber || ''} ${m.nights.map(n => n.acc.name || '').join(' ')}`.toLowerCase().includes(needle)) && inPeriod(m));
    const count = (k: NightState | '') => k ? matches.filter(m => stateOf(m) === k).length : matches.length;
    const visible = matches.filter(m => !kf || stateOf(m) === kf).sort((a, b) => (a.start || '9').localeCompare(b.start || '9'));
    const allOpen = visible.every(m => !closed.has(m.tour.id));
    const toggleAll = () => setClosed(allOpen ? new Set(visible.map(m => m.tour.id)) : new Set());
    const daysLeft = (start: string) => start ? Math.round((new Date(`${start}T00:00:00`).getTime() - new Date(`${todayK}T00:00:00`).getTime()) / 864e5) : null;

    // ── 고르기 창 ──
    const popTour = pop ? model.find(m => m.tour.id === pop.tourId) : undefined;
    const popNight = popTour && pop?.idx != null ? popTour.nights[pop.idx] : undefined;
    const patchNight = (m: typeof model[number], index: number, patch: Patch) => onPatch(m.tour.id, index, patch, m.fill);
    const choose = <T extends string,>(items: Array<{ value: T; label: string; sub?: string }>, current: string, pick: (v: T) => void) => items.map(o => (
        <button key={o.value || '__none'} type="button" className="la-pop-item" onClick={() => { pick(o.value); setPop(null); }}>
            <span><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>{current === o.value && <DashboardIcon name="lc-check" size={16} color="var(--adm-accent-strong)" />}
        </button>
    ));
    const renderPop = () => {
        if (!pop) return null;
        const style: React.CSSProperties = { left: pop.x, top: pop.y };
        if (!popTour) return null;
        const m = popTour, label = `${nameOf(m.tour)}${pop.idx != null ? ` ${pop.idx + 1}박` : ''}`;
        if (pop.kind === 'contractPackage') return <div className="la-pop" style={{ ...style, width: 220 }}>
            <div className="la-pop-head"><b>계약 패키지</b><small>{nameOf(m.tour)}</small></div>
            <div className="la-pop-list">{choose<ContractPackageType>([
                { value: 'value', label: '실속패키지' }, { value: 'full', label: '풀패키지' },
                { value: '', label: '자동 표시', sub: '숙소 등급과 예약 정보 기준' },
            ], m.tour.contractPackageType || '', type => onPackage(m.tour.id, type))}</div>
        </div>;
        if (pop.kind === 'info') {
            const href = m.tour.source === 'quote_booking' ? quoteCustomerHref(m.tour.bookingId, '/admin/accommodation-ops') : productCustomerHref(m.tour.bookingId, '/admin/accommodation-ops');
            const bookingId = encodeURIComponent(m.tour.bookingId);
            const contractHref = m.tour.source === 'quote_booking' ? `/계약서.html?adminId=${bookingId}&preview=1` : `/documents/contract/${bookingId}?preview=1`;
            const done = m.nights.filter(n => n.state !== 'none').length, ok = m.nights.filter(n => n.state === 'ok').length;
            return <div className="la-pop la-info" role="region" aria-label={`${nameOf(m.tour)} 예약 정보`} style={style}>
                <div className="la-info-head"><b>{nameOf(m.tour)}</b><em>{m.tour.source === 'quote_booking' ? '견적 예약' : '상품 예약'}</em><small>{m.tour.reservationNumber ? `#${m.tour.reservationNumber}` : ''}</small>
                    <button type="button" className="la-info-close" aria-label="예약 정보 닫기" onClick={() => setPop(null)}><DashboardIcon name="lc-x" size={16} /></button>
                </div>
                <dl>
                    <div><dt>연락처</dt><dd>{contactOf(m.tour) || '등록 안 됨'}</dd></div>
                    <div><dt>여행 기간</dt><dd>{dotted(m.start)} → {dotted(m.end)}</dd></div>
                    <div><dt>인원</dt><dd>{m.tour.travelers ? `${m.tour.travelers}명` : '-'} · {m.plan ? PACKAGE_LABELS[m.plan] : '패키지 미정'}</dd></div>
                    <div><dt>지역</dt><dd>{regionOf(m.tour)}</dd></div>
                    <div><dt>분류</dt><dd><button type="button" data-la-pop aria-label={`${nameOf(m.tour)} 분류`} disabled={!!pending[m.tour.id] || savingId === m.tour.id} onClick={e => openPop(e, { kind: 'category', tourId: m.tour.id }, 220, 420)}>{m.tour.assignmentCategory || '미정'}<DashboardIcon name="lc-chevron-down" size={12} /></button></dd></div>
                    <div><dt>숙소</dt><dd>{done}/{m.nights.length}박 배정 · {ok}박 확정</dd></div>
                </dl>
                <section className="la-contract-preview">
                    <div className="la-contract-heading"><b>여행계약서</b>
                        <a href={contractHref} target="_blank" rel="noopener noreferrer" aria-label={`${nameOf(m.tour)} 여행계약서 새 창에서 열기`}>새 창에서 열기<DashboardIcon name="lc-external-link" size={14} /></a>
                    </div>
                    <iframe key={contractHref} src={contractHref} title={`${nameOf(m.tour)} 여행계약서 미리보기`} referrerPolicy="no-referrer" />
                </section>
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
                    <button type="button" className="la-pop-item" onClick={() => { patchNight(m, idx, CLEAR_LODGE); setPop(null); }}><span><b>미배정</b><small>숙소 선택 해제</small></span>{!acc.name?.trim() && <DashboardIcon name="lc-check" size={16} color="var(--adm-accent-strong)" />}</button>
                    {list.map(l => <button key={l.id} type="button" className="la-pop-item" onClick={() => {
                        onPatch(m.tour.id, idx, { ...selectResourceLodge(n.night, l).accommodation, ...(n.area ? { location: n.area, region: n.area } : {}) }, m.fill);
                        setPop(null); flash(`${label} · ${l.name} 선택했어요`);
                    }}><span><b>{l.name}</b><small>{[l.region || l.location, l.type].filter(Boolean).join(' · ')}</small></span>{(acc.id ? acc.id === l.id : same(acc.name, l.name)) && <DashboardIcon name="lc-check" size={16} color="var(--adm-accent-strong)" />}</button>)}
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
        if (pop.kind === 'assign') return simple('배정 구분', [none, ...withCurrent(ASSIGN_TYPE_OPTIONS, acc.assignType).map(v => ({ value: v, label: v }))], acc.assignType || '', v => patchNight(m, idx, { assignType: v }));
        const isMail = pop.kind === 'mail';
        return simple(isMail ? '메일발송' : '예약상태', (isMail ? LODGE_MAIL_STAGES : LODGE_RESERVATION_STATES).map(value => ({ value, label: value })),
            isMail ? lodgeMailStatus(acc) : lodgeReservationStatus(acc.bookingStatus), value => {
                if (!acc.name?.trim() && value !== '배정X' && value !== '발송전') { flash('숙소를 먼저 골라 주세요'); return; }
                patchNight(m, idx, isMail ? { mailStatus: value } : changeLodgeReservation(acc, value));
            }, acc.name || label);
    };

    const dotTone: Record<string, string> = { none: 'is-none', sel: 'is-sel', req: 'is-req', ok: 'is-ok' };
    const chips = STATE_CHIPS.map(([k, l]) => ({ value: (k || 'all') as string, label: <>{k && <i className={`la-chip-dot ${dotTone[k]}`} aria-hidden="true" />}{l}</>, count: count(k), disabled: !!k && !count(k) && kf !== k }));
    const head = <div className={`${GRID} la-grid-head`}><span>예약일자</span><span className="is-r">인원</span><span>숙소지역</span><span>숙소정보</span><span>등급</span><span>방수</span><span>배정 구분</span><span>메일발송</span><span>메일발송일자</span><span>예약상태</span><span>예약메모</span></div>;

    return (
        <div className="la">
            <div className="la-tools">
                <div className="la-tools-left">
                    <AdminSearch value={q} onChange={setQ} placeholder="고객명·숙소명으로 찾기" aria-label="고객명·숙소명 검색" className="la-search" />
                    <AdminSelect aria-label="숙박 기간" value={period} onChange={v => setPeriod(v as Period)} className="la-select la-select-period" options={PERIODS.map(p => ({ value: p.value, label: p.label }))} />
                    <AdminSelect aria-label="예약 범위" value={scope} onChange={v => onScope(v as 'confirmed' | 'all')} className="la-select la-select-scope" options={[{ value: 'confirmed', label: '확정 예약만' }, { value: 'all', label: '전체 예약' }]} />
                </div>
                <AdminChipGroup label="배정 상태로 거르기" className="la-chips" items={chips} value={kf || 'all'} onChange={v => setKf(v === 'all' ? '' : v as NightState)} />
            </div>

            {dirty.size > 0 && <div className="la-savebar" role="status">
                <span>저장하지 않은 예약 <b>{dirty.size}</b>팀 · 변경 내용은 브라우저 초안으로도 보관돼요.</span>
                <button type="button" disabled={!!savingId || savingAll} onClick={onSaveAll}><DashboardIcon name="lc-check" size={15} />{savingAll ? '저장하는 중…' : '모두 저장'}</button>
            </div>}

            <section className="la-sheet" aria-label="숙소 배정 표">
                {loading ? <p className="la-empty">예약을 불러오고 있어요…</p>
                    : !visible.length ? <p className="la-empty">조건에 맞는 예약이 없어요.</p>
                    : <div className="la-scroll"><div className="la-inner">{head}{visible.map(m => {
                        const t = m.tour, open = !closed.has(t.id), N = m.nights.length, done = m.nights.filter(n => n.state !== 'none').length, ok = m.nights.filter(n => n.state === 'ok').length;
                        const locked = !!pending[t.id] || savingId === t.id, isDirty = dirty.has(t.id), serial = serials.get(t.id) || 0;
                        const dl = daysLeft(m.start), urgent = dl !== null && dl >= 0 && dl <= URGENT_DAYS, missing = N - done;
                        const badge = !N ? { text: '숙박 없음', tone: 'neutral' as const, strong: false }
                            : ok === N ? { text: '모두 확정', tone: 'info' as const, strong: false }
                            : missing && urgent ? { text: `${missing}박 미배정 · 출발 ${dl}일 전`, tone: 'danger' as const, strong: false }
                            : { text: `${done} / ${N}박 배정`, tone: missing ? 'warn' as const : 'neutral' as const, strong: false };
                        const toggle = () => setClosed(prev => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next; });
                        const nextDate = (() => { const last = m.nights[N - 1]?.date || m.end; if (!last) return ''; const d = new Date(`${last}T00:00:00`); d.setDate(d.getDate() + 1); return dotted(keyOf(d)); })();
                        const endShort = m.end && m.start && m.end.slice(0, 4) === m.start.slice(0, 4) ? m.end.slice(5).replace('-', '.') : dotted(m.end);
                        const addNight = () => { onAddNight(t.id, m.fill); flash(`${t.leadName || t.customerName || ''} · ${nextDate} 숙박을 추가했어요`); };
                        return <div key={t.id} id={`acc-row-${t.id}`} className={`la-tour${urgent && missing ? ' is-urgent' : ''}${isDirty ? ' is-dirty' : ''}`}>
                            <div className="la-tour-head">
                                <AdminIconButton label={`${nameOf(t)} 숙박 일정 ${open ? '접기' : '펼치기'}`} variant="outlined" size="sm" aria-expanded={open} onClick={toggle} className={`la-caret${open ? ' is-open' : ''}`}>
                                    <DashboardIcon name="lc-chevron-down" size={16} />
                                </AdminIconButton>
                                <span className="la-no">#{serial || '-'}</span>
                                <span className="la-name"><b>{nameOf(t)}</b>
                                    <button type="button" data-la-pop aria-label={`${nameOf(t)} 예약 정보 보기`} title="예약 정보 보기" aria-expanded={pop?.kind === 'info' && pop.tourId === t.id} className={`la-info-btn${pop?.kind === 'info' && pop.tourId === t.id ? ' is-on' : ''}`} onClick={e => openPop(e, { kind: 'info', tourId: t.id }, 480, Math.min(660, window.innerHeight - 24))}><DashboardIcon name="lc-info" size={14} /></button>
                                </span>
                                {dl !== null && <AdminBadge tone="neutral" strong={urgent}>{dl > 0 ? `D-${dl}` : dl === 0 ? 'D-DAY' : '진행 중'}</AdminBadge>}
                                <span className="la-range">{dotted(m.start)} → {endShort}</span>
                                <span className="la-sub">{N ? `${N}박 ${N + 1}일` : '당일'} · {t.travelers ? `${t.travelers}명` : '인원 미정'}</span>
                                <button type="button" className="la-pkg" data-plan={m.plan || 'none'} data-la-pop
                                    disabled={!!pending[t.id] || !!savingId || savingAll} aria-label={`${nameOf(t)} 계약 패키지 변경 · ${m.plan ? PACKAGE_LABELS[m.plan] : '미정'}`}
                                    aria-expanded={pop?.kind === 'contractPackage' && pop.tourId === t.id}
                                    onClick={e => openPop(e, { kind: 'contractPackage', tourId: t.id }, 220, 200)}>
                                    {m.plan ? (m.plan === 'value' ? '실속패키지' : PACKAGE_LABELS[m.plan]) : '패키지 미정'}<DashboardIcon name="lc-chevron-down" size={14} />
                                </button>
                                <span className="la-gap" />
                                {N > 0 && <span className="la-night-chips" aria-hidden="true">{m.nights.map(n => <i key={n.index} data-state={n.state}>{n.date ? n.date.slice(5).replace('-', '.') : '?'}</i>)}</span>}
                                {pending[t.id] ? <span className="la-actions"><em>초안</em><button type="button" onClick={() => onResolveDraft(t.id, true)}>복원</button><button type="button" onClick={() => onResolveDraft(t.id, false)}>버리기</button></span>
                                    : isDirty ? <span className="la-actions"><em data-kind="dirty">변경됨</em><button type="button" className="is-save" disabled={!!savingId} onClick={() => onSave(t.id)}>{savingId === t.id ? '저장 중…' : '저장'}</button></span>
                                    : <AdminBadge tone={badge.tone} size="md">{badge.text}</AdminBadge>}
                            </div>
                            {open && <div className="la-nights">
                                {!N && <div className="la-none">
                                    <div><b>숙박이 아직 없습니다</b><small>{m.start && m.end && m.start === m.end ? '당일 일정이에요. 숙박이 필요하면 직접 추가해 주세요.' : '여행 기간을 확인하거나 숙박을 직접 추가해 주세요.'}</small></div>
                                    <button type="button" className="la-add" disabled={locked} onClick={addNight}><DashboardIcon name="lc-plus" size={14} />숙박 추가{nextDate && <span>{nextDate}</span>}</button>
                                </div>}
                                {m.nights.map(n => {
                                    const acc = n.acc, hasLodge = !!acc.name?.trim(), status = lodgeReservationStatus(acc.bookingStatus), mail = lodgeMailStatus(acc), d = n.date ? new Date(`${n.date}T00:00:00`) : null;
                                    const added = n.index >= m.planned;
                                    const dd = (kind: Pop['kind'], value: string, empty: boolean, title: string) => <button type="button" data-la-pop className={`la-dd${empty ? ' is-empty' : ''}`} disabled={locked} aria-label={`${nameOf(t)} ${n.index + 1}박 ${title}`} onClick={e => openPop(e, { kind, tourId: t.id, idx: n.index }, 220, 380)}><span>{value}</span><DashboardIcon name="lc-chevron-down" size={14} /></button>;
                                    return <div key={n.index} className={`${GRID} la-night`}>
                                        <span className="la-date-cell">
                                            <span className="la-date">{n.date ? `${n.date.slice(5).replace('-', '.')} (${WD[d!.getDay()]})` : '날짜 미정'}</span>
                                            <small>{n.index + 1}박째{added && <em>추가</em>}</small>
                                            {added && <button type="button" className="la-remove" aria-label="숙박 삭제" title="추가한 숙박 삭제" disabled={locked} onClick={() => { onRemoveNight(t.id, n.index); flash(`${dotted(n.date)} 숙박을 삭제했어요`); }}><DashboardIcon name="lc-x" size={12} /></button>}
                                        </span>
                                        <span className="is-r la-pax">{t.travelers || '-'}</span>
                                        <button type="button" data-la-pop aria-label={`${nameOf(t)} ${n.index + 1}박 숙소지역`} className={`la-area${n.fromPlan ? ' is-planned' : ''}${!n.area ? ' is-empty' : ''}`} disabled={locked} title={n.fromPlan ? '계약 일정에서 불러온 지역입니다. 이 숙박일을 고치면 함께 저장됩니다.' : undefined}
                                            onClick={e => openPop(e, { kind: 'area', tourId: t.id, idx: n.index }, 220, 380)}><span>{n.area || '지역'}</span><DashboardIcon name="lc-chevron-down" size={14} /></button>
                                        <button type="button" data-la-pop aria-label={`${nameOf(t)} ${n.index + 1}박 숙소정보`} className={`la-hotel${hasLodge ? '' : urgent ? ' is-empty is-urgent' : ' is-empty'}`} disabled={locked || resourcesLoading} onClick={e => openPop(e, { kind: 'hotel', tourId: t.id, idx: n.index }, 340, 460)}>
                                            {hasLodge ? <><DashboardIcon name="lc-bed-double" size={16} /><b>{acc.name}</b><DashboardIcon name="lc-chevron-down" size={14} /></> : <b>+ 숙소 고르기</b>}
                                        </button>
                                        {dd('grade', acc.type || '미정', !acc.type, '등급')}
                                        <label className="la-room-count"><RoomCountInput aria-label={`${nameOf(t)} ${n.index + 1}박 방수`} disabled={locked}
                                            value={acc.roomCount} onChange={count => patchNight(m, n.index, { roomCount: count })} /></label>
                                        {dd('assign', acc.assignType || '미정', !acc.assignType, '배정 구분')}
                                        <button type="button" data-la-pop aria-label={`${nameOf(t)} ${n.index + 1}박 메일발송`} className="la-status" data-tone={mail.endsWith('완료') ? 'orange' : 'gray'} disabled={locked}
                                            onClick={e => openPop(e, { kind: 'mail', tourId: t.id, idx: n.index }, 220, 300)}>
                                            <i /><small>메일발송</small><span>{mail}</span><DashboardIcon name="lc-chevron-down" size={14} />
                                        </button>
                                        <label className="la-mail-date"><small>메일발송일자</small><input type="date" aria-label={`${nameOf(t)} ${n.index + 1}박 메일발송일자`} disabled={locked}
                                            value={acc.mailSentDate || ''} onChange={e => patchNight(m, n.index, { mailSentDate: e.target.value })} /></label>
                                        <button type="button" data-la-pop aria-label={`${nameOf(t)} ${n.index + 1}박 예약상태`} className="la-status" data-tone={toneOfStatus(status)} disabled={locked}
                                            onClick={e => openPop(e, { kind: 'status', tourId: t.id, idx: n.index }, 220, 340)}>
                                            <i /><small>예약상태</small><span>{status || '미정'}</span><DashboardIcon name="lc-chevron-down" size={14} />
                                        </button>
                                        <input className="la-memo" aria-label={`${nameOf(t)} ${n.index + 1}박 예약메모`} disabled={locked} maxLength={2000} value={acc.adminMemo || ''} title={acc.adminMemo || undefined} placeholder="메모" onChange={e => patchNight(m, n.index, { adminMemo: e.target.value })} />
                                    </div>;
                                })}
                                {N > 0 && <div className="la-add-row">
                                    <button type="button" className="la-add" disabled={locked} onClick={addNight}><DashboardIcon name="lc-plus" size={14} />숙박 추가{nextDate && <span>{nextDate}</span>}</button>
                                </div>}
                            </div>}
                        </div>;
                    })}</div></div>}
                {!loading && model.length > 0 && <footer className="la-foot">
                    <span>{model.length}건 중 {visible.length}건{kf || period !== 'all' || needle ? ' · 조건에 맞는 예약' : ''}</span>
                    {visible.length > 0 && <AdminTextButton onClick={toggleAll}>{allOpen ? '모두 접기' : '모두 펼치기'}</AdminTextButton>}
                </footer>}
            </section>
            {renderPop()}
            {toast && <div className="la-toast" role="status">{toast}</div>}
        </div>
    );
}
