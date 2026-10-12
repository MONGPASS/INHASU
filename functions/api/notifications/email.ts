import { Hono } from 'hono';
import { createNotification } from './index';
import { getSessionUser } from '../../lib/userAuth';
import { BRAND, COMPANY_INFO, DEPOSIT_ACCOUNT, DEPOSIT_PAYMENT_METHOD, KAKAO_CHANNEL_URL } from '../../../src/constants/company';

interface Env {
    DB: any;
    RESEND_API_KEY: string;
    ADMIN_EMAIL: string;
}

const app = new Hono<{ Bindings: Env }>();

// 발신 주소(noreply@mongolryokou.com)는 Resend에서 인증된 도메인이라 그대로 둔다. 표시 이름만 브랜드에 맞춘다.
const FROM = `${BRAND.name} <noreply@mongolryokou.com>`;
const SITE_URL = BRAND.siteUrl;
const CONTACT_EMAIL = COMPANY_INFO.email;

async function sendEmail(apiKey: string, to: string | string[], subject: string, html: string) {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: FROM,
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Resend error: ${err}`);
    }

    return res.json();
}

function escapeHtml(value: unknown) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function won(value: unknown) {
    if (value === null || value === undefined || value === '') return '-';
    if (typeof value === 'number') return `${value.toLocaleString('ko-KR')}원`;
    return escapeHtml(value);
}

function fieldRows(rows: Array<[string, unknown]>) {
    return rows
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .map(([label, value]) => `
            <tr>
                <th>${escapeHtml(label)}</th>
                <td>${escapeHtml(value)}</td>
            </tr>
        `)
        .join('');
}

function cta(label: string, url: string) {
    return `
        <div class="cta-wrap">
            <a class="btn" href="${escapeHtml(url)}">${escapeHtml(label)}</a>
            <p class="url-note">버튼이 열리지 않으면 아래 주소를 복사해 주세요:<br><span>${escapeHtml(url)}</span></p>
        </div>
    `;
}

function baseLayout(preheader: string, content: string) {
    return `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${BRAND.name}</title>
<style>
  body{margin:0;padding:0;background:#f3f7f6;color:#102522;font-family:Pretendard,-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Malgun Gothic",sans-serif;line-height:1.65;}
  .preheader{display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;}
  .wrap{max-width:640px;margin:28px auto;background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 10px 30px rgba(15,118,110,.12);}
  .header{background:#0f766e;padding:30px 34px;color:#fff;}
  .brand{font-size:13px;letter-spacing:.18em;text-transform:uppercase;opacity:.82;margin:0 0 8px;}
  .header h1{font-size:22px;line-height:1.35;margin:0;font-weight:800;}
  .body{padding:34px;}
  .lead{font-size:16px;font-weight:700;margin:0 0 14px;color:#102522;}
  p{font-size:14px;margin:0 0 16px;color:#365a55;}
  .notice{background:#ecfdf9;border:1px solid #c8eee5;border-radius:14px;padding:16px 18px;margin:22px 0;color:#234d47;font-size:14px;}
  .panel{border:1px solid #e4eeeb;border-radius:14px;overflow:hidden;margin:22px 0;background:#fbfefd;}
  .panel-title{margin:0;padding:13px 16px;background:#f2faf8;color:#0f766e;font-size:13px;font-weight:800;letter-spacing:.04em;}
  table{width:100%;border-collapse:collapse;}
  th,td{font-size:14px;padding:12px 16px;border-top:1px solid #e4eeeb;vertical-align:top;}
  th{width:34%;text-align:left;color:#6b817d;font-weight:700;background:#fbfefd;}
  td{color:#122d29;font-weight:650;text-align:right;}
  .steps{padding-left:18px;margin:10px 0 0;color:#365a55;font-size:14px;}
  .steps li{margin:6px 0;}
  .cta-wrap{text-align:center;margin:28px 0 20px;}
  .btn{display:inline-block;background:#0f766e;color:#fff!important;text-decoration:none;border-radius:12px;padding:14px 28px;font-size:15px;font-weight:800;}
  .url-note{font-size:12px;color:#78918d;margin-top:10px;word-break:break-all;}
  .url-note span{color:#0f766e;}
  .footer{background:#f7faf9;padding:22px 34px;text-align:center;font-size:12px;color:#6b817d;}
  .footer a{color:#0f766e;text-decoration:none;font-weight:700;}
  @media(max-width:680px){.wrap{margin:0;border-radius:0}.header,.body,.footer{padding-left:22px;padding-right:22px}th,td{display:block;width:auto;text-align:left}td{padding-top:0;border-top:none}th{padding-bottom:4px}}
</style>
</head>
<body>
<div class="preheader">${escapeHtml(preheader)}</div>
<div class="wrap">${content}</div>
</body>
</html>`;
}

function footer() {
    return `
        <div class="footer">
            ${BRAND.name} / ${BRAND.nameEn}<br>
            <a href="${SITE_URL}">${BRAND.domain}</a> · <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a> · <a href="${KAKAO_CHANNEL_URL}">카카오톡 채널</a>
        </div>
    `;
}

function tplReservationRequested(data: any) {
    return baseLayout('예약 신청이 접수되었습니다. 예약금 입금 계좌를 안내해 드립니다.', `
<div class="header">
  <p class="brand">${BRAND.name}</p>
  <h1>예약 신청이 접수되었습니다</h1>
</div>
<div class="body">
  <p class="lead">${escapeHtml(data.customerName || '고객')} 님</p>
  <p>${BRAND.name}에 신청해 주셔서 진심으로 감사드립니다. 아래 계좌로 예약금을 입금하고, 마이페이지에서 '입금 완료'를 알려 주세요. 담당자가 확인한 뒤 예약이 확정됩니다.</p>
  <div class="panel">
    <p class="panel-title">예약 내용</p>
    <table>${fieldRows([
        ['예약 번호', data.reservationId || data.reservationNumber],
        ['투어명', data.productName],
        ['예약금', won(data.depositAmount)],
        ['현지 결제 예정 금액', won(data.localAmount)],
    ])}</table>
  </div>
  <div class="panel">
    <p class="panel-title">예약금 입금 계좌 (${DEPOSIT_PAYMENT_METHOD})</p>
    <table>${fieldRows([
        ['은행', DEPOSIT_ACCOUNT.bank],
        ['계좌번호', DEPOSIT_ACCOUNT.number],
        ['예금주', DEPOSIT_ACCOUNT.holder],
        ['입금액', won(data.depositAmount)],
    ])}</table>
  </div>
  <div class="notice">
    <strong>이후 절차</strong>
    <ol class="steps">
      <li>위 계좌로 예약금을 입금하고, 마이페이지에서 '입금 완료'를 알려 주세요.</li>
      <li>담당자가 입금을 확인하면 예약이 확정되고 현지 수배를 시작합니다.</li>
      <li>확정 일정표, 계약서, 가이드 정보를 차례로 안내해 드립니다.</li>
      <li>잔금은 현지에서 현금으로 결제합니다.</li>
    </ol>
  </div>
  ${cta('예약 현황 확인하기', `${SITE_URL}/mypage/reservations${data.reservationDbId ? `/${data.reservationDbId}` : ''}`)}
</div>
${footer()}`);
}

export function tplPaymentConfirmed(data: any) {
    return baseLayout('예약금 입금을 확인했습니다. 이후 준비 절차를 안내해 드립니다.', `
<div class="header">
  <p class="brand">${BRAND.name}</p>
  <h1>예약금 입금을 확인했습니다</h1>
</div>
<div class="body">
  <p class="lead">${escapeHtml(data.customerName || '고객')} 님</p>
  <p>예약금 입금을 확인했습니다. 감사합니다. 여행에 필요한 현지 수배를 순차적으로 진행하겠습니다.</p>
  <div class="panel">
    <p class="panel-title">입금 내용</p>
    <table>${fieldRows([
        ['예약 번호', data.reservationNumber || data.reservationId],
        ['투어명', data.productName],
        ['입금액', won(data.paymentAmount)],
        ['현지 결제 예정 금액', won(data.balanceAmount)],
    ])}</table>
  </div>
  <div class="notice">
    <strong>이후 절차</strong>
    <ol class="steps">
      <li>숙박, 차량, 가이드 등 현지 수배를 진행합니다.</li>
      <li>확정 일정표와 해외여행 계약서를 차례로 안내해 드립니다.</li>
      <li>잔금은 현지에서 현금으로 결제합니다.</li>
    </ol>
  </div>
  ${cta('예약 현황 확인하기', `${SITE_URL}/mypage/reservations${data.reservationDbId ? `/${data.reservationDbId}` : ''}`)}
</div>
${footer()}`);
}

function tplAdminNewReservation(data: any) {
    return baseLayout('새 예약이 들어왔습니다. 관리 화면에서 내용을 확인해 주세요.', `
<div class="header">
  <p class="brand">Admin Notice</p>
  <h1>새 예약이 들어왔습니다</h1>
</div>
<div class="body">
  <p>관리 화면에서 예약 내용을 확인하고, 예약금 입금 여부와 수배 상황을 업데이트해 주세요.</p>
  <div class="panel">
    <p class="panel-title">예약 정보</p>
    <table>${fieldRows([
        ['예약 번호', data.reservationId || data.reservationNumber],
        ['고객명', data.customerName],
        ['투어명', data.productName],
        ['이메일', data.customerEmail],
        ['전화번호', data.customerPhone],
        ['예약금', won(data.depositAmount)],
    ])}</table>
  </div>
  ${cta('관리 화면 열기', `${SITE_URL}/admin/reservations`)}
</div>
${footer()}`);
}

/** 관리자 알림: 고객이 예약금 입금 완료를 신고했다 (POST /api/reservations/:id/deposit-report). */
export function tplAdminDepositReported(data: any) {
    const adminUrl = `${SITE_URL}/admin/reservations${data.reservationDbId ? `?open=${encodeURIComponent(String(data.reservationDbId))}` : ''}`;
    return baseLayout('고객이 예약금 입금 완료를 알렸습니다. 입금 내역을 확인해 주세요.', `
<div class="header">
  <p class="brand">Admin Notice</p>
  <h1>예약금 입금 신고가 들어왔습니다</h1>
</div>
<div class="body">
  <p>고객이 예약금 입금 완료를 알렸습니다. 계좌 입금 내역을 확인한 뒤, 관리 화면에서 '입금 확인'을 눌러 예약을 확정해 주세요.</p>
  <div class="panel">
    <p class="panel-title">입금 신고 내용</p>
    <table>${fieldRows([
        ['예약 번호', data.reservationNumber],
        ['고객명', data.customerName],
        ['입금자명', data.depositorName],
        ['예약금', won(data.depositAmount)],
        ['투어명', data.productName],
        ['신고 시각', data.reportedAtLabel],
        ['입금 계좌', `${DEPOSIT_ACCOUNT.bank} ${DEPOSIT_ACCOUNT.number}`],
    ])}</table>
  </div>
  ${cta('관리 화면에서 확인하기', adminUrl)}
</div>
${footer()}`);
}

function tplQuoteReceived(data: any) {
    return baseLayout('견적 요청이 접수되었습니다. 담당자가 연락드리겠습니다.', `
<div class="header">
  <p class="brand">${BRAND.name}</p>
  <h1>견적 요청이 접수되었습니다</h1>
</div>
<div class="body">
  <p class="lead">${escapeHtml(data.customerName || '고객')} 님</p>
  <p>요청하신 내용을 확인한 뒤 담당자가 보통 24시간 이내에 연락드립니다. 일정, 인원, 예산에 맞춰 가장 알맞은 플랜을 제안해 드리겠습니다.</p>
  <div class="panel">
    <p class="panel-title">상담 내용</p>
    <table>${fieldRows([
        ['내용', data.productName || data.destination || '맞춤 여행 상담'],
    ])}</table>
  </div>
  ${cta('마이페이지 확인하기', `${SITE_URL}/mypage/estimates`)}
</div>
${footer()}`);
}

function tplAdminNewQuote(data: any) {
    return baseLayout('새 견적 상담이 들어왔습니다.', `
<div class="header">
  <p class="brand">Admin Notice</p>
  <h1>새 견적 상담이 들어왔습니다</h1>
</div>
<div class="body">
  <div class="panel">
    <p class="panel-title">상담자 정보</p>
    <table>${fieldRows([
        ['고객명', data.customerName],
        ['이메일', data.customerEmail],
        ['전화번호', data.customerPhone],
        ['내용', data.productName || data.destination],
    ])}</table>
  </div>
  ${cta('견적 관리 열기', `${SITE_URL}/admin/quotes`)}
</div>
${footer()}`);
}

function tplGuideAssigned(data: any) {
    return baseLayout('담당 가이드와 숙박 정보를 안내해 드립니다.', `
<div class="header">
  <p class="brand">${BRAND.name}</p>
  <h1>담당 가이드·숙소 안내</h1>
</div>
<div class="body">
  <p class="lead">${escapeHtml(data.customerName || '고객')} 님</p>
  <p>여행을 담당할 가이드와 현지 수배 정보가 확정되어 안내해 드립니다. 출발 전에 확인이 필요한 사항이 있으면 담당자가 추가로 연락드리겠습니다.</p>
  <div class="panel">
    <p class="panel-title">담당 정보</p>
    <table>${fieldRows([
        ['투어명', data.productName],
        ['담당 가이드', data.guideName],
        ['가이드 연락처', data.guidePhone],
    ])}</table>
  </div>
  ${cta('예약 상세 확인하기',`${SITE_URL}/mypage/reservations${data.reservationDbId ? `/${data.reservationDbId}` : ''}`)}
</div>
${footer()}`);
}

function tplEstimateCompleted(data: any) {
    return baseLayout('견적이 완성되었습니다. 내용을 확인해 주세요.', `
<div class="header">
  <p class="brand">${BRAND.name}</p>
  <h1>견적이 완성되었습니다</h1>
</div>
<div class="body">
  <p class="lead">${escapeHtml(data.customerName || '고객')} 님</p>
  <p>요청하신 내용에 맞춘 몽골 여행 플랜의 견적을 준비했습니다. 내용을 확인하신 뒤 궁금한 점이나 조정을 원하는 부분이 있으면 편하게 회신해 주세요.</p>
  <div class="panel">
    <p class="panel-title">견적 개요</p>
    <table>${fieldRows([
        ['목적지', data.destination],
        ['합계 금액', won(data.totalAmount)],
    ])}</table>
  </div>
  ${data.adminNote ? `<div class="notice"><strong>담당자 메모</strong><br>${escapeHtml(data.adminNote).replace(/\n/g, '<br>')}</div>` : ''}
  ${cta('견적·여행 일정 확인하기',`${SITE_URL}/estimate/${data.quoteId || data.reservationId || ''}`)}
  ${data.estimateUrl ? `<p style="text-align:center;margin-top:8px"><a href="${escapeHtml(data.estimateUrl)}" style="color:#0f766e;font-size:13px">외부 견적서(PDF/자료) 보기</a></p>` : ''}
</div>
${footer()}`);
}

function tplContractReady(data: any) {
    // 보안: 링크는 UUID(reservationDbId)로 — 추측 가능한 예약번호(reservationId=MNxxx)는 URL에 쓰지 않음
    const url = data.contractUrl || `${SITE_URL}/documents/contract/${data.reservationDbId || ''}`;
    return baseLayout('해외여행 계약서를 준비했습니다. 내용을 확인해 주세요.', `
<div class="header">
  <p class="brand">${BRAND.name}</p>
  <h1>해외여행 계약서 안내</h1>
</div>
<div class="body">
  <p class="lead">${escapeHtml(data.customerName || '고객')} 님</p>
  <p>해외여행 계약서를 준비했습니다. 여행 조건, 여행자 정보, 결제 내용을 확인해 주세요. 수정이 필요하면 이 메일로 회신해 주세요.</p>
  <div class="panel">
    <p class="panel-title">계약서 정보</p>
    <table>${fieldRows([
        ['투어명', data.productName],
        ['여행 기간', data.travelDates],
        ['예약 번호', data.reservationNumber || data.reservationId],
    ])}</table>
  </div>
  <div class="notice">예약금 입금이 확인되면 계약 내용에 따라 현지 수배를 진행합니다.</div>
  ${cta('계약서 확인하기', url)}
</div>
${footer()}`);
}

function tplItineraryReady(data: any) {
    // 보안: 링크는 UUID(reservationDbId)로 — 추측 가능한 예약번호(reservationId=MNxxx)는 URL에 쓰지 않음
    const url = data.itineraryUrl || `${SITE_URL}/documents/itinerary/${data.reservationDbId || ''}`;
    return baseLayout('확정 일정표를 준비했습니다. 집합 시간, 숙소, 일정을 확인해 주세요.', `
<div class="header">
  <p class="brand">${BRAND.name}</p>
  <h1>확정 일정표 안내</h1>
</div>
<div class="body">
  <p class="lead">${escapeHtml(data.customerName || '고객')} 님</p>
  <p>여행 확정 일정표를 준비했습니다. 일자별 일정, 숙소, 담당 가이드 정보를 확인해 주세요.</p>
  <div class="panel">
    <p class="panel-title">여행 정보</p>
    <table>${fieldRows([
        ['투어명', data.productName],
        ['여행 기간', data.travelDates],
        ['예약 번호', data.reservationNumber || data.reservationId],
    ])}</table>
  </div>
  <div class="notice">
    <strong>출발 전에 확인해 주세요</strong>
    <ol class="steps">
      <li>집합 시간, 항공편 정보, 숙소에 잘못된 부분이 없는지 확인해 주세요.</li>
      <li>날씨나 도로 상황에 따라 현지에서 안전을 우선해 순서를 조정할 수 있습니다.</li>
      <li>변경을 원하거나 궁금한 점이 있으면 출발 전에 담당자에게 연락해 주세요.</li>
    </ol>
  </div>
  ${cta('일정표 확인하기', url)}
</div>
${footer()}`);
}

// How long after a booking / quote request its own confirmation mail may be requested.
const CONFIRMATION_WINDOW = '-30 minutes';

type Recipient = { to: string; data: Record<string, unknown> };

// Customer-triggered mails are rebuilt from the stored row, so the recipient and the
// contents are never taken from the request. Returns null when the caller has no
// matching booking / quote of their own.
async function reservationRecipient(db: any, userId: string, reservationDbId: unknown): Promise<Recipient | null> {
    if (typeof reservationDbId !== 'string' || !reservationDbId) return null;
    const row = await db.prepare(
        // A missing or unreadable timestamp must not cost the customer their confirmation.
        `SELECT * FROM reservations WHERE id = ? AND user_id = ?
         AND (datetime(created_at) IS NULL OR datetime(created_at) >= datetime('now', ?))`
    ).bind(reservationDbId, userId, CONFIRMATION_WINDOW).first();
    if (!row || !row.customer_email) return null;
    return {
        to: String(row.customer_email),
        data: {
            customerName: row.customer_name,
            productName: row.product_name,
            reservationId: row.reservation_number || `MN-${String(row.id).slice(0, 8).toUpperCase()}`,
            reservationDbId: row.id,
            depositAmount: Number(row.deposit_amount) || 0,
            localAmount: Number(row.balance_amount) || 0,
            customerPhone: row.customer_phone,
            userId,
        },
    };
}

async function quoteRecipient(db: any, to: unknown): Promise<Recipient | null> {
    if (typeof to !== 'string' || !to.trim()) return null;
    const row = await db.prepare(
        `SELECT * FROM quotes WHERE lower(email) = lower(?) AND datetime(created_at) >= datetime('now', ?)
         ORDER BY created_at DESC LIMIT 1`
    ).bind(to.trim(), CONFIRMATION_WINDOW).first();
    if (!row) return null;
    return {
        to: String(row.email),
        data: {
            customerName: row.name,
            productName: `몽골 맞춤 여행 (${row.period || '미정'})`,
            customerPhone: row.phone,
        },
    };
}

// POST /api/notifications/email
// - Admins: every template, any recipient (documents, estimates, guide assignment…).
// - Everyone else: only the confirmation of their own fresh booking (signed in) or
//   quote request (guests too), sent to the address stored with it.
app.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const type = body.type;
        let to = body.to;
        let data = body.data && typeof body.data === 'object' ? body.data : {};

        const sessionUser = await getSessionUser(c);
        if (sessionUser?.role !== 'admin') {
            let recipient: Recipient | null = null;
            if (type === 'RESERVATION_REQUESTED') {
                if (!sessionUser) return c.json({ error: 'Unauthorized' }, 401);
                recipient = await reservationRecipient(c.env.DB, sessionUser.id, data.reservationDbId);
            } else if (type === 'QUOTE_RECEIVED') {
                recipient = await quoteRecipient(c.env.DB, to);
            } else {
                return sessionUser ? c.json({ error: 'Forbidden' }, 403) : c.json({ error: 'Unauthorized' }, 401);
            }
            if (!recipient) return c.json({ error: 'Forbidden' }, 403);
            to = recipient.to;
            data = recipient.data;
        }

        const apiKey = c.env.RESEND_API_KEY;
        const adminEmail = c.env.ADMIN_EMAIL || 'agape_ibeel@hanpass.com';

        // 이메일 키가 없어도 인앱 알림은 계속 생성해야 하므로 여기서 중단하지 않음
        if (!apiKey) {
            console.error('RESEND_API_KEY not set — skipping email, in-app notification만 생성');
        }

        let subject = '';
        let html = '';
        let adminSubject = '';
        let adminHtml = '';

        switch (type) {
            case 'RESERVATION_REQUESTED':
                subject = `[예약 접수] ${data.productName || '몽골 여행'} 신청해 주셔서 감사합니다 | ${BRAND.name}`;
                html = tplReservationRequested(data);
                adminSubject = `[신규 예약] ${data.customerName || '고객'} - ${data.productName || '투어'}`;
                adminHtml = tplAdminNewReservation({ ...data, customerEmail: to });
                break;

            case 'PAYMENT_CONFIRMED':
                subject = `[입금 확인] ${data.productName || '몽골 여행'} 예약금 입금을 확인했습니다 | ${BRAND.name}`;
                html = tplPaymentConfirmed(data);
                break;

            case 'QUOTE_RECEIVED':
                subject = `[견적 접수] 상담을 신청해 주셔서 감사합니다 | ${BRAND.name}`;
                html = tplQuoteReceived(data);
                adminSubject = `[신규 견적] ${data.customerName || '고객'}`;
                adminHtml = tplAdminNewQuote({ ...data, customerEmail: to });
                break;

            case 'GUIDE_ASSIGNED':
                subject = `[담당 가이드 확정] ${data.productName || '여행'} 현지 수배 정보 | ${BRAND.name}`;
                html = tplGuideAssigned(data);
                break;

            case 'ESTIMATE_COMPLETED':
                subject = `[견적 완성] 몽골 여행 플랜을 확인해 주세요 | ${BRAND.name}`;
                html = tplEstimateCompleted(data);
                break;

            case 'ITINERARY_READY':
                subject = `[확정 일정표] ${data.productName || '여행'} 안내 | ${BRAND.name}`;
                html = tplItineraryReady(data);
                break;

            case 'CONTRACT_READY':
                subject = `[해외여행 계약서] ${data.productName || '여행'} 안내 | ${BRAND.name}`;
                html = tplContractReady(data);
                break;

            default:
                return c.json({ error: `Unknown email type: ${type}` }, 400);
        }

        if (apiKey) {
            try {
                await sendEmail(apiKey, to, subject, html);
            } catch (mailErr) {
                console.error('Email send failed (continuing to create in-app notification):', mailErr);
            }
        }

        const targetUserId = data.userId || data.user_id;
        if (targetUserId && c.env.DB) {
            // 메일 제목 끝의 ' | 브랜드명'은 사이트 알림 제목에서는 뺀다.
            const brandSuffix = ` | ${BRAND.name}`;
            const inAppTitle = subject.endsWith(brandSuffix) ? subject.slice(0, -brandSuffix.length) : subject;
            const inAppMessage =
                type === 'ITINERARY_READY' ? '확정 일정표를 준비했습니다. 내용을 확인해 주세요.' :
                type === 'CONTRACT_READY' ? '해외여행 계약서를 준비했습니다. 내용을 확인해 주세요.' :
                type === 'GUIDE_ASSIGNED' ? '담당 가이드와 현지 수배 정보를 안내해 드렸습니다.' :
                type === 'RESERVATION_REQUESTED' ? '예약 신청이 접수되었습니다.' :
                type === 'PAYMENT_CONFIRMED' ? '예약금 입금을 확인했습니다. 현지 수배를 진행합니다.' :
                type === 'QUOTE_RECEIVED' ? '견적 요청이 접수되었습니다.' :
                type === 'ESTIMATE_COMPLETED' ? '견적이 완성되었습니다. 내용을 확인해 주세요.' : '';
            const link =
                type === 'ITINERARY_READY' ? (data.reservationDbId ? `/mypage/reservations/${data.reservationDbId}` : `/documents/itinerary/${data.reservationId || ''}`) :
                type === 'CONTRACT_READY' ? (data.reservationDbId ? `/mypage/reservations/${data.reservationDbId}` : `/documents/contract/${data.reservationId || ''}`) :
                type === 'ESTIMATE_COMPLETED' ? `/estimate/${data.quoteId || data.reservationId || ''}` :
                type === 'GUIDE_ASSIGNED' || type === 'RESERVATION_REQUESTED' || type === 'PAYMENT_CONFIRMED' ? (data.reservationDbId ? `/mypage/reservations/${data.reservationDbId}` : '/mypage/reservations') :
                type === 'QUOTE_RECEIVED' ? '/mypage/estimates' : undefined;

            await createNotification(c.env.DB, {
                userId: targetUserId,
                type: 'reservation',
                title: inAppTitle,
                message: inAppMessage,
                link,
            });
        }

        if (adminSubject && adminHtml) {
            await sendEmail(apiKey, adminEmail, adminSubject, adminHtml);
        }

        return c.json({ success: true });
    } catch (e: any) {
        console.error('Email send error:', e);
        return c.json({ error: e.message || 'Failed to send email' }, 500);
    }
});

export default app;
