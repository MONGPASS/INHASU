import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { reservations } from '../../src/db/schema/reservations';
import { eq, desc, or, and, isNull } from 'drizzle-orm';
import { assignmentRecord, readProductVehicle, syncProductVehicle } from '../../src/utils/reservationAssignment';
import { preserveProductCustomerEvidence, publicProductContract } from '../../src/utils/productContractSignature';
import { initializeLucia } from '../lib/auth';
import { getCookie } from 'hono/cookie';
import { sendPayPalInvoice } from '../lib/paypal';
import { getSessionUser } from '../lib/userAuth';
import { sendEmail } from '../lib/mailer';
import { tplAdminDepositReported } from './notifications/email';
import { COMPANY_INFO } from '../../src/constants/company';
import { dispatchCustomerNotification, type CustomerNotificationKind } from '../lib/customerNotifications';
// 견적 시스템의 문자 발송 모듈(JS, 타입 선언 없음). SOLAPI_*·ADMIN_PHONE 이 없으면 조용히 건너뛴다.
// @ts-ignore
import { notifyAdmin } from './_solapi.js';

// Define Env locally if global scope is not picked up
interface Env {
    DB: any;
    BUCKET: any;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    ENVIRONMENT: string;
    PAYPAL_CLIENT_ID: string;
    PAYPAL_SECRET_KEY: string;
    PAYPAL_BUSINESS_EMAIL: string;
    PAYPAL_ENVIRONMENT?: string;
    /** 'true'일 때만 예약 생성 시 PayPal 인보이스를 보낸다 (기본 꺼짐). */
    PAYPAL_ENABLED?: string;
    RESEND_API_KEY?: string;
    MAIL_FROM?: string;
    ADMIN_EMAIL?: string;
}

const app = new Hono<{ Bindings: Env }>();

/** Dispatch only after persistence; notification failure never undoes the customer's saved work. */
async function queueCustomerNotification(c: any, bookingId: string, kind: CustomerNotificationKind, eventKey: string) {
    const task = Promise.resolve().then(() => dispatchCustomerNotification(c.env, { source: 'product', bookingId, kind, eventKey }))
        .catch(() => { console.error('[Customer Notification] outcome unavailable', kind); });
    try { c.executionCtx.waitUntil(task); } catch { await task; }
}

// 고객 정보와 내부 운영 정보가 브라우저·공유 프록시 캐시에 남지 않게 한다.
app.use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store');
    await next();
});

interface ReservationAdminOperations {
    joining: 'private' | 'join' | 'undecided';
    region: string;
    category: string;
    vehicle: string;
    driverPhone: string;
    receipt: {
        status: 'not_requested' | 'pending' | 'issued';
        number: string;
        issuedDate: string;
    };
    opsNote: string;
}

type OperationsUpdate = Partial<Omit<ReservationAdminOperations, 'receipt'>> & {
    receipt?: Partial<ReservationAdminOperations['receipt']>;
};

const emptyAdminOperations = (): ReservationAdminOperations => ({
    joining: 'undecided', region: '', category: '', vehicle: '', driverPhone: '',
    receipt: { status: 'not_requested', number: '', issuedDate: '' }, opsNote: '',
});

const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

/** 운영 정보는 정해진 필드만 허용한다. 문자열 JSON을 보내는 기존 TEXT 클라이언트도 검증한다. */
const validateAdminOperations = (input: unknown): OperationsUpdate | null => {
    let value = input;
    if (typeof value === 'string') {
        try { value = JSON.parse(value); } catch { return null; }
    }
    if (!record(value)) return null;
    const fields = new Set(['joining', 'region', 'category', 'vehicle', 'driverPhone', 'receipt', 'opsNote']);
    if (Object.keys(value).some((key) => !fields.has(key))) return null;
    const update: OperationsUpdate = {};
    if ('joining' in value) {
        if (typeof value.joining !== 'string' || !['private', 'join', 'undecided'].includes(value.joining)) return null;
        update.joining = value.joining as ReservationAdminOperations['joining'];
    }
    for (const key of ['region', 'category', 'vehicle', 'driverPhone', 'opsNote'] as const) {
        if (!(key in value)) continue;
        const text = value[key];
        const max = key === 'opsNote' ? 5000 : key === 'driverPhone' ? 100 : 200;
        if (typeof text !== 'string' || text.length > max) return null;
        update[key] = text.trim();
    }
    if ('receipt' in value) {
        if (!record(value.receipt) || Object.keys(value.receipt).some((key) => !['status', 'number', 'issuedDate'].includes(key))) return null;
        const receipt = value.receipt;
        update.receipt = {};
        if ('status' in receipt) {
            if (typeof receipt.status !== 'string' || !['not_requested', 'pending', 'issued'].includes(receipt.status)) return null;
            update.receipt.status = receipt.status as ReservationAdminOperations['receipt']['status'];
        }
        for (const key of ['number', 'issuedDate'] as const) {
            if (!(key in receipt)) continue;
            const text = receipt[key];
            if (typeof text !== 'string' || text.length > (key === 'number' ? 100 : 10)) return null;
            if (key === 'issuedDate' && text) {
                const date = new Date(text);
                if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) return null;
            }
            update.receipt[key] = text.trim();
        }
    }
    return update;
};

