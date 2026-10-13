import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { SEO } from '../components/seo/SEO';
import {
    INK, SUB, MUTE, FAINT, BLUE, BLUE_DK, BLUE_BG, BLUE_TX, RED, WARN_BG, WARN_TITLE, WARN_SUB, WARN_BULLET,
    BODY, BORDER, HAIRLINE, SECTION, PAGE_BG,
    type DayData, formatRange, computeDuration, splitItems,
    useIsMobile, Bullet, DayTimelineBlock, IncludedListsBlock, HeroMobile, HeroPC, InfoBlock,
    eyebrowStyle, h2Style,
} from '../components/document/ItineraryDocParts';
import { COMPANY_INFO, EMBASSY_INFO, LOCAL_EMERGENCY } from '../constants/company';
import { GuideItineraryPrint } from '../components/document/GuideItineraryPrint';

/**
 * 확정 일정표(고객용) — "確定日程表.dc.html"(모바일) + "確定日程表_PC.dc.html"(PC) 디자인 적용.
 * 반응형: ≤768px = 모바일 라이트 커버 단일 컬럼 / PC = 다크 히어로 + 사이드바 + 와이드 레이아웃.
 * DAY 일정은 상품관리에서 올린 **모든 이미지·내용**(스팟별 사진·제목·설명, 숙소 사진·시설, 식사)을 전부 렌더링한다.
 * 공용 렌더러(ItineraryDocParts)를 견적 페이지(/estimate/:id)와 공유 — 견적→확정 문서가 같은 디자인으로 이어진다.
 */

