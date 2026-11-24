import React, { useEffect, useId, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminToolbar } from './AdminToolbar';
import { adminSectionLabel } from './adminNav';
import { AdminIconButton } from './ui/AdminButton';
import { IconMenu, IconMoreHorizontal } from './ui/AdminIcons';
import { AdminMobileTabBar } from './ui/AdminMobileTabBar';
import { useCardTables } from './ui/useCardTables';
import { useAdminInstallMeta } from './ui/useAdminInstallMeta';
import '../../styles/adminShell';

const RAIL_KEY = 'mw-admin-side-rail';
const readRail = () => { try { return window.localStorage.getItem(RAIL_KEY) === '1'; } catch { return false; } };

interface AdminLayoutProps {
    activePage: string;
    title: string;
    description?: string;
    /** small uppercase label above the title; defaults from the page section. `null`이면 표시하지 않는다. */
    eyebrow?: string | null;
    /** 검색은 선택적으로 표시하며 업무 알림은 항상 제공한다. */
    showSearch?: boolean;
    /** kept for backward-compat with existing call sites; redesign is light-only */
    isDarkMode?: boolean;
    toggleTheme?: () => void;
    actions?: React.ReactNode;
    /** 제목 바로 옆(같은 줄)에 두는 화면 안 이동 탭. 주면 제목 줄 아래에 구분선을 긋는다. */
    titleAside?: React.ReactNode;
    /**
     * 본문 여백·최대 폭 없이 children 이 상단 바 아래 영역(뷰포트 − 상단 바)을 꽉 채운다.
     * 끼워 넣은 화면(맞춤 견적 데스크의 iframe)용 — children 의 최상위 요소에 `flex: 1` 을 주면 된다.
     */
    flush?: boolean;
    /** 편집 화면처럼 제목·설명·작업 버튼을 숨긴다. 상단 바(검색·알림)·사이드바·좁은 화면 메뉴 토글은 유지한다. */
    hideHeading?: boolean;
    /** 제목·설명 줄만 숨기고 화면이 본문에서 직접 머리를 그린다(대시보드 인사말). 위치 표시·휴대폰 아래 메뉴는 그대로. */
    headingInBody?: boolean;
    children: React.ReactNode;
}

