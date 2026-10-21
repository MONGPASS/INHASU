import { assignmentKey, assignmentRecord, readProductVehicle, syncProductVehicle, type AssignmentSource, type BookingAssignment } from '../../src/utils/reservationAssignment.ts';
import { isQuoteBooking, summarizeQuoteBooking } from './quoteBookings.ts';
import { toTourDateKey } from '../../src/utils/formatDate.ts';
import { assignmentScheduleCas, createAssignmentScheduleReader, type AssignmentScheduleRead } from './assignmentSchedule.ts';

const own = (v: object, k: string) => Object.prototype.hasOwnProperty.call(v, k);
const text = (v: unknown) => typeof v === 'string' ? v : '';
const array = (v: any): any[] => Array.isArray(v) ? v : [];
const parseArray = (v: any): any[] => { try { return array(typeof v === 'string' ? JSON.parse(v) : v); } catch { return []; } };
const quoteData = (value: unknown): Record<string, any> | null => {
    try { const data = typeof value === 'string' ? JSON.parse(value) : value; return data && typeof data === 'object' && !Array.isArray(data) ? data : null; } catch { return null; }
};
const flight = (value: unknown) => { const f = assignmentRecord(value); return { date: text(f.date), time: text(f.time), flight: text(f.flight) }; };
const travelers = (value: unknown) => array(value).map(t => ({ name: text(t?.name ?? t?.nameKo), passportName: text(t?.passportName), birthdate: text(t?.birthdate ?? t?.birth), gender: text(t?.gender), phone: text(t?.phone) }));
const GUIDE_FIELDS = ['id','name','phone','image','introduction','nameEn','role','languages','specialties'];
const ACCOMMODATION_FIELDS = ['id','name','type','location','region','address','images','description','facilities','roomAmenities','sharedFacilities','bookingStatus','roomCount','occupancy'];
const VEHICLE_RESOURCE_FIELDS = ['id','img','images','description','seats','luggage'];
const selectedGuide = (value: unknown) => {
    const guide = assignmentRecord(value);
    return { id: text(guide.id), name: text(guide.name), phone: text(guide.phone),
        ...Object.fromEntries(GUIDE_FIELDS.slice(3).filter(key => own(guide,key)).map(key => [key, guide[key]])),
        ...(!own(guide, 'image') && own(guide, 'img') ? { image: text(guide.img) } : {}),
        ...(!own(guide, 'introduction') && (own(guide, 'desc') || own(guide, 'bio')) ? { introduction: text(guide.bio ?? guide.desc) } : {}),
    };
};
const selectedVehicleResource = (value: unknown) => {
    const vehicle = assignmentRecord(value);
    if (![...VEHICLE_RESOURCE_FIELDS,'image','imgs','desc'].some(key => own(vehicle,key))) return {};
    return { resource: { id: text(vehicle.id), img: text(vehicle.img ?? vehicle.image),
        images: array(vehicle.images ?? vehicle.imgs).map(text).filter(Boolean), description: text(vehicle.description ?? vehicle.desc),
        seats: typeof vehicle.seats === 'number' ? String(vehicle.seats) : text(vehicle.seats), luggage: text(vehicle.luggage) } };
};
const mergeSelectedGuide = (previous: unknown, next: BookingAssignment['guide']) => {
    const old = assignmentRecord(previous), same = next.id ? next.id === text(old.id) : next.name === text(old.name);
    return { ...old, ...(!same ? { image: '', img: '', introduction: '', bio: '', desc: '', nameEn: '', role: '', languages: [], specialties: [], qr: '' } : {}),
        ...next, ...(own(next,'image') ? { img: next.image } : {}),
        ...(own(next,'introduction') ? { bio: next.introduction, desc: next.introduction } : {}) };
};
const vehicleResourcePatch = (vehicle: BookingAssignment['vehicle']) => vehicle.resource ? {
    id: text(vehicle.resource.id), img: text(vehicle.resource.img), image: text(vehicle.resource.img),
    images: array(vehicle.resource.images).map(text).filter(Boolean), imgs: array(vehicle.resource.images).map(text).filter(Boolean),
    description: text(vehicle.resource.description), desc: text(vehicle.resource.description),
    seats: text(vehicle.resource.seats), luggage: text(vehicle.resource.luggage),
} : null;
const publicDays = (value: any) => parseArray(value).filter(d => d && typeof d === 'object').map(d => {
    const acc = assignmentRecord(d.accommodation), selected: Record<string, any> = {};
    for (const key of ACCOMMODATION_FIELDS) if (own(acc,key)) selected[key] = acc[key];
    return { day: Number(d.day), date: text(d.date), accommodation: selected };
});
async function version(source: AssignmentSource, row: any, schedule: AssignmentScheduleRead) {
    const bytes = new TextEncoder().encode(JSON.stringify(source === 'product'
        ? [row.start_date, row.end_date, row.status, row.assigned_guide, row.daily_accommodations, row.contract_data, row.admin_operations,
            row.document_content, row.product_id, row.itinerary_template_id, schedule.revision]
        : [row.data, row.status, schedule.revision]));
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}

