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

export function CustomerWorkspaceOverview({ model: m, onAction, busy = false, noteComposer, bookingSelector }: {
    model: CustomerWorkspaceOverviewModel; onAction: (action: string, id?: string) => void;
    busy?: boolean; noteComposer?: ReactNode; bookingSelector?: ReactNode;
}) {
    const money = (value: number | null) => value === null || !Number.isFinite(value) ? '확인 필요' : `${value.toLocaleString('ko-KR')}원`;
    const progressKnown = m.payment.total !== null && Number.isFinite(m.payment.total) && m.payment.depositPaid !== null && m.payment.balancePaid !== null && (!m.payment.depositPaid || (m.payment.deposit !== null && Number.isFinite(m.payment.deposit))) && (!m.payment.balancePaid || (m.payment.balance !== null && Number.isFinite(m.payment.balance)));
    const paidAmount = (m.payment.depositPaid ? m.payment.deposit || 0 : 0) + (m.payment.balancePaid ? m.payment.balance || 0 : 0);
    const paidPercent = progressKnown ? (m.payment.total! > 0 ? Math.min(100, Math.max(0, Math.round(paidAmount / m.payment.total! * 100))) : m.payment.depositPaid && m.payment.balancePaid ? 100 : 0) : null;
    const next = m.tasks[0];
    const action = (name: string, id?: string) => () => onAction(name, id);
    const edit = (label: string, name: string) => <button type="button" className="cw-text-button" aria-label={label} disabled={busy} onClick={action(name)}><Icon name="edit" />수정</button>;
    return <section className="cw-overview" aria-label="고객 통합 작업 현황" aria-busy={busy}>
        <div className="cw-breadcrumb"><button type="button" disabled={busy} onClick={action('back')}>고객 관리</button><Icon name="chevron_right" /><span>{m.customerName || '고객 정보 확인 필요'}</span></div>
        <header className="cw-customer-header">
            <div><div className="cw-customer-title"><h1>{m.customerName || '고객 정보 확인 필요'} <span>고객</span></h1><span className="cw-status">{m.statusLabel}</span></div><p>{[m.partyLabel, m.period].filter(Boolean).join(' · ')}</p><div className="cw-record"><span>{m.sourceLabel}</span>{m.bookingNumber && <span>#{m.bookingNumber}</span>}{bookingSelector}</div></div>
            <div className="cw-header-actions"><button type="button" className="cw-button" disabled={busy || !m.customerLinkAvailable} onClick={action('customer-link')}><Icon name="link" />고객용 링크</button><button type="button" className="cw-button cw-primary" disabled={busy || !m.canSendItinerary} onClick={action('send-itinerary')}><Icon name="send" />일정표 보내기</button></div>
        </header>
        <ol className="cw-journey" aria-label="고객 업무 진행 단계">{m.steps.map(step => <li key={step.id} className={`${step.done ? 'is-done' : ''} ${step.current ? 'is-current' : ''}`} aria-current={step.current || undefined}><span className="cw-step-dot">{step.done ? '✓' : ''}</span><span>{step.label}</span></li>)}</ol>
        <div className={`cw-next-task${next ? '' : ' is-complete'}`} role="status"><span className="cw-task-symbol"><Icon name={next ? 'assignment' : 'check_circle'} /></span><strong>다음 할 일</strong><span className="cw-task-description">{next?.label || '현재 확인된 미완료 업무가 없습니다.'}</span><button type="button" className="cw-button cw-primary" disabled={busy} onClick={action(next?.action || 'history', next?.id)}>{next ? `${m.tasks.length}건 확인` : '이력 확인'}<Icon name="arrow_forward" /></button></div>
        {m.tasks.length > 1 && <div className="cw-task-list" aria-label="남은 고객 업무">{m.tasks.slice(1, 5).map(task => <button type="button" key={task.id} disabled={busy} onClick={action(task.action, task.id)}><span />{task.label}<Icon name="chevron_right" /></button>)}{m.tasks.length > 5 && <span>외 {m.tasks.length - 5}건</span>}</div>}
        <div className="cw-columns">
            <div className="cw-column cw-customer-column">
                <article className="cw-card"><header><h2>고객 정보</h2>{edit('고객 정보 수정', 'edit-info')}</header><dl className="cw-facts">{m.facts.map((fact, index) => <div key={`${fact.label}-${index}`}><dt>{fact.label}</dt><dd>{fact.value || '미등록'}</dd></div>)}</dl><div className="cw-preferences"><h3>고객 요청 사항</h3>{m.preferences?.length ? <div className="cw-chips">{m.preferences.map((value, index) => <span key={index}>{value}</span>)}</div> : <p>등록된 요청 사항이 없습니다.</p>}</div></article>
                <article className="cw-card cw-notes"><header><h2>상담 · 메모</h2><span className="cw-private"><Icon name="lock" />내부 전용</span></header><p className="cw-card-caption">직원이 기록한 상담 내용과 메모입니다.</p>{m.notes.length ? <ol>{m.notes.slice(-4).map(note => <li key={note.id}><div><strong>{note.author || '관리자 메모'}</strong>{note.at && <time>{note.at}</time>}</div><p>{note.body}</p></li>)}</ol> : <div className="cw-empty">상담 내용을 기록해 함께 확인하세요.</div>}{noteComposer || <button type="button" className="cw-button cw-wide" disabled={busy} onClick={action('notes')}><Icon name="edit_note" />메모 작성</button>}<button type="button" className="cw-history-link" disabled={busy} onClick={action('history')}>전체 처리 이력 보기<Icon name="chevron_right" /></button></article>
            </div>
            <article className="cw-card cw-itinerary-card"><header><h2>여행 일정</h2>{edit('여행 일정 편집', 'edit-itinerary')}</header>{m.days.length ? <ol className="cw-day-list">{m.days.map(day => <li key={day.id}><button type="button" disabled={busy} onClick={action('edit-itinerary', day.id)}><span className="cw-day-image">{day.image ? <img key={day.image} loading="lazy" decoding="async" src={day.image} alt="" onError={e => { e.currentTarget.style.display = 'none'; }} /> : <Icon name="landscape" />}</span><span className="cw-day-date"><b>DAY {day.day}</b><small>{day.date || '날짜 확인 필요'}</small></span><span className="cw-day-copy"><strong>{day.title || `${day.day}일차 일정 작성`}</strong><small>{day.summary || '상세 일정을 확인하세요.'}</small></span><Icon name="chevron_right" /></button></li>)}</ol> : <div className="cw-empty cw-empty-itinerary"><Icon name="route" /><strong>여행 일정을 준비해 주세요</strong><p>기존 견적·상품 일정을 불러와 편집할 수 있습니다.</p><button type="button" className="cw-button" disabled={busy} onClick={action('edit-itinerary')}>일정 작성하기</button></div>}<section className="cw-files" aria-label="고객 문서와 파일"><header><h2>문서 · 파일</h2><button type="button" className="cw-text-button" disabled={busy} onClick={action('documents')}>모두 보기<Icon name="chevron_right" /></button></header><div className="cw-file-list">{m.documents.map(doc => <button type="button" key={doc.id} disabled={busy || doc.disabled} onClick={action(doc.action || doc.id, doc.id)}><span className="cw-file-icon"><Icon name="description" /></span><span><strong>{doc.label}</strong><small>{doc.status || doc.detail || '내용 확인'}</small>{doc.status && doc.detail && <small>{doc.detail}</small>}</span><Icon name="chevron_right" /></button>)}</div>{!m.documents.length && <p className="cw-card-caption">견적을 작성하면 고객에게 전달할 문서를 확인할 수 있습니다.</p>}</section></article>
            <div className="cw-column cw-operations-column">
                <article className="cw-card cw-payments"><header><h2>결제 현황</h2></header><span className="cw-total-label">총 여행금액</span><strong className="cw-total">{money(m.payment.total)}</strong><div className="cw-payment-progress"><div role="progressbar" aria-label="입금 확인 비율" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPercent ?? undefined} aria-valuetext={paidPercent === null ? '확인 필요' : undefined}><span style={{ width: `${paidPercent ?? 0}%` }} /></div><span>{paidPercent === null ? '확인 필요' : `${paidPercent}%`}</span></div><dl className="cw-payment-lines">{([{ label: '예약금', value: m.payment.deposit, paid: m.payment.depositPaid }, { label: '잔금', value: m.payment.balance, paid: m.payment.balancePaid }]).map(item => <div key={item.label}><dt>{item.label}</dt><dd><strong>{money(item.value)}</strong><span className={`cw-pill ${item.paid === true ? 'is-ready' : 'is-pending'}`}>{item.paid === true ? '입금 확인' : item.paid === null ? '확인 필요' : '미입금'}</span></dd></div>)}</dl><div className="cw-payment-footer"><span><Icon name="info" />실제 입금 확인 상태입니다.</span><button type="button" className="cw-button" disabled={busy} onClick={action('payments')}><Icon name="receipt_long" />입금·잔금 관리</button></div></article>
                <article className="cw-card cw-assignments"><header><h2>숙소 · 차량 · 가이드</h2></header><ul>{m.assignments.map(item => <li key={item.id}><Icon name={item.id === 'stay' ? 'hotel' : item.id === 'vehicle' ? 'directions_car' : 'person'} /><div><span className="cw-assignment-label">{item.label}</span><strong>{item.value || '미배정'}</strong>{item.detail && <small>{item.detail}</small>}<span className={`cw-pill is-${item.state}`}>{item.statusLabel}</span></div><button type="button" className="cw-button" aria-label={`${item.label} 관리`} disabled={busy} onClick={action(item.id)}>{item.state === 'ready' ? '변경' : '확인'}</button></li>)}</ul><button type="button" className="cw-history-link" disabled={busy} onClick={action('history')}><Icon name="history" />예약 변경 · 발송 이력<Icon name="chevron_right" /></button></article>
            </div>
        </div>
    </section>;
}
