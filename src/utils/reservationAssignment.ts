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
export interface AssignmentVehicle { type: string; phone: string }

export function readProductVehicle(operations: unknown, contractData: unknown): AssignmentVehicle {
    const ops = assignmentRecord(operations), rawVehicle = assignmentRecord(contractData).vehicle, vehicle = assignmentRecord(rawVehicle);
    return {
        type: own(ops, 'vehicle') ? string(ops.vehicle) : typeof rawVehicle === 'string' ? rawVehicle : string(vehicle.type ?? vehicle.model ?? vehicle.name),
        phone: own(ops, 'driverPhone') ? string(ops.driverPhone) : string(vehicle.phone ?? vehicle.driverPhone),
    };
}

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
    operations.vehicle = next.type; operations.driverPhone = next.phone;
    const metadata = next.type === old.type ? assignmentRecord(assignmentRecord(currentContract).vehicle) : {};
    contractData.vehicle = { ...metadata, ...(vehiclePatch || {}), type: next.type, model: next.type, phone: next.phone };
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
export interface AssignmentGuide { id?: string; name?: string; phone?: string; image?: string; [key: string]: unknown }
export interface AssignmentAccommodation {
    day: number; date?: string;
    accommodation: { id?: string; name?: string; type?: string; location?: string; images?: string[]; description?: string; facilities?: string[]; roomCount?: number; occupancy?: string; bookingStatus?: string; [key: string]: unknown };
}
export interface BookingAssignment { guide: AssignmentGuide; vehicle: AssignmentVehicle; accommodations: AssignmentAccommodation[] }
export const assignmentKey = (source: AssignmentSource, id: string) => `${source}:${id}`;
