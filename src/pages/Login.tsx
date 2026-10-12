import React from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { LoginMobile } from '../components/mypage-mobile/LoginMobile';
import { googleLoginUrl, loginReturnPath } from '../components/mypage-mobile/googleLogin';

import loginBg2 from '../assets/login_bg_2.jpg';
import logo from '../assets/new_logo_2026.png';
import loginBg3 from '../assets/login_bg_3.jpg';
import loginBg4 from '../assets/login_bg_4.jpg';
import loginBg5 from '../assets/login_bg_5.jpg';

const MONGOLIA_IMAGES = [
    loginBg2, loginBg3, loginBg4,
    loginBg5, loginBg2, loginBg3,
    loginBg4, loginBg5, loginBg2,
];

const ScrollingColumn: React.FC<{ images: string[]; direction: 'up' | 'down'; duration: string; delay?: string }> = ({ images, direction, duration, delay }) => {
    // Duplicate images nicely to ensure loop
    const displayImages = [...images, ...images, ...images];

    return (
        <div className="relative h-full overflow-hidden flex-1">
            <div
                className={`flex flex-col gap-4 absolute top-0 left-0 w-full animate-scroll-${direction}`}
                style={{
                    animationDuration: duration,
                    animationDelay: delay || '0s'
                }}
            >
                {displayImages.map((src, idx) => (
                    <div key={idx} className="w-full rounded-2xl overflow-hidden shadow-lg aspect-[3/4]">
                        <img src={src} alt="Mongolia" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </div>
                ))}
            </div>
        </div>
    );
};

export const Login: React.FC = () => {
    const isDesktop = useIsDesktop();
    return isDesktop ? <LoginDesktop /> : <LoginMobile />;
};

const LoginDesktop: React.FC = () => {
    const location = useLocation();
    const { t } = useTranslation();

    const handleGoogleLogin = () => {
        // Forward the original page (set by AuthGuard via location.state.from) to the
        // OAuth start endpoint so the callback can redirect the user back after login.
        // Only same-origin paths are accepted; other inputs fall back to "/".
        window.location.href = googleLoginUrl(loginReturnPath(location.state));
    };

    return (
        <div className="relative w-full h-screen bg-black overflow-hidden font-display">
            {/* Animated Background */}
            <div className="absolute inset-0 flex gap-4 p-4 opacity-60 pointer-events-none">
                <ScrollingColumn images={MONGOLIA_IMAGES.slice(0, 3)} direction="up" duration="40s" />
                <ScrollingColumn images={MONGOLIA_IMAGES.slice(3, 6)} direction="down" duration="45s" delay="-10s" />
                <ScrollingColumn images={MONGOLIA_IMAGES.slice(6, 9)} direction="up" duration="50s" delay="-5s" />
            </div>

            {/* Overlay Gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20 pointer-events-none" />

            {/* Content Content - Centered */}
            <div className="relative z-20 flex flex-col items-center justify-center h-full text-center px-6">
                <div className="mb-8 animate-fade-in-up">
                    <img src={logo} alt="몽골리아 은하수" className="h-32 mb-6 mx-auto object-contain drop-shadow-xl" loading="lazy" decoding="async" />

                    <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-2 drop-shadow-xl">
                        {t('auth.title_line1')}<br />
                        <span className="text-primary-light">{t('auth.title_line2')}</span>
                    </h1>
                    <p className="text-gray-300 mt-4 text-sm md:text-base font-medium max-w-sm mx-auto leading-relaxed whitespace-pre-wrap">
                        {t('auth.subtitle')}
                    </p>
                </div>

                {/* Google Login Button */}
                <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="relative z-30 w-full max-w-xs bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all py-4 rounded-full font-bold flex items-center justify-center gap-3 shadow-2xl animate-fade-in-up-delay"
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="Google"
                        className="w-6 h-6" loading="lazy" decoding="async" />
                    <span>{t('auth.google_login')}</span>
                </button>

                <p className="mt-6 text-xs text-gray-500">
                    {t('auth.terms_agreement')}
                </p>
            </div>

            {/* Inline Styles for Animation */}
            <style>{`
                @keyframes scroll-up {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-50%); } /* Halfway because data is triplicated but we want loop */
                    /* Actually if triplicated, scroll 1/3? simpler: scroll -33.33% ? */
                    /* Better logic: we need seamless loop. */
                }
                @keyframes scroll-down {
                    0% { transform: translateY(-33.33%); } /* Start offset */
                    100% { transform: translateY(0); }
                }
                .animate-scroll-up {
                    animation: scroll-up linear infinite;
                }
                .animate-scroll-down {
                    animation: scroll-down linear infinite;
                }
                
                /* Fix keyframes logic */
                @keyframes scroll-up-seamless {
                    from { transform: translateY(0); }
                    to { transform: translateY(-33.33%); } /* Assuming 3 sets of images */
                }
                @keyframes scroll-down-seamless {
                    from { transform: translateY(-33.33%); }
                    to { transform: translateY(0); }
                }

                .animate-scroll-up { animation: scroll-up-seamless linear infinite; }
                .animate-scroll-down { animation: scroll-down-seamless linear infinite; }
                
                .animate-fade-in-up {
                    animation: fadeInUp 0.8s ease-out forwards;
                }
                .animate-fade-in-up-delay {
                    animation: fadeInUp 0.8s ease-out 0.3s forwards;
                    opacity: 0;
                }
                
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};
