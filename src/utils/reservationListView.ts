/**
 * 통합 예약 목록(/admin/reservations)의 보기 상태 — 탭·빠른 필터·검색·정렬·페이지·쪽당 건수 — 를 주소(URL)에 보관한다.
 * 상세 화면에 갔다가 `returnTo`로 돌아오거나 새로고침해도 같은 목록이 열린다(CLAUDE.md 5.1-5).
 * 다른 화면이 붙인 주소 값(open·kind·returnTo 등)은 건드리지 않는다.
 */
import type { V7Quick, V7Sort, V7Tab } from './reservationV7';

export interface ReservationListView {
    tab: V7Tab; quick: V7Quick; q: string; sort: V7Sort; page: number; size: number;
}

export const RESERVATION_PAGE_SIZES = [10, 20, 50] as const;
export const defaultReservationListView: ReservationListView = { tab: 'contract', quick: 'all', q: '', sort: 'pri', page: 1, size: 20 };

const TABS: V7Tab[] = ['contract', 'ongoing', 'ended', 'cancel'];
const QUICKS: V7Quick[] = ['all', 'week', 'bal', 'asg', 'ct', 'dep'];
const SORTS: V7Sort[] = ['pri', 'dep', 'bk'];
/** 이 목록이 쓰는 주소 키. 예전 목록의 status·payment·type·departure·source는 더 쓰지 않으므로 정리한다. */
const OWN_KEYS = ['tab', 'quick', 'q', 'sort', 'page', 'size'];
const LEGACY_KEYS = ['status', 'payment', 'type', 'departure', 'source'];

const pick = <T extends string>(list: readonly T[], value: string | null, fallback: T): T => (list as readonly string[]).includes(value || '') ? value as T : fallback;

export function readReservationListView(search: string): ReservationListView {
    const p = new URLSearchParams(search);
    const size = Number(p.get('size'));
    return {
        tab: pick(TABS, p.get('tab'), defaultReservationListView.tab),
        quick: pick(QUICKS, p.get('quick'), 'all'),
        q: (p.get('q') || '').slice(0, 200),
        sort: pick(SORTS, p.get('sort'), 'pri'),
        page: Math.max(1, Math.min(100000, Math.floor(Number(p.get('page')) || 1))),
        size: (RESERVATION_PAGE_SIZES as readonly number[]).includes(size) ? size : defaultReservationListView.size,
    };
}

export function reservationListViewSearch(view: ReservationListView, base = ''): string {
    const p = new URLSearchParams(base);
    [...OWN_KEYS, ...LEGACY_KEYS].forEach((key) => p.delete(key));
    if (view.tab !== defaultReservationListView.tab) p.set('tab', view.tab);
    if (view.quick !== 'all') p.set('quick', view.quick);
    if (view.q.trim()) p.set('q', view.q.slice(0, 200));
    if (view.sort !== 'pri') p.set('sort', view.sort);
    if (view.page > 1) p.set('page', String(view.page));
    if (view.size !== defaultReservationListView.size) p.set('size', String(view.size));
    const text = p.toString();
    return text ? `?${text}` : '';
}

/** 한 쪽에 보일 행. 쪽 번호가 넘치면 마지막 쪽으로 맞춘다(필터를 바꿔 건수가 줄었을 때). */
export function reservationPage<T>(rows: T[], page: number, size: number) {
    const totalPages = Math.max(1, Math.ceil(rows.length / size));
    const current = Math.min(Math.max(1, page), totalPages);
    const start = (current - 1) * size;
    return { page: current, totalPages, start, end: Math.min(rows.length, start + size), rows: rows.slice(start, start + size) };
}

/** 목록 아래 요약: ‘1–20 / 46건’ */
export const reservationPageSummary = (total: number, start: number, end: number) => total ? `${start + 1}–${end} / ${total}건` : '0건';
