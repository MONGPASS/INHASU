import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchV7Assignments, saveV7Assignment, type V7AssignmentItem } from '../../../utils/reservationV7';
import { loadRegisteredAssignmentResources, type RegisteredGuide } from '../../../utils/registeredAssignmentResources';
import { selectResourceGuide } from '../../../utils/accommodationResourceSelection';
import { guideOverlaps, overlapLabel } from '../../../utils/assignmentAvailability';
import { isUpcomingTour, tourMonthLabel, tourSerials, tripLengthLabel } from '../../../utils/accommodationSheet';
import { productCustomerHref, quoteCustomerHref } from '../../../utils/customerWorkspaceRoutes';
import { V7Menu, V7Styles, menuAt, type V7MenuItem, type V7MenuState } from '../v7/v7Ui';
import { confirmGuideConflict, guideMenuItems } from '../v7/guideMenuItems';
import { activeBooking, coversDay, guideRows, hasGuide, inMonth, laneBookings, monthDays, shiftMonth, type ScheduleBooking } from './guideScheduleModel';
import './GuideSchedule.css';

type Item = V7AssignmentItem & ScheduleBooking & { customerName?: string; leadName?: string; travelers?: number; productName?: string; contractData?: { region?: string } };
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const nameOf = (b: Item) => (b.leadName || b.customerName || '이름 없음').trim();
const regionOf = (b: Item) => b.contractData?.region || b.productName || '';
const hrefOf = (b: Item) => b.source === 'quote_booking' ? quoteCustomerHref(b.id, '/admin/quote-desk/resources?view=schedule') : productCustomerHref(b.id, '/admin/quote-desk/resources?view=schedule');
const dot = (key?: string) => (key || '').slice(5).replace('-', '.');

/**
 * 가이드 배정 현황 — 가이드별·날짜별로 누가 언제 일하는지 한눈에 보고, 빈칸에서 바로 배정한다.
 * 저장은 기존 배정 API(버전 확인 + 서버 가이드 중복 확인)를 그대로 쓴다.
 */
