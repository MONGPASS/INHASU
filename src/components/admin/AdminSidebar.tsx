import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { DashboardIcon, type DashboardIconName } from './dashboard/DashboardIcon';
import { QUOTE_DESK_TOOLS, disconnectQuoteDesk, quoteDeskHref, quoteDeskPageId } from './quoteDesk';

interface AdminSidebarProps {
    activePage: string;
    /** 아이콘만 보이는 좁은 메뉴 (디자인 v3의 접기). */
    rail?: boolean;
    onToggleRail?: () => void;
    /** kept for backward-compat with existing call sites; the redesign is light-only */
    isDarkMode?: boolean;
    toggleTheme?: () => void;
}

interface NavItem {
    id: string;
    icon: DashboardIconName;
    label: string;
    href: string;
}

interface NavGroup {
    id: string;
    icon: DashboardIconName;
    label: string;
    items: NavItem[];
    /** 상세·작성 화면도 관련 업무 메뉴 안에 표시한다. */
    relatedPages?: string[];
}

const dashboardItem: NavItem = { id: 'dashboard', icon: 'lc-layout-dashboard', label: '대시보드', href: '/admin' };

const QUOTE_ICONS: Record<string, DashboardIconName> = {
    inbox: 'lc-file-text', courses: 'lc-route', itinerary: 'lc-trending-up', spots: 'lc-map-pin', resources: 'lc-users',
};
const quoteItem = (key: string, label?: string): NavItem => {
    const tool = QUOTE_DESK_TOOLS.find((entry) => entry.key === key)!;
    return { id: quoteDeskPageId(key), icon: QUOTE_ICONS[key] || 'lc-file-text', label: label ?? tool.label, href: quoteDeskHref(key) };
};

const navGroups: NavGroup[] = [
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
/** 디자인 v3: 업무 메뉴(MAIN MENU)와 고객·사이트 메뉴(OTHER)를 나눈다. */
const sections: Array<{ title: string; groups: string[]; dashboard?: boolean }> = [
    { title: 'MAIN MENU', dashboard: true, groups: ['booking-work', 'quote-work', 'product-work', 'assignment-work'] },
    { title: 'OTHER', groups: ['customer-content', 'site-management'] },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activePage, rail = false, onToggleRail }) => {
    const navigate = useNavigate();
    let logout: undefined | (() => void | Promise<void>);
    try { logout = useUser().logout; } catch { logout = undefined; }

    const activeGroupId = navGroups.find((group) => (
        group.items.some((item) => item.id === activePage) || group.relatedPages?.includes(activePage)
    ))?.id ?? null;
    const [expandedGroup, setExpandedGroup] = useState<string | null>(activeGroupId);
    const navRef = useRef<HTMLElement>(null);

    // 현재 업무만 먼저 펼친다. 다른 화면으로 이동하면 해당 업무 메뉴를 자동으로 연다.
    useEffect(() => {
        setExpandedGroup(activeGroupId);
        const frame = window.requestAnimationFrame(() => {
            navRef.current?.querySelector('.nav-item.active, .nav-group-toggle.is-current')?.scrollIntoView({ block: 'nearest' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activePage, activeGroupId]);

    const handleLogout = async () => {
        // 견적 도구가 쓰는 관리자 값(sessionStorage)도 함께 지운다.
        disconnectQuoteDesk();
        try { await logout?.(); } catch { /* ignore */ }
        navigate('/admin/login');
    };

    const renderItem = (item: NavItem, sub = false) => {
        const isActive = activePage === item.id;
        return (
            <Link key={item.id} to={item.href} className={`nav-item${isActive ? ' active' : ''}`} aria-current={isActive ? 'page' : undefined} title={rail ? item.label : undefined}>
                <DashboardIcon name={item.icon} size={sub ? 16 : 18} />
                <span>{item.label}</span>
            </Link>
        );
    };

    return (
        <aside className={`side${rail ? ' is-rail' : ''}`}>
            {onToggleRail && <div className="side-rail-bar">
                <button type="button" className="side-rail-toggle" title={rail ? '메뉴 펼치기' : '메뉴 접기'} aria-label={rail ? '메뉴 펼치기' : '메뉴 접기'} aria-pressed={rail} onClick={onToggleRail}>
                    <DashboardIcon name={rail ? 'lc-chevron-right' : 'lc-chevron-left'} size={18} />
                </button>
            </div>}

            <nav className="side-nav" ref={navRef} aria-label="관리자 업무 메뉴">
                {sections.map((section) => (
                    <div className="nav-section" key={section.title}>
                        <div className="nav-section-title" aria-hidden={rail || undefined}>{section.title}</div>
                        {section.dashboard && renderItem(dashboardItem)}
                        {section.groups.map((groupId) => {
                            const group = navGroups.find((entry) => entry.id === groupId)!;
                            const isOpen = !rail && expandedGroup === group.id;
                            const isCurrent = activeGroupId === group.id;
                            const panelId = `admin-nav-${group.id}`;
                            return (
                                <div className={`nav-group${isOpen ? ' is-open' : ''}`} key={group.id}>
                                    <button
                                        type="button"
                                        className={`nav-group-toggle${isCurrent ? ' is-current' : ''}`}
                                        aria-expanded={isOpen}
                                        aria-controls={panelId}
                                        title={rail ? group.label : undefined}
                                        onClick={() => {
                                            // 접힌 메뉴에서는 펼치면서 해당 업무를 연다.
                                            if (rail) { onToggleRail?.(); setExpandedGroup(group.id); return; }
                                            setExpandedGroup(isOpen ? null : group.id);
                                        }}
                                    >
                                        <DashboardIcon name={group.icon} size={18} />
                                        <span>{group.label}</span>
                                        <span className="nav-chevron" aria-hidden="true"><DashboardIcon name="lc-chevron-down" size={16} /></span>
                                    </button>
                                    <div className="nav-submenu" id={panelId} hidden={!isOpen}>
                                        {group.items.map((item) => renderItem(item, true))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="side-foot">
                <div className="side-account">
                    <span className="av">관</span>
                    <div className="who">
                        <b>관리자</b>
                        <span>운영 계정 · 마스터</span>
                    </div>
                    <button type="button" className="out" title="로그아웃" aria-label="로그아웃" onClick={handleLogout}>
                        <DashboardIcon name="lc-log-out" size={18} />
                    </button>
                </div>
            </div>
        </aside>
    );
};
