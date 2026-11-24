import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminLayout } from '../components/admin/AdminLayout';
import {
    AdminBadge, AdminButton, AdminCheckbox, AdminChipGroup, AdminEmpty, AdminIconButton, AdminMessage, AdminSearch, AdminSegmented,
    AdminStat, AdminStatRow, AdminTable, AdminTbody, AdminTd, AdminTextButton, AdminTh, AdminThead, AdminTr,
    IconCalendar, IconChevronLeft, IconChevronRight, IconPersons, IconRefresh, type AdminChoiceItem,
} from '../components/admin/ui';
import { api } from '../lib/api';
import { peekAdminRead } from '../lib/adminReadCache';
import { useUser } from '../contexts/UserContext';
import { productCustomerHref, quoteCustomerHref, legacyQuoteCustomerHref } from '../utils/customerWorkspaceRoutes';
import { adaptCalendarTours, calendarDateKey, calendarMonthDays, toursOnDate, toursInMonth, calendarConflicts, calendarConflictsInRange, calendarStats, calendarTourDay,
    type CalendarTour, type CalendarConflict } from '../utils/adminTourCalendar';
import { readAdminCalendarView, adminCalendarSearch, adminCalendarMonth, type AdminCalendarView } from '../utils/adminCalendarView';
import type { CalendarWorkspaceAction } from '../utils/calendarWorkspaceAction';
import './AdminCalendar.css';

/*
 * 투어 캘린더 — 당근 Seed(은하수 판) 관리자 부품으로 그린다(2026-11-24).
 * 요약·검색·칩·보기 전환·표·알림·빈 화면은 우리 관리자 부품이고, 월간 달력 칸·일정 막대·팀 카드처럼 부품에 없는 업무 모양만
 * AdminCalendar.css(--adm-* 변수만)가 그린다. 데이터 읽기·주소 상태·필터 계산은 바꾸지 않았다.
 */
const typeLabels = { product: '상품 예약', quote_booking: '견적 예약', legacy_quote: '이전 문의' };
const sourceTone = { product: 'tag-blue', quote_booking: 'tag-violet', legacy_quote: 'warn' } as const;
const SourceBadge = ({ source }: { source: CalendarTour['source'] }) => <AdminBadge tone={sourceTone[source]}>{typeLabels[source]}</AdminBadge>;
const tourElementId = (key: string) => `adm-cal-tour-${encodeURIComponent(key)}`;
const actionable = (tour: CalendarTour) => tour.issues.filter(issue => issue.kind !== 'waiting');
const money = (value: number | null) => value === null ? '금액 미등록' : `${value.toLocaleString('ko-KR')}원`;
const peopleSummary = (stats: ReturnType<typeof calendarStats>) => stats.unknownPeople ? stats.people ? `${stats.people}명 + 미정 ${stats.unknownPeople}팀` : '인원 미등록' : `${stats.people}명`;
const dateLabel = (date: string, year = false) => new Intl.DateTimeFormat('ko-KR', { ...(year ? { year: 'numeric' as const } : {}), month: 'long', day: 'numeric', weekday: 'short', timeZone: 'Asia/Seoul' }).format(new Date(`${date}T12:00:00+09:00`));

