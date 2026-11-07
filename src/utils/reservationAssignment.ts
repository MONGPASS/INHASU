/** Shared read rules for the two legacy vehicle fields. Explicit empty values clear an assignment. */
export const assignmentRecord = (value: unknown): Record<string, any> => {
    let current = value;
    for (let i = 0; i < 3 && typeof current === 'string'; i++) {
        try { current = JSON.parse(current); } catch { return {}; }
    }
    return current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, any> : {};
};
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const string = (value: unknown): string => typeof value === 'string' ? value : '';
export interface AssignmentVehicleResource {
    id?: string; img?: string; images?: string[]; description?: string; seats?: string; luggage?: string;
}
/** driver: 차량 기사 이름(관리자·가이드 문서 전용, 고객 화면에는 내보내지 않는다) */
export interface AssignmentVehicle { type: string; phone: string; driver?: string; resource?: AssignmentVehicleResource }

export function readProductVehicle(operations: unknown, contractData: unknown): AssignmentVehicle {
    const ops = assignmentRecord(operations), rawVehicle = assignmentRecord(contractData).vehicle, vehicle = assignmentRecord(rawVehicle);
    return {
        type: own(ops, 'vehicle') ? string(ops.vehicle) : typeof rawVehicle === 'string' ? rawVehicle : string(vehicle.type ?? vehicle.model ?? vehicle.name),
        phone: own(ops, 'driverPhone') ? string(ops.driverPhone) : string(vehicle.phone ?? vehicle.driverPhone),
        ...driverOf(ops, vehicle),
    };
}
const driverOf = (ops: Record<string, any>, vehicle: Record<string, any>) => {
    const driver = own(ops, 'driverName') ? string(ops.driverName) : string(vehicle.driver ?? vehicle.driverName);
    return driver ? { driver } : {};
};

/** Server callers persist both results in one conditional UPDATE. Private fields stay private. */
export function syncProductVehicle(currentOperations: unknown, currentContract: unknown, patch: { operations?: unknown; contractData?: unknown }) {
    const operations = { ...assignmentRecord(currentOperations), ...assignmentRecord(patch.operations) };
    const contractData = patch.contractData === undefined ? { ...assignmentRecord(currentContract) } : { ...assignmentRecord(patch.contractData) };
    const incomingOps = assignmentRecord(patch.operations), incomingContract = assignmentRecord(patch.contractData);
    const old = readProductVehicle(currentOperations, currentContract);
    const vehiclePatch = own(incomingContract, 'vehicle') ? assignmentRecord(incomingContract.vehicle) : null;
    const next = {
        type: own(incomingOps, 'vehicle') ? string(incomingOps.vehicle) : vehiclePatch !== null ? string(vehiclePatch.type ?? vehiclePatch.model ?? vehiclePatch.name) : old.type,
        phone: own(incomingOps, 'driverPhone') ? string(incomingOps.driverPhone) : vehiclePatch !== null ? string(vehiclePatch.phone ?? vehiclePatch.driverPhone) : old.phone,
    };
    // 기사 이름: 보낸 값이 있으면 그 값, 없으면 같은 차량일 때만 이전 기사를 이어 쓴다(차량을 바꾸면 비운다).
    const driverPatch = own(incomingOps, 'driverName') ? string(incomingOps.driverName)
        : vehiclePatch !== null && (own(vehiclePatch, 'driver') || own(vehiclePatch, 'driverName')) ? string(vehiclePatch.driver ?? vehiclePatch.driverName) : undefined;
    const driver = driverPatch ?? (next.type === old.type ? old.driver || '' : '');
    operations.vehicle = next.type; operations.driverPhone = next.phone;
    if (driver) operations.driverName = driver; else delete operations.driverName;
    const metadata = next.type === old.type ? assignmentRecord(assignmentRecord(currentContract).vehicle) : {};
    const vehicle: Record<string, any> = { ...metadata, ...(vehiclePatch || {}), type: next.type, model: next.type, phone: next.phone };
    delete vehicle.driverName; if (driver) vehicle.driver = driver; else delete vehicle.driver;
    contractData.vehicle = vehicle;
    return { operations, contractData };
}

export function publicAssignmentContract(value: unknown) {
    const contract = { ...assignmentRecord(value) };
    if (own(contract, 'vehicle')) {
        if (typeof contract.vehicle !== 'string') {
            const vehicle = assignmentRecord(contract.vehicle);
            // A customer document only needs the public vehicle presentation. New private
            // fields must not become public merely because an internal editor saved them.
            contract.vehicle = Object.fromEntries(['type','model','name','image','img','images','imgs','description','desc','seats','luggage']
                .filter(key => own(vehicle, key)).map(key => [key, vehicle[key]]));
        }
    }
    return contract;
}

export type AssignmentSource = 'product' | 'quote_booking';
export interface AssignmentGuide {
    id?: string; name?: string; phone?: string; image?: string; introduction?: string; nameEn?: string; role?: string;
    languages?: string[]; specialties?: string[]; [key: string]: unknown;
}
export interface AssignmentAccommodation {
    day: number; date?: string;
    accommodation: { id?: string; name?: string; type?: string; location?: string; region?: string; address?: string;
        images?: string[]; description?: string; facilities?: string[]; roomAmenities?: string[]; sharedFacilities?: string[];
        roomCount?: number; occupancy?: string; bookingStatus?: string;
        /** 숙소 배정 시트 P열(배정 구분) */ assignType?: string;
        /** 숙소 배정 시트 S열(예약메모). 관리자 전용 — 고객 응답에 넣지 않는다 */ adminMemo?: string;
        [key: string]: unknown };
}
/** category: 숙소 배정 시트 G열(분류). 보내지 않으면 기존 값을 바꾸지 않는다. */
export interface BookingAssignment { guide: AssignmentGuide; vehicle: AssignmentVehicle; accommodations: AssignmentAccommodation[]; category?: string }
export const assignmentKey = (source: AssignmentSource, id: string) => `${source}:${id}`;
