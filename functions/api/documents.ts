import { Hono } from 'hono';
import { BRAND, COMPANY_INFO, DEPOSIT_ACCOUNT, resolveCancellationRows } from '../../src/constants/company';
import { getSessionUser } from '../lib/userAuth';
import { requireResourceAccess } from '../lib/customerAccess';
import { requireAdmin } from '../lib/adminAuth';
import { buildProductQuote, hasProductSchedule, loadProductDocument, mergeProductDays, productItineraryPublished } from '../lib/productItinerary';
import { PRODUCT_CONTRACT_TERMS_VERSION, productContractTerms, productSignatureRecord, publicProductContract, validateProductSignature } from '../../src/utils/productContractSignature';
import { documentRevision } from '../lib/adminDocumentRevision';
import { dispatchCustomerNotification, type CustomerNotificationKind } from '../lib/customerNotifications';

type Env = {
    DB: any;
};

const app = new Hono<{ Bindings: Env }>();
app.use('*', async (c, next) => { c.header('Cache-Control', 'private, no-store'); await next(); });

async function queueCustomerNotification(c: any, bookingId: string, kind: CustomerNotificationKind, eventKey: string) {
    const task = Promise.resolve().then(() => dispatchCustomerNotification(c.env, { source: 'product', bookingId, kind, eventKey }))
        .catch(() => { console.error('[Customer Notification] outcome unavailable', kind); });
    try { c.executionCtx.waitUntil(task); } catch { await task; }
}

const DOC_SETTINGS_MARKER = '\n\n__MILKYWAY_DOCUMENT_SETTINGS__=';

const parseNestedJson = (value: any, fallback: any = null, maxDepth = 2) => {
    if (!value) return fallback;
    let parsed = value;
    for (let depth = 0; depth < maxDepth && typeof parsed === 'string'; depth += 1) {
        try {
            parsed = JSON.parse(parsed);
        } catch {
            return fallback;
        }
    }
    return parsed;
};

const decodeTemplateDescription = (raw = '') => {
    const [description, encoded] = String(raw || '').split(DOC_SETTINGS_MARKER);
    if (!encoded) return { description: raw || '', documentSettings: null };
    try {
        return { description, documentSettings: JSON.parse(encoded) };
    } catch {
        return { description, documentSettings: null };
    }
};

// 예약 상품명으로 products 테이블의 포함/불포함(상품관리 입력값)을 로드.
// 일정표·계약서가 동일한 상품 기준 포함/불포함을 노출하도록 단일 출처로 사용.
const loadProductIncExc = async (db: any, productName?: string | null, productId?: string | null): Promise<{ included: string[]; excluded: string[] }> => {
    const empty = { included: [], excluded: [] };
    if (!productName && !productId) return empty;
    try {
        const prod: any = productId
            ? await db.prepare('SELECT included, excluded FROM products WHERE id = ?').bind(productId).first()
            : await db.prepare('SELECT included, excluded FROM products WHERE name = ? LIMIT 1').bind(productName).first();
        if (!prod) return empty;
        const arr = (v: any) => {
            try { const p = JSON.parse(v || '[]'); return Array.isArray(p) ? p.filter((x: any) => typeof x === 'string' && x.trim()) : []; }
            catch { return []; }
        };
        return { included: arr(prod.included), excluded: arr(prod.excluded) };
    } catch {
        return empty;
    }
};

