import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { reservations } from '../../../src/db/schema/reservations';
import { eq } from 'drizzle-orm';
import { sendEmail } from '../../lib/mailer';
import { createNotification } from '../notifications/index';
import { tplPaymentConfirmed } from '../notifications/email';

interface Env {
    DB: D1Database;
    PAYPAL_CLIENT_ID: string;
    PAYPAL_SECRET_KEY: string;
    PAYPAL_WEBHOOK_ID: string;
    PAYPAL_ENVIRONMENT?: string;
    RESEND_API_KEY: string;
    MAIL_FROM?: string;
}

const PAYPAL_LIVE_API = 'https://api-m.paypal.com';
const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';

function getPayPalApi(environment?: string): string {
    return environment?.toLowerCase() === 'sandbox'
        ? PAYPAL_SANDBOX_API
        : PAYPAL_LIVE_API;
}

async function getAccessToken(apiBase: string, clientId: string, secret: string): Promise<string> {
    const res = await fetch(`${apiBase}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${btoa(`${clientId}:${secret}`)}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw new Error(`PayPal auth failed: ${await res.text()}`);
    const data: any = await res.json();
    return data.access_token;
}

async function verifyWebhookSignature(
    apiBase: string,
    clientId: string,
    secret: string,
    webhookId: string,
    headers: Record<string, string>,
    body: any,
): Promise<boolean> {
    try {
        const token = await getAccessToken(apiBase, clientId, secret);
        const res = await fetch(`${apiBase}/v1/notifications/verify-webhook-signature`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                auth_algo: headers['paypal-auth-algo'],
                cert_url: headers['paypal-cert-url'],
                transmission_id: headers['paypal-transmission-id'],
                transmission_sig: headers['paypal-transmission-sig'],
                transmission_time: headers['paypal-transmission-time'],
                webhook_id: webhookId,
                webhook_event: body,
            }),
        });
        if (!res.ok) return false;
        const result: any = await res.json();
        return result.verification_status === 'SUCCESS';
    } catch {
        return false;
    }
}

const app = new Hono<{ Bindings: Env }>();

// POST /api/webhooks/paypal
app.post('/', async (c) => {
    const rawBody = await c.req.text();
    let event: any;
    try {
        event = JSON.parse(rawBody);
    } catch {
        return c.json({ error: 'Invalid JSON' }, 400);
    }

    // Verify webhook signature if PAYPAL_WEBHOOK_ID is configured
    if (c.env.PAYPAL_WEBHOOK_ID) {
        const headers: Record<string, string> = {
            'paypal-auth-algo': c.req.header('paypal-auth-algo') || '',
            'paypal-cert-url': c.req.header('paypal-cert-url') || '',
            'paypal-transmission-id': c.req.header('paypal-transmission-id') || '',
            'paypal-transmission-sig': c.req.header('paypal-transmission-sig') || '',
            'paypal-transmission-time': c.req.header('paypal-transmission-time') || '',
        };

        const valid = await verifyWebhookSignature(
            getPayPalApi(c.env.PAYPAL_ENVIRONMENT),
            c.env.PAYPAL_CLIENT_ID,
            c.env.PAYPAL_SECRET_KEY,
            c.env.PAYPAL_WEBHOOK_ID,
            headers,
            event,
        );

        if (!valid) {
            console.error('[PayPal Webhook] Signature verification failed');
            return c.json({ error: 'Signature verification failed' }, 401);
        }
    }

    const eventType: string = event.event_type || '';

    // Invoice payment completed → confirm reservation
    if (eventType === 'INVOICES.PAYMENT.COMPLETED') {
        const invoiceNumber: string = event.resource?.detail?.invoice_number || '';
        if (!invoiceNumber) {
            return c.json({ received: true, note: 'no invoice_number' });
        }

        const db = drizzle(c.env.DB);
        let reservation = await db
            .select()
            .from(reservations)
            .where(eq(reservations.reservationNumber, invoiceNumber))
            .get();

        // Duplicate invoice recovery appends a short suffix to the PayPal
        // invoice number. Resolve that payment back to the original booking.
        if (!reservation) {
            const suffixedNumber = invoiceNumber.match(/^(MN\d+)-[A-Z0-9]{6}$/i);
            if (suffixedNumber) {
                reservation = await db
                    .select()
                    .from(reservations)
                    .where(eq(reservations.reservationNumber, suffixedNumber[1]))
                    .get();
            }
        }

        if (reservation) {
            let history: any[] = [];
            try {
                history = reservation.history ? JSON.parse(reservation.history) : [];
            } catch {
                history = [];
            }

            if (event.id && history.some((item) => item.type === 'payment_confirmation_email_sent' && item.eventId === event.id)) {
                return c.json({ received: true, note: 'duplicate event' });
            }

            const confirmedAt = new Date().toISOString();
            const paymentAlreadyRecorded = event.id
                ? history.some((item) => item.type === 'payment_confirmed' && item.eventId === event.id)
                : false;
            if (!paymentAlreadyRecorded) {
                history.push({
                    type: 'payment_confirmed',
                    date: confirmedAt,
                    source: 'paypal_webhook',
                    eventId: event.id,
                });
            }

            await db
                .update(reservations)
                .set({
                    status: 'confirmed',
                    depositStatus: 'paid',
                    history: JSON.stringify(history),
                })
                .where(eq(reservations.id, reservation.id))
                .run();

            console.log(`[PayPal Webhook] Confirmed reservation ${invoiceNumber}`);

            const rawPaymentAmount =
                event.resource?.amount?.value
                ?? event.resource?.payment_amount?.value
                ?? event.resource?.detail?.payment_amount?.value;
            const parsedPaymentAmount = Number(rawPaymentAmount);
            const paymentAmount = Number.isFinite(parsedPaymentAmount)
                ? parsedPaymentAmount
                : (reservation.depositAmount || 0);

            try {
                if (!c.env.RESEND_API_KEY) {
                    throw new Error('RESEND_API_KEY not set');
                }
                if (!reservation.customerEmail) {
                    throw new Error('Customer email is missing');
                }

                await sendEmail(
                    c.env.RESEND_API_KEY,
                    reservation.customerEmail,
                    `[입금 확인] ${reservation.productName || '몽골 여행'} 예약금 입금을 확인했습니다 | 몽골리아 은하수`,
                    tplPaymentConfirmed({
                        customerName: reservation.customerName,
                        reservationNumber: reservation.reservationNumber || invoiceNumber,
                        reservationId: reservation.reservationNumber || invoiceNumber,
                        reservationDbId: reservation.id,
                        productName: reservation.productName,
                        paymentAmount,
                        balanceAmount: reservation.balanceAmount || 0,
                    }),
                    { env: c.env },
                );

                history.push({
                    type: 'payment_confirmation_email_sent',
                    date: new Date().toISOString(),
                    recipient: reservation.customerEmail,
                    eventId: event.id,
                });
            } catch (emailError: any) {
                console.error(`[PayPal Webhook] Payment confirmation email failed for ${invoiceNumber}:`, emailError);
                history.push({
                    type: 'payment_confirmation_email_failed',
                    date: new Date().toISOString(),
                    reason: emailError?.message || String(emailError),
                    eventId: event.id,
                });
            }

            if (reservation.userId) {
                await createNotification(c.env.DB, {
                    userId: reservation.userId,
                    type: 'reservation',
                    title: '예약금 입금을 확인했습니다',
                    message: '예약금 입금을 확인했습니다. 현지 수배를 진행합니다.',
                    link: `/mypage/reservations/${reservation.id}`,
                });
            }

            try {
                await db
                    .update(reservations)
                    .set({ history: JSON.stringify(history) })
                    .where(eq(reservations.id, reservation.id))
                    .run();
            } catch (historyError) {
                console.error(`[PayPal Webhook] Failed to record notification history for ${invoiceNumber}:`, historyError);
            }
        } else {
            console.warn(`[PayPal Webhook] Reservation not found for invoice ${invoiceNumber}`);
        }
    }

    return c.json({ received: true });
});

export default app;
