import type { QuoteDoneState } from './quoteLinks';

/**
 * 맞춤 견적 요청 폼의 공용 로직 (PC: CustomEstimateDesktop, 모바일: CustomEstimateMobile).
 * 선택지·검증 규칙·서버로 보내는 JSON은 견적 시스템의 원래 요청 폼(옛 public/견적요청.html)과 같다.
 * 접수된 요청은 관리자 도구(견적관리.html·견적만들기.html)가 그대로 읽으므로
 * 선택지 문자열과 payload의 key·값 형식을 바꾸지 말 것.
 */

/* ───────── 선택지 (원본 CONFIG 그대로) ───────── */

export const TRIP_TYPES = ['허니문', '가족 여행', '우정 여행', '나 홀로', '효도 여행', '단체·워크샵'];
export const TRAVEL_STYLES = ['휴양·힐링', '사진·은하수', '승마·액티비티', '트레킹', '문화·역사', '오지 탐험'];

export interface DestRegion {
    name: string;
    img: string;
    desc: string;
}

export interface DestCategory {
    /** 서버로 보내는 `destination` 값. */
    name: string;
    badge: string;
    tagline: string;
    /** 카드 사진: 관리자 관광지 사진(`spot` 키워드로 검색)이 없으면 이 파일을 쓴다. */
    img: string;
    /** 관광지 이름(DB)과 대조하므로 옛 일본어 이름과 한국어 이름 키워드를 함께 둔다. */
    spot: string[];
    /** 서버로 보내는 `destSpots` 후보. */
    regions: DestRegion[];
}

const REGION_IMG = '/img/regions';

/** 투어 카테고리 4개. 하나를 고르면 그 카테고리의 관심 지역을 고를 수 있다. */
export const DEST_CATEGORIES: DestCategory[] = [
    {
        name: '중앙 몽골 투어', badge: '인기 1위', tagline: '초원 승마·온천, 이동 짧고 여유로운 코스',
        img: `${REGION_IMG}/terelj.webp`, spot: ['大草原', '대초원', '테를지', '테렐지'],
        regions: [
            { name: '테를지 국립공원', img: `${REGION_IMG}/terelj.webp`, desc: '울란바토르에서 1.5시간. 기암괴석 초원에서 승마 체험.' },
            { name: '엘슨타사르해', img: `${REGION_IMG}/els.webp`, desc: "'미니 고비' 사막. 낙타 체험을 짧은 일정으로." },
            { name: '하르허링', img: `${REGION_IMG}/kharkhorin.webp`, desc: '몽골제국의 옛 수도 카라코룸. 에르덴조 사원.' },
            { name: '오르혼 계곡', img: `${REGION_IMG}/orkhon.webp`, desc: '유네스코 세계유산. 초원과 폭포가 어우러진 계곡.' },
            { name: '쳉헤르 온천', img: `${REGION_IMG}/tsenkher.webp`, desc: '숲속 노천 온천. 여행 피로 푸는 힐링 코스.' },
            { name: '우기 호수', img: `${REGION_IMG}/ugii.webp`, desc: '철새가 모이는 잔잔한 초원 호수.' },
            { name: '호스타이 국립공원', img: `${REGION_IMG}/khustai.webp`, desc: "야생마 '타히'를 만날 수 있는 국립공원." },
        ],
    },
    {
        name: '고비사막 투어', badge: '은하수 명소', tagline: '쏟아지는 은하수와 거대한 모래언덕',
        img: `${REGION_IMG}/khongor.webp`, spot: ['ホンゴル砂丘', 'ゴビ', '홍고르', '홍고린', '고비'],
        regions: [
            { name: '차강소브라가', img: `${REGION_IMG}/chagaan.webp`, desc: "바다가 융기한 거대 침식 절벽. '하얀 탑'." },
            { name: '욜린암', img: `${REGION_IMG}/yolynam.webp`, desc: '한여름에도 얼음이 남는 협곡 트레킹.' },
            { name: '홍고린엘스', img: `${REGION_IMG}/khongor.webp`, desc: "'노래하는 사막'. 선셋·모래썰매·낙타 체험." },
            { name: '바양작', img: `${REGION_IMG}/bayanzag.webp`, desc: "공룡알 화석이 나온 '불타는 절벽'." },
        ],
    },
    {
        name: '홉스굴 투어', badge: '여름 피서', tagline: "'몽골의 스위스' 푸른 호수와 침엽수 숲",
        img: `${REGION_IMG}/khuvsgul.webp`, spot: ['フブスグル', '홉스굴'],
        regions: [
            { name: '무릉', img: `${REGION_IMG}/murun.webp`, desc: '홉스굴로 가는 관문 도시.' },
            { name: '홉스굴', img: `${REGION_IMG}/khuvsgul.webp`, desc: '몽골 담수 70%의 거대 호수. 승마·보트·호숫가 게르.' },
        ],
    },
    {
        name: '몽골 트레킹 투어', badge: '', tagline: '초원과 산을 두 발로, 체력별 맞춤 코스',
        img: `${REGION_IMG}/tsetsee.webp`, spot: ['ハイキング', '登山', '하이킹', '등산', '트레킹'],
        regions: [
            { name: '열트산', img: `${REGION_IMG}/yolt.webp`, desc: '탁 트인 능선을 걷는 고지대 트레킹 코스.' },
            { name: '엉거츠산', img: `${REGION_IMG}/ongots.webp`, desc: '초원 위로 솟은 봉우리, 파노라마 전망.' },
            { name: '체체궁산', img: `${REGION_IMG}/tsetsee.webp`, desc: '울란바토르 남쪽 보그드산 자락의 당일 트레킹.' },
            { name: '테를지 국립공원', img: `${REGION_IMG}/terelj.webp`, desc: '기암 초원 능선을 걷는 입문 트레킹.' },
            { name: '몽골 올레길', img: `${REGION_IMG}/olle.webp`, desc: '제주올레가 만든 몽골 올레 트레킹 코스.' },
        ],
    },
];