// GET /api/documents/itinerary/:reservationId
// 기존 가이드 API는 호환 유지. format=quote는 공개된 고객 문서 또는 관리자 미리보기만 반환한다.
app.get('/itinerary/:reservationId', async (c) => {
    c.header('Cache-Control', 'private, no-store');
    const reservationId = c.req.param('reservationId');
    // The internal guide print client uses the default shape without a guide query.
    // Customers use the published format=quote projection; only admins read the guide shape.
    const denied = await requireResourceAccess(c.req.raw, c.env, 'reservation', reservationId, { adminOnly: c.req.query('guide') === '1' || c.req.query('format') !== 'quote' });
    if (denied) return denied;
    const db = c.env.DB;

    const reservation = await db.prepare(
        // 보안: 추측 가능한 예약번호(MNxxx)가 아닌 UUID(reservation.id)로만 조회 — 열거(enumeration) 공격 차단
        'SELECT * FROM reservations WHERE id = ?'
    ).bind(reservationId).first();

    if (!reservation) {
        return c.json({ error: 'Reservation not found' }, 404);
    }

    // Parse JSON fields
    let assignedGuide: any = null;
    try {
        assignedGuide = reservation.assigned_guide ? JSON.parse(reservation.assigned_guide) : null;
    } catch { assignedGuide = null; }

    const { product, template, days: mergedDays } = await loadProductDocument(db, reservation);
    const pdfFormat = c.req.query("format") === "quote";
    const preview = c.req.query("preview") === "1";
    let isAdmin = false;
    if (pdfFormat && preview) {
        isAdmin = (await getSessionUser(c))?.role === "admin";
        if (!isAdmin) return c.json({ error: "관리자 미리보기에는 로그인이 필요합니다." }, 403);
    }
    if (pdfFormat && !isAdmin && !productItineraryPublished(reservation)) {
        return c.json({ error: "확정 일정표 준비 중이에요. 담당자가 공개하면 확인할 수 있습니다." }, 409);
    }
    if (pdfFormat && !hasProductSchedule(mergedDays)) {
        return c.json({ error: "저장된 여행 일정이 없습니다. 담당자에게 문의해 주세요." }, 409);
    }
    const assignmentsVisible = isAdmin || !!reservation.are_assignments_visible_to_user;
    const customerDays = assignmentsVisible ? mergedDays : mergeProductDays({ ...reservation, daily_accommodations: null }, template, product);
    const quote = pdfFormat ? buildProductQuote({ reservation, template, product, days: customerDays,
        assignmentsVisible,
        brand: { company: BRAND.name, companyEn: BRAND.nameEn.toUpperCase(), companyFull: BRAND.name + " 현지 여행사",
            slogan: "당신의 삶을 우러러 볼 시간", instagram: "@mongolia_inhasu", kakao: "mongol247",
            bizMn: "몽골 현지 사업자 등록번호: " + COMPANY_INFO.registrationNumber + "(SUUNZAM)",
            bizKr: "국내 대행사 사업자 등록 번호: 730-54-00614(헬로볼라)",
            account: DEPOSIT_ACCOUNT.number + " " + DEPOSIT_ACCOUNT.bank + " " + DEPOSIT_ACCOUNT.holder } }) : undefined;

    if (quote) {
        return c.json({ quote: { ...quote, refundRows: resolveCancellationRows(template?.documentSettings?.contract?.cancellationRows) } });
    }

    const productIncExc = await loadProductIncExc(db, reservation.product_name, reservation.product_id);

    return c.json({
        reservation: {
            id: reservation.id,
            reservationNumber: reservation.reservation_number,
            productName: reservation.product_name,
            customerName: reservation.customer_name,
            customerEmail: reservation.customer_email,
            travelers: reservation.travelers,
            startDate: reservation.start_date,
            endDate: reservation.end_date,
            status: reservation.status,
        },
        template,
        guide: assignedGuide,
        days: mergedDays,
        productIncluded: productIncExc.included,
        productExcluded: productIncExc.excluded,
        ...(quote ? { quote } : {}),
    });
});

