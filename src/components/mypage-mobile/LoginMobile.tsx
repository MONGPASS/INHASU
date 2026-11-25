import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useMe } from '../mypage-desktop/useMyPageData';
import { LoginHero } from '../login/LoginHero';
import { SD } from '../site-seed/seed';
import { inAppBrowser, loginErrorMessage, loginReturnPath, startGoogleLogin } from './googleLogin';

/**
 * 휴대폰 로그인: PC와 같은 화면(LoginHero — 흐르는 몽골 사진 · 흰 로고 · 구글 로그인) + 왼쪽 위 뒤로 가기.
 * 고객 로그인은 Google뿐이고 처음 로그인하면 가입도 된다. 이미 로그인했으면 돌아갈 화면(없으면 마이페이지)으로 넘긴다.
 */
export function LoginMobile() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryClient = useQueryClient();
    const { data: me } = useMe();
    // Back to the page that asked for a login, otherwise on to the my page.
    const target = loginReturnPath(location.state, location.search) ?? '/mypage';
    const errorMessage = loginErrorMessage(location.search);
    // iOS 일반 앱 브라우저(인스타그램·네이버 등)는 바깥 브라우저로 넘길 수 없어 Safari로 열도록 안내한다.
    const [safariHint, setSafariHint] = useState(() => typeof navigator !== 'undefined' && inAppBrowser(navigator.userAgent) === 'ios-app');
    const [copied, setCopied] = useState(false);
    const copyLink = async () => {
        try { await navigator.clipboard.writeText(window.location.href); setCopied(true); }
        catch { window.prompt('주소를 길게 눌러 복사한 뒤 Safari에 붙여 넣어 주세요', window.location.href); }
    };

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

    const goBack = () => {
        if (window.history.length > 1) navigate(-1);
        else navigate('/');
    };

    // iOS 앱 안 브라우저 안내는 어두운 사진 위에서도 읽히게 흰 상자로 둔다.
    const notice = safariHint ? (
        <div role="status" className="relative z-30 w-full max-w-xs mb-4 px-4 py-3 rounded-2xl bg-white/95 text-sm font-semibold leading-relaxed shadow-lg text-left" style={{ color: SD.gray900 }}>
            <span>이 앱 안에서는 Google 로그인이 되지 않아요. 오른쪽 위 메뉴에서 ‘Safari로 열기’를 누르거나, 주소를 복사해 Safari에서 열어 주세요.</span>
            <button type="button" onClick={() => { void copyLink(); }} style={{ display: "block", marginTop: 8, height: 34, padding: "0 14px", border: `1px solid ${SD.gray300}`, borderRadius: 999, background: SD.white, fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: SD.gray900, cursor: "pointer" }}>
                {copied ? "주소를 복사했어요" : "주소 복사"}
            </button>
        </div>
    ) : null;

    return (
        <LoginHero
            onBack={goBack}
            notice={notice}
            errorMessage={errorMessage}
            onGoogleLogin={() => { if (startGoogleLogin(target) === "ios-app") setSafariHint(true); }}
        />
    );
}