/** 지역 선택을 여행사에 맡길 때의 `destination` 값. */
export const DEST_UNSURE = '잘 모르겠어요 (여행사 추천 요청)';

/** 시내(울란바토르)만 호텔 가능 / 투어 지역은 게르 등급만 가능. */
export const CITY_STAYS = ['호텔(5성급)', '호텔(4성급)', '게스트하우스', '상관없음'];
export const GER_STAYS = ['고급 여행자 게르', '일반 여행자 게르', '상관없음'];
export const VEHICLES = ['푸르공(6인)', '스타렉스(6인)', '랜드크루저(4인)', '델리카(6인)', '대형 버스(25인)', '상관없음'];

export const FLIGHT_YES = '예, 발행했어요';
export const FLIGHT_NO = '아니요, 아직이에요';
export const FLIGHT_OPTIONS = [FLIGHT_YES, FLIGHT_NO];

/** 한 항목(성인·아동·유아)에 넣을 수 있는 최대 인원 — 입력 실수 방지용. */
export const MAX_PAX = 99;

/* ───────── 값 ───────── */

export interface QuoteFormValues {
    adult: number;
    child: number;
    infant: number;
    /** 몽골 입국일 YYYY-MM-DD ('' = 미선택). */
    depart: string;
    /** 귀국일 YYYY-MM-DD. */
    return_: string;
    tripType: string;
    travelStyles: string[];
    destination: string;
    destSpots: string[];
    cityStay: string;
    gerStay: string;
    vehicle: string;
    flightIssued: string;
    /** datetime-local 값(YYYY-MM-DDTHH:mm). 보낼 때 "MM/DD - HH:mm"으로 바꾼다. */
    flightIn: string;
    flightOut: string;
    name: string;
    /** 숫자만. */
    phone: string;
    email: string;
    kakaoId: string;
    request: string;
    fileName: string;
    /** `POST /api/upload`가 돌려준 저장 위치. */
    fileKey: string;
    agree: boolean;
    /** 스팸 방어용 숨은 칸. 사람은 비워 두고, 채워져 오면 서버가 저장하지 않는다. */
    website: string;
}

/** 첨부 상태: 선택 전 / 올리는 중 / 완료 / 실패(파일 이름만 전달됨). */
export type QuoteFileState = '' | 'uploading' | 'done' | 'error';

