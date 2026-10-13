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
