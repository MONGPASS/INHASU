import React, { useMemo, useState } from 'react';
import { IconChevronLeft, IconChevronRight, IconClose } from '@montage-ui/icon';
import { AdminBadge, AdminButton, AdminIconButton, cx } from '../ui';
import { coversDay, inMonth, monthDays, shiftMonth } from './guideScheduleModel';
import { GuideAvatar } from './GuideAssignList';
import { dday, endOf, md, nameOf, nights, people, period, regionOf, startOf, tourName, type CarInfo, type GuideItem, type GuideRow } from './guideScheduleFormat';
import './guide-assign.css';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
type Kind = 'plan' | 'done' | 'dup';

export interface GuideDrawerProps {
    row: GuideRow;
    today: string;
    /** 처음 보여 줄 달(YYYY-MM) */
    month: string;
    dup: Set<string>;
    carInfo: (b: GuideItem) => CarInfo;
    onClose: () => void;
    onItinerary: (b: GuideItem) => void;
    onPicket: (b: GuideItem) => void;
    onAssignCar: (target: HTMLElement, b: GuideItem) => void;
}

/**
 * 가이드 상세 패널 — Claude Design ‘예약 관리 · 강력 개선안’ GuideDrawer(2026-11-23).
 * 머리(이름·연락처) → 숫자 3칸 → 달별 근무일 달력(투어 기간을 이어진 띠로) → 다가오는 일정 카드 → 접히는 지난 일정.
 */