// ─── 정형 콘텐츠(확정 문서 전용 — 안전/보험/약관) ───
const ACTIVITY_NOTICE = [
    '위험이 따르는 현지 액티비티 참가는 고객님 본인의 자유의사에 따른 것입니다.',
    '체험 중 발생한 사고나 부상은 여행자 보험의 보상 대상에서 제외될 수 있습니다.',
    '고객님 본인의 과실로 인한 사고로 판단되는 경우, 여행사에는 책임 및 귀책사유가 없으며 손해배상 등의 책임도 지지 않으므로 미리 양해해 주시기 바랍니다.',
    '위 내용에 동의하신 고객님만 액티비티에 참가하실 수 있습니다. 현지 참가 시에는 면책 동의서에 서명을 부탁드립니다.',
];
const SAFETY_INTRO = '본 투어는 몽골의 자연 지역·사막 지대·오프로드 구간을 포함하는 특수지역 여행입니다. 여행 중 발생할 수 있는 질병·사고·추가 체류 비용·현지 협조 사항을 사전에 안내해 드려 고객님께 불이익이 생기지 않도록 노력하고 있습니다. 계약 전에 반드시 내용을 확인하시고, 이해·동의하신 후 신청해 주세요.';
const MEDICAL_NOTES = [
    '몽골의 의료 수준·설비는 한국에 비해 충분하다고 할 수 없으며, 고도의 치료나 수술이 필요한 경우 해외에서 치료를 받아야 할 수 있습니다.',
    '울란바토르 시외에서는 의료 시설이 제한적이며 이송에 시간이 걸릴 수 있습니다.',
    '여행 중에는 건강·안전 관리에 각별히 유의해 주세요. 구급차가 필요한 경우 103으로 연락해 주세요.',
];
const CONFIRM_PURPOSE = '자연환경이 혹독한 지역을 방문하는 특수지역 여행이므로, 참가 전에 현지의 특성과 위험을 이해하시고 건강 상태에 문제가 없음을 확인하시도록 하기 위한 것입니다. 날씨·자연재해·교통 사정 등으로 추가 체류 비용이 발생할 수 있다는 점도 사전에 이해하시도록 하여 분쟁을 예방하는 데 목적이 있습니다. 특정 고객님의 참가를 제한하려는 것이 아닙니다. 가족분들께도 여행지·일정·기간을 공유하신 후 참가해 주세요.';
const HEALTH_RISKS = [
    '지방은 비포장도로가 매우 많고 도로 상태가 좋지 않습니다.',
    '안전벨트 미착용으로 인한 사고·부상에 대해서는 여행사·드라이버·가이드가 책임을 지지 않습니다.',
    '최근 이상 기후로 아침저녁 일교차가 클 수 있습니다.',
    '장시간 차량 이동으로 피로가 누적될 수 있습니다.',
    '시외에는 의료 시설이 적어 긴급 시 충분한 의료 서비스를 받지 못할 수 있습니다.',
    '오프로드 주행이나 산악 지대 이동이 있어 사고 위험이나 차량의 심한 흔들림이 발생할 수 있습니다.',
    '식수나 노점 등의 위생 환경으로 인해 건강에 이상이 생길 수 있습니다.',
    '각종 액티비티(승마·낙타·샌드보드 등) 참가는 고객님 본인의 판단에 따른 것이며, 안전 관리는 본인의 책임입니다.',
];
const MEDICAL_CONSULT = [
    '허리 디스크, 변형성 질환, 고혈압, 심장 질환, 신장 질환, 기타 지병이 있으신 분',
    '암 치료 중이신 분, 또는 여행 중 중대한 건강상의 문제가 발생할 가능성이 있는 분',
    '생명 유지와 관련된 약물을 사용 중이신 분',
    '임신 중이신 분',
];
const SENIOR_NOTES = [
    '비포장도로가 많은 특수지역 여행의 참가 가능 여부를 반드시 주치의와 상담해 주세요.',
    '긴급 연락처가 될 가족분의 정보를 출발 전에 제출해 주세요.',
];
const PRECONTRACT = [
    '본 여행이 특수지역 여행이며 일정한 위험성이 따른다는 점을 이해하고 참가합니다.',
    '여행에 지장을 주는 질병이 없음을 확인합니다.',
    '지병이나 기왕증을 알리지 않고 참가하여 발생하는 문제는 본인의 책임으로 합니다.',
    '특수지역의 도로 사정에 따른 위험성을 이해하고, 여행 중에는 항상 안전벨트를 착용합니다.',
    '개인행동으로 그룹에서 이탈한 경우, 그 시점 이후에 발생하는 사고·사건은 본인의 책임으로 합니다.',
];
const ADDITIONAL_COST_TAGS = ['자연재해', '홍수', '도로 붕괴', '악천후', '항공사 결항', '파업', '감염병', '정세 불안', '국경 폐쇄', '기타 예측 불가능한 사태'];
const ADDITIONAL_COST_EXAMPLE = '예) 폭우로 인한 도로 두절 / 결항으로 이동 불가 / 다음 목적지로 이동하지 못해 추가 숙박 / 고객님 사정에 의한 이탈 / 안전상의 이유로 가이드·드라이버가 이동 중지를 판단 / 감염병·정변 등으로 여행 지속이 불가능 등';
const COOPERATION = [
    '가이드·드라이버·다른 고객님에 대한 폭언, 비방·중상, 괴롭힘, 기물 파손, 민폐 행위를 하지 않을 것을 약속합니다.',
    '단체 전체의 안전이나 운영에 중대한 지장이 있다고 판단되는 경우, 가이드는 여행 지속을 거절할 권리를 가집니다.',
    '이 경우 여행 요금은 환불되지 않습니다.',
    '스태프에 대한 폭언·협박·상해 행위는 법적 조치 및 손해배상 청구의 대상이 될 수 있습니다.',
];
const CANCELLATION_CLAUSE = '여행사 또는 여행자는 여행 시작 전에 계약을 해제할 수 있습니다. 손해배상은 소비자분쟁해결기준 및 관계 법령에 따라 처리됩니다. 또한 다른 여행자에게 현저한 폐를 끼치는 경우, 질병 등으로 참가가 곤란한 경우, 여행 요금이 기한까지 지급되지 않은 경우에는 여행사가 계약을 해제할 수 있는 것으로 합니다.';
// 오너의 한국어 계약서(public/계약서.html) '환불규정' 1조와 같은 취지 — 표준약관 조항보다 계약서의 특약(예약금 환불 불가 등)이 우선한다.
const SPECIAL_TERMS_NOTE = '단, 본 상품은 현지 숙소·차량 예약이 완료되는 상품으로, 취소 시 국외여행 표준약관 제6조(특약)에 의거하여 여행 계약서의 취소·환불 규정이 우선 적용됩니다.';
const AGREEMENT_TEXT = '본인은 위 내용에 대해 충분한 설명을 들었으며, 본 여행이 특수지역을 포함하는 여행임을 이해하고 그 내용에 동의하여 참가함을 확인합니다.';

