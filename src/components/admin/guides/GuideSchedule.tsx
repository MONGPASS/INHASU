import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchV7Assignments, saveV7Assignment, type V7AssignmentItem } from '../../../utils/reservationV7';
import { loadRegisteredAssignmentResources, type RegisteredGuide } from '../../../utils/registeredAssignmentResources';
import { selectResourceGuide } from '../../../utils/accommodationResourceSelection';
import { guideOverlaps, overlapLabel, sameGuide } from '../../../utils/assignmentAvailability';
import { isUpcomingTour, tourMonthLabel, tourSerials, tripLengthLabel } from '../../../utils/accommodationSheet';
import { productCustomerHref, quoteCustomerHref } from '../../../utils/customerWorkspaceRoutes';
import { Ico } from '../v7/v7Ui';
import { confirmGuideConflict } from '../v7/guideMenuItems';
import { activeBooking, coversDay, guideRows, hasGuide, inMonth, laneBookings, monthDays, shiftMonth, type ScheduleBooking } from './guideScheduleModel';
import './GuideSchedule.css';

type Item = V7AssignmentItem & ScheduleBooking & { customerName?: string; leadName?: string; travelers?: number; productName?: string; contractData?: { region?: string } };
type Tone = 'cur' | 'mint' | 'red' | 'gray';
interface PopItem { key: string; name: string; sub: string; tag?: { label: string; tone: Tone }; muted?: boolean; onPick: () => void }
interface Pop { x: number; y: number; title: string; items: PopItem[]; emptyText?: string; activeKey?: string }

const WD = ['일', '월', '화', '수', '목', '금', '토'];
const DAY_W = 44, NAME_W = 200;
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nameOf = (b: Item) => (b.leadName || b.customerName || '이름 없음').trim();
const regionOf = (b: Item) => b.contractData?.region || b.productName || '';
const hrefOf = (b: Item) => b.source === 'quote_booking' ? quoteCustomerHref(b.id, '/admin/quote-desk/resources?view=schedule') : productCustomerHref(b.id, '/admin/quote-desk/resources?view=schedule');
const md = (key?: string) => (key || '').slice(5).replace('-', '.');
const period = (b: Item) => `${md(b.startDate)}→${md(b.endDate || b.startDate)}`;
const people = (b: Item) => (b.travelers ? `${b.travelers}명` : '인원 미정');
/** 버튼 아래(공간이 없으면 위)에 여는 고정 위치 팝오버 좌표 — 디자인 v4와 같은 계산 */
const popAt = (target: HTMLElement, width = 320, height = 260) => {
    const r = target.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight;
    return { x: Math.max(12, Math.min(r.left, vw - width - 12)), y: r.bottom + 6 > vh - height ? Math.max(12, r.top - height) : r.bottom + 6 };
};

/**
 * 가이드 배정 현황(디자인: Admin Dashboard redesign · 05-2 가이드 배정 현황 v4).
 * 가이드별·날짜별로 누가 언제 일하는지 보고, 빈칸이나 막대를 눌러 바로 배정한다.
 * 저장은 기존 배정 API(버전 확인 + 서버 가이드 중복 확인)를 그대로 쓴다.
 */
