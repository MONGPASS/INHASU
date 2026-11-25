/**
 * 홈 새 디자인(2026-11-25)의 고정 문구·사진·링크. PC·휴대폰 홈이 함께 쓴다.
 * 상품·후기·매거진·기획전 배너는 여기 없다 — 관리자에 등록한 실제 자료를 읽는다.
 */
import { KAKAO_CHANNEL_CHAT_URL, KAKAO_CHANNEL_URL } from '../../constants/company';

const IMG = '/img/home/v2';
export const HOME_IMG = {
    steppeRiders: `${IMG}/steppe-riders.jpg`,
    steppeGallop: `${IMG}/steppe-gallop.jpg`,
    camelRider: `${IMG}/camel-rider.jpg`,
    miniDesert: `${IMG}/mini-desert-camels.jpg`,
    winterGer: `${IMG}/winter-ger-stars.jpg`,
    winterLake: `${IMG}/winter-lake.jpg`,
    winterForest: `${IMG}/winter-forest-ride.jpg`,
    /** ‘지금 떠나기 좋은 몽골 투어’ 제목 옆 금색 트로피(오너가 준 SVG). */
    trophy: `${IMG}/icons/trophy.svg`,
} as const;

/** 상품을 테마로 묶는 낱말(상품 이름·분류·태그에서 찾는다). 분류 체계가 바뀌어도 이름에 낱말이 있으면 묶인다. */
export const THEME_WORDS = {
    winter: ['겨울', '은하수', '설원', '눈'],
    ride: ['승마', '말타기', '초원질주', '초원'],
    desert: ['사막', '낙타', '고비'],
} as const;
export type ThemeKey = keyof typeof THEME_WORDS;

export interface ThemeProductLike { name: string; category: string; tags: string[] }
export const inTheme = (p: ThemeProductLike, theme: ThemeKey) => {
    const text = [p.name, p.category, ...(p.tags || [])].join(' ');
    return THEME_WORDS[theme].some((word) => text.includes(word));
};

/** 테마 줄 2개: 왼쪽·오른쪽 큰 사진 + 상품 3개. 상품이 없으면 맞춤 견적 안내를 보여 준다. */
/** 테마 줄 2개의 기본값. 관리자가 ‘홈 화면 관리’에서 문구·사진·카테고리를 바꾼다(homeSettings.ts). */
export const THEME_ROWS: Array<{ theme: ThemeKey; title: string; sub: string; image: string; imageAlt: string; link: string }> = [
    { theme: 'winter', title: '지금 떠나기 좋은 겨울 몽골', sub: '눈 덮인 초원과 은하수를 만나는 겨울 코스', image: HOME_IMG.miniDesert, imageAlt: '낙타를 타고 있는 여행자들', link: '/products' },
    { theme: 'ride', title: '#초원질주 #몽골 승마 투어', sub: '대초원을 말로 달리는 가장 몽골다운 방법', image: HOME_IMG.steppeGallop, imageAlt: '초원에서 말을 타고 달리는 여행자들', link: '/products' },
];

/** 혜택 안내 띠(넘겨 보는 3장). titleShort는 휴대폰용 짧은 제목. */
export const BENEFIT_BANDS: Array<{ title: string; titleShort: string; tags: string; image: string; image2: string; alt: string; link: string }> = [
    { title: '맞춤 견적은 무료예요\n원하는 일정과 인원만 알려주세요', titleShort: '맞춤 견적은 무료예요\n원하는 일정만 알려주세요', tags: '#한국어 상담 #24시간 안에 답변', image: HOME_IMG.steppeRiders, image2: HOME_IMG.camelRider, alt: '초원에서 말을 타는 여행자들', link: '/custom-estimate' },
    { title: '겨울 은하수 투어 예약 받고 있어요\n별이 쏟아지는 몽골의 겨울 밤', titleShort: '겨울 은하수 투어\n예약 받고 있어요', tags: '#테를지 #대자연 #2박 3일부터', image: HOME_IMG.winterGer, image2: HOME_IMG.winterLake, alt: '은하수 아래 눈 덮인 게르', link: '/products' },
    { title: '함께 떠날 동행을 찾아보세요\n여행 경비는 나누고 추억은 두 배로', titleShort: '함께 떠날 동행을\n찾아보세요', tags: '#동행 찾기 #혼자여도 괜찮아요', image: HOME_IMG.miniDesert, image2: HOME_IMG.winterForest, alt: '낙타를 타고 있는 여행자들', link: '/travel-mates' },
];

/** 휴대폰 홈 기획전 아래의 여행 약속 3가지. */
export const HOME_PROMISES: Array<{ icon: string; title: string; sub: string }> = [
    { icon: 'chatLines', title: '한국어 가이드', sub: '처음부터 끝까지' },
    { icon: 'mapPin', title: '현지 여행사', sub: '울란바토르 본사' },
    { icon: 'clock', title: '24시간 답변', sub: '맞춤 견적 무료' },
];

/** 검색창 안내 문구(PC·휴대폰 공통). */
export const SEARCH_PLACEHOLDER = '겨울 은하수 투어 예약 받고 있어요';

