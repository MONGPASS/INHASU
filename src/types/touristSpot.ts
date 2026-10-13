// Tourist spot master record — reusable across timeline blocks.
// When picked from the picker modal, fills a timeline block's
// title / description / images in one click.
/**
 * Region/category tag — used so the admin can filter the spot library
 * when picking from the timeline editor. Despite the name "region", it
 * also covers non-geographic categories (experience, food) because the
 * picker is also used for those types of timeline entries.
 *
 * Empty string = uncategorized (legacy rows or admin chose not to set).
 */
export type SpotRegion =
    | 'central'      // 중앙몽골
    | 'gobi'         // 고비사막
    | 'hovsgol'      // 홉스굴
    | 'ulaanbaatar'  // 울란바타르 (수도, 도시 명소)
    | 'experience'   // 체험 (액티비티, 문화 체험)
    | 'food'         // 음식 (현지 음식, 레스토랑)
    | '';

export const SPOT_REGION_OPTIONS: { value: SpotRegion; label: string }[] = [
    { value: 'central', label: '중앙몽골' },
    { value: 'gobi', label: '고비사막' },
    { value: 'hovsgol', label: '홉스굴' },
    { value: 'ulaanbaatar', label: '울란바타르' },
    { value: 'experience', label: '체험' },
    { value: 'food', label: '음식' },
];

export interface TouristSpot {
    id: string;
    name_kr: string;         // 대제목 (필수, 일정 제목으로 들어감)
    name_local?: string;     // 소제목 (일정 카드 부제목)
    address?: string;
    description?: string;    // 일정 설명으로 들어감
    images?: string[];       // 일정 이미지로 들어감
    region?: SpotRegion;     // 중앙몽골/고비사막/홉스굴 분류 (빈 문자열 = 미분류)
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
}
