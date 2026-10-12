import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { SEO } from '../components/seo/SEO';
import { BRAND, COMPANY_INFO, CONTRACT_CANCELLATION_ROWS, CONTRACT_NOTICES, DEPOSIT_ACCOUNT, DEPOSIT_PAYMENT_METHOD, PRIVACY_NOTICES, OTHER_NOTICES, resolveCancellationRows, resolveDepositMethod } from '../constants/company';

/**
 * 여행 계약서(고객용) — Claude Design "Contract.dc.html" 디자인 적용.
 * 잉크블랙 CTA · 애저블루 액센트 · Pretendard. 3가지 시안(clean/card/editorial)을 모두 포팅하고
 * 아래 VARIANT 상수로 전환한다(기본: 시안 A 클린). 내용·문구·입력/서명/제출 로직은 기존 그대로 유지.
 */
const VARIANT: 'clean' | 'card' | 'editorial' = 'clean';

interface Traveler {
    name?: string;
    passportName?: string;
    age?: number | string;
    birthdate?: string;
    phone?: string;
    gender?: string;
}

interface ContractData {
    travelers?: Traveler[];
    arrival?: { date?: string; time?: string; flight?: string };
    departure?: { date?: string; time?: string; flight?: string };
    region?: string;
    category?: string;
    issuedDate?: string;
    agreement?: { agreed?: boolean; name?: string; agreedAt?: string };
    customerSubmittedAt?: string;
}

interface ContractSettings {
    intro?: string;
    paymentMethod?: string;
    paymentDeadline?: string;
    includedText?: string;
    excludedText?: string;
    cancellationRows?: { period: string; fee: string }[];
    signatureNote?: string;
}

interface ContractPageData {
    reservation: {
        id: string;
        reservationNumber: string | null;
        productName: string;
        customerName: string;
        customerPhone?: string;
        travelers: number;
        startDate: string;
        endDate: string;
        totalPrice: number;
        depositAmount: number;
        balanceAmount: number;
        createdAt: string;
    };
    contract: ContractData;
    template?: { id: string; name: string; description?: string; documentSettings?: { contract?: ContractSettings } } | null;
    accommodations: Array<{ day: number; accommodation: { name: string; type?: string; location?: string } }>;
    guide: { name?: string; phone?: string; languages?: any; specialties?: any } | null;
    productIncluded?: string[];
    productExcluded?: string[];
}

const fallbackContract: Required<ContractSettings> = {
    intro: '본 여행 조건서 및 아래 여행 조건에 따라 국외여행 계약을 체결합니다.',
    paymentMethod: DEPOSIT_PAYMENT_METHOD,
    paymentDeadline: '안내 메일에 기재된 기일까지',
    includedText: '숙박비, 식사비, 전용 차량, 드라이버, 한국어 가이드, 일정표에 기재된 체험 요금',
    excludedText: '국제선 항공권, 해외여행 보험, 개인 경비, 일정표에 기재되지 않은 식사',
    cancellationRows: CONTRACT_CANCELLATION_ROWS,
    signatureNote: '위 내용을 확인하고 이에 동의하여 본 계약을 체결합니다.',
};

/**
 * 템플릿에 복사돼 저장돼 있을 수 있는 옛 기본 서문(일본 여행업법 용어 '모집형 기획여행 계약').
 * 손대지 않은 복사본이면 현재 기본 서문(국외여행 계약)으로 바꿔 보여 준다.
 * 일본어 값은 DB의 옛 저장값과 비교하는 용도이므로 번역하지 않는다.
 */
const LEGACY_CONTRACT_INTROS = [
    '本旅行条件書および下記の旅行条件に基づき、募集型企画旅行契約を締結いたします。',
    '본 여행 조건서 및 아래의 여행 조건에 따라 모집형 기획여행 계약을 체결합니다.',
    '본 여행 조건서 및 아래 여행 조건에 따라 모집형 기획여행 계약을 체결합니다.',
];
const resolveContractIntro = (saved: unknown): string => {
    const value = typeof saved === 'string' ? saved.trim() : '';
    return !value || LEGACY_CONTRACT_INTROS.includes(value) ? fallbackContract.intro : value;
};

/** 취소·환불 규정 서문 — 오너의 한국어 계약서(public/계약서.html) '환불규정' 1조의 용어에 맞춘 안내. */
const CANCELLATION_PREAMBLE = '본 상품은 현지 숙소·차량 예약이 완료되는 상품으로, 취소 시 국외여행 표준약관 제6조(특약)에 의거하여 아래 규정이 적용됩니다.';

const fmtDate = (iso?: string) => {
    if (!iso) return '-';
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return iso;
        return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return iso; }
};

const fmtWon = (n?: number) => {
    if (typeof n !== 'number' || isNaN(n)) return '-';
    return `${n.toLocaleString('ko-KR')}원`;
};

const flightLine = (f?: { time?: string; flight?: string }) => {
    const parts = [f?.flight, f?.time].filter(Boolean);
    return parts.length ? parts.join(' / ') : '-';
};

const splitLines = (value?: string) => (value || '').split(/\r?\n|、|,/).map(v => v.trim()).filter(Boolean);

const dash = (v?: string) => (v && String(v).trim()) ? String(v) : '-';

// 예전에 일본어로 저장된 성별 값을 새 한국어 선택지에 맞춘다(읽을 때만 변환).
const GENDER_KO: Record<string, string> = { '男性': '남성', '女性': '여성', 'その他': '기타' };
const normalizeGender = (v?: string) => (v && GENDER_KO[v]) || v || '';

