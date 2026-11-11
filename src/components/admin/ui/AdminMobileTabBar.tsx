import React from 'react';
import { Link } from 'react-router-dom';
import { DashboardIcon, type DashboardIconName } from '../dashboard/DashboardIcon';

/**
 * 휴대폰 폭(760px 이하)에서 화면 아래에 고정되는 메뉴. 데스크톱·태블릿에서는 CSS로 숨긴다.
 * 어느 화면에서나 같은 다섯 칸이며, 마지막 칸은 전체 메뉴(서랍)를 연다.
 */
const TABS: Array<{ key: string; label: string; icon: DashboardIconName; href: string; match: (page: string) => boolean }> = [
    { key: 'home', label: '홈', icon: 'lc-layout-dashboard', href: '/admin', match: page => page === 'dashboard' },
    { key: 'booking', label: '예약', icon: 'lc-calendar-check', href: '/admin/reservations', match: page => page === 'reservations' || page === 'calendar' || page === 'quote-desk-bookings' },
    { key: 'quote', label: '견적', icon: 'lc-file-text', href: '/admin/quote-desk/inbox', match: page => /^quote-desk-(inbox|builder|courses|itinerary|spots)$/.test(page) },
    { key: 'assign', label: '배정', icon: 'lc-users', href: '/admin/accommodation-ops', match: page => page === 'accommodation-ops' || page === 'quote-desk-resources' },
];

export const AdminMobileTabBar: React.FC<{ activePage: string; menuOpen: boolean; menuId: string; onOpenMenu: () => void }> = ({ activePage, menuOpen, menuId, onOpenMenu }) => {
    const anyActive = TABS.some(entry => entry.match(activePage));
    return (
        <nav className="adm-tabbar" aria-label="관리자 바로가기 메뉴">
            {TABS.map(entry => {
                const active = entry.match(activePage);
                return (
                    <Link key={entry.key} to={entry.href} className={`adm-tabbar-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                        <DashboardIcon name={entry.icon} size={22} />
                        <span>{entry.label}</span>
                    </Link>
                );
            })}
            <button type="button" className={`adm-tabbar-item${menuOpen || !anyActive ? ' is-active' : ''}`} aria-expanded={menuOpen} aria-controls={menuId} onClick={onOpenMenu}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                <span>전체</span>
            </button>
        </nav>
    );
};
