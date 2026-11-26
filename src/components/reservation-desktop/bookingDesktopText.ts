import { BK_WEEK } from '../reservation-shared/bookingShared';

/** PC 예약 화면의 날짜 표기: ‘11월 27일(금)’, ‘11월 27일(금) → 11월 30일(월)’. */
export const fmtMd = (d: Date) => `${d.getMonth() + 1}월 ${d.getDate()}일(${BK_WEEK[d.getDay()]})`;
export const rangeText = (start: Date, end: Date) => `${fmtMd(start)} → ${fmtMd(end)}`;
