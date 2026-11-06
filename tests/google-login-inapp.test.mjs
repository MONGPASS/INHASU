import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

// googleLogin.ts는 BRAND 상수를 읽으므로 번들해서 불러온다.
const bundle = await build({
    entryPoints: [fileURLToPath(new URL('../src/components/mypage-mobile/googleLogin.ts', import.meta.url))],
    bundle: true, format: 'esm', platform: 'node', write: false, loader: { '.css': 'empty' },
});
const { inAppBrowser, externalBrowserUrl, startGoogleLogin } = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));

const UA = {
    kakaoIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.8.5',
    kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S921N Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 KAKAOTALK/10.8.5 (INAPP)',
    naverAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S921N; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0 Mobile Safari/537.36 NAVER(inapp; search; 2000; 12.8.4)',
    instagramIos: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0',
    safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
    desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
};

test('카카오톡·기타 앱 안 브라우저를 구분하고 일반 브라우저는 그대로 둔다', () => {
    assert.equal(inAppBrowser(UA.kakaoIos), 'kakao');
    assert.equal(inAppBrowser(UA.kakaoAndroid), 'kakao');
    assert.equal(inAppBrowser(UA.naverAndroid), 'android-app');
    assert.equal(inAppBrowser(UA.instagramIos), 'ios-app');
    for (const ua of [UA.safari, UA.chromeAndroid, UA.desktop, '']) assert.equal(inAppBrowser(ua), null, ua);
});

test('바깥 브라우저 주소: 카카오톡은 openExternal, Android 앱은 Chrome intent, iOS 일반 앱은 없음', () => {
    const start = 'https://mongolia-milkyway.com/api/auth/login/google?redirect=%2F%EA%B3%84%EC%95%BD%EC%84%9C.html%3Ft%3Dabc';
    assert.equal(externalBrowserUrl(start, 'kakao'), 'kakaotalk://web/openExternal?url=' + encodeURIComponent(start));
    const intent = externalBrowserUrl(start, 'android-app');
    assert.ok(intent.startsWith('intent://mongolia-milkyway.com/api/auth/login/google?redirect='));
    assert.ok(intent.includes(';scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(start) + ';end'));
    assert.equal(externalBrowserUrl(start, 'ios-app'), null);
    assert.equal(externalBrowserUrl(start, null), null);
});

test('startGoogleLogin은 로그인 시작 주소(복귀 경로 포함)를 앱에 맞는 브라우저로 넘긴다', () => {
    const surface = ua => ({ location: { href: 'https://mongolia-milkyway.com/login?returnTo=x', hostname: 'mongolia-milkyway.com' }, navigator: { userAgent: ua } });
    const kakao = surface(UA.kakaoIos);
    assert.equal(startGoogleLogin('/내견적.html?t=abc', kakao), 'kakao');
    const external = new URL(kakao.location.href);
    assert.equal(external.protocol, 'kakaotalk:');
    const target = new URL(external.searchParams.get('url'));
    assert.equal(target.origin + target.pathname, 'https://mongolia-milkyway.com/api/auth/login/google');
    assert.equal(target.searchParams.get('redirect'), '/내견적.html?t=abc');

    const ios = surface(UA.instagramIos);
    assert.equal(startGoogleLogin('/mypage', ios), 'ios-app');
    assert.equal(ios.location.href, 'https://mongolia-milkyway.com/login?returnTo=x', 'iOS 일반 앱은 이동하지 않고 안내를 띄운다');

    const normal = surface(UA.safari);
    assert.equal(startGoogleLogin(null, normal), null);
    assert.equal(normal.location.href, 'https://mongolia-milkyway.com/api/auth/login/google');
});
