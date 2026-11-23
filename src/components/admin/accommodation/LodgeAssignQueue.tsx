import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconCheck, IconChevronDown, IconChevronUp, IconPlus } from '@montage-ui/icon';
import {
    AdminBadge, AdminButton, AdminCard, AdminEmpty, AdminField, AdminLoading, AdminMessage, AdminPickCard, AdminSearch, AdminSelect, AdminStat,
    AdminStatRow, AdminTextButton, AdminTextInput, adminConfirm,
} from '../ui';
import type { AssignmentAccommodation, ContractPackageType } from '../../../utils/reservationAssignment';
import { MAX_ROOMS_PER_NIGHT } from '../../../utils/reservationAssignment';
import type { RegisteredLodge } from '../../../utils/registeredAssignmentResources';
import { selectResourceLodge } from '../../../utils/accommodationResourceSelection';
import { LODGE_MAIL_STAGES, LODGE_RESERVATION_STATES, changeLodgeReservation, lodgeMailStatus, lodgeReservationStatus } from '../../../utils/lodgeBookingStatus';
import { ASSIGN_TYPE_OPTIONS, LODGE_AREA_OPTIONS, LODGE_GRADE_OPTIONS, PACKAGE_LABELS } from '../../../utils/accommodationSheet';
import { productCustomerHref, quoteCustomerHref } from '../../../utils/customerWorkspaceRoutes';
import {
    CLEAR_LODGE, LODGE_CONTACT_STEPS, buildLodgeModel, contactStepsDone, dateKeyOf, daysUntil, dotted, nextMailStage, tourNameOf, tourStateOf,
    withCurrent, type LodgeBoardTour, type LodgeModel, type LodgePatch, type NightState,
} from './lodgeBoardModel';
import { LodgePicker } from './LodgePicker';
import './LodgeAssignQueue.css';

/**
 * 숙소 배정 — 배정 보드(Claude Design ‘숙소 배정 · 현지 운영’ A안).
 * 위: 상태 카드 4장(누르면 왼쪽 목록을 그 상태로 거름) · 왼쪽: 체크인 빠른 순 예약 대기열 · 오른쪽: 고른 예약의 숙박별 배정과 숙소 연락 단계.
 * 칸과 값은 표로 보기(LodgeAssignBoard)와 같고, 저장은 같은 예약 단위 배정 API·브라우저 초안을 쓴다.
 */
type Filter = NightState | 'all';
const WD = '일월화수목금토';
const PAGE = 20;
const STATE_LABEL: Record<NightState, string> = { none: '미배정', sel: '배정', req: '진행 중', ok: '배정 완료' };
const STATE_TONE: Record<NightState, 'danger' | 'info' | 'warn' | 'success'> = { none: 'danger', sel: 'info', req: 'warn', ok: 'success' };
const STATE_HINT: Record<Exclude<NightState, 'none'>, string> = {
    sel: '숙소는 정했고 요청 메일을 보낼 차례',
    req: '요청 메일을 보내고 답을 기다리는 중',
    ok: '숙소가 예약을 확정',
};
/** 계약 패키지 ‘자동 표시’(저장 값은 빈 값) — 고르기 칸은 빈 값을 ‘선택 안 함’으로 보여서 따로 둔다 */
const AUTO = '__auto__';
const PACKAGE_OPTIONS = [
    { value: 'value', label: '실속패키지' },
    { value: 'full', label: '풀패키지' },
    { value: AUTO, label: '자동 표시 · 숙소 등급 기준' },
];
const AREA_OPTIONS = [...LODGE_AREA_OPTIONS];

const weekday = (key: string) => key ? WD[new Date(`${key}T00:00:00`).getDay()] : '';
const shortDate = (key: string) => key ? `${key.slice(5, 7)}.${key.slice(8, 10)}` : '날짜 미정';
const dayLabel = (key: string) => key ? `${shortDate(key)} (${weekday(key)})` : '날짜 미정';
const ddayOf = (start: string) => {
    const days = daysUntil(start);
    if (days === null) return null;
    return { label: days > 0 ? `D-${days}` : days === 0 ? 'D-DAY' : '출발 후', soon: days <= 14 };
};
const spanLabel = (n: number) => n ? `${n}박 ${n + 1}일` : '당일';
const roomValue = (text: string): number | null | undefined => {
    if (text === '') return null;
    if (!/^\d+$/.test(text)) return undefined;
    const n = Number(text);
    return n >= 1 && n <= MAX_ROOMS_PER_NIGHT ? n : undefined;
};

