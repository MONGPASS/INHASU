import type { CSSProperties, MouseEvent } from 'react';
import { MW } from '../desktop-primitives/mwTokens';

/** Inline SVG paths from the design (24×24 stroke icons). */
export const ICON = {
    overview: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    bookings: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4M9.5 15l2 2 3.5-4',
    quotes: 'M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5',
    mates: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 010 6.5M18 14c2 .7 3 3 3 6',
    wish: 'M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z',
    recent: 'M4 12a8 8 0 102.3-5.7M4 4v4h4M12 8v4l3 2',
    reviews: 'M4 5h16v11H9l-5 4zM12 7.5l1 2 2.2.3-1.6 1.5.4 2.2-2-1-2 1 .4-2.2-1.6-1.5 2.2-.3z',
    notice: 'M6 16v-5a6 6 0 0112 0v5l1.5 2h-15zM10 20a2 2 0 004 0',
    active: 'M12 21c-4 0-6.5-2.8-6.5-6.2C5.5 10 12 3 12 3s6.5 7 6.5 11.8C18.5 18.2 16 21 12 21zM12 18a2.5 2.5 0 01-2.5-2.5c0-1.8 2.5-4.5 2.5-4.5s2.5 2.7 2.5 4.5A2.5 2.5 0 0112 18z',
    quoteRequest: 'M4 6h12M4 10h10M4 14h6M14 19l1-3 5-5 2 2-5 5z',
    mateAdd: 'M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M19 8v6M16 11h6',
    chat: 'M4 5h16v11H9l-5 4zM8 9h8M8 12h5',
    calendar: 'M5 5h14v15H5zM5 10h14M9 3v4M15 3v4',
    map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    check: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8 12l3 3 5-6',
    megaphone: 'M4 10v4h3l6 4V6L7 10zM17 9a4 4 0 010 6',
    bed: 'M3 18V8M3 14h18v4M21 14v-3a3 3 0 00-3-3h-7v6M7 11.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z',
    user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4.4 3.6-8 8-8s8 3.6 8 8',
    lock: 'M6 11h12v10H6zM8 11V8a4 4 0 018 0v3',
} as const;

/** onMouseEnter/Leave pair that swaps a few inline style props (the design's `style-hover`). */
export const hover = (over: CSSProperties, base: CSSProperties) => ({
    onMouseEnter: (e: MouseEvent<HTMLElement>) => { Object.assign(e.currentTarget.style, over); },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => { Object.assign(e.currentTarget.style, base); },
});

export const PAPER = '#F7FAF9';
export const HAIR = '#EEF1EF';

export const cardBox: CSSProperties = { border: `1px solid ${MW.line}`, borderRadius: 20, padding: 24, background: '#fff', display: 'flex', flexDirection: 'column', gap: 22 };

export const ghostBtn: CSSProperties = {
    height: 40, padding: '0 16px', border: `1px solid ${MW.line}`, borderRadius: 999, background: '#fff', fontFamily: 'inherit',
    fontSize: 13, fontWeight: 700, color: MW.mute, cursor: 'pointer', whiteSpace: 'nowrap',
};
export const ghostHover = hover({ borderColor: MW.mint, color: MW.mintDeep }, { borderColor: MW.line, color: MW.mute });

export const mintBtn: CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 6, height: 40, padding: '0 18px', border: 0, borderRadius: 999, background: MW.mint,
    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: MW.navy, cursor: 'pointer', whiteSpace: 'nowrap', textDecoration: 'none',
};
export const mintHover = hover({ background: '#3FC2A4' }, { background: MW.mint });

export const smallPill: CSSProperties = { ...ghostBtn, height: 32, padding: '0 12px', fontSize: 12 };

export interface BadgeTone { bg: string; fg: string; bd: string }

export const TONE = {
    solid: { bg: '#3FC2A4', fg: MW.navy, bd: '#3FC2A4' },
    tint: { bg: MW.mintTint, fg: MW.mintDeep, bd: '#A6E8D4' },
    plain: { bg: '#FFFFFF', fg: MW.mute, bd: MW.line },
    done: { bg: MW.chip, fg: MW.mute, bd: MW.chip },
    warn: { bg: '#FFF2DC', fg: '#9A5B00', bd: '#FFE2B0' },
    red: { bg: '#FCE9E7', fg: '#B23A3A', bd: '#F6CFCA' },
} satisfies Record<string, BadgeTone>;

/** Quote request status → label and badge tone (shared by the PC and mobile my page). */
export const QUOTE_STATUS: Record<string, { label: string; tone: BadgeTone }> = {
    new: { label: '답변 대기', tone: TONE.plain },
    pending: { label: '답변 대기', tone: TONE.plain },
    waiting: { label: '답변 대기', tone: TONE.plain },
    processing: { label: '상담 중', tone: TONE.plain },
    answered: { label: '답변 완료', tone: TONE.tint },
    reservation_requested: { label: '예약 요청 중', tone: TONE.tint },
    converted: { label: '예약 확정', tone: TONE.solid },
    completed: { label: '완료', tone: TONE.done },
    paused: { label: '보류', tone: TONE.plain },
    cancelled: { label: '취소', tone: TONE.red },
};

/** Notification type → filter label and icon; unknown types fall back to `system`. */
export const NOTICE_TYPES: Record<string, { label: string; d: string }> = {
    reservation: { label: '예약', d: ICON.bookings },
    comment: { label: '댓글', d: ICON.chat },
    event: { label: '이벤트', d: ICON.megaphone },
    system: { label: '안내', d: ICON.notice },
};

/** Reservation status → design badge tone. */
export const reservationTone = (status: string): BadgeTone =>
    status === 'confirmed' ? TONE.solid
        : status === 'paid' ? TONE.tint
            : status === 'pending_payment' || status === 'waiting_deposit' ? TONE.warn
                : status === 'completed' ? TONE.done
                    : status === 'cancelled' ? TONE.red
                        : TONE.plain;
