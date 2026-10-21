import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../components/admin/AdminLayout';
import { DashboardIcon, type DashboardIconName } from '../components/admin/dashboard/DashboardIcon';
import { api } from '../lib/api';
import { productCustomerHref, quoteCustomerHref, legacyQuoteCustomerHref } from '../utils/customerWorkspaceRoutes';
import { adaptCalendarTours, calendarDateKey, calendarMonthDays, toursOnDate, toursInMonth, calendarConflicts, calendarConflictsInRange, calendarStats, calendarTourDay,
    type CalendarTour, type CalendarConflict } from '../utils/adminTourCalendar';
import { readAdminCalendarView, adminCalendarSearch, adminCalendarMonth, type AdminCalendarView } from '../utils/adminCalendarView';
import type { CalendarWorkspaceAction } from '../utils/calendarWorkspaceAction';
import './AdminCalendar.css';

const paths = {
    previous: 'm14 6-6 6 6 6', next: 'm10 6 6 6-6 6', refresh: 'M20 7v5h-5M4 17v-5h5M6 8a7 7 0 0 1 12-2l2 3M4 15l2 3a7 7 0 0 0 12-2',
    search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.9M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    guide: 'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0', vehicle: 'm5 6 2-3h10l2 3M3 11l2-5h14l2 5v7H3v-7ZM3 11h18M6 18v3M18 18v3M6 15h2M16 15h2',
    stay: 'M3 20V5M3 15h18v5M3 10h5v5M8 9h10a3 3 0 0 1 3 3v3M6 7h0', money: 'M3 5h18v14H3zM7 9h0M17 15h0M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
    warning: 'm12 3 10 18H2L12 3ZM12 9v4M12 17h0', calendar: 'M8 2v4M16 2v4M3 10h18M3 4h18v17H3z', rows: 'M8 6h13M8 12h13M8 18h13M3 6h0M3 12h0M3 18h0',
    clear: 'm6 6 12 12M18 6 6 18', arrow: 'M4 12h16m-6-6 6 6-6 6',
};
type GlyphName = keyof typeof paths;
const Glyph = ({ name }: { name: GlyphName }) => <svg className="tc-glyph" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
const typeLabels = { product: '상품 예약', quote_booking: '견적 예약', legacy_quote: '이전 문의' };
const actionable = (tour: CalendarTour) => tour.issues.filter(issue => issue.kind !== 'waiting');
const money = (value: number | null) => value === null ? '금액 미등록' : `${value.toLocaleString('ko-KR')}원`;
const peopleSummary = (stats: ReturnType<typeof calendarStats>) => stats.unknownPeople ? stats.people ? `${stats.people}명 + 미정 ${stats.unknownPeople}팀` : '인원 미등록' : `${stats.people}명`;
const dateLabel = (date: string, year = false) => new Intl.DateTimeFormat('ko-KR', { ...(year ? { year: 'numeric' as const } : {}), month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));
function workspaceHref(tour: CalendarTour, returnTo: string, action?: CalendarWorkspaceAction) {
    const returnUrl = new URL(returnTo, 'https://calendar.invalid');
    returnUrl.searchParams.set('open', tour.key);
    const calendarReturn = `${returnUrl.pathname}${returnUrl.search}`;
    const href = tour.source === 'product' ? productCustomerHref(tour.id, calendarReturn) : tour.source === 'quote_booking' ? quoteCustomerHref(tour.id, calendarReturn) : legacyQuoteCustomerHref(tour.id, calendarReturn);
    if (!action || tour.source === 'legacy_quote') return href;
    const url = new URL(href, 'https://calendar.invalid'); url.searchParams.set('action', action);
    return `${url.pathname}${url.search}${url.hash}`;
}