type CalendarData = { reservations: unknown[]; bookings: unknown[]; quotes: unknown[] };
interface CalendarSnapshot {
    account: string;
    data: CalendarData;
    ready: { reservations: boolean; bookings: boolean; quotes: boolean };
    loading: boolean;
    warnings: string[];
    skippedBookings: number;
}
function cachedCalendar(account: string): CalendarSnapshot {
    const reservations = account ? peekAdminRead<unknown[]>('/api/reservations', account) : undefined;
    const bookings = account ? peekAdminRead<{ items: unknown[]; skipped?: number }>('/api/admin/bookings/quote', account) : undefined;
    const quotes = account ? peekAdminRead<unknown[]>('/api/quotes', account) : undefined;
    return { account,
        data: { reservations: Array.isArray(reservations) ? reservations : [], bookings: Array.isArray(bookings?.items) ? bookings.items : [], quotes: Array.isArray(quotes) ? quotes : [] },
        ready: { reservations: Array.isArray(reservations), bookings: Array.isArray(bookings?.items), quotes: Array.isArray(quotes) },
        loading: !Array.isArray(reservations) || !Array.isArray(bookings?.items), warnings: [], skippedBookings: Number(bookings?.skipped) || 0 };
}
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
    const resource = (label: string, value: string, detail: string, missing: boolean, action: CalendarWorkspaceAction) => {
        const verb = missing && action !== 'payments' ? '선택' : '관리';
        return <div className={`adm-cal-res${missing ? ' is-missing' : ''}`}>
            <span className="adm-cal-res-label">{label}</span>
            <strong className="adm-cal-res-value" title={value}>{value}</strong>
            <span className="adm-cal-res-detail" title={detail}>{detail}</span>
            {working && <AdminTextButton size="sm" tone={missing ? 'primary' : 'assistive'} to={workspaceHref(tour, returnTo, action)} aria-label={`${tour.customerName} ${label} ${verb}`} trailing={<IconChevronRight />}>{verb}</AdminTextButton>}
        </div>;
    };
    const stay = day?.night ? day.stay || '숙소 미배정' : tour.nights === 0 ? '당일 투어' : '마지막 날 · 숙박 없음';
    return <article id={tourElementId(tour.key)} className={`adm-cal-tour${selected ? ' is-selected' : ''}${conflicts.length ? ' is-conflict' : ''}`}>
        <div className="adm-cal-tour-head">
            <div className="adm-cal-tour-title"><SourceBadge source={tour.source} /><h3>{tour.customerName}</h3></div>
            <AdminBadge icon={<IconPersons />}>{tour.people === null ? '인원 미등록' : `${tour.people}명`}</AdminBadge>
        </div>
        <p className="adm-cal-tour-product">{tour.productName || '여행명 미등록'}</p>
        <div className="adm-cal-tour-meta"><span>{tour.statusLabel}</span><span>{day?.day} / {tour.days}일차</span><span>{tour.reservationNumber || tour.id}</span></div>
        {conflicts.length > 0 && <AdminMessage tone="negative" role="status">{conflicts.map(conflict => `${conflict.resource === 'guide' ? '가이드' : '차량'} ${conflict.name}`).join(' · ')} 일정 겹침</AdminMessage>}
        {tour.source === 'legacy_quote' ? <AdminMessage tone="cautionary">고객이 문의한 희망 일정입니다. 확정 투어와 예약 인원에 포함하지 않습니다.</AdminMessage> : <div className="adm-cal-res-grid">
            {resource('담당 가이드', tour.guide?.name || '미배정', tour.guide?.phone || '연락처 미등록', !tour.guide, 'guide')}
            {resource('투어 차량', tour.vehicle?.name || '미배정', tour.vehicle?.phone || '연락처 미등록', !tour.vehicle, 'vehicle')}
            {resource('오늘 숙소', stay, `전체 ${tour.stays.assigned}/${tour.stays.expected}박 배정`, Boolean(day?.night && !day.stay), 'stay')}
            {resource('입금 현황', tour.paymentLabel, tour.depositReported && tour.depositStatus !== 'paid' ? '고객 입금 신고 · 확인 필요' : `잔금 ${money(tour.balance)}`, tour.depositStatus !== 'paid' && tour.deposit !== 0, 'payments')}
        </div>}
        {issues.length > 0 && <div className="adm-cal-issues" aria-label="처리할 업무">{issues.slice(0, 3).map(issue => <AdminBadge key={issue.id} tone="warn">{issue.label}</AdminBadge>)}{issues.length > 3 && <AdminBadge tone="warn" title={issues.slice(3).map(issue => issue.label).join(' · ')}>+{issues.length - 3}건</AdminBadge>}</div>}
        <details className="adm-cal-details"><summary>여행·문서 정보</summary><dl><div><dt>여행 기간</dt><dd>{tour.startDate} ~ {tour.endDate}</dd></div><div><dt>총 여행금액</dt><dd>{money(tour.total)}</dd></div><div><dt>예약금 / 잔금</dt><dd>{money(tour.deposit)} / {money(tour.balance)}</dd></div><div><dt>여행 계약서</dt><dd>{tour.contract === 'signed' ? '고객 동의 완료' : tour.contract === 'waiting' ? '고객 동의 대기' : '동의 정보 확인 필요'}</dd></div><div><dt>확정 일정표</dt><dd>{tour.publication === 'published' ? '공개됨' : tour.publication === 'draft' ? '미공개' : '공개 상태 확인 필요'}</dd></div><div><dt>고객 연락처</dt><dd>{tour.phone || '미등록'}</dd></div>{tour.stays.missingDays.length > 0 && <div><dt>숙소 미배정</dt><dd>{tour.stays.missingDays.map(night => `${night}일차`).join(' · ')}</dd></div>}</dl></details>
        <footer className="adm-cal-tour-foot"><span>{tour.startDate.slice(5).replace('-', '.')} — {tour.endDate.slice(5).replace('-', '.')}</span><AdminButton size="sm" to={workspaceHref(tour, returnTo)} trailing={<IconChevronRight />}>예약 관리</AdminButton></footer>
    </article>;
}