const mergeAdminOperations = (current: ReservationAdminOperations, update: OperationsUpdate): ReservationAdminOperations => ({
    ...current, ...update, receipt: { ...current.receipt, ...update.receipt },
});

const parseAdminOperations = (value: unknown): ReservationAdminOperations => {
    const update = validateAdminOperations(value);
    return update ? mergeAdminOperations(emptyAdminOperations(), update) : emptyAdminOperations();
};

/** 내부 JSON을 그대로 펼치지 않는다. 게스트 예약도 조회자의 관리자 권한을 확인한다. */
const reservationForRole = <T extends { adminOperations?: unknown }>(row: T, isAdmin: boolean) => {
    const { adminOperations, ...visible } = row;
    const vehicle = readProductVehicle(adminOperations, (row as any).contractData);
    return isAdmin ? { ...visible, adminOperations: { ...parseAdminOperations(adminOperations), vehicle: vehicle.type, driverPhone: vehicle.phone } } : visible;
};

/** 관리자 메모는 조회 응답에서만 제외한다. 원본 이력과 일반 진행 이력은 그대로 둔다. */
const customerVisibleHistory = (history: unknown) =>
    Array.isArray(history) ? history.filter((entry) => !(record(entry) && entry.type === 'admin_memo')) : history;

// ── 예약금 입금 신고 (계좌이체 → 고객이 '입금 완료' 신고 → 담당자 확인) ──────────────
// reservations.deposit_report 는 JSON 문자열 { status: 'reported', name, reportedAt }, 미신고는 NULL.

interface DepositReport {
    status: 'reported';
    name: string;
    reportedAt: string;
}

/** 같은 예약에 다시 신고할 수 있기까지의 간격. */
const DEPOSIT_REPORT_COOLDOWN_MS = 60_000;
const DEPOSITOR_NAME_MAX = 30;

/**
 * deposit_report 컬럼 값 → 신고 객체. 미신고·깨진 값은 null.
 * 컬럼이 아직 없는 DB(/api/migrate-db 를 열기 전)에서는 SQLite 가 따옴표로 감싼 "deposit_report" 를
 * 문자열 그대로 돌려주는데, JSON 이 아니므로 그 경우에도 null 이 된다.
 */
const parseDepositReport = (value: unknown): DepositReport | null => {
    let parsed: any = value;
    if (typeof value === 'string') {
        try { parsed = JSON.parse(value); } catch { return null; }
    }
    if (!parsed || typeof parsed !== 'object' || parsed.status !== 'reported') return null;
    return { status: 'reported', name: String(parsed.name ?? ''), reportedAt: String(parsed.reportedAt ?? '') };
};

/** drizzle 은 드라이버 오류를 cause 에 담아 다시 던지므로 cause 까지 이어 붙여 본다. */
const errorChain = (e: unknown): string => {
    const parts: string[] = [];
    let current: any = e;
    for (let depth = 0; current && depth < 4; depth += 1) {
        parts.push(current instanceof Error ? current.message : String(current));
        current = current?.cause;
    }
    return parts.join(' | ');
};

const isMissingDepositColumn = (e: unknown) =>
    /(no such column|has no column named):?\s*"?deposit_report/i.test(errorChain(e));

/**
 * deposit_report 컬럼을 만든다(/api/migrate-db 와 같은 문장). 이미 있으면 그대로 성공.
 * 배포 직후 마이그레이션을 열기 전에 들어온 요청이 실패하지 않게 하는 안전장치로만 쓴다.
 */
const addDepositReportColumn = async (DB: any): Promise<boolean> => {
    try {
        await DB.prepare('ALTER TABLE reservations ADD COLUMN deposit_report TEXT').run();
        return true;
    } catch (e) {
        if (/duplicate column/i.test(errorChain(e))) return true;
        console.error('[Deposit Report] could not add reservations.deposit_report', errorChain(e));
        return false;
    }
};

/** 한 줄 텍스트: 제어 문자·줄바꿈은 공백으로 바꾸고 앞뒤 공백을 없앤다. */
const oneLine = (value: unknown): string =>
    typeof value === 'string'
        ? Array.from(value, (ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? ' ' : ch)).join('').replace(/\s+/g, ' ').trim()
        : '';