export function GuideDrawer({ row, today, month: initialMonth, dup, carInfo, onClose, onItinerary, onPicket, onAssignCar }: GuideDrawerProps) {
    const [month, setMonth] = useState(initialMonth);
    const [pastOpen, setPastOpen] = useState(true);
    const mine = useMemo(() => row.bookings.slice().sort((a, b) => startOf(a).localeCompare(startOf(b))), [row.bookings]);
    const days = useMemo(() => monthDays(month), [month]);
    const kindOf = (b: GuideItem): Kind => dup.has(b.key) ? 'dup' : endOf(b) < today ? 'done' : 'plan';
    const next = mine.filter(b => endOf(b) >= today);
    const past = mine.filter(b => endOf(b) < today).reverse();
    const inThisMonth = mine.filter(b => inMonth(b, days));
    const dupN = mine.filter(b => dup.has(b.key)).length;
    const phone = row.resource?.phone || String(mine.find(b => b.assignment?.guide?.phone)?.assignment?.guide?.phone || '');
    const firstWd = new Date(`${days[0]}T00:00:00`).getDay();
    const cells = days.map(day => {
        const on = mine.filter(b => coversDay(b, day)), wd = new Date(`${day}T00:00:00`).getDay();
        const b = on.find(x => dup.has(x.key)) || on[0], kind = b ? kindOf(b) : undefined;
        return { day, on, kind, start: !!b && (startOf(b) === day || wd === 0), end: !!b && (endOf(b) === day || wd === 6) };
    });
    const busyDays = cells.filter(c => c.on.length).length;
    const label = `${month.slice(0, 4)}년 ${Number(month.slice(5))}월`;
    const booked = (b: GuideItem) => b.createdAt ? `예약 접수 ${b.createdAt.slice(0, 10).replace(/-/g, '.')}` : '';
    const overlapWith = (b: GuideItem) => dup.has(b.key) ? mine.find(o => o.key !== b.key && startOf(o) <= endOf(b) && startOf(b) <= endOf(o)) : undefined;
    const carLine = (b: GuideItem) => {
        const car = carInfo(b);
        if (!car.type) return <span className="adm-gd-car is-warn">차량 미배정</span>;
        return <span className="adm-gd-car">{car.type}{car.plate ? ` · ${car.plate}` : ''} · {car.driver || car.phone ? `기사 ${[car.driver, car.phone].filter(Boolean).join(' · ')}` : <span className="is-warn">기사 정보 없음</span>}</span>;
    };
    const docs = (b: GuideItem, quiet?: boolean) => <span className="adm-gd-docs">
        <AdminButton variant={quiet ? 'secondary' : 'weak'} size="sm" title="담당 가이드에게 전달하는 일정표 열기" onClick={() => onItinerary(b)}>일정표</AdminButton>
        <AdminButton variant={quiet ? 'secondary' : 'weak'} size="sm" title="공항 미팅용 피켓 열기" onClick={() => onPicket(b)}>가이드 피켓</AdminButton>
    </span>;

    return <>
        <div className="adm-gd-dim" onClick={onClose} />
        <aside className="adm-gd" aria-label={`${row.guide.name} 가이드 상세`}>
            <header className="adm-gd-head">
                <GuideAvatar name={row.guide.name} img={row.resource?.image} large />
                <div className="adm-gd-who"><h2>{row.guide.name}</h2>
                    <span className={row.registered ? undefined : 'is-warn'}>{row.registered ? '등록된 가이드' : '등록 안 된 가이드'}{phone ? ` · ${phone}` : ''}</span></div>
                <AdminIconButton label="닫기" size="lg" onClick={onClose}><IconClose aria-hidden="true" /></AdminIconButton>
            </header>

            <div className="adm-gd-stats">
                <div className="adm-gd-stat"><span>예정 투어</span><b>{next.length}<small>팀</small></b></div>
                <div className="adm-gd-stat"><span>{Number(month.slice(5))}월 근무</span><b>{inThisMonth.length}<small>팀</small></b></div>
                <div className={cx('adm-gd-stat', dupN ? 'is-alert' : 'is-ok')}><span>일정 겹침</span><b>{dupN ? <>{dupN}<small>건</small></> : '없음'}</b></div>
            </div>

            <section className="adm-gd-cal" aria-label={`${label} 근무일`}>
                <div className="adm-gd-cal-head">
                    <span className="adm-gd-month">
                        <AdminIconButton label="이전 달" size="sm" onClick={() => setMonth(m => shiftMonth(m, -1))}><IconChevronLeft aria-hidden="true" /></AdminIconButton>
                        <h3>{label} 근무일</h3>
                        <AdminIconButton label="다음 달" size="sm" onClick={() => setMonth(m => shiftMonth(m, 1))}><IconChevronRight aria-hidden="true" /></AdminIconButton>
                    </span>
                    <span className="adm-gd-low">일정 있는 날 {busyDays}일</span>
                </div>
                <div className="adm-gd-grid is-wd" aria-hidden="true">{WD.map(w => <span key={w}>{w}</span>)}</div>
                <div className="adm-gd-grid">
                    {Array.from({ length: firstWd }, (_, i) => <span key={`e${i}`} />)}
                    {cells.map(c => <span key={c.day} title={c.on.map(nameOf).join(', ') || undefined}
                        className={cx('adm-gd-day', c.kind && `is-${c.kind}`, c.start && 'is-start', c.end && 'is-end', c.day === today && 'is-today')} aria-current={c.day === today ? 'date' : undefined}>
                        <span className="adm-gd-num">{Number(c.day.slice(8))}</span></span>)}
                </div>
                {inThisMonth.length > 0 && <div className="adm-gd-legend">
                    {inThisMonth.map(b => <span key={b.key}><i className={`is-${kindOf(b)}`} aria-hidden="true" />{({ plan: '예정', done: '완료', dup: '겹침' })[kindOf(b)]} · {nameOf(b)}</span>)}
                    {days.includes(today) && <span><i className="is-today" aria-hidden="true" />오늘</span>}
                </div>}
            </section>

            <div className="adm-gd-gap" />

            <section className="adm-gd-list" aria-label="일정 · 배정 내역">
                <h3>일정 · 배정 내역 <span>{mine.length}건</span></h3>
                <span className="adm-gd-group">다가오는 일정 · {next.length}</span>
                {next.map(b => {
                    const d = dday(b, today), car = carInfo(b), other = overlapWith(b), isDup = dup.has(b.key);
                    return <article key={b.key} className={cx('adm-gd-item is-next', isDup && 'is-dup')}>
                        <div className="adm-gd-row"><b className="adm-gd-range">{md(startOf(b))} → {md(endOf(b))}</b><span className="adm-gd-low">{nights(b)}</span><span className="adm-ga-spacer" />
                            <AdminBadge tone={isDup ? 'danger' : 'info'} strong={isDup} size="md">{isDup ? '일정 겹침' : d.label === '진행 중' ? '진행 중' : `예정 · ${d.label}`}</AdminBadge></div>
                        <span className="adm-gd-who-line">{nameOf(b)} · {people(b)}<span> · {regionOf(b) || tourName(b)}</span></span>
                        {car.type ? carLine(b) : <div className="adm-gd-alert"><span>차량 미배정</span>
                            <AdminButton variant="weak" size="sm" className="adm-gd-alert-btn" onClick={e => onAssignCar(e.currentTarget, b)}>차량 배정</AdminButton></div>}
                        {other && <span className="adm-gd-car is-alert">{nameOf(other)} ({period(other)})와 겹쳐요</span>}
                        <div className="adm-gd-row is-foot"><span className="adm-gd-low">{booked(b)}</span>{docs(b)}</div>
                    </article>;
                })}
                {!next.length && <span className="adm-gd-empty">다가오는 일정이 없어요.</span>}

                {past.length > 0 && <>
                    <button type="button" className="adm-gd-toggle" aria-expanded={pastOpen} onClick={() => setPastOpen(v => !v)}>
                        <span>지난 일정 · {past.length}</span><span>{pastOpen ? '접기' : '펼치기'}</span></button>
                    {pastOpen && past.map(b => <article key={b.key} className="adm-gd-item is-past">
                        <div className="adm-gd-row"><b className="adm-gd-range is-sm">{md(startOf(b))} → {md(endOf(b))}</b><span className="adm-gd-low">{nights(b)}</span><span className="adm-ga-spacer" />
                            <AdminBadge tone="neutral">완료</AdminBadge></div>
                        <span className="adm-gd-who-line is-sm">{nameOf(b)} · {people(b)}<span> · {tourName(b)}</span></span>
                        <span className="adm-gd-low">{carLine(b)}{booked(b) ? ` · ${booked(b)}` : ''}</span>
                        {docs(b, true)}
                    </article>)}
                </>}
            </section>
        </aside>
    </>;
}
