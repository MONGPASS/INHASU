import heroImg from '../../assets/about/about-hero.webp';
import nightImg from '../../assets/about/about-night.webp';
import point1Img from '../../assets/about/about-point-1.webp';
import point2Img from '../../assets/about/about-point-2.webp';
import point3Img from '../../assets/about/about-point-3.webp';
import team1Img from '../../assets/about/about-team-1.webp';
import team2Img from '../../assets/about/about-team-2.webp';
import team3Img from '../../assets/about/about-team-3.webp';

/**
 * 회사 소개 (/about) — copy and data shared by the PC and mobile screens.
 * The Korean text is a translation of the owner's company introduction (Japanese in the
 * Claude Design source); keep its meaning when editing.
 */

export interface AboutImage {
    src: string;
    alt: string;
    /** Intrinsic size of the file, so the browser can reserve the box before it loads. */
    width: number;
    height: number;
}

export const ABOUT_HERO_IMAGE: AboutImage = {
    src: heroImg,
    alt: '칭기즈 칸 기마상 앞에서 포즈를 취한 몽골 여행 참가자들',
    width: 680,
    height: 382,
};

export const ABOUT_BAND_IMAGE: AboutImage = {
    src: nightImg,
    alt: '몽골의 초원과 숲에 늘어선 전통 가옥 게르',
    width: 1200,
    height: 801,
};

export const ABOUT_COPY = {
    heroEyebrow: 'ABOUT US',
    heroLines: ['몽골 현지 여행사', '‘몽골리아 은하수’'],
    scrollHint: 'SCROLL',
    kicker: '몽골 현지 여행사',
    philosophyGhost: 'PHILOSOPHY',
    philosophyTitle: '#여행 철학은?',
    philosophyBody: [
        '단순한 관광이 아니라, 몽골의 대자연과 온몸으로 교감하는 특별한 경험을 선사합니다.',
        '지친 일상에서 벗어나 몽골의 자연 속에서 새로운 나를 발견할 수 있도록 돕겠습니다.',
    ],
    bandText:
        '현지인만 아는 가장 몽골다운 여행지와 여행 패키지, 그리고 한국인 여행객의 정서에 맞춘 일정으로 어디에도 없는 구성의 여행을 선보입니다.',
    valuesTitle: '#여행의 가치관은?',
    valuesBody: '여행자의 안전과 편의를 최우선으로 생각하며, 여행자가 최고의 만족을 느낄 수 있도록 최선을 다하겠습니다.',
    promiseEyebrow: 'OUR PROMISE',
    promiseTitle: '우리가 지키는 3가지 약속',
    ctaEyebrow: 'CUSTOM TOUR',
    /** One entry per phrase, so a narrow box breaks the heading at the comma. */
    ctaTitle: ['나만의 몽골 여행을,\u00A0', '현지 스태프와 함께'],
    ctaQuote: '맞춤 견적',
    ctaTours: '투어 상품 보기',
    ctaKakao: '카카오톡 상담',
} as const;

/** Decorative words of the flowing band under the hero (hidden from assistive tech). */
export const ABOUT_MARQUEE = ['MONGOLIA', 'MILKY WAY', 'NOMAD', 'STEPPE', 'GOBI', 'STARLIGHT'] as const;

export interface AboutMember {
    no: string;
    name: string;
    role: string;
    image: AboutImage;
}

export const ABOUT_TEAM: AboutMember[] = [
    { no: '01', name: 'Bilguun', role: '대표', image: { src: team1Img, alt: '대표 Bilguun', width: 776, height: 764 } },
    { no: '02', name: 'Gantuu', role: '부대표', image: { src: team2Img, alt: '부대표 Gantuu', width: 768, height: 776 } },
    { no: '03', name: 'Bolor', role: '여행 디자이너', image: { src: team3Img, alt: '여행 디자이너 Bolor', width: 776, height: 437 } },
];

export interface AboutPoint {
    no: string;
    /** Heading, one entry per rising line. */
    title: string[];
    body: string[];
    image: AboutImage;
    /** PC: photo on the right, wiped in from the right edge. */
    flip: boolean;
}

export const ABOUT_POINTS: AboutPoint[] = [
    {
        no: '01',
        title: ['몽골 여행 패키지는', '몽골 사람이 기획해야 합니다.'],
        body: [
            '저희 여행사는 한국에서 호텔경영학과를 졸업하고 몽골에 살고 있는 대표와 부대표, 한 가족이 함께 세운 몽골 여행사입니다!',
            '현지인만 아는 가장 몽골다운 여행지와 한국인 여행객의 정서에 맞춘 일정으로, 어디에도 없는 구성의 여행을 기획합니다.',
        ],
        image: { src: point1Img, alt: '몽골 초원에서 승마 투어를 즐기는 여행자들', width: 1080, height: 1080 },
        flip: false,
    },
    {
        no: '02',
        title: ['합리적인 가격이 가장 중요합니다.'],
        body: [
            '현지인만으로 운영하는 여행사이기에 대형 여행사의 중간 유통 과정을 생략해 여행자의 불필요한 수수료 부담을 낮췄습니다.',
            '여행은 여행일 뿐! NO 쇼핑, NO 옵션으로 여행 중 추가로 발생하는 옵션 비용이 없습니다.',
        ],
        image: { src: point2Img, alt: '여행 경비를 계산기로 계산하는 모습', width: 1128, height: 752 },
        flip: true,
    },
    {
        no: '03',
        title: ['몽골 여행에 대한', '고정관념을 깨뜨립니다.'],
        body: [
            '유목민과 승마! 전통 가옥 게르! 이 모든 것을 체험하면서 호캉스까지 전부 가능합니다!',
            '전통 게르 체험은 물론, 깨끗하고 수준 높은 숙소와 쾌적한 차량, 깔끔하고 맛있는 식당을 중심으로 여행하게 됩니다!',
        ],
        image: { src: point3Img, alt: '깨끗하고 넓은 호텔 객실', width: 1128, height: 750 },
        flip: false,
    },
];

export interface AboutStar {
    left: number;
    top: number;
    size: number;
    /** Twinkle duration / start offset in seconds. */
    duration: number;
    delay: number;
}

/** The 16 twinkling dots over the hero photo (same positions and timing as the design). */
export const ABOUT_STARS: AboutStar[] = Array.from({ length: 16 }, (_, i) => ({
    left: (11 + i * 37) % 100,
    top: (7 + i * 53) % 70,
    size: 2 + (i % 3),
    duration: 2.4 + (i % 4) * 0.7,
    delay: Number((i * 0.37).toFixed(2)),
}));
