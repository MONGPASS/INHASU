/**
 * Traffic sources for the admin dashboard, read from the GA4 Data API with a service account.
 * Secrets: GA4_PROPERTY_ID (numeric) and GA4_SERVICE_ACCOUNT_JSON (the downloaded key, as a secret).
 * The service account needs the Viewer role on the GA4 property.
 */
import type { AdminTrafficChannel, AdminTrafficData, AdminTrafficPeriod } from '../../src/types/adminTraffic';

export const TRAFFIC_CHANNELS: AdminTrafficChannel[] = ['네이버 검색', '네이버 블로그', '인스타그램', '구글 검색', '유튜브', '카카오톡 채널', '직접 방문', '기타·추천'];

/** GA session source/medium → dashboard channel. utm_source values from the owner's links come first. */
export function classifyTrafficSource(source: string, medium: string): AdminTrafficChannel {
    const s = (source || '').toLowerCase(), m = (medium || '').toLowerCase();
    if (s === '(direct)' && (m === '(none)' || m === '(not set)' || !m)) return '직접 방문';
    if (s.includes('blog.naver') || s === 'naver_blog' || s === 'naverblog') return '네이버 블로그';
    if (s.includes('naver')) return '네이버 검색';
    if (s.includes('instagram') || s === 'ig') return '인스타그램';
    if (s.includes('youtube') || s.includes('youtu.be')) return '유튜브';
    if (s.includes('google')) return '구글 검색';
    if (s.includes('kakao') || s === 'pf.kakao.com') return '카카오톡 채널';
    return '기타·추천';
}

const DATE_RANGES: Record<AdminTrafficPeriod, [{ startDate: string; endDate: string }, { startDate: string; endDate: string }]> = {
    today: [{ startDate: 'today', endDate: 'today' }, { startDate: 'yesterday', endDate: 'yesterday' }],
    '7d': [{ startDate: '6daysAgo', endDate: 'today' }, { startDate: '13daysAgo', endDate: '7daysAgo' }],
    '30d': [{ startDate: '29daysAgo', endDate: 'today' }, { startDate: '59daysAgo', endDate: '30daysAgo' }],
};
export const isTrafficPeriod = (value: string): value is AdminTrafficPeriod => value in DATE_RANGES;

/** One batch: totals for both ranges, sessions by source, and quote leads by source. */
export function trafficReportRequest(period: AdminTrafficPeriod) {
    const [current, previous] = DATE_RANGES[period];
    const bySource = [{ name: 'sessionSource' }, { name: 'sessionMedium' }];
    const lead = { filter: { fieldName: 'eventName', stringFilter: { matchType: 'EXACT', value: 'generate_lead' } } };
    return { requests: [
        { dateRanges: [current, previous], metrics: [{ name: 'activeUsers' }, { name: 'sessions' }, { name: 'screenPageViews' }] },
        { dateRanges: [current], dimensions: bySource, metrics: [{ name: 'sessions' }], limit: 1000 },
        { dateRanges: [current, previous], dimensions: bySource, metrics: [{ name: 'eventCount' }], dimensionFilter: lead, limit: 1000 },
    ] };
}

interface GaRow { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }
interface GaReport { rows?: GaRow[]; dimensionHeaders?: { name?: string }[] }
const int = (value: string | undefined) => { const n = Number(value); return Number.isFinite(n) ? Math.round(n) : 0; };
/** With two date ranges GA appends a `dateRange` dimension whose value is "date_range_0" / "date_range_1". */
const rangeIndex = (report: GaReport, row: GaRow) => {
    const at = (report.dimensionHeaders || []).findIndex(header => header.name === 'dateRange');
    return at < 0 ? 0 : row.dimensionValues?.[at]?.value === 'date_range_1' ? 1 : 0;
};

