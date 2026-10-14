import { Hono } from 'hono';
import { BRAND, COMPANY_INFO, DEPOSIT_ACCOUNT, resolveCancellationRows } from '../../src/constants/company';
import { getSessionUser } from '../lib/userAuth';
import { requireAdmin } from '../lib/adminAuth';
import { buildProductQuote, hasProductSchedule, loadProductDocument, mergeProductDays, productItineraryPublished } from '../lib/productItinerary';

type Env = {
    DB: any;
};

const app = new Hono<{ Bindings: Env }>();

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
const loadProductIncExc = async (db: any, productName?: string | null): Promise<{ included: string[]; excluded: string[] }> => {
    const empty = { included: [], excluded: [] };
    if (!productName) return empty;
    try {
        const prod: any = await db.prepare('SELECT included, excluded FROM products WHERE name = ? LIMIT 1').bind(productName).first();
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

    const productIncExc = await loadProductIncExc(db, reservation.product_name);

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
    const db = c.env.DB;
    const reservation = await db.prepare('SELECT * FROM reservations WHERE id = ?').bind(id).first();
    if (!reservation) return c.json({ error: 'Reservation not found' }, 404);
    if (!['confirmed', 'paid', 'completed'].includes(reservation.status)) {
        return c.json({ error: '예약금 확인 후 예약을 확정해야 확정 일정표를 공개할 수 있습니다.' }, 409);
    }
    const { days } = await loadProductDocument(db, reservation);
    if (!hasProductSchedule(days)) return c.json({ error: '여행 일정을 작성하고 저장해 주세요.' }, 409);
    const itineraryUrl = `${BRAND.siteUrl}/documents/itinerary/${id}`;
    await db.prepare("UPDATE reservations SET itinerary_url = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(itineraryUrl, id).run();
    return c.json({ itineraryUrl });
});

// GET /api/documents/contract/:reservationId — public
app.get('/contract/:reservationId', async (c) => {
    const reservationId = c.req.param('reservationId');
    const db = c.env.DB;

    const reservation = await db.prepare(
        // 보안: 추측 가능한 예약번호(MNxxx)가 아닌 UUID(reservation.id)로만 조회 — 열거(enumeration) 공격 차단
        'SELECT * FROM reservations WHERE id = ?'
    ).bind(reservationId).first();

    if (!reservation) {
        return c.json({ error: 'Reservation not found' }, 404);
    }

    let contractData: any = {};
    try { contractData = reservation.contract_data ? JSON.parse(reservation.contract_data) : {}; } catch { contractData = {}; }

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

    const productIncExc = await loadProductIncExc(db, reservation.product_name);

    return c.json({
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
        template,
        accommodations: dailyAccommodations.length > 0 ? dailyAccommodations : templateAccommodations,
        guide: assignedGuide,
        productIncluded: productIncExc.included,
        productExcluded: productIncExc.excluded,
    });
});

// POST /api/documents/contract/:reservationId/customer — public (link-based)
// 고객이 계약서에서 직접 입력한 여권정보 + 온라인 동의를 저장
app.post('/contract/:reservationId/customer', async (c) => {
    const reservationId = c.req.param('reservationId');
    const db = c.env.DB;

    const reservation: any = await db.prepare(
        // 보안: 추측 가능한 예약번호(MNxxx)가 아닌 UUID(reservation.id)로만 조회 — 열거(enumeration) 공격 차단
        'SELECT * FROM reservations WHERE id = ?'
    ).bind(reservationId).first();

    if (!reservation) {
        return c.json({ error: 'Reservation not found' }, 404);
    }

    let body: any = {};
    try { body = await c.req.json(); } catch { body = {}; }

    let contractData: any = {};
    try { contractData = reservation.contract_data ? JSON.parse(reservation.contract_data) : {}; } catch { contractData = {}; }

    // 여행자 여권정보(고객 입력)와 동의 정보만 병합 — 관리자가 입력한 일정/항공편 등은 유지
    if (Array.isArray(body.travelers)) {
        contractData.travelers = body.travelers.map((t: any) => ({
            name: t.name || '',
            passportName: t.passportName || '',
            birthdate: t.birthdate || '',
            gender: t.gender || '',
            phone: t.phone || '',
        }));
    }
    // 고객이 입력한 왕복 항공편 정보 병합 — 공항 송영 수배용. 값이 있을 때만 덮어써서 관리자 입력 보존
    const hasFlight = (f: any) => f && typeof f === 'object' && (f.date || f.time || f.flight);
    if (hasFlight(body.arrival)) {
        contractData.arrival = { date: body.arrival.date || '', time: body.arrival.time || '', flight: body.arrival.flight || '' };
    }
    if (hasFlight(body.departure)) {
        contractData.departure = { date: body.departure.date || '', time: body.departure.time || '', flight: body.departure.flight || '' };
    }
    if (body.agreement && body.agreement.agreed) {
        contractData.agreement = {
            agreed: true,
            name: body.agreement.name || '',
            agreedAt: body.agreement.agreedAt || new Date().toISOString(),
        };
    }
    contractData.customerSubmittedAt = new Date().toISOString();

    await db.prepare(
        'UPDATE reservations SET contract_data = ? WHERE id = ?'
    ).bind(JSON.stringify(contractData), reservation.id).run();

    return c.json({ success: true, contract: contractData });
});

export default app;
