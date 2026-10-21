import test from 'node:test';
import assert from 'node:assert/strict';
import { TrafficError, buildTrafficData, classifyTrafficSource, readTraffic, resetTrafficTokenCache, signServiceAccountJwt, trafficReportRequest } from '../functions/lib/ga4Traffic.ts';
import { trafficKpis, trafficRows } from '../src/utils/adminTraffic.ts';
import { analyticsPageLocation, isTrackedPath } from '../src/utils/analytics.ts';

const pem = (der, label) => `-----BEGIN ${label}-----\n${Buffer.from(der).toString('base64').match(/.{1,64}/g).join('\n')}\n-----END ${label}-----\n`;
const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const account = { client_email: 'dashboard@milkyway.iam.gserviceaccount.com', private_key: pem(await crypto.subtle.exportKey('pkcs8', keys.privateKey), 'PRIVATE KEY') };
const env = { GA4_PROPERTY_ID: '519854094', GA4_SERVICE_ACCOUNT_JSON: JSON.stringify(account) };

const row = (dims, metrics) => ({ dimensionValues: dims.map(value => ({ value })), metricValues: metrics.map(value => ({ value: String(value) })) });
const gaReports = () => [
    { dimensionHeaders: [{ name: 'dateRange' }], rows: [row(['date_range_0'], [900, 1000, 3400]), row(['date_range_1'], [800, 950, 3000])] },
    { dimensionHeaders: [{ name: 'sessionSource' }, { name: 'sessionMedium' }], rows: [
        row(['m.search.naver.com', 'referral'], [300]), row(['naver', 'organic'], [100]), row(['m.blog.naver.com', 'referral'], [200]),
        row(['l.instagram.com', 'referral'], [150]), row(['google', 'organic'], [120]), row(['youtube.com', 'referral'], [30]),
        row(['kakao', 'social'], [50]), row(['(direct)', '(none)'], [40]), row(['bing', 'organic'], [10]),
    ] },
    { dimensionHeaders: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'dateRange' }], rows: [
        row(['naver', 'organic', 'date_range_0'], [8]), row(['kakao', 'social', 'date_range_0'], [4]), row(['naver', 'organic', 'date_range_1'], [9]),
    ] },
];

test('GA 유입 출처를 대시보드 9개 채널로 나누고 utm 출처도 인식한다', () => {
    const cases = [['m.search.naver.com', 'referral', '네이버 검색'], ['naver', 'organic', '네이버 검색'], ['blog.naver.com', 'referral', '네이버 블로그'],
        ['naver_blog', 'social', '네이버 블로그'], ['l.instagram.com', 'referral', '인스타그램'], ['instagram', 'social', '인스타그램'],
        ['google', 'organic', '구글 검색'], ['m.youtube.com', 'referral', '유튜브'], ['youtube', 'video', '유튜브'], ['kakao', 'social', '카카오톡 채널'],
        ['pf.kakao.com', 'referral', '카카오톡 채널'], ['(direct)', '(none)', '직접 방문'], ['bing', 'organic', '기타·추천'], ['', '', '기타·추천'],
        ['facebook', 'social', '페이스북'], ['m.facebook.com', 'referral', '페이스북'], ['l.facebook.com', 'referral', '페이스북'],
        ['lm.facebook.com', 'referral', '페이스북'], ['fb', 'social', '페이스북']];
    for (const [source, medium, channel] of cases) assert.equal(classifyTrafficSource(source, medium), channel, `${source}/${medium}`);
});

test('GA 일괄 보고서를 채널별 방문·문의와 이전 기간 합계로 정리한다', () => {
    const data = buildTrafficData('30d', gaReports(), '2026-10-21T01:00:00.000Z');
    assert.deepEqual(data.current, { visitors: 900, sessions: 1000, pageViews: 3400, leads: 12 });
    assert.deepEqual(data.previous, { visitors: 800, sessions: 950, pageViews: 3000, leads: 9 });
    const byName = Object.fromEntries(data.channels.map(channel => [channel.name, channel]));
    assert.equal(data.channels.length, 9);
    assert.deepEqual(byName['네이버 검색'], { name: '네이버 검색', sessions: 400, leads: 8 });
    assert.deepEqual(byName['카카오톡 채널'], { name: '카카오톡 채널', sessions: 50, leads: 4 });
    assert.equal(byName['기타·추천'].sessions, 10);
    assert.equal(byName['유튜브'].leads, 0);

    const rows = trafficRows(data);
    assert.deepEqual(rows.map(r => r.name), ['네이버 검색', '네이버 블로그', '인스타그램', '구글 검색', '카카오톡 채널', '직접 방문', '유튜브', '기타·추천']);
    assert.equal(rows[0].cvr, 2);
    assert.equal(rows.find(r => r.name === '유튜브').cvr, 0);
    const kpis = Object.fromEntries(trafficKpis(data).map(k => [k.label, k]));
    assert.equal(kpis['홈페이지 방문자'].delta, '+13%');
    assert.equal(kpis['견적 문의'].delta, '+33%');
    assert.equal(kpis['문의 전환율'].format(kpis['문의 전환율'].value), '1.2');
    assert.equal(kpis['문의 전환율'].delta, '+0.3%p');

    const empty = buildTrafficData('today', [{}, {}, {}], '2026-10-21T01:00:00.000Z');
    assert.equal(trafficRows(empty).length, 0, 'channels without visits are not listed');
    assert.equal(trafficKpis(empty).find(k => k.label === '문의 전환율').value, null, 'no visits means no rate, not 0%');
    assert.equal(trafficKpis(empty)[0].delta, '');
});