export const EMPTY_QUOTE_FORM: QuoteFormValues = {
    adult: 2, child: 0, infant: 0,
    depart: '', return_: '',
    tripType: '', travelStyles: [], destination: '', destSpots: [], cityStay: '', gerStay: '', vehicle: '',
    flightIssued: '', flightIn: '', flightOut: '',
    name: '', phone: '', email: '', kakaoId: '',
    request: '', fileName: '', fileKey: '', agree: false,
    website: '',
};

/* ───────── 날짜·표기 ───────── */

export const WEEK = '일월화수목금토';
export const pad = (n: number) => String(n).padStart(2, '0');
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** 2026-10-03 + 1 → 2026-10-04 */
export const plusDays = (ymd: string, n: number) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return toKey(new Date(y, m - 1, d + n));
};
/** 2026-10-03 → 2026년 10월 3일(토) */
export const koDate = (v: string) => {
    if (!v) return '';
    const [y, m, d] = v.split('-').map(Number);
    return `${y}년 ${m}월 ${d}일(${WEEK[new Date(y, m - 1, d).getDay()]})`;
};

const dayNumber = (ymd: string) => {
    const [y, m, d] = ymd.split('-').map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
};
/** 박 수. 두 날짜가 모두 있어야 값이 나온다(귀국일이 입국일보다 앞이면 0 이하). */
export const quoteNights = (f: QuoteFormValues): number | null =>
    DATE_RE.test(f.depart) && DATE_RE.test(f.return_) ? Math.round(dayNumber(f.return_) - dayNumber(f.depart)) : null;
/** "3박 4일" ('' = 일정 미선택) */
export const quoteTripLength = (f: QuoteFormValues) => {
    const n = quoteNights(f);
    return n !== null && n > 0 ? `${n}박 ${n + 1}일` : '';
};

export const totalPax = (f: QuoteFormValues) => f.adult + f.child + f.infant;
export const quotePeople = (f: QuoteFormValues) =>
    [`성인 ${f.adult}명`, f.child > 0 ? `아동 ${f.child}명` : '', f.infant > 0 ? `유아 ${f.infant}명` : ''].filter(Boolean).join(' / ');

/** 휴대폰 번호 입력값 → 숫자만 11자리까지. 국가번호(+82)로 저장된 값은 0으로 시작하게 바꾼다. */
export const phoneDigits = (v: unknown) =>
    String(v ?? '').replace(/\D/g, '').replace(/^82(?=1\d{8,9}$)/, '0').slice(0, 11);

/* ───────── 검증 (원본 canProceed와 같은 규칙) ───────── */

export const PHONE_RE = /^[0-9]{9,11}$/;
export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** "푸르공(6인)" → 6. 정원 표기가 없거나 '상관없음'이면 제한 없음. */
export const vehicleCapacity = (value: string) => {
    if (!value || value === '상관없음') return Infinity;
    const m = value.match(/\((\d+)인\)/);
    return m ? Number(m[1]) : Infinity;
};
/** 고른 차량의 정원이 인원보다 적으면 안내 문구(진행 불가), 괜찮으면 ''. */
export const vehicleIssue = (f: QuoteFormValues) =>
    vehicleCapacity(f.vehicle) < totalPax(f)
        ? `${totalPax(f)}명은 ${f.vehicle}에 탑승할 수 없어요. 더 큰 차량이나 상관없음을 선택해 주세요.`
        : '';
export const recommendedVehicle = (f: QuoteFormValues) => {
    const p = totalPax(f);
    if (p <= 4) return '랜드크루저(4인)';
    if (p <= 6) return '푸르공·스타렉스·델리카(6인)';
    return '대형 버스(25인)';
};
export const vehicleAdvice = (f: QuoteFormValues) => {
    const issue = vehicleIssue(f);
    return {
        warn: !!issue,
        text: issue || `${totalPax(f)}명 기준 추천: ${recommendedVehicle(f)}. 짐의 양과 도로 상황에 따라 담당자가 최종 차량을 조정합니다.`,
    };
};

