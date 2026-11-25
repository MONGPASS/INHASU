import React, { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import loginBg2 from '../../assets/login_bg_2.jpg';
import logo from '../../assets/logo_white_full.webp';
import loginBg3 from '../../assets/login_bg_3.jpg';
import loginBg4 from '../../assets/login_bg_4.jpg';
import loginBg5 from '../../assets/login_bg_5.jpg';

const MONGOLIA_IMAGES = [
    loginBg2, loginBg3, loginBg4,
    loginBg5, loginBg2, loginBg3,
    loginBg4, loginBg5, loginBg2,
];

const ScrollingColumn: React.FC<{ images: string[]; direction: 'up' | 'down'; duration: string; delay?: string }> = ({ images, direction, duration, delay }) => {
    // 같은 사진 묶음을 세 번 이어 붙여 끊김 없이 흐르게 한다(1/3만큼 움직이고 처음으로).
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
                        <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </div>
                ))}
            </div>
        </div>
    );
};

interface LoginHeroProps {
    onGoogleLogin: () => void;
    errorMessage?: string | null;
    /** 오류 위에 보여 줄 안내(휴대폰: 앱 안 브라우저에서 Safari로 열기). */
    notice?: ReactNode;
    /** 있으면 왼쪽 위에 뒤로 가기 단추를 둔다(휴대폰 — 사이트 머리 없이 화면 전체를 쓰기 때문). */
    onBack?: () => void;
}

/**
 * 고객 로그인 화면(PC·휴대폰 같은 모양): 세 줄로 흐르는 몽골 사진 위에 흰 로고 · ‘내가 꿈꾸던 몽골 여정의 시작’ · 구글 로그인 단추.
 * 로그인 처리(돌아갈 주소, 앱 안 브라우저 처리)는 쓰는 쪽이 onGoogleLogin으로 넘긴다.
 */
export function LoginHero({ onGoogleLogin, errorMessage, notice, onBack }: LoginHeroProps) {
    const { t } = useTranslation();

    return (
        <div className="relative w-full h-[100dvh] bg-black overflow-hidden font-display">
            {/* 흐르는 사진 배경 */}
            <div className="absolute inset-0 flex gap-4 p-4 opacity-60 pointer-events-none" aria-hidden="true">
                <ScrollingColumn images={MONGOLIA_IMAGES.slice(0, 3)} direction="up" duration="40s" />
                <ScrollingColumn images={MONGOLIA_IMAGES.slice(3, 6)} direction="down" duration="45s" delay="-10s" />
                <ScrollingColumn images={MONGOLIA_IMAGES.slice(6, 9)} direction="up" duration="50s" delay="-5s" />
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/20 pointer-events-none" />

            {onBack && (
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="뒤로 가기"
                    className="absolute z-30 left-2 w-11 h-11 flex items-center justify-center rounded-full text-white bg-transparent border-0 cursor-pointer"
                    style={{ top: 'calc(8px + env(safe-area-inset-top))' }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M15 6l-6 6 6 6" />
                    </svg>
                </button>
            )}

            <div className="relative z-20 flex flex-col items-center justify-center h-full text-center px-6">
                <div className="mb-8 animate-fade-in-up">
                    <img src={logo} alt="몽골리아 은하수" className="h-32 mb-6 mx-auto object-contain drop-shadow-xl" decoding="async" />

                    <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-2 drop-shadow-xl">
                        {t('auth.title_line1')}<br />
                        <span className="text-primary-light">{t('auth.title_line2')}</span>
                    </h1>
                    <p className="text-gray-300 mt-4 text-sm md:text-base font-medium max-w-sm mx-auto leading-relaxed whitespace-pre-wrap">
                        {t('auth.subtitle')}
                    </p>
                </div>

                {notice}

                {errorMessage && (
                    <div role="alert" className="relative z-30 w-full max-w-xs mb-4 px-4 py-3 rounded-2xl bg-white/95 text-sm font-semibold text-red-700 leading-relaxed shadow-lg">
                        {errorMessage}
                    </div>
                )}

                <button
                    type="button"
                    onClick={onGoogleLogin}
                    className="relative z-30 w-full max-w-xs bg-white text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all py-4 rounded-full font-bold flex items-center justify-center gap-3 shadow-2xl animate-fade-in-up-delay"
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt=""
                        className="w-6 h-6" decoding="async" />
                    <span>{t('auth.google_login')}</span>
                </button>

                <p className="mt-6 text-xs text-gray-500">
                    {t('auth.terms_agreement')}
                </p>
            </div>

            <style>{`
                @keyframes scroll-up-seamless {
                    from { transform: translateY(0); }
                    to { transform: translateY(-33.33%); }
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
}
