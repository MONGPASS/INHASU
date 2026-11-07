// 몽골리아 은하수 — company-wide constants used across the site, mails and legal documents.
// Change here to update everywhere.

/** 브랜드 표기. 화면·메일·문서의 회사명은 이 값을 쓴다. */
export const BRAND = {
    name: '몽골리아 은하수',
    nameEn: 'Mongolia Milky Way',
    tagline: '몽골 여행·몽골 투어 전문',
    siteUrl: 'https://mongolia-milkyway.com',
    domain: 'mongolia-milkyway.com',
} as const;

/** 고객 상담 채널 — 카카오톡 채널. 채팅 바로가기는 `${KAKAO_CHANNEL_URL}/chat`. */
export const KAKAO_CHANNEL_URL = 'https://pf.kakao.com/_BSLaxl';
export const KAKAO_CHANNEL_CHAT_URL = `${KAKAO_CHANNEL_URL}/chat`;

/** 예약금 입금 계좌 (견적 시스템 public/booking.js 의 기본 계좌와 같은 값). */
export const DEPOSIT_ACCOUNT = {
    bank: '우리은행',
    number: '1002-245-516496',
    holder: 'DAVAASUREN (헬로볼라)',
} as const;

/** 상품 편집기의 1인 예약금. 1인 총가격이 더 낮으면 그 금액까지만 받는다. */
export const PRODUCT_DEPOSIT_PER_PERSON = 50000;

export const COMPANY_INFO = {
    nameJa: '몽골리아 은하수',
    nameEn: 'Mongolia Milky Way',
    nameLegal: 'Mongolia Milky Way (SUUN ZAM)',  // 상호(등록명)
    phoneKR: '+976-9594-5838',
    phoneMGL: '976-9594-5838',
    phoneSecondary: '+976-8010-7766',     // 현지 사무소 제2 연락처
    representative: 'DAVAASUREN BOLOR',  // 담당자 (대리)
    ceo: 'DAVAASUREN BILGUUN',           // 대표자
    registrationNumber: '9011640064',     // 사업자 등록번호
    tourRegistrationNumber: '6124313',    // 관광사업 등록번호
    registrationNote: 'Сүүнзам трэйд',
    addressJa: '울란바토르 바양주르흐구 13동 DACO센터 3층 306호',
    email: 'bolor1@hanmail.net',
    website: 'mongolia-milkyway.com',
    stampImage: '/stamp.png',             // place the stamp image at public/stamp.png
};

// 주몽골 대한민국 대사관 — 확정 일정표의 해외 안전 정보에 사용 (견적서의 안내와 같은 값)
export const EMBASSY_INFO = {
    nameJa: '주몽골 대한민국 대사관',
    addressJa: 'Mahatma Gandhi street-39, Khan-Uul district-15, Ulaanbaatar-17011, Mongolia',
    phone: '+976-7007-1020',              // 대표 전화(근무시간)
    emergencyPhone: '+976-9911-4119',     // 긴급(24시간)
    email: 'kormg@mofa.go.kr',
};

// 현지 긴급 신고처 — 몽골 국내
export const LOCAL_EMERGENCY: Array<{ label: string; number: string }> = [
    { label: '경찰', number: '102' },
    { label: '소방', number: '101' },
    { label: '구급차', number: '103' },
    { label: '재난·긴급', number: '105' },
];

/** 예약금은 숙박 시설의 선결제금으로 쓰이므로 취소 시에도 환불하지 않는다(오너 방침). */
export const DEPOSIT_POLICY = '예약금은 호텔 및 숙박 시설의 선결제금으로 사용되므로, 일정을 취소하시는 경우 전액 환불되지 않는 점 미리 양해해 주시기 바랍니다.';

export interface CancellationRow {
    period: string;
    fee: string;
}

/**
 * 계약서의 취소 규정(오너 방침 2026-10). 예약금은 숙박 시설의 선결제금이므로 환불 불가,
 * 잔금은 현지에서 결제하므로 여행 개시 전 취소 시에는 발생하지 않는다.
 */
export const CONTRACT_CANCELLATION_ROWS: CancellationRow[] = [
    { period: '예약금', fee: '취소 시기와 관계없이 환불 불가' },
    { period: '잔금(현지 결제)', fee: '여행 개시 전에 취소하시는 경우 결제하실 필요가 없습니다' },
    { period: '여행 개시 후 취소·중도 이탈', fee: '환불되지 않습니다' },
];

/**
 * Default tables earlier versions seeded templates with: the percentage table, then the one that still listed a bank-transferred balance,
 * then the Japanese wording of the current rules (the default before the Korean version).
 * 아래 일본어는 DB에 저장된 옛 템플릿 값과 비교하는 용도이므로 번역하지 않는다.
 */
