import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';

const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');
const { MemoryRouter } = require('react-router-dom');

// Render the actual hero components. Leave React and its providers external so
// the bundled components use the same contexts as the test's providers.
const bundled = buildSync({
    stdin: {
        contents: `
            export { HeroCarouselDesktop } from './src/components/home-desktop/HeroCarousel.desktop';
            export { HeroCarouselMobile } from './src/components/home-mobile/HeroCarousel.mobile';
        `,
        resolveDir: fileURLToPath(new URL('..', import.meta.url)),
        sourcefile: 'hero-banners-test-entry.ts',
        loader: 'ts',
    },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    packages: 'external',
    jsx: 'automatic',
    loader: { '.webp': 'dataurl' },
    define: { 'import.meta.env': '{}' },
    write: false,
}).outputFiles[0].text;
const module = { exports: {} };
new Function('require', 'module', 'exports', bundled)(require, module, module.exports);
const { HeroCarouselDesktop, HeroCarouselMobile } = module.exports;

const queryKey = ['heroBanners'];
const savedBanner = {
    id: 'saved-admin-banner',
    image: '/api/images/banners/saved-mobile.webp',
    pc_image: '/api/images/banners/saved-desktop.webp',
    tag: '몽골 여행',
    title: '관리자에서 저장한 몽골 여행',
    subtitle: '새로고침 후에도 유지되는 배너',
    link: '/products',
};

const response = banners => new Response(JSON.stringify({ banners }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
});
const failedResponse = () => new Response(JSON.stringify({ error: '배너 조회 일시 실패' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
});
// Each server render is a snapshot of an existing mounted query. Suppress a
// fresh observer's automatic mount retry so an error snapshot stays an error.
const client = () => new QueryClient({ defaultOptions: { queries: { retry: false, retryOnMount: false, gcTime: Infinity } } });

function render(Component, queryClient) {
    return renderToStaticMarkup(React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(MemoryRouter, null, React.createElement(Component, { products: [] }))));
}

// SSR registers the real useQuery options without running effects. Execute that
// registered queryFn against controlled HTTP responses, then render its state.
function fetchRegisteredQuery(queryClient) {
    const query = queryClient.getQueryCache().find({ queryKey, exact: true });
    assert.ok(query, 'the component must register its banner query');
    assert.equal(typeof query.options.queryFn, 'function');
    return queryClient.fetchQuery({ ...query.options, retry: false });
}

async function withBannerHttp(handler, run) {
    const previousFetch = globalThis.fetch;
    const previousWindow = globalThis.window;
    globalThis.window = { location: { origin: 'https://mongolia-milkyway.com', hostname: 'mongolia-milkyway.com' } };
    let requests = 0;
    globalThis.fetch = async (url, options) => {
        assert.equal(url, '/api/banners');
        assert.equal(options.credentials, 'include');
        requests += 1;
        return handler(requests);
    };
    try {
        return await run(() => requests);
    } finally {
        globalThis.fetch = previousFetch;
        if (previousWindow === undefined) delete globalThis.window;
        else globalThis.window = previousWindow;
    }
}