export async function assignmentFromRow(source: AssignmentSource, row: any, readSchedule = createAssignmentScheduleReader()) {
    const schedule = await readSchedule(source, row);
    const rowVersion = await version(source, row, schedule);
    if (source === 'product') {
        const contract = assignmentRecord(row.contract_data), guide = assignmentRecord(row.assigned_guide);
        return { key: assignmentKey(source, row.id), source, id: row.id, version: rowVersion, type: row.type, schedule: schedule.schedule,
            productName: row.product_name || '', customerName: row.customer_name || '', startDate: toTourDateKey(row.start_date), endDate: toTourDateKey(row.end_date),
            status: row.status, depositStatus: row.deposit_status, travelers: row.travelers, reservationNumber: row.reservation_number,
            accommodationsInitialized: row.daily_accommodations != null,
            contractData: { region: text(contract.region), category: text(contract.category), arrival: flight(contract.arrival), departure: flight(contract.departure), travelers: travelers(contract.travelers) },
            assignment: { guide: selectedGuide(guide), vehicle: { ...readProductVehicle(row.admin_operations, contract), ...selectedVehicleResource(contract.vehicle) }, accommodations: publicDays(row.daily_accommodations) },
        };
    }
    const data = quoteData(row.data); if (!data) throw new Error('Invalid quote source');
    const rec = { ...data, id: row.id, status: row.status }, summary = summarizeQuoteBooking(rec);
    const assign = assignmentRecord(rec.booking?.assign), guide = assignmentRecord(assign.guide), vehicle = assignmentRecord(assign.vehicle);
    return { key: assignmentKey(source, row.id), source, id: row.id, version: rowVersion, type: 'quote_booking', schedule: schedule.schedule,
        productName: summary.productName, customerName: summary.customerName, startDate: toTourDateKey(summary.startDate), endDate: toTourDateKey(summary.endDate),
        status: summary.status, depositStatus: summary.depositStatus, travelers: summary.totalPeople, reservationNumber: summary.reservationNumber,
        accommodationsInitialized: Array.isArray(assign.lodges),
        contractData: { ...summary.contractData, travelers: travelers(rec.booking?.travelers) },
        assignment: { guide: selectedGuide(guide),
            vehicle: { type: text(vehicle.model ?? vehicle.type), phone: text(vehicle.phone ?? vehicle.driverPhone), ...selectedVehicleResource(vehicle) },
            accommodations: array(assign.lodges).map((l: any, i: number) => ({ day: l.day === undefined ? i + 1 : Number.isFinite(Number(l.day)) ? Number(l.day) : 0, date: text(l.date), accommodation: {
                id: text(l.id), name: text(l.name), type: text(l.grade), location: text(l.region),
                ...Object.fromEntries(['address','roomAmenities','sharedFacilities'].filter(key => own(l,key)).map(key => [key,
                    key === 'address' ? text(l[key]) : Array.isArray(l[key]) ? l[key].map(text).filter(Boolean) : text(l[key]).split(/[\r\n,·|]+/).map((part: string) => part.trim()).filter(Boolean)])),
                region: text(l.region),
                images: array(l.imgs).length ? array(l.imgs) : l.img ? [l.img] : [], description: text(l.descCustom ?? l.desc), facilities: array(l.facilities),
                bookingStatus: text(l.bookingStatus), roomCount: l.roomCount === '' || l.roomCount == null ? undefined : Number(l.roomCount), occupancy: text(l.occupancy ?? l.roomType),
            } })),
        },
    };
}

