/** Trip phase shared by the my page screens (PC and mobile). */

interface TripDates {
    start: string;
    end: string;
    status: string;
}

export type TripPhase = 'upcoming' | 'live' | 'past';

/** Where a reservation sits relative to `today` ("YYYY-MM-DD"); cancelled and completed trips count as past. */
export const tripPhase = (r: TripDates, today: string): TripPhase => {
    if (r.status === 'cancelled' || r.status === 'completed') return 'past';
    if (!r.start) return 'upcoming';
    if ((r.end || r.start) < today) return 'past';
    return r.start <= today ? 'live' : 'upcoming';
};
