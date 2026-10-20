import type { Hotel } from '../types/hotel';

/** Documents own their copied information; later resource edits never rewrite existing itineraries. */
export function productLodgingSnapshot(hotel: Hotel) {
    return {
        accommodation: hotel.name_kr,
        accommodationHotelId: hotel.id,
        accommodationImages: [...(hotel.images || [])],
        accommodationDescription: hotel.description || '',
        accommodationAddress: hotel.address || '',
        accommodationSubtitle: hotel.name_local || '',
        accommodationAmenities: [...(hotel.amenities || [])],
        accommodationType: hotel.grade || hotel.type || (hotel.star_rating ? `${hotel.star_rating}성급 호텔` : ''),
        accommodationRegion: hotel.region || '',
        accommodationOccupancy: hotel.occupancy || '',
        accommodationRoomAmenities: [...(hotel.roomAmenities || [])],
        accommodationSharedFacilities: [...(hotel.sharedFacilities || [])],
    };
}

export function documentLodgingSnapshot(hotel: Hotel) {
    return {
        id: hotel.id,
        name: hotel.name_kr,
        type: hotel.grade || hotel.type || (hotel.star_rating ? `${hotel.star_rating}성급 호텔` : ''),
        location: hotel.address || hotel.region || '',
        address: hotel.address || '',
        region: hotel.region || '',
        occupancy: hotel.occupancy || '',
        images: [...(hotel.images || [])],
        description: hotel.description || '',
        facilities: [...(hotel.amenities || [])],
        roomAmenities: [...(hotel.roomAmenities || [])],
        sharedFacilities: [...(hotel.sharedFacilities || [])],
    };
}

export function lodgingTimelineSnapshot(hotel: Hotel, current: { description?: string; images?: string[] }) {
    const detail = [hotel.description, hotel.grade || hotel.type, hotel.address, hotel.amenities?.join(' · ')].filter(Boolean).join('\n\n');
    const commonLodge = hotel.id.startsWith('resource-lodge:');
    return { title: hotel.name_kr, description: commonLodge ? detail : detail || current.description,
        images: commonLodge ? [...(hotel.images || [])] : hotel.images?.length ? [...hotel.images] : current.images };
}
