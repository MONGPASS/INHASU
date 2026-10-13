import Dexie, { type Table } from 'dexie';

export interface AdminQuote {
    id: string; // "BQ-..."
    type: string;
    status: string;
    date: string;
    name: string;
    headcount: string;
    period: string;
    phone: string;
    email: string;
    attachment?: File | Blob;
    [key: string]: any;
}



export interface RecentlyViewed {
    id: string; // product ID
    productName: string;
    productImage?: string;
    category?: string;
    price?: number;
    viewedAt: string; // ISO timestamp
}

export interface Wishlist {
    id: string; // product ID
    productName: string;
    productImage?: string;
    category?: string;
    price?: number;
    addedAt: string; // ISO timestamp
}

export interface Settings {
    id: string; // e.g., 'company', etc.
    [key: string]: any;
}

export interface FAQ {
    id: string;
    category: string; // dynamic category from FAQCategory
    question: string;
    answer: string;
    viewCount: number;
    order: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface FAQCategory {
    id: string;
    name: string;
    order: number;
    isActive: boolean;
}

export interface TravelMate {
    id: string;
    status: 'recruiting' | 'closed';
    title: string;
    description: string;
    startDate: string;
    endDate: string;
    duration: string;
    region: string;
    tags: string[];
    recruitCount: number;
    gender: string;
    ageGroups: string[];
    styles: string[];
    image: string;
    authorId: string;
    authorName: string;
    authorInfo: string;
    authorImage: string;
    views: number;
    comments: number;
    createdAt: string;
    updatedAt: string;
}

export class MongolGalaxyDB extends Dexie {
    // 'friends' is just an example. 'adminQuotes' etc. are proper names
    adminQuotes!: Table<AdminQuote>;

    myEstimates!: Table<any>; // For personal estimates
    reservations!: Table<Reservation>;
    categories!: Table<Category>;
    magazines!: Table<Magazine>;
    reviews!: Table<Review>;
    recentlyViewed!: Table<RecentlyViewed>;
    wishlist!: Table<Wishlist>;
    settings!: Table<Settings>;
    faqs!: Table<FAQ>;
    faqCategories!: Table<FAQCategory>;
    travelMates!: Table<TravelMate>;

