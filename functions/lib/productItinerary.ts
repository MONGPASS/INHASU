// 상품 예약을 기존 INHASU 확정 일정표의 데이터 형식으로 연결한다.
// 샘플 견적을 복제하지 않는다. 누락된 고객 정보·금액은 실제 예약 값만 사용한다.
import type { RepresentativeSpotSnapshot } from '../../src/types/product';
import { readProductVehicle } from '../../src/utils/reservationAssignment.ts';
import { resolveCancellationRows } from '../../src/constants/company.ts';

export function parseDocumentJson(value: any, fallback: any = null) {
    let result = value;
    for (let i = 0; i < 3 && typeof result === 'string'; i++) {
        try { result = JSON.parse(result); } catch { return fallback; }
    }
    return result ?? fallback;
}

const array = (value: any): any[] => {
    const result = parseDocumentJson(value, []);
    return Array.isArray(result) ? result : [];
};
const text = (value: any) => typeof value === 'string' ? value : '';
const lines = (value: any) => text(value).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const amount = (value: any) => Number.isFinite(Number(value)) ? Number(value) : 0;
const dateKey = (value: any) => /^\d{4}-\d{2}-\d{2}/.test(text(value)) ? value.slice(0, 10) : '';
const dayDate = (start: string, offset: number) => {
    if (!start) return '';
    const date = new Date(`${start}T00:00:00Z`);
    if (!Number.isFinite(date.getTime())) return '';
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
};
export const documentImage = (value: any) => {
    const url = text(value).trim();
    // 회사의 정적/R2 이미지와 외부 http(s) 사진만. HTML·스크립트 URL은 넣지 않는다.
    return /^(https?:\/\/|\/(?!\/)|img\/)/i.test(url) ? url.replace(/["'<>\s]/g, c => c === "'" ? '%27' : encodeURIComponent(c)) : '';
};
const photos = (value: any) => array(value).map(documentImage).filter(Boolean);

/** Registered spot snapshots only; never infer spots from sales highlights. */
export function normalizeRepresentativeSpots(value: any): RepresentativeSpotSnapshot[] {
    return array(value).filter(spot => spot && typeof spot === 'object' && !Array.isArray(spot) && text(spot.name).trim()).map(spot => ({
        name: text(spot.name),
        ...Object.fromEntries(['nameMn', 'short', 'region', 'desc'].filter(key => typeof spot[key] === 'string').map(key => [key, spot[key]])),
        ...(typeof spot.img === 'string' ? { img: documentImage(spot.img) } : {}),
        ...(Array.isArray(spot.subImgs) ? { subImgs: photos(spot.subImgs) } : {}),
    }));
}

/** 상품 관리의 DAY/타임라인/이미지/슬라이드형 일정도 원본 사진과 함께 가져온다. */
export function productScheduleDays(product: any) {
    const days: any[] = [];
    let current: any;
    const ensureDay = () => {
        if (!current) { current = { day: days.length + 1, title: '', activities: [], meals: {} }; days.push(current); }
        return current;
    };
    for (const block of array(product?.itinerary_blocks ?? product?.itineraryBlocks)) {
        const content = parseDocumentJson(block.content, block.content);
        if (block.type === 'dayInfo' && content && typeof content === 'object') {
            current = {
                day: days.length + 1, title: text(content.title), summary: text(content.description),
                activities: [], meals: content.meals || {}, images: [...photos(content.galleryImages), documentImage(content.heroImage)].filter(Boolean),
                accommodation: content.accommodation ? {
                    name: content.accommodation, images: photos(content.accommodationImages),
                    description: content.accommodationDescription, location: content.accommodationAddress,
                    ...Object.fromEntries([
                        ['accommodationHotelId', 'id'], ['accommodationAddress', 'address'], ['accommodationRegion', 'region'],
                        ['accommodationType', 'type'], ['accommodationOccupancy', 'occupancy'],
                    ].filter(([source]) => typeof content[source] === 'string').map(([source, target]) => [target, content[source]])),
                    tags: array(content.accommodationAmenities).join(', '),
                    ...Object.fromEntries([
                        ['accommodationAmenities', 'facilities'], ['accommodationRoomAmenities', 'roomAmenities'], ['accommodationSharedFacilities', 'sharedFacilities'],
                    ].filter(([source]) => Array.isArray(content[source])).map(([source, target]) => [target, content[source].map(text).filter(Boolean)])),
                } : null,
            };
            days.push(current);
        } else if (block.type === 'timeline' && content && typeof content === 'object') {
            ensureDay().activities.push({ time: text(content.time), title: text(content.title), description: text(content.description), images: photos(content.images) });
        } else if (block.type === 'image' && documentImage(content)) {
            ensureDay().activities.push({ title: '', description: '', images: [documentImage(content)] });
        } else if (block.type === 'slide' && content && typeof content === 'object') {
            ensureDay().activities.push({ title: text(content.title), description: text(content.description), images: photos(content.images) });
        }
    }
    const legacyImages = photos(product?.itinerary_images ?? product?.itineraryImages);
    if (!days.length && legacyImages.length) ensureDay().activities.push({ title: '여행 일정', images: legacyImages });
    return days;
}

export function mergeProductDays(reservation: any, template: any, product: any) {
    const custom = parseDocumentJson(reservation.document_content, {});
    // 저장된 고객별 일정(빈 배열 포함)이 템플릿·상품보다 우선한다.
    const source = Array.isArray(custom.days) ? custom.days
        : Array.isArray(template?.days) ? template.days : productScheduleDays(product);
    const assigned = array(reservation.daily_accommodations);
    const days = source.map((d: any, i: number) => {
        const day = Number(d.day) || i + 1;
        const stay = assigned.find((a: any) => Number(a.day) === day)?.accommodation;
        return { ...d, day, date: d.dateMode === 'manual' ? text(d.date) : dayDate(dateKey(reservation.start_date), day - 1),
            activities: array(d.activities), meals: d.meals || {},
            accommodation: stay || (typeof d.accommodation === 'string' ? { name: d.accommodation } : d.accommodation) || null };
    });
    for (const a of assigned) {
        if (!days.some((d: any) => d.day === Number(a.day)) && a.accommodation) {
            days.push({ day: Number(a.day), date: dayDate(dateKey(reservation.start_date), Number(a.day) - 1),
                activities: [], meals: {}, accommodation: a.accommodation });
        }
    }
    return days.sort((a: any, b: any) => a.day - b.day);
}

export function hasProductSchedule(days: any[]) {
    return days.some(d => text(d.title).trim() || text(d.summary).trim() || array(d.items).some(item => text(item).trim()) || photos(d.images).length
        || array(d.activities).some(a => text(a.title).trim() || text(a.description).trim() || photos(a.images).length));
}

export function productItineraryPublished(reservation: any) {
    return ['confirmed', 'paid', 'completed'].includes(reservation.status) && !!reservation.itinerary_url;
}

export async function loadProductDocument(db: any, reservation: any) {
    // 이름이 같은 상품이 있어도 ID가 있는 예약은 그 상품만 조회한다.
    const product = reservation.product_id
        ? await db.prepare('SELECT * FROM products WHERE id = ?').bind(reservation.product_id).first()
        : reservation.product_name ? await db.prepare('SELECT * FROM products WHERE name = ? LIMIT 1').bind(reservation.product_name).first() : null;
    let template: any = null;
    if (reservation.itinerary_template_id) {
        const row = await db.prepare('SELECT * FROM itinerary_templates WHERE id = ?').bind(reservation.itinerary_template_id).first();
        if (row) {
            const [description, encoded] = text(row.description).split('\n\n__MILKYWAY_DOCUMENT_SETTINGS__=');
            template = { ...row, description, documentSettings: parseDocumentJson(encoded), days: array(row.days) };
        }
    }
    const custom = parseDocumentJson(reservation.document_content, {});
    if (Array.isArray(custom.days) || custom.documentSettings) {
        template = { ...template, id: template?.id || 'custom', name: custom.name || template?.name || '',
            description: custom.description ?? template?.description ?? '',
            documentSettings: custom.documentSettings || template?.documentSettings,
            days: Array.isArray(custom.days) ? custom.days : template?.days };
    }
    return { product, template, days: mergeProductDays(reservation, template, product) };
}

export function buildProductQuote({ reservation: r, template, product, days, brand, assignmentsVisible }: any) {
    const custom = parseDocumentJson(r.document_content, {});
    const settings = custom.documentSettings || template?.documentSettings || {};
    const overview = settings.overview || {};
    const contract = parseDocumentJson(r.contract_data, {});
    const guide = assignmentsVisible ? parseDocumentJson(r.assigned_guide, {}) : {};
    const vehicleName = assignmentsVisible ? readProductVehicle(r.admin_operations, contract).type : '';
    const vehicleData = vehicleName ? (contract.vehicle || {}) : {};
    const vehicle = typeof vehicleData === 'string' ? { model: vehicleName } : {
        model: vehicleName, img: documentImage(vehicleData.image || vehicleData.img),
        imgs: photos(vehicleData.images || vehicleData.imgs), desc: text(vehicleData.description || vehicleData.desc),
        seats: text(String(vehicleData.seats ?? '')), luggage: text(vehicleData.luggage),
    };
    const start = dateKey(r.start_date), end = dateKey(r.end_date);
    const dateDuration = start && end ? Math.round((Date.parse(end) - Date.parse(start)) / 86400000) : NaN;
    const duration = Number.isFinite(dateDuration) ? Math.max(0, dateDuration) : Math.max(0, days.length - 1);
    const flight = (f: any) => [text(f?.date), text(f?.time), text(f?.flight)].filter(Boolean).join(' · ') || '확인 중';
    const mainImages = photos(product?.main_images ?? product?.mainImages);
    const scheduleImages = days.flatMap((d: any) => [...photos(d.images), ...array(d.activities).flatMap(a => photos(a.images))]);
    const included = typeof overview.includedText === 'string' ? lines(overview.includedText) : array(product?.included).map(text).filter(Boolean);
    const excluded = typeof overview.excludedText === 'string' ? lines(overview.excludedText) : array(product?.excluded).map(text).filter(Boolean);
    const itineraryDays = days.map((d: any) => ({
        d: d.day, date: d.date, dest: (text(d.title) || text(d.region) || `${d.day}일차`).slice(0, 80), move: text(d.move), dist: text(d.dist),
        items: Array.isArray(d.items) ? d.items.filter((item: any) => typeof item === 'string')
            : [...lines(d.summary), ...array(d.activities).map(a => [text(a.time), text(a.title)].filter(Boolean).join(' '))].filter(Boolean).slice(0, 5).map(s => s.slice(0, 100)),
        stay: { name: (text(d.accommodation?.name) || '일정표 참조').slice(0, 80), tags: [] },
        meals: ['breakfast', 'lunch', 'dinner'].map(k => (text(d.meals?.[k]) || '-').slice(0, 60)),
    }));
    const lodges = assignmentsVisible ? days.filter((d: any) => d.accommodation?.name).map((d: any) => {
        const a = d.accommodation;
        return { day: d.day, name: text(a.name), region: typeof a.region === 'string' ? a.region : text(a.location), grade: text(a.type),
            img: documentImage(a.image || a.img) || photos(a.images)[0] || '', imgs: photos(a.images),
            desc: text(a.description), tags: text(a.tags), amenities: array(a.amenities), facilities: a.facilities,
            ...(Object.hasOwn(a, 'address') ? { address: text(a.address) } : {}),
            ...Object.fromEntries(['roomAmenities', 'sharedFacilities'].filter(field => Object.hasOwn(a, field))
                .map(field => [field, Array.isArray(a[field]) ? a[field].map(text).filter(Boolean).join('\n') : text(a[field])])) };
    }) : [];
    const breakdown = parseDocumentJson(r.price_breakdown, {});
    const total = amount(r.total_price ?? breakdown.total);
    const deposit = amount(r.deposit_amount ?? breakdown.deposit);
    const balance = amount(r.balance_amount ?? breakdown.local ?? Math.max(0, total - deposit));
    // Saved customer selections (including []) are authoritative. Only a document
    // without a selection field inherits the product's separate spot snapshots.
    const selectedSpots = Object.hasOwn(custom, 'highlights') ? custom.highlights
        : product?.representative_spots ?? product?.representativeSpots;
    const highlights = normalizeRepresentativeSpots(selectedSpots).map(h => ({
        name: text(h.name), nameMn: text(h.nameMn), desc: text(h.desc),
        img: documentImage(h.img), subImgs: photos(h.subImgs),
        ...(typeof h.short === 'string' ? { short: h.short } : {}),
        ...(typeof h.region === 'string' ? { region: h.region } : {}),
    }));
    return {
        source: 'product', brand, productName: text(r.product_name), quoteNo: text(r.reservation_number) || r.id,
        issueDate: dateKey(r.updated_at) || dateKey(r.created_at), manager: text(contract.manager) || '몽골리아 은하수',
        customer: text(r.customer_name), destination: text(contract.region) || text(product?.category) || text(r.product_name),
        pax: amount(r.travelers), paxNote: `${amount(r.travelers)}인`, nights: `${duration}박${duration + 1}일`,
        period: [start, end].filter(Boolean).join(' ~ '), periodShort: [start, end].filter(Boolean).join(' — '),
        vehicle: vehicle.model || '차량 배정 확인 중', flight: { in: flight(contract.arrival), out: flight(contract.departure) },
        pickup: text(contract.pickup) || '확인 중', drop: text(contract.drop) || '확인 중', benefits: '', events: [], remark: (text(custom.description) || '-').slice(0, 250),
        price: { total, deposit, balanceFinal: balance, options: [], balances: [],
            depositStatus: r.deposit_status === 'paid' ? '입금 확인 완료' : '입금 확인 중',
            balanceStatus: r.balance_status === 'paid' ? '결제 완료' : '현지 결제 예정',
            payment: '예약금: 계좌이체 · 잔금: 현지 현금 결제', paymentNote: '' },
        included, excluded, intensity: 0, days: itineraryDays, detailDays: days, highlights,
        refundRows: resolveCancellationRows(settings.contract?.cancellationRows),
        scheduleNotes: lines(settings.detail?.note),
        images: { cover: mainImages[0] || scheduleImages[0] || '', coverLabel: text(r.product_name) },
        booking: { assign: { guide: { name: text(guide.name), phone: text(guide.phone), img: documentImage(guide.image || guide.img),
            desc: text(guide.bio || guide.introduction), role: text(guide.role) }, vehicle, lodges } },
    };
}
