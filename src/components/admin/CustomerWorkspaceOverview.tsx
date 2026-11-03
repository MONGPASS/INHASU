import { useState, type ReactNode } from 'react';
import { Icon } from './console/Icon';
import { DashboardIcon, type DashboardIconName } from './dashboard/DashboardIcon';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import { reservationDday, reservationPeriod } from '../../utils/adminReservationBoard';
import { dashboardSeoulDate } from '../../utils/adminDashboard';
import './CustomerWorkspaceOverview.css';

export interface CustomerWorkspaceOverviewModel {
    customerName: string; sourceLabel: string; bookingNumber?: string; statusLabel: string;
    /** Breadcrumb label of the list this workspace returns to. */
    backLabel?: string;
    bookedProduct?: { name: string; href?: string; image?: string };
    /** 없으면 표시하지 않는다. tier가 null이면 패키지를 확인할 수 없는 예약이다. */
    packageInfo?: { tier: 'full' | 'value' | null; detail?: string };
    /** 상품과 연결되지 않은 맞춤 견적의 희망 여행지. */
    placeLabel?: string;
    documentLabel?: string;
    disabledActions?: string[];
    disabledActionReason?: string;
    workLabels?: Record<string, string>;
    period: string; partyLabel: string;
    facts: Array<{ label: string; value: string }>;
    preferences?: string[];
    flights?: Array<{ id: string; label: string; date?: string; time?: string; flight?: string; extra?: Array<{ label: string; value: string }> }>;
    travelers?: { expected: number | null; registered: number; people: Array<{ id: string; name: string; details: Array<{ label: string; value: string }> }>; status?: string };
    agreement?: { label: string; at?: string; name?: string };
    notes: Array<{ id: string; body: string; at?: string; author?: string }>;
    recentHistory?: Array<{ id: string; at: string; title: string; detail?: string; kind: 'inquiry' | 'quote' | 'booking' | 'payment' | 'contract' | 'customer' | 'assignment' | 'document' | 'memo' | 'change'; internal?: boolean }>;
    currentStage?: { label: string; detail?: string; tone: 'active' | 'waiting' | 'complete' | 'cancelled' };
    days: Array<{ id: string; day: number; title: string; date?: string; summary?: string; image?: string; region?: string;
        activities?: Array<{ time?: string; title: string; description?: string }>; stay?: string; stayAssigned?: boolean; stayRequired?: boolean; meals?: string; travel?: string }>;
    documents: Array<{ id: string; label: string; detail?: string; status?: string; action?: string; disabled?: boolean }>;
    payment: { total: number | null; deposit: number | null; balance: number | null; depositPaid: boolean | null; balancePaid: boolean | null };
    assignments: Array<{ id: 'guide' | 'vehicle' | 'stay'; label: string; value: string; detail?: string; statusLabel: string; state: 'ready' | 'pending' | 'unknown' }>;
    steps: Array<{ id: string; label: string; done: boolean; current?: boolean }>;
    tasks: Array<{ id: string; label: string; action: string; detail?: string; actionLabel?: string; waiting?: boolean }>;
    customerLinkAvailable?: boolean; canSendItinerary?: boolean;
}

