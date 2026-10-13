import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

interface SpotRow {
    name_kr?: string;
    images?: unknown;
    is_active?: unknown;
}

/**
 * Photos from the admin-managed tourist spots, looked up by name keyword.
 * Decorative imagery (quote hero, destination cards, magazine header) uses this
 * so replacing a spot photo in the admin updates the page without a deploy.
 */
export function useSpotImages() {
    const { data: spots = [] } = useQuery<{ name: string; images: string[] }[]>({
        queryKey: ['touristSpots', 'images'],
        staleTime: 1000 * 60 * 30,
        queryFn: async () => {
            const data = await api.touristSpots.list();
            const rows: SpotRow[] = Array.isArray(data) ? data : [];
            return rows
                .filter((s) => s.is_active !== false && s.is_active !== 0)
                .map((s) => ({
                    // Match on the title only — taglines mention other places (e.g. 테를지's says 대초원).
                    name: s.name_kr || '',
                    images: Array.isArray(s.images) ? s.images.filter((x): x is string => typeof x === 'string' && x.length > 0) : [],
                }))
                .filter((s) => s.images.length > 0);
        },
    });

    /** First spot whose name contains any keyword; '' when nothing matches. */
    const pick = useCallback(
        (keywords: string[], index = 0) => {
            const spot = spots.find((s) => keywords.some((k) => s.name.includes(k)));
            return spot ? spot.images[Math.min(index, spot.images.length - 1)] : '';
        },
        [spots],
    );

    return { pick, ready: spots.length > 0 };
}
