import { Hono } from 'hono';
import { requireAdmin } from '../lib/adminAuth';
import { readQuoteBookings } from '../lib/quoteBookings';

const app = new Hono<{ Bindings: { DB: any } }>();

// 관리자 세션만 허용. 기존 공유 관리자 비밀번호는 목록 조회를 위해 브라우저에 배포하지 않는다.
app.get('/quote', requireAdmin, async (c) => {
    c.header('Cache-Control', 'private, no-store');
    try {
        return c.json(await readQuoteBookings(c.env.DB));
    } catch (error) {
        console.error('[Admin bookings] quote bookings unavailable', error);
        return c.json({ error: '견적 예약을 불러오지 못했습니다. 다시 시도해 주세요.' }, 503);
    }
});

export default app;