export function buildTrafficData(period: AdminTrafficPeriod, reports: GaReport[], generatedAt: string): AdminTrafficData {
    const [totals, sessions, leads] = reports;
    const total = [{ visitors: 0, sessions: 0, pageViews: 0 }, { visitors: 0, sessions: 0, pageViews: 0 }];
    (totals?.rows || []).forEach(row => {
        const t = total[rangeIndex(totals, row)];
        t.visitors += int(row.metricValues?.[0]?.value); t.sessions += int(row.metricValues?.[1]?.value); t.pageViews += int(row.metricValues?.[2]?.value);
    });
    const channels = new Map(TRAFFIC_CHANNELS.map(name => [name, { name, sessions: 0, leads: 0 }]));
    (sessions?.rows || []).forEach(row => {
        const channel = classifyTrafficSource(row.dimensionValues?.[0]?.value || '', row.dimensionValues?.[1]?.value || '');
        channels.get(channel)!.sessions += int(row.metricValues?.[0]?.value);
    });
    const leadTotals = [0, 0];
    (leads?.rows || []).forEach(row => {
        const index = rangeIndex(leads, row), count = int(row.metricValues?.[0]?.value);
        leadTotals[index] += count;
        if (index === 0) channels.get(classifyTrafficSource(row.dimensionValues?.[0]?.value || '', row.dimensionValues?.[1]?.value || ''))!.leads += count;
    });
    return {
        configured: true, period, generatedAt,
        current: { ...total[0], leads: leadTotals[0] },
        previous: { ...total[1], leads: leadTotals[1] },
        channels: [...channels.values()],
    };
}

/* ───────── service account → access token (RS256 JWT, WebCrypto) ───────── */

interface ServiceAccount { client_email: string; private_key: string; token_uri?: string }
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
    try {
        const value = JSON.parse(raw || '');
        return typeof value?.client_email === 'string' && typeof value?.private_key === 'string' ? value : null;
    } catch { return null; }
}

const base64url = (bytes: ArrayBuffer | Uint8Array) => {
    let binary = '';
    new Uint8Array(bytes).forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const jsonPart = (value: unknown) => base64url(new TextEncoder().encode(JSON.stringify(value)));

export async function signServiceAccountJwt(account: ServiceAccount, nowSeconds: number): Promise<string> {
    const pem = account.private_key.replace(/\\n/g, '\n').replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, '');
    const der = Uint8Array.from(atob(pem), char => char.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const unsigned = `${jsonPart({ alg: 'RS256', typ: 'JWT' })}.${jsonPart({
        iss: account.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly',
        aud: account.token_uri || 'https://oauth2.googleapis.com/token', iat: nowSeconds, exp: nowSeconds + 3600,
    })}`;
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
    return `${unsigned}.${base64url(signature)}`;
}

export class TrafficError extends Error {
    readonly status: number;
    constructor(message: string, status: number) { super(message); this.status = status; }
}

let cachedToken: { email: string; token: string; expires: number } | null = null;
async function accessToken(account: ServiceAccount, fetcher: typeof fetch, now: number): Promise<string> {
    if (cachedToken && cachedToken.email === account.client_email && cachedToken.expires > now + 60_000) return cachedToken.token;
    const assertion = await signServiceAccountJwt(account, Math.floor(now / 1000));
    const res = await fetcher(account.token_uri || 'https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    const data = await res.json().catch(() => null) as { access_token?: unknown; expires_in?: unknown } | null;
    if (!res.ok || typeof data?.access_token !== 'string') throw new TrafficError('GA4 서비스 계정 인증에 실패했습니다. 등록한 JSON 키를 확인해 주세요.', 502);
    cachedToken = { email: account.client_email, token: data.access_token, expires: now + int(String(data.expires_in || 3600)) * 1000 };
    return data.access_token;
}

export interface TrafficEnv { GA4_PROPERTY_ID?: string; GA4_SERVICE_ACCOUNT_JSON?: string }

/** Unconfigured is a normal answer (the dashboard explains the setup); GA failures are errors, never zeros. */
export async function readTraffic(env: TrafficEnv, period: AdminTrafficPeriod, fetcher: typeof fetch = fetch, now = Date.now()): Promise<AdminTrafficData> {
    const property = (env.GA4_PROPERTY_ID || '').trim(), account = parseServiceAccount(env.GA4_SERVICE_ACCOUNT_JSON);
    if (!/^\d+$/.test(property) || !account) return { configured: false, period };
    const token = await accessToken(account, fetcher, now);
    const res = await fetcher(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:batchRunReports`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(trafficReportRequest(period)),
    });
    const data = await res.json().catch(() => null) as { reports?: GaReport[] } | null;
    if (res.status === 403) throw new TrafficError('서비스 계정에 GA4 속성 읽기 권한이 없습니다. GA4 속성 액세스 관리에서 뷰어로 추가해 주세요.', 502);
    if (res.status === 429) throw new TrafficError('GA4 조회 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.', 503);
    if (!res.ok || !Array.isArray(data?.reports)) throw new TrafficError('GA4 통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 502);
    return buildTrafficData(period, data.reports, new Date(now).toISOString());
}

/** Test hook: forget the isolate-level token. */
export const resetTrafficTokenCache = () => { cachedToken = null; };
