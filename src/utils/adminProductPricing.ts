import type { TourProduct } from '../types/product';
import { PRODUCT_DEPOSIT_PER_PERSON } from '../constants/company.ts';
import { getProductStartingPrice } from './productStartingPrice.ts';

/**
 * 상품 편집·초안 복원·저장 경계에서만 사용하는 가격 규칙.
 * 예약·견적 이력과 서버 원본은 변경하지 않는다. 잘못된 입력은 저장
 * 검증에서 안내할 수 있도록 그대로 남기고, 유효한 총가격만 계산한다.
 */
export function withAutomaticProductPricing<T extends Partial<TourProduct>>(form: T): T {
    let changed = false;
    const pricingOptions = Array.isArray(form.pricingOptions) ? form.pricingOptions.map(row => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) return row;
        const raw: unknown = row.pricePerPerson;
        if (typeof raw !== 'number' && !(typeof raw === 'string' && /^\d+$/.test(raw.trim()))) return row;
        const price = Number(raw);
        if (!Number.isSafeInteger(price) || price < 0) return row;
        const deposit = Math.min(PRODUCT_DEPOSIT_PER_PERSON, price);
        const local = price - deposit;
        if (row.pricePerPerson === price && row.depositPerPerson === deposit && row.localPaymentPerPerson === local) return row;
        changed = true;
        return { ...row, pricePerPerson: price, depositPerPerson: deposit, localPaymentPerPerson: local };
    }) : form.pricingOptions;
    const starting = getProductStartingPrice({ pricingOptions });
    const price = starting.price ?? (form.price !== undefined ? 0 : undefined);
    if (form.price !== price) changed = true;
    return changed ? { ...form, pricingOptions, price } : form;
}
