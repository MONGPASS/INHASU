import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSpotImages } from '../../hooks/useSpotImages';
import { HOME_IMG } from '../home/homeContent';
import { SD, SIcon } from '../site-seed/seed';
import { boxButton } from '../mypage-desktop/myBookingView';
import {
    CITY_STAYS, EMAIL_RE, FLIGHT_NO, FLIGHT_OPTIONS, GER_STAYS, MAX_PAX, PHONE_RE, QUOTE_STEP_LABELS, TRAVEL_STYLES, TRIP_TYPES, VEHICLES,
    flightYes, phoneDigits, scrollToQuoteStep, totalPax, vehicleAdvice,
} from '../estimate-desktop/quoteForm';
import { myQuotePath, quoteLinkDate } from '../estimate-desktop/quoteLinks';
import { Q_INPUT } from '../estimate-desktop/quoteSeed';
import {
    QChips, QCheckRow, QuoteHoneypot, QDates, QDestinations, QError, QField, QFile, QHint, QKakaoLink, QLabel, QPeople, QProgress, QReceipt, QSection, QStatusCard, QVehicles,
} from '../estimate-desktop/QuoteSeedParts';
import { useQuoteForm } from '../estimate-desktop/useQuoteForm';
import { MobileShell } from '../mobile/MobileShell';

const SLIDES = [
    { img: HOME_IMG.steppeGallop, alt: '초원에서 말을 타는 여행자들', title: ['원하는 대로,', '우리만의 몽골 여행'], sub: '100% 프라이빗 맞춤 견적' },
    { img: HOME_IMG.miniDesert, alt: '고비사막의 모래언덕', title: ['견적서는 24시간 안에', '알림톡으로 도착해요'], sub: '한국어 스태프가 직접 준비해요' },
    { img: '/img/regions/khuvsgul.webp', alt: '침엽수 숲으로 둘러싸인 푸른 호수', title: ['인원·일정·가고 싶은 곳만', '알려 주세요'], sub: '3분이면 충분해요' },
];
const STEPS = [
    { title: '요청서 작성', sub: '3분이면 충분해요' },
    { title: '맞춤 견적서', sub: '24시간 안에' },
    { title: '예약 확정', sub: '견적 확인 후' },
];

/**
 * 휴대폰 맞춤 견적 요청(Claude Design ‘맞춤 견적 — 모바일’): ‘← 맞춤 견적 ✕’ 줄 → 넘기는 소개 사진 3장 → 진행 3단계 →
 * 8개 입력 구역 → 요약(입력 중: 요청할 여행 / 모두 입력: 요청서 영수증) → 아래 붙는 줄(8칸 진행 · 다음 입력 항목 · 카카오톡 · 요청하기).
 * 선택지·검증·제출은 PC와 같은 quoteForm.ts / useQuoteForm.ts.
 */
