// 관리자 사이드바의 계산(처리할 일 숫자·메뉴 찾기·묶음 펼침·최근 연 화면). 화면은 AdminSidebar.tsx.
import type { AdminWorkTask } from '../../types/adminWorkspace';
import { quoteDeskPageId } from './quoteDesk';
import { dashboardItem, navGroups, type NavGroup, type NavItem } from './adminNav';

export type NavBadgeKind = 'alert' | 'new';
export interface NavBadge { count: number; kind: NavBadgeKind; label: string }

/**
 * 메뉴 옆 숫자 — 상단 바 ‘업무 알림’과 같은 자료(`/api/admin/workspace`의 tasks)를 센다.
 * - 통합 예약 목록: 입금 신고 확인 + 계약 동의 확인(처리 필요)
 * - 견적 문의: 답변하지 않은 문의(새 문의)
 * - 숙소 배정: 출발 7일 안에 배정이 끝나지 않은 예약(배정 필요)
 */
export const navBadges = (tasks: AdminWorkTask[] | null | undefined): Record<string, NavBadge> => {
    if (!tasks) return {};
    const count = (kinds: AdminWorkTask['kind'][]) => tasks.filter((task) => kinds.includes(task.kind)).length;
    const out: Record<string, NavBadge> = {};
    const put = (id: string, value: number, kind: NavBadgeKind, label: (n: number) => string) => {
        if (value > 0) out[id] = { count: value, kind, label: label(value) };
    };
    put('reservations', count(['deposit_report', 'contract']), 'alert', (n) => `처리 필요 ${n}건`);
    put(quoteDeskPageId('inbox'), count(['quote']), 'new', (n) => `새 문의 ${n}건`);
    put('accommodation-ops', count(['assignment']), 'alert', (n) => `배정 필요 ${n}건`);
    return out;
};

/** 배지에 보이는 글자(100 이상은 99+). */
export const badgeText = (count: number) => (count > 99 ? '99+' : String(count));

/** 접힌 묶음 제목 옆 합계. 처리 필요가 하나라도 있으면 빨간 배지. */
export const groupSummary = (group: NavGroup, badges: Record<string, NavBadge>): NavBadge | null => {
    const own = group.items.map((item) => badges[item.id]).filter(Boolean) as NavBadge[];
    if (!own.length) return null;
    const total = own.reduce((sum, badge) => sum + badge.count, 0);
    return { count: total, kind: own.some((badge) => badge.kind === 'alert') ? 'alert' : 'new', label: `처리할 일 ${total}건` };
};

export const groupOfPage = (activePage: string): NavGroup | undefined =>
    navGroups.find((group) => group.items.some((item) => item.id === activePage) || group.relatedPages?.includes(activePage));

/** 저장된 펼침 상태 + 기본값. 지금 화면이 든 묶음은 늘 펼친다. */
export const resolveOpenGroups = (stored: Record<string, boolean>, activePage: string): Record<string, boolean> => {
    const current = groupOfPage(activePage)?.id;
    return Object.fromEntries(navGroups.map((group) => [
        group.id, group.id === current || (stored[group.id] ?? group.defaultOpen !== false),
    ]));
};

/* ── 메뉴 찾기 ── */
export interface MenuMatch { item: NavItem; group: NavGroup | null; start: number; length: number }

const squash = (value: string) => value.toLowerCase().replace(/[\s·・]/g, '');

/** 대시보드와 모든 메뉴(묶음 순서). */
export const allMenuItems = (): Array<{ item: NavItem; group: NavGroup | null }> => [
    { item: dashboardItem, group: null },
    ...navGroups.flatMap((group) => group.items.map((item) => ({ item, group }))),
];

/**
 * 메뉴 이름과 묶음 이름으로 찾는다(띄어쓰기·가운뎃점 무시, 영문 대소문자 무시).
 * 이름에 그대로 들어 있으면 그 글자를 표시할 자리(start·length)를 돌려준다(없으면 -1).
 */
export const findMenus = (query: string): MenuMatch[] => {
    const needle = squash(query);
    if (!needle) return [];
    const matches: Array<MenuMatch & { rank: number }> = [];
    allMenuItems().forEach(({ item, group }, order) => {
        const inLabel = squash(item.label).includes(needle);
        const inGroup = !!group && squash(group.label).includes(needle);
        if (!inLabel && !inGroup) return;
        const start = item.label.toLowerCase().indexOf(query.trim().toLowerCase());
        const rank = (squash(item.label).startsWith(needle) ? 0 : inLabel ? 1 : 2) * 1000 + order;
        matches.push({ item, group, start, length: start >= 0 ? query.trim().length : 0, rank });
    });
    return matches.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...match }) => match);
};

/** ↑·↓로 고르는 자리(끝에서 처음으로 돈다). */
export const moveIndex = (current: number, step: 1 | -1, total: number) => (total ? (current + step + total) % total : 0);

/* ── 최근 연 화면(이 브라우저의 편의 기록) ── */
export const RECENT_KEY = 'mw-admin-recent-menus';
export const OPEN_KEY = 'mw-admin-nav-open';

const isMenuId = (id: string) => allMenuItems().some(({ item }) => item.id === id);

/** 지금 화면을 맨 앞에 두고 메뉴에 있는 화면만 최대 5개 남긴다. */
export const pushRecent = (list: string[], activePage: string): string[] =>
    isMenuId(activePage) ? [activePage, ...list.filter((id) => id !== activePage && isMenuId(id))].slice(0, 5) : list.filter(isMenuId).slice(0, 5);

/** 메뉴 찾기에 보일 최근 화면(지금 화면 제외, 3개). */
export const recentMenus = (list: string[], activePage: string): NavItem[] =>
    list.filter((id) => id !== activePage)
        .map((id) => allMenuItems().find(({ item }) => item.id === id)?.item)
        .filter(Boolean).slice(0, 3) as NavItem[];

export const readJson = <T,>(key: string, fallback: T): T => {
    try {
        const raw = window.localStorage.getItem(key);
        const value = raw ? JSON.parse(raw) : null;
        return value && typeof value === 'object' ? (value as T) : fallback;
    } catch { return fallback; }
};
export const writeJson = (key: string, value: unknown) => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장소를 쓸 수 없는 창 */ }
};
