/** 여행 타입: full = 풀패키지(4성급 호텔 + 디럭스 게르), value = 실속형(3성급 호텔 + 스탠다드 게르) */
export type PackageType = 'full' | 'value';

/** 선택 시점의 명소 정보. 라이브러리 수정·삭제 후에도 상품과 고객 문서에서 보존한다. */
export interface RepresentativeSpotSnapshot {
    name: string;
    nameMn?: string;
    short?: string;
    region?: string;
    desc?: string;
    img?: string;
    subImgs?: string[];
}

export interface TourProduct {
    id: string;

    // 기본 정보
    name: string;
    description?: string; // Short description or subtitle
    category: string; // '중앙몽골' | '고비사막' | '홉스굴' | '트레킹/골프' | '기업/단체'
    duration: string;

    // 가격 정보
    price: number;
    originalPrice?: number;

    // 이미지
    mainImages: string[]; // 메인 이미지들 (여러 개)
    galleryImages: string[];
    detailImages: string[]; // 상세 정보 이미지들 (레거시)
    detailSlides?: DetailSlide[]; // 슬라이드형 상세 정보 (레거시)
    detailBlocks?: DetailContentBlock[]; // 통합된 상세 컨텐츠 (이미지+슬라이드)
    itineraryImages: string[]; // 일정 이미지들 (레거시 - 단순 리스트)
    itineraryBlocks?: DetailContentBlock[]; // 통합된 일정 컨텐츠 (이미지+슬라이드)

    // 상태 및 노출
    status: 'active' | 'inactive' | 'soldout';
    isFeatured: boolean;
    isPopular?: boolean;
    packageType?: PackageType | null; // 여행 타입 — PC 투어 목록의 필터 카드


    // 상세 정보
    tags: string[];
    highlights: {
        icon: string;
        title: string;
        description: string;
    }[];
    representativeSpots?: RepresentativeSpotSnapshot[]; // 대표 명소: 판매 포인트 highlights와 별도 저장

    // 포함/불포함
    included: string[];
    excluded: string[];

    // 메타 정보
    createdAt: string;
    updatedAt: string;
    viewCount: number;
    bookingCount: number;

    // 옵션
    pricingOptions?: TourPricingOption[];
    accommodationOptions?: AccommodationOption[];
    vehicleOptions?: VehicleOption[];

    // 상품별 FAQ (관리자가 편집 가능). 비어 있으면 사이트 공통 기본 FAQ가 표시됨.
    faqs?: ProductFAQ[];
}

export interface ProductFAQ {
    q: string;
    a: string;
}

export interface TourPricingOption {
    people: number;         // 인원 수 (예: 2, 3, 4...)
    pricePerPerson: number; // 1인당 가격 (총 금액)
    depositPerPerson: number; // 1인당 예약금
    localPaymentPerPerson: number; // 1인당 현지 지불 잔금
}

export interface AccommodationOption {
    id: string;
    name: string;           // 숙소 이름 (예: "게르", "호텔")
    description: string;    // 설명
    imageUrl?: string;      // 이미지 (선택)
    priceModifier: number;  // 추가/할인 금액 (+50000, -20000 등)
    isDefault?: boolean;    // 기본 선택 여부
}

export interface VehicleOption {
    id: string;
    name: string;           // 차량 이름 (예: "봉고", "SUV")
    description: string;    // 설명
    priceModifier: number;  // 추가/할인 금액
    isDefault?: boolean;    // 기본 선택 여부
}

export interface DetailSlide {
    id: string;
    type: 'day' | 'option' | 'accommodation' | 'free'; // 슬라이드 종류
    dayLabel?: string;      // 예: "1-2일차", "옵션 A"
    title: string;          // 슬라이드 제목
    description?: string;   // 슬라이드 설명
    images: string[];       // 슬라이드 이미지들
}

export interface DividerContent {
    style: 'line' | 'space';
    height: number;
}