const SHORTCUTS: Array<{ name: string; label: string; icon: DashboardIconName }> = [
    { name: 'edit-itinerary', label: '일정표 편집', icon: 'lc-calendar' }, { name: 'view-info', label: '고객·항공편', icon: 'lc-user' },
    { name: 'payments', label: '결제·입금', icon: 'lc-banknote' }, { name: 'assignments', label: '가이드·숙소', icon: 'lc-bed' },
    { name: 'operations', label: '운영·영수증', icon: 'lc-clipboard-check' }, { name: 'history', label: '메모·이력', icon: 'lc-history' },
];
const PACKAGE_COPY = {
    full: { label: '풀패키지', detail: '4성급 호텔 + 디럭스 게르 숙박' },
    value: { label: '실속형', detail: '3성급 호텔 + 스탠다드 게르 숙박' },
};
const DOCUMENT_LINKS: Array<{ id: string; label: string; icon: DashboardIconName }> = [
    { id: 'quote', label: '견적서', icon: 'lc-file-text' }, { id: 'itinerary', label: '확정 일정표', icon: 'lc-calendar' }, { id: 'contract', label: '여행 계약서', icon: 'lc-file-check' },
];
const EVENT_ICONS: Record<NonNullable<CustomerWorkspaceOverviewModel['recentHistory']>[number]['kind'], DashboardIconName> = {
    inquiry: 'lc-message-circle', quote: 'lc-file-text', booking: 'lc-clipboard-check', payment: 'lc-banknote', contract: 'lc-file-check',
    customer: 'lc-user', assignment: 'lc-bed', document: 'lc-file-text', memo: 'lc-pencil', change: 'lc-history',
};
const dateKeys = (text: string) => (text.match(/\d{4}[-.]\d{2}[-.]\d{2}/g) || []).map(key => key.replaceAll('.', '-'));
/** 일차에 날짜가 저장되지 않은 상품 예약은 출발일 기준으로 숙박일을 표시한다. */
const nightDate = (startKey: string | undefined, day: number, endKey?: string) => {
    const stamp = startKey ? Date.parse(`${startKey}T00:00:00Z`) : NaN, end = endKey ? Date.parse(`${endKey}T00:00:00Z`) : NaN;
    const at = stamp + (day - 1) * 86400000;
    if (!Number.isFinite(at) || Number.isFinite(end) && at > end) return '날짜 확인 필요';
    const date = new Date(at);
    return `${String(date.getUTCMonth() + 1).padStart(2, '0')}.${String(date.getUTCDate()).padStart(2, '0')}(${'일월화수목금토'[date.getUTCDay()]})`;
};
const statusTone = (label: string) => /취소|실패/.test(label) ? 'alert' : /대기|요청|신규|접수/.test(label) ? 'wait' : /확정|완료/.test(label) ? 'ok' : 'neutral';
const documentTone = (status: string) => /실패|필요|미작성|미발송/.test(status) ? 'alert' : /준비|대기|요청|전달 전|확인 전|공개 전/.test(status) ? 'wait' : 'ok';

/** 패키지는 저장된 값에서 판별해 표시만 한다(맞춤 견적은 게르 등급, 상품 예약은 상품 설정). */
function PackageBadge({ info }: { info: NonNullable<CustomerWorkspaceOverviewModel['packageInfo']> }) {
    const copy = info.tier ? PACKAGE_COPY[info.tier] : null;
    return <span className={`cw-package is-${info.tier || 'unknown'}`}><strong>{copy?.label || '패키지 미지정'}</strong><span>{info.detail || copy?.detail || ''}</span></span>;
}

function CopyPhoneButton({ phone, busy }: { phone: string; busy: boolean }) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        try { await navigator.clipboard.writeText(phone); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
    };
    const label = copied ? '연락처를 복사했어요' : '연락처 복사';
    return <button type="button" className="cw-icon-button" aria-label={label} title={label} disabled={busy} onClick={() => void copy()}><DashboardIcon name={copied ? 'lc-check' : 'lc-copy'} size={16} /></button>;
}

