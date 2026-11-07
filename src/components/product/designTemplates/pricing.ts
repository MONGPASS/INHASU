import type { TourPricingOption } from '../../../types/product';
import { resolveBookingPricing } from '../../../utils/bookingPricing.ts';

/**
 * 상품 「가격/옵션」 탭의 인원별 가격을 디자인 템플릿 가격표(price_rows) 문자열로 변환.
 * 형식은 템플릿 표와 같다: 한 줄에 한 행, `참가 인원|예약금|잔금|1인 합계` (| 구분).
 * 등록된 인원별 가격은 예약 화면과 같은 계산을 사용한다. 잘못된 등록 금액은
 * 확인 필요로 표시하며, 템플릿의 예전 금액이나 샘플 금액으로 대체하지 않는다.
 * 인원별 가격이 하나도 없으면 undefined — 기존 직접 입력한 가격표를 유지한다.
 */
export function priceRowsFromOptions(options: TourPricingOption[] | undefined): string | undefined {
    const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;
    const rows = options ?? [];
    if (rows.length === 0) return undefined;
    return [...rows]
        .sort((a, b) => (a?.people ?? Infinity) - (b?.people ?? Infinity))
        .map(o => {
            try {
                // 이 표의 금액은 모두 1인 기준이며, 숙소·차량 선택 추가 요금은 제외한다.
                const people = Number(o.people);
                const { priceBreakdown, baseOption } = resolveBookingPricing({ pricingOptions: [o] }, people);
                return `${people}명일 때|${won(priceBreakdown.deposit / people)}|${won(priceBreakdown.local / people)}|${won(baseOption.pricePerPerson)}`;
            } catch {
                const people = Number.isSafeInteger(o?.people) && o.people > 0 ? `${o.people}명일 때` : '인원 확인 필요';
                return `${people}|요금 확인 필요|요금 확인 필요|요금 확인 필요`;
            }
        })
        .join('\n');
}