test('페이스북 유입과 문의는 기타·추천에 섞지 않고 별도 채널로 집계한다', () => {
    const reports = [{}, { rows: [row(['l.facebook.com', 'referral'], [60]), row(['facebook', 'social'], [15]), row(['bing', 'organic'], [5])] },
        { dimensionHeaders: [{ name: 'sessionSource' }, { name: 'sessionMedium' }, { name: 'dateRange' }], rows: [row(['facebook', 'social', 'date_range_0'], [3])] }];
    const byName = Object.fromEntries(buildTrafficData('7d', reports, '2026-10-21T01:00:00.000Z').channels.map(channel => [channel.name, channel]));
    assert.deepEqual(byName['페이스북'], { name: '페이스북', sessions: 75, leads: 3 });
    assert.deepEqual(byName['기타·추천'], { name: '기타·추천', sessions: 5, leads: 0 });
});

test('서비스 계정 JWT는 RS256으로 서명되고 GA 읽기 전용 범위만 요청한다', async () => {
    const jwt = await signServiceAccountJwt({ ...account, private_key: account.private_key.replace(/\n/g, '\\n') }, 1_800_000_000);
    const [header, claims, signature] = jwt.split('.');
    const decode = part => JSON.parse(Buffer.from(part, 'base64url').toString());
    assert.deepEqual(decode(header), { alg: 'RS256', typ: 'JWT' });
    assert.deepEqual(decode(claims), { iss: account.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
        aud: 'https://oauth2.googleapis.com/token', iat: 1_800_000_000, exp: 1_800_003_600 });
    assert.ok(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', keys.publicKey, Buffer.from(signature, 'base64url'), new TextEncoder().encode(`${header}.${claims}`)));
});

function fakeGoogle({ reportStatus = 200 } = {}) {
    const calls = [];
    const fetcher = async (url, init) => {
        calls.push({ url, body: init.body });
        if (String(url).includes('oauth2')) return Response.json({ access_token: 'token-1', expires_in: 3600 });
        if (reportStatus !== 200) return Response.json({ error: { status: 'PERMISSION_DENIED' } }, { status: reportStatus });
        return Response.json({ reports: gaReports() });
    };
    return { calls, fetcher };
}

test('GA4 설정이 없으면 외부 호출 없이 미설정으로 답하고 0을 만들지 않는다', async () => {
    const google = fakeGoogle();
    assert.deepEqual(await readTraffic({}, '7d', google.fetcher), { configured: false, period: '7d' });
    assert.deepEqual(await readTraffic({ GA4_PROPERTY_ID: '519854094', GA4_SERVICE_ACCOUNT_JSON: '{broken' }, '7d', google.fetcher), { configured: false, period: '7d' });
    assert.equal(google.calls.length, 0);
});

test('GA4를 읽고 토큰을 재사용하며 권한 오류는 원인을 알려 준다', async () => {
    resetTrafficTokenCache();
    const google = fakeGoogle();
    const now = Date.parse('2026-10-21T01:00:00Z');
    const data = await readTraffic(env, '30d', google.fetcher, now);
    assert.equal(data.configured, true);
    assert.equal(data.current.leads, 12);
    const report = google.calls.find(call => call.url.includes('batchRunReports'));
    assert.equal(report.url, 'https://analyticsdata.googleapis.com/v1beta/properties/519854094:batchRunReports');
    assert.deepEqual(JSON.parse(report.body), trafficReportRequest('30d'));
    assert.match(JSON.parse(report.body).requests[2].dimensionFilter.filter.stringFilter.value, /^generate_lead$/);

    await readTraffic(env, 'today', google.fetcher, now + 60_000);
    assert.equal(google.calls.filter(call => call.url.includes('oauth2')).length, 1, 'access token is reused until it nears expiry');

    resetTrafficTokenCache();
    await assert.rejects(readTraffic(env, '7d', fakeGoogle({ reportStatus: 403 }).fetcher, now),
        error => error instanceof TrafficError && /뷰어로 추가/.test(error.message));
});

test('GA에는 공개 화면만 보내고 주소의 토큰은 지우며 utm만 남긴다', () => {
    for (const path of ['/', '/products', '/products/abc', '/category/gobi', '/reviews', '/reviews/12', '/travel-guide/3', '/custom-estimate', '/estimate-complete', '/faq'])
        assert.ok(isTrackedPath(path), path);
    for (const path of ['/admin', '/admin/quotes', '/documents/itinerary/r1', '/documents/contract/r1', '/estimate/q1', '/customer-link', '/my-booking/r1',
        '/mypage/reservations', '/reservation/1', '/payment', '/chats/1', '/login', '/reviews/write', '/travel-mates/write', '/내견적.html'])
        assert.ok(!isTrackedPath(path), path);
    assert.equal(analyticsPageLocation('https://mongolia-milkyway.com', '/products/abc', '?t=SECRET&utm_source=kakao&adminId=7&utm_campaign=fall'),
        'https://mongolia-milkyway.com/products/abc?utm_source=kakao&utm_campaign=fall');
    assert.equal(analyticsPageLocation('https://mongolia-milkyway.com', '/', '?token=x'), 'https://mongolia-milkyway.com/');
});
