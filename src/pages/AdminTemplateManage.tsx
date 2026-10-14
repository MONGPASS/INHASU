import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { ReservationDocumentEditor, type ReservationDocContent } from '../components/admin/ReservationDocumentEditor';
import { Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';
import { BRAND, COMPANY_INFO, CONTRACT_CANCELLATION_ROWS, DEPOSIT_ACCOUNT, DEPOSIT_PAYMENT_METHOD, resolveCancellationRows, resolveDepositMethod } from '../constants/company';
import { uploadImage } from '../utils/upload';
import { TouristSpotPickerModal } from '../components/admin/TouristSpotPickerModal';
import { HotelPickerModal } from '../components/admin/HotelPickerModal';
import type { TouristSpot } from '../types/touristSpot';
import type { Hotel } from '../types/hotel';
import mongoliaHero from '../assets/login_bg_3.jpg';
import { DOC_BLUE, DOC_NAVY } from '../components/document/TripDocParts';
import { won } from '../components/desktop-primitives/mwTokens';

// ─── Types ───────────────────────────────────────────────
export type ActivityType = 'pickup' | 'transport' | 'meal' | 'sightseeing' | 'activity' | 'checkin' | 'free' | 'other';
export interface Activity { time?: string; type?: ActivityType; title: string; description: string; images?: string[]; }
export interface TemplateDay {
    day: number;
    date?: string;
    title: string;
    region?: string;
    summary?: string;
    move?: string;
    dist?: string;
    images?: string[];
    activities: Activity[];
    meals?: { breakfast?: string; lunch?: string; dinner?: string };
    accommodation?: {
        id?: string;
        name: string;
        type?: string;
        location?: string;
        images?: string[];
        description?: string;
        tags?: string;
    } | null;
}
export interface DocumentSettings {
    overview: {
        subtitle: string;
        heroTagline: string;
        intro: string;
        included: { icon: string; label: string }[];
        includedText: string;
        excludedText: string;
        pricePerPerson: string;
        paymentNote: string;
    };
    contract: {
        intro: string;
        paymentMethod: string;
        paymentDeadline: string;
        includedText: string;
        excludedText: string;
        cancellationRows: { period: string; fee: string }[];
        signatureNote: string;
    };
    detail: {
        title: string;
        note: string;
        footerBadges: string[];
    };
    guide: {
        notices: { title: string; body: string }[];
        conditions: string;
        paymentInfo: string;
        guideName: string;
        guidePhone: string;
        accommodationInfo: string;
        emergencyPhone: string;
        emergencyEmail: string;
        closingMessage: string;
        qrLabel: string;
    };
}
interface ItineraryTemplate { id: string; name: string; description: string; days: TemplateDay[]; createdAt: string; documentSettings: DocumentSettings; }

const DOC_SETTINGS_MARKER = '\n\n__MILKYWAY_DOCUMENT_SETTINGS__=';

export const defaultDocumentSettings = (): DocumentSettings => ({
    overview: {
        subtitle: '은하수 아래에서 대자연과 문화를 체험하는 특별한 여행으로',
        heroTagline: '전통 의상 체험·승마 체험·낙타 체험·게르 체험 모두 포함',
        intro: '예약 내용을 바탕으로 여행 개요·일정·요금을 정리한 확인용 여행 일정표입니다.',
        included: [
            { icon: 'hiking', label: '몽골 전통 의상 체험' },
            { icon: 'pets', label: '승마 체험' },
            { icon: 'local_taxi', label: '전용 차량·기사' },
            { icon: 'hotel', label: '숙박' },
            { icon: 'restaurant', label: '식사 포함' },
            { icon: 'support_agent', label: '한국어 가이드' },
        ],
        includedText: '전용 차량·기사\n숙박(호텔·게르)\n식사 포함\n한국어 가이드\n전통 의상·승마·낙타 체험',
        excludedText: '국제선 항공권\n해외여행 보험\n개인 경비\n일정표에 기재되지 않은 식사',
        pricePerPerson: '1280000',
        paymentNote: '위 요금에는 일정표에 기재된 서비스가 포함되어 있습니다.',
    },
    contract: {
        intro: '본 여행 조건서 및 아래 여행 조건에 따라 국외여행 계약을 체결합니다.',
        paymentMethod: DEPOSIT_PAYMENT_METHOD,
        paymentDeadline: '안내 메일에 기재된 기일까지',
        includedText: '숙박비, 식사비, 전용 차량, 기사, 한국어 가이드, 일정표에 기재된 체험 요금',
        excludedText: '국제선 항공권, 해외여행 보험, 개인 경비, 일정표에 기재되지 않은 식사',
        cancellationRows: CONTRACT_CANCELLATION_ROWS.map((row) => ({ ...row })),
        signatureNote: '위 내용을 확인하고 동의하여 본 계약을 체결합니다.',
    },
    detail: {
        title: '여행 일정표(상세)',
        note: '날씨·교통 상황에 따라 일정이 변경될 수 있습니다.',
        footerBadges: ['추가 요금 없는 올인클루시브 플랜', '일정 조정 가능', '단독 전용 차량으로 안심 이동', '한국어 가이드가 전 일정 지원'],
    },
    guide: {
        notices: [
            { title: '복장 안내', body: '아침저녁으로 쌀쌀할 수 있으니 걸칠 수 있는 겉옷을 준비해 주세요.' },
            { title: '숙박 안내', body: '호텔 및 게르 숙박은 현지 사정에 따라 동급 시설로 변경될 수 있습니다.' },
            { title: '식사 안내', body: '알레르기나 식사 제한이 있는 경우 사전에 알려 주세요.' },
            { title: '준비물 안내', body: '여권, 보험 증권, 상비약, 충전기 등을 준비해 주세요.' },
        ],
        conditions: '본 여행은 당사 여행 조건서 및 국외여행 표준약관에 따라 실시합니다.',
        // 이 문구에는 계좌번호 같은 숫자를 넣지 않는다 — 고객 견적 화면(EstimateDetail)이 여기서 4자리 이상 숫자를 예약금 금액으로 읽는다.
        paymentInfo: `예약금: ${DEPOSIT_PAYMENT_METHOD} — 예약 신청 후 안내해 드리는 계좌로 예약금을 입금하고, 마이페이지에서 '입금 완료'를 알려 주세요. 담당자가 확인한 뒤 예약이 확정됩니다.\n잔금: 현지에서 현금으로 결제합니다.`,
        guideName: '',
        guidePhone: '',
        accommodationInfo: '',
        emergencyPhone: '+976-80-1234-5678',
        emergencyEmail: COMPANY_INFO.email,
        closingMessage: '몽골의 대자연과 문화를 마음껏 즐겨 주세요.',
        qrLabel: '고객 전용 페이지',
    },
});

/**
 * 템플릿·예약 문서에 복사돼 저장돼 있을 수 있는 옛 기본 문구. 손대지 않은 복사본이면 현재 기본값으로 바꿔 보여 준다.
 * 일본어 값은 옛 데이터와 비교하는 용도이므로 번역하지 않는다.
 */
const LEGACY_GUIDE_PAYMENT_INFO = [
    'お支払い方法：銀行振込\nお支払い期限：ご案内メールに記載の期日まで', // 일본어판 초기(은행 송금)
    'お支払い方法：PayPal\nお支払い期限：ご案内メールに記載の期日まで', // 일본어판(PayPal 전용)
    '결제 방법: PayPal\n결제 기한: 안내 메일에 기재된 기일까지', // 한국어 번역 직후(PayPal 전용)
    '결제 방법: 계좌이체\n결제 기한: 안내 메일에 기재된 기일까지', // 계좌이체 전환 직후(결제 방법만 표기)
];
/** 일본 여행업법 용어를 직역했던 옛 기본 문구(한국어판) → 국외여행 계약 / 국외여행 표준약관. */
const LEGACY_CONTRACT_INTRO = ['본 여행 조건서 및 아래 여행 조건에 따라 모집형 기획여행 계약을 체결합니다.'];
const LEGACY_GUIDE_CONDITIONS = ['본 여행은 당사 여행 조건서 및 여행업 약관에 따라 실시합니다.'];
/** 옛 도메인의 문의 메일. */
const LEGACY_EMERGENCY_EMAILS = ['info@mongolryokou.com'];

export const mergeDocumentSettings = (value: any): DocumentSettings => {
    const base = defaultDocumentSettings();
    if (!value || typeof value !== 'object') return base;
    // 예약금은 계좌이체로 받는다(계좌는 공통 값 DEPOSIT_ACCOUNT) — 예전에 템플릿마다 저장하던 계좌 안내(bankInfo)는 버리고,
    // 옛 기본 결제 방법('銀行振込', 'PayPal')은 resolveDepositMethod가 계좌이체로 바꾼다.
    const { bankInfo: _legacyBankInfo, ...savedContract } = (value.contract || {}) as Record<string, unknown>;
    void _legacyBankInfo;
    if (LEGACY_CONTRACT_INTRO.includes(savedContract.intro as string)) savedContract.intro = base.contract.intro;
    const savedGuide = { ...(value.guide || {}) };
    if (LEGACY_GUIDE_PAYMENT_INFO.includes(savedGuide.paymentInfo)) savedGuide.paymentInfo = base.guide.paymentInfo;
    if (LEGACY_GUIDE_CONDITIONS.includes(savedGuide.conditions)) savedGuide.conditions = base.guide.conditions;
    if (LEGACY_EMERGENCY_EMAILS.includes(savedGuide.emergencyEmail)) savedGuide.emergencyEmail = base.guide.emergencyEmail;
    return {
        overview: { ...base.overview, ...(value.overview || {}), included: Array.isArray(value.overview?.included) ? value.overview.included : base.overview.included },
        contract: {
            ...base.contract,
            ...savedContract,
            paymentMethod: resolveDepositMethod(savedContract.paymentMethod),
            cancellationRows: resolveCancellationRows(value.contract?.cancellationRows).map((row) => ({ ...row })),
        },
        detail: { ...base.detail, ...(value.detail || {}), footerBadges: Array.isArray(value.detail?.footerBadges) ? value.detail.footerBadges : base.detail.footerBadges },
        guide: { ...base.guide, ...savedGuide, notices: Array.isArray(value.guide?.notices) ? value.guide.notices : base.guide.notices },
    };
};

export const decodeTemplateDescription = (raw = '') => {
    const [description, encoded] = raw.split(DOC_SETTINGS_MARKER);
    if (!encoded) return { description: raw, documentSettings: defaultDocumentSettings() };
    try {
        return { description, documentSettings: mergeDocumentSettings(JSON.parse(encoded)) };
    } catch {
        return { description, documentSettings: defaultDocumentSettings() };
    }
};

// 줄 단위 텍스트 → 일정 항목 배열 (전체 텍스트 편집용)
const inferTypeForText = (text: string): ActivityType => {
    const v = (text || '').toLowerCase();
    if (/(공항|픽업|도착|미팅|空港|到着|arrival|airport)/i.test(v)) return 'pickup';
    if (/(이동|출발|전용차|차량|버스|移動|出発|専用車|transfer|drive)/i.test(v)) return 'transport';
    if (/(식사|조식|중식|석식|점심|저녁|아침|食事|朝食|昼食|夕食|meal|lunch|dinner|breakfast)/i.test(v)) return 'meal';
    if (/(숙박|호텔|게르|체크인|宿泊|ホテル|ゲル|hotel|stay|check[-\s]?in)/i.test(v)) return 'checkin';
    if (/(체험|승마|낙타|트레킹|공연|乗馬|ラクダ|activity|experience)/i.test(v)) return 'activity';
    if (/(자유|휴식|自由|free)/i.test(v)) return 'free';
    return 'sightseeing';
};
export const parseDayActivitiesText = (text: string): Activity[] =>
    (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(line => {
        const m = line.match(/^(\d{1,2}:\d{2})\s+(.*)$/);
        const title = m ? m[2] : line;
        return { time: '', type: inferTypeForText(title), title, description: '' };
    });

const encodeTemplateDescription = (description: string, documentSettings: DocumentSettings) =>
    `${description || ''}${DOC_SETTINGS_MARKER}${JSON.stringify(documentSettings)}`;

const ACTIVITY_TYPES: { id: ActivityType; label: string; icon: string }[] = [
    { id: 'pickup', label: '픽업', icon: 'flight_land' },
    { id: 'transport', label: '이동', icon: 'directions_car' },
    { id: 'meal', label: '식사', icon: 'restaurant' },
    { id: 'sightseeing', label: '관광', icon: 'photo_camera' },
    { id: 'activity', label: '체험', icon: 'sports_handball' },
    { id: 'checkin', label: '체크인', icon: 'hotel' },
    { id: 'free', label: '자유시간', icon: 'park' },
    { id: 'other', label: '기타', icon: 'more_horiz' },
];
const TYPE_MAP = Object.fromEntries(ACTIVITY_TYPES.map(t => [t.id, t]));

// 항목 유형별 액센트 색 (목업 디자인: 관광=teal, 숙박=violet, 이동=blue, 식사=amber)
const typeAccent = (type?: ActivityType): { c: string; cb: string } => {
    switch (type) {
        case 'checkin': return { c: '#6a55d6', cb: '#efedfd' };
        case 'pickup':
        case 'transport': return { c: '#2767cf', cb: '#e8f0fd' };
        case 'meal': return { c: '#c97a16', cb: '#fcf2e0' };
        default: return { c: '#0e9c84', cb: '#e4f6f1' };
    }
};

interface Guide {
    id: string; name: string; image: string; introduction: string;
    phone: string; languages: string[]; specialties: string[]; status: string; experienceYears: number;
}

interface Accommodation {
    id: string; name: string; images: string[]; description: string;
    type: string; location: string;
}

const LANGUAGES = ['한국어', '영어', '몽골어', '중국어', '일본어'];
const SPECIALTIES = ['고비사막', '홉스굴', '테를지', '승마', '문화체험', '사진촬영'];
/** 옛 표기('홉스골')로 저장된 전문 분야도 현재 선택지('홉스굴')로 인식한다. */
const normalizeSpecialties = (list: unknown): string[] =>
    Array.from(new Set((Array.isArray(list) ? list : []).map((s) => (s === '홉스골' ? '홉스굴' : String(s)))));
const ACCOM_TYPES = { '호텔': ['2성급 호텔', '3성급 호텔', '4성급 호텔', '5성급 호텔'], '게르': ['일반 게르', '고급 게르', '럭셔리 게르'], '게스트하우스': ['게스트하우스'] };

// 모듈 스코프 컴포넌트 — 컴포넌트 내부에 정의하면 입력마다 리마운트되어 포커스·스크롤이 튐
const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="mx-auto max-w-[960px] rounded-[22px] border border-[#9CC5FF] bg-white shadow-sm">{children}</div>
);

// ─── Live Preview (editable PC document preview) ───
type TemplatePreviewProps = {
    name: string;
    description: string;
    days: TemplateDay[];
    documentSettings: DocumentSettings;
    onNameChange: (value: string) => void;
    onDescriptionChange: (value: string) => void;
    onDocSection: <K extends keyof DocumentSettings>(section: K, patch: Partial<DocumentSettings[K]>) => void;
    onIncluded: (idx: number, field: 'icon' | 'label', value: string) => void;
    onCancellation: (idx: number, field: 'period' | 'fee', value: string) => void;
    onGuideNotice: (idx: number, field: 'title' | 'body', value: string) => void;
    // 일정 직접 편집
    onDayChange: (dayIdx: number, field: keyof TemplateDay, value: any) => void;
    onActivityChange: (dayIdx: number, actIdx: number, field: 'time' | 'title' | 'description', value: string) => void;
    onAddDay: () => void;
    onAddActivity: (dayIdx: number) => void;
    onRemoveDay: (dayIdx: number) => void;
    onRemoveActivity: (dayIdx: number, actIdx: number) => void;
    onDayActivitiesText?: (dayIdx: number, text: string) => void;
    /** 일정 항목 순서 변경(드래그앤드랍) — 없으면 드래그 핸들 미표시 */
    onMoveActivity?: (dayIdx: number, from: number, to: number) => void;
    /** 일정 항목 사진 업로드 — 없으면 「사진 추가」 버튼 미표시 */
    onUploadActivityImages?: (dayIdx: number, actIdx: number, files: FileList | null) => void;
    onRemoveActivityImage?: (dayIdx: number, actIdx: number, imgIdx: number) => void;
    onPickSpot?: (dayIdx: number, actIdx: number) => void;
    onPickHotel?: (dayIdx: number) => void;
    /** 해당 일차의 숙소 선택 해제(확정 배정 해제 포함). 없으면 문서 내용의 숙소만 비운다. */
    onClearHotel?: (dayIdx: number) => void;
    defaultPage?: 'overview' | 'contract' | 'detail' | 'guide';
    focusDayIndex?: number;
    showPageTabs?: boolean;
    visiblePages?: Array<'overview' | 'contract' | 'detail' | 'guide'>;
    // 예약/견적에서 열 때 실제 고객 데이터 자동 표시 (없으면 샘플)
    customer?: {
        tripNumber?: string;
        period?: string;
        tripLength?: string;
        headcount?: string;
        name?: string;
        tripType?: string;
        totalAmount?: number;
        deposit?: number;
        localAmount?: number;
        peopleCount?: number;
    } | null;
    assignedGuide?: { name?: string; phone?: string; image?: string } | null;
    dailyAccommodations?: Array<{ day: number; accommodation: { name?: string; type?: string; location?: string } }>;
};

// 입력 내용에 맞춰 높이가 자동으로 늘어나는 textarea — 고정 rows로 위 내용이 가려지는 문제 방지
const AutoTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
    const ref = React.useRef<HTMLTextAreaElement | null>(null);
    const fit = () => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } };
    React.useEffect(fit, [props.value]);
    return <textarea ref={ref} rows={1} {...props} onInput={(e) => { fit(); props.onInput?.(e); }} style={{ ...(props.style || {}), overflow: 'hidden', resize: 'none' }} />;
};

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({ name, description, days, documentSettings, customer, assignedGuide, dailyAccommodations, onNameChange, onDescriptionChange, onDocSection, onIncluded, onCancellation, onGuideNotice, onDayChange, onActivityChange, onAddDay, onAddActivity, onRemoveDay, onRemoveActivity, onDayActivitiesText, onMoveActivity, onUploadActivityImages, onRemoveActivityImage, onPickSpot, onPickHotel, onClearHotel, defaultPage = 'overview', focusDayIndex, showPageTabs = true, visiblePages }) => {
    const [activePage, setActivePage] = useState<'overview' | 'contract' | 'detail' | 'guide'>(defaultPage);
    // 상세 탭 일정 항목 드래그앤드랍 상태 — DAY 사이드바(ReservationDocumentEditor)와 같은 HTML5 drag 방식
    const [dragActivity, setDragActivity] = useState<{ day: number; idx: number } | null>(null);
    useEffect(() => setActivePage(defaultPage), [defaultPage]);
    const totalDays = days.length;
    const nights = Math.max(0, totalDays - 1);
    const settings = mergeDocumentSettings(documentSettings);
    const peopleCount = customer?.peopleCount || 2;
    const samplePrice = (customer?.totalAmount && peopleCount) ? Math.round(customer.totalAmount / peopleCount) : (Number(settings.overview.pricePerPerson || 0) || 1280000);
    const sampleTotal = customer?.totalAmount ?? samplePrice * peopleCount;
    const sampleDeposit = customer?.deposit ?? Math.floor(sampleTotal * 0.1);
    const sampleLocal = customer?.localAmount ?? (sampleTotal - sampleDeposit);
    const tripLength = customer?.tripLength || `${nights}박 ${totalDays || 0}일`;
    const guideText = assignedGuide?.name
        ? `${assignedGuide.name}${assignedGuide.phone ? ` (${assignedGuide.phone})` : ''}`
        : '한국어 가이드가 전 일정 동행합니다';
    const getAccommodation = (day: number) =>
        dailyAccommodations?.find(item => item.day === day)?.accommodation
        || days.find(item => item.day === day)?.accommodation
        || null;
    const accommodationSummary = days
        .map(day => ({ day: day.day, accommodation: getAccommodation(day.day) }))
        .filter(item => item.accommodation?.name)
        .map(item => `${item.day}일차: ${item.accommodation?.name}`)
        .join(' / ') || '출발 전까지 안내해 드립니다';
    const pages = [
        { id: 'overview' as const, label: '일정표', icon: 'article' },
        { id: 'contract' as const, label: '계약서', icon: 'contract' },
        { id: 'detail' as const, label: '상세', icon: 'route' },
        { id: 'guide' as const, label: '안내', icon: 'info' },
    ].filter(page => !visiblePages || visiblePages.includes(page.id));
    const rows = [
        ['여행 번호', customer?.tripNumber || 'QT-20240604-001'],
        ['여행 기간', `${customer?.period || '2026년 6월 10일(수) ~ 2026년 6월 13일(토)'} ${tripLength}`],
        ['참가 인원', customer?.headcount || '성인 2명 / 어린이 0명'],
        ['고객명', `${customer?.name || '홍길동'} 님`],
        ['여행 형태', customer?.tripType || '단독 프라이빗 투어'],
    ];
    const fieldClass = 'w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 outline-none transition-colors hover:border-[#9CC5FF] hover:bg-white/80 focus:border-[#287DFA] focus:bg-white focus:ring-2 focus:ring-[#287DFA]/15';
    // 히어로(네이비 배경) 위 흰 글자 입력용 — 포커스 시에도 글자가 보이도록 어두운 배경 유지
    const heroFieldClass = 'w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 outline-none transition-colors hover:border-white/50 hover:bg-white/10 focus:border-white/80 focus:bg-[#0B1B45]/45 focus:ring-2 focus:ring-white/25';
    // 고객 문서(TripDocParts)와 동일한 카드 셸 — Trip.com식 블루/네이비
    const card = 'rounded-2xl bg-white shadow-[0_8px_24px_rgba(11,27,69,0.08)]';
    // Frame은 모듈 스코프로 이동 (입력마다 리마운트되어 스크롤·포커스가 튀던 문제 수정)
    // 섹션 타이틀 — 컴포넌트가 아닌 함수 호출(JSX 반환)이라 입력 리마운트 문제 없음
    const secTitle = (icon: string, label: React.ReactNode, tone: 'blue' | 'red' = 'blue') => (
        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-black" style={{ color: tone === 'red' ? '#EF4444' : DOC_NAVY }}>
            <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-white" style={{ background: tone === 'red' ? '#EF4444' : DOC_BLUE }}>
                <span className="material-symbols-outlined text-[16px]">{icon}</span>
            </span>
            {label}
        </h3>
    );
    const infoIcons: Record<string, string> = {
        '여행 번호': 'confirmation_number',
        '여행 기간': 'calendar_month',
        '참가 인원': 'groups',
        '고객명': 'person',
        '여행 형태': 'flag',
        '담당 가이드': 'support_agent',
        '숙박': 'hotel',
    };
    const mealDefs = [
        { key: 'breakfast' as const, label: '조식', icon: 'egg_alt', color: '#F59E0B' },
        { key: 'lunch' as const, label: '중식', icon: 'ramen_dining', color: '#10B981' },
        { key: 'dinner' as const, label: '석식', icon: 'restaurant', color: '#F97316' },
    ];

    return (
        <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-[#F2F5FA] dark:bg-slate-900">
            {showPageTabs && <div className="border-b border-[#C7DCFF]/60 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-400">
                        <span className="material-symbols-outlined text-[15px]">edit_note</span>PDF 화면에서 직접 편집
                    </p>
                    <span className="rounded-full bg-[#287DFA]/10 px-3 py-1 text-[11px] font-black text-[#1656D6]">클릭해서 수정</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-[#EAF3FF] p-1">
                    {pages.map(page => (
                        <button key={page.id} onClick={() => setActivePage(page.id)} className={`inline-flex min-w-0 items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-black transition-colors ${activePage === page.id ? 'bg-white text-[#1656D6] shadow-sm' : 'text-slate-500 hover:bg-white/60'}`} title={page.label}>
                            <span className="material-symbols-outlined text-[15px]">{page.icon}</span><span className="truncate">{page.label}</span>
                        </button>
                    ))}
                </div>
            </div>}
            {customer ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[#C7DCFF] bg-[#EAF3FF] px-4 py-2 text-[11px] font-bold text-[#1656D6] dark:border-blue-900 dark:bg-blue-900/20">
                    <span className="material-symbols-outlined text-[15px]">person</span>
                    <span>{customer.name || '고객'}님 문서 — 고객 정보·금액이 자동 반영되었습니다</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5"><span className="material-symbols-outlined text-[13px]">badge</span>{guideText}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5"><span className="material-symbols-outlined text-[13px]">hotel</span>{dailyAccommodations?.length ? `${dailyAccommodations.length}일 숙소 배정` : '숙소 미배정'}</span>
                </div>
            ) : (
                <div className="flex items-start gap-1.5 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                    <span className="material-symbols-outlined text-[15px]">info</span>
                    <span>샘플(예시) 표시입니다. 실제 고객 정보는 <b>통합 예약 관리 → 예약/견적 → 「문서 편집」</b>으로 열면 자동으로 채워집니다.</span>
                </div>
            )}
            <div className="flex-1 overflow-y-auto p-4">
                <div className="mx-auto flex max-w-[880px] flex-col gap-4">
                    {activePage === 'overview' && <>
                        <div className="flex items-center justify-between px-1 pt-1">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[26px]" style={{ color: DOC_BLUE }}>nights_stay</span>
                                <div>
                                    <p className="text-[15px] font-black leading-none" style={{ color: DOC_NAVY }}>몽골리아 은하수</p>
                                    <p className="text-[9px] font-bold tracking-[0.22em] text-slate-400">{BRAND.nameEn.toUpperCase()}</p>
                                </div>
                            </div>
                            <div className="w-[280px] text-right text-[11px] font-bold text-slate-500">
                                <p>여행 번호: <span className="font-black" style={{ color: DOC_NAVY }}>{customer?.tripNumber || 'QT-20240604-001'}</span></p>
                                <input value={settings.overview.subtitle} onChange={e => onDocSection('overview', { subtitle: e.target.value })} placeholder="부제목" className={`${fieldClass} text-right text-[10px] font-semibold text-slate-400`} />
                            </div>
                        </div>

                        <div className="relative overflow-hidden rounded-3xl">
                            <img src={mongoliaHero} alt="" className="h-[230px] w-full object-cover" />
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(110deg, rgba(11,27,69,0.94) 0%, rgba(22,39,95,0.78) 45%, rgba(40,125,250,0.30) 100%)' }} />
                            <div className="absolute inset-0 flex flex-col justify-center px-6 text-white sm:px-9">
                                <p className="text-[12px] font-bold tracking-wide text-sky-200">오직 당신만을 위한 특별한 여행으로</p>
                                <input value={name} onChange={e => onNameChange(e.target.value)} placeholder="은하수·대자연 패키지" className={`${heroFieldClass} mt-2 max-w-xl text-[26px] font-black leading-tight text-white placeholder:text-white/60`} />
                                <input value={description || settings.overview.heroTagline} onChange={e => onDescriptionChange(e.target.value)} className={`${heroFieldClass} mt-1 max-w-xl text-[12.5px] font-semibold text-white/85`} />
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <span className="rounded-xl px-3 py-1.5 text-[12px] font-black text-white" style={{ background: DOC_BLUE }}>{tripLength}</span>
                                    <span className="rounded-xl px-3 py-1.5 text-[12px] font-black text-white" style={{ background: DOC_BLUE }}>{customer?.headcount || `${peopleCount}명`}</span>
                                </div>
                            </div>
                        </div>

                        <section className={`${card} p-5`}>
                            {secTitle('person', '여행 정보')}
                            <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                                {[...rows, ['담당 가이드', guideText], ['숙박', accommodationSummary]].map(([label, value]) => (
                                    <div key={label} className="flex items-center gap-3 border-b border-slate-100 pb-3">
                                        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full" style={{ background: '#EAF3FF', color: DOC_BLUE }}>
                                            <span className="material-symbols-outlined text-[20px]">{infoIcons[label] || 'info'}</span>
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold text-slate-400">{label}</p>
                                            <p className="truncate text-[13.5px] font-black" style={{ color: DOC_NAVY }}>{value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <section className={`${card} p-5`}>
                            {secTitle('check', '여행 개요')}
                            <AutoTextarea value={settings.overview.intro} onChange={e => onDocSection('overview', { intro: e.target.value })} rows={3} className={`${fieldClass} resize-none text-[12px] font-semibold leading-relaxed text-slate-600`} />
                        </section>

                        <section className={`${card} p-5`}>
                            {secTitle('payments', '결제 정보')}
                            {customer && !customer.totalAmount && (
                                <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                                    <span className="material-symbols-outlined mt-px text-[17px] text-amber-500">warning</span>
                                    <p className="text-[11.5px] font-bold leading-relaxed text-amber-700">
                                        금액 미입력 — 아래 금액은 <b>기준요금×인원수로 임시 계산된 샘플</b>입니다.
                                        상세 화면의 <b>「견적 작성 — 확정 일정·금액」</b>에 총 결제금액·예약금을 입력하면 자동으로 반영됩니다.
                                    </p>
                                </div>
                            )}
                            <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
                                <div className="relative overflow-hidden rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #2F86FF 0%, #1656D6 100%)' }}>
                                    <span className="material-symbols-outlined absolute right-4 top-4 text-[34px] opacity-40">account_balance_wallet</span>
                                    <p className="text-[12px] font-bold text-white/85">총 여행 요금</p>
                                    <p className="mt-2 text-[30px] font-black tracking-tight">{won(sampleTotal)}</p>
                                    <p className="mt-1 text-[10.5px] font-bold text-white/70">(원화 기준 / {peopleCount}명)</p>
                                </div>
                                <div className="overflow-hidden rounded-2xl border border-slate-100">
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-[13px] font-bold" style={{ color: DOC_NAVY }}>
                                        <span>총 여행 요금</span><b style={{ color: DOC_BLUE }}>{won(sampleTotal)}</b>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-[13px] font-bold" style={{ color: DOC_NAVY }}>
                                        <span>예약금 <small className="font-semibold text-slate-400">({DEPOSIT_PAYMENT_METHOD} · 입금 확인 후 예약 확정)</small></span><b style={{ color: DOC_BLUE }}>{won(sampleDeposit)}</b>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-[13px] font-bold" style={{ color: DOC_NAVY }}>
                                        <span>현지 결제 잔금 <small className="font-semibold text-slate-400">(현지에서 현금 결제)</small></span><b style={{ color: DOC_BLUE }}>{won(sampleLocal)}</b>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-[13px] font-bold" style={{ color: DOC_NAVY }}>
                                        <span>입금 계좌</span><span className="text-right text-[12px] font-bold text-slate-600">{DEPOSIT_ACCOUNT.bank} {DEPOSIT_ACCOUNT.number} (예금주 {DEPOSIT_ACCOUNT.holder})</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-3 px-4 py-3 text-[13px] font-bold" style={{ color: DOC_NAVY }}>
                                        {customer?.totalAmount ? (
                                            <>
                                                <span>1인당</span>
                                                <b className="text-[13px] font-black text-[#1656D6]">{won(samplePrice)}</b>
                                            </>
                                        ) : (
                                            <>
                                                <span>기준 요금 <small className="font-semibold text-slate-400">(1인·원)</small></span>
                                                <div className="w-[130px] flex-none">
                                                    <input
                                                        value={settings.overview.pricePerPerson ? Number(settings.overview.pricePerPerson.replace(/[^\d]/g, '')).toLocaleString() : ''}
                                                        onChange={e => onDocSection('overview', { pricePerPerson: e.target.value.replace(/[^\d]/g, '') })}
                                                        placeholder="1,280,000"
                                                        className={`${fieldClass} text-right text-[13px] font-black text-[#1656D6]`}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <AutoTextarea value={settings.overview.paymentNote} onChange={e => onDocSection('overview', { paymentNote: e.target.value })} rows={2} placeholder="결제 관련 비고" className={`${fieldClass} mt-3 resize-none text-[11.5px] font-semibold leading-relaxed text-slate-500`} />
                        </section>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <section className={`${card} !shadow-[0_8px_24px_rgba(40,125,250,0.10)] p-5`}>
                                {secTitle('check', '포함 사항')}
                                <AutoTextarea value={settings.overview.includedText} onChange={e => onDocSection('overview', { includedText: e.target.value })} rows={6} placeholder="한 줄에 한 항목" className={`${fieldClass} resize-none text-[12px] font-bold leading-[1.9] text-[#0B1B45]`} />
                            </section>
                            <section className={`${card} !shadow-[0_8px_24px_rgba(239,68,68,0.08)] p-5`}>
                                {secTitle('close', '불포함 사항', 'red')}
                                <AutoTextarea value={settings.overview.excludedText} onChange={e => onDocSection('overview', { excludedText: e.target.value })} rows={6} placeholder="한 줄에 한 항목" className={`${fieldClass} resize-none text-[12px] font-bold leading-[1.9] text-slate-600`} />
                            </section>
                        </div>
                    </>}
                    {activePage === 'contract' && <>
                        <section className={`${card} p-6`}>
                            <div className="mb-5 flex items-start justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[24px]" style={{ color: DOC_BLUE }}>nights_stay</span>
                                    <div>
                                        <p className="text-[13px] font-black leading-none" style={{ color: DOC_NAVY }}>몽골리아 은하수</p>
                                        <p className="mt-0.5 text-[8px] font-bold tracking-[0.22em] text-slate-400">{BRAND.nameEn.toUpperCase()}</p>
                                    </div>
                                </div>
                                <div className="rounded-lg bg-[#EAF3FF] px-3 py-2 text-[10px] font-black" style={{ color: '#1656D6' }}>계약일: 2026년 6월 4일</div>
                            </div>
                            <h3 className="text-center text-[28px] font-black tracking-[0.18em]" style={{ color: DOC_NAVY }}>여행 계약서</h3>
                            <p className="text-center text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: DOC_BLUE }}>Travel Contract</p>
                            {customer && (
                                <div className="mx-auto mt-3 flex max-w-[560px] items-start gap-2 rounded-xl border border-[#BBD9FF] bg-[#EAF3FF] px-3.5 py-2.5">
                                    <span className="material-symbols-outlined mt-px text-[16px]" style={{ color: '#1656D6' }}>info</span>
                                    <p className="text-[11px] font-bold leading-relaxed" style={{ color: '#1656D6' }}>
                                        여기서는 <b>취소 규정·결제·문구</b>만 편집합니다.
                                        고객이 작성한 <b>여행자 정보</b>와 배정된 <b>숙소·가이드 표</b>는 발송되는 계약서에 자동으로 합쳐집니다
                                        — 완성본은 「작성 내용 확인」에서 보세요.
                                    </p>
                                </div>
                            )}
                            <AutoTextarea value={settings.contract.intro} onChange={e => onDocSection('contract', { intro: e.target.value })} rows={3} className={`${fieldClass} mx-auto mt-4 block max-w-[520px] resize-none text-center text-[11.5px] font-semibold leading-relaxed text-slate-500`} />
                            <div className="mt-5 overflow-hidden rounded-xl border border-[#C7DCFF] text-xs">
                                {[['여행명', name || '은하수·대자연 패키지'], ['여행 기간', tripLength], ['여행 요금', `${won(samplePrice)}(1인)`], ['합계 금액', won(sampleTotal)], ['가이드', guideText], ['숙박', accommodationSummary]].map(([label, value]) => (
                                    <div key={label} className="grid grid-cols-[112px_1fr] border-b border-[#C7DCFF] last:border-b-0">
                                        <div className="bg-[#EAF3FF] px-3 py-2 font-black" style={{ color: '#1656D6' }}>{label}</div>
                                        <div className="px-3 py-2 font-semibold text-slate-700">{value}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-[#C7DCFF] p-3">
                                    <p className="flex items-center gap-1 text-xs font-black" style={{ color: '#1656D6' }}><span className="material-symbols-outlined text-[15px]">event_busy</span>취소 규정</p>
                                    <div className="mt-2 space-y-1">
                                        {settings.contract.cancellationRows.slice(0, 5).map((row, idx) => (
                                            <div key={idx} className="grid grid-cols-[1fr_90px] gap-1">
                                                <input value={row.period} onChange={e => onCancellation(idx, 'period', e.target.value)} className={`${fieldClass} text-[10px] font-semibold text-slate-500`} />
                                                <input value={row.fee} onChange={e => onCancellation(idx, 'fee', e.target.value)} className={`${fieldClass} text-[10px] font-semibold text-slate-500`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-[#C7DCFF] p-3">
                                    <p className="flex items-center gap-1 text-xs font-black" style={{ color: '#1656D6' }}><span className="material-symbols-outlined text-[15px]">payments</span>결제</p>
                                    <input value={settings.contract.paymentMethod} onChange={e => onDocSection('contract', { paymentMethod: e.target.value })} className={`${fieldClass} mt-2 text-[10px] font-semibold text-slate-500`} />
                                    <input value={settings.contract.paymentDeadline} onChange={e => onDocSection('contract', { paymentDeadline: e.target.value })} className={`${fieldClass} mt-1 text-[10px] font-semibold text-slate-500`} />
                                    <input value={settings.contract.signatureNote} onChange={e => onDocSection('contract', { signatureNote: e.target.value })} className={`${fieldClass} mt-3 text-[10px] font-semibold text-slate-500`} />
                                    <div className="mt-2 border-b border-slate-300 pb-1 text-[10px] text-slate-400">여행자 서명</div>
                                </div>
                            </div>
                        </section>
                    </>}
                    {activePage === 'detail' && <>
                        <div className="px-1">
                            <p className="text-[11px] font-black tracking-[0.18em]" style={{ color: DOC_BLUE }}>TOUR ITINERARY</p>
                            <div className="flex items-end justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                    <input value={settings.detail.title} onChange={e => onDocSection('detail', { title: e.target.value })} className={`${fieldClass} text-[24px] font-black text-[#0B1B45]`} />
                                </div>
                                <span className="mb-1 flex-none rounded-full px-3 py-1 text-[12px] font-black text-white" style={{ background: DOC_BLUE }}>총 {totalDays || 0}일</span>
                            </div>
                        </div>

                        {days.map((day, dayIdx) => {
                            if (focusDayIndex !== undefined && dayIdx !== focusDayIndex) return null;
                            const accommodation = getAccommodation(day.day);
                            const meals = day.meals || {};
                            return (
                                <article key={dayIdx} className={`${card} overflow-hidden`}>
                                    <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
                                        <span className="rounded-full px-4 py-1.5 text-[13px] font-black text-white" style={{ background: DOC_BLUE }}>DAY {day.day}</span>
                                        <input
                                            value={day.date || ''}
                                            onChange={e => onDayChange(dayIdx, 'date', e.target.value)}
                                            placeholder="날짜 자동 / 직접 입력"
                                            className={`${fieldClass} w-[140px] flex-none text-[11px] font-bold text-slate-400`}
                                        />
                                        <div className="min-w-[160px] flex-1">
                                            <input value={day.title} onChange={e => onDayChange(dayIdx, 'title', e.target.value)} placeholder={`${day.day}일차 제목`} className={`${fieldClass} text-[15px] font-black text-[#0B1B45]`} />
                                        </div>
                                        <span className="inline-flex w-[150px] flex-none items-center gap-1 text-[12px] font-black" style={{ color: DOC_BLUE }}>
                                            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
                                            <input value={day.region || ''} onChange={e => onDayChange(dayIdx, 'region', e.target.value)} placeholder="지역" className={`${fieldClass} text-[12px] font-black text-[#287DFA]`} />
                                        </span>
                                        <button onClick={() => onRemoveDay(dayIdx)} className="h-8 w-8 flex-none rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500" title="이 일차 삭제">
                                            <span className="material-symbols-outlined text-[17px]">delete</span>
                                        </button>
                                    </div>
                                    <div className="px-5 pt-2">
                                        <AutoTextarea value={day.summary || ''} onChange={e => onDayChange(dayIdx, 'summary', e.target.value)} rows={2} placeholder="이날의 여행 흐름과 고객에게 전달할 설명을 입력하세요." className={`${fieldClass} resize-y text-[12px] font-semibold leading-relaxed text-slate-500`} />
                                    </div>

                                    <div className="grid gap-4 px-5 py-4 lg:grid-cols-[1fr_170px]">
                                        <div>
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                <p className="flex items-center gap-1.5 text-[12.5px] font-black" style={{ color: DOC_BLUE }}>
                                                    <span className="material-symbols-outlined text-[17px]">event_note</span>일정
                                                </p>
                                                {onDayActivitiesText && (
                                                    <button
                                                        onClick={() => {
                                                            const text = prompt('한 줄에 하나씩 주요 일정을 붙여넣으세요.', day.activities.map(a => a.title).join('\n'));
                                                            if (text !== null) onDayActivitiesText(dayIdx, text);
                                                        }}
                                                        className="inline-flex items-center gap-1 text-[10px] font-black"
                                                        style={{ color: '#1656D6' }}
                                                    >
                                                        <span className="material-symbols-outlined text-[14px]">content_paste</span>여러 줄 붙여넣기
                                                    </button>
                                                )}
                                            </div>
                                            <ul className="space-y-2">
                                                {day.activities.map((activity, index) => (
                                                    <li
                                                        key={index}
                                                        onDragOver={e => {
                                                            if (!onMoveActivity || dragActivity === null || dragActivity.day !== dayIdx) return;
                                                            e.preventDefault();
                                                            if (dragActivity.idx === index) return;
                                                            onMoveActivity(dayIdx, dragActivity.idx, index);
                                                            setDragActivity({ day: dayIdx, idx: index });
                                                        }}
                                                        onDrop={() => setDragActivity(null)}
                                                        className={`rounded-xl bg-[#F4F8FF] p-2.5 ${dragActivity?.day === dayIdx && dragActivity.idx === index ? 'opacity-50' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            {onMoveActivity ? (
                                                                <span
                                                                    draggable
                                                                    onDragStart={() => setDragActivity({ day: dayIdx, idx: index })}
                                                                    onDragEnd={() => setDragActivity(null)}
                                                                    title="드래그하여 순서 변경"
                                                                    className="-ml-0.5 flex flex-none cursor-grab items-center text-slate-300 hover:text-slate-500 active:cursor-grabbing"
                                                                >
                                                                    <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
                                                                </span>
                                                            ) : (
                                                                <span className="ml-1 h-1.5 w-1.5 flex-none rounded-full" style={{ background: DOC_BLUE }} />
                                                            )}
                                                            <div className="w-[56px] flex-none">
                                                                <input value={activity.time || ''} onChange={e => onActivityChange(dayIdx, index, 'time', e.target.value)} placeholder="10:00" className={`${fieldClass} text-center text-[11px] font-black text-[#1656D6]`} />
                                                            </div>
                                                            <input value={activity.title} onChange={e => onActivityChange(dayIdx, index, 'title', e.target.value)} placeholder="주요 일정 (예: 공항 도착 및 가이드 미팅)" className={`${fieldClass} flex-1 text-[12.5px] font-bold text-[#0B1B45]`} />
                                                            {onPickSpot && <button onClick={() => onPickSpot(dayIdx, index)} className="h-7 flex-none rounded-lg border border-[#C7DCFF] bg-white px-2 text-[9px] font-black" style={{ color: '#1656D6' }}>관광지</button>}
                                                            {onUploadActivityImages && (
                                                                <label className="flex h-7 flex-none cursor-pointer items-center gap-0.5 rounded-lg border border-[#C7DCFF] bg-white px-2 text-[9px] font-black" style={{ color: '#1656D6' }} title="사진 추가">
                                                                    <span className="material-symbols-outlined text-[14px]">add_photo_alternate</span>사진
                                                                    <input type="file" accept="image/*" multiple className="hidden" onChange={e => { onUploadActivityImages(dayIdx, index, e.target.files); e.currentTarget.value = ''; }} />
                                                                </label>
                                                            )}
                                                            <button onClick={() => onRemoveActivity(dayIdx, index)} className="flex-none text-slate-300 hover:text-red-500" title="삭제"><span className="material-symbols-outlined text-[16px]">close</span></button>
                                                        </div>
                                                        <div className="pl-[18px]">
                                                            <AutoTextarea value={activity.description || ''} onChange={e => onActivityChange(dayIdx, index, 'description', e.target.value)} rows={2} placeholder="상세 설명 (선택)" className={`${fieldClass} mt-1 resize-y text-[10.5px] font-semibold leading-relaxed text-slate-500`} />
                                                            {(activity.images || []).length > 0 && (
                                                                <div className="mt-1.5 grid grid-cols-3 gap-2">
                                                                    {(activity.images || []).map((image, imageIndex) => (
                                                                        <div key={`${image}-${imageIndex}`} className="relative">
                                                                            <img src={image} alt="" className="h-16 w-full rounded-lg object-cover" />
                                                                            {onRemoveActivityImage && (
                                                                                <button type="button" onClick={() => onRemoveActivityImage(dayIdx, index, imageIndex)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white shadow" title="사진 삭제">
                                                                                    <span className="material-symbols-outlined text-[13px]">close</span>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                            <button onClick={() => onAddActivity(dayIdx)} className="mt-2 inline-flex items-center gap-1 text-[11px] font-black" style={{ color: '#1656D6' }}>
                                                <span className="material-symbols-outlined text-[15px]">add_circle</span>주요 일정 추가
                                            </button>
                                        </div>
                                        <div className="flex gap-2 lg:flex-col lg:justify-start lg:border-l lg:border-slate-100 lg:pl-4">
                                            {mealDefs.map(m => (
                                                <div key={m.key} className="flex flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 lg:flex-none">
                                                    <span className="material-symbols-outlined text-[20px]" style={{ color: m.color }}>{m.icon}</span>
                                                    <div className="min-w-0 flex-1 leading-tight">
                                                        <p className="text-[10px] font-black" style={{ color: m.color }}>{m.label}</p>
                                                        <input value={meals[m.key] || ''} onChange={e => onDayChange(dayIdx, 'meals', { ...meals, [m.key]: e.target.value })} placeholder="미정" className={`${fieldClass} text-[11.5px] font-bold text-slate-600`} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 border-t border-slate-100 bg-[#F4F8FF] px-5 py-3.5">
                                        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl text-white" style={{ background: DOC_BLUE }}>
                                            <span className="material-symbols-outlined text-[20px]">apartment</span>
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-[10.5px] font-black" style={{ color: DOC_BLUE }}>숙박 정보</p>
                                                <div className="flex items-center gap-3">
                                                    {onPickHotel && <button onClick={() => onPickHotel(dayIdx)} className="text-[10px] font-black" style={{ color: '#1656D6' }}>숙소 마스터에서 선택</button>}
                                                    {(accommodation?.name || accommodation?.location || dailyAccommodations?.some(x => x.day === dayIdx + 1 && x.accommodation?.name)) && (
                                                        <button
                                                            onClick={() => onClearHotel ? onClearHotel(dayIdx) : onDayChange(dayIdx, 'accommodation', null)}
                                                            className="inline-flex items-center gap-0.5 text-[10px] font-black text-slate-400 hover:text-red-500"
                                                            title="이 일차의 숙소 선택을 해제합니다"
                                                        >
                                                            <span className="material-symbols-outlined text-[13px]">close</span>선택 해제
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <input value={accommodation?.name || ''} onChange={e => onDayChange(dayIdx, 'accommodation', { ...(day.accommodation || {}), name: e.target.value })} placeholder="호텔 또는 게르명" className={`${fieldClass} text-[13px] font-black text-[#0B1B45]`} />
                                            {accommodation?.location && <p className="mt-0.5 text-[10px] font-semibold text-slate-400">({accommodation.location})</p>}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}

                        {days.length === 0 && <p className={`${card} py-8 text-center text-[11px] font-bold text-slate-400`}>아래 버튼으로 첫 번째 DAY를 추가하세요.</p>}
                        <button onClick={onAddDay} className="w-full rounded-2xl border-2 border-dashed border-[#9CC5FF] py-3 text-xs font-black transition-colors hover:bg-[#EAF3FF]" style={{ color: '#1656D6' }}>
                            <span className="material-symbols-outlined align-middle text-[16px]">add</span> DAY 추가
                        </button>

                        <div className="flex items-start gap-1 px-1">
                            <span className="pt-1 text-[11px] font-bold text-slate-400">※</span>
                            <div className="min-w-0 flex-1">
                                <AutoTextarea value={settings.detail.note} onChange={e => onDocSection('detail', { note: e.target.value })} rows={2} className={`${fieldClass} resize-none text-[11px] font-bold leading-relaxed text-slate-400`} />
                            </div>
                        </div>
                    </>}
                    {activePage === 'guide' && <>
                        <section className={`${card} p-5`}>
                            {secTitle('info', '안내·유의 사항')}
                            <div className="grid gap-3 sm:grid-cols-2">
                                {settings.guide.notices.slice(0, 5).map((item, idx) => (
                                    <div key={idx} className="flex gap-2.5 rounded-xl bg-slate-50 p-3.5">
                                        <span className="material-symbols-outlined mt-px text-[19px]" style={{ color: DOC_BLUE }}>info</span>
                                        <div className="min-w-0 flex-1">
                                            <input value={item.title} onChange={e => onGuideNotice(idx, 'title', e.target.value)} className={`${fieldClass} text-[12.5px] font-black text-[#0B1B45]`} />
                                            <AutoTextarea value={item.body} onChange={e => onGuideNotice(idx, 'body', e.target.value)} rows={2} className={`${fieldClass} mt-1 resize-none text-[11.5px] font-semibold leading-relaxed text-slate-500`} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <section className={`${card} p-5`}>
                                {secTitle('gavel', '여행 조건(요약)')}
                                <AutoTextarea value={settings.guide.conditions} onChange={e => onDocSection('guide', { conditions: e.target.value })} rows={5} className={`${fieldClass} resize-none text-[11.5px] font-semibold leading-relaxed text-slate-500`} />
                            </section>
                            <section className={`${card} p-5`}>
                                {secTitle('payments', '여행 요금 결제')}
                                <AutoTextarea value={settings.guide.paymentInfo} onChange={e => onDocSection('guide', { paymentInfo: e.target.value })} rows={5} className={`${fieldClass} resize-none text-[11.5px] font-semibold leading-relaxed text-slate-500`} />
                            </section>
                        </div>

                        <section className={`${card} p-5`}>
                            {secTitle('call', '긴급 연락처')}
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="rounded-2xl border border-slate-100 p-3.5 text-center">
                                    <span className="material-symbols-outlined text-[26px]" style={{ color: DOC_BLUE }}>support_agent</span>
                                    <p className="mt-1 text-[10.5px] font-black text-slate-400">당사 (현지·한국어)</p>
                                    <input value={settings.guide.emergencyPhone} onChange={e => onDocSection('guide', { emergencyPhone: e.target.value })} className={`${fieldClass} text-center text-[12px] font-black text-[#0B1B45]`} />
                                    <p className="text-[10px] font-bold text-slate-400">24시간 응대</p>
                                </div>
                                <div className="rounded-2xl border border-slate-100 p-3.5 text-center">
                                    <span className="material-symbols-outlined text-[26px]" style={{ color: DOC_BLUE }}>mail</span>
                                    <p className="mt-1 text-[10.5px] font-black text-slate-400">이메일</p>
                                    <input value={settings.guide.emergencyEmail} onChange={e => onDocSection('guide', { emergencyEmail: e.target.value })} className={`${fieldClass} text-center text-[11px] font-black text-[#0B1B45]`} />
                                    <p className="text-[10px] font-bold text-slate-400">상시 접수</p>
                                </div>
                                <div className="rounded-2xl border border-slate-100 p-3.5 text-center">
                                    <span className="material-symbols-outlined text-[26px]" style={{ color: DOC_BLUE }}>emergency</span>
                                    <p className="mt-1 text-[10.5px] font-black text-slate-400">구급</p>
                                    <p className="text-[12.5px] font-black" style={{ color: DOC_NAVY }}>103</p>
                                    <p className="text-[10px] font-bold text-slate-400">(현지)</p>
                                </div>
                                <div className="rounded-2xl border border-slate-100 p-3.5 text-center">
                                    <span className="material-symbols-outlined text-[26px]" style={{ color: DOC_BLUE }}>local_police</span>
                                    <p className="mt-1 text-[10.5px] font-black text-slate-400">경찰</p>
                                    <p className="text-[12.5px] font-black" style={{ color: DOC_NAVY }}>102</p>
                                    <p className="text-[10px] font-bold text-slate-400">(현지)</p>
                                </div>
                            </div>
                        </section>

                        <div className="relative overflow-hidden rounded-2xl">
                            <img src={mongoliaHero} alt="" className="h-[120px] w-full object-cover" />
                            <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(11,27,69,0.92) 0%, rgba(40,125,250,0.45) 100%)' }} />
                            <div className="absolute inset-x-5 top-6">
                                <input value={settings.guide.closingMessage} onChange={e => onDocSection('guide', { closingMessage: e.target.value })} className={`${heroFieldClass} max-w-[420px] text-[15px] font-black text-white`} />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 py-2 text-[10px] font-bold text-white" style={{ background: 'rgba(11,27,69,0.85)' }}>
                                <span>{BRAND.name} | {BRAND.nameEn.toUpperCase()}</span>
                                <span>{settings.guide.emergencyEmail}</span>
                            </div>
                        </div>
                    </>}
                </div>
            </div>
        </div>
    );
};

type ProductStyleItineraryEditorProps = {
    days: TemplateDay[];
    quickDays: number;
    onQuickDaysChange: (value: number) => void;
    onCreateSkeleton: () => void;
    onAddDay: () => void;
    onUpdateDay: (dayIdx: number, field: keyof TemplateDay, value: any) => void;
    onMoveDay: (dayIdx: number, direction: -1 | 1) => void;
    onDuplicateDay: (dayIdx: number) => void;
    onRemoveDay: (dayIdx: number) => void;
    onAddActivity: (dayIdx: number, type: ActivityType) => void;
    onUpdateActivity: (dayIdx: number, activityIdx: number, field: keyof Activity, value: any) => void;
    onMoveActivity: (dayIdx: number, activityIdx: number, direction: -1 | 1) => void;
    onRemoveActivity: (dayIdx: number, activityIdx: number) => void;
    onRemoveActivityImage: (dayIdx: number, activityIdx: number, imageIdx: number) => void;
    onUploadActivityImages: (dayIdx: number, activityIdx: number, files: FileList | null) => void;
    onPickSpot: (dayIdx: number, activityIdx: number) => void;
    onPickHotelActivity: (dayIdx: number, activityIdx: number) => void;
    onPickDayHotel: (dayIdx: number) => void;
};

const ProductStyleItineraryEditor: React.FC<ProductStyleItineraryEditorProps> = ({
    days,
    quickDays,
    onQuickDaysChange,
    onCreateSkeleton,
    onAddDay,
    onUpdateDay,
    onMoveDay,
    onDuplicateDay,
    onRemoveDay,
    onAddActivity,
    onUpdateActivity,
    onMoveActivity,
    onRemoveActivity,
    onRemoveActivityImage,
    onUploadActivityImages,
    onPickSpot,
    onPickHotelActivity,
    onPickDayHotel,
}) => {
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);

    useEffect(() => {
        setSelectedDayIndex(current => Math.max(0, Math.min(current, days.length - 1)));
    }, [days.length]);

    const selectedDay = days[selectedDayIndex];
    const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-[#287DFA] focus:ring-2 focus:ring-[#287DFA]/15';
    const iconButtonClass = 'flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-[#9CC5FF] hover:text-[#1656D6] disabled:cursor-not-allowed disabled:opacity-30';

    return (
        <div className="grid h-full grid-cols-[230px_minmax(580px,1fr)_260px] overflow-hidden bg-[#F7FAFA] max-xl:grid-cols-[210px_minmax(520px,1fr)] max-lg:block max-lg:overflow-y-auto">
            <aside className="overflow-y-auto border-r border-slate-200 bg-white p-4 max-lg:border-b max-lg:border-r-0">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-black text-amber-900">N일 일정 골격 만들기</p>
                    <p className="mt-1 text-[10px] font-semibold leading-relaxed text-amber-700">상품관리 일정탭과 같은 방식으로 DAY를 먼저 생성합니다.</p>
                    <div className="mt-3 flex gap-2">
                        <select
                            value={quickDays}
                            onChange={event => onQuickDaysChange(Number(event.target.value))}
                            className="h-9 flex-1 rounded-lg border border-amber-200 bg-white px-2 text-xs font-black text-slate-700 outline-none"
                        >
                            {Array.from({ length: 14 }, (_, index) => index + 1).map(day => <option key={day} value={day}>{day}일</option>)}
                        </select>
                        <button type="button" onClick={onCreateSkeleton} className="h-9 rounded-lg bg-amber-500 px-3 text-xs font-black text-white hover:bg-amber-600">생성</button>
                    </div>
                </div>

                <div className="mb-3 mt-5 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">일정 구성</p>
                        <p className="mt-1 text-base font-black text-slate-900">{days.length}일 일정</p>
                    </div>
                    <button type="button" onClick={onAddDay} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1656D6] text-white" title="DAY 추가">
                        <span className="material-symbols-outlined text-[18px]">add</span>
                    </button>
                </div>

                <div className="space-y-2">
                    {days.map((day, index) => (
                        <button
                            key={`${day.day}-${index}`}
                            type="button"
                            onClick={() => setSelectedDayIndex(index)}
                            className={`w-full rounded-xl border p-3 text-left transition ${selectedDayIndex === index ? 'border-[#287DFA] bg-[#EAF3FF] shadow-sm' : 'border-slate-200 bg-white hover:border-[#9CC5FF]'}`}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-[#1656D6]">DAY {day.day}</span>
                                <span className="text-[9px] font-bold text-slate-400">{day.activities.length}개 일정</span>
                            </div>
                            <p className="mt-1 truncate text-xs font-black text-slate-800">{day.title || '일차 제목을 입력하세요'}</p>
                            <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">{[day.date, day.region].filter(Boolean).join(' · ') || '날짜·지역 미정'}</p>
                        </button>
                    ))}
                    {days.length === 0 && (
                        <button type="button" onClick={onCreateSkeleton} className="w-full rounded-xl border-2 border-dashed border-[#9CC5FF] px-3 py-8 text-xs font-black text-[#1656D6]">
                            일정 골격 생성
                        </button>
                    )}
                </div>
            </aside>

            <main className="min-w-0 overflow-y-auto p-5">
                {!selectedDay ? (
                    <div className="flex min-h-[420px] items-center justify-center rounded-2xl border-2 border-dashed border-[#9CC5FF] bg-white text-center">
                        <div>
                            <span className="material-symbols-outlined text-4xl text-[#287DFA]">calendar_add_on</span>
                            <p className="mt-3 text-sm font-black text-slate-800">먼저 여행 일수를 선택해 일정 골격을 생성하세요.</p>
                            <p className="mt-1 text-xs font-semibold text-slate-400">생성 후 일차별 제목, 일정, 식사와 숙소를 입력할 수 있습니다.</p>
                        </div>
                    </div>
                ) : (
                    <section className="overflow-hidden rounded-2xl border border-[#9CC5FF] bg-white shadow-sm">
                        <header className="flex items-start gap-3 border-b border-[#9CC5FF] bg-[#EAF3FF]/50 p-4">
                            <div className="flex h-14 w-16 flex-shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-[#1656D6] to-[#287DFA] text-white">
                                <span className="text-xs font-black">DAY {selectedDay.day}</span>
                                <span className="mt-0.5 text-[9px] font-bold text-white/80">{selectedDay.day}일차</span>
                            </div>
                            <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[130px_170px_1fr]">
                                <input value={selectedDay.date || ''} onChange={event => onUpdateDay(selectedDayIndex, 'date', event.target.value)} placeholder="날짜 (예: 06/10)" className={inputClass} />
                                <input value={selectedDay.region || ''} onChange={event => onUpdateDay(selectedDayIndex, 'region', event.target.value)} placeholder="지역 (예: 울란바토르)" className={inputClass} />
                                <input value={selectedDay.title} onChange={event => onUpdateDay(selectedDayIndex, 'title', event.target.value)} placeholder="일정 제목 (예: 공항 도착 및 시내 이동)" className={`${inputClass} font-black`} />
                            </div>
                            <div className="flex flex-shrink-0 gap-1">
                                <button type="button" onClick={() => onMoveDay(selectedDayIndex, -1)} disabled={selectedDayIndex === 0} className={iconButtonClass} title="앞으로 이동"><Icon name="arrow_upward" /></button>
                                <button type="button" onClick={() => onMoveDay(selectedDayIndex, 1)} disabled={selectedDayIndex === days.length - 1} className={iconButtonClass} title="뒤로 이동"><Icon name="arrow_downward" /></button>
                                <button type="button" onClick={() => onDuplicateDay(selectedDayIndex)} className={iconButtonClass} title="일차 복제"><Icon name="content_copy" /></button>
                                <button type="button" onClick={() => onRemoveDay(selectedDayIndex)} className={`${iconButtonClass} hover:border-rose-200 hover:text-rose-500`} title="일차 삭제"><Icon name="delete" /></button>
                            </div>
                        </header>

                        <div className="p-5">
                            <label className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">여행 소개</label>
                            <textarea
                                value={selectedDay.summary || ''}
                                onChange={event => onUpdateDay(selectedDayIndex, 'summary', event.target.value)}
                                rows={3}
                                placeholder="이날의 여행 흐름과 고객에게 전달할 설명을 입력하세요."
                                className={`${inputClass} mt-2 resize-y leading-relaxed`}
                            />

                            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-black text-slate-900">주요 일정</p>
                                    <p className="mt-0.5 text-[10px] font-semibold text-slate-400">시간 없이 방문지와 이동 흐름을 순서대로 구성합니다.</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {([
                                        ['sightseeing', 'add_location_alt', '관광 일정'],
                                        ['transport', 'directions_car', '이동'],
                                        ['activity', 'hiking', '체험'],
                                        ['free', 'park', '자유 일정'],
                                    ] as Array<[ActivityType, string, string]>).map(([type, icon, label]) => (
                                        <button key={type} type="button" onClick={() => onAddActivity(selectedDayIndex, type)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 hover:border-[#287DFA] hover:text-[#1656D6]">
                                            <span className="material-symbols-outlined text-[16px]">{icon}</span>{label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 space-y-3">
                                {selectedDay.activities.map((activity, activityIdx) => (
                                    <article key={activityIdx} className="rounded-2xl border border-slate-200 bg-[#F7FAFA] p-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#EAF3FF] text-[#1656D6]">
                                                <span className="material-symbols-outlined text-[19px]">{TYPE_MAP[activity.type || 'sightseeing']?.icon || 'place'}</span>
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="grid gap-2 sm:grid-cols-[130px_1fr]">
                                                    <select value={activity.type || 'sightseeing'} onChange={event => onUpdateActivity(selectedDayIndex, activityIdx, 'type', event.target.value as ActivityType)} className={inputClass}>
                                                        {ACTIVITY_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                                                    </select>
                                                    <input value={activity.title} onChange={event => onUpdateActivity(selectedDayIndex, activityIdx, 'title', event.target.value)} placeholder="일정 제목" className={`${inputClass} font-black`} />
                                                </div>
                                                <textarea value={activity.description || ''} onChange={event => onUpdateActivity(selectedDayIndex, activityIdx, 'description', event.target.value)} rows={2} placeholder="상세 설명 (선택)" className={`${inputClass} mt-2 resize-y text-xs leading-relaxed`} />
                                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                                    <button type="button" onClick={() => onPickSpot(selectedDayIndex, activityIdx)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#9CC5FF] bg-white px-2.5 text-[10px] font-black text-[#1656D6]"><Icon name="location_on" />관광지에서 선택</button>
                                                    <button type="button" onClick={() => onPickHotelActivity(selectedDayIndex, activityIdx)} className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-black text-slate-600"><Icon name="hotel" />호텔에서 선택</button>
                                                    <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-black text-slate-600">
                                                        <Icon name="add_photo_alternate" />사진 추가
                                                        <input type="file" accept="image/*" multiple className="hidden" onChange={event => onUploadActivityImages(selectedDayIndex, activityIdx, event.target.files)} />
                                                    </label>
                                                </div>
                                                {(activity.images || []).length > 0 && (
                                                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                                                        {(activity.images || []).map((image, imageIdx) => (
                                                            <div key={`${image}-${imageIdx}`} className="relative flex-none">
                                                                <img src={image} alt="" className="h-20 w-28 rounded-xl object-cover" />
                                                                <button type="button" onClick={() => onRemoveActivityImage(selectedDayIndex, activityIdx, imageIdx)} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white"><Icon name="close" style={{ fontSize: 13 }} /></button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-shrink-0 flex-col gap-1">
                                                <button type="button" onClick={() => onMoveActivity(selectedDayIndex, activityIdx, -1)} disabled={activityIdx === 0} className={iconButtonClass} title="위로"><Icon name="arrow_upward" /></button>
                                                <button type="button" onClick={() => onMoveActivity(selectedDayIndex, activityIdx, 1)} disabled={activityIdx === selectedDay.activities.length - 1} className={iconButtonClass} title="아래로"><Icon name="arrow_downward" /></button>
                                                <button type="button" onClick={() => onRemoveActivity(selectedDayIndex, activityIdx)} className={`${iconButtonClass} hover:border-rose-200 hover:text-rose-500`} title="삭제"><Icon name="delete" /></button>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                                {selectedDay.activities.length === 0 && (
                                    <button type="button" onClick={() => onAddActivity(selectedDayIndex, 'sightseeing')} className="w-full rounded-2xl border-2 border-dashed border-[#9CC5FF] py-8 text-xs font-black text-[#1656D6] hover:bg-[#EAF3FF]">
                                        <Icon name="add_circle" /> 첫 일정 항목 추가
                                    </button>
                                )}
                            </div>

                            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                                <div className="rounded-2xl border border-slate-200 p-4">
                                    <p className="flex items-center gap-1.5 text-sm font-black text-slate-900"><Icon name="restaurant" />식사 정보</p>
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                        {([
                                            ['breakfast', '조식'],
                                            ['lunch', '중식'],
                                            ['dinner', '석식'],
                                        ] as const).map(([key, label]) => (
                                            <label key={key} className="rounded-xl bg-slate-50 p-2">
                                                <span className="text-[9px] font-black text-slate-400">{label}</span>
                                                <input value={selectedDay.meals?.[key] || ''} onChange={event => onUpdateDay(selectedDayIndex, 'meals', { ...(selectedDay.meals || {}), [key]: event.target.value })} placeholder="미정" className="mt-1 w-full bg-transparent text-xs font-bold text-slate-700 outline-none" />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="flex items-center gap-1.5 text-sm font-black text-slate-900"><Icon name="hotel" />숙소 정보</p>
                                        <button type="button" onClick={() => onPickDayHotel(selectedDayIndex)} className="text-[10px] font-black text-[#1656D6]">호텔 마스터에서 선택</button>
                                    </div>
                                    <input value={selectedDay.accommodation?.name || ''} onChange={event => onUpdateDay(selectedDayIndex, 'accommodation', { ...(selectedDay.accommodation || {}), name: event.target.value })} placeholder="호텔 또는 게르명" className={`${inputClass} mt-3`} />
                                    {selectedDay.accommodation?.location && <p className="mt-2 text-[10px] font-semibold text-slate-400">{selectedDay.accommodation.location}</p>}
                                </div>
                            </div>
                        </div>
                    </section>
                )}
            </main>

            <aside className="overflow-y-auto border-l border-slate-200 bg-white p-4 max-xl:hidden">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">일정 요약</p>
                <div className="mt-3 rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-slate-800">전체 일정</span>
                        <span className="rounded-full bg-[#EAF3FF] px-2 py-1 text-[10px] font-black text-[#1656D6]">{days.length}일</span>
                    </div>
                    <dl className="mt-4 space-y-3 text-[11px]">
                        <div className="flex justify-between gap-3"><dt className="font-bold text-slate-400">주요 일정</dt><dd className="font-black text-slate-700">{days.reduce((sum, day) => sum + day.activities.length, 0)}개</dd></div>
                        <div className="flex justify-between gap-3"><dt className="font-bold text-slate-400">숙소 입력</dt><dd className="font-black text-slate-700">{days.filter(day => day.accommodation?.name).length}일</dd></div>
                        <div className="flex justify-between gap-3"><dt className="font-bold text-slate-400">식사 입력</dt><dd className="font-black text-slate-700">{days.filter(day => Object.values(day.meals || {}).some(Boolean)).length}일</dd></div>
                    </dl>
                </div>
                {selectedDay && (
                    <div className="mt-4 rounded-2xl border border-[#9CC5FF] bg-[#F7FAFA] p-4">
                        <p className="text-[10px] font-black text-[#1656D6]">현재 DAY {selectedDay.day}</p>
                        <p className="mt-2 text-sm font-black text-slate-900">{selectedDay.title || '제목 미입력'}</p>
                        <p className="mt-1 text-[10px] font-semibold text-slate-400">{[selectedDay.date, selectedDay.region].filter(Boolean).join(' · ') || '날짜·지역 미정'}</p>
                        <div className="mt-4 space-y-2">
                            {selectedDay.activities.slice(0, 5).map((activity, index) => (
                                <div key={index} className="flex items-start gap-2 text-[10px] font-semibold text-slate-600">
                                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#287DFA]" />
                                    <span>{activity.title || '일정 제목 미입력'}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </aside>
        </div>
    );
};

const ProductDayInfoItineraryEditor: React.FC<ProductStyleItineraryEditorProps> = ({
    days,
    quickDays,
    onQuickDaysChange,
    onCreateSkeleton,
    onAddDay,
    onUpdateDay,
    onMoveDay,
    onDuplicateDay,
    onRemoveDay,
    onAddActivity,
    onUpdateActivity,
    onMoveActivity,
    onRemoveActivity,
    onRemoveActivityImage,
    onUploadActivityImages,
    onPickSpot,
    onPickHotelActivity,
    onPickDayHotel,
}) => {
    const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
    const toggleDayCollapsed = (day: number) => {
        setCollapsedDays(previous => {
            const next = new Set(previous);
            if (next.has(day)) next.delete(day);
            else next.add(day);
            return next;
        });
    };

    return (
    <div className="h-full overflow-y-auto bg-[#F7FAFA] p-5">
        <div className="mx-auto max-w-[980px]">
            <div className="mb-4 rounded-2xl border border-[#B9ECE7] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-[230px] flex-1">
                        <p className="text-sm font-black text-slate-900">여행 일수 먼저 만들기</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">여행 일수를 선택하면 날짜별 카드가 한 번에 생성됩니다.</p>
                    </div>
                    <select value={quickDays} onChange={event => onQuickDaysChange(Number(event.target.value))} className="select h-10 min-w-[100px]">
                        {Array.from({ length: 14 }, (_, index) => index + 1).map(day => <option key={day} value={day}>{day}일</option>)}
                    </select>
                    <button type="button" onClick={onCreateSkeleton} className="btn btn-ink"><Icon name="calendar_add_on" />일정 생성</button>
                    <button type="button" onClick={onAddDay} className="btn btn-ghost"><Icon name="add" />DAY 추가</button>
                </div>
            </div>

            <div className="stack" style={{ gap: 18 }}>
                {days.map((day, dayIdx) => {
                    const collapsed = collapsedDays.has(day.day);
                    return (
                    <section key={`${day.day}-${dayIdx}`} className="overflow-hidden rounded-2xl border border-[#B9ECE7] bg-white shadow-sm">
                        <div className="flex flex-wrap items-center gap-2 border-b border-[#DDF4F1] bg-[#F1FBFA] px-4 py-3" data-template-day={day.day}>
                            <button type="button" onClick={() => toggleDayCollapsed(day.day)} className="act-btn" title={collapsed ? '펼치기' : '접기'}>
                                <Icon name={collapsed ? 'expand_more' : 'expand_less'} />
                            </button>
                            <span className="inline-flex min-w-[68px] items-center justify-center rounded-lg bg-[#1656D6] px-3 py-2 text-xs font-black text-white">DAY {day.day}</span>
                            <div className="min-w-[260px] flex-1">
                                <input className="inp font-bold" value={day.title || ''} onChange={event => onUpdateDay(dayIdx, 'title', event.target.value)} placeholder="일정 제목 (예: 울란바토르 → 테를지)" />
                            </div>
                            <input className="inp w-full sm:w-[130px]" value={day.date || ''} onChange={event => onUpdateDay(dayIdx, 'date', event.target.value)} placeholder="날짜 (05/26)" />
                            {collapsed && <span className="whitespace-nowrap text-xs font-bold text-slate-500">일정 {day.activities.length}개</span>}
                            <div className="edit-move">
                                <button type="button" onClick={() => onMoveDay(dayIdx, -1)} disabled={dayIdx === 0}><Icon name="expand_less" /></button>
                                <button type="button" onClick={() => onMoveDay(dayIdx, 1)} disabled={dayIdx === days.length - 1}><Icon name="expand_more" /></button>
                            </div>
                            <button type="button" onClick={() => onDuplicateDay(dayIdx)} className="act-btn" title="일차 복제"><Icon name="content_copy" /></button>
                            <button type="button" onClick={() => onRemoveDay(dayIdx)} className="act-btn danger" title="일차 삭제"><Icon name="delete" /></button>
                        </div>

                        {!collapsed && (
                            <div className="p-4">
                                <div className="mt-3">
                                    <label className="muted mb-1 block text-xs">주요 일정 요약</label>
                                    <textarea className="inp min-h-[76px] resize-y" value={day.summary || ''} onChange={event => onUpdateDay(dayIdx, 'summary', event.target.value)} placeholder="이날의 이동 동선과 고객에게 전달할 핵심 내용을 입력하세요." />
                                </div>

                                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                                    <div>
                                        <label className="cell-strong mb-2 block text-xs"><Icon name="restaurant" style={{ fontSize: 16 }} /> 식사 정보</label>
                                        <div className="meal-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                                            {([['breakfast', '조식'], ['lunch', '중식'], ['dinner', '석식']] as const).map(([key, label]) => (
                                                <div key={key} className="inp-mini">
                                                    <span className="pre text-[11px]">{label}</span>
                                                    <input value={day.meals?.[key] || ''} onChange={event => onUpdateDay(dayIdx, 'meals', { ...(day.meals || {}), [key]: event.target.value })} placeholder="미정" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="row mb-2">
                                            <label className="cell-strong text-xs"><Icon name="hotel" style={{ fontSize: 16 }} /> 숙소 정보</label>
                                            <span className="spacer" />
                                            <button type="button" onClick={() => onPickDayHotel(dayIdx)} className="btn btn-ghost btn-sm"><Icon name="hotel" />호텔 마스터에서 선택</button>
                                        </div>
                                        <div className="inp-mini">
                                            <span className="pre"><Icon name="hotel" style={{ fontSize: 14 }} /></span>
                                            <input value={day.accommodation?.name || ''} onChange={event => onUpdateDay(dayIdx, 'accommodation', { ...(day.accommodation || {}), name: event.target.value })} placeholder="숙소명 또는 호텔 마스터 선택" />
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 border-t border-slate-100 pt-4">
                                    <div className="mb-3 flex flex-wrap items-center gap-2">
                                        <span className="mr-auto text-xs font-black text-slate-900">주요 일정</span>
                                        {([
                                            ['sightseeing', 'add_location', '관광'],
                                            ['transport', 'directions_car', '이동'],
                                            ['activity', 'hiking', '체험'],
                                            ['free', 'park', '자유 일정'],
                                        ] as const).map(([type, icon, label]) => (
                                            <button key={type} type="button" onClick={() => onAddActivity(dayIdx, type)} className="btn btn-ghost btn-sm">
                                                <Icon name={icon} />{label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="stack" style={{ gap: 10 }}>
                                        {day.activities.map((activity, activityIdx) => (
                                            <div key={activityIdx} className="edit-row bg-slate-50" data-template-activity={`${day.day}-${activityIdx}`}>
                                                <div className="edit-move">
                                                    <button type="button" onClick={() => onMoveActivity(dayIdx, activityIdx, -1)} disabled={activityIdx === 0}><Icon name="expand_less" /></button>
                                                    <button type="button" onClick={() => onMoveActivity(dayIdx, activityIdx, 1)} disabled={activityIdx === day.activities.length - 1}><Icon name="expand_more" /></button>
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="row mb-3 flex-wrap" style={{ gap: 8 }}>
                                                        <span className="badge b-gray">일정 {activityIdx + 1}</span>
                                                        <span className="spacer" />
                                                        <button type="button" onClick={() => onPickSpot(dayIdx, activityIdx)} className="btn btn-blue btn-sm"><Icon name="location_on" />관광지 선택</button>
                                                        <button type="button" onClick={() => onPickHotelActivity(dayIdx, activityIdx)} className="btn btn-ghost btn-sm"><Icon name="hotel" />호텔 선택</button>
                                                        <label className="btn btn-ghost btn-sm cursor-pointer">
                                                            <Icon name="add_photo_alternate" />사진 추가
                                                            <input type="file" accept="image/*" multiple className="hidden" onChange={event => onUploadActivityImages(dayIdx, activityIdx, event.target.files)} />
                                                        </label>
                                                    </div>
                                                    <div className="row" style={{ gap: 8 }}>
                                                        <select className="select w-[140px]" value={activity.type || 'sightseeing'} onChange={event => onUpdateActivity(dayIdx, activityIdx, 'type', event.target.value as ActivityType)}>
                                                            {ACTIVITY_TYPES.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
                                                        </select>
                                                        <input className="inp flex-1 font-bold" value={activity.title || ''} onChange={event => onUpdateActivity(dayIdx, activityIdx, 'title', event.target.value)} placeholder="일정 제목" />
                                                    </div>
                                                    <textarea className="inp mt-2" rows={2} value={activity.description || ''} onChange={event => onUpdateActivity(dayIdx, activityIdx, 'description', event.target.value)} placeholder="고객에게 보여줄 상세 설명" />
                                                    {(activity.images || []).length > 0 && (
                                                        <div className="row mt-3 overflow-x-auto pb-2" style={{ gap: 8 }}>
                                                            {(activity.images || []).map((image, imageIdx) => (
                                                                <div key={`${image}-${imageIdx}`} className="relative flex-none">
                                                                    <img src={image} alt="" className="h-20 w-20 rounded-lg border border-slate-200 object-cover" />
                                                                    <button type="button" onClick={() => onRemoveActivityImage(dayIdx, activityIdx, imageIdx)} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border-0 bg-rose-500 text-white"><Icon name="close" style={{ fontSize: 13 }} /></button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <button type="button" onClick={() => onRemoveActivity(dayIdx, activityIdx)} className="act-btn danger" title="일정 삭제"><Icon name="delete" /></button>
                                            </div>
                                        ))}
                                    </div>

                                    <button type="button" onClick={() => onAddActivity(dayIdx, 'sightseeing')} className="add-line mt-3">
                                        <Icon name="add_circle" />일정 항목 추가
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>
                    );
                })}

                {days.length === 0 && (
                    <button type="button" onClick={onCreateSkeleton} className="min-h-[280px] w-full rounded-2xl border-2 border-dashed border-[#9CC5FF] bg-white text-sm font-black text-[#1656D6]">
                        <Icon name="calendar_add_on" /> 일정 골격 생성
                    </button>
                )}
            </div>
        </div>
    </div>
    );
};

// ─── Tab: Itinerary Templates ────────────────────────────
const TemplatesTab: React.FC = () => {
    const [templates, setTemplates] = useState<ItineraryTemplate[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<ItineraryTemplate | null>(null);
    const [form, setForm] = useState<{ name: string; description: string; days: TemplateDay[]; documentSettings: DocumentSettings }>({
        name: '',
        description: '',
        days: [],
        documentSettings: defaultDocumentSettings(),
    });
    const [quickDays, setQuickDays] = useState(4);
    const [editorMode, setEditorMode] = useState<'itinerary' | 'documents'>('itinerary');
    const [spotPickerTarget, setSpotPickerTarget] = useState<{ d: number; a: number } | null>(null);
    const [hotelPickerTarget, setHotelPickerTarget] = useState<{ d: number; a: number } | null>(null);
    const [dayHotelTarget, setDayHotelTarget] = useState<number | null>(null);

    const load = async () => {
        try {
            const data = await api.itineraryTemplates.list();
            if (Array.isArray(data)) {
                setTemplates(data.map((t: any) => {
                    const decoded = decodeTemplateDescription(t.description || '');
                    return {
                        id: t.id,
                        name: t.name,
                        description: decoded.description,
                        documentSettings: decoded.documentSettings,
                        days: typeof t.days === 'string' ? JSON.parse(t.days || '[]') : (t.days || []),
                        createdAt: t.created_at || t.createdAt
                    };
                }));
            }
        } catch (e) { console.error(e); }
    };

    useEffect(() => { load(); }, []);

    const resetForm = () => { setForm({ name: '', description: '', days: [], documentSettings: defaultDocumentSettings() }); setEditing(null); setQuickDays(4); setEditorMode('itinerary'); };

    const inferActivityType = (text: string): ActivityType => {
        const value = text.toLowerCase();
        if (/(공항|픽업|도착|미팅|arrival|airport)/i.test(value)) return 'pickup';
        if (/(이동|출발|전용차|차량|버스|transfer|drive)/i.test(value)) return 'transport';
        if (/(식사|조식|중식|석식|점심|저녁|아침|meal|lunch|dinner|breakfast)/i.test(value)) return 'meal';
        if (/(숙박|호텔|게르|체크인|hotel|stay|check[-\s]?in)/i.test(value)) return 'checkin';
        if (/(체험|승마|낙타|트레킹|공연|activity|experience)/i.test(value)) return 'activity';
        if (/(자유|휴식|free)/i.test(value)) return 'free';
        return 'sightseeing';
    };

    const createBlankDays = (days = quickDays) => {
        const count = Math.max(1, Math.min(14, days || 1));
        setForm(f => ({
            ...f,
            days: Array.from({ length: count }, (_, idx) => ({
                day: idx + 1,
                title: f.days[idx]?.title || '',
                date: f.days[idx]?.date || '',
                region: f.days[idx]?.region || '',
                summary: f.days[idx]?.summary || '',
                activities: f.days[idx]?.activities || [],
                meals: f.days[idx]?.meals || { breakfast: '', lunch: '', dinner: '' },
                accommodation: f.days[idx]?.accommodation || null,
            })),
        }));
    };

    // Day operations
    const addDay = () => setForm(f => ({ ...f, days: [...f.days, { day: f.days.length + 1, title: '', region: '', summary: '', activities: [], meals: {}, accommodation: null }] }));
    const removeDay = (idx: number) => setForm(f => ({ ...f, days: f.days.filter((_, i) => i !== idx).map((d, i) => ({ ...d, day: i + 1 })) }));
    const updateDay = (idx: number, field: keyof TemplateDay, value: any) => setForm(f => { const d = [...f.days]; d[idx] = { ...d[idx], [field]: value }; return { ...f, days: d }; });
    const moveDay = (idx: number, dir: -1 | 1) => setForm(f => {
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= f.days.length) return f;
        const d = [...f.days];
        [d[idx], d[newIdx]] = [d[newIdx], d[idx]];
        return { ...f, days: d.map((x, i) => ({ ...x, day: i + 1 })) };
    });
    const duplicateDay = (idx: number) => setForm(f => {
        const src = f.days[idx];
        const copy = {
            ...src,
            meals: { ...(src.meals || {}) },
            accommodation: src.accommodation ? { ...src.accommodation, images: [...(src.accommodation.images || [])] } : null,
            activities: src.activities.map(a => ({ ...a, images: [...(a.images || [])] })),
        };
        const d = [...f.days.slice(0, idx + 1), copy, ...f.days.slice(idx + 1)];
        return { ...f, days: d.map((x, i) => ({ ...x, day: i + 1 })) };
    });

    // Activity operations
    const addActivity = (dayIdx: number) => setForm(f => { const d = [...f.days]; d[dayIdx].activities = [...d[dayIdx].activities, { time: '', type: 'sightseeing', title: '', description: '' }]; return { ...f, days: d }; });
    // 유형을 지정해 빈 항목 추가 (이동/식사/직접입력 버튼용)
    const addActivityTyped = (dayIdx: number, type: ActivityType) => setForm(f => {
        const d = [...f.days];
        d[dayIdx] = { ...d[dayIdx], activities: [...d[dayIdx].activities, { time: '', type, title: '', description: '' }] };
        return { ...f, days: d };
    });
    // 관광지 마스터에서 선택 → 상세 설명을 채움. 직접 쓴 제목은 보존(비어 있을 때만 마스터명 사용)
    const fillItemFromSpot = (d: number, a: number, spot: TouristSpot) => setForm(f => {
        const desc = [spot.description, spot.address].filter(Boolean).join('\n\n');
        const days = [...f.days];
        const acts = [...days[d].activities];
        const cur = acts[a];
        const keepTitle = (cur.title || '').trim().length > 0;
        acts[a] = {
            ...cur,
            title: keepTitle ? cur.title : spot.name_kr,
            description: desc || cur.description,
            type: keepTitle ? cur.type : inferActivityType(`${spot.name_kr} ${desc}`),
            images: (spot.images && spot.images.length > 0) ? [...spot.images] : cur.images,
        };
        days[d] = { ...days[d], activities: acts };
        return { ...f, days };
    });
    // 호텔 마스터에서 선택 → 상세 설명을 채움. 직접 쓴 제목은 보존(비어 있을 때만 호텔명 사용)
    const fillItemFromHotel = (d: number, a: number, hotel: Hotel) => setForm(f => {
        const desc = [hotel.description, hotel.address].filter(Boolean).join('\n\n');
        const days = [...f.days];
        const acts = [...days[d].activities];
        const cur = acts[a];
        const keepTitle = (cur.title || '').trim().length > 0;
        acts[a] = {
            ...cur,
            title: keepTitle ? cur.title : hotel.name_kr,
            description: desc || cur.description || '숙박',
            type: keepTitle ? cur.type : 'checkin',
            images: (hotel.images && hotel.images.length > 0) ? [...hotel.images] : cur.images,
        };
        days[d] = { ...days[d], activities: acts };
        return { ...f, days };
    });
    const fillDayFromHotel = (d: number, hotel: Hotel) => setForm(f => {
        const days = [...f.days];
        days[d] = {
            ...days[d],
            accommodation: {
                id: hotel.id,
                name: hotel.name_kr,
                type: hotel.star_rating ? `${hotel.star_rating}성급 호텔` : undefined,
                location: hotel.address,
                images: [...(hotel.images || [])],
                description: hotel.description || '',
            },
        };
        return { ...f, days };
    });
    const removeActivity = (dayIdx: number, actIdx: number) => setForm(f => { const d = [...f.days]; d[dayIdx].activities = d[dayIdx].activities.filter((_, i) => i !== actIdx); return { ...f, days: d }; });
    const removeActivityImage = (dayIdx: number, actIdx: number, imgIdx: number) => setForm(f => {
        const d = [...f.days];
        const acts = [...d[dayIdx].activities];
        acts[actIdx] = { ...acts[actIdx], images: (acts[actIdx].images || []).filter((_, i) => i !== imgIdx) };
        d[dayIdx] = { ...d[dayIdx], activities: acts };
        return { ...f, days: d };
    });
    const uploadActivityImages = async (dayIdx: number, actIdx: number, files: FileList | null) => {
        if (!files?.length) return;
        try {
            const urls = await Promise.all(Array.from(files).map(file => uploadImage(file, 'itinerary-templates')));
            setForm(f => {
                const days = [...f.days];
                const activities = [...days[dayIdx].activities];
                activities[actIdx] = { ...activities[actIdx], images: [...(activities[actIdx].images || []), ...urls] };
                days[dayIdx] = { ...days[dayIdx], activities };
                return { ...f, days };
            });
        } catch {
            alert('일정 사진 업로드에 실패했습니다.');
        }
    };
    const updateActivity = (dayIdx: number, actIdx: number, field: keyof Activity, value: any) => setForm(f => { const d = [...f.days]; d[dayIdx].activities[actIdx] = { ...d[dayIdx].activities[actIdx], [field]: value }; return { ...f, days: d }; });
    const updateActivityText = (dayIdx: number, actIdx: number, field: 'title' | 'description', value: string) => setForm(f => {
        const d = [...f.days];
        const activity = d[dayIdx].activities[actIdx];
        const next = { ...activity, [field]: value };
        next.type = inferActivityType(`${field === 'title' ? value : next.title} ${field === 'description' ? value : next.description}`);
        d[dayIdx].activities[actIdx] = next;
        return { ...f, days: d };
    });
    const moveActivity = (dayIdx: number, actIdx: number, dir: -1 | 1) => setForm(f => {
        const acts = [...f.days[dayIdx].activities];
        const newIdx = actIdx + dir;
        if (newIdx < 0 || newIdx >= acts.length) return f;
        [acts[actIdx], acts[newIdx]] = [acts[newIdx], acts[actIdx]];
        const d = [...f.days];
        d[dayIdx] = { ...d[dayIdx], activities: acts };
        return { ...f, days: d };
    });
    const updateDocSection = <K extends keyof DocumentSettings>(section: K, patch: Partial<DocumentSettings[K]>) => {
        setForm(f => ({
            ...f,
            documentSettings: {
                ...f.documentSettings,
                [section]: { ...f.documentSettings[section], ...patch },
            },
        }));
    };

    const updateIncluded = (idx: number, field: 'icon' | 'label', value: string) => {
        setForm(f => {
            const included = [...f.documentSettings.overview.included];
            included[idx] = { ...included[idx], [field]: value };
            return { ...f, documentSettings: { ...f.documentSettings, overview: { ...f.documentSettings.overview, included } } };
        });
    };

    const updateCancellation = (idx: number, field: 'period' | 'fee', value: string) => {
        setForm(f => {
            const cancellationRows = [...f.documentSettings.contract.cancellationRows];
            cancellationRows[idx] = { ...cancellationRows[idx], [field]: value };
            return { ...f, documentSettings: { ...f.documentSettings, contract: { ...f.documentSettings.contract, cancellationRows } } };
        });
    };

    const updateGuideNotice = (idx: number, field: 'title' | 'body', value: string) => {
        setForm(f => {
            const notices = [...f.documentSettings.guide.notices];
            notices[idx] = { ...notices[idx], [field]: value };
            return { ...f, documentSettings: { ...f.documentSettings, guide: { ...f.documentSettings.guide, notices } } };
        });
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) { alert('템플릿 이름을 입력하세요.'); return; }
        try {
            const payload = {
                name: form.name,
                description: encodeTemplateDescription(form.description, form.documentSettings),
                days: form.days,
            };
            if (editing) { await api.itineraryTemplates.update(editing.id, payload); }
            else { await api.itineraryTemplates.create(payload); }
            await load(); setIsModalOpen(false); resetForm();
        } catch (e: any) { alert('저장 실패: ' + e.message); }
    };

    const handleEdit = (t: ItineraryTemplate) => { setEditing(t); setForm({ name: t.name, description: t.description, days: t.days, documentSettings: mergeDocumentSettings(t.documentSettings) }); setEditorMode('itinerary'); setIsModalOpen(true); };
    const handleDelete = async (id: string) => { if (!confirm('삭제하시겠습니까?')) return; try { await api.itineraryTemplates.delete(id); await load(); } catch (e: any) { alert('삭제 실패'); } };
    const handleDuplicate = (t: ItineraryTemplate) => {
        setEditing(null);
        setForm({
            name: `${t.name} (복사본)`,
            description: t.description,
            documentSettings: mergeDocumentSettings(t.documentSettings),
            days: t.days.map(d => ({ ...d, activities: d.activities.map(a => ({ ...a })) })),
        });
        setEditorMode('itinerary');
        setIsModalOpen(true);
    };

    const closeEditor = () => {
        if (form.name || form.days.length > 0) {
            if (!confirm('편집 중인 내용이 사라집니다. 닫으시겠습니까?')) return;
        }
        setIsModalOpen(false); resetForm();
    };

    // RDE에 넘길 초기 내용 — 모달 오픈 시점에만 계산(편집 중 리렌더로 초기화되지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const editorInitial = useMemo<ReservationDocContent>(() => ({ name: form.name, description: form.description, days: form.days, documentSettings: form.documentSettings }), [isModalOpen]);

    return (
        <div>
            <div className="toolbar">
                <div style={{ minWidth: 0 }}>
                    <div className="cell-strong" style={{ fontSize: 14 }}>일정 프리셋(템플릿)을 만들어 견적·예약 문서에 재사용합니다.</div>
                    <div className="cell-muted" style={{ fontSize: 12.5, marginTop: 2 }}>편집 화면은 예약 상세의 문서 편집기와 동일합니다. 문서 디자인은 브랜드 1벌로 고정되고, 여기서는 일정·포함사항·계약 조건을 편집합니다.</div>
                </div>
                <div className="spacer" />
                <button className="btn btn-ink" onClick={() => { resetForm(); setIsModalOpen(true); }}>
                    <Icon name="add" /> 일정 프리셋 추가
                </button>
            </div>

            {templates.length === 0 ? (
                <div className="empty">
                    <Icon name="event_note" />
                    <p>등록된 템플릿이 없습니다</p>
                </div>
            ) : (
                <div className="grid-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                    {templates.map(t => (
                        <div key={t.id} className="card" style={{ overflow: 'hidden' }}>
                            <div className="relative h-36 overflow-hidden">
                                <img src={mongoliaHero} alt="" className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-r from-[#0B1B45]/95 via-[#16275F]/70 to-transparent" />
                                <div className="absolute left-5 top-4 text-white">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[24px]">nights_stay</span>
                                        <div>
                                            <p className="text-[11px] font-black">몽골리아 은하수</p>
                                            <p className="text-[8px] font-bold tracking-widest text-white/70">DOCUMENT PACKAGE</p>
                                        </div>
                                    </div>
                                    <h3 className="mt-4 max-w-[420px] truncate text-xl font-black tracking-tight">{t.name}</h3>
                                    {t.description && <p className="mt-1 max-w-[420px] truncate text-xs font-semibold text-white/80">{t.description}</p>}
                                </div>
                                <span className="absolute right-4 top-4 rounded-xl bg-white/90 px-3 py-1 text-xs font-black text-[#1656D6] shadow-sm">{Math.max(0, t.days.length - 1)}박{t.days.length}일</span>
                            </div>

                            <div className="card-pad">
                                <div className="mb-4 grid grid-cols-4 gap-2">
                                    {[
                                        { icon: 'article', label: '개요' },
                                        { icon: 'contract', label: '계약서' },
                                        { icon: 'route', label: '상세일정' },
                                        { icon: 'qr_code_2', label: '안내/QR' },
                                    ].map(item => (
                                        <div key={item.label} className="rounded-xl border border-[#9CC5FF]/80 bg-[#F7FAFA] px-2 py-2 text-center text-[#1656D6]">
                                            <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                                            <p className="mt-1 text-[10px] font-black">{item.label}</p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
                                    <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-400">문서에 들어갈 일정 내용</p>
                                    <div className="space-y-1">
                                        {t.days.slice(0, 3).map(d => (
                                            <div key={d.day} className="flex items-center gap-2 text-xs text-slate-500">
                                                <span className="flex h-7 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#287DFA]/15 text-[11px] font-black text-[#1656D6]">{d.day}일</span>
                                                <span className="truncate font-semibold">{d.region ? `${d.region} · ` : ''}{d.title || '제목 없음'}</span>
                                                <span className="flex-shrink-0 text-slate-300">({d.activities.length})</span>
                                            </div>
                                        ))}
                                        {t.days.length > 3 && <p className="pl-11 text-xs text-slate-400">+ {t.days.length - 3}일 더...</p>}
                                    </div>
                                </div>

                                <div className="row" style={{ gap: 8 }}>
                                    <button onClick={() => handleEdit(t)} className="btn btn-ink" style={{ flex: 1 }}>프리셋 편집</button>
                                    <button onClick={() => handleDuplicate(t)} className="act-btn" title="이 템플릿 복제">
                                        <Icon name="content_copy" />
                                    </button>
                                    <button onClick={() => handleDelete(t.id)} className="act-btn danger" title="삭제">
                                        <Icon name="delete" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 편집기 단일화 — 예약 상세와 동일한 문서 워크스페이스(템플릿 모드) 재사용 */}
            <ReservationDocumentEditor
                open={isModalOpen}
                onClose={() => { setIsModalOpen(false); resetForm(); }}
                title={editing ? editing.name : '새 일정 프리셋'}
                templateMode
                initialContent={editorInitial}
                onSave={async (content) => {
                    if (!content.name.trim()) { throw new Error('프리셋 이름(문서 표지 제목)을 입력하세요.'); }
                    const payload = {
                        name: content.name,
                        description: encodeTemplateDescription(content.description, content.documentSettings),
                        days: content.days,
                    };
                    if (editing) { await api.itineraryTemplates.update(editing.id, payload); }
                    else { await api.itineraryTemplates.create(payload); }
                    await load();
                }}
            />
        </div>
    );
};

// ─── Tab: Guides ─────────────────────────────────────────
const GuidesTab: React.FC = () => {
    const [guides, setGuides] = useState<Guide[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Guide | null>(null);
    const [form, setForm] = useState({ name: '', image: '', introduction: '', phone: '', experienceYears: 0, languages: [] as string[], specialties: [] as string[] });

    const load = async () => {
        try {
            const data = await api.tourGuides.list();
            if (Array.isArray(data)) setGuides(data.map((g: any) => ({
                id: g.id, name: g.name, image: g.image || '', introduction: g.bio || g.introduction || '',
                phone: g.phone || '', languages: typeof g.languages === 'string' ? JSON.parse(g.languages || '[]') : (g.languages || []),
                specialties: normalizeSpecialties(typeof g.specialties === 'string' ? JSON.parse(g.specialties || '[]') : (g.specialties || [])),
                status: g.status || 'active', experienceYears: g.experience_years || 0,
            })));
        } catch (e) { console.error(e); }
    };

    useEffect(() => { load(); }, []);

    const resetForm = () => { setForm({ name: '', image: '', introduction: '', phone: '', experienceYears: 0, languages: [], specialties: [] }); setEditing(null); };
    const toggle = (field: 'languages' | 'specialties', val: string) => setForm(f => ({ ...f, [field]: f[field].includes(val) ? f[field].filter(v => v !== val) : [...f[field], val] }));

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        try { const url = await uploadImage(file, 'guides'); setForm(f => ({ ...f, image: url })); } catch { alert('이미지 업로드 실패'); }
    };

    const handleSubmit = async () => {
        if (!form.name || !form.phone) { alert('이름과 연락처는 필수입니다.'); return; }
        try {
            const payload = { name: form.name, bio: form.introduction, phone: form.phone, image: form.image, experience_years: form.experienceYears, languages: form.languages, specialties: form.specialties };
            if (editing) { await api.tourGuides.update(editing.id, { ...payload, status: editing.status }); }
            else { await api.tourGuides.create({ ...payload, status: 'active' }); }
            await load(); setIsModalOpen(false); resetForm();
        } catch (e: any) { alert('저장 실패: ' + e.message); }
    };

    const handleApprove = async (g: Guide) => {
        try { await api.tourGuides.update(g.id, { name: g.name, bio: g.introduction, phone: g.phone, image: g.image, experience_years: g.experienceYears, languages: g.languages, specialties: g.specialties, status: 'active' }); await load(); }
        catch (e: any) { alert('승인 실패'); }
    };

    const handleDelete = async (id: string) => { if (!confirm('삭제하시겠습니까?')) return; try { await api.tourGuides.delete(id); await load(); } catch { alert('삭제 실패'); } };

    const pendingCount = guides.filter(g => g.status === 'pending').length;

    return (
        <div>
            <div className="toolbar">
                <div className="row" style={{ minWidth: 0 }}>
                    <div className="cell-muted" style={{ fontSize: 13 }}>가이드를 등록하고 관리합니다.</div>
                    {pendingCount > 0 && <span className="badge b-amber">승인대기 {pendingCount}</span>}
                </div>
                <div className="spacer" />
                <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="btn btn-ink">
                    <Icon name="add" /> 가이드 등록
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {guides.map(g => (
                    <div key={g.id} className="card card-pad grid grid-cols-[72px_1fr_auto] gap-4 items-center" style={{ padding: 14 }}>
                        <div className="avatar flex-shrink-0" style={{ width: 72, height: 72, borderRadius: 'var(--r-md)', position: 'relative' }}>
                            {g.image ? <img src={g.image} alt={g.name} className="w-full h-full object-cover" /> : <Icon name="person" style={{ fontSize: 30, color: 'var(--mrt-gray-300)' }} />}
                            {g.status === 'pending' && <span className="badge b-amber" style={{ position: 'absolute', top: 4, left: 4, padding: '1px 6px', fontSize: 9 }}>대기</span>}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="cell-strong truncate" style={{ fontSize: 15 }}>{g.name}</h3>
                                {g.experienceYears > 0 && <span className="cell-muted inline-flex items-center gap-0.5" style={{ fontSize: 11 }}><Icon name="workspace_premium" style={{ fontSize: 14 }} />{g.experienceYears}년</span>}
                                <span className="cell-muted inline-flex items-center gap-0.5" style={{ fontSize: 11 }}><Icon name="phone" style={{ fontSize: 14 }} />{g.phone}</span>
                            </div>
                            <p className="cell-muted line-clamp-1 mb-1.5" style={{ fontSize: 12.5 }}>{g.introduction || '소개글 없음'}</p>
                            {g.languages.length > 0 && <div className="flex flex-wrap gap-1">{g.languages.map(l => <span key={l} className="badge b-blue" style={{ padding: '2px 7px', fontSize: 10.5 }}>{l}</span>)}</div>}
                        </div>
                        <div className="row-actions items-center" style={{ alignItems: 'center' }}>
                            {g.status === 'pending' && <button onClick={() => handleApprove(g)} className="btn btn-sm btn-blue">승인</button>}
                            <button onClick={() => { setEditing(g); setForm({ name: g.name, image: g.image, introduction: g.introduction, phone: g.phone, experienceYears: g.experienceYears, languages: g.languages, specialties: g.specialties }); setIsModalOpen(true); }} className="act-btn" title="수정"><Icon name="edit" /></button>
                            <button onClick={() => handleDelete(g.id)} className="act-btn danger" title="삭제"><Icon name="delete" /></button>
                        </div>
                    </div>
                ))}
                {guides.length === 0 && <div className="col-span-full empty"><Icon name="person_off" /><p>등록된 가이드가 없습니다</p></div>}
            </div>

            {isModalOpen && (
                <div className="picker-scrim">
                    <div className="picker" style={{ width: 520, maxHeight: '90vh' }}>
                        <div className="card-head" style={{ flexShrink: 0 }}>
                            <h2>{editing ? '가이드 수정' : '가이드 등록'}</h2>
                            <div className="spacer" />
                            <button className="act-btn" onClick={() => { setIsModalOpen(false); resetForm(); }} title="닫기"><Icon name="close" /></button>
                        </div>
                        <div className="picker-list" style={{ padding: '20px 22px' }}>
                            <div className="field">
                                <label>프로필 사진</label>
                                <div className="row" style={{ gap: 16 }}>
                                    <div className="avatar round" style={{ width: 64, height: 64 }}>
                                        {form.image ? <img src={form.image} className="w-full h-full object-cover" /> : <Icon name="person" style={{ fontSize: 28, color: 'var(--mrt-gray-300)' }} />}
                                    </div>
                                    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                                        사진 선택 <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                                    </label>
                                </div>
                            </div>
                            <div className="field"><label>이름 *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="inp" /></div>
                            <div className="field"><label>연락처 *</label><input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="inp" /></div>
                            <div className="field"><label>경력 연수</label><div className="row"><input type="number" min={0} value={form.experienceYears} onChange={e => setForm(f => ({ ...f, experienceYears: Number(e.target.value) }))} className="inp" style={{ width: 110, textAlign: 'center' }} /><span className="cell-muted" style={{ fontSize: 13 }}>년</span></div></div>
                            <div className="field"><label>소개글</label><textarea value={form.introduction} onChange={e => setForm(f => ({ ...f, introduction: e.target.value }))} rows={3} className="inp" /></div>
                            <div className="field"><label>언어</label><div className="chip-row">{LANGUAGES.map(l => <button key={l} type="button" onClick={() => toggle('languages', l)} className={`chip${form.languages.includes(l) ? ' active' : ''}`}>{l}</button>)}</div></div>
                            <div className="field"><label>전문 분야</label><div className="chip-row">{SPECIALTIES.map(s => <button key={s} type="button" onClick={() => toggle('specialties', s)} className={`chip${form.specialties.includes(s) ? ' active' : ''}`}>{s}</button>)}</div></div>
                            <div className="row" style={{ gap: 10, paddingTop: 4 }}>
                                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="btn btn-ghost" style={{ flex: 1 }}>취소</button>
                                <button onClick={handleSubmit} className="btn btn-ink" style={{ flex: 1 }}>{editing ? '수정' : '등록'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Tab: Accommodations ─────────────────────────────────
const AccommodationsTab: React.FC = () => {
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Accommodation | null>(null);
    const [form, setForm] = useState({ name: '', images: [] as string[], description: '', type: '3성급 호텔', location: '' });

    const load = async () => {
        try {
            const data = await api.accommodations.list();
            if (Array.isArray(data)) setAccommodations(data.map((a: any) => ({
                id: a.id, name: a.name, images: typeof a.images === 'string' ? JSON.parse(a.images || '[]') : (a.images || []),
                description: a.description || '', type: a.type || '', location: a.location || '',
            })));
        } catch (e) { console.error(e); }
    };

    useEffect(() => { load(); }, []);

    const resetForm = () => { setForm({ name: '', images: [], description: '', type: '3성급 호텔', location: '' }); setEditing(null); };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files; if (!files) return;
        try { const urls = await Promise.all(Array.from(files).map(f => uploadImage(f, 'accommodations'))); setForm(f => ({ ...f, images: [...f.images, ...urls] })); }
        catch { alert('이미지 업로드 실패'); }
    };

    const handleSubmit = async () => {
        if (!form.name || !form.location) { alert('숙소명과 위치는 필수입니다.'); return; }
        try {
            const payload = { name: form.name, images: form.images, description: form.description, type: form.type, location: form.location };
            if (editing) { await api.accommodations.update(editing.id, payload); }
            else { await api.accommodations.create({ ...payload, id: `ACCOM-${Date.now()}` }); }
            await load(); setIsModalOpen(false); resetForm();
        } catch (e: any) { alert('저장 실패: ' + e.message); }
    };

    const handleDelete = async (id: string) => { if (!confirm('삭제하시겠습니까?')) return; try { await api.accommodations.delete(id); await load(); } catch { alert('삭제 실패'); } };

    return (
        <div>
            <div className="toolbar">
                <div className="cell-muted" style={{ fontSize: 13, minWidth: 0 }}>숙소를 등록하고 예약에 배정합니다.</div>
                <div className="spacer" />
                <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="btn btn-ink">
                    <Icon name="add" /> 숙소 등록
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {accommodations.map(a => (
                    <div key={a.id} className="card card-pad grid grid-cols-[96px_1fr_auto] gap-4 items-center" style={{ padding: 14 }}>
                        <div className="flex-shrink-0 overflow-hidden" style={{ width: 96, height: 72, borderRadius: 'var(--r-md)', background: 'var(--mrt-gray-100)' }}>
                            {a.images.length > 0 ? <img src={a.images[0]} alt={a.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Icon name="hotel" style={{ fontSize: 30, color: 'var(--mrt-gray-300)' }} /></div>}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <h3 className="cell-strong truncate" style={{ fontSize: 15 }}>{a.name}</h3>
                                {a.type && <span className="badge b-gray" style={{ padding: '2px 7px', fontSize: 10.5 }}>{a.type}</span>}
                            </div>
                            <div className="cell-muted mb-1 inline-flex items-center gap-0.5" style={{ fontSize: 11 }}><Icon name="location_on" style={{ fontSize: 14 }} />{a.location}</div>
                            <p className="cell-muted line-clamp-1" style={{ fontSize: 12.5 }}>{a.description || '설명 없음'}</p>
                        </div>
                        <div className="row-actions items-center" style={{ alignItems: 'center' }}>
                            <button onClick={() => { setEditing(a); setForm({ name: a.name, images: a.images, description: a.description, type: a.type, location: a.location }); setIsModalOpen(true); }} className="act-btn" title="수정"><Icon name="edit" /></button>
                            <button onClick={() => handleDelete(a.id)} className="act-btn danger" title="삭제"><Icon name="delete" /></button>
                        </div>
                    </div>
                ))}
                {accommodations.length === 0 && <div className="col-span-full empty"><Icon name="hotel" /><p>등록된 숙소가 없습니다</p></div>}
            </div>

            {isModalOpen && (
                <div className="picker-scrim">
                    <div className="picker" style={{ width: 520, maxHeight: '90vh' }}>
                        <div className="card-head" style={{ flexShrink: 0 }}>
                            <h2>{editing ? '숙소 수정' : '숙소 등록'}</h2>
                            <div className="spacer" />
                            <button className="act-btn" onClick={() => { setIsModalOpen(false); resetForm(); }} title="닫기"><Icon name="close" /></button>
                        </div>
                        <div className="picker-list" style={{ padding: '20px 22px' }}>
                            <div className="field">
                                <label>이미지</label>
                                {form.images.length > 0 && <div className="grid grid-cols-3 gap-2 mb-2">{form.images.map((img, i) => <div key={i} className="relative aspect-video"><img src={img} className="w-full h-full object-cover rounded-lg" /><button onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5"><span className="material-symbols-outlined text-xs">close</span></button></div>)}</div>}
                                <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
                                    <Icon name="add_photo_alternate" /> 이미지 추가 <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                                </label>
                            </div>
                            <div className="field"><label>숙소명 *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="inp" /></div>
                            <div className="field"><label>위치 *</label><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="inp" placeholder="예: 울란바토르 시내, 테를지 국립공원" /></div>
                            <div className="field">
                                <label>숙소 타입</label>
                                {Object.entries(ACCOM_TYPES).map(([cat, subs]) => (
                                    <div key={cat} style={{ marginBottom: 12 }}>
                                        <p className="cell-muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{cat}</p>
                                        <div className="chip-row">{subs.map(s => <button key={s} type="button" onClick={() => setForm(f => ({ ...f, type: s }))} className={`chip${form.type === s ? ' active' : ''}`}>{s}</button>)}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="field"><label>설명</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} className="inp" /></div>
                            <div className="row" style={{ gap: 10, paddingTop: 4 }}>
                                <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="btn btn-ghost" style={{ flex: 1 }}>취소</button>
                                <button onClick={handleSubmit} className="btn btn-ink" style={{ flex: 1 }}>{editing ? '수정' : '등록'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Main Page ───────────────────────────────────────────
const TABS = [
    { id: 'templates', label: '일정 템플릿', icon: 'event_note' },
    { id: 'guides', label: '가이드 관리', icon: 'badge' },
    { id: 'accommodations', label: '숙소 관리', icon: 'hotel' },
];

export const AdminTemplateManage: React.FC = () => {
    const [activeTab, setActiveTab] = useState('templates');

    return (
        <AdminLayout activePage="templates" title="템플릿 관리">
            <div className="seg" style={{ marginBottom: 18 }}>
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={activeTab === tab.id ? 'active' : ''}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'templates' && <TemplatesTab />}
            {activeTab === 'guides' && <GuidesTab />}
            {activeTab === 'accommodations' && <AccommodationsTab />}
        </AdminLayout>
    );
};