/** 고른 투어·관심 지역 수에 비해 박 수가 짧으면 경고(진행은 가능). 투어를 고르지 않았으면 null. */
export const routeAdvice = (f: QuoteFormValues) => {
    if (!f.destination || f.destination === DEST_UNSURE) return null;
    const base = f.destination.includes('중앙') || f.destination.includes('트레킹') ? 3 : 5;
    const recommended = Math.max(base, f.destSpots.length + 1);
    const n = quoteNights(f);
    const short = n !== null && n > 0 && n < recommended;
    const tail = `권장 일정은 약 ${recommended}박 이상이며, 최종 이동 동선은 담당자가 조정합니다.`;
    if (n === null || n <= 0) return { warn: false, text: tail };
    return {
        warn: short,
        text: `${short ? `현재 ${n}박 일정에는 선택한 지역이 많을 수 있어요.` : '선택한 지역을 여유 있게 둘러볼 수 있는 일정입니다.'} ${tail}`,
    };
};

export const flightYes = (f: QuoteFormValues) => f.flightIssued.startsWith('예');
/** datetime-local 값("2026-08-06T04:30") → 견적서 표기("08/06 - 04:30") */
export const fmtFlight = (v: string) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return v;
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} - ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** 화면의 8개 스텝 이름(순서 = quoteSteps). 아직 못 채운 항목 안내에 쓴다. */
export const QUOTE_STEP_LABELS = ['여행지', '여행 기간', '인원', '여행 스타일', '숙소·차량', '항공권', '연락처', '개인정보 동의'];

/** 스텝별 완료 여부. 모두 true여야 제출할 수 있다. */
export const quoteSteps = (f: QuoteFormValues): boolean[] => {
    const n = quoteNights(f);
    return [
        !!f.destination,
        n !== null && n > 0,
        f.adult >= 1, // 성인 최소 1명 (아동·유아만으로는 예약 불가)
        !!f.tripType,
        !!f.cityStay && !!f.gerStay && !!f.vehicle && !vehicleIssue(f),
        f.flightIssued === FLIGHT_NO || (!!f.flightIssued && !!f.flightIn && !!f.flightOut),
        f.name.trim().length > 0 && PHONE_RE.test(f.phone) && EMAIL_RE.test(f.email.trim()),
        f.agree,
    ];
};
export const canSubmitQuote = (f: QuoteFormValues) => quoteSteps(f).every(Boolean);
export const quoteMissing = (f: QuoteFormValues) => quoteSteps(f).map((ok, i) => (ok ? '' : QUOTE_STEP_LABELS[i])).filter(Boolean);
/** "여행 기간 외 2개 항목을 확인해 주세요" ('' = 모두 입력됨) */
export const quoteMissingText = (f: QuoteFormValues) => {
    const missing = quoteMissing(f);
    if (!missing.length) return '';
    return missing.length > 1 ? `${missing[0]} 외 ${missing.length - 1}개 항목을 확인해 주세요` : `${missing[0]} 항목을 확인해 주세요`;
};

