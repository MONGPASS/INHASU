// Shared travel destination record — reusable across timeline blocks.
// When picked from the picker modal, fills a timeline block's
// title / description / images in one click.
/**
 * Region/category tag — used so the admin can filter the spot library
 * when picking from the timeline editor. Despite the name "region", it
 * also covers non-geographic categories (experience, food) because the
 * picker is also used for those types of timeline entries.
 *
 * New categories come directly from 여행지 관리. Existing English keys remain
 * display aliases so older saved categories still appear in Korean.
 * Empty string = uncategorized.
 */
export type SpotRegion = string;

export const SPOT_REGION_OPTIONS: { value: SpotRegion; label: string }[] = [
    { value: 'central', label: '중앙몽골' },
    { value: 'gobi', label: '고비사막' },
    { value: 'hovsgol', label: '홉스굴' },
    { value: 'ulaanbaatar', label: '울란바타르' },
    { value: 'experience', label: '체험' },
    { value: 'food', label: '음식' },
];

export function touristSpotRegionLabel(region?: SpotRegion | null): string {
    const value = typeof region === 'string' ? region.trim() : '';
    return SPOT_REGION_OPTIONS.find(option => option.value === value)?.label || value;
}

/** null means every category; the empty string is the real uncategorized group. */
export function touristSpotRegionGroups(spots: readonly TouristSpot[]): { value: string | null; label: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const spot of spots) {
        const category = touristSpotRegionLabel(spot.region);
        counts.set(category, (counts.get(category) || 0) + 1);
    }
    return [{ value: null, label: '전체', count: spots.length }, ...Array.from(counts)
        .sort(([a], [b]) => a ? b ? a.localeCompare(b, 'ko-KR') : -1 : 1)
        .map(([value, count]) => ({ value, label: value || '미분류', count }))];
}

export interface TouristSpot {
    id: string;
    name_kr: string;         // 대제목 (필수, 일정 제목으로 들어감)
    name_local?: string;     // 소제목 (일정 카드 부제목)
    address?: string;
    description?: string;    // 일정 설명으로 들어감
    images?: string[];       // 일정 이미지로 들어감
    region?: SpotRegion;     // 여행지 관리에 저장한 지역·분류 (빈 문자열 = 미분류)
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
}
