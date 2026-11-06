import { BRAND } from '../../constants/company';
import { safeCustomerReturnPath } from '../../../public/customer-access.js';

/**
 * Google OAuth is the only customer login. These helpers build the start URL for both the
 * PC and the mobile login screen.
 */

/**
 * The page the visitor was heading to (AuthGuard passes it as `location.state.from`).
 * Only same-origin paths are accepted; anything else yields null.
 */
export const loginReturnPath = (state: unknown, search = ''): string | null => {
    const from = (state as { from?: unknown } | null)?.from;
    const candidate = typeof from === 'string' ? from : new URLSearchParams(search).get('returnTo');
    // The claim screen must survive the OAuth round trip too; its return target is checked separately.
    return candidate ? safeCustomerReturnPath(candidate, '', true) || null : null;
};

/** 로그인에 실패해 돌아왔을 때(`/login?error=…`) 보여 줄 안내. 오류가 없으면 null. */
export const loginErrorMessage = (search: string): string | null => {
    const code = new URLSearchParams(search).get('error');
    if (!code) return null;
    const messages: Record<string, string> = {
        google_setup: 'Google 로그인이 아직 준비되지 않았습니다. 잠시 후 다시 시도하시거나 카카오톡 채널로 문의해 주세요.',
        google_cancelled: 'Google 로그인이 취소되었습니다. 다시 시도해 주세요.',
        google_state: '로그인 시간이 지났습니다. 다시 한 번 시도해 주세요.',
        google_linked: '기존 계정과 연결을 확인해야 합니다. 처음 이용한 Google 계정으로 로그인하거나 담당자에게 문의해 주세요.',
        account_disabled: '사용이 중지된 계정입니다. 문의해 주세요.',
        google_failed: 'Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    };
    return messages[code] || messages.google_failed;
};

/**
 * Google은 앱 안 브라우저(카카오톡·네이버·인스타그램 등)의 로그인을 막는다(403 disallowed_useragent).
 * - kakao: 카카오톡 → `kakaotalk://web/openExternal`로 기본 브라우저에서 연다(iOS·Android 모두).
 * - android-app: 그 밖의 Android 앱 브라우저 → Chrome intent로 연다.
 * - ios-app: 그 밖의 iOS 앱 브라우저 → 강제로 열 방법이 없으므로 Safari로 열도록 안내한다.
 */
export type InAppBrowser = 'kakao' | 'android-app' | 'ios-app' | null;
const OTHER_IN_APP = /NAVER\(inapp|Instagram|FBAN|FBAV|FB_IAB|\bLine\/|BAND\/|DaumApps|everytimeApp|; wv\)/i;
export const inAppBrowser = (userAgent: string): InAppBrowser => {
    if (/KAKAOTALK/i.test(userAgent)) return 'kakao';
    if (!OTHER_IN_APP.test(userAgent)) return null;
    if (/Android/i.test(userAgent)) return 'android-app';
    return /iPhone|iPad|iPod/i.test(userAgent) ? 'ios-app' : null;
};

/** 앱 안 브라우저에서 같은 주소를 바깥 브라우저로 여는 주소. 열 수 없으면 null(iOS 일반 앱). */
export const externalBrowserUrl = (absoluteUrl: string, kind: InAppBrowser): string | null => {
    if (kind === 'kakao') return `kakaotalk://web/openExternal?url=${encodeURIComponent(absoluteUrl)}`;
    if (kind === 'android-app') {
        const url = new URL(absoluteUrl);
        return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(':', '')};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(absoluteUrl)};end`;
    }
    return null;
};

/**
 * Google 로그인 시작. 앱 안 브라우저면 로그인 시작 주소를 바깥 브라우저로 넘겨 그곳에서 로그인과 원래 문서 복귀가 이어지게 한다.
 * iOS 일반 앱 브라우저처럼 넘길 수 없으면 값을 돌려주고(ios-app) 화면이 Safari 안내를 띄운다.
 */
export const startGoogleLogin = (redirect: string | null, surface: Pick<Window, 'location' | 'navigator'> = window): InAppBrowser => {
    const start = new URL(googleLoginUrl(redirect, surface.location.hostname), surface.location.href).href;
    const kind = inAppBrowser(surface.navigator.userAgent || '');
    const external = externalBrowserUrl(start, kind);
    if (kind === 'ios-app') return kind;
    surface.location.href = external ?? start;
    return kind;
};

/** OAuth start endpoint; `redirect` is where the callback sends the user after login (home when null). */
export const googleLoginUrl = (redirect: string | null, hostname: string = window.location.hostname) => {
    // Google OAuth redirect URIs are origin-sensitive. Desktop users may land
    // on the www domain, while the production OAuth callback is registered
    // against the apex domain. Start OAuth from the canonical production
    // origin so PC and mobile use the same callback URL and cookies.
    const authOrigin = hostname === `www.${BRAND.domain}` ? BRAND.siteUrl : '';
    return redirect
        ? `${authOrigin}/api/auth/login/google?redirect=${encodeURIComponent(redirect)}`
        : `${authOrigin}/api/auth/login/google`;
};
