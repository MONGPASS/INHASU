import { toTourDateKey } from './formatDate.ts';
import type { AssignmentAccommodation } from './reservationAssignment';

export interface AccommodationScheduleDay {
    day: number; date: string; title: string; region: string; summary: string;
}
export interface AccommodationSchedule {
    source: 'customer' | 'template' | 'product' | 'booking' | 'quote' | 'none' | 'unavailable';
    days: AccommodationScheduleDay[];
    warnings: string[];
}
export interface ScheduleBooking {
    startDate?: string; endDate?: string;
    dailyAccommodations?: AssignmentAccommodation[];
    schedule?: AccommodationSchedule;
}
export interface AccommodationNight extends AccommodationScheduleDay {
    calendarDate: string;
    usable: boolean;
}

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const keyOf = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    const key = toTourDateKey(value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '';
    const date = new Date(`${key}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === key ? key : '';
};
const offset = (key: string, days: number) => {
    const date = new Date(`${key}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
};
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];

function expectedNights(booking: ScheduleBooking) {
    const warnings: string[] = [...(booking.schedule?.warnings || [])];
    const start = keyOf(booking.startDate), end = keyOf(booking.endDate);
    if (!start || !end) return { needed: null, nights: [] as AccommodationNight[], warnings: unique([...warnings, '여행 시작일·종료일을 먼저 확인해 주세요.']) };
    const needed = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
    if (needed < 0 || needed > 100) return { needed: null, nights: [] as AccommodationNight[], warnings: unique([...warnings,
        needed < 0 ? '여행 종료일이 시작일보다 빠릅니다.' : '100박을 넘는 여행은 숙박 일정을 별도로 확인해 주세요.']) };
    const sourceDays = booking.schedule?.days || [];
    if (booking.schedule?.source === 'unavailable') warnings.push('고객 일정을 불러오지 못했습니다. 기존 배정을 유지하고 일정을 다시 확인해 주세요.');
    else if (!sourceDays.length) warnings.push('저장된 상세 일정이 없어 여행 기간을 기준으로 숙박 날짜를 표시합니다.');
    else if (sourceDays.length !== needed + 1) warnings.push(`예약은 ${needed + 1}일 여행이지만 일정표는 ${sourceDays.length}일입니다. 일정을 확인해 주세요.`);
    const nights: AccommodationNight[] = Array.from({ length: needed }, (_, index) => {
        const day = index + 1, matching = sourceDays.filter(item => Number(item.day) === day);
        const source = matching.length === 1 ? matching[0] : undefined;
        const calendarDate = offset(start, index), rawDate = text(source?.date);
        const date = source ? keyOf(rawDate) : calendarDate;
        const usable = matching.length <= 1 && !!date && date >= start && date < end && booking.schedule?.source !== 'unavailable';
        if (matching.length > 1) warnings.push(`고객 일정표에 ${day}일차가 중복되어 있습니다.`);
        if (source && !date) warnings.push(`고객 일정표 ${day}일차 날짜를 확인해 주세요.`);
        if (date && (date < start || date >= end)) warnings.push(`고객 일정표 ${day}일차(${date})가 숙박 가능한 여행 기간 밖입니다.`);
        return { day, date: date || rawDate, calendarDate, title: text(source?.title), region: text(source?.region), summary: text(source?.summary), usable };
    });
    for (const night of nights) {
        if (night.date && nights.filter(item => item.date === night.date).length > 1) {
            night.usable = false;
            warnings.push(`고객 일정표의 숙박 날짜 ${night.date}가 중복됩니다.`);
        }
    }
    return { needed, nights, warnings: unique(warnings) };
}

function dateAlignments(rows: AssignmentAccommodation[], nights: AccommodationNight[]) {
    const changes = new Map<number, AccommodationNight>();
    rows.forEach((row, index) => {
        const night = nights.find(item => item.day === Number(row.day));
        if (night?.usable && rows.filter(item => Number(item.day) === Number(row.day)).length === 1 && keyOf(row.date) !== night.date) changes.set(index, night);
    });
    // Retained outliers can occupy a target night. Remove dependent moves until no new date collides.
    let removed: boolean;
    do {
        removed = false;
        for (const [index, night] of changes) {
            if (rows.some((row, other) => other !== index && (changes.get(other)?.date || keyOf(row.date)) === night.date)) {
                changes.delete(index);
                removed = true;
            }
        }
    } while (removed);
    return changes;
}