// 링크 공유도 이메일 발송도 먼저 문서를 공개한다. 읽기/미리보기로 공개 상태를 바꾸지 않는다.
app.post('/itinerary/:reservationId/publish', requireAdmin, async (c) => {
    const id = c.req.param('reservationId');
    const denied = await requireResourceAccess(c.req.raw, c.env, 'reservation', id, { write: true, adminOnly: true });
    if (denied) return denied;
    const db = c.env.DB;
    const reservation = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first();
    if (!reservation) return c.json({ error: 'Reservation not found' }, 404);
    if (!['confirmed', 'paid', 'completed'].includes(reservation.status)) {
        return c.json({ error: '예약금 확인 후 예약을 확정해야 확정 일정표를 공개할 수 있습니다.' }, 409);
    }
    const { days } = await loadProductDocument(db, reservation);
    if (!hasProductSchedule(days)) return c.json({ error: '여행 일정을 작성하고 저장해 주세요.' }, 409);
    const itineraryUrl = `${BRAND.siteUrl}/documents/itinerary/${id}`;
    const published = await db.prepare("UPDATE reservations SET itinerary_url = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(itineraryUrl, id).run();
    if (Number(published?.meta?.changes ?? published?.changes ?? 0) !== 1) return c.json({ error: '예약이 변경되었습니다. 최신 정보를 확인한 뒤 다시 공개해 주세요.' }, 409);
    if (!productItineraryPublished(reservation)) {
        await queueCustomerNotification(c, id, 'itinerary', `product:${id}:first-itinerary-published:v1`);
    }
    return c.json({ itineraryUrl });
});

async function loadProductContractData(db: any, reservation: any, contractData: any) {
    let dailyAccommodations: any[] = [];
    try { dailyAccommodations = reservation.daily_accommodations ? JSON.parse(reservation.daily_accommodations) : []; } catch { dailyAccommodations = []; }

    let assignedGuide: any = null;
    try { assignedGuide = reservation.assigned_guide ? JSON.parse(reservation.assigned_guide) : null; } catch { assignedGuide = null; }

    let template: any = null;
    if (reservation.itinerary_template_id) {
        const t: any = await db.prepare(
            'SELECT * FROM itinerary_templates WHERE id = ?'
        ).bind(reservation.itinerary_template_id).first();
        if (t) {
            const decoded = decodeTemplateDescription(t.description || '');
            template = {
                id: t.id,
                name: t.name,
                description: decoded.description,
                documentSettings: decoded.documentSettings,
                days: (() => {
                    try { return t.days ? JSON.parse(t.days) : []; } catch { return []; }
                })(),
            };
        }
    }

    // 고객별 편집·저장된 문서 설정이 있으면 우선 사용
    const dcc = parseNestedJson(reservation.document_content);
    if (dcc && dcc.documentSettings) {
        template = {
            id: template?.id || 'custom',
            name: dcc.name || template?.name || '',
            description: dcc.description || template?.description || '',
            documentSettings: dcc.documentSettings,
            days: Array.isArray(dcc.days) ? dcc.days : (template?.days || []),
        };
    }

    const templateAccommodations = (template?.days || [])
        .filter((day: any) => day?.accommodation)
        .map((day: any, index: number) => ({
            day: day.day || index + 1,
            accommodation: typeof day.accommodation === 'string' ? { name: day.accommodation } : day.accommodation,
        }));

    const productIncExc = await loadProductIncExc(db, reservation.product_name, reservation.product_id);
    // 고객별로 저장한 계약 조건은 편집기와 고객 계약서가 같은 값을 사용한다.
    const savedContractSettings = dcc?.documentSettings?.contract;
    for (const [key, field] of [['included', 'includedText'], ['excluded', 'excludedText']] as const) {
        if (typeof savedContractSettings?.[field] === 'string') {
            productIncExc[key] = savedContractSettings[field].split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean);
        }
    }

    return {
        reservation: {
            id: reservation.id,
            reservationNumber: reservation.reservation_number,
            productName: reservation.product_name,
            customerName: reservation.customer_name,
            customerEmail: reservation.customer_email,
            customerPhone: reservation.customer_phone,
            travelers: reservation.travelers,
            startDate: reservation.start_date,
            endDate: reservation.end_date,
            status: reservation.status,
            totalPrice: reservation.total_price,
            depositAmount: reservation.deposit_amount,
            balanceAmount: reservation.balance_amount,
            createdAt: reservation.created_at,
        },
        contract: contractData,
        contractIncludedOverride: typeof savedContractSettings?.includedText === 'string',
        contractExcludedOverride: typeof savedContractSettings?.excludedText === 'string',
        template,
        accommodations: dailyAccommodations.length > 0 ? dailyAccommodations : templateAccommodations,
        guide: assignedGuide,
        productIncluded: productIncExc.included,
        productExcluded: productIncExc.excluded,
    };
}

