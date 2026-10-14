import { Hono } from 'hono';
import { sendEmail, baseLayout } from '../../lib/mailer';
import { BRAND, COMPANY_INFO, KAKAO_CHANNEL_URL } from '../../../src/constants/company';

interface Env {
    DB: D1Database;
    RESEND_API_KEY: string;
    MAIL_FROM?: string;
    CRON_SECRET: string;
}

interface ReservationRow {
    id: string;
    reservation_number: string | null;
    product_name: string | null;
    customer_name: string | null;
    customer_email: string | null;
    end_date: string | null;
    history: string | null;
}

interface HistoryEntry {
    type?: string;
    date?: string;
    [key: string]: unknown;
}

const app = new Hono<{ Bindings: Env }>();
const SITE_URL = BRAND.siteUrl;
const PROCESSING_TIMEOUT_MS = 60 * 60 * 1000;

function escapeHtml(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function parseHistory(value: string | null): HistoryEntry[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function todayInJapan() {
    return new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

function formatJapaneseDate(value: string | null) {
    const matched = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!matched) return value || '-';
    return `${Number(matched[1])}년 ${Number(matched[2])}월 ${Number(matched[3])}일`;
}

function reviewRequestTemplate(data: {
    customerName: string;
    reservationNumber: string;
    productName: string;
    endDate: string;
    reviewUrl: string;
}) {
    const customerName = escapeHtml(data.customerName);
    const reservationNumber = escapeHtml(data.reservationNumber);
    const productName = escapeHtml(data.productName);
    const endDate = escapeHtml(data.endDate);
    const reviewUrl = escapeHtml(data.reviewUrl);

    return baseLayout(`
<div class="header">
  <h1>${BRAND.name}</h1>
  <p>여행 소감을 들려주세요</p>
</div>
<div class="body">
  <p class="greeting">${customerName} 님</p>
  <p>${BRAND.name}를 이용해 주셔서 진심으로 감사드립니다.<br>몽골 여행은 즐거우셨나요?</p>
  <div class="card">
    <div class="card-row"><span class="label">예약 번호</span><span class="value">${reservationNumber}</span></div>
    <div class="card-row"><span class="label">투어명</span><span class="value">${productName}</span></div>
    <div class="card-row"><span class="label">여행 종료일</span><span class="value">${endDate}</span></div>
  </div>
  <p>더 나은 서비스를 만들고 앞으로 여행하실 분들께 도움이 될 수 있도록 소중한 후기를 남겨 주세요.</p>
  <div style="text-align:center;">
    <a class="btn" href="${reviewUrl}">여행 후기 쓰기</a>
  </div>
  <p style="font-size:13px;color:#6b8f88;">후기를 작성하려면 Google 계정으로 로그인해야 합니다. 링크를 열면 이번 예약이 자동으로 선택됩니다.</p>
</div>
<div class="footer">
  <a href="${SITE_URL}">${BRAND.domain}</a> |
  <a href="mailto:${COMPANY_INFO.email}">${COMPANY_INFO.email}</a> |
  <a href="${KAKAO_CHANNEL_URL}">카카오톡 채널</a>
</div>`);
}

// POST /api/cron/review-request
// Run once a day from an external scheduler with Authorization: Bearer <CRON_SECRET>.
// Any eligible past reservation is picked up, so a missed run is automatically backfilled.
app.post('/', async (c) => {
    const auth = c.req.header('Authorization');
    if (!c.env.CRON_SECRET || auth !== `Bearer ${c.env.CRON_SECRET}`) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const today = todayInJapan();
    const result = await c.env.DB.prepare(`
        SELECT id, reservation_number, product_name, customer_name, customer_email, end_date, history
        FROM reservations
        WHERE customer_email IS NOT NULL
          AND TRIM(customer_email) <> ''
          AND end_date IS NOT NULL
          AND SUBSTR(end_date, 1, 10) < ?
          AND status IN ('confirmed', 'paid', 'completed')
        ORDER BY end_date ASC
    `).bind(today).all<ReservationRow>();

    const rows = result.results || [];
    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const reservation of rows) {
        const originalHistory = reservation.history || '[]';
        const history = parseHistory(reservation.history);
        if (history.some((entry) => entry.type === 'review_request_sent' || entry.type === 'review_submitted')) {
            skipped++;
            continue;
        }

        const now = new Date();
        const activeClaim = history.find((entry) => entry.type === 'review_request_processing');
        if (activeClaim?.date && now.getTime() - new Date(activeClaim.date).getTime() < PROCESSING_TIMEOUT_MS) {
            skipped++;
            continue;
        }

        const claimedHistory = history
            .filter((entry) => entry.type !== 'review_request_processing')
            .concat({ type: 'review_request_processing', date: now.toISOString() });
        const claimedHistoryJson = JSON.stringify(claimedHistory);

        // Compare-and-set prevents two overlapping cron runs from sending the same email.
        const claim = await c.env.DB.prepare(`
            UPDATE reservations
            SET history = ?
            WHERE id = ? AND COALESCE(history, '[]') = ?
        `).bind(claimedHistoryJson, reservation.id, originalHistory).run();

        if (!claim.meta.changes) {
            skipped++;
            continue;
        }

        const reviewUrl = `${SITE_URL}/reviews/write?reservationId=${encodeURIComponent(reservation.id)}`;
        try {
            await sendEmail(
                c.env.RESEND_API_KEY,
                reservation.customer_email!,
                `[여행은 즐거우셨나요?] ${reservation.product_name || '몽골 투어'} | ${BRAND.name}`,
                reviewRequestTemplate({
                    customerName: reservation.customer_name || '고객',
                    reservationNumber: reservation.reservation_number || reservation.id.slice(0, 8).toUpperCase(),
                    productName: reservation.product_name || '몽골 투어',
                    endDate: formatJapaneseDate(reservation.end_date),
                    reviewUrl,
                }),
                { env: c.env },
            );

            const completedHistory = claimedHistory
                .filter((entry) => entry.type !== 'review_request_processing')
                .concat({ type: 'review_request_sent', date: new Date().toISOString(), reviewUrl });

            await c.env.DB.prepare(`
                UPDATE reservations
                SET history = ?
                WHERE id = ? AND history = ?
            `).bind(JSON.stringify(completedHistory), reservation.id, claimedHistoryJson).run();
            sent++;
        } catch (error: unknown) {
            // Release the claim so a later daily run can retry a temporary delivery failure.
            await c.env.DB.prepare(`
                UPDATE reservations
                SET history = ?
                WHERE id = ? AND history = ?
            `).bind(originalHistory, reservation.id, claimedHistoryJson).run();
            const message = error instanceof Error ? error.message : 'Unknown email error';
            errors.push(`${reservation.id}: ${message}`);
        }
    }

    return c.json({ success: true, date: today, considered: rows.length, sent, skipped, errors });
});

export default app;
