import type { CSSProperties } from 'react';

export interface ReservationWorkflowStep {
    id: string;
    title: string;
    description: string;
    done: boolean;
    actionLabel: string;
    onAction: () => void;
    disabled?: boolean;
}

export interface ReservationReadinessItem {
    title: string;
    value: string;
    description: string;
    ready: boolean;
    onAction: () => void;
}

interface ReservationWorkflowProps {
    steps: ReservationWorkflowStep[];
    readiness: ReservationReadinessItem[];
    cancelled?: boolean;
}

const WorkflowCheck = () => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <path d="m4.5 10 3.6 3.6 7.4-7.4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const WorkflowArrow = () => (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
        <path d="M4 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

/** 상품 예약의 실제 저장 상태와 작업 동작은 부모가 전달한다. */
export function ReservationWorkflow({ steps, readiness, cancelled = false }: ReservationWorkflowProps) {
    const nextIndex = steps.findIndex(step => !step.done);
    const nextStep = nextIndex < 0 ? undefined : steps[nextIndex];
    const completeCount = steps.filter(step => step.done).length;
    const allDone = steps.length > 0 && !nextStep;

    return (
        <div className="rw-overview">
            <section className="rw-workflow-card" aria-label="예약 진행 순서">
                <div className="rw-card-heading">
                    <div>
                        <p className="rw-eyebrow">예약 진행 순서</p>
                        <h2>지금 해야 할 작업을 순서대로 진행하세요</h2>
                    </div>
                    <span className={`rw-progress-label${allDone && !cancelled ? ' is-complete' : ''}`}>
                        {cancelled ? '취소된 예약' : allDone ? '필수 작업 완료' : `${completeCount}/${steps.length}단계 완료`}
                    </span>
                </div>

                <ol className="rw-steps" style={{ '--rw-step-count': Math.max(steps.length, 1) } as CSSProperties}>
                    {steps.map((step, index) => {
                        const isNext = !cancelled && index === nextIndex;
                        return (
                            <li key={step.id} className={`rw-step-item${step.done ? ' is-done' : ''}${isNext ? ' is-next' : ''}`}>
                                <button
                                    type="button"
                                    className="rw-step-button"
                                    onClick={step.onAction}
                                    disabled={cancelled || step.disabled}
                                    aria-current={isNext || undefined}
                                    title={step.description}
                                >
                                    <span className="rw-step-number">{step.done ? <WorkflowCheck /> : index + 1}</span>
                                    <span className="rw-step-title">{step.title}</span>
                                    <span className="rw-step-description">{step.description}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>

                <div className={`rw-next-task${allDone ? ' is-complete' : ''}${cancelled ? ' is-cancelled' : ''}`}>
                    <span className="rw-next-marker" aria-hidden="true">{allDone && !cancelled ? <WorkflowCheck /> : cancelled || !nextStep ? '—' : nextIndex + 1}</span>
                    <div className="rw-next-copy">
                        <span className="rw-eyebrow">{cancelled ? '예약 상태' : allDone ? '진행 현황' : '지금 할 일'}</span>
                        <h3>{cancelled ? '취소된 예약입니다' : allDone ? '필수 작업 완료' : nextStep?.title || '예약 진행 상태를 확인해 주세요'}</h3>
                        <p>{cancelled ? '예약 내용과 기존 문서는 아래에서 확인할 수 있습니다.' : allDone ? '문서와 배정 정보를 확인하고 필요한 경우 수정할 수 있습니다.' : nextStep?.description || '예약 정보를 불러온 뒤 진행 상태가 표시됩니다.'}</p>
                    </div>
                    {!cancelled && nextStep && (
                        <button type="button" className="rw-primary-action" onClick={nextStep.onAction} disabled={nextStep.disabled}>
                            {nextStep.actionLabel}<WorkflowArrow />
                        </button>
                    )}
                </div>
            </section>

            <section className="rw-readiness-card" aria-label="운영 준비 상태">
                <div className="rw-card-heading">
                    <div>
                        <p className="rw-eyebrow">출발 전 확인</p>
                        <h2>운영 준비 상태</h2>
                    </div>
                    <p className="rw-heading-note">항목을 누르면 해당 작업으로 이동합니다.</p>
                </div>
                <div className="rw-readiness-grid">
                    {readiness.map(item => (
                        <button key={item.title} type="button" className={`rw-readiness-item${item.ready ? ' is-ready' : ''}`} onClick={item.onAction}>
                            <span className="rw-readiness-top"><span>{item.title}</span><span className="rw-readiness-state">{item.ready ? <WorkflowCheck /> : '확인 필요'}</span></span>
                            <strong className="rw-readiness-value">{item.value}</strong>
                            <span className="rw-readiness-description">{item.description}</span>
                            <span className="rw-readiness-link">{item.ready ? '내용 확인' : '확인하러 가기'}<WorkflowArrow /></span>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
}
