import { WEEK } from '../estimate-desktop/quoteForm';

/**
 * Mobile quote form (Claude Design: "Milkyway Japan Mobile" — M Quote Form).
 * 선택지·검증·제출 payload는 estimate-desktop/quoteForm.ts, 폼 상태는 estimate-desktop/useQuoteForm.ts에 있고
 * (PC 폼과 공용), 이 파일에는 모바일 전용 표기만 둔다.
 */

export type CalKind = 'start' | 'end';
export type StepState = 'done' | 'current' | 'todo';

/** 2026-10-03 → 10월 3일(토): the short form that fits the half-width date fields. */
export const koDateShort = (v: string) => {
    if (!v) return '';
    const [y, m, d] = v.split('-').map(Number);
    return `${m}월 ${d}일(${WEEK[new Date(y, m - 1, d).getDay()]})`;
};

/** The first unfinished step is the "current" one on the rail. */
export const stepStates = (steps: boolean[]): StepState[] => {
    const current = steps.indexOf(false);
    return steps.map((done, i) => (done ? 'done' : i === current ? 'current' : 'todo'));
};