const sameEmail = (a: unknown, b: unknown) =>
    typeof a === 'string' && typeof b === 'string' && !!a.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();

const wonText = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

/** 담당자에게 입금 신고를 알린다: 관리자 메일 + 담당자 문자. 어느 쪽이 실패해도 예외를 던지지 않는다. */
async function notifyStaffOfDepositReport(env: Env, info: {
    reservationDbId: string;
    reservationNumber: string;
    customerName: string;
    productName: string;
    depositorName: string;
    depositAmount: number;
    reportedAt: string;
}) {
    const amount = info.depositAmount > 0 ? wonText(info.depositAmount) : '확인 필요';
    const jobs: Array<Promise<unknown>> = [];

    if (env.RESEND_API_KEY) {
        let reportedAtLabel = info.reportedAt;
        try {
            reportedAtLabel = `${new Date(info.reportedAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' })} (KST)`;
        } catch { /* 시간대 표기를 못 만들면 ISO 값 그대로 */ }
        jobs.push(sendEmail(
            env.RESEND_API_KEY,
            env.ADMIN_EMAIL || COMPANY_INFO.email,
            `[입금 신고] ${info.reservationNumber} · ${info.customerName} · 입금자명 ${info.depositorName} · 예약금 ${amount}`,
            tplAdminDepositReported({ ...info, reportedAtLabel }),
            { env },
        ));
    } else {
        console.warn('[Deposit Report] RESEND_API_KEY not set — admin mail skipped');
    }

    jobs.push(Promise.resolve(notifyAdmin(env,
        `[예약금 입금 신고] ${info.customerName}님이 예약금 입금 완료를 알렸습니다.\n` +
        `• 예약번호: ${info.reservationNumber}\n` +
        `• 입금자명: ${info.depositorName}\n` +
        `• 예약금: ${amount}\n` +
        `• 상품: ${info.productName}\n` +
        '통합 관리자 > 예약 관리에서 입금 내역을 확인해 주세요.',
    )));

    const settled = await Promise.allSettled(jobs);
    for (const result of settled) {
        if (result.status === 'rejected') console.error('[Deposit Report] staff notification failed', errorChain(result.reason));
    }
}

// GET /api/reservations
app.get('/', async (c) => {
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);

    if (!sessionId) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const { session, user } = await lucia.validateSession(sessionId);
    if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const db = drizzle(c.env.DB);
    let result;

    if (user.role === 'admin') {
        result = await db.select().from(reservations).orderBy(desc(reservations.createdAt)).all();
    } else {
        // Match by userId primarily, but also by customerEmail so guest-made
        // reservations (userId=null) with the same email appear after login.
        const conditions = user.email
            ? or(eq(reservations.userId, user.id), eq(reservations.customerEmail, user.email))
            : eq(reservations.userId, user.id);
        result = await db.select().from(reservations).where(conditions).orderBy(desc(reservations.createdAt)).all();
    }

    // Helper: safe JSON.parse
    const tryParse = (v: any) => {
        if (!v) return undefined;
        if (typeof v !== 'string') return v;
        try { return JSON.parse(v); } catch { return undefined; }
    };

    // Parse JSON fields and map to legacy frontend schema interface
    const parsed = result.map((r: any) => ({
        ...reservationForRole(r, user.role === 'admin'),
        email: r.customerEmail,
        phone: r.customerPhone,
        date: r.startDate,
        headcount: `${r.travelers}명`,
        totalPeople: r.travelers,
        totalAmount: r.totalPrice,
        deposit: r.depositAmount,
        balance: r.balanceAmount,
        price_breakdown: tryParse(r.priceBreakdown) || {
            total: r.totalPrice,
            deposit: r.depositAmount,
            local: r.balanceAmount,
        },
        depositStatus: r.depositStatus || (r.status === 'confirmed' ? 'paid' : 'unpaid'),
        balanceStatus: r.balanceStatus || (r.status === 'completed' ? 'paid' : 'unpaid'),
        dailyAccommodations: tryParse(r.dailyAccommodations),
        assignedGuide: tryParse(r.assignedGuide),
        contractData: tryParse(r.contractData),
        areAssignmentsVisibleToUser: !!r.areAssignmentsVisibleToUser,
        history: tryParse(r.history) || [],
        depositReport: parseDepositReport(r.depositReport),
        deposit_report: parseDepositReport(r.depositReport),
    }));

    return c.json(user.role === 'admin' ? parsed : parsed.map((row) => ({ ...row, contractData: publicProductContract(row.contractData), history: customerVisibleHistory(row.history) })));
});

