import React, { useState, useEffect, useMemo } from 'react';
import { AdminLayout } from '../components/admin/AdminLayout';
import { ReservationDocumentEditor, type ReservationDocContent } from '../components/admin/ReservationDocumentEditor';
// 문서 템플릿 화면은 고객 문서 미리보기와 같은 Material 아이콘을 쓴다(화면을 Seed로 다시 짤 때 편집 도구 아이콘만 Icon*으로)
import { MaterialIcon as Icon } from '../components/admin/console/Icon';
import { api } from '../lib/api';
import { BRAND, COMPANY_INFO, CONTRACT_CANCELLATION_ROWS, DEPOSIT_ACCOUNT, DEPOSIT_PAYMENT_METHOD, resolveCancellationRows, resolveDepositMethod } from '../constants/company';
import { uploadImage } from '../utils/upload';
import { TouristSpotPickerModal } from '../components/admin/TouristSpotPickerModal';
import { HotelPickerModal } from '../components/admin/HotelPickerModal';
import type { TouristSpot } from '../types/touristSpot';
import type { Hotel } from '../types/hotel';
import { documentLodgingSnapshot, lodgingTimelineSnapshot } from '../utils/lodgingItinerarySnapshot';
import { travelSpotSnapshot } from '../utils/travelSpotSnapshot';
import mongoliaHero from '../assets/login_bg_3.jpg';
import { DOC_BLUE, DOC_NAVY } from '../components/document/TripDocParts';
import { won } from '../components/desktop-primitives/mwTokens';
import { adminConfirm, adminNotify } from '../components/admin/ui/adminFeedback';
import { adminValidateRequired } from '../components/admin/ui/adminForm';
import {
    AdminBadge, AdminButton, AdminCard, AdminChip, AdminDialog, AdminEmpty, AdminError, AdminField, AdminFileButton, AdminIconButton, AdminLoading, AdminSegmented, AdminTextArea, AdminTextInput,
    IconClose, IconCopy, IconDocumentText, IconHotel, IconPencil, IconPerson, IconPlus, IconTrash, IconUpload,
} from '../components/admin/ui';
import './AdminTemplateManage.css';

