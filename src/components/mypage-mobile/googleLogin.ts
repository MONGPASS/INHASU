import { BRAND } from '../../constants/company';

/**
 * Google OAuth is the only customer login. These helpers build the start URL for both the
 * PC and the mobile login screen.
 */

/**
 * The page the visitor was heading to (AuthGuard passes it as `location.state.from`).
 * Only same-origin paths are accepted; anything else yields null.
 */
export const loginReturnPath = (state: unknown): string | null => {
    const from = (state as { from?: unknown } | null)?.from;
    return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') && from !== '/login' ? from : null;
};

/** 로그인에 실패해 돌아왔을 때(`/login?error=…`) 보여 줄 안내. 오류가 없으면 null. */
export const loginErrorMessage = (search: string): string | null => {
    const code = new URLSearchParams(search).get('error');
    if (!code) return null;
    const messages: Record<string, string> = {
        google_setup: 'Google 로그인이 아직 준비되지 않았습니다. 잠시 후 다시 시도하시거나 카카오톡 채널로 문의해 주세요.',
        google_cancelled: 'Google 로그인이 취소되었습니다. 다시 시도해 주세요.',
        google_state: '로그인 시간이 지났습니다. 다시 한 번 시도해 주세요.',
        google_linked: '이 이메일은 이미 다른 Google 계정으로 가입되어 있습니다. 처음 가입한 Google 계정으로 로그인해 주세요.',
        account_disabled: '사용이 중지된 계정입니다. 문의해 주세요.',
        google_failed: 'Google 로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    };
    return messages[code] || messages.google_failed;
};

/** OAuth start endpoint; `redirect` is where the callback sends the user after login (home when null). */
export const googleLoginUrl = (redirect: string | null) => {
    // Google OAuth redirect URIs are origin-sensitive. Desktop users may land
    // on the www domain, while the production OAuth callback is registered
    // against the apex domain. Start OAuth from the canonical production
    // origin so PC and mobile use the same callback URL and cookies.
    const authOrigin = window.location.hostname === `www.${BRAND.domain}` ? BRAND.siteUrl : '';
    return redirect
        ? `${authOrigin}/api/auth/login/google?redirect=${encodeURIComponent(redirect)}`
        : `${authOrigin}/api/auth/login/google`;
};