function TourCard({ tour, date, conflicts, returnTo, selected }: { tour: CalendarTour; date: string; conflicts: CalendarConflict[]; returnTo: string; selected: boolean }) {
    const day = calendarTourDay(tour, date), issues = actionable(tour);
    const working = tour.source !== 'legacy_quote' && !['on_hold', 'completed'].includes(tour.status);
    const resource = (icon: GlyphName, label: string, value: string, detail: string, missing: boolean, action: CalendarWorkspaceAction) => <div className={`tc-resource${missing ? ' is-missing' : ''}`}>
        <span className="tc-resource-label"><Glyph name={icon} />{label}</span><strong className="tc-resource-value" title={value}>{value}</strong>
        <span className="tc-resource-detail" title={detail}>{detail}</span>{working && <a className="tc-resource-action" href={workspaceHref(tour, returnTo, action)} aria-label={`${tour.customerName} ${label} ${missing && action !== 'payments' ? '선택' : '관리'}`}>{missing && action !== 'payments' ? '선택' : '관리'}<Glyph name="next" /></a>}
    </div>;
    const stay = day?.night ? day.stay || '숙소 미배정' : tour.nights === 0 ? '당일 투어' : '마지막 날 · 숙박 없음';
    return <article id={`tc-tour-${encodeURIComponent(tour.key)}`} className={`tc-tour-card${selected ? ' is-selected' : ''}${conflicts.length ? ' is-conflict' : ''}`}>
        <div className="tc-tour-heading"><div className="tc-tour-title"><span className="tc-source" data-source={tour.source}>{typeLabels[tour.source]}</span><h3>{tour.customerName}</h3></div><span className="tc-people"><Glyph name="people" />{tour.people === null ? '인원 미등록' : `${tour.people}명`}</span></div>
        <p className="tc-product-name">{tour.productName || '여행명 미등록'}</p>
        <div className="tc-tour-meta"><span>{tour.statusLabel}</span><span>{day?.day} / {tour.days}일차</span><span>{tour.reservationNumber || tour.id}</span></div>
        {conflicts.length > 0 && <div className="tc-conflict"><Glyph name="warning" /><span>{conflicts.map(conflict => `${conflict.resource === 'guide' ? '가이드' : '차량'} ${conflict.name}`).join(' · ')} 일정 겹침</span></div>}
        {tour.source === 'legacy_quote' ? <p className="tc-inquiry-note">고객이 문의한 희망 일정입니다. 확정 투어와 예약 인원에 포함하지 않습니다.</p> : <div className="tc-resources">
            {resource('guide', '담당 가이드', tour.guide?.name || '미배정', tour.guide?.phone || '연락처 미등록', !tour.guide, 'guide')}
            {resource('vehicle', '투어 차량', tour.vehicle?.name || '미배정', tour.vehicle?.phone || '연락처 미등록', !tour.vehicle, 'vehicle')}
            {resource('stay', '오늘 숙소', stay, `전체 ${tour.stays.assigned}/${tour.stays.expected}박 배정`, Boolean(day?.night && !day.stay), 'stay')}
            {resource('money', '입금 현황', tour.paymentLabel, tour.depositReported && tour.depositStatus !== 'paid' ? '고객 입금 신고 · 확인 필요' : `잔금 ${money(tour.balance)}`, tour.depositStatus !== 'paid' && tour.deposit !== 0, 'payments')}
        </div>}
        {issues.length > 0 && <div className="tc-issues" aria-label="처리할 업무">{issues.slice(0, 3).map(issue => <span key={issue.id} className="tc-issue">{issue.label}</span>)}{issues.length > 3 && <span className="tc-issue" title={issues.slice(3).map(issue => issue.label).join(' · ')}>+{issues.length - 3}건</span>}</div>}
        <details className="tc-tour-details"><summary>여행·문서 정보</summary><dl><div><dt>여행 기간</dt><dd>{tour.startDate} ~ {tour.endDate}</dd></div><div><dt>총 여행금액</dt><dd>{money(tour.total)}</dd></div><div><dt>예약금 / 잔금</dt><dd>{money(tour.deposit)} / {money(tour.balance)}</dd></div><div><dt>여행 계약서</dt><dd>{tour.contract === 'signed' ? '고객 동의 완료' : tour.contract === 'waiting' ? '고객 동의 대기' : '동의 정보 확인 필요'}</dd></div><div><dt>확정 일정표</dt><dd>{tour.publication === 'published' ? '공개됨' : tour.publication === 'draft' ? '미공개' : '공개 상태 확인 필요'}</dd></div><div><dt>고객 연락처</dt><dd>{tour.phone || '미등록'}</dd></div>{tour.stays.missingDays.length > 0 && <div><dt>숙소 미배정</dt><dd>{tour.stays.missingDays.map(night => `${night}일차`).join(' · ')}</dd></div>}</dl></details>
        <footer className="tc-tour-footer"><span>{tour.startDate.slice(5).replace('-', '.')} — {tour.endDate.slice(5).replace('-', '.')}</span><a href={workspaceHref(tour, returnTo)}>예약 관리<Glyph name="arrow" /></a></footer>
    </article>;
}

