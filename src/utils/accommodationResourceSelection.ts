import type { AssignmentAccommodation, AssignmentGuide, AssignmentVehicle } from './reservationAssignment';
import type { RegisteredGuide, RegisteredLodge, RegisteredVehicle } from './registeredAssignmentResources';

const text = (value: unknown): string => typeof value === 'string' ? value : '';
const list = (value: unknown): string[] => Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

/** Explicit selection copies only the assigned profile; previous contact and photos cannot leak into a different guide. */
export function selectResourceGuide(_current: AssignmentGuide | undefined, resource: RegisteredGuide): AssignmentGuide {
    return { id: resource.id, name: resource.name, phone: resource.phone, image: resource.image,
        introduction: resource.introduction, nameEn: resource.nameEn, role: resource.role,
        languages: [...resource.languages], specialties: [...resource.specialties] };
}

/** Selecting a vehicle fills its registered phone (including blank); subsequent manual phone edits remain ordinary assignment edits. */
export function selectResourceVehicle(_current: AssignmentVehicle | undefined, resource: RegisteredVehicle): AssignmentVehicle {
    const snapshot = resource.snapshot;
    // 등록 차량의 기사 이름을 함께 넣는다(없으면 비워 이전 차량의 기사가 남지 않게).
    return { type: resource.type, phone: resource.phone, driver: text(resource.driver), resource: {
        id: `resource-vehicle:${resource.name}`, img: text(snapshot.img), images: [...list(snapshot.images)],
        description: text(snapshot.description), seats: text(snapshot.seats), luggage: text(snapshot.luggage),
    } };
}

/** Day/room operations remain local to the booking. A different supplier must be confirmed afresh. */
export function selectResourceLodge(current: AssignmentAccommodation, resource: RegisteredLodge): AssignmentAccommodation {
    const previous = current.accommodation;
    const same = previous.id ? previous.id === resource.id : previous.name === resource.name;
    return { day: current.day, ...(Object.hasOwn(current, 'date') ? { date: current.date } : {}), accommodation: {
        id: resource.id, name: resource.name, type: resource.type, location: resource.location, region: resource.region, address: resource.address,
        images: [...resource.images], description: resource.description, facilities: [...resource.facilities],
        roomAmenities: [...resource.roomAmenities], sharedFacilities: [...resource.sharedFacilities],
        ...(Object.hasOwn(previous, 'roomCount') ? { roomCount: previous.roomCount } : {}),
        occupancy: text(previous.occupancy).trim() ? previous.occupancy : resource.occupancy,
        bookingStatus: same ? previous.bookingStatus : 'Илгээгээгүй',
    } };
}