/** Only assignment fields cross this endpoint. It never accepts booking/status/contract/accounting patches. */
export function validateBookingAssignment(value: unknown): BookingAssignment | null {
    const v = assignmentRecord(value);
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(v).some(k => !['guide','vehicle','accommodations'].includes(k))) return null;
    try { if (JSON.stringify(value).length > 2_000_000) return null; } catch { return null; }
    if (!v.guide || typeof v.guide !== 'object' || Array.isArray(v.guide) || !v.vehicle || typeof v.vehicle !== 'object' || Array.isArray(v.vehicle) || !Array.isArray(v.accommodations) || v.accommodations.length > 100) return null;
    const guide = assignmentRecord(v.guide), vehicle = assignmentRecord(v.vehicle);
    if (Object.keys(guide).some(k => !GUIDE_FIELDS.includes(k)) || Object.keys(vehicle).some(k => !['type','phone','resource'].includes(k))) return null;
    const validText = (x: any, max = 500) => x === undefined || (typeof x === 'string' && x.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x));
    const validPicture = (x: any) => {
        if (x === undefined || x === '') return true;
        if (!validText(x, 2000) || /[\u0000-\u0020\\]/.test(x) || x.startsWith('//')) return false;
        try {
            const url = new URL(x, 'https://assignment-image.invalid/');
            return /^https?:$/.test(url.protocol) && !url.username && !url.password
                && !/^\/(?:api\/file(?:\/|$)|api\/img\/uploads(?:\/|$)|uploads(?:\/|$))/i.test(decodeURIComponent(url.pathname));
        } catch { return false; }
    };
    const validList = (x: any, picture = false, max = 2000) => x === undefined || (Array.isArray(x) && x.length <= 50 && x.every(entry =>
        typeof entry === 'string' && validText(entry, max) && (!picture || validPicture(entry))));
    if (!['id','name','phone','nameEn','role'].every(k => validText(guide[k])) || !validText(guide.introduction, 10000) || !validPicture(guide.image)
        || !['languages','specialties'].every(k => validList(guide[k], false, 500)) || !['type','phone'].every(k => validText(vehicle[k]))) return null;
    if (vehicle.resource !== undefined) {
        const resource = assignmentRecord(vehicle.resource);
        if (!vehicle.resource || typeof vehicle.resource !== 'object' || Array.isArray(vehicle.resource)
            || Object.keys(resource).some(k => !VEHICLE_RESOURCE_FIELDS.includes(k))
            || !['id','seats','luggage'].every(k => validText(resource[k])) || !validText(resource.description, 10000)
            || !validPicture(resource.img) || !validList(resource.images, true)) return null;
    }
    const days = new Set<number>();
    for (const day of v.accommodations) {
        if (!day || typeof day !== 'object' || Array.isArray(day) || Object.keys(day).some(k => !['day','date','accommodation'].includes(k)) ||
            !Number.isInteger(day.day) || day.day < 1 || day.day > 100 || days.has(day.day) || !validText(day.date, 10) ||
            (day.date && (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !Number.isFinite(Date.parse(day.date)) || new Date(day.date).toISOString().slice(0,10) !== day.date))) return null;
        days.add(day.day);
        const acc = assignmentRecord(day.accommodation);
        if (!day.accommodation || Array.isArray(day.accommodation) || Object.keys(acc).some(k => !ACCOMMODATION_FIELDS.includes(k))) return null;
        if (!['id','name','type','location','region','address','description','occupancy','bookingStatus'].every(k => validText(acc[k], k === 'description' ? 10000 : 500))) return null;
        if (!validList(acc.images, true) || !['facilities','roomAmenities','sharedFacilities'].every(k => validList(acc[k]))) return null;
        if (acc.roomCount !== undefined && (!Number.isInteger(acc.roomCount) || acc.roomCount < 0 || acc.roomCount > 10000)) return null;
    }
    return { guide: selectedGuide(guide), vehicle: { type: text(vehicle.type), phone: text(vehicle.phone),
        ...(vehicle.resource !== undefined ? { resource: vehicle.resource } : {}) }, accommodations: v.accommodations };
}

