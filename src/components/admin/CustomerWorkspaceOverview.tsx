import type { ReactNode } from 'react';
import { Icon } from './console/Icon';
import { ResponsiveProductImage } from '../common/ResponsiveProductImage';
import './CustomerWorkspaceOverview.css';

export interface CustomerWorkspaceOverviewModel {
    customerName: string; sourceLabel: string; bookingNumber?: string; statusLabel: string;
    bookedProduct?: { name: string; href?: string; image?: string };
    documentLabel?: string;
    documentHint?: string;
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

export function CustomerWorkspaceOverview({ model: m, onAction, busy = false, noteComposer, bookingSelector, assignmentEditor, refreshControl, notificationActions, directAssignments = false }: {
    model: CustomerWorkspaceOverviewModel; onAction: (action: string, id?: string) => void;
    busy?: boolean; noteComposer?: ReactNode; bookingSelector?: ReactNode; assignmentEditor?: ReactNode; refreshControl?: ReactNode; notificationActions?: ReactNode; directAssignments?: boolean;
}) {
    const money = (value: number | null) => value === null || !Number.isFinite(value) ? '확인 필요' : `${value.toLocaleString('ko-KR')}원`;
    const progressKnown = m.payment.total !== null && Number.isFinite(m.payment.total) && m.payment.depositPaid !== null && m.payment.balancePaid !== null && (!m.payment.depositPaid || (m.payment.deposit !== null && Number.isFinite(m.payment.deposit))) && (!m.payment.balancePaid || (m.payment.balance !== null && Number.isFinite(m.payment.balance)));
    const paidAmount = (m.payment.depositPaid ? m.payment.deposit || 0 : 0) + (m.payment.balancePaid ? m.payment.balance || 0 : 0);
    const paidPercent = progressKnown ? (m.payment.total! > 0 ? Math.min(100, Math.max(0, Math.round(paidAmount / m.payment.total! * 100))) : m.payment.depositPaid && m.payment.balancePaid ? 100 : 0) : null;
    const orderedTasks = [...m.tasks.filter(task => !task.waiting), ...m.tasks.filter(task => task.waiting)];
    const next = orderedTasks[0];
    const completedSteps = m.steps.filter(item => item.done).length;
    const assignedResources = m.assignments.filter(item => item.state === 'ready').length;
    const confirmedFlights = m.flights?.filter(flight => flight.date && flight.time && flight.flight).length || 0;
    const historyTime = (at: string, full = false) => at.length === 10 ? at.replaceAll('-', '.') : new Date(at).toLocaleString('ko-KR', { ...(full ? { year: 'numeric' as const } : {}), month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    const name = m.customerName || '고객 정보 확인 필요';
    const action = (name: string, id?: string) => () => onAction(name, id);
    const edit = (label: string, name: string, text = '수정') => <button type="button" className="cw-text-button" aria-label={label} disabled={busy} onClick={action(name)}><Icon name="edit" />{text}</button>;
    const productContent = m.bookedProduct && <><span className="cw-booked-product-image"><Icon name="landscape" />{m.bookedProduct.image && <ResponsiveProductImage src={m.bookedProduct.image} sizes="56px" alt="" onError={event => { event.currentTarget.style.display = 'none'; }} />}</span><span className="cw-booked-product-copy"><small>예약 상품</small><strong>{m.bookedProduct.name}</strong><span>{m.bookedProduct.href ? '상품 페이지 새 창으로 보기' : '연결된 상품을 확인해 주세요.'}</span></span>{m.bookedProduct.href && <Icon name="open_in_new" />}</>;
    const workShortcuts = [{ name: 'edit-itinerary', label: '일정표 편집', icon: 'edit_calendar' }, { name: 'view-info', label: '고객·항공편', icon: 'person' },
        { name: 'payments', label: '결제·입금', icon: 'payments' }, { name: 'assignments', label: '가이드·숙소', icon: 'hotel' },
        { name: 'operations', label: '운영·영수증', icon: 'receipt_long' }, { name: 'history', label: '메모·이력', icon: 'history' }];

    return <section className="cw-overview" aria-label="고객 통합 작업 현황" aria-busy={busy}>
        <div className="cw-breadcrumb">
            <button type="button" disabled={busy} onClick={action('back')}>고객 관리</button>
            <Icon name="chevron_right" /><span>{name}</span>
        </div>
        <header className="cw-customer-header">
            <div className="cw-identity">
                <span className="cw-avatar" aria-hidden="true">{m.customerName?.trim().slice(0, 1) || <Icon name="person" />}</span>
                <div className="cw-identity-copy">
                    <div className="cw-customer-title"><h1>{name}</h1><span className="cw-status">{m.statusLabel}</span></div>
                    <p className="cw-trip-meta">{m.partyLabel && <span><Icon name="groups" />{m.partyLabel}</span>}{m.period && <span>{m.period}</span>}</p>
                    <div className="cw-record"><span className="cw-source-label">{m.sourceLabel}</span>{m.bookingNumber && <span>#{m.bookingNumber}</span>}</div>
                    {m.bookedProduct && (m.bookedProduct.href ? <a className="cw-booked-product" href={m.bookedProduct.href} target="_blank" rel="noopener noreferrer" aria-label={`예약 상품 ${m.bookedProduct.name} 새 창으로 보기`}>{productContent}</a> : <div className="cw-booked-product">{productContent}</div>)}
                </div>
            </div>
            <div className="cw-header-actions">
                <button type="button" className="cw-button cw-primary" disabled={busy} onClick={action('documents')}><Icon name="description" />{m.documentLabel || '고객 문서 확인·전달'}</button>
                <p>{m.documentHint || '일정표·계약서의 미리보기·안내문 복사·발송을 선택합니다.'}</p>
                {refreshControl && <div className="cw-overview-refresh">{refreshControl}</div>}
            </div>
        </header>
        {bookingSelector && <div className="cw-booking-switcher">{bookingSelector}</div>}

        <nav className="cw-shortcuts" aria-label="고객 빠른 업무">
            {workShortcuts.map(shortcut => <button type="button" key={shortcut.name} disabled={busy || m.disabledActions?.includes(shortcut.name)} title={m.disabledActions?.includes(shortcut.name) ? m.disabledActionReason || '예약 진행 후 사용할 수 있습니다.' : undefined} onClick={action(shortcut.name)}><Icon name={shortcut.icon} /><span>{m.workLabels?.[shortcut.name] || shortcut.label}</span><Icon name="chevron_right" /></button>)}
        </nav>

        <section className="cw-workflow" aria-label="업무 진행과 다음 할 일">
        {!!m.steps.length && <div className="cw-progress-card">
            <div className="cw-progress-caption"><strong>업무 진행</strong><span><b>{completedSteps}</b> / {m.steps.length} 완료</span></div>
            <ol className="cw-journey" aria-label="고객 업무 진행 단계">{m.steps.map((item, index) => <li key={item.id} className={`${item.done ? 'is-done' : ''} ${item.current ? 'is-current' : ''}`} aria-current={item.current || undefined}>
                <span className="cw-step-dot" aria-hidden="true">{item.done ? '✓' : index + 1}</span><span className="cw-step-copy"><span>{item.label}</span><small>{item.done ? '완료' : item.current ? '진행 중' : '대기'}</small></span>
            </li>)}</ol>
        </div>}

        <div className={`cw-task-card${next ? '' : ' is-complete'}`}>
            <div className="cw-next-task" role="status">
                <span className="cw-task-symbol"><Icon name={next ? 'assignment' : 'check_circle'} /></span>
                <div className="cw-task-copy"><div><strong>{next ? next.waiting ? '고객 확인 대기' : '지금 할 일' : '업무 확인 완료'}</strong>{next && <span className="cw-task-count">{m.tasks.length}건 남음</span>}</div><p>{next?.label || '현재 확인된 미완료 업무가 없습니다.'}</p></div>
                <button type="button" className="cw-button cw-primary" disabled={busy} onClick={action(next?.action || 'history', next?.id)}>{next ? next.actionLabel || '내용 확인' : '이력 확인'}<Icon name="arrow_forward" /></button>
            </div>
            {next?.detail && <p className="cw-next-task-detail">{next.detail}</p>}
            {orderedTasks.length > 1 && <div className="cw-task-list" aria-label="남은 고객 업무">{orderedTasks.slice(1).map(task => <div className={`cw-task-item${task.waiting ? ' is-waiting' : ''}`} key={task.id}>
                <span className="cw-task-marker" aria-hidden="true" /><div><strong>{task.label}</strong>{task.detail && <p>{task.detail}</p>}{task.waiting && <span className="cw-task-waiting">고객 확인 대기</span>}</div>
                <button type="button" className="cw-button" disabled={busy} onClick={action(task.action, task.id)}>{task.actionLabel || '내용 확인'}<Icon name="chevron_right" /></button>
            </div>)}</div>}
            {notificationActions}
        </div>
        </section>

        <div className="cw-columns">
            <div className="cw-column cw-customer-column">
                <article className="cw-card cw-customer-info">
                    <header><div className="cw-section-title"><span className="cw-section-icon is-neutral"><Icon name="person" /></span><h2>고객 정보</h2></div><button type="button" className="cw-text-button" aria-label="고객 정보 전체 상세보기" disabled={busy} onClick={action('customer-detail')}>상세보기<Icon name="chevron_right" /></button></header>
                    <dl className="cw-facts">{m.facts.slice(0, 3).map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value || '미등록'}</dd></div>)}</dl>
                    {m.facts.length > 3 && <details className="cw-customer-disclosure"><summary><span className="cw-disclosure-icon"><Icon name="receipt_long" /></span><span className="cw-disclosure-copy"><strong>예약 상세 정보</strong><small>접수·주문 경로 등 {m.facts.length - 3}개 항목</small></span><Icon name="expand_more" /></summary><div className="cw-disclosure-body"><dl className="cw-facts">{m.facts.slice(3).map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value || '미등록'}</dd></div>)}</dl></div></details>}
                    {!!m.flights?.length && <details className="cw-customer-disclosure" aria-label="고객 항공편 정보">
                        <summary><span className="cw-disclosure-icon"><Icon name="flight_land" /></span><span className="cw-disclosure-copy"><strong>항공편</strong><small>{confirmedFlights}/{m.flights.length}편 정보 등록</small></span><span className={`cw-pill ${confirmedFlights === m.flights.length ? 'is-ready' : 'is-pending'}`}>{confirmedFlights === m.flights.length ? '등록됨' : '입력 필요'}</span><Icon name="expand_more" /></summary>
                        <div className="cw-disclosure-body">
                        <div className="cw-flights">{m.flights.map(flight => <article className="cw-flight" key={flight.id}>
                            <div className="cw-flight-heading"><Icon name={flight.id === 'departure' ? 'flight_takeoff' : 'flight_land'} /><strong>{flight.label}</strong><span className={`cw-pill ${flight.date && flight.time && flight.flight ? 'is-ready' : 'is-pending'}`}>{flight.date && flight.time && flight.flight ? '등록됨' : '입력 필요'}</span></div>
                            <strong className={`cw-flight-number${flight.flight ? '' : ' is-missing'}`}>{flight.flight || '항공편명 미입력'}</strong>
                            <dl><div><dt>날짜</dt><dd>{flight.date || '미입력'}</dd></div><div><dt>{flight.id === 'departure' ? '몽골 출발' : '몽골 도착'}</dt><dd>{flight.time || '시각 미입력'}</dd></div>{flight.extra?.map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value || '미입력'}</dd></div>)}</dl>
                        </article>)}</div>
                        <button type="button" className="cw-disclosure-link" disabled={busy} onClick={action('flights')}>항공편 상세보기<Icon name="chevron_right" /></button></div>
                    </details>}
                    {m.travelers && <details className="cw-customer-disclosure" aria-label="예약 여행자 정보">
                        <summary><span className="cw-disclosure-icon"><Icon name="groups" /></span><span className="cw-disclosure-copy"><strong>여행자 정보</strong><small>{m.travelers.registered}{m.travelers.expected !== null ? `/${m.travelers.expected}` : ''}명 등록</small></span><Icon name="expand_more" /></summary>
                        <div className="cw-disclosure-body">{m.travelers.status && <p className="cw-card-caption">{m.travelers.status}</p>}
                        {m.travelers.people.length ? <ol className="cw-travelers">{m.travelers.people.map((person, index) => <li key={person.id}><details>
                            <summary><span className="cw-traveler-number">{index + 1}</span><strong>{person.name || '이름 미입력'}</strong><Icon name="expand_more" /></summary>
                            <dl>{person.details.map((fact, i) => <div key={`${fact.label}-${i}`}><dt>{fact.label}</dt><dd>{fact.value || '미입력'}</dd></div>)}</dl>
                        </details></li>)}</ol> : <p className="cw-information-empty">등록된 여행자가 없습니다. 고객이 제출한 정보를 확인해 주세요.</p>}
                        <button type="button" className="cw-disclosure-link" disabled={busy} onClick={action('travelers')}>여행자 전체 상세보기<Icon name="chevron_right" /></button></div>
                    </details>}
                    <details className="cw-customer-disclosure"><summary><span className="cw-disclosure-icon"><Icon name="chat_bubble_outline" /></span><span className="cw-disclosure-copy"><strong>고객 요청 사항</strong><small>{m.preferences?.length ? `${m.preferences.length}건 등록` : '등록된 요청 없음'}</small></span><Icon name="expand_more" /></summary><div className="cw-disclosure-body cw-preferences">{m.preferences?.length ? <div className="cw-chips">{m.preferences.map((value, index) => <span key={index}>{value}</span>)}</div> : <p>등록된 요청 사항이 없습니다.</p>}</div></details>
                    {m.agreement && <div className="cw-agreement"><span>계약 동의·서명</span><strong>{m.agreement.label}</strong>{m.agreement.name && <small>서명자 · {m.agreement.name}</small>}{m.agreement.at && <small>{m.agreement.at}</small>}</div>}
                    <div className="cw-customer-edit">{edit('고객 정보 수정', 'edit-info', '고객 정보 수정')}</div>
                </article>
                <article className="cw-card cw-notes">
                    <header><div className="cw-section-title"><span className="cw-section-icon is-neutral"><Icon name="edit_note" /></span><h2>상담 · 메모</h2></div><span className="cw-private"><Icon name="lock" />내부 전용</span></header>
                    <p className="cw-card-caption">직원이 함께 확인하는 상담 기록입니다.</p>
                    {m.notes.length ? <ol>{m.notes.slice(-4).map(note => <li key={note.id}><div><span className="cw-note-avatar" aria-hidden="true"><Icon name="person" /></span><strong>{note.author || '관리자 메모'}</strong>{note.at && <time>{note.at}</time>}</div><p>{note.body}</p></li>)}</ol> : <div className="cw-empty cw-empty-notes"><Icon name="edit_note" /><p>첫 상담 내용을 남겨 보세요.</p></div>}
                    {noteComposer || <button type="button" className="cw-button cw-wide" disabled={busy} onClick={action('notes')}><Icon name="edit_note" />메모 작성</button>}
                    <button type="button" className="cw-history-link" disabled={busy} onClick={action('history')}>전체 처리 이력 보기<Icon name="chevron_right" /></button>
                </article>
            </div>

            <div className="cw-column cw-itinerary-column"><article className="cw-card cw-itinerary-card">
                <header><div className="cw-section-title"><span className="cw-section-icon"><Icon name="route" /></span><h2>여행 일정</h2>{!!m.days.length && <span className="cw-section-count">{m.days.length}일</span>}</div>{edit('여행 일정 편집', 'edit-itinerary', '일정표 편집')}</header>
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
                                <span className="cw-day-image"><Icon name="landscape" />{day.image && <img key={day.image} loading="lazy" decoding="async" src={day.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}</span>
                                <span className="cw-day-content"><span className="cw-day-date"><b>{day.day}일차</b><small>{day.date || '날짜 확인 필요'}</small></span><strong className="cw-day-title">{day.title || `${day.day}일차 일정 작성`}</strong></span>
                                <span className="cw-day-detail-label" aria-hidden="true"><span className="cw-day-show">상세 보기</span><span className="cw-day-hide">접기</span><Icon name="expand_more" /></span>
                            </summary>
                            <div className="cw-day-details">
                                <h3>{day.day}일차 상세 일정</h3>{day.region && day.region !== day.title && <p className="cw-day-region">{day.region}</p>}
                                {activities.length ? activityList(activities) : <p className="cw-information-empty">상세 일정이 입력되지 않았습니다.</p>}
                                <dl className="cw-day-logistics"><div><dt><Icon name="hotel" />숙소</dt><dd>{day.stayRequired === false ? '숙박 없음' : day.stay || '미입력'}{day.stayRequired !== false && day.stay && <span className={`cw-pill ${day.stayAssigned ? 'is-ready' : 'is-unknown'}`}>{day.stayAssigned ? '실제 배정' : '일정상 숙소'}</span>}</dd></div><div><dt><Icon name="restaurant" />식사</dt><dd>{day.meals || '미입력'}</dd></div>{day.travel && <div><dt><Icon name="directions_car" />이동</dt><dd>{day.travel}</dd></div>}</dl>
                            </div>
                        </details>
                        <button type="button" className="cw-text-button cw-day-edit" aria-label={`${day.day}일차 일정 편집`} disabled={busy} onClick={action('edit-itinerary', day.id)}><Icon name="edit" />편집</button>
                    </li>;
                })}</ol> : <div className="cw-empty cw-empty-itinerary"><span className="cw-empty-graphic"><Icon name="route" /></span><strong>어떤 여행을 준비할까요?</strong><p>기존 견적·상품 일정을 불러와 편집할 수 있습니다.</p><button type="button" className="cw-button" disabled={busy} onClick={action('edit-itinerary')}>일정 작성하기</button></div>}
                <section className="cw-files" aria-label="고객 문서와 파일">
                    <header><div><h2>고객 문서</h2><p className="cw-card-caption">내용을 확인하고 고객에게 전달하세요.</p></div><button type="button" className="cw-text-button" disabled={busy} onClick={action('documents')}>모두 보기<Icon name="chevron_right" /></button></header>
                    <div className="cw-file-list">{m.documents.map(doc => <button type="button" key={doc.id} disabled={busy || doc.disabled} onClick={action(doc.action || doc.id, doc.id)}><span className="cw-file-icon"><Icon name="description" /></span><span className="cw-file-copy"><strong>{doc.label}</strong><small>{doc.status || doc.detail || '내용 확인'}</small>{doc.status && doc.detail && <small>{doc.detail}</small>}</span><Icon name="chevron_right" /></button>)}</div>
                    {!m.documents.length && <p className="cw-card-caption">견적을 작성하면 고객에게 전달할 문서를 확인할 수 있습니다.</p>}
                </section>
            </article>

                <article className="cw-card cw-recent-history">
                    <header><div className="cw-section-title"><span className="cw-section-icon is-neutral"><Icon name="history" /></span><h2>최근 고객 이력</h2></div><button type="button" className="cw-text-button" disabled={busy} onClick={action('history')}>전체보기<Icon name="chevron_right" /></button></header>
                    {m.currentStage && <div className={`cw-current-stage is-${m.currentStage.tone}`}><span>현재 단계</span><strong>{m.currentStage.label}</strong>{m.currentStage.detail && <p>{m.currentStage.detail}</p>}</div>}
                    {m.recentHistory?.length ? <ol className="cw-event-list">{m.recentHistory.slice(0, 5).map(event => <li key={event.id}><span className={`cw-event-dot is-${event.kind}`} aria-hidden="true" /><div><div className="cw-event-meta"><time dateTime={event.at} title={historyTime(event.at, true)}>{historyTime(event.at)}</time>{event.internal && <span><Icon name="lock" />내부</span>}</div><strong>{event.title}</strong>{event.detail && <p>{event.detail}</p>}</div></li>)}</ol> : <p className="cw-information-empty">저장된 처리 이력이 없습니다. 앞으로 기록된 업무를 여기에 표시합니다.</p>}
                </article>
            </div>
            <div className="cw-column cw-operations-column">
                <article className="cw-card cw-payments">
                    <header><div className="cw-section-title"><span className="cw-section-icon is-neutral"><Icon name="payments" /></span><h2>결제 현황</h2></div></header>
                    <div className="cw-payment-summary">
                    <span className="cw-total-label">총 여행금액</span><strong className="cw-total">{money(m.payment.total)}</strong>
                    <div className="cw-payment-ratio"><span>입금 확인 비율</span><strong>{paidPercent === null ? '확인 필요' : `${paidPercent}%`}</strong></div>
                    <div className="cw-payment-progress"><div role="progressbar" aria-label="입금 확인 비율" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercent ?? undefined} aria-valuetext={paidPercent === null ? '확인 필요' : undefined}><span style={{ width: `${paidPercent ?? 0}%` }} /></div></div>
                    </div>
                    <dl className="cw-payment-lines">{([{ label: '예약금', value: m.payment.deposit, paid: m.payment.depositPaid }, { label: '잔금', value: m.payment.balance, paid: m.payment.balancePaid }]).map(item => <div key={item.label}><dt>{item.label}</dt><dd><strong>{money(item.value)}</strong><span className={`cw-pill ${item.paid === true ? 'is-ready' : item.paid === null ? 'is-unknown' : 'is-pending'}`}>{item.paid === true ? '입금 확인' : item.paid === null ? '확인 필요' : '미입금'}</span></dd></div>)}</dl>
                    <div className="cw-payment-footer"><span><Icon name="info" />실제 입금 확인 기준</span><button type="button" className="cw-button" disabled={busy || m.disabledActions?.includes('payments')} title={m.disabledActions?.includes('payments') ? m.disabledActionReason : undefined} onClick={action('payments')}>입금·잔금 관리<Icon name="chevron_right" /></button></div>
                </article>
                <article className="cw-card cw-assignments">
                    <header><div className="cw-section-title"><span className="cw-section-icon is-neutral"><Icon name="hotel" /></span><h2>숙소 · 차량 · 가이드</h2></div><span className="cw-assignment-count">{assignedResources}/{m.assignments.length} 배정</span></header>
                    <p className="cw-card-caption">{directAssignments ? '등록된 자원을 선택해 이 예약에 배정하세요.' : '각 항목을 눌러 배정 내용을 확인하고 선택하세요.'}</p>
                    <ul className="cw-assignment-list">{m.assignments.map(item => <li key={item.id}><button type="button" className="cw-resource-select" aria-label={`${item.label} 관리`} disabled={busy || m.disabledActions?.includes('assignments')} title={m.disabledActions?.includes('assignments') ? m.disabledActionReason : undefined} onClick={action(item.id)}>
                        <span className={`cw-resource-icon is-${item.id}`}><Icon name={item.id === 'stay' ? 'hotel' : item.id === 'vehicle' ? 'directions_car' : 'person'} /></span>
                        <div className="cw-assignment-copy"><span className="cw-assignment-label">{item.label}</span><strong>{item.value || '미배정'}</strong>{item.detail && <small>{item.detail}</small>}<span className={`cw-pill is-${item.state}`}>{item.statusLabel}</span></div>
                        <span className="cw-resource-select-label">{item.id === 'stay' ? '숙소 선택' : item.id === 'vehicle' ? '차량 선택' : '가이드 선택'}<Icon name="expand_more" /></span>
                    </button>
                    </li>)}</ul>
                    {assignmentEditor}
                    <button type="button" className="cw-history-link" disabled={busy} onClick={action('history')}><Icon name="history" />예약 변경 · 발송 이력<Icon name="chevron_right" /></button>
                </article>
            </div>
        </div>
    </section>;
}