/** 스텝 컨테이너의 id. 아직 못 채운 스텝으로 화면을 옮길 때 쓴다. */
export const quoteStepId = (n: number) => `quote-step-${n}`;
export const scrollToQuoteStep = (index: number) => {
    document.getElementById(quoteStepId(index + 1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

/* ───────── ?stay= 프리필 ───────── */

/**
 * 투어 목록의 여행 타입 카드가 보내는 `?stay=4성급 호텔,디럭스 게르`(옛 숙소 선택지·옛 일본어 값 포함)를
 * 지금의 시내 숙소·게르 선택지로 옮긴다. 대응하는 선택지가 없는 값(3성급 호텔 등)은 버린다.
 */
const STAY_ALIASES: Array<[string, 'cityStay' | 'gerStay', string]> = [
    ['5성급 호텔', 'cityStay', '호텔(5성급)'],
    ['5つ星ホテル', 'cityStay', '호텔(5성급)'],
    ['4성급 호텔', 'cityStay', '호텔(4성급)'],
    ['4つ星ホテル', 'cityStay', '호텔(4성급)'],
    ['디럭스 게르', 'gerStay', '고급 여행자 게르'],
    ['デラックスゲル', 'gerStay', '고급 여행자 게르'],
    ['스탠다드 게르', 'gerStay', '일반 여행자 게르'],
    ['スタンダードゲル', 'gerStay', '일반 여행자 게르'],
    ...CITY_STAYS.filter((v) => v !== '상관없음').map((v): [string, 'cityStay', string] => [v, 'cityStay', v]),
    ...GER_STAYS.filter((v) => v !== '상관없음').map((v): [string, 'gerStay', string] => [v, 'gerStay', v]),
];
const stayKey = (v: string) => v.replace(/\s+/g, '').replace('스탠더드', '스탠다드');

export const staysFromParam = (raw: string | null): Partial<Pick<QuoteFormValues, 'cityStay' | 'gerStay'>> => {
    const found: Partial<Pick<QuoteFormValues, 'cityStay' | 'gerStay'>> = {};
    for (const part of (raw || '').split(',')) {
        const hit = STAY_ALIASES.find(([alias]) => stayKey(alias) === stayKey(part));
        if (hit && !found[hit[1]]) found[hit[1]] = hit[2];
    }
    return found;
};

/* ───────── 입력 임시저장 (sessionStorage — 새로고침해도 복원, 접수되면 삭제) ───────── */

const DRAFT_KEY = 'mw_quote_draft';

export function loadQuoteDraft(): { form: QuoteFormValues; fileState: QuoteFileState } {
    const empty = { form: { ...EMPTY_QUOTE_FORM }, fileState: '' as QuoteFileState };
    try {
        const saved: unknown = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
        if (!saved || typeof saved !== 'object') return empty;
        const d = saved as Record<string, unknown>;
        const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
        const count = (v: unknown, min: number, fallback: number) => {
            const n = Math.round(Number(v));
            return Number.isFinite(n) ? Math.min(MAX_PAX, Math.max(min, n)) : fallback;
        };
        const oneOf = (v: unknown, options: string[]) => (typeof v === 'string' && options.includes(v) ? v : '');
        // 고른 순서를 그대로 둔다(관리자 화면에 고객이 고른 순서로 보인다).
        const someOf = (v: unknown, options: string[]) =>
            Array.isArray(v) ? v.filter((x, i): x is string => typeof x === 'string' && options.includes(x) && v.indexOf(x) === i) : [];
        const date = (v: unknown) => (typeof v === 'string' && DATE_RE.test(v) ? v : '');

        const destination = oneOf(d.destination, [...DEST_CATEGORIES.map((c) => c.name), DEST_UNSURE]);
        const regions = DEST_CATEGORIES.find((c) => c.name === destination)?.regions.map((r) => r.name) ?? [];
        // 지난 날짜가 남아 있으면 일정만 다시 고르게 한다.
        const depart = date(d.depart) >= toKey(new Date()) ? date(d.depart) : '';
        const return_ = depart && date(d.return_) > depart ? date(d.return_) : '';
        // 올리던 중에 새로고침된 첨부는 끝났는지 알 수 없으므로 비운다.
        const uploading = d.fileState === 'uploading';
        const fileName = uploading ? '' : text(d.fileName, 200);
        const fileKey = uploading ? '' : text(d.fileKey, 300);

        return {
            form: {
                adult: count(d.adult, 1, EMPTY_QUOTE_FORM.adult),
                child: count(d.child, 0, 0),
                infant: count(d.infant, 0, 0),
                depart,
                return_,
                tripType: oneOf(d.tripType, TRIP_TYPES),
                travelStyles: someOf(d.travelStyles, TRAVEL_STYLES),
                destination,
                destSpots: someOf(d.destSpots, regions),
                cityStay: oneOf(d.cityStay, CITY_STAYS),
                gerStay: oneOf(d.gerStay, GER_STAYS),
                vehicle: oneOf(d.vehicle, VEHICLES),
                flightIssued: oneOf(d.flightIssued, FLIGHT_OPTIONS),
                flightIn: text(d.flightIn, 16),
                flightOut: text(d.flightOut, 16),
                name: text(d.name, 40),
                phone: phoneDigits(d.phone),
                email: text(d.email, 120),
                kakaoId: text(d.kakaoId, 80),
                request: text(d.request, 2000),
                fileName,
                fileKey,
                agree: d.agree === true,
                website: '',
            },
            fileState: fileKey ? 'done' : fileName ? 'error' : '',
        };
    } catch {
        return empty;
    }
}

export function saveQuoteDraft(f: QuoteFormValues, fileState: QuoteFileState) {
    try {
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...f, website: undefined, fileState }));
    } catch {
        /* 저장소를 쓸 수 없으면 임시저장 없이 진행 */
    }
}