// GET /api/documents/contract/:reservationId — existing private customer link
app.get('/contract/:reservationId', async (c) => {
    const denied = await requireResourceAccess(c.req.raw, c.env, 'reservation', c.req.param('reservationId'));
    if (denied) return denied;
    const reservation = await c.env.DB.prepare('SELECT * FROM reservations WHERE id = ?').bind(c.req.param('reservationId')).first();
    if (!reservation) return c.json({ error: 'Reservation not found' }, 404);
    const contractData = parseNestedJson(reservation.contract_data, {}) || {};
    const document = await loadProductContractData(c.env.DB, reservation, contractData);
    const isAdmin = (await getSessionUser(c))?.role === 'admin';
    const signatureRevision = await documentRevision({ document: { ...document, contract: publicProductContract(contractData) }, terms: productContractTerms(), termsVersion: PRODUCT_CONTRACT_TERMS_VERSION });
    return c.json({ ...document, contract: isAdmin ? contractData : publicProductContract(contractData), signatureRevision });
});

// Existing typed agreements remain compatible; actual hand signatures are additive evidence.
app.post('/contract/:reservationId/customer', async (c) => {
    const denied = await requireResourceAccess(c.req.raw, c.env, 'reservation', c.req.param('reservationId'), { write: true });
    if (denied) return denied;
    const db = c.env.DB;
    const reservation: any = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(c.req.param('reservationId')).first();
    if (!reservation) return c.json({ error: 'Reservation not found' }, 404);
    let body: any;
    try {
        const raw = await c.req.text();
        if (raw.length > 450_000) return c.json({ error: '계약 제출 내용이 너무 큽니다.' }, 413);
        body = JSON.parse(raw);
    } catch { return c.json({ error: '계약 제출 내용을 확인해 주세요.' }, 400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return c.json({ error: '계약 제출 내용을 확인해 주세요.' }, 400);
    const original = parseNestedJson(reservation.contract_data, {}) || {};
    const contractData = { ...original };
    const cleanText = (value: any, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
    const fields = ['name', 'passportName', 'birthdate', 'gender', 'phone'] as const;
    if (body.travelers !== undefined) {
        if (!Array.isArray(body.travelers) || body.travelers.length > 60 || body.travelers.some((person: any) => !person || typeof person !== 'object' || Array.isArray(person) || fields.some(key => person[key] !== undefined && typeof person[key] !== 'string'))) {
            return c.json({ error: '여행자 정보를 확인해 주세요.' }, 400);
        }
        contractData.travelers = body.travelers.map((person: any) => Object.fromEntries(fields.map(key => [key, cleanText(person[key], key === 'birthdate' ? 10 : 100)])));
    }
    const hasFlight = (flight: any) => flight && typeof flight === 'object' && !Array.isArray(flight) && (flight.date || flight.time || flight.flight);
    const validDate = (value: string) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value);
    for (const key of ['arrival', 'departure']) {
        const flight = body[key];
        if (flight !== undefined && (!flight || typeof flight !== 'object' || Array.isArray(flight) || ['date', 'time', 'flight'].some(field => flight[field] !== undefined && typeof flight[field] !== 'string'))) return c.json({ error: '항공편 정보를 확인해 주세요.' }, 400);
        if (hasFlight(flight)) {
            const date = cleanText(flight.date, 30), time = cleanText(flight.time, 30);
            if (!validDate(date) || (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))) return c.json({ error: '항공편 날짜와 24시간 기준 시각을 확인해 주세요.' }, 400);
            contractData[key] = { date, time, flight: cleanText(flight.flight, 80) };
        }
    }
    const now = new Date().toISOString();
    if (body.agreement !== undefined) {
        if (!body.agreement || body.agreement.agreed !== true || !cleanText(body.agreement.name, 100)) return c.json({ error: '계약 내용 동의와 성명을 확인해 주세요.' }, 400);
        contractData.agreement = { agreed: true, name: cleanText(body.agreement.name, 100), agreedAt: now };
    }
    if (body.signature !== undefined) {
        if (productSignatureRecord(original)) return c.json({ error: '이미 저장된 서명 원본은 다시 제출하여 변경할 수 없습니다. 새로고침 후 확인해 주세요.' }, 409);
        if (contractData.agreement?.agreed !== true) return c.json({ error: '계약 내용에 동의해 주세요.' }, 400);
        const checked = validateProductSignature(body.signature);
        if (!checked.ok) return c.json({ error: checked.error }, checked.status);
        if (checked.signerName !== contractData.agreement.name) return c.json({ error: '성명과 서명자 이름이 일치하지 않습니다.' }, 400);
        if (['cancelled'].includes(reservation.status)) return c.json({ error: '취소된 예약은 서명할 수 없습니다.' }, 409);
        const reviewed = await loadProductContractData(db, reservation, original);
        const revision = await documentRevision({ document: { ...reviewed, contract: publicProductContract(original) }, terms: productContractTerms(), termsVersion: PRODUCT_CONTRACT_TERMS_VERSION });
        if (typeof body.signature.expectedRevision !== 'string' || body.signature.expectedRevision !== revision) return c.json({ error: '계약 내용이 변경되었습니다. 작성한 정보를 보관한 뒤 새로고침하여 변경 내용을 확인하고 다시 서명해 주세요.' }, 409);
        const snapshot = { ...reviewed };
        snapshot.contract = publicProductContract(contractData);
        (snapshot as any).contractTerms = productContractTerms();
        contractData.signature = {
            signedAt: now, signerName: checked.signerName, signImg: checked.signImg, termsVersion: PRODUCT_CONTRACT_TERMS_VERSION, reviewedRevision: revision,
            snapshot: { version: 1, document: snapshot },
            ip: c.req.header('CF-Connecting-IP') || '', ua: (c.req.header('User-Agent') || '').slice(0, 200),
        };
    }
    contractData.customerSubmittedAt = now;
    // Compare the source read above: a concurrent signature or assignment must never be overwritten.
    const guardedColumns = ['contract_data', ...(body.signature !== undefined ? ['document_content', 'product_id', 'product_name', 'start_date', 'end_date', 'total_price', 'deposit_amount', 'balance_amount', 'itinerary_template_id', 'assigned_guide', 'daily_accommodations', 'status', 'travelers', 'customer_name', 'customer_phone', 'customer_email'] : [])];
    const guard = guardedColumns.map(key => key + ' IS ?').join(' AND ');
    const updateSql = `UPDATE reservations SET contract_data = ? WHERE id = ? AND ${guard}`;
    const result = await db.prepare(updateSql)
        .bind(JSON.stringify(contractData), reservation.id, ...guardedColumns.map(key => reservation[key] ?? null)).run();
    if (Number(result?.meta?.changes ?? result?.changes ?? 0) !== 1) return c.json({ error: '다른 화면에서 계약 정보가 변경되었습니다. 입력을 보관한 뒤 새로고침하여 확인해 주세요.' }, 409);
    if (body.signature !== undefined) {
        const eventKey = `product:${reservation.id}:contract-signed:${contractData.signature.signedAt}`;
        await queueCustomerNotification(c, reservation.id, 'contract_signed', eventKey);
        await queueCustomerNotification(c, reservation.id, 'travel_notice', eventKey);
    }
    return c.json({ success: true, contract: publicProductContract(contractData) });
});

export default app;