// ─── 디자인 토큰 (myrealtrip-design-system) — .mrtc 스코프 ───
const TOKENS = `
.mrtc{
  --mrt-blue:#1A8CFF; --mrt-blue-strong:#0B6FE0; --mrt-blue-50:#E8F2FF;
  --mrt-red:#FF4F4F; --mrt-red-soft:#FFECEC; --mrt-green:#18A957; --mrt-green-soft:#E4F7EC;
  --mrt-ink:#1A1B1E; --mrt-white:#FFFFFF;
  --mrt-gray-900:#24262B; --mrt-gray-700:#4A4E55; --mrt-gray-600:#5F636B; --mrt-gray-500:#8A8F99;
  --mrt-gray-400:#B4B8C0; --mrt-gray-300:#D7DAE0; --mrt-gray-100:#F1F2F4; --mrt-gray-50:#F7F8FA;
  --border-default:#E6E8EC; --border-subtle:#F1F2F4; --border-strong:#D7DAE0;
  --r-sm:8px; --r-md:12px; --r-lg:16px; --r-pill:999px;
  --shadow-xs:0 1px 2px rgba(26,27,30,.06); --shadow-sm:0 2px 8px rgba(26,27,30,.06); --shadow-md:0 4px 16px rgba(26,27,30,.08);
  --font-sans:'Pretendard',-apple-system,BlinkMacSystemFont,sans-serif;
}
.mrtc input, .mrtc select{ font-family:var(--font-sans); }
.mrtc input:focus, .mrtc select:focus{ border-color:var(--mrt-blue) !important; box-shadow:0 0 0 3px rgba(26,140,255,.15); }
@media print{
  .mrtc-bg{ background:#fff !important; padding:0 !important; }
  .no-print{ display:none !important; }
  .mrtc{ box-shadow:none !important; border-radius:0 !important; }
}
@page{ margin:12mm; }
`;

type T = Record<string, React.CSSProperties>;