export function clearQuoteDraft() {
    try {
        sessionStorage.removeItem(DRAFT_KEY);
    } catch {
        /* ignore */
    }
}

/* ───────── 첨부파일 (1개, 선택 즉시 업로드) ───────── */

export const QUOTE_FILE_ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.gif';
const QUOTE_FILE_MAX = 10 * 1024 * 1024;

/** 서버(`functions/api/upload.js`)와 같은 제한. 문제가 있으면 안내 문구, 없으면 ''. */
export const checkQuoteFile = (file: File) => {
    if (file.size > QUOTE_FILE_MAX) return '파일은 10MB 이하만 첨부할 수 있어요.';
    const ext = `.${(file.name.split('.').pop() || '').toLowerCase()}`;
    if (!QUOTE_FILE_ACCEPT.split(',').includes(ext)) return 'PDF·JPG·PNG·WEBP·HEIC·GIF 파일만 첨부할 수 있어요.';
    return '';
};

/** 올린 파일의 저장 위치(`fileKey`). 실패하면 null. */
export async function uploadQuoteFile(file: File): Promise<string | null> {
    try {
        const body = new FormData();
        body.append('file', file);
        const res = await fetch('/api/upload', { method: 'POST', body });
        const data: { ok?: boolean; key?: unknown } | null = await res.json().catch(() => null);
        return res.ok && data?.ok && typeof data.key === 'string' ? data.key : null;
    } catch {
        return null;
    }
}

/* ───────── 제출 ───────── */

/**
 * `POST /api/requests`로 보내는 JSON. key·순서·값 형식은 옛 견적 요청 폼이 보내던 것과 같다
 * (receivedAt·status·memo는 서버가 다시 정하지만 같은 모양으로 보낸다).
 */
export function buildQuotePayload(f: QuoteFormValues) {
    const issued = flightYes(f);
    return {
        adult: f.adult,
        child: f.child,
        infant: f.infant,
        depart: f.depart,
        return_: f.return_,
        tripType: f.tripType,
        travelStyles: f.travelStyles,
        destination: f.destination,
        destSpots: f.destSpots,
        cityStay: f.cityStay,
        gerStay: f.gerStay,
        vehicle: f.vehicle,
        flightIssued: f.flightIssued,
        // 항공권: 발행한 경우에만 "MM/DD - HH:mm", 미발행이면 빈 값(견적서에 "미정")
        flightIn: issued ? fmtFlight(f.flightIn) : '',
        flightOut: issued ? fmtFlight(f.flightOut) : '',
        name: f.name.trim(),
        phone: f.phone,
        email: f.email.trim(),
        kakaoId: f.kakaoId.trim(),
        request: f.request.trim(),
        fileName: f.fileName,
        fileKey: f.fileKey,
        agree: f.agree,
        nights: quoteNights(f),
        receivedAt: new Date().toISOString(),
        status: '신규',
        memo: '',
        website: f.website,
    };
}

export type QuoteSubmitResult =
    | { ok: true; id: string; token: string }
    | { ok: false; kind: 'login' | 'duplicate' | 'rate' | 'invalid' | 'server' | 'network'; message: string };

