import { useLocation, useNavigate } from 'react-router-dom';
import { MW, MW_FONT } from '../desktop-primitives/mwTokens';
import { useMe } from '../mypage-desktop/useMyPageData';
import { M_TILE } from './mobileTheme';
import { Ico, TravellerAvatar } from './mobileUi';

const TAB_ICON = {
    home: 'M3.5 10.2L12 3.5l8.5 6.7M5.5 8.7V19a1.5 1.5 0 001.5 1.5h3.2v-5.2a1.8 1.8 0 013.6 0v5.2H17a1.5 1.5 0 001.5-1.5V8.7',
    tours: 'M5 7.5h14a2 2 0 012 2v8.5a2 2 0 01-2 2H5a2 2 0 01-2-2V9.5a2 2 0 012-2zM8.5 7.5V6a2 2 0 012-2h3a2 2 0 012 2v1.5M3 12.5h18M10.5 12.5v1.5h3v-1.5',
    mates: 'M9 11.5a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5zM3 19.5c.4-3.2 2.9-5.5 6-5.5s5.6 2.3 6 5.5M15.5 5.2a3.25 3.25 0 010 6.1M17.5 14.4c1.9.7 3.2 2.6 3.5 5.1',
    review: 'M12 3.8c4.6 0 8.2 3.3 8.2 7.4s-3.6 7.4-8.2 7.4c-1 0-2-.2-2.9-.5L4.5 20l1.3-3.6C4.6 15 3.8 13.2 3.8 11.2c0-4.1 3.6-7.4 8.2-7.4zM12 7.8l1.1 2.2 2.4.4-1.75 1.7.4 2.4-2.15-1.1-2.15 1.1.4-2.4-1.75-1.7 2.4-.4z',
} as const;

const TABS: { key: 'home' | 'tours' | 'mates' | 'review' | 'my'; label: string; path: string; match: (p: string) => boolean }[] = [
    { key: 'home', label: '홈', path: '/', match: (p) => p === '/' },
    { key: 'tours', label: '투어 상품', path: '/products', match: (p) => p.startsWith('/products') || p.startsWith('/category/') },
    { key: 'mates', label: '동행 찾기', path: '/travel-mates', match: (p) => p.startsWith('/travel-mates') },
    { key: 'review', label: '여행 후기', path: '/reviews', match: (p) => p.startsWith('/reviews') },
    { key: 'my', label: '마이페이지', path: '/mypage', match: (p) => p.startsWith('/mypage') || p.startsWith('/my-booking') || p === '/login' || p === '/faq' || p === '/contact' },
];

const STICKY = { position: 'sticky', bottom: 0, width: '100%' } as const;
const FIXED = { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, fontFamily: MW_FONT } as const;

/**
 * Bottom tab bar of the mobile redesign. Inside MobileShell it is sticky at the end of the
 * page column; `fixed` pins it to the viewport for legacy screens that only swap their nav.
 */
export function MobileTabBar({ fixed = false }: { fixed?: boolean }) {
    const navigate = useNavigate();
    const path = useLocation().pathname;
    const { data: me } = useMe();
    const logged = !!me;
    const avatar = me?.avatarUrl || me?.image;
    const go = (to: string) => {
        navigate(to);
        window.scrollTo(0, 0);
    };

    return (
        <nav aria-label="메인 메뉴" style={{ ...(fixed ? FIXED : STICKY), zIndex: 30, boxSizing: 'border-box', background: 'rgba(255,255,255,0.98)', backdropFilter: 'blur(12px)', borderTop: `1px solid ${MW.line}`, display: 'grid', gridTemplateColumns: 'repeat(5,minmax(0,1fr))', padding: '0 6px calc(6px + env(safe-area-inset-bottom))' }}>
            {TABS.map((b) => {
                const on = b.match(path);
                const isMy = b.key === 'my';
                const fg = on ? MW.mintDeep : MW.mute;
                const to = isMy && !logged ? '/login' : b.path;
                return (
                    <a
                        key={b.key}
                        href={to}
                        onClick={(e) => { e.preventDefault(); go(to); }}
                        aria-current={on ? 'page' : undefined}
                        style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, height: 60, fontSize: 10, letterSpacing: '-0.02em', whiteSpace: 'nowrap', fontWeight: on ? 700 : 500, color: fg, textDecoration: 'none' }}
                    >
                        <span style={{ position: 'absolute', top: 0, left: '50%', width: on ? 28 : 0, height: 3, borderRadius: '0 0 3px 3px', background: MW.mint, transform: 'translateX(-50%)', transition: 'width .25s' }} />
                        {!isMy && (
                            <span style={{ width: 44, height: 28, borderRadius: 999, background: on ? MW.mintTint : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' }}>
                                <Ico d={TAB_ICON[b.key as keyof typeof TAB_ICON]} size={22} color={fg} width={on ? 1.9 : 1.6} fill={on && b.key !== 'review' ? 'rgba(39,171,143,0.18)' : 'none'} />
                            </span>
                        )}
                        {isMy && !logged && (
                            <span style={{ width: 44, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ width: 28, height: 28, borderRadius: '50%', boxSizing: 'border-box', border: `1.5px dashed ${on ? MW.mint : '#B8C4C1'}`, background: M_TILE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ico d="M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c.8-3.7 3.9-6 7.5-6s6.7 2.3 7.5 6" size={16} color={fg} width={2} />
                                </span>
                            </span>
                        )}
                        {isMy && logged && (
                            <span style={{ width: 44, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', boxSizing: 'border-box', border: `2px solid ${on ? MW.mint : MW.line}`, background: MW.mintTint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <TravellerAvatar size={24} />}
                                </span>
                            </span>
                        )}
                        {isMy && !logged ? '로그인' : b.label}
                    </a>
                );
            })}
        </nav>
    );
}
