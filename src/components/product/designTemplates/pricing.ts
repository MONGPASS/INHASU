import type { TourPricingOption } from '../../../types/product';

/**
 * 상품 「가격/옵션」 탭의 인원별 가격을 디자인 템플릿 가격표(price_rows) 문자열로 변환.
 * 형식은 템플릿 표와 같다: 한 줄에 한 행, `참가 인원|예약금|잔금|1인 합계` (| 구분).
 * 인원별 가격이 하나도 없으면 undefined — 템플릿에 직접 입력한 값/기본값이 그대로 쓰인다.
 */
export function priceRowsFromOptions(options: TourPricingOption[] | undefined): string | undefined {
    const won = (n: number) => `${Math.max(0, Math.round(n)).toLocaleString('ko-KR')}원`;
    const rows = (options ?? []).filter(
        o => o.people > 0 && (o.pricePerPerson > 0 || o.depositPerPerson > 0 || o.localPaymentPerPerson > 0),
    );
    if (rows.length === 0) return undefined;
    return [...rows]
        .sort((a, b) => a.people - b.people)
        .map(o => {
            const total = o.pricePerPerson > 0 ? o.pricePerPerson : o.depositPerPerson + o.localPaymentPerPerson;
            const local = o.localPaymentPerPerson > 0 ? o.localPaymentPerPerson : Math.max(total - o.depositPerPerson, 0);
            return `${o.people}명일 때|${won(o.depositPerPerson)}|${won(local)}|${won(total)}`;
        })
        .join('\n');
}
