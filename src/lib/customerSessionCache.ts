import type { QueryClient } from '@tanstack/react-query';

type SessionUser = { id: string; [key: string]: unknown };
const privateKeys = [['myPage'], ['wishlistIds'], ['tourDetail', 'recentlyViewed']] as const;
export const CUSTOMER_SESSION_CHANGED = 'inhasu-customer-session-changed';

/** Keep an expired-session draft for the same account, but never restore it into another account. */
export function synchronizeCustomerBrowserStorage(userId: string | null, logout = false,
    surface = typeof window === 'undefined' ? undefined : window) {
    if (!surface) return;
    try {
        const storage = surface.sessionStorage;
        if (logout || (userId && storage.getItem('mw_quote_draft_owner') !== userId)) storage.removeItem('mw_quote_draft');
        if (logout) { storage.removeItem('mw_quote_draft_owner'); storage.removeItem('leaders_admin_token'); }
        else if (userId) storage.setItem('mw_quote_draft_owner', userId);
    } catch { /* Storage may be unavailable in private browsing. */ }
    try {
        const storage = surface.localStorage;
        if (logout || (userId && storage.getItem('mw_quote_links_owner') !== userId)) storage.removeItem('mw_quote_links');
        if (logout) storage.removeItem('mw_quote_links_owner');
        else if (userId) storage.setItem('mw_quote_links_owner', userId);
    } catch { /* Private data must never be reconstructed from another storage source. */ }
}

/** A new session must never inherit another customer's cached details. */
export async function synchronizeCustomerSessionCache(queryClient: QueryClient, user: SessionUser | null) {
    synchronizeCustomerBrowserStorage(user?.id || null);
    // A customer login must not inherit a previously used staff credential in this tab.
    if (user && user.role !== 'admin' && typeof window !== 'undefined') {
        try { window.sessionStorage.removeItem('leaders_admin_token'); } catch { /* Storage may be disabled. */ }
    }
    const previous = queryClient.getQueryData<SessionUser | null>(['authMe']);
    // An older /me response may still be in flight in the public page header.
    await queryClient.cancelQueries({ queryKey: ['authMe'] });
    if (!user || previous?.id !== user.id) {
        await Promise.all(privateKeys.map(queryKey => queryClient.cancelQueries({ queryKey })));
        for (const queryKey of privateKeys) queryClient.removeQueries({ queryKey });
    }
    // Write before AuthGuard exposes its children; useMe cannot reuse the previous identity.
    queryClient.setQueryData(['authMe'], user);
    if ((!user || previous?.id !== user.id) && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(CUSTOMER_SESSION_CHANGED, { detail: { userId: user?.id || null } }));
    }
}

export const clearCustomerSessionCache = (queryClient: QueryClient) => {
    synchronizeCustomerBrowserStorage(null, true);
    return synchronizeCustomerSessionCache(queryClient, null);
};