export function GuideSchedule({ accountId }: { accountId: string }) {
    const [items, setItems] = useState<Item[]>([]);
    const [guides, setGuides] = useState<RegisteredGuide[]>([]);
    const [loading, setLoading] = useState(true);
    const [warnings, setWarnings] = useState<string[]>([]);
    const [notice, setNotice] = useState('');
    const [savingKey, setSavingKey] = useState('');
    const [month, setMonth] = useState(() => todayKey().slice(0, 7));
    const [view, setView] = useState<'calendar' | 'list'>('calendar');
    const [menu, setMenu] = useState<V7MenuState | null>(null);
    const mounted = useRef(true), generation = useRef(0);
    // 개발 모드에서는 화면이 두 번 붙었다 떨어지므로 붙을 때마다 다시 켠다.
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; generation.current++; }; }, []);

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

    // 배정 저장. 메뉴에서 겹침을 이미 확인했으면 서버 중복 확인을 다시 묻지 않는다.
    const assign = async (booking: Item, guide: RegisteredGuide | null, confirmed = false): Promise<void> => {
        if (savingKey) return;
        setSavingKey(booking.key);
        let retry = false;
        try {
            const assignment = { ...booking.assignment, guide: guide ? selectResourceGuide(booking.assignment.guide, guide) : { id: '', name: '', phone: '' } };
            const saved = await saveV7Assignment(booking, assignment, { allowGuideConflict: confirmed }) as Item;
            if (!mounted.current) return;
            setItems(prev => prev.map(x => x.key === saved.key ? { ...x, ...saved } : x));
            setNotice(guide ? `${nameOf(booking)} 팀에 ${guide.name} 가이드를 배정했어요.` : `${nameOf(booking)} 팀의 가이드 배정을 해제했어요.`);
        } catch (e: any) {
            if (mounted.current && !confirmed && confirmGuideConflict(e)) retry = true;
            else if (mounted.current) { setNotice(e?.message || '배정을 저장하지 못했습니다.'); void load(); }
        } finally { if (mounted.current) setSavingKey(''); }
        if (retry) return assign(booking, guide, true);
    };
    const guideMenu = (target: HTMLElement, booking: Item) => {
        const items: V7MenuItem[] = [
            ...(hasGuide(booking) ? [{ key: 'none', label: '배정 해제', muted: true, onPick: () => void assign(booking, null) }] : []),
            ...guideMenuItems(guides, active, booking, booking.assignment?.guide?.name, (guide, confirmed) => void assign(booking, guide, confirmed)),
        ];
        setMenu(menuAt(target, `${nameOf(booking)} · ${dot(booking.startDate)}~${dot(booking.endDate)} 가이드`, items, true));
    };
    // 가이드 줄의 빈 날짜를 누르면 그날 진행하는 미배정 투어를 고른다.
    const dayMenu = (target: HTMLElement, guide: RegisteredGuide, day: string) => {
        const candidates = unassigned.filter(b => coversDay(b, day));
        const items: V7MenuItem[] = candidates.length ? candidates.map(b => {
            const found = guideOverlaps(active, guide, b), overlap = found.find(x => x.kind === 'overlap'), handover = found.find(x => x.kind === 'handover');
            return { key: b.key, label: `${nameOf(b)} · ${dot(b.startDate)}~${dot(b.endDate)}`,
                sub: overlap ? `일정 겹침 · ${overlapLabel(overlap.booking)}` : handover ? `같은 날 교대 · ${overlapLabel(handover.booking)}` : regionOf(b) || '배정 가능',
                subTone: overlap ? 'warn' as const : handover ? 'muted' as const : 'ok' as const,
                onPick: () => { if (overlap && !window.confirm(`${guide.name} 가이드는 같은 기간에 ${overlapLabel(overlap.booking)} 일정이 있습니다. 그래도 배정할까요?`)) return; void assign(b, guide, !!overlap); } };
        }) : [{ key: 'empty', label: '이날 진행하는 미배정 투어가 없어요', muted: true, disabled: true, onPick: () => undefined }];
        setMenu(menuAt(target, `${guide.name} · ${dot(day)} 배정할 투어`, items, true));
    };

    const serials = useMemo(() => tourSerials(items.map(b => ({ id: b.key, createdAt: (b as any).createdAt, startDate: b.startDate }))), [items]);
    const upcoming = useMemo(() => active.filter(b => isUpcomingTour(b, today)).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '')), [active, today]);
    const barLabel = (b: Item) => `${nameOf(b)}${regionOf(b) ? ` · ${regionOf(b)}` : ''}`;
    // 줄마다 칸 너비가 달라지지 않게 날짜 칸은 고정 너비(긴 이름은 막대 안에서 줄임표).
    const cols = { gridTemplateColumns: `170px repeat(${days.length}, 36px)` };

    return (
        <div className="gs">
            <V7Styles /><V7Menu menu={menu} onClose={() => setMenu(null)} />
            <div className="gs-bar">
                <div className="gs-seg" role="group" aria-label="보기">
                    <button type="button" aria-pressed={view === 'calendar'} className={view === 'calendar' ? 'is-on' : ''} onClick={() => setView('calendar')}>달력</button>
                    <button type="button" aria-pressed={view === 'list'} className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>목록</button>
                </div>
                {view === 'calendar' && <div className="gs-month">
                    <button type="button" aria-label="이전 달" onClick={() => setMonth(m => shiftMonth(m, -1))}>‹</button>
                    <b>{month.slice(0, 4)}년 {Number(month.slice(5))}월</b>
                    <button type="button" aria-label="다음 달" onClick={() => setMonth(m => shiftMonth(m, 1))}>›</button>
                    <button type="button" className="gs-today" onClick={() => setMonth(today.slice(0, 7))}>이번 달</button>
                </div>}
                <span className="gs-stats">
                    {view === 'calendar' ? <>배정 <b>{monthStats.assigned}</b>팀 · 미배정 <b className={monthStats.unassigned ? 'is-warn' : ''}>{monthStats.unassigned}</b>팀 · 중복 <b className={monthStats.conflicts ? 'is-bad' : ''}>{monthStats.conflicts}</b>건</>
                        : <>오늘 이후 투어 <b>{upcoming.length}</b>팀 · 미배정 <b className="is-warn">{upcoming.filter(b => !hasGuide(b)).length}</b>팀</>}
                </span>
                <button type="button" className="gs-refresh" disabled={loading} onClick={() => void load()}>새로고침</button>
            </div>
            {notice && <div className="gs-notice" role="status">{notice}</div>}
            {warnings.map((w, i) => <div key={i} className="gs-notice is-warn" role="alert">{w}</div>)}
            {loading && !items.length ? <p className="gs-empty">배정 현황을 불러오고 있어요…</p> : view === 'calendar' ? (
                <div className="gs-cal" role="region" aria-label={`${month} 가이드 배정 달력`} tabIndex={0}>
                    <div className="gs-row gs-head" style={cols}>
                        <span className="gs-name">가이드</span>
                        {days.map(day => { const wd = new Date(`${day}T00:00:00`).getDay(); return <span key={day} className={`gs-day${wd === 0 || wd === 6 ? ' is-weekend' : ''}${day === today ? ' is-today' : ''}`}><b>{Number(day.slice(8))}</b><small>{WD[wd]}</small></span>; })}
                    </div>
                    {rows.map(row => {
                        const placed = laneBookings(row.bookings as Item[], days, active, row.guide), lanes = Math.max(1, ...placed.map(p => p.lane + 1));
                        const registered = row.registered ? guides.find(g => g.id === row.guide.id) : undefined;
                        return (
                            <div key={`${row.guide.id || ''}:${row.guide.name}`} className={`gs-row${placed.some(p => p.overlap) ? ' has-conflict' : ''}`} style={{ ...cols, gridTemplateRows: `repeat(${lanes}, 38px)` }}>
                                <span className="gs-name" style={{ gridRow: '1 / -1' }}>
                                    <b>{row.guide.name}</b>
                                    <small>{row.registered ? `${placed.length ? `${placed.length}팀` : '이 달 비어 있음'}` : '등록 안 된 가이드'}</small>
                                </span>
                                {days.map((day, i) => {
                                    const busy = placed.some(p => p.from <= i && p.to >= i);
                                    const wd = new Date(`${day}T00:00:00`).getDay();
                                    return registered && !busy
                                        ? <button key={day} type="button" className={`gs-cell is-free${wd === 0 || wd === 6 ? ' is-weekend' : ''}${day === today ? ' is-today' : ''}`} style={{ gridColumn: i + 2, gridRow: '1 / -1' }}
                                            title={`${row.guide.name} · ${dot(day)} 비어 있음 — 눌러서 배정`} aria-label={`${row.guide.name} ${dot(day)} 배정하기`} onClick={e => dayMenu(e.currentTarget, registered, day)} />
                                        : <span key={day} className={`gs-cell${wd === 0 || wd === 6 ? ' is-weekend' : ''}${day === today ? ' is-today' : ''}`} style={{ gridColumn: i + 2, gridRow: '1 / -1' }} />;
                                })}
                                {placed.map(({ booking, lane, from, to, overlap, startsBefore, endsAfter }) => {
                                    const b = booking as Item;
                                    return <a key={b.key} href={hrefOf(b)} className={`gs-tour${overlap ? ' is-conflict' : ''}${startsBefore ? ' starts-before' : ''}${endsAfter ? ' ends-after' : ''}`}
                                        style={{ gridColumn: `${from + 2} / ${to + 3}`, gridRow: lane + 1 }}
                                        title={`${barLabel(b)}\n${b.startDate} ~ ${b.endDate}${overlap ? '\n같은 날 다른 예약과 겹칩니다' : ''}`}>
                                        {overlap && <em>중복</em>}{barLabel(b)}
                                    </a>;
                                })}
                            </div>
                        );
                    })}
                    {(() => {
                        const placed = laneBookings(unassigned as Item[], days, active), lanes = Math.max(1, ...placed.map(p => p.lane + 1));
                        return (
                            <div className="gs-row gs-unassigned" style={{ ...cols, gridTemplateRows: `repeat(${lanes}, 38px)` }}>
                                <span className="gs-name" style={{ gridRow: '1 / -1' }}><b>미배정 투어</b><small>{placed.length ? `${placed.length}팀 · 눌러서 배정` : '이 달 없음'}</small></span>
                                {days.map((day, i) => <span key={day} className="gs-cell" style={{ gridColumn: i + 2, gridRow: '1 / -1' }} />)}
                                {placed.map(({ booking, lane, from, to }) => {
                                    const b = booking as Item;
                                    return <button key={b.key} type="button" className="gs-tour is-open" disabled={!!savingKey} style={{ gridColumn: `${from + 2} / ${to + 3}`, gridRow: lane + 1 }}
                                        title={`${barLabel(b)}\n${b.startDate} ~ ${b.endDate}\n눌러서 가이드 배정`} onClick={e => guideMenu(e.currentTarget, b)}>{barLabel(b)}</button>;
                                })}
                            </div>
                        );
                    })()}
                </div>
            ) : (
                <div className="gs-list-wrap" role="region" aria-label="가이드 배정 목록" tabIndex={0}>
                    <table className="gs-list">
                        <thead><tr><th>번호</th><th>고객명</th><th>도착일자</th><th>출발일자</th><th>인원</th><th>일정</th><th>지역</th><th>월</th><th>가이드명</th><th>전화번호</th><th>차량</th><th>기사 연락처</th></tr></thead>
                        <tbody>
                            {upcoming.length === 0 && <tr><td colSpan={12} className="gs-empty">오늘 이후 진행하는 투어가 없어요.</td></tr>}
                            {upcoming.map(b => {
                                const guide = b.assignment?.guide, overlap = hasGuide(b) && guideOverlaps(active, guide!, b).some(x => x.kind === 'overlap');
                                return (
                                    <tr key={b.key} className={overlap ? 'is-conflict' : ''}>
                                        <td className="is-num">{serials.get(b.key) ?? '-'}</td>
                                        <td><a href={hrefOf(b)}>{nameOf(b)}</a></td>
                                        <td>{b.startDate || '-'}</td><td>{b.endDate || '-'}</td>
                                        <td className="is-num">{b.travelers || '-'}</td>
                                        <td>{tripLengthLabel(b.startDate, b.endDate)}</td>
                                        <td>{regionOf(b) || '-'}</td>
                                        <td>{tourMonthLabel(b.startDate)}</td>
                                        <td><button type="button" className={`gs-pick${hasGuide(b) ? '' : ' is-empty'}`} disabled={!!savingKey} onClick={e => guideMenu(e.currentTarget, b)}>
                                            {overlap && <em>중복</em>}{hasGuide(b) ? guide?.name : '미배정'}<span aria-hidden="true">▾</span></button></td>
                                        <td>{guide?.phone || '-'}</td>
                                        <td>{b.assignment?.vehicle?.type || '-'}</td>
                                        <td>{b.assignment?.vehicle?.phone || '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
