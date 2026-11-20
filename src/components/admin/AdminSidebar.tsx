import React, { useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    IconApps, IconBook, IconCalendar, IconChevronLeft, IconChevronRight, IconCircleQuestion, IconClock, IconDocument, IconDocumentText,
    IconFlag, IconFolder, IconHome, IconImage, IconLocation, IconLogout, IconMail, IconMegaphone, IconPerson, IconPersons, IconStar, IconTag, IconTicket,
} from '@montage-ui/icon';
import { useUser } from '../../contexts/UserContext';
import { disconnectQuoteDesk, quoteDeskPageId } from './quoteDesk';
import { dashboardItem, navGroups, sections, type NavItem } from './adminNav';
import { preloadAdminPage } from '../../lib/adminPagePreload';

interface AdminSidebarProps {
    activePage: string;
    /** 아이콘만 보이는 좁은 메뉴(접기). */
    rail?: boolean;
    onToggleRail?: () => void;
    /** kept for backward-compat with existing call sites; the redesign is light-only */
    isDarkMode?: boolean;
    toggleTheme?: () => void;
}

type IconComponent = typeof IconApps;
/** 메뉴별 Montage 아이콘 — Claude Design "은하수 관리자 (Montage)" 공통 사이드바와 같다. */
const MENU_ICONS: Record<string, IconComponent> = {
    dashboard: IconApps, reservations: IconTicket, calendar: IconCalendar,
    [quoteDeskPageId('inbox')]: IconDocumentText, [quoteDeskPageId('courses')]: IconFlag, [quoteDeskPageId('itinerary')]: IconClock, [quoteDeskPageId('spots')]: IconLocation,
    products: IconFolder, categories: IconTag, templates: IconDocument,
    'accommodation-ops': IconHome, [quoteDeskPageId('resources')]: IconPersons,
    inquiries: IconMail, reviews: IconStar, faq: IconCircleQuestion, magazines: IconBook,
    banners: IconImage, promotions: IconMegaphone,
};

/**
 * 관리자 사이드바(Montage 시안): 로고 묶음 → "업무" / "고객 · 사이트" 구역 → 업무 묶음 제목과 메뉴(늘 펼침) → 계정.
 * 접기(rail)에서는 묶음 제목을 숨기고 메뉴 아이콘만 보인다.
 */
export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activePage, rail = false, onToggleRail }) => {
    const navigate = useNavigate();
    let logout: undefined | (() => void | Promise<void>);
    try { logout = useUser().logout; } catch { logout = undefined; }
    const navRef = useRef<HTMLElement>(null);

    // 다른 화면으로 이동하면 현재 메뉴가 보이게 스크롤한다.
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            navRef.current?.querySelector('.nav-item.active')?.scrollIntoView({ block: 'nearest' });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [activePage]);

    const handleLogout = async () => {
        // 견적 도구가 쓰는 관리자 값(sessionStorage)도 함께 지운다.
        disconnectQuoteDesk();
        try { await logout?.(); } catch { /* ignore */ }
        navigate('/admin/login');
    };

    const renderItem = (item: NavItem) => {
        const isActive = activePage === item.id;
        const Icon = MENU_ICONS[item.id] || IconDocument;
        return (
            <Link key={item.id} to={item.href} className={`nav-item${isActive ? ' active' : ''}`} aria-current={isActive ? 'page' : undefined} title={rail ? item.label : undefined}
                onPointerEnter={() => preloadAdminPage(item.href)} onFocus={() => preloadAdminPage(item.href)} onPointerDown={() => preloadAdminPage(item.href)}>
                <span className="nav-icon" aria-hidden="true"><Icon /></span>
                <span>{item.label}</span>
            </Link>
        );
    };

    return (
        <aside className={`side${rail ? ' is-rail' : ''}`}>
            {onToggleRail && <div className="side-rail-bar">
                <button type="button" className="side-rail-toggle" title={rail ? '메뉴 펼치기' : '메뉴 접기'} aria-label={rail ? '메뉴 펼치기' : '메뉴 접기'} aria-pressed={rail} onClick={onToggleRail}>
                    {rail ? <IconChevronRight aria-hidden="true" /> : <IconChevronLeft aria-hidden="true" />}
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
                        {section.dashboard && <div className="nav-group">{renderItem(dashboardItem)}</div>}
                        {section.groups.map((groupId) => {
                            const group = navGroups.find((entry) => entry.id === groupId)!;
                            const titleId = `admin-nav-${group.id}`;
                            return (
                                <div className="nav-group" key={group.id} role="group" aria-labelledby={titleId}>
                                    <div className="nav-group-title" id={titleId}>{group.label}</div>
                                    {group.items.map((item) => renderItem(item))}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="side-foot">
                <div className="side-account">
                    <span className="av" aria-hidden="true"><IconPerson /></span>
                    <div className="who">
                        <b>관리자</b>
                        <span>운영 계정 · 마스터</span>
                    </div>
                    <button type="button" className="out" title="로그아웃" aria-label="로그아웃" onClick={handleLogout}>
                        <IconLogout aria-hidden="true" />
                    </button>
                </div>
            </div>
        </aside>
    );
};
