import type { CSSProperties } from 'react';
import { isUsableImage } from '../desktop-primitives/mwTokens';
import type { HomeProduct } from '../home-desktop/homeDesktopData';
import { SD } from '../site-seed/seed';
import { toTourDateKey } from '../../utils/formatDate';
import { readBreakdown, readDepositReport, type ReservationDetail } from '../../utils/reservationDetail';
import { tripPhase } from '../mypage-mobile/tripFormat';
import { daysUntil, type MyReservation } from './useMyPageData';

/**
 * 마이페이지 새 디자인(Claude Design ‘마이페이지 개선’ — 개요·예약 내역·예약 상세·예약 확정 후, PC·휴대폰)이
 * 함께 쓰는 예약 상태·날짜·모양 값.
 */

/** 예약 내역의 칸: 입금 대기(접수·보류 포함) · 예약 확정(여행 중 포함) · 지난 여행(완료·취소). */
export type BookingTab = 'wait' | 'conf' | 'done';

export interface BookingStage {
    tab: BookingTab;
    label: string;
    /** 꼬리표 모양: 확정은 검은 칸, 지난 여행은 옅은 글자, 나머지는 흰 칸 + 테두리. */
    chip: 'solid' | 'muted' | 'line';
    /** 예약금을 아직 내지 않았다(입금 완료를 알릴 수 있다). */
    needsDeposit: boolean;
}

interface StageSource {
    status: string;
    start: string;
    end: string;
    depositReported: boolean;
}

export function bookingStage(r: StageSource, today: string): BookingStage {
    if (r.status === 'cancelled') return { tab: 'done', label: '취소됨', chip: 'muted', needsDeposit: false };
    // 날짜가 지났어도 확정되지 않았던 예약은 ‘여행 완료’가 아니라 ‘지난 예약’.
    if (tripPhase(r, today) === 'past') return { tab: 'done', label: ['confirmed', 'paid', 'completed'].includes(r.status) ? '여행 완료' : '지난 예약', chip: 'muted', needsDeposit: false };
    if (r.status === 'pending_payment' || r.status === 'waiting_deposit') {
        return r.depositReported
            ? { tab: 'wait', label: '입금 확인 중', chip: 'line', needsDeposit: false }
            : { tab: 'wait', label: '입금 대기', chip: 'line', needsDeposit: true };
    }
    if (r.status === 'reservation_requested') return { tab: 'wait', label: '예약 접수', chip: 'line', needsDeposit: false };
    if (r.status === 'on_hold') return { tab: 'wait', label: '보류', chip: 'line', needsDeposit: false };
    if (tripPhase(r, today) === 'live') return { tab: 'conf', label: '여행 중', chip: 'solid', needsDeposit: false };
    return { tab: 'conf', label: '예약 확정', chip: 'solid', needsDeposit: false };
}

/** 출발까지 남은 날(D-n / D-DAY / 여행 중). 지난 여행·날짜 없는 예약은 빈 값. */
export function ddayText(r: { status: string; start: string; end: string }, today: string) {
    if (!r.start) return '';
    const phase = tripPhase(r, today);
    if (phase === 'past') return '';
    if (phase === 'live') return r.start === today ? 'D-DAY' : '여행 중';
    return `D-${daysUntil(r.start, today)}`;
}

export const chipStyle = (kind: BookingStage['chip'], size: 'sm' | 'md' = 'md'): CSSProperties => ({
    flex: 'none', height: 22, padding: '0 8px', borderRadius: 6, boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
    fontSize: size === 'sm' ? 11 : 12, fontWeight: 700,
    ...(kind === 'solid'
        ? { background: SD.gray900, color: SD.white, border: 'none' }
        : { background: SD.white, color: kind === 'muted' ? SD.gray500 : SD.gray900, border: `1px solid ${SD.gray200}` }),
});

/** 흰 칸 + 테두리 꼬리표(상품 구분·준비 중·미결제 등). */
export const tagStyle: CSSProperties = {
    flex: 'none', height: 22, padding: '0 8px', borderRadius: 6, boxSizing: 'border-box', border: `1px solid ${SD.gray200}`, background: SD.white, color: SD.gray700,
    fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap',
};

/** 검은 칸 꼬리표(n일차·결제 완료). */
export const darkTagStyle: CSSProperties = { ...tagStyle, border: 'none', background: SD.gray900, color: SD.white };

const WEEK = '일월화수목금토';
const parts = (key: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
    if (!m) return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return { y: d.getFullYear(), md: `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}(${WEEK[d.getDay()]})` };
};

/** "2026.11.27(금) – 11.30(월)" (PC) / "11.27(금) – 11.30(월)" (휴대폰 목록, `withYear` false). */
export function dateRangeText(start: string, end: string, withYear = true) {
    const a = parts(start);
    if (!a) return '일정 미정';
    const b = parts(end);
    const first = withYear ? `${a.y}.${a.md}` : a.md;
    if (!b || end === start) return first;
    return `${first} – ${withYear && b.y !== a.y ? `${b.y}.` : ''}${b.md}`;
}

/** "3박 4일" — 날짜가 없으면 빈 값. */
export function nightsDaysText(start: string, end: string) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(start) || !/^\d{4}-\d{2}-\d{2}/.test(end)) return '';
    const nights = Math.round((Date.parse(end.slice(0, 10)) - Date.parse(start.slice(0, 10))) / 86_400_000);
    if (nights < 0) return '';
    return nights === 0 ? '당일' : `${nights}박 ${nights + 1}일`;
}

