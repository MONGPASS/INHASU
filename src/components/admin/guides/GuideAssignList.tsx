import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown, IconMoreVertical } from '@montage-ui/icon';
import { AdminBadge, AdminButton, AdminCheckbox, AdminChipGroup, AdminIconButton, AdminPagination, AdminSearch, AdminSelect, cx, type AdminTone, type AdminTagTone } from '../ui';
import type { RegisteredVehicle } from '../../../utils/registeredAssignmentResources';
import { guideOverlaps, overlapLabel } from '../../../utils/assignmentAvailability';
import { hasGuide, vehicleClash } from './guideScheduleModel';
import { dday, initial, nameOf, people, rangeFull, rangeShort, regionOf, sourceLabel, startOf, tourName, nights, norm, type CarInfo, type GuideItem, type GuideRow } from './guideScheduleFormat';
import type { AssignmentPick } from '../../../utils/assignmentLinks';
import './guide-assign.css';

/** 목록의 배정 상태: 가이드·차량 둘 다 = 배정 완료, 하나만 = 부분 배정, 둘 다 없음 = 미배정. 가이드·차량이 다른 투어와 겹치면 중복. */
export type ListState = 'none' | 'part' | 'done' | 'dup';
const STATE: Record<ListState, { label: string; tone: AdminTone | AdminTagTone; strong?: boolean }> = {
    none: { label: '미배정', tone: 'danger' }, part: { label: '부분 배정', tone: 'tag-blue' }, done: { label: '배정 완료', tone: 'info' }, dup: { label: '중복', tone: 'danger', strong: true },
};
/** 출발 2주 안이면 빈 칸을 빨간 점선으로 강조한다(통합 예약 목록과 같은 기준). */
const URGENT_DAYS = 14;
const PAGE_SIZES = [10, 20, 50];

interface Pop { key: string; kind: 'guide' | 'car'; x: number; y: number; /** 칸 위에 열 때: 화면 아래에서 띄울 거리(창 높이와 관계없이 칸에 붙는다) */ up?: number }

export interface GuideAssignListProps {
    /** 오늘 이후 투어(출발 빠른 순) */
    bookings: GuideItem[];
    /** 겹침 확인에 쓰는 진행 중인 예약 전체 */
    active: GuideItem[];
    today: string;
    rows: GuideRow[];
    vehicles: RegisteredVehicle[];
    dup: Set<string>;
    carDup: Set<string>;
    savingKey: string;
    rowOf: (b: GuideItem) => GuideRow | undefined;
    vehicleOf: (b: GuideItem) => RegisteredVehicle | undefined;
    carInfo: (b: GuideItem) => CarInfo;
    guideImg: (b: GuideItem) => string;
    onAssignGuide: (b: GuideItem, row: GuideRow) => void;
    onClearGuide: (b: GuideItem) => void;
    onAssignCar: (b: GuideItem, vehicle: RegisteredVehicle | null) => void;
    onDetail: (b: GuideItem, target: HTMLElement) => void;
    onMore: (target: HTMLElement, b: GuideItem) => void;
    /** 예약 상세의 ‘편집’으로 들어온 예약(주소 `booking`·`pick`·`returnTo`). 그 예약을 강조하고 고르기 창을 연다. */
    focus?: { key: string; pick: AssignmentPick; returnTo: string } | null;
}

/** 팝오버를 버튼 아래(공간이 없으면 위)에 연다. 위에 열 때는 창의 아래쪽을 칸 바로 위에 붙인다. */
const popAt = (target: HTMLElement, width: number, height: number) => {
    const r = target.getBoundingClientRect(), vw = window.innerWidth, vh = window.innerHeight, x = Math.max(12, Math.min(r.left, vw - width - 12));
    return r.bottom + 6 > vh - height ? { x, y: 12, up: vh - r.top + 6 } : { x, y: r.bottom + 6 };
};

