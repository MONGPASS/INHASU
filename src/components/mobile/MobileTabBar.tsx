import { useLocation, useNavigate } from 'react-router-dom';
import { MW_FONT } from '../desktop-primitives/mwTokens';
import { useMe } from '../mypage-desktop/useMyPageData';
import { SD, SIcon } from '../site-seed/seed';

/**
 * 하단 메뉴 5칸(디자인 ‘홈 · 휴대폰’, 2026-11-25). 견적 고객 페이지의 하단 메뉴(public/site-chrome.js)도 같은 목록을 쓴다 —
 * 이름·주소를 바꾸면 함께 고친다(tests/site-chrome.test.mjs).
 */
const TABS: { key: 'home' | 'search' | 'booking' | 'wish' | 'my'; label: string; path: string; icon: string; match: (p: string) => boolean }[] = [
    { key: 'home', label: '홈', path: '/', icon: 'homeRoof', match: (p) => p === '/' },
    { key: 'search', label: '검색', path: '/products', icon: 'search', match: (p) => p.startsWith('/products') || p.startsWith('/category/') },
    { key: 'booking', label: '예약 확인', path: '/mypage/reservations', icon: 'calendarCheck', match: (p) => p.startsWith('/mypage/reservations') || p.startsWith('/my-booking') },
    { key: 'wish', label: '찜 목록', path: '/mypage/wishlist', icon: 'heart', match: (p) => p.startsWith('/mypage/wishlist') },
    { key: 'my', label: '마이페이지', path: '/mypage', icon: 'user', match: (p) => (p.startsWith('/mypage') && !p.startsWith('/mypage/reservations') && !p.startsWith('/mypage/wishlist')) || p === '/login' },
];

const STICKY = { position: 'sticky', bottom: 0, width: '100%' } as const;
const FIXED = { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, fontFamily: MW_FONT } as const;

/**
 * 휴대폰 하단 메뉴. MobileShell 안에서는 본문 끝에 붙어 따라오고(sticky),
 * `fixed`는 옛 화면이 메뉴만 바꿔 끼울 때 화면 아래에 고정한다.
 */
export function MobileTabBar({ fixed = false }: { fixed?: boolean }) {
    const navigate = useNavigate();
    const path = useLocation().pathname;
    const { data: me } = useMe();
    const logged = !!me;
    const go = (to: string) => {
        navigate(to);
        window.scrollTo(0, 0);
    };

    return (
        <nav aria-label="하단 메뉴" style={{ ...(fixed ? FIXED : STICKY), zIndex: 30, boxSizing: 'border-box', display: 'flex', background: SD.white, borderTop: `1px solid ${SD.gray200}`, paddingBottom: 'calc(8px + env(safe-area-inset-bottom))' }}>
            {TABS.map((tab) => {
                const on = tab.match(path);
                const guest = tab.key === 'my' && !logged;
                const to = guest ? '/login' : tab.path;
                return (
                    <a key={tab.key} href={to} onClick={(e) => { e.preventDefault(); go(to); }} aria-current={on ? 'page' : undefined}
                        style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, height: 56, color: on ? SD.gray900 : SD.gray600, fontSize: 11,
                            fontWeight: on ? 700 : 400, whiteSpace: 'nowrap', textDecoration: 'none' }}>
                        <SIcon name={tab.icon} size={24} stroke={on ? 2 : 1.6} />
                        <span>{guest ? '로그인' : tab.label}</span>
                    </a>
                );
            })}
        </nav>
    );
}
