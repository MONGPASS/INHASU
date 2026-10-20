import React, { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminToolbar } from './AdminToolbar';
import '../../styles/admin-console.css';
import '../../styles/admin-redesign-pages.css';
import '../../styles/admin-redesign-catalog.css';
import '../../styles/admin-redesign-home.css';
import '../../styles/admin-redesign-content.css';
import '../../styles/admin-redesign-shell.css';

interface AdminLayoutProps {
    activePage: string;
    title: string;
    description?: string;
    /** small uppercase label above the title; defaults from the page section */
    eyebrow?: string;
    /** 검색은 선택적으로 표시하며 업무 알림은 항상 제공한다. */
    showSearch?: boolean;
    /** kept for backward-compat with existing call sites; redesign is light-only */
    isDarkMode?: boolean;
    toggleTheme?: () => void;
    actions?: React.ReactNode;
    /**
     * 본문 여백·최대 폭 없이 children 이 상단 바 아래 영역(뷰포트 − 상단 바)을 꽉 채운다.
     * 끼워 넣은 화면(맞춤 견적 데스크의 iframe)용 — children 의 최상위 요소에 `flex: 1` 을 주면 된다.
     */
    flush?: boolean;
    /** A full page editor supplies its own heading and tab navigation. */
    hidePageHeading?: boolean;
    children: React.ReactNode;
}

