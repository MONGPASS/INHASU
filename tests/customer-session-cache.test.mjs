import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryClient } from '@tanstack/react-query';
import { synchronizeCustomerSessionCache, clearCustomerSessionCache, synchronizeCustomerBrowserStorage } from '../src/lib/customerSessionCache.ts';

const tick = () => new Promise(resolve => setImmediate(resolve));
const fixture = () => {
    // Keep unobserved fixture queries alive until explicit clear(), matching the app's retained cache.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    queryClient.setQueryData(['authMe'], { id: 'customer-a' });
    queryClient.setQueryData(['myPage', 'quotes', 'customer-a'], [{ name: 'A private quote' }]);
    queryClient.setQueryData(['myPage', 'reservation', 'old-booking'], { phone: 'A private phone' });
    queryClient.setQueryData(['wishlistIds'], ['A favorite']);
    queryClient.setQueryData(['tourDetail', 'recentlyViewed'], ['A private browsing']);
    queryClient.setQueryData(['home', 'products'], ['public tour']);
    return queryClient;
};

test('a freshly validated account replaces authMe and removes every previous customer query before rendering', async () => {
    const queryClient = fixture();
    await synchronizeCustomerSessionCache(queryClient, { id: 'customer-b', name: 'B' });
    assert.equal(queryClient.getQueryData(['authMe']).id, 'customer-b');
    assert.equal(queryClient.getQueriesData({ queryKey: ['myPage'] }).length, 0);
    assert.equal(queryClient.getQueryData(['wishlistIds']), undefined);
    assert.equal(queryClient.getQueryData(['tourDetail', 'recentlyViewed']), undefined);
    assert.deepEqual(queryClient.getQueryData(['home', 'products']), ['public tour']);
    queryClient.clear();
});

test('an earlier authMe request cannot overwrite a fresh validated identity after account switch', async () => {
    const queryClient = fixture();
    let finish;
    const oldRequest = queryClient.fetchQuery({ queryKey: ['authMe'], queryFn: () => new Promise(resolve => { finish = resolve; }), staleTime: 0 }).catch(() => null);
    await tick();
    await synchronizeCustomerSessionCache(queryClient, { id: 'customer-b' });
    finish({ id: 'customer-a' }); await oldRequest; await tick();
    assert.equal(queryClient.getQueryData(['authMe']).id, 'customer-b');
    queryClient.clear();
});

test('logout cancels in-flight customer reads and leaves an explicit logged-out identity', async () => {
    const queryClient = fixture();
    let finish;
    const oldRequest = queryClient.fetchQuery({ queryKey: ['myPage', 'quotes', 'customer-a'], queryFn: () => new Promise(resolve => { finish = resolve; }), staleTime: 0 }).catch(() => null);
    await tick();
    await clearCustomerSessionCache(queryClient);
    finish([{ phone: 'late A details' }]); await oldRequest; await tick();
    assert.equal(queryClient.getQueryData(['authMe']), null);
    assert.equal(queryClient.getQueriesData({ queryKey: ['myPage'] }).length, 0);
    assert.equal(queryClient.getQueryData(['wishlistIds']), undefined);
    queryClient.clear();
});

test('the same validated account can reuse its own private cached rows', async () => {
    const queryClient = fixture();
    await synchronizeCustomerSessionCache(queryClient, { id: 'customer-a' });
    assert.deepEqual(queryClient.getQueryData(['myPage', 'quotes', 'customer-a']), [{ name: 'A private quote' }]);
    queryClient.clear();
});

const browserStorage = () => {
    const make = () => { const items = new Map(); return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) }; };
    return { sessionStorage: make(), localStorage: make() };
};
test('account switching cannot restore the previous customer form or saved link names', () => {
    const browser = browserStorage();
    synchronizeCustomerBrowserStorage('customer-a', false, browser);
    browser.sessionStorage.setItem('mw_quote_draft', 'PRIVATE-A-PHONE');
    browser.localStorage.setItem('mw_quote_links', 'PRIVATE-A-NAME');
    synchronizeCustomerBrowserStorage('customer-b', false, browser);
    assert.equal(browser.sessionStorage.getItem('mw_quote_draft'), null);
    assert.equal(browser.localStorage.getItem('mw_quote_links'), null);
    assert.equal(browser.sessionStorage.getItem('mw_quote_draft_owner'), 'customer-b');
});
test('session expiry retains a draft only for the same account and explicit logout clears it', () => {
    const browser = browserStorage();
    synchronizeCustomerBrowserStorage('customer-a', false, browser);
    browser.sessionStorage.setItem('mw_quote_draft', 'CURRENT-A-DRAFT');
    browser.localStorage.setItem('mw_quote_links', 'CURRENT-A-LINK');
    synchronizeCustomerBrowserStorage(null, false, browser);
    synchronizeCustomerBrowserStorage('customer-a', false, browser);
    assert.equal(browser.sessionStorage.getItem('mw_quote_draft'), 'CURRENT-A-DRAFT');
    assert.equal(browser.localStorage.getItem('mw_quote_links'), 'CURRENT-A-LINK');
    browser.sessionStorage.setItem('leaders_admin_token', 'OLD-STAFF-CREDENTIAL');
    synchronizeCustomerBrowserStorage(null, true, browser);
    assert.equal(browser.sessionStorage.getItem('mw_quote_draft'), null);
    assert.equal(browser.localStorage.getItem('mw_quote_links'), null);
    assert.equal(browser.sessionStorage.getItem('leaders_admin_token'), null);
});
