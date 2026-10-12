export interface HighlightCardData {
    image: string;
    tags?: string[];
    title: string;
    description?: string;
    link?: string;
}

export interface HighlightSectionData {
    label: string;
    title: string;
    subtitle?: string;
    cards: HighlightCardData[];
}

export interface Category {
    id: string;
    name: string;
    icon: string;
    description: string;
    order: number;
    isActive: boolean;
    type?: 'product' | 'magazine'; // 'product' by default if undefined

    // Landing page content (customer-facing /category/:slug)
    landing_hero_image?: string;        // legacy single image (kept in sync with first slide)
    landing_hero_images?: string[];     // slider images
    landing_hero_tagline?: string;
    landing_hero_title?: string;
    landing_hero_subtitle?: string;
    landing_accent_color?: string;
    landing_highlights?: HighlightSectionData[];
    landing_product_grid_title?: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
    {
        id: 'all',
        name: '전체',
        icon: 'grid_view',
        description: '모든 여행 상품',
        order: 0,
        isActive: true,
        type: 'product'
    },
    {
        id: 'central',
        name: '중앙몽골',
        icon: 'landscape',
        description: '테를지, 울란바토르 주변',
        order: 1,
        isActive: true,
        type: 'product'
    },
    {
        id: 'gobi',
        name: '고비사막',
        icon: 'wb_sunny',
        description: '고비 사막 투어',
        order: 2,
        isActive: true,
        type: 'product'
    },
    {
        id: 'khuvsgul',
        name: '홉스굴',
        icon: 'water',
        description: '몽골의 푸른 진주',
        order: 3,
        isActive: true,
        type: 'product'
    },
    {
        id: 'trekking',
        name: '트레킹/골프',
        icon: 'hiking',
        description: '트레킹 및 골프 투어',
        order: 4,
        isActive: true,
        type: 'product'
    },
    {
        id: 'corporate',
        name: '기업/단체',
        icon: 'groups',
        description: '기업 및 단체 여행',
        order: 5,
        isActive: true,
        type: 'product'
    }
];

export const DEFAULT_MAGAZINE_CATEGORIES: Category[] = [
    {
        id: 'mag-info',
        name: '몽골 기본 정보',
        icon: 'info',
        description: '환전, 유심, 날씨 등',
        order: 0,
        isActive: true,
        type: 'magazine'
    },
    {
        id: 'mag-tips',
        name: '여행 팁',
        icon: 'lightbulb',
        description: '준비물, 주의사항',
        order: 1,
        isActive: true,
        type: 'magazine'
    },
    {
        id: 'mag-local',
        name: '지역별 가이드',
        icon: 'map',
        description: '각 지역별 상세 정보',
        order: 2,
        isActive: true,
        type: 'magazine'
    },
    {
        id: 'mag-culture',
        name: '문화와 음식',
        icon: 'restaurant',
        description: '몽골의 식문화와 전통',
        order: 3,
        isActive: true,
        type: 'magazine'
    }
];
