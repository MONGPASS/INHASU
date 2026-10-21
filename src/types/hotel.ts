// Hotel master record — reusable across products and reservations.
// Stored as a snapshot at pick-time (id + denormalized name) in
// product itineraries so historical data survives master edits/deletions.
export interface Hotel {
    id: string;
    code?: string;           // Internal short code (e.g., HS40530)
    name_kr: string;         // 한글 명칭 (필수)
    name_local?: string;     // 현지/영문 명칭
    country?: string;        // 국가 (e.g., 싱가포르)
    city?: string;           // 도시
    region?: string;         // 지역 (e.g., 아시아)
    star_rating?: number;    // 1~5
    address?: string;
    latitude?: number | null;
    longitude?: number | null;
    description?: string;
    website?: string;
    images?: string[];
    amenities?: string[];    // ["수영장", "사우나", ...]
    /** 공통 숙소 리소스에서 선택할 때 사용하는 공개 정보 스냅샷. */
    grade?: string;
    type?: string;
    occupancy?: string;
    roomAmenities?: string[];
    sharedFacilities?: string[];
    is_active?: boolean;
    created_at?: string;
    updated_at?: string;
}
