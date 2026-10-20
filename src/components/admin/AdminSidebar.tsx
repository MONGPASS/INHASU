import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { Icon } from './console/Icon';
import { Admin3DIcon } from './Admin3DIcon';
import type { Admin3DIconName } from './Admin3DIcon';
import { QUOTE_DESK_TOOLS, disconnectQuoteDesk, quoteDeskHref, quoteDeskPageId } from './quoteDesk';

interface AdminSidebarProps {
    activePage: string;
    /** kept for backward-compat with existing call sites; the redesign is light-only */
    isDarkMode?: boolean;
    toggleTheme?: () => void;
}

interface NavItem {
    id: string;
    icon: string;
    label: string;
    href: string;
}

interface NavGroup {
    id: string;
    icon: string;
    label: string;
    items: NavItem[];
    /** 상세·작성 화면도 관련 업무 메뉴 안에 표시한다. */
    relatedPages?: string[];
}

const dashboardItem: NavItem = { id: 'dashboard', icon: 'dashboard', label: '대시보드', href: '/admin' };

const navArtwork: Record<string, Admin3DIconName> = {
    dashboard: 'dashboard', 'booking-work': 'reservation', 'quote-work': 'idea',
    'product-work': 'travel', 'assignment-work': 'customer',
    'customer-content': 'message', 'site-management': 'target',
};

const quoteItem = (key: string, label?: string): NavItem => {
    const tool = QUOTE_DESK_TOOLS.find((entry) => entry.key === key)!;
    return { id: quoteDeskPageId(key), icon: tool.icon, label: label ?? tool.label, href: quoteDeskHref(key) };
};

const navGroups: NavGroup[] = [
    {
        id: 'booking-work', icon: 'assignment', label: '예약 관리',
        relatedPages: [quoteDeskPageId('bookings')],
        items: [
            { id: 'reservations', icon: 'assignment', label: '통합 예약 목록', href: '/admin/reservations' },
            { id: 'calendar', icon: 'calendar_today', label: '투어 캘린더', href: '/admin/calendar' },
        ],
    },
    {
        id: 'quote-work', icon: 'request_quote', label: '견적 관리',
        relatedPages: [quoteDeskPageId('builder')],
        items: [
            quoteItem('inbox'),
            quoteItem('courses'),
            quoteItem('itinerary'),
            quoteItem('spots', '여행지 관리'),
        ],
    },
    {
        id: 'product-work', icon: 'inventory_2', label: '상품 관리',
        items: [
            { id: 'products', icon: 'inventory_2', label: '상품 목록', href: '/admin/products' },
            { id: 'categories', icon: 'category', label: '상품 카테고리', href: '/admin/categories' },
            { id: 'templates', icon: 'folder_special', label: '문서 템플릿', href: '/admin/templates' },
        ],
    },
    {
        id: 'assignment-work', icon: 'groups', label: '배정·자원',
        items: [
            { id: 'accommodation-ops', icon: 'night_shelter', label: '숙소 배정 · 현지 운영', href: '/admin/accommodation-ops' },
            quoteItem('resources', '가이드·숙소·차량'),
        ],
    },
    {
        id: 'customer-content', icon: 'mail', label: '고객·콘텐츠',
        items: [
            { id: 'inquiries', icon: 'mail', label: '일반 문의', href: '/admin/inquiries' },
            { id: 'reviews', icon: 'reviews', label: '후기 관리', href: '/admin/reviews' },
            { id: 'faq', icon: 'help', label: 'FAQ 관리', href: '/admin/faq' },
            { id: 'magazines', icon: 'menu_book', label: '매거진 관리', href: '/admin/magazines' },
        ],
    },
    {
        id: 'site-management', icon: 'ad_units', label: '사이트 관리',
        items: [
            { id: 'banners', icon: 'ad_units', label: '홈 화면 관리', href: '/admin/banners' },
            { id: 'promotions', icon: 'campaign', label: '여행기획전 관리', href: '/admin/promotions' },
        ],
    },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activePage }) => {
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

    const renderItem = (item: NavItem) => {
        const isActive = activePage === item.id;
        return (
            <Link key={item.id} to={item.href} className={`nav-item${isActive ? ' active' : ''}`} aria-current={isActive ? 'page' : undefined}>
                {navArtwork[item.id] ? <Admin3DIcon name={navArtwork[item.id]} fallback={item.icon} size={28} className="admin-nav-art" /> : <Icon name={item.icon} fill={isActive} />}
                <span>{item.label}</span>
            </Link>
        );
    };

    return (
        <aside className="side">
            <Link to="/admin" className="side-brand" aria-label="몽골리아 은하수 관리자 홈">
                <span className="brand-mark"><Icon name="flight_takeoff" /></span>
                <div>
                    <div className="brand-name">몽골리아 은하수</div>
                    <div className="brand-sub">통합 관리자</div>
                </div>
            </Link>

            <nav className="side-nav" ref={navRef} aria-label="관리자 업무 메뉴">
                {renderItem(dashboardItem)}
                {navGroups.map((group) => {
                    const isOpen = expandedGroup === group.id;
                    const isCurrent = activeGroupId === group.id;
                    const panelId = `admin-nav-${group.id}`;
                    return (
                        <div className={`nav-group${isOpen ? ' is-open' : ''}`} key={group.id}>
                            <button
                                type="button"
                                className={`nav-group-toggle${isCurrent ? ' is-current' : ''}`}
                                aria-expanded={isOpen}
                                aria-controls={panelId}
                                onClick={() => setExpandedGroup(isOpen ? null : group.id)}
                            >
                                <Admin3DIcon name={navArtwork[group.id]} fallback={group.icon} size={28} className="admin-nav-art" />
                                <span>{group.label}</span>
                                <svg className="nav-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                    <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </button>
                            <div className="nav-submenu" id={panelId} hidden={!isOpen}>
                                {group.items.map(renderItem)}
                            </div>
                        </div>
                    );
                })}
            </nav>

            <div className="side-foot">
                <div className="side-account">
                    <span className="av">관</span>
                    <div className="who">
                        <b>관리자</b>
                        <span>운영 계정 · 마스터</span>
                    </div>
                    <button type="button" className="out" title="로그아웃" aria-label="로그아웃" onClick={handleLogout}>
                        <Icon name="logout" />
                    </button>
                </div>
            </div>
        </aside>
    );
};
