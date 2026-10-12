/**
 * The six 이용 안내 / 회사 정보 pages that share the Info layout
 * (Claude Design: "Info Header" + "Info Nav"). Order = navigation order.
 */

export type InfoKey = 'bookingFlow' | 'faqList' | 'termsDoc' | 'privacyDoc' | 'guideRecruit' | 'contactUs';

export const INFO_GROUPS = ['이용 안내', '회사 정보'] as const;
export type InfoGroup = (typeof INFO_GROUPS)[number];

export interface InfoEntry {
    key: InfoKey;
    path: string;
    group: InfoGroup;
    /** English eyebrow above the title. */
    en: string;
    title: string;
    lead: string;
}

export const INFO_PAGES: InfoEntry[] = [
    { key: 'bookingFlow', path: '/booking-flow', group: '이용 안내', en: 'BOOKING FLOW', title: '예약 안내', lead: '문의부터 출발까지 한국어 스태프가 도와 드립니다.' },
    { key: 'faqList', path: '/faq', group: '이용 안내', en: 'FAQ', title: '자주 묻는 질문', lead: '고객님들이 자주 문의하시는 내용을 모았습니다.' },
    { key: 'termsDoc', path: '/terms-of-service', group: '이용 안내', en: 'TERMS OF SERVICE', title: '이용약관', lead: '몽골리아 은하수 서비스를 이용하실 때 적용되는 약관입니다.' },
    { key: 'privacyDoc', path: '/privacy-policy', group: '이용 안내', en: 'PRIVACY POLICY', title: '개인정보처리방침', lead: '고객님의 개인정보 처리에 대해 안내해 드립니다.' },
    { key: 'guideRecruit', path: '/guide-apply', group: '회사 정보', en: 'RECRUIT', title: '가이드 모집', lead: '몽골 여행 공인 가이드로 등록을 신청할 수 있습니다.' },
    { key: 'contactUs', path: '/contact', group: '회사 정보', en: 'CONTACT', title: '문의', lead: '여행 상담·질문은 편하게 남겨 주세요. 한국어 스태프가 24시간 이내에 답변해 드립니다.' },
];

export const infoEntry = (key: InfoKey): InfoEntry => INFO_PAGES.find((p) => p.key === key) ?? INFO_PAGES[0];

/** The entry whose route matches the current location; falls back to the page's own key. */
export const activeInfoKey = (pathname: string, fallback: InfoKey): InfoKey => {
    const path = pathname.replace(/\/+$/, '') || '/';
    return INFO_PAGES.find((p) => p.path === path)?.key ?? fallback;
};
