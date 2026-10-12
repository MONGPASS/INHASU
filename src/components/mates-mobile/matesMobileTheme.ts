import { MW } from '../desktop-primitives/mwTokens';
import { M_AMBER } from '../mobile/mobileTheme';
import type { MateStatus } from '../mates-desktop/matesData';

/**
 * Constants for the mobile 동행 찾기 screens (Claude Design: "Milkyway Japan Mobile").
 * Values are copied from the design file; data comes from mates-desktop/matesData.
 */

export const LIST_PATH = '/travel-mates';
export const WRITE_PATH = '/travel-mates/write';

/** Navy → mint panel ("THIS TRIP", hero stats) and the photo fallback. */
export const PANEL_BG = 'linear-gradient(160deg,#0F2A3B 0%,#1C8571 100%)';
export const MINT_SOLID = '#3FC2A4';
const AMBER_INK = '#9A5B00';

/** Status pill on a card photo: [background, text]. */
export const CARD_STATUS_PILL: Record<MateStatus, [string, string]> = {
    open: [MINT_SOLID, MW.navy],
    few: [M_AMBER, MW.navy],
    done: ['rgba(10,31,46,0.72)', '#FFFFFF'],
};

/** Status pill in the detail header: [background, text]. */
export const DETAIL_STATUS_PILL: Record<MateStatus, [string, string]> = {
    open: [MW.mintTint, MW.mintDeep],
    few: ['#FFF2DC', AMBER_INK],
    done: [MW.chip, MW.mute],
};

export const SEAT_FG: Record<MateStatus, string> = { open: MW.mintDeep, few: AMBER_INK, done: MW.mute2 };

/** Seat dots drawn on a card photo / member circles in the detail panel. */
export const MAX_SEAT_DOTS = 6;

export const STEPS: [string, string, string][] = [
    ['01', '모집글 찾기·올리기', '여행지와 일정, 여행 스타일로 마음 맞는 동행을 찾아보세요. 마땅한 글이 없으면 무료로 모집글을 올릴 수 있습니다.'],
    ['02', '댓글로 상의하기', '마음에 드는 모집글에는 댓글로 질문이나 참가 의사를 남겨 보세요. 일정과 플랜을 편하게 상의할 수 있습니다.'],
    ['03', '여행 준비는 몽골리아 은하수에', '멤버가 정해지면 한국어 가이드·차량·숙박 준비를 몽골리아 은하수에 한 번에 상담할 수 있습니다.'],
];

export const MATE_ICON = {
    search: 'M17.5 11a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0zM16 16l4.5 4.5',
    gender: 'M12 11a4 4 0 100-8 4 4 0 000 8zM5 21c0-4 3.1-7 7-7s7 3 7 7',
    age: 'M5 20h14M6 20v-7h12v7M9 13V10M15 13V10M12 13V9M12 6.5v.5',
    shield: 'M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4',
    chat: 'M4 5h16v11H9l-5 4z',
    share: 'M20.5 5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM8.5 12a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM20.5 19a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4',
} as const;