for (const [device, Component] of [['PC', HeroCarouselDesktop], ['모바일', HeroCarouselMobile]]) {
    test(`${device}: 새로고침 중 느린 배너 조회는 기본 광고로 바뀌지 않는다`, async () => {
        let resolveResponse;
        const delayed = new Promise(resolve => { resolveResponse = resolve; });
        await withBannerHttp(() => delayed, async requests => {
            const queryClient = client();
            try {
                const initial = render(Component, queryClient);
                assert.doesNotMatch(initial, /CUSTOM TOUR/);
                const loading = fetchRegisteredQuery(queryClient);
                assert.equal(queryClient.getQueryState(queryKey).fetchStatus, 'fetching');
                const pending = render(Component, queryClient);
                assert.match(pending, /aria-busy="true"/);
                assert.doesNotMatch(pending, /CUSTOM TOUR|관리자에서 저장한 몽골 여행/);
                resolveResponse(response([savedBanner]));
                await loading;
                assert.match(render(Component, queryClient), /관리자에서 저장한 몽골 여행/);
                assert.equal(requests(), 1);
            } finally {
                resolveResponse(response([]));
                queryClient.clear();
            }
        });
    });

    test(`${device}: 첫 배너 조회 실패는 기본 광고 대신 재시도 버튼을 표시한다`, async () => {
        await withBannerHttp(failedResponse, async () => {
            const queryClient = client();
            try {
                render(Component, queryClient);
                await assert.rejects(fetchRegisteredQuery(queryClient), /배너 조회 일시 실패/);
                assert.equal(queryClient.getQueryState(queryKey).status, 'error');
                const failed = render(Component, queryClient);
                assert.match(failed, /<button\b[^>]*>다시 시도<\/button>/);
                assert.doesNotMatch(failed, /CUSTOM TOUR|관리자에서 저장한 몽골 여행/);
            } finally { queryClient.clear(); }
        });
    });

    test(`${device}: 배너 배열이 빠진 응답을 빈 배너로 오인하지 않는다`, async () => {
        await withBannerHttp(() => new Response(JSON.stringify({}), {
            status: 200, headers: { 'Content-Type': 'application/json' },
        }), async () => {
            const queryClient = client();
            try {
                render(Component, queryClient);
                await assert.rejects(fetchRegisteredQuery(queryClient), /배너 응답/);
                assert.equal(queryClient.getQueryData(queryKey), undefined);
                const invalid = render(Component, queryClient);
                assert.match(invalid, /<button\b[^>]*>다시 시도<\/button>/);
                assert.doesNotMatch(invalid, /CUSTOM TOUR/);
            } finally { queryClient.clear(); }
        });
    });

    test(`${device}: 저장된 배너를 캐시 없는 두 번의 새 페이지 조회에서 유지한다`, async () => {
        await withBannerHttp(() => response([savedBanner]), async requests => {
            for (let reload = 0; reload < 2; reload += 1) {
                const queryClient = client();
                try {
                    assert.equal(queryClient.getQueryData(queryKey), undefined);
                    render(Component, queryClient);
                    await fetchRegisteredQuery(queryClient);
                    const loaded = render(Component, queryClient);
                    assert.match(loaded, /관리자에서 저장한 몽골 여행/);
                    assert.match(loaded, /\/api\/images\/banners\/saved-desktop\.webp/);
                    assert.doesNotMatch(loaded, /CUSTOM TOUR/);
                } finally { queryClient.clear(); }
            }
            assert.equal(requests(), 2, 'each cold page load must reread saved server data');
        });
    });

    test(`${device}: 정상 조회에서 배너가 실제로 없을 때만 기본 견적 안내를 표시한다`, async () => {
        await withBannerHttp(() => response([]), async () => {
            const queryClient = client();
            try {
                assert.doesNotMatch(render(Component, queryClient), /CUSTOM TOUR/);
                await fetchRegisteredQuery(queryClient);
                assert.equal(queryClient.getQueryState(queryKey).status, 'success');
                const empty = render(Component, queryClient);
                assert.match(empty, /CUSTOM TOUR/);
                assert.match(empty, /나만의 특별한 여행 플랜/);
                assert.doesNotMatch(empty, /다시 시도/);
            } finally { queryClient.clear(); }
        });
    });

    test(`${device}: 이미 표시한 저장 배너는 백그라운드 재조회 실패 후에도 유지한다`, async () => {
        await withBannerHttp(count => count === 1 ? response([savedBanner]) : failedResponse(), async requests => {
            const queryClient = client();
            try {
                render(Component, queryClient);
                await fetchRegisteredQuery(queryClient);
                await queryClient.invalidateQueries({ queryKey, exact: true, refetchType: 'none' });
                await assert.rejects(fetchRegisteredQuery(queryClient), /배너 조회 일시 실패/);
                assert.equal(queryClient.getQueryState(queryKey).status, 'error');
                assert.deepEqual(queryClient.getQueryData(queryKey), [savedBanner]);
                const retained = render(Component, queryClient);
                assert.match(retained, /관리자에서 저장한 몽골 여행/);
                assert.match(retained, /\/api\/images\/banners\/saved-desktop\.webp/);
                assert.doesNotMatch(retained, /CUSTOM TOUR|다시 시도/);
                assert.equal(requests(), 2);
            } finally { queryClient.clear(); }
        });
    });
}