// GET /api/reservations/:id
app.get('/:id', async (c) => {
    const id = c.req.param('id');
    const db = drizzle(c.env.DB);
    const result = await db.select().from(reservations).where(eq(reservations.id, id)).get();

    if (!result) return c.json({ error: 'Reservation not found' }, 404);

    // 게스트 예약(userId=null)도 관리자 세션인지 확인해야 내부 운영 정보를 반환할 수 있다.
    const user = await getSessionUser(c);
    if (result.userId !== null) {
        if (!user) return c.json({ error: "Unauthorized" }, 401);

        // Same visibility as the list: the owner, or the account whose e-mail the booking carries.
        const sameEmail = !!user.email && !!result.customerEmail
            && user.email.trim().toLowerCase() === result.customerEmail.trim().toLowerCase();
        if (user.role !== 'admin' && result.userId !== user.id && !sameEmail) {
            return c.json({ error: "Forbidden" }, 403);
        }
    }
    // If userId is null (guest reservation), allow public access since the UUID is practically unguessable.

    const parsed = {
        ...reservationForRole(result, user?.role === 'admin'),
        email: result.customerEmail,
        phone: result.customerPhone,
        date: result.startDate,
        headcount: `${result.travelers}명`,
        totalPeople: result.travelers,
        totalAmount: result.totalPrice,
        deposit: result.depositAmount,
        balance: result.balanceAmount,
        price_breakdown: (() => { try { return result.priceBreakdown ? JSON.parse(result.priceBreakdown) : { total: result.totalPrice, deposit: result.depositAmount, local: result.balanceAmount }; } catch { return { total: result.totalPrice, deposit: result.depositAmount, local: result.balanceAmount }; } })(),
        depositStatus: result.depositStatus || (result.status === 'confirmed' ? 'paid' : 'unpaid'),
        balanceStatus: result.balanceStatus || (result.status === 'completed' ? 'paid' : 'unpaid'),
        dailyAccommodations: (() => { try { return result.dailyAccommodations ? JSON.parse(result.dailyAccommodations) : undefined; } catch { return undefined; } })(),
        assignedGuide: (() => { try { return result.assignedGuide ? JSON.parse(result.assignedGuide) : undefined; } catch { return undefined; } })(),
        contractData: (() => { try { return result.contractData ? JSON.parse(result.contractData) : undefined; } catch { return undefined; } })(),
        areAssignmentsVisibleToUser: !!result.areAssignmentsVisibleToUser,
        history: (() => { try { return result.history ? JSON.parse(result.history) : []; } catch { return []; } })(),
        depositReport: parseDepositReport(result.depositReport),
        deposit_report: parseDepositReport(result.depositReport),
    };

    return c.json(user?.role === 'admin' ? parsed : { ...parsed, contractData: publicProductContract(parsed.contractData), history: customerVisibleHistory(parsed.history) });
});

