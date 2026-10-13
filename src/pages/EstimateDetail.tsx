import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { SEO } from '../components/seo/SEO';
import { DEPOSIT_PAYMENT_METHOD } from '../constants/company';
import {
    INK, SUB, MUTE, FAINT, BLUE, BLUE_DK, BLUE_BG, GREEN, GREEN_BG, BORDER, HAIRLINE, SECTION, PAGE_BG,
    type DayData, type HeroBadge,
    useIsMobile, DayTimelineBlock, IncludedListsBlock, HeroMobile, HeroPC, InfoBlock, eyebrowStyle, h2Style,
} from '../components/document/ItineraryDocParts';

/**
 * 견적(맞춤 견적 고객 페이지) — 확정 일정표(DocumentItinerary)와 같은
 * ItineraryDocParts 렌더러·디자인을 사용한다. 견적 → 확정 문서가 같은 구조로 이어지고,
 * 관리자가 편집기에서 넣은 일정(사진·설명 전부)이 그대로 보인다.
 * 견적 전용: 진행 단계·요금(확정가/예약금)·예약 요청 CTA·요청 내용.
 * 안전/보험/약관 안내는 계약 전 단계라 넣지 않는다(확정 일정표에만).
 */

export const EstimateDetail: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const [estimate, setEstimate] = useState<any>(null);
    const { showToast, showConfirm } = useToast();
    const m = useIsMobile();
    const parseMoney = (value: any) => {
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        const n = Number(String(value || '').replace(/[^\d]/g, ''));
        return Number.isFinite(n) ? n : 0;
    };
    const parsePeopleCount = (value: any) => {
        const matches = String(value || '').match(/\d+/g);
        if (!matches || matches.length === 0) return 1;
        return Math.max(1, matches.reduce((sum, num) => sum + parseInt(num, 10), 0));
    };
    const getEstimatePricing = (source: any) => {
        const settings = source?.documentContent?.documentSettings;
        const peopleCount = parsePeopleCount(source?.people);
        const confirmedTotal = parseMoney(source?.confirmedPrice);
        const pricePerPerson = parseMoney(settings?.overview?.pricePerPerson);
        const productTotal = pricePerPerson > 0 ? pricePerPerson * peopleCount : 0;
        const total = confirmedTotal > 0 ? confirmedTotal : productTotal;
        // 안내 문구에서 금액만 뽑는다. 계좌번호·전화번호·날짜처럼 하이픈으로 이어진 숫자(1002-245-516496)는
        // 먼저 지우고, 쉼표로 끊은 숫자(300,000)나 '원'이 붙은 숫자(300000원)만 금액으로 본다.
        const paymentInfo = String(settings?.guide?.paymentInfo || '').replace(/\d+(?:\s*-\s*\d+)+/g, ' ');
        const guideAmounts = Array.from(paymentInfo.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*(원)?/g))
            .filter((hit) => hit[1].includes(',') || !!hit[2])
            .map((hit) => parseMoney(hit[1]))
            .filter((amount) => amount >= 1000);
        const explicitDeposit = parseMoney(source?.deposit);
        const deposit = explicitDeposit > 0 ? explicitDeposit : (guideAmounts[0] || (total > 0 ? Math.floor(total * 0.1) : 0));
        return {
            total,
            deposit,
            local: Math.max(0, total - deposit),
            peopleCount,
            pricePerPerson,
            isProductEstimate: confirmedTotal <= 0 && productTotal > 0,
        };
    };

    const handleReservationRequest = async () => {
        const confirmed = await showConfirm({
            title: '예약 상담 신청',
            message: '예약 상담을 신청하시겠습니까?\n신청 후 담당자가 확인하여 안내해 드립니다.',
            confirmText: '신청하기',
            cancelText: '취소',
            type: 'info'
        });

        if (!confirmed) return;

        try {
            const { error } = await (api.quotes as any).update(id, { status: 'reservation_requested' });
            if (error) throw error;

            setEstimate((prev: any) => ({ ...prev, adminStatus: 'reservation_requested', statusLabel: '예약 요청 완료' }));
            showToast('success', '예약 상담 신청이 접수되었습니다. 담당자가 확인 후 바로 연락드리겠습니다.');
        } catch (error) {
            console.error("Failed to update status:", error);
            showToast('error', '오류가 발생했습니다. 다시 시도해 주세요.');
        }
    };

    const handleConfirmReservation = async () => {
        // 1. Confirm Dialog
        const confirmed = await showConfirm({
            title: '예약 요청',
            message: '이 견적 내용으로 예약을 진행하시겠습니까?',
            confirmText: '예약 요청',
            cancelText: '취소',
            type: 'info'
        });

        if (!confirmed) return;

        try {
            const me = await api.auth.me();
            if (!me) {
                showToast('error', '로그인이 필요합니다.');
                navigate('/login');
                return;
            }

            // Navigate to payment page with quote data
            const pricing = getEstimatePricing(estimate);

            navigate('/payment', {
                state: {
                    isQuote: true,
                    quoteId: id,
                    product: {
                        id: id,
                        name: estimate.title || `${estimate.destinations?.[0] || '맞춤'} 여행`,
                        duration: estimate.date || '',
                        price: pricing.total,
                    },
                    totalPeople: pricing.peopleCount,
                    priceBreakdown: {
                        total: pricing.total,
                        deposit: pricing.deposit,
                        local: pricing.local
                    },
                    customerInfo: {
                        name: estimate.contact?.name || '',
                        phone: estimate.contact?.phone || '',
                        email: estimate.contact?.email || ''
                    }
                }
            });

        } catch (error) {
            console.error("Failed to proceed:", error);
            showToast('error', '오류가 발생했습니다.');
        }
    };

    useEffect(() => {
        // Helper: quote fields like travel_types / accommodations are stored as JSON strings in D1.
        // If the server hasn't parsed them, we parse defensively here.
        const asArr = (val: any): string[] => {
            if (!val) return [];
            if (Array.isArray(val)) return val.filter(Boolean);
            if (typeof val === 'string') {
                const trimmed = val.trim();
                if (trimmed.startsWith('[')) {
                    try {
                        const parsed = JSON.parse(trimmed);
                        return Array.isArray(parsed) ? parsed.filter(Boolean) : [trimmed];
                    } catch {
                        return [trimmed];
                    }
                }
                // Comma-separated fallback (e.g. "중앙 몽골, 고비사막")
                return trimmed.split(/,\s*/).filter(Boolean);
            }
            return [];
        };

        const fetchEstimate = async () => {
            try {
                const data = await api.quotes.get(id as string);
                if (!data) return;

                const createdAtRaw = data.created_at || data.createdAt;
                const createdAtDate = createdAtRaw ? new Date(createdAtRaw) : null;
                const createdAtStr = createdAtDate && !isNaN(createdAtDate.getTime())
                    ? createdAtDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '—';

                setEstimate({
                    id: data.id,
                    status: data.status,
                    statusLabel:
                        data.status === 'converted' ? '예약 확정 완료' :
                            data.status === 'reservation_requested' ? '예약 요청 완료' :
                                data.status === 'answered' ? '견적 도착' :
                                    data.status === 'processing' ? '견적 작성 중' : '접수 완료',
                    adminStatus: data.status,
                    title: data.title || `${data.destination || '맞춤'} 여행 견적`,
                    date: data.travel_dates || data.period,
                    type: data.trip_type || '맞춤',
                    people: data.travelers || data.headcount,
                    requestDate: createdAtStr,
                    destinations: asArr(data.destination),
                    themes: asArr(data.travel_types ?? data.travelTypes),
                    accommodations: asArr(data.accommodations),
                    vehicle: data.vehicle,
                    priceRange: data.budget,
                    additionalRequest: data.additional_request,
                    contact: { name: data.name, phone: data.phone, email: data.email },
                    estimateUrl: data.estimate_url,
                    adminNote: data.admin_note,
                    confirmedPrice: data.confirmed_price,
                    deposit: data.deposit,
                    confirmedStartDate: data.confirmed_start_date,
                    confirmedEndDate: data.confirmed_end_date,
                    itinerary: data.itinerary || null,
                    documentContent: data.documentContent || null,
                });
            } catch (error) {
                console.error('Error fetching estimate:', error);
            }
        };
        fetchEstimate();
    }, [id]);

    // 확정 일정표와 동일한 폰트
    useEffect(() => {
        const fid = 'doc-noto-sans-kr';
        if (document.getElementById(fid)) return;
        const link = document.createElement('link');
        link.id = fid; link.rel = 'stylesheet';
        link.href = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css';
        document.head.appendChild(link);
    }, []);

    if (!estimate) {
        return (
            <>
                <SEO title="견적" description="고객님 전용 견적 페이지입니다." robots="noindex, nofollow" />
                <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: PAGE_BG, fontFamily: "'Pretendard',sans-serif" }}>
                    <div style={{ maxWidth: 360, background: '#fff', borderRadius: 4, padding: 28, textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
                        <div style={{ fontSize: 40 }}>📄</div>
                        <p style={{ marginTop: 10, fontSize: 15, fontWeight: 800, color: INK }}>견적 정보를 찾을 수 없습니다.</p>
                        <button onClick={() => navigate(-1)} style={{ marginTop: 14, fontSize: 13, fontWeight: 800, color: BLUE, background: 'none', border: 'none', cursor: 'pointer' }}>돌아가기</button>
                    </div>
                </div>
            </>
        );
    }

    // ── 발송 여부/표시용 파생값 ──
    const isSent = estimate.adminStatus === 'answered' || estimate.adminStatus === 'converted' || estimate.status === 'answered' || estimate.adminStatus === 'reservation_requested';
    const isWriting = estimate.adminStatus === 'processing';
    const isConverted = estimate.status === 'converted';
    const quoteNumber = String(estimate.id || '').slice(0, 8).toUpperCase();
    const periodLabel = (estimate.confirmedStartDate && estimate.confirmedEndDate)
        ? `${String(estimate.confirmedStartDate).slice(0, 10)} ~ ${String(estimate.confirmedEndDate).slice(0, 10)}`
        : (estimate.date || '일정 조율 중');
    const ds = estimate.documentContent?.documentSettings;
    const splitLines = (t?: string) => (t || '').split(/\r?\n/).map((x: string) => x.trim()).filter(Boolean);
    const includedList = splitLines(ds?.overview?.includedText).length > 0 ? splitLines(ds?.overview?.includedText)
        : ['공항 픽업·샌딩·전용 차량', '전 일정 숙박 (호텔·게르)', '일정표에 기재된 식사', '한국어 가이드', '관광지 입장료·각종 체험'];
    const excludedList = splitLines(ds?.overview?.excludedText).length > 0 ? splitLines(ds?.overview?.excludedText)
        : ['국제선 항공권', '해외여행 보험', '개인 경비 (기념품·음료 등)'];
    // 일정: 견적 API의 itinerary(문서 편집본 우선, 없으면 템플릿) → 방어적으로 documentContent.days 폴백
    const docDays: DayData[] = (estimate.itinerary && Array.isArray(estimate.itinerary.days) && estimate.itinerary.days.length > 0)
        ? estimate.itinerary.days
        : (Array.isArray(estimate.documentContent?.days) ? estimate.documentContent.days : []);

    const stepDone = [true, isWriting || isSent, isSent];
    const stepLabels = ['견적 접수', '견적 작성', '발송 완료'];

    // 상태별 히어로 배지 — 확정 일정표의 '예약 확정'과 같은 문법
    const heroBadge: HeroBadge = isConverted
        ? { text: '예약 확정', bg: GREEN_BG, fg: GREEN, dot: GREEN }
        : estimate.adminStatus === 'reservation_requested'
            ? { text: '예약 요청 완료', bg: BLUE_BG, fg: BLUE_DK, dot: BLUE }
            : isSent
                ? { text: '견적', bg: BLUE_BG, fg: BLUE_DK, dot: BLUE }
                : { text: isWriting ? '견적 작성 중' : '접수 완료', bg: '#FEF6E7', fg: '#B45309', dot: '#F59E0B' };
    const heroChips = [`🗓 ${periodLabel}`, estimate.people ? `👤 ${estimate.people}` : '', `🚐 ${estimate.vehicle || '전용 차량'}`].filter(Boolean) as string[];
    const heroSubtitle = '소중한 여행을 위해 정성껏 준비한 견적입니다.';

    const infoItems = [
        { label: '여행자명', value: `${estimate.contact?.name || '—'} 님` },
        { label: '여행 기간', value: periodLabel },
        { label: '인원', value: String(estimate.people || '—') },
        { label: '가이드', value: '한국어 가이드' },
        { label: '차량', value: estimate.vehicle || '전용 차량' },
    ];

    const won = (n: number) => `${(n || 0).toLocaleString('ko-KR')}원`;
    const sectionPad = m ? '20px 18px' : '38px 56px';
    const btnBase: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '15px 0', borderRadius: 14, fontSize: 14, fontWeight: 800, border: 'none', cursor: 'pointer', textDecoration: 'none' };

    // ─── 진행 단계 ───
    const stepsBlock = (
        <div style={{ padding: m ? '18px 18px' : '24px 56px', borderTop: m ? `8px solid ${SECTION}` : `1px solid #EDEFF2` }}>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', maxWidth: 340, margin: '0 auto' }}>
                <div style={{ position: 'absolute', top: 11, left: 12, right: 12, height: 2, background: HAIRLINE }} />
                <div style={{ position: 'absolute', top: 11, left: 12, height: 2, background: BLUE, width: isSent ? 'calc(100% - 24px)' : isWriting ? '50%' : '0%', transition: 'width .4s' }} />
                {stepLabels.map((label, i) => (
                    <div key={label} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: stepDone[i] ? BLUE : '#E2E8F0', border: '4px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,.1)', color: '#fff', fontSize: 11, fontWeight: 900 }}>
                            {stepDone[i] ? '✓' : ''}
                        </span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: stepDone[i] ? BLUE_DK : FAINT }}>{label}</span>
                    </div>
                ))}
            </div>
        </div>
    );

    // ─── 예약 전환 완료 배너 ───
    const convertedBanner = isConverted ? (
        <div style={{ padding: m ? '16px 18px 0' : '24px 56px 0' }}>
            <div style={{ background: INK, borderRadius: 16, padding: m ? 18 : '24px 28px', color: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <span style={{ width: 44, height: 44, flex: 'none', borderRadius: 13, background: 'rgba(255,255,255,.12)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🎉</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: m ? 15 : 17, fontWeight: 800 }}>예약이 접수되었습니다!</div>
                        <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,.7)', marginTop: 3 }}>예약금 입금이 확인되면 최종 확정됩니다. 최신 확정 일정표는 마이페이지에서 확인해 주세요.</div>
                    </div>
                </div>
                <button onClick={() => navigate('/mypage/reservations')} style={{ ...btnBase, marginTop: 14, background: '#fff', color: INK }}>
                    내 예약에서 확인하기 →
                </button>
            </div>
        </div>
    ) : null;

    // ─── 요금 카드 ───
    const pricing = getEstimatePricing(estimate);
    const total = pricing.total;
    const deposit = pricing.deposit;
    const priceBlock = (total > 0) ? (
        <div style={{ padding: sectionPad, borderTop: m ? `8px solid ${SECTION}` : `1px solid #EDEFF2` }}>
            <div style={eyebrowStyle(BLUE, m)}>PRICE</div>
            <h2 style={h2Style(m)}>견적 금액</h2>
            <div style={{ marginTop: m ? 14 : 20, background: SECTION, borderRadius: 16, padding: m ? 16 : '22px 26px' }}>
                {pricing.isProductEstimate && (
                    <div style={{ marginBottom: m ? 12 : 16, padding: m ? '10px 12px' : '12px 14px', borderRadius: 12, background: '#FFF7ED', color: '#B45309', fontSize: m ? 11.5 : 12.5, fontWeight: 800, lineHeight: 1.6 }}>
                        상품에서 불러온 기준 요금을 바탕으로 한 예상 금액입니다. 정식 확정 금액은 담당자가 확인 후 안내해 드립니다.
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 13, color: MUTE, fontWeight: 700 }}>총액</span>
                    <span style={{ fontSize: m ? 24 : 30, fontWeight: 900, color: INK, letterSpacing: '-0.02em' }}>{won(total)}</span>
                </div>
                <div style={{ height: 1, background: BORDER, margin: m ? '12px 0' : '16px 0' }} />
                {pricing.pricePerPerson > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                        <span style={{ fontSize: 12.5, color: MUTE }}>기준 요금 (1인)</span>
                        <span style={{ fontSize: m ? 15 : 17, fontWeight: 800, color: BLUE_DK }}>{won(pricing.pricePerPerson)}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontSize: 12.5, color: MUTE }}>예약금 ({DEPOSIT_PAYMENT_METHOD})</span>
                    <span style={{ fontSize: m ? 15 : 17, fontWeight: 800, color: BLUE_DK }}>{won(deposit)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 8 }}>
                    <span style={{ fontSize: 12.5, color: MUTE }}>잔금 (현지에서 현금 결제)</span>
                    <span style={{ fontSize: m ? 15 : 17, fontWeight: 800, color: INK }}>{won(pricing.local)}</span>
                </div>
            </div>
        </div>
    ) : isSent ? (
        <div style={{ padding: sectionPad, borderTop: m ? `8px solid ${SECTION}` : `1px solid #EDEFF2` }}>
            <div style={{ background: '#FEF6E7', borderRadius: 16, padding: m ? 16 : '20px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#B45309' }}>상담 후 금액이 확정되는 대로 예약하실 수 있습니다.</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#C0842A', marginTop: 4 }}>담당자가 금액을 확정하면 예약 버튼이 활성화됩니다.</div>
            </div>
        </div>
    ) : null;

    // ─── CTA ───
    const requested = estimate.adminStatus === 'reservation_requested' || estimate.adminStatus === 'converted';
    const ctaBlock = (isSent && !isConverted) ? (
        <div style={{ padding: m ? '0 18px 4px' : '0 56px 8px', display: 'flex', flexDirection: 'column', gap: 10, marginTop: m ? 16 : 20 }}>
            {estimate.estimateUrl && (
                <a href={estimate.estimateUrl} target="_blank" rel="noopener noreferrer" style={{ ...btnBase, background: '#fff', color: INK, border: `1px solid ${BORDER}` }}>
                    📄 견적서(첨부) 확인
                </a>
            )}
            {estimate.status === 'answered' ? (
                (total > 0) ? (
                    <button onClick={handleConfirmReservation} style={{ ...btnBase, background: BLUE, color: '#fff', boxShadow: '0 10px 24px rgba(26,140,255,.35)' }}>
                        이 내용으로 예약 요청하기
                    </button>
                ) : null
            ) : (
                <button onClick={handleReservationRequest} disabled={requested}
                    style={{ ...btnBase, background: requested ? SECTION : BLUE, color: requested ? FAINT : '#fff', cursor: requested ? 'not-allowed' : 'pointer', boxShadow: requested ? 'none' : '0 10px 24px rgba(26,140,255,.35)' }}>
                    {estimate.adminStatus === 'reservation_requested' ? '신청 완료' : '예약 상담 신청하기'}
                </button>
            )}
        </div>
    ) : null;

    // ─── 담당자 메시지 ───
    const adminNoteBlock = estimate.adminNote ? (
        <div style={{ padding: m ? '18px 18px 0' : '28px 56px 0' }}>
            <div style={{ background: BLUE_BG, borderRadius: 16, padding: m ? 16 : '20px 24px' }}>
                <div style={{ fontSize: m ? 13 : 14, fontWeight: 800, color: BLUE_DK, marginBottom: 8 }}>💬 담당자 메시지</div>
                <div style={{ fontSize: m ? 12.5 : 13.5, color: '#24405E', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{estimate.adminNote}</div>
            </div>
        </div>
    ) : null;

    // ─── 작성 중 안내 (아직 일정도 없고 발송도 안 된 초기 단계에만) ───
    const writingBlock = (!isSent && docDays.length === 0) ? (
        <div style={{ padding: m ? '18px 18px 0' : '28px 56px 0' }}>
            <div style={{ background: SECTION, borderRadius: 16, padding: m ? 18 : '24px 28px', textAlign: 'center' }}>
                <div style={{ fontSize: m ? 13.5 : 15, fontWeight: 800, color: INK }}>담당자가 견적을 작성하고 있습니다</div>
                <div style={{ fontSize: 12, color: SUB, marginTop: 5 }}>완성되는 대로 메일로 알려 드리겠습니다. 조금만 기다려 주세요.</div>
            </div>
        </div>
    ) : null;

    // ─── 요청 내용 ───
    const requestChips = [...(estimate.destinations || []), ...(estimate.themes || []), ...(estimate.accommodations || [])];
    const recapBlock = (
        <div style={{ padding: m ? '20px 18px 26px' : '36px 56px 44px', borderTop: m ? `8px solid ${SECTION}` : `1px solid #EDEFF2` }}>
            <div style={eyebrowStyle(MUTE, m)}>YOUR REQUEST</div>
            <h2 style={h2Style(m)}>요청 내용</h2>
            {requestChips.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: m ? 12 : 16 }}>
                    {requestChips.map((item: string, idx: number) => (
                        <span key={idx} style={{ fontSize: 12, fontWeight: 700, color: BLUE_DK, background: BLUE_BG, padding: '5px 12px', borderRadius: 999 }}>{item}</span>
                    ))}
                </div>
            )}
            <div style={{ marginTop: m ? 14 : 18 }}>
                {[
                    { label: '희망 예산 (1인)', value: estimate.priceRange || '—' },
                    { label: '성함', value: estimate.contact?.name || '—' },
                    { label: '전화번호', value: estimate.contact?.phone || '—' },
                    { label: '이메일', value: estimate.contact?.email || '—' },
                    { label: '요청일', value: estimate.requestDate || '—' },
                ].map((r, i, arr) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '9px 0', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${HAIRLINE}` }}>
                        <span style={{ fontSize: 13, color: MUTE, flex: 'none' }}>{r.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: INK, textAlign: 'right', wordBreak: 'break-all' }}>{r.value}</span>
                    </div>
                ))}
            </div>
            {estimate.additionalRequest && (
                <div style={{ marginTop: 12, background: SECTION, borderRadius: 14, padding: m ? 14 : '16px 20px', fontSize: 12.5, color: SUB, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{estimate.additionalRequest}</div>
            )}
            <div style={{ marginTop: m ? 22 : 28, textAlign: 'center' }}>
                <div style={{ fontSize: m ? 13 : 15, fontWeight: 800, letterSpacing: '0.04em', color: INK }}>MONGOLIA MILKY WAY</div>
                <div style={{ fontSize: m ? 9 : 12, color: FAINT, lineHeight: 1.6, marginTop: 10 }}>※ 본 견적의 내용·금액은 상담을 거쳐 변경될 수 있습니다. | 견적 번호 {quoteNumber}</div>
            </div>
        </div>
    );

    // ─── 일정표 (확정 일정표처럼 항상 렌더 — 일정이 없으면 "준비 중" 표시) ───
    const itineraryBlock = (
        <div style={{ padding: m ? '22px 18px 8px' : '40px 56px 8px', borderTop: m ? `8px solid ${SECTION}` : `1px solid #EDEFF2` }}>
            {isConverted && (
                <div style={{ marginBottom: 14, background: SECTION, borderRadius: 12, padding: '10px 14px', fontSize: 12, color: SUB }}>
                    ※ 견적 시점의 내용입니다. 최신 확정 일정표는 마이페이지에서 확인해 주세요.
                </div>
            )}
            <DayTimelineBlock days={docDays} m={m} startDate={estimate.confirmedStartDate ? String(estimate.confirmedStartDate).slice(0, 10) : undefined} />
        </div>
    );

    return (
        <>
            <SEO
                title="견적"
                description="고객님 전용 견적 페이지입니다."
                robots="noindex, nofollow"
            />
            <div className="doc-page jp" style={{ minHeight: '100vh', background: PAGE_BG, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: m ? '0 0 40px' : '0 24px 48px', fontFamily: "'Pretendard',sans-serif", boxSizing: 'border-box' }}>
                {/* 상단 바 (뒤로가기) */}
                <div style={{ position: 'sticky', top: 0, zIndex: 50, width: '100%', background: 'rgba(255,255,255,.95)', backdropFilter: 'blur(6px)', borderBottom: `1px solid ${HAIRLINE}` }}>
                    <div style={{ maxWidth: m ? 430 : 1120, margin: '0 auto', display: 'flex', alignItems: 'center', padding: '12px 14px' }}>
                        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: INK, display: 'inline-flex', padding: 6 }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 22 }}>arrow_back</span>
                        </button>
                        <span style={{ flex: 1, textAlign: 'center', fontSize: 15, fontWeight: 800, color: INK, paddingRight: 34 }}>견적 상세</span>
                    </div>
                </div>

                <div style={{ width: '100%', maxWidth: m ? 430 : 1120, marginTop: m ? 12 : 32 }}>
                    <div className="doc-card" style={{ width: '100%', background: '#fff', borderRadius: m ? 4 : 8, boxShadow: m ? '0 1px 3px rgba(0,0,0,.08)' : '0 4px 24px rgba(26,27,30,.10)', overflow: 'hidden' }}>
                        {m ? <HeroMobile badge={heroBadge} title={estimate.title} subtitle={heroSubtitle} chips={heroChips} />
                            : <HeroPC badge={heroBadge} title={estimate.title} subtitle={heroSubtitle} chips={heroChips} />}
                        {convertedBanner}
                        {stepsBlock}
                        {writingBlock}
                        {adminNoteBlock}
                        {m ? (
                            <>
                                <InfoBlock items={infoItems} m={m} />
                                {priceBlock}
                                {ctaBlock}
                                {itineraryBlock}
                                <IncludedListsBlock included={includedList} excluded={excludedList} m={m} />
                                {recapBlock}
                            </>
                        ) : (
                            <>
                                <div style={{ height: 28 }} />
                                <InfoBlock items={infoItems} m={m} />
                                {priceBlock}
                                {ctaBlock}
                                {itineraryBlock}
                                <IncludedListsBlock included={includedList} excluded={excludedList} m={m} />
                                {recapBlock}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