export function GuideSchedule({ accountId }: { accountId: string }) {
    const [items, setItems] = useState<Item[]>([]);
    const [guides, setGuides] = useState<RegisteredGuide[]>([]);
    const [loading, setLoading] = useState(true);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [toast, setToast] = useState('');
    const [savingKey, setSavingKey] = useState('');
    const [month, setMonth] = useState(() => todayKey().slice(0, 7));
    const [view, setView] = useState<'calendar' | 'list'>('calendar');
    const [pop, setPop] = useState<Pop | null>(null);
    const mounted = useRef(true), generation = useRef(0), toastTimer = useRef<number | undefined>(undefined);
    // 개발 모드에서는 화면이 두 번 붙었다 떨어지므로 붙을 때마다 다시 켠다.
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; window.clearTimeout(toastTimer.current); }; }, []);
    useEffect(() => {
        if (!pop) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPop(null); };
        window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
    }, [pop]);
    const flash = (text: string) => { window.clearTimeout(toastTimer.current); setToast(text); toastTimer.current = window.setTimeout(() => { if (mounted.current) setToast(''); }, 2200); };

    // 예약은 받는 대로 먼저 그리고, 등록 가이드 목록은 따로 채운다(느리거나 실패해도 예약에 적힌 가이드로 보여 준다).
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
            setGuides(result.guides);
            if (result.warnings.length) setWarnings(prev => [...prev, ...result.warnings]);
        }).catch(() => { if (live()) setWarnings(prev => [...prev, '등록 가이드를 불러오지 못했습니다. 예약에 적힌 가이드만 보여 줍니다.']); });
        await Promise.allSettled([bookings, resources]);
    }, [accountId]);
    useEffect(() => { void load(); }, [load]);

    const active = useMemo(() => items.filter(activeBooking), [items]);
    const days = useMemo(() => monthDays(month), [month]);
    const today = todayKey();
    const rows = useMemo(() => guideRows(guides.map(g => ({ id: g.id, name: g.name })), items, days), [guides, items, days]);
    const unassigned = useMemo(() => active.filter(b => !hasGuide(b)), [active]);
    const monthStats = useMemo(() => {
        const inThis = active.filter(b => inMonth(b, days));
        const conflicts = rows.reduce((n, row) => n + laneBookings(row.bookings, days, active, row.guide).filter(x => x.overlap).length, 0);
        return { assigned: inThis.filter(hasGuide).length, unassigned: inThis.filter(b => !hasGuide(b)).length, conflicts };
    }, [active, days, rows]);

    // 배정 저장. 팝오버에서 겹침을 이미 확인했으면 서버 중복 확인을 다시 묻지 않는다.
    const assign = async (booking: Item, guide: RegisteredGuide | null, confirmed = false): Promise<void> => {
        if (savingKey) return;
        setPop(null); setSavingKey(booking.key);
        let retry = false;
        try {
            const assignment = { ...booking.assignment, guide: guide ? selectResourceGuide(booking.assignment.guide, guide) : { id: '', name: '', phone: '' } };
            const saved = await saveV7Assignment(booking, assignment, { allowGuideConflict: confirmed }) as Item;
            if (!mounted.current) return;
            setItems(prev => prev.map(x => x.key === saved.key ? { ...x, ...saved } : x));
            flash(guide ? `${nameOf(booking)} · ${guide.name} 배정했어요` : `${nameOf(booking)} · 가이드 배정을 해제했어요`);
        } catch (e: any) {
            if (mounted.current && !confirmed && confirmGuideConflict(e)) retry = true;
            else if (mounted.current) { flash(e?.message || '배정을 저장하지 못했습니다.'); void load(); }
        } finally { if (mounted.current) setSavingKey(''); }
        if (retry) return assign(booking, guide, true);
    };
    const confirmOverlap = (guide: RegisteredGuide, overlap: { booking: any } | undefined) =>
        !overlap || window.confirm(`${guide.name} 가이드는 같은 기간에 ${overlapLabel(overlap.booking)} 일정이 있습니다. 그래도 배정할까요?`);

    // 막대를 누르면: 현재 가이드 → 가능 → 교대 → 겹침 순서의 가이드 목록
    const openGuidePop = (target: HTMLElement, booking: Item) => {
        const current = booking.assignment?.guide;
        const ranked = guides.map(guide => {
            const found = guideOverlaps(active, guide, booking);
            const overlap = found.find(x => x.kind === 'overlap'), handover = found.find(x => x.kind === 'handover');
            const cur = hasGuide(booking) && sameGuide(current, guide);
            return { guide, overlap, handover, cur, rank: cur ? -1 : overlap ? 2 : handover ? 1 : 0 };
        }).sort((a, b) => a.rank - b.rank || a.guide.name.localeCompare(b.guide.name, 'ko-KR'));
        const list: PopItem[] = ranked.map(({ guide, overlap, handover, cur }) => ({
            key: guide.id, name: guide.name,
            sub: overlap ? `겹침 · ${overlapLabel(overlap.booking).replace('~', '→')}` : handover ? `같은 날 교대 · ${overlapLabel(handover.booking).replace('~', '→')}` : '등록된 가이드',
            tag: cur ? { label: '현재', tone: 'cur' } : overlap ? { label: '겹침', tone: 'red' } : handover ? { label: '교대', tone: 'gray' } : { label: '가능', tone: 'mint' },
            onPick: () => { if (cur) { setPop(null); return; } if (confirmOverlap(guide, overlap)) void assign(booking, guide, !!overlap); },
        }));
        if (hasGuide(booking)) list.push({ key: 'none', name: '배정 해제', sub: '미배정 투어로 옮겨요', muted: true, onPick: () => void assign(booking, null) });
        list.push({ key: 'open', name: '고객 화면 열기', sub: `${nameOf(booking)} · ${tripLengthLabel(booking.startDate, booking.endDate)}`, muted: true, onPick: () => { window.location.assign(hrefOf(booking)); } });
        setPop({ ...popAt(target), title: `${nameOf(booking)} · ${period(booking)} 가이드`, items: list, activeKey: booking.key,
            emptyText: guides.length ? undefined : '등록된 가이드가 없어요. 등록 정보에서 가이드를 먼저 추가해 주세요.' });
    };
    // 가이드 줄의 빈 날짜를 누르면: 그날 진행하는 미배정 투어
    const openDayPop = (target: HTMLElement, guide: RegisteredGuide, day: string) => {
        const list: PopItem[] = unassigned.filter(b => coversDay(b, day)).map(b => {
            const found = guideOverlaps(active, guide, b), overlap = found.find(x => x.kind === 'overlap'), handover = found.find(x => x.kind === 'handover');
            return { key: b.key, name: nameOf(b), sub: `${period(b)} · ${tripLengthLabel(b.startDate, b.endDate)} · ${people(b)}`,
                tag: overlap ? { label: '겹침', tone: 'red' } : handover ? { label: '교대', tone: 'gray' } : { label: '배정', tone: 'mint' },
                onPick: () => { if (confirmOverlap(guide, overlap)) void assign(b, guide, !!overlap); } };
        });
        setPop({ ...popAt(target), title: `${guide.name} · ${md(day)} 배정할 투어`, items: list, emptyText: '이날 진행하는 미배정 투어가 없어요' });
    };

    const serials = useMemo(() => tourSerials(items.map(b => ({ id: b.key, createdAt: (b as any).createdAt, startDate: b.startDate }))), [items]);
    const upcoming = useMemo(() => active.filter(b => isUpcomingTour(b, today)).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '')), [active, today]);
    const grid = { gridTemplateColumns: `repeat(${days.length}, minmax(${DAY_W}px, 1fr))` };
    const dayInfo = days.map(day => { const wd = new Date(`${day}T00:00:00`).getDay(); return { day, wd, weekend: wd === 0 || wd === 6, today: day === today, weekStart: wd === 1 && day.slice(8) !== '01' }; });
    const dayClass = (d: typeof dayInfo[number]) => `${d.weekend ? ' is-weekend' : ''}${d.today ? ' is-today' : ''}${d.weekStart ? ' is-week' : ''}`;
    const stats: Array<[string, number, string, string]> = view === 'calendar'
        ? [['배정', monthStats.assigned, '팀', 'mint'], ['미배정', monthStats.unassigned, '팀', 'orange'], ['중복', monthStats.conflicts, '건', 'red']]
        : [['오늘 이후 투어', upcoming.length, '팀', 'mint'], ['미배정', upcoming.filter(b => !hasGuide(b)).length, '팀', 'orange']];

    const renderRow = (key: string, label: string, sub: string, kind: 'guide' | 'unregistered' | 'unassigned', list: Item[], guide?: RegisteredGuide, conflictGuide?: { id?: string; name: string }) => {
        const placed = laneBookings(list, days, active, conflictGuide), lanes = Math.max(1, ...placed.map(p => p.lane + 1));
        const hasDup = placed.some(p => p.overlap);
        return (
            <div key={key} className={`gs-row is-${kind}`}>
                <div className="gs-name">
                    <b className={hasDup ? 'is-dup' : ''}>{label}</b>
                    <span>{sub}</span>
                </div>
                <div className="gs-track">
                    <div className="gs-cells" style={grid}>
                        {dayInfo.map((d, i) => {
                            const busy = placed.some(p => p.from <= i && p.to >= i);
                            return guide && !busy
                                ? <button key={d.day} type="button" className={`gs-cell is-free${dayClass(d)}`} aria-label={`${label} ${md(d.day)} 배정하기`} title={`${md(d.day)} 비어 있음 — 눌러서 배정`} onClick={e => openDayPop(e.currentTarget, guide, d.day)} />
                                : <span key={d.day} className={`gs-cell${dayClass(d)}`} />;
                        })}
                    </div>
                    <div className="gs-bars" style={{ ...grid, gridTemplateRows: `repeat(${lanes}, 44px)` }}>
                        {placed.map(({ booking, lane, from, to, overlap }) => {
                            const b = booking as Item, none = kind === 'unassigned';
                            return (
                                <button key={b.key} type="button" disabled={savingKey === b.key}
                                    className={`gs-bar${overlap ? ' is-dup' : none ? ' is-open' : ''}${pop?.activeKey === b.key ? ' is-active' : ''}`}
                                    style={{ gridColumn: `${from + 1} / ${to + 2}`, gridRow: lane + 1 }}
                                    title={`${nameOf(b)} · ${regionOf(b)} · ${tripLengthLabel(b.startDate, b.endDate)}`}
                                    onClick={e => openGuidePop(e.currentTarget, b)}>
                                    {overlap && <span className="gs-dup">중복</span>}
                                    <span className="gs-bar-text"><b>{nameOf(b)}</b><span>{period(b)} · {people(b)}</span></span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="gs">
            <div className="gs-bar-top">
                <div className="gs-seg" role="group" aria-label="보기">
                    {([['calendar', '달력'], ['list', '목록']] as const).map(([key, label]) =>
                        <button key={key} type="button" aria-pressed={view === key} className={view === key ? 'is-on' : ''} onClick={() => { setView(key); setPop(null); }}>{label}</button>)}
                </div>
                {view === 'calendar' && <div className="gs-month">
                    <button type="button" className="gs-round" aria-label="이전 달" onClick={() => { setMonth(m => shiftMonth(m, -1)); setPop(null); }}><Ico name="lc-chevron-left" size={16} /></button>
                    <b>{month.slice(0, 4)}년 {Number(month.slice(5))}월</b>
                    <button type="button" className="gs-round" aria-label="다음 달" onClick={() => { setMonth(m => shiftMonth(m, 1)); setPop(null); }}><Ico name="lc-chevron-right" size={16} /></button>
                    <button type="button" className="gs-pill" onClick={() => { setMonth(today.slice(0, 7)); setPop(null); }}>이번 달</button>
                </div>}
                <span className="gs-spacer" />
                <div className="gs-stats">
                    {stats.map(([label, n, unit, tone]) => <span key={label} className="gs-stat"><i data-tone={tone} />{label}<b>{n}</b>{unit}</span>)}
                </div>
                <button type="button" className="gs-pill" disabled={loading} onClick={() => { setPop(null); void load().then(() => { if (mounted.current) flash('최신 배정 현황을 불러왔어요'); }); }}>
                    <Ico name="lc-refresh-cw" size={14} />새로고침
                </button>
            </div>
            {warnings.map((w, i) => <div key={i} className="gs-notice" role="alert">{w}</div>)}

            {loading && !items.length ? <p className="gs-empty">배정 현황을 불러오고 있어요…</p> : view === 'calendar' ? <>
                <div className="gs-card" role="region" aria-label={`${month} 가이드 배정 달력`} tabIndex={0}>
                    <div className="gs-cal" style={{ minWidth: NAME_W + days.length * DAY_W }}>
                        <div className="gs-head">
                            <div className="gs-name">가이드</div>
                            <div className="gs-days" style={grid}>
                                {dayInfo.map(d => <div key={d.day} className={`gs-day${dayClass(d)}`}><span className="gs-num">{Number(d.day.slice(8))}</span><span>{WD[d.wd]}</span></div>)}
                            </div>
                        </div>
                        {rows.map(row => {
                            const registered = row.registered ? guides.find(g => g.id === row.guide.id) : undefined;
                            const count = row.bookings.filter(b => inMonth(b, days)).length;
                            const sub = row.registered ? (count ? `${count}팀` : '이 달 비어 있음') : `등록 안 된 가이드${count ? ` · ${count}팀` : ''}`;
                            return renderRow(`${row.guide.id || ''}:${row.guide.name}`, row.guide.name, sub, row.registered ? 'guide' : 'unregistered', row.bookings as Item[], registered, row.guide);
                        })}
                        {(() => {
                            const count = unassigned.filter(b => inMonth(b, days)).length;
                            return renderRow('unassigned', '미배정 투어', count ? `${count}팀 · 눌러서 배정` : '이 달 없음', 'unassigned', unassigned as Item[]);
                        })()}
                    </div>
                </div>
                <div className="gs-legend">
                    <span><i data-tone="mint" />배정</span>
                    <span><i data-tone="red" />중복</span>
                    <span><i data-tone="orange" />미배정</span>
                    <span>빈 칸을 누르면 그날 배정할 투어를, 막대를 누르면 가이드를 바꿀 수 있어요.</span>
                </div>
            </> : (
                <div className="gs-card" role="region" aria-label="가이드 배정 목록" tabIndex={0}>
                    <div className="gs-list">
                        <div className="gs-list-row is-head">
                            <span>번호</span><span>고객명</span><span>도착일자</span><span>출발일자</span><span className="is-c">인원</span><span>일정</span><span>지역</span><span className="is-c">월</span><span>가이드명</span><span>전화번호</span><span>차량</span><span>기사 연락처</span>
                        </div>
                        {upcoming.length === 0 && <p className="gs-empty">오늘 이후 진행하는 투어가 없어요.</p>}
                        {upcoming.map(b => {
                            const guide = b.assignment?.guide, assigned = hasGuide(b);
                            const dup = assigned && guideOverlaps(active, guide!, b).some(x => x.kind === 'overlap');
                            const cell = (value?: string) => <span className={value ? '' : 'is-none'} title={value || undefined}>{value || '-'}</span>;
                            return (
                                <div key={b.key} className="gs-list-row">
                                    <span className="is-low">{serials.get(b.key) ?? '-'}</span>
                                    <a href={hrefOf(b)}><b>{nameOf(b)}</b></a>
                                    <span>{b.startDate || '-'}</span><span>{b.endDate || '-'}</span>
                                    <span className="is-c">{b.travelers || '-'}</span>
                                    <span>{tripLengthLabel(b.startDate, b.endDate)}</span>
                                    <span className="is-low">{regionOf(b) || '-'}</span>
                                    <span className="is-c">{tourMonthLabel(b.startDate)}</span>
                                    <button type="button" className={`gs-pick${dup ? ' is-dup' : assigned ? '' : ' is-open'}${pop?.activeKey === b.key ? ' is-active' : ''}`} disabled={savingKey === b.key} onClick={e => openGuidePop(e.currentTarget, b)}>
                                        {dup && <span className="gs-dup is-inline">중복</span>}<span className="gs-pick-name">{assigned ? guide?.name : '미배정'}</span><Ico name="lc-chevron-down" size={13} />
                                    </button>
                                    {cell(guide?.phone)}{cell(b.assignment?.vehicle?.type)}{cell(b.assignment?.vehicle?.phone)}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {pop && <>
                <div className="gs-pop-back" onClick={() => setPop(null)} />
                <div className="gs-pop" role="dialog" aria-label={pop.title} style={{ left: pop.x, top: pop.y }}>
                    <div className="gs-pop-head"><b>{pop.title}</b><button type="button" aria-label="닫기" onClick={() => setPop(null)}><Ico name="lc-x" size={14} /></button></div>
                    {pop.items.map(item => (
                        <button key={item.key} type="button" className={`gs-pop-row${item.muted ? ' is-muted' : ''}`} onClick={item.onPick}>
                            <span className="gs-pop-text"><b>{item.name}</b><span>{item.sub}</span></span>
                            {item.tag && <span className="gs-tag" data-tone={item.tag.tone}>{item.tag.label}</span>}
                        </button>
                    ))}
                    {!pop.items.length && pop.emptyText && <div className="gs-pop-empty">{pop.emptyText}</div>}
                    {pop.items.length > 0 && pop.emptyText && guides.length === 0 && <div className="gs-pop-empty">{pop.emptyText}</div>}
                </div>
            </>}
            {toast && <div className="gs-toast" role="status">{toast}</div>}
        </div>
    );
}
