/**
 * 숙소 수배(예약) 상태 — 숙소 배정 보드·고객 상세(v7)·예약 상세가 함께 쓰는 정본 목록.
 *
 * 처음 네 상태의 저장 값은 기존 몽골어 표기를 그대로 유지한다(이미 저장된 예약과 다른 화면이 읽는 값).
 * 2026-11 추가 상태는 한국어 그대로 저장한다. 화면에는 항상 `label`을 보여 준다.
 * 순서가 선택지 순서다.
 */
export interface LodgeBookingStatus { value: string; label: string; color: string; tone: 'gray' | 'amber' | 'blue' | 'solid' }

export const LODGE_BOOKING_UNSENT = 'Илгээгээгүй';
export const LODGE_BOOKING_STATUSES: LodgeBookingStatus[] = [
    { value: LODGE_BOOKING_UNSENT, label: '미발송', color: '#adb5bd', tone: 'gray' },
    { value: '예약요청', label: '예약요청', color: '#f59f00', tone: 'amber' },
    { value: 'Имэйл илгээсэн', label: '메일 발송', color: '#f08c00', tone: 'amber' },
    { value: 'Хариу ирсэн', label: '회신 받음', color: '#1c6fd1', tone: 'blue' },
    { value: '예약완료', label: '예약완료', color: '#12b28c', tone: 'solid' },
    { value: 'Баталгаажсан', label: '확정', color: '#12b28c', tone: 'solid' },
    { value: '취소요청', label: '취소요청', color: '#e8590c', tone: 'amber' },
    { value: '취소완료', label: '취소완료', color: '#868e96', tone: 'gray' },
    { value: '변경요청', label: '변경요청', color: '#f08c00', tone: 'amber' },
    { value: '변경완료', label: '변경완료', color: '#12b28c', tone: 'solid' },
    { value: '배정X', label: '배정X', color: '#FF4F4F', tone: 'gray' },
];

/** 숙소 수배가 끝난 상태. 이 상태의 숙박만 ‘배정 완료’ 집계에 들어간다. */
const CONFIRMED = new Set(['Баталгаажсан', '예약완료', '변경완료']);
export const isLodgeBookingConfirmed = (value: unknown) => CONFIRMED.has(String(value ?? ''));

/** 목록에 없는 예전 값은 저장 값을 그대로 라벨로 보여 준다. */
export const lodgeBookingLabel = (value: unknown) => {
    const v = String(value ?? '');
    return LODGE_BOOKING_STATUSES.find(s => s.value === v)?.label ?? v;
};