export function AdminCalendar() {
    const [params, setParams] = useSearchParams(), view = readAdminCalendarView(params.toString());
    const [data, setData] = useState<{ reservations: unknown[]; bookings: unknown[]; quotes: unknown[] }>({ reservations: [], bookings: [], quotes: [] });
    const [loading, setLoading] = useState(true), [initialized, setInitialized] = useState(false), [warnings, setWarnings] = useState<string[]>([]);
    const [skippedBookings, setSkippedBookings] = useState(0);
    const generation = useRef(0), panelRef = useRef<HTMLElement>(null);
    const revealedTour = useRef('');
    const reload = useCallback(async () => {
        const request = ++generation.current; setLoading(true);
        const results = await Promise.allSettled([api.reservations.list(), api.adminBookings.quote(), api.quotes.list()]);
        if (request !== generation.current) return;
        const nextWarnings: string[] = [];
        const rows = results.map((result, index) => {
            const raw = result.status === 'fulfilled' ? result.value : null;
            const value = index === 1 && raw && typeof raw === 'object' && 'items' in raw ? raw.items : raw;
            if (!Array.isArray(value)) { nextWarnings.push(['상품 예약', '견적 예약', '이전 문의'][index]); return null; }
            return value;
        });
        setData(previous => ({ reservations: rows[0] ?? previous.reservations, bookings: rows[1] ?? previous.bookings, quotes: rows[2] ?? previous.quotes }));
        if (results[1].status === 'fulfilled' && rows[1]) setSkippedBookings(Number(results[1].value.skipped) || 0);
        setWarnings(nextWarnings); setInitialized(true); setLoading(false);
    }, []);
    useEffect(() => { void reload(); const update = () => { void reload(); }; window.addEventListener('admin-workspace-changed', update); window.addEventListener('focus', update);
        return () => { generation.current++; window.removeEventListener('admin-workspace-changed', update); window.removeEventListener('focus', update); }; }, [reload]);
    const all = useMemo(() => adaptCalendarTours(data), [data]);
    useEffect(() => {
        const key = `${view.date}:${view.open}`;
        if (!view.open) { revealedTour.current = ''; return; }
        if (!initialized || key === revealedTour.current || !all.some(tour => tour.key === view.open)) return;
        revealedTour.current = key;
        const frame = requestAnimationFrame(() => document.getElementById(`tc-tour-${encodeURIComponent(view.open)}`)?.scrollIntoView({ block: 'nearest' }));
        return () => cancelAnimationFrame(frame);
    }, [all, initialized, view.date, view.open]);
    const monthDate = new Date(Number(view.month.slice(0, 4)), Number(view.month.slice(5)) - 1, 1, 12), today = calendarDateKey(new Date());
    const update = (patch: Partial<AdminCalendarView>, replace = false) => setParams(adminCalendarSearch({ ...view, ...patch }), { replace });
    const monthStart = `${view.month}-01`, monthEnd = `${view.month}-${new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()}`;
    const conflicts = useMemo(() => calendarConflictsInRange(all, monthStart, monthEnd), [all, monthStart, monthEnd]), conflictKeys = new Set(conflicts.flatMap(conflict => conflict.tourKeys));
    const query = view.query.trim().toLocaleLowerCase('ko-KR');
    const matched = all.filter(tour => (view.legacy || tour.source !== 'legacy_quote') && (view.source === 'all' || tour.source === view.source)
        && (!query || [tour.customerName, tour.productName, tour.reservationNumber, tour.phone, tour.guide?.name, tour.vehicle?.name].some(value => value?.toLocaleLowerCase('ko-KR').includes(query))));
    const monthTours = toursInMonth(matched, monthDate), stats = calendarStats(monthTours);
    const relevantConflicts = conflicts.filter(conflict => monthTours.some(tour => conflict.tourKeys.includes(tour.key)));
    const visible = matched.filter(tour => view.attention === 'conflicts' ? conflictKeys.has(tour.key) : view.attention === 'needs' ? actionable(tour).length > 0 || conflictKeys.has(tour.key) : true);
    const visibleMonth = toursInMonth(visible, monthDate);
    const dayConflicts = calendarConflicts(toursOnDate(all, view.date)), dayConflictKeys = new Set(dayConflicts.flatMap(conflict => conflict.tourKeys));
    const selected = toursOnDate(visible, view.date).filter(tour => view.attention !== 'conflicts' || dayConflictKeys.has(tour.key)).sort((a, b) => Number(dayConflictKeys.has(b.key)) - Number(dayConflictKeys.has(a.key)) || actionable(b).length - actionable(a).length || a.customerName.localeCompare(b.customerName, 'ko'));
    const dayStats = calendarStats(selected);
    const returnTo = `/admin/calendar?${adminCalendarSearch(view)}`;
    const filtered = Boolean(query || view.source !== 'all' || view.attention !== 'all');
    const clear = () => update({ query: '', source: 'all', attention: 'all', open: '' });
    const choose = (date: string, open = '', scroll = false) => {
        update({ month: date.slice(0, 7), date, open });
        if (scroll) requestAnimationFrame(() => {
            if (window.matchMedia('(max-width: 1280px)').matches) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (open) document.getElementById(`tc-tour-${encodeURIComponent(open)}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };
    const keyboardDate = (event: KeyboardEvent<HTMLButtonElement>, date: string) => {
        const change: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
        if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); setParams(adminCalendarSearch(adminCalendarMonth(view, event.key === 'PageUp' ? -1 : 1))); return; }
        if (!(event.key in change)) return;
        event.preventDefault(); const next = calendarDateKey(new Date(Date.parse(`${date}T12:00:00Z`) + change[event.key] * 86400000)); choose(next);
        requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`[data-calendar-date="${next}"]`)?.focus());
    };
    let cells = calendarMonthDays(monthDate);
    while (cells.length > 28 && cells.slice(-7).every(cell => !cell.inMonth)) cells = cells.slice(0, -7);
    const unknown = !initialized || (warnings.length === 3 && all.length === 0);
    const metrics = [
        { label: '이번 달 투어', value: `${stats.tours}팀`, caption: '상품·견적 예약 · 보류 제외', icon: 'lc-calendar' as DashboardIconName, tone: 'mint' },
        { label: '여행 인원', value: stats.people === 0 && stats.unknownPeople ? '인원 미등록' : `${stats.people}명`, caption: stats.unknownPeople ? `${stats.unknownPeople}팀 인원 확인 필요` : '확정 일정의 전체 예약 인원', icon: 'lc-users' as DashboardIconName, tone: 'green' },
        { label: '처리 필요', value: `${monthTours.filter(tour => actionable(tour).length || conflictKeys.has(tour.key)).length}팀`, caption: '미배정·입금·문서 확인', icon: 'lc-circle-alert' as DashboardIconName, tone: 'purple', attention: 'needs' as const },
        { label: '배정 일정 겹침', value: `${relevantConflicts.length}건`, caption: '등록된 가이드·차량 기준', icon: 'lc-copy' as DashboardIconName, tone: 'red', attention: 'conflicts' as const },
    ];
    const sources: Array<{ value: AdminCalendarView['source']; label: string }> = [{ value: 'all', label: '전체' }, { value: 'product', label: '상품 예약' }, { value: 'quote_booking', label: '견적 예약' }, ...(view.legacy ? [{ value: 'legacy_quote' as const, label: '이전 문의' }] : [])];
    return <AdminLayout activePage="calendar" title="투어 캘린더" description="날짜별 투어와 배정·입금·문서 업무를 함께 확인합니다." actions={<><button type="button" className="btn btn-ghost" onClick={() => void reload()} disabled={loading}><Glyph name="refresh" />{loading ? '불러오는 중' : '새로고침'}</button><a className="btn btn-ink" href="/admin/reservations">예약 관리<Glyph name="arrow" /></a></>}>
        <div className="tour-calendar">
            <div className="tc-metrics">{metrics.map(metric => <button key={metric.label} type="button" className={`tc-metric${metric.attention && view.attention === metric.attention ? ' is-active' : ''}`} disabled={!metric.attention} onClick={() => metric.attention && update({ attention: view.attention === metric.attention ? 'all' : metric.attention, open: '' })}><span className="tc-metric-icon" data-tone={metric.tone}><DashboardIcon name={metric.icon} size={20} /></span><span><span className="tc-metric-label">{metric.label}</span><strong>{unknown ? '—' : metric.value}</strong><small>{metric.caption}</small></span></button>)}</div>
            {warnings.length > 0 && <div className="tc-warning" role="alert"><Glyph name="warning" /><span>{warnings.join(' · ')} 조회에 실패했습니다. 해당 출처는 마지막으로 불러온 정보를 유지합니다.</span><button type="button" className="tc-button" disabled={loading} onClick={() => void reload()}>다시 시도</button></div>}
            {skippedBookings > 0 && <div className="tc-warning" role="status"><Glyph name="warning" /><span>견적 예약 {skippedBookings}건의 저장 형식을 확인해야 합니다. 나머지 일정을 표시합니다.</span><a className="tc-button" href="/admin/reservations">예약 목록 확인</a></div>}
            <div className="tc-filters"><label className="tc-search"><Glyph name="search" /><input aria-label="고객·여행·예약번호·배정 검색" value={view.query} maxLength={120} placeholder="고객, 여행, 예약번호 검색" onChange={event => update({ query: event.target.value, open: '' }, true)} />{view.query && <button type="button" className="tc-icon-button" aria-label="검색 지우기" onClick={() => update({ query: '', open: '' })}><Glyph name="clear" /></button>}</label>
                <div className="tc-filter-chips" role="group" aria-label="예약 출처">{sources.map(source => <button key={source.value} type="button" className={`tc-button${view.source === source.value ? ' is-active' : ''}`} aria-pressed={view.source === source.value} onClick={() => update({ source: source.value, open: '' })}>{source.label}</button>)}</div>
                <div className="tc-filter-chips" role="group" aria-label="처리 상태">{([{ value: 'all', label: '전체' }, { value: 'needs', label: '처리 필요' }, { value: 'conflicts', label: '배정 겹침' }] as const).map(filter => <button key={filter.value} type="button" className={`tc-button${view.attention === filter.value ? ' is-active' : ''}`} aria-pressed={view.attention === filter.value} onClick={() => update({ attention: filter.value, open: '' })}>{filter.label}</button>)}</div>
                <label className="tc-check"><input type="checkbox" checked={view.legacy} onChange={event => update({ legacy: event.target.checked, source: !event.target.checked && view.source === 'legacy_quote' ? 'all' : view.source, open: '' })} />이전 문의 포함</label>{filtered && <button type="button" className="tc-reset" onClick={clear}>필터 초기화</button>}
            </div>
            <div className="tc-workspace">
                <section className="tc-month-card" aria-label="월간 투어 일정" aria-busy={loading}>
                    <header className="tc-month-header"><div className="tc-month-nav"><button type="button" className="tc-icon-button" aria-label="이전 달" onClick={() => setParams(adminCalendarSearch(adminCalendarMonth(view, -1)))}><Glyph name="previous" /></button><h2>{Number(view.month.slice(0, 4))}년 {Number(view.month.slice(5))}월</h2><button type="button" className="tc-icon-button" aria-label="다음 달" onClick={() => setParams(adminCalendarSearch(adminCalendarMonth(view, 1)))}><Glyph name="next" /></button><button type="button" className="tc-button" onClick={() => choose(today)}>오늘</button></div><div className="tc-view-switch">{(['calendar', 'list'] as const).map(mode => <button type="button" key={mode} className={`tc-button${view.mode === mode ? ' is-active' : ''}`} aria-pressed={view.mode === mode} onClick={() => update({ mode })}><Glyph name={mode === 'calendar' ? 'calendar' : 'rows'} />{mode === 'calendar' ? '월간' : '목록'}</button>)}</div></header>
                    {view.mode === 'calendar' ? <><div className="tc-weekdays">{['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day}>{day}</span>)}</div><div className="tc-month-grid">{cells.map(cell => {
                        const cellConflicts = new Set(calendarConflicts(toursOnDate(all, cell.dateKey)).flatMap(conflict => conflict.tourKeys));
                        const tours = toursOnDate(visible, cell.dateKey).filter(tour => view.attention !== 'conflicts' || cellConflicts.has(tour.key)), cellStats = calendarStats(tours);
                        const needs = tours.some(tour => actionable(tour).length > 0 || cellConflicts.has(tour.key));
                        return <div className={`tc-day${!cell.inMonth ? ' is-outside' : ''}${view.date === cell.dateKey ? ' is-selected' : ''}${today === cell.dateKey ? ' is-today' : ''}`} key={cell.dateKey}>
                            <button type="button" className="tc-day-heading" data-calendar-date={cell.dateKey} aria-label={`${dateLabel(cell.dateKey, true)}, 투어 ${cellStats.tours}팀${needs ? ', 처리 필요' : ''}`} aria-pressed={view.date === cell.dateKey} onKeyDown={event => keyboardDate(event, cell.dateKey)} onClick={() => choose(cell.dateKey, '', true)}><span>{cell.day}</span>{needs && <i className="tc-attention-dot" aria-label="처리 필요" />}</button>
                            {tours.length > 0 && <span className="tc-day-count" title={peopleSummary(cellStats)}>{cellStats.tours}팀 · {peopleSummary(cellStats)}{cellStats.inquiries > 0 ? ` · 문의 ${cellStats.inquiries}` : ''}</span>}
                            <div className="tc-events">{tours.slice(0, 2).map(tour => <button type="button" className={`tc-event${cellConflicts.has(tour.key) ? ' is-conflict' : ''}${['completed', 'on_hold'].includes(tour.status) ? ' is-muted' : ''}`} data-source={tour.source} key={tour.key} title={`${typeLabels[tour.source]} · ${tour.customerName} · ${tour.productName}`} onClick={() => choose(cell.dateKey, tour.key, true)}><span>{tour.customerName}</span><small>{tour.people === null ? '?명' : `${tour.people}명`}</small></button>)}</div>
                            {tours.length > 2 && <button type="button" className="tc-more" onClick={() => choose(cell.dateKey, '', true)}>+{tours.length - 2}건 모두 보기</button>}
                        </div>;
                    })}</div></> : <div className="tc-table-wrap">{visibleMonth.length ? <table className="tc-table"><thead><tr><th>고객·여행</th><th>여행 기간</th><th>인원</th><th>가이드·차량</th><th>확인할 업무</th></tr></thead><tbody>{visibleMonth.map(tour => <tr key={tour.key}><td><button type="button" className="tc-table-customer" onClick={() => choose(view.date >= tour.startDate && view.date <= tour.endDate ? view.date : tour.startDate < `${view.month}-01` ? `${view.month}-01` : tour.startDate, tour.key, true)}><span className="tc-source" data-source={tour.source}>{typeLabels[tour.source]}</span><strong>{tour.customerName}</strong><small>{tour.productName}</small></button></td><td>{tour.startDate.slice(5)} ~ {tour.endDate.slice(5)}</td><td>{tour.people === null ? '미등록' : `${tour.people}명`}</td><td>{tour.guide?.name || '가이드 미배정'}<br />{tour.vehicle?.name || '차량 미배정'}</td><td>{conflictKeys.has(tour.key) ? '배정 겹침 · ' : ''}{actionable(tour).slice(0, 2).map(issue => issue.label).join(' · ') || tour.statusLabel}</td></tr>)}</tbody></table> : <div className="tc-empty"><Glyph name="calendar" /><strong>{unknown ? '일정을 불러오는 중입니다' : '표시할 일정이 없습니다'}</strong>{filtered && <button className="tc-button" onClick={clear}>필터 초기화</button>}</div>}</div>}
                    <footer className="tc-month-footer"><div className="tc-legend"><span data-source="product">상품 예약</span><span data-source="quote_booking">견적 예약</span>{view.legacy && <span data-source="legacy_quote">이전 문의</span>}<span><i className="tc-attention-dot" />처리 필요</span></div><small>날짜를 선택하면 팀별 운영 정보를 확인할 수 있습니다.</small></footer>
                </section>
                <section className="tc-day-panel" ref={panelRef} aria-label="선택일 투어 상세"><header className="tc-panel-header"><div><span className="tc-eyebrow">선택한 날짜</span><h2>{dateLabel(view.date)}{view.date === today && <span className="tc-today-badge">오늘</span>}</h2></div><span className="tc-panel-count">{selected.length}건</span></header><div className="tc-panel-stats"><span>투어 <b>{dayStats.tours}팀</b></span><span>인원 <b>{peopleSummary(dayStats)}</b></span><span>처리 필요 <b>{selected.filter(tour => actionable(tour).length || dayConflicts.some(conflict => conflict.tourKeys.includes(tour.key))).length}팀</b></span>{dayStats.inquiries > 0 && <span>문의 <b>{dayStats.inquiries}건</b></span>}</div>
                    <div className="tc-panel-body" aria-live="polite">{selected.length > 0 ? selected.map(tour => <TourCard key={tour.key} tour={tour} date={view.date} conflicts={dayConflicts.filter(conflict => conflict.tourKeys.includes(tour.key))} returnTo={returnTo} selected={view.open === tour.key} />) : <div className="tc-empty"><Glyph name="calendar" /><strong>{unknown ? '예약 정보를 불러오고 있습니다' : filtered ? '조건에 맞는 투어가 없습니다' : '이 날짜에 등록된 투어가 없습니다'}</strong><p>{filtered ? '검색어나 필터를 바꾸어 확인해 주세요.' : '다른 날짜를 선택하거나 예약 목록을 확인해 주세요.'}</p>{filtered ? <button type="button" className="tc-button" onClick={clear}>필터 초기화</button> : <a className="tc-button" href="/admin/reservations">예약 목록 보기</a>}</div>}</div>
                </section>
            </div><p className="tc-note">여행 날짜가 등록된 예약을 표시합니다. <a href="/admin/reservations">날짜 미정 예약은 예약 목록에서 확인<Glyph name="next" /></a></p>
        </div>
    </AdminLayout>;
}