export function GuideAvatar({ name, img, large }: { name: string; img?: string; large?: boolean }) {
    const [broken, setBroken] = useState(false);
    return <span className={cx('adm-ga-av', large && 'is-lg')} aria-hidden="true">{img && !broken ? <img src={img} alt="" onError={() => setBroken(true)} /> : initial(name)}</span>;
}

/**
 * 가이드 배정하기(목록) — Claude Design ‘예약 관리 · 강력 개선안’ GuideAssign(2026-11-23).
 * 상태 칩 → 지역·월 → 흰 카드 표(고객·투어 / 여행기간 / 인원·지역 / 가이드 칸 / 차량(기사) 칸 / 배정 상태 / 관리).
 * 가이드·차량 칸을 누르면 바로 아래에 고르기 창이 열리고, 저장은 GuideSchedule의 배정 API(버전 확인 + 서버 가이드 중복 확인)를 쓴다.
 */
export function GuideAssignList(props: GuideAssignListProps) {
    const { bookings, active, today, rows, vehicles, dup, carDup, savingKey, rowOf, vehicleOf, carInfo, guideImg } = props;
    const [tab, setTab] = useState<'all' | ListState>('all');
    const [region, setRegion] = useState('all');
    const [month, setMonth] = useState('all');
    const [pageSize, setPageSize] = useState(10);
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const [pop, setPop] = useState<Pop | null>(null);
    const [search, setSearch] = useState('');
    // 예약 상세에서 지정한 예약: 필터를 풀고 그 예약이 있는 페이지로 간 뒤(렌더 중 한 번), 화면에 그려지면 고르기 창을 연다.
    const focus = props.focus || null;
    const focusIdx = focus ? bookings.findIndex(b => b.key === focus.key) : -1;
    const [focusDone, setFocusDone] = useState(false);
    if (focus && !focusDone && focusIdx >= 0) {
        setFocusDone(true); setTab('all'); setRegion('all'); setMonth('all'); setPage(Math.floor(focusIdx / pageSize) + 1);
    }
    const focusOpened = useRef(false);
    useEffect(() => {
        if (!focus || !focusDone || focusOpened.current) return;
        const timer = window.setTimeout(() => {
            const rowEl = document.querySelector<HTMLElement>(`[data-ga-key="${CSS.escape(focus.key)}"]`);
            const slot = rowEl?.querySelector<HTMLElement>(`[data-ga-slot="${focus.pick}"]`);
            const target = bookings.find(b => b.key === focus.key);
            if (!rowEl || !slot || !target) return;
            focusOpened.current = true;
            rowEl.scrollIntoView({ block: 'center', behavior: 'instant' });
            // 스크롤이 끝난 다음 프레임에 칸 위치를 재야 고르기 창이 칸 바로 아래에 붙는다.
            window.requestAnimationFrame(() => {
                if (!slot.hasAttribute('disabled')) { setSearch(''); setPop({ key: target.key, kind: focus.pick, ...popAt(slot, focus.pick === 'guide' ? 340 : 300, 380) }); }
            });
        }, 150);
        return () => window.clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- 지정한 예약이 처음 그려졌을 때 한 번만 연다
    }, [focus, focusDone]);
    useEffect(() => {
        if (!pop) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setPop(null); } };
        window.addEventListener('keydown', onKey, true); return () => window.removeEventListener('keydown', onKey, true);
    }, [pop]);

    const stateOf = (b: GuideItem): ListState => dup.has(b.key) || carDup.has(b.key) ? 'dup'
        : hasGuide(b) && b.assignment?.vehicle?.type ? 'done' : hasGuide(b) || b.assignment?.vehicle?.type ? 'part' : 'none';
    const regionOpts = useMemo(() => [...new Set(bookings.map(b => regionOf(b) || '지역 미정'))], [bookings]);
    const monthOpts = useMemo(() => [...new Set(bookings.map(b => startOf(b).slice(0, 7)).filter(Boolean))], [bookings]);
    const scoped = bookings.filter(b => (region === 'all' || (regionOf(b) || '지역 미정') === region) && (month === 'all' || startOf(b).slice(0, 7) === month));
    const count = { all: scoped.length, none: 0, part: 0, done: 0, dup: 0 };
    scoped.forEach(b => { count[stateOf(b)]++; });
    const list = scoped.filter(b => tab === 'all' || stateOf(b) === tab);
    const pages = Math.max(1, Math.ceil(list.length / pageSize)), pageNow = Math.min(page, pages);
    const pageRows = list.slice((pageNow - 1) * pageSize, pageNow * pageSize);
    const allSel = pageRows.length > 0 && pageRows.every(b => selected[b.key]), someSel = pageRows.some(b => selected[b.key]);
    const selN = Object.values(selected).filter(Boolean).length;
    const go = (fn: () => void) => { fn(); setPage(1); setPop(null); };
    const dot = (tone: string) => <span className={cx('adm-ga-dot', `is-${tone}`)} aria-hidden="true" />;
    const tabs = [
        { value: 'all' as const, label: '전체', count: count.all },
        { value: 'none' as const, label: <>{dot('none')}미배정</>, count: count.none },
        { value: 'part' as const, label: <>{dot('part')}부분 배정</>, count: count.part },
        { value: 'done' as const, label: <>{dot('done')}배정 완료</>, count: count.done },
        ...(count.dup ? [{ value: 'dup' as const, label: <>{dot('dup')}중복</>, count: count.dup }] : []),
    ];
    const openPop = (target: HTMLElement, b: GuideItem, kind: Pop['kind']) => {
        if (pop?.key === b.key && pop.kind === kind) { setPop(null); return; }
        setSearch(''); setPop({ key: b.key, kind, ...popAt(target, kind === 'guide' ? 340 : 300, 380) });
    };
    const popBooking = pop ? bookings.find(b => b.key === pop.key) : undefined;

    // ── 가이드 고르기: 현재 → 가능 → 교대 → 겹침 ──
    const guidePop = popBooking && pop?.kind === 'guide' && (() => {
        const b = popBooking, current = rowOf(b), q = norm(search);
        const ranked = rows.filter(r => r.registered || r.key === current?.key).map(row => {
            const found = guideOverlaps(active, row.guide, b);
            const overlap = found.find(x => x.kind === 'overlap'), handover = found.find(x => x.kind === 'handover'), cur = row.key === current?.key;
            return { row, overlap, handover, cur, rank: cur ? -1 : overlap ? 2 : handover ? 1 : 0 };
        }).filter(x => !q || norm(x.row.guide.name).includes(q) || norm(x.row.resource?.phone).includes(q))
            .sort((a, c) => a.rank - c.rank || a.row.guide.name.localeCompare(c.row.guide.name, 'ko-KR'));
        return <div className="adm-ga-pop is-guide" role="dialog" aria-label="가이드 고르기" style={pop.up !== undefined ? { left: pop.x, bottom: pop.up } : { left: pop.x, top: pop.y }}>
            <div className="adm-ga-pop-head"><b>가이드 고르기</b><span>{rangeFull(b)}</span></div>
            <AdminSearch value={search} onChange={setSearch} placeholder="이름으로 찾기" wide autoFocus />
            <div className="adm-ga-opts" role="listbox" aria-label="가이드">
                {ranked.map(({ row, overlap, handover, cur }) => (
                    <button key={row.key} type="button" role="option" aria-selected={cur} className={cx('adm-ga-opt', cur && 'is-on', overlap && 'is-busy')}
                        onClick={() => { setPop(null); if (!cur) props.onAssignGuide(b, row); }}>
                        <GuideAvatar name={row.guide.name} img={row.resource?.image} />
                        <span className="adm-ga-opt-text"><b>{row.guide.name}</b>
                            <span className={overlap ? 'is-alert' : undefined}>{overlap ? `겹침 · ${overlapLabel(overlap.booking)}`
                                : handover ? `같은 날 교대 · ${overlapLabel(handover.booking)}` : row.registered ? '이 기간 다른 배정 없음' : '등록 안 된 가이드'}</span></span>
                        {cur ? <span className="adm-ga-tag is-on">배정됨</span> : !overlap && <span className="adm-ga-tag">{handover ? '교대' : '가능'}</span>}
                    </button>
                ))}
                {!ranked.length && <span className="adm-ga-pop-empty">{rows.length ? '찾는 가이드가 없어요.' : '등록된 가이드가 없어요. 등록 정보에서 가이드를 먼저 추가해 주세요.'}</span>}
                {hasGuide(b) && <button type="button" className="adm-ga-opt is-muted" onClick={() => { setPop(null); props.onClearGuide(b); }}>
                    <span className="adm-ga-opt-text"><b>배정 해제</b><span>미배정 투어로 옮겨요</span></span></button>}
            </div>
            <span className="adm-ga-pop-note">이 기간에 다른 투어가 있는 가이드는 아래로 내려갑니다.</span>
        </div>;
    })();

    // ── 차량 고르기 ──
    const carPop = popBooking && pop?.kind === 'car' && (() => {
        const b = popBooking, cur = vehicleOf(b);
        return <div className="adm-ga-pop is-car" role="dialog" aria-label="차량 고르기" style={pop.up !== undefined ? { left: pop.x, bottom: pop.up } : { left: pop.x, top: pop.y }}>
            <div className="adm-ga-pop-head"><b>차량 고르기 · {people(b)}</b><span>{rangeShort(b)}</span></div>
            <div className="adm-ga-opts" role="listbox" aria-label="차량">
                {vehicles.map(v => {
                    const clash = vehicleClash(active, v.name, b), on = cur === v, plate = String(v.snapshot.plate || '');
                    const driver = [v.driver, v.phone].filter(Boolean).join(' · ');
                    return <button key={v.name} type="button" role="option" aria-selected={on} className={cx('adm-ga-opt', on && 'is-on', clash && 'is-busy')}
                        onClick={() => { setPop(null); if (!on) props.onAssignCar(b, v); }}>
                        <span className="adm-ga-opt-text"><b>{plate ? `${v.name} · ${plate}` : v.name}</b>
                            <span className={clash ? 'is-alert' : driver ? undefined : 'is-warn'}>{clash ? `겹침 · ${overlapLabel(clash)}` : driver ? `기사 ${driver}` : '기사 정보 없음'}</span></span>
                        {on ? <span className="adm-ga-tag is-on">배정됨</span> : !clash && <span className="adm-ga-tag">가능</span>}
                    </button>;
                })}
                {!vehicles.length && <span className="adm-ga-pop-empty">등록된 차량이 없어요. 등록 정보에서 차량을 먼저 추가해 주세요.</span>}
                {b.assignment?.vehicle?.type && <button type="button" className="adm-ga-opt is-muted" onClick={() => { setPop(null); props.onAssignCar(b, null); }}>
                    <span className="adm-ga-opt-text"><b>배정 해제</b><span>차량 없이 둬요</span></span></button>}
            </div>
        </div>;
    })();

    return (
        <div className="adm-ga">
            {focus && <div className="adm-ga-focus adm-msg" role="status">
                <span>{focusIdx >= 0 ? <>예약 상세에서 연 예약 <b>{nameOf(bookings[focusIdx])}</b> · {rangeShort(bookings[focusIdx])} — {focus.pick === 'car' ? '차량' : '가이드'}을 골라 주세요.</>
                    : bookings.length ? '예약 상세에서 연 예약이 오늘 이후 투어 목록에 없어요(지난 투어이거나 취소된 예약).' : '예약 상세에서 연 예약을 찾는 중이에요.'}</span>
                {focus.returnTo && <AdminButton variant="weak" size="sm" onClick={() => window.location.assign(focus.returnTo)}>예약 상세로 돌아가기</AdminButton>}
            </div>}
            <div className="adm-ga-bar">
                <AdminChipGroup label="배정 상태" items={tabs} value={tab} onChange={v => go(() => setTab(v))} />
                <div className="adm-ga-selects">
                    {selN > 0 && <span className="adm-ga-sel-n">{selN}개 선택</span>}
                    <AdminSelect aria-label="지역" value={region} onChange={v => go(() => setRegion(v))} className="adm-ga-select"
                        options={[{ value: 'all', label: '전체 지역' }, ...regionOpts.map(v => ({ value: v, label: v }))]} />
                    <AdminSelect aria-label="월" value={month} onChange={v => go(() => setMonth(v))} className="adm-ga-select"
                        options={[{ value: 'all', label: '전체 월' }, ...monthOpts.map(v => ({ value: v, label: `${v.slice(0, 4)}년 ${Number(v.slice(5))}월` }))]} />
                </div>
            </div>

            <section className="adm-ga-card" aria-label="가이드 배정 목록">
                <div className="adm-ga-scroll">
                    <div className="adm-ga-table">
                        <div className="adm-ga-row is-head">
                            <span className="adm-ga-c-check"><AdminCheckbox size="sm" aria-label="전체 선택" checked={allSel} indeterminate={!allSel && someSel}
                                onChange={() => setSelected(s => { const n = { ...s }; pageRows.forEach(b => { n[b.key] = !allSel; }); return n; })} /></span>
                            {['고객 · 투어', '여행기간', '인원 · 지역', '가이드', '차량(기사)', '배정 상태'].map(h => <span key={h}>{h}</span>)}
                            <span className="adm-ga-c-acts">관리</span>
                        </div>
                        {pageRows.map(b => {
                            const g = b.assignment?.guide, assigned = hasGuide(b), car = carInfo(b), st = stateOf(b), d = dday(b, today);
                            const urgent = d.days !== null && d.days <= URGENT_DAYS, gOpen = pop?.key === b.key && pop.kind === 'guide', cOpen = pop?.key === b.key && pop.kind === 'car';
                            const busy = savingKey === b.key;
                            return (
                                <div key={b.key} className={cx('adm-ga-row', selected[b.key] && 'is-sel', focus?.key === b.key && 'is-focus')} data-ga-key={b.key}>
                                    <span className="adm-ga-c-check"><AdminCheckbox size="sm" aria-label={`${nameOf(b)} 선택`} checked={!!selected[b.key]}
                                        onChange={() => setSelected(s => ({ ...s, [b.key]: !s[b.key] }))} /></span>
                                    <span className="adm-ga-stack">
                                        <b className="adm-ga-name" title={nameOf(b)}>{nameOf(b)}</b>
                                        <span className="adm-ga-sub adm-ga-ell" title={tourName(b)}>{tourName(b)} · {b.reservationNumber ? `#${b.reservationNumber}` : sourceLabel(b)}</span>
                                    </span>
                                    <span className="adm-ga-stack">
                                        <span className="adm-ga-strong adm-ga-nowrap">{rangeShort(b)}</span>
                                        <span className="adm-ga-line"><AdminBadge tone="neutral" strong={urgent}>{d.label}</AdminBadge>
                                            <span className="adm-ga-sub">{startOf(b).slice(0, 4)} · {nights(b)}</span></span>
                                    </span>
                                    <span className="adm-ga-stack">
                                        <span className="adm-ga-strong">{people(b)}</span>
                                        <span className="adm-ga-sub adm-ga-ell">{regionOf(b) || '지역 미정'}</span>
                                    </span>
                                    <span>
                                        <button type="button" className={cx('adm-ga-slot', assigned ? 'is-filled' : 'is-empty', !assigned && urgent && 'is-urgent', dup.has(b.key) && 'is-dup', gOpen && 'is-open')}
                                            data-ga-slot="guide" disabled={busy} aria-haspopup="dialog" aria-expanded={gOpen} onClick={e => openPop(e.currentTarget, b, 'guide')}>
                                            {assigned ? <GuideAvatar name={g?.name || ''} img={guideImg(b)} /> : <span className="adm-ga-plus" aria-hidden="true">+</span>}
                                            <span className="adm-ga-slot-text">{assigned ? <><b>{g?.name}</b><span>{dup.has(b.key) ? '일정 겹침 · 바꾸기' : '배정됨 · 바꾸기'}</span></> : <b>가이드 배정</b>}</span>
                                            <IconChevronDown className="adm-ga-caret" aria-hidden="true" />
                                        </button>
                                    </span>
                                    <span>
                                        <button type="button" className={cx('adm-ga-slot', car.type ? 'is-filled' : 'is-empty', !car.type && urgent && 'is-urgent', carDup.has(b.key) && 'is-dup', cOpen && 'is-open')}
                                            data-ga-slot="car" disabled={busy} aria-haspopup="dialog" aria-expanded={cOpen} onClick={e => openPop(e.currentTarget, b, 'car')}>
                                            {!car.type && <span className="adm-ga-plus" aria-hidden="true">+</span>}
                                            <span className="adm-ga-slot-text">{car.type ? <><b>{car.plate ? `${car.type} · ${car.plate}` : car.type}</b>
                                                {car.driver || car.phone ? <span>기사 {[car.driver, car.phone].filter(Boolean).join(' · ')}</span> : <span className="is-warn">기사 정보 없음</span>}</> : <b>차량 배정</b>}</span>
                                            <IconChevronDown className="adm-ga-caret" aria-hidden="true" />
                                        </button>
                                    </span>
                                    <span className="adm-ga-stack">
                                        <AdminBadge tone={STATE[st].tone} strong={STATE[st].strong} size="md" className="adm-ga-state">{STATE[st].label}</AdminBadge>
                                        <span className="adm-ga-bars" aria-hidden="true"><span className={cx(assigned && 'is-on')} /><span className={cx(car.type && 'is-on')} /></span>
                                    </span>
                                    <span className="adm-ga-c-acts">
                                        <AdminButton variant="weak" size="sm" onClick={e => props.onDetail(b, e.currentTarget)}
                                            title={assigned ? `${g?.name}의 전체 일정 보기` : '가이드를 먼저 배정해 주세요'}>상세</AdminButton>
                                        <AdminIconButton label={`${nameOf(b)} 더 보기`} size="md" onClick={e => props.onMore(e.currentTarget, b)}><IconMoreVertical aria-hidden="true" /></AdminIconButton>
                                    </span>
                                </div>
                            );
                        })}
                        {!list.length && <div className="adm-ga-empty">{bookings.length ? '조건에 맞는 투어가 없어요.' : '오늘 이후 진행하는 투어가 없어요.'}</div>}
                    </div>
                </div>
                <div className="adm-ga-foot">
                    <span className="adm-ga-sub">총 {list.length}건</span>
                    <AdminPagination page={pageNow} totalPages={pages} onChange={setPage} />
                    <AdminSelect aria-label="페이지당 개수" value={String(pageSize)} onChange={v => { setPageSize(Number(v)); setPage(1); }} className="adm-ga-select"
                        options={PAGE_SIZES.map(n => ({ value: String(n), label: `페이지당 ${n}개` }))} />
                </div>
            </section>

            {pop && createPortal(<div className="adm-ga-layer">
                <div className="adm-ga-pop-back" onClick={() => setPop(null)} />
                {guidePop}{carPop}
            </div>, document.body)}
        </div>
    );
}