/** Seed BoxButton 모양(primary = 민트 채움 + 짙은 글자, tertiary = 흰 칸 + 테두리). */
export const boxButton = (variant: 'primary' | 'tertiary', size: 'small' | 'medium' | 'large', full = false): CSSProperties => ({
    height: size === 'small' ? 36 : size === 'medium' ? 44 : 52,
    padding: size === 'small' ? '0 14px' : '0 18px',
    width: full ? '100%' : undefined,
    boxSizing: 'border-box', borderRadius: size === 'small' ? 8 : 10,
    border: variant === 'tertiary' ? `1px solid ${SD.gray200}` : 'none',
    background: variant === 'primary' ? SD.mint400 : SD.white,
    color: variant === 'primary' ? SD.mint950 : SD.gray900,
    fontFamily: 'inherit', fontSize: size === 'small' ? 13 : size === 'medium' ? 14 : 16, fontWeight: 700, whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', textDecoration: 'none',
});

/** 디자인의 민트 글자(출발까지 D-n). */
export const DDAY_COLOR = SD.mint600;

export const productImageOf = (r: MyReservation, productById: Map<string, HomeProduct>) =>
    (r.productId ? productById.get(r.productId)?.mainImages.find(isUsableImage) : undefined) || '';

/** 다음 여행: 여행 중인 예약, 없으면 가장 가까운 출발(취소·지난 여행 제외). */
export function pickNextTrip(list: MyReservation[], today: string) {
    return list
        .filter((r) => bookingStage(r, today).tab !== 'done')
        .sort((a, b) => (a.start || '9999').localeCompare(b.start || '9999'))[0];
}

/** 마이페이지 왼쪽 메뉴(PC)·메뉴 묶음(휴대폰). */
export interface MyMenuEntry {
    key: string;
    label: string;
    icon: string;
    path: string;
}

export const MY_MENU_GROUPS: Array<{ title: string; items: MyMenuEntry[] }> = [
    {
        title: '나의 여행',
        items: [
            { key: 'overview', label: '개요', icon: 'gridFour', path: '/mypage' },
            { key: 'reservations', label: '예약 내역', icon: 'calendarCheck', path: '/mypage/reservations' },
            { key: 'estimates', label: '견적 내역', icon: 'quoteDoc', path: '/mypage/estimates' },
            { key: 'wishlist', label: '찜 목록', icon: 'heart', path: '/mypage/wishlist' },
            { key: 'recently-viewed', label: '최근 본 상품', icon: 'historyBack', path: '/mypage/recently-viewed' },
        ],
    },
    {
        title: '커뮤니티',
        items: [
            { key: 'travel-mates', label: '동행 찾기 글', icon: 'peopleTwo', path: '/mypage/travel-mates' },
            { key: 'my-reviews', label: '내 후기', icon: 'reviewBubble', path: '/mypage/reviews' },
        ],
    },
    {
        title: '계정',
        items: [{ key: 'notifications', label: '알림', icon: 'bell', path: '/mypage/notifications' }],
    },
];

/** 예약 상세(PC·휴대폰)가 그리는 값을 예약 한 건에서 한 번에 계산한다. */
export function bookingDetailView(reservation: ReservationDetail, today: string) {
    const number = reservation.reservationNumber || reservation.id.slice(0, 8).toUpperCase();
    const people = reservation.totalPeople ?? reservation.travelers ?? 0;
    const start = toTourDateKey(reservation.startDate);
    const end = toTourDateKey(reservation.endDate);
    const pb = readBreakdown(reservation);
    const depositPaid = reservation.depositStatus === 'paid' || ['paid', 'confirmed', 'completed'].includes(reservation.status);
    const balancePaid = reservation.balanceStatus === 'paid' || reservation.status === 'completed';
    // 고객이 '입금 완료'를 알렸고 담당자 확인을 기다리는 중
    const depositReported = !depositPaid && !!readDepositReport(reservation);
    const stage = bookingStage({ status: reservation.status, start, end, depositReported }, today);
    const paid = (depositPaid && pb ? pb.deposit : 0) + (balancePaid && pb ? pb.local : 0);
    const percent = pb && pb.total > 0 ? Math.min(100, (paid / pb.total) * 100) : 0;
    // 문서 링크는 늘 예약 UUID로 연다(저장된 주소는 발행 여부만 알려 준다).
    const itineraryUrl = reservation.itineraryUrl && ['confirmed', 'paid', 'completed'].includes(reservation.status) ? `/documents/itinerary/${reservation.id}` : '';
    const contractUrl = reservation.contractUrl ? `/documents/contract/${reservation.id}` : '';
    return {
        number, people, start, end, pb, depositPaid, balancePaid, depositReported, stage, paid, percent, itineraryUrl, contractUrl,
        dates: dateRangeText(start, end),
        length: nightsDaysText(start, end),
        dd: reservation.status === 'cancelled' ? '' : ddayText({ status: reservation.status, start, end }, today),
        guide: reservation.assignedGuide?.name ? reservation.assignedGuide : null,
        stays: reservation.dailyAccommodations || [],
        history: [...(reservation.history || [])].reverse(),
        /** 상태 점: 확정·결제는 민트, 취소·지난 여행은 옅은 회색. */
        dot: stage.tab === 'conf' ? SD.mint500 : stage.tab === 'done' ? SD.gray400 : SD.gray900,
    };
}

/** "11/11 20:52" — 타임라인 시각. */
export function shortStamp(v: string) {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 상품 구분 꼬리표 글자. */
export const packageLabel = (p?: HomeProduct) => (p?.packageType === 'full' ? '풀패키지' : p?.packageType === 'value' ? '실속형' : '');
