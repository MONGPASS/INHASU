import React, { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminToolbar } from './AdminToolbar';
import '../../styles/admin-console.css';

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
    children: React.ReactNode;
}

const EYEBROW: Record<string, string> = {
    dashboard: '관리자 콘솔',
    reservations: '운영', calendar: '운영', guides: '운영',
    products: '카탈로그', templates: '카탈로그',
    magazines: '콘텐츠', reviews: '콘텐츠', faq: '콘텐츠',
    banners: '사이트 설정', categories: '사이트 설정',
    accommodations: '사이트 설정',
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
    activePage, title, description, eyebrow, showSearch = true, actions, flush = false, children,
}) => {
    const eb = eyebrow || EYEBROW[activePage] || '관리자 콘솔';
    const location = useLocation();
    const customerLayout = location.pathname.startsWith('/admin/customer-workspace/');
    const [narrowCustomer, setNarrowCustomer] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const menuPanelRef = useRef<HTMLDivElement>(null);
    const actionButtonRef = useRef<HTMLButtonElement>(null);
    const actionPanelRef = useRef<HTMLDivElement>(null);
    const id = useId().replace(/:/g, '');
    const menuId = `admin-customer-menu-${id}`;
    const actionsId = `admin-customer-actions-${id}`;
    const menuShown = customerLayout && narrowCustomer && mobileMenuOpen;
    const closeMenu = () => {
        setMobileMenuOpen(false);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
    };
    useEffect(() => {
        const viewport = window.matchMedia('(max-width: 760px)');
        const update = () => { setNarrowCustomer(viewport.matches); if (!viewport.matches) { setMobileMenuOpen(false); setMobileActionsOpen(false); } };
        update(); viewport.addEventListener('change', update);
        return () => viewport.removeEventListener('change', update);
    }, []);
    useEffect(() => { setMobileMenuOpen(false); setMobileActionsOpen(false); }, [location.key]);
    useEffect(() => {
        if (!menuShown) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        menuPanelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
        return () => { document.body.style.overflow = previousOverflow; };
    }, [menuShown]);
    useEffect(() => {
        if (!mobileActionsOpen || !customerLayout || !narrowCustomer) return;
        const outside = (event: PointerEvent) => {
            if (!actionPanelRef.current?.contains(event.target as Node) && !actionButtonRef.current?.contains(event.target as Node)) setMobileActionsOpen(false);
        };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMobileActionsOpen(false); actionButtonRef.current?.focus(); } };
        document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
    }, [mobileActionsOpen, customerLayout, narrowCustomer]);
    return (
        <div className={`app${customerLayout ? ' admin-customer-layout' : ''}${menuShown ? ' admin-customer-menu-open' : ''}`}>
            {customerLayout ? <>
                {menuShown && <button type="button" className="admin-customer-menu-backdrop" aria-label="관리자 메뉴 배경 닫기" tabIndex={-1} onClick={closeMenu} />}
                <div ref={menuPanelRef} id={menuId} className="admin-customer-menu-panel" role={menuShown ? 'dialog' : undefined} aria-modal={menuShown ? true : undefined} aria-label={menuShown ? '관리자 메뉴' : undefined}
                    onClickCapture={event => { if (menuShown && (event.target as Element).closest('a[href]')) setMobileMenuOpen(false); }}
                    onKeyDown={event => {
                        if (!menuShown) return;
                        if (event.key === 'Escape') { event.preventDefault(); closeMenu(); return; }
                        if (event.key !== 'Tab') return;
                        const items = Array.from(menuPanelRef.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),[tabindex="0"]') || []).filter(element => element.offsetParent !== null);
                        const first = items[0], last = items[items.length - 1];
                        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
                        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
                    }}>
                    <button type="button" className="admin-customer-menu-close" aria-label="관리자 메뉴 닫기" onClick={closeMenu}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
                    <AdminSidebar activePage={activePage} />
                </div>
            </> : <AdminSidebar activePage={activePage} />}
            <div className="main" inert={menuShown} style={flush ? { height: '100vh' } : undefined}>
                <header className="header">
                    <div className="header-in">
                        {customerLayout && <button ref={menuButtonRef} type="button" className="admin-customer-menu-toggle" aria-label="관리자 메뉴 열기" aria-expanded={menuShown} aria-controls={menuId} onClick={() => { setMobileActionsOpen(false); setMobileMenuOpen(true); }}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 5h12M4 10h12M4 15h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></button>}
                        <div className="admin-layout-heading" style={{ minWidth: 0 }}>
                            <div className="eyebrow"><span className="dot" />{eb}</div>
                            <div className="page-title">{title}</div>
                            {description && (
                                <div className="cell-muted" style={{ fontSize: 12.5, marginTop: 2 }}>{description}</div>
                            )}
                        </div>
                        <div className="header-spacer" />
                        <div className="header-tools">
                            <AdminToolbar showSearch={showSearch} />
                            {customerLayout && actions ? <>
                                <button ref={actionButtonRef} type="button" className="admin-customer-actions-toggle" aria-label="고객 관리 추가 작업" aria-expanded={mobileActionsOpen} aria-controls={actionsId} onClick={() => setMobileActionsOpen(value => !value)}><svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="16" cy="10" r="1.6" /></svg></button>
                                <div ref={actionPanelRef} id={actionsId} className={`admin-customer-header-actions${mobileActionsOpen ? ' is-open' : ''}`} onClick={event => { if ((event.target as Element).closest('button,a[href]')) setMobileActionsOpen(false); }}>{actions}</div>
                            </> : actions}
                        </div>
                    </div>
                </header>

                {flush ? (
                    <div className="content" style={{ padding: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        {children}
                    </div>
                ) : (
                    <div className="content"><div className="content-in">{children}</div></div>
                )}
            </div>
        </div>
    );
};
