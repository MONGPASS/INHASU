// 관리자 메뉴 정의(사이드바·상단 바 경로 표시가 함께 쓴다).
import type { DashboardIconName } from './dashboard/DashboardIcon';
import { QUOTE_DESK_TOOLS, quoteDeskHref, quoteDeskPageId } from './quoteDesk';

export interface NavItem {
    id: string;
    icon: DashboardIconName;
    label: string;
    href: string;
}

export interface NavGroup {
    id: string;
    icon: DashboardIconName;
    label: string;
    items: NavItem[];
    /** 상세·작성 화면도 관련 업무 메뉴 안에 표시한다. */
    relatedPages?: string[];
}

export const dashboardItem: NavItem = { id: 'dashboard', icon: 'lc-layout-dashboard', label: '대시보드', href: '/admin' };

const QUOTE_ICONS: Record<string, DashboardIconName> = {
    inbox: 'lc-file-text', courses: 'lc-route', itinerary: 'lc-trending-up', spots: 'lc-map-pin', resources: 'lc-users',
};
const quoteItem = (key: string, label?: string): NavItem => {
    const tool = QUOTE_DESK_TOOLS.find((entry) => entry.key === key)!;
    return { id: quoteDeskPageId(key), icon: QUOTE_ICONS[key] || 'lc-file-text', label: label ?? tool.label, href: quoteDeskHref(key) };
};

export const navGroups: NavGroup[] = [
    {
        id: 'booking-work', icon: 'lc-calendar-check', label: '예약 관리',
        relatedPages: [quoteDeskPageId('bookings')],
        items: [
            { id: 'reservations', icon: 'lc-clipboard-list', label: '통합 예약 목록', href: '/admin/reservations' },
            { id: 'calendar', icon: 'lc-calendar', label: '투어 캘린더', href: '/admin/calendar' },
        ],
    },
    {
        id: 'quote-work', icon: 'lc-file-text', label: '견적 관리',
        relatedPages: [quoteDeskPageId('builder')],
        items: [quoteItem('inbox'), quoteItem('courses'), quoteItem('itinerary'), quoteItem('spots')],
    },
    {
        id: 'product-work', icon: 'lc-archive', label: '상품 관리',
        items: [
            { id: 'products', icon: 'lc-archive', label: '상품 목록', href: '/admin/products' },
            { id: 'categories', icon: 'lc-shapes', label: '상품 카테고리', href: '/admin/categories' },
            { id: 'templates', icon: 'lc-folder-plus', label: '문서 템플릿', href: '/admin/templates' },
        ],
    },
    {
        id: 'assignment-work', icon: 'lc-users', label: '배정·자원',
        items: [
            { id: 'accommodation-ops', icon: 'lc-house', label: '숙소 배정 · 현지 운영', href: '/admin/accommodation-ops' },
            quoteItem('resources'),
        ],
    },
    {
        id: 'customer-content', icon: 'lc-mail', label: '고객·콘텐츠',
        items: [
            { id: 'inquiries', icon: 'lc-mail', label: '일반 문의', href: '/admin/inquiries' },
            { id: 'reviews', icon: 'lc-message-square-quote', label: '후기 관리', href: '/admin/reviews' },
            { id: 'faq', icon: 'lc-circle-help', label: 'FAQ 관리', href: '/admin/faq' },
            { id: 'magazines', icon: 'lc-book-open', label: '매거진 관리', href: '/admin/magazines' },
        ],
    },
    {
        id: 'site-management', icon: 'lc-panel-top', label: '사이트 관리',
        items: [
            { id: 'banners', icon: 'lc-panel-top', label: '홈 화면 관리', href: '/admin/banners' },
            { id: 'promotions', icon: 'lc-megaphone', label: '여행기획전 관리', href: '/admin/promotions' },
        ],
    },
];
/** Montage 시안: 업무 메뉴와 고객·사이트 메뉴를 나눈다. */
export const sections: Array<{ title: string; groups: string[]; dashboard?: boolean }> = [
    { title: '업무', dashboard: true, groups: ['booking-work', 'quote-work', 'product-work', 'assignment-work'] },
    { title: '고객 · 사이트', groups: ['customer-content', 'site-management'] },
];

/** 화면 id가 속한 업무 묶음 이름(상단 바 경로). 대시보드는 '업무'. */
export const adminSectionLabel = (activePage: string): string => {
    if (activePage === dashboardItem.id) return sections[0].title;
    const group = navGroups.find((entry) => entry.items.some((item) => item.id === activePage) || entry.relatedPages?.includes(activePage));
    return group?.label ?? '관리자';
};
