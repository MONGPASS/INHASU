import React from 'react';
import { useLocation } from 'react-router-dom';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { LoginHero } from '../components/login/LoginHero';
import { LoginMobile } from '../components/mypage-mobile/LoginMobile';
import { loginErrorMessage, loginReturnPath, startGoogleLogin } from '../components/mypage-mobile/googleLogin';

export const Login: React.FC = () => {
    const isDesktop = useIsDesktop();
    return isDesktop ? <LoginDesktop /> : <LoginMobile />;
};

const LoginDesktop: React.FC = () => {
    const location = useLocation();

    // Forward the original page (set by AuthGuard via location.state.from) to the
    // OAuth start endpoint so the callback can redirect the user back after login.
    // Only same-origin paths are accepted; other inputs fall back to "/".
    // 카카오톡 등 앱 안 브라우저는 바깥 브라우저로 넘긴다(Google이 앱 안 로그인을 막는다).
    const handleGoogleLogin = () => {
        startGoogleLogin(loginReturnPath(location.state, location.search));
    };

    return <LoginHero onGoogleLogin={handleGoogleLogin} errorMessage={loginErrorMessage(location.search)} />;
};