// ─── Types ───────────────────────────────────────────────
export type ActivityType = 'pickup' | 'transport' | 'meal' | 'sightseeing' | 'activity' | 'checkin' | 'free' | 'other';
export interface Activity { time?: string; type?: ActivityType; title: string; description: string; images?: string[]; }
export interface TemplateDay {
    day: number;
    date?: string;
    dateMode?: 'manual' | 'auto';
    items?: string[];
    retainedActivities?: Activity[];
    retainedSummary?: string;
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
    <div className="mx-auto max-w-[960px] rounded-[22px] border border-[color:var(--adm-accent-line)] bg-white shadow-sm">{children}</div>
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
            {showPageTabs && <div className="border-b border-[color:var(--adm-line-subtle)] bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[color:var(--adm-text-3)]">
                        <span className="material-symbols-outlined text-[15px]">edit_note</span>PDF 화면에서 직접 편집
                    </p>
                    <span className="rounded-[4px] bg-[var(--adm-neutral-soft)] px-2 py-0.5 text-[12px] font-semibold text-[color:var(--adm-text-2)]">클릭해서 수정</span>
                </div>
                <div className="grid grid-cols-4 gap-0 rounded-[10px] bg-[var(--adm-neutral-soft)] p-1">
                    {pages.map(page => (
                        <button key={page.id} onClick={() => setActivePage(page.id)} className={`inline-flex h-8 min-w-0 items-center justify-center gap-1 rounded-[8px] px-2 text-[13px] transition-colors ${activePage === page.id ? 'bg-white font-semibold text-[color:var(--adm-ink)] shadow-[var(--adm-shadow-xs)]' : 'font-medium text-[color:var(--adm-text-3)] hover:text-[color:var(--adm-ink)]'}`} title={page.label}>
                            <span className="material-symbols-outlined text-[15px]">{page.icon}</span><span className="truncate">{page.label}</span>
                        </button>
                    ))}
                </div>
            </div>}
            {customer ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[color:var(--adm-accent-line)] bg-[var(--adm-accent-soft)] px-4 py-2 text-[11px] font-bold text-[color:var(--adm-accent-strong)] dark:border-blue-900 dark:bg-blue-900/20">
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
                                                            {onPickSpot && <button onClick={() => onPickSpot(dayIdx, index)} className="h-7 flex-none rounded-lg border border-[#C7DCFF] bg-white px-2 text-[9px] font-black" style={{ color: '#1656D6' }}>여행지</button>}
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
                                                    {onPickHotel && <button onClick={() => onPickHotel(dayIdx)} className="text-[10px] font-black" style={{ color: '#1656D6' }}>등록 숙소에서 선택</button>}
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

// ─── Tab: Itinerary Templates ────────────────────────────
const TemplatesTab: React.FC = () => {
    const [templates, setTemplates] = useState<ItineraryTemplate[]>([]);
    const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
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
                setListState('ready');
            } else setListState('error');
        } catch (e) { console.error(e); setListState('error'); }
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
        const snapshot = travelSpotSnapshot(spot);
        const days = [...f.days];
        const acts = [...days[d].activities];
        const cur = acts[a];
        const keepTitle = (cur.title || '').trim().length > 0;
        acts[a] = {
            ...cur,
            ...snapshot,
            title: keepTitle ? cur.title : spot.name_kr,
            type: keepTitle ? cur.type : inferActivityType(`${spot.name_kr} ${snapshot.description}`),
        };
        days[d] = { ...days[d], activities: acts };
        return { ...f, days };
    });
    // 등록 숙소에서 선택 → 상세 설명을 채움. 직접 쓴 제목은 보존(비어 있을 때만 호텔명 사용)
    const fillItemFromHotel = (d: number, a: number, hotel: Hotel) => setForm(f => {
        const days = [...f.days];
        const acts = [...days[d].activities];
        const cur = acts[a];
        const snapshot = lodgingTimelineSnapshot(hotel, cur);
        const keepTitle = (cur.title || '').trim().length > 0;
        acts[a] = {
            ...cur,
            ...snapshot,
            title: keepTitle ? cur.title : hotel.name_kr,
            description: hotel.id.startsWith('resource-lodge:') ? snapshot.description || '' : snapshot.description || '숙박',
            type: keepTitle ? cur.type : 'checkin',
        };
        days[d] = { ...days[d], activities: acts };
        return { ...f, days };
    });
    const fillDayFromHotel = (d: number, hotel: Hotel) => setForm(f => {
        const days = [...f.days];
        days[d] = {
            ...days[d],
            accommodation: documentLodgingSnapshot(hotel),
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
            adminNotify('일정 사진 업로드에 실패했습니다.');
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
        if (!form.name.trim()) { adminNotify('템플릿 이름을 입력하세요.'); return; }
        try {
            const payload = {
                name: form.name,
                description: encodeTemplateDescription(form.description, form.documentSettings),
                days: form.days,
            };
            if (editing) { await api.itineraryTemplates.update(editing.id, payload); }
            else { await api.itineraryTemplates.create(payload); }
            await load(); setIsModalOpen(false); resetForm();
        } catch (e: any) { adminNotify('저장 실패: ' + e.message); }
    };

    const handleEdit = (t: ItineraryTemplate) => { setEditing(t); setForm({ name: t.name, description: t.description, days: t.days, documentSettings: mergeDocumentSettings(t.documentSettings) }); setEditorMode('itinerary'); setIsModalOpen(true); };
    const handleDelete = async (id: string) => { if (!await adminConfirm('삭제하시겠습니까?')) return; try { await api.itineraryTemplates.delete(id); await load(); } catch (e: any) { adminNotify('삭제 실패'); } };
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

    const closeEditor = async () => {
        if (form.name || form.days.length > 0) {
            if (!await adminConfirm('편집 중인 내용이 사라집니다. 닫으시겠습니까?')) return;
        }
        setIsModalOpen(false); resetForm();
    };

    // RDE에 넘길 초기 내용 — 모달 오픈 시점에만 계산(편집 중 리렌더로 초기화되지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const editorInitial = useMemo<ReservationDocContent>(() => ({ name: form.name, description: form.description, days: form.days, documentSettings: form.documentSettings }), [isModalOpen]);

    return (
        <div className="tm-tab">
            <div className="tm-toolbar">
                <div className="tm-toolbar-text">
                    <b>일정 프리셋(템플릿)을 만들어 견적·예약 문서에 재사용합니다.</b>
                    <small>편집 화면은 예약 상세의 문서 편집기와 같습니다. 문서 디자인은 브랜드 1벌로 고정되고, 여기서는 일정·포함사항·계약 조건을 편집합니다.</small>
                </div>
                <AdminButton variant="primary" leading={<IconPlus />} onClick={() => { resetForm(); setIsModalOpen(true); }}>일정 프리셋 추가</AdminButton>
            </div>

            {templates.length === 0 ? (
                listState === 'loading' ? <AdminLoading label="템플릿을 불러오는 중…" />
                    : listState === 'error' ? <AdminError reason="템플릿을 불러오지 못했습니다." onRetry={() => { setListState('loading'); void load(); }} />
                    : <AdminEmpty icon={<IconDocumentText />} title="등록된 템플릿이 없습니다" />
            ) : (
                <div className="tm-grid">
                    {templates.map(t => (
                        <AdminCard key={t.id} flush className="tm-card">
                            <div className="tm-cover">
                                <img src={mongoliaHero} alt="" />
                                <div className="tm-cover-text">
                                    <span className="tm-brand">몽골리아 은하수 · DOCUMENT PACKAGE</span>
                                    <h3>{t.name}</h3>
                                    {t.description && <p>{t.description}</p>}
                                </div>
                                <AdminBadge className="tm-nights" tone="info">{Math.max(0, t.days.length - 1)}박{t.days.length}일</AdminBadge>
                            </div>
                            <div className="tm-card-body">
                                <ul className="tm-pages" aria-label="문서 구성">
                                    {['개요', '계약서', '상세일정', '안내/QR'].map(label => <li key={label}>{label}</li>)}
                                </ul>
                                <div className="tm-days">
                                    <small>문서에 들어갈 일정 내용</small>
                                    {t.days.slice(0, 3).map(d => (
                                        <span key={d.day} className="tm-day">
                                            <AdminBadge tone="info">{d.day}일</AdminBadge>
                                            <span className="tm-day-title">{d.region ? `${d.region} · ` : ''}{d.title || '제목 없음'}</span>
                                            <small>({d.activities.length})</small>
                                        </span>
                                    ))}
                                    {t.days.length > 3 && <small>+ {t.days.length - 3}일 더...</small>}
                                </div>
                                <div className="tm-actions">
                                    <AdminButton variant="primary" fullWidth onClick={() => handleEdit(t)}>프리셋 편집</AdminButton>
                                    <AdminIconButton variant="outlined" label="이 템플릿 복제" onClick={() => handleDuplicate(t)}><IconCopy /></AdminIconButton>
                                    <AdminIconButton variant="outlined" label="삭제" onClick={() => void handleDelete(t.id)}><IconTrash /></AdminIconButton>
                                </div>
                            </div>
                        </AdminCard>
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
    const [uploading, setUploading] = useState(false);

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

    const handleImageUpload = async (files: File[]) => {
        const file = files[0]; if (!file) return;
        setUploading(true);
        try { const url = await uploadImage(file, 'guides'); setForm(f => ({ ...f, image: url })); } catch { adminNotify('이미지 업로드 실패'); }
        finally { setUploading(false); }
    };

    const handleSubmit = async () => {
        if (!adminValidateRequired() || !form.name || !form.phone) return;
        try {
            const payload = { name: form.name, bio: form.introduction, phone: form.phone, image: form.image, experience_years: form.experienceYears, languages: form.languages, specialties: form.specialties };
            if (editing) { await api.tourGuides.update(editing.id, { ...payload, status: editing.status }); }
            else { await api.tourGuides.create({ ...payload, status: 'active' }); }
            await load(); setIsModalOpen(false); resetForm();
        } catch (e: any) { adminNotify('저장 실패: ' + e.message); }
    };

    const handleApprove = async (g: Guide) => {
        try { await api.tourGuides.update(g.id, { name: g.name, bio: g.introduction, phone: g.phone, image: g.image, experience_years: g.experienceYears, languages: g.languages, specialties: g.specialties, status: 'active' }); await load(); }
        catch { adminNotify('승인 실패'); }
    };

    const handleDelete = async (id: string) => { if (!await adminConfirm('삭제하시겠습니까?')) return; try { await api.tourGuides.delete(id); await load(); } catch { adminNotify('삭제 실패'); } };

    const pendingCount = guides.filter(g => g.status === 'pending').length;

    return (
        <div className="tm-tab">
            <div className="tm-toolbar">
                <span className="tm-toolbar-text"><small>가이드를 등록하고 관리합니다.</small>{pendingCount > 0 && <AdminBadge tone="warn">승인대기 {pendingCount}</AdminBadge>}</span>
                <AdminButton variant="primary" leading={<IconPlus />} onClick={() => { resetForm(); setIsModalOpen(true); }}>가이드 등록</AdminButton>
            </div>

            {guides.length > 0 ? (
                <div className="tm-rows">
                    {guides.map(g => (
                        <AdminCard key={g.id} className="tm-row">
                            <span className="tm-photo is-round">{g.image ? <img src={g.image} alt={g.name} /> : <IconPerson aria-hidden="true" />}</span>
                            <span className="tm-row-text">
                                <span className="tm-row-head">
                                    <b>{g.name}</b>
                                    {g.status === 'pending' && <AdminBadge tone="warn">대기</AdminBadge>}
                                    {g.experienceYears > 0 && <small>경력 {g.experienceYears}년</small>}
                                    <small>{g.phone}</small>
                                </span>
                                <small className="tm-clamp">{g.introduction || '소개글 없음'}</small>
                                {g.languages.length > 0 && <span className="tm-badges">{g.languages.map(l => <AdminBadge key={l} tone="info">{l}</AdminBadge>)}</span>}
                            </span>
                            <span className="tm-row-actions">
                                {g.status === 'pending' && <AdminButton size="sm" variant="primary" onClick={() => void handleApprove(g)}>승인</AdminButton>}
                                <AdminIconButton size="sm" label="수정" onClick={() => { setEditing(g); setForm({ name: g.name, image: g.image, introduction: g.introduction, phone: g.phone, experienceYears: g.experienceYears, languages: g.languages, specialties: g.specialties }); setIsModalOpen(true); }}><IconPencil /></AdminIconButton>
                                <AdminIconButton size="sm" label="삭제" onClick={() => void handleDelete(g.id)}><IconTrash /></AdminIconButton>
                            </span>
                        </AdminCard>
                    ))}
                </div>
            ) : <AdminEmpty icon={<IconPerson />} title="등록된 가이드가 없습니다" />}

            <AdminDialog open={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editing ? '가이드 수정' : '가이드 등록'}
                onSubmit={() => void handleSubmit()} submitLabel={editing ? '수정' : '등록'} submitDisabled={uploading}>
                <AdminField label="프로필 사진">
                    <span className="tm-upload">
                        <span className="tm-photo is-round">{form.image ? <img src={form.image} alt="" /> : <IconPerson aria-hidden="true" />}</span>
                        <AdminFileButton size="sm" accept="image/*" leading={<IconUpload />} loading={uploading} onFiles={(files) => void handleImageUpload(files)}>사진 선택</AdminFileButton>
                    </span>
                </AdminField>
                <AdminField label="이름" required>{(id) => <AdminTextInput id={id} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />}</AdminField>
                <AdminField label="연락처" required>{(id) => <AdminTextInput id={id} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />}</AdminField>
                <AdminField label="경력 연수">{(id) => <AdminTextInput id={id} className="tm-years" type="number" min={0} trailing="년" value={String(form.experienceYears)} onChange={e => setForm(f => ({ ...f, experienceYears: Number(e.target.value) }))} />}</AdminField>
                <AdminField label="소개글">{(id) => <AdminTextArea id={id} minRows={3} value={form.introduction} onChange={e => setForm(f => ({ ...f, introduction: e.target.value }))} />}</AdminField>
                <AdminField label="언어"><span className="tm-chips" role="group" aria-label="언어">{LANGUAGES.map(l => <AdminChip key={l} active={form.languages.includes(l)} onClick={() => toggle('languages', l)}>{l}</AdminChip>)}</span></AdminField>
                <AdminField label="전문 분야"><span className="tm-chips" role="group" aria-label="전문 분야">{SPECIALTIES.map(s => <AdminChip key={s} active={form.specialties.includes(s)} onClick={() => toggle('specialties', s)}>{s}</AdminChip>)}</span></AdminField>
            </AdminDialog>
        </div>
    );
};

// ─── Tab: Accommodations ─────────────────────────────────
const AccommodationsTab: React.FC = () => {
    const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Accommodation | null>(null);
    const [form, setForm] = useState({ name: '', images: [] as string[], description: '', type: '3성급 호텔', location: '' });
    const [uploading, setUploading] = useState(false);

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

    const handleImageUpload = async (files: File[]) => {
        if (!files.length) return;
        setUploading(true);
        try { const urls = await Promise.all(files.map(f => uploadImage(f, 'accommodations'))); setForm(f => ({ ...f, images: [...f.images, ...urls] })); }
        catch { adminNotify('이미지 업로드 실패'); }
        finally { setUploading(false); }
    };

    const handleSubmit = async () => {
        if (!adminValidateRequired() || !form.name || !form.location) return;
        try {
            const payload = { name: form.name, images: form.images, description: form.description, type: form.type, location: form.location };
            if (editing) { await api.accommodations.update(editing.id, payload); }
            else { await api.accommodations.create({ ...payload, id: `ACCOM-${Date.now()}` }); }
            await load(); setIsModalOpen(false); resetForm();
        } catch (e: any) { adminNotify('저장 실패: ' + e.message); }
    };

    const handleDelete = async (id: string) => { if (!await adminConfirm('삭제하시겠습니까?')) return; try { await api.accommodations.delete(id); await load(); } catch { adminNotify('삭제 실패'); } };

    return (
        <div className="tm-tab">
            <div className="tm-toolbar">
                <span className="tm-toolbar-text"><small>숙소를 등록하고 예약에 배정합니다.</small></span>
                <AdminButton variant="primary" leading={<IconPlus />} onClick={() => { resetForm(); setIsModalOpen(true); }}>숙소 등록</AdminButton>
            </div>

            {accommodations.length > 0 ? (
                <div className="tm-rows">
                    {accommodations.map(a => (
                        <AdminCard key={a.id} className="tm-row">
                            <span className="tm-photo is-wide">{a.images.length > 0 ? <img src={a.images[0]} alt={a.name} /> : <IconHotel aria-hidden="true" />}</span>
                            <span className="tm-row-text">
                                <span className="tm-row-head"><b>{a.name}</b>{a.type && <AdminBadge>{a.type}</AdminBadge>}</span>
                                <small>{a.location}</small>
                                <small className="tm-clamp">{a.description || '설명 없음'}</small>
                            </span>
                            <span className="tm-row-actions">
                                <AdminIconButton size="sm" label="수정" onClick={() => { setEditing(a); setForm({ name: a.name, images: a.images, description: a.description, type: a.type, location: a.location }); setIsModalOpen(true); }}><IconPencil /></AdminIconButton>
                                <AdminIconButton size="sm" label="삭제" onClick={() => void handleDelete(a.id)}><IconTrash /></AdminIconButton>
                            </span>
                        </AdminCard>
                    ))}
                </div>
            ) : <AdminEmpty icon={<IconHotel />} title="등록된 숙소가 없습니다" />}

            <AdminDialog open={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editing ? '숙소 수정' : '숙소 등록'}
                onSubmit={() => void handleSubmit()} submitLabel={editing ? '수정' : '등록'} submitDisabled={uploading}>
                <AdminField label="이미지">
                    <span className="tm-images">
                        {form.images.map((img, i) => (
                            <span key={i} className="tm-image">
                                <img src={img} alt={`사진 ${i + 1}`} />
                                <AdminIconButton size="sm" variant="background" className="tm-image-off" label={`사진 ${i + 1} 빼기`} onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}><IconClose /></AdminIconButton>
                            </span>
                        ))}
                    </span>
                    <AdminFileButton size="sm" accept="image/*" multiple leading={<IconUpload />} loading={uploading} onFiles={(files) => void handleImageUpload(files)}>이미지 추가</AdminFileButton>
                </AdminField>
                <AdminField label="숙소명" required>{(id) => <AdminTextInput id={id} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />}</AdminField>
                <AdminField label="위치" required>{(id) => <AdminTextInput id={id} value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="예: 울란바토르 시내, 테를지 국립공원" />}</AdminField>
                <AdminField label="숙소 타입">
                    <span className="tm-type-groups">
                        {Object.entries(ACCOM_TYPES).map(([cat, subs]) => (
                            <span key={cat} className="tm-type-group">
                                <small>{cat}</small>
                                <span className="tm-chips" role="group" aria-label={cat}>{subs.map(s => <AdminChip key={s} active={form.type === s} onClick={() => setForm(f => ({ ...f, type: s }))}>{s}</AdminChip>)}</span>
                            </span>
                        ))}
                    </span>
                </AdminField>
                <AdminField label="설명">{(id) => <AdminTextArea id={id} minRows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />}</AdminField>
            </AdminDialog>
        </div>
    );
};

// ─── Main Page ───────────────────────────────────────────
type TemplateTabKey = 'templates' | 'guides' | 'accommodations';
const TABS: Array<{ value: TemplateTabKey; label: string }> = [
    { value: 'templates', label: '일정 템플릿' },
    { value: 'guides', label: '가이드 관리' },
    { value: 'accommodations', label: '숙소 관리' },
];

export const AdminTemplateManage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TemplateTabKey>('templates');

    return (
        <AdminLayout activePage="templates" title="템플릿 관리">
            <div className="tm-page">
                <AdminSegmented label="템플릿 관리 화면" value={activeTab} onChange={setActiveTab} items={TABS} />
                {activeTab === 'templates' && <TemplatesTab />}
                {activeTab === 'guides' && <GuidesTab />}
                {activeTab === 'accommodations' && <AccommodationsTab />}
            </div>
        </AdminLayout>
    );
};
