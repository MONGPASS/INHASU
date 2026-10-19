import type { ReactNode } from 'react';
import { Icon } from './console/Icon';
import './CustomerWorkspaceOverview.css';

export interface CustomerWorkspaceOverviewModel {
    customerName: string; sourceLabel: string; bookingNumber?: string; statusLabel: string;
    period: string; partyLabel: string;
    facts: Array<{ label: string; value: string }>;
    preferences?: string[];
    notes: Array<{ id: string; body: string; at?: string; author?: string }>;
    days: Array<{ id: string; day: number; title: string; date?: string; summary?: string; image?: string }>;
    documents: Array<{ id: string; label: string; detail?: string; status?: string; action?: string; disabled?: boolean }>;
    payment: { total: number | null; deposit: number | null; balance: number | null; depositPaid: boolean | null; balancePaid: boolean | null };
    assignments: Array<{ id: 'guide' | 'vehicle' | 'stay'; label: string; value: string; detail?: string; statusLabel: string; state: 'ready' | 'pending' | 'unknown' }>;
    steps: Array<{ id: string; label: string; done: boolean; current?: boolean }>;
    tasks: Array<{ id: string; label: string; action: string }>;
    customerLinkAvailable?: boolean; canSendItinerary?: boolean;
}

export function CustomerWorkspaceOverview({ model: m, onAction, busy = false, noteComposer, bookingSelector, assignmentEditor, directAssignments = false }: {
    model: CustomerWorkspaceOverviewModel; onAction: (action: string, id?: string) => void;
    busy?: boolean; noteComposer?: ReactNode; bookingSelector?: ReactNode; assignmentEditor?: ReactNode; directAssignments?: boolean;
}) {
    const money = (value: number | null) => value === null || !Number.isFinite(value) ? '확인 필요' : `${value.toLocaleString('ko-KR')}원`;
    const progressKnown = m.payment.total !== null && Number.isFinite(m.payment.total) && m.payment.depositPaid !== null && m.payment.balancePaid !== null && (!m.payment.depositPaid || (m.payment.deposit !== null && Number.isFinite(m.payment.deposit))) && (!m.payment.balancePaid || (m.payment.balance !== null && Number.isFinite(m.payment.balance)));
    const paidAmount = (m.payment.depositPaid ? m.payment.deposit || 0 : 0) + (m.payment.balancePaid ? m.payment.balance || 0 : 0);
    const paidPercent = progressKnown ? (m.payment.total! > 0 ? Math.min(100, Math.max(0, Math.round(paidAmount / m.payment.total! * 100))) : m.payment.depositPaid && m.payment.balancePaid ? 100 : 0) : null;
    const next = m.tasks[0];
    const name = m.customerName || '고객 정보 확인 필요';
    const action = (name: string, id?: string) => () => onAction(name, id);
    const edit = (label: string, name: string) => <button type="button" className="cw-text-button" aria-label={label} disabled={busy} onClick={action(name)}><Icon name="edit" />수정</button>;

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
                </div>
            </div>
            <div className="cw-header-actions">
                <button type="button" className="cw-button" disabled={busy || !m.customerLinkAvailable} onClick={action('customer-link')}><Icon name="link" />고객용 링크</button>
                <button type="button" className="cw-button cw-primary" disabled={busy || !m.canSendItinerary} onClick={action('send-itinerary')}><Icon name="send" />일정표 보내기</button>
            </div>
        </header>
        {bookingSelector && <div className="cw-booking-switcher">{bookingSelector}</div>}

        {!!m.steps.length && <div className="cw-progress-card">
            <div className="cw-progress-caption"><strong>업무 진행</strong><span>{m.steps.filter(item => item.done).length}<span> / {m.steps.length} 완료</span></span></div>
            <ol className="cw-journey" aria-label="고객 업무 진행 단계">{m.steps.map((item, index) => <li key={item.id} className={`${item.done ? 'is-done' : ''} ${item.current ? 'is-current' : ''}`} aria-current={item.current || undefined}>
                <span className="cw-step-dot">{item.done ? '✓' : index + 1}</span><span>{item.label}</span>
            </li>)}</ol>
        </div>}

        <div className={`cw-task-card${next ? '' : ' is-complete'}`}>
            <div className="cw-next-task" role="status">
                <span className="cw-task-symbol"><Icon name={next ? 'assignment' : 'check_circle'} /></span>
                <div className="cw-task-copy"><div><strong>{next ? '지금 할 일' : '업무 확인 완료'}</strong>{next && <span className="cw-task-count">{m.tasks.length}건 남음</span>}</div><p>{next?.label || '현재 확인된 미완료 업무가 없습니다.'}</p></div>
                <button type="button" className="cw-button cw-primary" disabled={busy} onClick={action(next?.action || 'history', next?.id)}>{next ? '업무 열기' : '이력 확인'}<Icon name="arrow_forward" /></button>
            </div>
            {m.tasks.length > 1 && <details className="cw-task-disclosure">
                <summary>다른 할 일 {m.tasks.length - 1}건<Icon name="chevron_right" /></summary>
                <div className="cw-task-list" aria-label="남은 고객 업무">{m.tasks.slice(1).map(task => <button type="button" key={task.id} disabled={busy} onClick={action(task.action, task.id)}><span className="cw-task-marker" /><span>{task.label}</span><Icon name="arrow_forward" /></button>)}</div>
            </details>}
        </div>

        <div className="cw-columns">
            <div className="cw-column cw-customer-column">
                <article className="cw-card cw-customer-info">
                    <header><h2>고객 정보</h2>{edit('고객 정보 수정', 'edit-info')}</header>
                    <dl className="cw-facts">{m.facts.map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value || '미등록'}</dd></div>)}</dl>
                    <div className="cw-preferences"><h3>고객 요청 사항</h3>{m.preferences?.length ? <div className="cw-chips">{m.preferences.map((value, index) => <span key={index}>{value}</span>)}</div> : <p>등록된 요청 사항이 없습니다.</p>}</div>
                </article>
                <article className="cw-card cw-notes">
                    <header><h2>상담 · 메모</h2><span className="cw-private"><Icon name="lock" />내부 전용</span></header>
                    <p className="cw-card-caption">직원이 함께 확인하는 상담 기록입니다.</p>
                    {m.notes.length ? <ol>{m.notes.slice(-4).map(note => <li key={note.id}><div><span className="cw-note-avatar" aria-hidden="true"><Icon name="person" /></span><strong>{note.author || '관리자 메모'}</strong>{note.at && <time>{note.at}</time>}</div><p>{note.body}</p></li>)}</ol> : <div className="cw-empty cw-empty-notes"><Icon name="edit_note" /><p>첫 상담 내용을 남겨 보세요.</p></div>}
                    {noteComposer || <button type="button" className="cw-button cw-wide" disabled={busy} onClick={action('notes')}><Icon name="edit_note" />메모 작성</button>}
                    <button type="button" className="cw-history-link" disabled={busy} onClick={action('history')}>전체 처리 이력 보기<Icon name="chevron_right" /></button>
                </article>
            </div>

            <article className="cw-card cw-itinerary-card">
                <header><div className="cw-section-title"><span className="cw-section-icon"><Icon name="route" /></span><h2>여행 일정</h2>{!!m.days.length && <span className="cw-section-count">{m.days.length}일</span>}</div>{edit('여행 일정 편집', 'edit-itinerary')}</header>
                {m.days.length ? <ol className="cw-day-list">{m.days.map(day => <li key={day.id}><button type="button" disabled={busy} onClick={action('edit-itinerary', day.id)}>
                    <span className="cw-day-image"><Icon name="landscape" />{day.image && <img key={day.image} loading="lazy" decoding="async" src={day.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} />}</span>
                    <span className="cw-day-content"><span className="cw-day-date"><b>DAY {day.day}</b><small>{day.date || '날짜 확인 필요'}</small></span><span className="cw-day-copy"><strong>{day.title || `${day.day}일차 일정 작성`}</strong><small>{day.summary || '상세 일정을 확인하세요.'}</small></span></span>
                    <Icon name="chevron_right" />
                </button></li>)}</ol> : <div className="cw-empty cw-empty-itinerary"><span className="cw-empty-graphic"><Icon name="route" /></span><strong>어떤 여행을 준비할까요?</strong><p>기존 견적·상품 일정을 불러와 편집할 수 있습니다.</p><button type="button" className="cw-button" disabled={busy} onClick={action('edit-itinerary')}>일정 작성하기</button></div>}
                <section className="cw-files" aria-label="고객 문서와 파일">
                    <header><h2>문서 · 파일</h2><button type="button" className="cw-text-button" disabled={busy} onClick={action('documents')}>모두 보기<Icon name="chevron_right" /></button></header>
                    <div className="cw-file-list">{m.documents.map(doc => <button type="button" key={doc.id} disabled={busy || doc.disabled} onClick={action(doc.action || doc.id, doc.id)}><span className="cw-file-icon"><Icon name="description" /></span><span className="cw-file-copy"><strong>{doc.label}</strong><small>{doc.status || doc.detail || '내용 확인'}</small>{doc.status && doc.detail && <small>{doc.detail}</small>}</span><Icon name="chevron_right" /></button>)}</div>
                    {!m.documents.length && <p className="cw-card-caption">견적을 작성하면 고객에게 전달할 문서를 확인할 수 있습니다.</p>}
                </section>
            </article>

            <div className="cw-column cw-operations-column">
                <article className="cw-card cw-payments">
                    <header><h2>결제 현황</h2><span className="cw-section-icon cw-payment-icon"><Icon name="receipt_long" /></span></header>
                    <span className="cw-total-label">총 여행금액</span><strong className="cw-total">{money(m.payment.total)}</strong>
                    <div className="cw-payment-progress"><div role="progressbar" aria-label="입금 확인 비율" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercent ?? undefined} aria-valuetext={paidPercent === null ? '확인 필요' : undefined}><span style={{ width: `${paidPercent ?? 0}%` }} /></div><span>{paidPercent === null ? '확인 필요' : `${paidPercent}%`}</span></div>
                    <dl className="cw-payment-lines">{([{ label: '예약금', value: m.payment.deposit, paid: m.payment.depositPaid }, { label: '잔금', value: m.payment.balance, paid: m.payment.balancePaid }]).map(item => <div key={item.label}><dt>{item.label}</dt><dd><strong>{money(item.value)}</strong><span className={`cw-pill ${item.paid === true ? 'is-ready' : item.paid === null ? 'is-unknown' : 'is-pending'}`}>{item.paid === true ? '입금 확인' : item.paid === null ? '확인 필요' : '미입금'}</span></dd></div>)}</dl>
                    <div className="cw-payment-footer"><span><Icon name="info" />실제 입금 확인 기준</span><button type="button" className="cw-button" disabled={busy} onClick={action('payments')}>입금·잔금 관리<Icon name="chevron_right" /></button></div>
                </article>
                <article className="cw-card cw-assignments">
                    <header><h2>숙소 · 차량 · 가이드</h2><span className="cw-assignment-count">{m.assignments.filter(item => item.state === 'ready').length}/{m.assignments.length} 배정</span></header>
                    <ul className="cw-assignment-list">{m.assignments.map(item => <li key={item.id}>
                        <span className={`cw-resource-icon is-${item.id}`}><Icon name={item.id === 'stay' ? 'hotel' : item.id === 'vehicle' ? 'directions_car' : 'person'} /></span>
                        <div className="cw-assignment-copy"><span className="cw-assignment-label">{item.label}</span><strong>{item.value || '미배정'}</strong>{item.detail && <small>{item.detail}</small>}<span className={`cw-pill is-${item.state}`}>{item.statusLabel}</span></div>
                        <button type="button" className="cw-button" aria-label={`${item.label} 관리`} disabled={busy} onClick={action(item.id)}>{item.state === 'ready' ? '변경' : directAssignments && item.state !== 'unknown' ? '배정하기' : '확인하기'}</button>
                    </li>)}</ul>
                    {assignmentEditor}
                    <button type="button" className="cw-history-link" disabled={busy} onClick={action('history')}><Icon name="history" />예약 변경 · 발송 이력<Icon name="chevron_right" /></button>
                </article>
            </div>
        </div>
    </section>;
}