interface DocumentSettings {
    overview?: { heroTagline?: string; intro?: string; includedText?: string; excludedText?: string };
    detail?: { title?: string; note?: string };
    guide?: { guidePhone?: string; emergencyPhone?: string };
}
interface ItineraryData {
    reservation: { id: string; reservationNumber: string | null; productName: string; customerName: string; travelers: number; startDate: string; endDate: string; status: string };
    template: { id: string; name: string; description: string; days: any[]; documentSettings?: DocumentSettings } | null;
    guide: { id?: string; name: string; image?: string; phone?: string; languages?: string[] | string } | null;
    days: DayData[];
    productIncluded?: string[];
    productExcluded?: string[];
}
// 가이드용 사본(관리자→localStorage 전달, 고객 미노출)
interface GuideExtra {
    customerName?: string;
    people?: string;
    arrival?: string;
    departure?: string;
    guideName?: string;
    guidePhone?: string;
    vehicleType?: string;
    vehiclePhone?: string;
    memos?: string[];
}

// 이미 발송한 고객 링크도 기존 INHASU A4 문서로 연결한다. 가이드용 사본은 유지한다.
export const DocumentItinerary: React.FC = () => {
    const { reservationId } = useParams();
    const [params] = useSearchParams();
    const guideMode = params.get('guide') === '1';
    useEffect(() => {
        if (guideMode || !reservationId) return;
        const query = new URLSearchParams({ reservationId });
        if (params.get('preview') === '1') query.set('preview', '1');
        if (params.get('autoprint') === '1') { query.set('m', '0'); query.set('print', '1'); }
        window.location.replace(`/확정일정표?${query}`);
    }, [reservationId, params, guideMode]);
    return guideMode ? <GuideDocumentItinerary /> : <p style={{ padding: 40, textAlign: 'center' }}>확정 일정표를 여는 중…</p>;
};