const EYEBROW: Record<string, string> = {
    dashboard: '관리자 콘솔',
    reservations: '운영', calendar: '운영', guides: '운영',
    products: '카탈로그',
    magazines: '콘텐츠', templates: '콘텐츠', reviews: '콘텐츠', faq: '콘텐츠',
    banners: '사이트 설정', categories: '사이트 설정', hotels: '사이트 설정',
    'tourist-spots': '사이트 설정', 'design-spots': '사이트 설정', accommodations: '사이트 설정', 'guide-intro': '사이트 설정',
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({
    activePage, title, description, eyebrow, showSearch = true, actions, titleAside, flush = false, hideHeading = false, headingInBody = false, children,
}) => {
    const eb = eyebrow === null ? null : eyebrow || EYEBROW[activePage] || '관리자 콘솔';
    const location = useLocation();
    const customerLayout = location.pathname.startsWith('/admin/customer-workspace/');
    const [narrowCustomer, setNarrowCustomer] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
    // 사이드바 접기는 이 브라우저의 편의 설정이며 저장 실패 시에도 화면은 동작한다.
    const [rail, setRail] = useState(() => typeof window !== 'undefined' && readRail());
    const toggleRail = () => setRail(value => {
        try { window.localStorage.setItem(RAIL_KEY, value ? '0' : '1'); } catch { /* 저장소를 쓸 수 없는 창 */ }
        return !value;
    });
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const menuPanelRef = useRef<HTMLDivElement>(null);
    const actionButtonRef = useRef<HTMLButtonElement>(null);
    const actionPanelRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    useCardTables(contentRef);
    useAdminInstallMeta();
    const id = useId().replace(/:/g, '');
    const menuId = `admin-customer-menu-${id}`;
    const actionsId = `admin-customer-actions-${id}`;
    // 휴대폰 폭에서는 모든 화면이 같은 앱 틀(위 바 + 아래 메뉴 + 서랍 메뉴)을 쓴다.
    const menuShown = narrowCustomer && mobileMenuOpen;
    // 사이드바 접기는 사용자가 직접 고른 설정만 따른다(편집 화면이라고 자동으로 접지 않는다. 본문은 --adm-content-max까지만 넓어진다).
    const railShown = rail;
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
    // 화면을 옮기면 휴대폰 메뉴·작업 패널을 닫는다. effect가 아니라 그리는 중에 맞춰 한 번 더 그리지 않게 한다(React 권장 방식).
    const [seenLocationKey, setSeenLocationKey] = useState(location.key);
    if (seenLocationKey !== location.key) { setSeenLocationKey(location.key); setMobileMenuOpen(false); setMobileActionsOpen(false); }
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
        <div className={`app${customerLayout ? ' admin-customer-layout' : ''}${menuShown ? ' admin-customer-menu-open' : ''}${railShown && !menuShown ? ' is-side-rail' : ''}${hideHeading ? ' is-editing' : ''}`}>
            <>
                {/* 서랍 뒤 어두운 막: 누르면 닫힌다. 키보드는 서랍 안 닫기 버튼·Esc로 닫으니 막은 초점을 받지 않는다 */}
                {menuShown && <div className="admin-customer-menu-backdrop" aria-hidden="true" onClick={closeMenu} />}
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
                    {/* 휴대폰 서랍이면 사이드바가 닫기 버튼·큰 줄·사이트 보기/로그아웃을 그린다 */}
                    <AdminSidebar activePage={activePage} rail={railShown && !menuShown} onToggleRail={menuShown || hideHeading ? undefined : toggleRail} onClose={menuShown ? closeMenu : undefined} />
                </div>
            </>
            <div className={`main${flush ? ' is-flush' : ''}`} inert={menuShown}>
                <header className={`header${hideHeading ? ' is-heading-hidden' : ''}`}>
                    <div className="header-in">
                        <AdminIconButton ref={menuButtonRef} className="admin-customer-menu-toggle" label="관리자 메뉴 열기" aria-expanded={menuShown} aria-controls={menuId} onClick={() => { setMobileActionsOpen(false); setMobileMenuOpen(true); }}><IconMenu /></AdminIconButton>
                        {!hideHeading && <nav className="admin-breadcrumb" aria-label="현재 위치"><span>{adminSectionLabel(activePage)}</span><span aria-hidden="true">/</span><b aria-current="page">{title}</b></nav>}
                        {!hideHeading && !headingInBody && <div className={`admin-layout-heading${titleAside ? ' has-aside' : ''}`}>
                            {eb && <div className="eyebrow"><span className="dot" />{eb}</div>}
                            <div className="page-title">{title}</div>
                            {titleAside && <div className="admin-layout-title-aside">{titleAside}</div>}
                            {description && (
                                <div className="cell-muted">{description}</div>
                            )}
                        </div>}
                        <div className="header-spacer" />
                        <div className="header-tools">
                            <AdminToolbar showSearch={showSearch} />
                            {hideHeading ? null : customerLayout && actions ? <>
                                <AdminIconButton ref={actionButtonRef} className="admin-customer-actions-toggle" label="고객 관리 추가 작업" aria-expanded={mobileActionsOpen} aria-controls={actionsId} onClick={() => setMobileActionsOpen(value => !value)}><IconMoreHorizontal /></AdminIconButton>
                                <div ref={actionPanelRef} id={actionsId} className={`admin-customer-header-actions${mobileActionsOpen ? ' is-open' : ''}`} onClick={event => { if ((event.target as Element).closest('button,a[href]')) setMobileActionsOpen(false); }}>{actions}</div>
                            </> : actions && <div className="admin-page-actions">{actions}</div>}
                        </div>
                    </div>
                </header>

                {flush ? (
                    <div ref={contentRef} className="content">
                        {children}
                    </div>
                ) : (
                    <div ref={contentRef} className="content"><div className="content-in">{children}</div></div>
                )}
            </div>
            {!hideHeading && <AdminMobileTabBar activePage={activePage} menuOpen={menuShown} menuId={menuId} onOpenMenu={() => { setMobileActionsOpen(false); setMobileMenuOpen(true); }} />}
        </div>
    );
};