const LEGACY_CANCELLATION_TABLES: CancellationRow[][] = [
    [
        { period: '予約金', fee: 'キャンセルの時期にかかわらず返金不可' },
        { period: '残金（現地払い）', fee: '旅行開始前のキャンセルの場合、お支払いは不要です' },
        { period: '旅行開始後のキャンセル・途中離団', fee: '返金はありません' },
    ],
    [
        { period: '30日〜15日前まで', fee: '旅行代金の10%' },
        { period: '14日〜8日前まで', fee: '旅行代金の20%' },
        { period: '7日〜3日前まで', fee: '旅行代金の30%' },
        { period: '2日前〜当日', fee: '旅行代金の50%' },
        { period: '無連絡不参加', fee: '旅行代金の100%' },
    ],
    [
        { period: '予約金', fee: 'キャンセルの時期にかかわらず返金不可' },
        { period: '残金（現地払い）', fee: '旅行開始前のキャンセルの場合、お支払いは不要です' },
        { period: '残金（事前お振込み済み）', fee: '旅行開始前のキャンセルの場合、全額返金（振込手数料はお客様負担）' },
        { period: '旅行開始後のキャンセル・途中離団', fee: '返金はありません' },
    ],
];

/**
 * Saved templates carry a copy of whatever the default table was when they were saved.
 * An untouched copy of an earlier default table is replaced by the current rules; a table the
 * admin edited is kept as is.
 */
export const resolveCancellationRows = (rows: unknown): CancellationRow[] => {
    if (!Array.isArray(rows) || rows.length === 0) return CONTRACT_CANCELLATION_ROWS;
    const list = rows as CancellationRow[];
    const untouchedLegacy = LEGACY_CANCELLATION_TABLES.some((legacy) => list.length === legacy.length
        && list.every((r, i) => r?.period === legacy[i].period && r?.fee === legacy[i].fee));
    return untouchedLegacy ? CONTRACT_CANCELLATION_ROWS : list;
};

/**
 * 예약금 결제 방법. 한국어 통합 플랫폼에서는 계좌이체로 받고, 고객이 입금 후 '입금 완료'를 신고한다.
 * 예전 템플릿에 저장된 값('銀行振込', 'PayPal')도 현재 방침인 계좌이체로 바꿔 보여 준다.
 */
export const DEPOSIT_PAYMENT_METHOD = '계좌이체';

export const resolveDepositMethod = (saved: unknown): string => {
    const value = typeof saved === 'string' ? saved.trim() : '';
    return !value || value === '銀行振込' || /^paypal$/i.test(value) ? DEPOSIT_PAYMENT_METHOD : value;
};

export const CONTRACT_NOTICES = [
    '여행 중 고객 본인의 과실로 사고가 발생한 경우, 여행사에는 일체의 책임 및 손해배상 책임이 없음을 미리 양해해 주시기 바랍니다.',
    '여행 중에는 날씨 상황이나 도심 교통 체증 등으로 패키지 일정이 변경될 수 있습니다. 이 경우 현지 가이드의 판단에 따라 안내해 드립니다.',
    '승마 체험과 낙타 체험은 각각 1회씩 포함되어 있으며, 추가 체험을 원하시면 현지에서 추가 요금을 내고 이용하실 수 있습니다. 또한 박물관이나 각종 문화 시설을 추가로 이용하시는 경우 별도의 입장료가 발생할 수 있습니다.',
    DEPOSIT_POLICY,
    '잔금은 현지에서 현금으로 결제해 주시기 바랍니다.',
];

export const PRIVACY_NOTICES = [
    '수집 및 이용 목적: 숙박 예약 및 예약금 현금영수증 발행',
    '수집 및 이용 항목: 성명, 휴대전화 번호',
    '보유 및 이용 기간: 처리 완료 후 3개월간 보관',
    '개인정보 수집 및 이용에 동의하시는 경우에만 연락처를 기재해 주세요. 동의하지 않으시면 연락처를 기재하지 않으셔도 되지만, 이 경우 현금영수증은 발행해 드릴 수 없습니다.',
];

export const OTHER_NOTICES = [
    '추가 안내 사항이 있는 경우 여행자에게 별도로 안내해 드립니다.',
    '예약금이 입금되면 본 계약서는 효력이 발생합니다.',
    '추가 옵션(에어베드 등)은 사전에 예약 가능 여부를 확인하신 뒤, 출발 7일 전까지 홈페이지 > 체크포인트 > 옵션 상품에서 신청하시고 함께 연락해 주시기 바랍니다.',
];
