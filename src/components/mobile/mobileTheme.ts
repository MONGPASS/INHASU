import qmTours from '../../assets/mobile/quick-menu/tours.webp';
import qmQuote from '../../assets/mobile/quick-menu/quote.webp';
import qmMates from '../../assets/mobile/quick-menu/mates.webp';
import qmMagazine from '../../assets/mobile/quick-menu/magazine.webp';
import qmReviews from '../../assets/mobile/quick-menu/reviews.webp';
import qmEvent from '../../assets/mobile/quick-menu/event.webp';

/**
 * Constants for the mobile redesign (Claude Design: "Milkyway Japan Mobile").
 * Colours beyond the shared MW palette, icon path data and the quick-menu entries.
 */

export const M_GRADIENT = 'linear-gradient(135deg,#27AB8F 0%,#3FC2A4 100%)';
/** Soft page background used behind card lists (my page sub screens). */
export const M_PAPER = '#F7FAF9';
/** Hairline between rows inside a card. */
export const M_HAIR = '#EEF1EF';
/** Neutral tile background (quick menu, placeholders). */
export const M_TILE = '#F7F7F7';
export const M_AMBER = '#F2B544';

/** 카카오톡 채널 버튼: 카카오 노란색 바탕 + 말풍선 글리프(viewBox 0 0 24 24, fill). */
export const KAKAO_YELLOW = '#FEE500';
export const KAKAO_INK = '#191919';
export const KAKAO_BUBBLE = 'M12 3.5C6.75 3.5 2.5 6.86 2.5 11c0 2.62 1.7 4.92 4.28 6.26l-.9 3.3c-.08.3.26.54.52.37l3.93-2.6c.55.07 1.1.11 1.67.11 5.25 0 9.5-3.36 9.5-7.5S17.25 3.5 12 3.5z';

export const D = {
    back: 'M15 5l-7 7 7 7',
    chevron: 'M9 5l7 7-7 7',
    heart: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
    bell: 'M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15zM10 20.5a2 2 0 004 0',
    menu: 'M4 7h16M4 12h16M4 17h16',
    filter: 'M4 6h16M7 12h10M10 18h4',
    calendar: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
    people: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 010 6.5M18 14c2 .7 3 3 3 6',
    doc: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    faq: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01',
} as const;

export interface QuickMenuItem {
    key: string;
    label: string;
    path: string;
    icon: string;
    tag?: 'PICK' | 'EVENT';
    isNew?: boolean;
}

/** Home quick menu and the drawer's MENU grid share these six entries. */
export const QUICK_MENU: QuickMenuItem[] = [
    { key: 'tours', label: '투어 상품', path: '/products', icon: qmTours },
    { key: 'quote', label: '맞춤 견적', path: '/custom-estimate', icon: qmQuote, tag: 'PICK' },
    { key: 'mates', label: '동행 찾기', path: '/travel-mates', icon: qmMates, isNew: true },
    { key: 'magazine', label: '여행 가이드', path: '/travel-guide', icon: qmMagazine },
    { key: 'reviews', label: '여행 후기', path: '/reviews', icon: qmReviews },
    { key: 'event', label: '여행 기획전', path: '/promotions', icon: qmEvent, tag: 'EVENT' },
];
