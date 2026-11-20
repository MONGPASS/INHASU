import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../../contexts/UserContext';
import { DashboardIcon } from './dashboard/DashboardIcon';
import { disconnectQuoteDesk } from './quoteDesk';
import { dashboardItem, navGroups, sections, type NavItem } from './adminNav';
import { preloadAdminPage } from '../../lib/adminPagePreload';

interface AdminSidebarProps {
    activePage: string;
    /** 아이콘만 보이는 좁은 메뉴 (디자인 v3의 접기). */
    rail?: boolean;
    onToggleRail?: () => void;
    /** kept for backward-compat with existing call sites; the redesign is light-only */
    isDarkMode?: boolean;
    toggleTheme?: () => void;
}

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
            <Link key={item.id} to={item.href} className={`nav-item${isActive ? ' active' : ''}`} aria-current={isActive ? 'page' : undefined} title={rail ? item.label : undefined}
                onPointerEnter={() => preloadAdminPage(item.href)} onFocus={() => preloadAdminPage(item.href)} onPointerDown={() => preloadAdminPage(item.href)}>
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

            <Link to="/admin" className="side-brand" aria-label="몽골리아 은하수 관리자 대시보드" title={rail ? '몽골리아 은하수 관리자' : undefined}>
                <span className="side-brand-mark" aria-hidden="true">은</span>
                <span className="side-brand-text"><b>몽골리아 은하수</b><small>관리자</small></span>
            </Link>

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
                                            preloadAdminPage(group.items[0].href);
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