/** Existing rows, including [], remain authoritative. Only absent rows get initial empty nights. */
export function initialAccommodationRows(booking: ScheduleBooking): AssignmentAccommodation[] {
    const { nights } = expectedNights(booking);
    if (!Array.isArray(booking.dailyAccommodations)) return nights.filter(night => night.usable).map(night => ({
        day: night.day, date: night.date, accommodation: night.region ? { location: night.region, region: night.region } : {},
    }));
    return booking.dailyAccommodations.map(row => {
        const night = nights.find(item => item.day === Number(row.day));
        const savedDate = keyOf(row.date);
        if (savedDate && savedDate !== row.date) return { ...row, date: savedDate };
        return !text(row.date) && night?.usable ? { ...row, date: night.date } : row;
    });
}

/** Diagnose against required nights, never against the number of rows someone happened to save. */
export function getAccommodationPlan(booking: ScheduleBooking) {
    const expected = expectedNights(booking), { nights, needed } = expected;
    const rows = initialAccommodationRows(booking);
    const warnings = [...expected.warnings], rowWarnings: string[][] = rows.map(() => []);
    rows.forEach((row, index) => {
        const messages = rowWarnings[index], day = Number(row.day), date = keyOf(row.date);
        const night = nights.find(item => item.day === day);
        if (!Number.isInteger(day) || day < 1) messages.push('일차 번호를 확인해 주세요.');
        else if (needed !== null && !night) messages.push(`${day}일차는 숙박 범위 밖입니다. 귀국일에는 숙박 행이 필요하지 않습니다.`);
        if (rows.filter(item => Number(item.day) === day).length > 1) messages.push(`${day}일차 숙박 행이 중복됩니다.`);
        if (text(row.date) && !date) messages.push('유효하지 않은 숙박 날짜입니다.');
        if (night?.usable && date !== night.date) messages.push(`고객 일정은 ${night.date}입니다. 저장된 숙박 날짜를 확인해 주세요.`);
        if (date && rows.filter(item => keyOf(item.date) === date).length > 1) messages.push(`${date} 숙박 날짜가 중복됩니다.`);
        if (messages.length) warnings.push(...messages.map(message => `${day || '?'}일차: ${message}`));
    });
    const missingNights = nights.filter(night => !rows.some(row => Number(row.day) === night.day));
    const addableNights = missingNights.filter(night => night.usable && !rows.some(row => keyOf(row.date) === night.date));
    if (missingNights.length) warnings.push(`필요한 ${needed}박 중 ${missingNights.length}개 일차의 숙박 행이 없습니다.`);
    const validForNight = (night: AccommodationNight) => {
        const matches = rows.map((row, index) => ({ row, index })).filter(({ row }) => Number(row.day) === night.day);
        return night.usable && matches.length === 1 && !rowWarnings[matches[0].index].length ? matches[0].row : undefined;
    };
    const assigned = nights.filter(night => text(validForNight(night)?.accommodation?.name)).length;
    const confirmed = nights.filter(night => {
        const row = validForNight(night);
        return text(row?.accommodation?.name) && row?.accommodation?.bookingStatus === 'Баталгаажсан';
    }).length;
    const canAlignDates = dateAlignments(rows, nights).size > 0;
    const complete = needed !== null && confirmed === needed && rows.length === needed && rowWarnings.every(messages => !messages.length)
        && nights.every(night => night.usable) && booking.schedule?.source !== 'unavailable';
    return { nights, rows, needed, missingNights, addableNights, warnings: unique(warnings), rowWarnings, assigned, confirmed, complete, canAlignDates };
}

/** Explicitly append only safe missing nights; never replace or reorder existing supplier bookings. */
export function addMissingAccommodationNights(booking: ScheduleBooking): AssignmentAccommodation[] {
    const plan = getAccommodationPlan(booking);
    const rows = Array.isArray(booking.dailyAccommodations) ? booking.dailyAccommodations : [];
    return [...rows, ...plan.addableNights.map(night => ({ day: night.day, date: night.date,
        accommodation: night.region ? { location: night.region, region: night.region } : {},
    }))];
}

/** Explicit date alignment keeps day IDs/supplier details. Changed reserved dates require confirmation again. */
export function alignAccommodationDates(booking: ScheduleBooking): AssignmentAccommodation[] {
    const plan = getAccommodationPlan(booking);
    const rows = Array.isArray(booking.dailyAccommodations) ? booking.dailyAccommodations : [];
    const changes = dateAlignments(rows, plan.nights);
    return rows.map((row, index) => {
        const night = changes.get(index);
        if (!night) return row;
        return { ...row, date: night.date, accommodation: { ...row.accommodation,
            ...(text(row.date) ? { bookingStatus: 'Илгээгээгүй' } : {}),
        } };
    });
}
