import React from 'react';
import { Link } from 'react-router-dom';
import { IconApps, IconDocumentText, IconMenu, IconPersons, IconTicket } from './AdminIcons';

/**
 * 휴대폰 폭(760px 이하)에서 화면 아래에 고정되는 메뉴. 데스크톱·태블릿에서는 CSS로 숨긴다.
 * 어느 화면에서나 같은 다섯 칸이며, 마지막 칸은 전체 메뉴(서랍)를 연다.
 */
// 아이콘은 사이드바(AdminSidebar MENU_ICONS)와 같은 Seed 모양
const TABS: Array<{ key: string; label: string; icon: typeof IconApps; href: string; match: (page: string) => boolean }> = [
    { key: 'home', label: '홈', icon: IconApps, href: '/admin', match: page => page === 'dashboard' },
    { key: 'booking', label: '예약', icon: IconTicket, href: '/admin/reservations', match: page => page === 'reservations' || page === 'calendar' || page === 'quote-desk-bookings' },
    { key: 'quote', label: '견적', icon: IconDocumentText, href: '/admin/quote-desk/inbox', match: page => /^quote-desk-(inbox|builder|courses|itinerary|spots)$/.test(page) },
    { key: 'assign', label: '배정', icon: IconPersons, href: '/admin/accommodation-ops', match: page => page === 'accommodation-ops' || page === 'quote-desk-resources' },
];

export const AdminMobileTabBar: React.FC<{ activePage: string; menuOpen: boolean; menuId: string; onOpenMenu: () => void }> = ({ activePage, menuOpen, menuId, onOpenMenu }) => {
    const anyActive = TABS.some(entry => entry.match(activePage));
    return (
        <nav className="adm-tabbar" aria-label="관리자 바로가기 메뉴">
            {TABS.map(entry => {
                const active = entry.match(activePage);
                return (
                    <Link key={entry.key} to={entry.href} className={`adm-tabbar-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
                        <entry.icon width={22} height={22} />
                        <span>{entry.label}</span>
                    </Link>
                );
            })}
            <button type="button" className={`adm-tabbar-item${menuOpen || !anyActive ? ' is-active' : ''}`} aria-expanded={menuOpen} aria-controls={menuId} onClick={onOpenMenu}>
                <IconMenu width={22} height={22} />
                <span>전체</span>
            </button>
        </nav>
    );
};
