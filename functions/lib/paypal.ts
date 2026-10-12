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
    if (!res.ok) {
        throw new Error(`[PayPal Invoice][auth] ${res.status}: ${await res.text()}`);
    }
    const data: any = await res.json();
    if (!data.access_token) {
        throw new Error('[PayPal Invoice][auth] access_token missing from response');
    }
    return data.access_token;
}

function buildInvoiceBody(opts: {
    businessEmail: string;
    customerEmail: string;
    customerName: string;
    reservationNumber: string;
    productName: string;
    depositAmount: number;
}, invoiceNumber: string) {
    return {
        detail: {
            invoice_number: invoiceNumber,
            currency_code: 'JPY',
            locale: 'ko_KR',
            note: `예약 번호: ${opts.reservationNumber}\n잔금은 현지에서 엔화 현금으로 결제해 주세요.`,
            payment_term: { term_type: 'NET_10' },
            memo: opts.productName,
        },
        invoicer: {
            email_address: opts.businessEmail,
        },
        primary_recipients: [{
            billing_info: {
                email_address: opts.customerEmail,
                name: { given_name: opts.customerName },
            },
        }],
        items: [{
            name: `예약금 - ${opts.productName}`,
            description: `예약 번호: ${opts.reservationNumber}`,
            quantity: '1',
            unit_amount: { currency_code: 'JPY', value: String(Math.round(opts.depositAmount)) },
            unit_of_measure: 'QUANTITY',
        }],
        amount: {
            breakdown: {
                item_total: { currency_code: 'JPY', value: String(Math.round(opts.depositAmount)) },
            },
        },
    };
}

function isDuplicateInvoiceNumber(errorBody: string): boolean {
    return errorBody.includes('DUPLICATE_INVOICE_NUMBER');
}

export async function sendPayPalInvoice(opts: {
    clientId: string;
    secret: string;
    businessEmail: string;
    customerEmail: string;
    customerName: string;
    reservationNumber: string;
    productName: string;
    depositAmount: number;
    environment?: string;
}): Promise<{ invoiceId: string; invoiceNumber: string }> {
    const apiBase = getPayPalApi(opts.environment);
    const token = await getAccessToken(apiBase, opts.clientId, opts.secret);

    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
    };

    const createInvoice = (invoiceNumber: string) => fetch(`${apiBase}/v2/invoicing/invoices`, {
        method: 'POST',
        headers,
        body: JSON.stringify(buildInvoiceBody(opts, invoiceNumber)),
    });

    let invoiceNumber = opts.reservationNumber;
    let createRes = await createInvoice(invoiceNumber);
    if (!createRes.ok) {
        const createError = await createRes.text();
        if (!isDuplicateInvoiceNumber(createError)) {
            throw new Error(`[PayPal Invoice][create] ${createRes.status}: ${createError}`);
        }

        invoiceNumber = `${opts.reservationNumber}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
        console.warn(`[PayPal Invoice][create] duplicate invoice number; retrying as ${invoiceNumber}`);
        createRes = await createInvoice(invoiceNumber);
        if (!createRes.ok) {
            throw new Error(`[PayPal Invoice][create retry] ${createRes.status}: ${await createRes.text()}`);
        }
    }

    const locationHeader = createRes.headers.get('Location') || createRes.headers.get('location');
    let invoiceId: string | undefined;

    if (locationHeader) {
        invoiceId = locationHeader.split('/').pop();
    }

    if (!invoiceId) {
        try {
            const invoice: any = await createRes.json();
            invoiceId = invoice.id || invoice.links?.find((l: any) => l.rel === 'self')?.href?.split('/').pop();
        } catch { /* empty body */ }
    }

    if (!invoiceId) {
        throw new Error('[PayPal Invoice][create] no invoice ID in response');
    }

    const sendRes = await fetch(`${apiBase}/v2/invoicing/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ send_to_recipient: true, send_to_invoicer: true }),
    });

    if (!sendRes.ok) {
        throw new Error(`[PayPal Invoice][send] ${sendRes.status}: ${await sendRes.text()}`);
    }

    return { invoiceId, invoiceNumber };
}