// PUT /api/reservations/:id
app.put('/:id', async (c) => {
    const id = c.req.param('id');
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);

    if (!sessionId) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const { session, user } = await lucia.validateSession(sessionId);
    if (!session) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    // Only Admin can update reservations for now (or maybe user can cancel?)
    // For Admin Reservation Manage, it is admin only.
    if (user.role !== 'admin') {
        return c.json({ error: "Forbidden" }, 403);
    }

    const db = drizzle(c.env.DB);
    let body: unknown;
    try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON body' }, 400); }
    if (!record(body)) return c.json({ error: 'Invalid reservation update' }, 400);

    // Validate body?
    // We expect partial updates or full updates.
    // Drizzle update

    // Normalize snake_case keys from admin frontend to camelCase schema keys
    const snakeToCamel: Record<string, string> = {
        deposit_status: 'depositStatus',
        balance_status: 'balanceStatus',
        contract_url: 'contractUrl',
        itinerary_url: 'itineraryUrl',
        assigned_guide: 'assignedGuide',
        daily_accommodations: 'dailyAccommodations',
        product_id: 'productId',
        are_assignments_visible_to_user: 'areAssignmentsVisibleToUser',
        total_people: 'travelers',
        total_amount: 'totalPrice',
        deposit_amount: 'depositAmount',
        balance_amount: 'balanceAmount',
        itinerary_template_id: 'itineraryTemplateId',
        contract_data: 'contractData',
        document_content: 'documentContent',
        start_date: 'startDate',
        end_date: 'endDate',
        updated_at: 'updatedAt',
        admin_operations: 'adminOperations',
    };
    const normalized: any = {};
    for (const [k, v] of Object.entries(body)) {
        normalized[snakeToCamel[k] || k] = v;
    }

    const existing = await db.select().from(reservations).where(eq(reservations.id, id)).get();
    if (!existing) return c.json({ error: 'Reservation not found' }, 404);
    let operationsPatch: OperationsUpdate | undefined;
    if ('adminOperations' in normalized) {
        const operations = validateAdminOperations(normalized.adminOperations);
        if (!operations) return c.json({ error: 'Invalid admin operations' }, 400);
        operationsPatch = operations;
        normalized.adminOperations = mergeAdminOperations(parseAdminOperations(existing.adminOperations), operations);
    }
    const syncVehicle = 'adminOperations' in normalized || 'contractData' in normalized;
    if (syncVehicle) {
        if ('contractData' in normalized) normalized.contractData = preserveProductCustomerEvidence(existing.contractData, normalized.contractData);
        const synced = syncProductVehicle(existing.adminOperations, existing.contractData, { operations: operationsPatch, contractData: normalized.contractData });
        normalized.adminOperations = mergeAdminOperations(parseAdminOperations(existing.adminOperations), synced.operations);
        normalized.contractData = synced.contractData;
    }

    // Serialize nested objects/arrays to JSON strings for TEXT columns
    const updateData: any = {};
    for (const [k, v] of Object.entries(normalized)) {
        if (k === 'areAssignmentsVisibleToUser') {
            updateData[k] = v === true || v === 1 ? 1 : 0;
        } else if (v !== undefined && typeof v === 'object' && v !== null) {
            updateData[k] = JSON.stringify(v);
        } else {
            updateData[k] = v;
        }
    }

    // Known schema keys (from src/db/schema/reservations.ts)
    const schemaKeys = new Set([
        'id', 'type', 'productName', 'customerName', 'customerEmail', 'customerPhone',
        'travelers', 'startDate', 'endDate', 'duration', 'status', 'totalPrice', 'depositAmount',
        'balanceAmount', 'paymentMethod', 'dailyAccommodations', 'notes', 'history',
        'userId', 'reservationNumber', 'itineraryTemplateId', 'contractData',
        'assignedGuide', 'contractUrl', 'itineraryUrl',
        'depositStatus', 'balanceStatus', 'areAssignmentsVisibleToUser', 'priceBreakdown',
        'documentContent', 'source', 'productId',
        'adminOperations',
        'createdAt', 'updatedAt',
    ]);
    const filtered: any = {};
    for (const [k, v] of Object.entries(updateData)) {
        if (schemaKeys.has(k)) filtered[k] = v;
    }

    if (Object.keys(filtered).length > 0) {
        const result = await db.update(reservations).set(filtered).where(syncVehicle ? and(eq(reservations.id, id),
            existing.contractData == null ? isNull(reservations.contractData) : eq(reservations.contractData, existing.contractData),
            existing.adminOperations == null ? isNull(reservations.adminOperations) : eq(reservations.adminOperations, existing.adminOperations)) : eq(reservations.id, id)).run();
        if (result.meta?.changes !== 1) return c.json({ error: '예약이 변경되었습니다. 최신 정보를 확인한 뒤 다시 저장해 주세요.' }, 409);
    }

    // Fetch updated
    const updated = await db.select().from(reservations).where(eq(reservations.id, id)).get();

    // Compare stored fields rather than status-derived display values. A normal
    // note/assignment/document edit must not replay an earlier business event.
    if (updated && Object.hasOwn(filtered, 'depositStatus') && existing.depositStatus !== 'paid' && updated.depositStatus === 'paid') {
        await queueCustomerNotification(c, id, 'contract', `product:${id}:first-deposit-paid:v1`);
    }
    const alreadyConfirmed = ['confirmed', 'paid', 'completed'].includes(existing.status || '');
    if (updated && Object.hasOwn(filtered, 'status') && !alreadyConfirmed && ['confirmed', 'paid'].includes(updated.status || '')) {
        await queueCustomerNotification(c, id, 'booking_confirmed', `product:${id}:first-booking-confirmed:v1`);
    }
    if (updated && (Object.hasOwn(filtered, 'itineraryUrl') || Object.hasOwn(filtered, 'status'))
        && !(existing.itineraryUrl && alreadyConfirmed)
        && updated.itineraryUrl && ['confirmed', 'paid', 'completed'].includes(updated.status || '')) {
        await queueCustomerNotification(c, id, 'itinerary', `product:${id}:first-itinerary-published:v1`);
    }

    const parsed = {
        ...reservationForRole(updated!, true),
        email: updated?.customerEmail,
        phone: updated?.customerPhone,
        date: updated?.startDate,
        headcount: `${updated?.travelers}명`,
        totalPeople: updated?.travelers,
        totalAmount: updated?.totalPrice,
        deposit: updated?.depositAmount,
        balance: updated?.balanceAmount,
        price_breakdown: {
            total: updated?.totalPrice,
            deposit: updated?.depositAmount,
            local: updated?.balanceAmount
        },
        depositStatus: updated?.depositStatus || (updated?.status === 'confirmed' ? 'paid' : 'unpaid'),
        balanceStatus: updated?.balanceStatus || (updated?.status === 'completed' ? 'paid' : 'unpaid'),
        dailyAccommodations: updated?.dailyAccommodations ? JSON.parse(updated.dailyAccommodations) : undefined,
        history: updated?.history ? JSON.parse(updated.history) : undefined,
        depositReport: parseDepositReport(updated?.depositReport),
        deposit_report: parseDepositReport(updated?.depositReport),
    };

    return c.json(parsed);
});