/** 이달의 추천 PICK 왼쪽 탭. */
export const PICK_TABS: Array<{ id: 'all' | ThemeKey; label: string; image: string }> = [
    { id: 'all', label: '전체', image: HOME_IMG.steppeGallop },
    { id: 'winter', label: '겨울 한정', image: HOME_IMG.winterGer },
    { id: 'ride', label: '초원 승마', image: HOME_IMG.steppeRiders },
    { id: 'desert', label: '미니사막', image: HOME_IMG.miniDesert },
];

/** 영상 PLAY LIST의 기본값. 관리자가 ‘홈 화면 관리 → 영상 PLAY LIST’에서 링크·제목을 정한다(homeSettings.ts). */
export const HOME_VIDEOS: Array<{ title: string; tags: string; image: string; alt: string; url: string }> = [
    { title: '초원을 달리는 몽골 승마 투어', tags: '#초원질주 #승마', image: HOME_IMG.steppeRiders, alt: '초원 승마 영상', url: '' },
    { title: '게르에서 만나는 겨울 은하수', tags: '#겨울 은하수 #게르', image: HOME_IMG.winterGer, alt: '은하수 게르 영상', url: '' },
    { title: '미니사막 낙타체험과 모래썰매', tags: '#미니사막 #낙타체험', image: HOME_IMG.miniDesert, alt: '미니사막 낙타체험 영상', url: '' },
    { title: '눈 덮인 테를지의 겨울', tags: '#테를지 #겨울 여행', image: HOME_IMG.winterLake, alt: '테를지 겨울 영상', url: '' },
];

/** 소셜 채널. 주소가 비어 있는 채널은 ‘준비 중’으로 보이고 눌리지 않는다 — 주소가 정해지면 url만 채운다. */
/** 아이콘은 오너가 준 그림(60×60 PNG, public/img/home/v2/social/). */
export const SOCIAL_CHANNELS: Array<{ id: string; label: string; image: string; url: string }> = [
    { id: 'kakao', label: '카카오톡 채널', image: `${IMG}/social/kakao.png`, url: KAKAO_CHANNEL_URL },
    { id: 'instagram', label: '인스타그램', image: `${IMG}/social/instagram.png`, url: 'https://www.instagram.com/mongolia_inhasu/' },
    { id: 'facebook', label: '페이스북', image: `${IMG}/social/facebook.png`, url: 'https://www.facebook.com/mongoliasky.co.kr/' },
    { id: 'blog', label: '블로그', image: `${IMG}/social/blog.png`, url: 'https://blog.naver.com/tulgabolor2' },
    { id: 'youtube', label: '유튜브', image: `${IMG}/social/youtube.png`, url: 'https://www.youtube.com/@mongolia_inhasu' },
];

/** 문의 카드 2장. */
export const CONTACT_CARDS = {
    kakao: { title: 'CONTACT US', text: '예약과 문의는 은하수 투어 카카오톡으로\n쉽고 편하게 확인해 보세요', button: '카카오톡 상담', url: KAKAO_CHANNEL_CHAT_URL, image: HOME_IMG.steppeRiders, alt: '초원 풍경' },
    estimate: { title: '맞춤 여행 문의', text: '몽골 여행, 아직도 일일이\n직접 예약하고 계세요?', button: '나에게 맞는 맞춤 여행', path: '/custom-estimate', image: HOME_IMG.miniDesert, alt: '미니사막 풍경' },
} as const;

/** 협력 업체 로고(오너가 준 그림을 여백을 잘라 높이 120px WebP로 줄임, public/img/home/v2/partners/). 홈 아래쪽에서 옆으로 흐른다. */
export const PARTNERS: Array<{ name: string; image: string }> = [
    { name: '고려대학교안암병원', image: `${IMG}/partners/ku-anam.webp` },
    { name: '한국교통안전공단', image: `${IMG}/partners/ts.webp` },
    { name: '에어비자', image: `${IMG}/partners/airvisa.webp` },
    { name: '드림여성산악회', image: `${IMG}/partners/dream-alpine.webp` },
    { name: '다임스텍', image: `${IMG}/partners/dymstec.webp` },
    { name: 'KIAST', image: `${IMG}/partners/kiast.webp` },
    { name: 'ain global', image: `${IMG}/partners/ain-global.webp` },
    { name: 'X CREW', image: `${IMG}/partners/xcrew.webp` },
    { name: 'Mongolian Disciple Church', image: `${IMG}/partners/mongolian-disciple-church.webp` },
    { name: '안현교회', image: `${IMG}/partners/anhyun-church.webp` },
    { name: '한국문화역사지리학회', image: `${IMG}/partners/kchg.webp` },
    { name: '국토교통부', image: `${IMG}/partners/molit.webp` },
    { name: '제주특별자치도', image: `${IMG}/partners/jeju.webp` },
];

/** 매거진 카드 아래쪽을 덮는 색(카드마다 돌려 쓴다). */
export const MAGAZINE_TINTS = ['47,93,58', '46,108,138', '43,46,92', '84,110,46'] as const;

/** 상단 검색창의 추천 검색어(순서대로 번호가 붙는다). */
export const RECOMMENDED_WORDS = ['온천', '고비사막', '승마 여행', '별밤 투어', '홉스골', '테를지', '중앙몽골', '겨울 은하수 투어'] as const;