export interface LodgeAssignQueueProps {
    tours: LodgeBoardTour[];
    loading: boolean;
    rowsOf: (tour: LodgeBoardTour) => AssignmentAccommodation[];
    plannedNights: (tour: LodgeBoardTour) => number;
    lodges: RegisteredLodge[];
    lodgeRegions: string[];
    resourcesLoading: boolean;
    dirty: Set<string>;
    pending: Record<string, unknown>;
    savingId: string | null;
    clearedAreas: Set<string>;
    onAreaCleared: (key: string, cleared: boolean) => void;
    onPatch: (tourId: string, index: number, patch: LodgePatch, fill?: Record<number, string>) => void;
    onPackage: (tourId: string, type: ContractPackageType) => void;
    onSave: (tourId: string) => void;
    onDiscard: (tourId: string) => void;
    onResolveDraft: (tourId: string, restore: boolean) => void;
    onAddNight: (tourId: string, fill?: Record<number, string>) => void;
    onRemoveNight: (tourId: string, index: number) => void;
    /** 여행자·항공·계약서는 표로 보기의 예약 정보 창에서 본다(가이드·차량은 가이드 배정 현황) */
    onOpenCard: (tourId: string) => void;
}

export function LodgeAssignQueue(props: LodgeAssignQueueProps) {
    const { tours, loading, rowsOf, plannedNights, clearedAreas, lodgeRegions } = props;
    const [filter, setFilter] = useState<Filter>('all');
    const [q, setQ] = useState('');
    const [limit, setLimit] = useState(PAGE);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const detailRef = useRef<HTMLDivElement>(null);
    // 좁은 화면에서는 상세가 목록 아래에 있으니, 고르면 상세로 내려간다.
    const pick = (tourId: string) => {
        setSelectedId(tourId);
        window.setTimeout(() => {
            const el = detailRef.current;
            if (el && el.getBoundingClientRect().top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
    };

    const model = useMemo(() => tours.map(tour => buildLodgeModel(tour, { rows: rowsOf(tour), planned: plannedNights(tour), clearedAreas, lodgeRegions }))
        .map(m => ({ ...m, state: tourStateOf(m.nights) }))
        .sort((a, b) => (a.start || '9').localeCompare(b.start || '9')), [tours, rowsOf, plannedNights, clearedAreas, lodgeRegions]);
    const counts = useMemo(() => {
        const out: Record<NightState, number> = { none: 0, sel: 0, req: 0, ok: 0 };
        model.forEach(m => { out[m.state]++; });
        return out;
    }, [model]);
    const needle = q.trim().toLowerCase();
    const list = model.filter(m => (filter === 'all' || m.state === filter)
        && (!needle || `${m.tour.leadName || ''} ${m.tour.customerName || ''} ${m.tour.reservationNumber || ''} ${m.nights.map(n => n.acc.name || '').join(' ')}`.toLowerCase().includes(needle)));
    const shown = list.slice(0, limit);
    const selected = model.find(m => m.tour.id === selectedId) || shown[0] || null;
    useEffect(() => { setLimit(PAGE); }, [filter, needle]);

    const firstUnassigned = model.find(m => m.state === 'none' && m.start);
    const firstDday = firstUnassigned ? ddayOf(firstUnassigned.start) : null;
    const noneHint = firstUnassigned ? `가장 빠른 체크인 ${dayLabel(firstUnassigned.start)}${firstDday ? ` · ${firstDday.label}` : ''}` : '모든 예약에 숙소를 골랐어요';

    return (
        <div className="lq">
            <AdminStatRow label="배정 상태" className="lq-stats">
                {(['none', 'sel', 'req', 'ok'] as const).map(key => (
                    <AdminStat key={key} label={STATE_LABEL[key]} value={counts[key]} unit="건" attention={key === 'none' && counts.none > 0}
                        hint={key === 'none' ? noneHint : STATE_HINT[key]} active={filter === key} onClick={() => setFilter(filter === key ? 'all' : key)} />
                ))}
            </AdminStatRow>

            <div className="lq-work">
                <AdminCard className="lq-queue" title={<>예약 <span className="lq-count">{list.length}</span></>}
                    actions={filter === 'all'
                        ? <span className="lq-sort">체크인 빠른 순</span>
                        : <AdminTextButton size="sm" tone="primary" onClick={() => setFilter('all')}>{STATE_LABEL[filter]} · 전체 보기</AdminTextButton>}>
                    <AdminSearch value={q} onChange={setQ} placeholder="고객명·숙소명으로 찾기" aria-label="고객명·숙소명 검색" />
                    {loading ? <AdminLoading label="예약을 불러오고 있어요…" />
                        : !list.length ? <AdminEmpty title="조건에 맞는 예약이 없어요." description={filter === 'all' && !needle ? '다가오는 투어가 생기면 여기에 보여요.' : '검색어나 상태를 바꿔 보세요.'} />
                        : <ul className="lq-list" aria-label="숙소 배정 예약">
                            {shown.map(m => <li key={m.tour.id}><QueueItem m={m} selected={selected?.tour.id === m.tour.id} dirty={props.dirty.has(m.tour.id)} draft={!!props.pending[m.tour.id]} onPick={() => pick(m.tour.id)} /></li>)}
                        </ul>}
                    {list.length > shown.length && <AdminTextButton size="sm" className="lq-more" onClick={() => setLimit(limit + PAGE)}>{list.length - shown.length}건 더 보기</AdminTextButton>}
                </AdminCard>

                <div className="lq-detail-wrap" ref={detailRef}>
                    {selected ? <TourDetail key={selected.tour.id} m={selected} {...props} />
                        : !loading && <AdminCard><AdminEmpty title="왼쪽에서 예약을 골라 주세요." /></AdminCard>}
                </div>
            </div>
        </div>
    );
}

function QueueItem({ m, selected, dirty, draft, onPick }: { m: LodgeModel & { state: NightState }; selected: boolean; dirty: boolean; draft: boolean; onPick: () => void }) {
    const N = m.nights.length, unassigned = m.nights.filter(n => n.state === 'none').length, dday = ddayOf(m.start);
    const status = !N ? '숙박일 확인' : m.state === 'none' ? `${unassigned}박 미배정` : m.state === 'sel' ? '요청 전' : STATE_LABEL[m.state];
    return (
        <AdminPickCard selected={selected} onClick={onPick} className="lq-item" aria-label={`${tourNameOf(m.tour)} 예약 · ${status}`}>
            <span className="lq-item-head">
                {dday && <AdminBadge tone="neutral" strong={dday.soon}>{dday.label}</AdminBadge>}
                <b className="lq-item-name">{tourNameOf(m.tour)}</b>
                {m.tour.reservationNumber && <span className="lq-sub">#{m.tour.reservationNumber}</span>}
                <span className="lq-gap" />
                {draft ? <AdminBadge tone="warn" outlined>초안</AdminBadge> : dirty && <AdminBadge tone="info" outlined>변경됨</AdminBadge>}
                <AdminBadge tone={STATE_TONE[m.state]}>{status}</AdminBadge>
            </span>
            <span className="lq-sub">{shortDate(m.start)}{m.start && ` (${weekday(m.start)})`} → {shortDate(m.end)}{m.end && ` (${weekday(m.end)})`} · {spanLabel(N)} · {m.tour.travelers ? `${m.tour.travelers}명` : '인원 미정'}{m.plan ? ` · ${PACKAGE_LABELS[m.plan]}` : ''}</span>
            {N > 0 && <span className="lq-segs">
                {m.nights.map(n => <span key={n.index} className="lq-seg" data-state={n.state === 'none' ? 'none' : 'done'} title={`${shortDate(n.date)} ${n.state === 'none' ? '미배정' : '배정됨'}`}>
                    {n.state === 'none' ? <i aria-hidden="true" /> : <IconCheck aria-hidden="true" />}{shortDate(n.date)}
                </span>)}
                <span className="lq-progress">{N - unassigned}/{N}박 배정</span>
            </span>}
        </AdminPickCard>
    );
}

function TourDetail({ m, tours, rowsOf, lodges, lodgeRegions, resourcesLoading, dirty, pending, savingId, onAreaCleared, onPatch, onPackage, onSave, onDiscard, onResolveDraft, onAddNight, onRemoveNight, onOpenCard }:
    { m: LodgeModel & { state: NightState } } & LodgeAssignQueueProps) {
    const t = m.tour, N = m.nights.length, id = t.id;
    const locked = !!pending[id] || savingId === id, isDirty = dirty.has(id), dday = ddayOf(m.start);
    const firstOpen = Math.max(0, m.nights.findIndex(n => n.state === 'none'));
    const [open, setOpen] = useState<Set<number>>(() => new Set(N ? [firstOpen] : []));
    const [manual, setManual] = useState<Set<number>>(new Set());
    const allOpen = N > 0 && m.nights.every(n => open.has(n.index));
    const toggle = (index: number) => setOpen(prev => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next; });
    const patch = (index: number, value: LodgePatch) => onPatch(id, index, value, m.fill);
    const assigned = m.nights.filter(n => n.state !== 'none').length;
    const mailed = m.nights.filter(n => !['발송전', '배정X'].includes(lodgeMailStatus(n.acc))).length;
    const confirmed = m.nights.filter(n => n.state === 'ok').length;
    const nextDate = (() => { const last = m.nights[N - 1]?.date || m.end; if (!last) return ''; const d = new Date(`${last}T00:00:00`); d.setDate(d.getDate() + 1); return dotted(dateKeyOf(d)); })();
    /** 숙소 이름(소문자) → 불러온 예약에서 배정된 숙박 수(숙소 고르기의 ‘자주 쓴 숙소’) */
    const usage = useMemo(() => {
        const count: Record<string, number> = {};
        tours.forEach(tour => rowsOf(tour).forEach(row => { const name = row.accommodation?.name?.trim().toLowerCase(); if (name) count[name] = (count[name] || 0) + 1; }));
        return count;
    }, [tours, rowsOf]);
    const href = t.source === 'quote_booking' ? quoteCustomerHref(t.bookingId, '/admin/accommodation-ops') : productCustomerHref(t.bookingId, '/admin/accommodation-ops');

    return (
        <AdminCard as="article" className="lq-detail" aria-label={`${tourNameOf(t)} 숙소 배정`}>
            <header className="lq-detail-head">
                <div className="lq-title">
                    <div className="lq-title-row">
                        <h2>{tourNameOf(t)}</h2>
                        {t.reservationNumber && <span className="lq-sub">#{t.reservationNumber}</span>}
                        {dday && <AdminBadge tone="neutral" strong={dday.soon}>{dday.label}</AdminBadge>}
                        <AdminBadge outlined>{t.source === 'quote_booking' ? '견적 예약' : '상품 예약'}</AdminBadge>
                    </div>
                    <span className="lq-sub">{dotted(m.start)} ({weekday(m.start)}) → {dotted(m.end)} ({weekday(m.end)}) · {spanLabel(N)} · {t.travelers ? `${t.travelers}명` : '인원 미정'}</span>
                    <span className="lq-links">
                        <AdminButton size="sm" variant="weak" to={href}>예약 상세</AdminButton>
                        <AdminTextButton size="sm" tone="assistive" onClick={() => onOpenCard(id)}>여행자·일정 보기</AdminTextButton>
                    </span>
                </div>
                <div className="lq-head-actions">
                    <AdminSelect aria-label="계약 패키지" className="lq-package" value={t.contractPackageType || AUTO} disabled={locked || !!savingId}
                        options={PACKAGE_OPTIONS} onChange={value => onPackage(id, (value === AUTO ? '' : value) as ContractPackageType)} />
                    {isDirty && <AdminButton variant="weak" disabled={!!savingId} onClick={() => onDiscard(id)}>변경 취소</AdminButton>}
                    <AdminButton variant="primary" disabled={!isDirty || !!savingId || !!pending[id]} loading={savingId === id} onClick={() => onSave(id)}>배정 저장</AdminButton>
                </div>
            </header>

            {!!pending[id] && <AdminMessage tone="cautionary" title="보관된 배정 초안이 있어요" role="status"
                actions={<>
                    <AdminTextButton size="sm" tone="primary" disabled={!!savingId} onClick={() => onResolveDraft(id, true)}>초안 복원</AdminTextButton>
                    <AdminTextButton size="sm" tone="assistive" disabled={!!savingId} onClick={() => onResolveDraft(id, false)}>초안 버리기</AdminTextButton>
                </>}>복원하거나 버린 뒤에 고칠 수 있어요.</AdminMessage>}

            <AdminStatRow label="숙박 진행" className="lq-tiles">
                <AdminStat label="숙소 배정" value={assigned} unit={`/ ${N}박`} />
                <AdminStat label="요청 메일 발송" value={mailed} unit={`/ ${N}박`} />
                <AdminStat label="예약 완료" value={confirmed} unit={`/ ${N}박`} />
            </AdminStatRow>

            <section className="lq-nights" aria-label="숙박별 배정">
                <div className="lq-nights-head">
                    <h3>숙박 {N}박</h3>
                    {N > 0 && <AdminTextButton size="sm" tone="primary" onClick={() => setOpen(allOpen ? new Set() : new Set(m.nights.map(n => n.index)))}>{allOpen ? '모두 접기' : '모두 펼치기'}</AdminTextButton>}
                </div>
                {!N && <AdminEmpty title="숙박일이 없어요." description="당일 여행이거나 여행 기간을 확인해야 해요. 필요하면 아래에서 숙박을 추가하세요." />}
                {m.nights.map(n => {
                    const acc = n.acc, hasLodge = !!acc.name?.trim(), isOpen = open.has(n.index), key = `${id}:${n.index}`;
                    const done = contactStepsDone(acc), next = nextMailStage(acc);
                    const mail = lodgeMailStatus(acc), status = lodgeReservationStatus(acc.bookingStatus);
                    const summary = [n.area, acc.type, acc.assignType, acc.adminMemo?.trim() ? '메모 있음' : ''].filter(Boolean).join(' · ') || '지역·등급 미정';
                    const stage = done >= LODGE_CONTACT_STEPS.length ? '연락 완료' : `다음: ${LODGE_CONTACT_STEPS[done]}`;
                    const isManual = manual.has(n.index) || (hasLodge && !lodges.some(l => l.id === acc.id));
                    const added = n.index >= m.planned;
                    return (
                        <div key={n.index} className={`lq-night${isOpen ? ' is-open' : ''}`}>
                            <AdminPickCard expanded={isOpen} onClick={() => toggle(n.index)} className="lq-night-head" aria-controls={`lq-night-${key}`}>
                                <span className="lq-night-date"><b>{shortDate(n.date)}</b> <small>{weekday(n.date)}</small><span className="lq-sub">{n.index + 1}박째 · {t.travelers || '-'}명</span></span>
                                <span className="lq-night-main">
                                    <b className={hasLodge ? '' : 'is-empty'}>{hasLodge ? acc.name : '숙소를 아직 고르지 않았습니다'}</b>
                                    <span className="lq-sub">{summary}</span>
                                </span>
                                <span className="lq-night-stage"><span className="lq-sub">{stage}</span><AdminBadge tone={STATE_TONE[n.state]}>{n.state === 'none' ? '미배정' : n.state === 'sel' ? '배정' : STATE_LABEL[n.state]}</AdminBadge></span>
                                {isOpen ? <IconChevronUp className="lq-chev" aria-hidden="true" /> : <IconChevronDown className="lq-chev" aria-hidden="true" />}
                            </AdminPickCard>
                            {isOpen && <div className="lq-night-body" id={`lq-night-${key}`}>
                                <div className="lq-fields">
                                    <AdminField id={`${key}-date`} label="예약일자"><span className="lq-readonly">{dayLabel(n.date)}</span></AdminField>
                                    <AdminField id={`${key}-pax`} label="인원"><span className="lq-readonly">{t.travelers ? `${t.travelers}명` : '-'}</span></AdminField>
                                    <AdminField id={`${key}-area`} label="숙소지역" hint={n.fromPlan ? '계약 일정에서 불러온 지역' : undefined}>
                                        <AdminSelect id={`${key}-area`} value={n.area} disabled={locked} aria-label="숙소지역" placeholder="미정"
                                            options={[{ value: '', label: '미정' }, ...withCurrent([...new Set([...AREA_OPTIONS, ...lodgeRegions])], n.area).map(v => ({ value: v, label: v }))]}
                                            onChange={v => { onAreaCleared(key, !v); patch(n.index, { location: v, region: v }); }} />
                                    </AdminField>
                                    <AdminField id={`${key}-grade`} label="등급">
                                        <AdminSelect id={`${key}-grade`} aria-label="등급" value={acc.type || ''} disabled={locked} placeholder="미정"
                                            options={[{ value: '', label: '미정' }, ...withCurrent(LODGE_GRADE_OPTIONS, acc.type).map(v => ({ value: v, label: v }))]}
                                            onChange={v => patch(n.index, { type: v || undefined })} />
                                    </AdminField>
                                    <AdminField id={`${key}-lodge`} label="숙소정보" className="lq-span-2" hint={resourcesLoading ? '등록 숙소를 불러오는 중…' : '눌러서 이름·지역·등급으로 찾아요'}>
                                        <LodgePicker id={`${key}-lodge`} lodges={lodges} regions={lodgeRegions} area={n.area} nightLabel={dayLabel(n.date)} usage={usage}
                                            context={[`${tourNameOf(t)}${t.reservationNumber ? ` #${t.reservationNumber}` : ''}`, `${n.index + 1}박째`, t.travelers ? `${t.travelers}명` : '', n.area ? `숙소지역 ${n.area}` : ''].filter(Boolean).join(' · ')}
                                            currentId={isManual ? undefined : acc.id} currentName={acc.name} manual={isManual && hasLodge}
                                            disabled={locked} loading={resourcesLoading}
                                            onPick={lodge => {
                                                setManual(prev => { const next = new Set(prev); next.delete(n.index); return next; });
                                                patch(n.index, { ...selectResourceLodge(n.night, lodge).accommodation, ...(n.area ? { location: n.area, region: n.area } : {}) });
                                            }}
                                            onClear={() => { setManual(prev => { const next = new Set(prev); next.delete(n.index); return next; }); patch(n.index, CLEAR_LODGE); }}
                                            onManual={() => setManual(prev => new Set(prev).add(n.index))} />
                                        {isManual && <AdminTextInput large aria-label="숙소명 직접 입력" placeholder="숙소명 직접 입력" value={acc.name || ''} disabled={locked} className="lq-manual"
                                            onChange={e => { if (e.target.value !== acc.name) patch(n.index, { ...CLEAR_LODGE, name: e.target.value }); }} />}
                                    </AdminField>
                                    <AdminField id={`${key}-rooms`} label="방수">
                                        <AdminTextInput large id={`${key}-rooms`} inputMode="numeric" placeholder={`1–${MAX_ROOMS_PER_NIGHT}`} value={acc.roomCount == null ? '' : String(acc.roomCount)} disabled={locked}
                                            onChange={e => { const count = roomValue(e.target.value.trim()); if (count !== undefined) patch(n.index, { roomCount: count }); }} />
                                    </AdminField>
                                    <AdminField id={`${key}-assign`} label="배정 구분">
                                        <AdminSelect id={`${key}-assign`} aria-label="배정 구분" value={acc.assignType || ''} disabled={locked} placeholder="미정"
                                            options={[{ value: '', label: '미정' }, ...withCurrent(ASSIGN_TYPE_OPTIONS, acc.assignType).map(v => ({ value: v, label: v }))]}
                                            onChange={v => patch(n.index, { assignType: v })} />
                                    </AdminField>
                                </div>

                                <div className="lq-contact">
                                    <ol className="lq-steps" aria-label="숙소 연락 단계">
                                        {LODGE_CONTACT_STEPS.map((label, i) => <li key={label} data-state={i < done ? 'done' : i === done ? 'current' : 'todo'}>
                                            <i aria-hidden="true">{i < done && <IconCheck />}</i>{label}
                                        </li>)}
                                    </ol>
                                    <div className="lq-contact-fields">
                                        <AdminField id={`${key}-mail`} label="메일발송">
                                            <AdminSelect id={`${key}-mail`} aria-label="메일발송" value={mail} disabled={locked}
                                                options={LODGE_MAIL_STAGES.map(s => ({ value: s, label: s, disabled: !hasLodge && s !== '발송전' && s !== '배정X' }))}
                                                onChange={v => patch(n.index, { mailStatus: v })} />
                                        </AdminField>
                                        <AdminField id={`${key}-maildate`} label="메일발송일자">
                                            <AdminTextInput large id={`${key}-maildate`} type="date" value={acc.mailSentDate || ''} disabled={locked} onChange={e => patch(n.index, { mailSentDate: e.target.value })} />
                                        </AdminField>
                                        <AdminField id={`${key}-status`} label="예약상태">
                                            <AdminSelect id={`${key}-status`} aria-label="예약상태" value={status} disabled={locked} placeholder="미정"
                                                options={[
                                                    ...(status && !LODGE_RESERVATION_STATES.some(s => s === status) ? [{ value: status, label: status, disabled: true }] : []),
                                                    ...LODGE_RESERVATION_STATES.map(s => ({ value: s, label: s, disabled: !hasLodge && s !== '배정X' })),
                                                ]}
                                                onChange={v => patch(n.index, changeLodgeReservation(acc, v))} />
                                        </AdminField>
                                        <span className="lq-contact-action">
                                            {!hasLodge ? <AdminButton variant="secondary" size="lg" disabled>숙소를 먼저 선택</AdminButton>
                                                : next && <AdminButton variant="secondary" size="lg" disabled={locked} onClick={() => patch(n.index, { mailStatus: next, mailSentDate: dateKeyOf(new Date()) })}>{next.replace('완료', ' 보냄')}으로 표시</AdminButton>}
                                        </span>
                                    </div>
                                    <p className="lq-contact-note">요청 메일은 숙소에 직접 보내고, 보낸 뒤 여기서 회차를 표시해요(오늘 날짜가 함께 들어가요).</p>
                                </div>

                                <AdminField id={`${key}-memo`} label="예약메모">
                                    <AdminTextInput large id={`${key}-memo`} maxLength={2000} placeholder="메모를 입력해 주세요" value={acc.adminMemo || ''} disabled={locked} onChange={e => patch(n.index, { adminMemo: e.target.value })} />
                                </AdminField>
                                {added && <AdminTextButton size="sm" tone="assistive" className="lq-remove" disabled={locked}
                                    onClick={async () => { if (await adminConfirm({ title: '숙박 삭제', message: `${dayLabel(n.date)} 숙박을 삭제할까요? 배정 저장을 눌러야 반영됩니다.`, confirmLabel: '삭제', danger: true })) onRemoveNight(id, n.index); }}>추가한 숙박 삭제</AdminTextButton>}
                            </div>}
                        </div>
                    );
                })}
            </section>

            <footer className="lq-foot">
                <AdminButton variant="secondary" leading={<IconPlus />} disabled={locked} onClick={() => onAddNight(id, m.fill)}>숙박 추가{nextDate && ` · ${nextDate}`}</AdminButton>
                <span className="lq-sub">{isDirty ? '저장하지 않은 변경이 있어요. 배정 저장을 눌러야 반영됩니다(브라우저 초안으로도 보관돼요).' : '변경 사항은 배정 저장을 눌러야 반영됩니다. 계약 패키지는 고르면 바로 저장돼요.'}</span>
            </footer>
        </AdminCard>
    );
}