// Contract.dc.html theme(mode, variant) 포팅
function buildTheme(m: boolean, variant: string): T {
    const A = 'var(--mrt-blue)', INK = 'var(--mrt-ink)';
    const t: T = {};
    t.page = { background: 'var(--mrt-white)', padding: m ? '24px 16px 34px' : '52px 52px 58px', fontFamily: 'var(--font-sans)', color: 'var(--mrt-gray-900)', position: 'relative', boxSizing: 'border-box', width: '100%' };
    t.brandRow = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: m ? 16 : 22 };
    t.brandMark = { width: m ? 30 : 36, height: m ? 30 : 36, flex: 'none' };
    t.brandName = { fontSize: m ? 13.5 : 16, fontWeight: 800, letterSpacing: '-0.02em', color: INK, lineHeight: 1.15 };
    t.brandSub = { fontSize: m ? 8 : 9, fontWeight: 700, letterSpacing: '0.18em', color: A, marginTop: 2 };
    t.meta = { textAlign: 'right', fontSize: m ? 10 : 11, fontWeight: 700, color: A, lineHeight: 1.7, whiteSpace: 'nowrap' };
    t.hero = { textAlign: 'center', paddingBottom: m ? 20 : 26, borderBottom: '1px solid var(--border-default)', marginBottom: m ? 24 : 34 };
    t.heroEn = { fontSize: m ? 10 : 11.5, fontWeight: 700, letterSpacing: '0.34em', color: 'var(--mrt-gray-400)' };
    t.heroTitle = { fontSize: m ? 28 : 40, fontWeight: 800, letterSpacing: '-0.045em', color: INK, lineHeight: 1.05, margin: m ? '6px 0 8px' : '8px 0 10px' };
    t.heroSub = { fontSize: m ? 12.5 : 14, color: 'var(--mrt-gray-600)', lineHeight: 1.7, maxWidth: 540, margin: '0 auto', fontWeight: 500 };
    t.section = { marginBottom: m ? 24 : 36 };
    t.cardBox = {};
    t.secHead = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: m ? 12 : 16 };
    t.secNum = { flex: 'none', color: A, fontWeight: 800, fontSize: m ? 17 : 20, letterSpacing: '-0.02em' };
    t.plainBar = { flex: 'none', width: 4, height: m ? 16 : 18, borderRadius: 2, background: A };
    t.secTitle = { fontSize: m ? 16.5 : 20, fontWeight: 800, letterSpacing: '-0.03em', color: INK, lineHeight: 1.2 };
    t.kvWrap = { border: '1px solid var(--border-default)', borderRadius: 'var(--r-md)', overflow: 'hidden' };
    t.kvRow = { display: 'flex', flexDirection: m ? 'column' : 'row', gap: m ? 3 : 0, borderBottom: '1px solid var(--border-subtle)', padding: m ? '10px 13px' : 0 };
    t.kvLabel = { flex: m ? 'none' : '0 0 170px', background: m ? 'transparent' : 'var(--mrt-gray-50)', padding: m ? 0 : '13px 16px', fontSize: m ? 11 : 12.5, fontWeight: 700, color: 'var(--mrt-gray-600)', display: 'flex', alignItems: 'center', letterSpacing: '-0.01em' };
    t.kvValue = { flex: 1, padding: m ? 0 : '13px 18px', fontSize: m ? 13 : 14, fontWeight: 500, color: 'var(--mrt-gray-900)', display: 'flex', alignItems: 'center', lineHeight: 1.5 };
    t.payStrong = { flex: 1, padding: m ? 0 : '13px 18px', fontSize: m ? 15 : 17, fontWeight: 800, color: INK, display: 'flex', alignItems: 'center' };
    t.payAccent = { flex: 1, padding: m ? 0 : '13px 18px', fontSize: m ? 15 : 17, fontWeight: 800, color: A, display: 'flex', alignItems: 'center' };
    t.twoCol = { display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: m ? 22 : 34, marginBottom: m ? 24 : 36 };
    t.listItem = { display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: m ? 13 : 14, color: '#34373d', lineHeight: 1.5, padding: '5px 0' };
    t.bullet = { flex: 'none', width: 6, height: 6, borderRadius: '50%', background: A, marginTop: 7 };
    t.bulletMuted = { flex: 'none', width: 6, height: 6, borderRadius: '50%', background: 'var(--mrt-gray-400)', marginTop: 7 };
    t.cancelRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: m ? '11px 14px' : '13px 18px', borderBottom: '1px solid var(--border-subtle)' };
    t.cancelLabel = { fontSize: m ? 12.5 : 14, fontWeight: 700, color: A };
    t.cancelVal = { fontSize: m ? 12.5 : 14, fontWeight: 600, color: 'var(--mrt-gray-700)' };
    t.summaryGrid = { display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : 'repeat(4,1fr)', gap: m ? 8 : 10 };
    t.summaryItem = { background: 'var(--mrt-gray-50)', borderRadius: 'var(--r-sm)', padding: m ? '10px 12px' : '12px 14px' };
    t.summaryLabel = { fontSize: m ? 10.5 : 11.5, fontWeight: 700, color: 'var(--mrt-gray-500)', marginBottom: 4 };
    t.summaryValue = { fontSize: m ? 12.5 : 14, fontWeight: 700, color: INK, lineHeight: 1.4, wordBreak: 'break-word' };
    t.termRow = { display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0' };
    t.termNum = { flex: 'none', width: m ? 20 : 22, height: m ? 20 : 22, borderRadius: '50%', background: 'var(--mrt-blue-50)', color: A, fontSize: m ? 10.5 : 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 };
    t.termText = { fontSize: m ? 12 : 13, lineHeight: 1.65, color: 'var(--mrt-gray-700)', fontWeight: 500 };
    t.closeNote = { textAlign: 'center', fontSize: m ? 13 : 14.5, fontWeight: 700, color: INK, marginTop: m ? 28 : 40, marginBottom: m ? 8 : 10 };
    t.issueLine = { textAlign: 'center', fontSize: m ? 13 : 15, fontWeight: 800, color: A, marginBottom: m ? 22 : 30 };
    t.signLine = { display: 'flex', alignItems: 'center', gap: 14, marginTop: 14, padding: m ? '14px 14px' : '18px 18px', border: '1px dashed var(--border-strong)', borderRadius: 'var(--r-md)' };
    t.signLabel = { fontSize: m ? 12.5 : 13.5, fontWeight: 800, color: 'var(--mrt-gray-600)', flex: 'none' };
    t.signValue = { fontSize: m ? 16 : 20, fontWeight: 700, color: INK };
    t.signBlank = { flex: 1, borderBottom: '1px solid var(--border-strong)', height: m ? 22 : 26 };
    t.footer = { textAlign: 'center', borderTop: '1px solid var(--border-default)', paddingTop: m ? 20 : 26, marginTop: m ? 26 : 36 };
    t.footerName = { fontSize: m ? 12.5 : 14, fontWeight: 800, color: INK, letterSpacing: '0.04em' };
    t.footerMeta = { fontSize: m ? 10.5 : 12, color: 'var(--mrt-gray-500)', marginTop: 5, fontWeight: 500 };
    t.printBtn = { marginTop: m ? 18 : 22, display: 'inline-flex', alignItems: 'center', gap: 8, height: m ? 46 : 50, padding: '0 26px', borderRadius: 'var(--r-pill)', border: '1.5px solid var(--border-default)', background: '#fff', color: INK, fontSize: m ? 13.5 : 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
    t.formPanel = { border: '1.5px solid var(--mrt-blue)', background: 'var(--mrt-blue-50)', borderRadius: 'var(--r-lg)', padding: m ? '18px 14px' : '28px 28px', marginBottom: m ? 28 : 42 };
    t.formIntro = { fontSize: m ? 12 : 13.5, color: 'var(--mrt-gray-600)', margin: m ? '4px 0 16px' : '6px 0 20px', lineHeight: 1.6, fontWeight: 500 };
    t.formInnerCard = { background: '#fff', borderRadius: 'var(--r-md)', padding: m ? '14px 13px' : '20px 20px', marginBottom: 12, boxShadow: 'var(--shadow-xs)' };
    t.travLabel = { fontSize: m ? 12 : 13, fontWeight: 800, color: 'var(--mrt-gray-500)', marginBottom: m ? 12 : 14 };
    t.formGrid = { display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: m ? 11 : 15 };
    t.full = { gridColumn: '1 / -1' };
    t.fieldLabel = { fontSize: m ? 11 : 12, fontWeight: 700, color: 'var(--mrt-gray-600)', marginBottom: 6, display: 'block' };
    t.input = { width: '100%', height: m ? 44 : 46, padding: '0 13px', border: '1.5px solid var(--border-default)', borderRadius: 'var(--r-md)', fontSize: m ? 14 : 14.5, fontFamily: 'var(--font-sans)', color: INK, background: '#fff', boxSizing: 'border-box', outline: 'none', fontWeight: 500 };
    t.travActions = { display: 'flex', alignItems: 'center', gap: 16, margin: m ? '2px 2px 18px' : '4px 2px 24px' };
    t.addBtn = { background: 'none', border: 'none', color: A, fontSize: m ? 13 : 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 };
    t.delBtn = { background: 'none', border: 'none', color: 'var(--mrt-gray-500)', fontSize: m ? 12.5 : 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)', padding: 0 };
    t.flightHead = { display: 'flex', alignItems: 'center', gap: 8, fontSize: m ? 15 : 17, fontWeight: 800, color: INK, letterSpacing: '-0.02em', marginTop: m ? 6 : 8 };
    t.flightDesc = { fontSize: m ? 11.5 : 13, color: 'var(--mrt-gray-600)', margin: '6px 0 14px', lineHeight: 1.6, fontWeight: 500 };
    t.flightGrid = { display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: m ? 12 : 16 };
    t.flightCard = { background: '#fff', borderRadius: 'var(--r-md)', padding: m ? '14px 13px' : '18px 18px', boxShadow: 'var(--shadow-xs)' };
    t.flightTitle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: m ? 12.5 : 14, fontWeight: 800, color: INK, marginBottom: 12 };
    t.agreeRow = { display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', marginTop: m ? 18 : 22, marginBottom: 14 };
    t.agreeText = { fontSize: m ? 12.5 : 14, color: '#33363b', fontWeight: 600, lineHeight: 1.5, paddingTop: 1 };
    t.successBox = { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--mrt-green-soft)', border: '1.5px solid var(--mrt-green)', borderRadius: 'var(--r-md)', padding: m ? '16px 16px' : '20px 22px', marginTop: m ? 18 : 22 };
    t.cta = { width: '100%', height: m ? 52 : 56, border: 'none', borderRadius: 14, background: INK, color: '#fff', fontSize: m ? 15 : 16.5, fontWeight: 800, letterSpacing: '-0.02em', cursor: 'pointer', fontFamily: 'var(--font-sans)', marginTop: m ? 8 : 10, boxShadow: 'var(--shadow-md)' };
    t.ctaDisabled = { width: '100%', height: m ? 52 : 56, border: 'none', borderRadius: 14, background: 'var(--mrt-gray-300)', color: '#fff', fontSize: m ? 15 : 16.5, fontWeight: 800, letterSpacing: '-0.02em', cursor: 'not-allowed', fontFamily: 'var(--font-sans)', marginTop: m ? 8 : 10 };

    if (variant === 'card') {
        t.page = { ...t.page, background: 'var(--mrt-gray-50)' };
        t.section = { background: '#fff', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', padding: m ? '18px 16px' : '28px 30px', marginBottom: m ? 16 : 22 };
        t.cardBox = { background: '#fff', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-sm)', padding: m ? '18px 16px' : '24px 26px' };
        t.twoCol = { display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: m ? 16 : 22, marginBottom: m ? 16 : 22 };
        t.secNum = { flex: 'none', width: m ? 26 : 30, height: m ? 26 : 30, borderRadius: 9, background: INK, color: '#fff', fontSize: m ? 14 : 16, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' };
        t.plainBar = { flex: 'none', width: m ? 14 : 16, height: m ? 14 : 16, borderRadius: 5, background: A };
        t.kvWrap = {};
        t.heroEn = { ...t.heroEn, color: A };
    }
    if (variant === 'editorial') {
        t.hero = { textAlign: 'left', paddingBottom: m ? 16 : 22, borderBottom: '2px solid ' + INK, marginBottom: m ? 26 : 38 };
        t.heroEn = { ...t.heroEn, color: A, letterSpacing: '0.38em' };
        t.heroTitle = { ...t.heroTitle, fontSize: m ? 32 : 50, margin: m ? '8px 0 12px' : '10px 0 16px' };
        t.heroSub = { ...t.heroSub, maxWidth: 'none', margin: 0, textAlign: 'left' };
        t.secHead = { display: 'flex', alignItems: 'baseline', gap: m ? 12 : 16, marginBottom: m ? 14 : 18, borderBottom: '1px solid var(--border-default)', paddingBottom: m ? 10 : 12 };
        t.secNum = { flex: 'none', fontSize: m ? 22 : 32, fontWeight: 800, color: 'var(--mrt-gray-300)', letterSpacing: '-0.04em', lineHeight: 1, minWidth: m ? 22 : 38 };
        t.plainBar = { flex: 'none', width: m ? 7 : 9, height: m ? 7 : 9, borderRadius: '50%', background: A, alignSelf: 'center' };
        t.secTitle = { ...t.secTitle, fontSize: m ? 18 : 23 };
        t.kvWrap = {};
        t.kvRow = { display: 'flex', flexDirection: m ? 'column' : 'row', gap: m ? 3 : 0, borderBottom: '1px solid var(--border-subtle)', padding: m ? '10px 0' : 0 };
        t.kvLabel = { flex: m ? 'none' : '0 0 160px', background: 'transparent', padding: m ? 0 : '12px 0', fontSize: m ? 11 : 12.5, fontWeight: 600, color: 'var(--mrt-gray-500)', display: 'flex', alignItems: 'center' };
        t.kvValue = { flex: 1, padding: m ? 0 : '12px 0', fontSize: m ? 13 : 14.5, fontWeight: 600, color: 'var(--mrt-gray-900)', display: 'flex', alignItems: 'center', lineHeight: 1.5 };
        t.payStrong = { flex: 1, padding: m ? 0 : '12px 0', fontSize: m ? 16 : 19, fontWeight: 800, color: INK, display: 'flex', alignItems: 'center' };
        t.payAccent = { flex: 1, padding: m ? 0 : '12px 0', fontSize: m ? 16 : 19, fontWeight: 800, color: A, display: 'flex', alignItems: 'center' };
        t.cancelRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: m ? '10px 0' : '13px 0', borderBottom: '1px solid var(--border-subtle)' };
        t.summaryItem = { background: 'transparent', borderBottom: '1px solid var(--border-subtle)', borderRadius: 0, padding: m ? '8px 0' : '10px 2px' };
        t.formPanel = { border: '1px solid var(--border-default)', background: '#fff', boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--r-lg)', padding: m ? '18px 14px' : '28px 28px', marginBottom: m ? 28 : 42 };
        t.formInnerCard = { background: 'var(--mrt-gray-50)', borderRadius: 'var(--r-md)', padding: m ? '14px 13px' : '20px 20px', marginBottom: 12 };
        t.flightCard = { background: 'var(--mrt-gray-50)', borderRadius: 'var(--r-md)', padding: m ? '14px 13px' : '18px 18px' };
    }
    return t;
}

const useIsMobile = () => {
    const [m, setM] = useState<boolean>(() => (typeof window !== 'undefined' ? window.innerWidth <= 768 : false));
    useEffect(() => {
        const onResize = () => setM(window.innerWidth <= 768);
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);
    return m;
};

const BrandMark: React.FC<{ style?: React.CSSProperties }> = ({ style }) => (
    <svg style={style} viewBox="0 0 40 40" fill="none" aria-hidden>
        <circle cx="20" cy="20" r="20" fill="#1A8CFF" />
        <path d="M25.5 24.8a8 8 0 1 1-2.6-13.9 6.4 6.4 0 1 0 2.6 13.9Z" fill="#fff" />
        <circle cx="27" cy="14" r="1.4" fill="#fff" />
        <circle cx="30" cy="19" r="1" fill="#fff" />
    </svg>
);

export const DocumentContract: React.FC = () => {
    const { reservationId } = useParams();
    const isMobile = useIsMobile();
    const [data, setData] = useState<ContractPageData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [formTravelers, setFormTravelers] = useState<Traveler[]>([]);
    const [arrival, setArrival] = useState<{ date?: string; time?: string; flight?: string }>({});
    const [departure, setDeparture] = useState<{ date?: string; time?: string; flight?: string }>({});
    const [agreed, setAgreed] = useState(false);
    const [signerName, setSignerName] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!reservationId) return;
        (async () => {
            try {
                const res = await api.documents.contract.get(reservationId);
                setData(res);
            } catch (e: any) {
                setError(e.message || '계약서를 불러오지 못했습니다.');
            } finally {
                setLoading(false);
            }
        })();
    }, [reservationId]);

    // Pretendard 폰트 — 페이지 한정 주입
    useEffect(() => {
        const id = 'doc-noto-sans-kr';
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css';
        document.head.appendChild(link);
    }, []);

    useEffect(() => {
        if (!data) return;
        const c: any = data.contract || {};
        const existing: Traveler[] = Array.isArray(c.travelers) ? c.travelers : [];
        const count = existing.length > 0
            ? existing.length
            : Math.max(1, parseInt(String(data.reservation.travelers || '').replace(/[^0-9]/g, '')) || 1);
        const base: Traveler[] = Array.from({ length: count }, (_, i) => ({
            name: existing[i]?.name || (i === 0 ? data.reservation.customerName : '') || '',
            passportName: existing[i]?.passportName || '',
            birthdate: existing[i]?.birthdate || '',
            gender: normalizeGender(existing[i]?.gender),
            phone: existing[i]?.phone || (i === 0 ? data.reservation.customerPhone : '') || '',
        }));
        setFormTravelers(base);
        setArrival({ date: c.arrival?.date || '', time: c.arrival?.time || '', flight: c.arrival?.flight || '' });
        setDeparture({ date: c.departure?.date || '', time: c.departure?.time || '', flight: c.departure?.flight || '' });
        if (c.agreement?.agreed) {
            setAgreed(true);
            setSignerName(c.agreement.name || '');
            setSaved(true);
        }
    }, [data]);

    const updTraveler = (i: number, field: keyof Traveler, val: string) =>
        setFormTravelers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: val } : t));

    const handleCustomerSubmit = async () => {
        if (!agreed) { alert('여행 계약 내용에 대한 동의가 필요합니다.'); return; }
        if (!signerName.trim()) { alert('서명란에 성함을 입력해 주세요.'); return; }
        if (!reservationId) return;
        setSaving(true);
        try {
            const agreement = { agreed: true, name: signerName.trim(), agreedAt: new Date().toISOString() };
            await api.documents.contract.saveCustomer(reservationId, { travelers: formTravelers, arrival, departure, agreement });
            setSaved(true);
            setData(prev => prev ? { ...prev, contract: { ...prev.contract, travelers: formTravelers, arrival, departure, agreement } } as ContractPageData : prev);
            alert('계약 내용을 제출했습니다.');
        } catch (e: any) {
            alert('제출에 실패했습니다. ' + (e.message || ''));
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <>
                <SEO title="해외여행 계약서" description="고객님 전용 여행 계약서입니다." robots="noindex, nofollow" />
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e7e5df' }}>
                    <div className="h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: '#d6d3cb', borderTopColor: '#1A8CFF' }} />
                </div>
            </>
        );
    }

    if (error || !data) {
        return (
            <>
                <SEO title="해외여행 계약서" description="고객님 전용 여행 계약서입니다." robots="noindex, nofollow" />
                <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#e7e5df' }}>
                    <div style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 18, fontWeight: 800, color: '#1A1B1E', marginBottom: 8 }}>계약서를 표시할 수 없습니다</p>
                        <p style={{ fontSize: 14, color: '#5F636B' }}>{error || 'URL을 확인해 주세요.'}</p>
                    </div>
                </div>
            </>
        );
    }

    const m = isMobile;
    const t = buildTheme(m, VARIANT);
    const A = 'var(--mrt-blue)';
    const { reservation, contract, accommodations, guide, template } = data;
    const contractSettings = { ...fallbackContract, ...(template?.documentSettings?.contract || {}) };
    contractSettings.intro = resolveContractIntro(contractSettings.intro);
    const issuedDate = contract.issuedDate || reservation.createdAt?.split('T')[0] || '';
    const contractNumber = reservation.reservationNumber || reservation.id.slice(0, 8).toUpperCase();
    const cancellationRows = resolveCancellationRows(contractSettings.cancellationRows);
    const depositMethod = resolveDepositMethod(contractSettings.paymentMethod);
    const includedItems = (data.productIncluded && data.productIncluded.length) ? data.productIncluded : splitLines(contractSettings.includedText);
    const excludedItems = (data.productExcluded && data.productExcluded.length) ? data.productExcluded : splitLines(contractSettings.excludedText);
    const includedDisplay = includedItems.length ? includedItems : splitLines(fallbackContract.includedText);
    const excludedDisplay = excludedItems.length ? excludedItems : splitLines(fallbackContract.excludedText);
    const balance = reservation.balanceAmount ?? (reservation.totalPrice - (reservation.depositAmount || 0));

    const tripRows: Array<{ label: string; value: string }> = [
        { label: '여행명', value: reservation.productName },
        { label: '여행 기간', value: `${fmtDate(reservation.startDate)} ~ ${fmtDate(reservation.endDate)}` },
        { label: '참가 인원', value: `${reservation.travelers}명` },
        { label: '고객명', value: `${reservation.customerName} 님` },
        { label: '여행 형태', value: contract.category || '단독 프라이빗 투어' },
        { label: '지역', value: contract.region || '-' },
        { label: '가이드', value: guide?.name ? `${guide.name}${guide.phone ? ` (${guide.phone})` : ''}` : '한국어 가이드가 동행합니다' },
    ];
    const payRows: Array<{ label: string; value: string; vStyle: React.CSSProperties; note?: string }> = [
        { label: '합계 금액', value: fmtWon(reservation.totalPrice), vStyle: t.payStrong },
        { label: '예약금', value: reservation.depositAmount ? fmtWon(reservation.depositAmount) : '-', vStyle: t.kvValue, note: `${depositMethod} (입금 확인 후 예약 확정)` },
        { label: '잔금', value: fmtWon(balance), vStyle: t.payAccent, note: '현지에서 현금 결제' },
        { label: '지급 방법', value: `예약금: ${depositMethod} / 잔금: 현지에서 현금 결제`, vStyle: t.kvValue },
        // 입금 계좌는 예약금을 계좌이체로 받을 때만 안내한다(템플릿에 다른 지급 방법을 적어 둔 경우 제외).
        ...(depositMethod === DEPOSIT_PAYMENT_METHOD
            ? [{ label: '입금 계좌', value: `${DEPOSIT_ACCOUNT.bank} ${DEPOSIT_ACCOUNT.number} (예금주 ${DEPOSIT_ACCOUNT.holder})`, vStyle: t.kvValue }]
            : []),
        { label: '지급 기한', value: contractSettings.paymentDeadline, vStyle: t.kvValue },
    ];
    const termRows = [...CONTRACT_NOTICES, ...PRIVACY_NOTICES, ...OTHER_NOTICES].map((text, i) => ({ n: i + 1, text }));
    const companyRows: Array<{ label: string; value: string }> = [
        { label: '회사명', value: COMPANY_INFO.nameJa },
        { label: '전화번호', value: COMPANY_INFO.phoneKR },
        { label: '대표자', value: COMPANY_INFO.representative || COMPANY_INFO.ceo },
        { label: '등록번호', value: COMPANY_INFO.registrationNumber },
        { label: 'Web', value: COMPANY_INFO.website },
    ];

    // 여행자 정보(요약, 입력값 실시간 반영)
    const summaryRows: Array<{ label: string; value: string }> = [];
    formTravelers.forEach((tv, i) => {
        const sfx = formTravelers.length > 1 ? ` ${i + 1}` : '';
        summaryRows.push({ label: `성명${sfx}`, value: dash(tv.name) });
        summaryRows.push({ label: `여권 영문명${sfx}`, value: dash(tv.passportName) });
        summaryRows.push({ label: `생년월일${sfx}`, value: dash(tv.birthdate) });
        summaryRows.push({ label: `전화번호${sfx}`, value: dash(tv.phone) });
    });
    summaryRows.push({ label: '도착일', value: (arrival.date && arrival.date.trim()) ? fmtDate(arrival.date) : fmtDate(reservation.startDate) });
    summaryRows.push({ label: '출발일', value: (departure.date && departure.date.trim()) ? fmtDate(departure.date) : fmtDate(reservation.endDate) });
    summaryRows.push({ label: '도착편', value: flightLine(arrival) });
    summaryRows.push({ label: '출발편', value: flightLine(departure) });

    const canSubmit = agreed && signerName.trim().length > 0;
    const agreeBox: React.CSSProperties = {
        flex: 'none', width: m ? 22 : 24, height: m ? 22 : 24, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: m ? 13 : 14, color: '#fff', fontWeight: 900, border: agreed ? `1.5px solid ${A}` : '1.5px solid var(--border-strong)', background: agreed ? A : '#fff',
    };

    return (
        <>
            <SEO title="해외여행 계약서" description="고객님 전용 여행 계약서입니다." robots="noindex, nofollow" />
            <style>{TOKENS}</style>

            <div className="mrtc-bg" style={{ minHeight: '100vh', background: '#e7e5df', display: 'flex', justifyContent: 'center', padding: m ? '12px 0 80px' : '40px 16px 90px', boxSizing: 'border-box' }}>
                <div className="mrtc" style={{ width: '100%', maxWidth: 880 }}>
                    <div style={{ ...t.page, borderRadius: m ? 0 : 12, boxShadow: m ? 'none' : '0 8px 30px rgba(0,0,0,.10)', border: m ? 'none' : '1px solid var(--border-default)' }}>

                        {/* 브랜드 행 */}
                        <div style={t.brandRow}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                                <BrandMark style={t.brandMark} />
                                <div>
                                    <div style={t.brandName}>{COMPANY_INFO.nameJa}</div>
                                    <div style={t.brandSub}>{BRAND.nameEn.toUpperCase()}</div>
                                </div>
                            </div>
                            <div style={t.meta}>발행일: {fmtDate(issuedDate)}<br />계약 번호: {contractNumber}</div>
                        </div>

                        {/* 히어로 */}
                        <div style={t.hero}>
                            <div style={t.heroEn}>TRAVEL CONTRACT</div>
                            <div style={t.heroTitle}>여행 계약서</div>
                            <div style={t.heroSub}>{contractSettings.intro}</div>
                        </div>

                        {/* 입력 폼 패널 (화면 전용) */}
                        <div className="no-print" style={t.formPanel}>
                            <div style={t.secHead}>
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1B1E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 7h9M4 12h6M4 17h5" /><path d="m16 16 4-4 2 2-4 4-2.6.6.6-2.6Z" fill="#E8F2FF" /></svg>
                                <span style={t.secTitle}>고객 정보 확인</span>
                                {saved && <span style={{ marginLeft: 'auto', borderRadius: 999, background: A, padding: '3px 10px', fontSize: 11, fontWeight: 800, color: '#fff' }}>제출 완료</span>}
                            </div>
                            <div style={t.formIntro}>여권 정보와 동의 내용을 확인해 주세요. 입력하신 내용은 여행사로 제출됩니다.</div>

                            {formTravelers.map((tv, i) => (
                                <div key={i} style={t.formInnerCard}>
                                    <div style={{ ...t.travLabel, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>여행자 {i + 1}</span>
                                        {formTravelers.length > 1 && (
                                            <button type="button" aria-label="이 여행자 삭제"
                                                onClick={() => setFormTravelers(prev => prev.filter((_, idx) => idx !== i))}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mrt-gray-400)', fontSize: 12.5, fontWeight: 700, padding: 0, fontFamily: 'var(--font-sans)' }}>
                                                ✕ 삭제
                                            </button>
                                        )}
                                    </div>
                                    <div style={t.formGrid}>
                                        <div>
                                            <label style={t.fieldLabel}>성명</label>
                                            <input style={t.input} value={tv.name || ''} onChange={e => updTraveler(i, 'name', e.target.value)} placeholder="홍길동" />
                                        </div>
                                        <div>
                                            <label style={t.fieldLabel}>여권 영문명</label>
                                            <input style={t.input} value={tv.passportName || ''} onChange={e => updTraveler(i, 'passportName', e.target.value)} placeholder="HONG GILDONG" />
                                        </div>
                                        <div>
                                            <label style={t.fieldLabel}>생년월일</label>
                                            <input type="date" style={t.input} value={tv.birthdate || ''} onChange={e => updTraveler(i, 'birthdate', e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={t.fieldLabel}>성별</label>
                                            <select style={t.input} value={tv.gender || ''} onChange={e => updTraveler(i, 'gender', e.target.value)}>
                                                <option value="">선택</option>
                                                <option value="남성">남성</option>
                                                <option value="여성">여성</option>
                                                <option value="기타">기타</option>
                                            </select>
                                        </div>
                                        <div style={t.full}>
                                            <label style={t.fieldLabel}>전화번호</label>
                                            <input style={t.input} value={tv.phone || ''} onChange={e => updTraveler(i, 'phone', e.target.value)} placeholder="010-1234-5678" />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <div style={{ margin: m ? '2px 0 18px' : '4px 0 24px' }}>
                                <button type="button"
                                    onClick={() => setFormTravelers(prev => [...prev, { name: '', passportName: '', birthdate: '', gender: '', phone: '' }])}
                                    style={{ width: '100%', padding: m ? '11px' : '12px', border: '1.5px dashed var(--mrt-blue)', borderRadius: 'var(--r-md)', background: 'var(--mrt-blue-50)', color: 'var(--mrt-blue-strong)', fontSize: m ? 13 : 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                    + 여행자 추가
                                </button>
                            </div>

                            <div style={t.flightHead}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#1A8CFF" aria-hidden><path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5L21 16Z" /></svg>
                                항공편 정보 (항공권)
                            </div>
                            <div style={t.flightDesc}>공항 픽업·샌딩 준비에 사용합니다. 왕복 항공편의 날짜·시각·편명을 가능한 한 자세히 적어 주세요.</div>
                            <div style={t.flightGrid}>
                                <div style={t.flightCard}>
                                    <div style={t.flightTitle}>🛬 도착편 (몽골 도착)</div>
                                    <div style={t.formGrid}>
                                        <div>
                                            <label style={t.fieldLabel}>날짜</label>
                                            <input type="date" style={t.input} value={arrival.date || ''} onChange={e => setArrival(p => ({ ...p, date: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label style={t.fieldLabel}>시각</label>
                                            <input type="time" style={t.input} value={arrival.time || ''} onChange={e => setArrival(p => ({ ...p, time: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 11 }}>
                                        <label style={t.fieldLabel}>편명</label>
                                        <input style={t.input} value={arrival.flight || ''} onChange={e => setArrival(p => ({ ...p, flight: e.target.value }))} placeholder="예: OM302 (인천→울란바토르)" />
                                    </div>
                                </div>
                                <div style={t.flightCard}>
                                    <div style={t.flightTitle}>🛫 출발편 (몽골 출발)</div>
                                    <div style={t.formGrid}>
                                        <div>
                                            <label style={t.fieldLabel}>날짜</label>
                                            <input type="date" style={t.input} value={departure.date || ''} onChange={e => setDeparture(p => ({ ...p, date: e.target.value }))} />
                                        </div>
                                        <div>
                                            <label style={t.fieldLabel}>시각</label>
                                            <input type="time" style={t.input} value={departure.time || ''} onChange={e => setDeparture(p => ({ ...p, time: e.target.value }))} />
                                        </div>
                                    </div>
                                    <div style={{ marginTop: 11 }}>
                                        <label style={t.fieldLabel}>편명</label>
                                        <input style={t.input} value={departure.flight || ''} onChange={e => setDeparture(p => ({ ...p, flight: e.target.value }))} placeholder="예: OM301 (울란바토르→인천)" />
                                    </div>
                                </div>
                            </div>

                            {saved && (
                                <div style={t.successBox}>
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#18A957" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9" /><path d="m8.5 12 2.4 2.4 4.6-4.8" /></svg>
                                    <div>
                                        <div style={{ fontSize: 15, fontWeight: 800, color: '#1A1B1E' }}>제출이 완료되었습니다</div>
                                        <div style={{ fontSize: 12.5, color: 'var(--mrt-gray-600)', marginTop: 3, fontWeight: 500 }}>기재하신 내용을 여행사가 확인한 후 연락드리겠습니다.</div>
                                    </div>
                                </div>
                            )}

                            <div style={t.agreeRow} onClick={() => setAgreed(v => !v)}>
                                <span style={agreeBox}>{agreed ? '✓' : ''}</span>
                                <span style={t.agreeText}>여행 계약 내용, 여행 조건, 취소·환불 규정을 확인하였으며, <b style={{ color: A }}>이에 동의합니다.</b></span>
                            </div>
                            <div>
                                <label style={t.fieldLabel}>서명 (성명)</label>
                                <input style={t.input} value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="성명을 입력해 주세요" />
                            </div>
                            <button style={canSubmit ? t.cta : t.ctaDisabled} disabled={!canSubmit || saving} onClick={handleCustomerSubmit}>
                                {saving ? '제출 중...' : saved ? '다시 제출하기' : '동의하고 제출하기'}
                            </button>
                        </div>

                        {/* 1. 여행 내용 */}
                        <div style={t.section}>
                            <div style={t.secHead}><span style={t.secNum}>1</span><span style={t.secTitle}>여행 내용</span></div>
                            <div style={t.kvWrap}>
                                {tripRows.map((r, i) => (
                                    <div key={i} style={t.kvRow}><div style={t.kvLabel}>{r.label}</div><div style={t.kvValue}>{r.value}</div></div>
                                ))}
                            </div>
                        </div>

                        {/* 2. 지급 조건 */}
                        <div style={t.section}>
                            <div style={t.secHead}><span style={t.secNum}>2</span><span style={t.secTitle}>지급 조건</span></div>
                            <div style={t.kvWrap}>
                                {payRows.map((r, i) => (
                                    <div key={i} style={t.kvRow}>
                                        <div style={t.kvLabel}>{r.label}</div>
                                        <div style={r.note ? { ...r.vStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 3 } : r.vStyle}>
                                            <span>{r.value}</span>
                                            {r.note && <span style={{ fontSize: m ? 11 : 12, fontWeight: 600, color: 'var(--mrt-gray-500)', lineHeight: 1.5 }}>{r.note}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 3 / 4 포함·불포함 */}
                        <div style={t.twoCol}>
                            <div style={t.cardBox}>
                                <div style={t.secHead}><span style={t.secNum}>3</span><span style={t.secTitle}>여행 요금 포함 사항</span></div>
                                <div>
                                    {includedDisplay.map((it, i) => (
                                        <div key={i} style={t.listItem}><span style={t.bullet} /><span>{it}</span></div>
                                    ))}
                                </div>
                            </div>
                            <div style={t.cardBox}>
                                <div style={t.secHead}><span style={t.secNum}>4</span><span style={t.secTitle}>여행 요금 불포함 사항</span></div>
                                <div>
                                    {excludedDisplay.map((it, i) => (
                                        <div key={i} style={t.listItem}><span style={t.bulletMuted} /><span>{it}</span></div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* 5. 취소·환불 규정 */}
                        <div style={t.section}>
                            <div style={t.secHead}><span style={t.secNum}>5</span><span style={t.secTitle}>취소·환불 규정</span></div>
                            <div style={{ ...t.termText, marginBottom: m ? 10 : 12 }}>{CANCELLATION_PREAMBLE}</div>
                            <div style={t.kvWrap}>
                                {cancellationRows.map((c, i) => (
                                    <div key={i} style={t.cancelRow}><span style={t.cancelLabel}>{c.period}</span><span style={t.cancelVal}>{c.fee}</span></div>
                                ))}
                            </div>
                        </div>

                        {/* 여행자 정보 */}
                        <div style={t.section}>
                            <div style={t.secHead}><span style={t.plainBar} /><span style={t.secTitle}>여행자 정보</span></div>
                            <div style={t.summaryGrid}>
                                {summaryRows.map((r, i) => (
                                    <div key={i} style={t.summaryItem}><div style={t.summaryLabel}>{r.label}</div><div style={t.summaryValue}>{r.value}</div></div>
                                ))}
                            </div>
                        </div>

                        {/* 숙박 */}
                        {accommodations && accommodations.length > 0 && (
                            <div style={t.section}>
                                <div style={t.secHead}><span style={t.plainBar} /><span style={t.secTitle}>숙박</span></div>
                                {accommodations.map((a) => (
                                    <div key={a.day} style={{ ...t.summaryGrid, marginBottom: 10 }}>
                                        <div style={t.summaryItem}><div style={t.summaryLabel}>일정</div><div style={t.summaryValue}>{a.day}일차</div></div>
                                        <div style={t.summaryItem}><div style={t.summaryLabel}>숙박 시설</div><div style={t.summaryValue}>{a.accommodation?.name || '-'}</div></div>
                                        <div style={t.summaryItem}><div style={t.summaryLabel}>유형</div><div style={t.summaryValue}>{a.accommodation?.type || '-'}</div></div>
                                        <div style={t.summaryItem}><div style={t.summaryLabel}>지역</div><div style={t.summaryValue}>{a.accommodation?.location || '-'}</div></div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 여행 조건·유의 사항 */}
                        <div style={t.section}>
                            <div style={t.secHead}><span style={t.plainBar} /><span style={t.secTitle}>여행 조건·유의 사항</span></div>
                            <div>
                                {termRows.map((tm) => (
                                    <div key={tm.n} style={t.termRow}><span style={t.termNum}>{tm.n}</span><span style={t.termText}>{tm.text}</span></div>
                                ))}
                            </div>
                        </div>

                        <div style={t.closeNote}>{contractSettings.signatureNote}</div>
                        <div style={t.issueLine}>발행일: {fmtDate(issuedDate)}</div>

                        {/* 여행사 */}
                        <div style={t.section}>
                            <div style={t.secHead}><span style={t.plainBar} /><span style={t.secTitle}>여행사</span></div>
                            <div style={t.kvWrap}>
                                {companyRows.map((r, i) => (
                                    <div key={i} style={t.kvRow}><div style={t.kvLabel}>{r.label}</div><div style={t.kvValue}>{r.value}</div></div>
                                ))}
                            </div>
                            <div style={t.signLine}>
                                <span style={t.signLabel}>여행자 서명</span>
                                {contract.agreement?.agreed ? (
                                    <span style={t.signValue}>
                                        {contract.agreement.name}
                                        <span style={{ marginLeft: 8, fontSize: m ? 11 : 12, fontWeight: 700, color: A }}>전자 동의 완료{contract.agreement.agreedAt ? `: ${contract.agreement.agreedAt.split('T')[0]}` : ''}</span>
                                    </span>
                                ) : (
                                    <span style={t.signBlank} />
                                )}
                            </div>
                        </div>

                        {/* 푸터 */}
                        <div style={t.footer}>
                            <div style={t.footerName}>{COMPANY_INFO.nameEn}</div>
                            <div style={t.footerMeta}>{COMPANY_INFO.website} · {COMPANY_INFO.email}</div>
                            <button className="no-print" style={t.printBtn} onClick={() => { try { window.print(); } catch { /* noop */ } }}>🖨 인쇄 / PDF 저장</button>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
};
