import type { TouristSpot } from '../types/touristSpot';

/** Copy only itinerary content; an empty photo/description selection stays empty. */
export function travelSpotSnapshot(spot: TouristSpot) {
    return {
        title: spot.name_kr,
        description: [spot.description, spot.address].filter(Boolean).join('\n\n'),
        images: Array.isArray(spot.images) ? [...spot.images] : [],
    };
}