export async function readAdminAssignments(db: any) {
    const items: any[] = [], warnings: string[] = [];
    const readSchedule = createAssignmentScheduleReader(db);
    const results = await Promise.allSettled([
        Promise.resolve().then(() => db.prepare('SELECT * FROM reservations ORDER BY start_date,id').all()),
        Promise.resolve().then(() => db.prepare('SELECT id,status,data FROM requests ORDER BY received_at DESC').all()),
    ]);
    for (const [index, result] of results.entries()) {
        if (result.status !== 'fulfilled') { warnings.push(index ? '견적 예약을 불러오지 못했습니다.' : '상품 예약을 불러오지 못했습니다.'); continue; }
        for (const row of result.value.results || []) {
            try {
                if (index) { const data = quoteData(row.data); if (!data) throw new Error('Invalid quote source'); if (!isQuoteBooking({ ...data, status: row.status })) continue; }
                items.push(await assignmentFromRow(index ? 'quote_booking' : 'product', row, readSchedule));
            } catch { warnings.push('읽을 수 없는 예약이 있습니다. 해당 원본을 확인해 주세요.'); }
        }
    }
    return { items, warnings, availability: { product: results[0].status === 'fulfilled', quote_booking: results[1].status === 'fulfilled' } };
}

export async function saveAdminAssignment(db: any, source: AssignmentSource, id: string, expectedVersion: string, assignment: BookingAssignment) {
    const table = source === 'product' ? 'reservations' : 'requests';
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();
    if (row && source === 'quote_booking' && !quoteData(row.data)) return { status: 409, error: '견적 원본을 읽을 수 없습니다. 기존 예약 관리에서 원본을 확인해 주세요.' };
    if (!row || (source === 'quote_booking' && !isQuoteBooking({ ...assignmentRecord(row.data), status: row.status }))) return { status: 404, error: '예약을 찾을 수 없습니다.' };
    const schedule = await createAssignmentScheduleReader(db)(source, row);
    if (schedule.schedule.source === 'unavailable') return { status: 409, error: '고객 일정 원본을 읽지 못했습니다. 초안을 보관하고 고객 일정 원본을 확인한 뒤 다시 저장해 주세요.' };
    if (expectedVersion !== await version(source, row, schedule)) return { status: 409, error: '다른 곳에서 예약이나 고객 일정이 변경되었습니다. 초안을 보관한 뒤 최신 예약을 다시 불러와 주세요.' };
    const scheduleCas = assignmentScheduleCas(schedule.guards);
    let result: any;
    if (source === 'product') {
        const resource = vehicleResourcePatch(assignment.vehicle);
        const sync = syncProductVehicle(row.admin_operations, row.contract_data, {
            operations: { vehicle: assignment.vehicle.type, driverPhone: assignment.vehicle.phone },
            ...(resource ? { contractData: { ...assignmentRecord(row.contract_data), vehicle: { ...resource, type: assignment.vehicle.type, phone: assignment.vehicle.phone } } } : {}),
        });
        const guide = mergeSelectedGuide(row.assigned_guide, assignment.guide);
        const oldDays = parseArray(row.daily_accommodations);
        const days = assignment.accommodations.map(d => {
            const previous = oldDays.find((x: any) => x.day === d.day), old = assignmentRecord(previous?.accommodation);
            const same = d.accommodation.id ? d.accommodation.id === old.id : d.accommodation.name === old.name;
            return { ...previous, ...d, accommodation: { ...old, ...(!same ? { image: '', img: '', amenities: [] } : {}), ...d.accommodation } };
        });
        result = await db.prepare(`UPDATE reservations SET assigned_guide=?,daily_accommodations=?,admin_operations=?,contract_data=?
            WHERE id=? AND assigned_guide IS ? AND daily_accommodations IS ? AND admin_operations IS ? AND contract_data IS ? AND start_date IS ? AND end_date IS ? AND status IS ?
                AND document_content IS ? AND product_id IS ? AND itinerary_template_id IS ?${scheduleCas.sql}`)
            .bind(JSON.stringify(guide), JSON.stringify(days), JSON.stringify(sync.operations), JSON.stringify(sync.contractData), id,
                row.assigned_guide, row.daily_accommodations, row.admin_operations, row.contract_data, row.start_date, row.end_date, row.status,
                row.document_content, row.product_id, row.itinerary_template_id, ...scheduleCas.values).run();
    } else {
        const rec = assignmentRecord(row.data), booking = assignmentRecord(rec.booking), old = assignmentRecord(booking.assign);
        const oldLodges = array(old.lodges);
        const lodges = assignment.accommodations.map(d => {
            const acc = d.accommodation, previous = oldLodges.find((l: any) => Number(l.day) === d.day) || {};
            const same = acc.id ? acc.id === previous.id : acc.name === previous.name;
            return { ...previous, ...(!same ? { tags: '', amenities: [] } : {}), day: d.day, date: d.date || '', id: acc.id || '', name: acc.name || '', grade: acc.type || '', region: typeof acc.region === 'string' ? acc.region : acc.location || '',
                imgs: acc.images || [], img: acc.images?.[0] || '', desc: acc.description || '', descCustom: acc.description || '', facilities: acc.facilities || [],
                representativePhotos: acc.images || [],
                ...Object.fromEntries(['address','roomAmenities','sharedFacilities'].filter(key => own(acc,key)).map(key => [key,
                    key === 'address' ? text(acc[key]) : array(acc[key]).map(text).filter(Boolean).join('\n')])),
                bookingStatus: acc.bookingStatus || '', roomCount: acc.roomCount ?? '', occupancy: acc.occupancy || '', roomType: acc.occupancy || '' };
        });
        const previousVehicle = assignmentRecord(old.vehicle), sameVehicle = text(previousVehicle.model ?? previousVehicle.type) === assignment.vehicle.type;
        const updated = { ...rec, booking: { ...booking, assign: { ...old, guide: mergeSelectedGuide(old.guide, assignment.guide),
            vehicle: { ...previousVehicle, ...(!sameVehicle ? { id: '', image: '', img: '', images: [], imgs: [], description: '', desc: '', seats: '', luggage: '' } : {}),
                ...(vehicleResourcePatch(assignment.vehicle) || {}), model: assignment.vehicle.type, type: assignment.vehicle.type, phone: assignment.vehicle.phone }, lodges } } };
        result = await db.prepare('UPDATE requests SET data=? WHERE id=? AND data IS ? AND status IS ?').bind(JSON.stringify(updated), id, row.data, row.status).run();
    }
    if (result.meta?.changes !== 1) return { status: 409, error: '저장 직전에 예약이 변경되었습니다. 최신 예약을 확인한 뒤 다시 저장해 주세요.' };
    return { status: 200, item: await assignmentFromRow(source, await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first(), createAssignmentScheduleReader(db)) };
}
