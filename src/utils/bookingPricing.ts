import type { TourPricingOption } from '../types/product';

type Row = Record<string, unknown>;
export interface BookingPricing {
    priceBreakdown: { total: number; deposit: number; local: number };
    baseOption: TourPricingOption;
    selectedAccomId: string;
    selectedVehicleId: string;
}

const object = (value: unknown): Row => value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
const field = (row: Row, camel: string, snake: string): unknown => row[camel] !== undefined ? row[camel] : row[snake];
const fail = (label: string): never => { throw new Error(`${label} 정보를 확인할 수 없습니다. 상품의 가격·옵션을 다시 확인해 주세요.`); };
const money = (value: unknown, label: string, signed = false): number => {
    if (typeof value !== 'number' && !(typeof value === 'string' && /^-?\d+$/.test(value.trim()))) return fail(label);
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || (!signed && amount < 0)) return fail(label);
    return amount;
};
const list = (value: unknown, label: string): Row[] => {
    if (value === undefined || value === null) return [];
    let decoded = value;
    if (typeof decoded === 'string') {
        try { decoded = JSON.parse(decoded); } catch { return fail(label); }
    }
    if (!Array.isArray(decoded) || decoded.some(row => !row || typeof row !== 'object' || Array.isArray(row))) return fail(label);
    return decoded as Row[];
};
const checked = (value: number, label: string): number => Number.isSafeInteger(value) && value >= 0 ? value : fail(label);

/** One product quote for both booking steps and the server. No stored reservation is repriced here. */
export function resolveBookingPricing(product: unknown, totalPeople: number, selectedAccomId?: string, selectedVehicleId?: string): BookingPricing {
    if (!Number.isSafeInteger(totalPeople) || totalPeople <= 0) return fail('예약 인원');
    const source = object(product);
    const tiers = list(field(source, 'pricingOptions', 'pricing_options'), '인원별 가격');
    if (!tiers.length) return fail('인원별 가격');
    const sorted = tiers.map(row => ({ row, people: money(row.people, '인원별 가격') })).sort((a, b) => a.people - b.people);
    if (sorted.some((entry, index) => entry.people <= 0 || (index > 0 && entry.people === sorted[index - 1].people))) return fail('인원별 가격');
    const selected = sorted.find(entry => entry.people === totalPeople)
        ?? [...sorted].reverse().find(entry => entry.people <= totalPeople) ?? sorted[0];
    const unitTotal = money(field(selected.row, 'pricePerPerson', 'price_per_person'), '1인 여행 금액');
    const rawDeposit = field(selected.row, 'depositPerPerson', 'deposit_per_person');
    let unitDeposit: number;
    if (rawDeposit !== undefined) unitDeposit = money(rawDeposit, '1인 예약금');
    else {
        const unitLocal = money(field(selected.row, 'localPaymentPerPerson', 'local_payment_per_person'), '1인 현지 잔금');
        if (unitLocal > unitTotal) return fail('1인 현지 잔금');
        unitDeposit = unitTotal - unitLocal;
    }

    const option = (value: unknown, id: string | undefined, label: string): { id: string; modifier: number } => {
        const options = list(value, label);
        if (id !== undefined && typeof id !== 'string') return fail(label);
        if (!options.length) {
            if (id) return fail(label);
            return { id: '', modifier: 0 };
        }
        const row = id ? options.find(entry => entry.id === id) : options.find(entry => field(entry, 'isDefault', 'is_default') === true || field(entry, 'isDefault', 'is_default') === 1) ?? options[0];
        if (!row || typeof row.id !== 'string' || !row.id || options.filter(entry => entry.id === row.id).length !== 1) return fail(label);
        return { id: row.id, modifier: money(field(row, 'priceModifier', 'price_modifier'), label, true) };
    };
    const accommodation = option(field(source, 'accommodationOptions', 'accommodation_options'), selectedAccomId, '숙소 옵션');
    const vehicle = option(field(source, 'vehicleOptions', 'vehicle_options'), selectedVehicleId, '차량 옵션');
    const baseTotal = checked(unitTotal * totalPeople, '총 여행 금액');
    const configuredDeposit = checked(unitDeposit * totalPeople, '예약금');
    const exactTotal = BigInt(baseTotal) + BigInt(accommodation.modifier) + BigInt(vehicle.modifier);
    if (exactTotal < 0n || exactTotal > BigInt(Number.MAX_SAFE_INTEGER)) return fail('총 여행 금액');
    const total = Number(exactTotal);
    const deposit = Math.min(configuredDeposit, total);
    return {
        priceBreakdown: { total, deposit, local: total - deposit },
        baseOption: { people: selected.people, pricePerPerson: unitTotal, depositPerPerson: unitDeposit, localPaymentPerPerson: Math.max(0, unitTotal - unitDeposit) },
        selectedAccomId: accommodation.id,
        selectedVehicleId: vehicle.id,
    };
}
