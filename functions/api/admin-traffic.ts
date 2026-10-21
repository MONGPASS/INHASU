import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';
import { TrafficError, isTrafficPeriod, readTraffic, type TrafficEnv } from '../lib/ga4Traffic';

const CACHE_SECONDS = 900;
const app = new Hono<{ Bindings: TrafficEnv & { DB: unknown } }>();

/** GA4 aggregates only (no visitor-level data). Cached per period in the edge cache to protect GA quota. */
app.get('/', requireAdmin, async c => {
    c.header('Cache-Control', 'private, no-store');
    const period = c.req.query('period') || '30d';
    if (!isTrafficPeriod(period)) return c.json({ error: '조회 기간이 올바르지 않습니다.' }, 400);
    const cache = typeof caches !== 'undefined' ? (caches as unknown as { default?: Cache }).default : undefined;
    const key = new Request(`https://admin-traffic.cache/${encodeURIComponent(c.env.GA4_PROPERTY_ID || '')}/${period}`);
    const hit = await cache?.match(key);
    if (hit) return c.json(await hit.json());
    try {
        const data = await readTraffic(c.env, period);
        if (data.configured && cache) {
            c.executionCtx.waitUntil(cache.put(key, new Response(JSON.stringify(data), {
                headers: { 'Content-Type': 'application/json', 'Cache-Control': `max-age=${CACHE_SECONDS}` },
            })));
        }
        return c.json(data);
    } catch (error) {
        if (error instanceof TrafficError) return c.json({ error: error.message }, error.status as 502 | 503);
        return c.json({ error: 'GA4 통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' }, 502);
    }
});
export default app;