// POST /api/reservations — signed-in customers (booking flow) and admins (manual entry)
app.post('/', async (c) => {
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    const isAdmin = user.role === 'admin';

    const body = await c.req.json();
    const db = drizzle(c.env.DB);

    const selectedProductId = body.product_id ?? body.productId;
    let productId: string | null = null;
    if (selectedProductId !== undefined && selectedProductId !== null && selectedProductId !== '') {
        if (typeof selectedProductId !== 'string' || selectedProductId.length > 150) return c.json({ error: '상품 ID를 확인해 주세요.' }, 400);
        const selectedProduct = await c.env.DB.prepare('SELECT id FROM products WHERE id=?').bind(selectedProductId).first();
        if (!selectedProduct) return c.json({ error: '선택한 상품을 찾을 수 없습니다.' }, 400);
        productId = selectedProduct.id;
    }

    // 고객 예약 요청으로는 내부 메모·영수증 정보를 설정할 수 없다.
    let adminOperations: ReservationAdminOperations | null = null;
    if (isAdmin && (Object.hasOwn(body, 'adminOperations') || Object.hasOwn(body, 'admin_operations'))) {
        const operations = validateAdminOperations(Object.hasOwn(body, 'adminOperations') ? body.adminOperations : body.admin_operations);
        if (!operations) return c.json({ error: 'Invalid admin operations' }, 400);
        adminOperations = mergeAdminOperations(emptyAdminOperations(), operations);
    }

    // Basic validation (can be improved with Zod)
    const productName = body.product_name || body.productName;
    const customerInfo = body.customer_info || {};
    const customerName = customerInfo.name || body.customerName;
    const customerEmail = customerInfo.email || body.email;
    const customerPhone = customerInfo.phone || body.phone;

    if (!productName || !customerName) {
        return c.json({ error: 'Missing required fields' }, 400);
    }

    // Customers book for themselves as a new, unpaid request; only admins choose these fields.
    const id = (isAdmin && body.id) || crypto.randomUUID();
    const rawDocumentContent = body.document_content || body.documentContent;

    // Generate the next number from the historical maximum so deleted rows
    // never cause a PayPal invoice number to be reused.
    let reservationNumber = '';
    try {
        const row = await c.env.DB.prepare(`
            SELECT COALESCE(MAX(CAST(SUBSTR(reservation_number, 3) AS INTEGER)), 0) AS max_num
            FROM reservations
        `).first();
        const next = Number(row?.max_num || 0) + 1;
        reservationNumber = `MN${String(next).padStart(3, '0')}`;
    } catch (numberError) {
        console.warn('[Reservation Number] max lookup failed; using timestamp fallback', numberError);
        reservationNumber = `MN${Date.now().toString().slice(-4)}`;
    }

    try {
        const insertReservation = () => db.insert(reservations).values({
            id,
            type: body.type ? String(body.type) : 'tour',
            productName: String(productName),
            productId,
            userId: isAdmin
                ? ((body.user_id || body.userId) ? String(body.user_id || body.userId) : null)
                : user.id,
            customerName: String(customerName),
            customerEmail: String(customerEmail),
            customerPhone: String(customerPhone),
            travelers: Number(body.total_people || body.totalPeople || 1),
            startDate: (body.start_date || body.date) ? String(body.start_date || body.date) : null,
            endDate: body.end_date ? String(body.end_date) : null,
            duration: body.duration ? String(body.duration) : null,
            status: isAdmin && body.status ? String(body.status) : 'pending_payment',
            source: isAdmin && body.source ? String(body.source) : null,
            totalPrice: Number(body.price_breakdown?.total ?? body.totalAmount ?? 0),
            depositAmount: Number(body.price_breakdown?.deposit ?? body.deposit ?? 0),
            balanceAmount: Number(body.price_breakdown?.local ?? body.balance ?? 0),
            paymentMethod: body.paymentMethod ? String(body.paymentMethod) : null,
            notes: body.notes ? String(body.notes) : null,
            adminOperations: adminOperations ? JSON.stringify(adminOperations) : null,
            contractData: adminOperations ? JSON.stringify(syncProductVehicle(adminOperations, {}, { operations: adminOperations }).contractData) : null,
            dailyAccommodations: body.dailyAccommodations ? JSON.stringify(body.dailyAccommodations) : null,
            history: isAdmin && body.history ? JSON.stringify(body.history) : null,
            itineraryTemplateId: isAdmin && (body.itinerary_template_id || body.itineraryTemplateId)
                ? String(body.itinerary_template_id || body.itineraryTemplateId)
                : null,
            documentContent: isAdmin && rawDocumentContent
                ? (typeof rawDocumentContent === 'string' ? rawDocumentContent : JSON.stringify(rawDocumentContent))
                : null,
            reservationNumber,
        }).run();

        try {
            await insertReservation();
        } catch (insertError) {
            // drizzle 의 INSERT 는 스키마의 모든 컬럼을 나열한다. deposit_report 컬럼이 아직 없는 DB
            // (배포 후 /api/migrate-db 를 열기 전)에서는 예약 접수 자체가 실패하므로, 컬럼을 만들고 한 번 더 시도한다.
            if (!isMissingDepositColumn(insertError) || !(await addDepositReportColumn(c.env.DB))) throw insertError;
            await insertReservation();
        }

        // 예약금은 계좌이체 + 입금 신고로 받는다(오너 방침). PayPal 인보이스는 PAYPAL_ENABLED=true 일 때만 보낸다.
        if (c.env.PAYPAL_ENABLED === 'true') {
            const missingPayPalEnv = [
                !c.env.PAYPAL_CLIENT_ID && 'PAYPAL_CLIENT_ID',
                !c.env.PAYPAL_SECRET_KEY && 'PAYPAL_SECRET_KEY',
                !c.env.PAYPAL_BUSINESS_EMAIL && 'PAYPAL_BUSINESS_EMAIL',
            ].filter(Boolean);
            const depositAmt = Number(body.price_breakdown?.deposit ?? body.deposit ?? 0);

            if (missingPayPalEnv.length > 0) {
                console.warn(`[PayPal Invoice] skipped: missing ${missingPayPalEnv.join(', ')}`);
            } else if (!customerEmail) {
                console.warn(`[PayPal Invoice] skipped: customer email is missing (${reservationNumber})`);
            } else if (!Number.isFinite(depositAmt) || depositAmt <= 0) {
                console.warn(`[PayPal Invoice] skipped: deposit amount is ${depositAmt || 0} (${reservationNumber})`);
            } else {
                const invoicePromise = sendPayPalInvoice({
                    clientId: c.env.PAYPAL_CLIENT_ID,
                    secret: c.env.PAYPAL_SECRET_KEY,
                    businessEmail: c.env.PAYPAL_BUSINESS_EMAIL,
                    customerEmail: String(customerEmail),
                    customerName: String(customerName),
                    reservationNumber,
                    productName: String(productName),
                    depositAmount: depositAmt,
                    environment: c.env.PAYPAL_ENVIRONMENT,
                }).then(({ invoiceId, invoiceNumber }) => {
                    console.log(`[PayPal Invoice] sent: ${invoiceNumber} (${invoiceId})`);
                }).catch((paypalErr: any) => {
                    console.error(`[PayPal Invoice] failed: ${reservationNumber}`, paypalErr);
                });

                try {
                    c.executionCtx.waitUntil(
                        invoicePromise
                    );
                } catch (waitUntilError) {
                    // The promise has already started. Keep the successful INSERT
                    // response even if this runtime cannot register waitUntil.
                    console.warn('[PayPal Invoice] waitUntil unavailable; continuing in background', waitUntilError);
                    void invoicePromise;
                }
            }
        }

        return c.json({ message: 'Reservation created', id, reservationNumber }, 201);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// POST /api/reservations/:id/deposit-report — 고객이 예약금을 입금했다고 알린다 (입금자명 정정 재신고 가능).
// 예약 상태는 바꾸지 않는다: 담당자가 입금을 확인하고 관리 화면에서 '입금 확인'을 눌러야 확정된다.
app.post('/:id/deposit-report', async (c) => {
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: '로그인이 필요합니다.', code: 'UNAUTHORIZED' }, 401);

    let body: any = null;
    try { body = await c.req.json(); } catch { body = null; }
    const name = oneLine(body?.name);
    if (!name || Array.from(name).length > DEPOSITOR_NAME_MAX) {
        return c.json({ error: `입금자명을 1~${DEPOSITOR_NAME_MAX}자로 입력해 주세요.`, code: 'NAME_INVALID' }, 400);
    }

    try {
        const id = c.req.param('id');
        // SELECT * 는 deposit_report 컬럼이 아직 없어도 실패하지 않는다.
        const row: any = await c.env.DB.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first();
        if (!row) return c.json({ error: '예약을 찾을 수 없습니다.', code: 'NOT_FOUND' }, 404);

        // 본인 예약(user_id)만. user_id 가 없는 예약은 예약자 이메일이 로그인 계정과 같아야 한다.
        const isOwner = row.user_id ? row.user_id === user.id : sameEmail(row.customer_email, user.email);
        if (user.role !== 'admin' && !isOwner) {
            return c.json({ error: '본인의 예약만 입금 신고를 할 수 있습니다.', code: 'FORBIDDEN' }, 403);
        }

        if (row.status === 'cancelled') {
            return c.json({ error: '취소된 예약은 입금 신고를 할 수 없습니다.', code: 'CANCELLED' }, 409);
        }
        if (row.deposit_status === 'paid') {
            return c.json({ error: '이미 예약금 입금이 확인된 예약입니다.', code: 'ALREADY_PAID' }, 409);
        }

        const previous = parseDepositReport(row.deposit_report);
        const previousAt = previous ? Date.parse(previous.reportedAt) : NaN;
        const waitMs = Number.isFinite(previousAt) ? DEPOSIT_REPORT_COOLDOWN_MS - (Date.now() - previousAt) : 0;
        if (waitMs > 0) {
            c.header('Retry-After', String(Math.ceil(waitMs / 1000)));
            return c.json({ error: '방금 입금 신고가 접수되었습니다. 1분 뒤에 다시 시도해 주세요.', code: 'RATE_LIMITED' }, 429);
        }

        const reportedAt = new Date().toISOString();
        const depositReport: DepositReport = { status: 'reported', name, reportedAt };

        // 타임라인 항목은 관리 화면이 쓰는 모양 그대로: { timestamp, type, description, detail? }
        let history: any[] = [];
        try {
            const stored = row.history ? JSON.parse(row.history) : [];
            if (Array.isArray(stored)) history = stored;
        } catch { history = []; }
        history.push({
            timestamp: reportedAt,
            type: 'deposit_reported',
            description: `고객 입금 신고: 입금자명 ${name}`,
            ...(previous && previous.name !== name ? { detail: `이전 신고 입금자명: ${previous.name}` } : {}),
        });

        const save = () => c.env.DB
            .prepare('UPDATE reservations SET deposit_report = ?, history = ?, updated_at = ? WHERE id = ?')
            .bind(JSON.stringify(depositReport), JSON.stringify(history), reportedAt, id)
            .run();
        try {
            await save();
        } catch (saveError) {
            // 컬럼이 아직 없으면(/api/migrate-db 를 열기 전) 한 번 만들어 보고 다시 저장한다.
            let saved = false;
            if (isMissingDepositColumn(saveError) && (await addDepositReportColumn(c.env.DB))) {
                try {
                    await save();
                    saved = true;
                } catch (retryError) {
                    console.error('[Deposit Report] save failed after adding the column', errorChain(retryError));
                }
            } else {
                console.error('[Deposit Report] save failed', errorChain(saveError));
            }
            if (!saved) {
                return c.json({ error: '입금 신고를 저장하지 못했습니다. 잠시 후 다시 시도하시거나 카카오톡 채널로 알려 주세요.', code: 'UNAVAILABLE' }, 503);
            }
        }

        // 담당자 알림은 응답을 기다리게 하지 않는다. 알림이 실패해도 신고는 접수된 것으로 본다.
        const notifying = notifyStaffOfDepositReport(c.env, {
            reservationDbId: String(row.id),
            reservationNumber: String(row.reservation_number || String(row.id).slice(0, 8).toUpperCase()),
            customerName: String(row.customer_name || '고객'),
            productName: String(row.product_name || '투어'),
            depositorName: name,
            depositAmount: Number(row.deposit_amount) || 0,
            reportedAt,
        }).catch((notifyError: unknown) => {
            console.error('[Deposit Report] staff notification failed', errorChain(notifyError));
        });
        try {
            c.executionCtx.waitUntil(notifying);
        } catch {
            await notifying;
        }

        return c.json({ success: true, depositReport });
    } catch (error) {
        console.error('[Deposit Report] failed', errorChain(error));
        return c.json({ error: '입금 신고 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.', code: 'SERVER_ERROR' }, 500);
    }
});

// DELETE /api/reservations/:id
app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const lucia = initializeLucia(c.env.DB);
    const sessionId = getCookie(c, lucia.sessionCookieName);

    if (!sessionId) {
        return c.json({ error: "Unauthorized" }, 401);
    }

    const { session, user } = await lucia.validateSession(sessionId);
    if (!session || user.role !== 'admin') {
        return c.json({ error: "Forbidden" }, 403);
    }

    const db = drizzle(c.env.DB);

    // Check if exists
    const existing = await db.select().from(reservations).where(eq(reservations.id, id)).get();
    if (!existing) {
        return c.json({ error: "Not found" }, 404);
    }

    await db.delete(reservations).where(eq(reservations.id, id)).run();

    return c.json({ success: true, id });
});

export default app;
