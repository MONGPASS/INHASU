import { Hono } from 'hono';

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
// Public endpoint — no auth. Returns everything the itinerary page needs.
app.get('/itinerary/:reservationId', async (c) => {
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
    let dailyAccommodations: any[] = [];
    try {
        dailyAccommodations = reservation.daily_accommodations ? JSON.parse(reservation.daily_accommodations) : [];
    } catch { dailyAccommodations = []; }

    let assignedGuide: any = null;
    try {
        assignedGuide = reservation.assigned_guide ? JSON.parse(reservation.assigned_guide) : null;
    } catch { assignedGuide = null; }

    // Fetch itinerary template (if selected)
    let template: any = null;
    if (reservation.itinerary_template_id) {
        const t: any = await db.prepare(
            'SELECT * FROM itinerary_templates WHERE id = ?'
        ).bind(reservation.itinerary_template_id).first();
        if (t) {
            let days: any[] = [];
            try { days = t.days ? JSON.parse(t.days) : []; } catch { days = []; }
            const decoded = decodeTemplateDescription(t.description || '');
            template = {
                id: t.id,
                name: t.name,
                description: decoded.description,
                documentSettings: decoded.documentSettings,
                days,
            };
        }
    }

    // 고객별로 편집·저장된 문서 내용이 있으면 템플릿보다 우선 사용
    const dc = parseNestedJson(reservation.document_content);
    if (dc && (Array.isArray(dc.days) || dc.documentSettings)) {
        template = {
            id: template?.id || 'custom',
            name: dc.name || template?.name || '',
            description: dc.description || template?.description || '',
            documentSettings: dc.documentSettings || template?.documentSettings || null,
            days: Array.isArray(dc.days) ? dc.days : (template?.days || []),
        };
    }

    // Compute day-by-day merged view
    const mergedDays = (template?.days || []).map((tday: any, idx: number) => {
        const dayNumber = tday.day || idx + 1;
        const assignedAccommodation = dailyAccommodations.find((d: any) => d.day === dayNumber)?.accommodation || null;
        const templateAccommodation = tday.accommodation
            ? (typeof tday.accommodation === 'string' ? { name: tday.accommodation } : tday.accommodation)
            : null;
        return {
            day: dayNumber,
            date: tday.date || '',
            title: tday.title || '',
            region: tday.region || '',
            summary: tday.summary || '',
            activities: Array.isArray(tday.activities) ? tday.activities : [],
            meals: tday.meals || {},
            accommodation: assignedAccommodation || templateAccommodation,
        };
    });

    // If template has fewer days than accommodations, pad with accommodation-only rows
    if (dailyAccommodations.length > mergedDays.length) {
        for (let d = mergedDays.length + 1; d <= dailyAccommodations.length; d++) {
            const accommodation = dailyAccommodations.find((x: any) => x.day === d)?.accommodation || null;
            if (accommodation) mergedDays.push({ day: d, date: dailyAccommodations.find((x: any) => x.day === d)?.date || '', title: '', activities: [], accommodation });
        }
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
    });
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
