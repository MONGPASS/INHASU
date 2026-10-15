import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { reservations } from '../../../src/db/schema/reservations';
import { eq } from 'drizzle-orm';
import { sendEmail, baseLayout } from '../../lib/mailer';
import { BRAND, COMPANY_INFO, DEPOSIT_ACCOUNT, DEPOSIT_PAYMENT_METHOD, KAKAO_CHANNEL_URL } from '../../../src/constants/company';

interface Env {
    DB: D1Database;
    RESEND_API_KEY: string;
    MAIL_FROM?: string;
    ADMIN_EMAIL: string;
    CRON_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

/** 고객이 '입금 완료'를 신고한 예약인가 — deposit_report 는 JSON { status: 'reported', name, reportedAt }, 미신고는 NULL. */
const hasDepositReport = (value: unknown): boolean => {
    if (typeof value !== 'string' || !value) return false;
    try {
        return JSON.parse(value)?.status === 'reported';
    } catch {
        return false;
    }
};

function tplPaymentReminder(data: { customerName: string; reservationNumber: string; productName: string; depositAmount: number }) {
    return baseLayout(`
<div class="header">
  <h1>🐴 ${BRAND.name}</h1>
  <p>예약금 입금 안내</p>
</div>
<div class="body">
  <p class="greeting">${data.customerName} 님</p>
  <p>예약해 주셔서 감사합니다.<br>예약금 입금이 아직 확인되지 않았습니다.</p>
  <div class="card">
    <div class="card-row"><span class="label">예약 번호</span><span class="value" style="color:#1eb496;font-size:18px;font-weight:800;">${data.reservationNumber}</span></div>
    <div class="card-row"><span class="label">투어명</span><span class="value">${data.productName}</span></div>
    <div class="card-row"><span class="label">예약금(${DEPOSIT_PAYMENT_METHOD})</span><span class="value" style="color:#1eb496;">${data.depositAmount.toLocaleString('ko-KR')}원</span></div>
  </div>
  <div class="card">
    <div class="card-row"><span class="label">은행</span><span class="value">${DEPOSIT_ACCOUNT.bank}</span></div>
    <div class="card-row"><span class="label">계좌번호</span><span class="value">${DEPOSIT_ACCOUNT.number}</span></div>
    <div class="card-row"><span class="label">예금주</span><span class="value">${DEPOSIT_ACCOUNT.holder}</span></div>
  </div>
  <div class="alert">
    <strong>⚠️ 예약금 입금 기한이 다가오고 있습니다</strong><br><br>
    위 계좌로 예약금을 입금하고, 마이페이지에서 <strong>'입금 완료'</strong>를 알려 주세요.<br>
    담당자가 확인한 뒤 예약이 확정됩니다.<br><br>
    이미 입금하셨다면 마이페이지에서 <strong>'입금 완료'</strong>만 알려 주시면 됩니다.
  </div>
  <p style="font-size:14px;color:#4a6b64;">
    궁금한 점은 <a href="${KAKAO_CHANNEL_URL}" style="color:#1eb496;">카카오톡 채널</a> 또는 <a href="mailto:${COMPANY_INFO.email}" style="color:#1eb496;">${COMPANY_INFO.email}</a> 으로 문의해 주세요.
  </p>
  <a class="btn" href="${BRAND.siteUrl}/mypage/reservations">예약 확인하기</a>
</div>
<div class="footer">
  <a href="${BRAND.siteUrl}">${BRAND.domain}</a> |
  <a href="mailto:${COMPANY_INFO.email}">${COMPANY_INFO.email}</a> |
  <a href="${KAKAO_CHANNEL_URL}">카카오톡 채널</a>
</div>`);
}

// POST /api/cron/payment-reminder
// Called by external cron service (e.g. cron-job.org) with Authorization: Bearer <CRON_SECRET>
app.post('/', async (c) => {
    const auth = c.req.header('Authorization');
    if (!c.env.CRON_SECRET || auth !== `Bearer ${c.env.CRON_SECRET}`) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const db = drizzle(c.env.DB);

    // 접수 후 24시간이 지난 입금 대기 예약. SELECT * 로 읽어 deposit_report 컬럼이 아직 없는 DB
    // (/api/migrate-db 를 열기 전)에서도 깨지지 않게 하고, created_at 은 datetime() 으로 비교한다
    // ('YYYY-MM-DD HH:MM:SS' 와 ISO 형식이 섞여 있어 문자열 비교로는 24시간을 정확히 가릴 수 없다).
    const { results } = await c.env.DB.prepare(
        `SELECT * FROM reservations
         WHERE status = 'pending_payment' AND datetime(created_at) < datetime('now', '-24 hours')`
    ).all();
    const pending = (results || []) as Array<Record<string, any>>;

    let sent = 0;
    const errors: string[] = [];

    for (const r of pending) {
        if (!r.customer_email) continue;
        // 이미 입금을 신고했거나(담당자 확인 대기) 입금이 확인된 예약에는 재촉 메일을 보내지 않는다.
        if (hasDepositReport(r.deposit_report) || r.deposit_status === 'paid') continue;

        const history: any[] = r.history ? JSON.parse(r.history) : [];
        if (history.some((h) => h.type === 'reminder_sent')) continue;

        try {
            await sendEmail(
                c.env.RESEND_API_KEY,
                r.customer_email,
                `[입금 안내] ${r.product_name || '투어'} 예약금 입금을 확인해 주세요 | ${BRAND.name}`,
                tplPaymentReminder({
                    customerName: r.customer_name || '고객',
                    reservationNumber: r.reservation_number || String(r.id).slice(0, 8).toUpperCase(),
                    productName: r.product_name || '투어',
                    depositAmount: Number(r.deposit_amount) || 0,
                }),
                { env: c.env },
            );

            history.push({ type: 'reminder_sent', date: new Date().toISOString() });
            await db
                .update(reservations)
                .set({ history: JSON.stringify(history) })
                .where(eq(reservations.id, r.id))
                .run();

            sent++;
        } catch (e: any) {
            errors.push(`${r.id}: ${e.message}`);
        }
    }

    return c.json({ success: true, sent, skipped: pending.length - sent - errors.length, errors });
});

export default app;
