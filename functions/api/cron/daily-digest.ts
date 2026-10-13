import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { reservations } from '../../../src/db/schema/reservations';
import { eq, and, like } from 'drizzle-orm';
import { sendEmail, baseLayout } from '../../lib/mailer';
import { BRAND } from '../../../src/constants/company';

interface Env {
    DB: D1Database;
    RESEND_API_KEY: string;
    ADMIN_EMAIL: string;
    CRON_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

function tplDailyDigest(data: {
    date: string;
    departures: any[];
    unpaid: any[];
    newToday: any[];
}) {
    const won = (n: number) => `${n.toLocaleString('ko-KR')}원`;

    const departureRows = data.departures.length
        ? data.departures.map(r => `
    <tr>
      <td style="color:#1eb496;font-weight:700;">${r.reservationNumber || '-'}</td>
      <td>${r.customerName || '-'}</td>
      <td>${r.productName || '-'}</td>
      <td>${r.travelers || 1}명</td>
    </tr>`).join('')
        : '<tr><td colspan="4" style="color:#9ca3af;text-align:center;">오늘 출발 없음</td></tr>';

    const unpaidRows = data.unpaid.length
        ? data.unpaid.map(r => `
    <tr>
      <td style="color:#ef4444;font-weight:700;">${r.reservationNumber || '-'}</td>
      <td>${r.customerName || '-'}</td>
      <td>${r.productName || '-'}</td>
      <td style="color:#ef4444;">${won(r.depositAmount || 0)}</td>
    </tr>`).join('')
        : '<tr><td colspan="4" style="color:#9ca3af;text-align:center;">미결제 없음 ✅</td></tr>';

    const newRows = data.newToday.length
        ? data.newToday.map(r => `
    <tr>
      <td style="color:#1eb496;font-weight:700;">${r.reservationNumber || '-'}</td>
      <td>${r.customerName || '-'}</td>
      <td>${r.productName || '-'}</td>
      <td>${won(r.totalPrice || 0)}</td>
    </tr>`).join('')
        : '<tr><td colspan="4" style="color:#9ca3af;text-align:center;">오늘 신규 예약 없음</td></tr>';

    return baseLayout(`
<div class="header">
  <h1>📊 일일 리포트</h1>
  <p>${data.date} | ${BRAND.name}</p>
</div>
<div class="body">
  <p class="greeting">좋은 아침입니다. 오늘의 예약 현황입니다.</p>

  <h3 style="color:#1a2e2a;margin-top:28px;margin-bottom:8px;">✈️ 오늘 출발 (${data.departures.length}건)</h3>
  <table>
    <tr><th>예약 번호</th><th>고객</th><th>투어</th><th>인원</th></tr>
    ${departureRows}
  </table>

  <h3 style="color:#1a2e2a;margin-top:28px;margin-bottom:8px;">⚠️ 미결제 예약 (${data.unpaid.length}건)</h3>
  <table>
    <tr><th>예약 번호</th><th>고객</th><th>투어</th><th>예약금</th></tr>
    ${unpaidRows}
  </table>

  <h3 style="color:#1a2e2a;margin-top:28px;margin-bottom:8px;">🆕 오늘 신규 예약 (${data.newToday.length}건)</h3>
  <table>
    <tr><th>예약 번호</th><th>고객</th><th>투어</th><th>합계</th></tr>
    ${newRows}
  </table>

  <a class="btn" href="${BRAND.siteUrl}/admin/reservations" style="margin-top:28px;">관리 화면 열기</a>
</div>
<div class="footer">${BRAND.name} 관리 시스템 | 자동 발송 메일</div>`);
}

// POST /api/cron/daily-digest
app.post('/', async (c) => {
    const auth = c.req.header('Authorization');
    if (!c.env.CRON_SECRET || auth !== `Bearer ${c.env.CRON_SECRET}`) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const db = drizzle(c.env.DB);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const [departures, unpaid, newToday] = await Promise.all([
        db.select().from(reservations).where(like(reservations.startDate, `${today}%`)).all(),
        db.select().from(reservations).where(eq(reservations.status, 'pending_payment')).all(),
        db.select().from(reservations).where(like(reservations.createdAt, `${today}%`)).all(),
    ]);

    const adminEmail = c.env.ADMIN_EMAIL || 'agape_ibeel@hanpass.com';
    const dateLabel = new Date().toLocaleDateString('ko-KR', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
    });

    await sendEmail(
        c.env.RESEND_API_KEY,
        adminEmail,
        `[일일 리포트] ${today} 예약 현황 | ${BRAND.name}`,
        tplDailyDigest({ date: dateLabel, departures, unpaid, newToday }),
    );

    return c.json({
        success: true,
        departures: departures.length,
        unpaid: unpaid.length,
        newToday: newToday.length,
    });
});

export default app;