export function CustomerWorkspaceOverview({ model: m, onAction, busy = false, noteComposer, bookingSelector, assignmentEditor, notificationActions }: {
    model: CustomerWorkspaceOverviewModel; onAction: (action: string, id?: string) => void;
    busy?: boolean; noteComposer?: ReactNode; bookingSelector?: ReactNode; assignmentEditor?: ReactNode; notificationActions?: ReactNode; directAssignments?: boolean;
}) {
    const money = (value: number | null) => value === null || !Number.isFinite(value) ? '확인 필요' : `₩${value.toLocaleString('ko-KR')}`;
    const progressKnown = m.payment.total !== null && Number.isFinite(m.payment.total) && m.payment.depositPaid !== null && m.payment.balancePaid !== null && (!m.payment.depositPaid || (m.payment.deposit !== null && Number.isFinite(m.payment.deposit))) && (!m.payment.balancePaid || (m.payment.balance !== null && Number.isFinite(m.payment.balance)));
    const paidAmount = (m.payment.depositPaid ? m.payment.deposit || 0 : 0) + (m.payment.balancePaid ? m.payment.balance || 0 : 0);
    const paidPercent = progressKnown ? (m.payment.total! > 0 ? Math.min(100, Math.max(0, Math.round(paidAmount / m.payment.total! * 100))) : m.payment.depositPaid && m.payment.balancePaid ? 100 : 0) : null;
    const completedSteps = m.steps.filter(item => item.done).length;
    const stepPercent = m.steps.length ? Math.round(completedSteps / m.steps.length * 100) : 0;
    const assignedResources = m.assignments.filter(item => item.state === 'ready').length;
    const confirmedFlights = m.flights?.filter(flight => flight.date && flight.time && flight.flight).length || 0;
    const historyTime = (at: string, full = false) => at.length === 10 ? at.replaceAll('-', '.') : new Date(at).toLocaleString('ko-KR', { ...(full ? { year: 'numeric' as const } : {}), month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    const name = m.customerName || '고객 정보 확인 필요';
    const action = (name: string, id?: string) => () => onAction(name, id);
    const [startKey, endKey] = dateKeys(m.period || '');
    const dday = startKey ? reservationDday(startKey, dashboardSeoulDate(new Date().toISOString())) : null;
    const nights = startKey && endKey ? reservationPeriod(startKey, endKey).nights : '';
    const stageCancelled = m.currentStage?.tone === 'cancelled';
    const nowIndex = m.steps.findIndex(step => step.current), nowStep = m.steps[nowIndex];
    const allStepsDone = m.steps.length > 0 && m.steps.every(step => step.done);
    const nextTask = stageCancelled ? undefined : m.tasks.find(task => !task.waiting);
    const nextButton = nextTask && <button type="button" className="cw-button cw-primary cw-next-button" disabled={busy || m.disabledActions?.includes(nextTask.action)} onClick={action(nextTask.action)}>{nextTask.actionLabel || '바로가기'}</button>;
    const phone = m.facts.find(fact => fact.label === '연락처')?.value?.trim() || '';
    const assignmentsDisabled = busy || m.disabledActions?.includes('assignments');
    const assignmentRows = m.assignments.flatMap(item => {
        const nights = item.id === 'stay' && item.state !== 'unknown' ? m.days.filter(day => day.stayRequired === true) : [];
        if (nights.length) return nights.map((day, index) => ({ key: `stay:${day.id}`, id: 'stay', dayId: day.id, label: `${index + 1}박 숙소`, sub: day.date || nightDate(startKey, day.day, endKey), place: day.title, value: day.stayAssigned ? day.stay || '' : '선택해 주세요', ready: !!day.stayAssigned, picker: '숙소 선택' }));
        const sub = item.state === 'ready' && item.id === 'vehicle' && m.partyLabel ? `${m.partyLabel} 탑승` : item.detail || item.statusLabel;
        return [{ key: item.id, id: item.id as string, dayId: undefined, label: item.label, sub, place: '', value: item.state === 'ready' ? item.value : item.state === 'pending' ? '선택해 주세요' : item.value, ready: item.state === 'ready', picker: item.id === 'stay' ? '숙소 선택' : item.id === 'vehicle' ? '차량 선택' : '가이드 선택' }];
    });
    const productContent = m.bookedProduct &&<><span className="cw-booked-product-image"><DashboardIcon name="lc-map-pin" size={14} />{m.bookedProduct.image && <ResponsiveProductImage src={m.bookedProduct.image} sizes="28px" alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />}</span><span className="cw-booked-product-copy"><strong>{m.bookedProduct.name}</strong><span>{m.bookedProduct.href ? '상품 페이지 새 창으로 보기' : '연결된 상품을 확인해 주세요.'}</span></span>{m.bookedProduct.href && <DashboardIcon name="lc-external-link" size={14} />}</>;

    return <section className="cw-overview" aria-label="고객 통합 작업 현황" aria-busy={busy}>
        <div className="cw-breadcrumb">
            <button type="button" disabled={busy} onClick={action('back')}><DashboardIcon name="lc-chevron-left" size={16} />{m.backLabel || '고객 관리'}</button>
            <DashboardIcon name="lc-chevron-right" size={14} /><span>{name}</span>
        </div>

        <section className="cw-workflow" aria-label="예약 현황과 업무 진행">
            <div className="cw-hero">
                <header className="cw-customer-header">
                    <div className="cw-identity-copy">
                        <div className="cw-customer-title"><h1>{name}</h1><span className={`cw-badge is-${statusTone(m.statusLabel)}`}>{m.statusLabel}</span>{dday && dday.tone !== 'none' && <span className="cw-badge is-neutral cw-dday">{dday.label}</span>}</div>
                        <div className="cw-trip-meta">
                            {m.placeLabel && <span><DashboardIcon name="lc-map-pin" size={14} />{m.placeLabel}</span>}
                            {m.packageInfo && <PackageBadge info={m.packageInfo} />}
                            {m.partyLabel && <span><DashboardIcon name="lc-users" size={14} />{m.partyLabel}</span>}
                            {m.period && <span className="cw-mono"><DashboardIcon name="lc-calendar" size={14} />{m.period}</span>}
                            {nights && <span>{nights}</span>}
                            <span className="cw-record">{m.bookingNumber && `#${m.bookingNumber} · `}{m.sourceLabel}</span>
                        </div>
                        {m.bookedProduct && (m.bookedProduct.href ? <a className="cw-booked-product" href={m.bookedProduct.href} target="_blank" rel="noopener noreferrer" aria-label={`예약 상품 ${m.bookedProduct.name} 새 창으로 보기`}>{productContent}</a> : <div className="cw-booked-product">{productContent}</div>)}
                    </div>
                    <div className="cw-header-tools">
                        {DOCUMENT_LINKS.flatMap(link => { const doc = m.documents.find(item => item.id === link.id); return doc ? [<button type="button" key={link.id} className="cw-doc-link" disabled={busy || doc.disabled} onClick={action(doc.action || doc.id, doc.id)}><DashboardIcon name={link.icon} size={15} />{link.label}</button>] : []; })}
                        <span className="cw-header-divider" aria-hidden="true" />
                        <div className="cw-header-actions">
                            <button type="button" className="cw-button cw-primary" disabled={busy} onClick={action('documents')}>{m.documentLabel || '고객 문서 확인·전달'}</button>
                        </div>
                    </div>
                </header>
                {bookingSelector && <div className="cw-booking-switcher">{bookingSelector}</div>}
                {!!m.steps.length && <div className="cw-progress-card">
                    <div className="cw-progress-caption">
                        <strong>업무 진행</strong><span><b>{completedSteps}</b> / {m.steps.length} 완료</span>
                        <span className="cw-progress-meter" aria-hidden="true"><span><span style={{ width: `${stepPercent}%` }} /></span><em>{stepPercent}%</em></span>
                    </div>
                    <ol className="cw-journey" aria-label="고객 업무 진행 단계">{m.steps.map((item, index) => <li key={item.id} className={`${item.done ? 'is-done' : ''} ${item.current ? 'is-current' : ''}`} aria-current={item.current || undefined}>
                        <span className="cw-step-dot" aria-hidden="true">{item.done ? <DashboardIcon name="lc-check" size={16} strokeWidth={2.6} /> : index + 1}</span>
                        <span className="cw-step-copy"><span>{item.label}</span><small>{item.done ? '완료' : item.current ? '진행 중' : '대기'}</small></span>
                    </li>)}</ol>
                    {!stageCancelled && (nowStep || allStepsDone) && <div className="cw-now">
                        <span className="cw-now-dot" aria-hidden="true" /><span className="cw-now-caption">지금 단계</span>
                        <strong>{nowStep ? nowStep.label : '모든 단계 완료'}</strong>
                        <small>{nowStep ? [`${nowIndex + 1}단계`, m.steps[nowIndex + 1] && `다음은 ${m.steps[nowIndex + 1].label}`].filter(Boolean).join(' · ') : '출발 준비만 남았어요'}</small>
                        {nextButton}
                    </div>}
                </div>}
            </div>

            <nav className="cw-shortcuts" aria-label="고객 빠른 업무">
                {SHORTCUTS.map(shortcut => <button type="button" key={shortcut.name} disabled={busy || m.disabledActions?.includes(shortcut.name)} title={m.disabledActions?.includes(shortcut.name) ? m.disabledActionReason || '예약 진행 후 사용할 수 있습니다.' : undefined} onClick={action(shortcut.name)}>
                    <i className="cw-shortcut-icon" aria-hidden="true"><DashboardIcon name={shortcut.icon} size={18} /></i><span>{m.workLabels?.[shortcut.name] || shortcut.label}</span><DashboardIcon name="lc-chevron-right" size={16} />
                </button>)}
            </nav>

            {notificationActions}
        </section>

        <div className="cw-columns">
            <div className="cw-column cw-customer-column">
                <article className="cw-card cw-customer-info">
                    <header><h2>고객 정보</h2><span className="cw-card-tools">
                        {phone && phone !== '미입력' && phone !== '미등록' && <CopyPhoneButton phone={phone} busy={busy} />}
                        <button type="button" className="cw-icon-button" aria-label="고객 정보 전체 상세보기" title="고객 정보 전체 상세보기" disabled={busy} onClick={action('customer-detail')}><DashboardIcon name="lc-eye" size={16} /></button>
                        <button type="button" className="cw-icon-button" aria-label="고객 정보 수정" title="고객 정보 수정" disabled={busy} onClick={action('edit-info')}><DashboardIcon name="lc-pencil" size={16} /></button>
                    </span></header>
                    <dl className="cw-facts">{m.facts.slice(0, 3).map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value || '미등록'}</dd></div>)}</dl>
                    {m.facts.length > 3 && <details className="cw-customer-disclosure"><summary><span className="cw-disclosure-icon"><DashboardIcon name="lc-file-text" size={16} /></span><span className="cw-disclosure-copy"><strong>예약 상세 정보</strong><small>접수·주문 경로 등 {m.facts.length - 3}개 항목</small></span><DashboardIcon name="lc-chevron-down" size={16} /></summary><div className="cw-disclosure-body"><dl className="cw-facts">{m.facts.slice(3).map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value || '미등록'}</dd></div>)}</dl></div></details>}
                    {!!m.flights?.length && <details className="cw-customer-disclosure" aria-label="고객 항공편 정보">
                        <summary><span className="cw-disclosure-icon"><DashboardIcon name="lc-plane-takeoff" size={16} /></span><span className="cw-disclosure-copy"><strong>항공편</strong><small>{confirmedFlights}/{m.flights.length}편 정보 등록</small></span><span className={`cw-pill ${confirmedFlights === m.flights.length ? 'is-ready' : 'is-pending'}`}>{confirmedFlights === m.flights.length ? '등록됨' : '입력 필요'}</span><DashboardIcon name="lc-chevron-down" size={16} /></summary>
                        <div className="cw-disclosure-body">
                        <div className="cw-flights">{m.flights.map(flight => <article className="cw-flight" key={flight.id}>
                            <div className="cw-flight-heading"><DashboardIcon name={flight.id === 'departure' ? 'lc-plane-takeoff' : 'lc-plane-landing'} size={16} /><strong>{flight.label}</strong><span className={`cw-pill ${flight.date && flight.time && flight.flight ? 'is-ready' : 'is-pending'}`}>{flight.date && flight.time && flight.flight ? '등록됨' : '입력 필요'}</span></div>
                            <strong className={`cw-flight-number${flight.flight ? '' : ' is-missing'}`}>{flight.flight || '항공편명 미입력'}</strong>
                            <dl><div><dt>날짜</dt><dd>{flight.date || '미입력'}</dd></div><div><dt>{flight.id === 'departure' ? '몽골 출발' : '몽골 도착'}</dt><dd>{flight.time || '시각 미입력'}</dd></div>{flight.extra?.map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value || '미입력'}</dd></div>)}</dl>
                        </article>)}</div>
                        <button type="button" className="cw-disclosure-link" disabled={busy} onClick={action('flights')}>항공편 상세보기<DashboardIcon name="lc-chevron-right" size={14} /></button></div>
                    </details>}
                    {m.travelers && <details className="cw-customer-disclosure" aria-label="예약 여행자 정보">
                        <summary><span className="cw-disclosure-icon"><DashboardIcon name="lc-users" size={16} /></span><span className="cw-disclosure-copy"><strong>여행자 정보</strong><small>{m.travelers.registered}{m.travelers.expected !== null ? `/${m.travelers.expected}` : ''}명 등록</small></span><DashboardIcon name="lc-chevron-down" size={16} /></summary>
                        <div className="cw-disclosure-body">{m.travelers.status && <p className="cw-card-caption">{m.travelers.status}</p>}
                        {m.travelers.people.length ? <ol className="cw-travelers">{m.travelers.people.map((person, index) => <li key={person.id}><details>
                            <summary><span className="cw-traveler-number">{index + 1}</span><strong>{person.name || '이름 미입력'}</strong><DashboardIcon name="lc-chevron-down" size={16} /></summary>
                            <dl>{person.details.map((fact, i) => <div key={`${fact.label}-${i}`}><dt>{fact.label}</dt><dd>{fact.value || '미입력'}</dd></div>)}</dl>
                        </details></li>)}</ol> : <p className="cw-information-empty">등록된 여행자가 없습니다. 고객이 제출한 정보를 확인해 주세요.</p>}
                        <button type="button" className="cw-disclosure-link" disabled={busy} onClick={action('travelers')}>여행자 전체 상세보기<DashboardIcon name="lc-chevron-right" size={14} /></button></div>
                    </details>}
                    <details className="cw-customer-disclosure"><summary><span className="cw-disclosure-icon"><DashboardIcon name="lc-message-circle" size={16} /></span><span className="cw-disclosure-copy"><strong>고객 요청 사항</strong><small>{m.preferences?.length ? `${m.preferences.length}건 등록` : '등록된 요청 없음'}</small></span><DashboardIcon name="lc-chevron-down" size={16} /></summary><div className="cw-disclosure-body cw-preferences">{m.preferences?.length ? <div className="cw-chips">{m.preferences.map((value, index) => <span key={index}>{value}</span>)}</div> : <p>등록된 요청 사항이 없습니다.</p>}</div></details>
                    {m.agreement && <div className="cw-agreement"><DashboardIcon name="lc-file-check" size={14} /><span>계약 동의·서명</span><strong>{m.agreement.label}</strong>{m.agreement.name && <small>서명자 · {m.agreement.name}</small>}{m.agreement.at && <small>{m.agreement.at}</small>}</div>}
                </article>
            </div>

            <div className="cw-column cw-itinerary-column">
                <article className="cw-card cw-itinerary-card">
                    <header><div className="cw-section-title"><h2>여행 일정</h2>{!!m.days.length && <span className="cw-section-count">{m.days.length}일</span>}</div><button type="button" className="cw-text-button" aria-label="여행 일정 편집" disabled={busy} onClick={action('edit-itinerary')}>편집</button></header>
                    {m.days.length ? <ol className="cw-day-list cw-operational-days">{m.days.map(day => {
                        const storedActivities = day.activities || [];
                        const activities: NonNullable<typeof day.activities> = [];
                        const lineKey = (line: string) => line.trim().replace(/^\*\s*/, '').replace(/\s+/g, ' ');
                        const usedActivities = new Set<number>();
                        const shownLines = new Set<string>();
                        for (const title of day.summary?.split('\n').filter(line => line.trim()) || []) {
                            const key = lineKey(title);
                            const storedIndex = storedActivities.findIndex(item => [lineKey(item.title), lineKey([item.time, item.title].filter(Boolean).join(' '))].includes(key));
                            if (storedIndex >= 0) {
                                if (!usedActivities.has(storedIndex)) { activities.push(storedActivities[storedIndex]); usedActivities.add(storedIndex); }
                            } else if (!shownLines.has(key) && !storedActivities.some(item => lineKey(item.description || '') === key)) activities.push({ title });
                            shownLines.add(key);
                        }
                        storedActivities.forEach((item, index) => { if (!usedActivities.has(index)) activities.push(item); });
                        const activityList = (items: typeof activities) => <ul className="cw-activity-list">{items.map((item, index) => <li key={index}>{item.time && <time>{item.time}</time>}<div><span>{item.title}</span>{item.description && <small>{item.description}</small>}</div></li>)}</ul>;
                        return <li key={day.id}>
                            <details className="cw-day-disclosure">
                                <summary className="cw-day-summary" aria-label={`${day.day}일차 ${day.title || '일정'} 상세 일정`}>
                                    <span className="cw-day-date"><b>{day.day}일차</b><small>{day.date || nightDate(startKey, day.day, endKey)}</small></span>
                                    <strong className="cw-day-title">{day.title || `${day.day}일차 일정 작성`}</strong>
                                    <span className="cw-day-detail-label" aria-hidden="true"><span className="cw-day-show">상세 보기</span><span className="cw-day-hide">접기</span><DashboardIcon name="lc-chevron-down" size={16} /></span>
                                </summary>
                                <div className="cw-day-details">
                                    <h3>{day.day}일차 상세 일정</h3>{day.region && day.region !== day.title && <p className="cw-day-region">{day.region}</p>}
                                    {activities.length ? activityList(activities) : <p className="cw-information-empty">상세 일정이 입력되지 않았습니다.</p>}
                                    <dl className="cw-day-logistics"><div><dt><Icon name="hotel" />숙소</dt><dd>{day.stayRequired === false ? '숙박 없음' : day.stay || '미입력'}{day.stayRequired !== false && day.stay && <span className={`cw-pill ${day.stayAssigned ? 'is-ready' : 'is-unknown'}`}>{day.stayAssigned ? '실제 배정' : '일정상 숙소'}</span>}</dd></div><div><dt><Icon name="restaurant" />식사</dt><dd>{day.meals || '미입력'}</dd></div>{day.travel && <div><dt><Icon name="directions_car" />이동</dt><dd>{day.travel}</dd></div>}</dl>
                                </div>
                            </details>
                            <button type="button" className="cw-day-edit" aria-label={`${day.day}일차 일정 편집`} title={`${day.day}일차 일정 편집`} disabled={busy} onClick={action('edit-itinerary', day.id)}><DashboardIcon name="lc-pencil" size={14} /></button>
                        </li>;
                    })}</ol> : <div className="cw-empty cw-empty-itinerary"><span className="cw-empty-graphic"><DashboardIcon name="lc-calendar" size={22} /></span><strong>어떤 여행을 준비할까요?</strong><p>기존 견적·상품 일정을 불러와 편집할 수 있습니다.</p><button type="button" className="cw-button" disabled={busy} onClick={action('edit-itinerary')}>일정 작성하기</button></div>}
                    <section className="cw-files" aria-label="고객 문서와 파일">
                        <header><h2>고객 문서</h2><button type="button" className="cw-text-button" disabled={busy} onClick={action('documents')}>모두 보기<DashboardIcon name="lc-chevron-right" size={14} /></button></header>
                        <div className="cw-file-list">{m.documents.map(doc => <button type="button" key={doc.id} title={doc.status ? doc.detail : undefined} disabled={busy || doc.disabled} onClick={action(doc.action || doc.id, doc.id)}>
                            <span className="cw-file-copy"><strong>{doc.label}</strong>{!doc.status && <small>{doc.detail || '내용 확인'}</small>}</span>
                            {doc.status && <span className={`cw-badge is-${documentTone(doc.status)}`}>{doc.status}</span>}<DashboardIcon name="lc-chevron-right" size={16} />
                        </button>)}</div>
                        {!m.documents.length && <p className="cw-card-caption">견적을 작성하면 고객에게 전달할 문서를 확인할 수 있습니다.</p>}
                    </section>
                </article>

                <article className="cw-card cw-recent-history">
                    <header><h2>최근 고객 이력</h2><button type="button" className="cw-text-button" disabled={busy} onClick={action('history')}>전체보기<DashboardIcon name="lc-chevron-right" size={14} /></button></header>
                    {m.currentStage && <div className={`cw-current-stage is-${m.currentStage.tone}`}>
                        <div><span>현재 단계</span><strong>{m.currentStage.label}</strong>{m.currentStage.detail && <p>{m.currentStage.detail}</p>}</div>
                        {nextTask && <div className="cw-stage-next"><small>다음 · <b>{nextTask.label}</b></small>{nextButton}</div>}
                    </div>}
                    {m.recentHistory?.length ? <ol className="cw-event-list">{m.recentHistory.slice(0, 5).map(event => <li key={event.id}><span className={`cw-event-icon is-${event.kind}`} aria-hidden="true"><DashboardIcon name={EVENT_ICONS[event.kind]} size={15} /></span><div><div className="cw-event-meta"><strong>{event.title}</strong><time dateTime={event.at} title={historyTime(event.at, true)}>{historyTime(event.at)}</time></div>{event.detail && <p>{event.detail}</p>}{event.internal && <span className="cw-internal"><DashboardIcon name="lc-lock" size={11} />내부</span>}</div></li>)}</ol> : <p className="cw-information-empty">저장된 처리 이력이 없습니다. 앞으로 기록된 업무를 여기에 표시합니다.</p>}
                </article>
            </div>

            <div className="cw-column cw-operations-column">
                <article className="cw-card cw-payments">
                    <header><h2>결제 현황</h2><span className="cw-card-note">실제 입금 확인 기준</span></header>
                    <div className="cw-payment-summary">
                        <div className="cw-total-row"><strong className="cw-total">{money(m.payment.total)}</strong><span className="cw-total-label">총 여행금액</span></div>
                        <div className="cw-payment-progress"><div role="progressbar" aria-label="입금 확인 비율" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercent ?? undefined} aria-valuetext={paidPercent === null ? '확인 필요' : undefined}><span style={{ width: `${paidPercent ?? 0}%` }} /></div></div>
                        <div className="cw-payment-ratio"><span>입금 {progressKnown ? money(paidAmount) : '확인 필요'}</span><strong>{paidPercent === null ? '확인 필요' : `${paidPercent}%`}</strong></div>
                    </div>
                    <dl className="cw-payment-lines">{([{ label: '예약금', value: m.payment.deposit, paid: m.payment.depositPaid }, { label: '잔금', value: m.payment.balance, paid: m.payment.balancePaid }]).map(item => <div key={item.label}><dt>{item.label}</dt><dd><strong>{money(item.value)}</strong><span className={`cw-badge is-${item.paid === true ? 'ok' : item.paid === null ? 'neutral' : 'wait'}`}>{item.paid === true ? '입금 확인' : item.paid === null ? '확인 필요' : '미입금'}</span></dd></div>)}</dl>
                </article>
                <article className="cw-card cw-assignments">
                    <header><h2>숙소 · 차량 · 가이드</h2><span className={`cw-assignment-count ${assignedResources < m.assignments.length ? 'is-short' : ''}`}>{assignedResources} / {m.assignments.length} 배정</span></header>
                    <ul className="cw-assignment-list">{assignmentRows.map(row => <li key={row.key}><button type="button" className="cw-resource-select" aria-label={`${row.label} 관리`} disabled={assignmentsDisabled} title={m.disabledActions?.includes('assignments') ? m.disabledActionReason : undefined} onClick={action(row.id, row.dayId)}>
                        <span className="cw-assignment-copy"><span className="cw-assignment-label">{row.label}</span>{row.sub && <small>{row.sub}</small>}{row.place && <em>{row.place}</em>}</span>
                        <span className={`cw-select-box ${row.ready ? 'is-ready' : 'is-pending'}`}><span className="cw-select-dot" aria-hidden="true" /><strong>{row.value || '선택해 주세요'}</strong><span className="cw-resource-select-label">{row.picker}</span><DashboardIcon name="lc-chevron-down" size={16} /></span>
                    </button></li>)}</ul>
                    {assignmentEditor}
                    <button type="button" className="cw-history-link" disabled={assignmentsDisabled} onClick={action('assignments')}>세부 정보 수정<DashboardIcon name="lc-chevron-right" size={16} /></button>
                </article>
                <article className="cw-card cw-notes">
                    <header><h2>상담 · 메모</h2><span className="cw-private"><DashboardIcon name="lc-lock" size={12} />내부 전용</span></header>
                    {m.notes.length ? <ol>{m.notes.slice(-4).map(note => <li key={note.id}><div><strong>{note.author || '관리자 메모'}</strong>{note.at && <time>{note.at}</time>}</div><p>{note.body}</p></li>)}</ol> : null}
                    {noteComposer || <button type="button" className="cw-button cw-wide" disabled={busy} onClick={action('notes')}>메모 작성</button>}
                    <div className="cw-notes-foot"><button type="button" className="cw-history-link" disabled={busy} onClick={action('history')}><DashboardIcon name="lc-history" size={14} />처리 이력</button>{!m.notes.length && <span>저장된 메모가 없어요.</span>}</div>
                </article>
            </div>
        </div>
    </section>;
}
