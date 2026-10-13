import iconMates from '../../assets/mobile/my-icons/mates.webp';
import iconQuotes from '../../assets/mobile/my-icons/quotes.webp';
import iconWish from '../../assets/mobile/my-icons/wish.webp';
import iconRecent from '../../assets/mobile/my-icons/recent.webp';
import iconReviews from '../../assets/mobile/my-icons/reviews.webp';
import iconFaq from '../../assets/mobile/my-icons/faq.webp';
import iconContact from '../../assets/mobile/my-icons/contact.webp';

/** Rows whose badge shows a live count from the my page data. */
export type MyCountKey = 'mates' | 'quotes' | 'wish' | 'recent' | 'reviews';

export interface MyMenuItem {
    key: string;
    label: string;
    sub?: string;
    path: string;
    icon: string;
    count?: MyCountKey;
}

/** The three menu cards of the mobile my page (3D icons from the design, shown at 44px). */
export const MY_MENU: Array<{ title: string; items: MyMenuItem[] }> = [
    {
        title: '내 활동',
        items: [
            { key: 'mates', label: '동행 찾기 글', sub: '등록한 글 확인', path: '/mypage/travel-mates', icon: iconMates, count: 'mates' },
            { key: 'quotes', label: '견적 내역', sub: '보낸 요청과 답변', path: '/mypage/estimates', icon: iconQuotes, count: 'quotes' },
        ],
    },
    {
        title: '찜 목록',
        items: [
            { key: 'wish', label: '찜한 상품', path: '/mypage/wishlist', icon: iconWish, count: 'wish' },
            { key: 'recent', label: '최근 본 상품', path: '/mypage/recently-viewed', icon: iconRecent, count: 'recent' },
            { key: 'reviews', label: '내 후기', path: '/mypage/reviews', icon: iconReviews, count: 'reviews' },
        ],
    },
    {
        title: '고객 지원',
        items: [
            { key: 'faq', label: 'FAQ', sub: '자주 묻는 질문', path: '/faq', icon: iconFaq },
            { key: 'contact', label: '문의', sub: '카카오톡·메일로 한국어 응대', path: '/contact', icon: iconContact },
        ],
    },
];
