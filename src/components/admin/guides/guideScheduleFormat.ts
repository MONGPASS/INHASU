import type { V7AssignmentItem } from '../../../utils/reservationV7';
import type { RegisteredGuide } from '../../../utils/registeredAssignmentResources';
import { tripLengthLabel } from '../../../utils/accommodationSheet';
import { dayDiff, type ScheduleBooking } from './guideScheduleModel';

/** 가이드 배정 현황이 다루는 예약 한 건(배정 API 응답 + 화면에 쓰는 고객 정보) */
export type GuideItem = V7AssignmentItem & ScheduleBooking & {
    customerName?: string; leadName?: string; travelers?: number; productName?: string; reservationNumber?: string; createdAt?: string;
    contractData?: { region?: string; arrival?: { date?: string; time?: string; flight?: string }; departure?: { date?: string; time?: string; flight?: string } };
};

/** 가이드 한 줄(등록 가이드 또는 예약에만 적힌 이름) */
export interface GuideRow { key: string; guide: { id?: string; name: string }; registered: boolean; resource?: RegisteredGuide; bookings: GuideItem[]; color: string[] }

/** 차종·차량 번호·기사 이름·연락처 */
export interface CarInfo { type: string; plate: string; driver: string; phone: string }

export const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const norm = (value?: string) => String(value || '').replace(/\s+/g, '').toLowerCase();
export const nameOf = (b: GuideItem) => (b.leadName || b.customerName || '이름 없음').trim();
export const regionOf = (b: GuideItem) => (b.contractData?.region || '').trim();
export const md = (key?: string) => (key || '').slice(5).replace('-', '.');
export const startOf = (b: GuideItem) => (b.startDate || '').slice(0, 10);
export const endOf = (b: GuideItem) => (b.endDate || b.startDate || '').slice(0, 10);
export const period = (b: GuideItem) => `${md(startOf(b))}→${md(endOf(b))}`;
export const people = (b: GuideItem) => (b.travelers ? `${b.travelers}명` : '인원 미정');
export const nights = (b: GuideItem) => tripLengthLabel(b.startDate, b.endDate);
export const initial = (name: string) => name.replace(/^로컬\s*/, '').trim().slice(0, 1).toUpperCase() || '?';
export const tourName = (b: GuideItem) => b.productName || (b.source === 'quote_booking' ? '맞춤 견적 여행' : '상품 미지정');
export const sourceLabel = (b: GuideItem) => b.source === 'quote_booking' ? '견적 예약' : '상품 예약';

/** ‘11.27 – 11.28’ */
export const rangeShort = (b: GuideItem) => `${md(startOf(b))} – ${md(endOf(b))}`;
/** ‘2026.11.27 – 11.28’, 해를 넘기면 ‘2026.12.31 – 2027.01.03’ */
export const rangeFull = (b: GuideItem) => {
    const a = startOf(b), z = endOf(b);
    if (!a) return '날짜 미정';
    return `${a.replace(/-/g, '.')} – ${z.slice(0, 4) === a.slice(0, 4) ? md(z) : z.replace(/-/g, '.')}`;
};
/** 출발까지 남은 날: ‘D-4’ · 진행 중 · 종료 */
export const dday = (b: GuideItem, today: string) => {
    const a = startOf(b);
    if (!a) return { label: '날짜 미정', days: null as number | null };
    const n = dayDiff(today, a);
    if (n > 0) return { label: `D-${n}`, days: n };
    if (endOf(b) >= today) return { label: '진행 중', days: 0 };
    return { label: '종료', days: null };
};
