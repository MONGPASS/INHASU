export const SEO_CONSTANTS = {
    TITLE: "몽골 여행·몽골 투어 전문 현지 여행사 | 몽골리아 은하수",
    DESCRIPTION: "몽골 현지 여행사 몽골리아 은하수의 몽골 여행·투어. 고비사막, 테를지, 홉스굴, 승마 여행을 한국어 가이드와 함께하세요. 상품별 일정·원화 가격과 맞춤 견적을 확인할 수 있습니다.",
    KEYWORDS: [
        "몽골 여행",
        "몽골 투어",
        "몽골 관광",
        "몽골 현지 여행사",
        "몽골 승마 여행",
        "몽골 여행 비용",
        "몽골 고비사막",
        "몽골 테를지",
        "몽골 홉스굴",
        "울란바토르 관광",
        "몽골 별밤 투어",
        "게르 숙박",
        "몽골리아 은하수"
    ].join(", "),
    SITE_URL: "https://mongolia-milkyway.com",
    // Existing public photo; the former /og-image.jpg did not exist.
    OG_IMAGE: "/img/home/1.webp"
};

/** Account, booking and customer document pages must never be indexed. */
export const isPrivateSeoPath = (pathname: string) =>
    /^\/(?:admin(?:\/|\.html|$)|admin-mobile|login(?:\/|$)|mypage(?:\/|$)|my-booking(?:\/|$)|reservation(?:\/|-|$)|payment(?:\/|$)|estimate(?:\/|-|$)|documents(?:\/|$)|chats(?:\/|$)|reviews\/write(?:\/|$)|travel-mates\/write(?:\/|$))/.test(pathname);

/** Both columns exist in some old databases. An explicit hidden flag wins. */
export const isPublishedMagazine = (row: { is_published?: unknown; is_active?: unknown }) => {
    const flags = [row.is_published, row.is_active].filter(value => value != null);
    return flags.length > 0 && flags.every(value => value === true || value === 1 || value === '1');
};