export function CustomEstimateMobile() {
    const navigate = useNavigate();
    const { pick } = useSpotImages();
    const q = useQuoteForm();
    const { form, set, steps } = q;
    const [touched, setTouched] = useState({ phone: false, email: false });
    const pax = totalPax(form);
    const vehicle = vehicleAdvice(form);
    const phoneBad = touched.phone && !!form.phone && !PHONE_RE.test(form.phone);
    const emailBad = touched.email && !!form.email.trim() && !EMAIL_RE.test(form.email.trim());
    const jump = (step: number) => scrollToQuoteStep(step - 1);
    const close = () => { navigate('/'); window.scrollTo(0, 0); };

    const closeBtn = (
        <button type="button" aria-label="닫기" onClick={close}
            style={{ width: 44, height: 44, border: 'none', background: 'transparent', color: SD.gray900, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
            <SIcon name="close" size={22} stroke={1.8} />
        </button>
    );

    return (
        <MobileShell title="맞춤 견적" brandHeader={false} footer={false} titleAction={closeBtn}
            bottomBar={<ActionBar steps={steps} canSubmit={q.canSubmit} submitting={q.submitting} error={q.error} onSubmit={q.submit} onJump={jump} />}>
            <div style={{ background: SD.white, color: SD.gray900 }}>
                <HeroSlides />

                <section style={{ padding: '20px 20px 24px', borderBottom: `8px solid ${SD.gray50}` }}>
                    <ol aria-label="진행 순서" style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', gap: 6 }}>
                        {STEPS.map((s, i) => (
                            <li key={s.title} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 10px', borderRadius: 12, background: SD.gray50 }}>
                                <span style={{ width: 22, height: 22, boxSizing: 'border-box', borderRadius: 9999, background: i === 0 ? SD.gray900 : SD.white, border: i === 0 ? 'none' : `1.5px solid ${SD.gray200}`,
                                    color: i === 0 ? SD.white : SD.gray700, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                                <span style={{ fontSize: 13, fontWeight: 700 }}>{s.title}</span>
                                <span style={{ fontSize: 11, color: SD.gray600 }}>{s.sub}</span>
                            </li>
                        ))}
                    </ol>
                    {q.recent && (
                        <a href={myQuotePath(q.recent.token)} style={{ marginTop: 14, display: 'inline-flex', fontSize: 12, color: SD.gray700, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                            이전에 요청한 견적 보기{quoteLinkDate(q.recent.createdAt) ? ` (${quoteLinkDate(q.recent.createdAt)} 요청)` : ''}
                        </a>
                    )}
                </section>

                <QSection compact n={1} title="가고 싶은 곳" sub="투어 1개 선택" done={steps[0]}>
                    <QDestinations compact form={form} pick={pick} onPick={q.pickDestination} onToggleSpot={(name) => q.toggleIn('destSpots', name)} />
                </QSection>

                <QSection compact n={2} title="여행 기간" sub="몽골 입국일과 귀국일" done={steps[1]}>
                    <QDates compact form={form} onDepart={q.pickDepart} onReturn={(v) => set({ return_: v })} />
                </QSection>

                <QSection compact n={3} title="참가 인원" sub="성인 1명 이상" done={steps[2]}>
                    <QPeople form={form} set={set} max={MAX_PAX} />
                </QSection>

                <QSection compact n={4} title="여행 스타일" sub="동행 형태와 여행 취향" done={steps[3]}>
                    <QLabel required>누구와 떠나시나요?</QLabel>
                    <QChips scroll label="동행 형태" options={TRIP_TYPES} isOn={(v) => form.tripType === v} onPick={(v) => set({ tripType: v })} />
                    <QLabel top note="선택 · 여러 개 가능">어떤 경험을 원하시나요?</QLabel>
                    <QChips scroll label="여행 취향" options={TRAVEL_STYLES} isOn={(v) => form.travelStyles.includes(v)} onPick={(v) => q.toggleIn('travelStyles', v)} />
                </QSection>

                <QSection compact n={5} title="숙소·차량" sub="시내 숙소 · 게르 등급 · 차량" done={steps[4]}>
                    <QLabel required>시내(울란바토르) 숙소</QLabel>
                    <QChips scroll label="시내 숙소" options={CITY_STAYS} isOn={(v) => form.cityStay === v} onPick={(v) => set({ cityStay: v })} />
                    <QHint>호텔 등급은 객실 상태와 조식·부대시설 수준을 기준으로 선택해 주세요.</QHint>
                    <QLabel top required note="시내 외 지역은 게르만 가능해요">투어 지역 게르 등급</QLabel>
                    <QChips scroll label="게르 등급" options={GER_STAYS} isOn={(v) => form.gerStay === v} onPick={(v) => set({ gerStay: v })} />
                    <QHint>고급 게르는 전용 또는 개선된 편의시설을 우선 배정하며, 지역별 실제 시설은 견적서에서 확인할 수 있어요.</QHint>
                    <QLabel top required>차량</QLabel>
                    <QVehicles compact options={VEHICLES} value={form.vehicle} pax={pax} onPick={(v) => set({ vehicle: v })} />
                    <QHint warn={vehicle.warn}>{vehicle.text}</QHint>
                </QSection>

                <QSection compact n={6} title="항공권" sub="발행 여부" done={steps[5]}>
                    <p style={{ margin: '-8px 0 14px', fontSize: 13, color: SD.gray600 }}>이미 발권하셨다면 도착·출발 일시를 알려 주세요. 견적서와 픽업·드랍 안내에 반영돼요.</p>
                    <QChips label="항공권 발행 여부" options={FLIGHT_OPTIONS} isOn={(v) => form.flightIssued === v} onPick={(v) => set({ flightIssued: v })} />
                    {flightYes(form) && (
                        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
                            <QField label="몽골 도착 일시 (IN)" required><input type="datetime-local" value={form.flightIn} onChange={(e) => set({ flightIn: e.target.value })} style={{ ...Q_INPUT, fontSize: 16 }} /></QField>
                            <QField label="몽골 출발 일시 (OUT)" required><input type="datetime-local" value={form.flightOut} onChange={(e) => set({ flightOut: e.target.value })} style={{ ...Q_INPUT, fontSize: 16 }} /></QField>
                        </div>
                    )}
                    {form.flightIssued === FLIGHT_NO && <QHint>괜찮아요! 견적서에는 미정으로 표시되고, 발권 후 알려 주시면 일정에 반영해 드려요.</QHint>}
                </QSection>

                <QSection compact n={7} title="연락처" sub="견적서를 받으실 곳" done={steps[6]}>
                    {/* 휴대폰에서 입력칸을 누를 때 화면이 확대되지 않도록 글자는 16px */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
                        <QField label="신청자 이름" required>
                            <input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="이름" autoComplete="name" maxLength={40} style={{ ...Q_INPUT, fontSize: 16 }} />
                        </QField>
                        <QField label="휴대폰 번호" required error={phoneBad ? '휴대폰 번호는 숫자 9~11자리로 입력해 주세요.' : undefined}>
                            <input type="tel" inputMode="numeric" value={form.phone} onChange={(e) => set({ phone: phoneDigits(e.target.value) })} onBlur={() => setTouched((t) => ({ ...t, phone: true }))}
                                placeholder="01012345678 (숫자만)" autoComplete="tel" maxLength={20} style={{ ...Q_INPUT, fontSize: 16 }} />
                        </QField>
                        <QField label="이메일" required error={emailBad ? '이메일 주소 형식을 확인해 주세요.' : undefined}>
                            <input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                                placeholder="example@email.com" autoComplete="email" maxLength={120} style={{ ...Q_INPUT, fontSize: 16 }} />
                        </QField>
                        <QField label="카카오톡 ID" note="선택">
                            <input value={form.kakaoId} onChange={(e) => set({ kakaoId: e.target.value })} placeholder="카카오톡 상담을 원하시면 입력해 주세요" autoComplete="off" maxLength={80} style={{ ...Q_INPUT, fontSize: 16 }} />
                        </QField>
                    </div>
                </QSection>

                <QSection compact n={8} title="요청 사항·동의" sub="확인 후 요청하기" done={steps[7]}>
                    <QField label="요청 사항" note="선택">
                        <textarea value={form.request} onChange={(e) => set({ request: e.target.value })} maxLength={2000}
                            placeholder={'예) 승마 체험과 별 관측을 꼭 넣고 싶어요.\n아이와 함께라 이동 시간이 짧았으면 해요.'}
                            style={{ ...Q_INPUT, height: 120, padding: '14px 16px', fontSize: 16, lineHeight: 1.6, resize: 'none' }} />
                    </QField>
                    <QFile compact fileName={form.fileName} state={q.fileState} note={q.fileNote} onPick={q.pickFile} onRemove={q.removeFile} />
                    <div style={{ marginTop: 16 }}>
                        <QCheckRow on={form.agree} onToggle={() => set({ agree: !form.agree })} gray
                            title={<>개인정보 수집 및 이용에 동의합니다. <span style={{ color: SD.mint500 }}>*</span></>} sub="이름·연락처·이메일은 견적 상담 목적으로만 사용돼요." />
                    </div>
                </QSection>

                <section aria-label={q.canSubmit ? '견적 요청서' : '입력 현황'} style={{ padding: q.canSubmit ? '24px 20px 40px' : '24px 20px 32px', background: SD.gray50 }}>
                    {q.canSubmit ? <QReceipt compact form={form} /> : <QStatusCard compact form={form} onJump={jump} />}
                </section>
                <QuoteHoneypot value={form.website} onChange={(v) => set({ website: v })} />
            </div>
        </MobileShell>
    );
}

/** 넘기는 소개 사진 3장 + ‘1 / 3’. */
function HeroSlides() {
    const track = useRef<HTMLDivElement>(null);
    const [idx, setIdx] = useState(0);
    const onScroll = () => {
        const el = track.current;
        if (el && el.clientWidth) setIdx(Math.round(el.scrollLeft / el.clientWidth));
    };
    return (
        <section aria-label="맞춤 견적 소개" aria-roledescription="캐러셀" style={{ position: 'relative' }}>
            <div ref={track} onScroll={onScroll} className="q-hscroll" style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
                <style>{'.q-hscroll::-webkit-scrollbar{display:none}'}</style>
                {SLIDES.map((s, i) => (
                    <div key={s.img} role="group" aria-roledescription="슬라이드" aria-label={`${i + 1} / ${SLIDES.length}`} style={{ position: 'relative', flex: '0 0 100%', height: 300, scrollSnapAlign: 'start' }}>
                        <img src={s.img} alt={s.alt} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <span aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.62) 100%)' }} />
                        <div style={{ position: 'absolute', left: 20, right: 72, bottom: 22, color: SD.white }}>
                            {i === 0
                                ? <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.3px', textShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>{s.title[0]}<br />{s.title[1]}</h1>
                                : <p style={{ margin: 0, fontSize: 22, fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.3px', textShadow: '0 1px 6px rgba(0,0,0,0.25)' }}>{s.title[0]}<br />{s.title[1]}</p>}
                            <p style={{ margin: '6px 0 0', fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{s.sub}</p>
                        </div>
                    </div>
                ))}
            </div>
            <span style={{ position: 'absolute', right: 16, bottom: 22, height: 24, padding: '0 10px', borderRadius: 9999, background: 'rgba(0,0,0,0.45)', color: SD.white, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <strong>{idx + 1}</strong><span style={{ opacity: 0.7 }}>/ {SLIDES.length}</span>
            </span>
        </section>
    );
}

/** 아래 붙는 줄: 8칸 진행 · 다음에 입력할 항목(누르면 그 구역) · 카카오톡 · 요청하기. */
function ActionBar({ steps, canSubmit, submitting, error, onSubmit, onJump }: {
    steps: boolean[]; canSubmit: boolean; submitting: boolean; error: string; onSubmit: () => void; onJump: (step: number) => void;
}) {
    const done = steps.filter(Boolean).length;
    const next = steps.findIndex((x) => !x);
    return (
        <div data-mw-actionbar="" style={{ position: 'sticky', bottom: 0, zIndex: 30, background: SD.white, borderTop: `1px solid ${SD.gray200}`, padding: '0 16px calc(12px + env(safe-area-inset-bottom))' }}>
            <div style={{ margin: '0 -16px' }}><QProgress steps={steps} height={3} gap={2} /></div>
            {error && <div style={{ marginTop: 10 }}><QError message={error} /></div>}
            <div style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                {next >= 0 ? (
                    <button type="button" onClick={() => onJump(next + 1)}
                        style={{ minWidth: 0, padding: 0, border: 'none', background: 'transparent', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: SD.gray700, cursor: 'pointer' }}>
                        <strong style={{ color: SD.gray900 }}>{QUOTE_STEP_LABELS[next]}</strong>부터 입력해 주세요<SIcon name="chevronRight" size={14} stroke={2} />
                    </button>
                ) : <span style={{ fontSize: 13, fontWeight: 700, color: SD.gray900 }}>모든 항목을 입력했어요</span>}
                <span style={{ flex: 'none', fontSize: 12, color: SD.gray500 }}><strong style={{ color: SD.gray900 }}>{done}</strong>/{steps.length} 완료</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <QKakaoLink style={{ flex: 'none', width: 52, height: 52, boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${SD.gray200}` }} />
                <button type="button" onClick={onSubmit} disabled={submitting}
                    style={{ ...boxButton('primary', 'large', true), flex: '1 1 auto', height: 52, borderRadius: 12,
                        ...(canSubmit ? null : { background: SD.gray200, color: SD.gray500 }), opacity: submitting ? 0.6 : 1 }}>
                    {submitting ? '요청 보내는 중…' : canSubmit ? '무료로 견적 요청하기' : '견적 요청하기'}
                </button>
            </div>
        </div>
    );
}
