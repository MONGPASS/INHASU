import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { Icon } from './console/Icon';
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
    count?: number;
}

const primaryItems: NavItem[] = [
    { id: 'dashboard', icon: 'dashboard', label: '대시보드', href: '/admin' },
    { id: 'reservations', icon: 'assignment', label: '통합 예약 관리', href: '/admin/reservations' },
    { id: 'accommodation-ops', icon: 'night_shelter', label: 'Байр захиалга · 숙소배정', href: '/admin/accommodation-ops' },
    { id: 'calendar', icon: 'calendar_today', label: '투어 캘린더', href: '/admin/calendar' },
];

// 맞춤 견적 — 견적 관리 도구(public/*.html)를 관리자 안에 끼워 넣은 화면들 (pages/AdminQuoteDesk)
const quoteDeskItems: NavItem[] = QUOTE_DESK_TOOLS.map((tool) => ({
    id: quoteDeskPageId(tool.key),
    icon: tool.icon,
    label: tool.label,
    href: quoteDeskHref(tool.key),
}));

const catalogItems: NavItem[] = [
    { id: 'products', icon: 'inventory_2', label: '상품 관리', href: '/admin/products' },
    { id: 'magazines', icon: 'menu_book', label: '매거진 관리', href: '/admin/magazines' },
    { id: 'templates', icon: 'folder_special', label: '템플릿 관리', href: '/admin/templates' },
    { id: 'reviews', icon: 'reviews', label: '후기 관리', href: '/admin/reviews' },
    { id: 'faq', icon: 'help', label: 'FAQ 관리', href: '/admin/faq' },
    { id: 'inquiries', icon: 'mail', label: '문의 관리', href: '/admin/inquiries' },
];

const settingItems: NavItem[] = [
    { id: 'banners', icon: 'ad_units', label: '홈 화면 관리', href: '/admin/banners' },
    { id: 'promotions', icon: 'campaign', label: '여행기획전 관리', href: '/admin/promotions' },
    { id: 'categories', icon: 'category', label: '카테고리 관리', href: '/admin/categories' },
    { id: 'hotels', icon: 'hotel', label: '호텔 마스터', href: '/admin/hotels' },
    { id: 'tourist-spots', icon: 'location_on', label: '관광지 마스터', href: '/admin/tourist-spots' },
    { id: 'design-spots', icon: 'photo_library', label: '여행지 사진', href: '/admin/design-spots' },
    { id: 'guide-intro', icon: 'translate', label: '가이드 소개 (공통)', href: '/admin/guide-intro' },
];

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activePage }) => {
    const navigate = useNavigate();
    let logout: undefined | (() => void | Promise<void>);
    try { logout = useUser().logout; } catch { logout = undefined; }

    // 메뉴가 길어 스크롤되므로, 현재 메뉴가 가려져 있으면 보이는 곳까지만 옮긴다.
    const navRef = useRef<HTMLElement>(null);
    useEffect(() => {
        navRef.current?.querySelector('.nav-item.active')?.scrollIntoView({ block: 'nearest' });
    }, [activePage]);

    const handleLogout = async () => {
        // 견적 도구가 쓰는 관리자 값(sessionStorage)도 함께 지운다.
        disconnectQuoteDesk();
        try { await logout?.(); } catch { /* ignore */ }
        navigate('/admin/login');
    };

    const renderItem = (item: NavItem) => {
        const isActive = activePage === item.id;
        return (
            <a key={item.id} href={item.href} className={`nav-item${isActive ? ' active' : ''}`} aria-current={isActive ? 'page' : undefined}>
                <Icon name={item.icon} fill={isActive} />
                <span>{item.label}</span>
                {item.count ? <span className="nav-count">{item.count}</span> : null}
            </a>
        );
    };

    return (
        <aside className="side">
            <a href="/admin" className="side-brand" aria-label="몽골리아 은하수 관리자 홈">
                <span className="brand-mark"><Icon name="flight_takeoff" /></span>
                <div>
                    <div className="brand-name">몽골리아 은하수</div>
                    <div className="brand-sub">통합 관리자</div>
                </div>
            </a>

            <nav className="side-nav" ref={navRef}>
                {primaryItems.map(renderItem)}
                <div className="nav-group-label">맞춤 견적</div>
                {quoteDeskItems.map(renderItem)}
                <div className="nav-group-label">상품 · 콘텐츠</div>
                {catalogItems.map(renderItem)}
                <div className="nav-group-label">사이트 설정</div>
                {settingItems.map(renderItem)}
            </nav>

            <div className="side-foot">
                <div className="side-account">
                    <span className="av">관</span>
                    <div className="who">
                        <b>관리자</b>
                        <span>운영 계정 · 마스터</span>
                    </div>
                    <button className="out" title="로그아웃" onClick={handleLogout}>
                        <Icon name="logout" />
                    </button>
                </div>
            </div>
        </aside>
    );
};
