import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { Icon } from './console/Icon';
import { QUOTE_DESK_TOOLS, disconnectQuoteDesk, quoteDeskHref, quoteDeskPageId } from './quoteDesk';

interface AdminSidebarProps {
    activePage: string;
    collapsed?: boolean;
    onToggleCollapsed?: () => void;
    onExpand?: () => void;
    onLogoutConfirmChange?: (open: boolean) => void;
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

export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activePage, collapsed = false, onToggleCollapsed, onExpand, onLogoutConfirmChange }) => {
    const navigate = useNavigate();
    let logout: undefined | (() => void | Promise<void>);
    let accountName = '관리자';
    try { const account = useUser(); logout = account.logout; accountName = account.user?.name || '관리자'; } catch { logout = undefined; }

    const activeGroupId = navGroups.find((group) => (
        group.items.some((item) => item.id === activePage) || group.relatedPages?.includes(activePage)
    ))?.id ?? null;
    const [expandedGroup, setExpandedGroup] = useState<string | null>(activeGroupId);
    const navRef = useRef<HTMLElement>(null);
    const [logoutConfirm, setLogoutConfirm] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const logoutButton = useRef<HTMLButtonElement>(null);
    const logoutPanel = useRef<HTMLDivElement>(null);
    const cancelLogout = () => { setLogoutConfirm(false); requestAnimationFrame(() => logoutButton.current?.focus()); };
    useEffect(() => {
        onLogoutConfirmChange?.(logoutConfirm);
        if (logoutConfirm) logoutPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }, [logoutConfirm, onLogoutConfirmChange]);

    // 현재 업무만 먼저 펼친다. 다른 화면으로 이동하면 해당 업무 메뉴를 자동으로 연다.
    useEffect(() => {
        setExpandedGroup(activeGroupId);
        const frame = window.requestAnimationFrame(() => {
            navRef.current?.querySelector('.nav-item.active, .nav-group-toggle.is-current')?.scrollIntoView({ block: 'nearest' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activePage, activeGroupId]);

    const handleLogout = async () => {
        if (loggingOut) return;
        setLoggingOut(true);
        // 견적 도구가 쓰는 관리자 값(sessionStorage)도 함께 지운다.
        disconnectQuoteDesk();
        try { await logout?.(); } catch { /* ignore */ }
        navigate('/admin/login');
    };

    const renderItem = (item: NavItem) => {
        const isActive = activePage === item.id;
        return (
            <Link key={item.id} to={item.href} className={`nav-item${isActive ? ' active' : ''}`} aria-label={collapsed ? item.label : undefined} title={item.label} aria-current={isActive ? 'page' : undefined}>
                <Icon name={item.icon} />
                <span className="nav-label">{item.label}</span>
            </Link>
        );
    };

    const renderGroup = (group: NavGroup) => {
        const isOpen = !collapsed && expandedGroup === group.id;
        const isCurrent = activeGroupId === group.id;
        const panelId = `admin-nav-${group.id}`;
        return (
            <div className={`nav-group${isOpen ? ' is-open' : ''}`} key={group.id}>
                <button type="button" className={`nav-group-toggle${isCurrent ? ' is-current' : ''}`}
                    aria-expanded={isOpen} aria-controls={panelId} aria-label={collapsed ? group.label : undefined} title={group.label}
                    onClick={() => { if (collapsed) onExpand?.(); setExpandedGroup(isOpen ? null : group.id); }}>
                    <Icon name={group.icon} />
                    <span className="nav-label">{group.label}</span>
                    <svg className="nav-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <div className="nav-submenu" id={panelId} hidden={!isOpen}>{group.items.map(renderItem)}</div>
            </div>
        );
    };

    return (
        <aside className={`side${collapsed ? ' is-collapsed' : ''}`}>
            {onToggleCollapsed && <div className="side-rail-control" inert={logoutConfirm}><button type="button" className="side-rail-toggle" aria-label={collapsed ? '관리자 메뉴 펼치기' : '관리자 메뉴 접기'} title={collapsed ? '관리자 메뉴 펼치기' : '관리자 메뉴 접기'} aria-expanded={!collapsed} onClick={onToggleCollapsed}><svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d={collapsed ? 'm7 4 5 5-5 5' : 'm11 4-5 5 5 5'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div>}
            <nav className="side-nav" ref={navRef} aria-label="관리자 업무 메뉴" inert={logoutConfirm}>
                <section className="nav-section" aria-label="주요 메뉴">
                    <div className="nav-section-title" aria-hidden="true">MAIN MENU</div>
                    {renderItem(dashboardItem)}
                    {navGroups.slice(0, 4).map(renderGroup)}
                </section>
                <section className="nav-section" aria-label="기타 메뉴">
                    <div className="nav-section-title" aria-hidden="true">OTHER</div>
                    {navGroups.slice(4).map(renderGroup)}
                </section>
            </nav>

            <div className="side-foot">
                <div className="side-account" inert={logoutConfirm}>
                    <span className="av" aria-hidden="true">{accountName.slice(0, 1)}</span>
                    <div className="who">
                        <b title={accountName}>{accountName}</b>
                        <span>관리자 계정</span>
                    </div>
                    <button ref={logoutButton} type="button" className="out" title="로그아웃" aria-label="로그아웃" aria-haspopup="dialog" aria-expanded={logoutConfirm} onClick={() => setLogoutConfirm(true)}>
                        <Icon name="logout" />
                    </button>
                </div>
                {logoutConfirm && <>
                    <button type="button" className="admin-logout-backdrop" aria-label="로그아웃 확인 닫기" tabIndex={-1} disabled={loggingOut} onClick={cancelLogout} />
                    <div ref={logoutPanel} className="admin-logout-confirm" role="alertdialog" aria-modal="true" aria-labelledby="admin-logout-title" aria-describedby="admin-logout-description" onKeyDown={event => {
                        if (event.key === 'Escape' && !loggingOut) { event.preventDefault(); event.stopPropagation(); cancelLogout(); }
                        if (event.key !== 'Tab') return;
                        const buttons = Array.from(logoutPanel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') || []);
                        if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1)?.focus(); }
                        else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0]?.focus(); }
                    }}>
                        <strong id="admin-logout-title">로그아웃할까요?</strong>
                        <p id="admin-logout-description">저장하지 않은 입력 내용은 사라질 수 있어요.</p>
                        <div><button type="button" disabled={loggingOut} onClick={cancelLogout}>취소</button><button type="button" disabled={loggingOut} onClick={() => { void handleLogout(); }}>{loggingOut ? '로그아웃 중…' : '로그아웃'}</button></div>
                    </div>
                </>}
            </div>
        </aside>
    );
};
