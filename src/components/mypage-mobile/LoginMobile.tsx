import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MW, MW_FONT_EN } from '../desktop-primitives/mwTokens';
import { useMe } from '../mypage-desktop/useMyPageData';
import { MobileShell } from '../mobile/MobileShell';
import { D } from '../mobile/mobileTheme';
import { Ico, TravellerAvatar } from '../mobile/mobileUi';
import { googleLoginUrl, loginErrorMessage, loginReturnPath } from './googleLogin';

const PERKS: Array<[string, string]> = [
    ['예약 현황을 언제든 확인', D.calendar],
    ['마음에 드는 투어 저장', D.heart],
    ['견적 답변 알림','M6 16V11a6 6 0 1112 0v5l1.5 2h-15zM10 20a2 2 0 004 0'],
];

/**
 * Mobile login (Claude Design: "M Login"). Customers sign in with Google only, so the design's
 * LINE button and e-mail form are left out; a first Google login also creates the account.
 */
export function LoginMobile() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { data: me } = useMe();
    // Back to the page that asked for a login, otherwise on to the my page.
    const target = loginReturnPath(location.state, location.search) ?? '/mypage';
    const errorMessage = loginErrorMessage(location.search);

    // Coming back from the OAuth round trip (or the back/forward cache) must not reuse a
    // "logged out" answer cached before the login, so the tab bar can switch to the avatar.
    useEffect(() => {
        const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['authMe'] }, { cancelRefetch: false }); };
        const onShow = (e: PageTransitionEvent) => { if (e.persisted) refresh(); };
        refresh();
        window.addEventListener('pageshow', onShow);
        return () => window.removeEventListener('pageshow', onShow);
    }, [queryClient]);

    if (me) return <Navigate to={target} replace />;

    const go = (path: string) => {
        navigate(path);
        window.scrollTo(0, 0);
    };
    const link = { color: MW.mintDeep, fontWeight: 700, textDecoration: 'none' } as const;

    return (
        <MobileShell title="로그인">
            <section style={{ padding: '24px 20px 40px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 24, background: `linear-gradient(160deg,${MW.navySoft} 0%,${MW.mintDeep} 100%)`, color: '#FFFFFF', padding: '24px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                    <span style={{ position: 'absolute', right: -60, top: -60, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle,rgba(109,219,190,0.35),rgba(109,219,190,0) 70%)', pointerEvents: 'none' }} />
                    <span style={{ position: 'relative', flexShrink: 0, width: 88, height: 88, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.85)', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', background: MW.mintTint }}>
                        <TravellerAvatar size={88} />
                    </span>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', color: MW.mintLight }}>SAIN BAINA UU</span>
                        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, lineHeight: 1.4 }}>로그인하고<br />여행을 더 편리하게</h1>
                        <span style={{ fontSize: 12, color: MW.mintTint, whiteSpace: 'nowrap' }}>로그인하면 나만의 여행 캐릭터가 등장</span>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {PERKS.map(([text, d]) => (
                        <span key={text} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, fontWeight: 700, color: MW.ink3 }}>
                            <span style={{ width: 30, height: 30, borderRadius: '50%', background: MW.mintBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Ico d={d} size={16} color={MW.mintDeep} />
                            </span>
                            {text}
                        </span>
                    ))}
                </div>

                {errorMessage && (
                    <div role="alert" style={{ padding: '12px 14px', borderRadius: 14, background: '#FDECEA', border: '1px solid #F5C6C0', fontSize: 13, fontWeight: 700, lineHeight: 1.6, color: MW.redDeep }}>
                        {errorMessage}
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                        type="button"
                        onClick={() => { window.location.href = googleLoginUrl(target); }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, border: `1.5px solid ${MW.line}`, borderRadius: 999, background: '#FFFFFF', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: MW.navy, cursor: 'pointer' }}
                    >
                        <span style={{ fontFamily: MW_FONT_EN, fontSize: 15, fontWeight: 700, color: '#4285F4' }}>G</span>
                        Google로 로그인
                    </button>
                    <span style={{ fontSize: 12, lineHeight: 1.7, color: MW.mute, textAlign: 'center' }}>처음이신 분도 Google 계정으로 바로 회원가입할 수 있습니다.</span>
                </div>

                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.8, color: MW.mute2, textAlign: 'center' }}>
                    로그인하면{' '}
                    <a href="/terms-of-service" onClick={(e) => { e.preventDefault(); go('/terms-of-service'); }} style={link}>이용약관</a>
                    {' '}및{' '}
                    <a href="/privacy-policy" onClick={(e) => { e.preventDefault(); go('/privacy-policy'); }} style={link}>개인정보처리방침</a>
                    에 동의한 것으로 간주됩니다.
                </p>
            </section>
        </MobileShell>
    );
}
