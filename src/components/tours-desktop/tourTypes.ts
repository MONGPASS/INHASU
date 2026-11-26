/** 투어 목록(PC·휴대폰)이 함께 쓰는 상품 구분 값. */

/** 상품 구분별 숙박 안내(디자인 ‘투어 상품’). PC 목록 카드는 끝에 ‘숙박’을 붙인다. */
export const TOUR_STAY: Record<'full' | 'value', string> = {
    full: '4성급 호텔 + 디럭스 게르',
    value: '3성급 호텔 + 스탠다드 게르',
};

/**
 * 빈 목록의 ‘맞춤 견적 요청’이 고른 상품 구분의 숙박을 견적 폼에 미리 넣는다(?stay=).
 * 값은 견적 폼(estimate-desktop/quoteForm.ts의 ACCOMMODATIONS)과 일치해야 선택된다.
 * 견적 폼이 일본어 값·한국어 값 어느 쪽이어도 맞도록 두 표기를 함께 보낸다(모르는 값은 견적 폼이 버린다).
 */
const QUOTE_STAYS: Record<'full' | 'value', string[]> = {
    full: ['4성급 호텔', '디럭스 게르', '4つ星ホテル', 'デラックスゲル'],
    value: ['3성급 호텔', '스탠다드 게르', '3つ星ホテル', 'スタンダードゲル'],
};
export const tourQuotePath = (type: 'full' | 'value' | '') =>
    type ? `/custom-estimate?stay=${encodeURIComponent(QUOTE_STAYS[type].join(','))}` : '/custom-estimate';