export function AdminCalendar() {
    const [params, setParams] = useSearchParams(), view = readAdminCalendarView(params.toString());
    const { user } = useUser(), account = user?.role === 'admin' ? user.id : '';
    const [snapshot, setSnapshot] = useState<CalendarSnapshot>(() => cachedCalendar(account));
    // Do not show the previous administrator's rows even for the render before effect cleanup.
    const visibleSnapshot = snapshot.account === account ? snapshot : cachedCalendar(account);
    const { data, warnings, skippedBookings } = visibleSnapshot;
    const initialized = visibleSnapshot.ready.reservations && visibleSnapshot.ready.bookings && (!view.legacy || visibleSnapshot.ready.quotes);
    const loading = visibleSnapshot.loading || (!initialized && warnings.length === 0);
    const activeAccount = useRef(account);
    const generation = useRef(0), panelRef = useRef<HTMLElement>(null);
    const pending = useRef<{ id: number; promise: Promise<void> } | null>(null), reloadQueued = useRef(false);
    const latestReload = useRef<((force?: boolean) => Promise<void>) | null>(null);
    const lastSuccess = useRef({ account: '', base: 0, legacy: 0 });
    const revealedTour = useRef('');
    const reload = useCallback(async (force = true): Promise<void> => {
        if (!account || activeAccount.current !== account) return;
        if (pending.current) { if (force) reloadQueued.current = true; return pending.current.promise; }
        const fresh = lastSuccess.current;
        if (!force && fresh.account === account && Date.now() - fresh.base < 30000 && (!view.legacy || Date.now() - fresh.legacy < 30000)) return;
        const request = ++generation.current;
        const active = () => request === generation.current && activeAccount.current === account;
        setSnapshot(previous => ({ ...(previous.account === account ? previous : cachedCalendar(account)), loading: true }));
        const operation = (async () => {
            // Old inquiries are optional; they must not hold up the normal tour calendar.
            const results = await Promise.allSettled([api.reservations.list(), api.adminBookings.quote(), view.legacy ? api.quotes.list() : Promise.resolve(null)]);
            if (!active()) return;
            const nextWarnings: string[] = [];
            const rows = results.map((result, index) => {
                if (index === 2 && !view.legacy) return null;
                const raw = result.status === 'fulfilled' ? result.value : null;
                const value = index === 1 && raw && typeof raw === 'object' && 'items' in raw ? raw.items : raw;
                if (!Array.isArray(value)) { nextWarnings.push(['상품 예약', '견적 예약', '이전 문의'][index]); return null; }
                return value;
            });
            setSnapshot(previous => {
                const current = previous.account === account ? previous : cachedCalendar(account);
                return { account, data: { reservations: rows[0] ?? current.data.reservations, bookings: rows[1] ?? current.data.bookings, quotes: rows[2] ?? current.data.quotes },
                    ready: { reservations: rows[0] !== null || current.ready.reservations, bookings: rows[1] !== null || current.ready.bookings, quotes: rows[2] !== null || current.ready.quotes },
                    loading: false, warnings: nextWarnings,
                    skippedBookings: rows[1] && results[1].status === 'fulfilled' ? Number(results[1].value.skipped) || 0 : current.skippedBookings };
            });
            if (rows[0] && rows[1]) lastSuccess.current = { account, base: Date.now(), legacy: rows[2] ? Date.now() : fresh.account === account ? fresh.legacy : 0 };
        })().finally(() => {
            if (!active()) return;
            pending.current = null;
            if (reloadQueued.current) { reloadQueued.current = false; void latestReload.current?.(); }
        });
        pending.current = { id: request, promise: operation };
        return operation;
    }, [account, view.legacy]);
    useEffect(() => { latestReload.current = reload; return () => { latestReload.current = null; }; }, [reload]);
    useEffect(() => {
        activeAccount.current = account;
        const mountGeneration = generation.current;
        queueMicrotask(() => { if (generation.current === mountGeneration && activeAccount.current === account) void reload(false); });
        const update = () => { void reload(); }, focus = () => { if (!document.hidden) void reload(false); };
        window.addEventListener('admin-workspace-changed', update); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', focus);
        const cancelRead = () => { generation.current++; pending.current = null; reloadQueued.current = false; activeAccount.current = ''; };
        return () => { cancelRead(); window.removeEventListener('admin-workspace-changed', update); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); };
    }, [account, reload]);
    const all = useMemo(() => adaptCalendarTours(data), [data]);
    useEffect(() => {
        const key = `${view.date}:${view.open}`;
        if (!view.open) { revealedTour.current = ''; return; }
        if (!initialized || key === revealedTour.current || !all.some(tour => tour.key === view.open)) return;
        revealedTour.current = key;
        const frame = requestAnimationFrame(() => document.getElementById(tourElementId(view.open))?.scrollIntoView({ block: 'nearest' }));
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
            if (open) document.getElementById(tourElementId(open))?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
    const unknown = !initialized;
    const needsCount = monthTours.filter(tour => actionable(tour).length || conflictKeys.has(tour.key)).length;
    const metrics: Array<{ label: string; value: string; caption: string; attention?: 'needs' | 'conflicts'; count?: number }> = [
        { label: '이번 달 투어', value: `${stats.tours}팀`, caption: '상품·견적 예약 · 보류 제외' },
        { label: '여행 인원', value: stats.people === 0 && stats.unknownPeople ? '인원 미등록' : `${stats.people}명`, caption: stats.unknownPeople ? `${stats.unknownPeople}팀 인원 확인 필요` : '확정 일정의 전체 예약 인원' },
        { label: '처리 필요', value: `${needsCount}팀`, caption: '미배정·입금·문서 확인', attention: 'needs', count: needsCount },
        { label: '배정 일정 겹침', value: `${relevantConflicts.length}건`, caption: '등록된 가이드·차량 기준', attention: 'conflicts', count: relevantConflicts.length },
    ];
    const sources: AdminChoiceItem<AdminCalendarView['source']>[] = [{ value: 'all', label: '전체' }, { value: 'product', label: '상품 예약' }, { value: 'quote_booking', label: '견적 예약' }, ...(view.legacy ? [{ value: 'legacy_quote' as const, label: '이전 문의' }] : [])];
    const attentionItems: AdminChoiceItem<AdminCalendarView['attention']>[] = [{ value: 'all', label: '전체' }, { value: 'needs', label: '처리 필요' }, { value: 'conflicts', label: '배정 겹침' }];
    const modes: AdminChoiceItem<typeof view.mode>[] = [{ value: 'calendar', label: '월간' }, { value: 'list', label: '목록' }];
    const firstDayFor = (tour: CalendarTour) => view.date >= tour.startDate && view.date <= tour.endDate ? view.date : tour.startDate < monthStart ? monthStart : tour.startDate;
    return <AdminLayout activePage="calendar" title="투어 캘린더" description="날짜별 투어와 배정·입금·문서 업무를 함께 확인합니다." actions={<>
        <AdminButton leading={<IconRefresh />} loading={loading} onClick={() => void reload()}>{loading ? '불러오는 중' : '새로고침'}</AdminButton>
        <AdminButton to="/admin/reservations" trailing={<IconChevronRight />}>예약 관리</AdminButton>
    </>}>
        <div className="adm-cal">
            <AdminStatRow label="이번 달 요약">{metrics.map(metric => {
                const filter = metric.attention;
                return <AdminStat key={metric.label} label={metric.label} value={unknown ? '—' : metric.value} hint={metric.caption}
                    attention={Boolean(filter && !unknown && metric.count)} active={Boolean(filter && view.attention === filter)}
                    onClick={filter ? () => update({ attention: view.attention === filter ? 'all' : filter, open: '' }) : undefined} />;
            })}</AdminStatRow>
            {warnings.length > 0 && <AdminMessage tone="cautionary" role="alert" actions={<AdminTextButton size="sm" disabled={loading} onClick={() => void reload()}>다시 시도</AdminTextButton>}>{warnings.join(' · ')} 조회에 실패했습니다. 해당 출처는 마지막으로 불러온 정보를 유지합니다.</AdminMessage>}
            {skippedBookings > 0 && <AdminMessage tone="cautionary" actions={<AdminTextButton size="sm" to="/admin/reservations">예약 목록 확인</AdminTextButton>}>견적 예약 {skippedBookings}건의 저장 형식을 확인해야 합니다. 나머지 일정을 표시합니다.</AdminMessage>}
            <div className="adm-cal-filters">
                <AdminSearch value={view.query} maxLength={120} placeholder="고객, 여행, 예약번호 검색" aria-label="고객·여행·예약번호·배정 검색" onChange={value => update({ query: value, open: '' }, value !== '')} />
                <AdminChipGroup label="예약 출처" items={sources} value={view.source} onChange={source => update({ source, open: '' })} />
                <AdminChipGroup label="처리 상태" items={attentionItems} value={view.attention} onChange={attention => update({ attention, open: '' })} />
                <span className="adm-cal-filters-end">
                    <AdminCheckbox size="sm" checked={view.legacy} label="이전 문의 포함" onChange={checked => update({ legacy: checked, source: !checked && view.source === 'legacy_quote' ? 'all' : view.source, open: '' })} />
                    {filtered && <AdminTextButton size="sm" tone="assistive" onClick={clear}>필터 초기화</AdminTextButton>}
                </span>
            </div>
            <div className="adm-cal-workspace">
                <section className="adm-cal-month" aria-label="월간 투어 일정" aria-busy={loading}>
                    <header className="adm-cal-month-head">
                        <div className="adm-cal-month-nav">
                            <AdminIconButton label="이전 달" size="sm" onClick={() => setParams(adminCalendarSearch(adminCalendarMonth(view, -1)))}><IconChevronLeft /></AdminIconButton>
                            <h2>{Number(view.month.slice(0, 4))}년 {Number(view.month.slice(5))}월</h2>
                            <AdminIconButton label="다음 달" size="sm" onClick={() => setParams(adminCalendarSearch(adminCalendarMonth(view, 1)))}><IconChevronRight /></AdminIconButton>
                            <AdminButton size="sm" onClick={() => choose(today)}>오늘</AdminButton>
                        </div>
                        <AdminSegmented label="보기" items={modes} value={view.mode} onChange={next => update({ mode: next })} />
                    </header>
                    {view.mode === 'calendar' ? <><div className="adm-cal-weekdays" aria-hidden="true">{['일', '월', '화', '수', '목', '금', '토'].map(day => <span key={day}>{day}</span>)}</div><div className="adm-cal-grid">{cells.map(cell => {
                        const cellConflicts = new Set(calendarConflicts(toursOnDate(all, cell.dateKey)).flatMap(conflict => conflict.tourKeys));
                        const tours = toursOnDate(visible, cell.dateKey).filter(tour => view.attention !== 'conflicts' || cellConflicts.has(tour.key)), cellStats = calendarStats(tours);
                        const needs = tours.some(tour => actionable(tour).length > 0 || cellConflicts.has(tour.key));
                        return <div className={`adm-cal-day${!cell.inMonth ? ' is-outside' : ''}${view.date === cell.dateKey ? ' is-selected' : ''}${today === cell.dateKey ? ' is-today' : ''}`} key={cell.dateKey}>
                            <button type="button" className="adm-cal-day-head" data-calendar-date={cell.dateKey} aria-label={`${dateLabel(cell.dateKey, true)}, 투어 ${cellStats.tours}팀${needs ? ', 처리 필요' : ''}`} aria-pressed={view.date === cell.dateKey} onKeyDown={event => keyboardDate(event, cell.dateKey)} onClick={() => choose(cell.dateKey, '', true)}><span className="adm-cal-day-num">{cell.day}</span>{needs && <i className="adm-cal-dot" aria-label="처리 필요" />}</button>
                            {tours.length > 0 && <span className="adm-cal-day-count" title={peopleSummary(cellStats)}>{cellStats.tours}팀 · {peopleSummary(cellStats)}{cellStats.inquiries > 0 ? ` · 문의 ${cellStats.inquiries}` : ''}</span>}
                            <div className="adm-cal-events">{tours.slice(0, 2).map(tour => <button type="button" className={`adm-cal-event${cellConflicts.has(tour.key) ? ' is-conflict' : ''}${['completed', 'on_hold'].includes(tour.status) ? ' is-muted' : ''}`} data-source={tour.source} key={tour.key} title={`${typeLabels[tour.source]} · ${tour.customerName} · ${tour.productName}`} onClick={() => choose(cell.dateKey, tour.key, true)}><span>{tour.customerName}</span><small>{tour.people === null ? '?명' : `${tour.people}명`}</small></button>)}</div>
                            {tours.length > 2 && <button type="button" className="adm-cal-more" onClick={() => choose(cell.dateKey, '', true)}>+{tours.length - 2}건 모두 보기</button>}
                        </div>;
                    })}</div></> : <div className="adm-cal-list">{visibleMonth.length ? <AdminTable label="이번 달 투어 목록"><AdminThead><AdminTr><AdminTh>고객·여행</AdminTh><AdminTh>여행 기간</AdminTh><AdminTh>인원</AdminTh><AdminTh>가이드·차량</AdminTh><AdminTh>확인할 업무</AdminTh></AdminTr></AdminThead><AdminTbody>{visibleMonth.map(tour => <AdminTr key={tour.key} selected={view.open === tour.key}>
                        <AdminTd><button type="button" className="adm-cal-table-customer" onClick={() => choose(firstDayFor(tour), tour.key, true)}><SourceBadge source={tour.source} /><strong>{tour.customerName}</strong><small>{tour.productName}</small></button></AdminTd>
                        <AdminTd nowrap>{tour.startDate.slice(5)} ~ {tour.endDate.slice(5)}</AdminTd>
                        <AdminTd nowrap>{tour.people === null ? '미등록' : `${tour.people}명`}</AdminTd>
                        <AdminTd>{tour.guide?.name || '가이드 미배정'}<br />{tour.vehicle?.name || '차량 미배정'}</AdminTd>
                        <AdminTd>{conflictKeys.has(tour.key) ? '배정 겹침 · ' : ''}{actionable(tour).slice(0, 2).map(issue => issue.label).join(' · ') || tour.statusLabel}</AdminTd>
                    </AdminTr>)}</AdminTbody></AdminTable> : <AdminEmpty icon={<IconCalendar />} title={unknown ? loading ? '일정을 불러오는 중입니다' : '일정을 불러오지 못했습니다' : '표시할 일정이 없습니다'} action={filtered ? <AdminButton size="sm" onClick={clear}>필터 초기화</AdminButton> : undefined} />}</div>}
                    <footer className="adm-cal-month-foot"><div className="adm-cal-legend"><span data-source="product">상품 예약</span><span data-source="quote_booking">견적 예약</span>{view.legacy && <span data-source="legacy_quote">이전 문의</span>}<span><i className="adm-cal-dot" />처리 필요</span></div><small>날짜를 선택하면 팀별 운영 정보를 확인할 수 있습니다.</small></footer>
                </section>
                <section className="adm-cal-panel" ref={panelRef} aria-label="선택일 투어 상세">
                    <header className="adm-cal-panel-head"><div><span className="adm-cal-eyebrow">선택한 날짜</span><h2>{dateLabel(view.date)}{view.date === today && <AdminBadge tone="info">오늘</AdminBadge>}</h2></div><AdminBadge size="md">{unknown ? '—' : selected.length}건</AdminBadge></header>
                    <div className="adm-cal-panel-stats"><span>투어 <b>{unknown ? '—' : dayStats.tours}팀</b></span><span>인원 <b>{unknown ? '—' : peopleSummary(dayStats)}</b></span><span>처리 필요 <b>{unknown ? '—' : selected.filter(tour => actionable(tour).length || dayConflicts.some(conflict => conflict.tourKeys.includes(tour.key))).length}팀</b></span>{dayStats.inquiries > 0 && <span>문의 <b>{dayStats.inquiries}건</b></span>}</div>
                    <div className="adm-cal-panel-body" aria-live="polite">{selected.length > 0 ? selected.map(tour => <TourCard key={tour.key} tour={tour} date={view.date} conflicts={dayConflicts.filter(conflict => conflict.tourKeys.includes(tour.key))} returnTo={returnTo} selected={view.open === tour.key} />)
                        : <AdminEmpty icon={<IconCalendar />} title={unknown ? loading ? '예약 정보를 불러오고 있습니다' : '예약 정보를 불러오지 못했습니다' : filtered ? '조건에 맞는 투어가 없습니다' : '이 날짜에 등록된 투어가 없습니다'}
                            description={filtered ? '검색어나 필터를 바꾸어 확인해 주세요.' : '다른 날짜를 선택하거나 예약 목록을 확인해 주세요.'}
                            action={filtered ? <AdminButton size="sm" onClick={clear}>필터 초기화</AdminButton> : <AdminButton size="sm" to="/admin/reservations">예약 목록 보기</AdminButton>} />}</div>
                </section>
            </div>
            <p className="adm-cal-note">여행 날짜가 등록된 예약을 표시합니다. <AdminTextButton size="sm" to="/admin/reservations" trailing={<IconChevronRight />}>날짜 미정 예약은 예약 목록에서 확인</AdminTextButton></p>
        </div>
    </AdminLayout>;
}