    constructor() {
        super('MongolGalaxyDB');
        this.version(8).stores({
            adminQuotes: 'id, type, status, createdAt',

            myEstimates: 'id, status',
            reservations: 'id, status, type',
            categories: 'id, order, isActive, type',
            magazines: 'id, category, isFeatured, isActive, order, createdAt',
            reviews: 'id, rating, date, productId',
            recentlyViewed: 'id, viewedAt',
            wishlist: 'id, addedAt',
            settings: 'id',
            faqs: 'id, category, order, isActive',
            faqCategories: 'id, order, isActive',
            travelMates: 'id, status, region, authorId, createdAt'
        });


        // Populate initial reviews if empty
        this.on('ready', async () => {
            // Populate initial reviews if empty - DISABLED to remove fake data
            /*
            const reviewCount = await this.reviews.count();
            if (reviewCount === 0) {
                await this.reviews.bulkAdd(initialReviews);
            }
            */


            // Populate sample reservations if empty
            const reservationCount = await this.reservations.count();
            if (reservationCount === 0) {
                await this.reservations.bulkAdd(sampleReservations);
            }
        });
    }
}

export interface Review {
    id: string;
    author: string;
    visitDate: string; // e.g. "2024.01"
    date: string; // ISO date for sorting
    rating: number;
    productName: string;
    productId?: string; // ID of the associated product
    content: string;
    images: string[];
    userImage?: string; // Avatar
    helpfulCount: number;
    helpfulUsers: string[]; // List of user IDs who found it helpful
    comments: Comment[];
}

export interface Comment {
    id: string;
    author: string;
    content: string;
    date: string; // ISO string
    userImage?: string;
}

const initialReviews: Review[] = [
    {
        id: '1',
        author: '김* 님',
        visitDate: '2024.01 방문',
        date: '2024-01-15',
        rating: 5,
        productName: '고비사막 별밤 관측 투어',
        content: '"인생 최고의 여행이었습니다. 밤하늘의 은하수는 평생 잊지 못할 추억이 될 것 같아요..."',
        images: ['https://lh3.googleusercontent.com/aida-public/AB6AXuB4K20GMVq8yGSfTci46S9biO_u2LDuxENlWBxUuJ0nn-vXp0HxEwZMChpGwntz2L5VISAaVTO0C3Jwe-ONgJLNcItHgdmG8Zb9pp-1uACHde5HETQBqmxnKmhs57ApVVkSCA6Kd-ta5q_h0ExQ84FYSY6vbGnDKD5yCJn-muLZnWDQCVEXnPd4YHvkNxzeRZmK1PN9XDNxQ1qdNDHGzJNqUkknzlI6FflIQG7Tnf1tHDg5TqEB8Gp1IlcZiBunTStiUDAFZDa0zQ'],
        userImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDEPhsKRODSrZPj9ZNZymOTchNvDJE8BDxJ_Au_pSe77PLomOjV7tutw5kLq2uLspxCvcBQraXW-RVoXTzh_xHoQF_NfeHE1cdtgSYjnjaKyXcGPSUgmW2HBTNE_fne1vlYB49o486w8rOvQ719eQqr4aCbmzwdqYb5OVr-0MvPwBUoZypxVGIjeSFnt7Er6lW_psrbXz4Rj135GiajkURZ3KTC8Ca0l_1qkUFxlHtoEslZ7CFR2TEr0kC4n1JmsB49LHVY9SPtDA',
        helpfulCount: 124,
        helpfulUsers: [],
        comments: [
            {
                id: 'c1',
                author: '초원의 바람',
                content: '와... 사진이 정말 예술이네요! 저도 이번 겨울에 가 보려고 하는데, 유용한 팁 감사합니다.',
                date: '2024-01-15T10:30:00Z',
                userImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvXSDqPR_KG335tZ6xXdjJoye4q5GVOTr20Oxpslu1zyfriAne1bZWvV5FqTK1TMF8Pa1QAcQy2yaWauK2D5V1leqdjSwdnrqFosOmj-9vf7CPhM3Z9gIL-5-j2eWYXS83ed9f7Vvy3hjsIGC1Z0B5_EUcobb3GorLH7Yy9HjTt3PhIszI6Nt4c7nFrUTEEkIoTcf-TPZ3YdGamfNE7avVjkxfs8eVnht9ZetrB1Sscxz7vShzYcrg5IX3ceMT-FPkb_wWidkhrg'
            },
            {
                id: 'c2',
                author: '노마드 라이프',
                content: '괜찮으시다면 가이드분 성함을 알려 주실 수 있을까요? 정말 좋아 보이네요!',
                date: '2024-01-15T11:00:00Z',
                userImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCShn2kpwvxzyvDnD-GN7JpBO_QKvP9brwexzTHeQAi-LgGsgbHT_GYq1BVRsmIU-WEzOpQ2tWJmbLpO8pJrGbA3lg-smckmQKX_kQQicB-2J33wkLDt9Y4un0drqJv1_xI5rZDHdphMjpKxq7s-8rzZKC4ypahdGTWeuf6wASKvdI-Q8MrDAILu54YJEn_WIcvM1pT6kAKv50dT8x6UlDQtX1cKgIa6wAZ7GX7ZAvvF5gwM_E2eo6V5nclQAyDn6JvbJjWP-pXBw'
            }
        ]
    },
    {
        id: '2',
        author: '이* 님',
        visitDate: '2023.12 방문',
        date: '2023-12-20',
        rating: 5,
        productName: '테를지 국립공원 승마 체험',
        content: '"가이드분도 정말 친절했고 숙소 수준이 기대 이상이었습니다. 또 오고 싶어요."',
        images: ['https://lh3.googleusercontent.com/aida-public/AB6AXuCa-lOI8hWg7jkEPE6aLpgULy46wN1zu_SdVj-gwNCoVza2ioMGm0cfT7njLma7CYQJ7YOCcomwafa5fKhJc9eO0hKtIafFHLoS9Vw_f3fyxGnxJkpkfUIBcpBSK8kb0onNzfKU-ImdlsG7T9ipvcqEVeiv0IkkaRjkNX43p7iWB42lYEVlHp-virwWcrmYH0R2SNXPmyNr-nNF55R-vs8rATJH09lIQgi22C3kyFBnx7gHhz_pjfvaFOI5i-SonHUBrrbuY_hnNQ'],
        userImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBvXSDqPR_KG335tZ6xXdjJoye4q5GVOTr20Oxpslu1zyfriAne1bZWvV5FqTK1TMF8Pa1QAcQy2yaWauK2D5V1leqdjSwdnrqFosOmj-9vf7CPhM3Z9gIL-5-j2eWYXS83ed9f7Vvy3hjsIGC1Z0B5_EUcobb3GorLH7Yy9HjTt3PhIszI6Nt4c7nFrUTEEkIoTcf-TPZ3YdGamfNE7avVjkxfs8eVnht9ZetrB1Sscxz7vShzYcrg5IX3ceMT-FPkb_wWidkhrg',
        helpfulCount: 5,
        helpfulUsers: [],
        comments: []
    },
    {
        id: '3',
        author: '박* 님',
        visitDate: '2023.09 방문',
        date: '2023-09-10',
        rating: 5,
        productName: '고비사막 투어',
        content: '"고비사막의 은하수는 말로 표현할 수 없을 만큼 아름다웠습니다. 강력 추천합니다!"',
        images: ['https://lh3.googleusercontent.com/aida-public/AB6AXuCViCzrsaryy2z22sZJjJC2yPok7E9fmP1eXTz5wxd0B9jW3b8ccHatM2GhE_PpfKvS4v62VtA9hKyqw0dGAuFEsBQax20AoO8MdCUXLg00zA8ODyeJZh-S9i4BUVoD3jx3bueEDMJeAJknjXRv9dg0xSf2FnfAZjPTTIHQoJm77_1r5C4ZlTxJWlzEkoI1s2BhdWPaYC11Q17j9_gAO2hS0gUFXxzfVl469Mp7kJGlkuZc39udLK16lJgqurk2l1VXHODjPbZ5gA'],
        userImage: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCShn2kpwvxzyvDnD-GN7JpBO_QKvP9brwexzTHeQAi-LgGsgbHT_GYq1BVRsmIU-WEzOpQ2tWJmbLpO8pJrGbA3lg-smckmQKX_kQQicB-2J33wkLDt9Y4un0drqJv1_xI5rZDHdphMjpKxq7s-8rzZKC4ypahdGTWeuf6wASKvdI-Q8MrDAILu54YJEn_WIcvM1pT6kAKv50dT8x6UlDQtX1cKgIa6wAZ7GX7ZAvvF5gwM_E2eo6V5nclQAyDn6JvbJjWP-pXBw',
        helpfulCount: 0,
        helpfulUsers: [],
        comments: []
    },
    {
        id: '4',
        author: '최* 님',
        visitDate: '2023.08 방문',
        date: '2023-08-05',
        rating: 5,
        productName: '승마 체험',
        content: '"승마는 처음이라 불안했는데, 정말 친절하게 가르쳐 주셔서 즐겁게 탈 수 있었습니다. 잊지 못할 추억이에요."',
        images: ['https://lh3.googleusercontent.com/aida-public/AB6AXuB4K20GMVq8yGSfTci46S9biO_u2LDuxENlWBxUuJ0nn-vXp0HxEwZMChpGwntz2LVISAaVTO0C3Jwe-ONgJLNcItHgdmG8Zb9pp-1uACHde5HETQBqmxnKmhs57ApVVkSCA6Kd-ta5q_h0ExQ84FYSY6vbGnDKD5yCJn-muLZnWDQCVEXnPd4YHvkNxzeRZmK1PN9XDNxQ1qdNDHGzJNqUkknzlI6FflIQG7Tnf1tHDg5TqEB8Gp1IlcZiBunTStiUDAFZDa0zQ'],
        userImage: '', // Placeholder or random
        helpfulCount: 0,
        helpfulUsers: [],
        comments: []
    }
];

const sampleReservations: Reservation[] = [
    {
        id: 'RSV-001',
        type: 'tour',
        status: 'completed',
        productName: '고비사막 5박 6일 투어',
        productId: 'tour-gobi-001',
        startDate: '2023-10-01',
        endDate: '2023-10-06',
        duration: '5박 6일',
        totalPeople: 2,
        customerInfo: {
            name: '김민수',
            phone: '010-1234-5678',
            email: 'test@example.com'
        },
        priceBreakdown: {
            total: 2500000,
            deposit: 500000,
            local: 2000000
        },
        createdAt: '2023-09-15T10:00:00Z',
        history: []
    },
    {
        id: 'RSV-002',
        type: 'tour',
        status: 'completed',
        productName: '테를지 국립공원 일일 투어',
        productId: 'tour-terelj-001',
        startDate: '2023-09-25',
        endDate: '2023-09-25',
        duration: '1일',
        totalPeople: 1,
        customerInfo: {
            name: '김민수',
            phone: '010-1234-5678',
            email: 'test@example.com'
        },
        priceBreakdown: {
            total: 150000,
            deposit: 50000,
            local: 100000
        },
        createdAt: '2023-09-20T10:00:00Z',
        history: []
    }
];


export interface Magazine {
    id: string;
    title: string;
    description: string;
    content: string;
    category: string; // '전체' | '몽골 기본 정보' | '여행 팁' | '지역별 가이드' | '문화와 음식'
    image: string; // base64 or URL
    tag?: string; // e.g., "Mongolia Insight", "Local Story"
    isFeatured: boolean; // Show in "지금 가장 핫한 가이드" section
    isActive: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
}

export interface Category {
    id: string;
    icon: string;
    name: string;
    description: string;
    isActive: boolean;
    order: number;
    type?: 'product' | 'magazine';
}

export interface Reservation {
    id: string;
    type: 'tour' | 'hotel' | 'vehicle' | 'guide' | 'quote';
    status: 'pending_payment' | 'confirmed' | 'cancelled' | 'completed';
    productName: string;
    productId: string | number;
    startDate: string;
    endDate: string;
    duration: string;
    totalPeople: number;
    customerInfo: {
        name: string;
        phone: string;
        email: string;
    };
    priceBreakdown: {
        total: number;
        deposit: number;
        local: number;
    };
    createdAt: string;
    history: {
        timestamp: string;
        type: string;
        description: string;
        detail?: string;
        details?: any;
    }[];
    [key: string]: any;
}

export const db = new MongolGalaxyDB();
