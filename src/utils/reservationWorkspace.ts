import { hasProductSchedule } from '../../functions/lib/productItinerary.ts';

export interface ReservationOperations {
    joining: 'private' | 'join' | 'undecided';
    region: string;
    category: string;
    vehicle: string;
    driverPhone: string;
    /** 예약 관리 v7의 구분(풀패키지·일정+차량…)과 항공(포함·불포함·개별). 빈 값은 미정. */
    serviceType?: string;
    airfare?: string;
    receipt: { status: ReceiptStatus; number: string; issuedDate: string };
    opsNote: string;
}
export type ReceiptStatus = 'not_requested' | 'pending' | 'issued' | 'info_missing' | 'tax_invoice_pending' | 'tax_invoice_issued';

/** 예약 관리 v7의 운영 선택지. 저장 값은 functions/api/reservations.ts가 같은 목록으로 검증한다. */
export const SERVICE_TYPE_OPTIONS = ['풀패키지', '일정+차량', '차량만', '가이드만', '숙소만', '기타'];
export const AIRFARE_OPTIONS = ['포함', '불포함', '개별'];
// 숙소 배정 시트(G열 분류)와 같은 목록. 기존 저장 값은 그대로 두고 시트에만 있던 분류를 더했다.
export const CATEGORY_OPTIONS = ['개인', '가족여행', '학회/협회', '학교행사', '정부행사', '여행사', '산악회', '우정여행', '승마투어', '골프투어', '종교행사', '기타행사', '출장/세미나'];
export const JOINING_LABELS: Record<ReservationOperations['joining'], string> = { join: '체크(Yes)', private: '체크(No)', undecided: '미정' };
export const RECEIPT_LABELS: Record<ReceiptStatus, string> = {
    pending: '예정', issued: '완료', not_requested: '해당x', info_missing: '정보작성x', tax_invoice_pending: '전자세금계산서발행', tax_invoice_issued: '전자세금계산서완료',
};

export const emptyReservationOperations = (): ReservationOperations => ({
    joining: 'undecided', region: '', category: '', vehicle: '', driverPhone: '', serviceType: '', airfare: '',
    receipt: { status: 'not_requested', number: '', issuedDate: '' }, opsNote: '',
});

/** 메일 발송·문서 공개·고객 동의는 서로 다른 완료 조건이다. */
export function reservationWorkspaceStatus(input: {
    status: string;
    depositStatus: string;
    itineraryUrl?: string;
    days: any[];
    agreement?: { agreed?: boolean };
    travelers?: Array<{ name?: string }>;
    totalPeople: number;
    startDate?: string;
    endDate?: string;
    assignedGuide?: { name?: string };
    dailyAccommodations?: Array<{ day: number; accommodation?: { name?: string } }>;
}) {
    const scheduleReady = hasProductSchedule(input.days);
    const duration = input.startDate && input.endDate
        ? Math.round((Date.parse(input.endDate.slice(0, 10)) - Date.parse(input.startDate.slice(0, 10))) / 86400000) : NaN;
    const nights = Number.isFinite(duration) && duration >= 0 ? duration : Math.max(0, input.days.length - 1);
    // Product/template lodging describes the plan; only saved booking assignments confirm rooms.
    const accommodationDays = new Set<number>();
    for (const stay of input.dailyAccommodations || []) if (stay.accommodation?.name) accommodationDays.add(Number(stay.day));
    const stayCount = Array.from(accommodationDays).filter(day => day >= 1 && day <= nights).length;
    const travelerCount = (input.travelers || []).filter(t => t.name?.trim()).length;
    const cancelled = input.status === 'cancelled';
    return {
        cancelled, scheduleReady, nights, stayCount, travelerCount,
        depositPaid: input.depositStatus === 'paid',
        signed: input.agreement?.agreed === true,
        published: !cancelled && ['confirmed', 'paid', 'completed'].includes(input.status) && !!input.itineraryUrl && scheduleReady,
        accommodationsReady: nights === 0 || stayCount >= nights,
        travelersReady: input.totalPeople > 0 && travelerCount >= input.totalPeople,
        guideReady: !!input.assignedGuide?.name,
    };
}