export interface TimelineContent {
    id: string;
    time?: string;
    title: string;
    description: string;
    images: string[];
    /** 강조 배지 문구 (예: 환전 / 장보기) — 있으면 설명이 배지 달린 강조 박스로 표시된다 */
    badge?: string;
}

export interface DayInfoContent {
    id: string;
    dayLabel: string;        // 일차 라벨 (예: "1일차", "DAY 1")
    dayDate?: string;        // 날짜 (예: "05/26(화)")
    title?: string;          // 일정 제목 (예: "인천, 울란바토르, 고르히-테렐지")
    description?: string;    // 주요 일정 요약
    meals?: {
        breakfast?: string;  // 조식 (예: "캠프식", "호텔 조식")
        lunch?: string;      // 중식 (예: "현지식")
        dinner?: string;     // 석식 (예: "캠프식")
    };
    accommodation?: string;  // 숙소 (예: "개별화장실과 샤워실이 구비된 디럭스게르")
    /**
     * Optional common lodging resource ID or legacy hotel ID. Set when the
     * admin picks from the picker modal instead of typing free-form text.
     * `accommodation` always holds the display name (snapshot), so historical
     * data survives even if the master entry is later edited or deleted.
     */
    accommodationHotelId?: string;
    /**
     * Hotel snapshot (images + description + address) captured at pick time.
     * Lets the user-facing page render a photo card under the accommodation
     * row without re-fetching from the hotels master. Survives master edits/
     * deletions just like `accommodation`.
     */
    accommodationImages?: string[];
    accommodationDescription?: string;
    accommodationAddress?: string;
    accommodationSubtitle?: string;  // hotels.name_local — small caption below the name
    /** 숙소 마스터의 편의시설 스냅샷 ('숙박 안내' 박스에 · 항목으로 표시) */
    accommodationAmenities?: string[];
    accommodationType?: string;
    accommodationRegion?: string;
    accommodationOccupancy?: string;
    accommodationRoomAmenities?: string[];
    accommodationSharedFacilities?: string[];
    /** 일정 상세 디자인의 히어로(배경) 사진 — 비우면 그 일차의 첫 사진이 자동으로 쓰인다 */
    heroImage?: string;
    /** 일정 상세 디자인의 카드 상단 사진 그리드(최대 5장) — 비우면 이미지 블록 사진이 쓰인다 */
    galleryImages?: string[];
}

export type DetailBlockType = 'image' | 'slide' | 'divider' | 'timeline' | 'dayInfo' | 'design';

/**
 * 'design' 블록: 코드에 내장된 디자인 템플릿(src/components/product/designTemplates)을
 * 렌더링한다. values는 템플릿 매니페스트의 field key → 관리자가 입력한 값(텍스트/이미지 URL).
 * 비어 있는 key는 매니페스트의 default가 사용된다.
 */
export interface DesignBlockContent {
    templateId: string;
    values: Record<string, string>;
    /**
     * 표시할 섹션 목록 (순서대로). 없으면 템플릿의 기본 섹션 전체를 한 번씩 표시.
     * 복제본은 id에 '#2' 같은 접미사가 붙고, 그 섹션의 입력값 key에도 같은 접미사가 붙는다.
     * 섹션을 삭제하면 이 목록에서 빠진다 (입력값은 남아 있어 다시 추가하면 복원됨).
     */
    sections?: DesignSectionInstance[];
}

export interface DesignSectionInstance {
    /** 인스턴스 고유 id — 원본은 def와 동일, 복제본은 `${def}#2` 형태 */
    id: string;
    /** 템플릿 섹션 id */
    def: string;
    /** true면 상세페이지에서 숨긴다 (관리자가 뺀 섹션 — 값은 남아 있어 복원 가능) */
    hidden?: boolean;
}

export interface DetailContentBlock {
    id: string;
    type: DetailBlockType;
    content: string | DetailSlide | DividerContent | TimelineContent | DayInfoContent | DesignBlockContent;
}