/** 서버 저장이 확인된 경우에만 성공을 돌려준다(실패하면 완료 화면을 띄우지 않아 문의 유실을 막는다). */
export async function submitQuote(f: QuoteFormValues): Promise<QuoteSubmitResult> {
    let res: Response;
    try {
        res = await fetch('/api/requests', {
            credentials: 'same-origin',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildQuotePayload(f)),
        });
    } catch {
        return { ok: false, kind: 'network', message: '인터넷 연결을 확인하고 다시 시도해 주세요.' };
    }
    const data: { ok?: boolean; id?: unknown; token?: unknown } | null = await res.json().catch(() => null);
    if (res.ok && data?.ok && typeof data.token === 'string' && data.token) {
        return { ok: true, id: typeof data.id === 'string' ? data.id : '', token: data.token };
    }
    if (res.status === 401) return { ok: false, kind: 'login', message: '로그인 시간이 지났습니다. 다시 로그인하면 작성한 내용을 이어서 제출할 수 있습니다.' };
    if (res.status === 409) {
        return { ok: false, kind: 'duplicate', message: '접수 번호가 겹쳐 저장되지 않았어요. [견적 요청하기]를 한 번 더 눌러 주세요.' };
    }
    if (res.status === 429) {
        return { ok: false, kind: 'rate', message: '같은 휴대폰 번호로 방금 접수된 요청이 있어요. 1분 뒤에 다시 시도해 주세요.' };
    }
    if (res.status === 400) {
        return { ok: false, kind: 'invalid', message: '입력 내용을 다시 확인해 주세요. (일정·인원·연락처·필수 선택 항목)' };
    }
    if (res.status === 413) {
        return { ok: false, kind: 'invalid', message: '요청 내용이 너무 깁니다. 요청 사항을 줄여 다시 시도해 주세요.' };
    }
    // 2xx인데 조회 값이 없으면(스팸 방어에 걸린 경우 등) 저장되지 않은 것이므로 성공으로 치지 않는다.
    return { ok: false, kind: 'server', message: '접수를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' };
}

/* ───────── 완료 화면에 넘길 요약 ───────── */

const row = (k: string, v: string): [string, string] => [k, v];

/** 요청 내용 전체(원본 완료 화면의 "요청 내용 자세히 보기"와 같은 항목). */
export const quoteSummaryRows = (f: QuoteFormValues): Array<[string, string]> => {
    const length = quoteTripLength(f);
    return [
        row('여행 인원', `성인 ${f.adult} · 아동 ${f.child} · 유아 ${f.infant}`),
        row('여행 일정', `${f.depart} ~ ${f.return_}${length ? ` (${length})` : ''}`),
        row('여행 타입', f.tripType),
        ...(f.travelStyles.length ? [row('여행 취향', f.travelStyles.join(', '))] : []),
        row('희망 투어', f.destination),
        ...(f.destSpots.length ? [row('관심 지역', f.destSpots.join(', '))] : []),
        row('시내 숙소', f.cityStay),
        row('투어지역 게르', f.gerStay),
        row('차량', f.vehicle),
        row('항공권', flightYes(f) ? `도착 ${fmtFlight(f.flightIn)} · 출발 ${fmtFlight(f.flightOut)}` : '미발행 (미정)'),
        row('신청자', f.name.trim() || '-'),
        ...(f.kakaoId.trim() ? [row('카카오톡 ID', f.kakaoId.trim())] : []),
    ];
};

const maskPhone = (phone: string) =>
    phone.replace(/^(\d{3})(\d+)(\d{4})$/, (_, a: string, b: string, c: string) => `${a}-${'*'.repeat(Math.min(4, b.length))}-${c}`);

export function buildQuoteDone(f: QuoteFormValues, token: string): QuoteDoneState {
    const rows = quoteSummaryRows(f);
    const memo = [
        '[몽골 맞춤 견적 요청]',
        ...rows.map(([k, v]) => `${k}: ${v}`),
        `연락처: ${f.phone}`,
        `이메일: ${f.email.trim()}`,
        ...(f.request.trim() ? [`요청사항: ${f.request.trim()}`] : []),
    ].join('\n');
    return {
        token,
        name: f.name.trim(),
        createdAt: new Date().toISOString(),
        brief: {
            trip: `${quoteTripLength(f) || '일정 확인 중'} · ${totalPax(f)}명`,
            tour: f.destination || '추천 요청',
            phone: maskPhone(f.phone) || '-',
        },
        rows,
        memo,
    };
}