const GuideDocumentItinerary: React.FC = () => {
    const { reservationId } = useParams();
    const [searchParams] = useSearchParams();
    const guideMode = searchParams.get('guide') === '1';
    // 가이드 인쇄는 항상 라이트(모바일) 레이아웃 — PC 다크 히어로는 브라우저 "배경 그래픽"
    // 옵션이 꺼지면 흰 글자가 흰 배경에 찍혀 사라진다. 라이트 레이아웃은 배경 옵션과 무관하게 안전.
    const isMobileScreen = useIsMobile();
    const m = guideMode ? true : isMobileScreen;
    const [data, setData] = useState<ItineraryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!reservationId) return;
        (async () => {
            try { setData(await api.documents.itinerary.get(reservationId)); }
            catch (e: any) { setError(e.message || '일정표를 불러오지 못했습니다.'); }
            finally { setLoading(false); }
        })();
    }, [reservationId]);

    useEffect(() => {
        const id = 'doc-noto-sans-kr';
        if (document.getElementById(id)) return;
        const link = document.createElement('link');
        link.id = id; link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css';
        document.head.appendChild(link);
    }, []);

    // ── 가이드용 사본 모드 ──
    // 관리자에서 "가이드 PDF"로 열면 ?guide=1 로 들어온다. 가이드 전용 정보(항공편·
    // 요청메모·담당가이드·차량)는 고객용 API 응답에 포함되지 않으므로, 관리자 브라우저의
    // localStorage 로만 전달한다(같은 origin·일회성). 고객은 이 데이터가 없어 절대 노출되지 않는다.
    const [guideExtra, setGuideExtra] = useState<GuideExtra | null>(null);
    useEffect(() => {
        if (!guideMode || !reservationId) return;
        try {
            const raw = localStorage.getItem(`guideDoc:${reservationId}`);
            if (raw) { setGuideExtra(JSON.parse(raw)); localStorage.removeItem(`guideDoc:${reservationId}`); }
        } catch { /* ignore */ }
    }, [guideMode, reservationId]);
    // 데이터가 그려진 뒤 자동 인쇄(관리자가 바로 PDF 저장할 수 있도록). 수동 인쇄 버튼도 유지된다.
    // lazy 이미지가 인쇄 전에 로드되도록 강제 eager + 로드 완료 대기(최대 4초 캡).
    useEffect(() => {
        if (searchParams.get('autoprint') !== '1' || loading || error || !data) return;
        let printed = false;
        const doPrint = () => {
            if (printed) return;
            printed = true;
            const previousTitle = document.title;
            // Chromium 인쇄의 선택적 머리글에 긴 페이지 제목이 반복되지 않도록 비운다.
            if (guideMode) document.title = ' ';
            const closeAfterPrint = guideMode && searchParams.get('autoclose') === '1';
            const finishPrint = () => {
                document.title = previousTitle;
                if (closeAfterPrint) window.setTimeout(() => window.close(), 300);
            };
            try {
                window.addEventListener('afterprint', finishPrint, { once: true });
                window.focus();
                window.print();
                if (!closeAfterPrint) window.setTimeout(finishPrint, 10000);
            } catch {
                finishPrint();
            }
        };
        const kick = window.setTimeout(() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            imgs.forEach((im) => { try { im.loading = 'eager'; const s = im.getAttribute('src'); if (s && !im.complete) im.setAttribute('src', s); } catch { /* noop */ } });
            const pending = imgs.filter((im) => !im.complete);
            if (pending.length === 0) { window.setTimeout(doPrint, 300); return; }
            let remaining = pending.length;
            const onDone = () => { remaining -= 1; if (remaining <= 0) window.setTimeout(doPrint, 300); };
            pending.forEach((im) => { im.addEventListener('load', onDone, { once: true }); im.addEventListener('error', onDone, { once: true }); });
            window.setTimeout(doPrint, 4000); // 하드 캡: 일부 이미지가 안 떠도 인쇄는 진행
        }, 500);
        return () => window.clearTimeout(kick);
    }, [searchParams, loading, error, data, guideMode]);

    if (loading) {
        return (<>
            <SEO title="확정 일정표" description="고객님 전용 여행 일정표입니다." robots="noindex, nofollow" />
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAGE_BG }}>
                <div className="h-8 w-8 animate-spin rounded-full border-4" style={{ borderColor: '#d6d3cb', borderTopColor: BLUE }} />
            </div>
        </>);
    }
    if (error || !data) {
        return (<>
            <SEO title="확정 일정표" description="고객님 전용 여행 일정표입니다." robots="noindex, nofollow" />
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: PAGE_BG }}>
                <div style={{ maxWidth: 360, background: '#fff', borderRadius: 4, padding: 28, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
                    <div style={{ fontSize: 40 }}>🗓</div>
                    <p style={{ marginTop: 10, fontSize: 17, fontWeight: 800, color: INK }}>일정표를 표시할 수 없습니다</p>
                    <p style={{ marginTop: 4, fontSize: 13, color: SUB }}>{error || 'URL을 확인해 주세요.'}</p>
                </div>
            </div>
        </>);
    }

    const { reservation, template, guide, days } = data;
    const settings = template?.documentSettings || {};
    const overview = settings.overview || {};
    const detail = settings.detail || {};
    const guideSettings = settings.guide || {};
    const duration = computeDuration(reservation.startDate, reservation.endDate);
    const durationChip = duration ? `${duration.nights}박 ${duration.days}일` : `총 ${days.length}일`;
    const title = template?.name || reservation.productName;
    // 고객별 문서 편집기에서 고친 소개문이 프리셋 기본 문구보다 우선한다.
    const subtitle = template?.description || overview.heroTagline || '중앙 몽골의 대자연과 문화를 체험하는 특별한 여행으로. 한국어 가이드 동행.';

    const productInc = data.productIncluded || [];
    const productExc = data.productExcluded || [];
    const includedDisplay = productInc.length ? productInc : (splitItems(overview.includedText).length ? splitItems(overview.includedText)
        : ['공항 픽업·샌딩·전용 차량', '전 일정 숙박 (호텔·게르)', '일정표에 기재된 식사', '한국어 가이드 동행', '관광지 입장료·각종 체험']);
    const excludedDisplay = productExc.length ? productExc : (splitItems(overview.excludedText).length ? splitItems(overview.excludedText)
        : ['국제선 항공권', '해외여행 보험', '개인 경비 (기념품·음료 등)', '가이드·드라이버 팁']);

    const officePhone1 = COMPANY_INFO.phoneKR;
    const officePhone2 = guideSettings.emergencyPhone || guide?.phone || COMPANY_INFO.phoneSecondary;
    const telHref = (p: string) => `tel:${p.replace(/[^+\d]/g, '')}`;

    const infoItems: Array<{ label: string; value: string }> = [
        { label: '고객명', value: `${reservation.customerName || '—'} 님` },
        { label: '여행 기간', value: formatRange(reservation.startDate, reservation.endDate) },
        { label: '인원', value: `${reservation.travelers || '-'}명` },
        { label: '가이드', value: guide?.name || '한국어 가이드' },
        { label: '차량', value: '전용 차량' },
    ];

    if (guideMode) {
        return (
            <>
                <SEO title="가이드용 여행 일정" description="담당 가이드용 여행 일정표입니다." robots="noindex, nofollow" />
                <GuideItineraryPrint reservation={reservation} title={title} days={days} extra={guideExtra} />
            </>
        );
    }

    const blockTitle: React.CSSProperties = { fontSize: m ? 14 : 16, fontWeight: 800, color: INK };
    const prose: React.CSSProperties = { fontSize: m ? 12.5 : 13.5, color: SUB, lineHeight: 1.8, marginTop: 8 };

    // ─── 포함/불포함 (+ 확정 문서 전용: 활동 주의·보험 안내) ───
    const includedBlock = (
        <IncludedListsBlock included={includedDisplay} excluded={excludedDisplay} m={m}>
            {/* 활동 주의 + 보험 안내 — 가이드 모드에서는 숨김(안전/보험 안내 제외) */}
            {!guideMode && (
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1.4fr 1fr', gap: m ? 12 : 16, marginTop: m ? 16 : 24 }}>
                    <div style={{ background: WARN_BG, borderRadius: 16, padding: m ? 16 : '22px 24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span style={{ fontSize: m ? 15 : 17 }}>⚠️</span><span style={{ fontSize: m ? 13.5 : 15, fontWeight: 800, color: WARN_TITLE }}>현지 액티비티 참가 안내</span><span style={{ fontSize: m ? 11.5 : 12, color: WARN_SUB }}>승마·낙타 타기·샌드보드</span></div>
                        <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: m ? 8 : '10px 20px', marginTop: m ? 12 : 14 }}>
                            {ACTIVITY_NOTICE.map((tx, i) => <Bullet key={i} color={WARN_BULLET}>{tx}</Bullet>)}
                        </div>
                    </div>
                    <div style={{ background: BLUE_BG, borderRadius: 16, padding: m ? 16 : '22px 24px' }}>
                        <div style={{ fontSize: m ? 13.5 : 15, fontWeight: 800, color: BLUE_DK }}>☞ 해외여행 보험에 반드시 가입해 주세요</div>
                        <div style={{ fontSize: m ? 12.5 : 13, color: BLUE_TX, lineHeight: 1.75, marginTop: 10 }}>만일의 사고나 질병, 수하물 분실 등에 대비해 출발 전에 해외여행 보험에 반드시 가입해 주시기 바랍니다.</div>
                    </div>
                </div>
            )}
        </IncludedListsBlock>
    );

    // ─── 해외 안전 정보 ───
    const safetyBlock = (
        <div style={{ padding: m ? '24px 18px 26px' : '36px 56px 44px', borderTop: m ? `8px solid ${SECTION}` : `1px solid #EDEFF2` }} className="print-break">
            <div style={eyebrowStyle(RED, m)}>SAFETY &amp; EMERGENCY</div>
            <h2 style={h2Style(m)}>해외 안전 정보·안내 사항</h2>

            {/* 긴급 연락처 (블랙) */}
            <div style={{ marginTop: m ? 16 : 22, background: INK, borderRadius: 16, padding: m ? 18 : '26px 30px', color: '#fff', display: 'grid', gridTemplateColumns: m ? '1fr' : '1.1fr 1.5fr', gap: m ? 18 : 36, alignItems: 'center' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ width: 9, height: 9, borderRadius: '50%', background: RED, boxShadow: '0 0 0 4px rgba(255,79,79,.25)' }} /><span style={{ fontSize: m ? 14 : 16, fontWeight: 800 }}>긴급 연락처</span></div>
                    <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.65)', lineHeight: 1.65, marginTop: 10 }}>현지 상황은 시시각각 변하므로 현지 총괄 책임자가 상시 관리하고 있습니다. 출발 전에 <b style={{ color: '#fff' }}>카카오톡</b> 연락처를 안내해 드립니다.</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', letterSpacing: '0.06em', marginTop: 16 }}>현지 사무소 (한국어 응대 가능)</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: m ? 10 : 20, marginTop: 8 }}>
                        <a href={telHref(officePhone1)} style={{ textDecoration: 'none', color: '#fff', fontSize: m ? 16 : 18, fontWeight: 800 }}>📞 {officePhone1}</a>
                        {officePhone2 && officePhone2 !== officePhone1 && <a href={telHref(officePhone2)} style={{ textDecoration: 'none', color: '#fff', fontSize: m ? 16 : 18, fontWeight: 800 }}>{officePhone2}</a>}
                    </div>
                </div>
                <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', letterSpacing: '0.06em', marginBottom: 10 }}>현지 긴급 신고 번호</div>
                    <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: 10 }}>
                        {LOCAL_EMERGENCY.map(e => (
                            <a key={e.number} href={telHref(e.number)} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(255,255,255,.07)', borderRadius: 11, padding: '12px 14px' }}>
                                <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,.65)' }}>{e.label}</span>
                                <span style={{ fontSize: 22, fontWeight: 800, color: '#FF7A7A' }}>{e.number}</span>
                            </a>
                        ))}
                    </div>
                </div>
            </div>

            {/* 대사관 + 회사 */}
            <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: m ? 12 : 16, marginTop: m ? 12 : 22 }}>
                <div style={{ padding: m ? 16 : '20px 22px', background: SECTION, borderRadius: 14 }}>
                    <div style={{ fontSize: m ? 14 : 15, fontWeight: 800, color: INK }}>{EMBASSY_INFO.nameJa}</div>
                    <div style={{ fontSize: 13, color: SUB, lineHeight: 1.6, marginTop: 8 }}>{EMBASSY_INFO.addressJa}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 13, color: MUTE }}>대표 전화</span><a href={telHref(EMBASSY_INFO.phone)} style={{ fontSize: 14, fontWeight: 700, color: BLUE, textDecoration: 'none' }}>{EMBASSY_INFO.phone}</a></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontSize: 13, color: MUTE }}>긴급 (24시간)</span><a href={telHref(EMBASSY_INFO.emergencyPhone)} style={{ fontSize: 14, fontWeight: 700, color: BLUE, textDecoration: 'none' }}>{EMBASSY_INFO.emergencyPhone}</a></div>
                        {EMBASSY_INFO.email && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}><span style={{ fontSize: 13, color: MUTE }}>이메일</span><a href={`mailto:${EMBASSY_INFO.email}`} style={{ fontSize: 14, fontWeight: 700, color: BLUE, textDecoration: 'none', wordBreak: 'break-all' }}>{EMBASSY_INFO.email}</a></div>}
                    </div>
                </div>
                <div style={{ padding: m ? 16 : '20px 22px', background: SECTION, borderRadius: 14 }}>
                    <div style={{ fontSize: m ? 14 : 15, fontWeight: 800, color: INK, marginBottom: 10 }}>회사 정보</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '7px 16px' }}>
                        {[['상호', COMPANY_INFO.nameLegal], ['대표자', COMPANY_INFO.ceo], ['사업자 등록', COMPANY_INFO.registrationNumber], ['관광사업 등록', COMPANY_INFO.tourRegistrationNumber], ['소재지', COMPANY_INFO.addressJa]].map(([k, v]) => (
                            <React.Fragment key={k}>
                                <span style={{ fontSize: 13, color: MUTE }}>{k}</span>
                                <span style={{ fontSize: 13, fontWeight: 600, color: '#24262B', lineHeight: 1.5 }}>{v}</span>
                            </React.Fragment>
                        ))}
                    </div>
                </div>
            </div>

            {/* 안전 안내 + 의료 + 목적 + 계약전확인 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: m ? 18 : 22, marginTop: m ? 20 : 28 }}>
                <div><div style={blockTitle}>안전 관련 안내</div><div style={prose}>{SAFETY_INTRO}</div></div>
                <div>
                    <div style={blockTitle}>의료 기관 안내</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>{MEDICAL_NOTES.map((tx, i) => <Bullet key={i}>{tx}</Bullet>)}</div>
                </div>
                <div><div style={blockTitle}>본 확인서의 목적</div><div style={prose}>{CONFIRM_PURPOSE}</div></div>
                <div>
                    <div style={blockTitle}>계약 전 확인 사항</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>{PRECONTRACT.map((tx, i) => <Bullet key={i} n={i + 1}>{tx}</Bullet>)}</div>
                </div>
            </div>

            {/* 건강·질병 리스크 */}
            <div style={{ marginTop: m ? 18 : 22, background: WARN_BG, borderRadius: 16, padding: m ? 16 : '20px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ fontSize: m ? 15 : 16 }}>⚠️</span><span style={{ fontSize: m ? 14 : 15, fontWeight: 800, color: WARN_TITLE }}>건강 및 질병 위험</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: m ? 8 : '9px 18px', marginTop: 13 }}>
                    {HEALTH_RISKS.map((tx, i) => <Bullet key={i} n={i + 1} color={WARN_BULLET}>{tx}</Bullet>)}
                </div>
            </div>
            <div style={{ marginTop: m ? 18 : 22 }}>
                <div style={blockTitle}>계약 전에 의사와 상담이 필요하신 분</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>{MEDICAL_CONSULT.map((tx, i) => <Bullet key={i} n={i + 1}>{tx}</Bullet>)}</div>
            </div>
            <div style={{ marginTop: m ? 14 : 18, background: BLUE_BG, borderRadius: 14, padding: m ? '14px 16px' : '18px 20px' }}>
                <div style={{ fontSize: m ? 13 : 15, fontWeight: 800, color: BLUE_DK }}>75세 이상 고객님께</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 9 }}>{SENIOR_NOTES.map((tx, i) => <Bullet key={i} n={i + 1}><span style={{ color: BLUE_TX }}>{tx}</span></Bullet>)}</div>
            </div>

            {/* 추가 비용 */}
            <div style={{ marginTop: m ? 20 : 30 }}>
                <div style={blockTitle}>추가 체류 비용 발생 가능성 안내</div>
                <div style={prose}>아래와 같은 불가항력으로 일정 변경이나 연박이 필요해진 경우, 발생하는 추가 비용은 고객님 부담입니다.</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
                    {ADDITIONAL_COST_TAGS.map((tx, i) => <span key={i} style={{ fontSize: 12.5, color: BODY, background: HAIRLINE, padding: '5px 12px', borderRadius: 999 }}>{tx}</span>)}
                </div>
                <div style={{ fontSize: 12.5, color: MUTE, lineHeight: 1.75, marginTop: 10 }}>{ADDITIONAL_COST_EXAMPLE}</div>
            </div>

            {/* 협력 + 약관 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: m ? 20 : 26, marginTop: m ? 20 : 30 }}>
                <div>
                    <div style={blockTitle}>가이드 및 스태프에 대한 협조</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>{COOPERATION.map((tx, i) => <Bullet key={i} n={i + 1}>{tx}</Bullet>)}</div>
                </div>
                <div><div style={blockTitle}>국외여행 표준약관 제16조 (여행출발 전 계약해제)</div><div style={prose}>{CANCELLATION_CLAUSE}</div><div style={prose}>{SPECIAL_TERMS_NOTE}</div></div>
            </div>

            {/* 동의 */}
            <div style={{ marginTop: m ? 22 : 30, background: SECTION, border: '1px dashed #D7DAE0', borderRadius: 16, padding: m ? '18px 16px' : '24px 28px' }}>
                <div style={{ fontSize: m ? 12.5 : 14, color: '#24262B', lineHeight: 1.8, fontWeight: 600, textAlign: 'center' }}>{AGREEMENT_TEXT}</div>
            </div>
            <div style={{ marginTop: m ? 20 : 26, textAlign: 'center' }}>
                <div style={{ fontSize: m ? 13 : 15, fontWeight: 800, letterSpacing: '0.04em', color: INK }}>MONGOLIA MILKY WAY</div>
                <div style={{ fontSize: m ? 9 : 12, color: FAINT, lineHeight: 1.6, marginTop: 10 }}>{detail.note ? `※ ${detail.note}` : '※ 본 일정은 현지 사정(날씨·교통 상황 등)에 따라 변경될 수 있습니다.'}</div>
            </div>
        </div>
    );

    // ─── 가이드용 사본(관리자 발행 시에만·상단) ───
    const guideRows: Array<{ label: string; value?: string }> = guideExtra ? [
        { label: '고객', value: guideExtra.customerName ? `${guideExtra.customerName} 님` : undefined },
        { label: '여행 기간', value: formatRange(reservation.startDate, reservation.endDate) },
        { label: '인원', value: guideExtra.people },
        { label: '도착편', value: guideExtra.arrival },
        { label: '출발편', value: guideExtra.departure },
        { label: '담당 가이드', value: [guideExtra.guideName, guideExtra.guidePhone].filter(Boolean).join(' · ') || undefined },
        { label: '차량', value: [guideExtra.vehicleType, guideExtra.vehiclePhone].filter(Boolean).join(' · ') || undefined },
    ].filter(r => r.value) : [];
    const guideBlock = guideExtra ? (
        <div className="print-break" style={{ padding: m ? '16px 16px 0' : '24px 56px 0' }}>
            <div style={{ border: `1px solid ${BORDER}`, borderRadius: 14, padding: m ? '14px 15px' : '18px 22px', background: '#FBFCFE' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: m ? 10 : 12 }}>
                    <span style={{ fontSize: m ? 14 : 16 }}>🧭</span>
                    <span style={{ fontSize: m ? 13 : 15, fontWeight: 800, color: INK }}>가이드용 / Гайдын мэдээлэл</span>
                    <span style={{ fontSize: 11, color: MUTE }}>(고객용 문서에는 표시되지 않습니다)</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: m ? '1fr' : '1fr 1fr', gap: m ? '8px' : '10px 28px' }}>
                    {guideRows.map((r, i) => (
                        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'baseline', borderBottom: `1px solid ${HAIRLINE}`, paddingBottom: 7 }}>
                            <span style={{ fontSize: 12, color: MUTE, flex: 'none', width: m ? 72 : 84 }}>{r.label}</span>
                            <span style={{ fontSize: m ? 13 : 13.5, fontWeight: 700, color: INK }}>{r.value}</span>
                        </div>
                    ))}
                </div>
                {guideExtra.memos && guideExtra.memos.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: WARN_TITLE, marginBottom: 6 }}>⚑ 요청 사항·메모</div>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {guideExtra.memos.map((mm, i) => <li key={i} style={{ fontSize: 12.5, color: BODY, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{mm}</li>)}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    ) : null;

    const heroBadge = { text: '예약 확정' };
    const heroChips = [`🗓 ${durationChip}`, `👤 ${reservation.travelers || '-'}명`, '🚐 전용 차량'];
    const itinerary = <DayTimelineBlock days={days} m={m} startDate={reservation.startDate} heading={detail.title || '여행 일정표'} />;
    const infoBlock = <InfoBlock items={infoItems} m={m} />;

    return (
        <>
            <SEO title="확정 일정표" description="고객님 전용 여행 일정표입니다." robots="noindex, nofollow" />
            <style>{`
                @media print {
                    body { background:#fff !important; }
                    .no-print { display:none !important; }
                    .doc-page { background:#fff !important; padding:0 !important; }
                    .doc-card { box-shadow:none !important; max-width:100% !important; width:100% !important; border-radius:0 !important; }
                    .print-break { break-inside:avoid; page-break-inside:avoid; }
                    /* 인쇄 시 떠 있는 채팅 위젯 숨김 (PDF에 찍히지 않도록) */
                    .floating-line-btn, #ch-plugin-entry, #ch-plugin-launcher { display:none !important; }
                    /* 브라우저 "배경 그래픽" 옵션이 꺼져 있어도 타임라인 라인·DAY 포인트·
                       식사 칩·섹션 배경색이 그대로 인쇄되도록 강제 */
                    .doc-card, .doc-card * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                }
                @page { size: A4; margin:10mm; }
            `}</style>

            {/* 가이드 모드는 인쇄 전용 — 카드가 A4 전폭을 쓰도록 인라인에서 직접 전폭 렌더(CSS 오버라이드 의존 X) */}
            <div className="doc-page jp" style={{ minHeight: '100vh', background: guideMode ? '#fff' : PAGE_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: guideMode ? '0 0 24px' : (m ? '16px 12px 90px' : '40px 24px 90px'), fontFamily: "'Pretendard',sans-serif", boxSizing: 'border-box' }}>
                <div className="doc-card" style={{ width: '100%', maxWidth: guideMode ? '100%' : (m ? 430 : 1120), background: '#fff', borderRadius: guideMode ? 0 : (m ? 4 : 8), boxShadow: guideMode ? 'none' : (m ? '0 1px 3px rgba(0,0,0,.08)' : '0 4px 24px rgba(26,27,30,.10)'), overflow: 'hidden' }}>
                    {m ? <HeroMobile badge={heroBadge} title={title} subtitle={subtitle} chips={heroChips} /> : <HeroPC badge={heroBadge} title={title} subtitle={subtitle} chips={heroChips} />}
                    {guideBlock}
                    {m ? (
                        <>
                            {/* 가이드용 사본이 있으면 여행 기간까지 포함하므로 여행 정보는 중복 → 숨김 */}
                            {!guideExtra && infoBlock}
                            <div style={{ padding: '22px 18px 8px', borderTop: `8px solid ${SECTION}` }}>{itinerary}</div>
                            {includedBlock}
                            {!guideMode && safetyBlock}
                        </>
                    ) : (
                        <>
                            <div style={{ padding: '40px 56px 8px' }}>{itinerary}</div>
                            {!guideExtra && infoBlock}
                            <div style={{ height: 32 }} />
                            {includedBlock}
                            {!guideMode && safetyBlock}
                        </>
                    )}
                </div>

                <div className="no-print" style={{ position: 'sticky', bottom: 16, marginTop: 18, display: 'flex', justifyContent: 'center' }}>
                    <button onClick={() => window.print()} style={{ display: 'inline-flex', height: 48, alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, padding: '0 24px', fontSize: 14, fontWeight: 800, color: '#fff', border: 'none', cursor: 'pointer', background: BLUE, boxShadow: '0 10px 24px rgba(26,140,255,0.4)' }}>
                        🖨 인쇄 / PDF 저장
                    </button>
                </div>
            </div>
        </>
    );
};
