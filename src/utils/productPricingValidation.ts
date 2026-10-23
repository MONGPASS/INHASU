import type { TourPricingOption } from '../types/product';

/** Keep an inconsistent administrator entry editable, but require correction before saving it. */
export function productPricingIssues(options: TourPricingOption[] | undefined): (string | null)[] {
    const rows = options ?? [];
    const amount = (value: unknown): number | null => {
        if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value.trim()))) return null;
        const parsed = Number(value);
        return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
    };
    return rows.map((row, index) => {
        const label = `${index + 1}번째 인원별 요금`;
        const people = amount(row?.people);
        if (people === null || people <= 0) return `${label}: 인원을 1명 이상의 정수로 입력해 주세요.`;
        if (rows.some((other, otherIndex) => otherIndex !== index && amount(other?.people) === people)) return `${label}: ${people}명 요금이 중복되어 있습니다.`;
        const price = amount(row.pricePerPerson), deposit = amount(row.depositPerPerson), local = amount(row.localPaymentPerPerson);
        if (price === null || deposit === null || local === null) return `${label}: 1인 총가격·예약금·현지 잔금을 0원 이상의 정수로 입력해 주세요.`;
        if (deposit > price) return `${label}: 1인 예약금이 1인 총가격보다 큽니다. 예약금을 확인해 주세요.`;
        if (local !== price - deposit) return `${label}: 1인 예약금과 현지 잔금의 합계가 1인 총가격과 같아야 합니다.`;
        return null;
    });
}
