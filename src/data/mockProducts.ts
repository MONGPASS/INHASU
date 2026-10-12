import type { TourProduct } from '../types/product';

const DEFAULT_FIELDS = {
    galleryImages: [],
    detailImages: [],
    itineraryImages: [],
    status: 'active' as const,
    isFeatured: false,
    highlights: [],
    included: [],
    excluded: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    viewCount: 0,
    bookingCount: 0
};

export const MOCK_PRODUCTS: TourProduct[] = [
    {
        ...DEFAULT_FIELDS,
        id: 'central-1',
        name: '테를지 & 카라코룸 투어',
        price: 850000,
        originalPrice: 950000,
        duration: '4박 5일',
        category: '중앙 몽골',
        mainImages: ['https://lh3.googleusercontent.com/aida-public/AB6AXuCViCzrsaryy2z22sZJjJC2yPok7E9fmP1eXTz5wxd0B9jW3b8ccHatM2GhE_PpfKvS4v62VtA9hKyqw0dGAuFEsBQax20AoO8MdCUXLg00zA8ODyeJZh-S9i4BUVoD3jx3bueEDMJeAJknjXRv9dg0xSf2FnfAZjPTTIHQoJm77_1r5C4ZlTxJWlzEkoI1s2BhdWPaYC11Q17j9_gAO2hS0gUFXxzfVl469Mp7kJGlkuZc39udLK16lJgqurk2l1VXHODjPbZ5gA'],
        isPopular: true,
        tags: ['역사', '초원', '인기']
    },
    {
        ...DEFAULT_FIELDS,
        id: 'central-2',
        name: '온천 힐링 7일 투어',
        price: 1120000,
        duration: '6박 7일',
        category: '중앙 몽골',
        mainImages: ['https://lh3.googleusercontent.com/aida-public/AB6AXuB4K20GMVq8yGSfTci46S9biO_u2LDuxENlWBxUuJ0nn-vXp0HxEwZMChpGwntz2L5VISAaVTO0C3Jwe-ONgJLNcItHgdmG8Zb9pp-1uACHde5HETQBqmxnKmhs57ApVVkSCA6Kd-ta5q_h0ExQ84FYSY6vbGnDKD5yCJn-muLZnWDQCVEXnPd4YHvkNxzeRZmK1PN9XDNxQ1qdNDHGzJNqUkknzlI6FflIQG7Tnf1tHDg5TqEB8Gp1IlcZiBunTStiUDAFZDa0zQ'],
        isPopular: true,
        tags: ['온천', '힐링', '가족 여행']
    },
    {
        ...DEFAULT_FIELDS,
        id: 'central-3',
        name: '엘승타사르해 미니 사막 체험',
        price: 700000,
        duration: '2박 3일',
        category: '중앙 몽골',
        mainImages: ['https://lh3.googleusercontent.com/aida-public/AB6AXuCa-lOI8hWg7jkEPE6aLpgULy46wN1zu_SdVj-gwNCoVza2ioMGm0cfT7njLma7CYQJ7YOCcomwafa5fKhJc9eO0hKtIafFHLoS9Vw_f3fyxGnxJkpkfUIBcpBSK8kb0onNzfKU-ImdlsG7T9ipvcqEVeiv0IkkaRjkNX43p7iWB42lYEVLHp-virwWcrmYH0R2SNXPmyNr-nNF55R-vs8rATJH09lIQgi22C3kyFBnx7gHhz_pjfvaFOI5i-SonHUBrrbuY_hnNQ'],
        isPopular: false,
        tags: ['사막', '낙타 체험']
    },
    {
        ...DEFAULT_FIELDS,
        id: 'central-4',
        name: '울란바토르 시내 + 테를지 승마',
        price: 650000,
        originalPrice: 700000,
        duration: '3박 4일',
        category: '중앙 몽골',
        mainImages: ['https://lh3.googleusercontent.com/aida-public/AB6AXuBD7uRymu-LzGzR84yG42fTq3Kx7U0GZzUe1QyK8q0X3kX6j7xC5gJ8v9w0T4y2r1sH3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4'],
        isPopular: false,
        tags: ['시티 투어', '승마']
    },
    {
        ...DEFAULT_FIELDS,
        id: 'gobi-1',
        name: '고비사막 별밤 투어',
        price: 450000,
        duration: '4박 5일',
        category: '고비사막',
        mainImages: ['https://lh3.googleusercontent.com/aida-public/AB6AXuB4K20GMVq8yGSfTci46S9biO_u2LDuxENlWBxUuJ0nn-vXp0HxEwZMChpGwntz2L5VISAaVTO0C3Jwe-ONgJLNcItHgdmG8Zb9pp-1uACHde5HETQBqmxnKmhs57ApVVkSCA6Kd-ta5q_h0ExQ84FYSY6vbGnDKD5yCJn-muLZnWDQCVEXnPd4YHvkNxzeRZmK1PN9XDNxQ1qdNDHGzJNqUkknzlI6FflIQG7Tnf1tHDg5TqEB8Gp1IlcZiBunTStiUDAFZDa0zQ'],
        isPopular: true,
        tags: ['별밤', '사막']
    },
    {
        ...DEFAULT_FIELDS,
        id: 'khuvsgul-1',
        name: '홉스굴 호수 힐링',
        price: 900000,
        duration: '5박 6일',
        category: '홉스굴',
        mainImages: ['https://lh3.googleusercontent.com/aida-public/AB6AXuBD7uRymu-LzGzR84yG42fTq3Kx7U0GZzUe1QyK8q0X3kX6j7xC5gJ8v9w0T4y2r1sH3n4o5p6q7r8s9t0u1v2w3x4y5z6A7B8C9D0E1F2G3H4I5J6K7L8M9N0O1P2Q3R4S5T6U7V8W9X0Y1Z2a3b4c5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z8A9B0C1D2E3F4G5H6I7J8K9L0M1N2O3P4Q5R6S7T8U9V0W1X2Y3Z4'],
        isPopular: true,
        tags: ['호수', '휴식']
    }
];
