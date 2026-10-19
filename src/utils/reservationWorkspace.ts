import { hasProductSchedule } from '../../functions/lib/productItinerary.ts';

export interface ReservationOperations {
    joining: 'private' | 'join' | 'undecided';
    region: string;
    category: string;
    vehicle: string;
    driverPhone: string;
    receipt: { status: 'not_requested' | 'pending' | 'issued'; number: string; issuedDate: string };
    opsNote: string;
}

export const emptyReservationOperations = (): ReservationOperations => ({
    joining: 'undecided', region: '', category: '', vehicle: '', driverPhone: '',
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