const EYEBROW: Record<string, string> = {
    dashboard: '관리자 콘솔',
    reservations: '운영', calendar: '운영', guides: '운영',
    products: '카탈로그', templates: '카탈로그',
    magazines: '콘텐츠', reviews: '콘텐츠', faq: '콘텐츠',
    banners: '사이트 설정', categories: '카탈로그',
    accommodations: '사이트 설정',
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
    activePage, title, description, eyebrow, showSearch = true, actions, flush = false, hidePageHeading = false, children,
}) => {
    const eb = eyebrow || EYEBROW[activePage] || '관리자 콘솔';
    const location = useLocation();
    const customerLayout = location.pathname.startsWith('/admin/customer-workspace/');
    const showPageHeading = !flush && !customerLayout && !hidePageHeading;
    const [narrowViewport, setNarrowViewport] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        if (typeof window === 'undefined') return false;
        try {
            const saved = window.localStorage.getItem('mw-admin-sidebar-collapsed-v1');
            if (saved !== null) return saved === 'true';
        } catch { /* Browser storage is optional for a display preference. */ }
        return window.matchMedia('(min-width: 761px) and (max-width: 1050px)').matches;
    });
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
    const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const menuPanelRef = useRef<HTMLDivElement>(null);
    const actionButtonRef = useRef<HTMLButtonElement>(null);
    const actionPanelRef = useRef<HTMLDivElement>(null);
    const id = useId().replace(/:/g, '');
    const menuId = `admin-menu-${id}`;
    const actionsId = `admin-actions-${id}`;
    const menuShown = narrowViewport && mobileMenuOpen;
    const collapsed = !narrowViewport && sidebarCollapsed;
    const closeMenu = () => {
        setMobileMenuOpen(false);
        requestAnimationFrame(() => {
            const trigger = menuButtonRef.current || document.querySelector<HTMLButtonElement>('.admin-menu-toggle');
            if (trigger?.getClientRects().length) trigger.focus();
            else document.querySelector<HTMLButtonElement>('.side-rail-toggle')?.focus();
        });
    };
    useEffect(() => {
        try { window.localStorage.setItem('mw-admin-sidebar-collapsed-v1', String(sidebarCollapsed)); } catch { /* optional */ }
    }, [sidebarCollapsed]);
    useEffect(() => {
        const viewport = window.matchMedia('(max-width: 760px)');
        const update = () => { setNarrowViewport(viewport.matches); if (!viewport.matches) { setMobileMenuOpen(false); setMobileActionsOpen(false); } };
        update(); viewport.addEventListener('change', update);
        return () => viewport.removeEventListener('change', update);
    }, []);
    useEffect(() => { if (mobileMenuOpen) closeMenu(); setMobileActionsOpen(false); }, [location.key]);
    useEffect(() => {
        if (!menuShown) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        menuPanelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        return () => { document.body.style.overflow = previousOverflow; };
    }, [menuShown]);
    useEffect(() => {
        if (!mobileActionsOpen) return;
        const outside = (event: PointerEvent) => {
            if (!actionPanelRef.current?.contains(event.target as Node) && !actionButtonRef.current?.contains(event.target as Node)) setMobileActionsOpen(false);
        };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileActionsOpen(false); actionButtonRef.current?.focus(); } };
        document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
    }, [mobileActionsOpen]);
    return (
        <div className={`app admin-redesign-shell${customerLayout ? ' admin-customer-layout' : ''}${collapsed ? ' admin-shell-rail' : ''}${flush ? ' admin-shell-flush' : ''}${menuShown ? ' admin-menu-open' : ''}`}>
                {menuShown && <button type="button" className="admin-menu-backdrop" aria-label="관리자 메뉴 배경 닫기" tabIndex={-1} onClick={closeMenu} />}
                <div ref={menuPanelRef} id={menuId} className="admin-menu-panel" role={menuShown ? 'dialog' : undefined} aria-modal={menuShown ? true : undefined} aria-label={menuShown ? '관리자 메뉴' : undefined}
                    onClickCapture={event => { if (menuShown && (event.target as Element).closest('a[href]')) closeMenu(); }}
                    onKeyDown={event => {
                        if (!menuShown) return;
                        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(); return; }
                        if (event.key !== 'Tab') return;
                        const items = Array.from(menuPanelRef.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),[tabindex="0"]') || []).filter(element => element.offsetParent !== null);
                        const first = items[0], last = items[items.length - 1];
                        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                    }}>
                    <button type="button" className="admin-menu-close" aria-label="관리자 메뉴 닫기" onClick={closeMenu}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
                    <AdminSidebar activePage={activePage} collapsed={collapsed} onToggleCollapsed={() => setSidebarCollapsed(value => !value)} onExpand={() => setSidebarCollapsed(false)} onLogoutConfirmChange={setLogoutDialogOpen} />
                </div>
            <div className="main" inert={menuShown || logoutDialogOpen}>
                <header className="header">
                    <div className="header-in">
                        <button ref={menuButtonRef} type="button" className="admin-menu-toggle" aria-label="관리자 메뉴 열기" aria-expanded={menuShown} aria-controls={menuId} onClick={() => { setMobileActionsOpen(false); setMobileMenuOpen(true); }}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
                        <div className="header-spacer" />
                        <div className="header-tools">
                            <AdminToolbar showSearch={showSearch} />
                            {!showPageHeading && actions && <>
                                <button ref={actionButtonRef} type="button" className="admin-actions-toggle" aria-label="페이지 추가 작업" aria-expanded={mobileActionsOpen} aria-controls={actionsId} onClick={() => setMobileActionsOpen(value => !value)}><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="16" cy="10" r="1.6" /></svg></button>
                                <div ref={actionPanelRef} id={actionsId} className={`admin-header-actions${mobileActionsOpen ? ' is-open' : ''}`} onClick={event => { if ((event.target as Element).closest('button,a[href]')) setMobileActionsOpen(false); }}>{actions}</div>
                            </>}
                        </div>
                    </div>
                </header>

                {flush ? (
                    <div className="content" style={{ padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        {children}
                    </div>
                ) : (
                    <div className="content"><div className="content-in">
                        {showPageHeading && <div className="admin-page-heading">
                            <div className="admin-layout-heading">
                                <div className="eyebrow">{eb}</div>
                                <h1 className="page-title">{title}</h1>
                                {description && <p className="admin-page-description">{description}</p>}
                            </div>
                            {actions && <div className="admin-page-actions">{actions}</div>}
                        </div>}
                        {children}
                    </div></div>
                )}
            </div>
        </div>
    );
};
